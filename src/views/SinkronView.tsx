import { useMemo, useState } from "react";
import { useApp } from "../lib/store";
import { SPREADSHEET_ID, slotLabel, tanggalPendek, timById } from "../lib/model";
import { APPS_SCRIPT, blokSalin, tesScript } from "../lib/sheet";
import { jamSinkron, waktuSinkron } from "../lib/sync";
import { Btn, Card, I, Pill, Spinner, cx, salin, useToast } from "../components/ui";
import { StatusSinkron } from "../components/SyncBadge";
import { StateGate } from "./common";

export default function SinkronView() {
  const {
    week,
    settings,
    setSettings,
    reload,
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
  } = useApp();
  const toast = useToast();
  const [copied, setCopied] = useState("");
  const [busy, setBusy] = useState<"" | "tes" | "kirim">("");
  const [hasil, setHasil] = useState<{ ok: boolean; text: string } | null>(null);
  const [bukaKode, setBukaKode] = useState(false);
  const [bukaKoneksi, setBukaKoneksi] = useState(false);
  const [bukaCadangan, setBukaCadangan] = useState(false);

  const blok = useMemo(() => (week ? blokSalin(week) : []), [week]);
  if (!week) return <StateGate />;

  const terpasang = !!settings.scriptUrl && !!settings.token;
  const urlValid = /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec/.test(settings.scriptUrl);
  const sheetUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit#gid=${week.gid}`;

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
    try {
      const r = await tesScript(settings.scriptUrl);
      if (r.ok) {
        setHasil({ ok: true, text: `Terhubung ke “${r.nama}” (skrip v${r.versi ?? "?"}) · ${r.tabs?.length ?? 0} tab.` });
        if (r.tabs?.length) setSettings({ extraTabs: r.tabs.filter((t) => !t.name.startsWith("_")) });
      } else setHasil({ ok: false, text: "Skrip merespons, tetapi tidak valid." });
    } catch {
      setHasil({ ok: false, text: "Tidak bisa terhubung. Pastikan URL berakhiran /exec dan akses “Siapa saja”." });
    }
    setBusy("");
  };

  const kirimSekarang = async () => {
    setBusy("kirim");
    setHasil(null);
    await syncNow();
    setBusy("");
    toast("Pengiriman dijalankan — lihat status di atas");
  };

  const tautanSiapPakai = () => {
    const isi = btoa(encodeURIComponent(JSON.stringify({ u: settings.scriptUrl, t: settings.token })));
    return `${window.location.origin}${window.location.pathname}#/sinkron?setup=${encodeURIComponent(isi)}`;
  };

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
              <p className="text-[13.5px] font-bold">Tautan berisi pengaturan sinkron</p>
              <p className="text-[12px] text-muted">Sekali klik, perangkat ini langsung ikut mengirim otomatis ke sheet.</p>
            </div>
            <div className="flex gap-2">
              <Btn variant="ghost" size="sm" onClick={buangTautan}>
                Nanti
              </Btn>
              <Btn variant="brand" size="sm" onClick={terapkanTautan}>
                <I.check className="h-3.5 w-3.5" /> Aktifkan
              </Btn>
            </div>
          </div>
        </Card>
      )}

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
          <Btn
            variant="soft"
            onClick={() => {
              kirimSemua();
              toast("Seluruh isian tab ini akan ditulis ulang ke Sheet");
            }}
            disabled={!terpasang || busy !== ""}
            title="Tulis seluruh isian tab ini ke sheet (untuk pemulihan)"
          >
            <I.sheet className="h-4 w-4" /> Kirim ulang semua isian
          </Btn>
          {!terpasang && (
            <span className="text-[12px] text-warn">Isi URL Web App & token di bawah untuk mengaktifkan.</span>
          )}
        </div>
      </Card>

      {/* koneksi */}
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[16px] font-bold">
              {terpasang ? "Koneksi Apps Script" : "Aktifkan sekali: pasang Apps Script"}
            </h2>
            <p className="mt-0.5 max-w-[640px] text-[12.5px] leading-relaxed text-muted">
              {terpasang
                ? "Sudah tersambung lewat Web App. Ganti di sini bila alamat deployment berubah."
                : "Aplikasi ini hanya butuh satu kali penyiapan agar bisa menulis ke spreadsheet Anda."}
            </p>
          </div>
          {terpasang && (
            <Btn variant="ghost" size="sm" onClick={() => setBukaKoneksi((v) => !v)}>
              {bukaKoneksi ? "Tutup" : "Ubah koneksi"}
            </Btn>
          )}
        </div>

        {(!terpasang || bukaKoneksi) && (
          <div className="mt-4 grid gap-5 lg:grid-cols-2">
            <div>
              <ol className="space-y-2.5 text-[12.5px] leading-relaxed text-muted">
                <li>
                  <b className="text-ink">1.</b> Buka spreadsheet → <b className="text-ink">Ekstensi → Apps Script</b>. Hapus isi
                  default, tempel kode di bawah.
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

              <div className="mt-3 overflow-hidden rounded-xl border border-line">
                <div className="flex items-center justify-between border-b border-line bg-paper px-3 py-2">
                  <span className="font-mono text-[11.5px] text-muted">Kode.gs · v1.3 · {APPS_SCRIPT.split("\n").length} baris</span>
                  <div className="flex gap-1.5">
                    <Btn variant="ghost" size="sm" onClick={() => setBukaKode((v) => !v)}>
                      {bukaKode ? "Sembunyikan" : "Lihat kode"}
                    </Btn>
                    <Btn
                      variant={copied === "script" ? "brand" : "primary"}
                      size="sm"
                      onClick={() =>
                        doCopy(
                          "script",
                          settings.token ? APPS_SCRIPT.replace("GANTI-DENGAN-KODE-RAHASIA", settings.token) : APPS_SCRIPT,
                          "Kode tersalin",
                        )
                      }
                    >
                      {copied === "script" ? <I.check className="h-3.5 w-3.5" /> : <I.copy className="h-3.5 w-3.5" />}
                      {copied === "script" ? "Tersalin" : "Salin kode"}
                    </Btn>
                  </div>
                </div>
                {bukaKode && (
                  <pre className="thin-scroll max-h-[320px] overflow-auto bg-[#151816] p-3 font-mono text-[11px] leading-relaxed text-[#d7e4dc]">{APPS_SCRIPT}</pre>
                )}
              </div>
              {settings.token && <p className="mt-2 text-[11.5px] text-muted">Kode yang disalin sudah berisi token Anda.</p>}
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-muted">URL Web App</label>
              <input
                value={settings.scriptUrl}
                onChange={(e) => setSettings({ scriptUrl: e.target.value.trim() })}
                placeholder="https://script.google.com/macros/s/…/exec"
                className="mt-1.5 h-11 w-full rounded-xl border border-line bg-paper px-3 font-mono text-[12px] outline-none transition focus:border-brand focus:bg-white"
              />
              {settings.scriptUrl && !urlValid && (
                <p className="mt-1 text-[11.5px] text-warn">URL biasanya berakhiran <code className="font-mono">/exec</code>.</p>
              )}

              <label className="mt-3 block text-[12px] font-semibold text-muted">
                Token (kode rahasia yang sama dengan di skrip)
              </label>
              <input
                value={settings.token}
                onChange={(e) => setSettings({ token: e.target.value.trim() })}
                placeholder="cth. dukman-2026-xyz"
                className="mt-1.5 h-11 w-full rounded-xl border border-line bg-paper px-3 font-mono text-[12px] outline-none transition focus:border-brand focus:bg-white"
              />

              <div className="mt-3 flex flex-wrap items-center gap-2">
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

              {terpasang && (
                <div className="mt-4 rounded-xl border border-line p-3">
                  <p className="text-[12.5px] font-bold">Bagikan ke rekan setim</p>
                  <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted">
                    Kirim tautan ini agar perangkat rekan langsung ikut sinkron otomatis — tanpa mengisi apa pun. Tautan berisi
                    token, jadi bagikan hanya ke tim internal.
                  </p>
                  <Btn
                    variant="ghost"
                    size="sm"
                    className="mt-2"
                    onClick={() => doCopy("tautan", tautanSiapPakai(), "Tautan siap pakai tersalin")}
                  >
                    {copied === "tautan" ? <I.check className="h-3.5 w-3.5" /> : <I.link className="h-3.5 w-3.5" />}
                    {copied === "tautan" ? "Tersalin" : "Salin tautan siap pakai"}
                  </Btn>
                </div>
              )}
            </div>
          </div>
        )}
      </Card>

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
            {dirtyCount > 0 && (
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
