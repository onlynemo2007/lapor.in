import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { DEFAULT_TABS, type Tab, type WeekData, ringkas, type Ringkasan, splitUraian, slotKey, lampKey, norm, TIMS } from "./model";
import { fetchWeek, mergeWeek } from "./sheet";

export type Settings = {
  nama: string;
  timUtama: string;
  scriptUrl: string;
  token: string;
  activeGid: string;
  extraTabs: Tab[];
};

type Persisted = { v: 1; settings: Settings; weeks: Record<string, WeekData>; trend: Record<string, Ringkasan & { judul: string }> };

const KEY = "laporin:v2";

const defaultSettings: Settings = {
  nama: "",
  timUtama: "",
  scriptUrl: "",
  token: "",
  activeGid: DEFAULT_TABS[0].gid,
  extraTabs: [],
};

function load(): Persisted {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Persisted;
      return { v: 1, settings: { ...defaultSettings, ...p.settings }, weeks: p.weeks ?? {}, trend: p.trend ?? {} };
    }
  } catch {
    /* abaikan */
  }
  return { v: 1, settings: defaultSettings, weeks: {}, trend: {} };
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
};

const AppCtx = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Persisted>(load);
  const [loadState, setLoadState] = useState<LoadState>({ status: "idle" });
  const [trendLoading, setTrendLoading] = useState(false);
  const dataRef = useRef(data);
  dataRef.current = data;

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch {
      /* kuota penuh */
    }
  }, [data]);

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
  if ((w.lampiran[k] ?? "") === url) return w;
  const lampiran = { ...w.lampiran };
  if (url) lampiran[k] = url;
  else delete lampiran[k];
  return { ...w, lampiran, dirty: { ...w.dirty, [`L:${k}`]: true }, meta: { ...w.meta, [`L:${k}`]: { oleh, at: Date.now() } } };
}

export function setRencana(w: WeekData, tim: string, items: string[], oleh: string): WeekData {
  const rencana = { ...w.rencana };
  if (items.length) rencana[tim] = items;
  else delete rencana[tim];
  return { ...w, rencana, dirty: { ...w.dirty, [`B:${tim}`]: true }, meta: { ...w.meta, [`B:${tim}`]: { oleh, at: Date.now() } } };
}
