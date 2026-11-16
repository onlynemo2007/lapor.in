/**
 * Routing sederhana berbasis hash: #/dashboard, #/isi, #/wfh, …
 *
 * Alamat utama tanpa hash (…/) berarti HALAMAN PILIH (landing), bukan dashboard:
 * pegawai diminta memilih dulu mau mengisi Laporan Mingguan atau Laporan WFH.
 * Setiap pilihan tetap punya alamatnya sendiri (…/#/isi dan …/#/wfh) sehingga
 * bisa disimpan sebagai bookmark atau dibagikan lewat WhatsApp grup tim.
 */

/** Halaman pembuka (di luar daftar menu, tampil tanpa sidebar). */
export const VIEW_AWAL = "awal";

export const ALAMAT_PILIH = "#/";
export const ALAMAT_MINGGUAN = "#/isi";
export const ALAMAT_WFH = "#/wfh";

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
