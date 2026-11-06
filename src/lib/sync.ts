/* ------------------------------------------------------------------ */
/*  Mesin sinkronisasi otomatis                                        */
/*  Setiap isian yang disimpan di perangkat langsung didorong ke tab   */
/*  Google Sheet lewat Apps Script — tanpa tombol "Kirim".             */
/* ------------------------------------------------------------------ */

import { joinUraian, norm, type WeekData } from "./model";
import {
  aplikasiCells,
  buildPayload,
  fetchWeek,
  payloadCount,
  presensiCells,
  type Payload,
} from "./sheet";

export type SyncStatus =
  | "idle" // belum ada apa-apa
  | "off" // sinkron otomatis dimatikan
  | "setup" // URL / token belum diisi
  | "queued" // menunggu jeda tulis
  | "sending" // sedang mengirim
  | "ok" // semua sudah masuk sheet
  | "error" // gagal (bisa dicoba lagi)
  | "offline"; // perangkat tanpa internet

export type SyncState = {
  status: SyncStatus;
  pending: number;
  at?: number; // waktu sukses terakhir
  pesan?: string; // pesan galat / info
  gagal?: string[]; // baris yang tidak ditemukan di sheet
  percobaan?: number;
};

export type SyncLog = {
  at: number;
  ok: boolean;
  gid: string;
  tab: string;
  sel: number;
  pesan?: string;
};

/** Satu paket kiriman untuk satu tab. */
export type Kiriman = {
  gid: string;
  tab: string;
  payload: Payload;
  sel: number;
  dirty: string[];
  stamp: Record<string, number>;
};

/** Jumlah isian yang belum masuk sheet (semua tab yang pernah dibuka). */
export const jumlahTertunda = (weeks: Record<string, WeekData>) =>
  Object.values(weeks ?? {}).reduce((n, w) => n + Object.keys(w?.dirty ?? {}).length, 0);

/** Siapkan paket kiriman berisi perubahan saja. `null` bila tidak ada yang bisa dikirim. */
export function siapkanKiriman(w: WeekData, token: string, nama: string): Kiriman | null {
  const payload = buildPayload(w, token, nama, true);
  const sel = payloadCount(payload);
  if (!sel) return null;
  const dirty = Object.keys(w.dirty);
  const stamp: Record<string, number> = {};
  dirty.forEach((k) => {
    stamp[k] = w.meta[k]?.at ?? 0;
  });
  return { gid: w.gid, tab: w.tab, payload, sel, dirty, stamp };
}

/**
 * Hapus penanda "belum dikirim" setelah berhasil ditulis.
 * Isian yang sempat diubah lagi selama pengiriman tetap ditandai (timestamp berubah).
 */
export function tandaiTerkirim(w: WeekData, k: Kiriman, at: number): WeekData {
  const dirty = { ...w.dirty };
  const meta = { ...w.meta };
  k.dirty.forEach((dk) => {
    if ((w.meta[dk]?.at ?? 0) !== k.stamp[dk]) return;
    delete dirty[dk];
    // "ganti" hanya sekali pakai: setelah baris itu terkirim, skrip kembali hanya menambah,
    // sehingga tautan yang ditambahkan orang lain langsung di sheet tidak ikut terhapus.
    if (dk.startsWith("L:")) {
      const awalan = `L:${dk.slice(2)}|`;
      Object.keys(meta).forEach((mk) => {
        if (mk.startsWith(awalan) && meta[mk].ganti) meta[mk] = { ...meta[mk], ganti: false };
      });
    }
  });
  return { ...w, dirty, meta, syncedAt: at };
}

export const jamSinkron = (at?: number) =>
  at ? new Date(at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "";

export const waktuSinkron = (at?: number) =>
  at
    ? new Date(at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })
    : "";

/**
 * Periksa apakah isi sheet sudah benar-benar berubah.
 * Dipakai saat balasan Apps Script tidak dapat dibaca browser (mode no-cors).
 */
export async function verifikasiKiriman(k: Kiriman, ulang = 3): Promise<boolean> {
  for (let i = 0; i < ulang; i++) {
    if (i) await new Promise((r) => setTimeout(r, 1500));
    try {
      const w = await fetchWeek(k.gid, k.tab);
      if (cocok(w, k.payload)) return true;
    } catch {
      /* sheet sesaat belum terbaca — coba lagi */
    }
  }
  return false;
}

function cocok(w: WeekData, p: Payload): boolean {
  const beda: boolean[] = [];
  p.kegiatan.forEach((x) => {
    beda.push(norm(joinUraian(w.kegiatan[`${x.tim}|${x.sub}|${x.tanggal}`] ?? [])) !== norm(x.uraian));
  });
  p.rencana.forEach((x) => {
    beda.push(norm(joinUraian(w.rencana[x.tim] ?? [])) !== norm(x.uraian));
  });
  p.lampiran.forEach((x) => {
    beda.push(norm(w.lampiran[`${x.tim}|${x.sub}`] ?? "") !== norm(x.url));
  });
  p.presensi.forEach((x) => {
    beda.push(norm(presensiCells(w.presensi[norm(x.tanggal)]).join("|")) !== norm(x.nilai.join("|")));
  });
  p.aplikasi.forEach((x) => {
    beda.push(norm(aplikasiCells(w.aplikasi[norm(x.tanggal)]).join("|")) !== norm(x.nilai.join("|")));
  });
  return !beda.some(Boolean);
}
