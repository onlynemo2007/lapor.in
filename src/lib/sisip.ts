/* ------------------------------------------------------------------ */
/*  Tambah baris pada tabel bagian C/D (penggunaan aplikasi presensi,  */
/*  Rekapitulasi UP, Pembayaran Melalui LS, …)                         */
/* ------------------------------------------------------------------ */

import type { TabelKeuangan, WeekData } from "./model";
import { SCRIPT_VERSI, acuanSisip, fetchWeek, kirimKeScript, payloadSisip } from "./sheet";

export type HasilSisip = { ok: boolean; pesan: string };

/**
 * Sisipkan satu baris baru ke sebuah tabel di sheet (sebelum baris Jumlah bila ada),
 * lalu baca ulang tab supaya baris itu langsung muncul di aplikasi.
 */
export async function sisipBarisTabel(opts: {
  week: WeekData;
  tabel: TabelKeuangan;
  oleh: string;
  token: string;
  scriptUrl: string;
  reload: () => Promise<unknown>;
}): Promise<HasilSisip> {
  const { week, tabel, oleh, token, scriptUrl } = opts;
  if (!scriptUrl || !token) {
    return { ok: false, pesan: "Hubungkan Apps Script dulu (menu Sinkronisasi) agar baris bisa ditambahkan ke sheet." };
  }
  const acuan = acuanSisip(tabel);
  if (!acuan.acuan) return { ok: false, pesan: "Tabel ini belum punya baris acuan di sheet." };

  // nomor urut berikutnya bila kolom penanda berisi angka — baris baru langsung terlihat, bukan kosong
  const nilai = acuan.kolom.map(() => "");
  const label = (acuan.label ?? "").trim();
  if (/^\d+$/.test(label) && acuan.labelKolom === acuan.kolom[0]) nilai[0] = String(Number(label) + 1);

  const r = await kirimKeScript(scriptUrl, payloadSisip(week, token, oleh, [{ judul: tabel.judul, ...acuan, nilai }]));
  if (!r.ok) return { ok: false, pesan: r.error ?? "Skrip menolak permintaan." };
  if (r.gagal?.length) return { ok: false, pesan: r.gagal[0] };
  if (r.verified && !r.ditulis) {
    return {
      ok: false,
      pesan: `Skrip di spreadsheet masih versi lama. Salin ulang kode v${SCRIPT_VERSI} dari menu Sinkronisasi → Apps Script, lalu Deploy versi baru.`,
    };
  }
  if (!r.verified) {
    // balasan skrip tidak terbaca browser: pastikan barisnya benar-benar bertambah
    const sesudah = await fetchWeek(week.gid, week.tab);
    const semua = [...sesudah.tabelKeuangan, ...(sesudah.aplikasiTabel ? [sesudah.aplikasiTabel] : [])];
    const sama = semua.find((x) => x.judul === tabel.judul);
    if (!sama || sama.baris.length <= tabel.baris.length) {
      return { ok: false, pesan: "Skrip menerima permintaan, tetapi baris di sheet belum bertambah." };
    }
  }
  await opts.reload();
  return { ok: true, pesan: `Satu baris ditambahkan di "${tabel.judul}" · tersimpan di sheet` };
}
