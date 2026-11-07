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


/* ---------- tabel presensi seperti di sheet: judul kolom dua baris & isi teks ---------- */
{
  const CSV3 = [
    "LAPORAN MINGGU I BULAN NOVEMBER 2026,,,,,,,",
    ",,C,REKAPITULASI KEHADIRAN,,,,",
    "No,,Tanggal,Kehadiran,Tidak Masuk,Dinas Luar,Cuti,,",
    ",,2 November 2026,51,,,1,,",
    ",,,,,,,",
    "Rekapitulasi Penggunaan Aplikasi Presensi,,,,,,,",
    "No,Tanggal,Presensi Menggunakan Aplikasi,,,Tidak Presensi,Cuti/DL,",
    ",,Sikepo,Epresensi,Finger Print,,,,",
    "1,2 November 2026,51 pegawai,1 pegawai : Fatryandi (Absen pagi dan sore),1 pegawai : M. Akhirudin,1 pegawai : Firdaus (tidak absen sore rapat di GMB),3 Pegawai : Cuti : 3 Pegawai,",
    '2,3 November 2026,51 pegawai,"2 pegawai : Fatryandi (Absen pagi dan sore)\n\nCandra (absen sore)",-,4 pegawai : Sri Yuni Astuti (Tidak absen pagi),4 Pegawai : Cuti : 2 Pegawai,',
  ].join("\n");

  const w3 = parseWeek(CSV3, "1", "Nov I");
  const t3 = w3.aplikasiTabel;
  cek("judul kolom dua baris terbaca", !!t3 && t3.kolom.map((k) => k.label).join("|") === "No|Tanggal|Sikepo|Epresensi|Finger Print|Tidak Presensi|Cuti/DL", JSON.stringify(t3?.kolom));
  cek("kelompok kolom diisi", !!t3 && t3.kolom[2].kelompok === "Presensi Menggunakan Aplikasi" && t3.kolom[4].kelompok === "Presensi Menggunakan Aplikasi", JSON.stringify(t3?.kolom));
  cek("kolom No/Tanggal tidak punya kelompok", !!t3 && !t3.kolom[0].kelompok && !t3.kolom[5].kelompok, JSON.stringify(t3?.kolom));
  cek("baris tanggal terbaca", !!t3 && t3.baris.length === 2 && t3.baris[0].nomor === 9, JSON.stringify(t3?.baris.map((r) => r.nomor)));
  cek("isi teks apa adanya", !!t3 && t3.baris[0].sel[2] === "51 pegawai" && /Fatryandi/.test(t3.baris[0].sel[3]), JSON.stringify(t3?.baris[0].sel));
  cek("teks multi-baris utuh", !!t3 && /Candra \(absen sore\)/.test(t3.baris[1].sel[3]), JSON.stringify(t3?.baris[1].sel[3]));
  cek("judul tabel dua baris benar", !!t3 && /Rekapitulasi Penggunaan Aplikasi Presensi/.test(t3.judul), t3?.judul);
  cek("baris judul kolom menunjuk baris atas", !!t3 && t3.header === 7, String(t3?.header));

  /* angka tebakan dari teks tidak boleh menimpa sel teks */
  const w4 = { ...w3, dirty: { ...w3.dirty, "P:2 november 2026": true } };
  const p4 = buildPayload(w4, "tok", "Uji", true);
  cek("tidak ada kiriman angka presensi saat tabel teks", p4.aplikasi.length === 0, JSON.stringify(p4.aplikasi));
}

const lulus = hasil.filter((h) => h.lulus).length;
console.log(`\n${lulus}/${hasil.length} uji aplikasi presensi lulus`);
process.exit(lulus === hasil.length ? 0 : 1);
