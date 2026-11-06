/** Spreadsheet tiruan: kolom A..L, tim di D, tanggal E, uraian F..J, link K (merge per blok tim). */
export const GID = "1192874962";
export const LAMA = "https://drive.google.com/file/d/LAMA/view";

const tanggal = ["2 November 2026", "3 November 2026", "4 November 2026", "5 November 2026", "6 November 2026"];

export function grid(linkSel) {
  const g = [];
  const isi = (row, col, val) => {
    while (g.length < row) g.push([]);
    const r = g[row - 1];
    while (r.length < col) r.push("");
    r[col - 1] = val;
  };
  isi(1, 1, "LAPORAN MINGGU I BULAN NOVEMBER 2026");
  isi(2, 3, "A");
  isi(2, 4, "KEGIATAN TIM");
  isi(3, 1, "No");
  isi(3, 3, "Tim");
  isi(3, 4, "Tanggal");
  isi(3, 5, "Uraian");
  isi(3, 11, "Link Bukti Dukung");
  ["Keuangan", "Umum"].forEach((t, ti) => {
    tanggal.forEach((d, di) => {
      const row = 4 + ti * 5 + di;
      if (di === 0) isi(row, 3, t);
      isi(row, 4, d);
    });
    // satu sel per blok tim (seperti merge): isi hanya di baris pertama
    if (ti === 0) isi(4, 11, linkSel);
  });
  return g;
}

let urut = 5000;
const display = (v) => (v instanceof Date ? v.toISOString() : v == null ? "" : String(v));
const kolomAngka = (h) => [...h].reduce((n, c) => n * 26 + (c.charCodeAt(0) - 64), 0);

class R {
  constructor(sh, r, c, nr = 1, nc = 1) { this.sh = sh; this.r = r; this.c = c; this.nr = nr; this.nc = nc; }
  getRow() { return this.r; }
  getColumn() { return this.c; }
  getNumRows() { return this.nr; }
  getNumColumns() { return this.nc; }
  /** gabungan (merge) yang memuat sel ini */
  getMergedRanges() {
    return this.sh.merges
      .filter((m) => this.r >= m.r1 && this.r <= m.r2 && this.c >= m.c1 && this.c <= m.c2)
      .map((m) => this.sh.getRange(m.r1, m.c1, m.r2 - m.r1 + 1, m.c2 - m.c1 + 1));
  }
  /** lepas gabungan; isi tetap di sel kiri-atas */
  breakApart() {
    const sh = this.sh;
    sh.merges = sh.merges.filter((m) => !(this.r <= m.r1 && this.c <= m.c1 && this.r + this.nr - 1 >= m.r2 && this.c + this.nc - 1 >= m.c2));
    return this;
  }
  getValue() { return this.sh.get(this.r, this.c); }
  getDisplayValue() { return display(this.sh.get(this.r, this.c)); }
  setValue(v) { this.sh.set(this.r, this.c, v); return this; }
  clearContent() { for (let i = 0; i < this.nr; i++) for (let j = 0; j < this.nc; j++) this.sh.set(this.r + i, this.c + j, ""); return this; }
  getValues() { const o = []; for (let i = 0; i < this.nr; i++) { const row = []; for (let j = 0; j < this.nc; j++) row.push(this.sh.get(this.r + i, this.c + j)); o.push(row); } return o; }
  setValues(m) { m.forEach((row, i) => row.forEach((v, j) => this.sh.set(this.r + i, this.c + j, v))); return this; }
  getDisplayValues() { return this.getValues().map((row) => row.map(display)); }
}

export class Sheet {
  constructor(ss, name, g) { this.ss = ss; this.name = name; this.grid = g.map((r) => [...r]); this.id = ++urut; this.hidden = false; this.merges = []; }
  merge(r1, c1, r2, c2) { this.merges.push({ r1, c1, r2, c2 }); return this; }
  getName() { return this.name; }
  getSheetId() { return this.id; }
  isSheetHidden() { return this.hidden; }
  showSheet() { this.hidden = false; return this; }
  setName(n) { this.name = n; return this; }
  getIndex() { return this.ss.sheets.indexOf(this) + 1; }
  getParent() { return this.ss; }
  appendRow(row) { const r = this.getLastRow() + 1; row.forEach((v, j) => this.set(r, j + 1, v)); }
  get(row, col) { const r = this.grid[row - 1]; return r && r[col - 1] !== undefined ? r[col - 1] : ""; }
  set(row, col, v) {
    while (this.grid.length < row) this.grid.push([]);
    const r = this.grid[row - 1];
    while (r.length < col) r.push("");
    r[col - 1] = v;
  }
  getLastRow() { for (let i = this.grid.length - 1; i >= 0; i--) if ((this.grid[i] ?? []).some((x) => display(x) !== "")) return i + 1; return 0; }
  getLastColumn() { let n = 0; this.grid.forEach((r) => r.forEach((x, j) => { if (display(x) !== "") n = Math.max(n, j + 1); })); return n; }
  getDataRange() { return new R(this, 1, 1, this.getLastRow(), this.getLastColumn()); }
  getRange(a, b, c, d) {
    if (typeof a === "string") {
      const m = a.match(/^([A-Z]+)(\d+)$/);
      return new R(this, Number(m[2]), kolomAngka(m[1]));
    }
    return new R(this, a, b, c ?? 1, d ?? 1);
  }
  getRangeList(list) { const sh = this; return { clearContent() { list.forEach((a1) => sh.getRange(a1).clearContent()); } }; }
  copyTo(ss) { const b = new Sheet(ss, `Copy of ${this.name}`, this.grid); ss.sheets.push(b); return b; }
}

class SS {
  constructor() { this.sheets = []; this.aktif = null; }
  getName() { return "Laporan Mingguan"; }
  getSheets() { return this.sheets; }
  getSheetByName(n) { return this.sheets.find((s) => s.name === n) ?? null; }
  insertSheet(n) { const s = new Sheet(this, n, []); this.sheets.push(s); return s; }
  setActiveSheet(s) { this.aktif = s; return s; }
  moveActiveSheet(pos) { const i = this.sheets.indexOf(this.aktif); if (i < 0) return; this.sheets.splice(i, 1); this.sheets.splice(Math.max(0, pos - 1), 0, this.aktif); }
}

/** Lingkungan dengan isi tab bebas (dipakai untuk uji bagian lain, mis. realisasi keuangan). */
export function lingkunganDari(isiGrid, nama = "Nov I") {
  const ss = new SS();
  const sumber = new Sheet(ss, nama, isiGrid);
  sumber.id = Number(GID);
  const audit = new Sheet(ss, "_audit", []);
  audit.hidden = true;
  ss.sheets.push(sumber, audit);
  ss.aktif = sumber;
  return {
    ss, sumber,
    SpreadsheetApp: { getActiveSpreadsheet: () => ss },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
    ContentService: { MimeType: { JSON: "json" }, createTextOutput: (s) => ({ setMimeType() { return this; }, getContent: () => s }) },
  };
}

export function lingkungan(linkSel) {
  const ss = new SS();
  const sumber = new Sheet(ss, "Nov I", grid(linkSel));
  sumber.id = Number(GID);
  const audit = new Sheet(ss, "_audit", []);
  audit.hidden = true;
  ss.sheets.push(sumber, audit);
  ss.aktif = sumber;
  return {
    ss, sumber,
    SpreadsheetApp: { getActiveSpreadsheet: () => ss },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
    ContentService: { MimeType: { JSON: "json" }, createTextOutput: (s) => ({ setMimeType() { return this; }, getContent: () => s }) },
  };
}
