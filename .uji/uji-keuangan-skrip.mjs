import { readFileSync } from "node:fs";
import { lingkunganDari, GID } from "./fixture-lamp.mjs";

const kode = readFileSync("/tmp/kode.js", "utf8");
const hasil = [];
const cek = (nama, lulus, info = "") => {
  hasil.push({ nama, lulus });
  if (!lulus) console.log("  GAGAL:", nama, "→", info);
};

const api = (env) =>
  new Function("SpreadsheetApp", "LockService", "ContentService", `${kode}\nreturn { doPost: doPost, TOKEN: TOKEN, VERSI: VERSI };`)(
    env.SpreadsheetApp,
    env.LockService,
    env.ContentService,
  );
const post = (a, isi) => JSON.parse(a.doPost({ postData: { contents: JSON.stringify(isi) } }).getContent());

/* ---- tab dengan bagian D (realisasi keuangan) ---- */
function isiTab() {
  const g = [];
  const isi = (row, col, val) => {
    while (g.length < row) g.push([]);
    const r = g[row - 1];
    while (r.length < col) r.push("");
    r[col - 1] = val;
  };
  isi(1, 1, "LAPORAN MINGGU I BULAN NOVEMBER 2026");
  isi(2, 3, "D");
  isi(2, 4, "REALISASI KEUANGAN");
  isi(3, 1, "No");
  isi(3, 2, "Kode");
  isi(3, 3, "Uraian");
  isi(3, 4, "Pagu");
  isi(3, 5, "Realisasi");
  isi(4, 1, 1);
  isi(4, 2, "032.12.01");
  isi(4, 3, "Perjalanan dinas");
  isi(4, 4, 100000000);
  isi(4, 5, 25000000);
  isi(5, 1, 2);
  isi(5, 2, "032.12.02");
  isi(5, 3, "Sewa kendaraan");
  isi(5, 4, 50000000);
  isi(5, 5, 10000000);
  isi(6, 2, "Total");
  isi(6, 4, 150000000);
  isi(6, 5, 35000000);
  return g;
}

{
  const env = lingkunganDari(isiTab());
  const a = api(env);
  cek("versi skrip 1.7", a.VERSI === "1.7", a.VERSI);

  const r = post(a, {
    token: a.TOKEN,
    gid: GID,
    keuangan: [
      { kode: "032.12.02", uraian: "Sewa kendaraan", pagu: 50000000, realisasi: 27500000 },
      { kode: "032.12.01", uraian: "Perjalanan dinas", pagu: 100000000, realisasi: 40000000 },
    ],
  });
  cek("kiriman diterima", r.ok === true && r.gagal.length === 0, JSON.stringify(r));
  cek("realisasi kode 032.12.02 masuk baris 5", env.sumber.get(5, 5) === 27500000, String(env.sumber.get(5, 5)));
  cek("pagu kode 032.12.02 tidak berubah", env.sumber.get(5, 4) === 50000000, String(env.sumber.get(5, 4)));
  cek("realisasi kode 032.12.01 masuk baris 4", env.sumber.get(4, 5) === 40000000, String(env.sumber.get(4, 5)));
  cek("nilai ditulis sebagai angka", typeof env.sumber.get(4, 5) === "number", typeof env.sumber.get(4, 5));
  cek("uraian & kode tetap", env.sumber.get(4, 2) === "032.12.01" && env.sumber.get(4, 3) === "Perjalanan dinas", JSON.stringify([env.sumber.get(4, 2), env.sumber.get(4, 3)]));
  cek("baris total tidak disentuh", env.sumber.get(6, 5) === 35000000, String(env.sumber.get(6, 5)));

  /* kode tak dikenal → dilaporkan gagal, bukan menulis ke baris salah */
  const r2 = post(a, { token: a.TOKEN, gid: GID, keuangan: [{ kode: "999.99", uraian: "X", pagu: 1, realisasi: 2 }] });
  cek("kode tak dikenal dilaporkan gagal", r2.ok === true && r2.gagal.length === 1 && /999\.99/.test(r2.gagal[0]), JSON.stringify(r2));
  cek("tidak ada baris tertimpa", env.sumber.get(4, 5) === 40000000 && env.sumber.get(5, 5) === 27500000, JSON.stringify([env.sumber.get(4, 5), env.sumber.get(5, 5)]));

  /* angka berbentuk teks ("1.250.000") tetap diterima */
  post(a, { token: a.TOKEN, gid: GID, keuangan: [{ kode: "032.12.01", uraian: "Perjalanan dinas", pagu: "100.000.000", realisasi: "12.500.000" }] });
  cek("nilai teks berformat rupiah dinormalkan", env.sumber.get(4, 5) === 12500000, String(env.sumber.get(4, 5)));
}

const lulus = hasil.filter((h) => h.lulus).length;
console.log(`\n${lulus}/${hasil.length} uji keuangan (skrip) lulus`);
process.exit(lulus === hasil.length ? 0 : 1);
