import { act } from "react";
import { createRoot } from "react-dom/client";
import { ToastProvider } from "../src/components/ui";
import { AppProvider, useApp } from "../src/lib/store";
import IsiView from "../src/views/IsiView";

/* Pegawai mengisi sheet manual: tautan tanpa tanggal + format tanggal lain */
const CSV = [
  "LAPORAN MINGGU I BULAN NOVEMBER 2025,,,,,,,,",
  ",,A,KEGIATAN TIM,,,,,,",
  "No,,Tim,Tanggal,Uraian,,,,,Link Bukti Dukung",
  ",,Humas,3 November 2025,,,,,,https://drive.google.com/file/d/MANUAL/view",
  ",,,4 November 2025,,,,,,2/11/2025: https://drive.google.com/file/d/LALU/view",
  ",,B,RENCANA KEGIATAN TIM,,,,,,",
  "No,,Tim,Uraian,,,,,,",
  ",,Humas,,,,,,,",
  ",,C,REKAPITULASI KEHADIRAN,,,,,,,",
  "No,,Tanggal,Kehadiran,Tidak Masuk,Dinas Luar,Cuti,,,",
  ",,3 November 2025,,,,,,",
  ",,4 November 2025,,,,,,",
].join("\n");

let aktif: ReturnType<typeof useApp> | null = null;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  if (init?.method === "POST")
    return { ok: true, text: async () => JSON.stringify({ ok: true, versi: "1.8", ditulis: 1, gagal: [] }), json: async () => ({}) } as unknown as Response;
  if (url.includes("aksi=ping")) return { ok: true, json: async () => ({ ok: false }), text: async () => "" } as unknown as Response;
  return { ok: true, text: async () => CSV, json: async () => ({}) } as unknown as Response;
}) as typeof fetch;

function Probe() {
  aktif = useApp();
  return null;
}

const teks = () => document.body.textContent ?? "";
const tombolMemuat = (label: string) =>
  Array.from(document.querySelectorAll("button")).find((b) => (b.textContent ?? "").includes(label)) as HTMLButtonElement | undefined;

async function klik(b?: HTMLButtonElement) {
  if (!b) throw new Error("tombol tidak ditemukan");
  await act(async () => {
    b.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 40));
  });
}

async function main() {
  const hasil: { nama: string; lulus: boolean; info?: string }[] = [];
  const cek = (nama: string, lulus: boolean, info = "") => hasil.push({ nama, lulus, info });

  localStorage.setItem(
    "laporin:v3",
    JSON.stringify({ v: 2, settings: { nama: "Uji", timUtama: "humas" }, weeks: {}, trend: {}, log: [] }),
  );

  const wadah = document.createElement("div");
  document.body.appendChild(wadah);
  const root = createRoot(wadah);
  await act(async () => {
    root.render(
      <ToastProvider>
        <AppProvider>
          <Probe />
          <IsiView params={new URLSearchParams("tim=humas&d=3 November 2025")} />
        </AppProvider>
      </ToastProvider>,
    );
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 80));
  });

  const c = () => aktif as unknown as ReturnType<typeof useApp>;
  const sel = c().week!.lampiran["humas|"] ?? "";
  cek("sel lampiran terbaca dari sheet", sel.includes("MANUAL"), sel);
  cek("tautan manual tanpa tanggal tampil di kotak tersimpan", teks().includes("MANUAL"), teks().slice(0, 120));
  cek("diberi keterangan belum bertanggal", /belum bertanggal/.test(teks()), "");

  /* tautan 2/11/2025 menjadi milik tanggal 4 November? bukan — tanggal 2 tidak ada di tab */
  cek("tautan tanggal di luar tab tidak dianggap milik 3 Nov", !teks().includes("LALU"), teks().slice(0, 200));

  /* Pakai tanggal ini → tercatat pada 3 November 2025 */
  await klik(tombolMemuat("Pakai tanggal ini"));
  cek("tombol simpan aktif setelah memilih", !(Array.from(document.querySelectorAll("button")).find((b) => (b.textContent ?? "").trim() === "Simpan") as HTMLButtonElement).disabled);
  await klik(Array.from(document.querySelectorAll("button")).find((b) => (b.textContent ?? "").trim() === "Simpan") as HTMLButtonElement);
  const sesudah = c().week!.lampiran["humas|"] ?? "";
  cek("tautan dipakai untuk tanggal 3 November", sesudah.includes("3 November 2025: https://drive.google.com/file/d/MANUAL/view"), sesudah);
  cek("tautan manual tidak terduplikasi", sesudah.split("\n").filter((x) => x.includes("MANUAL")).length === 1, sesudah);
  cek("tautan tanggal lain tetap utuh", sesudah.includes("2 November 2025: https://drive.google.com/file/d/LALU/view"), sesudah);

  const lulus = hasil.filter((h) => h.lulus).length;
  hasil.filter((h) => !h.lulus).forEach((h) => console.log("  GAGAL:", h.nama, "→", h.info));
  console.log(`\n${lulus}/${hasil.length} uji Isi manual lulus`);
  process.exit(lulus === hasil.length ? 0 : 1);
}

void main();
