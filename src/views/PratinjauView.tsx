import { useEffect } from "react";
import { useApp } from "../lib/store";
import { TIMS, TOTAL_PEGAWAI, joinUraian, lampKey, lampiranTanggal, norm, rupiah, serapan, slotKey, totalAnggaran } from "../lib/model";
import { presensiCells } from "../lib/sheet";
import { jamSinkron } from "../lib/sync";
import { Btn, I } from "../components/ui";
import { StateGate } from "./common";

const th = "border border-[#9a9a95] bg-[#f1f1ee] px-2 py-1.5 text-left text-[11.5px] font-bold print:bg-[#eee]";
const td = "border border-[#9a9a95] px-2 py-1.5 align-top text-[12px] leading-snug";

export default function PratinjauView() {
  const { week, settings, reload, dibacaAt } = useApp();

  // Pratinjau & cetak harus memakai isi sheet terbaru: ambil ulang diam-diam saat halaman dibuka.
  useEffect(() => {
    if (!dibacaAt || Date.now() - dibacaAt > 8000) void reload(undefined, true);
  }, [reload, dibacaAt]);

  if (!week) return <StateGate />;

  return (
    <div className="space-y-5">
      <div className="no-print flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[13px] font-medium text-muted">Tab {week.tab}</p>
          <h1 className="mt-1 text-[24px] font-extrabold tracking-tight sm:text-[28px]">Pratinjau laporan</h1>
          <p className="mt-1 text-[13px] text-muted">Tampilan mengikuti format sheet. Gunakan “Cetak / PDF” → Simpan sebagai PDF.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[11.5px] text-muted">
            {dibacaAt ? `Data sheet dibaca ${jamSinkron(dibacaAt)}` : "Membaca sheet…"}
          </p>
          <Btn variant="ghost" size="sm" onClick={() => void reload(undefined, true)} title="Ambil isi terbaru dari Google Sheet">
            <I.refresh className="h-4 w-4" /> Ambil data terbaru
          </Btn>
          <Btn onClick={() => window.print()}>
            <I.print className="h-4 w-4" /> Cetak / PDF
          </Btn>
        </div>
      </div>

      <article className="print-area mx-auto max-w-[900px] rounded-2xl border border-line bg-white p-6 shadow-sm sm:p-10">
        <header className="border-b-2 border-ink pb-4 text-center">
          <p className="text-[13px] font-bold tracking-wide">KEMENTERIAN KELAUTAN DAN PERIKANAN</p>
          <p className="text-[12px] font-semibold">PUSAT STANDARDISASI DAN SERTIFIKASI SUMBER DAYA MANUSIA KELAUTAN DAN PERIKANAN</p>
        </header>
        <div className="mt-5 text-center">
          <p className="text-[14px] font-extrabold uppercase">{week.judul}</p>
          <p className="text-[13px] font-bold">TIM DUKMAN</p>
        </div>

        {/* A */}
        <h2 className="mt-7 text-[13px] font-bold">A. {week.judulKegiatan || "Kegiatan"}</h2>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse">
            <thead>
              <tr>
                <th className={`${th} w-10`}>No</th>
                <th className={`${th} w-[120px]`}>Tim</th>
                <th className={`${th} w-[118px]`}>Tanggal</th>
                <th className={th}>Uraian</th>
                <th className={`${th} w-[120px]`}>Lampiran</th>
              </tr>
            </thead>
            <tbody>
              {TIMS.map((t) => {
                const rows = t.subs.flatMap((sub) => [
                  ...(sub ? [{ kind: "sub" as const, sub, d: "" }] : []),
                  ...week.dates.map((d) => ({ kind: "day" as const, sub, d })),
                ]);
                return rows.map((r, i) => {
                  // tautan bukti dukung mengikuti baris tanggalnya (sesuai isi kolom lampiran di sheet)
                  const lamp = r.kind === "day" ? lampiranTanggal(week.lampiran[lampKey(t.id, r.sub)] ?? "", r.d) : [];
                  return (
                    <tr key={t.id + r.sub + r.d + i}>
                      {i === 0 && (
                        <>
                          <td className={`${td} text-center font-semibold`} rowSpan={rows.length}>
                            {t.no}
                          </td>
                          <td className={`${td} font-semibold`} rowSpan={rows.length}>
                            {t.label}
                          </td>
                        </>
                      )}
                      {r.kind === "sub" ? (
                        <td className={`${td} bg-[#fafaf7] font-bold italic`} colSpan={2}>
                          {r.sub}
                        </td>
                      ) : (
                        <>
                          <td className={`${td} whitespace-nowrap`}>{r.d}</td>
                          <td className={`${td} whitespace-pre-wrap`}>{joinUraian(week.kegiatan[slotKey(t.id, r.sub, r.d)] ?? [])}</td>
                        </>
                      )}
                      <td className={`${td} break-all text-[10.5px]`}>
                        {lamp.length ? (
                          <div className="space-y-0.5">
                            {lamp.map((u, j) => (
                              <a key={u} href={u} target="_blank" rel="noreferrer" className="block text-[#1a5fd0] underline" title={u}>
                                {lamp.length > 1 ? `${j + 1}. ` : ""}
                                {u.length > 30 ? `${u.slice(0, 30)}…` : u}
                              </a>
                            ))}
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  );
                });
              })}
            </tbody>
          </table>
        </div>

        {/* B */}
        <h2 className="mt-7 text-[13px] font-bold">B. {week.judulRencana || "Rencana kegiatan"}</h2>
        <table className="mt-2 w-full border-collapse">
          <thead>
            <tr>
              <th className={`${th} w-10`}>No</th>
              <th className={`${th} w-[150px]`}>Tim</th>
              <th className={th}>Uraian</th>
            </tr>
          </thead>
          <tbody>
            {TIMS.map((t) => (
              <tr key={t.id}>
                <td className={`${td} text-center font-semibold`}>{t.no}</td>
                <td className={`${td} font-semibold`}>{t.label}</td>
                <td className={`${td} whitespace-pre-wrap`}>{joinUraian(week.rencana[t.id] ?? [])}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* C */}
        <h2 className="mt-7 text-[13px] font-bold">C. {week.judulPresensi || "Rekapitulasi presensi pegawai"}</h2>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[620px] border-collapse">
            <thead>
              <tr>
                <th className={`${th} w-10`}>No</th>
                <th className={`${th} w-[130px]`}>Tanggal</th>
                <th className={th}>Kehadiran</th>
                <th className={th}>Tanpa keterangan</th>
                <th className={th}>Dinas Luar</th>
                <th className={th}>Cuti</th>
              </tr>
            </thead>
            <tbody>
              {week.dates.map((d, i) => {
                const c = presensiCells(week.presensi[norm(d)]);
                return (
                  <tr key={d}>
                    <td className={`${td} text-center`}>{i + 1}</td>
                    <td className={`${td} whitespace-nowrap`}>{d}</td>
                    {c.map((v, j) => (
                      <td key={j} className={`${td} whitespace-pre-wrap`}>
                        {v.replace(/\n\n/g, "\n")}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-1.5 text-[11px] italic">Keterangan: Total PNS {TOTAL_PEGAWAI} terdiri PNS 43; PPPK 13</p>

        <p className="mt-4 text-[12px] font-bold">Rekapitulasi Penggunaan Aplikasi Presensi</p>
        <table className="mt-2 w-full border-collapse">
          <thead>
            <tr>
              <th className={`${th} w-10`}>No</th>
              <th className={`${th} w-[130px]`}>Tanggal</th>
              <th className={th}>Sikepo</th>
              <th className={th}>ePresensi</th>
              <th className={th}>Finger Print</th>
              <th className={th}>Tidak Presensi</th>
              <th className={th}>Cuti/DL</th>
            </tr>
          </thead>
          <tbody>
            {week.dates.map((d, i) => {
              const a = week.aplikasi[norm(d)];
              return (
                <tr key={d}>
                  <td className={`${td} text-center`}>{i + 1}</td>
                  <td className={`${td} whitespace-nowrap`}>{d}</td>
                  {(["sikepo", "epresensi", "fp", "tidak", "cutiDl"] as const).map((f) => (
                    <td key={f} className={`${td} text-center`}>
                      {a?.[f] ?? ""}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* D — realisasi keuangan */}
        {week.anggaran.length > 0 && (
          <>
            <h2 className="mt-7 text-[13px] font-bold">D. Realisasi Keuangan</h2>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse">
                <thead>
                  <tr>
                    <th className={`${th} w-10`}>No</th>
                    <th className={`${th} w-[100px]`}>Kode</th>
                    <th className={th}>Uraian</th>
                    <th className={`${th} w-[120px]`}>Pagu (Rp)</th>
                    <th className={`${th} w-[120px]`}>Realisasi (Rp)</th>
                    <th className={`${th} w-[64px]`}>%</th>
                  </tr>
                </thead>
                <tbody>
                  {week.anggaran.map((a, i) => (
                    <tr key={a.kode + i}>
                      <td className={`${td} text-center`}>{i + 1}</td>
                      <td className={`${td} whitespace-nowrap font-mono text-[10.5px]`}>{a.kode}</td>
                      <td className={td}>{a.uraian}</td>
                      <td className={`${td} whitespace-nowrap text-right`}>{a.pagu ? rupiah(a.pagu) : ""}</td>
                      <td className={`${td} whitespace-nowrap text-right`}>{a.realisasi ? rupiah(a.realisasi) : ""}</td>
                      <td className={`${td} text-right`}>{a.pagu ? `${serapan(a.realisasi, a.pagu).toFixed(1).replace(".", ",")}%` : ""}</td>
                    </tr>
                  ))}
                  <tr className="font-bold">
                    <td className={`${td} text-right`} colSpan={3}>
                      Total
                    </td>
                    <td className={`${td} whitespace-nowrap text-right`}>{rupiah(totalAnggaran(week.anggaran).pagu)}</td>
                    <td className={`${td} whitespace-nowrap text-right`}>{rupiah(totalAnggaran(week.anggaran).realisasi)}</td>
                    <td className={`${td} text-right`}>
                      {serapan(totalAnggaran(week.anggaran).realisasi, totalAnggaran(week.anggaran).pagu)
                        .toFixed(1)
                        .replace(".", ",")}
                      %
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        )}

        <p className="mt-8 text-right text-[10.5px] text-muted">
          Disusun dengan Lapor.in · {settings.nama || "—"} · {new Date().toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" })}
        </p>
      </article>
    </div>
  );
}
