import { useMemo, useState } from "react";
import { Layers, Pencil, RotateCcw, Download } from "lucide-react";
import { loadTiers, saveTiers, resetTiers, tierById, type TierPrice, type TierId } from "../lib/pricing";
import { costFor, fmtInt, fmtMoney, fmtPct } from "../lib/format";
import { addSaved } from "../lib/storage";
import { Card, SectionHeader, Stat, Badge } from "./ui";

type Complexity = "trivial" | "simple" | "medium" | "hard";

const COMPLEXITY_INFO: Record<
  Complexity,
  { label: string; desc: string; mix: [TierId, number][]; inTok: number; outTok: number }
> = {
  trivial: {
    label: "Trivial",
    desc: "Classification, formatting, extraction — deterministic micro-tasks.",
    mix: [["nano", 0.95], ["mini", 0.05]],
    inTok: 400,
    outTok: 80,
  },
  simple: {
    label: "Simple",
    desc: "Summaries, rewrites, Q&A over short context.",
    mix: [["mini", 0.8], ["flagship", 0.2]],
    inTok: 1200,
    outTok: 300,
  },
  medium: {
    label: "Medium",
    desc: "Multi-step reasoning, code generation, RAG over moderate context.",
    mix: [["flash", 0.5], ["mini", 0.3], ["flagship", 0.2]],
    inTok: 4000,
    outTok: 900,
  },
  hard: {
    label: "Hard",
    desc: "Deep reasoning, agentic workflows, novel problem solving.",
    mix: [["flagship", 0.7], ["haiku", 0.3]],
    inTok: 9000,
    outTok: 2200,
  },
};

const CALL_VOLUMES = [1_000, 10_000, 100_000];

export default function ModelCascade({ onSaved }: { onSaved: () => void }) {
  const [tiers, setTiers] = useState<TierPrice[]>(() => loadTiers());
  const [editing, setEditing] = useState(false);
  const [complexity, setComplexity] = useState<Complexity>("medium");

  const info = COMPLEXITY_INFO[complexity];

  const perCall = useMemo(() => {
    const naive =
      costFor(info.inTok, tierById(tiers, "flagship").inPer1M) +
      costFor(info.outTok, tierById(tiers, "flagship").outPer1M);
    const cascade = info.mix.reduce((sum, [id, share]) => {
      const t = tierById(tiers, id);
      return sum + share * (costFor(info.inTok, t.inPer1M) + costFor(info.outTok, t.outPer1M));
    }, 0);
    return { naive, cascade, frac: naive > 0 ? (naive - cascade) / naive : 0 };
  }, [tiers, info]);

  const updateTier = (id: TierId, field: "inPer1M" | "outPer1M", value: number) => {
    if (!Number.isFinite(value) || value < 0) return;
    setTiers((prev) => {
      const next = prev.map((t) => (t.id === id ? { ...t, [field]: value } : t));
      saveTiers(next);
      return next;
    });
  };

  const handleReset = () => {
    resetTiers();
    setTiers(loadTiers());
  };

  return (
    <div className="animate-float-in">
      <SectionHeader
        icon={<Layers size={20} />}
        title="Model Cascade"
        blurb="Not every task needs the flagship model. Route trivial work to nano-class tiers and reserve flagship spend for genuinely hard tasks — the cascade cuts cost per call dramatically."
      />

      <div className="mb-5 grid gap-2 sm:grid-cols-4">
        {(Object.keys(COMPLEXITY_INFO) as Complexity[]).map((c) => (
          <button
            key={c}
            onClick={() => setComplexity(c)}
            className={`rounded-xl border p-3 text-left transition ${
              complexity === c
                ? "border-amber-500/50 bg-amber-500/10"
                : "border-white/10 bg-white/[0.02] hover:border-white/25"
            }`}
          >
            <div className="text-sm font-bold text-white">{COMPLEXITY_INFO[c].label}</div>
            <div className="mt-1 text-[11px] leading-snug text-white/50">{COMPLEXITY_INFO[c].desc}</div>
          </button>
        ))}
      </div>

      <Card className="mb-5">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-widest text-white/50">
          Recommended routing — {info.label}
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          {info.mix.map(([id, share]) => {
            const t = tierById(tiers, id);
            return (
              <Badge key={id} tone={id === "flagship" ? "gold" : "emerald"}>
                {(share * 100).toFixed(0)}% → {t.label}
              </Badge>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-white/45">
          Per call: ~{fmtInt(info.inTok)} input + ~{fmtInt(info.outTok)} output tokens.
          Naive (always flagship): <span className="font-mono text-red-300">{fmtMoney(perCall.naive)}</span>
          {" "}vs cascade: <span className="font-mono text-emerald-300">{fmtMoney(perCall.cascade)}</span>
          {" "}(saves <span className="font-mono text-amber-300">{fmtPct(perCall.frac)}</span>).
        </p>
        <button
          onClick={() => {
            const savedTok = Math.round(100_000 * (perCall.naive - perCall.cascade > 0 ? (info.inTok + info.outTok) * perCall.frac : 0));
            addSaved("cascade", savedTok);
            onSaved();
          }}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-500/40 transition hover:bg-emerald-500/25"
        >
          <Download size={13} />
          Log 100k-call scenario savings (estimated)
        </button>
      </Card>

      <div className="mb-5 overflow-x-auto">
        <Card className="min-w-[560px]">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-widest text-white/50">
            Cost comparison: naive vs cascade
          </h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs uppercase tracking-widest text-white/45">
                <th className="pb-2 pr-4">Calls</th>
                <th className="pb-2 pr-4">Naive (always flagship)</th>
                <th className="pb-2 pr-4">Cascade</th>
                <th className="pb-2">Saved</th>
              </tr>
            </thead>
            <tbody>
              {CALL_VOLUMES.map((v) => {
                const naive = perCall.naive * v;
                const cascade = perCall.cascade * v;
                return (
                  <tr key={v} className="border-b border-white/5 last:border-0">
                    <td className="py-2.5 pr-4 font-mono text-white/80">{fmtInt(v)}</td>
                    <td className="py-2.5 pr-4 font-mono text-red-300">{fmtMoney(naive)}</td>
                    <td className="py-2.5 pr-4 font-mono text-emerald-300">{fmtMoney(cascade)}</td>
                    <td className="py-2.5 font-mono text-amber-300">
                      {fmtMoney(naive - cascade)} ({fmtPct(perCall.frac)})
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </div>

      <Card>
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-white/50">
            Cost per 1M tokens <Badge tone="gold">user-editable estimates</Badge>
          </h3>
          <div className="flex gap-2">
            <button
              onClick={() => setEditing((e) => !e)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70 transition hover:border-amber-500/40 hover:text-amber-300"
            >
              <Pencil size={13} /> {editing ? "Done" : "Edit"}
            </button>
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70 transition hover:border-white/30"
            >
              <RotateCcw size={13} /> Reset
            </button>
          </div>
        </div>
        <p className="mb-3 text-xs text-white/40">
          Realistic 2026 prices, editable — providers change pricing, so treat these as starting estimates. Saved to your browser.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs uppercase tracking-widest text-white/45">
                <th className="pb-2 pr-4">Tier</th>
                <th className="pb-2 pr-4">Input / 1M</th>
                <th className="pb-2 pr-4">Output / 1M</th>
                <th className="pb-2">Notes</th>
              </tr>
            </thead>
            <tbody>
              {tiers.map((t) => (
                <tr key={t.id} className="border-b border-white/5 last:border-0">
                  <td className="py-2.5 pr-4 font-semibold text-white">{t.label}</td>
                  <td className="py-2.5 pr-4">
                    {editing ? (
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={t.inPer1M}
                        onChange={(e) => updateTier(t.id, "inPer1M", parseFloat(e.target.value))}
                        className="w-24 rounded-lg border border-white/15 bg-black/50 px-2 py-1 font-mono text-xs text-white outline-none focus:border-emerald-500/50"
                      />
                    ) : (
                      <span className="font-mono text-white/80">${t.inPer1M.toFixed(2)}</span>
                    )}
                  </td>
                  <td className="py-2.5 pr-4">
                    {editing ? (
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={t.outPer1M}
                        onChange={(e) => updateTier(t.id, "outPer1M", parseFloat(e.target.value))}
                        className="w-24 rounded-lg border border-white/15 bg-black/50 px-2 py-1 font-mono text-xs text-white outline-none focus:border-emerald-500/50"
                      />
                    ) : (
                      <span className="font-mono text-white/80">${t.outPer1M.toFixed(2)}</span>
                    )}
                  </td>
                  <td className="py-2.5 text-xs text-white/45">{t.blurb}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <Stat label="Cost / call (naive)" value={fmtMoney(perCall.naive)} accent="red" />
        <Stat label="Cost / call (cascade)" value={fmtMoney(perCall.cascade)} accent="emerald" />
        <Stat label="Saved per 100k calls" value={fmtMoney((perCall.naive - perCall.cascade) * 100_000)} accent="gold" />
      </div>
    </div>
  );
}
