import { useEffect, useMemo, useRef, useState } from "react";
import { setKeuangan, setSelKeuangan, useApp } from "../lib/store";
import { kodeInduk, parseAngka, rupiah, rupiahPendek, selKey, serapan, totalAnggaran, type TabelKeuangan } from "../lib/model";
import { SCRIPT_VERSI } from "../lib/sheet";
import { sisipBarisTabel } from "../lib/sisip";
import { Btn, Card, I, Pill, SectionTitle, Spinner, cx, useToast } from "../components/ui";
import { StateGate } from "./common";
import { jamSinkron } from "../lib/sync";

type Draft = { uraian: string; pagu: string; realisasi: string };

const angkaTeks = (n: number) => (n ? String(n) : "");
const formatAngka = (v: string) => (v ? Number(v).toLocaleString("id-ID") : "");

export default function KeuanganView() {
  const { week, settings, updateWeek, reload, dibacaAt } = useApp();
  const toast = useToast();
  const [draft, setDraft] = useState<Record<string, Draft>>({});
  const [selDraft, setSelDraft] = useState<Record<string, string>>({});
  const [cari, setCari] = useState("");
  const [sisipSibuk, setSisipSibuk] = useState("");
  const awal = useRef<Record<string, Draft>>({});

  // Muat isian dari sheet. Pembacaan ulang otomatis tidak boleh menimpa ketikan yang belum disimpan.
  useEffect(() => {
    if (!week) return;
    const adaKetikan = Object.keys(draft).some((k) => {
      const d = draft[k];
      const a = awal.current[k];
      return d && a && (d.uraian !== a.uraian || d.pagu !== a.pagu || d.realisasi !== a.realisasi);
    });
    if (adaKetikan) return;
    const d: Record<string, Draft> = {};
    week.anggaran.forEach((a) => {
      d[a.kode] = { uraian: a.uraian, pagu: angkaTeks(a.pagu), realisasi: angkaTeks(a.realisasi) };
    });
    awal.current = d;
    setDraft(d);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [week?.gid, week?.importedAt]);

  const baris = week?.anggaran ?? [];
  const total = useMemo(() => totalAnggaran(baris), [baris]);
  const persen = serapan(total.realisasi, total.pagu);
  /** Baris induk (Total/Program) dijumlahkan rumus sheet → hanya dibaca, tidak ditulis aplikasi. */
  const induk = useMemo(() => kodeInduk(baris), [baris]);

  // tabel keuangan lain (Rekapitulasi UP, Pembayaran LS, Rencana Penarikan, …)
  const tabel = week?.tabelKeuangan ?? [];
  const nilaiSheet = useMemo(() => {
    const m: Record<string, string> = {};
    tabel.forEach((t) =>
      t.baris.forEach((r) => t.kolom.forEach((k) => (m[selKey(r.nomor, k.index)] = r.sel[k.index] ?? ""))),
    );
    return m;
  }, [tabel]);
  const nilai = (kunci: string) => selDraft[kunci] ?? week?.selKeuangan?.[kunci] ?? nilaiSheet[kunci] ?? "";
  const selBerubah = Object.keys(selDraft).filter(
    (k) => selDraft[k] !== (week?.selKeuangan?.[k] ?? nilaiSheet[k] ?? ""),
  );

  const berubah = baris.filter((a) => {
    if (induk.has(a.kode)) return false; // baris agregat: angkanya dari rumus sheet
    const d = draft[a.kode];
    if (!d) return false;
    return d.uraian !== a.uraian || parseAngka(d.pagu) !== a.pagu || parseAngka(d.realisasi) !== a.realisasi;
  });

  if (!week) return <StateGate />;

  const set = (kode: string, patch: Partial<Draft>) =>
    setDraft((s) => ({ ...s, [kode]: { ...(s[kode] ?? { uraian: "", pagu: "", realisasi: "" }), ...patch } }));

  /** Sel yang termasuk satu tabel keuangan — dipakai untuk tombol Simpan per tabel. */
  const selMilikTabel = (t: TabelKeuangan) => {
    const kunci = new Set<string>();
    t.baris.forEach((r) => t.kolom.forEach((k) => kunci.add(selKey(r.nomor, k.index))));
    return selBerubah.filter((k) => kunci.has(k));
  };

  /**
   * Simpan perubahan. `lingkup`:
   * - "semua" → tabel realisasi anggaran + semua sel tabel keuangan (tombol di kanan atas)
   * - "anggaran" → hanya baris kode/pagu/realisasi
   * - TabelKeuangan → hanya sel milik tabel itu (tombol Simpan di judul tiap tabel)
   */
  const simpan = (lingkup: "semua" | "anggaran" | TabelKeuangan = "semua") => {
    const pakaiKode = lingkup === "semua" || lingkup === "anggaran";
    const pakaiSel = lingkup === "semua" ? selBerubah : lingkup === "anggaran" ? [] : selMilikTabel(lingkup);
    const kodeBerubah = pakaiKode ? berubah : [];
    if (!kodeBerubah.length && !pakaiSel.length) return;
    updateWeek((w) => {
      let next = w;
      kodeBerubah.forEach((a) => {
        const d = draft[a.kode];
        next = setKeuangan(
          next,
          a.kode,
          { uraian: d.uraian.trim() || a.uraian, pagu: parseAngka(d.pagu), realisasi: parseAngka(d.realisasi) },
          settings.nama,
        );
      });
      pakaiSel.forEach((k) => {
        const [b, c] = k.split(":");
        next = setSelKeuangan(next, Number(b), Number(c), selDraft[k], settings.nama);
      });
      return next;
    });
    // hanya reset penanda ketikan bila tabel anggaran ikut tersimpan
    if (pakaiKode) awal.current = { ...draft };
    toast(
      `Realisasi keuangan tersimpan · ${kodeBerubah.length + pakaiSel.length} isian${settings.scriptUrl && settings.token && settings.autoSync ? " · langsung ke Sheet" : ""}`,
    );
  };

  /** Sisipkan satu baris baru ke tabel keuangan di sheet (sebelum baris Jumlah), lalu baca ulang. */
  const tambahBaris = async (t: TabelKeuangan) => {
    setSisipSibuk(`${t.judul}|${t.header}`);
    try {
      const r = await sisipBarisTabel({
        week,
        tabel: t,
        oleh: settings.nama,
        token: settings.token,
        scriptUrl: settings.scriptUrl,
        reload: () => reload(undefined, true),
      });
      toast(r.pesan, r.ok ? "ok" : "err");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Gagal menambah baris.", "err");
    } finally {
      setSisipSibuk("");
    }
  };

  const tampil = baris.filter((a) => {
    const q = cari.trim().toLowerCase();
    return !q || a.kode.toLowerCase().includes(q) || a.uraian.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[13px] font-medium text-muted">Bagian D — realisasi keuangan</p>
          <h1 className="mt-1 text-[24px] font-extrabold tracking-tight sm:text-[28px]">Realisasi keuangan</h1>
          <p className="mt-1 max-w-[640px] text-[13px] leading-relaxed text-muted">
            Isi <b>pagu</b> dan <b>realisasi</b> tiap kode kegiatan. Nilainya ditulis ke baris yang sama di bagian D
            sheet (dicocokkan lewat kode, jadi aman bila ada baris disisipkan). Rumus total di sheet tidak diubah.
          </p>
          <p className="mt-1.5 max-w-[640px] text-[11.5px] leading-relaxed text-muted">
            {week.anggaran.length ? (
              <>
                Sumber: tabel <b className="text-ink">{week.anggaranJudul || "bagian D"}</b>
                {week.anggaranBaris ? (
                  <>
                    {" "}
                    · baris <b className="text-ink">{week.anggaranBaris.dari}–{week.anggaranBaris.sampai}</b> ·{" "}
                    {week.anggaran.length} kode
                  </>
                ) : null}
              </>
            ) : (
              "Belum ada tabel kode/pagu yang terbaca di bagian D."
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[11.5px] text-muted">{dibacaAt ? `Data sheet ${jamSinkron(dibacaAt)}` : ""}</p>
          <Btn variant="ghost" size="sm" onClick={() => void reload(undefined, true)} title="Ambil isi terbaru dari Google Sheet">
            <I.refresh className="h-4 w-4" /> Ambil data terbaru
          </Btn>
          <Btn variant="brand" onClick={() => simpan("semua")} disabled={!berubah.length && !selBerubah.length}>
            <I.check className="h-4 w-4" />
            Simpan{berubah.length + selBerubah.length ? ` (${berubah.length + selBerubah.length})` : ""}
          </Btn>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {(
          [
            ["Total pagu", rupiah(total.pagu), "neutral"],
            ["Total realisasi", rupiah(total.realisasi), "brand"],
            ["Serapan", `${persen.toFixed(1).replace(".", ",")}%`, persen >= 80 ? "brand" : "warn"],
          ] as const
        ).map(([label, nilai, tone]) => (
          <Card key={label} className="p-4">
            <p className="text-[11.5px] font-semibold uppercase tracking-wider text-muted">{label}</p>
            <p className="mt-1 text-[19px] font-extrabold leading-tight">{nilai}</p>
            <div className="mt-2">
              <Pill tone={tone as "neutral" | "brand" | "warn"}>{baris.length} baris</Pill>
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-4 sm:p-5">
        <SectionTitle
          title="Realisasi anggaran"
          sub={baris.length ? `${baris.length} kode · tombol Simpan juga ada di judul tiap tabel` : "Tabel bagian D belum terbaca"}
          right={
            <div className="flex flex-wrap items-center gap-2">
              <label className="relative">
                <input
                  value={cari}
                  onChange={(e) => setCari(e.target.value)}
                  placeholder="Cari kode / uraian…"
                  className="h-9 w-[190px] rounded-lg border border-line bg-white pl-8 pr-2 text-[12.5px] outline-none focus:border-brand"
                />
                <I.sheet className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted" />
              </label>
              <Btn
                variant="brand"
                size="sm"
                onClick={() => simpan("anggaran")}
                disabled={!berubah.length}
                aria-label="Simpan tabel realisasi anggaran"
                title="Simpan perubahan pagu/realisasi tabel ini"
              >
                <I.check className="h-4 w-4" /> Simpan{berubah.length ? ` (${berubah.length})` : ""}
              </Btn>
            </div>
          }
        />

        {baris.length === 0 ? (
          <p className="mt-3 rounded-xl bg-paper p-4 text-[13px] leading-relaxed text-muted">
            Tabel kode/pagu (bagian D) tidak ditemukan di tab ini. Pastikan baris judul kolom memuat{" "}
            <span className="font-mono">Kode</span>, <span className="font-mono">Uraian</span>,{" "}
            <span className="font-mono">Pagu</span>, dan <span className="font-mono">Realisasi</span>, lalu tekan{" "}
            <b>Ambil data terbaru</b>.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-[12.5px]">
              <thead>
                <tr className="border-b border-line text-left text-[11px] uppercase tracking-wider text-muted">
                  <th className="w-[112px] py-2 pr-2 font-semibold">Kode</th>
                  <th className="py-2 pr-2 font-semibold">Uraian kegiatan</th>
                  <th className="w-[150px] py-2 pr-2 text-right font-semibold">Pagu (Rp)</th>
                  <th className="w-[150px] py-2 pr-2 text-right font-semibold">Realisasi (Rp)</th>
                  <th className="w-[140px] py-2 pr-2 text-right font-semibold">Sisa (Rp)</th>
                  <th className="w-[92px] py-2 text-right font-semibold">Serapan</th>
                </tr>
              </thead>
              <tbody>
                {tampil.map((a) => {
                  const agregat = induk.has(a.kode);
                  const d = draft[a.kode] ?? { uraian: a.uraian, pagu: angkaTeks(a.pagu), realisasi: angkaTeks(a.realisasi) };
                  const pagu = agregat ? a.pagu : parseAngka(d.pagu);
                  const real = agregat ? a.realisasi : parseAngka(d.realisasi);
                  const p = serapan(real, pagu);
                  const kotor = !agregat && (d.uraian !== a.uraian || pagu !== a.pagu || real !== a.realisasi);
                  return (
                    <tr key={a.kode} className={cx("border-b border-line/70 align-top", kotor && "bg-warn-soft/40")}>
                      <td className="py-2 pr-2 font-mono text-[11.5px] text-muted">
                        {a.kode}
                        {agregat && <Pill className="ml-1.5">otomatis</Pill>}
                      </td>
                      <td className="py-2 pr-2">
                        {agregat ? (
                          <span className="block px-1.5 py-1 text-[12.5px] font-semibold" title="Dijumlahkan rumus sheet dari baris rincian di bawahnya">
                            {a.uraian}
                          </span>
                        ) : (
                          <input
                            value={d.uraian}
                            onChange={(e) => set(a.kode, { uraian: e.target.value })}
                            className="w-full rounded-lg border border-transparent bg-transparent px-1.5 py-1 text-[12.5px] outline-none transition hover:border-line focus:border-brand focus:bg-white"
                          />
                        )}
                      </td>
                      <td className="py-2 pr-2">
                        {agregat ? (
                          <span className="block rounded-lg bg-paper px-2 py-1.5 text-right font-mono text-[12px] font-semibold text-muted">
                            {formatAngka(angkaTeks(a.pagu)) || "0"}
                          </span>
                        ) : (
                          <input
                            value={formatAngka(d.pagu)}
                            onChange={(e) => set(a.kode, { pagu: e.target.value.replace(/[^\d]/g, "") })}
                            inputMode="numeric"
                            placeholder="0"
                            className="w-full rounded-lg border border-line bg-white px-2 py-1.5 text-right font-mono text-[12px] outline-none focus:border-brand"
                          />
                        )}
                      </td>
                      <td className="py-2 pr-2">
                        {agregat ? (
                          <span className="block rounded-lg bg-paper px-2 py-1.5 text-right font-mono text-[12px] font-semibold text-muted">
                            {formatAngka(angkaTeks(a.realisasi)) || "0"}
                          </span>
                        ) : (
                          <input
                            value={formatAngka(d.realisasi)}
                            onChange={(e) => set(a.kode, { realisasi: e.target.value.replace(/[^\d]/g, "") })}
                            inputMode="numeric"
                            placeholder="0"
                            className="w-full rounded-lg border border-line bg-white px-2 py-1.5 text-right font-mono text-[12px] outline-none focus:border-brand"
                          />
                        )}
                      </td>
                      <td className="py-2 pr-2 text-right font-mono text-[12px] text-muted">
                        {pagu || real ? (pagu - real).toLocaleString("id-ID") : "—"}
                      </td>
                      <td className="py-2 text-right">
                        <span className={cx("font-mono text-[12px] font-bold", p >= 100 ? "text-brand" : p > 0 ? "text-ink" : "text-muted")}>
                          {p ? `${p.toFixed(1).replace(".", ",")}%` : "—"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="text-[12.5px] font-bold">
                  <td className="py-3 pr-2" colSpan={2}>
                    Total ({tampil.length} baris)
                  </td>
                  <td className="py-3 pr-2 text-right font-mono">{rupiah(total.pagu)}</td>
                  <td className="py-3 pr-2 text-right font-mono">{rupiah(total.realisasi)}</td>
                  <td className="py-3 text-right font-mono">{persen ? `${persen.toFixed(1).replace(".", ",")}%` : "—"}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {baris.length > 0 && (
          <p className="mt-3 text-[11.5px] leading-relaxed text-muted">
            Ringkas: pagu {rupiahPendek(total.pagu)} · realisasi {rupiahPendek(total.realisasi)}. Kolom{" "}
            <b>Total</b> di sheet tetap memakai rumusnya sendiri — aplikasi hanya menulis baris kegiatan yang Anda ubah.
          </p>
        )}
      </Card>

      {tabel.map((t) => {
        const milik = selMilikTabel(t);
        return (
        <Card key={`${t.judul}-${t.header}`} className="p-4 sm:p-5">
          <SectionTitle
            title={t.judul}
            sub={`${t.baris.length} baris · kolom mengikuti sheet (baris ${t.header})`}
            right={
              <div className="flex flex-wrap items-center gap-2">
                <Pill>{t.kolom.length} kolom</Pill>
                <Btn
                  variant="ghost"
                  size="sm"
                  onClick={() => void tambahBaris(t)}
                  disabled={!!sisipSibuk}
                  title="Sisipkan satu baris baru sebelum baris Jumlah dan simpan ke sheet"
                >
                  {sisipSibuk === `${t.judul}|${t.header}` ? <Spinner className="h-4 w-4" /> : <I.plus className="h-4 w-4" />}
                  Tambah baris
                </Btn>
                <Btn
                  variant="brand"
                  size="sm"
                  onClick={() => simpan(t)}
                  disabled={!milik.length}
                  aria-label={`Simpan tabel ${t.judul}`}
                  title="Simpan perubahan pada tabel ini"
                >
                  <I.check className="h-4 w-4" /> Simpan{milik.length ? ` (${milik.length})` : ""}
                </Btn>
              </div>
            }
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] border-collapse text-[12.5px]">
              <thead>
                <tr className="border-b border-line text-left text-[11px] uppercase tracking-wider text-muted">
                  {t.kolom.map((k) => (
                    <th key={k.index} className="whitespace-nowrap py-2 pr-2 font-semibold">
                      {k.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {t.baris.map((r) => (
                  <tr key={r.nomor} className="border-b border-line/70 align-top">
                    {t.kolom.map((k) => {
                      const kunci = selKey(r.nomor, k.index);
                      const kotor = selDraft[kunci] !== undefined && selDraft[kunci] !== (week.selKeuangan?.[kunci] ?? nilaiSheet[kunci] ?? "");
                      // kolom penanda hanya bisa dibaca — kecuali pada baris yang masih kosong (baris baru)
                      if (k.index === r.labelKolom && r.label)
                        return (
                          <td key={k.index} className="py-2 pr-2 font-semibold">
                            {r.sel[k.index] ?? r.label}
                          </td>
                        );
                      return (
                        <td key={k.index} className="py-1.5 pr-2">
                          <input
                            value={nilai(kunci)}
                            onChange={(e) => setSelDraft((d) => ({ ...d, [kunci]: e.target.value }))}
                            placeholder="—"
                            className={cx(
                              "w-full min-w-[92px] rounded-lg border bg-white px-2 py-1.5 text-[12px] outline-none focus:border-brand",
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
        </Card>
        );
      })}

      {tabel.length > 0 && (
        <p className="text-[11.5px] leading-relaxed text-muted">
          Sel yang diubah ditulis ke baris &amp; kolom yang sama dengan pengaman: bila barisnya bergeser di sheet,
          aplikasi menolak menulis dan menandainya gagal (tidak menimpa baris lain). Kolom penanda baris sengaja
          tidak bisa diubah dari sini. Tombol <b>Tambah baris</b> menyisipkan satu baris baru tepat sebelum baris
          Jumlah (rumus di atasnya ikut disalin, rentang Jumlah diperluas) lalu langsung menulisnya ke sheet —
          perlu Apps Script v{SCRIPT_VERSI}.
        </p>
      )}
    </div>
  );
}
