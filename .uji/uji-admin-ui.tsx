import { act } from "react";
import { createRoot } from "react-dom/client";
import { AppProvider, useApp } from "../src/lib/store";

/* Uji alur admin & kunci minggu di sisi aplikasi:
   - PIN admin diverifikasi ke skrip (skrip lama tidak dianggap benar)
   - minggu lama dikenali sebagai terkunci
   - kirim tanpa nama ditahan sebelum menyentuh sheet
   - konflik anti-timpa menghentikan pengiriman & membuang isian basi */

const CSV = [
  "LAPORAN MINGGU I BULAN NOVEMBER 2026,,,,,,",
  ",,A,KEGIATAN TIM,,,,",
  "No,,Tim,Tanggal,Uraian,,,",
  ',,Keuangan,2 November 2026,"rapat internal",,,',
  ",,B,RENCANA KEGIATAN TIM,,,,",
  "No,,Tim,Uraian,,,,",
  ",,Keuangan,rencana lama,,,,",
].join("\n");

const hasil: { nama: string; lulus: boolean; info?: string }[] = [];
const cek = (nama: string, lulus: boolean, info = "") => hasil.push({ nama, lulus, info });
const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));

/** Balasan skrip yang bisa diubah per uji. */
let ping = { ok: true, versi: "2.2", terbaru: "222", dibuka: [] as string[], adaPin: true, tabs: [{ name: "Nov I", gid: "1192874962" }] };
let pinBenar = "1234";
let balasanPost: Record<string, unknown> = { ok: true, ditulis: 1, gagal: [], konflik: [] };
const kiriman: Record<string, unknown>[] = [];

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  if (init?.method === "POST") {
    kiriman.push(JSON.parse(String(init.body ?? "{}")) as Record<string, unknown>);
    return { ok: true, text: async () => JSON.stringify(balasanPost), json: async () => balasanPost } as unknown as Response;
  }
  // "aksi=ping" juga mengandung "aksi=pin" → periksa ping lebih dulu.
  if (url.includes("aksi=ping")) {
    return { ok: true, json: async () => ping, text: async () => JSON.stringify(ping) } as unknown as Response;
  }
  if (url.includes("aksi=pin")) {
    const pin = decodeURIComponent(url.split("pin=")[1] ?? "");
    return { ok: true, json: async () => ({ ok: pin === pinBenar, adaPin: true, versi: "2.2" }), text: async () => "" } as unknown as Response;
  }
  return { ok: true, text: async () => CSV, json: async () => ({}) } as unknown as Response;
}) as typeof fetch;

let aktif: ReturnType<typeof useApp> | null = null;
function Probe() {
  aktif = useApp();
  return null;
}

const wadah = document.createElement("div");
document.body.appendChild(wadah);

let root: ReturnType<typeof createRoot> | null = null;

async function buka(pengaturan: Record<string, unknown> = {}) {
  // Provider lama harus dilepas: kalau tidak, Probe-nya bisa menimpa `aktif` belakangan.
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
    JSON.stringify({ v: 2, settings: { nama: "Uji", timUtama: "keuangan", scriptUrl: "https://script.google.com/macros/s/UJI/exec", token: "tok", autoSync: true, ...pengaturan }, weeks: {}, trend: {}, log: [] }),
  );
  root = createRoot(w);
  aktif = null;
  await act(async () => {
    root!.render(
      <AppProvider>
        <Probe />
      </AppProvider>,
    );
    await tunggu(40);
  });
}

async function main() {
  /* 1) minggu lama → terkunci */
  ping = { ok: true, versi: "2.2", terbaru: "999", dibuka: [], adaPin: true, tabs: [{ name: "Nov I", gid: "1192874962" }] };
  await buka();
  cek("tab lama dikenali terkunci", aktif!.terkunciAktif === true, JSON.stringify({ gid: aktif!.settings.activeGid, info: aktif!.skripInfo }));

  ping = { ...ping, terbaru: "1192874962" };
  await buka();
  cek("tab terbaru tidak terkunci", aktif!.terkunciAktif === false);

  ping = { ok: true, versi: "2.2", terbaru: "999", dibuka: ["1192874962"], adaPin: true, tabs: [] };
  await buka();
  cek("tab yang dibuka admin tidak terkunci", aktif!.terkunciAktif === false);

  /* 2) PIN admin */
  ping = { ok: true, versi: "2.2", terbaru: "1192874962", dibuka: [], adaPin: true, tabs: [] };
  await buka();
  const pinBenarHasil = await aktif!.masukAdmin("1234");
  await act(async () => {
    await tunggu(20);
  });
  cek("PIN benar diterima", pinBenarHasil.ok === true && aktif!.settings.pinAdmin === "1234", JSON.stringify(pinBenarHasil));

  await buka();
  const pinSalahHasil = await aktif!.masukAdmin("9999");
  cek("PIN salah ditolak", pinSalahHasil.ok === false && /PIN admin salah/.test(pinSalahHasil.error ?? ""), JSON.stringify(pinSalahHasil));
  cek("PIN salah tidak disimpan", !aktif!.settings.pinAdmin);

  /* 3) nama wajib sebelum mengirim */
  await buka({ nama: "" });
  await act(async () => {
    aktif!.updateWeek((w) => ({ ...w, rencana: { ...w.rencana, keuangan: ["rencana baru"] }, dirty: { "B:keuangan": true }, meta: { "B:keuangan": { oleh: "", at: Date.now() } } }));
    await tunggu(20);
  });
  kiriman.length = 0;
  await act(async () => {
    await aktif!.syncNow();
    await tunggu(30);
  });
  cek("tanpa nama tidak ada kiriman", kiriman.length === 0, JSON.stringify(kiriman));
  cek("status jadi “nama”", aktif!.syncState.status === "nama", aktif!.syncState.status);

  /* 4) dengan nama → terkirim, memuat nama pengisi */
  await buka({ nama: "Rani" });
  await act(async () => {
    aktif!.updateWeek((w) => ({ ...w, rencana: { ...w.rencana, keuangan: ["rencana baru"] }, dirty: { "B:keuangan": true }, meta: { "B:keuangan": { oleh: "Rani", at: Date.now() } } }));
    await tunggu(20);
  });
  kiriman.length = 0;
  await act(async () => {
    await aktif!.syncNow();
    await tunggu(30);
  });
  cek("kiriman membawa nama pengisi", kiriman[0]?.oleh === "Rani" && (kiriman[0]?.rencana as unknown[])?.length === 1, JSON.stringify(kiriman[0]));

  /* 5) anti-timpa: skrip melaporkan konflik → isian basi dibuang, kiriman berhenti */
  await buka({ nama: "Rani" });
  await act(async () => {
    aktif!.updateWeek((w) => ({ ...w, rencana: { ...w.rencana, keuangan: ["versi saya"] }, dirty: { "B:keuangan": true }, meta: { "B:keuangan": { oleh: "Rani", at: Date.now() } } }));
    await tunggu(20);
  });
  balasanPost = { ok: true, ditulis: 0, gagal: [], konflik: ["rencana keuangan"] };
  await act(async () => {
    await aktif!.syncNow();
    await tunggu(40);
  });
  cek("status jadi “konflik”", aktif!.syncState.status === "konflik", aktif!.syncState.status);
  cek("isian bentrok tidak dikirim ulang", Object.keys(aktif!.week?.dirty ?? {}).length === 0, JSON.stringify(aktif!.week?.dirty));

  /* 6) kirim ulang seluruh tab menyertakan penuh + PIN */
  balasanPost = { ok: true, ditulis: 1, gagal: [], konflik: [] };
  await buka({ nama: "Rani", pinAdmin: "1234" });
  kiriman.length = 0;
  await act(async () => {
    aktif!.kirimSemua();
    await tunggu(1500);
  });
  // Tunggu jeda tulis otomatis, lalu kirim paksa agar tidak bergantung timing timer jsdom.
  await act(async () => {
    await aktif!.syncNow();
    await tunggu(60);
  });
  const paketPenuh = kiriman.find((k) => k.penuh === true);
  cek("kirim ulang penuh ditandai & memakai PIN", !!paketPenuh && paketPenuh.pin === "1234", JSON.stringify(kiriman.map((k) => ({ penuh: k.penuh, pin: k.pin }))));

  await act(async () => {
    root?.unmount();
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
