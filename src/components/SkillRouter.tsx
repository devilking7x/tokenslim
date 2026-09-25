import { useMemo, useState } from "react";
import { Library, Search, X, FileText, Zap, Download } from "lucide-react";
import registry from "../data/skills-registry.json";
import { fmtInt, fmtPct } from "../lib/format";
import { addSaved } from "../lib/storage";
import { Card, SectionHeader, Stat, Badge } from "./ui";

interface SkillEntry {
  id: string;
  name: string;
  category: string;
  description: string;
  estTokens: number;
}

const SKILLS = registry as SkillEntry[];

// Full bodies for the 18 curated skills, loaded on demand via ?raw.
const skillModules = import.meta.glob("../data/skills/*.md", {
  query: "?raw",
  import: "default",
}) as Record<string, () => Promise<string>>;

const CATEGORIES = Array.from(new Set(SKILLS.map((s) => s.category))).sort();

function parseFrontmatter(raw: string): { body: string; meta: Record<string, string> } {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return { body: raw, meta: {} };
  const meta: Record<string, string> = {};
  for (const line of m[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx > 0) meta[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return { body: m[2].trim(), meta };
}

/** Minimal markdown renderer: headings, bold, inline code, fences, lists. */
function renderMarkdown(md: string) {
  const lines = md.split("\n");
  const out: React.ReactNode[] = [];
  let i = 0;
  let key = 0;
  const inline = (text: string): React.ReactNode[] => {
    const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    return parts.map((p, j) => {
      if (p.startsWith("**") && p.endsWith("**"))
        return <strong key={j} className="text-white">{p.slice(2, -2)}</strong>;
      if (p.startsWith("`") && p.endsWith("`"))
        return (
          <code key={j} className="rounded bg-white/10 px-1 py-0.5 font-mono text-[0.85em] text-amber-300">
            {p.slice(1, -1)}
          </code>
        );
      return <span key={j}>{p}</span>;
    });
  };
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("```")) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) buf.push(lines[i++]);
      i++;
      out.push(
        <pre key={key++} className="my-3 overflow-x-auto rounded-lg bg-black/50 p-3 font-mono text-xs text-emerald-200 ring-1 ring-white/10">
          {buf.join("\n")}
        </pre>,
      );
      continue;
    }
    if (line.startsWith("### ")) {
      out.push(<h4 key={key++} className="mb-1 mt-4 text-sm font-bold text-amber-300">{inline(line.slice(4))}</h4>);
    } else if (line.startsWith("## ")) {
      out.push(<h3 key={key++} className="mb-1 mt-5 text-base font-bold text-emerald-300">{inline(line.slice(3))}</h3>);
    } else if (line.startsWith("# ")) {
      out.push(<h2 key={key++} className="mb-2 mt-1 text-xl font-bold text-white">{inline(line.slice(2))}</h2>);
    } else if (/^\s*-\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*-\s/.test(lines[i])) items.push(lines[i].replace(/^\s*-\s/, ""));
      out.push(
        <ul key={key++} className="my-2 list-disc space-y-1 pl-5 text-sm text-white/75">
          {items.map((t, j) => <li key={j}>{inline(t)}</li>)}
        </ul>,
      );
      continue;
    } else if (/^\s*\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s/.test(lines[i])) items.push(lines[i].replace(/^\s*\d+\.\s/, ""));
      out.push(
        <ol key={key++} className="my-2 list-decimal space-y-1 pl-5 text-sm text-white/75">
          {items.map((t, j) => <li key={j}>{inline(t)}</li>)}
        </ol>,
      );
      continue;
    } else if (line.trim() === "") {
      /* skip */
    } else {
      out.push(<p key={key++} className="my-2 text-sm leading-relaxed text-white/75">{inline(line)}</p>);
    }
    i++;
  }
  return out;
}

export default function SkillRouter({ onSaved }: { onSaved: () => void }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [selected, setSelected] = useState<SkillEntry | null>(null);
  const [body, setBody] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SKILLS.filter(
      (s) =>
        (category === "all" || s.category === category) &&
        (!q || s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q) || s.id.includes(q)),
    );
  }, [query, category]);

  const math = useMemo(() => {
    const allTokens = SKILLS.reduce((a, s) => a + s.estTokens, 0);
    const avg = allTokens / SKILLS.length;
    const routerTokens = avg * 2 + 120; // 2 full bodies + router overhead
    return {
      allTokens,
      routerTokens: Math.round(routerTokens),
      saved: Math.round(allTokens - routerTokens),
      frac: (allTokens - routerTokens) / allTokens,
    };
  }, []);

  const openSkill = async (skill: SkillEntry) => {
    setSelected(skill);
    setBody(null);
    setLoading(true);
    try {
      const loader = skillModules[`../data/skills/${skill.id}.md`];
      if (loader) {
        const raw = await loader();
        setBody(parseFrontmatter(raw).body);
      } else {
        setBody(null);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-float-in">
      <SectionHeader
        icon={<Library size={20} />}
        title="Skill Router"
        blurb="A searchable registry of 350 skills. The key insight: you don't load all 350 bodies into context — you load the tiny registry, route to the 2 you need, and load only those."
      />

      <Card className="mb-5 border-emerald-500/25 bg-emerald-500/[0.05]">
        <div className="flex items-center gap-2 text-sm font-semibold text-emerald-300">
          <Zap size={16} />
          The key insight — live math
        </div>
        <p className="mt-2 text-sm leading-relaxed text-white/75">
          Loading all <strong className="text-white">350</strong> skills ={" "}
          <strong className="font-mono text-red-300">~{fmtInt(math.allTokens)} tokens</strong> vs. the
          router loads <strong className="text-white">2</strong> ={" "}
          <strong className="font-mono text-emerald-300">~{fmtInt(math.routerTokens)} tokens</strong>{" "}
          (saves <strong className="font-mono text-amber-300">{fmtPct(math.frac)}</strong>).
        </p>
        <button
          onClick={() => {
            addSaved("router", math.saved);
            onSaved();
          }}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-500/40 transition hover:bg-emerald-500/25"
        >
          <Download size={13} />
          Log scenario savings ({fmtInt(math.saved)} tokens, estimated)
        </button>
        <p className="mt-2 text-[11px] text-white/40">
          Honest note: this is an estimate — 2 average full bodies + ~120 tokens of router overhead.
        </p>
      </Card>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/35" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search skills…"
            className="w-full rounded-xl border border-white/10 bg-black/40 py-2.5 pl-10 pr-10 text-sm text-white/90 outline-none transition focus:border-emerald-500/50"
          />
          {query && (
            <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white">
              <X size={15} />
            </button>
          )}
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white/90 outline-none focus:border-emerald-500/50"
        >
          <option value="all">All categories ({SKILLS.length})</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c} ({SKILLS.filter((s) => s.category === c).length})
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        <div className="max-h-[560px] space-y-2 overflow-y-auto pr-1 lg:col-span-2">
          {filtered.map((s) => (
            <button
              key={s.id}
              onClick={() => openSkill(s)}
              className={`w-full rounded-xl border p-3 text-left transition ${
                selected?.id === s.id
                  ? "border-emerald-500/50 bg-emerald-500/10"
                  : "border-white/10 bg-white/[0.02] hover:border-white/25"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-white">{s.name}</span>
                <Badge tone="neutral">{s.estTokens}t</Badge>
              </div>
              <div className="mt-0.5 text-[11px] uppercase tracking-wider text-emerald-400/70">{s.category}</div>
              <p className="mt-1 line-clamp-2 text-xs text-white/55">{s.description}</p>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="py-8 text-center text-sm text-white/40">No skills match your search.</p>
          )}
        </div>

        <div className="lg:col-span-3">
          <Card className="min-h-[560px]">
            {!selected && (
              <div className="flex h-full min-h-[500px] flex-col items-center justify-center text-center">
                <FileText size={40} className="text-white/15" />
                <p className="mt-4 max-w-sm text-sm text-white/45">
                  Select a skill to preview its body. The 18 curated skills have full bodies; the
                  rest show a lightweight placeholder — exactly how a real router works.
                </p>
              </div>
            )}
            {selected && (
              <div>
                <div className="flex flex-wrap items-start justify-between gap-2 border-b border-white/10 pb-3">
                  <div>
                    <h3 className="text-lg font-bold text-white">{selected.name}</h3>
                    <div className="mt-1 flex items-center gap-2">
                      <Badge tone="emerald">{selected.category}</Badge>
                      <Badge tone="gold">~{selected.estTokens} tokens (registry entry)</Badge>
                    </div>
                  </div>
                  <button onClick={() => { setSelected(null); setBody(null); }} className="text-white/40 hover:text-white">
                    <X size={18} />
                  </button>
                </div>
                <div className="pt-2">
                  {loading && <p className="py-8 text-center text-sm text-white/40">Loading body…</p>}
                  {!loading && body && renderMarkdown(body)}
                  {!loading && !body && (
                    <div className="rounded-xl border border-dashed border-amber-500/30 bg-amber-500/[0.05] p-6 text-center">
                      <p className="text-sm font-semibold text-amber-300">Full body loads on demand</p>
                      <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-white/55">
                        This registry entry costs ~{selected.estTokens} tokens in context. The full
                        skill body is fetched only when the router actually selects it — keeping the
                        other 349 skills out of your context window.
                      </p>
                      <p className="mt-3 font-mono text-[11px] text-white/35">id: {selected.id}.md</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <Stat label="Registry entries" value={fmtInt(SKILLS.length)} />
        <Stat label="Registry total" value={`~${fmtInt(math.allTokens)}`} sub="tokens if all loaded" />
        <Stat label="Router loads" value={`~${fmtInt(math.routerTokens)}`} accent="emerald" sub="2 bodies + overhead" />
      </div>
    </div>
  );
}
