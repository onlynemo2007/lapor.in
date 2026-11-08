import { readFileSync } from "node:fs";
import { csv, grid } from "./fixture-besar.mjs";
import { parseWeek, parseTabelKeuangan } from "/tmp/sheet.mjs";
import { lingkunganDari, GID } from "./fixture-lamp.mjs";

const kode = readFileSync("/tmp/kode.js", "utf8");

const hasil = [];
const cek = (nama, lulus, info = "") => {
  hasil.push({ nama, lulus });
  if (!lulus) console.log("  GAGAL:", nama, "→", info);
};

const w = parseWeek(csv(), "1", "Nov I");

/* --- judul bagian tidak lagi dibajak baris data --- */
cek("judul bagian A benar", w.judulKegiatan === "KEGIATAN TIM", w.judulKegiatan);
cek("judul bagian B & C benar", w.judulRencana === "RENCANA KEGIATAN TIM" && w.judulPresensi === "REKAPITULASI KEHADIRAN", JSON.stringify([w.judulRencana, w.judulPresensi]));
cek("kegiatan terbaca", w.dates.length === 3 && (w.kegiatan["humas||2 november 2026"] ?? []).length === 1, JSON.stringify(w.dates));

/* --- sumber pagu/realisasi = tabel "Realisasi Anggaran" --- */
cek("judul tabel sumber", w.anggaranJudul === "Realisasi Anggaran", w.anggaranJudul);
cek("23-24 baris dari tabel itu", w.anggaran.length === 24, String(w.anggaran.length));
cek("baris pertama 104", w.anggaran[0]?.baris === 104, JSON.stringify(w.anggaran[0]));
cek("baris terakhir 127", w.anggaran[w.anggaran.length - 1]?.baris === 127, String(w.anggaran[w.anggaran.length - 1]?.baris));
cek("rentang baris dilaporkan", w.anggaranBaris?.dari === 104 && w.anggaranBaris?.sampai === 127, JSON.stringify(w.anggaranBaris));
const total = w.anggaran.reduce((t, a) => t + a.pagu, 0);
cek("total pagu hanya dari tabel itu", total === Array.from({ length: 24 }, (_, i) => 10000000 * (i + 1)).reduce((a, b) => a + b, 0), String(total));
cek("realisasi ikut terbaca (bukan nol semua)", w.anggaran.reduce((t, a) => t + a.realisasi, 0) === 750000000, String(w.anggaran.reduce((t, a) => t + a.realisasi, 0)));
cek("baris Total tidak dihitung", !w.anggaran.some((a) => /^total$/i.test(a.kode)), JSON.stringify(w.anggaran.map((a) => a.kode).slice(-2)));

/* --- tabel kode lain tetap tampil apa adanya (bisa diisi) --- */
const judulTabel = w.tabelKeuangan.map((t) => t.judul);
cek("tabel kode lain ikut tampil", judulTabel.includes("Sisa Di Rekening"), JSON.stringify(judulTabel));
cek("tabel sumber tidak diduplikasi", !judulTabel.includes("Realisasi Anggaran"), JSON.stringify(judulTabel));
const sisa = w.tabelKeuangan.find((t) => t.judul === "Sisa Di Rekening");
cek("kolom tabel sesuai sheet", sisa?.kolom.map((k) => k.label).join("|") === "No|Kode|Uraian|Pagu|Realisasi", JSON.stringify(sisa?.kolom));
cek("baris tabel sesuai sheet", sisa?.baris.length === 1 && sisa.baris[0].sel[3] === "1500000000", JSON.stringify(sisa?.baris));

/* --- baris panjang ber-kata kunci tidak boleh memecah tabel jadi dua --- */
{
  const baris = [
    ["Rekapitulasi UP"],
    ["No", "Uraian", "Pagu", "Pengeluaran", "Sisa"],
    ["1", "UP Kartu Kredit Pemerintah", "", "", "80000000"],
    ["2", "UP Tunai", "", "0,00", "120000000"],
    ["a", "Sisa Di Rekening", "95865159", "0,00", ""],
    ["b", "Tunai", "24134841", "0,00", ""],
    ["B2", "PEMBAYARAN PUMK DUKMAN MELALUI TUNAI", "", "", ""],
    ["b3", "Pembayaran PUMK Teknis Melalui Tunai", "", "", ""],
    ["Jumlah", "", "", "", ""],
    [],
    ["Pembayaran Melalui LS"],
    ["No", "Uraian", "Nilai", "Keterangan"],
    ["1", "Honor narasumber", "15000000", "Lunas"],
  ];
  const t = parseTabelKeuangan(baris);
  cek("tabel tidak terpecah dua", t.length === 2, JSON.stringify(t.map((x) => [x.judul, x.baris.length])));
  cek("baris panjang tetap di tabel UP", t[0].baris.length === 7, JSON.stringify(t[0]?.baris.map((b) => b.label)));
  cek("baris panjang tidak jadi judul kolom", t[0].kolom.length === 5, JSON.stringify(t[0]?.kolom.map((k) => k.label)));
  cek("tabel berikutnya tetap terpisah", t[1].judul === "Pembayaran Melalui LS" && t[1].baris.length === 1, JSON.stringify(t[1]?.judul));
}

/* --- skrip menulis ke baris yang dikirim aplikasi (bukan tabel lain) --- */
{
  const env = lingkunganDari(grid());
  const api = new Function("SpreadsheetApp", "LockService", "ContentService", "PropertiesService", "CacheService", `${kode}\nreturn { doPost: doPost, TOKEN: TOKEN };`)(
    env.SpreadsheetApp,
    env.LockService,
    env.ContentService,
    env.PropertiesService,
    env.CacheService,
  );
  // Skrip v2.2 mewajibkan nama pengisi ("oleh").
  const post = (isi) => JSON.parse(api.doPost({ postData: { contents: JSON.stringify({ oleh: "Uji", ...isi }) } }).getContent());

  const r = post({
    token: api.TOKEN,
    gid: GID,
    keuangan: [
      { kode: "032.12.05", uraian: "Belanja 5", pagu: 50000000, realisasi: 12500000, baris: 108 },
      { kode: "900.02", uraian: "Kas di bendahara", pagu: 1500000000, realisasi: 750000000, baris: 26 },
    ],
  });
  cek("dua baris ditulis tanpa gagal", r.ok === true && r.gagal.length === 0, JSON.stringify(r));
  cek("baris 108 ditulis di tabel Realisasi Anggaran", env.sumber.get(108, 4) === 50000000 && env.sumber.get(108, 5) === 12500000, JSON.stringify([env.sumber.get(108, 4), env.sumber.get(108, 5)]));
  cek("baris 26 ditulis di tabel lain", env.sumber.get(26, 4) === 1500000000, String(env.sumber.get(26, 4)));
  cek("baris tabel lain tidak tersentuh", env.sumber.get(22, 4) === 9000000000, String(env.sumber.get(22, 4)));

  // baris kiriman sudah bergeser (kode tidak cocok) → kembali memakai pencocokan kode
  const r2 = post({ token: api.TOKEN, gid: GID, keuangan: [{ kode: "032.12.07", uraian: "Belanja 7", pagu: 70000000, realisasi: 17500000, baris: 26 }] });
  cek("baris bergeser tetap ditulis ke kode yang benar", r2.gagal.length === 0 && env.sumber.get(110, 4) === 70000000, JSON.stringify(r2));
  cek("baris salah tidak ditimpa", env.sumber.get(26, 5) === 750000000, String(env.sumber.get(26, 5)));
}

const lulus = hasil.filter((h) => h.lulus).length;
console.log(`\n${lulus}/${hasil.length} uji layout besar lulus`);
process.exit(lulus === hasil.length ? 0 : 1);
