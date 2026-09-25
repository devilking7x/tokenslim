export interface TierPrice {
  id: TierId;
  label: string;
  blurb: string;
  inPer1M: number;
  outPer1M: number;
}

export type TierId = "flagship" | "haiku" | "flash" | "mini" | "nano";

/**
 * Seed table of realistic 2026 cost-per-1M-tokens prices.
 * CLEARLY LABELED "user-editable estimates" — providers change prices,
 * so the UI treats these as editable defaults stored in localStorage.
 */
export const SEED_TIERS: TierPrice[] = [
  {
    id: "flagship",
    label: "Flagship",
    blurb: "Top-tier frontier model (e.g. GPT-5 / Claude Opus-class)",
    inPer1M: 4.0,
    outPer1M: 16.0,
  },
  {
    id: "haiku",
    label: "Haiku-class",
    blurb: "Fast lightweight reasoning tier (e.g. Claude Haiku-class)",
    inPer1M: 0.25,
    outPer1M: 1.25,
  },
  {
    id: "flash",
    label: "Flash-class",
    blurb: "High-throughput budget tier (e.g. Gemini Flash-class)",
    inPer1M: 0.1,
    outPer1M: 0.4,
  },
  {
    id: "mini",
    label: "Mini-class",
    blurb: "Small efficient model (e.g. GPT-mini-class)",
    inPer1M: 0.3,
    outPer1M: 1.2,
  },
  {
    id: "nano",
    label: "Nano-class",
    blurb: "Ultra-cheap distilled tier (e.g. GPT-nano-class)",
    inPer1M: 0.05,
    outPer1M: 0.2,
  },
];

const PRICING_KEY = "tokenslim_pricing";

export function loadTiers(): TierPrice[] {
  try {
    const raw = localStorage.getItem(PRICING_KEY);
    if (!raw) return SEED_TIERS.map((t) => ({ ...t }));
    const parsed = JSON.parse(raw) as TierPrice[];
    const byId = new Map(parsed.map((t) => [t.id, t]));
    return SEED_TIERS.map((seed) => ({ ...seed, ...(byId.get(seed.id) ?? {}) }));
  } catch {
    return SEED_TIERS.map((t) => ({ ...t }));
  }
}

export function saveTiers(tiers: TierPrice[]): void {
  try {
    localStorage.setItem(PRICING_KEY, JSON.stringify(tiers));
  } catch {
    /* storage full or unavailable — ignore */
  }
}

export function resetTiers(): void {
  try {
    localStorage.removeItem(PRICING_KEY);
  } catch {
    /* ignore */
  }
}

export function tierById(tiers: TierPrice[], id: TierId): TierPrice {
  const found = tiers.find((t) => t.id === id);
  if (!found) throw new Error(`Unknown tier: ${id}`);
  return found;
}
