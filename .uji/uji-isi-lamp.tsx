import { act } from "react";
import { createRoot } from "react-dom/client";
import { ToastProvider } from "../src/components/ui";
import { AppProvider, useApp } from "../src/lib/store";
import IsiView from "../src/views/IsiView";

const CSV = [
  "LAPORAN MINGGU I BULAN NOVEMBER 2025,,,,,,,,",
  ",,A,KEGIATAN TIM,,,,,,",
  "No,,Tim,Tanggal,Uraian,,,,,Link Bukti Dukung",
  ",,Humas,3 November 2025,,,,,,",
  ",,,4 November 2025,,,,,,",
  ",,B,RENCANA KEGIATAN TIM,,,,,,",
  "No,,Tim,Uraian,,,,,,",
  ",,Humas,,,,,,,",
  ",,C,REKAPITULASI KEHADIRAN,,,,,,",
  "No,,Tanggal,Kehadiran,Tidak Masuk,Dinas Luar,Cuti,,,",
  ",,3 November 2025,,,,,,",
  ",,4 November 2025,,,,,,",
].join("\n");

let aktif: ReturnType<typeof useApp> | null = null;
const fetchAsli = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  if (init?.method === "POST") {
    return { ok: true, text: async () => JSON.stringify({ ok: true, versi: "1.5", ditulis: 1, gagal: [] }), json: async () => ({}) } as unknown as Response;
  }
  if (url.includes("aksi=ping")) return { ok: true, json: async () => ({ ok: false }), text: async () => "" } as unknown as Response;
  return { ok: true, text: async () => CSV, json: async () => ({}) } as unknown as Response;
}) as typeof fetch;

function Probe() {
  aktif = useApp();
  return null;
}

const teks = () => document.body.textContent ?? "";
const tombol = (label: string) =>
  Array.from(document.querySelectorAll("button")).find((b) => (b.textContent ?? "").trim() === label) as HTMLButtonElement | undefined;
const tombolMemuat = (label: string) =>
  Array.from(document.querySelectorAll("button")).find((b) => (b.textContent ?? "").includes(label)) as HTMLButtonElement | undefined;

async function isi(input: HTMLInputElement, nilai: string) {
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), "value")!.set!;
  setter.call(input, nilai);
  input.dispatchEvent(new window.Event("input", { bubbles: true }));
}

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
          <IsiView params={new URLSearchParams("")} />
        </AppProvider>
      </ToastProvider>,
    );
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 80));
  });

  const c = () => aktif as unknown as ReturnType<typeof useApp>;
  cek("tab termuat", !!c().week && c().week!.dates.length === 2, JSON.stringify(c().week?.dates));
  cek("mulai di 3 November", c().week!.dates[0] === "3 November 2025", c().week!.dates[0]);

  /* --- tanggal 3: tambah tautan --- */
  const input = document.querySelector('input[placeholder^="https://drive"]') as HTMLInputElement;
  cek("kotak tautan ada", !!input);
  await act(async () => {
    await isi(input, "https://drive.google.com/file/d/AAA/view");
  });
  await klik(tombolMemuat("Tambah"));
  cek("chip tautan muncul", teks().includes("AAA"), teks().slice(0, 80));
  await klik(tombol("Simpan"));

  const isi3 = c().week!.lampiran["humas|"] ?? "";
  cek("tersimpan dengan tanggal 3 November", isi3 === "3 November 2025: https://drive.google.com/file/d/AAA/view", isi3);
  cek("tidak ada tanda 'ganti'", c().week!.meta["L:humas|"]?.ganti === false, String(c().week!.meta["L:humas|"]?.ganti));

  /* --- pindah ke tanggal 4: tambah tautan lain --- */
  await klik(tombolMemuat("4 Nov"));
  cek("tanggal 4 tidak menampilkan tautan tanggal 3", !(document.querySelector('input[placeholder^="https://drive"]') as HTMLInputElement)?.value);
  cek("ada keterangan tautan tanggal lain", /tautan tanggal lain/.test(teks()), "");
  const input4 = document.querySelector('input[placeholder^="https://drive"]') as HTMLInputElement;
  await act(async () => {
    await isi(input4, "https://drive.google.com/file/d/BBB/view");
  });
  await klik(tombolMemuat("Tambah"));
  await klik(tombol("Simpan"));

  const isi4 = c().week!.lampiran["humas|"] ?? "";
  cek("tautan tanggal 3 TETAP ada", isi4.includes("3 November 2025: https://drive.google.com/file/d/AAA/view"), isi4);
  cek("tautan tanggal 4 ditambahkan", isi4.includes("4 November 2025: https://drive.google.com/file/d/BBB/view"), isi4);
  cek("dua baris", isi4.split("\n").length === 2, isi4);

  /* --- kembali ke tanggal 3 dan hapus tautannya --- */
  await klik(tombolMemuat("3 Nov"));
  const hapus = Array.from(document.querySelectorAll('button[aria-label^="Hapus tautan"]'))[0] as HTMLButtonElement;
  cek("tombol hapus ada di tanggal 3", !!hapus);
  await klik(hapus);
  await klik(tombol("Simpan"));
  const isi5 = c().week!.lampiran["humas|"] ?? "";
  cek("tautan tanggal 3 hilang karena dihapus", !isi5.includes("AAA"), isi5);
  cek("tautan tanggal 4 tetap", isi5.includes("BBB"), isi5);
  cek("tanda 'ganti' aktif setelah hapus", c().week!.meta["L:humas|"]?.ganti === true, String(c().week!.meta["L:humas|"]?.ganti));

  const lulus = hasil.filter((h) => h.lulus).length;
  hasil.filter((h) => !h.lulus).forEach((h) => console.log("  GAGAL:", h.nama, "→", h.info));
  console.log(`\n${lulus}/${hasil.length} uji IsiView lulus`);
  globalThis.fetch = fetchAsli;
  process.exit(lulus === hasil.length ? 0 : 1);
}

void main();
