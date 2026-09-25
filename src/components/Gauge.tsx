import { useId } from "react";

/**
 * Hand-rolled SVG arc gauge. frac in [0,1]; the needle sweeps from -120° to +120°.
 */
export function Gauge({
  frac,
  label,
  value,
  size = 200,
}: {
  frac: number;
  label: string;
  value: string;
  size?: number;
}) {
  const gid = useId();
  const clamped = Math.max(0, Math.min(1, frac));
  const cx = 100;
  const cy = 100;
  const r = 78;
  const startAngle = -120;
  const endAngle = 120;
  const toXY = (deg: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };
  const arc = (a0: number, a1: number) => {
    const p0 = toXY(a0);
    const p1 = toXY(a1);
    const large = a1 - a0 > 180 ? 1 : 0;
    return `M ${p0.x} ${p0.y} A ${r} ${r} 0 ${large} 1 ${p1.x} ${p1.y}`;
  };
  const needleDeg = startAngle + clamped * (endAngle - startAngle);
  const ticks = Array.from({ length: 9 }, (_, i) => startAngle + (i / 8) * (endAngle - startAngle));

  return (
    <svg viewBox="0 0 200 200" width={size} height={size} className="mx-auto block">
      <defs>
        <linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="60%" stopColor="#34d399" />
          <stop offset="100%" stopColor="#fbbf24" />
        </linearGradient>
      </defs>
      {/* track */}
      <path d={arc(startAngle, endAngle)} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="14" strokeLinecap="round" />
      {/* value arc */}
      <path
        d={arc(startAngle, needleDeg)}
        fill="none"
        stroke={`url(#${gid})`}
        strokeWidth="14"
        strokeLinecap="round"
        className="transition-all duration-700"
      />
      {/* ticks */}
      {ticks.map((t) => {
        const p0 = toXY(t);
        const rad = ((t - 90) * Math.PI) / 180;
        const p1 = { x: cx + (r - 16) * Math.cos(rad), y: cy + (r - 16) * Math.sin(rad) };
        return <line key={t} x1={p0.x} y1={p0.y} x2={p1.x} y2={p1.y} stroke="rgba(255,255,255,0.25)" strokeWidth="2" />;
      })}
      {/* needle */}
      <g className="animate-needle" style={{ ["--to" as string]: `${needleDeg}deg`, ["--from" as string]: "-120deg" }}>
        <line x1={cx} y1={cy} x2={cx} y2={cy - 58} stroke="#fbbf24" strokeWidth="3" strokeLinecap="round" />
      </g>
      <circle cx={cx} cy={cy} r="9" fill="#0b120e" stroke="#fbbf24" strokeWidth="2" />
      <text x={cx} y={cy + 42} textAnchor="middle" fill="#fff" fontSize="22" fontWeight="700" fontFamily="JetBrains Mono, monospace">
        {value}
      </text>
      <text x={cx} y={cy + 62} textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="11" letterSpacing="2">
        {label.toUpperCase()}
      </text>
    </svg>
  );
}
