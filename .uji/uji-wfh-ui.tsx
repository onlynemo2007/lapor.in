import { act } from "react";
import { createRoot } from "react-dom/client";
import { ToastProvider } from "../src/components/ui";
import { NAV } from "../src/components/Shell";
import { AppProvider, useApp } from "../src/lib/store";
import { WFH_URL_BAWAAN, tautanWfh, tautanWfhPendek } from "../src/lib/wfh";
import WfhView from "../src/views/WfhView";

let aktif: ReturnType<typeof useApp> | null = null;
const fetchAsli = globalThis.fetch;
globalThis.fetch = (async () => ({ ok: true, text: async () => "", json: async () => ({ ok: false }) }) as unknown as Response) as typeof fetch;

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

  /* --- tautan: hanya /exec yang diterima --- */
  cek("tautan bawaan dipakai bila kosong", tautanWfh("") === WFH_URL_BAWAAN);
  cek("tautan lain ditolak → bawaan", tautanWfh("https://contoh.test/form") === WFH_URL_BAWAAN);
  cek(
    "tautan Apps Script lain diterima",
    tautanWfh("https://script.google.com/macros/s/AKfycbContohPanjang123/exec") ===
      "https://script.google.com/macros/s/AKfycbContohPanjang123/exec",
  );
  cek("tautan panjang dipendekkan untuk layar", /^script\.google\.com\/…\/AKfycbw2…\/exec$/.test(tautanWfhPendek(WFH_URL_BAWAAN)), tautanWfhPendek(WFH_URL_BAWAAN));

  /* --- menu --- */
  const item = NAV.find((n) => n.id === "wfh");
  cek("menu Laporan WFH ada di navigasi", !!item && item.label === "Laporan WFH", JSON.stringify(NAV.map((n) => n.label)));

  /* --- tampilan --- */
  localStorage.setItem("laporin:v3", JSON.stringify({ v: 2, settings: { nama: "Uji", timUtama: "humas" }, weeks: {}, trend: {}, log: [] }));
  const wadah = document.createElement("div");
  document.body.appendChild(wadah);
  const root = createRoot(wadah);
  await act(async () => {
    root.render(
      <ToastProvider>
        <AppProvider>
          <Probe />
          <WfhView />
        </AppProvider>
      </ToastProvider>,
    );
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 50));
  });

  const teks = () => document.body.textContent ?? "";
  const tautan = Array.from(document.querySelectorAll("a")) as HTMLAnchorElement[];
  const buka = tautan.filter((a) => a.target === "_blank");
  cek("judul halaman tampil", teks().includes("Laporan WFH Pegawai"), teks().slice(0, 160));
  cek("tombol buka formulir menuju tautan bawaan", buka.length >= 1 && buka[0].href === WFH_URL_BAWAAN, JSON.stringify(buka.map((a) => a.href)));
  cek("langkah pemakaian dijelaskan", /Isi identitas sekali saja/.test(teks()) && /Isi kegiatan harian/.test(teks()));

  /* --- ganti tautan --- */
  const ganti = Array.from(document.querySelectorAll("button")).find((b) => (b.textContent ?? "").includes("Ganti tautan")) as HTMLButtonElement;
  await act(async () => {
    ganti.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  });
  const kolom = document.getElementById("wfh-url") as HTMLInputElement;
  cek("kolom tautan muncul saat pengaturan dibuka", !!kolom, String(!!kolom));
  await act(async () => {
    await isi(kolom, "https://script.google.com/macros/s/AKfycbBaruUntukUji/exec");
  });
  const simpan = Array.from(document.querySelectorAll("button")).find((b) => (b.textContent ?? "").includes("Simpan tautan")) as HTMLButtonElement;
  await act(async () => {
    simpan.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 30));
  });
  const c = () => aktif as unknown as ReturnType<typeof useApp>;
  cek("tautan baru tersimpan di pengaturan", c().settings.wfhUrl === "https://script.google.com/macros/s/AKfycbBaruUntukUji/exec", String(c().settings.wfhUrl));
  const tautanBaru = (Array.from(document.querySelectorAll("a")) as HTMLAnchorElement[]).filter((a) => a.target === "_blank");
  cek("tombol memakai tautan baru", tautanBaru[0].href === "https://script.google.com/macros/s/AKfycbBaruUntukUji/exec", JSON.stringify(tautanBaru.map((a) => a.href)));

  const lulus = hasil.filter((h) => h.lulus).length;
  hasil.filter((h) => !h.lulus).forEach((h) => console.log("  GAGAL:", h.nama, "→", h.info));
  console.log(`\n${lulus}/${hasil.length} uji Laporan WFH lulus`);
  globalThis.fetch = fetchAsli;
  process.exit(lulus === hasil.length ? 0 : 1);
}

void main();
