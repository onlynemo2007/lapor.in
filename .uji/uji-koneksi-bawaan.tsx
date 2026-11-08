import { act } from "react";
import { createRoot } from "react-dom/client";
import { AppProvider, useApp } from "../src/lib/store";
import { PeringatanKoneksi } from "../src/components/Koneksi";

/* Berkas ini dibundel dengan:
   --define:import.meta.env={"VITE_SCRIPT_URL":"…","VITE_TOKEN":"…"}
   meniru Environment Variables yang diisi saat build (mis. di Vercel). */

const CSV = [
  "LAPORAN MINGGU I BULAN NOVEMBER 2026,,,,,,",
  ",,A,KEGIATAN TIM,,,,",
  "No,,Tim,Tanggal,Uraian,,,",
  ',,Keuangan,2 November 2026,"k1",,,',
  ",,B,RENCANA KEGIATAN TIM,,,,",
  "No,,Tim,Uraian,,,,",
  ",,Keuangan,,,,,",
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
const URL_LAIN = "https://script.google.com/macros/s/LAIN/exec";

async function main() {
  /* 1) Perangkat baru: tersambung sendiri dari koneksi bawaan build */
  let root = await buka("#/dashboard");
  cek("perangkat baru otomatis tersambung", aktif!.settings.scriptUrl === import.meta.env.VITE_SCRIPT_URL && aktif!.settings.token === import.meta.env.VITE_TOKEN, aktif!.settings.scriptUrl);
  cek("sinkron otomatis aktif sejak awal", aktif!.settings.autoSync === true);
  cek("tidak ada banner “belum tersambung”", !/belum tersambung ke Google Sheet/.test(teks()));
  cek("koneksi bawaan ikut tersimpan di perangkat", simpanan().scriptUrl === import.meta.env.VITE_SCRIPT_URL, JSON.stringify(simpanan()));

  /* 2) Koneksi milik perangkat tetap menang */
  root = await buka("#/dashboard", { scriptUrl: URL_LAIN, token: "token-lain", autoSync: true });
  cek("koneksi tersimpan menang atas koneksi bawaan", aktif!.settings.scriptUrl === URL_LAIN && aktif!.settings.token === "token-lain", aktif!.settings.scriptUrl);

  /* 3) Putus koneksi tetap dihormati */
  root = await buka("#/dashboard", { scriptUrl: "", token: "", putus: true });
  cek("perangkat yang diputus tidak dipaksa tersambung", aktif!.settings.scriptUrl === "" && aktif!.settings.token === "", aktif!.settings.scriptUrl);
  cek("banner tampil untuk perangkat yang diputus", /belum tersambung ke Google Sheet/.test(teks()));

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
