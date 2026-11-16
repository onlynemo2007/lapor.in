import { act } from "react";
import { createRoot } from "react-dom/client";
import { ToastProvider } from "../src/components/ui";
import { AppProvider, useApp } from "../src/lib/store";
import { buildPayload } from "../src/lib/sheet";
import KeuanganView from "../src/views/KeuanganView";

/* Tab tiruan: bagian D punya baris rekap (7948) + rincian di bawahnya. */
const CSV = [
  "LAPORAN MINGGU I BULAN NOVEMBER 2025,,,,,,",
  ",,A,KEGIATAN TIM,,,,",
  "No,,Tim,Tanggal,Uraian,,,",
  ',,Humas,3 November 2025,"Satu butir",,,',
  ",,,,,,,",
  ",,D,REALISASI KEUANGAN,,,,",
  "Realisasi Anggaran,,,,,,",
  "No,Kode,Uraian,Pagu,Realisasi,,",
  "1,7948,Rekap Program,100000000,50000000,,",
  "2,7948.ADF,Sertifikasi Lembaga,60000000,30000000,,",
  "3,7948.AFA,Norma Standar,40000000,20000000,,",
  "4,032.12.691629,Total,,,",
].join("\n");

let aktif: ReturnType<typeof useApp> | null = null;
const fetchAsli = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  if (init?.method === "POST") return { ok: true, text: async () => JSON.stringify({ ok: true, versi: "2.3", ditulis: 1, gagal: [] }) } as unknown as Response;
  const url = String(input);
  if (url.includes("aksi=ping")) return { ok: true, json: async () => ({ ok: false }), text: async () => "" } as unknown as Response;
  return { ok: true, text: async () => CSV, json: async () => ({}) } as unknown as Response;
}) as typeof fetch;

function Probe() {
  aktif = useApp();
  return null;
}

async function isi(input: HTMLInputElement, nilai: string) {
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), "value")!.set!;
  setter.call(input, nilai);
  input.dispatchEvent(new window.Event("input", { bubbles: true }));
}

async function main() {
  const hasil: { nama: string; lulus: boolean; info?: string }[] = [];
  const cek = (nama: string, lulus: boolean, info = "") => hasil.push({ nama, lulus, info });

  // menu ini milik satu tim: presensi → kepegawaian, keuangan → keuangan
  localStorage.setItem("laporin:v3", JSON.stringify({ v: 2, settings: { nama: "Uji", timUtama: "keuangan" }, weeks: {}, trend: {}, log: [] }));

  const wadah = document.createElement("div");
  document.body.appendChild(wadah);
  const root = createRoot(wadah);
  await act(async () => {
    root.render(
      <ToastProvider>
        <AppProvider>
          <Probe />
          <KeuanganView />
        </AppProvider>
      </ToastProvider>,
    );
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 200));
  });

  const c = () => aktif as unknown as ReturnType<typeof useApp>;
  const angka = Array.from(document.querySelectorAll('input[inputmode="numeric"]')) as HTMLInputElement[];

  cek("baris rekap ikut tampil", c().week!.anggaran.some((a) => a.kode === "7948"), JSON.stringify(c().week!.anggaran));
  cek("semua baris punya kolom isian", angka.length === c().week!.anggaran.length * 2, `${angka.length} isian / ${c().week!.anggaran.length} baris`);
  cek("baris rekap ditandai", (document.body.textContent ?? "").includes("rekap"), (document.body.textContent ?? "").slice(0, 200));

  /* ubah realisasi baris rekap → konfirmasi dulu */
  const panggilan: string[] = [];
  const konfirmAsli = window.confirm;
  Object.defineProperty(window, "confirm", { configurable: true, writable: true, value: (m: string) => (panggilan.push(String(m)), false) });

  const realRekap = angka[1]; // baris pertama = 7948, kolom realisasi
  await act(async () => {
    await isi(realRekap, "55000000");
  });

  const tombol = Array.from(document.querySelectorAll("button")).filter((b) => (b.textContent ?? "").includes("Simpan")) as HTMLButtonElement[];
  await act(async () => {
    tombol[0].dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 60));
  });
  cek("menyimpan baris rekap minta konfirmasi", panggilan.length === 1 && /rumus/i.test(panggilan[0] ?? ""), JSON.stringify(panggilan));
  cek("batal konfirmasi = tidak tersimpan", c().week!.anggaran.find((a) => a.kode === "7948")!.realisasi === 50000000, JSON.stringify(c().week!.anggaran));

  /* setuju → tersimpan & payload memakai paksa */
  Object.defineProperty(window, "confirm", { configurable: true, writable: true, value: (m: string) => (panggilan.push(String(m)), true) });
  await act(async () => {
    tombol[0].dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 60));
  });
  const rekap = c().week!.anggaran.find((a) => a.kode === "7948")!;
  cek("realisasi baris rekap tersimpan", rekap.realisasi === 55000000, JSON.stringify(rekap));
  const p = buildPayload(c().week!, "tok", "Uji", true);
  const kirim = p.keuangan.find((x) => x.kode === "7948");
  cek("kiriman rekap memakai paksa", !!kirim && kirim.paksa === true, JSON.stringify(p.keuangan));

  /* baris rincian tetap biasa */
  const rinci = Array.from(document.querySelectorAll('input[inputmode="numeric"]')) as HTMLInputElement[];
  await act(async () => {
    await isi(rinci[3], "31000000"); // 7948.ADF realisasi
  });
  Object.defineProperty(window, "confirm", { configurable: true, writable: true, value: (m: string) => (panggilan.push(String(m)), false) });
  const sebelum = panggilan.length;
  await act(async () => {
    (Array.from(document.querySelectorAll("button")).filter((b) => (b.textContent ?? "").includes("Simpan"))[0] as HTMLButtonElement).dispatchEvent(
      new window.MouseEvent("click", { bubbles: true }),
    );
    await new Promise((r) => setTimeout(r, 60));
  });
  cek("baris rincian tidak minta konfirmasi", panggilan.length === sebelum, JSON.stringify(panggilan));
  const p2 = buildPayload(c().week!, "tok", "Uji", true);
  const adf = p2.keuangan.find((x) => x.kode === "7948.ADF");
  cek("baris rincian terkirim tanpa paksa", !!adf && adf.paksa === undefined && adf.realisasi === 31000000, JSON.stringify(p2.keuangan));

  Object.defineProperty(window, "confirm", { configurable: true, writable: true, value: konfirmAsli });
  const lulus = hasil.filter((h) => h.lulus).length;
  hasil.filter((h) => !h.lulus).forEach((h) => console.log("  GAGAL:", h.nama, "→", h.info));
  console.log(`\n${lulus}/${hasil.length} uji keuangan (baris rekap) lulus`);
  globalThis.fetch = fetchAsli;
  process.exit(lulus === hasil.length ? 0 : 1);
}

void main();
