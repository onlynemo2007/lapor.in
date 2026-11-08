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
  lampiranPerTanggal,
  normalisasiLampiran,
  selKey,
  samaLampiran,
  SLOT_ROWS,
  TIMS,
} from "./model";
import { aturMinggu, buatTabBaru, cekPin, fetchWeek, kirimKeScript, mergeWeek, tesScript, type SkripInfo } from "./sheet";
import { bacaKoneksiMentah, bersihkanTautan, dariTautan, koneksiBawaan, tentukanKoneksi } from "./koneksi";
import { jumlahTertunda, siapkanKiriman, tandaiTerkirim, verifikasiKiriman, type SyncLog, type SyncState } from "./sync";

export type Settings = {
  nama: string;
  timUtama: string;
  scriptUrl: string;
  token: string;
  /** Kirim otomatis setiap isian disimpan (tanpa menekan tombol). */
  autoSync: boolean;
  /** PIN admin perangkat ini — diverifikasi skrip, tidak pernah disimpan di skrip. */
  pinAdmin?: string;
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
/** URL Web App + token disimpan terpisah agar tidak ikut hilang saat data mingguan berubah/dibersihkan. */
const KEY_KONEKSI = "laporin:koneksi";

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
  pinAdmin: "",
  activeGid: DEFAULT_TABS[0].gid,
  extraTabs: [],
};

/** Koneksi Apps Script tersimpan sendiri; null berarti belum pernah disimpan. */
function bacaKoneksi() {
  try {
    return bacaKoneksiMentah(localStorage.getItem(KEY_KONEKSI));
  } catch {
    return null;
  }
}

/** Koneksi bawaan build (Vercel Environment Variables) — dipakai perangkat yang belum tersambung. */
function bawaanBuild() {
  return koneksiBawaan(import.meta.env);
}

function load(): Persisted {
  let settings: Settings = defaultSettings;
  let weeks: Record<string, WeekData> = {};
  let trend: Persisted["trend"] = {};
  let log: SyncLog[] = [];
  try {
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem(KEY_LAMA);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Persisted>;
      settings = { ...defaultSettings, ...p.settings };
      weeks = p.weeks ?? {};
      trend = p.trend ?? {};
      log = p.log ?? [];
    }
  } catch {
    /* data rusak — pakai bawaan, koneksi tetap dibaca di bawah */
  }
  // Koneksi tersimpan terpisah: menang bila ada; kalau perangkat ini belum pernah
  // tersambung, koneksi bawaan build dipakai supaya rekan setim tidak perlu mengisi apa pun.
  // Kunci `laporin:koneksi` yang belum pernah dibuat tidak boleh menghapus URL/token
  // yang tersimpan di data utama (versi lama aplikasi menyimpannya di sana).
  const tersimpan = bacaKoneksi() ?? (settings.scriptUrl || settings.token ? { scriptUrl: settings.scriptUrl, token: settings.token } : null);
  const koneksi = tentukanKoneksi(tersimpan, bawaanBuild());
  settings = {
    ...settings,
    scriptUrl: koneksi.scriptUrl,
    token: koneksi.token,
    autoSync: koneksi.autoSync ?? settings.autoSync,
  };
  return { v: 2, settings, weeks, trend, log };
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

export type HasilBuatMinggu = { ok: boolean; gid?: string; nama?: string; error?: string; terbaca?: boolean };

type Ctx = {
  settings: Settings;
  setSettings: (p: Partial<Settings>) => void;
  /** Putus koneksi Apps Script di perangkat ini (URL & token dikosongkan). */
  putuskanKoneksi: () => void;
  tabs: Tab[];
  week: WeekData | null;
  weeks: Record<string, WeekData>;
  loadState: LoadState;
  /** Muat ulang tab dari sheet; hasil `true` bila berhasil terbaca. `senyap` = tanpa indikator memuat. */
  /** Muat ulang tab dari sheet. `tanpaLokal` = abaikan isian lokal yang belum terkirim (dipakai saat bentrok). */
  reload: (gid?: string, senyap?: boolean, tanpaLokal?: boolean) => Promise<boolean>;
  /** Waktu (ms) sheet terakhir berhasil dibaca ulang — dipakai pratinjau agar selalu data terbaru. */
  dibacaAt?: number;
  /** Pembacaan sheet terakhir gagal (data yang tampil bisa lebih lama dari sheet). */
  gagalBaca: { at: number; pesan: string } | null;
  /**
   * Buat tab minggu baru di spreadsheet: salinan struktur tab sumber,
   * isian mingguan kosong, tanggal digeser (default +7 hari).
   */
  buatMingguBaru: (p: { nama: string; sumberGid?: string; geserHari?: number }) => Promise<HasilBuatMinggu>;
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
  /** Versi Apps Script terakhir yang terbaca dari sheet (mis. "1.3", "1.4"). */
  versiSkrip: string;
  /** Periksa skrip: versi & daftar tab. `true` bila skrip merespons. */
  periksaSkrip: () => Promise<{ ok: boolean; versi?: string; nama?: string; jumlahTab?: number; error?: string }>;
  /** Info terakhir dari skrip: minggu terbaru, minggu yang dibuka admin, ada PIN atau belum. */
  skripInfo: SkripInfo | null;
  /** Tab minggu aktif sudah ditutup (baca-saja) menurut skrip. */
  terkunciAktif: boolean;
  /** Buka / kunci kembali satu minggu — hanya berhasil bila PIN admin benar. */
  aturKunciMinggu: (gid: string, buka: boolean) => Promise<{ ok: boolean; error?: string }>;
  /** Periksa PIN admin ke skrip; bila benar disimpan di perangkat ini. */
  masukAdmin: (pin: string) => Promise<{ ok: boolean; error?: string }>;
  /** Lupakan PIN admin di perangkat ini. */
  keluarAdmin: () => void;
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
  const [versiSkrip, setVersiSkrip] = useState("");
  const [skripInfo, setSkripInfo] = useState<SkripInfo | null>(null);
  const [dibacaAt, setDibacaAt] = useState<number>();
  /** Gagal baca terakhir (mis. jaringan/Google menolak) — supaya data lama tidak tampil tanpa tanda. */
  const [gagalBaca, setGagalBaca] = useState<{ at: number; pesan: string } | null>(null);

  const dataRef = useRef(data);
  dataRef.current = data;

  /** Perangkat ini sengaja diputuskan dari Apps Script (koneksi bawaan tidak boleh memaksa masuk). */
  const putusRef = useRef<boolean>(bacaKoneksi()?.putus === true);
  /** gid yang sedang dikirim ULANG seluruhnya (butuh PIN admin di skrip). */
  const penuhRef = useRef<string | null>(null);

  const sending = useRef(false);
  const again = useRef(false);
  const percobaan = useRef(0);
  const timer = useRef<number | null>(null);
  const runRef = useRef<(paksa?: boolean) => Promise<void>>(async () => {});
  const reloadRef = useRef<(gid?: string, senyap?: boolean, tanpaLokal?: boolean) => Promise<boolean>>(async () => false);

  useEffect(() => {
    // 1) Koneksi Apps Script disimpan lebih dulu (kecil, hampir tidak mungkin gagal)
    try {
      const tersambung = !!(data.settings.scriptUrl && data.settings.token);
      localStorage.setItem(
        KEY_KONEKSI,
        JSON.stringify({
          scriptUrl: data.settings.scriptUrl,
          token: data.settings.token,
          autoSync: data.settings.autoSync,
          putus: putusRef.current && !tersambung,
        }),
      );
    } catch {
      /* penyimpanan penuh — data lain di bawah tetap dicoba */
    }
    // 2) Data mingguan & riwayat
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch {
      // Kuota penuh: simpan versi ringkas agar isian & koneksi tetap aman
      try {
        localStorage.setItem(KEY, JSON.stringify({ v: 2, settings: data.settings, weeks: data.weeks, trend: {}, log: [] }));
      } catch {
        /* menyerah dengan tenang — koneksi sudah tersimpan terpisah */
      }
    }
  }, [data]);

  // Segarkan daftar tab sekali saat aplikasi dibuka: tab minggu baru yang sudah
  // dibuat (dari perangkat lain) langsung muncul di pemilih minggu.
  const pingAwal = useRef(false);
  useEffect(() => {
    if (pingAwal.current) return;
    pingAwal.current = true;
    const st = dataRef.current.settings;
    if (!st.scriptUrl) return;
    void (async () => {
      try {
        const r = await tesScript(st.scriptUrl);
        if (r.versi) setVersiSkrip(String(r.versi));
        setSkripInfo(r);
        if (!r.ok || !r.tabs?.length) return;
        const extra = r.tabs.filter((t) => !t.name.startsWith("_"));
        setData((d) => ({ ...d, settings: { ...d.settings, extraTabs: extra } }));
      } catch {
        /* diamkan — daftar tab bawaan tetap dipakai */
      }
    })();
  }, []);

  /** Ping Apps Script: perbarui versi skrip + daftar tab. */
  const periksaSkrip = useCallback(async () => {
    const st = dataRef.current.settings;
    if (!st.scriptUrl) return { ok: false, error: "URL Web App belum diisi." };
    try {
      const r = await tesScript(st.scriptUrl);
      if (r.versi) setVersiSkrip(String(r.versi));
      setSkripInfo(r);
      if (r.ok && r.tabs?.length) {
        const extra = r.tabs.filter((t) => !t.name.startsWith("_"));
        setData((d) => ({ ...d, settings: { ...d.settings, extraTabs: extra } }));
      }
      return { ok: !!r.ok, versi: r.versi, nama: r.nama, jumlahTab: r.tabs?.length };
    } catch {
      return { ok: false, error: "Tidak bisa terhubung ke Apps Script." };
    }
  }, []);

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
      // Skrip menolak kiriman tanpa nama pengisi (jejak audit tidak berguna bila kosong).
      if (String(st.nama || "").trim().length < 2) {
        setSyncState({
          status: "nama",
          pending: pendingSekarang(),
          pesan: "Isi nama Anda dulu (klik profil di kiri bawah) supaya isian bisa dikirim ke sheet.",
        });
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
      const konflikBaris: string[] = [];

      try {
        for (let putaran = 0; putaran < 20; putaran++) {
          const w = Object.values(dataRef.current.weeks).find((x) => !sudah.has(x.gid) && Object.keys(x.dirty ?? {}).length);
          if (!w) break;
          const k = siapkanKiriman(w, st.token, st.nama);
          sudah.add(w.gid);
          if (!k) continue; // tidak ada isi yang bisa ditulis (mis. presensi belum lengkap)

          if (penuhRef.current === w.gid) {
            k.payload.penuh = true;
            k.payload.pin = st.pinAdmin ?? "";
          }
          setSyncState({ status: "sending", pending: pendingSekarang() });
          const r = await kirimKeScript(st.scriptUrl, k.payload);
          if (!r.ok) throw new Error(r.error ?? "Skrip menolak tulisan ke sheet.");
          if (r.konflik?.length) {
            // Anti-timpa: sel sudah diubah rekan. Jangan timpa — buang isian lokal tab ini
            // lalu muat ulang dari sheet supaya tampilan & isian kembali sama.
            konflikBaris.push(...r.konflik);
            setData((d) => {
              const cur = d.weeks[w.gid];
              return cur ? { ...d, weeks: { ...d.weeks, [w.gid]: { ...cur, dirty: {} } } } : d;
            });
          }

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
        if (konflikBaris.length) {
          setSyncState({
            status: "konflik",
            pending: pendingSekarang(),
            pesan: `${konflikBaris.length} isian tidak dikirim karena selnya sudah diubah rekan. Tampilan dimuat ulang dari sheet — silakan periksa lagi.`,
          });
          // Isian lokal yang bentrok tidak boleh dipertahankan: ambil apa adanya dari sheet.
          void reloadRef.current(undefined, true, true);
        } else {
          setSyncState({
            status: "ok",
            pending: pendingSekarang(),
            at: Date.now(),
            gagal: gagalBaris.length ? gagalBaris : undefined,
          });
        }
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
        penuhRef.current = null;
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
    // Nama kosong / konflik: jangan kirim otomatis berulang sampai pengguna bertindak.
    if (syncState.status === "nama" || syncState.status === "konflik") return;
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
      w.anggaran.forEach((a) => {
        if (a.kode) dirty[`R:${a.kode}`] = true;
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
      penuhRef.current = g;
      return { ...d, weeks: { ...d.weeks, [g]: { ...w, dirty } } };
    });
    window.setTimeout(() => void runRef.current(true), 500);
  }, []);

  const hapusLog = useCallback(() => setData((d) => ({ ...d, log: [] })), []);

  /* -------------------------- pengaturan dari tautan -------------------------- */

  const pasangKoneksi = useCallback((k: TautanSiapPakai) => {
    putusRef.current = false;
    setData((d) => ({
      ...d,
      settings: {
        ...d.settings,
        // nilai lama tidak dihapus kalau tautan tidak membawa isian tersebut
        scriptUrl: k.scriptUrl || d.settings.scriptUrl,
        token: k.token || d.settings.token,
        autoSync: true,
      },
    }));
    percobaan.current = 0;
    // Kirim isian yang tertunda, lalu ambil isi sheet terbaru (perangkat ini baru bergabung).
    window.setTimeout(() => void runRef.current(true), 300);
    window.setTimeout(() => void reloadRef.current(undefined, true), 900);
  }, []);

  useEffect(() => {
    const h = window.location.hash;
    const k = dariTautan(h);
    if (!k) return;
    const st = dataRef.current.settings;
    // Perangkat yang belum tersambung langsung memakai tautan ini — rekan cukup membuka tautan.
    if (!st.scriptUrl || !st.token) pasangKoneksi(k);
    else setTautan(k);
    window.history.replaceState(null, "", bersihkanTautan(h));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const terapkanTautan = useCallback(() => {
    if (!tautan) return;
    pasangKoneksi(tautan);
    setTautan(null);
  }, [tautan, pasangKoneksi]);

  const buangTautan = useCallback(() => setTautan(null), []);

  /* ---------------------------------- data ---------------------------------- */

  const tabs = useMemo(() => {
    const seen = new Set<string>();
    return [...data.settings.extraTabs, ...DEFAULT_TABS].filter((t) => (seen.has(t.gid) ? false : (seen.add(t.gid), true)));
  }, [data.settings.extraTabs]);

  const setSettings = useCallback((p: Partial<Settings>) => {
    // Mengisi URL/token berarti perangkat ini kembali tersambung (batalkan penanda “putus”).
    if (p.scriptUrl || p.token) putusRef.current = false;
    setData((d) => {
      const baru = { ...d.settings, ...p };
      // URL Web App & token yang sudah ada tidak boleh terhapus oleh nilai kosong.
      // Untuk memutus koneksi, gunakan putuskanKoneksi().
      if (!p.scriptUrl) baru.scriptUrl = d.settings.scriptUrl;
      if (!p.token) baru.token = d.settings.token;
      return { ...d, settings: baru };
    });
  }, []);

  /** Putus koneksi Apps Script di perangkat ini saja (sheet tidak diubah). */
  const putuskanKoneksi = useCallback(() => {
    putusRef.current = true;
    setData((d) => ({ ...d, settings: { ...d.settings, scriptUrl: "", token: "" } }));
  }, []);

  const reload = useCallback(
    async (gid?: string, senyap = false, tanpaLokal = false) => {
      const g = gid ?? dataRef.current.settings.activeGid;
      const tab = tabs.find((t) => t.gid === g) ?? { name: g, gid: g };
      if (!senyap) setLoadState({ status: "loading" });
      try {
        let fresh = await fetchWeek(g, tab.name);
        const local = tanpaLokal ? undefined : dataRef.current.weeks[g];
        if (!local && g === DEFAULT_TABS[0].gid) fresh = migrasiLama(fresh);
        const merged = mergeWeek(fresh, local);
        const r = ringkas(merged);
        setData((d) => ({
          ...d,
          weeks: { ...d.weeks, [g]: merged },
          trend: { ...d.trend, [g]: { ...r, judul: tab.name } },
        }));
        setDibacaAt(Date.now());
        setGagalBaca(null);
        if (!senyap) setLoadState({ status: "ok" });
        return true;
      } catch (e) {
        // pembaruan senyap tidak boleh menutupi status pemuatan yang sudah baik,
        // tetapi kegagalannya tetap dicatat agar data lama tidak tampil tanpa tanda.
        const pesan = e instanceof Error ? e.message : "Gagal memuat sheet.";
        setGagalBaca({ at: Date.now(), pesan });
        if (!senyap) setLoadState({ status: "error", error: pesan });
        return false;
      }
    },
    [tabs],
  );

  useEffect(() => {
    reloadRef.current = reload;
  }, [reload]);

  /** Buat tab minggu baru di spreadsheet (lewat Apps Script), lalu buka tab itu. */
  const buatMingguBaru = useCallback(
    async (p: { nama: string; sumberGid?: string; geserHari?: number }): Promise<HasilBuatMinggu> => {
      const st = dataRef.current.settings;
      if (!st.scriptUrl || !st.token) return { ok: false, error: "Sambungkan Apps Script dulu agar aplikasi bisa membuat tab baru." };
      const nama = p.nama.replace(/\s+/g, " ").trim();
      if (!nama) return { ok: false, error: "Nama tab baru belum diisi." };
      const sumber = p.sumberGid || st.activeGid;
      try {
        const r = await buatTabBaru(st.scriptUrl, st.token, sumber, nama, p.geserHari ?? 7, st.nama, st.pinAdmin ?? "");
        if (!r.ok || !r.gid) return { ok: false, error: r.error ?? "Tab baru tidak dibuat." };
        const tab: Tab = { name: r.name ?? nama, gid: String(r.gid) };
        setData((d) => ({
          ...d,
          settings: {
            ...d.settings,
            extraTabs: [tab, ...d.settings.extraTabs.filter((t) => t.gid !== tab.gid)],
            activeGid: tab.gid,
          },
        }));
        catatLog({ at: Date.now(), ok: true, gid: tab.gid, tab: tab.name, sel: 0, pesan: "Tab minggu baru dibuat dari tab sebelumnya" });
        // Tab yang baru dibuat kadang belum langsung tersedia pada ekspor CSV — coba beberapa kali.
        let terbaca = false;
        for (let i = 0; i < 3 && !terbaca; i++) {
          if (i) await new Promise((res) => setTimeout(res, 1600));
          terbaca = await reload(tab.gid);
        }
        return { ok: true, gid: tab.gid, nama: tab.name, terbaca };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "Gagal membuat tab baru." };
      }
    },
    [catatLog, reload],
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

  // Segarkan diam-diam dari sheet saat jendela kembali aktif / ditinggal lama terbuka,
  // supaya pratinjau & cetak selalu memakai isi sheet terbaru (perubahan rekan ikut terbaca).
  const dibacaRef = useRef(0);
  useEffect(() => {
    dibacaRef.current = dibacaAt ?? 0;
  }, [dibacaAt]);
  useEffect(() => {
    const segarkan = () => {
      if (document.visibilityState === "hidden") return;
      if (Date.now() - dibacaRef.current < 15000) return;
      void reload(undefined, true);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") segarkan();
    };
    window.addEventListener("focus", segarkan);
    document.addEventListener("visibilitychange", onVisible);
    const jam = window.setInterval(segarkan, 120000);
    return () => {
      window.removeEventListener("focus", segarkan);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(jam);
    };
  }, [reload]);

  /** PIN admin diperiksa ke skrip (PIN tidak disimpan di skrip, hanya di perangkat ini). */
  const masukAdmin = useCallback(async (pin: string) => {
    const st = dataRef.current.settings;
    if (!st.scriptUrl) return { ok: false, error: "Sambungkan Apps Script dulu." };
    if (!pin.trim()) return { ok: false, error: "PIN admin belum diisi." };
    const r = await cekPin(st.scriptUrl, pin.trim());
    if (!r.ok) {
      return {
        ok: false,
        error: r.error ?? (r.adaPin === false ? "PIN admin belum disetel di skrip (Script Properties → PIN_ADMIN)." : "PIN admin salah."),
      };
    }
    setSettings({ pinAdmin: pin.trim() });
    return { ok: true };
  }, [setSettings]);

  const keluarAdmin = useCallback(() => setSettings({ pinAdmin: "" }), [setSettings]);

  /** Buka/kunci satu minggu — skrip yang memutuskan, PIN diverifikasi di sana. */
  const aturKunciMinggu = useCallback(async (gid: string, buka: boolean) => {
    const st = dataRef.current.settings;
    if (!st.scriptUrl || !st.token) return { ok: false, error: "Sambungkan Apps Script dulu." };
    try {
      const r = await aturMinggu(st.scriptUrl, st.token, st.pinAdmin ?? "", gid, buka);
      if (!r.ok) return { ok: false, error: r.error ?? "Skrip menolak permintaan." };
      if (r.dibuka === undefined) return { ok: false, error: "Skrip di spreadsheet masih versi lama (butuh v2.2). Perbarui kode di menu Sinkronisasi." };
      setSkripInfo((i) => (i ? { ...i, terbaru: r.terbaru ?? i.terbaru, dibuka: r.dibuka ?? i.dibuka } : i));
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Gagal menghubungi Apps Script." };
    }
  }, []);

  /** Tab minggu aktif sudah ditutup menurut skrip (dan belum dibuka admin). */
  const terkunciAktif = useMemo(() => {
    const gid = data.settings.activeGid;
    const info = skripInfo;
    if (!info?.terbaru) return false;
    if (gid === info.terbaru) return false;
    return !(info.dibuka ?? []).includes(gid);
  }, [skripInfo, data.settings.activeGid]);

  const week = data.weeks[data.settings.activeGid] ?? null;
  const dirtyCount = week ? Object.keys(week.dirty).length : 0;

  const value: Ctx = {
    settings: data.settings,
    setSettings,
    putuskanKoneksi,
    tabs,
    week,
    weeks: data.weeks,
    loadState,
    reload,
    dibacaAt,
    gagalBaca,
    buatMingguBaru,
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
    versiSkrip,
    periksaSkrip,
    skripInfo,
    terkunciAktif,
    aturKunciMinggu,
    masukAdmin,
    keluarAdmin,
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
  // satu baris per tautan, diawali tanggalnya (mis. "2 November 2026: https://…")
  const isi = normalisasiLampiran(url);
  if (samaLampiran(w.lampiran[k] ?? "", isi)) return w;
  const lampiran = { ...w.lampiran };
  if (isi) lampiran[k] = isi;
  else delete lampiran[k];

  // Bila ada tautan lama yang hilang, itu karena user menekan hapus.
  // Selain itu skrip hanya menambah, jadi isi sel tidak pernah tertimpa.
  // Penanda "ganti" disimpan PER TANGGAL: tiap tanggal punya barisnya sendiri di sheet,
  // jadi menghapus tautan tanggal 3 tidak menyentuh baris tanggal lain.
  const lama = lampiranPerTanggal(w.lampiran[k] ?? "");
  const baru = lampiranPerTanggal(isi);
  const at = Date.now();
  const meta = { ...w.meta };
  const semuaTanggal = new Set([...Object.keys(lama), ...Object.keys(baru)]);
  semuaTanggal.forEach((t) => {
    const l = lama[t] ?? [];
    const b = baru[t] ?? [];
    const ganti = l.some((u) => !b.includes(u));
    meta[`L:${k}|${t}`] = { oleh, at, ganti };
  });
  // penanda ringkas untuk status "belum terkirim" (dipakai mesin sinkron)
  meta[`L:${k}`] = { oleh, at, ganti: false };

  return {
    ...w,
    lampiran,
    dirty: { ...w.dirty, [`L:${k}`]: true },
    meta,
  };
}

/** Ubah satu baris realisasi keuangan (bagian D) — pagu, realisasi, atau uraiannya. */
export function setKeuangan(w: WeekData, kode: string, patch: { uraian?: string; pagu?: number; realisasi?: number }, oleh: string): WeekData {
  if (!w.anggaran.some((a) => a.kode === kode)) return w;
  const anggaran = w.anggaran.map((a) => (a.kode === kode ? { ...a, ...patch } : a));
  return {
    ...w,
    anggaran,
    dirty: { ...w.dirty, [`R:${kode}`]: true },
    meta: { ...w.meta, [`R:${kode}`]: { oleh, at: Date.now() } },
  };
}

/** Ubah satu sel tabel keuangan (Rekapitulasi UP, Pembayaran LS, Rencana Penarikan, …). */
export function setSelKeuangan(w: WeekData, baris: number, kolom: number, teks: string, oleh: string): WeekData {
  const k = selKey(baris, kolom);
  return {
    ...w,
    selKeuangan: { ...w.selKeuangan, [k]: teks },
    dirty: { ...w.dirty, [`K:${k}`]: true },
    meta: { ...w.meta, [`K:${k}`]: { oleh, at: Date.now() } },
  };
}

export function setRencana(w: WeekData, tim: string, items: string[], oleh: string): WeekData {
  const rencana = { ...w.rencana };
  if (items.length) rencana[tim] = items;
  else delete rencana[tim];
  return { ...w, rencana, dirty: { ...w.dirty, [`B:${tim}`]: true }, meta: { ...w.meta, [`B:${tim}`]: { oleh, at: Date.now() } } };
}
