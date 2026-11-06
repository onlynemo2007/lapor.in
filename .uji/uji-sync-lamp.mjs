import { buildPayload } from "/tmp/sheet.mjs";
import { siapkanKiriman, tandaiTerkirim } from "/tmp/sync.mjs";

const hasil = [];
const cek = (nama, lulus, info = "") => {
  hasil.push({ nama, lulus });
  if (!lulus) console.log("  GAGAL:", nama, "→", info);
};

const A = "https://drive.google.com/file/d/AAA/view";
const B = "https://drive.google.com/file/d/BBB/view";
const at = 111;

const minggu = () => ({
  gid: "1",
  tab: "Nov I",
  cols: {},
  judul: "Nov I",
  judulKegiatan: "",
  judulRencana: "",
  judulPresensi: "",
  dates: ["3 November 2025", "4 November 2025"],
  kegiatan: {},
  lampiran: { "humas|": `3 November 2025: ${A}\n4 November 2025: ${B}` },
  rencana: {},
  presensi: {},
  aplikasi: {},
  anggaran: [],
  rows: { A: {}, L: {}, B: {}, C: {}, P: {} },
  dirty: { "L:humas|": true },
  meta: {
    "L:humas|": { oleh: "Uji", at, ganti: false },
    "L:humas||3 november 2025": { oleh: "Uji", at: 222, ganti: true },
    "L:humas||4 november 2025": { oleh: "Uji", at: 222, ganti: false },
  },
  importedAt: 0,
});

const w = minggu();
const k = siapkanKiriman(w, "tok", "Uji");
cek("kiriman disiapkan", !!k && k.payload.lampiran.length === 2, JSON.stringify(k?.payload.lampiran));
const l3 = k.payload.lampiran.find((x) => x.tanggal === "3 november 2025");
const l4 = k.payload.lampiran.find((x) => x.tanggal === "4 november 2025");
cek("tanggal 3 dikirim sebagai ganti", l3.gabung === false && l3.url.includes(A), JSON.stringify(l3));
cek("tanggal 4 dikirim menambah", l4.gabung === true && l4.url.includes(B), JSON.stringify(l4));
cek("payload memuat tanggal", k.payload.lampiran.every((x) => !!x.tanggal), JSON.stringify(k.payload.lampiran));

const sesudah = tandaiTerkirim(w, k, 12345);
cek("dirty dibersihkan", Object.keys(sesudah.dirty).length === 0, JSON.stringify(sesudah.dirty));
cek("'ganti' dimatikan setelah terkirim", sesudah.meta["L:humas||3 november 2025"]?.ganti === false, JSON.stringify(sesudah.meta));
const p2 = buildPayload({ ...sesudah, dirty: { "L:humas|": true } }, "tok", "Uji", true);
cek("kiriman berikutnya kembali menambah", p2.lampiran.find((x) => x.tanggal === "3 november 2025")?.gabung === true, JSON.stringify(p2.lampiran));

/* tanggal yang tautannya dihapus: url kosong + gabung:false → baris itu saja yang dikosongkan */
const wHapus = minggu();
wHapus.lampiran = { "humas|": `4 November 2025: ${B}` };
const kHapus = siapkanKiriman(wHapus, "tok", "Uji");
const h3 = kHapus.payload.lampiran.find((x) => x.tanggal === "3 november 2025");
cek("tanggal yang dihapus dikirim kosong", h3 && h3.url === "" && h3.gabung === false, JSON.stringify(kHapus.payload.lampiran));
cek("tanggal lain tidak ikut dikosongkan", kHapus.payload.lampiran.find((x) => x.tanggal === "4 november 2025")?.gabung === true, JSON.stringify(kHapus.payload.lampiran));

const lulus = hasil.filter((h) => h.lulus).length;
console.log(`\n${lulus}/${hasil.length} uji sinkron lulus`);
process.exit(lulus === hasil.length ? 0 : 1);
