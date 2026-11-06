import { useEffect, useMemo } from "react";
import { useApp } from "../lib/store";
import { SLOT_ROWS, TIMS, TOTAL_PEGAWAI, hariDari, norm, rupiahPendek, ringkas, slotAda, slotKey, slotLabel, tanggalPendek } from "../lib/model";
import { go } from "../components/Shell";
import { jamSinkron } from "../lib/sync";
import { Btn, Card, I, Pill, Progress, SectionTitle, Spinner, cx } from "../components/ui";
import { StateGate } from "./common";

export default function DashboardView() {
  const { week, settings, setSettings, trend, loadTrend, trendLoading, tabs, pendingCount, syncState, reload, dibacaAt } = useApp();

  // Peta isian harus memakai isi sheet terbaru: baca ulang diam-diam saat dashboard dibuka.
  useEffect(() => {
    if (!dibacaAt || Date.now() - dibacaAt > 8000) void reload(undefined, true);
  }, [reload, dibacaAt]);

  useEffect(() => {
    const have = tabs.slice(0, 6).filter((t) => trend[t.gid]).length;
    if (have < 4 && !trendLoading) loadTrend(6);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const r = useMemo(() => (week ? ringkas(week) : null), [week]);

  // rincian baris bagian A yang benar-benar terbaca dari sheet (untuk menelusuri data yang tidak muncul)
  const rincianA = useMemo(
    () =>
      !week
        ? []
        : Object.entries(week.rows.A)
            .map(([k, baris]) => {
              const [tim, sub, tgl] = k.split("|");
              return { k, baris, tim, sub, tgl, items: week.kegiatan[k] ?? [] };
            })
            .sort((a, b) => a.baris - b.baris),
    [week],
  );

  if (!week || !r) return <StateGate />;

  const pct = r.slotTotal ? Math.round((r.slotTerisi / r.slotTotal) * 100) : 0;
  const anggaran = week.anggaran.filter((a) => /^032\.12\./.test(a.kode));
  const total = anggaran.find((a) => /total/i.test(a.uraian)) ?? anggaran[0];
  const realPct = total && total.pagu ? (total.realisasi / total.pagu) * 100 : 0;

  // slot kosong pertama untuk tim utama
  const timUtama = TIMS.find((t) => t.id === settings.timUtama);
  const kosongUtama = timUtama
    ? timUtama.subs.flatMap((sub) => week.dates.filter((d) => !week.kegiatan[slotKey(timUtama.id, sub, d)]).map((d) => ({ sub, d })))
    : [];

  const belum = SLOT_ROWS.map(({ tim, sub }) => ({
    tim,
    sub,
    hari: week.dates.filter((d) => slotAda(week, tim.id, sub, d) && !(week.kegiatan[slotKey(tim.id, sub, d)] ?? []).length),
  })).filter((x) => x.hari.length);

  const trendRows = tabs
    .slice(0, 6)
    .map((t) => ({ t, s: trend[t.gid] }))
    .reverse();

  return (
    <div className="space-y-6">
      {/* sapaan */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[13px] font-medium text-muted">{week.judul}</p>
          <h1 className="mt-1 text-[26px] font-extrabold tracking-tight sm:text-[30px]">
            Halo{settings.nama ? `, ${settings.nama.split(" ")[0]}` : ""} 👋
          </h1>
          <p className="mt-1 text-[14px] text-muted">
            {pct === 100
              ? "Semua kolom kegiatan minggu ini sudah terisi."
              : `${r.slotTotal - r.slotTerisi} dari ${r.slotTotal} kolom kegiatan masih kosong.`}
            {pendingCount > 0 && (
              <>
                {" "}
                <a
                  href="#/sinkron"
                  className={cx("font-semibold underline-offset-2 hover:underline", syncState.status === "error" ? "text-bad" : "text-warn")}
                >
                  {syncState.status === "error"
                    ? `${pendingCount} isian gagal masuk sheet — ulangi →`
                    : syncState.status === "setup"
                      ? `${pendingCount} isian menunggu — aktifkan sinkron →`
                      : `${pendingCount} isian sedang masuk ke sheet…`}
                </a>
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[11.5px] text-muted">{dibacaAt ? `Data sheet dibaca ${jamSinkron(dibacaAt)}` : "Membaca sheet…"}</p>
          <Btn variant="ghost" size="sm" onClick={() => void reload(undefined, true)} title="Ambil isi terbaru dari Google Sheet">
            <I.refresh className="h-4 w-4" /> Ambil data terbaru
          </Btn>
          <Btn variant="ghost" onClick={() => go("isi", { mode: "chat" })}>
            <I.chat className="h-4 w-4" />
            Isi lewat chat
          </Btn>
          <Btn
            variant="brand"
            onClick={() =>
              go("isi", timUtama && kosongUtama[0] ? { tim: timUtama.id, sub: kosongUtama[0].sub, d: kosongUtama[0].d } : {})
            }
          >
            <I.pen className="h-4 w-4" />
            {timUtama && kosongUtama[0] ? `Isi ${hariDari(kosongUtama[0].d)}, ${tanggalPendek(kosongUtama[0].d)}` : "Isi laporan"}
          </Btn>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Kelengkapan kegiatan" value={`${pct}%`} sub={`${r.slotTerisi}/${r.slotTotal} kolom`} bar={pct} icon={<I.check className="h-4 w-4" />} />
        <Kpi label="Butir kegiatan" value={String(r.butir)} sub={`${week.dates.length} hari kerja`} icon={<I.pen className="h-4 w-4" />} />
        <Kpi
          label="Rencana minggu depan"
          value={`${r.rencanaTerisi}/7`}
          sub="tim sudah mengisi"
          bar={(r.rencanaTerisi / 7) * 100}
          tone="#8b7cf6"
          icon={<I.flag className="h-4 w-4" />}
          onClick={() => go("isi", { mode: "rencana" })}
        />
        <Kpi
          label="Rata-rata hadir"
          value={r.rataHadir === null ? "—" : `${Math.round(r.rataHadir)}`}
          sub={r.rataHadir === null ? "presensi belum diisi" : `dari ${TOTAL_PEGAWAI} pegawai · ${r.presensiTerisi} hari`}
          bar={r.rataHadir === null ? undefined : (r.rataHadir / TOTAL_PEGAWAI) * 100}
          tone="#4a8bf0"
          icon={<I.users className="h-4 w-4" />}
          onClick={() => go("presensi")}
        />
      </div>

      {/* heatmap */}
      <Card className="p-5">
        <SectionTitle
          title="Peta isian kegiatan"
          sub="Klik kotak untuk mengisi atau mengubah. Angka = jumlah butir kegiatan."
          right={
            <div className="flex items-center gap-3 text-[11.5px] text-muted">
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded border border-dashed border-[#cfcec8]" /> kosong
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded bg-brand/30" /> terisi
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded ring-2 ring-warn" /> menunggu sinkron
              </span>
            </div>
          }
        />
        <div className="thin-scroll -mx-1 overflow-x-auto px-1 pb-1">
          <table className="w-full min-w-[620px] border-separate border-spacing-1.5">
            <thead>
              <tr>
                <th className="w-[210px]" />
                {week.dates.map((d) => (
                  <th key={d} className="pb-1 text-center text-[11.5px] font-semibold text-muted">
                    <span className="block text-ink">{hariDari(d)}</span>
                    {tanggalPendek(d)}
                  </th>
                ))}
                <th className="w-[70px] pb-1 text-right text-[11.5px] font-semibold text-muted">Terisi</th>
              </tr>
            </thead>
            <tbody>
              {SLOT_ROWS.map(({ tim, sub }) => {
                const mine = tim.id === settings.timUtama;
                const terisi = week.dates.filter((d) => (week.kegiatan[slotKey(tim.id, sub, d)] ?? []).length).length;
                return (
                  <tr key={tim.id + sub}>
                    <td className="pr-2">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: tim.tone }} />
                        <span className={cx("truncate text-[13px]", mine ? "font-bold" : "font-medium")}>
                          <span className="mr-1 text-[11px] text-muted">{tim.no}</span>
                          {tim.label}
                          {sub && <span className="text-muted"> · {sub}</span>}
                        </span>
                        {mine && <Pill tone="brand" className="!px-1.5 !py-0.5 !text-[9.5px]">tim Anda</Pill>}
                      </div>
                    </td>
                    {week.dates.map((d) => {
                      const k = slotKey(tim.id, sub, d);
                      const n = (week.kegiatan[k] ?? []).length;
                      const dirty = !!week.dirty[`A:${k}`];
                      if (!slotAda(week, tim.id, sub, d))
                        return (
                          <td key={d}>
                            <div className="grid h-11 place-items-center rounded-lg bg-[#f3f2ee] text-[10.5px] font-medium text-[#b9b8b2]" title="Baris ini tidak ada di tab ini">
                              n/a
                            </div>
                          </td>
                        );
                      return (
                        <td key={d}>
                          <button
                            onClick={() => go("isi", { tim: tim.id, sub, d })}
                            title={`${slotLabel(tim.id, sub)} · ${d}${n ? ` · ${n} butir` : " · kosong"}`}
                            className={cx(
                              "group grid h-11 w-full place-items-center rounded-lg text-[13px] font-bold transition-all hover:scale-[1.04]",
                              n ? "text-ink" : "border border-dashed border-[#d6d5cf] text-[#b9b8b2] hover:border-brand hover:text-brand",
                              dirty && "ring-2 ring-warn ring-offset-1",
                            )}
                            style={n ? { background: `color-mix(in srgb, ${tim.tone} ${Math.min(18 + n * 14, 70)}%, white)` } : undefined}
                          >
                            {n ? n : <I.plus className="h-4 w-4" />}
                          </button>
                        </td>
                      );
                    })}
                    <td className="text-right text-[12px] font-semibold text-muted">
                      {terisi}/{week.dates.length}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <details className="mt-3 rounded-lg border border-line px-3 py-2">
            <summary className="cursor-pointer text-[11.5px] font-semibold text-muted">
              Rincian pembacaan sheet (diagnosa) · {rincianA.length} baris bagian A · {week.dates.length} tanggal
            </summary>
            <div className="mt-2 space-y-0.5 text-[11px] leading-relaxed text-muted">
              <p className="font-semibold text-ink">Tab {week.tab}</p>
              {rincianA.length === 0 && <p>Belum ada baris bagian A yang terbaca.</p>}
              {rincianA.slice(0, 60).map((x) => (
                <p key={x.k} className="truncate" title={x.items.join(" · ")}>
                  baris {x.baris} · {slotLabel(x.tim, x.sub)} · {x.tgl} · {x.items.length ? `${x.items.length} butir` : "kosong"}
                </p>
              ))}
              {rincianA.length > 60 && <p>… {rincianA.length - 60} baris lainnya</p>}
              {!!week.takTerbaca?.length && (
                <>
                  <p className="pt-1 font-semibold text-[#8a5a12]">Dilewati ({week.takTerbaca.length})</p>
                  {week.takTerbaca.map((t) => (
                    <p key={t.baris} className="truncate" title={t.teks}>
                      baris {t.baris} · {t.teks}
                    </p>
                  ))}
                </>
              )}
            </div>
          </details>
          {!!week.takTerbaca?.length && (
            <p
              className="mt-3 flex items-start gap-1.5 rounded-lg bg-warn-soft px-3 py-2 text-[11.5px] leading-relaxed text-[#8a5a12]"
              title={week.takTerbaca.map((t) => `baris ${t.baris}: ${t.teks}`).join("\n")}
            >
              <I.alert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                {week.takTerbaca.length} baris di tab ini belum bisa dipetakan ke tim/tanggal — baris{" "}
                {week.takTerbaca.slice(0, 5).map((t) => t.baris).join(", ")}
                {week.takTerbaca.length > 5 ? ", …" : ""}. Arahkan kursor untuk melihat isinya.
              </span>
            </p>
          )}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* belum diisi */}
        <Card className="p-5 lg:col-span-3">
          <SectionTitle title="Belum diisi" sub={belum.length ? "Kirim pengingat ke tim terkait atau isi langsung." : undefined} />
          {belum.length === 0 ? (
            <div className="grid place-items-center rounded-xl bg-brand-soft py-10 text-center">
              <I.check className="h-8 w-8 text-brand" />
              <p className="mt-2 text-[14px] font-semibold text-brand">Lengkap! Semua tim sudah mengisi.</p>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {belum.map(({ tim, sub, hari }) => (
                <li key={tim.id + sub} className="flex flex-wrap items-center gap-3 py-3">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: tim.tone }} />
                  <span className="min-w-[150px] flex-1 text-[13.5px] font-semibold">{slotLabel(tim.id, sub)}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {hari.map((d) => (
                      <button
                        key={d}
                        onClick={() => go("isi", { tim: tim.id, sub, d })}
                        className="rounded-lg border border-line px-2 py-1 text-[11.5px] font-semibold text-muted transition hover:border-brand hover:bg-brand-soft hover:text-brand"
                      >
                        {hariDari(d).slice(0, 3)} {tanggalPendek(d)}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* tren */}
        <Card className="p-5 lg:col-span-2">
          <SectionTitle
            title="Tren 6 minggu"
            sub="Kelengkapan kolom kegiatan per tab"
            right={
              <button
                onClick={() => loadTrend(6)}
                disabled={trendLoading}
                className="grid h-8 w-8 place-items-center rounded-lg border border-line text-muted transition hover:text-ink"
                title="Muat ulang tren"
              >
                {trendLoading ? <Spinner className="h-3.5 w-3.5" /> : <I.refresh className="h-4 w-4" />}
              </button>
            }
          />
          <div className="flex h-[170px] items-end gap-2.5">
            {trendRows.map(({ t, s }) => {
              const p = s && s.slotTotal ? (s.slotTerisi / s.slotTotal) * 100 : 0;
              const active = t.gid === week.gid;
              return (
                <button key={t.gid} onClick={() => setSettings({ activeGid: t.gid })} className="group flex h-full flex-1 flex-col items-center justify-end gap-1.5" title={`${t.name}: ${Math.round(p)}%`}>
                  <span className="text-[11px] font-bold text-muted">{s ? `${Math.round(p)}%` : ""}</span>
                  <div className="relative flex w-full flex-1 items-end overflow-hidden rounded-lg bg-paper">
                    <div
                      className={cx("w-full rounded-lg transition-[height] duration-700", active ? "bg-brand" : "bg-[#cfe9dd] group-hover:bg-[#a9dcc5]")}
                      style={{ height: s ? `${Math.max(4, p)}%` : "0%" }}
                    />
                    {!s && trendLoading && <span className="absolute inset-0 animate-pulse bg-[#f0efeb]" />}
                  </div>
                  <span className={cx("truncate text-[11px] font-semibold", active ? "text-ink" : "text-muted")}>{t.name}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-4 space-y-2 border-t border-line pt-4">
            {TIMS.map((t) => {
              const s = r.perTim[t.id];
              const p = s && s.total ? (s.terisi / s.total) * 100 : 0;
              return (
                <div key={t.id} className="flex items-center gap-3">
                  <span className="w-[112px] truncate text-[12px] font-medium text-muted">{t.label}</span>
                  <Progress value={p} tone={t.tone} />
                  <span className="w-9 text-right text-[11.5px] font-bold">{Math.round(p)}%</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* presensi ringkas + anggaran */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <SectionTitle
            title="Presensi minggu ini"
            sub={week.judulPresensi || "Bagian C"}
            right={
              <Btn variant="ghost" size="sm" onClick={() => go("presensi")}>
                Isi presensi <I.chev className="h-3.5 w-3.5" />
              </Btn>
            }
          />
          <div className="grid grid-cols-5 gap-2">
            {week.dates.map((d) => {
              const p = week.presensi[norm(d)];
              const ok = p && p.hadir !== null;
              return (
                <button
                  key={d}
                  onClick={() => go("presensi")}
                  className={cx("rounded-xl border p-3 text-left transition hover:-translate-y-0.5", ok ? "border-line bg-white" : "border-dashed border-[#d6d5cf] bg-paper")}
                >
                  <p className="text-[11px] font-semibold text-muted">{hariDari(d).slice(0, 3)}</p>
                  <p className="mt-1 text-[20px] font-extrabold leading-none">{ok ? p!.hadir : "—"}</p>
                  <p className="mt-1 truncate text-[10.5px] text-muted">{ok ? `DL ${p!.dl} · Cuti ${p!.cuti}` : "belum"}</p>
                </button>
              );
            })}
          </div>
        </Card>

        <Card className="p-5">
          <SectionTitle
            title="Realisasi anggaran"
            sub="Bagian D — dibaca dari tab ini"
            right={
              <div className="flex items-center gap-2">
                {total ? <Pill tone={realPct > 0 ? "brand" : "neutral"}>{realPct.toFixed(1).replace(".", ",")}%</Pill> : null}
                <Btn variant="ghost" size="sm" onClick={() => go("keuangan")}>
                  Isi realisasi <I.chev className="h-3.5 w-3.5" />
                </Btn>
              </div>
            }
          />
          {anggaran.length === 0 ? (
            <p className="rounded-xl bg-paper p-4 text-[13px] text-muted">Tabel realisasi anggaran tidak ditemukan di tab ini.</p>
          ) : (
            <ul className="space-y-3.5">
              {anggaran.map((a) => {
                const p = a.pagu ? (a.realisasi / a.pagu) * 100 : 0;
                return (
                  <li key={a.kode}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 truncate text-[13px] font-semibold">
                        <span className="mr-1.5 font-mono text-[11px] font-medium text-muted">{a.kode}</span>
                        {a.uraian}
                      </span>
                      <span className="shrink-0 font-mono text-[11.5px] text-muted">{rupiahPendek(a.pagu)}</span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-3">
                      <Progress value={p} tone="#0f9f6e" />
                      <span className="w-12 text-right text-[11.5px] font-bold">{p.toFixed(1).replace(".", ",")}%</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {total && total.realisasi === 0 && (
            <p className="mt-4 text-[12px] text-muted">Realisasi di tab ini masih 0 — diisi bendahara langsung di sheet.</p>
          )}
        </Card>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  bar,
  tone = "#0f9f6e",
  icon,
  onClick,
}: {
  label: string;
  value: string;
  sub: string;
  bar?: number;
  tone?: string;
  icon: React.ReactNode;
  onClick?: () => void;
}) {
  const C = onClick ? "button" : "div";
  return (
    <C onClick={onClick} className={cx("rounded-2xl border border-line bg-white p-4 text-left", onClick && "transition hover:-translate-y-0.5 hover:border-[#d3d2cc]")}>
      <div className="flex items-center justify-between text-muted">
        <span className="text-[12px] font-semibold">{label}</span>
        <span style={{ color: tone }}>{icon}</span>
      </div>
      <p className="mt-2 text-[28px] font-extrabold leading-none tracking-tight">{value}</p>
      <p className="mt-1.5 text-[11.5px] text-muted">{sub}</p>
      {bar !== undefined && (
        <div className="mt-3">
          <Progress value={bar} tone={tone} h={5} />
        </div>
      )}
    </C>
  );
}
