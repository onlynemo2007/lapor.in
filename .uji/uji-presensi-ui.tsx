import { act } from "react";
import { createRoot } from "react-dom/client";
import { ToastProvider } from "../src/components/ui";
import { AppProvider, useApp } from "../src/lib/store";
import { buildPayload } from "../src/lib/sheet";
import PresensiView from "../src/views/PresensiView";

const CSV = [
  "LAPORAN MINGGU I BULAN NOVEMBER 2026,,,,,,,",
  ",,A,KEGIATAN TIM,,,,",
  "No,,Tim,Tanggal,Uraian,,,",
  ',,Humas,2 November 2026,"a1",,,',
  ",,C,REKAPITULASI KEHADIRAN,,,,",
  "No,,Tanggal,Kehadiran,Tidak Masuk,Dinas Luar,Cuti,,",
  ",,2 November 2026,50,,,1,,",
  ",,,,,,,",
  "Rekapitulasi Penggunaan Aplikasi Presensi,,,,,,,",
  "No,Nama Pegawai,Sikepo,e-Presensi,Finger Print,Tidak Presensi,Cuti/DL,",
  "1,Budi Santoso,5,5,4,,1,",
  "2,Siti Aminah,5,4,4,1,,",
].join("\n");

let aktif: ReturnType<typeof useApp> | null = null;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  if (init?.method === "POST") return { ok: true, text: async () => JSON.stringify({ ok: true, versi: "2.1", ditulis: 1, gagal: [] }) } as unknown as Response;
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
          <PresensiView />
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

  cek("tabel aplikasi presensi terbaca", !!c().week!.aplikasiTabel, JSON.stringify(Object.keys(c().week!)));
  const nilaiInput = Array.from(document.querySelectorAll("input")).map((i) => (i as HTMLInputElement).value);
  cek("nama pegawai muncul", nilaiInput.includes("Budi Santoso") && nilaiInput.includes("Siti Aminah"), JSON.stringify(nilaiInput));
  const td = Array.from(document.querySelectorAll("td")).map((x) => (x.textContent ?? "").trim());
  cek("kolom No tampil sebagai teks (tidak bisa diubah)", td.includes("1") && td.includes("2"), JSON.stringify(td.slice(0, 10)));
  cek("judul kolom sheet dipakai", /Nama Pegawai/.test(teks()) && /Finger Print/.test(teks()), teks().slice(0, 300));
  cek("judul asal tabel ditampilkan", /Rekapitulasi Penggunaan Aplikasi Presensi/i.test(teks()), "");
  cek("angka penggunaan tampil", /5/.test(teks()), "");

  /* ubah satu sel: Sikepo Budi 5 → 6 */
  const budi = c().week!.aplikasiTabel!.baris[0];
  const kunci = `${budi.nomor}:2`;
  await act(async () => {
    c().setSettings({ autoSync: false });
  });
  const input = Array.from(document.querySelectorAll("input")).find((i) => (i as HTMLInputElement).value === "5") as HTMLInputElement | undefined;
  cek("sel angka bisa diisi", !!input, JSON.stringify(Array.from(document.querySelectorAll("input")).map((i) => (i as HTMLInputElement).value)));
  await act(async () => {
    if (input) await isi(input, "6");
  });
  const simpan = Array.from(document.querySelectorAll("button")).find((b) => (b.textContent ?? "").includes("Simpan")) as HTMLButtonElement;
  await act(async () => {
    simpan.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 80));
  });
  cek("isian sel tersimpan", c().week!.selKeuangan[kunci] === "6", JSON.stringify(c().week!.selKeuangan));
  cek("ditandai belum terkirim", c().week!.dirty[`K:${kunci}`] === true, JSON.stringify(c().week!.dirty));

  const p = buildPayload(c().week!, "tok", "Uji", true);
  const sel = p.sel.find((x) => x.baris === budi.nomor && x.kolom === 2);
  cek("payload memuat sel itu", !!sel && sel.nilai === "6", JSON.stringify(p.sel));
  cek("payload membawa label baris", !!sel && sel.label === budi.label && sel.labelKolom === budi.labelKolom, JSON.stringify(sel));

  const lulus = hasil.filter((h) => h.lulus).length;
  hasil.filter((h) => !h.lulus).forEach((h) => console.log("  GAGAL:", h.nama, "→", h.info));
  console.log(`\n${lulus}/${hasil.length} uji Presensi (UI) lulus`);
  process.exit(lulus === hasil.length ? 0 : 1);
}

void main();
