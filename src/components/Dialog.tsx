import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Btn, I, cx } from "./ui";

/**
 * Dialog native `<dialog>` dibuka dengan `showModal()`.
 *
 * Yang sudah ditangani browser (jangan ditambah manual):
 *  - halaman di belakang menjadi inert, fokus terkurung di dalam dialog
 *  - `Esc` dan gestur "kembali" di ponsel menutup dialog (`cancel` → `close`)
 *  - fokus kembali ke tombol pemicu setelah dialog tertutup
 *  - `::backdrop` di top layer, di atas seluruh UI lain
 */
export function Dialog({
  open,
  onClose,
  labelledBy,
  children,
  wide = false,
  dismissible = true,
}: {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  children: ReactNode;
  wide?: boolean;
  /** `false` = wajib diselesaikan di dalam dialog (Esc & klik backdrop tidak menutup). */
  dismissible?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Buka/tutup mengikuti state React. `close`/`cancel` dipasang sebagai listener native
  // (bukan prop React) agar tetap bekerja walau browser/React berbeda soal event ini.
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const saatTutup = () => onCloseRef.current();
    const saatBatal = (e: Event) => {
      // Esc & gestur "kembali" di ponsel datang sebagai `cancel`; dialog wajib boleh menolaknya.
      if (!dismissible) e.preventDefault();
    };
    d.addEventListener("close", saatTutup);
    d.addEventListener("cancel", saatBatal);
    return () => {
      d.removeEventListener("close", saatTutup);
      d.removeEventListener("cancel", saatBatal);
    };
  }, [dismissible]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      // Fokus awal: kontrol ber-[autofocus], kalau tidak ada → kontrol pertama (tombol aman).
      if (!d.contains(document.activeElement)) {
        d.querySelector<HTMLElement>("[autofocus], input, button")?.focus();
      }
    }
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="dlg"
      aria-labelledby={labelledBy}
      onClick={(e) => {
        // klik pada backdrop: event.target = elemen <dialog> (bukan isinya)
        if (dismissible && e.target === ref.current) ref.current?.close();
      }}
    >
      <div
        className={cx(
          "anim-pop flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl",
          wide ? "w-[min(36rem,calc(100vw-2rem))]" : "w-[min(28rem,calc(100vw-2rem))]",
        )}
      >
        {children}
      </div>
    </dialog>
  );
}

/* --------------------------------- konfirmasi --------------------------------- */

type Minta = {
  judul: string;
  pesan: ReactNode;
  labelYa: string;
  labelBatal: string;
  bahaya?: boolean;
};

type Jawab = (v: boolean) => void;

const KonfirmasiCtx = createContext<(m: Minta) => Promise<boolean>>(() => Promise.resolve(false));

/**
 * Pengganti `window.confirm()`: dialog native, bisa digayakan, tetap bisa di-`await`.
 * Fokus awal ada di tombol aman (Batal) — dan tombol berbahaya ditaruh paling kanan
 * supaya klik kedua di titik yang sama tidak langsung menghapus.
 */
export function KonfirmasiProvider({ children }: { children: ReactNode }) {
  const [minta, setMinta] = useState<Minta | null>(null);
  const jawab = useRef<Jawab | null>(null);
  const id = useId();

  const tanya = useCallback((m: Minta) => {
    setMinta(m);
    return new Promise<boolean>((resolve) => {
      jawab.current = resolve;
    });
  }, []);

  const tutup = (v: boolean) => {
    jawab.current?.(v);
    jawab.current = null;
    setMinta(null);
  };

  return (
    <KonfirmasiCtx.Provider value={tanya}>
      {children}
      <Dialog open={!!minta} onClose={() => tutup(false)} labelledBy={`${id}-judul`}>
        {minta && (
          <>
            <div className="flex items-start gap-3 px-6 py-5">
              <span
                className={cx(
                  "grid h-10 w-10 shrink-0 place-items-center rounded-2xl",
                  minta.bahaya ? "bg-bad-soft text-bad" : "bg-warn-soft text-warn",
                )}
              >
                <I.alert className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h2 id={`${id}-judul`} className="text-[16px] font-bold tracking-tight">
                  {minta.judul}
                </h2>
                <div className="mt-1 whitespace-pre-line text-[13px] leading-relaxed text-muted">{minta.pesan}</div>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-line px-6 py-4">
              <Btn variant="ghost" onClick={() => tutup(false)} autoFocus>
                {minta.labelBatal}
              </Btn>
              <Btn variant={minta.bahaya ? "danger" : "primary"} onClick={() => tutup(true)} className={minta.bahaya ? "bg-bad text-white hover:bg-[#a93524]" : undefined}>
                {minta.labelYa}
              </Btn>
            </div>
          </>
        )}
      </Dialog>
    </KonfirmasiCtx.Provider>
  );
}

/** `const setuju = await tanya({...})` — pengganti `window.confirm()`. */
export const useKonfirmasi = () => useContext(KonfirmasiCtx);
