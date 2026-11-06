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

export type Anggaran = {
  kode: string;
  uraian: string;
  pagu: number;
  realisasi: number;
  /** nomor baris di sheet (bagian D) — diisi saat membaca tab */
  baris?: number;
};

/** Kunci stabil satu baris realisasi keuangan (kode kegiatan). */
export const angKey = (a: Anggaran) => a.kode;

/** Persentase serapan anggaran (0 bila pagu belum diisi). */
export const serapan = (realisasi: number, pagu: number) => (pagu > 0 ? (realisasi / pagu) * 100 : 0);

export const totalAnggaran = (arr: Anggaran[]) =>
  arr.reduce((t, a) => ({ pagu: t.pagu + a.pagu, realisasi: t.realisasi + a.realisasi }), { pagu: 0, realisasi: 0 });

/** Satu baris pada tabel keuangan bebas (Rekapitulasi UP, Pembayaran LS, Rencana Penarikan, …). */
export type BarisKeuangan = {
  /** nomor baris di sheet (1-based) */
  nomor: number;
  /** teks penanda baris (kolom label) — dipakai aplikasi untuk memastikan baris tidak bergeser */
  label: string;
  /** indeks kolom (0-based) tempat teks penanda berada */
  labelKolom: number;
  /** nilai sel per indeks kolom, hanya sel yang berisi */
  sel: Record<number, string>;
};

/** Tabel keuangan apa pun di bagian D — dibaca apa adanya dari sheet. */
export type TabelKeuangan = {
  judul: string;
  /** nomor baris judul kolom (1-based) */
  header: number;
  kolom: { index: number; label: string }[];
  baris: BarisKeuangan[];
};

/** Kunci satu sel tabel keuangan: "baris:kolom". */
export const selKey = (baris: number, kolom: number) => `${baris}:${kolom}`;

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
  /** judul tabel sumber pagu/realisasi (mis. "Realisasi Anggaran") */
  anggaranJudul?: string;
  /** rentang baris tabel itu di sheet (1-based) — dipakai untuk menampilkan asal datanya */
  anggaranBaris?: { dari: number; sampai: number };
  /** tabel keuangan lain di bagian D (dibaca generik: judul, kolom, baris) */
  tabelKeuangan: TabelKeuangan[];
  /** isian sel tabel keuangan yang belum terkirim: "baris:kolom" → teks */
  selKeuangan: Record<string, string>;
  rows: RowMap;
  dirty: Record<string, true>;
  meta: Record<string, { oleh: string; at: number; ganti?: boolean }>;
  importedAt: number;
  syncedAt?: number;
  /** baris bagian A yang tidak bisa dipetakan ke tim/tanggal (nama tim tak dikenal / tanggal kosong) */
  takTerbaca?: { baris: number; teks: string }[];
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

/** Tanggal dalam penulisan apa pun yang didukung parseTanggal (2 November 2026, 2 Nov 2026, 02/11/2026). */
export const isTanggal = (s: string) => !!parseTanggal(s);

/** Indeks bulan dari nama penuh atau singkatannya ("November", "Nov", "Nop"). */
const bulanDari = (t: string): number => {
  const s = t.toLowerCase().replace(/[^a-z]/g, "");
  if (s.length < 3) return -1;
  const penuh = BULAN.indexOf(s);
  if (penuh >= 0) return penuh;
  const alias: Record<string, number> = { nop: 10, peb: 1, des: 11 };
  if (s in alias) return alias[s];
  // "sept" → september, "agu" → agustus
  return BULAN.findIndex((b) => b.startsWith(s) || s.startsWith(b.slice(0, 4)));
};

/**
 * Baca tanggal dari beberapa penulisan yang lazim dipakai orang saat mengisi sheet:
 *   "2 November 2026", "2 Nov 2026", "02/11/2026", "2-11-2026", "2026-11-02"
 */
export const parseTanggal = (s: string): Date | null => {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  if (!t) return null;
  let m = t.match(/^(\d{1,2})\s+([A-Za-z]+)\.?\s+(\d{4})$/);
  if (m) {
    const bi = bulanDari(m[2]);
    if (bi < 0) return null;
    return new Date(Number(m[3]), bi, Number(m[1]));
  }
  m = t.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (m) {
    const d = Number(m[1]), mo = Number(m[2]), y = Number(m[3]);
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    return new Date(y, mo - 1, d);
  }
  m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) {
    const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    return new Date(y, mo - 1, d);
  }
  return null;
};

/** Dua penulisan tanggal menunjuk hari yang sama (2 November 2026 ≈ 02/11/2026 ≈ 2 Nov 2026). */
export function tanggalSama(a: string, b: string): boolean {
  const da = parseTanggal(a);
  const db = parseTanggal(b);
  if (da && db) return da.toDateString() === db.toDateString();
  return norm(a) === norm(b);
}

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

/**
 * Tanggal yang terselip di dalam teks bebas — dipakai saat sel tanggal tidak berisi tanggal saja:
 *   "Senin, 2 November 2026" → "2 November 2026"
 *   "2 s.d. 6 November 2026"  → "2 November 2026" (tanggal pertama)
 *   "02-Nov-2026" / "2 - 11 - 2026" → "2 November 2026"
 */
export const tanggalDariTeks = (s: string): string => {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  if (parseTanggal(t)) return cleanDate(t);
  // "02-Nov-2026", "2 / Nov / 2026" → "2 Nov 2026"
  const pisah = t
    .replace(/(\d)\s*[-–/.·]\s*([A-Za-z])/g, "$1 $2")
    .replace(/([A-Za-z])\s*[-–/.·]\s*(\d)/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
  if (pisah !== t && parseTanggal(pisah)) return cleanDate(pisah);
  const iso = t.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso && parseTanggal(`${iso[1]}-${iso[2]}-${iso[3]}`)) return cleanDate(`${iso[1]}-${iso[2]}-${iso[3]}`);
  const angka = t.match(/(\d{1,2})\s*[/\-.]\s*(\d{1,2})\s*[/\-.]\s*(\d{4})/);
  if (angka && parseTanggal(`${angka[1]}/${angka[2]}/${angka[3]}`)) return cleanDate(`${angka[1]}/${angka[2]}/${angka[3]}`);
  const nama = t.match(/(\d{1,2})\s*(?:s\.?\s*d\.?|sampai|hingga|[-–—])?\s*\d{0,2}\s+([A-Za-z]{3,})\.?,?\s+(\d{4})/);
  if (nama) {
    const gabung = `${nama[1]} ${nama[2]} ${nama[3]}`;
    if (parseTanggal(gabung)) return cleanDate(gabung);
  }
  return "";
};

/* ------------------------- minggu berikutnya ------------------------- */

/** Singkatan bulan seperti dipakai pada nama tab sheet ("Nov I", "Agust III"). */
export const BULAN_SINGKAT = ["Jan", "Feb", "Mar", "April", "Mei", "Jun", "Jul", "Agust", "Sept", "Okt", "Nov", "Des"];
export const ROMAWI = ["I", "II", "III", "IV", "V", "VI"];

/** Pekan ke berapa dalam bulan (1–5) menurut tanggalnya. */
export const pekanKe = (d: Date) => Math.min(5, Math.floor((d.getDate() - 1) / 7) + 1);

/** Label tab dari sebuah tanggal: 3 Nov 2025 → "Nov I", 10 Nov 2025 → "Nov II". */
export const labelMinggu = (d: Date) => `${BULAN_SINGKAT[d.getMonth()]} ${ROMAWI[pekanKe(d) - 1]}`;

/** Tanggal terakhir (paling baru) dari daftar tanggal sebuah tab. */
export function tanggalTerakhir(dates: string[]): Date | null {
  let max: Date | null = null;
  dates.forEach((s) => {
    const d = parseTanggal(s);
    if (d && (!max || d > max)) max = d;
  });
  return max;
}

/** Rentang tanggal tab setelah digeser (untuk pratinjau "10 – 14 Nov 2025"). */
export function rentangSetelahGeser(dates: string[], geserHari: number): { dari: string; sampai: string } | null {
  const all = dates
    .map((s) => parseTanggal(s))
    .filter((d): d is Date => !!d)
    .map((d) => {
      const n = new Date(d);
      n.setDate(n.getDate() + geserHari);
      return n;
    })
    .sort((a, b) => a.getTime() - b.getTime());
  if (!all.length) return null;
  const teks = (d: Date) => `${tanggalPendek(`${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`)} ${d.getFullYear()}`;
  return { dari: teks(all[0]), sampai: teks(all[all.length - 1]) };
}

/**
 * Saran nama tab minggu berikutnya berdasarkan tanggal tab sumber.
 * "3–7 Nov 2025" → "Nov II". Bila tanggal tak terbaca, angka romawi di nama dinaikkan.
 */
export function saranNamaMinggu(w: { tab: string; dates: string[] }, geserHari = 7): string {
  const akhir = tanggalTerakhir(w.dates);
  if (akhir) {
    const n = new Date(akhir);
    n.setDate(n.getDate() + geserHari);
    return labelMinggu(n);
  }
  const m = w.tab.trim().match(/^(.*?)(I{1,3}|IV|V)$/);
  if (m) {
    const i = ROMAWI.indexOf(m[2]);
    if (i >= 0 && i < ROMAWI.length - 1) return `${m[1]}${ROMAWI[i + 1]}`.trim();
  }
  return w.tab.trim();
}

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

/* --------------------------- tautan lampiran --------------------------- */

/**
 * Ambil semua tautan dari sel lampiran — bisa satu tautan, beberapa baris,
 * bernomor ("1. …", "2. …"), atau berderet dipisah spasi/koma.
 */
export function splitLinks(raw: string): string[] {
  const t = (raw ?? "").replace(/\r/g, "");
  const out: string[] = [];
  // alamat tanpa "https://" pun diterima (mis. "www.drive.google.com/…") lalu dirapikan
  const re = /(?:https?:\/\/|www\.)[^\s<>"']+/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    let u = m[0].replace(/^www\./i, "https://www.").replace(/[.,;:]+$/, "");
    // buang tanda kurung penutup yang tidak berpasangan
    while (u.endsWith(")") && (u.match(/\(/g)?.length ?? 0) < (u.match(/\)/g)?.length ?? 0)) u = u.slice(0, -1);
    if (!out.some((x) => x.toLowerCase() === u.toLowerCase())) out.push(u);
  }
  return out;
}

/** Susun sel lampiran: satu tautan apa adanya, lebih dari satu diberi nomor urut 1, 2, 3… */
export function joinLinks(urls: string[]): string {
  const list = urls.map((u) => u.trim()).filter(Boolean);
  if (list.length <= 1) return list[0] ?? "";
  return list.map((u, i) => `${i + 1}. ${u}`).join("\n");
}

/** Rapikan isi lampiran; teks yang bukan tautan dibiarkan apa adanya. */
export const normalisasiLinks = (raw: string) => {
  const urls = splitLinks(raw);
  return urls.length ? joinLinks(urls) : (raw ?? "").trim();
};

/* ---------------- lampiran bertanggal (satu sel per tim/minggu) ---------------- */

/**
 * Satu baris isi sel lampiran. Bentuk yang didukung:
 *   "2 November 2026: https://…"   ← tautan untuk tanggal tertentu
 *   "https://…"                    ← tautan tanpa tanggal (data lama)
 */
export type LampiranEntri = { tanggal: string; url: string };

/** Baca sel lampiran menjadi daftar entri bertanggal. */
export function parseLampiran(raw: string): LampiranEntri[] {
  const teks = (raw ?? "").replace(/\r/g, "");
  const out: LampiranEntri[] = [];
  teks.split("\n").forEach((baris) => {
    const t = baris.trim();
    if (!t) return;
    const { tanggal, isi } = pisahTanggal(t);
    splitLinks(isi).forEach((url) => {
      if (out.some((e) => e.url.toLowerCase() === url.toLowerCase())) return;
      out.push({ tanggal, url });
    });
  });
  return out;
}

/**
 * Pisahkan awalan tanggal pada satu baris sel lampiran.
 * Menerima "2 November 2026: https://…" maupun "2/11/2026 https://…" (tanpa titik dua).
 */
function pisahTanggal(t: string): { tanggal: string; isi: string } {
  const pola =
    /^(\d{1,2}\s+[A-Za-z]+\.?\s+\d{4}|\d{1,2}[/\-.]\d{1,2}[/\-.]\d{4}|\d{4}-\d{1,2}-\d{1,2})\s*(?:[:\u2013\u2014-]\s*)?(.*)$/;
  const m = t.match(pola);
  if (!m) return { tanggal: "", isi: t };
  const sisa = m[2] ?? "";
  // hanya dianggap awalan tanggal bila sisanya tautan (atau kosong) — bukan kalimat biasa
  if (sisa.trim() && !splitLinks(sisa).length) return { tanggal: "", isi: t };
  return { tanggal: cleanDate(m[1]), isi: sisa };
}

/** Susun entri menjadi isi sel: satu baris per tautan, diawali tanggalnya. */
export function susunLampiran(entri: LampiranEntri[]): string {
  // satu tautan sekali saja; bila tautan yang sama punya tanggal, versi bertanggal yang dipakai
  const peta = new Map<string, LampiranEntri>();
  entri.forEach((e) => {
    const url = (e.url ?? "").trim();
    if (!url) return;
    const kunci = url.toLowerCase();
    const tanggal = e.tanggal ? cleanDate(e.tanggal) : "";
    const ada = peta.get(kunci);
    if (!ada || (!ada.tanggal && tanggal)) peta.set(kunci, { tanggal, url });
  });
  return [...peta.values()].map((e) => (e.tanggal ? `${e.tanggal}: ${e.url}` : e.url)).join("\n");
}

/** Rapikan isi sel lampiran (tanggal & tautan); teks tanpa tautan dibiarkan apa adanya. */
export const normalisasiLampiran = (raw: string) => {
  const entri = parseLampiran(raw);
  return entri.length ? susunLampiran(entri) : (raw ?? "").trim();
};

/** Tautan yang tercatat untuk satu tanggal (format penulisan tanggal apa pun). */
export const lampiranTanggal = (raw: string, tanggal: string) =>
  parseLampiran(raw)
    .filter((e) => e.tanggal && tanggalSama(e.tanggal, tanggal))
    .map((e) => e.url);

/** Tautan yang ditulis di sheet tanpa tanggal — tetap ditampilkan supaya tidak "hilang". */
export const lampiranTanpaTanggal = (raw: string) =>
  parseLampiran(raw)
    .filter((e) => !e.tanggal)
    .map((e) => e.url);

/** Ganti tautan satu tanggal saja — entri tanggal lain tidak disentuh. */
/** Kelompokkan tautan per tanggal (kunci = tanggal huruf kecil; "" = tautan tanpa tanggal). */
export function lampiranPerTanggal(raw: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  parseLampiran(raw).forEach((e) => {
    const k = e.tanggal ? norm(e.tanggal) : "";
    (out[k] ??= []).push(e.url);
  });
  return out;
}

export function gantiLampiranTanggal(raw: string, tanggal: string, urls: string[]): string {
  const tgl = cleanDate(tanggal);
  const lain = parseLampiran(raw).filter((e) => !e.tanggal || !tanggalSama(e.tanggal, tgl));
  const baru: LampiranEntri[] = urls.map((u) => ({ tanggal: tgl, url: u.trim() })).filter((e) => e.url);
  return susunLampiran([...lain, ...baru]);
}

/** Tambah tautan untuk satu tanggal tanpa menghapus yang sudah ada. */
export function tambahLampiranTanggal(raw: string, tanggal: string, urls: string[]): string {
  const ada = lampiranTanggal(raw, tanggal);
  return gantiLampiranTanggal(raw, tanggal, [...ada, ...urls]);
}

/** Dua isi lampiran sama bila tanggal & tautannya sama (urutan diperhatikan). */
export const samaLampiran = (a: string, b: string) => {
  const x = parseLampiran(a);
  const y = parseLampiran(b);
  if (!x.length && !y.length) return (a ?? "").trim() === (b ?? "").trim();
  if (x.length !== y.length) return false;
  return x.every((e, i) => norm(e.tanggal) === norm(y[i].tanggal) && e.url.toLowerCase() === y[i].url.toLowerCase());
};

/** Huruf kolom dari indeks 0-based: 0 → A, 9 → J, 10 → K. */
export function hurufKolom(n: number): string {
  let s = "";
  let x = n + 1;
  while (x > 0) {
    const m = (x - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s;
}

/** Isi lampiran dianggap sama walau berbeda nomor/format penulisan. */
export const samaLinks = (a: string, b: string) => {
  const x = splitLinks(a);
  const y = splitLinks(b);
  if (!x.length && !y.length) return (a ?? "").trim() === (b ?? "").trim();
  return x.length === y.length && x.every((u, i) => u === y[i]);
};

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
/**
 * Apakah baris tim/sub ini ada di tab? "n/a" hanya untuk tim yang sama sekali tidak ada di tab —
 * kalau timnya ada tetapi tanggal itu belum punya baris, kotaknya tetap bisa diisi.
 */
export const slotAda = (w: WeekData, tim: string, sub: string, d: string) => {
  const A = w.rows?.A ?? {};
  const keys = Object.keys(A);
  if (!keys.length) return true;
  if (A[slotKey(tim, sub, d)]) return true;
  const timAda = keys.some((k) => k.startsWith(`${tim}|`));
  if (!timAda) return false;
  const subAda = keys.some((k) => k.startsWith(`${tim}|${norm(sub)}|`));
  return subAda;
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
