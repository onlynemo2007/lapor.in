import { act } from "react";
import { createRoot } from "react-dom/client";
import { ToastProvider } from "../src/components/ui";
import { AppProvider, useApp } from "../src/lib/store";
import PratinjauView from "../src/views/PratinjauView";

const A = "https://drive.google.com/file/d/AAA/view";
const B = "https://drive.google.com/file/d/BBB/view";
const C = "https://drive.google.com/C"; // ditulis manual di sheet tanpa tanggal

/* sheet v1.6: tautan ada di baris tanggalnya masing-masing */
const CSV = [
  "LAPORAN MINGGU I BULAN NOVEMBER 2025,,,,,,,,",
  ",,A,KEGIATAN TIM,,,,,,",
  "No,,Tim,Tanggal,Uraian,,,,,Link Bukti Dukung",
  `,,Humas,3 November 2025,"Satu butir",,,,,3 November 2025: ${A}`,
  `,,,4 November 2025,"Dua butir",,,,,"4 November 2025: ${B}\n${C}"`,
  ",,B,RENCANA KEGIATAN TIM,,,,,,",
  "No,,Tim,Uraian,,,,,,",
  ",,Humas,,,,,,,",
  ",,C,REKAPITULASI KEHADIRAN,,,,,,",
  "No,,Tanggal,Kehadiran,Tidak Masuk,Dinas Luar,Cuti,,,",
  ",,3 November 2025,,,,,,",
  ",,4 November 2025,,,,,,",
  ",,D,REALISASI KEUANGAN,,,,,",
  "No,Kode,Uraian,Pagu,Realisasi,,,,",
  "1,032.12.01,Perjalanan dinas,100000000,25000000,,,,",
  ",,Total,100000000,25000000,,,,",
  ",,,,,,,,,",
  "Rekapitulasi UP,,,,,,,,,",
  "No,Uraian,Pagu,Realisasi,Sisa,,,,,",
  "1,UP Januari,100000000,20000000,80000000,,,,,",
  "2,UP Februari,50000000,10000000,40000000,,,,,",
  ",,,,,,,,,",
  "Pembayaran Melalui LS,,,,,,,,,",
  "No,Uraian,Nilai,Keterangan,,,,,,",
  "1,Honor narasumber,15000000,Lunas,,,,,,",
  ",,,,,,,,,",
  "Rencana Penarikan,,,,,,,,,",
  "Bulan,Jumlah,Keterangan,,,,,,",
  "November,75000000,,,,,,,,",
].join("\n");

let aktif: ReturnType<typeof useApp> | null = null;
let jumlahBaca = 0;
const fetchAsli = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  if (init?.method === "POST") return { ok: true, text: async () => JSON.stringify({ ok: true, versi: "1.6", ditulis: 1, gagal: [] }) } as unknown as Response;
  if (url.includes("aksi=ping")) return { ok: true, json: async () => ({ ok: false }), text: async () => "" } as unknown as Response;
  jumlahBaca += 1;
  return { ok: true, text: async () => CSV, json: async () => ({}) } as unknown as Response;
}) as typeof fetch;

function Probe() {
  aktif = useApp();
  return null;
}

async function main() {
  const hasil: { nama: string; lulus: boolean; info?: string }[] = [];
  const cek = (nama: string, lulus: boolean, info = "") => hasil.push({ nama, lulus, info });

  localStorage.setItem("laporin:v3", JSON.stringify({ v: 2, settings: { nama: "Uji", timUtama: "humas" }, weeks: {}, trend: {}, log: [] }));

  const wadah = document.createElement("div");
  document.body.appendChild(wadah);
  const root = createRoot(wadah);
  await act(async () => {
    root.render(
      <ToastProvider>
        <AppProvider>
          <Probe />
          <PratinjauView />
        </AppProvider>
      </ToastProvider>,
    );
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 250));
  });

  const c = () => aktif as unknown as ReturnType<typeof useApp>;
  cek("sheet dibaca ulang saat pratinjau dibuka", jumlahBaca >= 1, `baca ${jumlahBaca}x`);
  cek("waktu baca tercatat", typeof c().dibacaAt === "number" && c().dibacaAt! > 0, String(c().dibacaAt));
  cek("label waktu baca tampil", /Data sheet dibaca/.test(document.body.textContent ?? ""), (document.body.textContent ?? "").slice(0, 120));

  const barisDari = (url: string) => {
    const a = Array.from(document.querySelectorAll("a")).find((x) => (x as HTMLAnchorElement).href === url) as HTMLAnchorElement | undefined;
    return a ? (a.closest("tr") as HTMLTableRowElement | null) : null;
  };
  const r3 = barisDari(A);
  const r4 = barisDari(B);
  cek("tautan tanggal 3 tampil", !!r3, "tautan AAA tidak ditemukan");
  cek("tautan tanggal 3 di baris tanggal 3", !!r3 && (r3.textContent ?? "").includes("3 November 2025"), r3?.textContent);
  cek("tautan tanggal 3 tidak menumpang di baris tanggal 4", !!r4 && !(r4.textContent ?? "").includes("AAA"), r4?.textContent);
  cek("tautan tanggal 4 di baris tanggal 4", !!r4 && (r4.textContent ?? "").includes("4 November 2025"), r4?.textContent);

  const teksD = document.body.textContent ?? "";
  cek("tabel Rekapitulasi UP tercetak", teksD.includes("Rekapitulasi UP") && teksD.includes("UP Februari"), teksD.slice(-400));
  cek("tabel Pembayaran Melalui LS tercetak", teksD.includes("Pembayaran Melalui LS") && teksD.includes("Honor narasumber"));
  cek("tabel Rencana Penarikan tercetak", teksD.includes("Rencana Penarikan") && teksD.includes("November"));
  cek("angka tabel diformat seperti sheet", teksD.includes("80.000.000") && teksD.includes("15.000.000"), "");
  cek("teks sel apa adanya", teksD.includes("Lunas"), "");
  cek("total kode tetap tercetak", teksD.includes("25.000.000"), "");
  cek("tautan manual tanpa tanggal ikut tercetak", (document.body.textContent ?? "").includes("drive.google.com/C"), "");
  cek("tautan tanpa tanggal hanya sekali", ((document.body.textContent ?? "").match(/drive\.google\.com\/C/g) ?? []).length === 1, String(((document.body.textContent ?? "").match(/drive\.google\.com\/C/g) ?? []).length));
  cek("bagian D ikut tercetak", /D\. Realisasi Keuangan/.test(document.body.textContent ?? "") && (document.body.textContent ?? "").includes("032.12.01"), "");

  /* tombol ambil data terbaru memicu pembacaan lagi */
  const sebelum = jumlahBaca;
  const tombol = Array.from(document.querySelectorAll("button")).find((b) => (b.textContent ?? "").includes("Ambil data terbaru")) as HTMLButtonElement;
  cek("tombol ambil data terbaru ada", !!tombol);
  await act(async () => {
    tombol?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 150));
  });
  cek("tombol memuat ulang dari sheet", jumlahBaca > sebelum, `${sebelum} → ${jumlahBaca}`);

  /* ---------------- pilihan kelompok cetak ---------------- */
  const tombolKelompok = Array.from(document.querySelectorAll("[role=tab]")).map((b) => (b.textContent ?? "").trim());
  cek(
    "lima pilihan cetak tersedia",
    tombolKelompok.join("|") === "Semua|Tim Dukman|Tim Teknis|Presensi|Keuangan",
    tombolKelompok.join("|"),
  );
  cek("laporan lengkap memuat tim teknis", (document.body.textContent ?? "").includes("Sertifikasi Kompetensi SDMKP"));
  cek("laporan lengkap memuat bagian C dan D", /C\. Rekapitulasi/i.test(document.body.textContent ?? "") && /D\. Realisasi Keuangan/.test(document.body.textContent ?? ""));

  const pasang = async (params: URLSearchParams) => {
    document.body.innerHTML = "";
    const w = document.createElement("div");
    document.body.appendChild(w);
    const r = createRoot(w);
    await act(async () => {
      r.render(
        <ToastProvider>
          <AppProvider>
            <PratinjauView params={params} />
          </AppProvider>
        </ToastProvider>,
      );
    });
    await act(async () => {
      await new Promise((x) => setTimeout(x, 250));
    });
  };

  await pasang(new URLSearchParams("cetak=dukman"));
  const td = document.body.textContent ?? "";
  cek("cetak tim dukman: judul TIM DUKMAN", td.includes("TIM DUKMAN"));
  cek("cetak tim dukman: bagian A & B tercetak", /A\. /.test(td) && /B\. /.test(td));
  cek("cetak tim dukman: berhenti di rencana (tanpa C & D)", !/C\. Rekapitulasi/i.test(td) && !/D\. Realisasi Keuangan/.test(td));
  cek("cetak tim dukman: hanya tim I–VII", td.includes("Hukum") && !td.includes("Sertifikasi Kompetensi SDMKP") && !td.includes("Penjamin Mutu LSP"), "");
  cek("cetak tim dukman: pilihan aktif ditandai", (document.querySelector("[role=tab][aria-selected=true]")?.textContent ?? "").trim() === "Tim Dukman");

  await pasang(new URLSearchParams("cetak=teknis"));
  const tt = document.body.textContent ?? "";
  cek("cetak tim teknis: judul TIM TEKNIS", tt.includes("TIM TEKNIS"));
  cek("cetak tim teknis: bagian A & B tercetak", /A\. /.test(tt) && /B\. /.test(tt));
  cek("cetak tim teknis: berhenti di rencana (tanpa C & D)", !/C\. Rekapitulasi/i.test(tt) && !/D\. Realisasi Keuangan/.test(tt));
  cek("cetak tim teknis: tiga tim baru tercetak", ["Sertifikasi Kompetensi SDMKP", "Standardisasi Kompetensi", "Penjamin Mutu LSP"].every((x) => tt.includes(x)));
  cek("cetak tim teknis: tim dukman tidak ikut", !tt.includes("Hukum") && !tt.includes("Kepegawaian"));

  /* --- cetak khusus presensi (bagian C) --- */
  await pasang(new URLSearchParams("cetak=presensi"));
  const tp = document.body.textContent ?? "";
  cek("cetak presensi: subjudul REKAPITULASI PRESENSI PEGAWAI", tp.includes("REKAPITULASI PRESENSI PEGAWAI"));
  cek("cetak presensi: bagian C tercetak", /C\. Rekapitulasi/i.test(tp));
  cek("cetak presensi: tanpa bagian A, B, dan D", !/A\. /.test(tp) && !/B\. /.test(tp) && !/D\. Realisasi Keuangan/.test(tp));
  cek("cetak presensi: tanpa tabel tim", !tp.includes("Hukum") && !tp.includes("Sertifikasi Kompetensi SDMKP"));
  cek(
    "cetak presensi: pilihan aktif ditandai",
    (document.querySelector("[role=tab][aria-selected=true]")?.textContent ?? "").trim() === "Presensi",
  );

  /* --- cetak khusus keuangan (bagian D) --- */
  await pasang(new URLSearchParams("cetak=keuangan"));
  const tk = document.body.textContent ?? "";
  cek("cetak keuangan: subjudul REALISASI KEUANGAN", /REALISASI KEUANGAN/.test(tk));
  cek("cetak keuangan: bagian D tercetak", /D\. Realisasi Keuangan/.test(tk) && tk.includes("032.12.01"));
  cek("cetak keuangan: tabel keuangan lain ikut tercetak", tk.includes("Rekapitulasi UP") && tk.includes("Pembayaran Melalui LS"));
  cek("cetak keuangan: tanpa bagian A, B, dan C", !/A\. /.test(tk) && !/B\. /.test(tk) && !/C\. Rekapitulasi/i.test(tk));
  cek(
    "cetak keuangan: pilihan aktif ditandai",
    (document.querySelector("[role=tab][aria-selected=true]")?.textContent ?? "").trim() === "Keuangan",
  );

  const lulus = hasil.filter((h) => h.lulus).length;
  hasil.filter((h) => !h.lulus).forEach((h) => console.log("  GAGAL:", h.nama, "→", h.info));
  console.log(`\n${lulus}/${hasil.length} uji Pratinjau lulus`);
  globalThis.fetch = fetchAsli;
  process.exit(lulus === hasil.length ? 0 : 1);
}

void main();
