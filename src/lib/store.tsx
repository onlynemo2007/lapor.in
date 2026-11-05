import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  DEFAULT_TABS,
  type Tab,
  type WeekData,
  ringkas,
  type Ringkasan,
  splitUraian,
  slotKey,
  lampKey,
  norm,
  normalisasiLinks,
  samaLinks,
  SLOT_ROWS,
  TIMS,
} from "./model";
import { fetchWeek, kirimKeScript, mergeWeek } from "./sheet";
import { jumlahTertunda, siapkanKiriman, tandaiTerkirim, verifikasiKiriman, type SyncLog, type SyncState } from "./sync";

export type Settings = {
  nama: string;
  timUtama: string;
  scriptUrl: string;
  token: string;
  /** Kirim otomatis setiap isian disimpan (tanpa menekan tombol). */
  autoSync: boolean;
  activeGid: string;
  extraTabs: Tab[];
};

type Persisted = {
  v: 2;
  settings: Settings;
  weeks: Record<string, WeekData>;
  trend: Record<string, Ringkasan & { judul: string }>;
  log: SyncLog[];
};

const KEY = "laporin:v3";
const KEY_LAMA = "laporin:v2";

/** Jeda setelah isian terakhir sebelum dikirim (mencegah kiriman bertubi-tubi saat mengetik). */
const JEDA_TULIS = 900;
/** Jeda percobaan ulang otomatis (ms) bila gagal. */
const ULANG = [4000, 10000, 25000, 60000];

const defaultSettings: Settings = {
  nama: "",
  timUtama: "",
  scriptUrl: "",
  token: "",
  autoSync: true,
  activeGid: DEFAULT_TABS[0].gid,
  extraTabs: [],
};

function load(): Persisted {
  try {
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem(KEY_LAMA);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Persisted>;
      return {
        v: 2,
        settings: { ...defaultSettings, ...p.settings },
        weeks: p.weeks ?? {},
        trend: p.trend ?? {},
        log: p.log ?? [],
      };
    }
  } catch {
    /* abaikan */
  }
  return { v: 2, settings: defaultSettings, weeks: {}, trend: {}, log: [] };
}

/** Pindahkan isian dari versi lama (lm.entries / lm.plans) ke minggu Nov I. */
function migrasiLama(w: WeekData): WeekData {
  try {
    const entries = JSON.parse(localStorage.getItem("lm.entries") || "[]") as {
      team: string;
      sub?: string;
      date: string;
      uraian: string;
      link?: string;
    }[];
    const plans = JSON.parse(localStorage.getItem("lm.plans") || "[]") as { team: string; uraian: string }[];
    if (!entries.length && !plans.length) return w;
    const out: WeekData = { ...w, kegiatan: { ...w.kegiatan }, rencana: { ...w.rencana }, lampiran: { ...w.lampiran }, dirty: { ...w.dirty } };
    const idDari = (label: string) => TIMS.find((t) => norm(t.label) === norm(label))?.id;
    entries.forEach((e) => {
      const id = idDari(e.team);
      if (!id) return;
      const k = slotKey(id, e.sub ?? "", e.date);
      const items = splitUraian(e.uraian);
      if (items.length) {
        out.kegiatan[k] = [...(out.kegiatan[k] ?? []), ...items];
        out.dirty[`A:${k}`] = true;
      }
      if (e.link) {
        const lk = lampKey(id, e.sub ?? "");
        out.lampiran[lk] = e.link;
        out.dirty[`L:${lk}`] = true;
      }
    });
    plans.forEach((p) => {
      const id = idDari(p.team);
      if (!id) return;
      out.rencana[id] = [...(out.rencana[id] ?? []), ...splitUraian(p.uraian)];
      out.dirty[`B:${id}`] = true;
    });
    localStorage.removeItem("lm.entries");
    localStorage.removeItem("lm.plans");
    return out;
  } catch {
    return w;
  }
}

type LoadState = { status: "idle" | "loading" | "ok" | "error"; error?: string };

export type TautanSiapPakai = { scriptUrl: string; token: string };

type Ctx = {
  settings: Settings;
  setSettings: (p: Partial<Settings>) => void;
  tabs: Tab[];
  week: WeekData | null;
  weeks: Record<string, WeekData>;
  loadState: LoadState;
  reload: (gid?: string) => Promise<void>;
  updateWeek: (fn: (w: WeekData) => WeekData) => void;
  trend: Persisted["trend"];
  loadTrend: (n?: number) => Promise<void>;
  trendLoading: boolean;
  dirtyCount: number;
  /** Semua isian tertunda, termasuk tab lain yang pernah dibuka. */
  pendingCount: number;
  syncState: SyncState;
  syncLog: SyncLog[];
  /** Kirim sekarang (paksa, walau sinkron otomatis dimatikan). */
  syncNow: () => Promise<void>;
  /** Tandai sudah dipindahkan manual (mode salin-tempel). */
  tandaiManual: () => void;
  /** Tandai seluruh isian tab aktif untuk dikirim ulang (pemulihan / sinkron penuh). */
  kirimSemua: () => void;
  hapusLog: () => void;
  /** Pengaturan dari tautan siap pakai (#/sinkron?setup=…). */
  tautan: TautanSiapPakai | null;
  terapkanTautan: () => void;
  buangTautan: () => void;
};

const AppCtx = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Persisted>(load);
  const [loadState, setLoadState] = useState<LoadState>({ status: "idle" });
  const [trendLoading, setTrendLoading] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>({ status: "idle", pending: 0 });
  const [tautan, setTautan] = useState<TautanSiapPakai | null>(null);

  const dataRef = useRef(data);
  dataRef.current = data;

  const sending = useRef(false);
  const again = useRef(false);
  const percobaan = useRef(0);
  const timer = useRef<number | null>(null);
  const runRef = useRef<(paksa?: boolean) => Promise<void>>(async () => {});

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch {
      /* kuota penuh */
    }
  }, [data]);

  /* ----------------------------- sinkron otomatis ----------------------------- */

  const catatLog = useCallback((e: SyncLog) => {
    setData((d) => ({ ...d, log: [e, ...(d.log ?? [])].slice(0, 30) }));
  }, []);

  const pendingSekarang = useCallback(() => jumlahTertunda(dataRef.current.weeks), []);

  const flush = useCallback(
    async (paksa = false) => {
      if (timer.current) {
        window.clearTimeout(timer.current);
        timer.current = null;
      }
      const st = dataRef.current.settings;

      if (!st.scriptUrl || !st.token) {
        setSyncState({ status: "setup", pending: pendingSekarang() });
        return;
      }
      if (!st.autoSync && !paksa) {
        setSyncState({ status: "off", pending: pendingSekarang() });
        return;
      }
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        setSyncState({ status: "offline", pending: pendingSekarang(), pesan: "Tidak ada koneksi internet. Isian menunggu dikirim." });
        return;
      }
      if (sending.current) {
        again.current = true;
        return;
      }

      sending.current = true;
      const sudah = new Set<string>();
      const gagalBaris: string[] = [];

      try {
        for (let putaran = 0; putaran < 20; putaran++) {
          const w = Object.values(dataRef.current.weeks).find((x) => !sudah.has(x.gid) && Object.keys(x.dirty ?? {}).length);
          if (!w) break;
          const k = siapkanKiriman(w, st.token, st.nama);
          sudah.add(w.gid);
          if (!k) continue; // tidak ada isi yang bisa ditulis (mis. presensi belum lengkap)

          setSyncState({ status: "sending", pending: pendingSekarang() });
          const r = await kirimKeScript(st.scriptUrl, k.payload);
          if (!r.ok) throw new Error(r.error ?? "Skrip menolak tulisan ke sheet.");

          // Bila balasan skrip tidak terbaca (mode no-cors), pastikan sheet benar-benar berubah.
          if (!r.verified && !(await verifikasiKiriman(k))) {
            throw new Error("Skrip menerima kiriman, tetapi sheet belum berubah. Periksa token dan nama tab.");
          }

          const at = Date.now();
          setData((d) => {
            const cur = d.weeks[k.gid];
            return cur ? { ...d, weeks: { ...d.weeks, [k.gid]: tandaiTerkirim(cur, k, at) } } : d;
          });
          if (r.gagal?.length) gagalBaris.push(...r.gagal);
          catatLog({
            at,
            ok: true,
            gid: k.gid,
            tab: k.tab,
            sel: r.ditulis ?? k.sel,
            pesan: r.gagal?.length ? `${r.gagal.length} baris tidak ditemukan di sheet` : undefined,
          });
          percobaan.current = 0;
        }
        setSyncState({
          status: "ok",
          pending: pendingSekarang(),
          at: Date.now(),
          gagal: gagalBaris.length ? gagalBaris : undefined,
        });
      } catch (e) {
        const pesan = e instanceof Error ? e.message : "Gagal mengirim ke Google Sheet.";
        percobaan.current += 1;
        const n = percobaan.current;
        catatLog({ at: Date.now(), ok: false, gid: "", tab: "", sel: 0, pesan });
        setSyncState({ status: "error", pending: pendingSekarang(), pesan, percobaan: n });
        if (n <= ULANG.length) {
          timer.current = window.setTimeout(() => {
            timer.current = null;
            void runRef.current(true);
          }, ULANG[n - 1]);
        }
      } finally {
        sending.current = false;
        if (again.current) {
          again.current = false;
          timer.current = window.setTimeout(() => {
            timer.current = null;
            void runRef.current(true);
          }, 400);
        }
      }
    },
    [catatLog, pendingSekarang],
  );

  useEffect(() => {
    runRef.current = flush;
  }, [flush]);

  const pendingCount = useMemo(() => jumlahTertunda(data.weeks), [data.weeks]);

  /** Sidik isian tertunda: berubah setiap kali ada isian baru / diubah (termasuk isian yang sama). */
  const pendingSig = useMemo(() => {
    const bagian: string[] = [];
    Object.values(data.weeks).forEach((w) => {
      const keys = Object.keys(w.dirty ?? {}).sort();
      if (keys.length) bagian.push(`${w.gid}#${keys.map((k) => `${k}@${w.meta[k]?.at ?? 0}`).join(",")}`);
    });
    return bagian.join("|");
  }, [data.weeks]);

  // Kirim otomatis setiap kali ada isian tersimpan (dengan jeda singkat).
  useEffect(() => {
    const st = data.settings;

    if (!st.scriptUrl || !st.token) {
      setSyncState((s) => (s.status === "setup" && s.pending === pendingCount ? s : { status: "setup", pending: pendingCount, at: s.at }));
      return;
    }
    if (!st.autoSync) {
      setSyncState((s) => (s.status === "off" && s.pending === pendingCount ? s : { status: "off", pending: pendingCount, at: s.at }));
      return;
    }
    if (!pendingCount) {
      setSyncState((s) =>
        s.status === "sending" ? s : { status: s.at ? "ok" : "idle", pending: 0, at: s.at, gagal: s.gagal },
      );
      return;
    }
    if (syncState.status === "error") {
      // Biarkan percobaan ulang berjalan sesuai jeda. Bila jeda sudah habis, coba lagi saat ada isian baru.
      if ((syncState.percobaan ?? 0) > ULANG.length) {
        percobaan.current = 0;
        setSyncState((s) => ({ ...s, pending: pendingCount }));
        const t0 = window.setTimeout(() => {
          void runRef.current(true);
        }, 1200);
        return () => window.clearTimeout(t0);
      }
      setSyncState((s) => (s.pending === pendingCount ? s : { ...s, pending: pendingCount }));
      return;
    }

    setSyncState((s) => (s.status === "sending" ? { ...s, pending: pendingCount } : { status: "queued", pending: pendingCount, at: s.at }));
    const t = window.setTimeout(() => {
      void runRef.current();
    }, JEDA_TULIS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCount, pendingSig, data.settings.scriptUrl, data.settings.token, data.settings.autoSync]);

  // Segera kirim lagi saat koneksi kembali.
  useEffect(() => {
    const online = () => {
      percobaan.current = 0;
      void runRef.current(true);
    };
    const offline = () => {
      if (dataRef.current.settings.scriptUrl) setSyncState({ status: "offline", pending: pendingSekarang(), pesan: "Tidak ada koneksi internet." });
    };
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, [pendingSekarang]);

  const syncNow = useCallback(async () => {
    percobaan.current = 0;
    await runRef.current(true);
  }, []);

  const tandaiManual = useCallback(() => {
    setData((d) => {
      const g = d.settings.activeGid;
      const w = d.weeks[g];
      if (!w) return d;
      return { ...d, weeks: { ...d.weeks, [g]: { ...w, dirty: {}, syncedAt: Date.now() } } };
    });
  }, []);

  const kirimSemua = useCallback(() => {
    setData((d) => {
      const g = d.settings.activeGid;
      const w = d.weeks[g];
      if (!w) return d;
      const dirty: Record<string, true> = { ...w.dirty };
      SLOT_ROWS.forEach(({ tim, sub }) => {
        w.dates.forEach((dd) => {
          dirty[`A:${slotKey(tim.id, sub, dd)}`] = true;
        });
        dirty[`L:${lampKey(tim.id, sub)}`] = true;
      });
      TIMS.forEach((t) => {
        dirty[`B:${t.id}`] = true;
      });
      w.dates.forEach((dd) => {
        const k = norm(dd);
        if (w.presensi[k]?.hadir != null) dirty[`C:${k}`] = true;
        const a = w.aplikasi[k];
        if (a && Object.values(a).some((v) => v !== null)) dirty[`P:${k}`] = true;
      });
      return { ...d, weeks: { ...d.weeks, [g]: { ...w, dirty } } };
    });
    window.setTimeout(() => void runRef.current(true), 500);
  }, []);

  const hapusLog = useCallback(() => setData((d) => ({ ...d, log: [] })), []);

  /* -------------------------- pengaturan dari tautan -------------------------- */

  useEffect(() => {
    const h = window.location.hash;
    const m = h.match(/[?&]setup=([^&]+)/);
    if (!m) return;
    try {
      const j = JSON.parse(decodeURIComponent(atob(decodeURIComponent(m[1])))) as { u?: string; t?: string };
      if (j.u && j.t) setTautan({ scriptUrl: String(j.u), token: String(j.t) });
    } catch {
      /* tautan rusak — abaikan */
    }
    const bersih = h.replace(/([?&])setup=[^&]*/, "$1").replace(/[?&]$/, "");
    window.history.replaceState(null, "", bersih || "#/sinkron");
  }, []);

  const terapkanTautan = useCallback(() => {
    if (!tautan) return;
    setData((d) => ({
      ...d,
      settings: { ...d.settings, scriptUrl: tautan.scriptUrl, token: tautan.token, autoSync: true },
    }));
    setTautan(null);
    percobaan.current = 0;
    window.setTimeout(() => void runRef.current(true), 300);
  }, [tautan]);

  const buangTautan = useCallback(() => setTautan(null), []);

  /* ---------------------------------- data ---------------------------------- */

  const tabs = useMemo(() => {
    const seen = new Set<string>();
    return [...data.settings.extraTabs, ...DEFAULT_TABS].filter((t) => (seen.has(t.gid) ? false : (seen.add(t.gid), true)));
  }, [data.settings.extraTabs]);

  const setSettings = useCallback((p: Partial<Settings>) => {
    setData((d) => ({ ...d, settings: { ...d.settings, ...p } }));
  }, []);

  const reload = useCallback(
    async (gid?: string) => {
      const g = gid ?? dataRef.current.settings.activeGid;
      const tab = tabs.find((t) => t.gid === g) ?? { name: g, gid: g };
      setLoadState({ status: "loading" });
      try {
        let fresh = await fetchWeek(g, tab.name);
        const local = dataRef.current.weeks[g];
        if (!local && g === DEFAULT_TABS[0].gid) fresh = migrasiLama(fresh);
        const merged = mergeWeek(fresh, local);
        const r = ringkas(merged);
        setData((d) => ({
          ...d,
          weeks: { ...d.weeks, [g]: merged },
          trend: { ...d.trend, [g]: { ...r, judul: tab.name } },
        }));
        setLoadState({ status: "ok" });
      } catch (e) {
        setLoadState({ status: "error", error: e instanceof Error ? e.message : "Gagal memuat sheet." });
      }
    },
    [tabs],
  );

  const updateWeek = useCallback((fn: (w: WeekData) => WeekData) => {
    setData((d) => {
      const g = d.settings.activeGid;
      const w = d.weeks[g];
      if (!w) return d;
      const next = fn(w);
      return { ...d, weeks: { ...d.weeks, [g]: next }, trend: { ...d.trend, [g]: { ...ringkas(next), judul: w.tab } } };
    });
  }, []);

  const loadTrend = useCallback(
    async (n = 6) => {
      setTrendLoading(true);
      const pick = tabs.slice(0, n);
      const results = await Promise.allSettled(pick.map((t) => fetchWeek(t.gid, t.name)));
      setData((d) => {
        const trend = { ...d.trend };
        results.forEach((r, i) => {
          if (r.status === "fulfilled") {
            const local = d.weeks[pick[i].gid];
            const w = local ? mergeWeek(r.value, local) : r.value;
            trend[pick[i].gid] = { ...ringkas(w), judul: pick[i].name };
          }
        });
        return { ...d, trend };
      });
      setTrendLoading(false);
    },
    [tabs],
  );

  // muat tab aktif saat pertama dibuka / saat tab berganti
  useEffect(() => {
    reload(data.settings.activeGid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.settings.activeGid]);

  const week = data.weeks[data.settings.activeGid] ?? null;
  const dirtyCount = week ? Object.keys(week.dirty).length : 0;

  const value: Ctx = {
    settings: data.settings,
    setSettings,
    tabs,
    week,
    weeks: data.weeks,
    loadState,
    reload,
    updateWeek,
    trend: data.trend,
    loadTrend,
    trendLoading,
    dirtyCount,
    pendingCount,
    syncState,
    syncLog: data.log ?? [],
    syncNow,
    tandaiManual,
    kirimSemua,
    hapusLog,
    tautan,
    terapkanTautan,
    buangTautan,
  };

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp() {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp di luar AppProvider");
  return c;
}

/* ---------------------------- helper mutasi ---------------------------- */

export function setKegiatan(w: WeekData, k: string, items: string[], oleh: string): WeekData {
  const kegiatan = { ...w.kegiatan };
  if (items.length) kegiatan[k] = items;
  else delete kegiatan[k];
  return { ...w, kegiatan, dirty: { ...w.dirty, [`A:${k}`]: true }, meta: { ...w.meta, [`A:${k}`]: { oleh, at: Date.now() } } };
}

export function setLampiran(w: WeekData, k: string, url: string, oleh: string): WeekData {
  // beberapa tautan ditulis bernomor urut, satu tautan apa adanya
  const isi = normalisasiLinks(url);
  if (samaLinks(w.lampiran[k] ?? "", isi)) return w;
  const lampiran = { ...w.lampiran };
  if (isi) lampiran[k] = isi;
  else delete lampiran[k];
  return { ...w, lampiran, dirty: { ...w.dirty, [`L:${k}`]: true }, meta: { ...w.meta, [`L:${k}`]: { oleh, at: Date.now() } } };
}

export function setRencana(w: WeekData, tim: string, items: string[], oleh: string): WeekData {
  const rencana = { ...w.rencana };
  if (items.length) rencana[tim] = items;
  else delete rencana[tim];
  return { ...w, rencana, dirty: { ...w.dirty, [`B:${tim}`]: true }, meta: { ...w.meta, [`B:${tim}`]: { oleh, at: Date.now() } } };
}
