import { useEffect, useRef, useState } from "react";
import { setSelKeuangan, useApp } from "../lib/store";
import { type Aplikasi, type Presensi, TOTAL_PEGAWAI, emptyAplikasi, emptyPresensi, hariDari, norm, selKey, tanggalPendek, totalPresensi } from "../lib/model";
import { Btn, Card, I, Pill, SectionTitle, cx, useToast } from "../components/ui";
import { StateGate } from "./common";

const hitungJumlahNama = (ket: string) =>
  ket
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean).length;

export default function PresensiView() {
  const { week, settings, updateWeek } = useApp();
  const toast = useToast();
  const [pres, setPres] = useState<Record<string, Presensi>>({});
  const [apl, setApl] = useState<Record<string, Aplikasi>>({});
  const [buka, setBuka] = useState<string>("");
  /** isian sel tabel aplikasi presensi (kolom mengikuti sheet) */
  const [selDraft, setSelDraft] = useState<Record<string, string>>({});

  // isian yang sedang diketik tidak boleh tertimpa pembacaan ulang sheet otomatis
  const awal = useRef<{ p: Record<string, Presensi>; a: Record<string, Aplikasi> }>({ p: {}, a: {} });
  useEffect(() => {
    if (!week) return;
    const beda = week.dates.some((d) => {
      const k = norm(d);
      const p0 = awal.current.p[k];
      const a0 = awal.current.a[k];
      return (
        (!!p0 && !!pres[k] && JSON.stringify(pres[k]) !== JSON.stringify(p0)) ||
        (!!a0 && !!apl[k] && JSON.stringify(apl[k]) !== JSON.stringify(a0))
      );
    });
    if (beda) return;
    const p: Record<string, Presensi> = {};
    const a: Record<string, Aplikasi> = {};
    week.dates.forEach((d) => {
      const k = norm(d);
      p[k] = { ...(week.presensi[k] ?? emptyPresensi()) };
      a[k] = { ...(week.aplikasi[k] ?? emptyAplikasi()) };
    });
    awal.current = { p, a };
    setPres(p);
    setApl(a);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [week?.gid, week?.importedAt]);

  if (!week) return <StateGate />;

  // tabel aplikasi presensi apa adanya (termasuk kolom Nama) — dipakai bila tabelnya bukan per tanggal
  const tabelApl = week.aplikasiTabel;
  const nilaiSheet: Record<string, string> = {};
  tabelApl?.baris.forEach((r) =>
    tabelApl.kolom.forEach((k) => (nilaiSheet[selKey(r.nomor, k.index)] = r.sel[k.index] ?? "")),
  );
  const nilaiSel = (kunci: string) => selDraft[kunci] ?? week.selKeuangan?.[kunci] ?? nilaiSheet[kunci] ?? "";
  const changedSel = Object.keys(selDraft).filter(
    (k) => selDraft[k] !== (week.selKeuangan?.[k] ?? nilaiSheet[k] ?? ""),
  );

  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  const changedP = week.dates.filter((d) => {
    const k = norm(d);
    return pres[k] && !same(pres[k], week.presensi[k] ?? emptyPresensi());
  });
  const changedA = week.dates.filter((d) => {
    const k = norm(d);
    return apl[k] && !same(apl[k], week.aplikasi[k] ?? emptyAplikasi());
  });
  const adaPerubahan = changedP.length + changedA.length + changedSel.length > 0;

  const setP = (k: string, patch: Partial<Presensi>) => setPres((s) => ({ ...s, [k]: { ...s[k], ...patch } }));
  const setA = (k: string, patch: Partial<Aplikasi>) => setApl((s) => ({ ...s, [k]: { ...s[k], ...patch } }));

  const simpan = () => {
    updateWeek((w) => {
      const presensi = { ...w.presensi };
      const aplikasi = { ...w.aplikasi };
      const dirty = { ...w.dirty };
      const meta = { ...w.meta };
      changedP.forEach((d) => {
        const k = norm(d);
        presensi[k] = pres[k];
        dirty[`C:${k}`] = true;
        meta[`C:${k}`] = { oleh: settings.nama, at: Date.now() };
      });
      changedA.forEach((d) => {
        const k = norm(d);
        aplikasi[k] = apl[k];
        dirty[`P:${k}`] = true;
        meta[`P:${k}`] = { oleh: settings.nama, at: Date.now() };
      });
      let next = { ...w, presensi, aplikasi, dirty, meta };
      changedSel.forEach((kunci) => {
        const [b, c] = kunci.split(":");
        next = setSelKeuangan(next, Number(b), Number(c), selDraft[kunci], settings.nama);
      });
      return next;
    });
    setSelDraft({});
    toast(
      `Presensi tersimpan · ${changedP.length + changedA.length + changedSel.length} isian${settings.scriptUrl && settings.token && settings.autoSync ? " · langsung ke Sheet" : ""}`,
    );
  };

  const otomatis = (k: string) => {
    const p = pres[k];
    setP(k, { hadir: Math.max(0, TOTAL_PEGAWAI - p.tanpaKet - p.dl - p.cuti) });
  };

  const num = (v: string) => (v === "" ? null : Math.max(0, Math.floor(Number(v) || 0)));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[13px] font-medium text-muted">{week.judulPresensi || "Bagian C"}</p>
          <h1 className="mt-1 text-[24px] font-extrabold tracking-tight sm:text-[28px]">Presensi pegawai</h1>
          <p className="mt-1 max-w-[620px] text-[13px] leading-relaxed text-muted">
            Total {TOTAL_PEGAWAI} pegawai (PNS 43 · PPPK 13). Jumlah keempat kolom sebaiknya = {TOTAL_PEGAWAI}. Setelah
            disimpan, presensi langsung masuk Google Sheet secara otomatis.
          </p>
        </div>
        <Btn variant="brand" onClick={simpan} disabled={!adaPerubahan}>
          <I.check className="h-4 w-4" />
          Simpan presensi{adaPerubahan ? ` (${changedP.length + changedA.length + changedSel.length})` : ""}
        </Btn>
      </div>

      <div className="space-y-3">
        {week.dates.map((d) => {
          const k = norm(d);
          const p = pres[k];
          if (!p) return null;
          const tot = totalPresensi(p);
          const terisi = p.hadir !== null;
          const cocok = terisi && tot === TOTAL_PEGAWAI;
          const on = buka === k;
          return (
            <Card key={k} className={cx("p-4 sm:p-5", changedP.includes(d) && "border-warn/50")}>
              <div className="flex flex-wrap items-center gap-3">
                <div className="w-[108px]">
                  <p className="text-[14px] font-bold">{hariDari(d)}</p>
                  <p className="text-[12px] text-muted">{tanggalPendek(d)}</p>
                </div>

                <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-4">
                  <NumField label="Hadir" value={p.hadir} onChange={(v) => setP(k, { hadir: num(v) })} strong />
                  <NumField label="Tanpa ket." value={p.tanpaKet} onChange={(v) => setP(k, { tanpaKet: num(v) ?? 0 })} />
                  <NumField label="Dinas luar" value={p.dl} onChange={(v) => setP(k, { dl: num(v) ?? 0 })} />
                  <NumField label="Cuti" value={p.cuti} onChange={(v) => setP(k, { cuti: num(v) ?? 0 })} />
                </div>

                <div className="flex items-center gap-2">
                  {terisi ? (
                    <Pill tone={cocok ? "brand" : "warn"}>
                      {cocok ? <I.check className="h-3 w-3" /> : <I.alert className="h-3 w-3" />}
                      {tot}/{TOTAL_PEGAWAI}
                    </Pill>
                  ) : (
                    <Pill>belum</Pill>
                  )}
                  <button
                    onClick={() => otomatis(k)}
                    className="rounded-lg border border-line px-2.5 py-1.5 text-[11.5px] font-semibold text-muted transition hover:border-brand hover:text-brand"
                    title={`Hadir = ${TOTAL_PEGAWAI} − tanpa ket − DL − cuti`}
                  >
                    Hitung hadir
                  </button>
                  <button onClick={() => setBuka(on ? "" : k)} className="grid h-8 w-8 place-items-center rounded-lg border border-line text-muted transition hover:text-ink" title="Nama pegawai DL/cuti">
                    <I.down className={cx("h-4 w-4 transition-transform", on && "rotate-180")} />
                  </button>
                </div>
              </div>

              {on && (
                <div className="anim-fade mt-4 grid gap-3 border-t border-line pt-4 sm:grid-cols-3">
                  {(
                    [
                      ["tanpaKetKet", "tanpaKet", "Tanpa keterangan — nama"],
                      ["dlKet", "dl", "Dinas luar — nama"],
                      ["cutiKet", "cuti", "Cuti — nama & jenis"],
                    ] as const
                  ).map(([field, nField, label]) => (
                    <label key={field} className="block">
                      <span className="flex items-center justify-between text-[12px] font-semibold text-muted">
                        {label}
                        {p[field] && hitungJumlahNama(p[field]) !== p[nField] && (
                          <button
                            type="button"
                            onClick={() => setP(k, { [nField]: hitungJumlahNama(p[field]) } as Partial<Presensi>)}
                            className="text-[11px] font-semibold text-brand hover:underline"
                          >
                            set jumlah = {hitungJumlahNama(p[field])}
                          </button>
                        )}
                      </span>
                      <textarea
                        value={p[field]}
                        onChange={(e) => setP(k, { [field]: e.target.value } as Partial<Presensi>)}
                        rows={4}
                        placeholder={"1. Nama pegawai\n2. …"}
                        className="mt-1.5 w-full resize-y rounded-xl border border-line bg-paper px-3 py-2 text-[13px] leading-relaxed outline-none transition focus:border-brand focus:bg-white"
                      />
                    </label>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {tabelApl ? (
        <Card className="p-5">
          <SectionTitle
            title="Penggunaan aplikasi presensi"
            sub={`${tabelApl.judul} · ${tabelApl.baris.length} baris · kolom mengikuti sheet (baris ${tabelApl.header})`}
            right={<Pill>{tabelApl.kolom.length} kolom</Pill>}
          />
          <div className="thin-scroll overflow-x-auto">
            <table className="w-full min-w-[620px] border-collapse text-[12.5px]">
              <thead>
                <tr className="border-b border-line text-left text-[11px] uppercase tracking-wider text-muted">
                  {tabelApl.kolom.map((k) => (
                    <th key={k.index} className="whitespace-nowrap py-2 pr-2 font-semibold">
                      {k.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tabelApl.baris.map((r) => (
                  <tr key={r.nomor} className="border-b border-line/70 align-top">
                    {tabelApl.kolom.map((k) => {
                      const kunci = selKey(r.nomor, k.index);
                      const kotor = selDraft[kunci] !== undefined && selDraft[kunci] !== (week.selKeuangan?.[kunci] ?? nilaiSheet[kunci] ?? "");
                      // kolom penanda hanya bisa dibaca — kecuali pada baris kosong (baris baru)
                      if (k.index === r.labelKolom && r.label)
                        return (
                          <td key={k.index} className="py-2 pr-2 font-semibold">
                            {r.sel[k.index] ?? r.label}
                          </td>
                        );
                      return (
                        <td key={k.index} className="py-1.5 pr-2">
                          <input
                            value={nilaiSel(kunci)}
                            onChange={(e) => setSelDraft((d) => ({ ...d, [kunci]: e.target.value }))}
                            placeholder="—"
                            className={cx(
                              "w-full min-w-[76px] rounded-lg border bg-white px-2 py-1.5 text-[12px] outline-none focus:border-brand",
                              kotor ? "border-warn bg-warn-soft/40" : "border-line",
                            )}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11.5px] leading-relaxed text-muted">
            Tabel ini ditulis apa adanya ke baris &amp; kolom yang sama di sheet (dengan pengaman label baris), jadi nama
            pegawai dan kolom lain tidak berubah.
          </p>
        </Card>
      ) : Object.keys(week.rows.P).length === 0 ? (
        <Card className="bg-paper p-5 text-[13px] text-muted">
          Tab <b>{week.tab}</b> tidak memiliki tabel “Rekapitulasi Penggunaan Aplikasi Presensi”.
        </Card>
      ) : (
      <Card className="p-5">
        <SectionTitle title="Penggunaan aplikasi presensi" sub="Rekapitulasi Sikepo · ePresensi · Finger Print" />
        <div className="thin-scroll overflow-x-auto">
          <table className="w-full min-w-[560px] text-[13px]">
            <thead>
              <tr className="text-left text-[11.5px] font-semibold text-muted">
                <th className="pb-2 pr-3">Tanggal</th>
                <th className="pb-2 pr-2">Sikepo</th>
                <th className="pb-2 pr-2">ePresensi</th>
                <th className="pb-2 pr-2">Finger Print</th>
                <th className="pb-2 pr-2">Tidak presensi</th>
                <th className="pb-2">Cuti/DL</th>
              </tr>
            </thead>
            <tbody>
              {week.dates.map((d) => {
                const k = norm(d);
                const a = apl[k];
                if (!a) return null;
                return (
                  <tr key={k} className={cx("border-t border-line", changedA.includes(d) && "bg-warn-soft/50")}>
                    <td className="py-2 pr-3 font-semibold">
                      {hariDari(d).slice(0, 3)} {tanggalPendek(d)}
                    </td>
                    {(["sikepo", "epresensi", "fp", "tidak", "cutiDl"] as const).map((f) => (
                      <td key={f} className="py-2 pr-2">
                        <input
                          inputMode="numeric"
                          value={a[f] ?? ""}
                          onChange={(e) => setA(k, { [f]: num(e.target.value.replace(/\D/g, "")) } as Partial<Aplikasi>)}
                          className="h-10 w-full rounded-lg border border-line bg-paper px-3 text-center font-semibold outline-none transition focus:border-brand focus:bg-white"
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      )}

      {adaPerubahan && (
        <div className="no-print anim-pop sticky bottom-20 z-20 flex items-center justify-between gap-3 rounded-2xl bg-ink px-4 py-3 text-white shadow-xl lg:bottom-6">
          <span className="text-[13px] font-medium">{changedP.length + changedA.length + changedSel.length} isian presensi diubah</span>
          <Btn variant="brand" size="sm" onClick={simpan}>
            <I.check className="h-4 w-4" /> Simpan
          </Btn>
        </div>
      )}
    </div>
  );
}

function NumField({ label, value, onChange, strong }: { label: string; value: number | null; onChange: (v: string) => void; strong?: boolean }) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold text-muted">{label}</span>
      <input
        inputMode="numeric"
        value={value ?? ""}
        placeholder="—"
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
        className={cx(
          "mt-1 h-10 w-full rounded-lg border border-line bg-paper px-3 text-center outline-none transition focus:border-brand focus:bg-white",
          strong ? "text-[15px] font-extrabold" : "text-[14px] font-semibold",
        )}
      />
    </label>
  );
}
