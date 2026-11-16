/**
 * Aplikasi "Laporan WFH Pegawai" (Google Apps Script) yang dipakai tim Dukman.
 * Tautan bawaannya di bawah ini; bisa diganti lewat pengaturan di menu Laporan WFH.
 */
export const WFH_URL_BAWAAN =
  "https://script.google.com/macros/s/AKfycbw2YKqEgyI8apEacVnSavh7G0jYiozF4RB5jRI_TrdM1bgacKc73ECrrshaiy1W8eEr/exec";

/** Hanya terima tautan Apps Script yang masuk akal; selain itu pakai tautan bawaan. */
export const tautanWfh = (url?: string) => {
  const t = (url || "").trim();
  return /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec\/?$/.test(t) ? t : WFH_URL_BAWAAN;
};

/** Bagian tautan yang pendek untuk ditampilkan di layar. */
export const tautanWfhPendek = (url: string) => {
  const cocok = url.match(/macros\/s\/([\w-]{8})[\w-]*\/(exec)/);
  return cocok ? `script.google.com/…/${cocok[1]}…/${cocok[2]}` : url;
};

/** Langkah pemakaian yang ditampilkan di menu Laporan WFH. */
export const LANGKAH_WFH: { judul: string; isi: string }[] = [
  {
    judul: "Isi identitas sekali saja",
    isi: "Nama, NIP, jabatan, tim kerja, dan alamat lokasi WFH. Identitas diingat di perangkat pegawai, jadi laporan berikutnya tidak perlu diisi ulang.",
  },
  {
    judul: "Isi kegiatan harian",
    isi: "Tulis kegiatan yang dikerjakan saat WFH beserta tanggalnya, lalu kirim. Data masuk ke spreadsheet laporan WFH.",
  },
  {
    judul: "Ulangi setiap hari kerja",
    isi: "Buka menu ini dari HP masing-masing. Cukup tekan tombol buka formulir, tidak perlu menyimpan tautan atau menghafal alamatnya.",
  },
];
