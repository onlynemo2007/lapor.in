import { useEffect, useRef, useState, type ReactNode } from "react";
import { setKegiatan, setLampiran, useApp } from "../lib/store";
import { TIMS, type Tim, hariDari, joinUraian, lampKey, norm, rapikan, slotKey, tanggalPendek, teksKeButir, timById } from "../lib/model";
import { go } from "../components/Shell";
import { I, Logo, cx } from "../components/ui";

type Step = "tim" | "sub" | "hari" | "ada" | "kegiatan" | "lampiran" | "konfirmasi" | "selesai";
type Msg = { id: number; from: "bot" | "user"; body: ReactNode };
type Chip = { label: string; onPick: () => void; primary?: boolean };
type Ctx = { tim: string; sub: string; d: string; items: string[]; lamp: string };

let uid = 0;

const HARI_KATA: Record<string, string> = { senin: "Senin", selasa: "Selasa", rabu: "Rabu", kamis: "Kamis", jumat: "Jumat", "jum'at": "Jumat" };

function cariTim(text: string): Tim | undefined {
  const t = norm(text);
  return TIMS.find((x) => t.includes(x.id) || t.includes(norm(x.label)) || (x.id === "program" && t.includes("monev")));
}

export default function ChatAsisten() {
  const { week, settings, updateWeek } = useApp();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [step, setStep] = useState<Step>("tim");
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState("");
  const ctx = useRef<Ctx>({ tim: "", sub: "", d: "", items: [], lamp: "" });
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const started = useRef(false);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, typing]);

  const user = (body: ReactNode) => setMsgs((m) => [...m, { id: ++uid, from: "user", body }]);
  const bot = (bodies: ReactNode[], next: Step) => {
    setTyping(true);
    setStep(next);
    bodies.forEach((b, i) => {
      window.setTimeout(() => {
        setMsgs((m) => [...m, { id: ++uid, from: "bot", body: b }]);
        if (i === bodies.length - 1) {
          setTyping(false);
          requestAnimationFrame(() => inputRef.current?.focus());
        }
      }, 320 + i * 380);
    });
  };

  /* --------------------------------- alur --------------------------------- */

  const mulai = () => {
    ctx.current = { tim: "", sub: "", d: "", items: [], lamp: "" };
    const t = timById(settings.timUtama);
    bot(
      [
        <>
          Halo{settings.nama ? `, ${settings.nama.split(" ")[0]}` : ""}! Saya bantu isi <b>{week?.judulKegiatan || "laporan minggu ini"}</b>.
        </>,
        t ? <>Isi untuk tim <b>{t.label}</b>, atau tim lain?</> : "Laporan untuk tim mana?",
      ],
      "tim",
    );
  };

  useEffect(() => {
    if (week && !started.current) {
      started.current = true;
      mulai();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [week]);

  if (!week) return null;

  const pilihTim = (t: Tim) => {
    user(t.label);
    ctx.current.tim = t.id;
    if (t.subs.length > 1) bot(["Bagian Program atau Monev?"], "sub");
    else {
      ctx.current.sub = "";
      tanyaHari();
    }
  };

  const pilihSub = (s: string) => {
    user(s);
    ctx.current.sub = s;
    tanyaHari();
  };

  const tanyaHari = () => {
    const c = ctx.current;
    const kosong = week.dates.filter((d) => !week.kegiatan[slotKey(c.tim, c.sub, d)]);
    bot(
      [
        kosong.length
          ? <>Hari yang masih kosong: <b>{kosong.map((d) => hariDari(d)).join(", ")}</b>. Mau isi hari apa?</>
          : "Semua hari sudah terisi. Mau menambah atau mengubah hari apa?",
      ],
      "hari",
    );
  };

  const pilihHari = (d: string) => {
    user(`${hariDari(d)}, ${tanggalPendek(d)}`);
    const c = ctx.current;
    c.d = d;
    c.lamp = week.lampiran[lampKey(c.tim, c.sub)] ?? "";
    const ada = week.kegiatan[slotKey(c.tim, c.sub, d)] ?? [];
    if (ada.length) {
      c.items = [...ada];
      bot(
        [
          <>
            Sudah ada {ada.length} butir untuk {hariDari(d)}:
            <ol className="mt-1.5 list-decimal space-y-0.5 pl-5">
              {ada.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ol>
          </>,
          "Mau menambah butir atau menulis ulang?",
        ],
        "ada",
      );
    } else {
      c.items = [];
      tanyaKegiatan();
    }
  };

  const tanyaKegiatan = () =>
    bot(
      [
        <>
          Ceritakan kegiatannya — santai saja, saya rapikan. Satu pesan = satu butir (atau pisahkan dengan <b>;</b>). Ketik <b>selesai</b> kalau sudah.
        </>,
      ],
      "kegiatan",
    );

  const tambahKegiatan = (raw: string) => {
    const baru = teksKeButir(raw).map(rapikan).filter(Boolean);
    if (!baru.length) return;
    user(raw);
    ctx.current.items.push(...baru);
    const n = ctx.current.items.length;
    bot(
      [
        <>
          Dicatat sebagai:
          <div className="mt-1.5 space-y-1">
            {baru.map((b, i) => (
              <div key={i} className="rounded-lg bg-brand-soft px-2.5 py-1.5 text-[13px] text-[#0b5e42]">
                {n - baru.length + i + 1}. {b}
              </div>
            ))}
          </div>
        </>,
        "Ada lagi? Atau tekan Selesai.",
      ],
      "kegiatan",
    );
  };

  const selesaiKegiatan = () => {
    user("Selesai");
    if (!ctx.current.items.length) {
      bot(["Belum ada butir yang dicatat. Tulis minimal satu kegiatan ya."], "kegiatan");
      return;
    }
    const c = ctx.current;
    bot(
      [
        c.lamp ? (
          <>
            Tautan lampiran {c.sub || timById(c.tim)?.label} minggu ini sudah ada. Ganti? Tempel tautan baru, atau pilih <b>Pakai yang lama</b>.
          </>
        ) : (
          "Ada tautan lampiran (Google Drive)? Tempel di sini, atau Lewati."
        ),
      ],
      "lampiran",
    );
  };

  const isiLampiran = (raw: string) => {
    const url = raw.trim();
    if (!/^https?:\/\//i.test(url)) {
      user(raw);
      bot(["Itu bukan tautan. Tempel URL yang diawali https://, atau pilih Lewati."], "lampiran");
      return;
    }
    user(url);
    ctx.current.lamp = url;
    konfirmasi();
  };

  const konfirmasi = () => {
    const c = ctx.current;
    const t = timById(c.tim)!;
    bot(
      [
        <>
          <p className="mb-2">Ini yang akan disimpan:</p>
          <div className="overflow-hidden rounded-xl border border-line bg-white text-[12.5px]">
            <div className="grid grid-cols-[84px_1fr] border-b border-line">
              <span className="bg-paper px-2.5 py-1.5 text-muted">Tim</span>
              <span className="px-2.5 py-1.5 font-semibold">{t.no}. {t.label}{c.sub && ` · ${c.sub}`}</span>
            </div>
            <div className="grid grid-cols-[84px_1fr] border-b border-line">
              <span className="bg-paper px-2.5 py-1.5 text-muted">Tanggal</span>
              <span className="px-2.5 py-1.5 font-semibold">{c.d}</span>
            </div>
            <div className="grid grid-cols-[84px_1fr] border-b border-line">
              <span className="bg-paper px-2.5 py-1.5 text-muted">Uraian</span>
              <pre className="whitespace-pre-wrap px-2.5 py-1.5 font-sans">{joinUraian(c.items)}</pre>
            </div>
            <div className="grid grid-cols-[84px_1fr]">
              <span className="bg-paper px-2.5 py-1.5 text-muted">Lampiran</span>
              <span className="truncate px-2.5 py-1.5">{c.lamp || "—"}</span>
            </div>
          </div>
        </>,
      ],
      "konfirmasi",
    );
  };

  const simpan = () => {
    user("Simpan");
    const c = ctx.current;
    const k = slotKey(c.tim, c.sub, c.d);
    updateWeek((w) => setLampiran(setKegiatan(w, k, [...c.items], settings.nama), lampKey(c.tim, c.sub), c.lamp, settings.nama));
    const next = week.dates.find((d) => d !== c.d && !week.kegiatan[slotKey(c.tim, c.sub, d)]);
    bot(
      [
        <>
          <span className="font-semibold text-brand">✓ Tersimpan.</span> {c.items.length} butir untuk {hariDari(c.d)}, {tanggalPendek(c.d)} — langsung masuk Google Sheet.
        </>,
        next ? <>Lanjut isi <b>{hariDari(next)}</b>?</> : "Semua hari untuk tim ini sudah terisi. Isian Anda otomatis tersimpan di sheet.",
      ],
      "selesai",
    );
  };

  /* ------------------------------- input teks ------------------------------- */

  const kirim = () => {
    const v = text.trim();
    if (!v || typing) return;
    setText("");
    if (step === "tim") {
      const t = cariTim(v);
      if (t) return pilihTim(t);
      user(v);
      return bot(["Tim tidak dikenali. Pilih salah satu tombol di bawah."], "tim");
    }
    if (step === "sub") {
      if (/monev/i.test(v)) return pilihSub("Monev");
      if (/program/i.test(v)) return pilihSub("Program");
      user(v);
      return bot(["Pilih Program atau Monev."], "sub");
    }
    if (step === "hari") {
      const n = norm(v);
      const kata = Object.keys(HARI_KATA).find((h) => n.includes(h));
      const d =
        week.dates.find((x) => kata && hariDari(x) === HARI_KATA[kata]) ??
        week.dates.find((x) => n.includes(norm(x).split(" ")[0] + " ") || n === norm(x).split(" ")[0]);
      if (d) return pilihHari(d);
      user(v);
      return bot(["Hari tidak ditemukan di minggu ini. Pilih dari tombol di bawah."], "hari");
    }
    if (step === "kegiatan") {
      if (/^(selesai|sudah|udah|done|cukup)$/i.test(v)) return selesaiKegiatan();
      return tambahKegiatan(v);
    }
    if (step === "lampiran") {
      if (/^(lewati|skip|tidak|ga|gak|nggak|tidak ada)$/i.test(v)) {
        user(v);
        return konfirmasi();
      }
      return isiLampiran(v);
    }
    if (step === "konfirmasi") {
      if (/^(ya|simpan|ok|oke|y)$/i.test(v)) return simpan();
    }
    user(v);
    bot(["Gunakan tombol di bawah untuk melanjutkan."], step);
  };

  /* --------------------------------- chips --------------------------------- */

  const c = ctx.current;
  const chips: Chip[] = (() => {
    if (typing) return [];
    switch (step) {
      case "tim": {
        const u = timById(settings.timUtama);
        const list = u ? [u, ...TIMS.filter((t) => t.id !== u.id)] : TIMS;
        return list.map((t, i) => ({ label: t.label, onPick: () => pilihTim(t), primary: !!u && i === 0 }));
      }
      case "sub":
        return ["Program", "Monev"].map((s) => ({ label: s, onPick: () => pilihSub(s) }));
      case "hari": {
        const firstEmpty = week.dates.find((d) => !week.kegiatan[slotKey(c.tim, c.sub, d)]);
        return week.dates.map((d) => {
          const n = (week.kegiatan[slotKey(c.tim, c.sub, d)] ?? []).length;
          return { label: `${hariDari(d).slice(0, 3)} ${tanggalPendek(d)}${n ? " ✓" : ""}`, onPick: () => pilihHari(d), primary: d === firstEmpty };
        });
      }
      case "ada":
        return [
          { label: "Tambah butir", primary: true, onPick: () => { user("Tambah butir"); tanyaKegiatan(); } },
          { label: "Tulis ulang", onPick: () => { user("Tulis ulang"); ctx.current.items = []; tanyaKegiatan(); } },
          { label: "Ganti hari", onPick: () => { user("Ganti hari"); tanyaHari(); } },
        ];
      case "kegiatan":
        return c.items.length
          ? [
              { label: `Selesai (${c.items.length} butir)`, primary: true, onPick: selesaiKegiatan },
              {
                label: "Hapus butir terakhir",
                onPick: () => {
                  const x = ctx.current.items.pop();
                  user("Hapus butir terakhir");
                  bot([x ? <>Dihapus: <s>{x}</s></> : "Tidak ada butir."], "kegiatan");
                },
              },
            ]
          : [];
      case "lampiran":
        return c.lamp
          ? [{ label: "Pakai yang lama", primary: true, onPick: () => { user("Pakai yang lama"); konfirmasi(); } }, { label: "Hapus lampiran", onPick: () => { user("Hapus lampiran"); ctx.current.lamp = ""; konfirmasi(); } }]
          : [{ label: "Lewati", primary: true, onPick: () => { user("Lewati"); konfirmasi(); } }];
      case "konfirmasi":
        return [
          { label: "Simpan", primary: true, onPick: simpan },
          { label: "Tambah butir lagi", onPick: () => { user("Tambah butir lagi"); tanyaKegiatan(); } },
          { label: "Batal", onPick: () => { user("Batal"); setMsgs([]); mulai(); } },
        ];
      case "selesai": {
        const next = week.dates.find((d) => d !== c.d && !week.kegiatan[slotKey(c.tim, c.sub, d)] && d !== c.d);
        const out: Chip[] = [];
        if (next) out.push({ label: `Isi ${hariDari(next)}`, primary: true, onPick: () => pilihHari(next) });
        out.push({ label: "Ganti tim", onPick: () => { user("Ganti tim"); bot(["Tim mana?"], "tim"); } });
        out.push({ label: "Lihat sinkronisasi", primary: !next, onPick: () => go("sinkron") });
        out.push({ label: "Lihat dashboard", onPick: () => go("dashboard") });
        return out;
      }
    }
  })();

  const inputAktif = !typing && ["tim", "sub", "hari", "kegiatan", "lampiran", "konfirmasi"].includes(step);
  const ph =
    step === "kegiatan"
      ? "cth: rapat koordinasi tim dukman; bikin flyer kuis serasi"
      : step === "lampiran"
        ? "https://drive.google.com/…"
        : step === "hari"
          ? "cth: senin"
          : step === "tim"
            ? "cth: humas"
            : "Ketik…";

  return (
    <div className="mx-auto flex h-[calc(100dvh-230px)] min-h-[480px] max-w-3xl flex-col overflow-hidden rounded-2xl border border-line bg-white lg:h-[calc(100dvh-200px)]">
      <div className="flex items-center gap-3 border-b border-line px-4 py-3">
        <Logo className="h-9 w-9" />
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-bold">Asisten Lapor.in</p>
          <p className="flex items-center gap-1.5 text-[11.5px] text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-brand" /> {week.tab} · tersimpan otomatis di perangkat
          </p>
        </div>
        <button
          onClick={() => { setMsgs([]); mulai(); }}
          className="grid h-9 w-9 place-items-center rounded-xl border border-line text-muted transition hover:text-ink"
          title="Mulai ulang"
        >
          <I.refresh className="h-4 w-4" />
        </button>
      </div>

      <div ref={bodyRef} className="thin-scroll flex-1 space-y-3 overflow-y-auto bg-paper/60 px-4 py-5">
        {msgs.map((m) => (
          <div key={m.id} className={cx("anim-pop flex", m.from === "user" ? "justify-end" : "justify-start")}>
            <div
              className={cx(
                "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[14px] leading-relaxed",
                m.from === "user" ? "rounded-br-md bg-ink text-white" : "rounded-bl-md border border-line bg-white",
              )}
            >
              {m.body}
            </div>
          </div>
        ))}
        {typing && (
          <div className="flex justify-start">
            <div className="dots flex gap-1 rounded-2xl rounded-bl-md border border-line bg-white px-4 py-3.5">
              <span className="h-1.5 w-1.5 rounded-full bg-muted" />
              <span className="h-1.5 w-1.5 rounded-full bg-muted" />
              <span className="h-1.5 w-1.5 rounded-full bg-muted" />
            </div>
          </div>
        )}
      </div>

      {chips.length > 0 && (
        <div className="no-scrollbar flex gap-2 overflow-x-auto border-t border-line px-4 py-3">
          {chips.map((ch) => (
            <button
              key={ch.label}
              onClick={ch.onPick}
              className={cx(
                "anim-pop shrink-0 rounded-full border px-3.5 py-2 text-[13px] font-semibold transition active:scale-95",
                ch.primary ? "border-brand bg-brand text-white hover:bg-[#0c8a5f]" : "border-line bg-white text-ink hover:border-[#cfcec8] hover:bg-paper",
              )}
            >
              {ch.label}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          kirim();
        }}
        className="flex items-center gap-2 border-t border-line p-3"
      >
        <input
          ref={inputRef}
          value={text}
          disabled={!inputAktif}
          onChange={(e) => setText(e.target.value)}
          placeholder={inputAktif ? ph : "Pilih salah satu tombol di atas"}
          className="h-11 flex-1 rounded-xl border border-line bg-paper px-4 text-[14px] outline-none transition focus:border-brand focus:bg-white disabled:cursor-not-allowed"
        />
        <button
          type="submit"
          disabled={!inputAktif || !text.trim()}
          className="grid h-11 w-11 place-items-center rounded-xl bg-ink text-white transition hover:bg-[#2a2e2b] disabled:bg-[#e6e5e0] disabled:text-[#a9a8a2]"
          aria-label="Kirim"
        >
          <I.send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
