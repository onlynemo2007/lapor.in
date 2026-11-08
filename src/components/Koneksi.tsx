import { useApp } from "../lib/store";
import { go } from "./Shell";
import { jamSinkron } from "../lib/sync";
import { Btn, I, cx } from "./ui";

/**
 * Pemberitahuan koneksi perangkat.
 *
 * URL Web App + token hanya tersimpan di browser masing-masing, jadi rekan yang
 * membuka tautan aplikasi di perangkat lain belum tersambung: sheet tetap terbaca
 * (ekspor CSV publik), tetapi isian di perangkat itu belum masuk ke sheet.
 * Banner ini membuat keadaan tersebut terlihat, bukan diam-diam.
 */
export function PeringatanKoneksi({ className = "" }: { className?: string }) {
  const { settings, gagalBaca, dibacaAt, reload } = useApp();
  const tersambung = !!(settings.scriptUrl && settings.token);

  if (!tersambung)
    return (
      <div
        className={cx(
          "no-print flex flex-wrap items-center gap-3 rounded-2xl border border-warn/30 bg-warn-soft px-4 py-3",
          className,
        )}
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/70 text-warn">
          <I.alert className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold text-ink">Perangkat ini belum tersambung ke Google Sheet</p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-muted">
            Sheet tetap terbaca, tetapi isian di perangkat ini <b>belum masuk ke sheet</b> — jadi datanya bisa berbeda
            dengan rekan yang sudah tersambung. Buka tautan siap pakai dari rekan, atau isi URL Web App + token sekali di
            menu Sinkronisasi.
          </p>
        </div>
        <Btn variant="ghost" size="sm" className="bg-white/80" onClick={() => go("sinkron")}>
          <I.sync className="h-3.5 w-3.5" /> Sambungkan
        </Btn>
      </div>
    );

  if (gagalBaca)
    return (
      <div
        className={cx(
          "no-print flex flex-wrap items-center gap-3 rounded-2xl border border-warn/30 bg-warn-soft px-4 py-3",
          className,
        )}
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/70 text-warn">
          <I.refresh className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold text-ink">
            Gagal membaca sheet terbaru{gagalBaca.at ? ` (${jamSinkron(gagalBaca.at)})` : ""}
          </p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-muted">
            Data yang tampil bisa lebih lama dari sheet{dibacaAt ? ` — terakhir berhasil dibaca ${jamSinkron(dibacaAt)}` : ""}.{" "}
            {gagalBaca.pesan}
          </p>
        </div>
        <Btn variant="ghost" size="sm" className="bg-white/80" onClick={() => void reload()}>
          <I.refresh className="h-3.5 w-3.5" /> Coba lagi
        </Btn>
      </div>
    );

  return null;
}
