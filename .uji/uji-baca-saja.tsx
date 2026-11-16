import { act } from "react";
import { createRoot } from "react-dom/client";
import { ToastProvider } from "../src/components/ui";
import { AppProvider, useApp } from "../src/lib/store";
import IsiView from "../src/views/IsiView";

/* Uji minggu lama = baca-saja:
   - isi laporan (form cepat, rencana, asisten chat) hanya menampilkan isian
   - tidak ada tombol simpan / kotak isian / kolom tautan baru
   - mode admin (PIN) membuka kembali pengeditan */

const LAMA = "1192874962";
const BARU = "2525123456";

const TABS = [
  { name: "Nov III", gid: BARU },
  { name: "Nov II", gid: "1338555942" },
  { name: "Nov I", gid: LAMA },
];

const CSV = [
  "LAPORAN MINGGU I BULAN NOVEMBER 2026,,,,,,,,",
  ",,A,KEGIATAN TIM,,,,,,",
  "No,,Tim,Tanggal,Uraian,,,,,Link Bukti Dukung",
  ',,Keuangan,2 November 2026,"rapat internal",,,,,',
  ",,,3 November 2026,,,,,,",
  ",,B,RENCANA KEGIATAN TIM,,,,,,",
  "No,,Tim,Uraian,,,,,,",
  ",,Keuangan,,,,,,,",
].join("\n");

const ping = { ok: true, versi: "2.4", terbaru: BARU, dibuka: [] as string[], adaPin: true, tabs: TABS };

// jsdom belum punya scrollTo pada elemen (dipakai panel chat)
if (globalThis.HTMLElement) (globalThis.HTMLElement.prototype as unknown as { scrollTo: () => void }).scrollTo = () => {};

let aktif: ReturnType<typeof useApp> | null = null;

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  if (init?.method === "POST") {
    return { ok: true, text: async () => JSON.stringify({ ok: true, versi: "2.4", ditulis: 1, gagal: [] }) } as unknown as Response;
  }
  if (url.includes("aksi=ping")) {
    return { ok: true, json: async () => ping, text: async () => JSON.stringify(ping) } as unknown as Response;
  }
  return { ok: true, text: async () => CSV, json: async () => ({}) } as unknown as Response;
}) as typeof fetch;

function Probe() {
  aktif = useApp();
  return null;
}

const teks = () => document.body.textContent ?? "";
const tombolTeks = (label: string) =>
  Array.from(document.querySelectorAll("button")).find((b) => (b.textContent ?? "").trim() === label) as HTMLButtonElement | undefined;
const semuaTombol = () => Array.from(document.querySelectorAll("button"));

let root: ReturnType<typeof createRoot> | null = null;

/** Tunggu sampai info skrip (minggu terbaru) terbaca dari ping. */
async function tungguSkrip(ms = 4000) {
  const akhir = Date.now() + ms;
  while (Date.now() < akhir) {
    if (aktif?.skripInfo?.terbaru) return;
    await act(async () => {
      await new Promise((r) => setTimeout(r, 60));
    });
  }
}

/** Pindah ke minggu lama seperti pengguna memilih tab (bukan saat aplikasi dibuka). */
async function keMingguLama(ms = 4000) {
  await act(async () => {
    aktif!.setSettings({ activeGid: LAMA });
    await new Promise((r) => setTimeout(r, 80));
  });
  const akhir = Date.now() + ms;
  while (Date.now() < akhir) {
    if (aktif?.week?.gid === LAMA && aktif?.settings.activeGid === LAMA) return;
    await act(async () => {
      await new Promise((r) => setTimeout(r, 60));
    });
  }
}

async function buka(params: string, pengaturan: Record<string, unknown> = {}) {
  if (root) {
    const lama = root;
    await act(async () => {
      lama.unmount();
    });
    root = null;
  }
  document.body.innerHTML = "";
  const w = document.createElement("div");
  document.body.appendChild(w);
  localStorage.clear();
  localStorage.setItem(
    "laporin:v3",
    JSON.stringify({
      v: 2,
      settings: {
        nama: "Uji",
        timUtama: "keuangan",
        scriptUrl: "https://script.google.com/macros/s/UJI/exec",
        token: "tok",
        autoSync: true,
        activeGid: BARU,
        ...pengaturan,
      },
      weeks: {},
      trend: {},
      log: [],
    }),
  );
  root = createRoot(w);
  aktif = null;
  await act(async () => {
    root!.render(
      <ToastProvider>
        <AppProvider>
          <Probe />
          <IsiView params={new URLSearchParams(params)} />
        </AppProvider>
      </ToastProvider>,
    );
    await new Promise((r) => setTimeout(r, 160));
  });
  await tungguSkrip();
}

async function main() {
  const hasil: { nama: string; lulus: boolean; info?: string }[] = [];
  const cek = (nama: string, lulus: boolean, info = "") => hasil.push({ nama, lulus, info });

  /* ------------------------- 1. form cepat baca-saja ------------------------- */
  await buka("");
  await keMingguLama();
  cek("pengguna bisa membuka minggu lama", aktif!.settings.activeGid === LAMA, aktif!.settings.activeGid);
  cek("status baca-saja aktif", aktif!.bacaSaja === true);
  cek("spanduk “hanya bisa dilihat”", /hanya bisa\s+dilihat/i.test(teks()), teks().slice(0, 400));
  cek("spanduk menyarankan menu Kunci minggu", /Kunci minggu/i.test(teks()));
  cek("isian ditampilkan tanpa kotak edit", !!document.querySelector("[data-baca-saja]"));
  cek("tidak ada kotak isian (textarea) di form", document.querySelectorAll("textarea").length === 0, String(document.querySelectorAll("textarea").length));
  cek("tidak ada tombol Simpan", !semuaTombol().some((b) => /^Simpan/.test((b.textContent ?? "").trim())));
  cek("tidak ada tombol Rapikan", !tombolTeks("Rapikan"));
  cek("tidak ada kolom tautan baru", !document.querySelector('input[placeholder^="https://drive"]'));
  cek("isi lama tetap terbaca", /rapat internal/i.test(teks()), teks().slice(0, 300));

  /* ----------------------- 2. rencana minggu depan ----------------------- */
  await buka("mode=rencana");
  await keMingguLama();
  cek("rencana: penjelasan baca-saja", /hanya bisa dilihat/i.test(teks()) && /Rencana tidak bisa diubah/i.test(teks()), teks().slice(0, 400));
  cek("rencana: editor diganti tampilan baca", !!document.querySelector("[data-baca-saja]"));
  cek("rencana: tanpa tombol simpan", !semuaTombol().some((b) => /Simpan rencana/.test(b.textContent ?? "")));

  /* ------------------------- 3. asisten chat baca-saja ------------------------- */
  await buka("mode=chat");
  await keMingguLama();
  await act(async () => {
    await new Promise((r) => setTimeout(r, 400));
  });
  cek("chat: kartu baca-saja", /hanya bisa dilihat/i.test(teks()), teks().slice(0, 300));
  cek("chat: tidak ada kotak ketik", document.querySelectorAll("input").length === 0, String(document.querySelectorAll("input").length));
  cek("chat: tidak menawarkan pengisian", !/Hari apa yang mau diisi/i.test(teks()), teks().slice(0, 300));

  /* ------------------------ 4. admin boleh mengedit ------------------------ */
  await buka("", { pinAdmin: "1234" });
  await keMingguLama();
  cek("admin: bukan baca-saja", aktif!.bacaSaja === false);
  cek("admin: kotak isian kembali ada", document.querySelectorAll("textarea").length > 0, String(document.querySelectorAll("textarea").length));
  cek("admin: tombol simpan tersedia", semuaTombol().some((b) => /^Simpan/.test((b.textContent ?? "").trim())));
  cek("admin: spanduk baca-saja hilang", !/hanya bisa\s+dilihat/i.test(teks()));

  await buka("mode=chat", { pinAdmin: "1234" });
  await keMingguLama();
  await act(async () => {
    await new Promise((r) => setTimeout(r, 900));
  });
  cek("admin: chat aktif (bisa mengisi)", document.querySelectorAll("input").length > 0, teks().slice(0, 200));
  cek("admin: chat menawarkan pengisian", /Isi untuk tim|tim mana|Hari apa yang mau diisi/i.test(teks()), teks().slice(0, 300));

  const lulus = hasil.filter((h) => h.lulus).length;
  hasil.filter((h) => !h.lulus).forEach((h) => console.log("  GAGAL:", h.nama, "→", h.info));
  console.log(`\n${lulus}/${hasil.length} uji baca-saja lulus`);
  process.exit(lulus === hasil.length ? 0 : 1);
}

void main();
