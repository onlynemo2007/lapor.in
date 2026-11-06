import { parseWeek, buildPayload, mergeWeek } from "/tmp/sheet.mjs";
import { setKeuangan } from "/tmp/store.mjs";

const hasil = [];
const cek = (nama, lulus, info = "") => {
  hasil.push({ nama, lulus });
  if (!lulus) console.log("  GAGAL:", nama, "→", info);
};

const bagianD = [
  "LAPORAN MINGGU I BULAN NOVEMBER 2026,,,,,,",
  ",,D,REALISASI KEUANGAN,,,,",
  "No,Kode,Uraian,Pagu,Realisasi,,",
  '1,032.12.01,"Perjalanan dinas",100000000,25000000,,',
  '2,032.12.02,"Sewa kendaraan",50000000,10000000,,',
  ",,Total,150000000,35000000,,",
].join("\n");

const w = parseWeek(bagianD, "1", "Nov I");
cek("bagian D terbaca", w.anggaran.length === 2, JSON.stringify(w.anggaran));
cek("kode & uraian", w.anggaran[0]?.kode === "032.12.01" && w.anggaran[0]?.uraian === "Perjalanan dinas", JSON.stringify(w.anggaran[0]));
cek("pagu & realisasi angka", w.anggaran[0]?.pagu === 100000000 && w.anggaran[0]?.realisasi === 25000000, JSON.stringify(w.anggaran[0]));
cek("nomor baris sheet tercatat", w.anggaran[0]?.baris === 4 && w.anggaran[1]?.baris === 5, JSON.stringify(w.anggaran.map((a) => a.baris)));
cek("baris Total tidak ikut", w.anggaran.length === 2, String(w.anggaran.length));

/* versi lama: judul "Realisasi Anggaran" tanpa penanda D */
const lama = [
  "LAPORAN MINGGU I,,,,,,",
  "Realisasi Anggaran,,,,,,",
  ",Kode,Uraian,Pagu,Realisasi,,",
  ',032.12.03,"Konsumsi rapat",20000000,5000000,,',
].join("\n");
const w2 = parseWeek(lama, "1", "Nov I");
cek("judul lama tetap terbaca", w2.anggaran.length === 1 && w2.anggaran[0].kode === "032.12.03", JSON.stringify(w2.anggaran));

/* payload: hanya baris yang berubah */
const week = {
  ...w,
  gid: "1",
  dates: [],
  kegiatan: {},
  lampiran: {},
  rencana: {},
  presensi: {},
  aplikasi: {},
  dirty: { "R:032.12.02": true },
  meta: {},
};
const p = buildPayload(week, "tok", "Uji", true);
cek("hanya baris berubah yang dikirim", p.keuangan.length === 1 && p.keuangan[0].kode === "032.12.02", JSON.stringify(p.keuangan));
cek("nilai ikut terkirim", p.keuangan[0].pagu === 50000000 && p.keuangan[0].realisasi === 10000000, JSON.stringify(p.keuangan[0]));
const semua = buildPayload({ ...week, dirty: {} }, "tok", "Uji", false);
cek("kirim penuh memuat semua kode", semua.keuangan.length === 2, JSON.stringify(semua.keuangan));
cek("uraian ikut terkirim", semua.keuangan[0].uraian === "Perjalanan dinas", JSON.stringify(semua.keuangan[0]));

/* store: ubah satu baris */
const baru = setKeuangan(week, "032.12.02", { realisasi: 33000000 }, "Uji");
cek("realisasi berubah", baru.anggaran.find((a) => a.kode === "032.12.02").realisasi === 33000000, JSON.stringify(baru.anggaran));
cek("baris lain tetap", baru.anggaran.find((a) => a.kode === "032.12.01").realisasi === 25000000);
cek("ditandai belum terkirim", baru.dirty["R:032.12.02"] === true, JSON.stringify(baru.dirty));
cek("kode tak dikenal diabaikan", setKeuangan(week, "999", { pagu: 1 }, "Uji") === week);

/* pembacaan ulang sheet tidak boleh menimpa realisasi yang belum terkirim */
const ulang = parseWeek(bagianD, "1", "Nov I");
/* ---- lampiran manual di sheet tidak hilang saat aplikasi membaca ulang ---- */
{
  const csvLamp = [
    "LAPORAN MINGGU I BULAN NOVEMBER 2026,,,,,,,,",
    ",,A,KEGIATAN TIM,,,,,,",
    "No,,Tim,Tanggal,Uraian,,,,,Link Bukti Dukung",
    ",,Humas,2 November 2026,,,,,,https://drive.google.com/file/d/MANUAL/view",
    ",,,3 November 2026,,,,,,",
  ].join("\n");
  const segar = parseWeek(csvLamp, "1", "Nov I");
  const lokal = {
    ...segar,
    lampiran: { "humas|": `2 November 2026: https://drive.google.com/file/d/LOKAL/view` },
    dirty: { "L:humas||2 november 2026": true },
    meta: { "L:humas|": { oleh: "Uji", at: 1, ganti: false } },
  };
  const g = mergeWeek(segar, lokal);
  cek("tautan manual di sheet tetap ada", g.lampiran["humas|"].includes("MANUAL"), g.lampiran["humas|"]);
  cek("isian aplikasi yang belum terkirim tetap ada", g.lampiran["humas|"].includes("LOKAL"), g.lampiran["humas|"]);

  const dihapus = {
    ...segar,
    lampiran: { "humas|": `3 November 2026: https://drive.google.com/file/d/BARU/view` },
    dirty: { "L:humas||2 november 2026": true },
    meta: { "L:humas|": { oleh: "Uji", at: 1, ganti: false }, "L:humas||2 november 2026": { oleh: "Uji", at: 1, ganti: true } },
  };
  const g2 = mergeWeek(segar, dihapus);
  cek("tautan yang sengaja dihapus tidak dihidupkan lagi", !g2.lampiran["humas|"].includes("MANUAL"), g2.lampiran["humas|"]);
}

const gabung = mergeWeek(ulang, baru);
cek("isian belum terkirim dipertahankan saat baca ulang", gabung.anggaran.find((a) => a.kode === "032.12.02").realisasi === 33000000, JSON.stringify(gabung.anggaran));
cek("baris lain mengikuti sheet", gabung.anggaran.find((a) => a.kode === "032.12.01").realisasi === 25000000, JSON.stringify(gabung.anggaran));
cek("nomor baris tetap dari sheet", gabung.anggaran.every((a) => typeof a.baris === "number"), JSON.stringify(gabung.anggaran));

const lulus = hasil.filter((h) => h.lulus).length;
console.log(`\n${lulus}/${hasil.length} uji keuangan (data) lulus`);
process.exit(lulus === hasil.length ? 0 : 1);
