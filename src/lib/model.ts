/* ------------------------------------------------------------------ */
/*  Model data — mengikuti struktur tab mingguan di Google Sheet       */
/*  "Laporan Mingguan Tim Dukman" (PSSSDMKP, KKP).                     */
/* ------------------------------------------------------------------ */

export const SPREADSHEET_ID = "1DZsGd20ftE3q9C0em3KxF0jkUTkJYSC2xnZ194AvKRw";
export const TOTAL_PEGAWAI = 56;

export type Tab = { name: string; gid: string };

/** Daftar tab hasil pembacaan file (urut terbaru → terlama). */
export const DEFAULT_TABS: Tab[] = [
  { name: "Nov I", gid: "1192874962" },
  { name: "okt IV", gid: "1338555942" },
  { name: "okt III", gid: "395121796" },
  { name: "Okto II", gid: "257565011" },
  { name: "Okt I", gid: "785175718" },
  { name: "Sept V", gid: "231054254" },
  { name: "Sept IV", gid: "221300810" },
  { name: "Sept III", gid: "1565187238" },
  { name: "Sept II", gid: "1012513293" },
  { name: "Sept I", gid: "912514002" },
  { name: "Agust IV", gid: "285729051" },
  { name: "Agust III", gid: "1425727527" },
  { name: "Agustus II", gid: "1545180441" },
  { name: "Agustus I", gid: "883340127" },
  { name: "Juli V", gid: "1996441976" },
  { name: "Jul IV", gid: "1717403508" },
  { name: "Jul III", gid: "2057559087" },
  { name: "Juli II", gid: "1792098331" },
  { name: "Juli I", gid: "1511438763" },
  { name: "Jun IV", gid: "847396505" },
  { name: "Jun III", gid: "1759343341" },
  { name: "jun II", gid: "655488404" },
  { name: "Jun I", gid: "1086689288" },
  { name: "Mei IV", gid: "99873138" },
  { name: "Mei III", gid: "1417680138" },
  { name: "Mei II", gid: "715027622" },
  { name: "Mei I", gid: "2019933428" },
  { name: "April V", gid: "1190015801" },
  { name: "April IV", gid: "1237999004" },
  { name: "April III", gid: "1707496298" },
  { name: "April  II", gid: "0" },
];

export type TimId = "keuangan" | "umum" | "arsiparis" | "kepegawaian" | "program" | "humas" | "hukum";

export type Tim = { id: TimId; no: string; label: string; subs: string[]; tone: string };

export const TIMS: Tim[] = [
  { id: "keuangan", no: "I", label: "Keuangan", subs: [""], tone: "#f3b23c" },
  { id: "umum", no: "II", label: "Umum", subs: [""], tone: "#4a8bf0" },
  { id: "arsiparis", no: "III", label: "Arsiparis", subs: [""], tone: "#16c08a" },
  { id: "kepegawaian", no: "IV", label: "Kepegawaian", subs: [""], tone: "#e0654a" },
  { id: "program", no: "V", label: "Program dan Monev", subs: ["Program", "Monev"], tone: "#8b7cf6" },
  { id: "humas", no: "VI", label: "Humas Datin", subs: [""], tone: "#0ea5b7" },
  { id: "hukum", no: "VII", label: "Hukum", subs: [""], tone: "#c2410c" },
];

export const timById = (id: string) => TIMS.find((t) => t.id === id);

/** Baris-baris yang diisi (Program dan Monev terpecah dua). */
export const SLOT_ROWS = TIMS.flatMap((t) => t.subs.map((sub) => ({ tim: t, sub })));

export const slotLabel = (timId: string, sub: string) => {
  const t = timById(timId);
  if (!t) return timId;
  return sub ? `${t.label} · ${sub}` : t.label;
};

/* --------------------------------- types --------------------------------- */

export type Presensi = {
  hadir: number | null;
  tanpaKet: number;
  tanpaKetKet: string;
  dl: number;
  dlKet: string;
  cuti: number;
  cutiKet: string;
};

export type Aplikasi = {
  sikepo: number | null;
  epresensi: number | null;
  fp: number | null;
  tidak: number | null;
  cutiDl: number | null;
};

export type Anggaran = { kode: string; uraian: string; pagu: number; realisasi: number };

export type RowMap = {
  A: Record<string, number>;
  L: Record<string, number>;
  B: Record<string, number>;
  C: Record<string, number>;
  P: Record<string, number>;
};

/** Posisi kolom (0-based) yang dideteksi dari baris judul tiap bagian. */
export type Cols = {
  tim: number;
  tgl: number;
  ur: number;
  lamp: number;
  bTim: number;
  bUr: number;
  cTgl: number;
  cHadir: number;
  cTk: number;
  cDl: number;
  cCuti: number;
  pTgl: number;
  pSikepo: number;
  pEp: number;
  pFp: number;
  pTidak: number;
  pCutiDl: number;
  rKode: number;
  rUr: number;
  rPagu: number;
  rReal: number;
};

export const DEFAULT_COLS: Cols = {
  tim: 2, tgl: 3, ur: 4, lamp: 9,
  bTim: 2, bUr: 3,
  cTgl: 2, cHadir: 3, cTk: 4, cDl: 5, cCuti: 6,
  pTgl: 2, pSikepo: 3, pEp: 4, pFp: 5, pTidak: 6, pCutiDl: 7,
  rKode: 1, rUr: 2, rPagu: 3, rReal: 4,
};

export type WeekData = {
  gid: string;
  tab: string;
  cols: Cols;
  judul: string;
  judulKegiatan: string;
  judulRencana: string;
  judulPresensi: string;
  dates: string[];
  kegiatan: Record<string, string[]>;
  lampiran: Record<string, string>;
  rencana: Record<string, string[]>;
  presensi: Record<string, Presensi>;
  aplikasi: Record<string, Aplikasi>;
  anggaran: Anggaran[];
  rows: RowMap;
  dirty: Record<string, true>;
  meta: Record<string, { oleh: string; at: number }>;
  importedAt: number;
  syncedAt?: number;
};

export const emptyPresensi = (): Presensi => ({
  hadir: null,
  tanpaKet: 0,
  tanpaKetKet: "",
  dl: 0,
  dlKet: "",
  cuti: 0,
  cutiKet: "",
});

export const emptyAplikasi = (): Aplikasi => ({ sikepo: null, epresensi: null, fp: null, tidak: null, cutiDl: null });

/* --------------------------------- keys --------------------------------- */

export const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
export const slotKey = (tim: string, sub: string, date: string) => `${tim}|${norm(sub)}|${norm(date)}`;
export const lampKey = (tim: string, sub: string) => `${tim}|${norm(sub)}`;

/* -------------------------------- tanggal -------------------------------- */

const BULAN = [
  "januari",
  "februari",
  "maret",
  "april",
  "mei",
  "juni",
  "juli",
  "agustus",
  "september",
  "oktober",
  "november",
  "desember",
];
const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

export const isTanggal = (s: string) =>
  new RegExp(`^\\d{1,2}\\s+(${BULAN.join("|")})\\s+\\d{4}$`, "i").test(s.replace(/\s+/g, " ").trim());

export const parseTanggal = (s: string): Date | null => {
  const m = s.replace(/\s+/g, " ").trim().match(/^(\d{1,2}) (\w+) (\d{4})$/);
  if (!m) return null;
  const bi = BULAN.indexOf(m[2].toLowerCase());
  if (bi < 0) return null;
  return new Date(Number(m[3]), bi, Number(m[1]));
};

export const hariDari = (s: string) => {
  const d = parseTanggal(s);
  return d ? HARI[d.getDay()] : "";
};

export const tanggalPendek = (s: string) => {
  const d = parseTanggal(s);
  if (!d) return s;
  return `${d.getDate()} ${BULAN[d.getMonth()].slice(0, 3).replace(/^./, (c) => c.toUpperCase())}`;
};

export const cleanDate = (s: string) => {
  const d = parseTanggal(s);
  if (!d) return s.trim();
  const b = BULAN[d.getMonth()];
  return `${d.getDate()} ${b[0].toUpperCase()}${b.slice(1)} ${d.getFullYear()}`;
};

/* ---------------------------- teks & uraian ---------------------------- */

/** Pecah sel uraian sheet ("1. a\n2. b") menjadi daftar butir. */
export function splitUraian(raw: string): string[] {
  const t = raw.replace(/\r/g, "").trim();
  if (!t) return [];
  const numbered = /^\s*\d+[.)]\s+/m.test(t);
  const parts = numbered ? t.split(/\n(?=\s*\d+[.)]\s+)/) : t.split(/\n+/);
  return parts
    .map((p) =>
      p
        .replace(/^\s*\d+[.)]\s+/, "")
        .replace(/\s*\n\s*/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean);
}

/** Gabungkan butir menjadi format sel sheet. */
export const joinUraian = (items: string[]) =>
  items
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s, i) => `${i + 1}. ${s}`)
    .join("\n");

const KAMUS: [RegExp, string][] = [
  [/\bmedsos\b/gi, "media sosial"],
  [/\butk\b/gi, "untuk"],
  [/\bdgn\b/gi, "dengan"],
  [/\byg\b/gi, "yang"],
  [/\btgl\b/gi, "tanggal"],
  [/\bsdh\b/gi, "sudah"],
  [/\bblm\b/gi, "belum"],
  [/\bkrn\b/gi, "karena"],
  [/\bdll\b/gi, "dan lain-lain"],
  [/\bbuat medsos\b/gi, "untuk media sosial"],
  [/\bzoom\b/gi, "Zoom"],
  [/\be-?monev\b/gi, "e-Monev"],
  [/\bpsssdmkp\b/gi, "PSSSDMKP"],
  [/\bkkp\b/gi, "KKP"],
];

const AWALAN: [RegExp, string][] = [
  [/^(bikin|buat)\s+/i, "Membuat "],
  [/^ikut\s+/i, "Mengikuti "],
  [/^input\s+/i, "Menginput "],
  [/^susun\s+/i, "Menyusun "],
  [/^cek\s+/i, "Mengecek "],
  [/^kirim\s+/i, "Mengirim "],
  [/^bantu\s+/i, "Membantu "],
  [/^koordinasi\s+/i, "Melakukan koordinasi "],
];

/** Rapikan satu butir: ejaan singkat, kata kerja baku, kapitalisasi, spasi. */
export function rapikan(s: string): string {
  let t = s.replace(/\s+/g, " ").trim().replace(/[.;,]+$/, "");
  if (!t) return t;
  t = t.replace(/^\s*\d+[.)]\s+/, "");
  KAMUS.forEach(([re, rep]) => (t = t.replace(re, rep)));
  AWALAN.forEach(([re, rep]) => (t = t.replace(re, rep)));
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Pecah teks bebas (bisa multi-baris / bernomor / dipisah titik koma) jadi butir. */
export function teksKeButir(raw: string): string[] {
  const t = raw.trim();
  if (!t) return [];
  if (/\n/.test(t) || /^\s*\d+[.)]\s+/.test(t)) return splitUraian(t);
  return t
    .split(/\s*;\s*/)
    .map((x) => x.trim())
    .filter(Boolean);
}

/* ------------------------------ presensi ------------------------------ */

export function parsePegawai(cell: string): { n: number; ket: string } {
  const t = cell.replace(/\r/g, "").trim();
  if (!t || t === "-") return { n: 0, ket: "" };
  const m = t.match(/(\d+)/);
  const n = m ? Number(m[1]) : 0;
  const idx = t.indexOf(":");
  const ket = idx >= 0 ? t.slice(idx + 1).replace(/^\s+/, "").trim() : "";
  return { n, ket };
}

export function formatPegawai(n: number, ket: string): string {
  if (!n) return "-";
  const k = ket.trim();
  return k ? `${n} Pegawai : \n\n${k}` : `${n} Pegawai`;
}

export const isPresensiTerisi = (p?: Presensi) => !!p && p.hadir !== null;

export const totalPresensi = (p: Presensi) => (p.hadir ?? 0) + p.tanpaKet + p.dl + p.cuti;

/* ------------------------------ angka ------------------------------ */

export const parseAngka = (s: string) => {
  const t = (s || "").replace(/[^\d,.-]/g, "");
  if (!t) return 0;
  return Number(t.replace(/\./g, "").replace(",", ".")) || 0;
};

export const rupiah = (n: number) => `Rp${Math.round(n).toLocaleString("id-ID")}`;
export const rupiahPendek = (n: number) => {
  if (n >= 1e9) return `Rp${(n / 1e9).toFixed(2).replace(".", ",")} M`;
  if (n >= 1e6) return `Rp${(n / 1e6).toFixed(1).replace(".", ",")} jt`;
  return rupiah(n);
};

/* ------------------------------ ringkasan ------------------------------ */

/** Apakah baris tim/sub/tanggal ada di tab (tab lama bisa punya susunan tim berbeda). */
export const slotAda = (w: WeekData, tim: string, sub: string, d: string) => {
  const A = w.rows?.A ?? {};
  return Object.keys(A).length === 0 || !!A[slotKey(tim, sub, d)];
};

export type Ringkasan = {
  slotTotal: number;
  slotTerisi: number;
  butir: number;
  perTim: Record<string, { terisi: number; total: number; butir: number }>;
  rencanaTerisi: number;
  presensiTerisi: number;
  rataHadir: number | null;
};

export function ringkas(w: WeekData): Ringkasan {
  const perTim: Ringkasan["perTim"] = {};
  let slotTotal = 0;
  let slotTerisi = 0;
  let butir = 0;
  SLOT_ROWS.forEach(({ tim, sub }) => {
    perTim[tim.id] ??= { terisi: 0, total: 0, butir: 0 };
    w.dates.forEach((d) => {
      if (!slotAda(w, tim.id, sub, d)) return;
      const items = w.kegiatan[slotKey(tim.id, sub, d)] ?? [];
      slotTotal++;
      perTim[tim.id].total++;
      if (items.length) {
        slotTerisi++;
        perTim[tim.id].terisi++;
      }
      butir += items.length;
      perTim[tim.id].butir += items.length;
    });
  });
  const rencanaTerisi = TIMS.filter((t) => (w.rencana[t.id] ?? []).length > 0).length;
  const pres = w.dates.map((d) => w.presensi[norm(d)]).filter(isPresensiTerisi);
  const rataHadir = pres.length ? pres.reduce((a, p) => a + (p!.hadir ?? 0), 0) / pres.length : null;
  return { slotTotal, slotTerisi, butir, perTim, rencanaTerisi, presensiTerisi: pres.length, rataHadir };
}
