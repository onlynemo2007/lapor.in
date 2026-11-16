import { act } from "react";
import { createRoot } from "react-dom/client";
import { ToastProvider } from "../src/components/ui";
import { AppProvider, useApp } from "../src/lib/store";
import IsiView from "../src/views/IsiView";
import DashboardView from "../src/views/DashboardView";

/* Uji pembatasan tim per pengguna:
   - pegawai hanya bisa mengisi/mengedit tim utamanya (Form cepat, Asisten chat, Rencana)
   - tim lain dari tautan (?tim=…) diabaikan
   - admin (PIN) dan pengguna yang belum memilih tim tetap bisa semua tim */

const CSV = [
  "LAPORAN MINGGU I BULAN NOVEMBER 2026,,,,,,,,",
  ",,A,KEGIATAN TIM,,,,,,",
  "No,,Tim,Tanggal,Uraian,,,,,Link Bukti Dukung",
  ",,Humas,2 November 2026,,,,,,",
  ",,,3 November 2026,,,,,,",
  ",,Hukum,2 November 2026,,,,,,",
  ",,,3 November 2026,,,,,,",
  ",,B,RENCANA KEGIATAN TIM,,,,,,",
  "No,,Tim,Uraian,,,,,,",
  ",,Humas,,,,,,,",
  ",,Hukum,,,,,,,",
].join("\n");

// jsdom belum punya scrollTo pada elemen (dipakai panel chat)
if (globalThis.HTMLElement) (globalThis.HTMLElement.prototype as unknown as { scrollTo: () => void }).scrollTo = () => {};

let aktif: ReturnType<typeof useApp> | null = null;

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  if (init?.method === "POST") {
    return { ok: true, text: async () => JSON.stringify({ ok: true, versi: "2.4", ditulis: 1, gagal: [] }) } as unknown as Response;
  }
  if (url.includes("aksi=ping")) return { ok: true, json: async () => ({ ok: false }), text: async () => "" } as unknown as Response;
  return { ok: true, text: async () => CSV, json: async () => ({}) } as unknown as Response;
}) as typeof fetch;

function Probe() {
  aktif = useApp();
  return null;
}

const teks = () => document.body.textContent ?? "";
const tombolTeks = (label: string) =>
  Array.from(document.querySelectorAll("button")).find((b) => (b.textContent ?? "").trim() === label) as HTMLButtonElement | undefined;
const chipTim = () => Array.from(document.querySelectorAll("[data-pemilih-tim] button")) as HTMLButtonElement[];
const kartuRencana = () =>
  Array.from(document.querySelectorAll("[data-rencana-tim]")).map((b) => (b as HTMLElement).dataset.rencanaTim ?? "");

let root: ReturnType<typeof createRoot> | null = null;

async function buka(
  params: string,
  pengaturan: Record<string, unknown> = { timUtama: "humas" },
  tampilan: "isi" | "dashboard" = "isi",
) {
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
    JSON.stringify({ v: 2, settings: { nama: "Uji", ...pengaturan }, weeks: {}, trend: {}, log: [] }),
  );
  root = createRoot(w);
  aktif = null;
  await act(async () => {
    root!.render(
      <ToastProvider>
        <AppProvider>
          <Probe />
          {tampilan === "dashboard" ? <DashboardView /> : <IsiView params={new URLSearchParams(params)} />}
        </AppProvider>
      </ToastProvider>,
    );
    await new Promise((r) => setTimeout(r, tampilan === "dashboard" ? 700 : 260));
  });
}

async function main() {
  const hasil: { nama: string; lulus: boolean; info?: string }[] = [];
  const cek = (nama: string, lulus: boolean, info = "") => hasil.push({ nama, lulus, info });

  /* ---------------------------- 1. form cepat ---------------------------- */
  await buka("");
  const chips = chipTim();
  cek("form cepat: hanya tim sendiri yang tampil", chips.length === 1, chips.map((b) => b.textContent).join("|"));
  cek("form cepat: chip bertuliskan tim utama", (chips[0]?.textContent ?? "").trim() === "Humas Datin", chips[0]?.textContent ?? "");
  cek("form cepat: penanda “hanya tim Anda”", /hanya tim Anda/i.test(teks()));
  cek("form cepat: keterangan kunci tim", /Isian dikunci untuk tim\s*Humas Datin/i.test(teks()), teks().slice(0, 300));

  /* tautan tim lain (?tim=hukum) tidak boleh mengubah tim aktif */
  await buka("tim=hukum");
  const chips2 = chipTim();
  cek("tautan tim lain: tim tetap tim sendiri", chips2.length === 1 && (chips2[0].textContent ?? "").trim() === "Humas Datin", chips2.map((b) => b.textContent).join("|"));
  cek("tautan tim lain: pengguna diberi tahu", /Isian dibatasi untuk tim Humas Datin/i.test(teks()), teks().slice(0, 400));

  /* ------------------------- 2. rencana minggu depan ------------------------- */
  await buka("mode=rencana");
  const kartu = kartuRencana();
  cek("rencana: hanya kartu tim sendiri", kartu.join("|") === "humas", kartu.join("|"));
  cek("rencana: penjelasan kunci tim", /Rencana dikunci untuk tim\s*Humas Datin/i.test(teks()), teks().slice(0, 300));

  /* ---------------------------- 3. asisten chat ---------------------------- */
  await buka("mode=chat");
  await act(async () => {
    await new Promise((r) => setTimeout(r, 1200));
  });
  const tc = teks();
  cek("chat: langsung memakai tim sendiri", /dikunci untuk tim\s*Humas Datin/i.test(tc), tc.slice(0, 300));
  cek("chat: tidak ditawari tim lain", !/atau tim lain/i.test(tc), tc.slice(0, 300));
  cek("chat: lanjut ke pertanyaan hari", /Hari apa yang mau diisi/i.test(tc), tc.slice(0, 400));
  const chipChat = chipTim().map((b) => (b.textContent ?? "").trim());
  cek(
    "chat: chip yang tampil adalah hari, bukan tim",
    chipChat.length > 0 && chipChat.some((x) => /Sen|Sel|Rab|Kam|Jum/i.test(x)),
    chipChat.join("|"),
  );
  cek("chat: tidak ada tombol ganti tim", !chipChat.includes("Ganti tim"), chipChat.join("|"));

  /* ---------------------- 4. admin boleh semua tim ---------------------- */
  await buka("", { timUtama: "humas", pinAdmin: "1234" });
  const chipsAdmin = chipTim();
  cek("mode admin: semua tim tampil", chipsAdmin.length === 10, String(chipsAdmin.length));
  cek("mode admin: tanpa penanda kunci", !/hanya tim Anda/i.test(teks()));

  await buka("mode=rencana", { timUtama: "humas", pinAdmin: "1234" });
  cek("mode admin: semua kartu rencana tampil", kartuRencana().length === 10, kartuRencana().join("|"));

  /* ------------------ 5. belum memilih tim → bebas memilih ------------------ */
  await buka("", { timUtama: "" });
  cek("tanpa tim utama: semua tim tampil", chipTim().length === 10, String(chipTim().length));

  /* ------------------------- 6. tim Program (sub) ------------------------- */
  await buka("", { timUtama: "program" });
  const chipsProgram = chipTim();
  cek("tim Program: chip hanya Program dan Monev", chipsProgram.length === 1 && (chipsProgram[0].textContent ?? "").trim() === "Program dan Monev", chipsProgram.map((b) => b.textContent).join("|"));
  cek("tim Program: pilihan Program/Monev tetap ada", !!tombolTeks("Program") && !!tombolTeks("Monev"), teks().slice(0, 200));

  /* ------------------ 7. peta isian dashboard ikut terkunci ------------------ */
  await buka("", { timUtama: "humas" }, "dashboard");
  const semua = Array.from(document.querySelectorAll("button"));
  const terkunciDash = semua.filter((b) => (b as HTMLButtonElement).disabled && /hanya tim Humas Datin/i.test(b.getAttribute("title") ?? ""));
  const tombolHumas = semua.filter((b) => !(b as HTMLButtonElement).disabled && /^Humas Datin ·/.test(b.getAttribute("title") ?? ""));
  cek("dashboard: sel tim lain dinonaktifkan", terkunciDash.length > 0, String(terkunciDash.length));
  cek("dashboard: sel tim sendiri tetap bisa dibuka", tombolHumas.length > 0, String(tombolHumas.length));
  cek("dashboard: daftar belum isi menandai “tim lain”", /tim lain/i.test(teks()), teks().slice(0, 200));

  await buka("", { timUtama: "humas", pinAdmin: "1234" }, "dashboard");
  const nonaktifAdmin = Array.from(document.querySelectorAll("button")).filter((b) => (b as HTMLButtonElement).disabled);
  cek("dashboard: mode admin tidak mengunci sel tim lain", nonaktifAdmin.length === 0, String(nonaktifAdmin.length));

  /* --------------------------- 7. simpan tetap aman --------------------------- */
  cek("pengisi tetap tercatat", !!aktif?.settings.nama);

  const lulus = hasil.filter((h) => h.lulus).length;
  hasil.filter((h) => !h.lulus).forEach((h) => console.log("  GAGAL:", h.nama, "→", h.info));
  console.log(`\n${lulus}/${hasil.length} uji batas tim lulus`);
  process.exit(lulus === hasil.length ? 0 : 1);
}

void main();
