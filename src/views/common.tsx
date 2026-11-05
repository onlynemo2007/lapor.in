import { useApp } from "../lib/store";
import { Btn, Card, I, Spinner } from "../components/ui";

/** Ditampilkan selama data tab belum tersedia (memuat / gagal). */
export function StateGate() {
  const { loadState, reload, tabs, settings } = useApp();
  const tab = tabs.find((t) => t.gid === settings.activeGid);

  if (loadState.status === "error")
    return (
      <Card className="mx-auto mt-10 max-w-lg p-8 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-bad-soft text-bad">
          <I.alert className="h-6 w-6" />
        </span>
        <h2 className="mt-4 text-[18px] font-bold">Tab “{tab?.name}” belum bisa dibaca</h2>
        <p className="mt-2 text-[13.5px] leading-relaxed text-muted">{loadState.error}</p>
        <p className="mt-2 text-[12.5px] text-muted">
          Pastikan akses berbagi sheet: <b>Siapa saja yang memiliki link → Pelihat</b>.
        </p>
        <Btn className="mt-5" onClick={() => reload()}>
          <I.refresh className="h-4 w-4" /> Coba lagi
        </Btn>
      </Card>
    );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 text-[13.5px] font-medium text-muted">
        <Spinner /> Membaca tab “{tab?.name}” dari Google Sheet…
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[118px] animate-pulse rounded-2xl bg-[#efeee9]" />
        ))}
      </div>
      <div className="h-[380px] animate-pulse rounded-2xl bg-[#efeee9]" />
    </div>
  );
}
