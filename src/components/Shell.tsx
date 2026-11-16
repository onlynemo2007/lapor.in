import { useEffect, useState, type ReactNode } from "react";
import { useApp } from "../lib/store";
import { SPREADSHEET_ID, TIMS } from "../lib/model";
import { Btn, I, Logo, Spinner, cx } from "./ui";
import { StatusSinkron } from "./SyncBadge";
import { PeringatanKoneksi, PeringatanMinggu } from "./Koneksi";
import { VIEW_AWAL, ruteDariHash } from "../lib/rute";
import { SCRIPT_VERSI } from "../lib/sheet";

export type View = typeof VIEW_AWAL | "dashboard" | "isi" | "presensi" | "keuangan" | "pratinjau" | "sinkron";

export const NAV: { id: View; label: string; short: string; icon: keyof typeof I }[] = [
  { id: "dashboard", label: "Dashboard", short: "Dashboard", icon: "home" },
  { id: "isi", label: "Isi Laporan", short: "Isi", icon: "pen" },
  { id: "presensi", label: "Presensi", short: "Presensi", icon: "users" },
  { id: "keuangan", label: "Realisasi Keuangan", short: "Keuangan", icon: "money" },
  { id: "pratinjau", label: "Pratinjau & Cetak", short: "Pratinjau", icon: "doc" },
  { id: "sinkron", label: "Sinkronisasi", short: "Sinkron", icon: "sync" },
];

/* --------------------------------- routing --------------------------------- */

export function parseHash(): { view: View; params: URLSearchParams } {
  // Alamat utama tanpa hash = halaman pilih (Laporan Mingguan / aplikasi WFH).
  return ruteDariHash(window.location.hash, NAV.map((n) => n.id)) as { view: View; params: URLSearchParams };
}

export function go(view: View, params?: Record<string, string>) {
  const qs = params ? `?${new URLSearchParams(params).toString()}` : "";
  window.location.hash = `/${view}${qs}`;
}

export function useRoute() {
  const [r, setR] = useState(parseHash);
  useEffect(() => {
    const on = () => {
      setR(parseHash());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return r;
}

/* --------------------------------- shell --------------------------------- */

export default function Shell({ view, children }: { view: View; children: ReactNode }) {
  const { settings, setSettings, tabs, week, loadState, reload, pendingCount, syncState, admin, bolehBukaMinggu } =
    useApp();
  const gagalSinkron = syncState.status === "error";
  const [editNama, setEditNama] = useState(false);
  const [aturKunci, setAturKunci] = useState(false);
  const loading = loadState.status === "loading";

  return (
    <div className="min-h-screen lg:pl-[248px]">
      {/* sidebar */}
      <aside className="no-print fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col border-r border-line bg-white lg:flex">
        <a
          href="#/"
          title="Kembali ke halaman pilih (Laporan Mingguan / Laporan WFH)"
          className="flex items-center gap-2.5 rounded-xl px-5 pb-4 pt-5 transition-opacity hover:opacity-80"
        >
          <Logo className="h-8 w-8" />
          <div>
            <p className="text-[16px] font-extrabold leading-none tracking-tight">Lapor.in</p>
            <p className="mt-1 text-[11px] text-muted">PSSSDMKP</p>
          </div>
        </a>

        <nav className="mt-2 flex-1 space-y-0.5 px-3">
          {NAV.map((n) => {
            const Icon = I[n.icon];
            const on = view === n.id;
            return (
              <a
                key={n.id}
                href={`#/${n.id}`}
                className={cx(
                  "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-semibold transition-colors",
                  on ? "bg-ink text-white" : "text-muted hover:bg-paper hover:text-ink",
                )}
              >
                <Icon className="h-[18px] w-[18px]" />
                {n.label}
                {n.id === "sinkron" && pendingCount > 0 && (
                  <span className={cx("ml-auto rounded-full px-2 py-0.5 text-[10.5px] font-bold", gagalSinkron ? "bg-bad-soft text-bad" : on ? "bg-white/20 text-white" : "bg-warn-soft text-warn")}>
                    {pendingCount}
                  </span>
                )}
              </a>
            );
          })}
        </nav>

        <div className="space-y-3 border-t border-line p-4">
          <a
            href="#/"
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-[12.5px] font-semibold text-ink transition-colors hover:bg-paper"
          >
            <I.chev className="h-4 w-4 rotate-180 text-brand" />
            Halaman pilih
          </a>
          <a
            href={`https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit#gid=${settings.activeGid}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-[12.5px] font-medium text-muted transition-colors hover:bg-paper hover:text-ink"
          >
            <I.sheet className="h-4 w-4 text-brand" />
            Buka Google Sheet
            <I.arrow className="ml-auto h-3.5 w-3.5" />
          </a>
          <button
            onClick={() => setEditNama(true)}
            className="flex w-full items-center gap-3 rounded-xl border border-line px-3 py-2.5 text-left transition-colors hover:bg-paper"
          >
            <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-soft text-[12px] font-bold text-brand">
              {(settings.nama || "?").slice(0, 1).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold">{settings.nama || "Atur nama"}</span>
              <span className="block truncate text-[11px] text-muted">
                {TIMS.find((t) => t.id === settings.timUtama)?.label ?? "Pilih tim"}
              </span>
            </span>
          </button>
        </div>
      </aside>

      {/* topbar */}
      <header className="no-print sticky top-0 z-30 border-b border-line bg-paper/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1180px] items-center gap-3 px-4 py-3 lg:px-8">
          <a href="#/" title="Kembali ke halaman pilih" aria-label="Halaman pilih" className="shrink-0 lg:hidden">
            <Logo className="h-7 w-7" />
          </a>

          <label className="relative flex min-w-0 items-center">
            <I.cal className="pointer-events-none absolute left-3 h-4 w-4 text-muted" />
            <select
              value={settings.activeGid}
              onChange={(e) => setSettings({ activeGid: e.target.value })}
              className="h-10 min-w-0 max-w-[190px] appearance-none truncate rounded-xl border border-line bg-white pl-9 pr-9 text-[13px] font-semibold outline-none transition focus:border-brand sm:max-w-none"
              aria-label="Pilih minggu (tab sheet)"
            >
              {tabs.map((t) => (
                <option key={t.gid} value={t.gid} disabled={!bolehBukaMinggu(t.gid)}>
                  Tab {t.name}
                  {bolehBukaMinggu(t.gid) ? "" : " · terkunci"}
                </option>
              ))}
              {/* tab aktif yang belum ada di daftar (mis. baru dibuat rekan) tetap tampil */}
              {!tabs.some((t) => t.gid === settings.activeGid) && (
                <option value={settings.activeGid}>Tab {week?.tab ?? settings.activeGid}</option>
              )}
            </select>
            <I.down className="pointer-events-none absolute right-3 h-4 w-4 text-muted" />
          </label>

          <Btn
            variant="ghost"
            size="sm"
            className={cx("h-10 shrink-0 px-2.5", admin && "text-brand")}
            title={
              admin
                ? "Mode admin aktif — minggu lama boleh dibuka di perangkat ini"
                : "Minggu lama dikunci. Buka mode admin (PIN) untuk mengedit minggu lama."
            }
            onClick={() => setAturKunci(true)}
          >
            <I.lock className="h-4 w-4" />
            <span className="hidden md:inline">{admin ? "Admin" : "Kunci minggu"}</span>
          </Btn>

          <Btn
            variant="ghost"
            size="sm"
            className="h-10 shrink-0 px-2.5"
            title="Buat tab minggu baru di spreadsheet (struktur sama, isi kosong)"
            onClick={() => {
              go("sinkron", { buat: "1" });
              window.setTimeout(
                () => document.getElementById("minggu-baru")?.scrollIntoView({ behavior: "smooth", block: "start" }),
                150,
              );
            }}
          >
            <I.plus className="h-4 w-4" />
            <span className="hidden md:inline">Minggu baru</span>
          </Btn>

          <p className="hidden min-w-0 truncate text-[12.5px] text-muted xl:block">{week?.judul ?? ""}</p>

          <div className="ml-auto flex items-center gap-2">
            {loadState.status === "error" && (
              <span className="hidden max-w-[260px] truncate text-[12px] font-medium text-bad sm:block" title={loadState.error}>
                {loadState.error}
              </span>
            )}
            <div className="hidden sm:block">
              <StatusSinkron />
            </div>
            <Btn variant="ghost" size="sm" onClick={() => reload()} disabled={loading} className="h-10 px-3" title="Muat ulang dari Google Sheet">
              {loading ? <Spinner /> : <I.refresh className="h-4 w-4" />}
              <span className="hidden sm:inline">{loading ? "Memuat…" : "Muat ulang"}</span>
            </Btn>
            <button
              onClick={() => setEditNama(true)}
              className="grid h-10 w-10 place-items-center rounded-xl border border-line bg-white text-[13px] font-bold text-brand lg:hidden"
              aria-label="Profil"
            >
              {(settings.nama || "?").slice(0, 1).toUpperCase()}
            </button>
          </div>
        </div>
        {(pendingCount > 0 || syncState.status === "error" || syncState.status === "offline") && (
          <div className="mx-auto flex max-w-[1180px] px-4 pb-2 sm:hidden lg:px-8">
            <StatusSinkron ringkas className="max-w-full" />
          </div>
        )}
      </header>

      <main className="mx-auto max-w-[1180px] px-4 pb-28 pt-6 lg:px-8 lg:pb-12">
        <PeringatanKoneksi className="mb-5" />
        <PeringatanMinggu className="mb-5" />
        {children}
      </main>

      {/* bottom nav (HP) */}
      <nav className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <div className="grid grid-cols-6">
          {NAV.map((n) => {
            const Icon = I[n.icon];
            const on = view === n.id;
            return (
              <a key={n.id} href={`#/${n.id}`} className={cx("relative flex min-w-0 flex-col items-center gap-1 px-0.5 py-2.5 text-[9.5px] font-semibold", on ? "text-ink" : "text-muted")}>
                <span className={cx("grid h-8 w-12 place-items-center rounded-full transition-colors", on && "bg-brand-soft text-brand")}>
                  <Icon className="h-[19px] w-[19px]" />
                </span>
                <span className="max-w-full truncate">{n.short}</span>
                {n.id === "sinkron" && pendingCount > 0 && (
                  <span className={cx("absolute right-[calc(50%-22px)] top-1.5 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[9px] font-bold text-white", gagalSinkron ? "bg-bad" : "bg-warn")}>
                    {pendingCount}
                  </span>
                )}
              </a>
            );
          })}
        </div>
      </nav>

      {(editNama || !settings.nama) && <Profil onClose={() => setEditNama(false)} />}
      {aturKunci && <KunciMinggu onClose={() => setAturKunci(false)} />}
    </div>
  );
}

/* -------------------------- kunci minggu / mode admin -------------------------- */

/**
 * Minggu terbaru selalu bisa diisi; minggu lama terkunci otomatis. Admin membuka
 * kuncinya dengan PIN — PIN diperiksa Apps Script, tidak dikirim ke sheet.
 */
function KunciMinggu({ onClose }: { onClose: () => void }) {
  const {
    settings,
    setSettings,
    tabs,
    week,
    admin,
    mingguTerbaru,
    versiSkrip,
    terkunciGid,
    aturKunciMinggu,
    masukAdmin,
    keluarAdmin,
  } = useApp();
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyGid, setBusyGid] = useState("");
  const [pesan, setPesan] = useState<{ ok: boolean; text: string } | null>(null);
  const nama = (gid: string) => tabs.find((t) => t.gid === gid)?.name ?? gid;

  const bukaAdmin = async () => {
    if (!pin.trim()) return;
    setBusy(true);
    const r = await masukAdmin(pin);
    setBusy(false);
    if (r.ok) {
      setPin("");
      setPesan({ ok: true, text: "Mode admin aktif di perangkat ini. Minggu lama kini bisa dipilih dan dibuka." });
    } else {
      setPesan({ ok: false, text: r.error ?? "PIN admin salah." });
    }
  };

  const ubahKunci = async (gid: string, buka: boolean) => {
    setBusyGid(gid);
    const r = await aturKunciMinggu(gid, buka);
    setBusyGid("");
    setPesan({
      ok: r.ok,
      text: r.ok
        ? buka
          ? `Minggu “${nama(gid)}” dibuka kembali — semua pengisi boleh mengoreksinya.`
          : `Minggu “${nama(gid)}” dikunci lagi.`
        : r.error ?? "Skrip menolak permintaan.",
    });
  };

  return (
    <div className="no-print anim-fade fixed inset-0 z-[70] grid place-items-center bg-ink/40 p-4 backdrop-blur-sm">
      <div className="anim-pop flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start gap-3 border-b border-line px-6 py-5">
          <span className={cx("grid h-10 w-10 shrink-0 place-items-center rounded-2xl", admin ? "bg-brand-soft text-brand" : "bg-paper text-muted")}>
            <I.lock className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-[17px] font-bold tracking-tight">Kunci minggu</h2>
            <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">
              Minggu terbaru ({mingguTerbaru ? nama(mingguTerbaru) : "—"}) selalu bisa diisi. Minggu lama terkunci
              otomatis; hanya admin yang boleh membukanya untuk koreksi.
            </p>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <ul className="space-y-1.5">
            {tabs.slice(0, 12).map((t) => {
              const kunci = terkunciGid(t.gid);
              const aktif = settings.activeGid === t.gid;
              return (
                <li
                  key={t.gid}
                  className={cx(
                    "flex items-center gap-2 rounded-xl border px-3 py-2",
                    aktif ? "border-ink bg-paper" : "border-line",
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold">Tab {t.name}</span>
                    <span className="block text-[11px] text-muted">
                      {t.gid === mingguTerbaru ? "Minggu terbaru · bisa diisi" : kunci ? "Terkunci · baca-saja" : "Dibuka untuk koreksi"}
                    </span>
                  </span>
                  {t.gid !== mingguTerbaru && admin && (
                    <Btn
                      variant="ghost"
                      size="sm"
                      className="shrink-0 bg-white"
                      disabled={busyGid === t.gid}
                      onClick={() => void ubahKunci(t.gid, kunci)}
                      title={kunci ? "Buka kunci minggu ini di sheet" : "Kunci lagi minggu ini di sheet"}
                    >
                      {busyGid === t.gid ? <Spinner className="h-3.5 w-3.5" /> : <I.lock className="h-3.5 w-3.5" />}
                      {kunci ? "Buka" : "Kunci"}
                    </Btn>
                  )}
                  {!kunci && !aktif && (
                    <Btn
                      variant="ghost"
                      size="sm"
                      className="shrink-0 bg-white"
                      onClick={() => {
                        setSettings({ activeGid: t.gid });
                        onClose();
                      }}
                    >
                      Pakai
                    </Btn>
                  )}
                  {aktif && <span className="shrink-0 rounded-full bg-ink px-2 py-1 text-[10.5px] font-bold text-white">Aktif</span>}
                </li>
              );
            })}
          </ul>
          {tabs.length > 12 && (
            <p className="mt-2 text-[11px] text-muted">Menampilkan 12 tab terbaru dari {tabs.length} tab.</p>
          )}

          {!!versiSkrip && versiSkrip !== SCRIPT_VERSI && (
            <p className="mt-3 rounded-xl bg-warn-soft px-3 py-2 text-[12px] leading-relaxed text-warn">
              Skrip di spreadsheet masih <b>v{versiSkrip}</b>. Versi <b>v{SCRIPT_VERSI}</b> diperlukan agar minggu terbaru
              terbaca tepat — pada versi lama, tab minggu baru bisa salah dianggap sudah ditutup. Salin ulang kode di menu
              Sinkronisasi, lalu Terapkan → Kelola deployment → Edit → Versi baru.
            </p>
          )}

          {pesan && (
            <p className={cx("mt-3 rounded-xl px-3 py-2 text-[12px]", pesan.ok ? "bg-brand-soft text-[#0b5e42]" : "bg-bad-soft text-bad")}>
              {pesan.text}
            </p>
          )}
        </div>

        <div className="border-t border-line px-6 py-4">
          {admin ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-[12px] text-muted">
                Mode admin aktif{week ? ` · tab ${week.tab}` : ""}
              </p>
              <Btn
                variant="ghost"
                onClick={() => {
                  keluarAdmin();
                  setPesan({ ok: true, text: "Mode admin ditutup. Minggu lama terkunci lagi." });
                }}
              >
                <I.x className="h-4 w-4" /> Tutup mode admin
              </Btn>
            </div>
          ) : (
            <div className="flex flex-wrap items-end gap-2">
              <label className="block flex-1">
                <span className="block text-[11.5px] font-semibold text-muted">PIN admin</span>
                <input
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    void bukaAdmin();
                  }}
                  placeholder="••••••"
                  className="mt-1 h-10 w-full rounded-xl border border-line bg-paper px-3 font-mono text-[12.5px] outline-none transition focus:border-brand focus:bg-white"
                />
              </label>
              <Btn
                variant="brand"
                onClick={() => void bukaAdmin()}
                disabled={busy || !pin.trim() || !settings.scriptUrl}
              >
                {busy ? <Spinner className="h-4 w-4" /> : <I.lock className="h-4 w-4" />} Buka mode admin
              </Btn>
            </div>
          )}
          <div className="mt-3 flex justify-end">
            <Btn variant="ghost" onClick={onClose}>
              Tutup
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ profil / onboarding ------------------------------ */

function Profil({ onClose }: { onClose: () => void }) {
  const { settings, setSettings } = useApp();
  const [nama, setNama] = useState(settings.nama);
  const [tim, setTim] = useState(settings.timUtama);
  const first = !settings.nama;

  const simpan = () => {
    if (!nama.trim()) return;
    setSettings({ nama: nama.trim(), timUtama: tim });
    onClose();
  };

  return (
    <div className="no-print anim-fade fixed inset-0 z-[70] grid place-items-center bg-ink/40 p-4 backdrop-blur-sm">
      <div className="anim-pop w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-center gap-3">
          <Logo className="h-10 w-10" />
          <div>
            <h2 className="text-[18px] font-bold tracking-tight">{first ? "Selamat datang di Lapor.in" : "Profil pengisi"}</h2>
            <p className="text-[13px] text-muted">Nama dicatat di setiap isian dan di log sheet.</p>
          </div>
        </div>

        <label className="mt-6 block text-[12.5px] font-semibold">Nama</label>
        <input
          autoFocus
          value={nama}
          onChange={(e) => setNama(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && simpan()}
          placeholder="cth. Rani Oktavia"
          className="mt-1.5 w-full rounded-xl border border-line bg-paper px-4 py-3 text-[14px] outline-none transition focus:border-brand focus:bg-white"
        />

        <label className="mt-4 block text-[12.5px] font-semibold">Tim utama (dipilih otomatis saat mengisi)</label>
        <div className="mt-2 flex flex-wrap gap-2">
          {TIMS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTim(t.id)}
              className={cx(
                "rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition",
                tim === t.id ? "border-ink bg-ink text-white" : "border-line text-muted hover:border-[#cfcec8] hover:text-ink",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          {!first && (
            <Btn variant="ghost" onClick={onClose}>
              Batal
            </Btn>
          )}
          <Btn variant="brand" onClick={simpan} disabled={!nama.trim()}>
            {first ? "Mulai" : "Simpan"}
            <I.arrow className="h-4 w-4" />
          </Btn>
        </div>
      </div>
    </div>
  );
}
