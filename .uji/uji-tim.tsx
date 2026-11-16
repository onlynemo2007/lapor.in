import { act } from "react";
import { createRoot } from "react-dom/client";
import { ToastProvider } from "../src/components/ui";
import { AppProvider } from "../src/lib/store";
import { TIMS, slotAda } from "../src/lib/model";
import { parseWeek } from "../src/lib/sheet";
import DashboardView from "../src/views/DashboardView";
import IsiView from "../src/views/IsiView";
import ChatAsisten from "../src/views/ChatAsisten";

// jsdom belum punya scrollTo pada elemen (dipakai panel chat)
if (globalThis.HTMLElement) (globalThis.HTMLElement.prototype as unknown as { scrollTo: () => void }).scrollTo = () => {};

const TANGGAL = ["16 November 2026", "17 November 2026", "18 November 2026", "19 November 2026", "20 November 2026"];

type TimCsv = { no: string; label: string };

const TUJUH: TimCsv[] = [
  { no: "I", label: "Keuangan" },
  { no: "II", label: "Umum" },
  { no: "III", label: "Arsiparis" },
  { no: "IV", label: "Kepegawaian" },
  { no: "V", label: "Program dan Monev" },
  { no: "VI", label: "Humas Datin" },
  { no: "VII", label: "Hukum" },
];

const SEPULUH: TimCsv[] = [
  ...TUJUH,
  { no: "VIII", label: "Sertifikasi Kompetensi SDMKP" },
  { no: "IX", label: "Standardisasi Kompetensi" },
  { no: "X", label: "Penjamin Mutu LSP" },
];

/** CSV tiruan tab mingguan: bagian A (per tim × 5 tanggal) + bagian B (rencana). */
function csv(tims: TimCsv[]) {
  const baris: string[] = [
    "LAPORAN MINGGU KE- III BULAN NOVEMBER 2026,,,,,,",
    ",,A,KEGIATAN TIM,,,,",
    "No,,Tim,Tanggal,Uraian,,,",
  ];
  for (const t of tims) {
    if (t.label === "Program dan Monev") {
      baris.push(`,${t.no},${t.label},,Program,,`);
      TANGGAL.forEach((d) => baris.push(`,,,${d},,`));
      baris.push(`,,,,Monev,,`);
      TANGGAL.forEach((d) => baris.push(`,,,${d},,`));
      continue;
    }
    TANGGAL.forEach((d, i) => baris.push(`,${i === 0 ? t.no : ""},${i === 0 ? t.label : ""},${d},,`));
  }
  baris.push(",,B,RENCANA KEGIATAN MINGGU BERIKUTNYA,,,,");
  baris.push("No,,Tim,Uraian,,,,");
  for (const t of tims) baris.push(`,${t.no},${t.label},,,,`);
  baris.push(",,C,REKAPITULASI KEHADIRAN,,,,");
  baris.push("No,,Tanggal,Kehadiran,Tidak Masuk,Dinas Luar,Cuti,,");
  TANGGAL.forEach((d) => baris.push(`,,${d},,,,,`));
  return baris.join("\n");
}

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  if (init?.method === "POST") {
    return { ok: true, text: async () => JSON.stringify({ ok: true, versi: "2.3", ditulis: 1, gagal: [] }) } as unknown as Response;
  }
  if (String(input).includes("aksi=ping")) return { ok: true, json: async () => ({ ok: false }), text: async () => "" } as unknown as Response;
  return { ok: true, text: async () => "", json: async () => ({}) } as unknown as Response;
}) as typeof fetch;

async function main() {
  const hasil: { nama: string; lulus: boolean; info?: string }[] = [];
  const cek = (nama: string, lulus: boolean, info = "") => hasil.push({ nama, lulus, info });

  /* ---------------- daftar tim ---------------- */
  const id = TIMS.map((t) => t.id);
  cek("jumlah tim sekarang 10", TIMS.length === 10, id.join(","));
  cek("tiga tim baru terdaftar", ["sertifikasi", "standardisasi", "mutu"].every((x) => id.includes(x)));
  cek(
    "nama tim baru sesuai permintaan",
    TIMS.find((t) => t.id === "sertifikasi")?.label === "Sertifikasi Kompetensi SDMKP" &&
      TIMS.find((t) => t.id === "standardisasi")?.label === "Standardisasi Kompetensi" &&
      TIMS.find((t) => t.id === "mutu")?.label === "Penjamin Mutu LSP",
  );
  cek(
    "penomoran melanjutkan I–VII di sheet",
    TIMS.find((t) => t.id === "sertifikasi")?.no === "VIII" &&
      TIMS.find((t) => t.id === "standardisasi")?.no === "IX" &&
      TIMS.find((t) => t.id === "mutu")?.no === "X",
    TIMS.map((t) => t.no).join(" "),
  );
  cek("nomor tim unik", new Set(TIMS.map((t) => t.no)).size === TIMS.length);
  cek("id tim unik", new Set(id).size === TIMS.length);
  cek("tim lama tidak berubah", TUJUH.every((t, i) => TIMS[i].label === t.label && TIMS[i].no === t.no));

  /* ---------------- tab lama (7 tim): tim baru ditandai n/a ---------------- */
  const lama = parseWeek(csv(TUJUH), "gid-lama", "Nov III");
  cek("tab 7 tim: Keuangan tetap terbaca", slotAda(lama, "keuangan", "", TANGGAL[0]));
  cek("tab 7 tim: tim baru belum punya baris", ["sertifikasi", "standardisasi", "mutu"].every((t) => !slotAda(lama, t, "", TANGGAL[0])));
  cek(
    "tab 7 tim: tidak ada baris tak terbaca",
    (lama.takTerbaca ?? []).length === 0,
    JSON.stringify(lama.takTerbaca ?? []).slice(0, 120),
  );

  /* ---------------- tab baru (10 tim): semua terbaca ---------------- */
  const baru = parseWeek(csv(SEPULUH), "gid-baru", "Nov IV");
  cek(
    "tab 10 tim: tiga tim baru terpetakan",
    ["sertifikasi", "standardisasi", "mutu"].every((t) => slotAda(baru, t, "", TANGGAL[0])),
    Object.keys(baru.rows.A).slice(-6).join(" | "),
  );
  cek(
    "tab 10 tim: penomoran VIII/IX/X dikenali",
    ["sertifikasi", "standardisasi", "mutu"].every((t) => !!baru.rows.B[t]),
    JSON.stringify(baru.rows.B),
  );
  cek("tab 10 tim: 5 tanggal per tim baru", ["sertifikasi", "standardisasi", "mutu"].every((t) => TANGGAL.every((d) => slotAda(baru, t, "", d))));
  cek("tab 10 tim: tidak ada baris tak terbaca", (baru.takTerbaca ?? []).length === 0, JSON.stringify(baru.takTerbaca ?? []).slice(0, 120));

  /* ---------------- dashboard menampilkan tim baru ---------------- */
  localStorage.setItem("laporin:v3", JSON.stringify({ v: 2, settings: { nama: "Uji", timUtama: "humas" }, weeks: {}, trend: {}, log: [] }));
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === "POST") {
      return { ok: true, text: async () => JSON.stringify({ ok: true, versi: "2.3", ditulis: 1, gagal: [] }) } as unknown as Response;
    }
    if (String(input).includes("aksi=ping")) return { ok: true, json: async () => ({ ok: false }), text: async () => "" } as unknown as Response;
    return { ok: true, text: async () => csv(TUJUH), json: async () => ({}) } as unknown as Response;
  }) as typeof fetch;

  const wadah = document.createElement("div");
  document.body.appendChild(wadah);
  const root = createRoot(wadah);
  await act(async () => {
    root.render(
      <ToastProvider>
        <AppProvider>
          <DashboardView />
        </AppProvider>
      </ToastProvider>,
    );
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 80));
  });

  const teks = () => document.body.textContent ?? "";
  cek("dashboard memuat tim Sertifikasi", teks().includes("Sertifikasi Kompetensi SDMKP"));
  cek("dashboard memuat tim Standardisasi", teks().includes("Standardisasi Kompetensi"));
  cek("dashboard memuat tim Penjamin Mutu", teks().includes("Penjamin Mutu LSP"));
  cek("baris tim lama tetap ada", ["Keuangan", "Umum", "Arsiparis", "Kepegawaian", "Program", "Humas Datin", "Hukum"].every((x) => teks().includes(x)));
  cek("sel tim baru tanpa baris ditandai n/a", (teks().match(/n\/a/g) ?? []).length >= 15, String((teks().match(/n\/a/g) ?? []).length));

  /* ---------------- rencana: tim baru diberi tahu belum ada di sheet ---------------- */
  document.body.innerHTML = "";
  const wadah2 = document.createElement("div");
  document.body.appendChild(wadah2);
  const root2 = createRoot(wadah2);
  await act(async () => {
    root2.render(
      <ToastProvider>
        <AppProvider>
          <IsiView params={new URLSearchParams("mode=rencana")} />
        </AppProvider>
      </ToastProvider>,
    );
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 80));
  });
  cek("rencana: tim lama bisa diisi", teks().includes("Keuangan"));
  cek("rencana: tiga tim baru ditandai belum ada di sheet", (teks().match(/belum ada di sheet/g) ?? []).length >= 3, String((teks().match(/belum ada di sheet/g) ?? []).length));

  /* ---------------- pemilih tim tidak melebihi layar ---------------- */
  document.body.innerHTML = "";
  const wadah3 = document.createElement("div");
  document.body.appendChild(wadah3);
  const root3 = createRoot(wadah3);
  await act(async () => {
    root3.render(
      <ToastProvider>
        <AppProvider>
          <IsiView params={new URLSearchParams("")} />
        </AppProvider>
      </ToastProvider>,
    );
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 80));
  });

  const pemilih = document.querySelector("[data-pemilih-tim]") as HTMLElement | null;
  const kelas = pemilih?.className ?? "";
  cek("form cepat: pemilih tim dibungkus (flex-wrap)", /flex-wrap/.test(kelas), kelas);
  cek("form cepat: tidak perlu digeser (tanpa overflow-x)", !/overflow-x-auto/.test(kelas), kelas);
  const chipTim = pemilih ? Array.from(pemilih.querySelectorAll("button")) : [];
  cek("form cepat: 10 tim tampil semua", chipTim.length === 10, String(chipTim.length));
  cek(
    "form cepat: chip tidak dikunci selebar layar",
    chipTim.length > 0 && chipTim.every((b) => !/shrink-0 rounded-full border px-3\.5 py-2 text-\[13px\]/.test(b.className)),
  );
  cek("form cepat: nama tim panjang utuh", (pemilih?.textContent ?? "").includes("Sertifikasi Kompetensi SDMKP"));

  document.body.innerHTML = "";
  const wadah4 = document.createElement("div");
  document.body.appendChild(wadah4);
  const root4 = createRoot(wadah4);
  await act(async () => {
    root4.render(
      <ToastProvider>
        <AppProvider>
          <ChatAsisten />
        </AppProvider>
      </ToastProvider>,
    );
  });
  // beri waktu animasi "mengetik" selesai supaya chip pilihan tim muncul
  await act(async () => {
    await new Promise((r) => setTimeout(r, 2000));
  });
  const pemilihChat = document.querySelector("[data-pemilih-tim]") as HTMLElement | null;
  const kelasChat = pemilihChat?.className ?? "";
  cek("asisten chat: pemilih tim dibungkus (flex-wrap)", /flex-wrap/.test(kelasChat), kelasChat);
  cek("asisten chat: tidak perlu digeser (tanpa overflow-x)", !/overflow-x-auto/.test(kelasChat), kelasChat);
  const chipChat = pemilihChat ? Array.from(pemilihChat.querySelectorAll("button")) : [];
  cek("asisten chat: 10 tim tampil semua", chipChat.length === 10, String(chipChat.length));

  const lulus = hasil.filter((h) => h.lulus).length;
  for (const h of hasil) console.log(`${h.lulus ? "✓" : "✗"} ${h.nama}${h.info ? ` — ${h.info}` : ""}`);
  console.log(`\n${lulus}/${hasil.length} lulus`);
  process.exit(lulus === hasil.length ? 0 : 1);
}

await main();
