import { useState } from "react";
import { useApp } from "../lib/store";
import { Btn, Card, I, Pill, SectionTitle, cx, useToast } from "../components/ui";
import { LANGKAH_WFH, WFH_URL_BAWAAN, tautanWfh, tautanWfhPendek } from "../lib/wfh";

export default function WfhView() {
  const { settings, setSettings } = useApp();
  const toast = useToast();
  const url = tautanWfh(settings.wfhUrl);
  const [atur, setAtur] = useState(false);
  const [draft, setDraft] = useState(settings.wfhUrl || WFH_URL_BAWAAN);

  const salin = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast("Tautan Laporan WFH disalin — tinggal tempel di WhatsApp grup tim.");
    } catch {
      toast("Tautan tidak bisa disalin otomatis. Salin manual dari kolom tautan di bawah.", "err");
      setAtur(true);
    }
  };

  const simpan = () => {
    setSettings({ wfhUrl: draft.trim() });
    setAtur(false);
    toast("Tautan Laporan WFH diperbarui.");
  };

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden p-0">
        <div className="bg-ink px-5 py-6 text-white sm:px-7 sm:py-7">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone="brand" className="bg-white/15 text-white">
              satu pintu
            </Pill>
            <span className="text-[11.5px] font-semibold text-white/60">Google Apps Script tim Dukman</span>
          </div>
          <h1 className="mt-2.5 text-[22px] font-extrabold leading-tight tracking-tight">Laporan WFH Pegawai</h1>
          <p className="mt-1.5 max-w-[560px] text-[13px] leading-relaxed text-white/70">
            Formulir kerja dari rumah (WFH) yang dipakai pegawai Dukman. Dibuka dari sini supaya tidak perlu
            menyimpan tautan sendiri — data tetap masuk ke spreadsheet laporan WFH.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-[13.5px] font-bold text-white transition hover:bg-brand-dark"
            >
              <I.pen className="h-4 w-4" /> Buka formulir WFH
            </a>
            <button
              onClick={() => void salin()}
              className="inline-flex items-center gap-2 rounded-xl border border-white/25 px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:bg-white/10"
            >
              <I.copy className="h-4 w-4" /> Salin tautan
            </button>
            <a
              href={url}
              className="inline-flex items-center gap-2 rounded-xl px-3 py-2.5 text-[12.5px] font-semibold text-white/70 transition hover:text-white"
            >
              Buka di tab ini <I.chev className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>

        <div className="grid gap-0 divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {LANGKAH_WFH.map((l, i) => (
            <div key={l.judul} className="p-5">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-soft text-[12px] font-bold text-brand">
                {i + 1}
              </span>
              <p className="mt-2.5 text-[13.5px] font-bold">{l.judul}</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{l.isi}</p>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <SectionTitle title="Tautan yang dipakai" sub="Berlaku untuk semua pegawai di perangkat ini." />
          <p className="break-all rounded-xl border border-line bg-paper px-3 py-2.5 font-mono text-[11.5px] text-muted">
            {tautanWfhPendek(url)}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Btn variant="ghost" size="sm" onClick={() => setAtur((v) => !v)}>
              <I.link className="h-4 w-4" /> {atur ? "Tutup pengaturan" : "Ganti tautan"}
            </Btn>
            {settings.wfhUrl ? (
              <Btn
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSettings({ wfhUrl: "" });
                  setDraft(WFH_URL_BAWAAN);
                  toast("Tautan kembali ke bawaan.");
                }}
              >
                <I.refresh className="h-4 w-4" /> Pakai bawaan
              </Btn>
            ) : null}
          </div>
          {atur && (
            <div className="mt-3 space-y-2">
              <label className="block text-[11.5px] font-semibold text-muted" htmlFor="wfh-url">
                Tautan Apps Script (diakhiri /exec)
              </label>
              <input
                id="wfh-url"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={WFH_URL_BAWAAN}
                className="w-full rounded-lg border border-line bg-white px-2.5 py-2 font-mono text-[11.5px] outline-none focus:border-brand"
              />
              <div className="flex items-center gap-2">
                <Btn variant="brand" size="sm" onClick={simpan} disabled={!draft.trim()}>
                  <I.check className="h-4 w-4" /> Simpan tautan
                </Btn>
                <span className={cx("text-[11px]", /\/exec\/?$/.test(draft.trim()) ? "text-muted" : "text-warn")}>
                  {/\/exec\/?$/.test(draft.trim()) ? "Format tautan benar." : "Tautan harus berakhiran /exec."}
                </span>
              </div>
            </div>
          )}
        </Card>

        <Card className="p-5">
          <SectionTitle title="Kenapa dibuka di tab baru?" sub="Bukan pilihan gaya — ini batasan Google." />
          <p className="text-[12.5px] leading-relaxed text-muted">
            Aplikasi Apps Script tidak mengizinkan dirinya ditampilkan di dalam aplikasi lain (iframe ditolak
            Google), jadi formulir WFH pasti tampil kosong bila dipaksa masuk ke sini. Karena itu tombolnya
            membuka formulir resmi di tab baru — tetap satu jalan masuk dari menu ini.
          </p>
          <ul className="mt-3 space-y-2 text-[12.5px] leading-relaxed">
            <li className="flex gap-2">
              <I.check className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
              Identitas pegawai cukup diisi sekali, lalu diingat di perangkatnya.
            </li>
            <li className="flex gap-2">
              <I.check className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
              Bisa dibuka dari HP; cukup tambahkan halaman ini ke layar utama.
            </li>
            <li className="flex gap-2">
              <I.check className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
              Isian WFH tidak bercampur dengan laporan mingguan — masing-masing tetap di spreadsheet-nya.
            </li>
          </ul>
          <p className="mt-3 rounded-xl bg-paper px-3 py-2.5 text-[11.5px] leading-relaxed text-muted">
            Ingin formulir WFH benar-benar menyatu (diisi di dalam aplikasi ini dan masuk ke sheet yang sama)?
            Itu perlu dibangun ulang di dalam Lapor.in — sampaikan saja, nanti saya siapkan.
          </p>
        </Card>
      </div>
    </div>
  );
}
