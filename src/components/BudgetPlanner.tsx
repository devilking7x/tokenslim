import { useMemo, useState } from "react";
import { Wallet, Plus, Trash2, AlertTriangle, Download } from "lucide-react";
import { loadTiers, tierById, type TierId } from "../lib/pricing";
import { costFor, fmtInt, fmtMoney } from "../lib/format";
import { addSaved } from "../lib/storage";
import { Card, SectionHeader, Stat, Badge, Meter } from "./ui";

interface Task {
  id: number;
  name: string;
  inTokens: number;
  outTokens: number;
  tier: TierId;
}

const TASKS_KEY = "tokenslim_planner_tasks";
const BUDGET_KEY = "tokenslim_planner_budget";

function loadTasks(): Task[] {
  try {
    const raw = localStorage.getItem(TASKS_KEY);
    if (raw) return JSON.parse(raw) as Task[];
  } catch {
    /* ignore */
  }
  return [
    { id: 1, name: "Daily support triage", inTokens: 2500, outTokens: 400, tier: "mini" },
    { id: 2, name: "Weekly report generation", inTokens: 12000, outTokens: 2500, tier: "flagship" },
    { id: 3, name: "Log classification", inTokens: 800, outTokens: 60, tier: "nano" },
  ];
}

export default function BudgetPlanner({ onSaved }: { onSaved: () => void }) {
  const [tiers] = useState(() => loadTiers());
  const [tasks, setTasks] = useState<Task[]>(loadTasks);
  const [budget, setBudget] = useState(() => {
    try {
      return Number(localStorage.getItem(BUDGET_KEY) ?? 50) || 50;
    } catch {
      return 50;
    }
  });
  const [name, setName] = useState("");
  const [inTokens, setInTokens] = useState("2000");
  const [outTokens, setOutTokens] = useState("500");
  const [tier, setTier] = useState<TierId>("mini");

  const persistTasks = (next: Task[]) => {
    setTasks(next);
    try {
      localStorage.setItem(TASKS_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const setBudgetPersist = (v: number) => {
    setBudget(v);
    try {
      localStorage.setItem(BUDGET_KEY, String(v));
    } catch {
      /* ignore */
    }
  };

  const totals = useMemo(() => {
    let inT = 0;
    let outT = 0;
    let cost = 0;
    for (const t of tasks) {
      inT += t.inTokens;
      outT += t.outTokens;
      const p = tierById(tiers, t.tier);
      cost += costFor(t.inTokens, p.inPer1M) + costFor(t.outTokens, p.outPer1M);
    }
    return { inT, outT, cost, frac: budget > 0 ? cost / budget : 0 };
  }, [tasks, tiers, budget]);

  const addTask = () => {
    const i = parseInt(inTokens, 10);
    const o = parseInt(outTokens, 10);
    if (!name.trim() || !Number.isFinite(i) || !Number.isFinite(o) || i < 0 || o < 0) return;
    persistTasks([...tasks, { id: Date.now(), name: name.trim(), inTokens: i, outTokens: o, tier }]);
    setName("");
  };

  const taskCost = (t: Task) => {
    const p = tierById(tiers, t.tier);
    return costFor(t.inTokens, p.inPer1M) + costFor(t.outTokens, p.outPer1M);
  };

  const status = totals.frac >= 1 ? "over" : totals.frac >= 0.8 ? "warn" : "ok";

  return (
    <div className="animate-float-in">
      <SectionHeader
        icon={<Wallet size={20} />}
        title="Budget Planner"
        blurb="Model your recurring AI workload as tasks with estimated token volumes and tiers. Watch the budget meter — warnings fire at 80% and 100% of your budget."
      />

      <Card className="mb-5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-white/50">Budget meter</h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/50">Monthly budget</span>
            <div className="flex items-center rounded-lg border border-white/10 bg-black/40 px-2">
              <span className="text-xs text-white/40">$</span>
              <input
                type="number"
                min="0"
                step="1"
                value={budget}
                onChange={(e) => setBudgetPersist(Math.max(0, Number(e.target.value) || 0))}
                className="w-20 bg-transparent px-1 py-1.5 font-mono text-sm text-white outline-none"
              />
            </div>
          </div>
        </div>
        <Meter
          frac={totals.frac}
          label="Budget used"
          warnAt={0.8}
          dangerAt={1}
          format={(f) => `${(f * 100).toFixed(1)}% · ${fmtMoney(totals.cost)} / ${fmtMoney(budget)}`}
        />
        {status !== "ok" && (
          <div
            className={`mt-3 flex items-center gap-2 rounded-xl p-3 text-xs ${
              status === "over"
                ? "border border-red-500/30 bg-red-500/10 text-red-300"
                : "border border-amber-500/30 bg-amber-500/10 text-amber-300"
            }`}
          >
            <AlertTriangle size={14} />
            {status === "over"
              ? `Over budget by ${fmtMoney(totals.cost - budget)}. Downgrade tiers or trim token volumes.`
              : `At ${(totals.frac * 100).toFixed(0)}% of budget — close to the limit.`}
          </div>
        )}
      </Card>

      <div className="grid gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-widest text-white/50">Add task</h3>
          <div className="space-y-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Task name"
              className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2 text-sm text-white/90 outline-none transition focus:border-emerald-500/50"
            />
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-white/50">
                Input tokens
                <input
                  type="number"
                  min="0"
                  value={inTokens}
                  onChange={(e) => setInTokens(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 font-mono text-sm text-white outline-none focus:border-emerald-500/50"
                />
              </label>
              <label className="text-xs text-white/50">
                Output tokens
                <input
                  type="number"
                  min="0"
                  value={outTokens}
                  onChange={(e) => setOutTokens(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 font-mono text-sm text-white outline-none focus:border-emerald-500/50"
                />
              </label>
            </div>
            <label className="block text-xs text-white/50">
              Model tier
              <select
                value={tier}
                onChange={(e) => setTier(e.target.value as TierId)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white/90 outline-none focus:border-emerald-500/50"
              >
                {tiers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label} (${t.inPer1M}/${t.outPer1M} per 1M)
                  </option>
                ))}
              </select>
            </label>
            <button
              onClick={addTask}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-black transition hover:bg-emerald-400 active:scale-95"
            >
              <Plus size={15} /> Add task
            </button>
          </div>
          <button
            onClick={() => {
              addSaved("planner", Math.round(totals.inT * 0.2 + totals.outT * 0.2));
              onSaved();
            }}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-500/40 transition hover:bg-emerald-500/25"
          >
            <Download size={13} />
            Log 20% optimization potential (estimated)
          </button>
        </Card>

        <Card className="lg:col-span-3">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-widest text-white/50">
            Tasks ({tasks.length})
          </h3>
          <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
            {tasks.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-white">{t.name}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <Badge tone="emerald">{tierById(tiers, t.tier).label}</Badge>
                    <span className="font-mono text-[11px] text-white/45">
                      {fmtInt(t.inTokens)} in · {fmtInt(t.outTokens)} out
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="font-mono text-sm font-semibold text-amber-300">{fmtMoney(taskCost(t))}</span>
                  <button
                    onClick={() => persistTasks(tasks.filter((x) => x.id !== t.id))}
                    className="text-white/30 transition hover:text-red-400"
                    aria-label="Remove task"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
            {tasks.length === 0 && (
              <p className="py-8 text-center text-sm text-white/40">No tasks yet — add one to start planning.</p>
            )}
          </div>
        </Card>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-4">
        <Stat label="Total input" value={fmtInt(totals.inT)} sub="tokens" />
        <Stat label="Total output" value={fmtInt(totals.outT)} sub="tokens" />
        <Stat label="Projected cost" value={fmtMoney(totals.cost)} accent="gold" />
        <Stat
          label="Remaining"
          value={fmtMoney(Math.max(0, budget - totals.cost))}
          accent={status === "ok" ? "emerald" : "red"}
          sub={`of ${fmtMoney(budget)} budget`}
        />
      </div>
    </div>
  );
}
