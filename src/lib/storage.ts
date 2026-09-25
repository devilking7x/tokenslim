/**
 * Shared localStorage helpers for TokenSlim savings tracking.
 *
 * - tokenslim_total_saved: cumulative tokens saved (number)
 * - tokenslim_feature_savings: per-feature savings { [feature]: tokens }
 * - tokenslim_activity: daily savings log [{ date: "YYYY-MM-DD", tokens }]
 */

export type FeatureKey =
  | "optimizer"
  | "router"
  | "cascade"
  | "thinking"
  | "cache"
  | "planner";

export const FEATURE_LABELS: Record<FeatureKey, string> = {
  optimizer: "Prompt Optimizer",
  router: "Skill Router",
  cascade: "Model Cascade",
  thinking: "Thinking Budget",
  cache: "Semantic Cache",
  planner: "Budget Planner",
};

const TOTAL_KEY = "tokenslim_total_saved";
const FEATURE_KEY = "tokenslim_feature_savings";
const ACTIVITY_KEY = "tokenslim_activity";

interface ActivityEntry {
  date: string;
  tokens: number;
}

function todayISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function getTotalSaved(): number {
  try {
    return Number(localStorage.getItem(TOTAL_KEY) ?? 0) || 0;
  } catch {
    return 0;
  }
}

export function getFeatureSavings(): Record<FeatureKey, number> {
  const zero = {
    optimizer: 0,
    router: 0,
    cascade: 0,
    thinking: 0,
    cache: 0,
    planner: 0,
  } as Record<FeatureKey, number>;
  try {
    const raw = localStorage.getItem(FEATURE_KEY);
    if (!raw) return zero;
    return { ...zero, ...(JSON.parse(raw) as Partial<Record<FeatureKey, number>>) };
  } catch {
    return zero;
  }
}

/** Add saved tokens to the cumulative counter and per-feature tally. */
export function addSaved(feature: FeatureKey, tokens: number): void {
  if (!Number.isFinite(tokens) || tokens <= 0) return;
  const n = Math.round(tokens);
  try {
    localStorage.setItem(TOTAL_KEY, String(getTotalSaved() + n));
    const feat = getFeatureSavings();
    feat[feature] = (feat[feature] ?? 0) + n;
    localStorage.setItem(FEATURE_KEY, JSON.stringify(feat));
    const log = getActivity();
    const today = todayISO();
    const existing = log.find((e) => e.date === today);
    if (existing) {
      existing.tokens += n;
    } else {
      log.push({ date: today, tokens: n });
    }
    localStorage.setItem(ACTIVITY_KEY, JSON.stringify(log.slice(-60)));
  } catch {
    /* ignore */
  }
}

export function getActivity(): ActivityEntry[] {
  try {
    const raw = localStorage.getItem(ACTIVITY_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ActivityEntry[];
  } catch {
    return [];
  }
}

/** Last 7 days (including today) of saved tokens, oldest → newest. */
export function getWeeklyActivity(): { label: string; tokens: number }[] {
  const log = new Map(getActivity().map((e) => [e.date, e.tokens]));
  const out: { label: string; tokens: number }[] = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const pad = (n: number) => String(n).padStart(2, "0");
    const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const weekday = d.toLocaleDateString("en-US", { weekday: "short" });
    out.push({ label: i === 0 ? "Today" : weekday, tokens: log.get(iso) ?? 0 });
  }
  return out;
}

export function resetSavings(): void {
  try {
    localStorage.removeItem(TOTAL_KEY);
    localStorage.removeItem(FEATURE_KEY);
    localStorage.removeItem(ACTIVITY_KEY);
  } catch {
    /* ignore */
  }
}
