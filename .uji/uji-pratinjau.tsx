import { act } from "react";
import { createRoot } from "react-dom/client";
import { ToastProvider } from "../src/components/ui";
import { AppProvider, useApp } from "../src/lib/store";
import PratinjauView from "../src/views/PratinjauView";

const A = "https://drive.google.com/file/d/AAA/view";
const B = "https://drive.google.com/file/d/BBB/view";

/* sheet v1.6: tautan ada di baris tanggalnya masing-masing */
const CSV = [
  "LAPORAN MINGGU I BULAN NOVEMBER 2025,,,,,,,,",
  ",,A,KEGIATAN TIM,,,,,,",
  "No,,Tim,Tanggal,Uraian,,,,,Link Bukti Dukung",
  `,,Humas,3 November 2025,"Satu butir",,,,,3 November 2025: ${A}`,
  `,,,4 November 2025,"Dua butir",,,,,4 November 2025: ${B}`,
  ",,B,RENCANA KEGIATAN TIM,,,,,,",
  "No,,Tim,Uraian,,,,,,",
  ",,Humas,,,,,,,",
  ",,C,REKAPITULASI KEHADIRAN,,,,,,",
  "No,,Tanggal,Kehadiran,Tidak Masuk,Dinas Luar,Cuti,,,",
  ",,3 November 2025,,,,,,",
  ",,4 November 2025,,,,,,",
].join("\n");

let aktif: ReturnType<typeof useApp> | null = null;
let jumlahBaca = 0;
const fetchAsli = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  if (init?.method === "POST") return { ok: true, text: async () => JSON.stringify({ ok: true, versi: "1.6", ditulis: 1, gagal: [] }) } as unknown as Response;
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
          <PratinjauView />
        </AppProvider>
      </ToastProvider>,
    );
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 250));
  });

  const c = () => aktif as unknown as ReturnType<typeof useApp>;
  cek("sheet dibaca ulang saat pratinjau dibuka", jumlahBaca >= 1, `baca ${jumlahBaca}x`);
  cek("waktu baca tercatat", typeof c().dibacaAt === "number" && c().dibacaAt! > 0, String(c().dibacaAt));
  cek("label waktu baca tampil", /Data sheet dibaca/.test(document.body.textContent ?? ""), (document.body.textContent ?? "").slice(0, 120));

  const barisDari = (url: string) => {
    const a = Array.from(document.querySelectorAll("a")).find((x) => (x as HTMLAnchorElement).href === url) as HTMLAnchorElement | undefined;
    return a ? (a.closest("tr") as HTMLTableRowElement | null) : null;
  };
  const r3 = barisDari(A);
  const r4 = barisDari(B);
  cek("tautan tanggal 3 tampil", !!r3, "tautan AAA tidak ditemukan");
  cek("tautan tanggal 3 di baris tanggal 3", !!r3 && (r3.textContent ?? "").includes("3 November 2025"), r3?.textContent);
  cek("tautan tanggal 3 tidak menumpang di baris tanggal 4", !!r4 && !(r4.textContent ?? "").includes("AAA"), r4?.textContent);
  cek("tautan tanggal 4 di baris tanggal 4", !!r4 && (r4.textContent ?? "").includes("4 November 2025"), r4?.textContent);

  /* tombol ambil data terbaru memicu pembacaan lagi */
  const sebelum = jumlahBaca;
  const tombol = Array.from(document.querySelectorAll("button")).find((b) => (b.textContent ?? "").includes("Ambil data terbaru")) as HTMLButtonElement;
  cek("tombol ambil data terbaru ada", !!tombol);
  await act(async () => {
    tombol?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 150));
  });
  cek("tombol memuat ulang dari sheet", jumlahBaca > sebelum, `${sebelum} → ${jumlahBaca}`);

  const lulus = hasil.filter((h) => h.lulus).length;
  hasil.filter((h) => !h.lulus).forEach((h) => console.log("  GAGAL:", h.nama, "→", h.info));
  console.log(`\n${lulus}/${hasil.length} uji Pratinjau lulus`);
  globalThis.fetch = fetchAsli;
  process.exit(lulus === hasil.length ? 0 : 1);
}

void main();
