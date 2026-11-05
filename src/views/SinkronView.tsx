import { useMemo, useState } from "react";
import { useApp } from "../lib/store";
import { SPREADSHEET_ID, slotLabel, tanggalPendek, timById } from "../lib/model";
import { APPS_SCRIPT, blokSalin, buildPayload, kirimKeScript, payloadCount, tesScript } from "../lib/sheet";
import { Btn, Card, I, Pill, Spinner, cx, salin, useToast } from "../components/ui";
import { StateGate } from "./common";

type Opsi = "A" | "B";

export default function SinkronView() {
  const { week, settings, setSettings, reload, updateWeek, dirtyCount } = useApp();
  const toast = useToast();
  const [opsi, setOpsi] = useState<Opsi>(settings.scriptUrl ? "B" : "A");
  const [copied, setCopied] = useState("");
  const [busy, setBusy] = useState<"" | "tes" | "kirim">("");
  const [hasil, setHasil] = useState<{ ok: boolean; text: string } | null>(null);
  const [hanyaBerubah, setHanyaBerubah] = useState(true);
  const [lihatKode, setLihatKode] = useState(false);

  const blok = useMemo(() => (week ? blokSalin(week) : []), [week]);
  const payload = useMemo(() => (week ? buildPayload(week, settings.token, settings.nama, hanyaBerubah) : null), [week, settings.token, settings.nama, hanyaBerubah]);

  if (!week || !payload) return <StateGate />;

  const sheetUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit#gid=${week.gid}`;

  const doCopy = async (id: string, text: string, sel?: string) => {
    const ok = await salin(text);
    if (ok) {
      setCopied(id);
      toast(sel ? `Tersalin — tempel di sel ${sel}` : "Tersalin");
      window.setTimeout(() => setCopied((c) => (c === id ? "" : c)), 2200);
    } else toast("Gagal menyalin, izinkan akses clipboard", "err");
  };

  const tandaiTerkirim = () => {
    updateWeek((w) => ({ ...w, dirty: {}, syncedAt: Date.now() }));
  };

  const tes = async () => {
    if (!settings.scriptUrl) return;
    setBusy("tes");
    setHasil(null);
    try {
      const r = await tesScript(settings.scriptUrl);
      if (r.ok) {
        setHasil({ ok: true, text: `Terhubung ke “${r.nama}” (skrip v${r.versi ?? "?"}) · ${r.tabs?.length ?? 0} tab.` });
        if (r.tabs?.length) {
          setSettings({ extraTabs: r.tabs.filter((t) => !t.name.startsWith("_")) });
        }
      } else setHasil({ ok: false, text: "Skrip merespons, tetapi tidak valid." });
    } catch {
      setHasil({ ok: false, text: "Tidak bisa terhubung. Periksa URL (harus berakhiran /exec) dan akses “Siapa saja”." });
    }
    setBusy("");
  };

  const kirim = async () => {
    if (!settings.scriptUrl || !settings.token) return;
    setBusy("kirim");
    setHasil(null);
    try {
      const r = await kirimKeScript(settings.scriptUrl, payload);
      if (!r.ok) {
        setHasil({ ok: false, text: r.error ?? "Gagal menulis ke sheet." });
      } else {
        tandaiTerkirim();
        const gagal = r.gagal?.length ? ` · ${r.gagal.length} tidak ditemukan: ${r.gagal.slice(0, 3).join(", ")}` : "";
        setHasil({
          ok: true,
          text: r.verified ? `Berhasil — ${r.ditulis} sel ditulis ke tab ${week.tab}${gagal}.` : `Terkirim ke Apps Script (balasan tidak dapat dibaca browser). Muat ulang untuk memastikan.`,
        });
        toast("Terkirim ke Google Sheet");
        window.setTimeout(() => reload(), 1500);
      }
    } catch {
      setHasil({ ok: false, text: "Gagal mengirim. Periksa koneksi & URL Web App." });
    }
    setBusy("");
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

  const siapB = !!settings.scriptUrl && !!settings.token;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[13px] font-medium text-muted">Tab {week.tab}</p>
          <h1 className="mt-1 text-[24px] font-extrabold tracking-tight sm:text-[28px]">Kirim ke Google Sheet</h1>
          <p className="mt-1 text-[13px] text-muted">
            {dirtyCount ? `${dirtyCount} perubahan di perangkat ini belum masuk sheet.` : "Tidak ada perubahan tertunda."}
            {week.syncedAt && ` Terakhir dikirim ${new Date(week.syncedAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}.`}
          </p>
        </div>
        <a href={sheetUrl} target="_blank" rel="noreferrer">
          <Btn variant="ghost">
            <I.sheet className="h-4 w-4 text-brand" /> Buka tab di Sheet
          </Btn>
        </a>
      </div>

      {/* perubahan tertunda */}
      {dirtyList.length > 0 && (
        <Card className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-[12.5px] font-semibold text-muted">Belum dikirim:</span>
            {dirtyList.slice(0, 14).map((d) => (
              <Pill key={d.dk} tone="warn">
                {d.jenis} · {d.label}
              </Pill>
            ))}
            {dirtyList.length > 14 && <Pill>+{dirtyList.length - 14} lagi</Pill>}
          </div>
        </Card>
      )}

      {/* pilih opsi */}
      <div className="grid gap-3 sm:grid-cols-2">
        {(
          [
            ["A", "Opsi A · Salin & tempel", "Tanpa setup. Salin blok, tempel ke sel yang ditunjuk.", I.copy],
            ["B", "Opsi B · Kirim otomatis", "Sekali pasang Apps Script, lalu satu klik langsung masuk sheet.", I.bolt],
          ] as const
        ).map(([id, title, desc, Icon]) => (
          <button
            key={id}
            onClick={() => setOpsi(id)}
            className={cx(
              "flex items-start gap-3 rounded-2xl border p-4 text-left transition",
              opsi === id ? "border-ink bg-white shadow-sm ring-1 ring-ink" : "border-line bg-white hover:border-[#cfcec8]",
            )}
          >
            <span className={cx("grid h-10 w-10 shrink-0 place-items-center rounded-xl", opsi === id ? "bg-ink text-white" : "bg-paper text-muted")}>
              <Icon className="h-5 w-5" />
            </span>
            <span>
              <span className="flex items-center gap-2 text-[14.5px] font-bold">
                {title}
                {id === "B" && siapB && <Pill tone="brand">terhubung</Pill>}
              </span>
              <span className="mt-0.5 block text-[12.5px] text-muted">{desc}</span>
            </span>
          </button>
        ))}
      </div>

      {opsi === "A" && (
        <Card className="p-5">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-[16px] font-bold">Salin per blok</h2>
              <p className="mt-0.5 text-[12.5px] text-muted">
                Klik <b>Salin</b>, buka sheet, klik sel tujuan, lalu <b>Ctrl/⌘+V</b>. Baris kosong ikut tersalin agar posisi tetap pas.
              </p>
            </div>
            {dirtyCount > 0 && (
              <Btn variant="soft" size="sm" onClick={() => { tandaiTerkirim(); toast("Ditandai sudah ditempel"); }}>
                <I.check className="h-3.5 w-3.5" /> Tandai sudah ditempel
              </Btn>
            )}
          </div>
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
                <Btn variant={copied === b.id ? "brand" : "ghost"} size="sm" onClick={() => doCopy(b.id, b.tsv, b.sel)} disabled={!b.terisi} className="w-[100px]">
                  {copied === b.id ? <I.check className="h-3.5 w-3.5" /> : <I.copy className="h-3.5 w-3.5" />}
                  {copied === b.id ? "Tersalin" : "Salin"}
                </Btn>
              </li>
            ))}
          </ul>
          <p className="mt-3 rounded-xl bg-paper p-3 text-[12px] leading-relaxed text-muted">
            Nomor sel dibaca dari struktur tab saat terakhir dimuat. Jika ada yang menyisipkan baris di sheet, tekan <b>Muat ulang</b> dulu agar posisi sel diperbarui.
          </p>
        </Card>
      )}

      {opsi === "B" && (
        <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
          <Card className="p-5">
            <h2 className="text-[16px] font-bold">1 · Pasang Apps Script (sekali saja)</h2>
            <ol className="mt-3 space-y-2.5 text-[13px] leading-relaxed text-muted">
              <li>
                <b className="text-ink">a.</b> Buka spreadsheet →{" "}
                <b className="text-ink">Ekstensi → Apps Script</b>. Hapus isi default, tempel kode di bawah.
              </li>
              <li>
                <b className="text-ink">b.</b> Ganti <code className="rounded bg-paper px-1 font-mono text-[11.5px]">GANTI-DENGAN-KODE-RAHASIA</code> dengan kode buatan Anda, lalu isi kode yang sama di kolom Token.
              </li>
              <li>
                <b className="text-ink">c.</b> <b className="text-ink">Terapkan → Deployment baru → Aplikasi web</b>. Jalankan sebagai: <b className="text-ink">Saya</b>. Akses: <b className="text-ink">Siapa saja</b>. Izinkan akses saat diminta.
              </li>
              <li>
                <b className="text-ink">d.</b> Salin URL yang berakhiran <code className="rounded bg-paper px-1 font-mono text-[11.5px]">/exec</code> ke kolom di samping.
              </li>
            </ol>

            <div className="mt-4 overflow-hidden rounded-xl border border-line">
              <div className="flex items-center justify-between border-b border-line bg-paper px-3 py-2">
                <span className="font-mono text-[11.5px] text-muted">Kode.gs · {APPS_SCRIPT.split("\n").length} baris</span>
                <div className="flex gap-1.5">
                  <Btn variant="ghost" size="sm" onClick={() => setLihatKode((v) => !v)}>
                    {lihatKode ? "Sembunyikan" : "Lihat kode"}
                  </Btn>
                  <Btn
                    variant={copied === "script" ? "brand" : "primary"}
                    size="sm"
                    onClick={() => doCopy("script", settings.token ? APPS_SCRIPT.replace("GANTI-DENGAN-KODE-RAHASIA", settings.token) : APPS_SCRIPT)}
                  >
                    {copied === "script" ? <I.check className="h-3.5 w-3.5" /> : <I.copy className="h-3.5 w-3.5" />}
                    {copied === "script" ? "Tersalin" : "Salin kode"}
                  </Btn>
                </div>
              </div>
              {lihatKode && (
                <pre className="thin-scroll max-h-[340px] overflow-auto bg-[#151816] p-3 font-mono text-[11px] leading-relaxed text-[#d7e4dc]">{APPS_SCRIPT}</pre>
              )}
            </div>
            {settings.token && <p className="mt-2 text-[11.5px] text-muted">Kode yang disalin sudah berisi token Anda.</p>}
          </Card>

          <Card className="p-5">
            <h2 className="text-[16px] font-bold">2 · Hubungkan & kirim</h2>
            <label className="mt-4 block text-[12px] font-semibold text-muted">URL Web App</label>
            <input
              value={settings.scriptUrl}
              onChange={(e) => setSettings({ scriptUrl: e.target.value.trim() })}
              placeholder="https://script.google.com/macros/s/…/exec"
              className="mt-1.5 h-11 w-full rounded-xl border border-line bg-paper px-3 font-mono text-[12px] outline-none transition focus:border-brand focus:bg-white"
            />
            <label className="mt-3 block text-[12px] font-semibold text-muted">Token (kode rahasia yang sama dengan di skrip)</label>
            <input
              value={settings.token}
              onChange={(e) => setSettings({ token: e.target.value.trim() })}
              placeholder="cth. dukman-2026-xyz"
              className="mt-1.5 h-11 w-full rounded-xl border border-line bg-paper px-3 font-mono text-[12px] outline-none transition focus:border-brand focus:bg-white"
            />
            <div className="mt-3 flex gap-2">
              <Btn variant="ghost" size="sm" onClick={tes} disabled={!settings.scriptUrl || busy !== ""}>
                {busy === "tes" ? <Spinner className="h-3.5 w-3.5" /> : <I.bolt className="h-3.5 w-3.5" />}
                Tes koneksi
              </Btn>
              {!settings.token && <span className="self-center text-[11.5px] text-warn">Token wajib diisi</span>}
            </div>

            <div className="mt-5 rounded-xl border border-line p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[13.5px] font-bold">{payloadCount(payload)} sel akan ditulis</p>
                  <p className="text-[11.5px] text-muted">
                    {payload.kegiatan.length} kegiatan · {payload.lampiran.length} lampiran · {payload.rencana.length} rencana · {payload.presensi.length + payload.aplikasi.length} presensi
                  </p>
                </div>
              </div>
              <div className="mt-3 flex rounded-lg bg-paper p-1 text-[12px] font-semibold">
                <button onClick={() => setHanyaBerubah(true)} className={cx("flex-1 rounded-md py-1.5 transition", hanyaBerubah ? "bg-white shadow-sm" : "text-muted")}>
                  Hanya yang berubah
                </button>
                <button onClick={() => setHanyaBerubah(false)} className={cx("flex-1 rounded-md py-1.5 transition", !hanyaBerubah ? "bg-white shadow-sm" : "text-muted")}>
                  Semua isian
                </button>
              </div>
              <Btn variant="brand" className="mt-4 w-full" onClick={kirim} disabled={!siapB || busy !== "" || payloadCount(payload) === 0}>
                {busy === "kirim" ? <Spinner /> : <I.send className="h-4 w-4" />}
                {busy === "kirim" ? "Mengirim…" : `Kirim ke tab ${week.tab}`}
              </Btn>
            </div>

            {hasil && (
              <div className={cx("anim-pop mt-4 flex items-start gap-2.5 rounded-xl p-3 text-[12.5px] leading-relaxed", hasil.ok ? "bg-brand-soft text-[#0b5e42]" : "bg-bad-soft text-bad")}>
                {hasil.ok ? <I.check className="mt-0.5 h-4 w-4 shrink-0" /> : <I.alert className="mt-0.5 h-4 w-4 shrink-0" />}
                {hasil.text}
              </div>
            )}

            <p className="mt-4 text-[11.5px] leading-relaxed text-muted">
              Skrip mencari baris berdasarkan <b>tim + tanggal</b> (bukan nomor baris), jadi aman meski ada baris yang disisipkan. Setiap kiriman dicatat di tab tersembunyi <code className="font-mono">_audit</code>.
            </p>
          </Card>
        </div>
      )}
    </div>
  );
}
