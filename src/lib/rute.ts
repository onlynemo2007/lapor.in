/**
 * Routing sederhana berbasis hash: #/dashboard, #/isi, #/presensi, …
 *
 * Alamat utama tanpa hash (…/) berarti HALAMAN PILIH (landing), bukan dashboard:
 * pegawai memilih dulu mau mengisi Laporan Mingguan (menu di aplikasi ini) atau
 * Laporan WFH (aplikasi Google Apps Script terpisah, dibuka di tab baru).
 */

/** Halaman pembuka (di luar daftar menu, tampil tanpa sidebar). */
export const VIEW_AWAL = "awal";

export const ALAMAT_PILIH = "#/";
export const ALAMAT_MINGGUAN = "#/isi";

export type Rute = { view: string; params: URLSearchParams };

/**
 * Terjemahkan hash alamat menjadi view + parameter.
 * - "" / "#" / "#/"        → halaman pilih
 * - "#/isi", "#/wfh?x=1"   → view menu terkait (garis miring di ujung diabaikan)
 * - hash tak dikenal        → halaman pilih (bukan halaman kosong)
 */
export function ruteDariHash(hash: string, idMenu: readonly string[]): Rute {
  const bersih = (hash || "").replace(/^#/, "").replace(/^\/+/, "").trim();
  if (!bersih) return { view: VIEW_AWAL, params: new URLSearchParams() };

  const [path, qs] = bersih.split("?");
  const params = new URLSearchParams(qs ?? "");
  const id = path.replace(/\/+$/, "").toLowerCase();
  if (!id) return { view: VIEW_AWAL, params };

  return { view: idMenu.includes(id) ? id : VIEW_AWAL, params };
}

/** Apakah sebuah view adalah halaman pembuka (tampil tanpa sidebar)? */
export const viewAwal = (view: string) => view === VIEW_AWAL;
