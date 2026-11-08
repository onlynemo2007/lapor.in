/* ------------------------------------------------------------------ */
/*  Koneksi Apps Script: dari perangkat, dari tautan, atau dari build  */
/*                                                                     */
/*  URL Web App + token hanya hidup di localStorage tiap browser. Bila */
/*  rekan membuka tautan aplikasi di perangkat lain, perangkat itu     */
/*  belum punya koneksi — jadi:                                        */
/*   1. koneksi yang tersimpan di perangkat menang,                    */
/*   2. kalau perangkat belum pernah menyambung (dan tidak sengaja     */
/*      diputus), dipakai koneksi bawaan build (env) atau tautan       */
/*      siap pakai `#/sinkron?setup=…` yang dibuka.                    */
/* ------------------------------------------------------------------ */

export type Kredensial = { scriptUrl: string; token: string };

export type KoneksiTersimpan = Kredensial & {
  autoSync?: boolean;
  /** Pengguna sengaja menekan “Putuskan koneksi” di perangkat ini. */
  putus?: boolean;
};

/** Env build (Vite). Dibaca lewat import.meta.env agar bisa diisi di Vercel. */
export function koneksiBawaan(env?: { VITE_SCRIPT_URL?: string; VITE_TOKEN?: string } | null): Kredensial | null {
  const url = (env?.VITE_SCRIPT_URL ?? "").trim();
  const token = (env?.VITE_TOKEN ?? "").trim();
  if (!url || !token) return null;
  return { scriptUrl: url, token };
}

/** Baca isi `localStorage["laporin:koneksi"]` dengan aman (null bila kosong/rusak). */
export function bacaKoneksiMentah(raw: string | null | undefined): KoneksiTersimpan | null {
  if (!raw) return null;
  try {
    const k = JSON.parse(raw) as { scriptUrl?: unknown; token?: unknown; autoSync?: unknown; putus?: unknown };
    return {
      scriptUrl: typeof k.scriptUrl === "string" ? k.scriptUrl : "",
      token: typeof k.token === "string" ? k.token : "",
      autoSync: typeof k.autoSync === "boolean" ? k.autoSync : undefined,
      putus: k.putus === true,
    };
  } catch {
    return null;
  }
}

export type HasilKoneksi = {
  scriptUrl: string;
  token: string;
  autoSync?: boolean;
  /** Koneksi berasal dari build/tautan, bukan dari isian di perangkat ini. */
  dariBawaan: boolean;
};

/**
 * Tentukan koneksi yang dipakai:
 * - perangkat yang sudah tersambung tetap memakai koneksinya sendiri,
 * - “Putuskan koneksi” dihormati (koneksi bawaan tidak memaksa masuk lagi),
 * - perangkat baru otomatis tersambung dari koneksi bawaan (env build).
 */
export function tentukanKoneksi(tersimpan: KoneksiTersimpan | null, bawaan: Kredensial | null): HasilKoneksi {
  if (tersimpan?.putus) return { scriptUrl: "", token: "", autoSync: tersimpan.autoSync, dariBawaan: false };
  if (tersimpan?.scriptUrl && tersimpan.token)
    return { scriptUrl: tersimpan.scriptUrl, token: tersimpan.token, autoSync: tersimpan.autoSync, dariBawaan: false };
  if (bawaan) return { scriptUrl: bawaan.scriptUrl, token: bawaan.token, autoSync: tersimpan?.autoSync, dariBawaan: true };
  return {
    scriptUrl: tersimpan?.scriptUrl ?? "",
    token: tersimpan?.token ?? "",
    autoSync: tersimpan?.autoSync,
    dariBawaan: false,
  };
}

/** Ambil URL/token dari tautan siap pakai: `#/sinkron?setup=<base64>`. */
export function dariTautan(hash: string): Kredensial | null {
  const m = hash.match(/[?&]setup=([^&]+)/);
  if (!m) return null;
  try {
    const j = JSON.parse(decodeURIComponent(atob(decodeURIComponent(m[1])))) as { u?: unknown; t?: unknown };
    const scriptUrl = typeof j.u === "string" ? j.u.trim() : "";
    const token = typeof j.t === "string" ? j.t.trim() : "";
    if (!scriptUrl || !token) return null;
    return { scriptUrl, token };
  } catch {
    return null;
  }
}

/** Buang parameter `setup` dari hash supaya token tidak tertinggal di address bar/riwayat. */
export function bersihkanTautan(hash: string): string {
  const [path, qs] = hash.replace(/^#\/?/, "").split("?");
  const jalur = path ? `/${path.replace(/^\/+/, "")}` : "/sinkron";
  if (!qs) return `#${jalur}`;
  const params = new URLSearchParams(qs);
  params.delete("setup");
  const sisa = params.toString();
  return sisa ? `#${jalur}?${sisa}` : `#${jalur}`;
}

/** Bikin tautan siap pakai yang membawa koneksi (untuk dibagikan ke rekan setim). */
export function tautanSiapPakai(origin: string, pathname: string, k: Kredensial): string {
  const isi = btoa(encodeURIComponent(JSON.stringify({ u: k.scriptUrl, t: k.token })));
  return `${origin}${pathname}#/sinkron?setup=${encodeURIComponent(isi)}`;
}
