import * as M from "/tmp/model.mjs";

const hasil = [];
const cek = (nama, lulus, info = "") => {
  hasil.push({ nama, lulus });
  if (!lulus) console.log("  GAGAL:", nama, "→", info);
};

const A = "https://drive.google.com/file/d/AAA/view";
const B = "https://drive.google.com/file/d/BBB/view";
const C = "https://drive.google.com/file/d/CCC/view";

/* parse */
const p1 = M.parseLampiran(`2 November 2026: ${A}\n3 November 2026: ${B}`);
cek("parse 2 entri bertanggal", p1.length === 2 && p1[0].tanggal === "2 November 2026" && p1[1].url === B, JSON.stringify(p1));
const p2 = M.parseLampiran(`1. ${A}\n2. ${B}`);
cek("parse format lama bernomor (tanpa tanggal)", p2.length === 2 && p2.every((e) => e.tanggal === ""), JSON.stringify(p2));
const p3 = M.parseLampiran(`${A} ${B}`);
cek("parse dua tautan satu baris", p3.length === 2);
const p4 = M.parseLampiran(`2 november 2026 - ${A}`);
cek("parse tanggal huruf kecil + tanda hubung", p4.length === 1 && p4[0].tanggal === "2 November 2026", JSON.stringify(p4));
const p5 = M.parseLampiran(`2 November 2026: ${A}\n2 November 2026: ${A}`);
cek("parse buang duplikat", p5.length === 1);

/* susun */
cek("susun bertanggal", M.susunLampiran([{ tanggal: "2 November 2026", url: A }, { tanggal: "", url: B }]) === `2 November 2026: ${A}\n${B}`);

/* ganti per tanggal */
const isi = `2 November 2026: ${A}\n3 November 2026: ${B}`;
const g1 = M.gantiLampiranTanggal(isi, "3 November 2026", [C]);
cek("ganti tanggal 3 tidak menyentuh tanggal 2", g1.includes(A) && !g1.includes(B) && g1.includes(C), g1);
const g2 = M.gantiLampiranTanggal(isi, "2 november 2026", [A]);
cek("ganti dengan tanggal huruf kecil tetap dikenali", g2.includes(B) && g2.split("\n").length === 2, g2);

/* tambah */
const t1 = M.tambahLampiranTanggal(isi, "2 November 2026", [C]);
cek("tambah ke tanggal 2 menyimpan semuanya", t1.includes(A) && t1.includes(B) && t1.includes(C) && t1.split("\n").length === 3, t1);
const t2 = M.tambahLampiranTanggal(`1. ${A}`, "2 November 2026", [B]);
cek("data lama tanpa tanggal tetap dipertahankan", t2.includes(A) && t2.includes(B), t2);

/* ambil per tanggal */
const u = M.lampiranTanggal(isi, "2 November 2026");
cek("ambil tautan satu tanggal", u.length === 1 && u[0] === A, JSON.stringify(u));

/* sama / normalisasi */
cek("samaLampiran abaikan format", M.samaLampiran(`2 November 2026: ${A}`, `2 NOVEMBER 2026 - ${A}`));
cek("samaLampiran beda tanggal → beda", !M.samaLampiran(`2 November 2026: ${A}`, `3 November 2026: ${A}`));
cek("normalisasiLampiran menata ulang", M.normalisasiLampiran(`1. ${A}\n2. ${B}`) === `${A}\n${B}`);
cek("normalisasiLampiran pertahankan teks bukan tautan", M.normalisasiLampiran("lihat folder drive") === "lihat folder drive");

/* huruf kolom */
cek("huruf kolom 9 = J, 10 = K", M.hurufKolom(9) === "J" && M.hurufKolom(10) === "K" && M.hurufKolom(26) === "AA", M.hurufKolom(26));

const lulus = hasil.filter((h) => h.lulus).length;
console.log(`\n${lulus}/${hasil.length} uji model lulus`);
process.exit(lulus === hasil.length ? 0 : 1);
