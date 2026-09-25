import { useState } from "react";
import { LayoutDashboard, RotateCcw, TrendingDown } from "lucide-react";
import {
  getTotalSaved,
  getFeatureSavings,
  getWeeklyActivity,
  resetSavings,
  FEATURE_LABELS,
  type FeatureKey,
} from "../lib/storage";
import { fmtInt } from "../lib/format";
import { Card, SectionHeader, Stat } from "./ui";

const FEATURE_COLORS: Record<FeatureKey, string> = {
  optimizer: "#10b981",
  router: "#34d399",
  cascade: "#fbbf24",
  thinking: "#f59e0b",
  cache: "#6ee7b7",
  planner: "#a7f3d0",
};

export default function Dashboard({ onSaved }: { onSaved: () => void }) {
  const [, setTick] = useState(0);
  const total = getTotalSaved();
  const perFeature = getFeatureSavings();
  const weekly = getWeeklyActivity();

  const refresh = () => {
    onSaved();
    setTick((t) => t + 1);
  };

  const keys = Object.keys(FEATURE_LABELS) as FeatureKey[];
  const maxFeature = Math.max(1, ...keys.map((k) => perFeature[k]));

  // Weekly bars chart geometry
  const W = 640;
  const H = 200;
  const pad = 36;
  const maxW = Math.max(1, ...weekly.map((d) => d.tokens));
  const bw = (W - pad * 2) / weekly.length;

  return (
    <div className="animate-float-in">
      <SectionHeader
        icon={<LayoutDashboard size={20} />}
        title="Savings Dashboard"
        blurb="Every feature in TokenSlim can log its savings here. The cumulative counter and activity log live in your browser's localStorage — nothing leaves the device."
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Stat label="Cumulative tokens saved" value={fmtInt(total)} accent="emerald" sub="all features, all time" />
        <Stat
          label="Active features"
          value={String(keys.filter((k) => perFeature[k] > 0).length)}
          sub={`of ${keys.length} tracking`}
        />
        <Card className="flex items-center justify-between !p-4">
          <div className="flex items-center gap-2 text-xs text-white/60">
            <TrendingDown size={15} className="text-emerald-400" />
            Every token saved is spend avoided.
          </div>
          <button
            onClick={() => {
              resetSavings();
              refresh();
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/60 transition hover:border-red-500/40 hover:text-red-300"
          >
            <RotateCcw size={12} /> Reset
          </button>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest text-white/50">
            Savings by feature
          </h3>
          <div className="space-y-3">
            {keys.map((k, i) => {
              const v = perFeature[k];
              return (
                <div key={k}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-white/70">{FEATURE_LABELS[k]}</span>
                    <span className="font-mono text-white/85">{fmtInt(v)}</span>
                  </div>
                  <div className="h-4 overflow-hidden rounded-md bg-white/[0.07]">
                    <div
                      className="animate-bar h-full rounded-md"
                      style={{
                        width: `${(v / maxFeature) * 100}%`,
                        background: `linear-gradient(90deg, ${FEATURE_COLORS[k]}55, ${FEATURE_COLORS[k]})`,
                        animationDelay: `${i * 80}ms`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
            {total === 0 && (
              <p className="pt-2 text-xs text-white/40">
                Nothing logged yet — run the Prompt Optimizer or Semantic Cache, or log a scenario
                estimate from any feature tab.
              </p>
            )}
          </div>
        </Card>

        <Card>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest text-white/50">
            Weekly activity
          </h3>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
            {[0.25, 0.5, 0.75, 1].map((f) => (
              <g key={f}>
                <line
                  x1={pad}
                  x2={W - pad}
                  y1={H - pad - f * (H - pad * 2)}
                  y2={H - pad - f * (H - pad * 2)}
                  stroke="rgba(255,255,255,0.07)"
                />
                <text
                  x={pad - 8}
                  y={H - pad - f * (H - pad * 2) + 4}
                  textAnchor="end"
                  fontSize="10"
                  fill="rgba(255,255,255,0.4)"
                >
                  {fmtInt(maxW * f)}
                </text>
              </g>
            ))}
            {weekly.map((d, i) => {
              const h = (d.tokens / maxW) * (H - pad * 2);
              const x = pad + i * bw + bw * 0.2;
              const w = bw * 0.6;
              return (
                <g key={i}>
                  <rect
                    x={x}
                    y={H - pad - h}
                    width={w}
                    height={Math.max(h, 2)}
                    rx="5"
                    fill={d.tokens > 0 ? "#10b981" : "rgba(255,255,255,0.06)"}
                    opacity={d.tokens > 0 ? 0.9 : 1}
                    className="animate-bar"
                    style={{ animationDelay: `${i * 70}ms` }}
                  />
                  <text x={x + w / 2} y={H - 14} textAnchor="middle" fontSize="10" fill="rgba(255,255,255,0.5)">
                    {d.label}
                  </text>
                  {d.tokens > 0 && (
                    <text
                      x={x + w / 2}
                      y={H - pad - h - 6}
                      textAnchor="middle"
                      fontSize="9"
                      fill="rgba(255,255,255,0.55)"
                    >
                      {fmtInt(d.tokens)}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
          <p className="mt-2 text-xs text-white/40">
            Tokens saved per day over the last 7 days, from your local activity log.
          </p>
        </Card>
      </div>

      <Card className="mt-5">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-widest text-white/50">
          How savings are counted
        </h3>
        <ul className="list-disc space-y-1.5 pl-5 text-xs leading-relaxed text-white/55">
          <li>
            <strong className="text-white/80">Prompt Optimizer</strong> — real BPE token counts
            before vs after compression, logged when you press "Log saved tokens".
          </li>
          <li>
            <strong className="text-white/80">Semantic Cache</strong> — real token counts of the
            question + served answer on each cache hit.
          </li>
          <li>
            <strong className="text-white/80">Skill Router, Model Cascade, Thinking Budget, Budget
            Planner</strong> — scenario estimates, clearly labeled "estimated" where you log them.
          </li>
        </ul>
      </Card>
    </div>
  );
}
