import { act } from "react";
import { createRoot } from "react-dom/client";
import App from "../src/App";
import LandingView from "../src/views/LandingView";
import { NAV } from "../src/components/Shell";
import { ALAMAT_MINGGUAN, ALAMAT_WFH, VIEW_AWAL, ruteDariHash, viewAwal } from "../src/lib/rute";

const ID_MENU = NAV.map((n) => n.id);

const CSV = [
  "LAPORAN MINGGU I BULAN NOVEMBER 2026,,,,,,",
  ",,A,KEGIATAN TIM,,,,",
  "No,,Tim,Tanggal,Uraian,,,",
  ',,Humas,2 November 2026,"a1",,,',
  ",,B,RENCANA KEGIATAN TIM,,,,",
  "No,,Tim,Uraian,,,,",
  ",,Humas,,,,,,",
].join("\n");

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  if (init?.method === "POST") {
    return { ok: true, text: async () => JSON.stringify({ ok: true, versi: "2.3", ditulis: 1, gagal: [] }) } as unknown as Response;
  }
  const url = String(input);
  if (url.includes("aksi=ping")) return { ok: true, json: async () => ({ ok: false }), text: async () => "" } as unknown as Response;
  return { ok: true, text: async () => CSV, json: async () => ({}) } as unknown as Response;
}) as typeof fetch;

async function main() {
  const hasil: { nama: string; lulus: boolean; info?: string }[] = [];
  const cek = (nama: string, lulus: boolean, info = "") => hasil.push({ nama, lulus, info });

  /* ---------------- routing: alamat utama = halaman pilih ---------------- */
  cek("alamat utama (tanpa hash) = halaman pilih", ruteDariHash("", ID_MENU).view === VIEW_AWAL, ruteDariHash("", ID_MENU).view);
  cek('"#" dan "#/" juga halaman pilih', ruteDariHash("#", ID_MENU).view === VIEW_AWAL && ruteDariHash("#/", ID_MENU).view === VIEW_AWAL);
  cek('"#/isi" = laporan mingguan', ruteDariHash("#/isi", ID_MENU).view === "isi", ruteDariHash("#/isi", ID_MENU).view);
  cek('"#/wfh" = laporan WFH', ruteDariHash("#/wfh", ID_MENU).view === "wfh", ruteDariHash("#/wfh", ID_MENU).view);
  cek('"#/wfh/" (garis miring di ujung) tetap WFH', ruteDariHash("#/wfh/", ID_MENU).view === "wfh");
  cek("parameter ikut terbaca", ruteDariHash("#/sinkron?buat=1", ID_MENU).params.get("buat") === "1");
  cek('"#/dashboard" tetap dashboard', ruteDariHash("#/dashboard", ID_MENU).view === "dashboard");
  cek("hash tak dikenal → halaman pilih (tidak kosong)", ruteDariHash("#/entah", ID_MENU).view === VIEW_AWAL, ruteDariHash("#/entah", ID_MENU).view);
  cek("viewAwal hanya untuk halaman pilih", viewAwal(VIEW_AWAL) && !viewAwal("dashboard") && !viewAwal("isi"));
  cek("halaman pilih tidak ikut jadi item menu", !ID_MENU.includes(VIEW_AWAL), ID_MENU.join(","));

  /* ---------------- tampilan halaman pilih ---------------- */
  const wadah = document.createElement("div");
  document.body.appendChild(wadah);
  const root = createRoot(wadah);
  await act(async () => {
    root.render(<LandingView />);
  });

  const teks = () => document.body.textContent ?? "";
  const kartu = Array.from(document.querySelectorAll("a[data-pilihan]")) as HTMLAnchorElement[];
  const ambil = (id: string) => kartu.find((a) => a.getAttribute("data-pilihan") === id);

  cek("dua pilihan tampil", kartu.length === 2, kartu.map((a) => a.getAttribute("data-pilihan")).join(","));
  cek("judul pertanyaan tampil", teks().includes("Mau isi laporan apa hari ini?"), teks().slice(0, 120));
  cek("kartu laporan mingguan ada", !!ambil("mingguan") && (ambil("mingguan")!.textContent ?? "").includes("Laporan Mingguan"));
  cek("kartu laporan WFH ada", !!ambil("wfh") && (ambil("wfh")!.textContent ?? "").includes("Laporan WFH"));
  cek("kartu mingguan menuju #/isi", ambil("mingguan")?.getAttribute("href") === ALAMAT_MINGGUAN, ambil("mingguan")?.getAttribute("href") ?? "");
  cek("kartu WFH menuju #/wfh", ambil("wfh")?.getAttribute("href") === ALAMAT_WFH, ambil("wfh")?.getAttribute("href") ?? "");
  cek("tautan langsung #/isi dan #/wfh disebut", teks().includes("#/isi") && teks().includes("#/wfh"));
  cek("ada jalan ke dashboard", !!Array.from(document.querySelectorAll("a")).find((a) => a.getAttribute("href") === "#/dashboard"));
  cek("halaman pilih tanpa sidebar/bilah menu", !teks().includes("Realisasi Keuangan") && !teks().includes("Pratinjau & Cetak"));

  /* ---------------- aplikasi nyata: alamat utama vs tautan langsung ---------------- */
  localStorage.setItem(
    "laporin:v3",
    JSON.stringify({ v: 2, settings: { nama: "Uji", timUtama: "humas" }, weeks: {}, trend: {}, log: [] }),
  );
  window.location.hash = "";
  document.body.innerHTML = "";
  const wadah2 = document.createElement("div");
  document.body.appendChild(wadah2);
  const root2 = createRoot(wadah2);
  await act(async () => {
    root2.render(<App />);
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 60));
  });

  cek("buka alamat utama → halaman pilih", teks().includes("Mau isi laporan apa hari ini?"), teks().slice(0, 120));

  // klik kartu WFH seperti pengguna
  await act(async () => {
    window.location.hash = "#/wfh";
    window.dispatchEvent(new window.Event("hashchange"));
  });
  cek("pilih WFH → halaman WFH terbuka", teks().includes("Laporan WFH Pegawai") && !teks().includes("Mau isi laporan apa hari ini?"), teks().slice(0, 120));
  cek("sidebar muncul lagi setelah masuk aplikasi", teks().includes("Realisasi Keuangan"));

  await act(async () => {
    window.location.hash = "#/isi";
    window.dispatchEvent(new window.Event("hashchange"));
  });
  cek("tautan langsung #/isi → isi laporan mingguan", teks().includes("Isi laporan"), teks().slice(0, 120));

  await act(async () => {
    window.location.hash = "";
    window.dispatchEvent(new window.Event("hashchange"));
  });
  cek("logo/«halaman pilih» bisa kembali ke halaman pilih", teks().includes("Mau isi laporan apa hari ini?"));

  const lulus = hasil.filter((h) => h.lulus).length;
  for (const h of hasil) console.log(`${h.lulus ? "✓" : "✗"} ${h.nama}${h.info ? ` — ${h.info}` : ""}`);
  console.log(`\n${lulus}/${hasil.length} lulus`);
  process.exit(lulus === hasil.length ? 0 : 1);
}

await main();
