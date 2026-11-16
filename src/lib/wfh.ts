/**
 * Aplikasi "Laporan WFH Pegawai" (Google Apps Script) yang dipakai tim Dukman.
 *
 * Aplikasi ini BERDIRI SENDIRI: tidak lagi punya menu di dashboard Lapor.in.
 * Tautannya ditampilkan sebagai kartu di halaman pilih (src/views/LandingView.tsx)
 * dan langsung membuka formulir WFH di tab baru. Bila alamat formulir berubah,
 * cukup ubah satu konstanta di bawah ini.
 */
export const WFH_URL_BAWAAN =
  "https://script.google.com/macros/s/AKfycbw2YKqEgyI8apEacVnSavh7G0jYiozF4RB5jRI_TrdM1bgacKc73ECrrshaiy1W8eEr/exec";

/** Bagian tautan yang pendek untuk ditampilkan di layar. */
export const tautanWfhPendek = (url: string) => {
  const cocok = url.match(/macros\/s\/([\w-]{8})[\w-]*\/(exec)/);
  return cocok ? `script.google.com/…/${cocok[1]}…/${cocok[2]}` : url;
};
