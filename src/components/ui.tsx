import type { ReactNode } from "react";
import { cn } from "./cn";

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm p-5 sm:p-6 shadow-[0_8px_30px_rgba(0,0,0,0.35)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SectionHeader({
  icon,
  title,
  blurb,
}: {
  icon: ReactNode;
  title: string;
  blurb: string;
}) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30">
          {icon}
        </div>
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight">{title}</h2>
      </div>
      <p className="mt-2 max-w-2xl text-sm text-white/60">{blurb}</p>
    </div>
  );
}

export function Stat({
  label,
  value,
  accent,
  sub,
}: {
  label: string;
  value: string;
  accent?: "emerald" | "gold" | "red" | "white";
  sub?: string;
}) {
  const colors = {
    emerald: "text-emerald-400",
    gold: "text-amber-400",
    red: "text-red-400",
    white: "text-white",
  };
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-4">
      <div className="text-[11px] uppercase tracking-widest text-white/45">{label}</div>
      <div className={cn("mt-1 font-mono text-2xl font-semibold", colors[accent ?? "white"])}>
        {value}
      </div>
      {sub && <div className="mt-1 text-xs text-white/45">{sub}</div>}
    </div>
  );
}

/** Horizontal meter with animated fill and threshold coloring. */
export function Meter({
  frac,
  label,
  warnAt = 0.8,
  dangerAt = 1,
  format,
}: {
  frac: number;
  label?: string;
  warnAt?: number;
  dangerAt?: number;
  format?: (frac: number) => string;
}) {
  const clamped = Math.max(0, Math.min(1, frac));
  const color =
    clamped >= dangerAt
      ? "from-red-500 to-red-400"
      : clamped >= warnAt
        ? "from-amber-500 to-amber-400"
        : "from-emerald-500 to-emerald-400";
  return (
    <div>
      {label && (
        <div className="mb-1.5 flex items-center justify-between text-xs text-white/60">
          <span>{label}</span>
          <span className="font-mono">{format ? format(clamped) : `${(clamped * 100).toFixed(1)}%`}</span>
        </div>
      )}
      <div className="h-3 overflow-hidden rounded-full bg-white/10">
        <div
          className={cn("animate-meter h-full rounded-full bg-gradient-to-r", color)}
          style={{ width: `${clamped * 100}%` }}
        />
      </div>
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "emerald" | "gold" | "red";
}) {
  const tones = {
    neutral: "bg-white/10 text-white/70 ring-white/15",
    emerald: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
    gold: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
    red: "bg-red-500/15 text-red-300 ring-red-500/30",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* clipboard unavailable */
    }
  };
  return (
    <button
      onClick={onCopy}
      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-500/40 transition hover:bg-emerald-500/25 active:scale-95"
    >
      {label}
    </button>
  );
}
