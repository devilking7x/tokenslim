import { useMemo, useState } from "react";
import { Brain, Download } from "lucide-react";
import { loadTiers, tierById } from "../lib/pricing";
import { costFor, fmtInt, fmtMoney, fmtPct } from "../lib/format";
import { addSaved } from "../lib/storage";
import { Card, SectionHeader, Stat } from "./ui";
import { Gauge } from "./Gauge";

const MAX_BUDGET = 16_000;
const WORKLOAD_TASKS = 10_000;
const BASE_INPUT = 3_000;
const BASE_OUTPUT = 600;

export default function ThinkingBudget({ onSaved }: { onSaved: () => void }) {
  const [budget, setBudget] = useState(4_000);
  const [tiers] = useState(() => loadTiers());

  const calc = useMemo(() => {
    const t = tierById(tiers, "mini");
    const basePerTask =
      costFor(BASE_INPUT, t.inPer1M) + costFor(BASE_OUTPUT, t.outPer1M);
    const withThinking =
      costFor(BASE_INPUT + budget, t.inPer1M) + costFor(BASE_OUTPUT, t.outPer1M);
    const baseTotal = basePerTask * WORKLOAD_TASKS;
    const thinkingTotal = withThinking * WORKLOAD_TASKS;
    const extra = thinkingTotal - baseTotal;
    return {
      baseTotal,
      thinkingTotal,
      extra,
      uplift: baseTotal > 0 ? extra / baseTotal : 0,
      reasoningTokens: budget * WORKLOAD_TASKS,
    };
  }, [budget, tiers]);

  return (
    <div className="animate-float-in">
      <SectionHeader
        icon={<Brain size={20} />}
        title="Thinking Budget"
        blurb="Reasoning tokens are billed like output tokens — and they add up fast. Set a thinking budget per task and see what it does to a 10k-task workload."
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-widest text-white/50">
              Reasoning tokens per task
            </h3>
            <span className="font-mono text-lg font-bold text-amber-300">{fmtInt(budget)}</span>
          </div>
          <input
            type="range"
            min={0}
            max={MAX_BUDGET}
            step={250}
            value={budget}
            onChange={(e) => setBudget(Number(e.target.value))}
            className="slim-slider w-full"
            style={{ ["--fill" as string]: `${(budget / MAX_BUDGET) * 100}%` }}
          />
          <div className="mt-1 flex justify-between text-[11px] text-white/40">
            <span>0</span>
            <span>8k</span>
            <span>16k</span>
          </div>
          <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-4 text-xs leading-relaxed text-white/60">
            <strong className="text-white/85">Why reasoning tokens are sneaky:</strong> they're
            invisible in the answer but billed as output. A model "thinking" for 4,000 tokens before
            answering a 600-token question costs{" "}
            <strong className="text-amber-300">~7× the output price</strong> of the answer itself.
            Unbounded thinking on easy tasks is pure waste — cap it per task, raise it only where
            evals prove it helps.
          </div>
          <button
            onClick={() => {
              addSaved("thinking", Math.round(calc.reasoningTokens * 0.5));
              onSaved();
            }}
            disabled={budget === 0}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-500/40 transition hover:bg-emerald-500/25 disabled:opacity-40"
          >
            <Download size={13} />
            Log 50% of reasoning tokens as avoidable (estimated)
          </button>
        </Card>

        <Card className="flex items-center justify-center">
          <Gauge
            frac={Math.min(1, calc.uplift)}
            value={budget === 0 ? "0%" : `+${fmtPct(calc.uplift)}`}
            label="cost uplift"
          />
        </Card>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-4">
        <Stat label="Workload" value={fmtInt(WORKLOAD_TASKS)} sub="medium tasks" />
        <Stat label="Base cost" value={fmtMoney(calc.baseTotal)} sub="no reasoning" />
        <Stat label="With thinking" value={fmtMoney(calc.thinkingTotal)} accent="gold" sub={`${fmtInt(budget)} reasoning tokens/task`} />
        <Stat label="Extra spend" value={fmtMoney(calc.extra)} accent="red" sub={`${fmtInt(calc.reasoningTokens)} reasoning tokens`} />
      </div>

      <Card className="mt-5">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-widest text-white/50">
          Cost vs thinking budget (sample workload)
        </h3>
        <ThinkingChart budget={budget} tiers={tiers} />
      </Card>
    </div>
  );
}

function ThinkingChart({ budget, tiers }: { budget: number; tiers: ReturnType<typeof loadTiers> }) {
  const points = useMemo(() => {
    const t = tierById(tiers, "mini");
    return [0, 2000, 4000, 8000, 12000, 16000].map((b) => {
      const perTask =
        costFor(BASE_INPUT + b, t.inPer1M) + costFor(BASE_OUTPUT, t.outPer1M);
      return { b, total: perTask * WORKLOAD_TASKS };
    });
  }, [tiers]);

  const W = 640;
  const H = 220;
  const pad = 40;
  const max = Math.max(...points.map((p) => p.total));
  const x = (i: number) => pad + (i / (points.length - 1)) * (W - pad * 2);
  const y = (v: number) => H - pad - (v / max) * (H - pad * 2);
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.total)}`).join(" ");
  const area = `${line} L${x(points.length - 1)},${H - pad} L${x(0)},${H - pad} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      <defs>
        <linearGradient id="thinkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <g key={f}>
          <line x1={pad} x2={W - pad} y1={y(max * f)} y2={y(max * f)} stroke="rgba(255,255,255,0.07)" />
          <text x={pad - 6} y={y(max * f) + 4} textAnchor="end" fontSize="10" fill="rgba(255,255,255,0.4)">
            {fmtMoney(max * f)}
          </text>
        </g>
      ))}
      <path d={area} fill="url(#thinkFill)" />
      <path d={line} fill="none" stroke="#fbbf24" strokeWidth="2.5" />
      {points.map((p, i) => {
        const active = p.b === budget;
        return (
          <g key={p.b}>
            <circle
              cx={x(i)}
              cy={y(p.total)}
              r={active ? 7 : 4}
              fill={active ? "#fbbf24" : "#0b120e"}
              stroke="#fbbf24"
              strokeWidth="2"
              className={active ? "animate-pulse-ring" : ""}
            />
            <text x={x(i)} y={H - 12} textAnchor="middle" fontSize="10" fill="rgba(255,255,255,0.45)">
              {p.b / 1000}k
            </text>
          </g>
        );
      })}
      <text x={pad} y={18} fontSize="11" fill="rgba(255,255,255,0.5)">
        Total workload cost · mini-class tier · {fmtInt(WORKLOAD_TASKS)} tasks
      </text>
    </svg>
  );
}
