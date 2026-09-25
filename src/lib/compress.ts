/**
 * Rule-based prompt compressor: strips filler phrases, collapses whitespace,
 * dedupes repeated sentences, and converts verbose requests into tight
 * imperative bullets. Fully deterministic, runs locally.
 */

const FILLER_PATTERNS: [RegExp, string][] = [
  // greetings / pleasantries
  [/\b(hello|hi|hey)( there)?\b[.!]?/gi, ""],
  [/\bi hope you('re| are) (doing )?well( today)?\b[^.!?]*[.!?]?/gi, ""],
  [/\bgood (morning|afternoon|evening)\b[.!]?/gi, ""],
  // courtesy fillers
  [/\bcould you (kindly|please)?\s*/gi, ""],
  [/\bcan you (please|kindly)?\s*/gi, ""],
  [/\bwould you (kindly|please)?\s*/gi, ""],
  [/\bplease\b/gi, ""],
  [/\bkindly\b/gi, ""],
  [/\bthank(s| you| you so much| you very much)\b[^.!?]*[.!?]?/gi, ""],
  [/\bi('d| would) be (really |very )?grateful\b[^.!?]*[.!?]?/gi, ""],
  // hedging / meta commentary
  [/\bas an ai( language model)?\b[^.!?]*[.!?]?/gi, ""],
  [/\bi hope this helps\b[^.!?]*[.!?]?/gi, ""],
  [/\bi('m| am) happy to help\b[^.!?]*[.!?]?/gi, ""],
  [/\bi('d| would) be happy to\b[^.!?]*[.!?]?/gi, ""],
  [/\bfeel free to\b[^.!?]*[.!?]?/gi, ""],
  [/\blet me know if (you|there)\b[^.!?]*[.!?]?/gi, ""],
  [/\bplease (note|keep in mind|be aware) that\b/gi, ""],
  [/\bit('s| is) (important|worth|good) to (note|mention|keep in mind) that\b/gi, ""],
  [/\bsorry (for|about)\b[^.!?]*[.!?]?/gi, ""],
  [/\bof course,?\b/gi, ""],
  [/\bcertainly,?\b/gi, ""],
  [/\bsure thing[.,]?/gi, ""],
  [/\bhere('s| is) (what|how|a)\b[^.!?]*:/gi, ""],
  // soft openers → imperative
  [/\bwhat i want you to do is\b/gi, ""],
  [/\bi want you to\b/gi, ""],
  [/\bsimply put,?\s*/gi, ""],
  [/\bi('d| would) like you to\b/gi, ""],
  [/\bi( also)? need you to\b/gi, ""],
  [/\bi was wondering if you could\b/gi, ""],
  [/\bi('m| am) (just |)wondering\b/gi, ""],
  [/\bdo you think you could\b/gi, ""],
];

const WEAK_SENTENCE_STARTS: RegExp[] = [
  /^(so|well|basically|actually|essentially|simply|just|really|okay|ok)\b,?\s+/i,
  /^sure[.,]?\s+/i,
];

export interface CompressResult {
  output: string;
  rulesApplied: string[];
  sentencesBefore: number;
  sentencesAfter: number;
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function normalizeSentence(s: string): string {
  let out = s;
  for (const [re] of FILLER_PATTERNS) {
    const before = out;
    out = out.replace(re, " ");
    if (before !== out) out = out.replace(/\s+/g, " ");
  }
  out = out.replace(/\s+/g, " ").trim();
  // strip leading stray punctuation left by removals
  out = out.replace(/^[,;:\s]+/, "");
  // strip weak openers repeatedly (e.g. "Okay so, basically ...")
  let prev: string;
  do {
    prev = out;
    for (const re of WEAK_SENTENCE_STARTS) {
      out = out.replace(re, "");
    }
  } while (out !== prev);
  // drop trailing polite tail and stray punctuation
  out = out.replace(/,?\s*(please|thanks|thank you)[.!?]?$/i, "");
  out = out.replace(/[,;:\s]+$/, "");
  out = out.trim();
  return out;
}

function toImperative(s: string): string {
  // "Can you write a test" → "Write a test" (most fillers already stripped)
  let out = s
    .replace(/^you should\s+/i, "")
    .replace(/^make sure to\s+/i, "")
    .replace(/^it would be great if you could\s+/i, "");
  return out.trim();
}

export function compressPrompt(input: string): CompressResult {
  const rulesApplied: string[] = [];
  const collapsed = input.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  if (collapsed !== input) rulesApplied.push("Collapsed redundant whitespace");
  if (!collapsed) {
    return { output: "", rulesApplied, sentencesBefore: 0, sentencesAfter: 0 };
  }

  const rawSentences = splitSentences(collapsed);
  const beforeCount = rawSentences.length;

  // 1. strip filler per sentence
  let sentences = rawSentences.map((s) => normalizeSentence(s)).filter((s) => s.length > 0);
  if (sentences.length !== beforeCount) rulesApplied.push("Removed filler-only sentences");

  // 2. dedupe repeated sentences (case-insensitive)
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const s of sentences) {
    const key = s.toLowerCase().replace(/[^a-z0-9 ]/g, "");
    if (key.length < 8 || !seen.has(key)) {
      deduped.push(s);
      seen.add(key);
    }
  }
  if (deduped.length !== sentences.length) {
    rulesApplied.push(`Removed ${sentences.length - deduped.length} repeated sentence(s)`);
    sentences = deduped;
  }

  // 3. imperative bullets
  const bullets = sentences.map((s) => {
    let out = toImperative(s);
    // capitalize first letter
    out = out.charAt(0).toUpperCase() + out.slice(1);
    // ensure terminal punctuation is minimal (strip trailing space first)
    out = out.replace(/[\s.,!?;:]+$/, "");
    return `- ${out}`;
  });

  if (rulesApplied.length === 0) rulesApplied.push("Normalized to imperative bullets");
  else if (!rulesApplied.some((r) => r.includes("bullets"))) {
    rulesApplied.push("Converted to imperative bullets");
  }

  return {
    output: bullets.join("\n"),
    rulesApplied,
    sentencesBefore: beforeCount,
    sentencesAfter: bullets.length,
  };
}

export interface DiffToken {
  text: string;
  removed: boolean;
}

/**
 * Simple word-level diff: walks the original words and marks any word whose
 * occurrence count isn't consumed by the compressed version as "removed".
 */
export function diffWords(before: string, after: string): DiffToken[] {
  const beforeWords = before.split(/\s+/).filter(Boolean);
  const afterCounts = new Map<string, number>();
  for (const w of after.split(/\s+/).filter(Boolean)) {
    const k = w.toLowerCase();
    afterCounts.set(k, (afterCounts.get(k) ?? 0) + 1);
  }
  return beforeWords.map((w) => {
    const k = w.toLowerCase();
    const remaining = afterCounts.get(k) ?? 0;
    if (remaining > 0) {
      afterCounts.set(k, remaining - 1);
      return { text: w, removed: false };
    }
    return { text: w, removed: true };
  });
}

export const SAMPLE_PROMPTS: { title: string; body: string }[] = [
  {
    title: "Polite API request",
    body: `Hello there! I hope you're doing well today. I was wondering if you could kindly help me with something, please. Basically, I need you to write a simple REST API endpoint using Node.js and Express. It would be great if you could make it return JSON. Could you please also add some basic error handling? I would be really grateful for your help. Thank you so much for your time! I hope this helps.`,
  },
  {
    title: "Hedged code review",
    body: `Hi! Could you please take a look at this code for me, please? I just wanted to ask if you could kindly review my React component. It's important to note that I'm not sure if it's fully correct. As an AI language model, please note that I value your feedback. I want you to check for bugs. I want you to check for bugs. Please let me know if there are any issues. Feel free to suggest improvements. Sorry for the trouble, and thanks again!`,
  },
  {
    title: "Rambling data task",
    body: `Okay so, I basically need some help with a data task. Could you kindly write a Python script for me, please? What I want you to do is read a CSV file. Actually, I also need you to filter out the rows where the status is inactive. Simply put, just keep the active ones. It would be great if you could save the result to a new file. Please make sure to handle missing values. Of course, please add comments to the code. Thank you very much!`,
  },
];
