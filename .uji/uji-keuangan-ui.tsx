import { act } from "react";
import { createRoot } from "react-dom/client";
import { ToastProvider } from "../src/components/ui";
import { AppProvider, useApp } from "../src/lib/store";
import { buildPayload } from "../src/lib/sheet";
import KeuanganView from "../src/views/KeuanganView";

const CSV = [
  "LAPORAN MINGGU I BULAN NOVEMBER 2025,,,,,,",
  ",,A,KEGIATAN TIM,,,,",
  "No,,Tim,Tanggal,Uraian,,,",
  ',,Humas,3 November 2025,"Satu butir",,,',
  ",,,,,,,",
  ",,D,REALISASI KEUANGAN,,,,",
  "No,Kode,Uraian,Pagu,Realisasi,,",
  '1,032.12.01,"Perjalanan dinas",100000000,25000000,,',
  '2,032.12.02,"Sewa kendaraan",50000000,10000000,,',
  ",,Total,150000000,35000000,,",
].join("\n");

let aktif: ReturnType<typeof useApp> | null = null;
const fetchAsli = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  if (init?.method === "POST") return { ok: true, text: async () => JSON.stringify({ ok: true, versi: "1.7", ditulis: 1, gagal: [] }) } as unknown as Response;
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

  localStorage.setItem("laporin:v3", JSON.stringify({ v: 2, settings: { nama: "Uji", timUtama: "humas" }, weeks: {}, trend: {}, log: [] }));

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
  const teks = () => document.body.textContent ?? "";
  cek("tabel bagian D terbaca", c().week!.anggaran.length === 2, JSON.stringify(c().week!.anggaran));
  const nilaiInput = Array.from(document.querySelectorAll("input")).map((i) => (i as HTMLInputElement).value);
  cek("kode tampil di layar", teks().includes("032.12.01") && teks().includes("032.12.02"), teks().slice(0, 400));
  cek("uraian terisi di kolom", nilaiInput.includes("Sewa kendaraan") && nilaiInput.includes("Perjalanan dinas"), JSON.stringify(nilaiInput.slice(0, 8)));
  cek("total pagu tampil", /150\.000\.000/.test(teks()), teks().slice(0, 200));

  const angka = Array.from(document.querySelectorAll('input[inputmode="numeric"]')) as HTMLInputElement[];
  cek("dua kolom angka per baris", angka.length === 4, String(angka.length));

  /* ubah realisasi baris pertama: 25.000.000 → 40.000.000 */
  await act(async () => {
    await isi(angka[1], "40000000");
  });
  const simpan = Array.from(document.querySelectorAll("button")).find((b) => (b.textContent ?? "").includes("Simpan")) as HTMLButtonElement;
  cek("tombol simpan aktif", !!simpan && !simpan.disabled, String(simpan?.disabled));
  await act(async () => {
    simpan.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 60));
  });

  const a1 = c().week!.anggaran.find((a) => a.kode === "032.12.01")!;
  cek("realisasi tersimpan lokal", a1.realisasi === 40000000, JSON.stringify(a1));
  cek("pagu tidak ikut berubah", a1.pagu === 100000000, JSON.stringify(a1));
  cek("baris lain tidak berubah", c().week!.anggaran.find((a) => a.kode === "032.12.02")!.realisasi === 10000000);
  cek("ditandai belum terkirim", c().week!.dirty["R:032.12.01"] === true, JSON.stringify(c().week!.dirty));

  const p = buildPayload(c().week!, "tok", "Uji", true);
  const k = p.keuangan.find((x) => x.kode === "032.12.01");
  cek("payload memuat baris itu", !!k && k.realisasi === 40000000 && k.pagu === 100000000, JSON.stringify(p.keuangan));
  cek("hanya satu baris terkirim", p.keuangan.length === 1, JSON.stringify(p.keuangan));

  /* ubah pagu juga ikut terkirim */
  await act(async () => {
    await isi(angka[2], "60000000");
  });
  const simpan2 = Array.from(document.querySelectorAll("button")).find((b) => (b.textContent ?? "").includes("Simpan")) as HTMLButtonElement;
  await act(async () => {
    simpan2.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 60));
  });
  cek("pagu baris kedua tersimpan", c().week!.anggaran.find((a) => a.kode === "032.12.02")!.pagu === 60000000, JSON.stringify(c().week!.anggaran));

  const lulus = hasil.filter((h) => h.lulus).length;
  hasil.filter((h) => !h.lulus).forEach((h) => console.log("  GAGAL:", h.nama, "→", h.info));
  console.log(`\n${lulus}/${hasil.length} uji Keuangan (UI) lulus`);
  globalThis.fetch = fetchAsli;
  process.exit(lulus === hasil.length ? 0 : 1);
}

void main();
