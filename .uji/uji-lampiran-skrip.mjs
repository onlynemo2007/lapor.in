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

/* baris tim Keuangan = 4..8 (2,3,4,5,6 November 2026) */
const R2 = 4, R3 = 5, R4 = 6, R5 = 7, R6 = 8;

const kirim = (a, tanggal, url, extra = {}) =>
  post(a, { token: a.TOKEN, gid: GID, lampiran: [{ tim: "keuangan", sub: "", tanggal, url, ...extra }] });

const A = "https://drive.google.com/file/d/AAA/view";
const B = "https://drive.google.com/file/d/BBB/view";
const C = "https://drive.google.com/file/d/CCC/view";
const D = "https://drive.google.com/file/d/DDD/view";

/* ---------- 1. dasar: tiap tanggal ditulis di barisnya sendiri (tanpa merge) ---------- */
{
  const env = lingkungan("");
  const a = api(env);
  cek("versi skrip 1.6", a.VERSI === "1.6", a.VERSI);

  const r = kirim(a, "3 november 2026", `3 November 2026: ${A}`, { gabung: true });
  cek("kiriman diterima", r.ok === true && r.ditulis >= 1 && r.gagal.length === 0, JSON.stringify(r));
  cek("tautan masuk baris tanggal 3", String(env.sumber.get(R3, 11)).includes(A), String(env.sumber.get(R3, 11)));
  cek("baris tanggal 2 tetap kosong", String(env.sumber.get(R2, 11)) === "", String(env.sumber.get(R2, 11)));

  /* dua tautan di tanggal yang sama → dua baris teks di sel yang sama */
  kirim(a, "3 november 2026", `3 November 2026: ${B}`);
  const sel3 = String(env.sumber.get(R3, 11));
  cek("dua tautan satu tanggal di baris yang sama", sel3.split("\n").length === 2 && sel3.includes(A) && sel3.includes(B), sel3);

  /* tanggal lain → baris lain, tidak menimpa */
  kirim(a, "4 november 2026", `4 November 2026: ${C}`);
  cek("tautan tanggal 4 di barisnya sendiri", String(env.sumber.get(R4, 11)).includes(C), String(env.sumber.get(R4, 11)));
  cek("baris tanggal 3 tidak berubah", String(env.sumber.get(R3, 11)) === sel3, String(env.sumber.get(R3, 11)));

  /* hapus tautan tanggal 3 saja (gabung:false) → hanya baris itu yang berubah */
  const r4 = kirim(a, "3 november 2026", "", { gabung: false });
  cek("gabung:false mengosongkan baris tanggal 3", String(env.sumber.get(R3, 11)) === "", String(env.sumber.get(R3, 11)));
  cek("baris tanggal 4 tetap", String(env.sumber.get(R4, 11)).includes(C), String(env.sumber.get(R4, 11)));
  cek("balasan ok", r4.ok === true);

  /* kiriman ulang tidak menimbulkan duplikat */
  kirim(a, "4 november 2026", `4 November 2026: ${C}`);
  cek("tidak ada duplikat", String(env.sumber.get(R4, 11)).split("\n").filter((b) => b.includes(C)).length === 1, String(env.sumber.get(R4, 11)));
}

/* ---------- 2. sel gabungan (merge) seperti di sheet user: dipecah & disebar ---------- */
{
  const lump = `2 November 2026: ${LAMA}\n2 November 2026: ${A}\n4 November 2026: ${B}`;
  const env = lingkungan(lump);
  env.sumber.merge(R2, 11, R2 + 4, 11); // K4:K8 satu blok tim
  const a = api(env);

  kirim(a, "3 november 2026", `3 November 2026: ${D}`, { gabung: true });

  const ambil = (r) => String(env.sumber.get(r, 11));
  cek("merge kolom lampiran dibuka", env.sumber.merges.length === 0, JSON.stringify(env.sumber.merges));
  cek("tautan 3 Nov masuk baris tanggal 3", ambil(R3).includes(D) && ambil(R3).split("\n").length === 1, ambil(R3));
  cek("tautan 2 Nov lama tetap & pindah ke baris tanggal 2", ambil(R2).includes(LAMA) && ambil(R2).includes(A), ambil(R2));
  cek("tautan 4 Nov lama pindah ke baris tanggal 4", ambil(R4).includes(B), ambil(R4));
  cek("baris lain tidak diisi", ambil(R4) === `4 November 2026: ${B}` && ambil(R5) === "" && ambil(R6) === "", JSON.stringify([ambil(R4), ambil(R5), ambil(R6)]));

  /* kirim ulang → idempotent */
  kirim(a, "3 november 2026", `3 November 2026: ${D}`, { gabung: true });
  cek("idempotent setelah penyebaran", ambil(R3) === `3 November 2026: ${D}`, ambil(R3));
}

/* ---------- 3. format lama tanpa tanggal pada sel gabungan: tetap di baris atas ---------- */
{
  const env = lingkungan(`1. ${LAMA}\n2. ${A}`);
  env.sumber.merge(R2, 11, R2 + 4, 11);
  const a = api(env);
  kirim(a, "5 november 2026", `5 November 2026: ${B}`);
  const ambil = (r) => String(env.sumber.get(r, 11));
  cek("tautan tanpa tanggal tetap ada di baris atas", ambil(R2).includes(LAMA) && ambil(R2).includes(A), ambil(R2));
  cek("tautan baru di baris tanggal 5", ambil(R5).includes(B), ambil(R5));
}

/* ---------- 4. aplikasi lama (tanpa tanggal) tetap jalan: pakai baris pertama tim ---------- */
{
  const env = lingkungan("");
  const a = api(env);
  const r = post(a, { token: a.TOKEN, gid: GID, lampiran: [{ tim: "keuangan", sub: "", url: `${A}`, gabung: true }] });
  cek("payload tanpa tanggal ditulis di baris pertama tim", String(env.sumber.get(R2, 11)).includes(A) && r.ok === true, String(env.sumber.get(R2, 11)));
}

/* ---------- 5. buatTab v1.6 tetap benar ---------- */
{
  const env = lingkungan(`2 November 2026: ${LAMA}`);
  const a = api(env);
  const r = post(a, { token: a.TOKEN, aksi: "buatTab", sumberGid: GID, nama: "Nov II", geserHari: 7 });
  const baru = env.ss.getSheetByName("Nov II");
  cek("buatTab ok", r.ok === true && !!baru, JSON.stringify(r));
  cek("tab baru: sel link dikosongkan", String(baru.get(4, 11)).trim() === "", String(baru.get(4, 11)));
  cek("tab baru: nama tim tetap", baru.get(4, 3) === "Keuangan");
  cek("tab baru: tanggal +7", baru.get(4, 4) === "9 November 2026", String(baru.get(4, 4)));
  cek("tab sumber tidak berubah", String(env.sumber.get(4, 11)).includes(LAMA));
}

const lulus = hasil.filter((h) => h.lulus).length;
console.log(`\n${lulus}/${hasil.length} uji skrip lulus`);
process.exit(lulus === hasil.length ? 0 : 1);
