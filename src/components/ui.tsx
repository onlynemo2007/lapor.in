import { createContext, useCallback, useContext, useState, type ReactNode, type SVGProps } from "react";

/* ---------------------------------- ikon ---------------------------------- */

type P = SVGProps<SVGSVGElement>;
const ic = (d: ReactNode) =>
  function Icon(p: P) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" {...p}>
        {d}
      </svg>
    );
  };

export const I = {
  home: ic(<><path d="M3.5 10.5 12 4l8.5 6.5" /><path d="M5.5 9v10.5h13V9" /><path d="M10 19.5v-5h4v5" /></>),
  pen: ic(<><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" /><path d="m13.5 6.5 4 4" /></>),
  chat: ic(<><path d="M20.5 12a8 8 0 0 1-8 8H7l-3.5 2.5V16A8 8 0 0 1 11.5 4h1a8 8 0 0 1 8 8Z" /><path d="M8.5 11h7M8.5 14h4" /></>),
  flag: ic(<><path d="M5 21V4" /><path d="M5 4h11l-2 4 2 4H5" /></>),
  users: ic(<><circle cx="9" cy="8" r="3.3" /><path d="M3.5 19.5c.5-3.2 2.8-5 5.5-5s5 1.8 5.5 5" /><path d="M16 5a3.2 3.2 0 0 1 0 6M17.5 14.6c1.9.6 3 2.2 3.3 4.4" /></>),
  doc: ic(<><path d="M14 3H7.5A1.8 1.8 0 0 0 5.7 4.8v14.4A1.8 1.8 0 0 0 7.5 21h9a1.8 1.8 0 0 0 1.8-1.8V7.4Z" /><path d="M13.8 3.2v4.4h4.4M9 12.5h6M9 16h4" /></>),
  sync: ic(<><path d="M20 11a8 8 0 0 0-14.6-4.5L4 8" /><path d="M4 4v4h4" /><path d="M4 13a8 8 0 0 0 14.6 4.5L20 16" /><path d="M20 20v-4h-4" /></>),
  refresh: ic(<><path d="M20 12a8 8 0 1 1-2.6-5.9" /><path d="M20 4v4.5h-4.5" /></>),
  check: ic(<path d="m5 12.5 4.5 4.5L19 7.5" />),
  x: ic(<path d="M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5" />),
  plus: ic(<path d="M12 5.5v13M5.5 12h13" />),
  trash: ic(<><path d="M4.5 7h15M9.5 7V4.8h5V7" /><path d="M6.5 7l.8 12.2a1.6 1.6 0 0 0 1.6 1.5h6.2a1.6 1.6 0 0 0 1.6-1.5L17.5 7" /></>),
  copy: ic(<><rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2" /><path d="M15.5 8.5V5.8a1.8 1.8 0 0 0-1.8-1.8H5.8A1.8 1.8 0 0 0 4 5.8v7.9a1.8 1.8 0 0 0 1.8 1.8h2.7" /></>),
  send: ic(<path d="M4.5 11.8 20 4.5l-7.2 15.5-1.9-6.3Z" />),
  spark: ic(<><path d="M12 3.5 13.6 9l5.4 1.6-5.4 1.6L12 17.7l-1.6-5.5L5 10.6 10.4 9Z" /><path d="M18.5 4v2.8M17.1 5.4h2.8" /></>),
  link: ic(<><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>),
  print: ic(<><path d="M7 9V3.5h10V9" /><rect x="3.5" y="9" width="17" height="8" rx="2" /><path d="M7 14.5h10v6H7z" /></>),
  sheet: ic(<><rect x="3.5" y="3.5" width="17" height="17" rx="2.5" /><path d="M3.5 9.5h17M9.5 9.5v11M3.5 15h17" /></>),
  chev: ic(<path d="m9 5.5 6.5 6.5L9 18.5" />),
  down: ic(<path d="m5.5 9 6.5 6.5L18.5 9" />),
  alert: ic(<><path d="M12 4 2.8 19.5h18.4Z" /><path d="M12 10v4.2M12 17v.01" /></>),
  wand: ic(<><path d="m4 20 11-11" /><path d="m13 7 2-2 4 4-2 2" /><path d="M7 4v2M6 5h2M19 15v2M18 16h2" /></>),
  bolt: ic(<path d="M13 3 5.5 13.5h5L10 21l7.5-10.5h-5.2Z" />),
  arrow: ic(<path d="M5 12h14M13.5 6.5 19 12l-5.5 5.5" />),
  user: ic(<><circle cx="12" cy="8.5" r="3.8" /><path d="M4.5 20.5c.8-4 3.8-6.2 7.5-6.2s6.7 2.2 7.5 6.2" /></>),
  cal: ic(<><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>),
  money: ic(<><rect x="2.5" y="6" width="19" height="12" rx="2.5" /><circle cx="12" cy="12" r="2.6" /><path d="M6 9.5v5M18 9.5v5" /></>),
};

export function Logo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none">
      <rect x="1" y="1" width="30" height="30" rx="9" fill="#111412" />
      <path d="M9 10.5h14M9 16h9M9 21.5h6" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="22.5" cy="21.5" r="2.6" fill="#19c38a" />
    </svg>
  );
}

/* --------------------------------- primitif --------------------------------- */

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return <div className={cx("rounded-2xl border border-line bg-white", className)}>{children}</div>;
}

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "soft" | "danger" | "brand";
  size?: "sm" | "md";
};

export function Btn({ variant = "primary", size = "md", className = "", ...p }: BtnProps) {
  return (
    <button
      {...p}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100",
        size === "sm" ? "px-3 py-1.5 text-[12.5px]" : "px-4 py-2.5 text-[13.5px]",
        variant === "primary" && "bg-ink text-white hover:bg-[#2a2e2b]",
        variant === "brand" && "bg-brand text-white hover:bg-[#0c8a5f]",
        variant === "ghost" && "border border-line bg-white text-ink hover:border-[#d3d2cc] hover:bg-paper",
        variant === "soft" && "bg-paper text-ink hover:bg-[#f0efeb]",
        variant === "danger" && "text-bad hover:bg-bad-soft",
        className,
      )}
    />
  );
}

export function Pill({ tone = "neutral", children, className = "" }: { tone?: "neutral" | "brand" | "warn" | "bad"; children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
        tone === "neutral" && "bg-paper text-muted",
        tone === "brand" && "bg-brand-soft text-brand",
        tone === "warn" && "bg-warn-soft text-warn",
        tone === "bad" && "bg-bad-soft text-bad",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return <span className={cx("anim-spin inline-block rounded-full border-2 border-current border-r-transparent", className)} />;
}

export function SectionTitle({ title, sub, right }: { title: string; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-[17px] font-bold tracking-tight">{title}</h2>
        {sub && <p className="mt-0.5 text-[13px] text-muted">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export function Progress({ value, tone = "#0f9f6e", h = 6 }: { value: number; tone?: string; h?: number }) {
  return (
    <div className="w-full overflow-hidden rounded-full bg-[#f0efeb]" style={{ height: h }}>
      <div className="h-full rounded-full transition-[width] duration-700 ease-out" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: tone }} />
    </div>
  );
}

/* ---------------------------------- toast ---------------------------------- */

type Toast = { id: number; text: string; tone: "ok" | "err" | "info" };
const ToastCtx = createContext<(text: string, tone?: Toast["tone"]) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((text: string, tone: Toast["tone"] = "ok") => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x, { id, text, tone }]);
    window.setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), 3200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="no-print pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6">
        {items.map((t) => (
          <div
            key={t.id}
            className={cx(
              "anim-pop pointer-events-auto flex max-w-md items-center gap-2.5 rounded-xl px-4 py-2.5 text-[13px] font-medium shadow-lg",
              t.tone === "ok" && "bg-ink text-white",
              t.tone === "err" && "bg-bad text-white",
              t.tone === "info" && "border border-line bg-white text-ink",
            )}
          >
            {t.tone === "ok" && <I.check className="h-4 w-4 text-[#5fe0b0]" />}
            {t.tone === "err" && <I.alert className="h-4 w-4" />}
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);

export async function salin(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}
