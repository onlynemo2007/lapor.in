/* Uji logika koneksi Apps Script (murni, tanpa DOM):
   - koneksi tersimpan vs koneksi bawaan build
   - penanda "putus" dihormati
   - tautan siap pakai (#/sinkron?setup=…) dibaca & dibersihkan */
import {
  bacaKoneksiMentah,
  bersihkanTautan,
  dariTautan,
  koneksiBawaan,
  tautanSiapPakai,
  tentukanKoneksi,
} from "../src/lib/koneksi.ts";

const hasil = [];
const cek = (nama, lulus, info = "") => hasil.push({ nama, lulus, info });

const BAWAAN = { scriptUrl: "https://script.google.com/macros/s/BAWAAN/exec", token: "rahasia-bawaan" };
const lama = { scriptUrl: "https://script.google.com/macros/s/LAMA/exec", token: "rahasia-lama" };

/* ------------------------------- koneksiBawaan ------------------------------ */
cek("bawaan kosong → null", koneksiBawaan(null) === null);
cek("bawaan hanya URL → null", koneksiBawaan({ VITE_SCRIPT_URL: BAWAAN.scriptUrl }) === null);
cek("bawaan hanya token → null", koneksiBawaan({ VITE_TOKEN: BAWAAN.token }) === null);
const bawaan = koneksiBawaan({ VITE_SCRIPT_URL: `  ${BAWAAN.scriptUrl}  `, VITE_TOKEN: ` ${BAWAAN.token} ` });
cek("bawaan lengkap dipakai (spasi dirapikan)", !!bawaan && bawaan.scriptUrl === BAWAAN.scriptUrl && bawaan.token === BAWAAN.token, JSON.stringify(bawaan));

/* ------------------------------ bacaKoneksiMentah --------------------------- */
cek("localStorage kosong → null", bacaKoneksiMentah(null) === null);
cek("JSON rusak → null", bacaKoneksiMentah("{bukan json") === null);
const terbaca = bacaKoneksiMentah(JSON.stringify({ scriptUrl: lama.scriptUrl, token: lama.token, autoSync: false }));
cek(
  "koneksi tersimpan terbaca apa adanya",
  !!terbaca && terbaca.scriptUrl === lama.scriptUrl && terbaca.token === lama.token && terbaca.autoSync === false && terbaca.putus === false,
  JSON.stringify(terbaca),
);
cek("penanda putus terbaca", bacaKoneksiMentah(JSON.stringify({ scriptUrl: "", token: "", putus: true }))?.putus === true);

/* ------------------------------- tentukanKoneksi ---------------------------- */
const a = tentukanKoneksi(bacaKoneksiMentah(JSON.stringify(lama)), BAWAAN);
cek("perangkat tersambung → koneksi sendiri menang", a.scriptUrl === lama.scriptUrl && a.token === lama.token && a.dariBawaan === false, JSON.stringify(a));

const b = tentukanKoneksi(null, BAWAAN);
cek("perangkat baru → koneksi bawaan dipakai", b.scriptUrl === BAWAAN.scriptUrl && b.token === BAWAAN.token && b.dariBawaan === true, JSON.stringify(b));

const c = tentukanKoneksi(bacaKoneksiMentah(JSON.stringify({ scriptUrl: "", token: "", putus: true })), BAWAAN);
cek("perangkat yang sengaja diputus → tidak dipaksa tersambung", c.scriptUrl === "" && c.token === "" && c.dariBawaan === false, JSON.stringify(c));

const d = tentukanKoneksi(bacaKoneksiMentah(JSON.stringify({ scriptUrl: lama.scriptUrl, token: "" })), BAWAAN);
cek("token kosong di perangkat → pakai bawaan", d.scriptUrl === BAWAAN.scriptUrl && d.token === BAWAAN.token, JSON.stringify(d));

const e = tentukanKoneksi(null, null);
cek("tanpa simpanan & tanpa bawaan → kosong", e.scriptUrl === "" && e.token === "" && e.dariBawaan === false, JSON.stringify(e));

const f = tentukanKoneksi(bacaKoneksiMentah(JSON.stringify({ scriptUrl: "", token: "", autoSync: false })), null);
cek("autoSync tersimpan tetap dihormati", f.autoSync === false && f.scriptUrl === "", JSON.stringify(f));

/* --------------------------------- tautan ---------------------------------- */
const tautan = tautanSiapPakai("https://laporin-psi.vercel.app", "/", lama);
cek("tautan siap pakai berbentuk #/sinkron?setup=", tautan.includes("#/sinkron?setup="), tautan.slice(0, 60));

const balik = dariTautan(new URL(tautan).hash);
cek("tautan dibaca balik jadi URL + token", !!balik && balik.scriptUrl === lama.scriptUrl && balik.token === lama.token, JSON.stringify(balik));

cek("tanpa parameter setup → null", dariTautan("#/dashboard") === null);
const rusak = `#/sinkron?setup=${encodeURIComponent("%7Bbukan-base64%7D")}`;
cek("parameter setup rusak → null", dariTautan(rusak) === null);
const tanpaToken = `#/sinkron?setup=${encodeURIComponent(Buffer.from(encodeURIComponent(JSON.stringify({ u: lama.scriptUrl }))).toString("base64"))}`;
cek("tautan tanpa token → null", dariTautan(tanpaToken) === null);

cek("hash dibersihkan jadi #/sinkron", bersihkanTautan("#/sinkron?setup=abc") === "#/sinkron", bersihkanTautan("#/sinkron?setup=abc"));
cek("parameter lain dipertahankan", bersihkanTautan("#/dashboard?setup=abc&x=1") === "#/dashboard?x=1", bersihkanTautan("#/dashboard?setup=abc&x=1"));
cek("hash kosong → #/sinkron", bersihkanTautan("") === "#/sinkron", bersihkanTautan(""));

let gagal = 0;
hasil.forEach((h) => {
  if (!h.lulus) gagal += 1;
  console.log(`${h.lulus ? "✔" : "✘"} ${h.nama}${h.lulus || !h.info ? "" : ` — ${h.info}`}`);
});
console.log(`\n${hasil.length - gagal}/${hasil.length} cek lulus`);
process.exit(gagal ? 1 : 0);
