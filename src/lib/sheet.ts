import {
  type Anggaran,
  type Aplikasi,
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
  parseAngka,
  parsePegawai,
  slotKey,
  splitUraian,
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
const isLink = (s: string) => /https?:\/\//i.test(s);

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
    rows: { A: {}, L: {}, B: {}, C: {}, P: {} },
    dirty: {},
    meta: {},
    importedAt: Date.now(),
  };

  let sec = "";
  let tim: string | null = null;
  let sub = "";
  let lampFound = false;
  const firstRow: Record<string, number> = {};
  const lampRaw: Record<string, string[]> = {};
  const cList: { tgl: string; row: number; r: string[] }[] = [];
  const pList: { tgl: string; row: number; r: string[] }[] = [];

  rows.forEach((r, i) => {
    const sheetRow = i + 1;
    const cell = (j: number) => (r[j] ?? "").trim();

    if (r.some((x) => /^LAPORAN MINGGU/i.test(x.trim()))) w.judul = r.find((x) => /^LAPORAN MINGGU/i.test(x.trim()))!.trim().replace(/\s+/g, " ");

    // penanda bagian: "A" | "B" | "C" | "D" diikuti judul
    for (let j = 0; j < 4; j++) {
      if (["A", "B", "C", "D"].includes(cell(j)) && cell(j + 1)) {
        sec = cell(j);
        if (sec === "A") w.judulKegiatan = cell(j + 1);
        if (sec === "B") w.judulRencana = cell(j + 1);
        if (sec === "C") w.judulPresensi = cell(j + 1);
        tim = null;
        sub = "";
        return;
      }
    }
    if (r.some((x) => /^Rekapitulasi Penggunaan Aplikasi Presensi/i.test(x.trim()))) return void (sec = "P");
    if (r.some((x) => /^Realisasi Anggaran/i.test(x.trim()))) return void (sec = "R");

    /* ---- baris judul kolom ---- */
    if (sec === "A") {
      const t = has(r, (x) => x === "tim"), g = has(r, (x) => x.startsWith("tanggal")), u = has(r, (x) => x.startsWith("uraian"));
      if (t >= 0 && g >= 0 && u >= 0) {
        Object.assign(c, { tim: t, tgl: g, ur: u });
        if (!lampFound) c.lamp = u + 5;
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
    if (sec === "R") {
      const k = has(r, (x) => x === "kode"), p = has(r, (x) => x === "pagu");
      if (k >= 0 && p >= 0) {
        const u = has(r, (x) => x.startsWith("uraian")), re = has(r, (x) => x === "realisasi");
        Object.assign(c, { rKode: k, rPagu: p, rUr: u >= 0 ? u : k + 1, rReal: re >= 0 ? re : p + 1 });
        return;
      }
    }

    /* ---- baris data ---- */
    if (sec === "A") {
      const T = cell(c.tim), G = cell(c.tgl);
      if (T && norm(T) !== "tim") {
        tim = timIdDari(T);
        sub = "";
      }
      if (!tim) return;
      if (/^(program|monev)$/i.test(G)) {
        sub = G[0].toUpperCase() + G.slice(1).toLowerCase();
      }
      // tautan lampiran: kolom setelah uraian yang berisi URL
      for (let j = c.ur + 1; j < r.length; j++) {
        if (isLink(r[j])) {
          if (!lampFound) {
            c.lamp = j;
            lampFound = true;
          }
          const lk = lampKey(tim, sub);
          (lampRaw[lk] ??= []).push(r[j].trim());
          break;
        }
      }
      if (tim === "program" && !sub && isTanggal(G)) sub = "Program";
      if (isTanggal(G)) {
        const tgl = cleanDate(G);
        if (!w.dates.some((x) => norm(x) === norm(tgl))) w.dates.push(tgl);
        const k = slotKey(tim, sub, tgl);
        w.rows.A[k] = sheetRow;
        const items = splitUraian(r[c.ur] ?? "");
        if (items.length) w.kegiatan[k] = items;
        const lk = lampKey(tim, sub);
        if (!(lk in firstRow)) firstRow[lk] = sheetRow;
      }
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
    } else if (sec === "R") {
      const kode = cell(c.rKode), ur = cell(c.rUr);
      if (kode && ur && norm(kode) !== "kode" && cell(c.rPagu)) {
        const a: Anggaran = { kode, uraian: ur, pagu: parseAngka(cell(c.rPagu)), realisasi: parseAngka(cell(c.rReal)) };
        if (a.pagu > 0) w.anggaran.push(a);
      }
    }
  });

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
    if (cat === "L") pick(local.lampiran, out.lampiran);
    if (cat === "B") pick(local.rencana, out.rencana);
    if (cat === "C") pick(local.presensi, out.presensi);
    if (cat === "P") pick(local.aplikasi, out.aplikasi);
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
  lampiran: { tim: string; sub: string; url: string }[];
  rencana: { tim: string; uraian: string }[];
  presensi: { tanggal: string; idx: number; nilai: string[] }[];
  aplikasi: { tanggal: string; idx: number; nilai: string[] }[];
};

export function buildPayload(w: WeekData, token: string, oleh: string, hanyaBerubah: boolean): Payload {
  const inc = (k: string) => !hanyaBerubah || !!w.dirty[k];
  const p: Payload = { token, gid: w.gid, oleh, kegiatan: [], lampiran: [], rencana: [], presensi: [], aplikasi: [] };

  SLOT_ROWS.forEach(({ tim, sub }) => {
    w.dates.forEach((d) => {
      const k = slotKey(tim.id, sub, d);
      const items = w.kegiatan[k] ?? [];
      if (inc(`A:${k}`) && (items.length || hanyaBerubah))
        p.kegiatan.push({ tim: tim.id, sub: norm(sub), tanggal: norm(d), uraian: joinUraian(items) });
    });
    const lk = lampKey(tim.id, sub);
    if (inc(`L:${lk}`) && (w.lampiran[lk] || hanyaBerubah))
      p.lampiran.push({ tim: tim.id, sub: norm(sub), url: w.lampiran[lk] ?? "" });
  });
  TIMS.forEach((t) => {
    const items = w.rencana[t.id] ?? [];
    if (inc(`B:${t.id}`) && (items.length || hanyaBerubah)) p.rencana.push({ tim: t.id, uraian: joinUraian(items) });
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
  p.kegiatan.length + p.lampiran.length + p.rencana.length + p.presensi.length + p.aplikasi.length;

export type ScriptResult = { ok: boolean; ditulis?: number; gagal?: string[]; error?: string; verified: boolean };

export async function kirimKeScript(url: string, payload: Payload): Promise<ScriptResult> {
  const body = JSON.stringify(payload);
  try {
    const res = await fetch(url, { method: "POST", body, redirect: "follow" });
    const data = await res.json();
    return { ...data, verified: true };
  } catch {
    // Fallback: kirim tanpa membaca balasan (beberapa browser memblokir redirect Apps Script)
    await fetch(url, { method: "POST", body, mode: "no-cors" });
    return { ok: true, verified: false };
  }
}

export async function tesScript(url: string): Promise<{ ok: boolean; nama?: string; tabs?: { name: string; gid: string }[]; versi?: string }> {
  const res = await fetch(`${url}${url.includes("?") ? "&" : "?"}aksi=ping`, { redirect: "follow" });
  return res.json();
}

export const APPS_SCRIPT = `/**
 * Lapor.in — jembatan tulis ke "Laporan Mingguan Tim Dukman"
 * Pasang: buka spreadsheet → Ekstensi → Apps Script → tempel seluruh kode ini.
 * Deploy: Terapkan → Deployment baru → Jenis: Aplikasi web
 *         Jalankan sebagai: Saya · Yang memiliki akses: Siapa saja
 * Posisi kolom dibaca dari baris judul (No/Tim/Tanggal/Uraian, Kehadiran, Sikepo…),
 * jadi tetap aman bila ada kolom/baris yang disisipkan.
 */
const TOKEN = 'GANTI-DENGAN-KODE-RAHASIA'; // samakan dengan isian di aplikasi
const VERSI = '1.2';

function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return keluar({
    ok: true, versi: VERSI, nama: ss.getName(),
    tabs: ss.getSheets().filter(s => !s.isSheetHidden())
      .map(s => ({ name: s.getName(), gid: String(s.getSheetId()) }))
  });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const d = JSON.parse(e.postData.contents);
    if (d.token !== TOKEN) return keluar({ ok: false, error: 'Token tidak cocok.' });
    const sh = SpreadsheetApp.getActiveSpreadsheet().getSheets()
      .find(s => String(s.getSheetId()) === String(d.gid));
    if (!sh) return keluar({ ok: false, error: 'Tab dengan gid ' + d.gid + ' tidak ditemukan.' });

    const m = petakan(sh), k = m.col;
    let n = 0; const gagal = [];
    const tulis = (row, cols, vals, label) => {
      if (!row) { gagal.push(label); return; }
      cols.forEach((c, i) => sh.getRange(row, c + 1).setValue(vals[i]));
      n++;
    };

    (d.kegiatan || []).forEach(x => tulis(m.A[x.tim + '|' + x.sub + '|' + x.tanggal], [k.ur], [x.uraian], 'kegiatan ' + x.tim + ' ' + x.tanggal));
    (d.lampiran || []).forEach(x => tulis(m.L[x.tim + '|' + x.sub], [k.lamp], [x.url], 'lampiran ' + x.tim));
    (d.rencana  || []).forEach(x => tulis(m.B[x.tim], [k.bUr], [x.uraian], 'rencana ' + x.tim));
    (d.presensi || []).forEach(x => tulis(m.C[x.tanggal] || m.Cidx[x.idx], [k.cHadir, k.cTk, k.cDl, k.cCuti], x.nilai, 'presensi ' + x.tanggal));
    (d.aplikasi || []).forEach(x => tulis(m.P[x.tanggal] || m.Pidx[x.idx], [k.pSikepo, k.pEp, k.pFp, k.pTidak, k.pCutiDl], x.nilai, 'aplikasi ' + x.tanggal));

    catat(sh, d.oleh, n);
    return keluar({ ok: true, ditulis: n, gagal: gagal });
  } catch (err) {
    return keluar({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

/** Membaca struktur tab: bagian A–C, posisi kolom, tim, sub (Program/Monev), dan tanggal. */
function petakan(sh) {
  const v = sh.getDataRange().getDisplayValues();
  const m = { A: {}, L: {}, B: {}, C: {}, P: {}, Cidx: [], Pidx: [],
    col: { tim: 2, tgl: 3, ur: 4, lamp: 9, bTim: 2, bUr: 3, cTgl: 2, cHadir: 3, cTk: 4, cDl: 5, cCuti: 6,
           pTgl: 2, pSikepo: 3, pEp: 4, pFp: 5, pTidak: 6, pCutiDl: 7 } };
  const c = m.col;
  const tglRe = /^\\d{1,2} (januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember) \\d{4}$/;
  const n = s => String(s || '').toLowerCase().replace(/\\s+/g, ' ').trim();
  const cari = (r, f) => r.findIndex(x => f(n(x)));
  const timDari = s => n(s).split(' ')[0];
  let sec = '', tim = '', sub = '', lampFound = false;

  for (let i = 0; i < v.length; i++) {
    const r = v[i], row = i + 1, cell = j => String(r[j] || '').trim();
    let marker = false;
    for (let j = 0; j < 4; j++) {
      if (['A', 'B', 'C', 'D'].indexOf(cell(j)) >= 0 && cell(j + 1)) { sec = cell(j); tim = ''; sub = ''; marker = true; break; }
    }
    if (marker) continue;
    if (r.some(x => /^rekapitulasi penggunaan aplikasi presensi/i.test(String(x).trim()))) { sec = 'P'; continue; }
    if (r.some(x => /^realisasi anggaran/i.test(String(x).trim()))) { sec = 'R'; continue; }

    if (sec === 'A') {
      const t = cari(r, x => x === 'tim'), g = cari(r, x => x.indexOf('tanggal') === 0), u = cari(r, x => x.indexOf('uraian') === 0);
      if (t >= 0 && g >= 0 && u >= 0) { c.tim = t; c.tgl = g; c.ur = u; if (!lampFound) c.lamp = u + 5; continue; }
      const T = cell(c.tim), G = n(cell(c.tgl));
      if (T && n(T) !== 'tim') { tim = timDari(T); sub = ''; }
      if (!tim) continue;
      if (G === 'program' || G === 'monev') sub = G;
      for (let j = c.ur + 1; j < r.length; j++) {
        if (/https?:\\/\\//i.test(r[j])) { if (!lampFound) { c.lamp = j; lampFound = true; } break; }
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

function catat(sh, oleh, n) {
  const ss = sh.getParent();
  let log = ss.getSheetByName('_audit');
  if (!log) { log = ss.insertSheet('_audit'); log.appendRow(['Waktu', 'Oleh', 'Tab', 'Jumlah']); log.hideSheet(); }
  log.appendRow([new Date(), oleh || '-', sh.getName(), n + ' sel']);
}

function keluar(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
`;
