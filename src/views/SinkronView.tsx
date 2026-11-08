import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "../lib/store";
import { SPREADSHEET_ID, rentangSetelahGeser, saranNamaMinggu, slotLabel, tanggalPendek, timById } from "../lib/model";
import { APPS_SCRIPT, SCRIPT_VERSI, blokSalin } from "../lib/sheet";
import { jamSinkron, waktuSinkron } from "../lib/sync";
import { tautanSiapPakai } from "../lib/koneksi";
import { Btn, Card, I, Pill, Spinner, cx, salin, useToast } from "../components/ui";
import { StatusSinkron } from "../components/SyncBadge";
import { StateGate } from "./common";

export default function SinkronView({ params }: { params: URLSearchParams }) {
  const {
    week,
    weeks,
    tabs,
    settings,
    setSettings,
    putuskanKoneksi,
    reload,
    buatMingguBaru,
    dirtyCount,
    pendingCount,
    syncState,
    syncLog,
    syncNow,
    kirimSemua,
    tandaiManual,
    hapusLog,
    tautan,
    terapkanTautan,
    buangTautan,
    versiSkrip,
    periksaSkrip,
    skripInfo,
    masukAdmin,
    keluarAdmin,
    terkunciAktif,
    aturKunciMinggu,
  } = useApp();
  const toast = useToast();
  const [copied, setCopied] = useState("");
  const [busy, setBusy] = useState<"" | "tes" | "kirim">("");
  const [hasil, setHasil] = useState<{ ok: boolean; text: string } | null>(null);
  const [bukaKode, setBukaKode] = useState(false);
  const [bukaKoneksi, setBukaKoneksi] = useState(false);
  const [bukaCadangan, setBukaCadangan] = useState(false);
  // minggu baru
  const [sumberGid, setSumberGid] = useState(settings.activeGid);
  const [namaManual, setNamaManual] = useState<string | null>(null);
  const [geser, setGeser] = useState(7);
  const [busyBuat, setBusyBuat] = useState(false);
  const [hasilBuat, setHasilBuat] = useState<{ ok: boolean; text: string } | null>(null);
  const refBuat = useRef<HTMLDivElement>(null);
  // isian koneksi memakai draf: URL & token yang sudah ada tidak pernah terhapus saat mengetik/keluar kolom
  const [urlDraf, setUrlDraf] = useState(settings.scriptUrl);
  const [tokenDraf, setTokenDraf] = useState(settings.token);
  // mode admin: PIN diverifikasi skrip, disimpan hanya di perangkat ini
  const [pinDraf, setPinDraf] = useState("");
  const [busyPin, setBusyPin] = useState(false);
  const [pesanPin, setPesanPin] = useState<{ ok: boolean; text: string } | null>(null);
  const [tampilToken, setTampilToken] = useState(false);

  useEffect(() => {
    setUrlDraf(settings.scriptUrl);
    setTokenDraf(settings.token);
  }, [settings.scriptUrl, settings.token]);

  // sumber template: tab aktif atau tab lain yang sudah terbaca di perangkat ini
  const sumberWeek = weeks[sumberGid] ?? (sumberGid === settings.activeGid ? week : null);
  const dasar = sumberWeek ?? week;
  const saranNama = useMemo(() => (dasar ? saranNamaMinggu(dasar, geser) : ""), [dasar, geser]);
  const namaBaru = namaManual ?? saranNama;
  const rentangBaru = useMemo(() => (sumberWeek ? rentangSetelahGeser(sumberWeek.dates, geser) : null), [sumberWeek, geser]);

  // Bila tab yang aktif berganti (mis. setelah tab baru dibuat), saran nama ikut menyesuaikan.
  useEffect(() => {
    setSumberGid(settings.activeGid);
    setNamaManual(null);
  }, [settings.activeGid]);

  // Tombol "Minggu baru" di bilah atas membuka bagian ini langsung.
  useEffect(() => {
    if (params.get("buat")) {
      const t = window.setTimeout(() => refBuat.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
      return () => window.clearTimeout(t);
    }
  }, [params]);

  const blok = useMemo(() => (week ? blokSalin(week) : []), [week]);
  if (!week) return <StateGate />;

  const terpasang = !!settings.scriptUrl && !!settings.token;
  /** Mode admin: PIN sudah diverifikasi skrip di perangkat ini. */
  const admin = !!(settings.pinAdmin ?? "").trim();
  const tautanSama = !!tautan && tautan.scriptUrl === settings.scriptUrl && tautan.token === settings.token;
  const urlValid = /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec/.test(settings.scriptUrl);
  const sheetUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit#gid=${week.gid}`;

  const simpanKoneksi = (diam = false) => {
    const url = urlDraf.trim();
    const tok = tokenDraf.trim();
    const patch: { scriptUrl?: string; token?: string } = {};
    if (url && url !== settings.scriptUrl) patch.scriptUrl = url;
    if (tok && tok !== settings.token) patch.token = tok;
    if (!Object.keys(patch).length) {
      setUrlDraf(settings.scriptUrl);
      setTokenDraf(settings.token);
      if (!diam) toast("Koneksi tidak berubah", "info");
      return;
    }
    setSettings(patch);
    if (patch.scriptUrl || patch.token) void periksaSkrip();
    toast("Koneksi disimpan di perangkat ini");
    setHasil({ ok: true, text: "URL & token tersimpan di perangkat ini — tidak terhapus saat data diperbarui atau aplikasi dimuat ulang." });
  };

  const bukaAdmin = async () => {
    if (!pinDraf.trim()) return;
    setBusyPin(true);
    const r = await masukAdmin(pinDraf);
    setBusyPin(false);
    if (r.ok) {
      setPesanPin({ ok: true, text: "Mode admin aktif di perangkat ini. PIN tidak dikirim ke sheet." });
      setPinDraf("");
      toast("Mode admin aktif");
    } else {
      setPesanPin({ ok: false, text: r.error ?? "PIN admin salah." });
    }
  };

  const putus = () => {
    const yakin = window.confirm(
      "Putuskan koneksi Apps Script di perangkat ini?\n\nURL Web App dan token akan dihapus dari perangkat ini saja. Isi Google Sheet tidak berubah, dan isian yang belum terkirim tetap tersimpan.",
    );
    if (!yakin) return;
    putuskanKoneksi();
    setUrlDraf("");
    setTokenDraf("");
    setHasil(null);
    toast("Koneksi diputus di perangkat ini", "info");
  };

  const doCopy = async (id: string, text: string, pesan?: string) => {
    const ok = await salin(text);
    if (ok) {
      setCopied(id);
      toast(pesan ?? "Tersalin");
      window.setTimeout(() => setCopied((c) => (c === id ? "" : c)), 2400);
    } else toast("Gagal menyalin, izinkan akses clipboard", "err");
  };

  const tes = async () => {
    if (!settings.scriptUrl) return;
    setBusy("tes");
    setHasil(null);
    const r = await periksaSkrip();
    if (r.ok) {
      setHasil({
        ok: true,
        text: `Terhubung ke “${r.nama}” (skrip v${r.versi ?? "?"}) · ${r.jumlahTab ?? 0} tab.${r.versi && r.versi !== SCRIPT_VERSI ? ` Skrip perlu diperbarui ke v${SCRIPT_VERSI} agar bisa membuat tab baru.` : ""}`,
      });
    } else setHasil({ ok: false, text: r.error ?? "Skrip merespons, tetapi tidak valid." });
    setBusy("");
  };

  const buatMinggu = async () => {
    const nama = namaBaru.replace(/\s+/g, " ").trim();
    if (!nama) {
      setHasilBuat({ ok: false, text: "Isi nama tab baru dulu." });
      return;
    }
    if (tabs.some((t) => t.name.trim().toLowerCase() === nama.toLowerCase())) {
      setHasilBuat({ ok: false, text: `Tab “${nama}” sudah ada. Pakai nama lain, mis. ${saranNama}.` });
      return;
    }
    setBusyBuat(true);
    setHasilBuat(null);
    const r = await buatMingguBaru({ nama, sumberGid, geserHari: geser });
    if (!r.ok) {
      setBusyBuat(false);
      setHasilBuat({ ok: false, text: r.error ?? "Tab baru gagal dibuat." });
      return;
    }
    // segarkan daftar tab langsung dari skrip (urutan & nama sama dengan sheet)
    await periksaSkrip();
    // daftar dari skrip bisa saja belum memuat tab yang baru dibuat — jangan sampai hilang
    const daftar = tabs.some((t) => t.gid === r.gid) ? null : [{ name: r.nama ?? nama, gid: String(r.gid) }, ...tabs];
    if (daftar) setSettings({ extraTabs: daftar });
    setBusyBuat(false);
    setNamaManual(null);
    setHasilBuat({
      ok: true,
      text:
        `Tab “${r.nama}” dibuat di spreadsheet: struktur minggu sebelumnya disalin, isian dikosongkan, tanggal digeser ${geser ? `+${geser} hari` : "tidak (sama)"}. ` +
        (r.terbaca === false ? "Isinya belum terbaca dari sheet — tekan “Muat ulang dari Sheet” sebentar lagi." : "Aplikasi sudah pindah ke tab itu."),
    });
    toast(`Tab “${r.nama}” dibuat`);
  };

  const kirimSekarang = async () => {
    setBusy("kirim");
    setHasil(null);
    await syncNow();
    setBusy("");
    toast("Pengiriman dijalankan — lihat status di atas");
  };

  const buatTautan = () =>
    tautanSiapPakai(window.location.origin, window.location.pathname, {
      scriptUrl: settings.scriptUrl,
      token: settings.token,
    });

  const dirtyList = Object.keys(week.dirty).map((dk) => {
    const [cat, ...rest] = dk.split(":");
    const k = rest.join(":");
    const [a, b, c] = k.split("|");
    if (cat === "A") return { dk, label: `${slotLabel(a, b ? b[0].toUpperCase() + b.slice(1) : "")} · ${tanggalPendek(c)}`, jenis: "Kegiatan" };
    if (cat === "L") return { dk, label: slotLabel(a, b ? b[0].toUpperCase() + b.slice(1) : ""), jenis: "Lampiran" };
    if (cat === "B") return { dk, label: timById(k)?.label ?? k, jenis: "Rencana" };
    if (cat === "C") return { dk, label: tanggalPendek(k), jenis: "Presensi" };
    return { dk, label: tanggalPendek(k), jenis: "Aplikasi presensi" };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[13px] font-medium text-muted">Tab {week.tab}</p>
          <h1 className="mt-1 text-[24px] font-extrabold tracking-tight sm:text-[28px]">Sinkronisasi otomatis</h1>
          <p className="mt-1 max-w-[620px] text-[13px] leading-relaxed text-muted">
            Setiap isian yang Anda simpan <b className="text-ink">langsung ditulis ke Google Sheet</b> — tanpa menyalin
            dan tanpa menekan tombol kirim.
          </p>
        </div>
        <a href={sheetUrl} target="_blank" rel="noreferrer">
          <Btn variant="ghost">
            <I.sheet className="h-4 w-4 text-brand" /> Buka tab di Sheet
          </Btn>
        </a>
      </div>

      {/* pengaturan dari tautan rekan */}
      {tautan && (
        <Card className="anim-pop border-brand/40 bg-brand-soft/60 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-brand">
              <I.bolt className="h-5 w-5" />
            </span>
            <div className="min-w-[220px] flex-1">
              <p className="text-[13.5px] font-bold">
                {tautanSama ? "Tautan ini sama dengan koneksi tersimpan" : terpasang ? "Perangkat ini sudah tersambung" : "Tautan berisi pengaturan sinkron"}
              </p>
              <p className="text-[12px] leading-relaxed text-muted">
                {tautanSama
                  ? "Tidak ada yang perlu diubah — URL & token yang tersimpan tetap dipakai."
                  : terpasang
                    ? "Tautan membawa URL/token lain. Koneksi yang sekarang tetap aman bila Anda memilih pertahankan."
                    : "Sekali klik, perangkat ini langsung ikut mengirim otomatis ke sheet."}
              </p>
            </div>
            <div className="flex gap-2">
              <Btn variant="ghost" size="sm" onClick={buangTautan}>
                {terpasang ? "Pertahankan yang ada" : "Nanti"}
              </Btn>
              {!tautanSama && (
                <Btn variant="brand" size="sm" onClick={terapkanTautan}>
                  <I.check className="h-3.5 w-3.5" /> {terpasang ? "Ganti dengan tautan ini" : "Aktifkan"}
                </Btn>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* mode admin */}
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className={cx("grid h-11 w-11 shrink-0 place-items-center rounded-2xl", admin ? "bg-ink text-white" : "bg-paper text-muted")}>
              <I.lock className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[15.5px] font-bold">{admin ? "Mode admin aktif di perangkat ini" : "Mode admin"}</p>
              <p className="mt-0.5 max-w-[560px] text-[12.5px] leading-relaxed text-muted">
                {admin
                  ? "Pengaturan koneksi, tautan siap pakai, pembuatan minggu baru, dan kirim ulang seluruh isian terbuka. PIN tidak disimpan di skrip — hanya di perangkat ini."
                  : "Untuk pengurus: buka mode admin agar pengaturan koneksi, tautan siap pakai, minggu baru, dan kirim ulang seluruh isian bisa dipakai. PIN disetel di Apps Script → Project Settings → Script Properties → PIN_ADMIN."}
              </p>
              {!admin && skripInfo?.adaPin === false && (
                <p className="mt-1.5 text-[12px] font-semibold text-warn">PIN_ADMIN belum disetel di skrip.</p>
              )}
            </div>
          </div>
          {admin ? (
            <Btn
              variant="ghost"
              onClick={() => {
                keluarAdmin();
                setPesanPin(null);
                toast("Mode admin ditutup di perangkat ini", "info");
              }}
            >
              <I.x className="h-4 w-4" /> Tutup mode admin
            </Btn>
          ) : (
            <div className="flex items-end gap-2">
              <label className="block">
                <span className="block text-[11.5px] font-semibold text-muted">PIN admin</span>
                <input
                  type="password"
                  value={pinDraf}
                  onChange={(e) => setPinDraf(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    void bukaAdmin();
                  }}
                  placeholder="••••••"
                  className="mt-1 h-10 w-[150px] rounded-xl border border-line bg-paper px-3 font-mono text-[12.5px] outline-none transition focus:border-brand focus:bg-white"
                />
              </label>
              <Btn variant="brand" onClick={() => void bukaAdmin()} disabled={busyPin || !terpasang || !pinDraf.trim()}>
                {busyPin ? <Spinner className="h-4 w-4" /> : <I.lock className="h-4 w-4" />} Buka
              </Btn>
            </div>
          )}
        </div>
        {pesanPin && !admin && (
          <p className={cx("mt-3 rounded-xl px-3 py-2 text-[12px]", pesanPin.ok ? "bg-brand-soft text-[#0b5e42]" : "bg-bad-soft text-bad")}>
            {pesanPin.text}
          </p>
        )}
        {admin && terkunciAktif && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-paper p-3">
            <p className="text-[12px] leading-relaxed text-muted">
              Minggu <b className="text-ink">{week.tab}</b> sudah ditutup (bukan minggu terbaru), jadi isiannya tidak dikirim ke sheet.
            </p>
            <Btn
              variant="ghost"
              size="sm"
              className="bg-white"
              onClick={() => {
                void (async () => {
                  const r = await aturKunciMinggu(week.gid, true);
                  toast(r.ok ? `Minggu “${week.tab}” dibuka kembali` : r.error ?? "Gagal membuka kunci", r.ok ? "ok" : "err");
                })();
              }}
            >
              <I.lock className="h-3.5 w-3.5" /> Buka kunci minggu ini
            </Btn>
          </div>
        )}
      </Card>

      {/* status & kontrol */}
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span
              className={cx(
                "grid h-11 w-11 shrink-0 place-items-center rounded-2xl",
                syncState.status === "error" ? "bg-bad-soft text-bad" : terpasang && settings.autoSync ? "bg-brand-soft text-brand" : "bg-warn-soft text-warn",
              )}
            >
              {syncState.status === "sending" ? <Spinner className="h-5 w-5" /> : <I.bolt className="h-5 w-5" />}
            </span>
            <div>
              <p className="text-[15.5px] font-bold">
                {!terpasang
                  ? "Sinkron otomatis belum aktif"
                  : !settings.autoSync
                    ? "Sinkron otomatis dimatikan"
                    : syncState.status === "error"
                      ? "Pengiriman gagal"
                      : syncState.status === "offline"
                        ? "Menunggu koneksi"
                        : "Sinkron otomatis aktif"}
              </p>
              <p className="mt-0.5 max-w-[520px] text-[12.5px] leading-relaxed text-muted">
                {!terpasang
                  ? "Pasang jembatan Apps Script satu kali (langkah di bawah), lalu isian Anda langsung masuk sheet."
                  : settings.autoSync
                    ? "Isian dikirim ±1 detik setelah disimpan. Bila koneksi putus, isian tersimpan dan dikirim ulang otomatis."
                    : "Isian hanya tersimpan di perangkat ini sampai Anda menekan “Sinkronkan sekarang”."}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <StatusSinkron />
                {pendingCount > 0 && <Pill tone="warn">{pendingCount} isian tertunda</Pill>}
                {syncState.at && <Pill>Terakhir {waktuSinkron(syncState.at)}</Pill>}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-line px-4 py-3">
            <div>
              <p className="text-[12.5px] font-bold">Kirim otomatis</p>
              <p className="text-[11px] text-muted">tanpa menekan tombol</p>
            </div>
            <button
              role="switch"
              aria-checked={settings.autoSync}
              onClick={() => setSettings({ autoSync: !settings.autoSync })}
              className={cx(
                "relative h-7 w-12 shrink-0 rounded-full transition-colors",
                settings.autoSync ? "bg-brand" : "bg-[#dcdbd4]",
              )}
              title={settings.autoSync ? "Matikan sinkron otomatis" : "Aktifkan sinkron otomatis"}
            >
              <span
                className={cx(
                  "absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all",
                  settings.autoSync ? "left-[22px]" : "left-0.5",
                )}
              />
            </button>
          </div>
        </div>

        {syncState.status === "error" && syncState.pesan && (
          <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-bad-soft p-3 text-[12.5px] leading-relaxed text-bad">
            <I.alert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {syncState.pesan}
              {!!syncState.percobaan && syncState.percobaan <= 4 && " Mencoba ulang otomatis…"}
            </span>
          </div>
        )}

        {!!syncState.gagal?.length && (
          <div className="mt-4 rounded-xl bg-warn-soft p-3 text-[12.5px] leading-relaxed text-warn">
            <b>{syncState.gagal.length} baris tidak ditemukan di sheet</b> — biasanya karena tim/tanggal belum ada di tab ini.
            Tambahkan barisnya di sheet lalu muat ulang. Contoh: {syncState.gagal.slice(0, 3).join(", ")}.
          </div>
        )}

        {dirtyList.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="mr-1 text-[12px] font-semibold text-muted">Menunggu dikirim:</span>
            {dirtyList.slice(0, 12).map((d) => (
              <Pill key={d.dk} tone="warn">
                {d.jenis} · {d.label}
              </Pill>
            ))}
            {dirtyList.length > 12 && <Pill>+{dirtyList.length - 12} lagi</Pill>}
            {pendingCount > dirtyCount && <Pill>+{pendingCount - dirtyCount} di tab lain</Pill>}
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-4">
          <Btn variant="brand" onClick={kirimSekarang} disabled={!terpasang || busy !== ""}>
            {busy === "kirim" ? <Spinner /> : <I.send className="h-4 w-4" />}
            Sinkronkan sekarang
          </Btn>
          <Btn variant="ghost" onClick={() => void reload()} disabled={busy !== ""}>
            <I.refresh className="h-4 w-4" /> Muat ulang dari Sheet
          </Btn>
          {admin && (
            <Btn
              variant="soft"
              onClick={() => {
                kirimSemua();
                toast("Seluruh isian tab ini akan ditulis ulang ke Sheet");
              }}
              disabled={!terpasang || busy !== ""}
              title="Tulis seluruh isian tab ini ke sheet (untuk pemulihan) — hanya admin"
            >
              <I.sheet className="h-4 w-4" /> Kirim ulang semua isian
            </Btn>
          )}
          {!terpasang && (
            <span className="text-[12px] text-warn">Isi URL Web App & token di bawah untuk mengaktifkan.</span>
          )}
        </div>
      </Card>

      {/* minggu baru */}
      <div ref={refBuat} id="minggu-baru" className="scroll-mt-24">
        <Card className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand">
                <I.cal className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-[16px] font-bold">Minggu baru</h2>
                <p className="mt-0.5 max-w-[620px] text-[12.5px] leading-relaxed text-muted">
                  Buat tab minggu berikutnya <b className="text-ink">di dalam spreadsheet</b>: struktur, judul, dan nama tim
                  disalin dari tab yang dipilih — isian laporan, presensi, dan tautan bukti dikosongkan.
                </p>
              </div>
            </div>
            <Pill tone="brand">Tab aktif: {week.tab}</Pill>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_290px]">
            <div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-[12px] font-semibold text-muted" htmlFor="sumber-minggu">
                    Salin struktur dari tab
                  </label>
                  <select
                    id="sumber-minggu"
                    value={sumberGid}
                    onChange={(e) => {
                      setSumberGid(e.target.value);
                      setNamaManual(null);
                      setHasilBuat(null);
                    }}
                    className="mt-1.5 h-11 w-full rounded-xl border border-line bg-white px-3 text-[13px] font-semibold outline-none transition focus:border-brand"
                  >
                    {tabs.map((t) => (
                      <option key={t.gid} value={t.gid}>
                        Tab {t.name}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-[11.5px] text-muted">
                    {sumberWeek?.dates.length
                      ? `${sumberWeek.dates.length} tanggal · ${sumberWeek.dates[0]} – ${sumberWeek.dates[sumberWeek.dates.length - 1]}`
                      : "Isi tab ini belum terbaca di perangkat ini."}
                  </p>
                </div>

                <div>
                  <label className="block text-[12px] font-semibold text-muted" htmlFor="nama-minggu">
                    Nama tab baru
                  </label>
                  <input
                    id="nama-minggu"
                    value={namaBaru}
                    onChange={(e) => setNamaManual(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && terpasang && !busyBuat) {
                        e.preventDefault();
                        void buatMinggu();
                      }
                    }}
                    placeholder="cth. Nov II"
                    className="mt-1.5 h-11 w-full rounded-xl border border-line bg-white px-3 text-[13px] font-semibold outline-none transition focus:border-brand"
                  />
                  <p className="mt-1 flex items-center gap-1.5 text-[11.5px] text-muted">
                    Saran otomatis
                    {namaManual !== null && namaBaru !== saranNama && (
                      <button type="button" onClick={() => setNamaManual(null)} className="font-semibold text-brand underline-offset-2 hover:underline">
                        pakai “{saranNama}”
                      </button>
                    )}
                  </p>
                </div>
              </div>

              <div className="mt-3">
                <p className="text-[12px] font-semibold text-muted">Tanggal di tab baru</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  {[
                    { v: 7, label: "+7 hari (minggu berikutnya)" },
                    { v: 0, label: "Biarkan sama" },
                  ].map((o) => (
                    <button
                      key={o.v}
                      type="button"
                      onClick={() => setGeser(o.v)}
                      className={cx(
                        "rounded-xl border px-3 py-2 text-[12.5px] font-semibold transition-colors",
                        geser === o.v ? "border-brand bg-brand-soft text-brand" : "border-line bg-white text-muted hover:bg-paper",
                      )}
                    >
                      {geser === o.v ? <I.check className="mr-1 inline h-3.5 w-3.5" /> : null}
                      {o.label}
                    </button>
                  ))}
                </div>
                {rentangBaru && (
                  <p className="mt-1.5 text-[11.5px] text-muted">
                    Tanggal pada tab baru:{" "}
                    <b className="text-ink">
                      {rentangBaru.dari === rentangBaru.sampai ? rentangBaru.dari : `${rentangBaru.dari} – ${rentangBaru.sampai}`}
                    </b>
                    {geser === 0 && " (sama seperti tab sumber)"}
                  </p>
                )}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Btn variant="brand" onClick={() => void buatMinggu()} disabled={!terpasang || busyBuat || !namaBaru.trim()}>
                  {busyBuat ? <Spinner /> : <I.plus className="h-4 w-4" />}
                  {busyBuat ? "Membuat tab…" : "Buat tab minggu baru"}
                </Btn>
                <a href={`https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit`} target="_blank" rel="noreferrer">
                  <Btn variant="ghost" size="sm">
                    <I.sheet className="h-4 w-4 text-brand" /> Lihat spreadsheet
                  </Btn>
                </a>
              </div>

              {!terpasang && (
                <div className="mt-3 rounded-xl bg-warn-soft p-3 text-[12px] leading-relaxed text-warn">
                  <b>Butuh koneksi Apps Script.</b> Isi URL Web App & token di bagian Koneksi di bawah, lalu buat tab dari sini.
                  Sementara itu, buat manual: klik kanan tab minggu terakhir di Google Sheet → <b>Duplikat</b> → ganti nama →
                  hapus isian uraian, presensi, dan tautan.
                </div>
              )}

              {terpasang && versiSkrip && versiSkrip !== SCRIPT_VERSI && (
                <div className="mt-3 flex flex-wrap items-start gap-2.5 rounded-xl bg-warn-soft p-3 text-[12px] leading-relaxed text-warn">
                  <I.alert className="mt-0.5 h-4 w-4 shrink-0" />
                  <span className="min-w-[200px] flex-1">
                    Skrip di spreadsheet masih v{versiSkrip}. Fitur <b>tab baru</b> dan <b>tambah baris</b> di tabel keuangan
                    butuh v{SCRIPT_VERSI} — salin ulang kode di bagian Koneksi, lalu{" "}
                    <b>Terapkan → Kelola deployment → Edit → Versi baru</b>.
                  </span>
                  <Btn
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setBukaKode(true);
                      window.setTimeout(
                        () => document.getElementById("kode-skrip")?.scrollIntoView({ behavior: "smooth", block: "start" }),
                        80,
                      );
                    }}
                  >
                    Lihat &amp; salin kode
                  </Btn>
                </div>
              )}

              {hasilBuat && (
                <div
                  className={cx(
                    "anim-pop mt-3 flex items-start gap-2.5 rounded-xl p-3 text-[12.5px] leading-relaxed",
                    hasilBuat.ok ? "bg-brand-soft text-[#0b5e42]" : "bg-bad-soft text-bad",
                  )}
                >
                  {hasilBuat.ok ? <I.check className="mt-0.5 h-4 w-4 shrink-0" /> : <I.alert className="mt-0.5 h-4 w-4 shrink-0" />}
                  <span className="min-w-[180px] flex-1">{hasilBuat.text}</span>
                  {!hasilBuat.ok && /skrip|v\d\.\d/i.test(hasilBuat.text) && (
                    <Btn
                      variant="ghost"
                      size="sm"
                      className="shrink-0"
                      onClick={() => {
                        setBukaKode(true);
                        window.setTimeout(
                          () => document.getElementById("kode-skrip")?.scrollIntoView({ behavior: "smooth", block: "start" }),
                          80,
                        );
                      }}
                    >
                      Buka kode v{SCRIPT_VERSI}
                    </Btn>
                  )}
                </div>
              )}
            </div>

            <div className="rounded-xl bg-paper p-3.5 text-[11.5px] leading-relaxed text-muted">
              <p className="text-[12px] font-bold text-ink">Yang tetap &amp; yang kosong</p>
              <ul className="mt-2 space-y-1.5">
                <li className="flex gap-1.5">
                  <I.check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
                  <span>Judul bagian, judul kolom, nama tim, format &amp; lebar kolom, rumus, dan tabel realisasi anggaran.</span>
                </li>
                <li className="flex gap-1.5">
                  <I.x className="mt-0.5 h-3.5 w-3.5 shrink-0 text-bad" />
                  <span>Uraian kegiatan &amp; rencana, tautan bukti dukung, angka kehadiran, dan aplikasi presensi.</span>
                </li>
                <li className="flex gap-1.5">
                  <I.cal className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
                  <span>Tanggal kolom A/C/P digeser {geser ? "+7 hari" : "0 hari"}; baris lain tidak diubah.</span>
                </li>
              </ul>
              <p className="mt-2.5 border-t border-line pt-2.5">
                Tab baru diletakkan tepat di samping tab sumber, dan tab lain di spreadsheet tidak tersentuh.
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* koneksi */}
      <div id="koneksi-apps-script" className="scroll-mt-24">
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[16px] font-bold">
              {terpasang ? "Koneksi Apps Script" : "Aktifkan sekali: pasang Apps Script"}
            </h2>
            <p className="mt-0.5 max-w-[640px] text-[12.5px] leading-relaxed text-muted">
              {terpasang
                ? "Sudah tersambung lewat Web App. Kode skrip terbaru bisa disalin kapan saja di kotak di bawah."
                : "Aplikasi ini hanya butuh satu kali penyiapan agar bisa menulis ke spreadsheet Anda."}
            </p>
          </div>
          {terpasang && (
            <Btn variant="ghost" size="sm" onClick={() => setBukaKoneksi((v) => !v)}>
              {bukaKoneksi ? "Tutup" : "Ubah koneksi"}
            </Btn>
          )}
        </div>

        {/* Kode skrip: selalu terlihat supaya mudah disalin/diperbarui */}
        <div id="kode-skrip" className="mt-4 scroll-mt-24 overflow-hidden rounded-xl border border-line">
          <div className="flex flex-wrap items-center gap-2 border-b border-line bg-paper px-3 py-2">
            <span className="font-mono text-[11.5px] text-muted">
              Kode.gs · v{SCRIPT_VERSI} · {APPS_SCRIPT.split("\n").length} baris
            </span>
            {!!versiSkrip && (versiSkrip === SCRIPT_VERSI ? <Pill tone="brand">sheet v{versiSkrip}</Pill> : <Pill tone="warn">sheet masih v{versiSkrip}</Pill>)}
            <div className="ml-auto flex gap-1.5">
              <Btn variant="ghost" size="sm" onClick={() => setBukaKode((v) => !v)}>
                {bukaKode ? "Sembunyikan" : "Lihat kode"}
              </Btn>
              {/* Kode yang disalin memuat token asli → hanya admin. */}
              {admin && (
                <Btn
                  variant={copied === "script" ? "brand" : "primary"}
                  size="sm"
                  onClick={() =>
                    doCopy(
                      "script",
                      settings.token ? APPS_SCRIPT.replace("GANTI-DENGAN-KODE-RAHASIA", settings.token) : APPS_SCRIPT,
                      `Kode v${SCRIPT_VERSI} tersalin`,
                    )
                  }
                >
                  {copied === "script" ? <I.check className="h-3.5 w-3.5" /> : <I.copy className="h-3.5 w-3.5" />}
                  {copied === "script" ? "Tersalin" : "Salin kode"}
                </Btn>
              )}
            </div>
          </div>
          {bukaKode && (
            <pre className="thin-scroll max-h-[320px] overflow-auto bg-[#151816] p-3 font-mono text-[11px] leading-relaxed text-[#d7e4dc]">{APPS_SCRIPT}</pre>
          )}
          <div className="space-y-1 px-3 py-2 text-[11.5px] leading-relaxed text-muted">
            <p>
              <b className="text-ink">Cara memperbarui:</b> Salin kode → buka spreadsheet → <b className="text-ink">Ekstensi → Apps Script</b> →
              hapus semua isi (Ctrl+A) → tempel → <b className="text-ink">Terapkan → Kelola deployment → ikon pensil → Versi: Versi
              baru → Deploy</b>. URL <code className="rounded bg-paper px-1 font-mono">/exec</code> tidak berubah, jadi tidak perlu
              mengisi ulang apa pun di aplikasi.
            </p>
            {settings.token && <p>Kode yang disalin sudah berisi token Anda.</p>}
          </div>
        </div>

        {(!terpasang || bukaKoneksi) && (
          <div className="mt-4 grid gap-5 lg:grid-cols-2">
            <div>
              <ol className="space-y-2.5 text-[12.5px] leading-relaxed text-muted">
                <li>
                  <b className="text-ink">1.</b> Buka spreadsheet → <b className="text-ink">Ekstensi → Apps Script</b>. Hapus isi
                  default, lalu tempel <b className="text-ink">kode dari kotak “Kode.gs” di atas</b> (tombol Salin kode).
                </li>
                <li>
                  <b className="text-ink">2.</b> Ganti{" "}
                  <code className="rounded bg-paper px-1 font-mono text-[11.5px]">GANTI-DENGAN-KODE-RAHASIA</code> dengan kode
                  buatan Anda, lalu isi kode yang sama di kolom Token.
                </li>
                <li>
                  <b className="text-ink">3.</b> <b className="text-ink">Terapkan → Deployment baru → Aplikasi web</b>. Jalankan
                  sebagai <b className="text-ink">Saya</b>, akses <b className="text-ink">Siapa saja</b>, lalu Deploy.
                </li>
                <li>
                  <b className="text-ink">4.</b> Tempel URL yang berakhiran{" "}
                  <code className="rounded bg-paper px-1 font-mono text-[11.5px]">/exec</code> ke kolom di samping — selesai,
                  sinkron otomatis langsung berjalan.
                </li>
              </ol>

              <p className="mt-3 rounded-xl bg-paper p-3 text-[11.5px] leading-relaxed text-muted">
                Belum punya kode? Klik <b className="text-ink">Salin kode</b> pada kotak <b className="text-ink">Kode.gs · v{SCRIPT_VERSI}</b>{" "}
                di atas kartu ini, lalu tempel di Apps Script.
              </p>
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-muted">URL Web App</label>
              <input
                value={urlDraf}
                readOnly={!admin}
                onChange={(e) => setUrlDraf(e.target.value)}
                onBlur={() => simpanKoneksi(true)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    simpanKoneksi();
                  }
                }}
                placeholder="https://script.google.com/macros/s/…/exec"
                className="mt-1.5 h-11 w-full rounded-xl border border-line bg-paper px-3 font-mono text-[12px] outline-none transition focus:border-brand focus:bg-white"
              />
              {urlDraf.trim() && !urlValid && (
                <p className="mt-1 text-[11.5px] text-warn">URL biasanya berakhiran <code className="font-mono">/exec</code>.</p>
              )}

              <label className="mt-3 block text-[12px] font-semibold text-muted">
                Token (kode rahasia yang sama dengan di skrip)
              </label>
              <input
                value={tokenDraf}
                type={tampilToken ? "text" : "password"}
                readOnly={!admin}
                onChange={(e) => setTokenDraf(e.target.value)}
                onBlur={() => simpanKoneksi(true)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    simpanKoneksi();
                  }
                }}
                placeholder="cth. dukman-2026-xyz"
                className="mt-1.5 h-11 w-full rounded-xl border border-line bg-paper px-3 font-mono text-[12px] outline-none transition focus:border-brand focus:bg-white"
              />

              <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted">
                Tersimpan di perangkat ini dan <b>tidak terhapus</b> saat data mingguan diperbarui, sheet dimuat ulang, atau
                aplikasi diperbarui. Mengosongkan kolom tidak menghapus koneksi.
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {admin && (
                  <Btn variant="primary" size="sm" onClick={() => simpanKoneksi()} disabled={busy !== ""}>
                    <I.check className="h-3.5 w-3.5" /> Simpan koneksi
                  </Btn>
                )}
                <Btn variant="ghost" size="sm" onClick={() => setTampilToken((v) => !v)}>
                  {tampilToken ? <I.x className="h-3.5 w-3.5" /> : <I.doc className="h-3.5 w-3.5" />}
                  {tampilToken ? "Sembunyikan token" : "Tampilkan token"}
                </Btn>
                <Btn variant="ghost" size="sm" onClick={tes} disabled={!settings.scriptUrl || busy !== ""}>
                  {busy === "tes" ? <Spinner className="h-3.5 w-3.5" /> : <I.bolt className="h-3.5 w-3.5" />}
                  Tes koneksi
                </Btn>
                <Btn
                  variant={settings.autoSync ? "soft" : "brand"}
                  size="sm"
                  onClick={() => setSettings({ autoSync: true })}
                  disabled={settings.autoSync}
                >
                  <I.check className="h-3.5 w-3.5" /> {settings.autoSync ? "Otomatis aktif" : "Aktifkan otomatis"}
                </Btn>
              </div>

              {hasil && (
                <div
                  className={cx(
                    "anim-pop mt-3 flex items-start gap-2.5 rounded-xl p-3 text-[12.5px] leading-relaxed",
                    hasil.ok ? "bg-brand-soft text-[#0b5e42]" : "bg-bad-soft text-bad",
                  )}
                >
                  {hasil.ok ? <I.check className="mt-0.5 h-4 w-4 shrink-0" /> : <I.alert className="mt-0.5 h-4 w-4 shrink-0" />}
                  {hasil.text}
                </div>
              )}

              {terpasang && admin && (
                <div className="mt-4 rounded-xl border border-line p-3">
                  <p className="text-[12.5px] font-bold">Bagikan ke rekan setim</p>
                  <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted">
                    Kirim tautan ini ke rekan setim. Begitu dibuka, perangkat mereka <b>langsung tersambung</b> dan memakai
                    sheet yang sama — tanpa mengisi apa pun. Tautan berisi token, jadi bagikan hanya ke tim internal.
                    Perangkat yang belum pernah menyambung juga otomatis tersambung bila koneksi bawaan sudah diisi saat build.
                  </p>
                  <Btn
                    variant="ghost"
                    size="sm"
                    className="mt-2"
                    onClick={() => doCopy("tautan", buatTautan(), "Tautan siap pakai tersalin")}
                  >
                    {copied === "tautan" ? <I.check className="h-3.5 w-3.5" /> : <I.link className="h-3.5 w-3.5" />}
                    {copied === "tautan" ? "Tersalin" : "Salin tautan siap pakai"}
                  </Btn>
                </div>
              )}

              {terpasang && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-paper p-3">
                  <p className="text-[11.5px] leading-relaxed text-muted">
                    Hanya bila ingin memutus dari perangkat ini. Sheet tidak diubah.
                  </p>
                  <Btn variant="danger" size="sm" onClick={putus} disabled={busy !== ""}>
                    <I.x className="h-3.5 w-3.5" /> Putuskan koneksi
                  </Btn>
                </div>
              )}
            </div>
          </div>
        )}
      </Card>
      </div>

      {/* aktivitas */}
      <Card className="p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-[16px] font-bold">Aktivitas sinkronisasi</h2>
            <p className="mt-0.5 text-[12.5px] text-muted">Riwayat 30 pengiriman terakhir dari perangkat ini.</p>
          </div>
          {syncLog.length > 0 && (
            <Btn variant="ghost" size="sm" onClick={hapusLog}>
              <I.trash className="h-3.5 w-3.5" /> Bersihkan
            </Btn>
          )}
        </div>
        {syncLog.length === 0 ? (
          <p className="rounded-xl bg-paper p-3 text-[12.5px] text-muted">
            Belum ada pengiriman. Simpan satu isian laporan — pengiriman pertama akan muncul di sini.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {syncLog.map((l, i) => (
              <li key={`${l.at}-${i}`} className="flex items-start gap-3 py-2.5">
                <span
                  className={cx(
                    "mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full",
                    l.ok ? "bg-brand-soft text-brand" : "bg-bad-soft text-bad",
                  )}
                >
                  {l.ok ? <I.check className="h-3.5 w-3.5" /> : <I.alert className="h-3.5 w-3.5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-semibold">
                    {l.ok ? `${l.sel} sel ditulis${l.tab ? ` · tab ${l.tab}` : ""}` : "Gagal mengirim"}
                    <span className="ml-2 font-normal text-muted">{jamSinkron(l.at)}</span>
                  </p>
                  {l.pesan && <p className="text-[11.5px] leading-relaxed text-muted">{l.pesan}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* cadangan: salin-tempel */}
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[16px] font-bold">Cadangan: salin & tempel manual</h2>
            <p className="mt-0.5 max-w-[640px] text-[12.5px] leading-relaxed text-muted">
              Dipakai hanya bila Apps Script belum bisa dipasang. Klik <b>Salin</b>, buka sheet, klik sel tujuan, lalu tempel.
            </p>
          </div>
          <Btn variant="ghost" size="sm" onClick={() => setBukaCadangan((v) => !v)}>
            {bukaCadangan ? "Tutup" : "Buka cadangan"}
          </Btn>
        </div>

        {bukaCadangan && (
          <div className="mt-3">
            <ul className="divide-y divide-line">
              {blok.map((b) => (
                <li key={b.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-[180px] flex-1">
                    <p className="text-[13.5px] font-semibold">{b.judul}</p>
                    <p className="text-[11.5px] text-muted">
                      {b.terisi}/{b.baris} baris terisi
                    </p>
                  </div>
                  <span className="rounded-lg bg-paper px-2.5 py-1 font-mono text-[12px] font-semibold">
                    tempel di <span className="text-brand">{b.sel}</span>
                  </span>
                  <Btn
                    variant={copied === b.id ? "brand" : "ghost"}
                    size="sm"
                    onClick={() => doCopy(b.id, b.tsv, `Tersalin — tempel di sel ${b.sel}`)}
                    disabled={!b.terisi}
                    className="w-[100px]"
                  >
                    {copied === b.id ? <I.check className="h-3.5 w-3.5" /> : <I.copy className="h-3.5 w-3.5" />}
                    {copied === b.id ? "Tersalin" : "Salin"}
                  </Btn>
                </li>
              ))}
            </ul>
            {admin && dirtyCount > 0 && (
              <Btn
                variant="soft"
                size="sm"
                className="mt-3"
                onClick={() => {
                  tandaiManual();
                  toast("Ditandai sudah ditempel manual");
                }}
              >
                <I.check className="h-3.5 w-3.5" /> Tandai sudah ditempel
              </Btn>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
