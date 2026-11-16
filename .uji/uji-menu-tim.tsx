import { act } from "react";
import { createRoot } from "react-dom/client";
import { ToastProvider } from "../src/components/ui";
import { AppProvider, useApp } from "../src/lib/store";
import { bolehIsiMenu, timMenu } from "../src/lib/model";
import PresensiView from "../src/views/PresensiView";
import KeuanganView from "../src/views/KeuanganView";

/* Uji menu milik satu tim:
   - Presensi hanya boleh diisi/diubah/disimpan tim Kepegawaian
   - Realisasi keuangan hanya boleh diisi/diubah/disimpan tim Keuangan
   - tim lain hanya melihat (isian read-only, tombol simpan nonaktif)
   - admin (PIN) dan pengguna yang belum memilih tim tetap bebas */

const CSV_PRESENSI = [
  "LAPORAN MINGGU I BULAN NOVEMBER 2026,,,,,,,",
  ",,A,KEGIATAN TIM,,,,,,",
  "No,,Tim,Tanggal,Uraian,,,,",
  ',,Humas,2 November 2026,"a1",,,,',
  ",,C,REKAPITULASI KEHADIRAN,,,,,,",
  "No,,Tanggal,Kehadiran,Tidak Masuk,Dinas Luar,Cuti,,",
  ",,2 November 2026,51,,,1,,",
  ",,,,,,,,",
  "Rekapitulasi Penggunaan Aplikasi Presensi,,,,,,,",
  "No,Tanggal,Presensi Menggunakan Aplikasi,,,Tidak Presensi,Cuti/DL,",
  ",,Sikepo,Epresensi,Finger Print,,,,",
  "1,2 November 2026,51 pegawai,1 pegawai,Finger,1 pegawai,Firdaus,,",
].join("\n");

const CSV_KEUANGAN = [
  "LAPORAN MINGGU I BULAN NOVEMBER 2026,,,,,,",
  ",,A,KEGIATAN TIM,,,,",
  "No,,Tim,Tanggal,Uraian,,,",
  ',,Humas,2 November 2026,"Satu butir",,,',
  ",,,,,,,",
  ",,D,REALISASI KEUANGAN,,,,",
  "Realisasi Anggaran,,,,,,",
  "No,Kode,Uraian,Pagu,Realisasi,,",
  '1,032.12.01,"Perjalanan dinas",100000000,25000000,,',
  '2,032.12.02,"Sewa kendaraan",50000000,10000000,,',
].join("\n");

let csv = CSV_PRESENSI;
let aktif: ReturnType<typeof useApp> | null = null;

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  if (init?.method === "POST") {
    return { ok: true, text: async () => JSON.stringify({ ok: true, versi: "2.4", ditulis: 1, gagal: [] }) } as unknown as Response;
  }
  const url = String(input);
  if (url.includes("aksi=ping")) return { ok: true, json: async () => ({ ok: false }), text: async () => "" } as unknown as Response;
  return { ok: true, text: async () => csv, json: async () => ({}) } as unknown as Response;
}) as typeof fetch;

function Probe() {
  aktif = useApp();
  return null;
}

const teks = () => document.body.textContent ?? "";
const semuaTombol = () => Array.from(document.querySelectorAll("button")) as HTMLButtonElement[];
const semuaInput = () =>
  [...Array.from(document.querySelectorAll("input")), ...Array.from(document.querySelectorAll("textarea"))] as (
    | HTMLInputElement
    | HTMLTextAreaElement
  )[];
const tombolTeks = (re: RegExp) => semuaTombol().find((b) => re.test((b.textContent ?? "").trim()));

let root: ReturnType<typeof createRoot> | null = null;

async function buka(view: "presensi" | "keuangan", pengaturan: Record<string, unknown>) {
  csv = view === "presensi" ? CSV_PRESENSI : CSV_KEUANGAN;
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
        scriptUrl: "https://script.google.com/macros/s/UJI/exec",
        token: "tok",
        autoSync: true,
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
          {view === "presensi" ? <PresensiView /> : <KeuanganView />}
        </AppProvider>
      </ToastProvider>,
    );
    for (let i = 0; i < 4; i++) await new Promise((r) => setTimeout(r, 70));
  });
}

async function main() {
  const hasil: { nama: string; lulus: boolean; info?: string }[] = [];
  const cek = (nama: string, lulus: boolean, info = "") => hasil.push({ nama, lulus, info });

  /* ------------------------- 1. aturan dasar ------------------------- */
  cek("aturan: tim Kepegawaian boleh isi presensi", bolehIsiMenu("kepegawaian", false, "presensi") === true);
  cek("aturan: tim lain tidak boleh isi presensi", bolehIsiMenu("humas", false, "presensi") === false);
  cek("aturan: tim Keuangan boleh isi keuangan", bolehIsiMenu("keuangan", false, "keuangan") === true);
  cek("aturan: tim Keuangan tidak boleh isi presensi", bolehIsiMenu("keuangan", false, "presensi") === false);
  cek("aturan: tim Kepegawaian tidak boleh isi keuangan", bolehIsiMenu("kepegawaian", false, "keuangan") === false);
  cek("aturan: admin boleh semua", bolehIsiMenu("humas", true, "presensi") && bolehIsiMenu("humas", true, "keuangan"));
  cek("aturan: belum pilih tim → bebas", bolehIsiMenu("", false, "presensi") && bolehIsiMenu("", false, "keuangan"));
  cek("label tim pemilik benar", timMenu("presensi")?.label === "Kepegawaian" && timMenu("keuangan")?.label === "Keuangan", `${timMenu("presensi")?.label} / ${timMenu("keuangan")?.label}`);

  /* ------------- 2. presensi: tim lain hanya boleh melihat ------------- */
  await buka("presensi", { timUtama: "humas" });
  const t1 = teks();
  cek("presensi: spanduk khusus tim Kepegawaian", /Presensi hanya bisa diisi, diubah, dan disimpan oleh tim\s*Kepegawaian/i.test(t1), t1.slice(0, 400));
  cek("presensi: semua isian read-only", semuaInput().length > 0 && semuaInput().every((i) => i.readOnly), `${semuaInput().filter((i) => !i.readOnly).length} bisa diketik`);
  const simpan1 = tombolTeks(/^Hanya lihat$|^Simpan presensi/);
  cek("presensi: tombol simpan jadi “Hanya lihat”", (simpan1?.textContent ?? "").trim() === "Hanya lihat", simpan1?.textContent ?? "");
  cek("presensi: tombol simpan nonaktif", !!simpan1?.disabled);
  cek("presensi: tanpa tombol Hitung hadir", !tombolTeks(/^Hitung hadir$/));
  cek("presensi: tambah baris nonaktif", semuaTombol().filter((b) => /Tambah baris/.test(b.textContent ?? "")).every((b) => b.disabled));

  /* ----------------- 3. presensi: tim Kepegawaian boleh ----------------- */
  await buka("presensi", { timUtama: "kepegawaian" });
  const t2 = teks();
  cek("presensi: tanpa spanduk tim", !/hanya bisa diisi, diubah, dan disimpan oleh tim/i.test(t2));
  cek("presensi: isian bisa diketik", semuaInput().some((i) => !i.readOnly), `${semuaInput().length} input`);
  cek("presensi: tombol Hitung hadir tersedia", !!tombolTeks(/^Hitung hadir$/));
  cek("presensi: label simpan normal", /Simpan presensi/.test(teks()));

  /* ------------- 4. keuangan: tim lain hanya boleh melihat ------------- */
  await buka("keuangan", { timUtama: "humas" });
  const t3 = teks();
  cek("keuangan: spanduk khusus tim Keuangan", /Realisasi keuangan hanya bisa diisi, diubah, dan disimpan oleh tim\s*Keuangan/i.test(t3), t3.slice(0, 400));
  // kotak "Cari kode / uraian" memang tetap bisa diketik (bukan isian data)
  const isianData = semuaInput().filter((i) => !/^Cari/i.test(i.getAttribute("placeholder") ?? ""));
  cek("keuangan: isian uang read-only", isianData.length > 0 && isianData.every((i) => i.readOnly), `${isianData.filter((i) => !i.readOnly).length} bisa diketik`);
  const simpan3 = tombolTeks(/^Hanya lihat$/);
  cek("keuangan: tombol simpan jadi “Hanya lihat”", !!simpan3 && simpan3.disabled, simpan3?.textContent ?? "");
  cek("keuangan: tambah baris nonaktif", semuaTombol().filter((b) => /Tambah baris/.test(b.textContent ?? "")).every((b) => b.disabled));

  /* ------------------ 5. keuangan: tim Keuangan boleh ------------------ */
  await buka("keuangan", { timUtama: "keuangan" });
  cek("keuangan: tanpa spanduk tim", !/hanya bisa diisi, diubah, dan disimpan oleh tim/i.test(teks()));
  cek("keuangan: isian bisa diketik", semuaInput().some((i) => !i.readOnly));
  cek("keuangan: tombol simpan normal", !!tombolTeks(/^Simpan/), teks().slice(0, 200));

  /* --------------------- 6. admin bebas semua menu --------------------- */
  await buka("keuangan", { timUtama: "humas", pinAdmin: "1234" });
  cek("admin: keuangan bisa diedit", semuaInput().some((i) => !i.readOnly) && !/hanya bisa diisi, diubah, dan disimpan oleh tim/i.test(teks()));
  await buka("presensi", { timUtama: "humas", pinAdmin: "1234" });
  cek("admin: presensi bisa diedit", semuaInput().some((i) => !i.readOnly) && !/hanya bisa diisi, diubah, dan disimpan oleh tim/i.test(teks()));

  /* ---------------- 7. belum memilih tim → bebas mengisi ---------------- */
  await buka("presensi", { timUtama: "" });
  cek("tanpa tim utama: presensi bisa diedit", semuaInput().some((i) => !i.readOnly), teks().slice(0, 200));
  await buka("keuangan", { timUtama: "" });
  cek("tanpa tim utama: keuangan bisa diedit", semuaInput().some((i) => !i.readOnly));

  cek("minggu tetap terbaca", !!aktif?.week);

  const lulus = hasil.filter((h) => h.lulus).length;
  hasil.filter((h) => !h.lulus).forEach((h) => console.log("  GAGAL:", h.nama, "→", h.info));
  console.log(`\n${lulus}/${hasil.length} uji menu milik tim lulus`);
  process.exit(lulus === hasil.length ? 0 : 1);
}

void main();
