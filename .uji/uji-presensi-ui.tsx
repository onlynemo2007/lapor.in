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
  ",,2 November 2026,51,,,1,,",
  ",,,,,,,",
  "Rekapitulasi Penggunaan Aplikasi Presensi,,,,,,,",
  "No,Tanggal,Presensi Menggunakan Aplikasi,,,Tidak Presensi,Cuti/DL,",
  ",,Sikepo,Epresensi,Finger Print,,,,",
  "1,2 November 2026,51 pegawai,1 pegawai : Fatryandi (Absen pagi dan sore),1 pegawai : M. Akhirudin,1 pegawai : Firdaus (tidak absen sore rapat di GMB),3 Pegawai : Cuti : 3 Pegawai,",
  '2,3 November 2026,51 pegawai,"2 pegawai : Fatryandi (Absen pagi dan sore)",-,4 pegawai : Sri Yuni Astuti (Tidak absen pagi),4 Pegawai : Cuti : 2 Pegawai,',
].join("\n");

let aktif: ReturnType<typeof useApp> | null = null;
const terkirim: any[] = [];
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  if (init?.method === "POST") {
    try { terkirim.push(JSON.parse(String(init.body))); } catch { /* abaikan */ }
    return { ok: true, text: async () => JSON.stringify({ ok: true, versi: "2.1", ditulis: 1, gagal: [] }) } as unknown as Response;
  }
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
  const nilaiInput = () => Array.from(document.querySelectorAll("input")).map((i) => (i as HTMLInputElement).value);

  const t = c().week!.aplikasiTabel;
  cek("tabel aplikasi presensi terbaca", !!t, JSON.stringify(Object.keys(c().week!)));
  cek("tujuh kolom termasuk Tidak Presensi & Cuti/DL", !!t && t.kolom.length === 7, JSON.stringify(t?.kolom.map((k) => k.label)));
  cek("judul kelompok tampil", /Presensi Menggunakan Aplikasi/.test(teks()), teks().slice(0, 300));
  cek("rincian kolom tampil", /Sikepo/.test(teks()) && /Finger Print/.test(teks()) && /Cuti\/DL/.test(teks()), teks().slice(0, 400));
  cek("isi sel apa adanya (teks panjang)", nilaiInput().some((v) => /Fatryandi/.test(v)), JSON.stringify(nilaiInput()).slice(0, 300));
  cek("tanggal terbaca", nilaiInput().some((v) => /2 November 2026/.test(v)), JSON.stringify(nilaiInput()).slice(0, 300));
  cek("judul asal tabel tampil", /Rekapitulasi Penggunaan Aplikasi Presensi/.test(teks()), "");

  /* ubah satu sel teks: Sikepo baris 1 */
  await act(async () => {
    c().setSettings({ scriptUrl: "https://script.test/exec", token: "tok", autoSync: false });
  });
  const sel = Array.from(document.querySelectorAll("input")).find((i) => (i as HTMLInputElement).value === "51 pegawai") as HTMLInputElement | undefined;
  cek("sel teks bisa diubah", !!sel, JSON.stringify(nilaiInput()).slice(0, 200));
  await act(async () => {
    if (sel) await isi(sel, "52 pegawai");
  });
  const simpan = Array.from(document.querySelectorAll("button")).find((b) => (b.textContent ?? "").includes("Simpan")) as HTMLButtonElement;
  await act(async () => {
    simpan.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 80));
  });
  const baris1 = t!.baris[0];
  cek("isian teks tersimpan", c().week!.selKeuangan[`${baris1.nomor}:2`] === "52 pegawai", JSON.stringify(c().week!.selKeuangan));
  const p = buildPayload(c().week!, "tok", "Uji", true);
  cek("payload memuat teks itu", p.sel.some((x) => x.baris === baris1.nomor && x.kolom === 2 && x.nilai === "52 pegawai"), JSON.stringify(p.sel));
  cek("payload membawa label baris", p.sel.every((x) => x.label !== undefined && x.labelKolom !== undefined), JSON.stringify(p.sel));

  /* tambah baris */
  const tombol = Array.from(document.querySelectorAll("button")).find((b) => (b.textContent ?? "").includes("Tambah baris")) as HTMLButtonElement;
  cek("tombol tambah baris ada", !!tombol, "");
  await act(async () => {
    tombol.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 120));
  });
  const sisip = terkirim.map((x) => x.sisip?.[0]).filter(Boolean).pop();
  cek("kiriman sisip terkirim", !!sisip, JSON.stringify(terkirim.map((x) => Object.keys(x))));
  cek("sisip setelah baris terakhir", !!sisip && sisip.baris === baris1.nomor + 2 && sisip.acuan === baris1.nomor + 1, JSON.stringify(sisip));
  cek("nomor urut baris baru diisi", !!sisip && sisip.nilai?.[0] === "3", JSON.stringify(sisip?.nilai));
  cek("semua kolom tabel ikut", !!sisip && sisip.kolom.length === 7, JSON.stringify(sisip?.kolom));
  cek("tanda berhasil tampil", /ditambahkan di/.test(document.body.textContent ?? ""), (document.body.textContent ?? "").slice(-160));

  const lulus = hasil.filter((h) => h.lulus).length;
  hasil.filter((h) => !h.lulus).forEach((h) => console.log("  GAGAL:", h.nama, "→", h.info));
  console.log(`\n${lulus}/${hasil.length} uji Presensi (UI) lulus`);
  process.exit(lulus === hasil.length ? 0 : 1);
}

void main();
