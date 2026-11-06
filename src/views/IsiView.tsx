import { useEffect, useMemo, useRef, useState } from "react";
import { setKegiatan, setLampiran, setRencana, useApp } from "../lib/store";
import {
  TIMS,
  type WeekData,
  gantiLampiranTanggal,
  hariDari,
  hurufKolom,
  joinUraian,
  lampKey,
  lampiranTanggal,
  lampiranTanpaTanggal,
  norm,
  parseLampiran,
  rapikan,
  slotAda,
  slotKey,
  splitLinks,
  susunLampiran,
  tanggalPendek,
  tanggalSama,
  timById,
} from "../lib/model";
import { go } from "../components/Shell";
import { jamSinkron } from "../lib/sync";
import { Btn, Card, I, Pill, cx, useToast } from "../components/ui";
import ItemsEditor from "./ItemsEditor";
import ChatAsisten from "./ChatAsisten";
import { StateGate } from "./common";

type Mode = "form" | "chat" | "rencana";

export default function IsiView({ params }: { params: URLSearchParams }) {
  const { week, reload, dibacaAt } = useApp();
  const mode = (["form", "chat", "rencana"].includes(params.get("mode") ?? "") ? params.get("mode") : "form") as Mode;

  if (!week) return <StateGate />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[13px] font-medium text-muted">{mode === "rencana" ? week.judulRencana || "Bagian B" : week.judulKegiatan || "Bagian A"}</p>
          <h1 className="mt-1 text-[24px] font-extrabold tracking-tight sm:text-[28px]">Isi laporan</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-[11.5px] text-muted">
            <span>{dibacaAt ? `Data sheet dibaca ${jamSinkron(dibacaAt)}` : "Membaca sheet…"}</span>
            <Btn variant="ghost" size="sm" onClick={() => void reload(undefined, true)} title="Ambil isi terbaru dari Google Sheet">
              <I.refresh className="h-4 w-4" /> Ambil data terbaru
            </Btn>
          </p>
        </div>
        <div className="flex rounded-xl border border-line bg-white p-1">
          {(
            [
              ["form", "Form cepat", I.pen],
              ["chat", "Asisten chat", I.chat],
              ["rencana", "Rencana minggu depan", I.flag],
            ] as const
          ).map(([m, label, Icon]) => (
            <button
              key={m}
              onClick={() => go("isi", m === "form" ? Object.fromEntries([...params].filter(([k]) => k !== "mode")) : { mode: m })}
              className={cx(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-[12.5px] font-semibold transition",
                mode === m ? "bg-ink text-white" : "text-muted hover:text-ink",
              )}
            >
              <Icon className="h-4 w-4" />
              <span className={m === "rencana" ? "hidden sm:inline" : ""}>{label}</span>
              {m === "rencana" && <span className="sm:hidden">Rencana</span>}
            </button>
          ))}
        </div>
      </div>

      {mode === "form" && <FormKegiatan week={week} params={params} />}
      {mode === "chat" && <ChatAsisten />}
      {mode === "rencana" && <FormRencana week={week} />}
    </div>
  );
}

/* ------------------------------- form kegiatan ------------------------------- */

function FormKegiatan({ week, params }: { week: WeekData; params: URLSearchParams }) {
  const { settings, updateWeek, syncState } = useApp();
  const toast = useToast();
  const siapSinkron = !!settings.scriptUrl && !!settings.token && settings.autoSync;

  const awal = () => {
    const t = timById(params.get("tim") ?? "") ?? timById(settings.timUtama) ?? TIMS[0];
    const ps = params.get("sub") ?? "";
    const sub = t.subs.includes(ps) ? ps : t.subs[0];
    const pd = week.dates.find((d) => norm(d) === norm(params.get("d") ?? ""));
    const d = pd ?? week.dates.find((x) => !week.kegiatan[slotKey(t.id, sub, x)]) ?? week.dates[0];
    return { tim: t.id as string, sub, d };
  };

  const [slot, setSlot] = useState(awal);
  const key = slotKey(slot.tim, slot.sub, slot.d);
  const lk = lampKey(slot.tim, slot.sub);
  const [items, setItems] = useState<string[]>(() => week.kegiatan[key] ?? []);
  // tautan bukti dukung disimpan per tanggal: satu sel per tim/minggu memuat semua tanggal
  const [urlsTgl, setUrlsTgl] = useState<string[]>(() => lampiranTanggal(week.lampiran[lk] ?? "", slot.d));
  const [lampBaru, setLampBaru] = useState("");
  const [flash, setFlash] = useState(0);
  const loadedKey = useRef(key);

  // param URL berubah (mis. klik dari dashboard)
  const pstr = params.toString();
  useEffect(() => {
    if (params.get("tim") || params.get("d")) pindah(awal());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pstr]);

  // muat isi saat slot/tab berganti
  useEffect(() => {
    setItems(week.kegiatan[key] ?? []);
    setUrlsTgl(lampiranTanggal(week.lampiran[lk] ?? "", slot.d));
    setLampBaru("");
    loadedKey.current = key;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, week.gid]);

  const tersimpan = week.kegiatan[key] ?? [];
  // tautan milik tanggal ini vs tanggal lain pada tim yang sama
  const entriLamp = parseLampiran(week.lampiran[lk] ?? "");
  const urlTersimpan = lampiranTanggal(week.lampiran[lk] ?? "", slot.d);
  const entriTgl = entriLamp.filter((e) => e.tanggal && tanggalSama(e.tanggal, slot.d));
  // tautan yang ditulis manual di sheet tanpa awalan tanggal — tetap ditampilkan
  const tanpaTgl = lampiranTanpaTanggal(week.lampiran[lk] ?? "");
  const jumlahLain = entriLamp.length - entriTgl.length;
  const barisLamp = week.rows.A[key] ?? week.rows.L[lk];
  const samaDaftar = (a: string[], b: string[]) =>
    a.length === b.length && a.every((u, i) => u.toLowerCase() === (b[i] ?? "").toLowerCase());
  const berubah =
    JSON.stringify(items.map((s) => s.trim()).filter(Boolean)) !== JSON.stringify(tersimpan) ||
    !samaDaftar(urlsTgl, urlTersimpan) ||
    splitLinks(lampBaru).length > 0;

  /** Tambah tautan untuk tanggal ini — tautan tanggal ini/tanggal lain tidak dihapus. */
  const tambahLamp = () => {
    const baru = splitLinks(lampBaru);
    if (!baru.length) {
      toast("Tempel tautan yang diawali https://", "err");
      return;
    }
    const gabung = [...urlsTgl];
    baru.forEach((u) => {
      if (!gabung.some((x) => x.toLowerCase() === u.toLowerCase())) gabung.push(u);
    });
    setUrlsTgl(gabung);
    setLampBaru("");
    if (gabung.length > urlsTgl.length) toast(`Tautan ${tanggalPendek(slot.d)} ditambahkan`);
    else toast("Tautan itu sudah ada di daftar", "info");
  };

  const simpan = (diam = false) => {
    const bersih = items.map(rapikan).filter(Boolean);
    const k = loadedKey.current;
    const [tim, sub, tgl] = k.split("|");
    const tambahan = splitLinks(lampBaru);
    // hanya entri tanggal ini yang diganti; tanggal lain di sel yang sama dibiarkan
    const lampFinal = gantiLampiranTanggal(week.lampiran[lk] ?? "", tgl, [...urlsTgl, ...tambahan]);
    updateWeek((w) => setLampiran(setKegiatan(w, k, bersih, settings.nama), lampKey(tim, sub), lampFinal, settings.nama));
    setItems(bersih);
    if (tambahan.length) {
      setUrlsTgl([...urlsTgl, ...tambahan.filter((u) => !urlsTgl.some((x) => x.toLowerCase() === u.toLowerCase()))]);
      setLampBaru("");
    }
    setFlash((f) => f + 1);
    const lanjut = siapSinkron ? " · langsung ke Sheet" : "";
    if (!diam) toast(bersih.length ? `Tersimpan · ${bersih.length} butir${lanjut}` : "Isian dikosongkan");
    else toast(`Perubahan tersimpan${lanjut}`, "info");
  };

  const pindah = (next: { tim: string; sub: string; d: string }) => {
    if (berubah) simpan(true);
    setSlot(next);
  };

  const tim = timById(slot.tim)!;
  const idx = week.dates.indexOf(slot.d);
  const nextDate = week.dates.slice(idx + 1).find((d) => !week.kegiatan[slotKey(slot.tim, slot.sub, d)]) ?? week.dates[idx + 1];

  const simpanLanjut = () => {
    simpan();
    if (nextDate) setSlot({ ...slot, d: nextDate });
  };

  const meta = week.meta[`A:${key}`];

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <Card className="p-5 sm:p-6">
        {/* tim */}
        <p className="text-[12px] font-semibold uppercase tracking-wider text-muted">Tim</p>
        <div className="no-scrollbar -mx-1 mt-2 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {TIMS.map((t) => {
            const on = t.id === slot.tim;
            return (
              <button
                key={t.id}
                onClick={() => {
                  const sub = t.subs[0];
                  const d = week.dates.find((x) => !week.kegiatan[slotKey(t.id, sub, x)]) ?? slot.d;
                  pindah({ tim: t.id, sub, d });
                }}
                className={cx(
                  "flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-[13px] font-semibold transition",
                  on ? "border-ink bg-ink text-white" : "border-line bg-white text-muted hover:border-[#cfcec8] hover:text-ink",
                )}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: t.tone }} />
                {t.label}
              </button>
            );
          })}
        </div>

        {tim.subs.length > 1 && (
          <div className="mt-3 flex gap-1.5">
            {tim.subs.map((s) => (
              <button
                key={s}
                onClick={() => pindah({ ...slot, sub: s })}
                className={cx(
                  "rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition",
                  slot.sub === s ? "bg-brand-soft text-brand" : "bg-paper text-muted hover:text-ink",
                )}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* hari */}
        <p className="mt-5 text-[12px] font-semibold uppercase tracking-wider text-muted">Hari</p>
        <div className="mt-2 grid grid-cols-5 gap-1.5">
          {week.dates.map((d) => {
            const k = slotKey(slot.tim, slot.sub, d);
            const n = (week.kegiatan[k] ?? []).length;
            const on = d === slot.d;
            return (
              <button
                key={d}
                onClick={() => pindah({ ...slot, d })}
                className={cx(
                  "relative rounded-xl border px-1 py-2.5 text-center transition",
                  on ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-[#cfcec8]",
                )}
              >
                <span className={cx("block text-[11px] font-semibold", on ? "text-white/70" : "text-muted")}>{hariDari(d).slice(0, 3)}</span>
                <span className="block text-[14px] font-bold">{tanggalPendek(d)}</span>
                <span
                  className={cx(
                    "absolute right-1.5 top-1.5 h-2 w-2 rounded-full",
                    week.dirty[`A:${k}`] ? "bg-warn" : n ? "bg-brand" : on ? "bg-white/25" : "bg-[#e3e2dd]",
                  )}
                />
              </button>
            );
          })}
        </div>

        {/* editor */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-[16px] font-bold">
              {hariDari(slot.d)}, {slot.d}
            </h3>
            <p className="text-[12.5px] text-muted">
              {tim.no}. {tim.label}
              {slot.sub && ` · ${slot.sub}`}
              {meta && ` · diubah ${meta.oleh} ${new Date(meta.at).toLocaleString("id-ID", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {week.dirty[`A:${key}`] && (
              <Pill tone={syncState.status === "error" ? "bad" : "warn"}>
                {syncState.status === "error"
                  ? "gagal sinkron"
                  : syncState.status === "sending" || syncState.status === "queued"
                    ? "mengirim…"
                    : siapSinkron
                      ? "menunggu sinkron"
                      : "belum tersinkron"}
              </Pill>
            )}
            {items.length > 0 && (
              <Btn variant="soft" size="sm" onClick={() => setItems(items.map(rapikan))} title="Rapikan ejaan & kapitalisasi">
                <I.wand className="h-3.5 w-3.5" /> Rapikan
              </Btn>
            )}
          </div>
        </div>

        {!slotAda(week, slot.tim, slot.sub, slot.d) && (
          <div className="mt-3 flex items-start gap-2.5 rounded-xl bg-warn-soft p-3 text-[12.5px] text-warn">
            <I.alert className="mt-0.5 h-4 w-4 shrink-0" />
            Baris {slot.sub || tim.label} · {slot.d} tidak ada di tab {week.tab}, jadi isian ini tidak bisa dikirim ke sheet. Tambahkan barisnya di sheet lalu muat ulang.
          </div>
        )}

        <div key={flash} className={cx("mt-3 rounded-2xl", flash > 0 && "anim-flash")}>
          <ItemsEditor
            items={items}
            onChange={setItems}
            onSubmit={simpanLanjut}
            autoFocus
            placeholder={items.length ? "Tambah butir lain…" : "Apa yang dikerjakan hari ini? cth: bikin flyer kuis serasi buat medsos"}
          />
        </div>

        <label className="mt-5 block text-[12px] font-semibold uppercase tracking-wider text-muted">
          Link bukti data dukung
          <span className="font-medium normal-case tracking-normal">
            {" "}
            (tautan {tanggalPendek(slot.d)} ditulis di baris tanggal itu · kolom {hurufKolom(week.cols.lamp)} ·
            {slot.sub || tim.label} minggu ini)
          </span>
        </label>

        {urlsTgl.length > 0 && (
          <ul className="mt-2 space-y-1.5">
            {urlsTgl.map((u, i) => (
              <li key={u} className="flex items-center gap-2 rounded-xl border border-line bg-white px-2.5 py-2">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-paper font-mono text-[11px] font-bold text-muted">{i + 1}</span>
                <Pill tone="neutral" className="shrink-0">{tanggalPendek(slot.d)}</Pill>
                <a
                  href={u}
                  target="_blank"
                  rel="noreferrer"
                  className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-brand hover:underline"
                  title={u}
                >
                  {u}
                </a>
                <button
                  onClick={() => {
                    setUrlsTgl(urlsTgl.filter((x) => x !== u));
                    toast(`Tautan ${tanggalPendek(slot.d)} dihapus dari daftar — simpan untuk menerapkan`, "info");
                  }}
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-bad-soft hover:text-bad"
                  title="Hapus tautan ini"
                  aria-label={`Hapus tautan ${i + 1}`}
                >
                  <I.trash className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {tanpaTgl.length > 0 && (
          <div className="mt-2 rounded-xl border border-warn/40 bg-warn-soft/40 px-3 py-2">
            <p className="text-[11.5px] font-semibold text-ink">
              Tautan di sheet yang belum bertanggal ({tanpaTgl.length})
            </p>
            <ul className="mt-1.5 space-y-1">
              {tanpaTgl.map((u) => (
                <li key={u} className="flex items-center gap-2">
                  <a
                    href={u}
                    target="_blank"
                    rel="noreferrer"
                    className="min-w-0 flex-1 truncate text-[12px] font-medium text-brand hover:underline"
                    title={u}
                  >
                    {u}
                  </a>
                  <Btn
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (urlsTgl.some((x) => x.toLowerCase() === u.toLowerCase())) return;
                      setUrlsTgl([...urlsTgl, u]);
                      toast(`Tautan dipakai untuk ${tanggalPendek(slot.d)} — simpan untuk menerapkan`);
                    }}
                  >
                    Pakai tanggal ini
                  </Btn>
                </li>
              ))}
            </ul>
            <p className="mt-1 text-[11px] leading-relaxed text-muted">
              Ditulis langsung di sheet tanpa awalan tanggal. Tekan “Pakai tanggal ini” agar tautannya tercatat pada{" "}
              {tanggalPendek(slot.d)}.
            </p>
          </div>
        )}

        {jumlahLain > 0 && (
          <p className="mt-2 rounded-xl bg-paper px-3 py-2 text-[11.5px] leading-relaxed text-muted">
            Sel ini juga menyimpan <b className="text-ink">{jumlahLain} tautan lain</b> (tanggal lain / belum
            bertanggal) — tetap utuh dan tidak tersentuh saat Anda menyimpan tanggal ini.
          </p>
        )}

        <div className="mt-2 flex items-center gap-2 rounded-xl border border-line bg-white px-3 transition focus-within:border-brand">
          <I.link className="h-4 w-4 shrink-0 text-muted" />
          <input
            value={lampBaru}
            onChange={(e) => setLampBaru(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                tambahLamp();
              }
            }}
            onPaste={(e) => {
              const t = e.clipboardData.getData("text");
              if (splitLinks(t).length > 1) {
                e.preventDefault();
                const gabung = [...urlsTgl];
                splitLinks(t).forEach((u) => {
                  if (!gabung.some((x) => x.toLowerCase() === u.toLowerCase())) gabung.push(u);
                });
                setUrlsTgl(gabung);
                setLampBaru("");
                toast(`Beberapa tautan sekaligus ditambahkan untuk ${tanggalPendek(slot.d)}`);
              }
            }}
            placeholder={urlsTgl.length ? "Tambah tautan lain…" : "https://drive.google.com/…"}
            className="h-11 w-full bg-transparent text-[13.5px] outline-none"
          />
          <Btn variant="soft" size="sm" onClick={tambahLamp} disabled={!lampBaru.trim()} className="shrink-0">
            <I.plus className="h-3.5 w-3.5" /> Tambah
          </Btn>
        </div>
        <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted">
          Tautan di sini ditulis ke <b>baris {tanggalPendek(slot.d)}</b> (kolom{" "}
          {hurufKolom(week.cols.lamp)}) sebagai <span className="font-mono">{slot.d}: https://…</span>. Tautan tanggal
          lain tetap di barisnya masing-masing — skrip hanya menambah, tidak ada yang terhapus kecuali Anda menekan
          tombol hapus. Saat mengisi manual di sheet, tulis tanggalnya di depan tautan (mis.{" "}
          <span className="font-mono">2 November 2026: https://…</span>; ditulis{" "}
          <span className="font-mono">2/11/2026</span> atau <span className="font-mono">2 Nov 2026</span> juga
          dikenali). Tempel <b>alamat tautannya</b> apa adanya — tautan yang disisipkan lewat “Sisipkan link”
          berteks (mis. tulisan “Bukti 2 Nov” yang bisa diklik) tidak terbaca aplikasi karena yang tersimpan hanya
          teksnya.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-end gap-2 border-t border-line pt-5">
          <span className="mr-auto text-[12px] text-muted">
            {berubah
              ? "Ada perubahan belum disimpan"
              : siapSinkron
                ? syncState.status === "error"
                  ? "Tersimpan di perangkat · gagal sinkron ke Sheet"
                  : syncState.status === "sending" || syncState.status === "queued"
                    ? "Tersimpan · sedang masuk ke Sheet…"
                    : "Tersimpan dan otomatis masuk Google Sheet"
                : "Tersimpan di perangkat"}
          </span>
          {nextDate && (
            <Btn variant="ghost" onClick={() => simpan()} disabled={!berubah}>
              <I.check className="h-4 w-4" /> Simpan
            </Btn>
          )}
          {nextDate && (
            <Btn variant="brand" onClick={simpanLanjut}>
              Simpan & lanjut {hariDari(nextDate)}
              <I.arrow className="h-4 w-4" />
            </Btn>
          )}
          {!nextDate && (
            <Btn variant="brand" onClick={() => { if (berubah) simpan(); }} disabled={!berubah}>
              <I.check className="h-4 w-4" /> Simpan
            </Btn>
          )}
        </div>
      </Card>

      {/* panel samping */}
      <div className="space-y-4">
        <Card className="p-4">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-muted">Pratinjau sel sheet</p>
          <div className="mt-2 rounded-xl border border-line bg-paper">
            <div className="flex border-b border-line font-mono text-[10.5px] text-muted">
              <span className="w-12 border-r border-line px-2 py-1.5">E{week.rows.A[key] ?? "?"}</span>
              <span className="px-2 py-1.5">Uraian</span>
            </div>
            <pre className="max-h-[220px] overflow-auto whitespace-pre-wrap p-3 font-mono text-[12px] leading-relaxed">
              {joinUraian(items) || <span className="text-[#b9b8b2]">(kosong)</span>}
            </pre>
          </div>
          {entriTgl.length > 0 && (
            <>
              <div className="mt-2 rounded-xl border border-line bg-paper">
                <div className="flex border-b border-line font-mono text-[10.5px] text-muted">
                  <span className="w-12 border-r border-line px-2 py-1.5">
                    {hurufKolom(week.cols.lamp)}
                    {barisLamp ?? "?"}
                  </span>
                  <span className="px-2 py-1.5">
                    Lampiran {tanggalPendek(slot.d)} ({entriTgl.length} tautan)
                  </span>
                </div>
                <pre className="max-h-[160px] overflow-auto whitespace-pre-wrap p-3 font-mono text-[11.5px] leading-relaxed">
                  {susunLampiran(entriTgl)}
                </pre>
              </div>
            </>
          )}
        </Card>

        <Card className="p-4">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-muted">
            Minggu ini · {slot.sub || tim.label}
          </p>
          <ul className="mt-2 space-y-1">
            {week.dates.map((d) => {
              const its = week.kegiatan[slotKey(slot.tim, slot.sub, d)] ?? [];
              const on = d === slot.d;
              return (
                <li key={d}>
                  <button
                    onClick={() => pindah({ ...slot, d })}
                    className={cx("w-full rounded-xl px-3 py-2 text-left transition", on ? "bg-brand-soft" : "hover:bg-paper")}
                  >
                    <span className="flex items-center justify-between text-[12.5px] font-semibold">
                      {hariDari(d)} {tanggalPendek(d)}
                      <span className={cx("text-[11px]", its.length ? "text-brand" : "text-[#b9b8b2]")}>{its.length ? `${its.length} butir` : "kosong"}</span>
                    </span>
                    {its[0] && <span className="mt-0.5 line-clamp-1 block text-[11.5px] text-muted">{its[0]}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card className="bg-paper p-4">
          <p className="flex items-center gap-2 text-[12.5px] font-semibold">
            <I.spark className="h-4 w-4 text-brand" /> Tips cepat
          </p>
          <ul className="mt-2 space-y-1.5 text-[12px] leading-relaxed text-muted">
            <li>· Tulis santai: “bikin flyer buat medsos” otomatis jadi “Membuat flyer untuk media sosial”.</li>
            <li>· <b>Ctrl/⌘ + Enter</b> = simpan & lanjut ke hari berikutnya.</li>
            <li>· Isian langsung masuk Google Sheet otomatis — tanpa menyalin ke sheet.</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}

/* ------------------------------- form rencana ------------------------------- */

function FormRencana({ week }: { week: WeekData }) {
  const { settings, updateWeek } = useApp();
  const toast = useToast();
  const urut = useMemo(() => {
    const u = TIMS.find((t) => t.id === settings.timUtama);
    return u ? [u, ...TIMS.filter((t) => t.id !== u.id)] : TIMS;
  }, [settings.timUtama]);
  const [buka, setBuka] = useState<string>(urut[0].id);
  const [draft, setDraft] = useState<Record<string, string[]>>({});

  const itemsOf = (id: string) => draft[id] ?? week.rencana[id] ?? [];

  const simpan = (id: string) => {
    const bersih = itemsOf(id).map(rapikan).filter(Boolean);
    updateWeek((w) => setRencana(w, id, bersih, settings.nama));
    setDraft((d) => {
      const n = { ...d };
      delete n[id];
      return n;
    });
    toast(`Rencana ${timById(id)?.label} tersimpan${settings.scriptUrl && settings.token && settings.autoSync ? " · langsung ke Sheet" : ""}`);
    const i = urut.findIndex((t) => t.id === id);
    const next = urut.slice(i + 1).find((t) => !(week.rencana[t.id] ?? []).length);
    if (next) setBuka(next.id);
  };

  return (
    <div className="space-y-3">
      <p className="text-[13.5px] text-muted">{week.judulRencana || "Rencana kegiatan minggu berikutnya"} — satu sel per tim di kolom D.</p>
      {urut.map((t) => {
        const items = itemsOf(t.id);
        const on = buka === t.id;
        const changed = draft[t.id] !== undefined;
        return (
          <Card key={t.id} className={cx("overflow-hidden transition", on && "border-[#d3d2cc] shadow-sm")}>
            <button onClick={() => setBuka(on ? "" : t.id)} className="flex w-full items-center gap-3 px-5 py-4 text-left">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: t.tone }} />
              <span className="text-[14px] font-bold">
                <span className="mr-1.5 text-[12px] text-muted">{t.no}</span>
                {t.label}
              </span>
              {week.dirty[`B:${t.id}`] && <Pill tone="warn">menunggu sinkron</Pill>}
              <span className={cx("ml-auto text-[12px] font-semibold", items.length ? "text-brand" : "text-[#b9b8b2]")}>
                {items.length ? `${items.length} rencana` : "kosong"}
              </span>
              <I.down className={cx("h-4 w-4 text-muted transition-transform", on && "rotate-180")} />
            </button>
            {on && (
              <div className="anim-fade border-t border-line px-5 pb-5 pt-4">
                <ItemsEditor
                  items={items}
                  onChange={(v) => setDraft((d) => ({ ...d, [t.id]: v }))}
                  onSubmit={() => simpan(t.id)}
                  autoFocus
                  placeholder="Rencana kegiatan minggu depan…"
                />
                <div className="mt-4 flex justify-end">
                  <Btn variant="brand" onClick={() => simpan(t.id)} disabled={!changed}>
                    <I.check className="h-4 w-4" /> Simpan rencana
                  </Btn>
                </div>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
