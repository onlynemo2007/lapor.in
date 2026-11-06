import { parseCSV, parseWeek } from "/tmp/sheet.mjs";

const A = "https://drive.google.com/file/d/AAA/view";
const B = "https://drive.google.com/file/d/BBB/view";
const hasil = [];
const cek = (nama, lulus, info = "") => {
  hasil.push({ nama, lulus });
  if (!lulus) console.log("  GAGAL:", nama, "→", info);
};

const sel = `2 November 2026: ${A}\n3 November 2026: ${B}`;
const csv = [
  "LAPORAN MINGGU I BULAN NOVEMBER 2026,,,,,,,,",
  ",,A,KEGIATAN TIM,,,,,,",
  "No,,Tim,Tanggal,Uraian,,,,,Link Bukti Dukung",
  `,,Humas,2 November 2026,"Satu butir",,,,,${`"${sel.replace(/"/g, '""')}"`}`,
  ",,,3 November 2026,,,,,,",
  ",,B,RENCANA KEGIATAN TIM,,,,,,",
  "No,,Tim,Uraian,,,,,,",
  ",,Humas,,,,,,,",
  ",,C,REKAPITULASI KEHADIRAN,,,,,,",
  "No,,Tanggal,Kehadiran,Tidak Masuk,Dinas Luar,Cuti,,,",
  ",,2 November 2026,,,,,,",
].join("\n");

const rows = parseCSV(csv);
cek("sel multi-baris dibaca sebagai satu sel", rows[3][9] === sel, JSON.stringify(rows[3][9]));
cek("baris berikutnya tidak bergeser", rows[4][3] === "3 November 2026", JSON.stringify(rows[4]));

const w = parseWeek(csv, "1", "Nov I");
const lamp = w.lampiran["humas|"] ?? "";
cek("dua tautan terbaca", lamp.includes(A) && lamp.includes(B), lamp);
cek("penanda tanggal utuh", lamp.includes("2 November 2026") && lamp.includes("3 November 2026"), lamp);
cek("uraian tetap di barisnya", (w.kegiatan["humas||2 november 2026"] ?? []).join(" ") === "Satu butir", JSON.stringify(w.kegiatan));
cek("tanggal minggu utuh", w.dates.length === 2, JSON.stringify(w.dates));

const lulus = hasil.filter((h) => h.lulus).length;
console.log(`\n${lulus}/${hasil.length} uji parse lulus`);
process.exit(lulus === hasil.length ? 0 : 1);
