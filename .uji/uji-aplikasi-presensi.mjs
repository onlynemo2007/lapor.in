import { parseWeek, parseTabelAplikasi, buildPayload } from "/tmp/sheet.mjs";
import { setSelKeuangan } from "/tmp/store.mjs";

const hasil = [];
const cek = (nama, lulus, info = "") => {
  hasil.push({ nama, lulus });
  if (!lulus) console.log("  GAGAL:", nama, "→", info);
};

/* tabel penggunaan aplikasi presensi yang berisi NAMA pegawai (bukan per tanggal) */
const CSV = [
  "LAPORAN MINGGU I BULAN NOVEMBER 2026,,,,,,,",
  ",,A,KEGIATAN TIM,,,,",
  "No,,Tim,Tanggal,Uraian,,,",
  ',,Humas,2 November 2026,"a1",,,',
  ",,C,REKAPITULASI KEHADIRAN,,,,",
  "No,,Tanggal,Kehadiran,Tidak Masuk,Dinas Luar,Cuti,,",
  ",,2 November 2026,50,,,1,,",
  ",,,,,,,",
  "Rekapitulasi Penggunaan Aplikasi Presensi,,,,,,,",
  "No,Nama Pegawai,Sikepo,e-Presensi,Finger Print,Tidak Presensi,Cuti/DL,",
  "1,Budi Santoso,5,5,4,,1,",
  "2,Siti Aminah,5,4,4,1,,",
  "3,Agus Salim,,5,5,,,",
].join("\n");

const w = parseWeek(CSV, "1", "Nov I");

cek("tabel aplikasi presensi terbaca", !!w.aplikasiTabel, JSON.stringify(Object.keys(w)));
const t = w.aplikasiTabel;
cek("kolom mengikuti sheet", !!t && t.kolom.map((k) => k.label).join("|") === "No|Nama Pegawai|Sikepo|e-Presensi|Finger Print|Tidak Presensi|Cuti/DL", JSON.stringify(t?.kolom));
cek("baris tabel terbaca semua", !!t && t.baris.length === 3, JSON.stringify(t?.baris.map((r) => r.nomor)));
cek("nama pegawai terbaca", !!t && t.baris.map((r) => r.sel[1]).join("|") === "Budi Santoso|Siti Aminah|Agus Salim", JSON.stringify(t?.baris.map((r) => r.sel)));
cek("angka penggunaan terbaca", !!t && t.baris[0].sel[2] === "5" && t.baris[1].sel[5] === "1", JSON.stringify(t?.baris[0].sel));
cek("judul tabel diambil dari baris di atasnya", !!t && /Rekapitulasi Penggunaan Aplikasi Presensi/i.test(t.judul), t?.judul);

/* tabel per tanggal seperti sebelumnya tetap terbaca sebagai aplikasi per tanggal */
const CSV2 = [
  "LAPORAN MINGGU I BULAN NOVEMBER 2026,,,,,,,",
  ",,C,REKAPITULASI KEHADIRAN,,,,",
  "No,,Tanggal,Kehadiran,Tidak Masuk,Dinas Luar,Cuti,,",
  ",,2 November 2026,50,,,1,,",
  "Rekapitulasi Penggunaan Aplikasi Presensi,,,,,,,",
  "Tanggal,Sikepo,ePresensi,Finger Print,Tidak Presensi,Cuti/DL,,",
  "2 November 2026,55,54,50,2,3,,",
  "3 November 2026,56,56,55,0,1,,",
].join("\n");
const w2 = parseWeek(CSV2, "1", "Nov I");
cek("tabel per tanggal tetap terpakai", w2.aplikasi["2 november 2026"]?.sikepo === 55, JSON.stringify(w2.aplikasi));
cek("tabel apa adanya juga tersedia", !!w2.aplikasiTabel && w2.aplikasiTabel.baris.length === 2, JSON.stringify(w2.aplikasiTabel?.baris.length));

/* sel tabel aplikasi presensi ikut terkirim sebagai `sel` dengan pengaman label */
const w3 = setSelKeuangan(w, 11, 2, "6", "Uji");
const p = buildPayload(w3, "tok", "Uji", true);
const sel = p.sel.find((x) => x.baris === 11 && x.kolom === 2);
cek("sel aplikasi presensi masuk payload", !!sel && sel.nilai === "6", JSON.stringify(p.sel));
cek("payload membawa label baris tabel presensi", !!sel && sel.label === "1" && sel.labelKolom === 0, JSON.stringify(sel));

/* parser tabel aplikasi berdiri sendiri */
const t2 = parseTabelAplikasi(CSV.split("\n").map((r) => r.split(",")));
cek("parseTabelAplikasi bisa dipakai terpisah", !!t2 && t2.baris.length === 3, JSON.stringify(t2?.judul));

const lulus = hasil.filter((h) => h.lulus).length;
console.log(`\n${lulus}/${hasil.length} uji aplikasi presensi lulus`);
process.exit(lulus === hasil.length ? 0 : 1);
