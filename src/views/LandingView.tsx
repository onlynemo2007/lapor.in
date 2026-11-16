import { I, Logo, Pill, cx } from "../components/ui";
import { ALAMAT_MINGGUAN } from "../lib/rute";
import { WFH_URL_BAWAAN, tautanWfhPendek } from "../lib/wfh";

/**
 * Halaman pilih (landing) — tampil setiap kali alamat utama Lapor.in dibuka
 * tanpa hash. Pegawai memilih dulu: Laporan Mingguan (menu di aplikasi ini)
 * atau Laporan WFH (aplikasi Google Apps Script tersendiri, dibuka di tab baru).
 */
const PILIHAN = [
  {
    id: "mingguan",
    href: ALAMAT_MINGGUAN,
    Ikon: I.pen,
    nomor: "01",
    judul: "Laporan Mingguan",
    ringkas: "Isian rutin tim: kegiatan harian, presensi, dan realisasi keuangan.",
    rincian: ["Uraian kegiatan per hari", "Presensi & realisasi keuangan", "Pratinjau dan cetak"],
    aksi: "Isi laporan mingguan",
    alamat: "…/#/isi",
    tone: "brand" as const,
  },
  {
    id: "wfh",
    href: WFH_URL_BAWAAN,
    Ikon: I.wfh,
    nomor: "02",
    judul: "Laporan WFH",
    ringkas: "Formulir kerja dari rumah (WFH) pegawai — aplikasi tersendiri, di luar dashboard ini.",
    rincian: ["Identitas cukup diisi sekali", "Kegiatan harian selama WFH", "Masuk ke spreadsheet WFH"],
    aksi: "Buka formulir WFH",
    alamat: tautanWfhPendek(WFH_URL_BAWAAN),
    luar: true,
    tone: "neutral" as const,
  },
];

export default function LandingView() {
  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <header className="mx-auto w-full max-w-[980px] px-4 pt-6 sm:px-6">
        <div className="flex items-center gap-2.5">
          <Logo className="h-9 w-9" />
          <div className="min-w-0">
            <p className="text-[15px] font-extrabold leading-none tracking-tight">Lapor.in</p>
            <p className="mt-1 text-[11px] text-muted">PSSSDMKP</p>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[980px] flex-1 px-4 pb-10 pt-8 sm:px-6 sm:pt-12">
        <Pill tone="brand">satu pintu, dua jenis laporan</Pill>
        <h1 className="mt-3 max-w-[620px] text-[26px] font-extrabold leading-tight tracking-tight sm:text-[34px]">
          Mau isi laporan apa hari ini?
        </h1>
        <p className="mt-2 max-w-[560px] text-[13.5px] leading-relaxed text-muted">
          Pilih salah satu di bawah. Masing-masing punya alamat sendiri, jadi bisa Anda simpan sebagai bookmark atau
          bagikan ke pegawai lain lewat grup WhatsApp.
        </p>

        <div className="mt-6 grid gap-3.5 sm:mt-7 sm:grid-cols-2 sm:gap-4">
          {PILIHAN.map(({ id, href, Ikon, nomor, judul, ringkas, rincian, aksi, alamat, tone, luar }) => (
            <a
              key={id}
              href={href}
              data-pilihan={id}
              data-luar={luar ? "1" : undefined}
              {...(luar ? { target: "_blank", rel: "noreferrer" } : {})}
              className={cx(
                "group flex flex-col rounded-2xl border bg-white p-5 transition-all duration-150",
                "hover:-translate-y-0.5 hover:shadow-[0_10px_30px_-18px_rgba(17,20,18,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
                "border-line hover:border-[#cdd6d0]",
              )}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className={cx(
                    "grid h-10 w-10 shrink-0 place-items-center rounded-xl",
                    tone === "brand" ? "bg-brand-soft text-brand" : "bg-paper text-ink",
                  )}
                >
                  <Ikon className="h-5 w-5" />
                </span>
                <span className="font-mono text-[11px] font-semibold tracking-widest text-muted">{nomor}</span>
                <I.arrow className="ml-auto h-4 w-4 text-muted transition group-hover:translate-x-0.5 group-hover:text-brand" />
              </div>

              <h2 className="mt-4 text-[19px] font-extrabold leading-tight tracking-tight">{judul}</h2>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{ringkas}</p>

              <ul className="mt-3 space-y-1.5">
                {rincian.map((r) => (
                  <li key={r} className="flex items-start gap-2 text-[12.5px] text-muted">
                    <I.check className="mt-[3px] h-3.5 w-3.5 shrink-0 text-brand" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>

              <span className="mt-4 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 border-t border-line pt-3.5">
                <span className="text-[13.5px] font-bold text-ink">
                  {aksi}
                  {luar && <span className="ml-1.5 font-semibold text-[11.5px] text-muted">· tab baru</span>}
                </span>
                <span className="font-mono text-[10.5px] text-muted">{alamat}</span>
              </span>
            </a>
          ))}
        </div>

        <div className="mt-5 rounded-2xl border border-line bg-white p-4 text-[12.5px] leading-relaxed text-muted">
          <p>
            <b className="text-ink">Tautan langsung.</b> Simpan{" "}
            <a href="#/isi" className="rounded bg-paper px-1.5 py-0.5 font-mono text-[11.5px] text-ink hover:text-brand">
              #/isi
            </a>{" "}
            untuk laporan mingguan — langsung masuk ke menu isian tanpa melewati halaman ini. Laporan WFH berdiri
            sendiri sebagai aplikasi (Google Apps Script), jadi tautannya dibagikan langsung dari kartu di atas.
          </p>
          <p className="mt-2">
            Data pegawai tersimpan di perangkat ini, dan setiap isian langsung dikirim ke spreadsheet. Di dalam aplikasi,
            seluruh menu (presensi, keuangan, pratinjau, sinkronisasi) tetap tersedia lewat bilah menu.
          </p>
        </div>
      </main>

      <footer className="border-t border-line bg-white">
        <div className="mx-auto flex w-full max-w-[980px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-4 text-[12px] text-muted sm:px-6">
          <a href="#/dashboard" className="font-semibold text-ink hover:text-brand">
            Masuk ke dashboard
          </a>
          <a href="#/sinkron" className="hover:text-ink">
            Sinkronisasi &amp; kode skrip
          </a>
          <span className="ml-auto">Lapor.in · PSSSDMKP</span>
        </div>
      </footer>
    </div>
  );
}
