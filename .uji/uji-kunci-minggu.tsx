import { act } from "react";
import { createRoot } from "react-dom/client";
import { ToastProvider } from "../src/components/ui";
import { AppProvider, useApp } from "../src/lib/store";
import Shell from "../src/components/Shell";

/* Uji penguncian minggu di sisi aplikasi:
   - saat dashboard/isi dibuka, tab dipindah otomatis ke minggu terbaru
   - minggu lama terkunci (baca-saja) kecuali admin membuka PIN / skrip membukanya
   - mode admin membolehkan minggu lama, menutup mode admin mengunci lagi */

const LAMA = "1192874962";
const BARU = "2525123456";

const TABS = [
  { name: "Nov III", gid: BARU },
  { name: "Nov II", gid: "1338555942" },
  { name: "Nov I", gid: LAMA },
];

const CSV = [
  "LAPORAN MINGGU III BULAN NOVEMBER 2026,,,,,,",
  ",,A,KEGIATAN TIM,,,,",
  "No,,Tim,Tanggal,Uraian,,,",
  ',,Keuangan,16 November 2026,"rapat internal",,,',
].join("\n");

let aktif: ReturnType<typeof useApp> | null = null;
let ping = { ok: true, versi: "2.4", terbaru: BARU, dibuka: [] as string[], adaPin: true, tabs: TABS };
const kiriman: Record<string, unknown>[] = [];

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  if (init?.method === "POST") {
    const isi = JSON.parse(String(init.body ?? "{}")) as Record<string, unknown>;
    kiriman.push(isi);
    return { ok: true, text: async () => JSON.stringify({ ok: true, ditulis: 1, gagal: [] }), json: async () => ({ ok: true }) } as unknown as Response;
  }
  // "aksi=ping" juga mengandung "aksi=pin" → periksa ping lebih dulu.
  if (url.includes("aksi=ping")) {
    return { ok: true, json: async () => ping, text: async () => JSON.stringify(ping) } as unknown as Response;
  }
  if (url.includes("aksi=pin")) {
    const pin = decodeURIComponent(/pin=([^&]*)/.exec(url)?.[1] ?? "");
    const benar = pin === "1234";
    const data = { ok: benar, adaPin: true };
    return { ok: true, json: async () => data, text: async () => JSON.stringify(data) } as unknown as Response;
  }
  return { ok: true, text: async () => CSV, json: async () => ({}) } as unknown as Response;
}) as typeof fetch;

function Probe() {
  aktif = useApp();
  return null;
}

const hasil: { nama: string; lulus: boolean; info?: string }[] = [];
const cek = (nama: string, lulus: boolean, info = "") => hasil.push({ nama, lulus, info });
const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));

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
        activeGid: LAMA,
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
      <AppProvider>
        <Probe />
      </AppProvider>,
    );
    await tunggu(120);
  });
}

async function main() {
  /* 1) dibuka dengan tab minggu lama → otomatis pindah ke minggu terbaru */
  ping = { ok: true, versi: "2.4", terbaru: BARU, dibuka: [], adaPin: true, tabs: TABS };
  await buka();
  cek("minggu terbaru terbaca dari skrip", aktif!.mingguTerbaru === BARU, aktif!.mingguTerbaru);
  cek("tab lama dipindah otomatis ke minggu terbaru", aktif!.settings.activeGid === BARU, aktif!.settings.activeGid);
  cek("minggu lama dikenali terkunci", aktif!.terkunciGid(LAMA) === true);
  cek("minggu lama tidak boleh dibuka", aktif!.bolehBukaMinggu(LAMA) === false);
  cek("minggu terbaru selalu boleh dibuka", aktif!.bolehBukaMinggu(BARU) === true);
  cek("tanpa mode admin", aktif!.admin === false);

  /* 2) admin memilih minggu lama tanpa PIN → langsung dikembalikan ke minggu terbaru */
  await act(async () => {
    aktif!.setSettings({ activeGid: LAMA });
    await tunggu(80);
  });
  cek("pilihan minggu lama tanpa admin ditolak", aktif!.settings.activeGid === BARU, aktif!.settings.activeGid);

  /* 3) skrip membuka minggu lama untuk koreksi → semua pengisi boleh */
  ping = { ok: true, versi: "2.4", terbaru: BARU, dibuka: [LAMA], adaPin: true, tabs: TABS };
  await buka({ activeGid: LAMA });
  cek("minggu yang dibuka skrip tidak terkunci", aktif!.terkunciGid(LAMA) === false);
  cek("minggu yang dibuka skrip boleh dipakai", aktif!.bolehBukaMinggu(LAMA) === true);
  cek("tab minggu lama tetap aktif", aktif!.settings.activeGid === LAMA, aktif!.settings.activeGid);

  /* 4) PIN admin benar → minggu lama boleh dibuka di perangkat ini */
  ping = { ok: true, versi: "2.4", terbaru: BARU, dibuka: [], adaPin: true, tabs: TABS };
  await buka();
  const pinSalah = await aktif!.masukAdmin("9999");
  cek("PIN salah ditolak", pinSalah.ok === false && aktif!.admin === false, JSON.stringify(pinSalah));
  const pinBenar = await aktif!.masukAdmin("1234");
  await act(async () => {
    await tunggu(60);
  });
  cek("PIN benar membuka mode admin", pinBenar.ok === true && aktif!.admin === true, JSON.stringify(pinBenar));
  await act(async () => {
    aktif!.setSettings({ activeGid: LAMA });
    await tunggu(80);
  });
  cek("mode admin boleh memilih minggu lama", aktif!.settings.activeGid === LAMA, aktif!.settings.activeGid);
  cek("mode admin membolehkan minggu lama", aktif!.bolehBukaMinggu(LAMA) === true);

  /* 5) mode admin ditutup → minggu lama terkunci lagi & tab kembali ke minggu terbaru */
  await act(async () => {
    aktif!.keluarAdmin();
    await tunggu(100);
  });
  cek("tutup mode admin mengunci lagi", aktif!.admin === false && aktif!.terkunciGid(LAMA) === true);
  cek("tab dikembalikan ke minggu terbaru", aktif!.settings.activeGid === BARU, aktif!.settings.activeGid);
  cek("isian lama tidak dikirim saat terkunci", kiriman.length === 0, JSON.stringify(kiriman));

  /* 6) tampilan: pemilih minggu mengunci tab lama & menu “Kunci minggu” bisa dibuka.
     Versi skrip sengaja dimundurkan untuk memastikan saran pembaruan tampil. */
  ping = { ok: true, versi: "2.3", terbaru: BARU, dibuka: [], adaPin: true, tabs: TABS };
  await buka();
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
        activeGid: LAMA,
      },
      weeks: {},
      trend: {},
      log: [],
    }),
  );
  const r = createRoot(w);
  await act(async () => {
    r.render(
      <ToastProvider>
        <AppProvider>
          <Shell view="isi">
            <p>isi</p>
          </Shell>
        </AppProvider>
      </ToastProvider>,
    );
    await tunggu(150);
  });
  const opsi = Array.from(document.querySelectorAll("select option")) as HTMLOptionElement[];
  const opsiLama = opsi.find((o) => o.value === LAMA);
  const opsiBaru = opsi.find((o) => o.value === BARU);
  cek("pemilih minggu menonaktifkan tab lama", !!opsiLama?.disabled, JSON.stringify(opsi.map((o) => [o.textContent, o.disabled])));
  cek("pemilih minggu menandai tab lama “terkunci”", /terkunci/.test(opsiLama?.textContent ?? ""), opsiLama?.textContent ?? "");
  cek("pemilih minggu membiarkan minggu terbaru", !!opsiBaru && opsiBaru.disabled === false);
  const tombolKunci = Array.from(document.querySelectorAll("button")).find((b) => /Kunci minggu/.test(b.textContent ?? ""));
  cek("tombol kunci minggu tersedia", !!tombolKunci);
  if (tombolKunci) {
    await act(async () => {
      tombolKunci.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await tunggu(60);
    });
    const t = document.body.textContent ?? "";
    cek("panel kunci minggu terbuka", t.includes("Minggu terbaru (Nov III) selalu bisa diisi"));
    cek("panel menandai minggu lama baca-saja", /Terkunci · baca-saja/.test(t));
    cek("panel menyediakan PIN admin", t.includes("PIN admin") && t.includes("Buka mode admin"));
    cek("panel menyarankan perbarui skrip v2.4", t.includes("v2.4 diperlukan agar minggu terbaru terbaca tepat"), "");
  }

  const lulus = hasil.filter((h) => h.lulus).length;
  hasil.filter((h) => !h.lulus).forEach((h) => console.log("  GAGAL:", h.nama, "→", h.info));
  console.log(`\n${lulus}/${hasil.length} uji kunci minggu lulus`);
  process.exit(lulus === hasil.length ? 0 : 1);
}

void main();
