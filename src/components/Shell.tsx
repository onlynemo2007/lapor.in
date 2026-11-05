import { useEffect, useState, type ReactNode } from "react";
import { useApp } from "../lib/store";
import { SPREADSHEET_ID, TIMS } from "../lib/model";
import { Btn, I, Logo, Spinner, cx } from "./ui";
import { StatusSinkron } from "./SyncBadge";

export type View = "dashboard" | "isi" | "presensi" | "pratinjau" | "sinkron";

export const NAV: { id: View; label: string; short: string; icon: keyof typeof I }[] = [
  { id: "dashboard", label: "Dashboard", short: "Dashboard", icon: "home" },
  { id: "isi", label: "Isi Laporan", short: "Isi", icon: "pen" },
  { id: "presensi", label: "Presensi", short: "Presensi", icon: "users" },
  { id: "pratinjau", label: "Pratinjau & Cetak", short: "Pratinjau", icon: "doc" },
  { id: "sinkron", label: "Sinkronisasi", short: "Sinkron", icon: "sync" },
];

/* --------------------------------- routing --------------------------------- */

export function parseHash(): { view: View; params: URLSearchParams } {
  const h = window.location.hash.replace(/^#\/?/, "");
  const [path, qs] = h.split("?");
  const view = (NAV.find((n) => n.id === path)?.id ?? "dashboard") as View;
  return { view, params: new URLSearchParams(qs ?? "") };
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
  const { settings, setSettings, tabs, week, loadState, reload, pendingCount, syncState } = useApp();
  const gagalSinkron = syncState.status === "error";
  const [editNama, setEditNama] = useState(false);
  const loading = loadState.status === "loading";

  return (
    <div className="min-h-screen lg:pl-[248px]">
      {/* sidebar */}
      <aside className="no-print fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col border-r border-line bg-white lg:flex">
        <div className="flex items-center gap-2.5 px-5 pb-4 pt-5">
          <Logo className="h-8 w-8" />
          <div>
            <p className="text-[16px] font-extrabold leading-none tracking-tight">Lapor.in</p>
            <p className="mt-1 text-[11px] text-muted">Tim Dukman · PSSSDMKP</p>
          </div>
        </div>

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
          <Logo className="h-7 w-7 lg:hidden" />

          <label className="relative flex min-w-0 items-center">
            <I.cal className="pointer-events-none absolute left-3 h-4 w-4 text-muted" />
            <select
              value={settings.activeGid}
              onChange={(e) => setSettings({ activeGid: e.target.value })}
              className="h-10 min-w-0 max-w-[190px] appearance-none truncate rounded-xl border border-line bg-white pl-9 pr-9 text-[13px] font-semibold outline-none transition focus:border-brand sm:max-w-none"
              aria-label="Pilih minggu (tab sheet)"
            >
              {tabs.map((t) => (
                <option key={t.gid} value={t.gid}>
                  Tab {t.name}
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

      <main className="mx-auto max-w-[1180px] px-4 pb-28 pt-6 lg:px-8 lg:pb-12">{children}</main>

      {/* bottom nav (HP) */}
      <nav className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <div className="grid grid-cols-5">
          {NAV.map((n) => {
            const Icon = I[n.icon];
            const on = view === n.id;
            return (
              <a key={n.id} href={`#/${n.id}`} className={cx("relative flex flex-col items-center gap-1 py-2.5 text-[10.5px] font-semibold", on ? "text-ink" : "text-muted")}>
                <span className={cx("grid h-8 w-12 place-items-center rounded-full transition-colors", on && "bg-brand-soft text-brand")}>
                  <Icon className="h-[19px] w-[19px]" />
                </span>
                {n.short}
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
