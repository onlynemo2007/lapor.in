import { act } from "react";
import { createRoot } from "react-dom/client";
import { ToastProvider } from "../src/components/ui";
import { AppProvider, useApp } from "../src/lib/store";
import SinkronView from "../src/views/SinkronView";
import { bolehBukaKoneksi } from "../src/lib/sheet";

/* Uji kunci koneksi Apps Script:
   - kode skrip, tombol Salin kode, dan pengaturan URL/token hanya terbuka di mode admin (PIN)
   - perangkat yang belum tersambung tetap bisa menyiapkan koneksi
   - skrip yang belum punya PIN_ADMIN tetap boleh menyalin kode (masa peralihan) */

const TABS = [{ name: "Nov I", gid: "1192874962" }];

const CSV = [
  "LAPORAN MINGGU I BULAN NOVEMBER 2026,,,,,,",
  ",,A,KEGIATAN TIM,,,,",
  "No,,Tim,Tanggal,Uraian,,,",
  ',,Keuangan,2 November 2026,"rapat internal",,,',
  ",,B,RENCANA KEGIATAN TIM,,,,",
  "No,,Tim,Uraian,,,,",
  ",,Keuangan,,,,,",
].join("\n");

let ping = { ok: true, versi: "2.4", terbaru: TABS[0].gid, dibuka: [] as string[], adaPin: true, tabs: TABS };

// jsdom belum punya scrollIntoView
if (globalThis.Element) (globalThis.Element.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = () => {};

let aktif: ReturnType<typeof useApp> | null = null;

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  if (init?.method === "POST") {
    return { ok: true, text: async () => JSON.stringify({ ok: true, versi: "2.4", ditulis: 1, gagal: [] }) } as unknown as Response;
  }
  if (url.includes("aksi=ping")) {
    return { ok: true, json: async () => ping, text: async () => JSON.stringify(ping) } as unknown as Response;
  }
  if (url.includes("aksi=pin")) {
    const pin = decodeURIComponent(/pin=([^&]*)/.exec(url)?.[1] ?? "");
    return { ok: true, json: async () => ({ ok: pin === "1234", adaPin: true }), text: async () => "" } as unknown as Response;
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

async function buka(pengaturan: Record<string, unknown> = {}) {
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
        activeGid: TABS[0].gid,
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
          <SinkronView params={new URLSearchParams("")} />
        </AppProvider>
      </ToastProvider>,
    );
    await new Promise((r) => setTimeout(r, 260));
  });
}

async function main() {
  const hasil: { nama: string; lulus: boolean; info?: string }[] = [];
  const cek = (nama: string, lulus: boolean, info = "") => hasil.push({ nama, lulus, info });

  /* ------------------- 0. aturan dasar (fungsi murni) ------------------- */
  cek("aturan: admin selalu boleh", bolehBukaKoneksi(true, true, { adaPin: true }) === true);
  cek("aturan: bukan admin ditolak", bolehBukaKoneksi(false, true, { adaPin: true }) === false);
  cek("aturan: belum tersambung boleh disiapkan", bolehBukaKoneksi(false, false, { adaPin: true }) === true);
  cek("aturan: skrip tanpa PIN_ADMIN boleh", bolehBukaKoneksi(false, true, { adaPin: false }) === true);
  cek("aturan: info skrip belum terbaca tetap terkunci", bolehBukaKoneksi(false, true, null) === false);

  /* --------------------- 1. bukan admin → terkunci --------------------- */
  ping = { ok: true, versi: "2.4", terbaru: TABS[0].gid, dibuka: [], adaPin: true, tabs: TABS };
  await buka();
  const t1 = teks();
  cek("bukan admin: penanda “Perlu PIN admin”", /Perlu PIN admin/i.test(t1), t1.slice(0, 300));
  cek("bukan admin: tanpa tombol Lihat kode", !tombolTeks("Lihat kode"));
  cek("bukan admin: tanpa tombol Salin kode", !tombolTeks("Salin kode"));
  cek("bukan admin: tanpa tombol Ubah koneksi", !tombolTeks("Ubah koneksi"));
  cek("bukan admin: kotak kode dijelaskan terkunci", /terkunci/i.test(t1) && /mode admin/i.test(t1), t1.slice(0, 400));
  cek("bukan admin: tanpa blok kode skrip", !document.querySelector("#kode-skrip pre"));
  cek("bukan admin: kolom URL/token tidak tampil", !document.querySelector('input[placeholder="https://script.google.com/macros/s/…/exec"]'));
  cek("bukan admin: tombol buka mode admin ada", !!tombolTeks("Buka mode admin (PIN)"));

  /* ------------------------- 2. admin → terbuka ------------------------- */
  await buka({ pinAdmin: "1234" });
  const t2 = teks();
  cek("admin: tanpa penanda kunci", !/Perlu PIN admin/i.test(t2));
  cek("admin: tombol Lihat kode tersedia", !!tombolTeks("Lihat kode"), t2.slice(0, 200));
  cek("admin: tombol Salin kode tersedia", !!tombolTeks("Salin kode"));
  cek("admin: tombol Ubah koneksi tersedia", !!tombolTeks("Ubah koneksi"));
  const lihat = tombolTeks("Lihat kode");
  if (lihat) {
    await act(async () => {
      lihat.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 60));
    });
  }
  cek("admin: kode skrip bisa dibuka", !!document.querySelector("#kode-skrip pre"));

  /* ------------- 3. skrip belum punya PIN_ADMIN → transisi ------------- */
  ping = { ok: true, versi: "2.3", terbaru: TABS[0].gid, dibuka: [], adaPin: false, tabs: TABS };
  await buka();
  const t3 = teks();
  cek("tanpa PIN_ADMIN: kode tetap bisa disalin", !!tombolTeks("Salin kode"), t3.slice(0, 300));
  cek("tanpa PIN_ADMIN: dijelaskan masa peralihan", /PIN_ADMIN/i.test(t3));
  cek("tanpa PIN_ADMIN: tanpa penanda kunci koneksi", !/Perlu PIN admin/i.test(t3));

  /* ------------- 4. perangkat belum tersambung → penyiapan ------------- */
  ping = { ok: true, versi: "2.4", terbaru: TABS[0].gid, dibuka: [], adaPin: true, tabs: TABS };
  await buka({ scriptUrl: "", token: "" });
  const t4 = teks();
  cek("belum tersambung: form penyiapan tampil", !!document.querySelector('input[placeholder="https://script.google.com/macros/s/…/exec"]'), t4.slice(0, 300));
  cek("belum tersambung: judul penyiapan", /pasang Apps Script/i.test(t4));

  /* ----------------- 5. tombol buka mode admin aman diklik --------------- */
  await buka();
  const bukaAdmin = tombolTeks("Buka mode admin (PIN)");
  let aman = true;
  if (bukaAdmin) {
    await act(async () => {
      try {
        bukaAdmin.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        await new Promise((r) => setTimeout(r, 120));
      } catch {
        aman = false;
      }
    });
  }
  cek("tombol buka mode admin bisa diklik", aman && !!aktif);

  const lulus = hasil.filter((h) => h.lulus).length;
  hasil.filter((h) => !h.lulus).forEach((h) => console.log("  GAGAL:", h.nama, "→", h.info));
  console.log(`\n${lulus}/${hasil.length} uji kunci koneksi lulus`);
  process.exit(lulus === hasil.length ? 0 : 1);
}

void main();
