import { act } from "react";
import { createRoot } from "react-dom/client";
import { AppProvider, useApp } from "../src/lib/store";
import { PeringatanKoneksi } from "../src/components/Koneksi";
import { tautanSiapPakai } from "../src/lib/koneksi";

/* CSV kecil yang cukup untuk satu tab mingguan. */
const CSV = [
  "LAPORAN MINGGU I BULAN NOVEMBER 2026,,,,,,",
  ",,A,KEGIATAN TIM,,,,",
  "No,,Tim,Tanggal,Uraian,,,",
  ',,Keuangan,2 November 2026,"k1",,,',
  ",,B,RENCANA KEGIATAN TIM,,,,",
  "No,,Tim,Uraian,,,,",
  ",,Keuangan,,,,,",
  ",,C,REKAPITULASI KEHADIRAN,,,,",
  "No,,Tanggal,Kehadiran,Tidak Masuk,Dinas Luar,Cuti,,",
  ",,2 November 2026,,,,,,",
].join("\n");

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  if (init?.method === "POST") return { ok: true, text: async () => JSON.stringify({ ok: true }) } as unknown as Response;
  const url = String(input);
  if (url.includes("aksi=ping")) return { ok: true, json: async () => ({ ok: false }), text: async () => "" } as unknown as Response;
  return { ok: true, text: async () => CSV, json: async () => ({}) } as unknown as Response;
}) as typeof fetch;

const hasil: { nama: string; lulus: boolean; info?: string }[] = [];
const cek = (nama: string, lulus: boolean, info = "") => hasil.push({ nama, lulus, info });
const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));

let aktif: ReturnType<typeof useApp> | null = null;
function Probe() {
  aktif = useApp();
  return <PeringatanKoneksi />;
}

const wadah = document.createElement("div");
document.body.appendChild(wadah);

/** Pasang aplikasi baru (seperti membuka tautan di perangkat lain). */
async function buka(hash: string, simpanan?: unknown) {
  document.body.innerHTML = "";
  const w = document.createElement("div");
  document.body.appendChild(w);
  localStorage.clear();
  if (simpanan !== undefined) localStorage.setItem("laporin:koneksi", JSON.stringify(simpanan));
  window.location.hash = hash;
  const root = createRoot(w);
  aktif = null;
  await act(async () => {
    root.render(
      <AppProvider>
        <Probe />
      </AppProvider>,
    );
    await tunggu(30);
  });
  return root;
}

const teks = () => document.body.textContent ?? "";
const simpanan = () => JSON.parse(localStorage.getItem("laporin:koneksi") ?? "{}");

const URL_A = "https://script.google.com/macros/s/AAA/exec";
const URL_B = "https://script.google.com/macros/s/BBB/exec";
const tautanB = tautanSiapPakai("https://laporin-psi.vercel.app", "/", { scriptUrl: URL_B, token: "token-b" });

async function main() {
  /* 1) Perangkat baru tanpa koneksi: terbaca dari sheet, tetapi belum tersambung */
  let root = await buka("#/dashboard");
  cek("perangkat baru tanpa koneksi → URL kosong", aktif!.settings.scriptUrl === "", aktif!.settings.scriptUrl);
  cek("banner “belum tersambung” tampil", /belum tersambung ke Google Sheet/.test(teks()));
  cek("banner menjelaskan isian belum masuk sheet", /belum masuk ke sheet/.test(teks()));
  cek("sheet tetap terbaca walau belum tersambung", !!aktif!.week && aktif!.dibacaAt !== undefined);

  /* 2) Tautan siap pakai di perangkat baru → langsung tersambung tanpa klik */
  root = await buka(new URL(tautanB).hash);
  await act(async () => {
    await tunggu(60);
  });
  cek("tautan siap pakai langsung menyambungkan perangkat", aktif!.settings.scriptUrl === URL_B && aktif!.settings.token === "token-b", JSON.stringify(aktif!.settings));
  cek("sinkron otomatis ikut aktif", aktif!.settings.autoSync === true);
  cek("token dibersihkan dari address bar", !window.location.hash.includes("setup"), window.location.hash);
  cek("koneksi tersimpan di perangkat", simpanan().scriptUrl === URL_B && simpanan().putus === false, JSON.stringify(simpanan()));
  cek("banner hilang setelah tersambung", !/belum tersambung ke Google Sheet/.test(teks()));

  /* 3) Perangkat yang sudah tersambung tidak ditimpa tautan lain */
  root = await buka(new URL(tautanB).hash, { scriptUrl: URL_A, token: "token-a", autoSync: true });
  await act(async () => {
    await tunggu(60);
  });
  cek("koneksi perangkat menang atas tautan", aktif!.settings.scriptUrl === URL_A && aktif!.settings.token === "token-a", aktif!.settings.scriptUrl);
  cek("tautan tetap ditawarkan sebagai kartu", !!aktif!.tautan && aktif!.tautan.scriptUrl === URL_B);

  /* 4) Putuskan koneksi dihormati saat halaman dibuka lagi */
  root = await buka("#/dashboard", { scriptUrl: URL_A, token: "token-a", autoSync: true });
  const putus = aktif!.putuskanKoneksi;
  await act(async () => {
    putus();
    await tunggu(20);
  });
  cek("putus koneksi mengosongkan URL/token", aktif!.settings.scriptUrl === "" && aktif!.settings.token === "", aktif!.settings.scriptUrl);
  cek("penanda putus tersimpan", simpanan().putus === true, JSON.stringify(simpanan()));
  cek("banner muncul kembali setelah diputus", /belum tersambung ke Google Sheet/.test(teks()));

  root = await buka("#/dashboard", { scriptUrl: "", token: "", putus: true });
  cek("perangkat yang diputus tetap kosong saat dibuka lagi", aktif!.settings.scriptUrl === "" && aktif!.settings.token === "");

  /* 5) Mengisi ulang URL/token membatalkan penanda putus */
  root = await buka("#/dashboard", { scriptUrl: "", token: "", putus: true });
  const set = aktif!.setSettings;
  await act(async () => {
    set({ scriptUrl: URL_A, token: "token-a" });
    await tunggu(20);
  });
  cek("isi ulang URL/token → tersambung lagi", aktif!.settings.scriptUrl === URL_A && aktif!.settings.token === "token-a");
  cek("penanda putus dibatalkan", simpanan().putus === false, JSON.stringify(simpanan()));

  await act(async () => {
    root.unmount();
  });

  let gagal = 0;
  hasil.forEach((h) => {
    if (!h.lulus) gagal += 1;
    console.log(`${h.lulus ? "✔" : "✘"} ${h.nama}${h.lulus || !h.info ? "" : ` — ${h.info}`}`);
  });
  console.log(`\n${hasil.length - gagal}/${hasil.length} cek lulus`);
  process.exit(gagal ? 1 : 0);
}

void main();
