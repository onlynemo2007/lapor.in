import { useApp } from "../lib/store";
import { jamSinkron, waktuSinkron } from "../lib/sync";
import { I, Spinner, cx } from "./ui";

/** Ringkasan status sinkron otomatis yang dipakai di beberapa layar. */
export function pakaiStatusSinkron() {
  const { syncState, pendingCount, settings } = useApp();
  const aktif = !!settings.scriptUrl && !!settings.token;

  if (!aktif)
    return {
      tone: "warn" as const,
      label: pendingCount ? `${pendingCount} isian menunggu — sinkron belum aktif` : "Sinkron otomatis belum aktif",
      pendek: pendingCount ? `${pendingCount} belum sinkron` : "Belum aktif",
      judul: "Sekali pasang Apps Script, semua isian langsung masuk Google Sheet.",
      aksi: "setup" as const,
      retry: false,
    };

  if (!settings.autoSync)
    return {
      tone: "muted" as const,
      label: "Sinkron otomatis dimatikan",
      pendek: "Otomatis mati",
      judul: "Isian hanya tersimpan di perangkat ini sampai Anda menekan Kirim sekarang.",
      aksi: "setup" as const,
      retry: false,
    };

  switch (syncState.status) {
    case "sending":
      return { tone: "busy" as const, label: "Mengirim ke Sheet…", pendek: "Mengirim…", judul: "Isian sedang ditulis ke Google Sheet.", aksi: "none" as const, retry: false };
    case "queued":
      return {
        tone: "busy" as const,
        label: `Menyinkronkan ${pendingCount} isian…`,
        pendek: "Menyinkronkan…",
        judul: "Isian dikirim otomatis sesaat setelah disimpan.",
        aksi: "none" as const,
        retry: false,
      };
    case "error":
      return {
        tone: "bad" as const,
        label: pendingCount ? `Gagal sinkron · ${pendingCount} menunggu` : "Gagal sinkron",
        pendek: "Gagal sinkron",
        judul: syncState.pesan ?? "Gagal mengirim ke Google Sheet. Percobaan ulang otomatis berjalan.",
        aksi: "retry" as const,
        retry: true,
      };
    case "offline":
      return { tone: "warn" as const, label: "Offline — akan dikirim saat online", pendek: "Offline", judul: syncState.pesan ?? "", aksi: "none" as const, retry: false };
    case "ok":
      return {
        tone: "ok" as const,
        label: `Isian terkirim ${jamSinkron(syncState.at)}`,
        pendek: `Terkirim ${jamSinkron(syncState.at)}`,
        judul: "Semua isian sudah masuk Google Sheet. Untuk mengambil isi sheet terbaru, tekan Muat ulang.",
        aksi: "none" as const,
        retry: false,
      };
    default:
      return {
        tone: "muted" as const,
        label: pendingCount ? `${pendingCount} isian menunggu` : "Siap sinkron",
        pendek: pendingCount ? `${pendingCount} menunggu` : "Siap",
        judul: "Belum ada isian baru untuk dikirim.",
        aksi: "none" as const,
        retry: false,
      };
  }
}

/** Lencana status sinkron yang bisa diklik (coba lagi / buka pengaturan). */
export function StatusSinkron({ className = "", ringkas = false }: { className?: string; ringkas?: boolean }) {
  const { syncState, syncNow } = useApp();
  const s = pakaiStatusSinkron();

  const isi = (
    <>
      {s.tone === "busy" ? (
        <Spinner className="h-3 w-3" />
      ) : s.tone === "ok" ? (
        <I.check className="h-3.5 w-3.5" />
      ) : s.tone === "bad" ? (
        <I.alert className="h-3.5 w-3.5" />
      ) : (
        <span className={cx("h-1.5 w-1.5 rounded-full", s.tone === "warn" ? "bg-warn" : "bg-muted")} />
      )}
      <span className="truncate">{ringkas ? s.pendek : s.label}</span>
      {s.retry && <span className="hidden font-bold underline underline-offset-2 sm:inline">ulangi</span>}
    </>
  );

  const gaya = cx(
    "flex max-w-[320px] items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[11.5px] font-semibold transition",
    s.tone === "ok" && "bg-brand-soft text-brand",
    s.tone === "busy" && "bg-paper text-muted",
    s.tone === "bad" && "bg-bad-soft text-bad hover:brightness-95",
    s.tone === "warn" && "bg-warn-soft text-warn hover:brightness-95",
    s.tone === "muted" && "bg-paper text-muted hover:bg-[#f0efeb]",
    className,
  );

  const judul = [s.judul, syncState.gagal?.length ? `${syncState.gagal.length} baris tidak ditemukan di sheet.` : ""]
    .filter(Boolean)
    .join(" ");

  if (s.aksi === "retry")
    return (
      <button onClick={() => void syncNow()} className={gaya} title={judul}>
        {isi}
      </button>
    );

  if (s.aksi === "setup")
    return (
      <a href="#/sinkron" className={gaya} title={judul}>
        {isi}
      </a>
    );

  return (
    <span className={gaya} title={judul || (syncState.at ? `Terakhir ${waktuSinkron(syncState.at)}` : "")}>
      {isi}
    </span>
  );
}
