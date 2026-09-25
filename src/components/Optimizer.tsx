import { useMemo, useState } from "react";
import { Scissors, Copy, Check, Sparkles, Wand2 } from "lucide-react";
import { compressPrompt, diffWords, SAMPLE_PROMPTS } from "../lib/compress";
import { countTokens } from "../lib/tokenizer";
import { fmtInt, fmtPct } from "../lib/format";
import { addSaved } from "../lib/storage";
import { Card, SectionHeader, Stat, CopyButton, Badge } from "./ui";
import { Gauge } from "./Gauge";

export default function Optimizer({ onSaved }: { onSaved: () => void }) {
  const [input, setInput] = useState(SAMPLE_PROMPTS[0].body);
  const [copied, setCopied] = useState(false);

  const result = useMemo(() => {
    const c = compressPrompt(input);
    const before = countTokens(input);
    const after = countTokens(c.output);
    const saved = Math.max(0, before - after);
    return { ...c, before, after, saved, frac: before > 0 ? saved / before : 0 };
  }, [input]);

  const diff = useMemo(() => diffWords(input, result.output), [input, result.output]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(result.output);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  const handleLogSavings = () => {
    addSaved("optimizer", result.saved);
    onSaved();
  };

  return (
    <div className="animate-float-in">
      <SectionHeader
        icon={<Scissors size={20} />}
        title="Prompt Optimizer"
        blurb="Paste a bloated prompt. TokenSlim strips filler phrases, dedupes repeated sentences, collapses whitespace, and rewrites it as tight imperative bullets — with real BPE token counts before and after."
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {SAMPLE_PROMPTS.map((s) => (
          <button
            key={s.title}
            onClick={() => setInput(s.body)}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70 transition hover:border-emerald-500/40 hover:text-emerald-300"
          >
            <Sparkles size={12} />
            {s.title}
          </button>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-widest text-white/50">Before</h3>
            <Badge tone="neutral">{fmtInt(result.before)} tokens</Badge>
          </div>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={14}
            placeholder="Paste your verbose prompt here…"
            className="w-full resize-y rounded-xl border border-white/10 bg-black/40 p-4 text-sm leading-relaxed text-white/90 outline-none transition focus:border-emerald-500/50"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={handleLogSavings}
              disabled={result.saved <= 0}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-black transition hover:bg-emerald-400 active:scale-95 disabled:opacity-40"
            >
              <Wand2 size={15} />
              Log {fmtInt(result.saved)} saved tokens
            </button>
          </div>
        </Card>

        <Card>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-widest text-white/50">After</h3>
            <div className="flex items-center gap-2">
              <Badge tone="emerald">{fmtInt(result.after)} tokens</Badge>
              <CopyButton text={result.output} />
            </div>
          </div>
          <div className="min-h-[340px] whitespace-pre-wrap rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4 font-mono text-sm leading-relaxed text-emerald-100">
            {result.output || <span className="text-white/30">Optimized output appears here…</span>}
          </div>
          <div className="mt-3">
            <div className="mb-1 text-xs text-white/50">Rules applied</div>
            <div className="flex flex-wrap gap-1.5">
              {result.rulesApplied.map((r) => (
                <Badge key={r} tone="gold">{r}</Badge>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Card className="flex items-center justify-center">
          <Gauge frac={result.frac} value={fmtPct(result.frac)} label="tokens saved" />
        </Card>
        <div className="lg:col-span-2">
          <Card className="h-full">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-widest text-white/50">Word diff</h3>
              <span className="text-xs text-white/40">struck words were removed</span>
            </div>
            <p className="max-h-56 overflow-y-auto text-sm leading-7 text-white/80">
              {diff.map((t, i) => (
                <span
                  key={i}
                  className={
                    t.removed
                      ? "rounded bg-red-500/15 px-0.5 text-red-300 line-through decoration-red-400/70"
                      : ""
                  }
                >
                  {t.text}{" "}
                </span>
              ))}
            </p>
          </Card>
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-4">
        <Stat label="Tokens before" value={fmtInt(result.before)} />
        <Stat label="Tokens after" value={fmtInt(result.after)} accent="gold" />
        <Stat label="Tokens saved" value={fmtInt(result.saved)} accent="emerald" />
        <Stat
          label="Sentences"
          value={`${result.sentencesBefore} → ${result.sentencesAfter}`}
          sub="deduplicated & compressed"
        />
      </div>

      <button
        onClick={handleCopy}
        className="mt-5 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 transition hover:border-emerald-500/40 hover:text-emerald-300"
      >
        {copied ? <Check size={15} className="text-emerald-400" /> : <Copy size={15} />}
        {copied ? "Copied!" : "Copy optimized prompt"}
      </button>
    </div>
  );
}
