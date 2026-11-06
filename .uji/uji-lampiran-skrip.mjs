import { readFileSync } from "node:fs";
import { lingkungan, GID, LAMA } from "./fixture-lamp.mjs";

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

const A = "https://drive.google.com/file/d/AAA/view";
const B = "https://drive.google.com/file/d/BBB/view";
const C = "https://drive.google.com/file/d/CCC/view";

const kirim = (a, url, extra = {}) =>
  post(a, { token: a.TOKEN, gid: GID, lampiran: [{ tim: "keuangan", sub: "", url, ...extra }] });

/* 1. skrip lama (isi sel sudah ada) + tambah tautan tanggal lain */
{
  const env = lingkungan(`2 November 2026: ${LAMA}`);
  const a = api(env);
  cek("versi skrip 1.5", a.VERSI === "1.5", a.VERSI);

  const r = kirim(a, `3 November 2026: ${A}`, { gabung: true });
  const sel = String(env.sumber.get(4, 11));
  cek("kiriman diterima", r.ok === true && r.ditulis >= 1 && r.gagal.length === 0, JSON.stringify(r));
  cek("tautan lama TIDAK hilang", sel.includes(LAMA), sel);
  cek("tautan baru masuk dengan tanggalnya", sel.includes(`3 November 2026: ${A}`), sel);
  cek("dua baris berurutan", sel.split("\n").length === 2, sel);

  /* 2. tambah lagi tanpa properti gabung (default = gabung) */
  const r2 = kirim(a, `4 November 2026: ${B}`);
  const sel2 = String(env.sumber.get(4, 11));
  cek("default tetap menggabung", sel2.includes(LAMA) && sel2.includes(A) && sel2.includes(B), sel2);
  cek("tiga baris", sel2.split("\n").length === 3, sel2);
  cek("balasan kedua ok", r2.ok === true);

  /* 3. kirim ulang tautan yang sama → tidak dobel */
  kirim(a, `4 November 2026: ${B}`);
  const sel3 = String(env.sumber.get(4, 11));
  cek("tidak ada duplikat", sel3.split("\n").filter((b) => b.includes(B)).length === 1, sel3);

  /* 4. gabung:false (user menghapus tautan) → sel diganti persis */
  const r4 = kirim(a, `4 November 2026: ${C}`, { gabung: false });
  const sel4 = String(env.sumber.get(4, 11));
  cek("gabung:false menimpa sesuai daftar", sel4 === `4 November 2026: ${C}`, sel4);
  cek("gabung:false ok", r4.ok === true);
}

/* 5. sel kosong + data lama tanpa tanggal */
{
  const env = lingkungan(`1. ${LAMA}\n2. ${A}`);
  const a = api(env);
  kirim(a, `5 November 2026: ${B}`, { gabung: true });
  const sel = String(env.sumber.get(4, 11));
  cek("format lama bernomor tetap ada", sel.includes(LAMA) && sel.includes(A), sel);
  cek("tautan baru bertanggal ditambahkan", sel.includes(`5 November 2026: ${B}`), sel);
  cek("total tiga baris", sel.split("\n").length === 3, sel);
}

/* 6. entri lama tanpa tanggal diberi tanggal bila tautannya sama */
{
  const env = lingkungan(`1. ${LAMA}`);
  const a = api(env);
  kirim(a, `2 November 2026: ${LAMA}`, { gabung: true });
  const sel = String(env.sumber.get(4, 11));
  cek("tautan sama tidak digandakan, tanggalnya dilengkapi", sel === `2 November 2026: ${LAMA}`, sel);
}

/* 7. buatTab v1.5 tetap bekerja & isian lampiran dikosongkan */
{
  const env = lingkungan(`2 November 2026: ${LAMA}`);
  const a = api(env);
  const r = post(a, { token: a.TOKEN, aksi: "buatTab", sumberGid: GID, nama: "Nov II", geserHari: 7 });
  const baru = env.ss.getSheetByName("Nov II");
  cek("buatTab ok", r.ok === true && !!baru, JSON.stringify(r));
  cek("tab baru: uraian kosong", String(baru.get(4, 5)).trim() === "");
  cek("tab baru: sel link dikosongkan", String(baru.get(4, 11)).trim() === "", String(baru.get(4, 11)));
  cek("tab baru: nama tim tetap", baru.get(4, 3) === "Keuangan");
  cek("tab baru: tanggal +7", baru.get(4, 4) === "9 November 2026", String(baru.get(4, 4)));
  cek("tab sumber tidak berubah", String(env.sumber.get(4, 11)).includes(LAMA));
}

const lulus = hasil.filter((h) => h.lulus).length;
console.log(`\n${lulus}/${hasil.length} uji skrip lulus`);
process.exit(lulus === hasil.length ? 0 : 1);
