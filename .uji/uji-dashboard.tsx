import { act } from "react";
import { createRoot } from "react-dom/client";
import { ToastProvider } from "../src/components/ui";
import { AppProvider, useApp } from "../src/lib/store";
import DashboardView from "../src/views/DashboardView";
import { ringkas } from "../src/lib/model";

/* sel tanggal digabung: tanggal hanya di baris pertama tiap blok */
const CSV = [
  "LAPORAN MINGGU I BULAN NOVEMBER 2026,,,,,,",
  ",,A,KEGIATAN TIM,,,,",
  "No,,Tim,Tanggal,Uraian,,,",
  ',,Sekretariat,2 November 2026,"tak dikenal",,,',
  ',,Humas,2 November 2026,"a1",,,',
  ',,Keuangan,,"k1",,,',
  ',,Humas,3 November 2026,"a2",,,',
  ',,Keuangan,,"k2",,,',
  ",,B,RENCANA KEGIATAN TIM,,,,",
  "No,,Tim,Uraian,,,,",
  ",,Humas,,,,,",
  ",,C,REKAPITULASI KEHADIRAN,,,,",
  "No,,Tanggal,Kehadiran,Tidak Masuk,Dinas Luar,Cuti,,",
  ",,2 November 2026,,,,,,",
  ",,3 November 2026,,,,,,",
].join("\n");

let aktif: ReturnType<typeof useApp> | null = null;
let jumlahBaca = 0;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  if (init?.method === "POST") return { ok: true, text: async () => JSON.stringify({ ok: true, versi: "1.9", ditulis: 1, gagal: [] }) } as unknown as Response;
  const url = String(input);
  if (url.includes("aksi=ping")) return { ok: true, json: async () => ({ ok: false }), text: async () => "" } as unknown as Response;
  jumlahBaca += 1;
  return { ok: true, text: async () => CSV, json: async () => ({}) } as unknown as Response;
}) as typeof fetch;

function Probe() {
  aktif = useApp();
  return null;
}

async function main() {
  const hasil: { nama: string; lulus: boolean; info?: string }[] = [];
  const cek = (nama: string, lulus: boolean, info = "") => hasil.push({ nama, lulus, info });

  localStorage.setItem("laporin:v3", JSON.stringify({ v: 2, settings: { nama: "Uji", timUtama: "humas" }, weeks: {}, trend: {}, log: [] }));

  const wadah = document.createElement("div");
  document.body.appendChild(wadah);
  const root = createRoot(wadah);
  await act(async () => {
    root.render(
      <ToastProvider>
        <AppProvider>
          <Probe />
          <DashboardView />
        </AppProvider>
      </ToastProvider>,
    );
  });
  for (let i = 0; i < 3; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 80));
    });
  }

  const c = () => aktif as unknown as ReturnType<typeof useApp>;
  const teks = () => document.body.textContent ?? "";
  const tombol = (label: string) =>
    Array.from(document.querySelectorAll("button")).find((b) => (b.textContent ?? "").includes(label)) as HTMLButtonElement | undefined;

  cek("peta isian tampil", /Peta isian kegiatan/.test(teks()), teks().slice(0, 120));
  cek("label data sheet dibaca", /Data sheet dibaca|Membaca sheet/.test(teks()), "");
  cek("tombol ambil data terbaru ada", !!tombol("Ambil data terbaru"));

  const w = c().week!;
  cek("dua tanggal terbaca", w.dates.length === 2, JSON.stringify(w.dates));
  cek("kegiatan Keuangan ikut terbaca (sel tanggal merge)", (w.kegiatan["keuangan||2 november 2026"] ?? []).length === 1, JSON.stringify(Object.keys(w.kegiatan)));
  cek("kegiatan Humas terbaca", (w.kegiatan["humas||3 november 2026"] ?? []).length === 1, JSON.stringify(w.kegiatan));

  const r = ringkas(w);
  cek("angka kelengkapan sesuai isi sheet", teks().includes(`${r.slotTerisi}/${r.slotTotal}`), `${r.slotTerisi}/${r.slotTotal} :: ${teks().slice(0, 200)}`);
  const kotakTerisi = Array.from(document.querySelectorAll("button")).filter((b) => (b.textContent ?? "").trim() === "1");
  cek("kotak peta menampilkan jumlah butir", kotakTerisi.length >= 4, String(kotakTerisi.length));
  cek("baris tak terbaca dilaporkan", /belum bisa dipetakan/.test(teks()), teks().slice(-300));
  cek("tim yang dikenal tetap n/a", /n\/a/.test(teks()), "");

  const lulus = hasil.filter((h) => h.lulus).length;
  hasil.filter((h) => !h.lulus).forEach((h) => console.log("  GAGAL:", h.nama, "→", h.info));
  console.log(`\n${lulus}/${hasil.length} uji Dashboard lulus`);
  process.exit(lulus === hasil.length ? 0 : 1);
}

void main();
