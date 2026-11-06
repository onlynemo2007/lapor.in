import { readFileSync } from "node:fs";
import { lingkunganDari, GID } from "./fixture-lamp.mjs";
import { grid, csv } from "./fixture-keuangan.mjs";
import { parseWeek, buildPayload, mergeWeek, acuanSisip, payloadSisip } from "/tmp/sheet.mjs";
import { setSelKeuangan } from "/tmp/store.mjs";

const kode = readFileSync("/tmp/kode.js", "utf8");
const hasil = [];
const cek = (nama, lulus, info = "") => {
  hasil.push({ nama, lulus });
  if (!lulus) console.log("  GAGAL:", nama, "→", info);
};

/* ---------------- baca tabel ---------------- */
const w = parseWeek(csv(), "1", "Nov I");
const judul = w.tabelKeuangan.map((t) => t.judul);
cek("tiga tabel generik terbaca", w.tabelKeuangan.length === 3, JSON.stringify(judul));
cek("judul sesuai sheet", judul.includes("Rekapitulasi UP") && judul.includes("Pembayaran Melalui LS") && judul.includes("Rencana Penarikan"), JSON.stringify(judul));
cek("tabel anggaran tidak diduplikasi", !judul.some((j) => /^realisasi anggaran$/i.test(j)), JSON.stringify(judul));
cek("tabel anggaran tetap terbaca terstruktur", w.anggaran.length === 2 && w.anggaran[0].kode === "032.12.01", JSON.stringify(w.anggaran));

const up = w.tabelKeuangan.find((t) => t.judul === "Rekapitulasi UP");
cek("kolom UP", up.kolom.map((k) => k.label).join("|") === "No|Uraian|Pagu|Realisasi|Sisa", JSON.stringify(up?.kolom));
cek("baris UP", up.baris.length === 2 && up.baris[0].nomor === 5, JSON.stringify(up?.baris.map((b) => b.nomor)));
cek("nilai sel UP", up.baris[0].sel[3] === "20000000" && up.baris[1].sel[1] === "UP Februari", JSON.stringify(up.baris[0].sel));
const ls = w.tabelKeuangan.find((t) => t.judul === "Pembayaran Melalui LS");
cek("kolom LS", ls.kolom.map((k) => k.label).join("|") === "No|Uraian|Nilai|Keterangan", JSON.stringify(ls?.kolom));
const rp = w.tabelKeuangan.find((t) => t.judul === "Rencana Penarikan");
cek("kolom Rencana Penarikan", rp.kolom.map((k) => k.label).join("|") === "Bulan|Jumlah|Keterangan", JSON.stringify(rp?.kolom));
cek("label baris + kolom label", rp.baris[0].label === "November" && rp.baris[0].labelKolom === 0, JSON.stringify(rp.baris[0]));

/* ---------------- penanda & judul kolom yang berbeda ---------------- */
{
  const v = parseWeek(csv().replace(",D,REALISASI KEUANGAN", ",D.,Realisasi Keuangan"), "1", "Nov I");
  cek("penanda bagian 'D.' dikenali", v.tabelKeuangan.length === 3 && v.anggaran.length === 2, JSON.stringify([v.tabelKeuangan.length, v.anggaran.length]));
}
{
  const v = parseWeek(csv().replace("Kode,Uraian,Pagu,Realisasi", "Kode Rekening,Uraian,Pagu,Realisasi"), "1", "Nov I");
  cek("judul 'Kode Rekening' dikenali", v.anggaran.length === 2 && v.anggaran[0].kode === "032.12.01", JSON.stringify(v.anggaran));
}

/* ---------------- payload ---------------- */
const w2 = setSelKeuangan(w, 6, 3, "12000000", "Uji");
const p = buildPayload(w2, "tok", "Uji", true);
cek("sel dikirim", p.sel.length === 1 && p.sel[0].baris === 6 && p.sel[0].kolom === 3, JSON.stringify(p.sel));
cek("nilai sel ikut", p.sel[0].nilai === "12000000", JSON.stringify(p.sel[0]));
cek("label baris sebagai pengaman", p.sel[0].label === "2" && p.sel[0].labelKolom === 0, JSON.stringify(p.sel[0]));
cek("tidak ada kiriman keuangan lain", p.keuangan.length === 0, JSON.stringify(p.keuangan));

/* ---------------- baca ulang tidak menimpa isian belum terkirim ---------------- */
const gabung = mergeWeek(parseWeek(csv(), "1", "Nov I"), w2);
cek("sel belum terkirim dipertahankan", gabung.selKeuangan["6:3"] === "12000000", JSON.stringify(gabung.selKeuangan));
const bersih = mergeWeek(parseWeek(csv(), "1", "Nov I"), { ...w2, dirty: {} });
cek("sel yang sudah terkirim mengikuti sheet", !("6:3" in bersih.selKeuangan), JSON.stringify(bersih.selKeuangan));

/* ---------------- skrip menulis sel ---------------- */
const api = (env) =>
  new Function("SpreadsheetApp", "LockService", "ContentService", `${kode}\nreturn { doPost: doPost, TOKEN: TOKEN, VERSI: VERSI };`)(
    env.SpreadsheetApp,
    env.LockService,
    env.ContentService,
  );
const post = (a, isi) => JSON.parse(a.doPost({ postData: { contents: JSON.stringify(isi) } }).getContent());

{
  const env = lingkunganDari(grid());
  const a = api(env);
  const r = post(a, {
    token: a.TOKEN,
    gid: GID,
    sel: [
      { baris: 6, kolom: 3, nilai: "12000000", label: "2", labelKolom: 0 },
      { baris: 10, kolom: 3, nilai: "Belum lunas", label: "1", labelKolom: 0 },
      { baris: 19, kolom: 1, nilai: "90000000", label: "November", labelKolom: 0 },
    ],
  });
  cek("tiga sel ditulis", r.ok === true && r.gagal.length === 0 && r.ditulis >= 3, JSON.stringify(r));
  cek("realisasi UP baris 6 ditulis", env.sumber.get(6, 4) === 12000000, String(env.sumber.get(6, 4)));
  cek("nilai angka disimpan sebagai angka", typeof env.sumber.get(6, 4) === "number", typeof env.sumber.get(6, 4));
  cek("teks keterangan LS ditulis", env.sumber.get(10, 4) === "Belum lunas", String(env.sumber.get(10, 4)));
  cek("jumlah rencana penarikan ditulis", env.sumber.get(19, 2) === 90000000, String(env.sumber.get(19, 2)));
  cek("baris lain tidak tersentuh", env.sumber.get(5, 4) === 20000000 && env.sumber.get(14, 4) === 25000000, JSON.stringify([env.sumber.get(5, 4), env.sumber.get(14, 4)]));

  /* label tidak cocok → ditolak (baris bergeser) */
  const r2 = post(a, { token: a.TOKEN, gid: GID, sel: [{ baris: 6, kolom: 4, nilai: "1", label: "99", labelKolom: 0 }] });
  cek("label tak cocok ditolak", r2.gagal.length === 1 && /bergeser/.test(r2.gagal[0]), JSON.stringify(r2));
  cek("sel tidak berubah", env.sumber.get(6, 5) === 40000000, String(env.sumber.get(6, 5)));

  /* tanpa label tetap boleh (kiriman lama) */
  const r3 = post(a, { token: a.TOKEN, gid: GID, sel: [{ baris: 5, kolom: 4, nilai: "70000000" }] });
  cek("tanpa label tetap ditulis", r3.gagal.length === 0 && env.sumber.get(5, 5) === 70000000, JSON.stringify(r3));
}


/* ---------- titik sisip baris baru (tambah baris tabel keuangan) ---------- */
{
  const teks = [
    "LAPORAN MINGGU I BULAN NOVEMBER 2026,,,,,,",
    ",,D,REALISASI KEUANGAN,,,,",
    "Rekapitulasi UP,,,,,,",
    "No,Uraian,Pagu,Realisasi,Sisa,,",
    "1,UP Januari,100000000,20000000,80000000,,",
    "2,UP Februari,50000000,10000000,40000000,,",
    "Jumlah,,150000000,30000000,120000000,,",
    ",,,,,,,",
    "Pembayaran Melalui LS,,,,,,",
    "No,Uraian,Nilai,Keterangan,,,",
    "1,Honor narasumber,15000000,Lunas,,,",
  ].join("\n");
  const w = parseWeek(teks, "1", "Nov I");
  const up = w.tabelKeuangan.find((t) => /Rekapitulasi UP/i.test(t.judul));
  const ls = w.tabelKeuangan.find((t) => /Pembayaran Melalui LS/i.test(t.judul));
  cek("tabel UP & LS terbaca", !!up && !!ls, JSON.stringify(w.tabelKeuangan.map((t) => t.judul)));
  const aUp = up ? acuanSisip(up) : null;
  cek("baris baru UP disisip sebelum baris Jumlah", !!aUp && aUp.baris === 7 && aUp.acuan === 7, JSON.stringify(aUp));
  cek("acuan UP membawa label 'Jumlah'", !!aUp && /jumlah/i.test(aUp.label ?? "") && aUp.labelKolom === 0, JSON.stringify(aUp));
  cek("kolom sisip mengikuti kolom tabel", !!aUp && aUp.kolom.join(",") === "0,1,2,3,4", JSON.stringify(aUp?.kolom));
  const aLs = ls ? acuanSisip(ls) : null;
  cek("tabel tanpa Jumlah: sisip setelah baris terakhir", !!aLs && aLs.baris === 12 && aLs.acuan === 11, JSON.stringify(aLs));
  const p = payloadSisip(w, "tok", "Uji", [{ judul: up?.judul, ...aUp, nilai: [] }]);
  cek("payload sisip hanya memuat sisip", p.sisip?.length === 1 && !p.kegiatan.length && !p.sel.length, JSON.stringify(p).slice(0, 160));
}


/* ---------- baris kosong di tengah tabel ikut ditampilkan ---------- */
{
  const teks = [
    "LAPORAN MINGGU I BULAN NOVEMBER 2026,,,,,,",
    ",,D,REALISASI KEUANGAN,,,,",
    "Rekapitulasi UP,,,,,,",
    "No,Uraian,Pagu,Realisasi,Sisa,,",
    "1,UP Januari,100000000,20000000,80000000,,",
    ",,,,,,,",
    "Jumlah,,100000000,20000000,80000000,,",
    ",,,,,,,",
    "Pembayaran Melalui LS,,,,,,",
    "No,Uraian,Nilai,Keterangan,,,",
    "1,Honor narasumber,15000000,Lunas,,,",
  ].join("\n");
  const w = parseWeek(teks, "1", "Nov I");
  const up = w.tabelKeuangan.find((t) => /Rekapitulasi UP/i.test(t.judul));
  const ls = w.tabelKeuangan.find((t) => /Pembayaran Melalui LS/i.test(t.judul));
  cek("baris kosong sebelum Jumlah ikut dibaca", !!up && up.baris.map((r) => r.nomor).join(",") === "5,6,7", JSON.stringify(up?.baris.map((r) => r.nomor)));
  cek("baris kosong tanpa label (bisa diisi)", !!up && up.baris[1].label === "" && Object.keys(up.baris[1].sel).length === 0, JSON.stringify(up?.baris[1]));
  cek("baris kosong penutup tabel tidak ikut", !!ls && ls.baris.length === 1, JSON.stringify(ls?.baris.map((r) => r.nomor)));
  cek("sisip pada tabel ber-Jumlah tetap sebelum Jumlah", !!up && acuanSisip(up).baris === 7, JSON.stringify(up && acuanSisip(up)));
}

const lulus = hasil.filter((h) => h.lulus).length;
console.log(`\n${lulus}/${hasil.length} uji tabel keuangan lulus`);
process.exit(lulus === hasil.length ? 0 : 1);
