import { useMemo, useState } from "react";
import { Database, Send, Plus, Trash2, Info } from "lucide-react";
import { countTokens } from "../lib/tokenizer";
import { fmtInt, fmtPct } from "../lib/format";
import { addSaved } from "../lib/storage";
import { Card, SectionHeader, Stat, Badge } from "./ui";

interface CacheEntry {
  q: string;
  a: string;
}

const CACHE_KEY = "tokenslim_semantic_cache";
const THRESHOLD = 0.45;

const SEED: CacheEntry[] = [
  { q: "How do I reset my password?", a: "Go to Settings → Security → Reset password. You'll get an email link valid for 30 minutes." },
  { q: "What is your refund policy?", a: "Full refunds within 14 days of purchase, no questions asked. After 14 days, refunds are prorated." },
  { q: "How can I export my data?", a: "Open the dashboard, click Export in the top-right, and choose CSV or JSON. Exports include all records." },
  { q: "Do you offer a free trial?", a: "Yes — 14 days, no credit card required. All Pro features are enabled during the trial." },
  { q: "How do I invite team members?", a: "Go to Workspace → Members → Invite. Each invite link expires after 7 days." },
  { q: "What payment methods do you accept?", a: "Visa, Mastercard, Amex, and ACH bank transfer for annual plans." },
  { q: "Is there an API for developers?", a: "Yes. Generate a key under Settings → API. Docs are at /docs/api with OpenAPI specs." },
];

function words(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 1),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const w of a) if (b.has(w)) inter++;
  return inter / (a.size + b.size - inter);
}

function loadCache(): CacheEntry[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) return JSON.parse(raw) as CacheEntry[];
  } catch {
    /* ignore */
  }
  return SEED;
}

export default function SemanticCache({ onSaved }: { onSaved: () => void }) {
  const [entries, setEntries] = useState<CacheEntry[]>(loadCache);
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<{
    hit: boolean;
    entry?: CacheEntry;
    sim: number;
    saved: number;
  } | null>(null);
  const [newQ, setNewQ] = useState("");
  const [newA, setNewA] = useState("");

  const persist = (next: CacheEntry[]) => {
    setEntries(next);
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const ask = () => {
    const q = question.trim();
    if (!q) return;
    const qWords = words(q);
    let best: CacheEntry | null = null;
    let bestSim = 0;
    for (const e of entries) {
      const sim = jaccard(qWords, words(e.q));
      if (sim > bestSim) {
        bestSim = sim;
        best = e;
      }
    }
    if (best && bestSim >= THRESHOLD) {
      const saved = countTokens(q) + countTokens(best.a);
      setResult({ hit: true, entry: best, sim: bestSim, saved });
      addSaved("cache", saved);
      onSaved();
    } else {
      setResult({ hit: false, sim: bestSim, saved: 0 });
    }
  };

  const addEntry = () => {
    if (!newQ.trim() || !newA.trim()) return;
    persist([...entries, { q: newQ.trim(), a: newA.trim() }]);
    setNewQ("");
    setNewA("");
  };

  const removeEntry = (idx: number) => {
    persist(entries.filter((_, i) => i !== idx));
  };

  const stats = useMemo(
    () => ({
      entries: entries.length,
      avgQ: entries.length ? Math.round(entries.reduce((a, e) => a + countTokens(e.q), 0) / entries.length) : 0,
    }),
    [entries],
  );

  return (
    <div className="animate-float-in">
      <SectionHeader
        icon={<Database size={20} />}
        title="Semantic Cache"
        blurb="Ask a question. If a near-duplicate was answered before (Jaccard similarity ≥ 0.45 on word sets), the cached answer is served — skipping a full model call."
      />
      <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-3 text-xs text-amber-200/80">
        <Info size={14} className="mt-0.5 shrink-0" />
        <span>
          Local demo of the concept — a production semantic cache uses vector embeddings and a real
          vector store. This demo uses Jaccard similarity on word sets so the idea is visible
          without any backend.
        </span>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-widest text-white/50">Ask</h3>
          <div className="flex gap-2">
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && ask()}
              placeholder='Try "how can I change my password?"'
              className="flex-1 rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white/90 outline-none transition focus:border-emerald-500/50"
            />
            <button
              onClick={ask}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-black transition hover:bg-emerald-400 active:scale-95"
            >
              <Send size={15} />
              Ask
            </button>
          </div>

          {result && (
            <div className="mt-4">
              {result.hit && result.entry ? (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.07] p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <Badge tone="emerald">Cache hit</Badge>
                    <span className="font-mono text-xs text-emerald-300">
                      similarity {fmtPct(result.sim)} · saved ~{fmtInt(result.saved)} tokens
                    </span>
                  </div>
                  <p className="text-xs text-white/45">Matched: “{result.entry.q}”</p>
                  <p className="mt-2 text-sm leading-relaxed text-white/85">{result.entry.a}</p>
                </div>
              ) : (
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <Badge tone="neutral">Cache miss</Badge>
                  <p className="mt-2 text-sm text-white/60">
                    No near-duplicate found (best similarity {fmtPct(result.sim)} &lt; 45%). A real
                    system would call the model here — and then cache the answer.
                  </p>
                </div>
              )}
            </div>
          )}

          <h3 className="mb-3 mt-6 text-sm font-semibold uppercase tracking-widest text-white/50">
            Add Q&A pair
          </h3>
          <div className="space-y-2">
            <input
              value={newQ}
              onChange={(e) => setNewQ(e.target.value)}
              placeholder="Question"
              className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2 text-sm text-white/90 outline-none transition focus:border-emerald-500/50"
            />
            <input
              value={newA}
              onChange={(e) => setNewA(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addEntry()}
              placeholder="Answer"
              className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2 text-sm text-white/90 outline-none transition focus:border-emerald-500/50"
            />
            <button
              onClick={addEntry}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/75 transition hover:border-emerald-500/40 hover:text-emerald-300"
            >
              <Plus size={13} /> Add to cache
            </button>
          </div>
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-widest text-white/50">
              Cached pairs ({entries.length})
            </h3>
            <Badge tone="gold">Jaccard ≥ 0.45</Badge>
          </div>
          <div className="max-h-[480px] space-y-2 overflow-y-auto pr-1">
            {entries.map((e, i) => (
              <div key={i} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-white/85">{e.q}</p>
                  <button
                    onClick={() => removeEntry(i)}
                    className="shrink-0 text-white/30 transition hover:text-red-400"
                    aria-label="Remove entry"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-white/50">{e.a}</p>
                <p className="mt-1 font-mono text-[10px] text-white/30">
                  ~{fmtInt(countTokens(e.q) + countTokens(e.a))} tokens
                </p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Stat label="Cached pairs" value={fmtInt(stats.entries)} />
        <Stat label="Avg tokens / pair" value={fmtInt(stats.avgQ)} sub="question tokens" />
      </div>
    </div>
  );
}
