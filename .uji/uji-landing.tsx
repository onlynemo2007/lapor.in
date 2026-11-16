import { act } from "react";
import { createRoot } from "react-dom/client";
import App from "../src/App";
import LandingView from "../src/views/LandingView";
import DashboardView from "../src/views/DashboardView";
import { NAV } from "../src/components/Shell";
import { AppProvider } from "../src/lib/store";
import { ToastProvider } from "../src/components/ui";
import { ALAMAT_MINGGUAN, VIEW_AWAL, ruteDariHash, viewAwal } from "../src/lib/rute";
import { WFH_URL_BAWAAN, tautanWfhPendek } from "../src/lib/wfh";

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
  cek("parameter ikut terbaca", ruteDariHash("#/sinkron?buat=1", ID_MENU).params.get("buat") === "1");
  cek('"#/dashboard" tetap dashboard', ruteDariHash("#/dashboard", ID_MENU).view === "dashboard");
  cek("hash tak dikenal → halaman pilih (tidak kosong)", ruteDariHash("#/entah", ID_MENU).view === VIEW_AWAL, ruteDariHash("#/entah", ID_MENU).view);
  cek("viewAwal hanya untuk halaman pilih", viewAwal(VIEW_AWAL) && !viewAwal("dashboard") && !viewAwal("isi"));
  cek("halaman pilih tidak ikut jadi item menu", !ID_MENU.includes(VIEW_AWAL), ID_MENU.join(","));

  /* ---------------- WFH bukan menu di dashboard ---------------- */
  cek("menu Laporan WFH sudah tidak ada", !ID_MENU.includes("wfh"), ID_MENU.join(","));
  cek("navigasi tinggal 6 menu", NAV.length === 6, String(NAV.length));
  cek('tautan lama "#/wfh" jatuh ke halaman pilih', ruteDariHash("#/wfh", ID_MENU).view === VIEW_AWAL, ruteDariHash("#/wfh", ID_MENU).view);
  cek(
    "alamat formulir WFH berupa /exec Apps Script",
    /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(WFH_URL_BAWAAN),
    WFH_URL_BAWAAN.slice(0, 48) + "…",
  );
  cek("alamat WFH dipendekkan untuk layar", /^script\.google\.com\/…\/AKfycbw2…\/exec$/.test(tautanWfhPendek(WFH_URL_BAWAAN)), tautanWfhPendek(WFH_URL_BAWAAN));

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
  cek("kartu WFH menuju aplikasi WFH", ambil("wfh")?.getAttribute("href") === WFH_URL_BAWAAN, ambil("wfh")?.getAttribute("href") ?? "");
  cek("kartu WFH terbuka di tab baru", ambil("wfh")?.getAttribute("target") === "_blank" && ambil("wfh")?.getAttribute("rel") === "noreferrer");
  cek("kartu WFH ditandai tautan luar", ambil("wfh")?.getAttribute("data-luar") === "1");
  cek("kartu mingguan tetap di aplikasi ini", !ambil("mingguan")?.getAttribute("target"));
  cek("alamat formulir WFH ditampilkan pendek", teks().includes("script.google.com/…/AKfycbw2…/exec"));
  cek("tautan langsung #/isi disebut", teks().includes("#/isi"));
  cek("tidak ada lagi janji halaman #/wfh", !teks().includes("#/wfh"));
  cek("ada jalan ke dashboard", !!Array.from(document.querySelectorAll("a")).find((a) => a.getAttribute("href") === "#/dashboard"));
  cek("halaman pilih tanpa sidebar/bilah menu", !teks().includes("Realisasi Keuangan") && !teks().includes("Pratinjau & Cetak"));

  /* ---------------- dashboard tanpa kartu WFH ---------------- */
  localStorage.setItem(
    "laporin:v3",
    JSON.stringify({ v: 2, settings: { nama: "Uji", timUtama: "humas" }, weeks: {}, trend: {}, log: [] }),
  );
  document.body.innerHTML = "";
  const wadahD = document.createElement("div");
  document.body.appendChild(wadahD);
  const rootD = createRoot(wadahD);
  await act(async () => {
    rootD.render(
      <ToastProvider>
        <AppProvider>
          <DashboardView />
        </AppProvider>
      </ToastProvider>,
    );
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 60));
  });
  const teksD = document.body.textContent ?? "";
  cek("dashboard tidak lagi memuat kartu/formulir WFH", !teksD.includes("Isi formulir WFH") && !/Laporan WFH/.test(teksD), teksD.slice(0, 120));

  /* ---------------- aplikasi nyata: alamat utama vs tautan langsung ---------------- */
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

  await act(async () => {
    window.location.hash = "#/isi";
    window.dispatchEvent(new window.Event("hashchange"));
  });
  cek("pilih laporan mingguan → Isi Laporan terbuka", teks().includes("Isi laporan"), teks().slice(0, 120));
  cek("sidebar muncul setelah masuk aplikasi", teks().includes("Realisasi Keuangan"));
  cek("sidebar tanpa menu WFH", !teks().includes("Laporan WFH"));

  await act(async () => {
    window.location.hash = "#/dashboard";
    window.dispatchEvent(new window.Event("hashchange"));
  });
  cek("dashboard bisa dibuka & tanpa WFH", /Halo/.test(teks()) && !/Laporan WFH/.test(teks()), teks().slice(0, 160));

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
