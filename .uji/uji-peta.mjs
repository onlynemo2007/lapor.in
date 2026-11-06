import { parseWeek } from "/tmp/sheet.mjs";
import { ringkas, slotAda, slotKey } from "/tmp/model.mjs";

const hasil = [];
const cek = (nama, lulus, info = "") => {
  hasil.push({ nama, lulus });
  if (!lulus) console.log("  GAGAL:", nama, "→", info);
};

/* ---------- 1. sel tanggal digabung (merge): tanggal hanya di baris pertama ---------- */
{
  const csv = [
    "LAPORAN MINGGU I BULAN NOVEMBER 2026,,,,,,",
    ",,A,KEGIATAN TIM,,,,",
    "No,,Tim,Tanggal,Uraian,,,",
    ',,Humas,2 November 2026,"a1",,,',
    ',,Keuangan,,"k1",,,',
    ',,Umum,,"u1",,,',
    ',,Humas,3 November 2026,"a2",,,',
    ',,Keuangan,,"k2",,,',
    ',,Umum,,"u2",,,',
  ].join("\n");
  const w = parseWeek(csv, "1", "Nov I");
  cek("dua tanggal terbaca", w.dates.length === 2, JSON.stringify(w.dates));
  cek("tanggal gabungan tetap terisi (Humas)", (w.kegiatan["humas||2 november 2026"] ?? []).length === 1, JSON.stringify(w.kegiatan));
  cek("tanggal gabungan tetap terisi (Keuangan)", (w.kegiatan["keuangan||2 november 2026"] ?? []).length === 1, JSON.stringify(w.kegiatan));
  cek("tanggal gabungan tetap terisi (Umum)", (w.kegiatan["umum||2 november 2026"] ?? []).length === 1, JSON.stringify(w.kegiatan));
  cek("tanggal kedua ikut terbaca", (w.kegiatan["umum||3 november 2026"] ?? []).length === 1, JSON.stringify(w.kegiatan));
  const r = ringkas(w);
  cek("enam kolom terisi dihitung", r.slotTerisi >= 6, JSON.stringify({ terisi: r.slotTerisi, total: r.slotTotal, butir: r.butir }));
}

/* ---------- 2. tanggal ditulis angka (02/11/2026, 2 Nov 2026) ---------- */
{
  const csv = [
    "LAPORAN MINGGU I BULAN NOVEMBER 2026,,,,,,",
    ",,A,KEGIATAN TIM,,,,",
    "No,,Tim,Tanggal,Uraian,,,",
    ',,Humas,02/11/2026,"a1",,,',
    ',,Keuangan,2 Nov 2026,"k1",,,',
    ',,Umum,2026-11-03,"u1",,,',
  ].join("\n");
  const w = parseWeek(csv, "1", "Nov I");
  cek("tanggal angka dibaca sebagai November", w.dates.every((d) => /November 2026/.test(d)), JSON.stringify(w.dates));
  cek("tanggal 2 Nov dari dua penulisan jadi satu", w.dates.filter((d) => /^2 November/.test(d)).length === 1, JSON.stringify(w.dates));
  cek("kegiatan 2 Nov terbaca dari 02/11/2026", (w.kegiatan[slotKey("humas", "", "2 November 2026")] ?? []).length === 1, JSON.stringify(w.kegiatan));
  cek("kegiatan 2 Nov terbaca dari 2 Nov 2026", (w.kegiatan[slotKey("keuangan", "", "2 November 2026")] ?? []).length === 1, JSON.stringify(w.kegiatan));
  cek("kegiatan 3 Nov terbaca dari 2026-11-03", (w.kegiatan[slotKey("umum", "", "3 November 2026")] ?? []).length === 1, JSON.stringify(w.kegiatan));
}

/* ---------- 3. judul sub Program/Monev di kolom uraian ---------- */
{
  const csv = [
    "LAPORAN MINGGU I BULAN NOVEMBER 2026,,,,,,",
    ",,A,KEGIATAN TIM,,,,",
    "No,,Tim,Tanggal,Uraian,,,",
    ",,Program dan Monev,,Program,,,",
    ',,,2 November 2026,"p1",,,',
    ',,,3 November 2026,"p2",,,',
    ",,,,Monev,,,",
    ',,,2 November 2026,"m1",,,',
    ',,,3 November 2026,"m2",,,',
  ].join("\n");
  const w = parseWeek(csv, "1", "Nov I");
  cek("sub Program terbaca", (w.kegiatan["program|program|2 november 2026"] ?? []).length === 1, JSON.stringify(Object.keys(w.kegiatan)));
  cek("sub Monev terbaca", (w.kegiatan["program|monev|2 november 2026"] ?? []).length === 1, JSON.stringify(Object.keys(w.kegiatan)));
  cek("Monev tidak menimpa Program", (w.kegiatan["program|program|3 november 2026"] ?? [])[0] === "p2", JSON.stringify(w.kegiatan["program|program|3 november 2026"]));
  cek("tanggal tidak dobel", w.dates.length === 2, JSON.stringify(w.dates));
}

/* ---------- 4. layout biasa tidak berubah ---------- */
{
  const csv = [
    "LAPORAN MINGGU I BULAN NOVEMBER 2026,,,,,,",
    ",,A,KEGIATAN TIM,,,,",
    "No,,Tim,Tanggal,Uraian,,,",
    ',,Humas,2 November 2026,"a1",,,',
    ',,,3 November 2026,"a2",,,',
  ].join("\n");
  const w = parseWeek(csv, "1", "Nov I");
  cek("layout biasa tetap terbaca", w.dates.length === 2 && (w.kegiatan["humas||3 november 2026"] ?? []).length === 1, JSON.stringify(w.kegiatan));
  cek("baris kosong tidak menggeser tanggal", w.rows.A["humas||2 november 2026"] === 4, JSON.stringify(w.rows.A));
}


/* ---------- 5. nama tim dengan penomoran / kata tambahan ---------- */
{
  const csv = [
    "LAPORAN MINGGU I BULAN NOVEMBER 2026,,,,,,",
    ",,A,KEGIATAN TIM,,,,",
    "No,,Tim,Tanggal,Uraian,,,",
    ',,VI. Humas Datin,2 November 2026,"h1",,,',
    ',,"Humas, Datin",3 November 2026,"h2",,,',
    ',,Datin,4 November 2026,"h3",,,',
    ',,VII. Hukum,2 November 2026,"k1",,,',
    ',,Hukum,3 November 2026,"k2",,,',
    ',,5. Program dan Monev,2 November 2026,"p1",,,',
    ',,Program dan Monev,3 November 2026,"p2",,,',
    ',,Monev,2 November 2026,"mv1",,,',
  ].join("\n");
  const w = parseWeek(csv, "1", "Nov I");
  cek("tim berpenomoran VI → Humas", (w.kegiatan["humas||2 november 2026"] ?? []).length === 1, JSON.stringify(Object.keys(w.kegiatan)));
  cek("tim \"Humas, Datin\" → Humas", (w.kegiatan["humas||3 november 2026"] ?? []).length === 1, JSON.stringify(Object.keys(w.kegiatan)));
  cek("tim \"Datin\" saja → Humas", (w.kegiatan["humas||4 november 2026"] ?? []).length === 1, JSON.stringify(Object.keys(w.kegiatan)));
  cek("tim berpenomoran VII → Hukum", (w.kegiatan["hukum||2 november 2026"] ?? []).length === 1, JSON.stringify(Object.keys(w.kegiatan)));
  cek("tim Hukum biasa terbaca", (w.kegiatan["hukum||3 november 2026"] ?? []).length === 1, JSON.stringify(Object.keys(w.kegiatan)));
  cek("Program berpenomoran terbaca", (w.kegiatan["program|program|2 november 2026"] ?? []).length === 1, JSON.stringify(Object.keys(w.kegiatan)));
  cek("sub Monev di kolom Tim terbaca", (w.kegiatan["program|monev|2 november 2026"] ?? []).length === 1, JSON.stringify(Object.keys(w.kegiatan)));
  cek("sub Monev tidak menimpa Program", (w.kegiatan["program|program|3 november 2026"] ?? [])[0] === "p2", JSON.stringify(w.kegiatan["program|program|3 november 2026"]));
  cek("tidak ada baris tak terbaca", !w.takTerbaca, JSON.stringify(w.takTerbaca));
}

/* ---------- 6. tanggal berteks (nama hari, rentang, tanda hubung) ---------- */
{
  const csv = [
    "LAPORAN MINGGU I BULAN NOVEMBER 2026,,,,,,",
    ",,A,KEGIATAN TIM,,,,",
    "No,,Tim,Tanggal,Uraian,,,",
    ',,Humas,"Senin, 2 November 2026","h1",,,',
    ',,Umum,"2 s.d. 4 November 2026","u1",,,',
    ',,Keuangan,02-Nov-2026,"k1",,,',
  ].join("\n");
  const w = parseWeek(csv, "1", "Nov I");
  cek("tanggal dengan nama hari terbaca", (w.kegiatan["humas||2 november 2026"] ?? []).length === 1, JSON.stringify(Object.keys(w.kegiatan)));
  cek("rentang tanggal pakai tanggal pertama", (w.kegiatan["umum||2 november 2026"] ?? []).length === 1, JSON.stringify(w.dates));
  cek("tanggal bertanda hubung terbaca", (w.kegiatan["keuangan||2 november 2026"] ?? []).length === 1, JSON.stringify(Object.keys(w.kegiatan)));
  cek("tanggal tidak dobel", w.dates.length === 1, JSON.stringify(w.dates));
}

/* ---------- 7. n/a hanya untuk tim yang tidak ada di tab ---------- */
{
  const csv = [
    "LAPORAN MINGGU I BULAN NOVEMBER 2026,,,,,,",
    ",,A,KEGIATAN TIM,,,,",
    "No,,Tim,Tanggal,Uraian,,,,",
    ',,Humas,2 November 2026,"h1",,,',
    ',,Humas,3 November 2026,,,,',
  ].join("\n");
  const w = parseWeek(csv, "1", "Nov I");
  cek("tanggal tanpa baris tetap bisa diisi", slotAda(w, "humas", "", "4 November 2026") === true, JSON.stringify(w.dates));
  cek("tim yang tidak ada di tab tetap n/a", slotAda(w, "hukum", "", "2 November 2026") === false, JSON.stringify(Object.keys(w.rows.A)));
}

/* ---------- 8. baris tak dikenal dicatat ---------- */
{
  const csv = [
    "LAPORAN MINGGU I BULAN NOVEMBER 2026,,,,,,",
    ",,A,KEGIATAN TIM,,,,",
    "No,,Tim,Tanggal,Uraian,,,,",
    ',,Humas,2 November 2026,"h1",,,',
    ',,Sekretariat,2 November 2026,"x",,,',
    ',,Humas,,,"tanpa tanggal",,,',
  ].join("\n");
  const w = parseWeek(csv, "1", "Nov I");
  cek("baris dengan tim tak dikenal dicatat", (w.takTerbaca ?? []).some((t) => t.baris === 5 && /Sekretariat/.test(t.teks)), JSON.stringify(w.takTerbaca));
  cek("baris tanpa tanggal & tanpa tanggal warisan dicatat", (w.takTerbaca ?? []).some((t) => t.baris === 6), JSON.stringify(w.takTerbaca));
  cek("satu-satunya tanggal tetap terbaca", w.dates.length === 1, JSON.stringify(w.dates));
}

const lulus = hasil.filter((h) => h.lulus).length;
console.log(`\n${lulus}/${hasil.length} uji peta kegiatan lulus`);
process.exit(lulus === hasil.length ? 0 : 1);
