import { useRef, useState } from "react";
import { rapikan, teksKeButir } from "../lib/model";
import { I, cx } from "../components/ui";

/** Editor daftar butir bernomor — dipakai untuk kegiatan harian & rencana. */
export default function ItemsEditor({
  items,
  onChange,
  placeholder = "Tulis kegiatan, tekan Enter…",
  onSubmit,
  autoFocus,
}: {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
  onSubmit?: () => void;
  autoFocus?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const addRef = useRef<HTMLTextAreaElement | null>(null);

  const tambah = (raw: string) => {
    const baru = teksKeButir(raw).map(rapikan).filter(Boolean);
    if (!baru.length) return;
    onChange([...items, ...baru]);
    setDraft("");
    requestAnimationFrame(() => addRef.current?.focus());
  };

  const ubah = (i: number, v: string) => onChange(items.map((x, j) => (j === i ? v : x)));
  const hapus = (i: number) => onChange(items.filter((_, j) => j !== i));
  const geser = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const n = [...items];
    [n[i], n[j]] = [n[j], n[i]];
    onChange(n);
  };

  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={i} className="anim-pop group flex items-start gap-2 rounded-xl border border-line bg-white p-1.5 pl-3 transition focus-within:border-brand">
          <span className="mt-2 w-5 shrink-0 text-right font-mono text-[12px] font-bold text-muted">{i + 1}.</span>
          <textarea
            value={it}
            rows={Math.max(1, Math.ceil(it.length / 70))}
            onChange={(e) => ubah(i, e.target.value)}
            onBlur={(e) => ubah(i, rapikan(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                onSubmit?.();
              }
            }}
            className="min-h-[36px] flex-1 resize-none bg-transparent py-1.5 text-[14px] leading-relaxed outline-none"
          />
          <div className="flex shrink-0 items-center opacity-100 transition sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
            <button onClick={() => geser(i, -1)} disabled={i === 0} className="grid h-8 w-7 place-items-center rounded-lg text-muted hover:bg-paper hover:text-ink disabled:opacity-30" title="Naikkan">
              <I.down className="h-4 w-4 rotate-180" />
            </button>
            <button onClick={() => geser(i, 1)} disabled={i === items.length - 1} className="grid h-8 w-7 place-items-center rounded-lg text-muted hover:bg-paper hover:text-ink disabled:opacity-30" title="Turunkan">
              <I.down className="h-4 w-4" />
            </button>
            <button onClick={() => hapus(i)} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-bad-soft hover:text-bad" title="Hapus butir">
              <I.trash className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}

      <div className={cx("flex items-start gap-2 rounded-xl border border-dashed p-1.5 pl-3 transition focus-within:border-brand focus-within:bg-white", items.length ? "border-[#d6d5cf]" : "border-[#c8c7c0] bg-white")}>
        <span className="mt-2 w-5 shrink-0 text-right font-mono text-[12px] font-bold text-[#b9b8b2]">{items.length + 1}.</span>
        <textarea
          ref={addRef}
          autoFocus={autoFocus}
          value={draft}
          rows={draft.includes("\n") ? Math.min(6, draft.split("\n").length) : 1}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onPaste={(e) => {
            const t = e.clipboardData.getData("text");
            if (t.includes("\n")) {
              e.preventDefault();
              tambah(draft + t);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              if (draft.trim()) tambah(draft);
              onSubmit?.();
              return;
            }
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              tambah(draft);
            }
          }}
          className="min-h-[36px] flex-1 resize-none bg-transparent py-1.5 text-[14px] leading-relaxed outline-none placeholder:text-[#a9a8a2]"
        />
        <button
          onClick={() => tambah(draft)}
          disabled={!draft.trim()}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-ink text-white transition hover:bg-[#2a2e2b] disabled:bg-[#e6e5e0] disabled:text-[#a9a8a2]"
          title="Tambah butir"
        >
          <I.plus className="h-4 w-4" />
        </button>
      </div>
      <p className="pl-1 text-[11.5px] text-muted">
        <kbd className="rounded border border-line bg-white px-1 font-mono text-[10px]">Enter</kbd> tambah butir ·{" "}
        <kbd className="rounded border border-line bg-white px-1 font-mono text-[10px]">Shift+Enter</kbd> baris baru · tempel daftar bernomor langsung terpecah otomatis
      </p>
    </div>
  );
}
