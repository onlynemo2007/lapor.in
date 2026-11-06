import {
  type Anggaran,
  type Aplikasi,
  type BarisKeuangan,
  type TabelKeuangan,
  type Cols,
  DEFAULT_COLS,
  type Presensi,
  type WeekData,
  SPREADSHEET_ID,
  SLOT_ROWS,
  TIMS,
  cleanDate,
  emptyAplikasi,
  formatPegawai,
  isTanggal,
  joinUraian,
  lampKey,
  norm,
  parseLampiran,
  parseAngka,
  parsePegawai,
  slotKey,
  splitUraian,
  susunLampiran,
} from "./model";

/* ------------------------------- CSV ------------------------------- */

export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let f = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          f += '"';
          i++;
        } else q = false;
      } else f += c;
    } else if (c === '"') q = true;
    else if (c === ",") {
      row.push(f);
      f = "";
    } else if (c === "\n") {
      row.push(f);
      rows.push(row);
      row = [];
      f = "";
    } else if (c !== "\r") f += c;
  }
  if (f || row.length) {
    row.push(f);
    rows.push(row);
  }
  return rows;
}

const timIdDari = (name: string) => {
  const w = norm(name).split(" ")[0];
  return TIMS.find((t) => t.id === w)?.id ?? null;
};

/* ---------------------------- parse tab ---------------------------- */

const has = (r: string[], pred: (x: string) => boolean) => r.findIndex((x) => pred(norm(x)));
const isLink = (s: string) => /(https?:\/\/|www\.)/i.test(s);
/** Tautan tanpa "https://" (mis. "www.drive.google.com/…") dirapikan agar bisa diklik. */
const rapiTautan = (s: string) => s.trim().replace(/^www\./i, "https://www.");

/** Kata kunci yang hanya muncul di tabel keuangan (bagian D), bukan di tabel kegiatan/presensi. */
const KATA_KEUANGAN = /\b(pagu|realisasi|sisa|jumlah|nilai|penarikan|anggaran|pembayaran|up|ls|triwulan|akun)\b/i;
const angkaSel = (t: string) => /^-?[\d.,\s]+$/.test(t) && /\d/.test(t);

/**
 * Baca semua tabel keuangan di tab (Rekapitulasi UP, Pembayaran Melalui LS, Realisasi Anggaran,
 * Rencana Penarikan, …). Judul diambil dari baris teks di atas baris judul kolom; kolom & baris
 * dibaca apa adanya, tanpa mengandaikan susunan tertentu.
 */
export function parseTabelKeuangan(rows: string[][], kecuali?: Set<number>): TabelKeuangan[] {
  const out: TabelKeuangan[] = [];
  const isi = (r: string[]) => (r ?? []).map((x) => (x ?? "").trim());
  const nonKosong = (r: string[]) => isi(r).map((t, j) => (t ? j : -1)).filter((j) => j >= 0);

  const labelKolom = (t: string) => t.length <= 24 && t.split(/\s+/).length <= 4;
  const headerDari = (r: string[]): number[] | null => {
    const sel = isi(r);
    const idx = nonKosong(sel);
    if (idx.length < 2) return null;
    const judul = idx.map((j) => sel[j]);
    if (judul.every((t) => angkaSel(t))) return null;
    // baris data hampir selalu memuat angka atau kalimat panjang — jangan dianggap judul kolom
    if (idx.some((j) => angkaSel(sel[j]))) return null;
    // judul kolom itu pendek ("Pagu", "Pembayaran Melalui LS"); baris data bisa panjang
    // ("PEMBAYARAN PUMK DUKMAN MELALUI TUNAI") dan tidak boleh memecah tabel
    if (judul.some((t) => !labelKolom(t))) return null;
    const adaKeuangan = judul.filter((t) => KATA_KEUANGAN.test(t)).length > 0;
    const adaUraian = judul.some((t) => /uraian|kegiatan|keterangan/i.test(t));
    if (!adaKeuangan) return null;
    if (!adaUraian && judul.length < 3) return null;
    return idx;
  };

  const judulDari = (r: string[]): string => {
    const sel = isi(r).filter(Boolean);
    // buang penanda bagian satu huruf ("D")
    const teks = sel.filter((t) => !/^[A-F]$/.test(t));
    return (teks[0] ?? sel[0] ?? "").replace(/\s+/g, " ");
  };

  const tampakJudul = (r: string[]) => {
    const idx = nonKosong(r);
    if (!idx.length || idx.length > 3) return false;
    const sel = isi(r);
    const teks = idx.map((j) => sel[j]);
    return teks.every((t) => !angkaSel(t)) && !headerDari(r);
  };

  for (let i = 0; i < rows.length; i++) {
    const kolomIdx = headerDari(rows[i]);
    if (!kolomIdx) continue;
    const header = i + 1;
    // judul: baris teks terdekat di atasnya
    let judul = "";
    for (let b = i - 1; b >= 0 && b >= i - 3; b--) {
      if (tampakJudul(rows[b])) {
        judul = judulDari(rows[b]);
        if (judul) break;
      }
    }
    if (kecuali?.has(i + 1)) continue;
    const sel = isi(rows[i]);
    const kolom = kolomIdx.map((j) => ({ index: j, label: sel[j] || `Kolom ${j + 1}` }));

    const baris: BarisKeuangan[] = [];
    for (let j = i + 1; j < rows.length; j++) {
      const isiBaris = isi(rows[j]);
      if (!nonKosong(isiBaris).length) break;
      if (headerDari(rows[j])) break;
      const idxTerisi = nonKosong(isiBaris).filter((k) => kolomIdx.includes(k));
      // baris "Jumlah"/"Total" penutup tabel tetap dibaca walau barisnya hanya berisi satu sel
      const total = idxTerisi.length > 0 && /^(jumlah|total|sub ?total|grand ?total)\b/i.test(isiBaris[idxTerisi[0]] ?? "");
      if (!total && tampakJudul(rows[j]) && (!nonKosong(rows[j + 1] ?? []).length || headerDari(rows[j + 1] ?? []))) break;
      if (!idxTerisi.length) {
        if (tampakJudul(rows[j])) break;
        continue;
      }
      const labelKolom = idxTerisi[0];
      const selBaris: Record<number, string> = {};
      idxTerisi.forEach((k) => (selBaris[k] = isiBaris[k]));
      baris.push({ nomor: j + 1, label: isiBaris[labelKolom] ?? "", labelKolom, sel: selBaris });
      if (baris.length >= 80) break;
    }
    if (baris.length) out.push({ judul: judul || `Tabel keuangan ${out.length + 1}`, header, kolom, baris });
  }
  return out;
}

/** Judul bagian yang lazim dipakai sheet (dipakai agar baris data tidak dianggap judul bagian). */
const JUDUL_BAGIAN: Record<string, RegExp> = {
  A: /kegiatan/i,
  B: /rencana/i,
  C: /kehadiran|presensi|rekap/i,
  D: /realisasi|keuangan|anggaran/i,
};

/**
 * Kenali baris judul bagian ("A. KEGIATAN TIM", "D. REALISASI KEUANGAN", …).
 * Sengaja ketat: sel penanda harus berdiri sendiri di awal baris dan judulnya mengandung kata
 * yang sesuai — supaya baris data seperti "A | Sisa Di Rekening" tidak dianggap judul bagian.
 */
function penandaBagian(
  r: string[],
  sudah: Set<string>,
  hurufTerakhir: number,
): { huruf: string; judul: string } | null {
  for (let j = 0; j < 4; j++) {
    const sel = (r[j] ?? "").trim();
    if (!/^[A-Da-d]\.?$/.test(sel)) continue;
    const huruf = sel[0].toUpperCase();
    if (j > 0 && r.slice(0, j).some((x) => (x ?? "").trim())) continue;
    // tiap bagian hanya dikenali sekali dan urutannya menurun (A → B → C → D):
    // baris data seperti "A | Sisa Di Rekening" di tengah tabel tidak boleh membajak judul bagian
    if (sudah.has(huruf)) continue;
    if ("ABCD".indexOf(huruf) < hurufTerakhir) continue;
    const judul = (r[j + 1] ?? "").trim();
    if (!judul || judul.length > 60) continue;
    const kapital = judul === judul.toUpperCase() && /[A-Z]/.test(judul);
    const kunci = JUDUL_BAGIAN[huruf].test(judul);
    const barisJudul = !r.slice(j + 2).some((x) => (x ?? "").trim());
    if (!kunci && !kapital && !barisJudul) continue;
    return { huruf, judul: judul.replace(/\s+/g, " ") };
  }
  return null;
}

/** Baris judul (1–3 sel teks) tepat di atas judul kolom — dipakai menamai tabel keuangan. */
function judulDiAtas(rows: string[][], i: number): string {
  for (let b = i - 1; b >= 0 && b >= i - 3; b--) {
    const sel = (rows[b] ?? []).map((x) => (x ?? "").trim());
    const idx = sel.map((t, j) => (t ? j : -1)).filter((j) => j >= 0);
    if (!idx.length || idx.length > 3) continue;
    if (idx.some((j) => angkaSel(sel[j]))) continue;
    const teks = idx.map((j) => sel[j]).filter((t) => !/^[A-F]$/.test(t));
    if (!teks.length) continue;
    return teks[0].replace(/\s+/g, " ");
  }
  return "";
}

export function parseWeek(csv: string, gid: string, tab: string): WeekData {
  const rows = parseCSV(csv).map((r) => r.map((x) => x ?? ""));
  const c: Cols = { ...DEFAULT_COLS };
  const w: WeekData = {
    gid,
    tab,
    cols: c,
    judul: tab,
    judulKegiatan: "",
    judulRencana: "",
    judulPresensi: "",
    dates: [],
    kegiatan: {},
    lampiran: {},
    rencana: {},
    presensi: {},
    aplikasi: {},
    anggaran: [],
    anggaranJudul: "",
    tabelKeuangan: [],
    selKeuangan: {},
    rows: { A: {}, L: {}, B: {}, C: {}, P: {} },
    dirty: {},
    meta: {},
    importedAt: Date.now(),
  };

  let sec = "";
  const bagianSudah = new Set<string>();
  let hurufBagian = -1;
  let tim: string | null = null;
  let sub = "";
  let lampFound = false;
  let lampHeader = false;
  // bagian D/R: baris realisasi hanya dibaca setelah judul kolomnya benar-benar dikenali.
  // Bisa ada beberapa tabel ber-kolom Kode+Pagu (mis. "Realisasi Anggaran" dan "Sisa Di Rekening"),
  // jadi tiap tabel dikumpulkan dulu lalu dipilih yang benar sebagai sumber pagu/realisasi.
  type KodeTabel = { judul: string; header: number; baris: Anggaran[] };
  const kodeTabel: KodeTabel[] = [];
  let keuHeader: KodeTabel | null = null;
  const firstRow: Record<string, number> = {};
  // tanggal terakhir yang terbaca di bagian A — dipakai bila sel tanggal dikosongkan (merge)
  let tglTerakhir = "";
  const lampRaw: Record<string, string[]> = {};
  const cList: { tgl: string; row: number; r: string[] }[] = [];
  const pList: { tgl: string; row: number; r: string[] }[] = [];

  rows.forEach((r, i) => {
    const sheetRow = i + 1;
    const cell = (j: number) => (r[j] ?? "").trim();

    if (r.some((x) => /^LAPORAN MINGGU/i.test(x.trim()))) w.judul = r.find((x) => /^LAPORAN MINGGU/i.test(x.trim()))!.trim().replace(/\s+/g, " ");

    // penanda bagian: "A" | "B" | "C" | "D" diikuti judul bagian
    const bagian = penandaBagian(r, bagianSudah, hurufBagian);
    if (bagian) {
      bagianSudah.add(bagian.huruf);
      hurufBagian = "ABCD".indexOf(bagian.huruf);
      sec = bagian.huruf;
      if (sec === "A") w.judulKegiatan = bagian.judul;
      if (sec === "B") w.judulRencana = bagian.judul;
      if (sec === "C") w.judulPresensi = bagian.judul;
      tim = null;
      sub = "";
      return;
    }
    if (r.some((x) => /^Rekapitulasi Penggunaan Aplikasi Presensi/i.test(x.trim()))) return void (sec = "P");
    if (r.some((x) => /\brealisasi (anggaran|keuangan)/i.test(x))) return void (sec = "R");

    /* ---- baris judul kolom ---- */
    if (sec === "A") {
      const t = has(r, (x) => x === "tim"), g = has(r, (x) => x.startsWith("tanggal")), u = has(r, (x) => x.startsWith("uraian"));
      if (t >= 0 && g >= 0 && u >= 0) {
        Object.assign(c, { tim: t, tgl: g, ur: u });
        // kolom lampiran: pakai judul kolomnya bila ada (tab baru belum punya tautan sama sekali)
        const l = has(r, (x) => /^(link|tautan|lampiran|bukti)/.test(x));
        if (l > u) {
          c.lamp = l;
          lampHeader = true;
        } else if (!lampFound) c.lamp = u + 5;
        return;
      }
    }
    if (sec === "B") {
      const t = has(r, (x) => x === "tim"), u = has(r, (x) => x.startsWith("uraian"));
      if (t >= 0 && u >= 0) return void Object.assign(c, { bTim: t, bUr: u });
    }
    if (sec === "C") {
      const g = has(r, (x) => x === "tanggal"), h = has(r, (x) => x.startsWith("kehadiran"));
      if (g >= 0 && h >= 0) {
        Object.assign(c, { cTgl: g, cHadir: h });
        const tk = has(r, (x) => x.startsWith("tidak masuk")), dl = has(r, (x) => x.startsWith("dinas luar")), ct = has(r, (x) => x === "cuti");
        if (tk >= 0) c.cTk = tk;
        if (dl >= 0) c.cDl = dl;
        if (ct >= 0) c.cCuti = ct;
        return;
      }
    }
    if (sec === "P") {
      const g = has(r, (x) => x === "tanggal");
      if (g >= 0) {
        c.pTgl = g;
        const td = has(r, (x) => x.startsWith("tidak presensi")), cd = has(r, (x) => x.startsWith("cuti"));
        if (td >= 0) c.pTidak = td;
        if (cd >= 0) c.pCutiDl = cd;
        return;
      }
      const s = has(r, (x) => x === "sikepo");
      if (s >= 0) {
        c.pSikepo = s;
        const e = has(r, (x) => x.replace(/[-\s]/g, "") === "epresensi"), f = has(r, (x) => x.startsWith("finger"));
        if (e >= 0) c.pEp = e;
        if (f >= 0) c.pFp = f;
        return;
      }
    }
    if (sec === "R" || sec === "D") {
      const k = has(r, (x) => x.startsWith("kode")), p = has(r, (x) => x.startsWith("pagu"));
      const u = has(r, (x) => x.startsWith("uraian")), re = has(r, (x) => x.startsWith("realisasi"));
      if (k >= 0 && p >= 0) {
        Object.assign(c, { rKode: k, rPagu: p, rUr: u >= 0 ? u : k + 1, rReal: re >= 0 ? re : p + 1 });
        const tabel: KodeTabel = { judul: judulDiAtas(rows, i), header: sheetRow, baris: [] };
        kodeTabel.push(tabel);
        keuHeader = tabel;
        return;
      }
      // tabel keuangan lain (Rekapitulasi UP, LS, Rencana Penarikan, …) punya judul kolom sendiri
      if (u >= 0 && p >= 0) {
        keuHeader = null;
        return;
      }
      const terisi = r.filter((x) => (x ?? "").trim()).length;
      if (terisi <= 1) {
        keuHeader = null;
        return;
      }
    }

    /* ---- baris data ---- */
    if (sec === "A") {
      const T = cell(c.tim), G = cell(c.tgl), U = cell(c.ur);
      if (T && norm(T) !== "tim") {
        const id = timIdDari(T);
        if (id) {
          tim = id;
          sub = "";
        }
      }
      if (!tim) return;

      // baris judul sub-tim ("Program" / "Monev") — boleh di kolom tanggal atau kolom uraian
      const subDari = (x: string) => {
        const t = x.trim().toLowerCase();
        return t === "program" ? "Program" : t === "monev" ? "Monev" : "";
      };
      const subKolom = subDari(G) || (!isTanggal(G) && !G.trim() ? subDari(U) : "");
      if (subKolom) {
        sub = subKolom;
        return;
      }
      // sub pertama untuk tim Program/Monev bila sheet tidak menulis judul sub-nya
      if (tim === "program" && !sub) sub = "Program";

      // tautan lampiran: kolom setelah uraian yang berisi URL
      for (let j = c.ur + 1; j < r.length; j++) {
        if (isLink(r[j])) {
          if (!lampHeader && !lampFound) {
            c.lamp = j;
            lampFound = true;
          }
          const lk = lampKey(tim, sub);
          (lampRaw[lk] ??= []).push(rapiTautan(r[j]));
          break;
        }
      }

      // Tanggal boleh kosong bila selnya digabung (merge) — pakai tanggal terakhir di atasnya,
      // asalkan baris ini memang berisi uraian kegiatan.
      const tgl = isTanggal(G) ? cleanDate(G) : !G.trim() && U.trim() ? tglTerakhir : "";
      if (!tgl) return;
      tglTerakhir = tgl;
      if (!w.dates.some((x) => norm(x) === norm(tgl))) w.dates.push(tgl);
      const k = slotKey(tim, sub, tgl);
      w.rows.A[k] = sheetRow;
      const items = splitUraian(U);
      if (items.length) w.kegiatan[k] = items;
      const lk = lampKey(tim, sub);
      if (!(lk in firstRow)) firstRow[lk] = sheetRow;
    } else if (sec === "B") {
      const T = cell(c.bTim);
      if (T && norm(T) !== "tim") {
        const id = timIdDari(T);
        if (id) {
          w.rows.B[id] = sheetRow;
          const items = splitUraian(r[c.bUr] ?? "");
          if (items.length) w.rencana[id] = items;
        }
      }
    } else if (sec === "C") {
      if (isTanggal(cell(c.cTgl))) cList.push({ tgl: cell(c.cTgl), row: sheetRow, r });
    } else if (sec === "P") {
      if (isTanggal(cell(c.pTgl))) pList.push({ tgl: cell(c.pTgl), row: sheetRow, r });
    } else if ((sec === "R" || sec === "D") && keuHeader) {
      const kode = cell(c.rKode), ur = cell(c.rUr);
      if (kode && ur && norm(kode) !== "kode" && cell(c.rPagu)) {
        const a: Anggaran = {
          kode,
          uraian: ur,
          pagu: parseAngka(cell(c.rPagu)),
          realisasi: parseAngka(cell(c.rReal)),
          baris: sheetRow,
        };
        if (a.pagu > 0) keuHeader.baris.push(a);
      }
    }
  });

  // sumber pagu/realisasi: tabel berjudul "Realisasi Anggaran" (kalau ada), selain itu tabel kode pertama
  const utama =
    kodeTabel.find((t) => /realisasi\s*anggaran/i.test(t.judul)) ??
    kodeTabel.find((t) => /realisasi|anggaran/i.test(t.judul)) ??
    kodeTabel[0] ??
    null;
  w.anggaran = utama ? utama.baris : [];
  w.anggaranJudul = utama?.judul ?? "";
  const awal = utama?.baris[0]?.baris;
  const akhir = utama?.baris[utama.baris.length - 1]?.baris;
  w.anggaranBaris = awal && akhir ? { dari: awal, sampai: akhir } : undefined;

  // tabel ber-kode lain tetap ditampilkan apa adanya (bisa diisi selnya), tabel utama tidak diduplikasi
  w.tabelKeuangan = parseTabelKeuangan(rows, new Set(utama ? [utama.header] : []));

  // baris lampiran = baris tanggal pertama tiap tim/sub (Program/Monev: baris pertama sub)
  Object.entries(firstRow).forEach(([lk, row]) => {
    w.rows.L[lk] = row;
    if (lampRaw[lk]?.length) w.lampiran[lk] = lampRaw[lk].join("\n");
  });

  // presensi & aplikasi: cocokkan tanggal; bila tanggal di sheet salah ketik, pakai urutan baris
  const keyFor = (tgl: string, i: number) => (w.dates.some((d) => norm(d) === norm(tgl)) ? norm(tgl) : w.dates[i] ? norm(w.dates[i]) : norm(tgl));
  cList.forEach(({ tgl, row, r }, i) => {
    const k = keyFor(tgl, i);
    w.rows.C[k] = row;
    const hadirRaw = (r[c.cHadir] ?? "").trim();
    if (hadirRaw) {
      const tk = parsePegawai(r[c.cTk] ?? ""), dl = parsePegawai(r[c.cDl] ?? ""), ct = parsePegawai(r[c.cCuti] ?? "");
      const p: Presensi = { hadir: parsePegawai(hadirRaw).n, tanpaKet: tk.n, tanpaKetKet: tk.ket, dl: dl.n, dlKet: dl.ket, cuti: ct.n, cutiKet: ct.ket };
      w.presensi[k] = p;
    }
  });
  pList.forEach(({ tgl, row, r }, i) => {
    const k = keyFor(tgl, i);
    w.rows.P[k] = row;
    const v = (j: number) => {
      const s = (r[j] ?? "").trim();
      return s === "" ? null : parseAngka(s);
    };
    const a: Aplikasi = { sikepo: v(c.pSikepo), epresensi: v(c.pEp), fp: v(c.pFp), tidak: v(c.pTidak), cutiDl: v(c.pCutiDl) };
    w.aplikasi[k] = Object.values(a).some((x) => x !== null) ? a : emptyAplikasi();
  });

  return w;
}

export async function fetchWeek(gid: string, tab: string): Promise<WeekData> {
  const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&gid=${gid}&_=${Date.now()}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Gagal membaca tab (${res.status}). Pastikan sheet dapat dilihat siapa saja yang punya link.`);
  const text = await res.text();
  if (/<html/i.test(text.slice(0, 200))) throw new Error("Sheet tidak publik — Google meminta login.");
  const w = parseWeek(text, gid, tab);
  if (!w.dates.length) throw new Error("Tab terbaca, tetapi struktur bagian A (Tim/Tanggal/Uraian) tidak ditemukan.");
  return w;
}

/** Gabungkan hasil impor dengan perubahan lokal yang belum dikirim. */
export function mergeWeek(fresh: WeekData, local?: WeekData): WeekData {
  if (!local) return fresh;
  const out: WeekData = {
    ...fresh,
    kegiatan: { ...fresh.kegiatan },
    lampiran: { ...fresh.lampiran },
    rencana: { ...fresh.rencana },
    presensi: { ...fresh.presensi },
    aplikasi: { ...fresh.aplikasi },
    anggaran: [...fresh.anggaran],
    selKeuangan: {},
    dirty: { ...local.dirty },
    meta: { ...local.meta },
    syncedAt: local.syncedAt,
  };
  Object.keys(local.dirty).forEach((dk) => {
    const [cat, ...rest] = dk.split(":");
    const k = rest.join(":");
    const pick = <T,>(src: Record<string, T>, dst: Record<string, T>) => {
      if (k in src) dst[k] = src[k];
      else delete dst[k];
    };
    if (cat === "A") pick(local.kegiatan, out.kegiatan);
    if (cat === "L") {
      // kunci dirty lampiran per tanggal ("tim|sub|tanggal") → nilai sel disimpan per tim/sub
      const bagian = k.split("|");
      const lk = `${bagian[0]}|${bagian[1] ?? ""}`;
      const lokal = local.lampiran[lk];
      if (lokal === undefined) return;
      // tautan yang sudah dihapus pengguna (ganti) jangan dihidupkan lagi dari sheet;
      // selain itu gabungkan supaya tautan yang baru diisi manual di sheet tidak hilang
      const ganti = Object.entries(local.meta).some(([mk, mv]) => mk.startsWith(`L:${lk}|`) && mv.ganti);
      out.lampiran[lk] = ganti
        ? lokal
        : susunLampiran([...parseLampiran(out.lampiran[lk] ?? ""), ...parseLampiran(lokal)]);
    }
    if (cat === "B") pick(local.rencana, out.rencana);
    if (cat === "C") pick(local.presensi, out.presensi);
    if (cat === "P") pick(local.aplikasi, out.aplikasi);
    if (cat === "K") out.selKeuangan[k] = local.selKeuangan?.[k] ?? "";
    if (cat === "R") {
      // realisasi keuangan yang belum terkirim tetap dipakai (dicocokkan lewat kode)
      const lokal = local.anggaran.find((a) => a.kode === k);
      const i = out.anggaran.findIndex((a) => a.kode === k);
      if (lokal && i >= 0) out.anggaran[i] = { ...lokal, baris: out.anggaran[i].baris };
      else if (lokal) out.anggaran.push(lokal);
    }
  });
  return out;
}

/* ------------------------- Opsi A: salin-tempel ------------------------- */

const tsvCell = (v: string) => (/[\t\n"]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
export const toTSV = (rows: string[][]) => rows.map((r) => r.map(tsvCell).join("\t")).join("\n");

const kolom = (n: number) => (n > 26 ? String.fromCharCode(64 + Math.floor((n - 1) / 26)) : "") + String.fromCharCode(65 + ((n - 1) % 26));

/** Letakkan nilai sesuai indeks kolomnya (mengisi celah dengan sel kosong). */
function sebar(cols: number[], vals: string[]): string[] {
  const min = Math.min(...cols);
  const out = Array(Math.max(...cols) - min + 1).fill("");
  cols.forEach((col, i) => (out[col - min] = vals[i] ?? ""));
  return out;
}

export type BlokSalin = { id: string; judul: string; sel: string; baris: number; tsv: string; terisi: number };

/** Blok-blok yang bisa disalin lalu ditempel ke sheet, lengkap dengan sel tujuan. */
export function blokSalin(w: WeekData): BlokSalin[] {
  const out: BlokSalin[] = [];

  SLOT_ROWS.forEach(({ tim, sub }) => {
    const rows = w.dates.map((d) => w.rows.A[slotKey(tim.id, sub, d)]).filter(Boolean) as number[];
    if (!rows.length) return;
    const start = Math.min(...rows);
    const end = Math.max(...rows);
    const grid: string[][] = [];
    let terisi = 0;
    for (let r = start; r <= end; r++) {
      const d = w.dates.find((x) => w.rows.A[slotKey(tim.id, sub, x)] === r);
      const items = d ? (w.kegiatan[slotKey(tim.id, sub, d)] ?? []) : [];
      if (items.length) terisi++;
      grid.push([joinUraian(items)]);
    }
    out.push({
      id: `A-${tim.id}-${sub}`,
      judul: `${tim.no}. ${tim.label}${sub ? ` · ${sub}` : ""}`,
      sel: `${kolom(w.cols.ur + 1)}${start}`,
      baris: grid.length,
      tsv: toTSV(grid),
      terisi,
    });
  });

  const bRows = TIMS.map((t) => w.rows.B[t.id]).filter(Boolean) as number[];
  if (bRows.length) {
    const start = Math.min(...bRows);
    const end = Math.max(...bRows);
    const grid: string[][] = [];
    let terisi = 0;
    for (let r = start; r <= end; r++) {
      const t = TIMS.find((x) => w.rows.B[x.id] === r);
      const items = t ? (w.rencana[t.id] ?? []) : [];
      if (items.length) terisi++;
      grid.push([joinUraian(items)]);
    }
    out.push({ id: "B", judul: "B. Rencana kegiatan", sel: `${kolom(w.cols.bUr + 1)}${start}`, baris: grid.length, tsv: toTSV(grid), terisi });
  }

  const cRows = w.dates.map((d) => w.rows.C[norm(d)]).filter(Boolean) as number[];
  if (cRows.length) {
    const start = Math.min(...cRows);
    const grid = w.dates
      .filter((d) => w.rows.C[norm(d)])
      .map((d) => sebar([w.cols.cHadir, w.cols.cTk, w.cols.cDl, w.cols.cCuti], presensiCells(w.presensi[norm(d)])));
    out.push({
      id: "C",
      judul: "C. Rekapitulasi presensi",
      sel: `${kolom(Math.min(w.cols.cHadir, w.cols.cTk, w.cols.cDl, w.cols.cCuti) + 1)}${start}`,
      baris: grid.length,
      tsv: toTSV(grid),
      terisi: grid.filter((g) => g.some(Boolean)).length,
    });
  }

  const pRows = w.dates.map((d) => w.rows.P[norm(d)]).filter(Boolean) as number[];
  if (pRows.length) {
    const start = Math.min(...pRows);
    const pc = [w.cols.pSikepo, w.cols.pEp, w.cols.pFp, w.cols.pTidak, w.cols.pCutiDl];
    const grid = w.dates.filter((d) => w.rows.P[norm(d)]).map((d) => sebar(pc, aplikasiCells(w.aplikasi[norm(d)])));
    out.push({
      id: "P",
      judul: "C. Penggunaan aplikasi presensi",
      sel: `${kolom(Math.min(...pc) + 1)}${start}`,
      baris: grid.length,
      tsv: toTSV(grid),
      terisi: grid.filter((g) => g.some(Boolean)).length,
    });
  }

  return out;
}

export function presensiCells(p?: Presensi): string[] {
  if (!p || p.hadir === null) return ["", "", "", ""];
  return [
    `${p.hadir} Pegawai`,
    formatPegawai(p.tanpaKet, p.tanpaKetKet),
    formatPegawai(p.dl, p.dlKet),
    formatPegawai(p.cuti, p.cutiKet),
  ];
}

export function aplikasiCells(a?: Aplikasi): string[] {
  if (!a) return ["", "", "", "", ""];
  return [a.sikepo, a.epresensi, a.fp, a.tidak, a.cutiDl].map((v) => (v === null ? "" : String(v)));
}

/* ------------------------- Opsi B: Apps Script ------------------------- */

export type Payload = {
  token: string;
  gid: string;
  oleh: string;
  kegiatan: { tim: string; sub: string; tanggal: string; uraian: string }[];
  /** satu entri per tanggal: skrip menuliskannya ke baris tanggal itu */
  lampiran: { tim: string; sub: string; tanggal: string; url: string; gabung?: boolean }[];
  rencana: { tim: string; uraian: string }[];
  presensi: { tanggal: string; idx: number; nilai: string[] }[];
  aplikasi: { tanggal: string; idx: number; nilai: string[] }[];
  /** bagian D — realisasi keuangan per kode kegiatan */
  keuangan: { kode: string; uraian: string; pagu: number; realisasi: number; baris?: number }[];
  /** bagian D — sel tabel keuangan lain (Rekapitulasi UP, LS, Rencana Penarikan, …) */
  sel: { baris: number; kolom: number; nilai: string; label?: string; labelKolom?: number }[];
};

export function buildPayload(w: WeekData, token: string, oleh: string, hanyaBerubah: boolean): Payload {
  const inc = (k: string) => !hanyaBerubah || !!w.dirty[k];
  const p: Payload = {
    token,
    gid: w.gid,
    oleh,
    kegiatan: [],
    lampiran: [],
    rencana: [],
    presensi: [],
    aplikasi: [],
    keuangan: [],
    sel: [],
  };

  SLOT_ROWS.forEach(({ tim, sub }) => {
    w.dates.forEach((d) => {
      const k = slotKey(tim.id, sub, d);
      const items = w.kegiatan[k] ?? [];
      if (inc(`A:${k}`) && (items.length || hanyaBerubah))
        p.kegiatan.push({ tim: tim.id, sub: norm(sub), tanggal: norm(d), uraian: joinUraian(items) });
    });
    const lk = lampKey(tim.id, sub);
    // tautan dikirim PER TANGGAL: tiap tanggal ditulis ke barisnya sendiri di kolom lampiran
    if (inc(`L:${lk}`)) {
      const entri = parseLampiran(w.lampiran[lk] ?? "");
      w.dates.forEach((d) => {
        const milik = entri.filter((e) => norm(e.tanggal) === norm(d));
        // "ganti" hanya untuk tanggal yang tautannya dihapus user; tanggal lain tetap ditambah
        const ganti = !!w.meta[`L:${lk}|${norm(d)}`]?.ganti;
        if (!milik.length && !ganti) return;
        p.lampiran.push({ tim: tim.id, sub: norm(sub), tanggal: norm(d), url: susunLampiran(milik), gabung: !ganti });
      });
    }
  });
  TIMS.forEach((t) => {
    const items = w.rencana[t.id] ?? [];
    if (inc(`B:${t.id}`) && (items.length || hanyaBerubah)) p.rencana.push({ tim: t.id, uraian: joinUraian(items) });
  });
  // bagian D: hanya baris yang diubah (atau semua saat kirim ulang penuh)
  w.anggaran.forEach((a) => {
    if (!a.kode) return;
    if (inc(`R:${a.kode}`))
      p.keuangan.push({ kode: a.kode, uraian: a.uraian, pagu: a.pagu, realisasi: a.realisasi, baris: a.baris });
  });
  // sel tabel keuangan lain: kirim baris + kolom yang diubah, plus label baris sebagai pengaman
  Object.keys(w.dirty).forEach((dk) => {
    if (!dk.startsWith("K:") || !inc(dk)) return;
    const [b, c] = dk.slice(2).split(":");
    const baris = Number(b);
    const kolom = Number(c);
    if (!baris || Number.isNaN(kolom)) return;
    const pemilik = (w.tabelKeuangan ?? []).flatMap((t) => t.baris).find((r) => r.nomor === baris);
    p.sel.push({
      baris,
      kolom,
      nilai: w.selKeuangan?.[`${b}:${c}`] ?? "",
      label: pemilik?.label,
      labelKolom: pemilik?.labelKolom,
    });
  });
  w.dates.forEach((d, idx) => {
    const k = norm(d);
    const pr = w.presensi[k];
    if (inc(`C:${k}`) && pr && pr.hadir !== null) p.presensi.push({ tanggal: k, idx, nilai: presensiCells(pr) });
    const ap = w.aplikasi[k];
    if (inc(`P:${k}`) && ap && Object.values(ap).some((v) => v !== null))
      p.aplikasi.push({ tanggal: k, idx, nilai: aplikasiCells(ap) });
  });
  return p;
}

export const payloadCount = (p: Payload) =>
  p.kegiatan.length +
  p.lampiran.length +
  p.rencana.length +
  p.presensi.length +
  p.aplikasi.length +
  (p.keuangan?.length ?? 0) +
  (p.sel?.length ?? 0);

export type ScriptResult = {
  ok: boolean;
  ditulis?: number;
  gagal?: string[];
  error?: string;
  versi?: string;
  verified: boolean;
};

const simpul = (e: unknown) =>
  e instanceof Error && e.name === "AbortError"
    ? "Koneksi ke Apps Script timeout."
    : "Tidak bisa menghubungi Apps Script. Periksa URL Web App & koneksi internet.";

/** Kirim paket perubahan ke Apps Script. `verified` = balasan skrip terbaca. */
export async function kirimKeScript(url: string, payload: Payload, batasMs = 25000): Promise<ScriptResult> {
  const body = JSON.stringify(payload);
  const ctrl = new AbortController();
  const jam = setTimeout(() => ctrl.abort(), batasMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      body,
      // text/plain = permintaan sederhana, jadi tidak memicu preflight CORS
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      redirect: "follow",
      signal: ctrl.signal,
    });
    const teks = await res.text();
    try {
      const data = JSON.parse(teks);
      return { ...data, verified: true };
    } catch {
      // balasan bukan JSON (mis. halaman login Google) — anggap belum terverifikasi
      return { ok: res.ok, verified: false, error: "Balasan skrip tidak dapat dibaca." };
    }
  } catch {
    // Beberapa browser memblokir balasan Apps Script: kirim ulang tanpa membaca balasan
    // (nilainya idempoten, jadi aman bila ternyata kiriman pertama sudah masuk).
    try {
      const ctrl2 = new AbortController();
      const jam2 = setTimeout(() => ctrl2.abort(), 15000);
      await fetch(url, {
        method: "POST",
        body,
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        signal: ctrl2.signal,
      });
      clearTimeout(jam2);
      return { ok: true, verified: false };
    } catch (e) {
      throw new Error(simpul(e));
    }
  } finally {
    clearTimeout(jam);
  }
}

/** Versi kode Apps Script yang disalin dari aplikasi (harus sama dengan `VERSI` di skrip). */
export const SCRIPT_VERSI = "1.9";

export type BuatTabResult = {
  ok: boolean;
  gid?: string;
  name?: string;
  versi?: string;
  /** jumlah sel isian yang dikosongkan */
  dikosongkan?: number;
  /** jumlah sel tanggal yang digeser + rentangnya */
  tanggal?: { jumlah: number; pertama?: string; terakhir?: string };
  error?: string;
};

/**
 * Minta Apps Script membuat tab minggu baru: salinan struktur tab sumber,
 * isian mingguan dikosongkan, tanggal digeser `geserHari`.
 */
export async function buatTabBaru(
  url: string,
  token: string,
  sumberGid: string,
  nama: string,
  geserHari: number,
  oleh = "",
): Promise<BuatTabResult> {
  const body = JSON.stringify({ token, aksi: "buatTab", sumberGid, nama, geserHari, oleh });
  const ctrl = new AbortController();
  const jam = setTimeout(() => ctrl.abort(), 60000);
  try {
    const res = await fetch(url, {
      method: "POST",
      body,
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      redirect: "follow",
      signal: ctrl.signal,
    });
    const teks = await res.text();
    let data: BuatTabResult;
    try {
      data = JSON.parse(teks) as BuatTabResult;
    } catch {
      throw new Error(`Balasan skrip tidak dapat dibaca. Perbarui Apps Script ke v${SCRIPT_VERSI} lalu coba lagi.`);
    }
    if (!data.gid) {
      if (data.versi && data.versi !== SCRIPT_VERSI) {
        return {
          ok: false,
          error: `Skrip di spreadsheet masih v${data.versi}. Salin ulang kode v${SCRIPT_VERSI} dari menu Sinkronisasi → Apps Script, lalu Deploy versi baru — setelah itu tab baru bisa dibuat dari aplikasi.`,
          versi: data.versi,
        };
      }
      return { ok: false, error: data.error ?? "Skrip tidak mengembalikan tab baru.", versi: data.versi };
    }
    return { ...data, ok: true };
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") throw new Error("Pembuatan tab melebihi batas waktu. Periksa sheet — bila tab sudah ada, cukup muat ulang daftar tab.");
    if (e instanceof Error && /Balasan skrip/.test(e.message)) throw e;
    throw new Error("Tidak bisa menghubungi Apps Script untuk membuat tab baru. Periksa URL Web App & koneksi internet.");
  } finally {
    clearTimeout(jam);
  }
}

export async function tesScript(url: string): Promise<{ ok: boolean; nama?: string; tabs?: { name: string; gid: string }[]; versi?: string }> {
  const ctrl = new AbortController();
  const jam = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(`${url}${url.includes("?") ? "&" : "?"}aksi=ping`, { redirect: "follow", signal: ctrl.signal });
    return await res.json();
  } finally {
    clearTimeout(jam);
  }
}

export const APPS_SCRIPT = `/**
 * Lapor.in — jembatan tulis OTOMATIS ke "Laporan Mingguan Tim Dukman"
 * Setiap isian di aplikasi langsung masuk ke sheet, tanpa menyalin/menekan kirim.
 *
 * 1. Buka spreadsheet → Ekstensi → Apps Script → hapus isi default → tempel kode ini.
 * 2. Ganti TOKEN di bawah dengan kode rahasia Anda, samakan dengan kolom Token di aplikasi.
 * 3. Terapkan → Deployment baru → Jenis: Aplikasi web
 *    Jalankan sebagai: Saya · Yang memiliki akses: Siapa saja → Deploy → salin URL /exec.
 *
 * Posisi kolom dibaca dari baris judul (No/Tim/Tanggal/Uraian, Kehadiran, Sikepo…),
 * jadi tetap aman bila ada kolom/baris yang disisipkan.
 *
 * v1.4 menambah aksi "buatTab": menyalin tab minggu sebelumnya menjadi tab minggu
 * baru — struktur/judul/nama tim tetap, isian dikosongkan, tanggal digeser +7 hari.
 * v1.5 menulis tautan bukti dukung secara MENAMBAH (bertanda tanggal) — isi sel
 * lama tidak pernah terhapus kecuali aplikasi mengirim perintah ganti.
 * v1.6 menulis tautan ke BARIS TANGGALNYA masing-masing (bukan menumpuk di satu
 * sel), dan membuka sel gabungan (merge) pada kolom lampiran lebih dulu.
 * v1.7 menulis bagian D (realisasi keuangan): pagu & realisasi per kode kegiatan
 * langsung ke barisnya, dicocokkan lewat kode (aman bila ada baris disisipkan).
 * v1.8 menulis sel tabel keuangan lain (Rekapitulasi UP, Pembayaran Melalui LS,
 * Rencana Penarikan, …) ke baris & kolom yang sama, dengan pemeriksaan label baris.
 * v1.9 pagu/realisasi ditulis ke baris yang dikirim aplikasi (setelah kodenya dicek),
 * jadi tetap benar walau bagian D memuat beberapa tabel ber-kolom Kode/Pagu.
 */
const TOKEN = 'GANTI-DENGAN-KODE-RAHASIA'; // samakan dengan isian di aplikasi
const VERSI = '${SCRIPT_VERSI}';

/** Rapikan teks: huruf kecil, spasi tunggal — dipakai untuk mencocokkan tanggal. */
function rapi(s) {
  return String(s === null || s === undefined ? '' : s).toLowerCase().replace(/\\s+/g, ' ').trim();
}

function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return keluar({
    ok: true, versi: VERSI, nama: ss.getName(),
    tabs: ss.getSheets().filter(function (s) { return !s.isSheetHidden(); })
      .map(function (s) { return { name: s.getName(), gid: String(s.getSheetId()) }; })
  });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) return keluar({ ok: false, error: 'Sheet sedang ditulis proses lain. Coba lagi.' });
  try {
    const d = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (String(d.token) !== String(TOKEN)) return keluar({ ok: false, error: 'Token tidak cocok dengan yang ada di skrip.' });
    if (d.aksi === 'buatTab') return buatTab(d);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = cariTab(ss, d.gid);
    if (!sh) return keluar({ ok: false, error: 'Tab dengan gid ' + d.gid + ' tidak ditemukan.' });

    const m = petakan(sh), k = m.col;
    let n = 0; const gagal = [];
    const tulis = function (row, cols, vals, label) {
      if (!row) { gagal.push(label); return; }
      n += tulisBaris(sh, row, cols, vals);
    };

    (d.kegiatan || []).forEach(function (x) { tulis(m.A[x.tim + '|' + x.sub + '|' + x.tanggal], [k.ur], [x.uraian], 'kegiatan ' + x.tim + ' ' + x.tanggal); });
    (d.lampiran || []).forEach(function (x) {
      const kunci = x.tim + '|' + x.sub;
      const tgl = rapi(x.tanggal || '');
      // baris tanggalnya sendiri; kalau tanggal tidak dikirim (aplikasi lama) pakai baris pertama tim
      const barisLamp = (tgl && m.A[kunci + '|' + tgl]) || m.L[kunci];
      if (!barisLamp) { gagal.push('lampiran ' + x.tim + (x.tanggal ? ' ' + x.tanggal : '')); return; }
      n += tulisLampiran(sh, barisLamp, k.lamp, x.url, x.gabung !== false, m, x.tim, x.sub);
    });
    (d.rencana || []).forEach(function (x) { tulis(m.B[x.tim], [k.bUr], [x.uraian], 'rencana ' + x.tim); });
    (d.keuangan || []).forEach(function (x) {
      const kode = String(x.kode || '').trim();
      if (!kode) { gagal.push('keuangan: kode kosong'); return; }
      const baris = m.Rkode[rapi(kode)];
      if (!baris) { gagal.push('keuangan ' + kode); return; }
      n += tulisBaris(sh, baris, [k.rKode, k.rUr, k.rPagu, k.rReal], [kode, x.uraian, angkaNomor(x.pagu), angkaNomor(x.realisasi)]);
    });
    (d.sel || []).forEach(function (x) {
      const baris = Number(x.baris), kolom = Number(x.kolom);
      if (!baris || kolom < 0) { gagal.push('sel ' + baris + ':' + kolom); return; }
      // pengaman: pastikan barisnya masih baris yang sama (label tidak bergeser)
      if (x.label !== undefined && x.label !== null && x.label !== '') {
        const labelSekarang = String(sh.getRange(baris, Number(x.labelKolom || 0) + 1).getDisplayValue() || '').trim();
        if (rapi(labelSekarang) !== rapi(x.label)) { gagal.push('baris ' + baris + ' bergeser'); return; }
      }
      sh.getRange(baris, kolom + 1).setValue(nilaiSel(x.nilai));
      n += 1;
    });
    (d.presensi || []).forEach(function (x) { tulis(m.C[x.tanggal] || m.Cidx[x.idx], [k.cHadir, k.cTk, k.cDl, k.cCuti], x.nilai, 'presensi ' + x.tanggal); });
    (d.aplikasi || []).forEach(function (x) { tulis(m.P[x.tanggal] || m.Pidx[x.idx], [k.pSikepo, k.pEp, k.pFp, k.pTidak, k.pCutiDl], x.nilai, 'aplikasi ' + x.tanggal); });

    if (n) catat(sh, d.oleh, n, gagal.length);
    return keluar({ ok: true, versi: VERSI, ditulis: n, gagal: gagal });
  } catch (err) {
    return keluar({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function cariTab(ss, gid) {
  const sheets = ss.getSheets();
  for (let i = 0; i < sheets.length; i++) if (String(sheets[i].getSheetId()) === String(gid)) return sheets[i];
  return null;
}

/** Nilai sel tabel keuangan: teks berisi angka ditulis sebagai angka, selain itu teks biasa. */
function nilaiSel(v) {
  if (typeof v === 'number') return v;
  const t = String(v === null || v === undefined ? '' : v).trim();
  if (!t) return '';
  if (/^-?[0-9.,]+$/.test(t) && /[0-9]/.test(t)) return angkaNomor(t);
  return t;
}

/** Angka rupiah dari payload (boleh angka atau teks "1.250.000" / "1.250.000,50"). */
function angkaNomor(v) {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  const t = String(v === null || v === undefined ? '' : v).replace(/[^0-9,.-]/g, '');
  if (!t) return 0;
  const n = Number(t.split('.').join('').replace(',', '.'));
  return isFinite(n) ? n : 0;
}

/** Tulis beberapa kolom pada satu baris. Kolom berurutan disatukan agar cepat (cocok untuk sinkron otomatis). */
function tulisBaris(sh, row, cols, vals) {
  const pasangan = cols.map(function (c, i) {
    const v = vals[i];
    // angka ditulis sebagai angka (bukan teks) supaya rumus & format rupiah tetap bekerja
    return [c, v === null || v === undefined || v === '' ? '' : (typeof v === 'number' ? v : String(v))];
  }).sort(function (a, b) { return a[0] - b[0]; });
  let n = 0, mulai = pasangan[0][0], buf = [pasangan[0][1]];
  const siram = function () {
    if (!buf.length) return;
    sh.getRange(row, mulai + 1, 1, buf.length).setValues([buf]);
    n += buf.length;
  };
  for (let i = 1; i < pasangan.length; i++) {
    if (pasangan[i][0] === mulai + buf.length) buf.push(pasangan[i][1]);
    else { siram(); mulai = pasangan[i][0]; buf = [pasangan[i][1]]; }
  }
  siram();
  return n;
}

/** Membaca struktur tab: bagian A–C, posisi kolom, tim, sub (Program/Monev), dan tanggal. */
function petakan(sh) {
  const v = sh.getDataRange().getDisplayValues();
  const m = { A: {}, L: {}, B: {}, C: {}, P: {}, Cidx: [], Pidx: [], Rkode: {}, rAda: false,
    col: { tim: 2, tgl: 3, ur: 4, lamp: 9, bTim: 2, bUr: 3, cTgl: 2, cHadir: 3, cTk: 4, cDl: 5, cCuti: 6,
           pTgl: 2, pSikepo: 3, pEp: 4, pFp: 5, pTidak: 6, pCutiDl: 7, rKode: 1, rUr: 2, rPagu: 3, rReal: 4 } };
  const c = m.col;
  const tglRe = /^\\d{1,2} (januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember) \\d{4}$/;
  const n = s => String(s || '').toLowerCase().replace(/\\s+/g, ' ').trim();
  const cari = (r, f) => r.findIndex(x => f(n(x)));
  const timDari = s => n(s).split(' ')[0];
  let sec = '', tim = '', sub = '', lampFound = false, lampHeader = false;

  for (let i = 0; i < v.length; i++) {
    const r = v[i], row = i + 1, cell = j => String(r[j] || '').trim();
    let marker = false;
    for (let j = 0; j < 4; j++) {
      if (['A', 'B', 'C', 'D'].indexOf(cell(j)) >= 0 && cell(j + 1)) { sec = cell(j); tim = ''; sub = ''; marker = true; break; }
    }
    if (marker) continue;
    if (r.some(x => /^rekapitulasi penggunaan aplikasi presensi/i.test(String(x).trim()))) { sec = 'P'; continue; }
    if (r.some(x => /^realisasi (anggaran|keuangan)/i.test(String(x).trim()))) { sec = 'R'; continue; }

    if (sec === 'A') {
      const t = cari(r, x => x === 'tim'), g = cari(r, x => x.indexOf('tanggal') === 0), u = cari(r, x => x.indexOf('uraian') === 0);
      if (t >= 0 && g >= 0 && u >= 0) {
        c.tim = t; c.tgl = g; c.ur = u;
        // kolom lampiran dibaca dari judul kolomnya (tab baru belum punya tautan)
        const lk = cari(r, x => /^(link|tautan|lampiran|bukti)/.test(x));
        if (lk > u) { c.lamp = lk; lampHeader = true; }
        else if (!lampFound) c.lamp = u + 5;
        continue;
      }
      const T = cell(c.tim), G = n(cell(c.tgl));
      if (T && n(T) !== 'tim') { tim = timDari(T); sub = ''; }
      if (!tim) continue;
      if (G === 'program' || G === 'monev') sub = G;
      for (let j = c.ur + 1; j < r.length; j++) {
        if (/https?:\\/\\//i.test(r[j])) { if (!lampHeader && !lampFound) { c.lamp = j; lampFound = true; } break; }
      }
      if (tim === 'program' && !sub && tglRe.test(G)) sub = 'program';
      if (tglRe.test(G)) {
        m.A[tim + '|' + sub + '|' + G] = row;
        if (!m.L[tim + '|' + sub]) m.L[tim + '|' + sub] = row;
      }
    } else if (sec === 'B') {
      const t = cari(r, x => x === 'tim'), u = cari(r, x => x.indexOf('uraian') === 0);
      if (t >= 0 && u >= 0) { c.bTim = t; c.bUr = u; continue; }
      const T = cell(c.bTim);
      if (T && n(T) !== 'tim') m.B[timDari(T)] = row;
    } else if (sec === 'R' || sec === 'D') {
      const k = cari(r, x => x.indexOf('kode') === 0), p = cari(r, x => x.indexOf('pagu') === 0);
      const u = cari(r, x => x.indexOf('uraian') === 0), re = cari(r, x => x.indexOf('realisasi') === 0);
      if (k >= 0 && p >= 0) {
        c.rKode = k; c.rPagu = p; c.rUr = u >= 0 ? u : k + 1; c.rReal = re >= 0 ? re : p + 1;
        m.rAda = true;
        continue;
      }
      // judul kolom tabel keuangan lain / baris judul → berhenti membaca tabel anggaran
      if ((u >= 0 && p >= 0) || r.filter(x => String(x || '').trim()).length <= 1) {
        m.rAda = false;
        continue;
      }
      // hanya setelah judul kolom kode/pagu dikenali — supaya tabel lain tidak salah ditulis
      const kode = cell(c.rKode);
      if (m.rAda && kode && n(kode) !== 'kode' && !/^total/i.test(n(kode))) m.Rkode[n(kode)] = row;
    } else if (sec === 'C') {
      const g = cari(r, x => x === 'tanggal'), h = cari(r, x => x.indexOf('kehadiran') === 0);
      if (g >= 0 && h >= 0) {
        c.cTgl = g; c.cHadir = h;
        const tk = cari(r, x => x.indexOf('tidak masuk') === 0), dl = cari(r, x => x.indexOf('dinas luar') === 0), ct = cari(r, x => x === 'cuti');
        if (tk >= 0) c.cTk = tk; if (dl >= 0) c.cDl = dl; if (ct >= 0) c.cCuti = ct;
        continue;
      }
      if (tglRe.test(n(cell(c.cTgl)))) { m.C[n(cell(c.cTgl))] = row; m.Cidx.push(row); }
    } else if (sec === 'P') {
      const g = cari(r, x => x === 'tanggal');
      if (g >= 0) {
        c.pTgl = g;
        const td = cari(r, x => x.indexOf('tidak presensi') === 0), cd = cari(r, x => x.indexOf('cuti') === 0);
        if (td >= 0) c.pTidak = td; if (cd >= 0) c.pCutiDl = cd;
        continue;
      }
      const s = cari(r, x => x === 'sikepo');
      if (s >= 0) {
        c.pSikepo = s;
        const e = cari(r, x => x.replace(/[-\\s]/g, '') === 'epresensi'), f = cari(r, x => x.indexOf('finger') === 0);
        if (e >= 0) c.pEp = e; if (f >= 0) c.pFp = f;
        continue;
      }
      if (tglRe.test(n(cell(c.pTgl)))) { m.P[n(cell(c.pTgl))] = row; m.Pidx.push(row); }
    }
  }
  return m;
}

/* ---------------------- tautan bukti dukung (bertanggal) ---------------------- */

/**
 * Tulis tautan ke sel lampiran PADA BARIS TANGGAL ITU.
 * gabung = tambahkan ke isi baris (default), false = ganti isi baris (user menghapus tautan).
 * Sel gabungan (merge) dibuka lebih dulu agar tiap tanggal punya barisnya sendiri.
 */
function tulisLampiran(sh, row, col, teks, gabung, m, tim, sub) {
  bukaGabungan(sh, row, col, m, tim, sub);
  const sel = sh.getRange(row, col + 1);
  const lama = String(sel.getDisplayValue() || '');
  const isi = gabung ? gabungLampiran(lama, teks) : susunLampiran(entriLampiran(teks));
  if (isi === lama) return 0;
  return tulisBaris(sh, row, [col], [isi]);
}

/**
 * Bila sel lampiran tergabung (merge) beberapa baris, buka gabungannya dan sebar
 * isi lama ke baris tanggalnya masing-masing — tidak ada tautan yang hilang.
 */
function bukaGabungan(sh, row, col, m, tim, sub) {
  const sel = sh.getRange(row, col + 1);
  let g = [];
  try { g = sel.getMergedRanges() || []; } catch (e) { g = []; }
  if (!g.length) return false;
  const r0 = g[0];
  const tinggi = r0.getNumRows ? r0.getNumRows() : 1;
  if (tinggi < 2 || (r0.getNumColumns && r0.getNumColumns() > 1)) return false;
  const atas = r0.getRow();
  const isi = String(sh.getRange(atas, col + 1).getDisplayValue() || '');
  r0.breakApart();
  if (!isi.trim()) return true;
  const pindah = {}, sisa = [];
  entriLampiran(isi).forEach(function (e) {
    const baris = e.tanggal && m && tim !== undefined ? m.A[tim + '|' + (sub || '') + '|' + rapi(e.tanggal)] : 0;
    if (baris && baris >= atas && baris < atas + tinggi) (pindah[baris] = pindah[baris] || []).push(e);
    else sisa.push(e);
  });
  sh.getRange(atas, col + 1).setValue(susunLampiran(sisa));
  Object.keys(pindah).forEach(function (b) {
    const lamaBaris = String(sh.getRange(Number(b), col + 1).getDisplayValue() || '');
    sh.getRange(Number(b), col + 1).setValue(gabungLampiran(lamaBaris, susunLampiran(pindah[b])));
  });
  return true;
}

/** Pecah isi sel lampiran menjadi entri { tanggal, url }. */
function entriLampiran(teks) {
  const out = [], sudah = {};
  String(teks || '').replace(/\\r/g, '').split('\\n').forEach(function (baris) {
    const t = baris.trim();
    if (!t) return;
    const m = t.match(/^(\\d{1,2}\\s+[A-Za-z]+\\s+\\d{4})\\s*[:\\u2013-]\\s*(.*)$/);
    const tanggal = m ? m[1] : '';
    const isi = tanggal ? m[2] : t;
    const re = /https?:\\/\\/[^\\s<>"']+/gi;
    let u;
    while ((u = re.exec(isi))) {
      const url = u[0].replace(/[.,;:]+$/, '');
      const kunci = url.toLowerCase();
      if (sudah[kunci]) continue;
      sudah[kunci] = 1;
      out.push({ tanggal: tanggal, url: url });
    }
  });
  return out;
}

/** Susun entri menjadi isi sel: satu baris per tautan, diawali tanggalnya. */
function susunLampiran(entri) {
  if (!entri.length) return '';
  return entri.map(function (e) { return (e.tanggal ? e.tanggal + ': ' : '') + e.url; }).join('\\n');
}

/** Gabungkan isi sel lama dengan kiriman baru — tautan lama tidak pernah hilang. */
function gabungLampiran(lama, baru) {
  const hasil = entriLampiran(lama);
  entriLampiran(baru).forEach(function (e) {
    const ada = hasil.filter(function (x) { return x.url.toLowerCase() === e.url.toLowerCase(); })[0];
    if (ada) {
      if (!ada.tanggal && e.tanggal) ada.tanggal = e.tanggal;
      return;
    }
    hasil.push({ tanggal: e.tanggal, url: e.url });
  });
  return susunLampiran(hasil);
}

function catat(sh, oleh, n, gagal) {
  const ss = sh.getParent();
  let log = ss.getSheetByName('_audit');
  if (!log) {
    log = ss.insertSheet('_audit');
    log.appendRow(['Waktu', 'Oleh', 'Tab', 'Jumlah', 'Catatan']);
    log.hideSheet();
  }
  log.appendRow([new Date(), oleh || '-', sh.getName(), n + ' sel', gagal ? gagal + ' baris tidak ditemukan' : 'otomatis']);
}

/* ------------------- tab minggu baru (permintaan: buatTab) ------------------- */

/**
 * Salin tab sumber menjadi tab minggu baru:
 * judul, nama tim, dan baris tetap — isian mingguan dikosongkan, tanggal digeser.
 */
function buatTab(d) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sumber = cariTab(ss, d.sumberGid);
  if (!sumber) return keluar({ ok: false, versi: VERSI, error: 'Tab sumber tidak ditemukan. Muat ulang daftar tab lalu coba lagi.' });

  const nama = String(d.nama || '').replace(/\\s+/g, ' ').trim();
  if (!nama) return keluar({ ok: false, versi: VERSI, error: 'Nama tab baru belum diisi.' });
  if (nama.length > 90) return keluar({ ok: false, versi: VERSI, error: 'Nama tab terlalu panjang (maksimal 90 huruf).' });
  if (nama.charAt(0) === '_') return keluar({ ok: false, versi: VERSI, error: 'Nama tab tidak boleh diawali garis bawah (_).' });
  if (ss.getSheetByName(nama)) return keluar({ ok: false, versi: VERSI, error: 'Tab "' + nama + '" sudah ada. Pakai nama lain.' });

  const m = petakan(sumber);
  const geser = isNaN(Number(d.geserHari)) ? 7 : Number(d.geserHari);

  const baru = sumber.copyTo(ss);
  baru.setName(nama);
  baru.showSheet();

  // 1) kosongkan isian mingguan (uraian & lampiran A, rencana B, nilai C & P)
  const A1 = function (row, col) { return kolomAbjad(col + 1) + row; };
  const barisA = unik(nilai(m.A).concat(nilai(m.L)));
  const barisB = unik(nilai(m.B));
  const sel = [];
  barisA.forEach(function (row) {
    sel.push(A1(row, m.col.ur));
    if (m.col.lamp >= 0) sel.push(A1(row, m.col.lamp));
  });
  barisB.forEach(function (row) { sel.push(A1(row, m.col.bUr)); });
  m.Cidx.forEach(function (row) {
    [m.col.cHadir, m.col.cTk, m.col.cDl, m.col.cCuti].forEach(function (c) { sel.push(A1(row, c)); });
  });
  m.Pidx.forEach(function (row) {
    [m.col.pSikepo, m.col.pEp, m.col.pFp, m.col.pTidak, m.col.pCutiDl].forEach(function (c) { sel.push(A1(row, c)); });
  });
  const bersih = unik(sel);
  if (bersih.length) {
    try {
      baru.getRangeList(bersih).clearContent();
    } catch (err) {
      bersih.forEach(function (a1) { try { baru.getRange(a1).clearContent(); } catch (err2) {} });
    }
  }

  // 2) geser tanggal: kolom Tanggal bagian A, C, P + rentang tanggal di judul
  let nTanggal = 0, pertama = null, terakhir = null;
  if (geser) {
    const sasaran = [];
    barisA.forEach(function (row) { sasaran.push([row, m.col.tgl]); });
    m.Cidx.forEach(function (row) { sasaran.push([row, m.col.cTgl]); });
    m.Pidx.forEach(function (row) { sasaran.push([row, m.col.pTgl]); });
    sasaran.forEach(function (t) {
      const rg = baru.getRange(t[0], t[1] + 1);
      const v = rg.getValue();
      let g = null;
      if (v instanceof Date) g = new Date(v.getTime());
      else if (typeof v === 'string') g = tanggalDariTeks(v);
      if (!g) return;
      g.setDate(g.getDate() + geser);
      if (v instanceof Date) rg.setValue(g); else rg.setValue(tulisTanggal(v, g));
      nTanggal++;
      if (!pertama || g < pertama) pertama = g;
      if (!terakhir || g > terakhir) terakhir = g;
    });

    // geser juga tanggal yang tertulis di baris judul ("LAPORAN MINGGU … 3 - 7 November 2025")
    const barisJudul = cariJudul(baru);
    if (barisJudul) {
      const lebar = baru.getLastColumn();
      for (let kol = 1; kol <= lebar; kol++) {
        const rg = baru.getRange(barisJudul, kol);
        const teks = String(rg.getValue() || '');
        if (!teks) continue;
        const teksBaru = geserTanggalTeks(teks, geser);
        if (teksBaru !== teks) rg.setValue(teksBaru);
      }
    }
  }

  // 3) letakkan di samping tab sumber (biasanya di depan, mengikuti urutan terbaru)
  const posisi = sumber.getIndex();
  ss.setActiveSheet(baru);
  ss.moveActiveSheet(posisi);

  catat(baru, d.oleh, bersih.length, 0);
  return keluar({
    ok: true, versi: VERSI, gid: String(baru.getSheetId()), name: baru.getName(),
    dikosongkan: bersih.length,
    tanggal: {
      jumlah: nTanggal,
      pertama: pertama ? pertama.toISOString() : '',
      terakhir: terakhir ? terakhir.toISOString() : ''
    }
  });
}

const BULAN_ID = ['januari', 'februari', 'maret', 'april', 'mei', 'juni', 'juli', 'agustus', 'september', 'oktober', 'november', 'desember'];

function nilai(obj) {
  return Object.keys(obj).map(function (k) { return obj[k]; });
}

function unik(arr) {
  const out = [], sudah = {};
  arr.forEach(function (x) {
    if (sudah[x]) return;
    sudah[x] = 1;
    out.push(x);
  });
  return out;
}

function kolomAbjad(n) {
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function tanggalDariTeks(s) {
  const m = String(s).replace(/\\s+/g, ' ').trim().match(/^(\\d{1,2})\\s+([A-Za-z]+)\\s+(\\d{4})$/);
  if (!m) return null;
  const b = BULAN_ID.indexOf(m[2].toLowerCase());
  if (b < 0) return null;
  return new Date(Number(m[3]), b, Number(m[1]));
}

function namaBulan(asli) {
  const b = BULAN_ID[BULAN_ID.indexOf(String(asli).toLowerCase())];
  if (!b) return String(asli);
  const kapital = String(asli).charAt(0) !== String(asli).charAt(0).toLowerCase();
  return kapital ? b.charAt(0).toUpperCase() + b.slice(1) : b;
}

function tulisTanggal(asli, g) {
  // asli bisa berupa tanggal lengkap ("3 November 2025") atau nama bulan saja ("NOVEMBER")
  const t = String(asli).replace(/\\s+/g, ' ').trim();
  const m = t.match(/^\\d{1,2}\\s+([A-Za-z]+)\\s+\\d{4}$/);
  const kata = m ? m[1] : t;
  const nama = BULAN_ID.indexOf(kata.toLowerCase()) >= 0 ? namaBulan(kata) : BULAN_ID[g.getMonth()];
  return g.getDate() + ' ' + nama + ' ' + g.getFullYear();
}

/** Geser setiap tanggal yang tertulis di sebuah teks ("3 - 7 November 2025" → "10 - 14 November 2025"). */
function geserTanggalTeks(teks, hari) {
  return String(teks).replace(/(\\d{1,2})(\\s*[-\\u2013]\\s*(\\d{1,2}))?\\s+([A-Za-z]+)\\s+(\\d{4})/g, function (utuh, d1, rentang, d2, bulan, tahun) {
    const bi = BULAN_ID.indexOf(String(bulan).toLowerCase());
    if (bi < 0) return utuh;
    const maju = function (n) {
      const x = new Date(Number(tahun), bi, Number(n));
      x.setDate(x.getDate() + hari);
      return x;
    };
    const a = maju(d1);
    if (!d2) return tulisTanggal(bulan, a);
    const b = maju(d2);
    const pisah = (String(rentang).match(/[-\\u2013]/) || ['-'])[0];
    if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear())
      return a.getDate() + ' ' + pisah + ' ' + b.getDate() + ' ' + namaBulan(bulan) + ' ' + b.getFullYear();
    return tulisTanggal(bulan, a) + ' ' + pisah + ' ' + tulisTanggal(bulan, b);
  });
}

/** Nomor baris yang memuat judul "LAPORAN MINGGU …". */
function cariJudul(sh) {
  const n = Math.min(sh.getLastRow(), 12);
  if (!n) return 0;
  const v = sh.getRange(1, 1, n, Math.min(sh.getLastColumn(), 12)).getDisplayValues();
  for (let i = 0; i < v.length; i++) {
    for (let j = 0; j < v[i].length; j++) {
      if (/^laporan minggu/i.test(String(v[i][j]).trim())) return i + 1;
    }
  }
  return 0;
}

function keluar(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
`;
