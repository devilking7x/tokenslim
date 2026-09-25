import { useState } from "react";
import {
  Scissors,
  Library,
  Layers,
  Brain,
  Database,
  Wallet,
  LayoutDashboard,
  Leaf,
  Github,
} from "lucide-react";
import { getTotalSaved } from "./lib/storage";
import { fmtInt } from "./lib/format";
import { cn } from "./components/cn";
import Optimizer from "./components/Optimizer";
import SkillRouter from "./components/SkillRouter";
import ModelCascade from "./components/ModelCascade";
import ThinkingBudget from "./components/ThinkingBudget";
import SemanticCache from "./components/SemanticCache";
import BudgetPlanner from "./components/BudgetPlanner";
import Dashboard from "./components/Dashboard";

const TABS = [
  { id: "optimizer", label: "Optimizer", icon: Scissors },
  { id: "router", label: "Skill Router", icon: Library },
  { id: "cascade", label: "Cascade", icon: Layers },
  { id: "thinking", label: "Thinking", icon: Brain },
  { id: "cache", label: "Cache", icon: Database },
  { id: "planner", label: "Planner", icon: Wallet },
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function App() {
  const [tab, setTab] = useState<TabId>("optimizer");
  const [total, setTotal] = useState(() => getTotalSaved());

  const refreshTotal = () => setTotal(getTotalSaved());

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#060a08]/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <button onClick={() => setTab("optimizer")} className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-black shadow-[0_0_24px_rgba(16,185,129,0.4)]">
              <Leaf size={20} strokeWidth={2.5} />
            </span>
            <span className="text-lg font-bold tracking-tight">
              Token<span className="text-emerald-400">Slim</span>
            </span>
          </button>
          <div className="flex items-center gap-3">
            <div className="hidden rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs sm:block">
              <span className="text-white/55">saved: </span>
              <span className="font-mono font-bold text-emerald-300">{fmtInt(total)}</span>
              <span className="text-white/55"> tokens</span>
            </div>
            <a
              href="https://github.com/devilking7x/tokenslim"
              target="_blank"
              rel="noreferrer"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 text-white/60 transition hover:border-white/30 hover:text-white"
              aria-label="GitHub repository"
            >
              <Github size={17} />
            </a>
          </div>
        </div>
        {/* Tab nav */}
        <nav className="mx-auto max-w-6xl px-4 pb-3">
          <div className="flex gap-1.5 overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium transition",
                  tab === t.id
                    ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/50"
                    : "text-white/55 hover:bg-white/5 hover:text-white",
                )}
              >
                <t.icon size={15} />
                {t.label}
              </button>
            ))}
          </div>
        </nav>
      </header>

      {/* Hero */}
      {tab === "optimizer" && (
        <div className="bg-grid relative overflow-hidden">
          <div className="mx-auto max-w-6xl px-4 pb-2 pt-10 text-center sm:pt-14">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs font-medium text-amber-300">
              100% client-side · real token counting · no data leaves your browser
            </div>
            <h1 className="mx-auto max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
              Trim AI costs{" "}
              <span className="bg-gradient-to-r from-emerald-400 to-amber-300 bg-clip-text text-transparent">
                without trimming quality
              </span>
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-white/60 sm:text-base">
              TokenSlim is a seven-tool workbench for cutting LLM spend: compress prompts, route
              skills without flooding context, cascade models by difficulty, budget reasoning
              tokens, cache semantically, and plan spend — with every saving tracked.
            </p>
          </div>
        </div>
      )}

      {/* Content */}
      <main className="mx-auto max-w-6xl px-4 py-8">
        {tab === "optimizer" && <Optimizer onSaved={refreshTotal} />}
        {tab === "router" && <SkillRouter onSaved={refreshTotal} />}
        {tab === "cascade" && <ModelCascade onSaved={refreshTotal} />}
        {tab === "thinking" && <ThinkingBudget onSaved={refreshTotal} />}
        {tab === "cache" && <SemanticCache onSaved={refreshTotal} />}
        {tab === "planner" && <BudgetPlanner onSaved={refreshTotal} />}
        {tab === "dashboard" && <Dashboard onSaved={refreshTotal} />}
      </main>

      <footer className="border-t border-white/10 py-8">
        <div className="mx-auto max-w-6xl px-4 text-center text-xs text-white/35">
          <p>
            TokenSlim · token estimates via BPE counting · cost figures are user-editable estimates,
            not provider quotes
          </p>
          <p className="mt-1">MIT License · built client-side, localStorage only</p>
        </div>
      </footer>
    </div>
  );
}
