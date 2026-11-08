/* Uji pengamanan Apps Script v2.2:
   - nama pengisi ("oleh") wajib
   - batas jumlah sel & frekuensi kiriman
   - minggu lama terkunci (baca-saja) + buka/kunci oleh admin
   - anti-timpa: isian yang selnya sudah diubah rekan tidak ditimpa */
import { readFileSync } from "node:fs";
import { lingkunganDari, Sheet, GID } from "./fixture-lamp.mjs";

const kode = readFileSync("/tmp/kode.js", "utf8");
const hasil = [];
const cek = (nama, lulus, info = "") => {
  hasil.push({ nama, lulus });
  if (!lulus) console.log("  GAGAL:", nama, "→", info);
};

const api = (env) =>
  new Function(
    "SpreadsheetApp",
    "LockService",
    "ContentService",
    "PropertiesService",
    "CacheService",
    `${kode}\nreturn { doPost: doPost, doGet: doGet, TOKEN: TOKEN, VERSI: VERSI };`,
  )(env.SpreadsheetApp, env.LockService, env.ContentService, env.PropertiesService, env.CacheService);

const post = (a, isi) => JSON.parse(a.doPost({ postData: { contents: JSON.stringify(isi) } }).getContent());
const get = (a, parameter) => JSON.parse(a.doGet({ parameter }).getContent());

/** Tab mingguan sederhana berisi bagian A (Tim/Tanggal/Uraian) dan B (rencana). */
function isiTab() {
  const g = [];
  const isi = (row, col, val) => {
    while (g.length < row) g.push([]);
    const r = g[row - 1];
    while (r.length < col) r.push("");
    r[col - 1] = val;
  };
  isi(1, 1, "LAPORAN MINGGU I BULAN NOVEMBER 2026");
  isi(2, 3, "A");
  isi(2, 4, "KEGIATAN TIM");
  isi(3, 1, "No");
  isi(3, 3, "Tim");
  isi(3, 4, "Tanggal");
  isi(3, 5, "Uraian");
  isi(3, 11, "Link Bukti Dukung");
  isi(4, 3, "Keuangan");
  isi(4, 4, "2 November 2026");
  isi(4, 5, "rapat internal");
  isi(6, 3, "B");
  isi(6, 4, "RENCANA KEGIATAN TIM");
  isi(7, 1, "No");
  isi(7, 3, "Tim");
  isi(7, 4, "Uraian");
  isi(8, 3, "Keuangan");
  isi(8, 4, "rencana lama");
  return g;
}

const BARIS_URAIAN = 4;
const BARIS_RENCANA = 8;
const KOL_URAIAN = 5;
const KOL_BUR = 4;

/* ------------------------- 1. nama pengisi wajib ------------------------- */
{
  const env = lingkunganDari(isiTab());
  const a = api(env);
  const tanpa = post(a, { token: a.TOKEN, gid: GID, kegiatan: [{ tim: "keuangan", sub: "", tanggal: "2 november 2026", uraian: "x" }] });
  cek("kiriman tanpa nama ditolak", tanpa.ok === false && /Nama pengisi wajib/.test(tanpa.error), JSON.stringify(tanpa));
  cek("sheet tidak berubah saat ditolak", String(env.sumber.get(BARIS_URAIAN, KOL_URAIAN)) === "rapat internal");
  const spasi = post(a, { token: a.TOKEN, oleh: "  ", gid: GID, kegiatan: [] });
  cek("nama hanya spasi ditolak", spasi.ok === false && /Nama pengisi wajib/.test(spasi.error), JSON.stringify(spasi));
  const benar = post(a, { token: a.TOKEN, oleh: "Rani", gid: GID, kegiatan: [{ tim: "keuangan", sub: "", tanggal: "2 november 2026", uraian: "rapat internal\nnotulen" }] });
  cek("kiriman bernama ditulis", benar.ok === true && String(env.sumber.get(BARIS_URAIAN, KOL_URAIAN)).includes("notulen"), JSON.stringify(benar));
}

/* --------------------- 2. batas jumlah sel per kiriman -------------------- */
{
  const env = lingkunganDari(isiTab());
  const a = api(env);
  const besar = post(a, {
    token: a.TOKEN,
    oleh: "Rani",
    gid: GID,
    kegiatan: Array.from({ length: 401 }, () => ({ tim: "keuangan", sub: "", tanggal: "2 november 2026", uraian: "x" })),
  });
  cek("kiriman > 400 sel ditolak", besar.ok === false && /terlalu besar/i.test(besar.error), JSON.stringify(besar).slice(0, 160));
  const wajar = post(a, {
    token: a.TOKEN,
    oleh: "Rani",
    gid: GID,
    kegiatan: [{ tim: "keuangan", sub: "", tanggal: "2 november 2026", uraian: "kecil" }],
  });
  cek("kiriman wajar tetap diterima", wajar.ok === true, JSON.stringify(wajar));
}

/* ------------------------- 3. batas frekuensi kirim ---------------------- */
{
  const env = lingkunganDari(isiTab());
  const a = api(env);
  let terakhir = null;
  for (let i = 0; i < 61; i++) {
    terakhir = post(a, { token: a.TOKEN, oleh: "Rani", gid: GID, kegiatan: [] });
  }
  cek("kiriman ke-61 dalam 5 menit ditolak", terakhir.ok === false && /Terlalu banyak kiriman/.test(terakhir.error), JSON.stringify(terakhir));
}

/* -------------------- 4. minggu lama terkunci (baca-saja) ---------------- */
{
  const env = lingkunganDari(isiTab());
  const lamaId = Number(GID);
  const baru = new Sheet(env.ss, "Nov II", isiTab());
  baru.id = 424242;
  baru.set(1, 1, "LAPORAN MINGGU II BULAN NOVEMBER 2026"); // judul menentukan minggu terbaru
  env.ss.sheets.splice(1, 0, baru);
  const a = api(env);

  const info = get(a, {});
  cek("ping membawa gid minggu terbaru", info.terbaru === String(baru.getSheetId()), JSON.stringify({ terbaru: info.terbaru }));
  cek("ping melaporkan PIN admin belum disetel", info.adaPin === false && Array.isArray(info.dibuka), JSON.stringify(info).slice(0, 120));

  const tulisLama = post(a, {
    token: a.TOKEN,
    oleh: "Rani",
    gid: String(lamaId),
    kegiatan: [{ tim: "keuangan", sub: "", tanggal: "2 november 2026", uraian: "ubah minggu lama" }],
  });
  cek("tulisan ke minggu lama ditolak", tulisLama.ok === false && tulisLama.terkunci === true && /sudah ditutup/.test(tulisLama.error), JSON.stringify(tulisLama));
  cek("isi minggu lama tidak berubah", String(env.sumber.get(BARIS_URAIAN, KOL_URAIAN)) === "rapat internal");

  const tulisBaru = post(a, {
    token: a.TOKEN,
    oleh: "Rani",
    gid: String(baru.getSheetId()),
    kegiatan: [{ tim: "keuangan", sub: "", tanggal: "2 november 2026", uraian: "minggu terbaru boleh" }],
  });
  cek("minggu terbaru tetap bisa ditulis", tulisBaru.ok === true, JSON.stringify(tulisBaru));

  const bukaTanpaPin = post(a, { token: a.TOKEN, aksi: "bukaMinggu", gid: String(lamaId) });
  cek("buka kunci tanpa PIN ditolak", bukaTanpaPin.ok === false && /PIN admin/.test(bukaTanpaPin.error), JSON.stringify(bukaTanpaPin));

  env.properti.setProperty("PIN_ADMIN", "rahasia-admin");
  cek("cek PIN benar lewat ping", get(a, { aksi: "pin", pin: "rahasia-admin" }).ok === true);
  cek("cek PIN salah lewat ping", get(a, { aksi: "pin", pin: "salah" }).ok === false);

  const buka = post(a, { token: a.TOKEN, pin: "rahasia-admin", aksi: "bukaMinggu", gid: String(lamaId) });
  cek("admin membuka kunci minggu lama", buka.ok === true && (buka.dibuka ?? []).includes(String(lamaId)), JSON.stringify(buka));

  const tulisSetelahBuka = post(a, {
    token: a.TOKEN,
    oleh: "Rani",
    gid: String(lamaId),
    kegiatan: [{ tim: "keuangan", sub: "", tanggal: "2 november 2026", uraian: "koreksi disetujui" }],
  });
  cek("setelah dibuka, minggu lama bisa dikoreksi", tulisSetelahBuka.ok === true, JSON.stringify(tulisSetelahBuka));

  const kunci = post(a, { token: a.TOKEN, pin: "rahasia-admin", aksi: "kunciMinggu", gid: String(lamaId) });
  cek("admin mengunci kembali", kunci.ok === true && !(kunci.dibuka ?? []).includes(String(lamaId)), JSON.stringify(kunci));
  const tulisLagi = post(a, {
    token: a.TOKEN,
    oleh: "Rani",
    gid: String(lamaId),
    kegiatan: [{ tim: "keuangan", sub: "", tanggal: "2 november 2026", uraian: "harus ditolak" }],
  });
  cek("setelah dikunci lagi, tulisan ditolak", tulisLagi.ok === false && tulisLagi.terkunci === true, JSON.stringify(tulisLagi));
}

/* ------- 4b. urutan tab dibalik: judul tetap yang menentukan terbaru ------- */
{
  const env = lingkunganDari(isiTab()); // Nov I (judul minggu I)
  const lamaId = Number(GID);
  const baru = new Sheet(env.ss, "Nov II", isiTab());
  baru.id = 515151;
  baru.set(1, 1, "LAPORAN MINGGU II BULAN NOVEMBER 2026");
  env.ss.sheets.unshift(baru); // Nov II diletakkan di paling KIRI
  const a = api(env);
  const info = get(a, {});
  cek("minggu terbaru mengikuti judul, bukan posisi tab", info.terbaru === String(baru.getSheetId()), JSON.stringify({ terbaru: info.terbaru }));
  const tulisLama = post(a, {
    token: a.TOKEN,
    oleh: "Rani",
    gid: String(lamaId),
    kegiatan: [{ tim: "keuangan", sub: "", tanggal: "2 november 2026", uraian: "harus ditolak" }],
  });
  cek("tab lama tetap terkunci walau di kanan", tulisLama.ok === false && tulisLama.terkunci === true, JSON.stringify(tulisLama));
}

/* --------------------------- 5. anti-timpa ------------------------------ */
{
  const env = lingkunganDari(isiTab());
  const a = api(env);

  const salah = post(a, {
    token: a.TOKEN,
    oleh: "Rani",
    gid: GID,
    kegiatan: [{ tim: "keuangan", sub: "", tanggal: "2 november 2026", uraian: "versi saya", lama: "isi yang sudah tidak ada" }],
  });
  cek("sel yang sudah diubah rekan tidak ditimpa", salah.ok === true && salah.ditulis === 0 && (salah.konflik ?? []).length === 1, JSON.stringify(salah));
  cek("isi sheet tetap seperti semula", String(env.sumber.get(BARIS_URAIAN, KOL_URAIAN)) === "rapat internal");

  const cocok = post(a, {
    token: a.TOKEN,
    oleh: "Rani",
    gid: GID,
    kegiatan: [{ tim: "keuangan", sub: "", tanggal: "2 november 2026", uraian: "rapat internal\nhasil baru", lama: "rapat internal" }],
  });
  cek("sel yang belum berubah tetap ditulis", cocok.ok === true && cocok.ditulis === 1, JSON.stringify(cocok));

  const rencanaKonflik = post(a, {
    token: a.TOKEN,
    oleh: "Rani",
    gid: GID,
    rencana: [{ tim: "keuangan", uraian: "rencana baru", lama: "bukan isi sebenarnya" }],
  });
  cek("rencana yang bentrok juga ditolak", (rencanaKonflik.konflik ?? []).length === 1 && String(env.sumber.get(BARIS_RENCANA, KOL_BUR)) === "rencana lama", JSON.stringify(rencanaKonflik));

  const tanpaLama = post(a, {
    token: a.TOKEN,
    oleh: "Rani",
    gid: GID,
    rencana: [{ tim: "keuangan", uraian: "rencana tanpa pembanding" }],
  });
  cek("tanpa pembanding (lama) tetap ditulis", tanpaLama.ok === true && tanpaLama.ditulis === 1, JSON.stringify(tanpaLama));
}

/* --------------------- 6. kirim ulang penuh butuh PIN -------------------- */
{
  const env = lingkunganDari(isiTab());
  const a = api(env);
  const tanpa = post(a, { token: a.TOKEN, oleh: "Rani", gid: GID, penuh: true, rencana: [{ tim: "keuangan", uraian: "x" }] });
  cek("kirim ulang penuh tanpa PIN ditolak", tanpa.ok === false && /PIN admin/.test(tanpa.error), JSON.stringify(tanpa));
  env.properti.setProperty("PIN_ADMIN", "rahasia-admin");
  const dengan = post(a, { token: a.TOKEN, pin: "rahasia-admin", oleh: "Rani", gid: GID, penuh: true, rencana: [{ tim: "keuangan", uraian: "x" }] });
  cek("kirim ulang penuh dengan PIN diterima", dengan.ok === true, JSON.stringify(dengan));
}

/* ------------------------ 7. token tetap wajib -------------------------- */
{
  const env = lingkunganDari(isiTab());
  const a = api(env);
  const r = post(a, { token: "salah", oleh: "Rani", gid: GID, kegiatan: [] });
  cek("token salah ditolak", r.ok === false && /Token tidak cocok/.test(r.error), JSON.stringify(r));
}

/* ------------- 8. penyalinan kode skrip saat masa peralihan ------------- */
{
  // jalur tidak ditulis sebagai literal supaya esbuild tidak ikut membundelnya
  const mod = await import(process.env.SHEET_MOD || "/tmp/sheet.mjs");
  cek("admin selalu boleh menyalin kode", mod.bolehSalinKode(true, "2.2", true) === true);
  cek("pegawai tidak boleh menyalin kode bila skrip sudah v2.2 + PIN", mod.bolehSalinKode(false, "2.2", true) === false);
  cek("masa peralihan: skrip lama tetap bisa disalin", mod.bolehSalinKode(false, "2.1", undefined) === true);
  cek("masa peralihan: v2.2 tanpa PIN_ADMIN tetap bisa disalin", mod.bolehSalinKode(false, "2.2", false) === true);
  cek("versi skrip belum terbaca tetap bisa disalin", mod.bolehSalinKode(false, "", undefined) === true);
}

const lulus = hasil.filter((h) => h.lulus).length;
console.log(`\n${lulus}/${hasil.length} uji keamanan skrip lulus`);
process.exit(lulus === hasil.length ? 0 : 1);
