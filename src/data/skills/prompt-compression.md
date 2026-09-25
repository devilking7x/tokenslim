---
id: prompt-compression
name: Prompt Compression for TokenSlim
category: ai-agents
estTokens: 3100
---

TokenSlim's core skill: shrink prompts without losing task performance. These are the field-tested techniques the router itself uses.

## The compression stack (apply in order)

### 1. Strip the obvious (20–40% savings, zero risk)

- Delete: greetings, apologies, "I hope this helps", "As an AI", "Certainly!", sign-offs, repeated acknowledgments.
- Delete restated context: if the conversation already contains the schema, don't paste it again — reference it ("per the schema above").
- Collapse whitespace: single spaces, no blank-line runs, no decorative ASCII dividers or emoji bullets in machine-read prompts.

### 2. Structural compression (30–60% savings)

- **Tables > prose.** Any list of attributes, mappings, or comparisons becomes a markdown table.
- **Schemas > examples.** One JSON schema replaces three example objects. One regex replaces a paragraph of format rules.
- **Bullets > sentences.** Imperative fragments: "Validate email format" not "You should make sure that the email address is in a valid format."
- **Reference > repeat.** "Follow skill `api-design` §Errors" instead of re-pasting the error envelope.
- **Negative constraints last, compressed:** "Don't: localStorage, alg:none, custom crypto" — a don't-list, not paragraphs.

### 3. Semantic compression (use with care)

- Drop politeness grammar: "Please" and "could you" carry zero bits for instruction-following models.
- Merge redundant instructions: "Be concise" + "avoid verbosity" + "keep it short" = "Be concise."
- Prefer the model's latent knowledge: don't explain what a JWT is to a model that knows; specify only YOUR constraints (lifetimes, algorithms, storage).
- Remove few-shot examples that duplicate what the instruction already says. Keep 1 example per genuinely ambiguous format, zero otherwise.

### 4. Tokenizer-aware tricks

- Common words are cheap; rare words and exotic unicode are expensive. "Use" beats "utilize".
- JSON with short keys is cheaper than pretty-printed XML for the same data.
- Avoid repeating long identifiers: define once (`API = https://...`), then use the alias.
- Numbers and code compress well; natural-language restatements of code do not — never explain code in prose right after showing it.

## Before / after

Before (~90 tokens):
> "Hi! I need your help with something. Could you please write a function for me? What I want is a function that takes a list of user objects, where each user object has an id, a name, and an email field, and returns only the users whose email ends with @example.com. Please make sure the code is clean and well-written. Thanks so much!"

After (~25 tokens):
> "Write `filterExampleUsers(users: User[]): User[]` — keep users with email ending `@example.com`. Type: `{id: string; name: string; email: string}`."

## What NOT to compress

- Safety constraints, exact formats (regexes, schemas), and numeric thresholds: keep verbatim.
- The actual task requirements: compress the wrapping, never the spec.
- Ambiguity is the enemy: if removing a sentence creates two readings, keep the sentence.
- Legal/compliance text: out of scope for compression entirely.

## Verification loop

1. Compress. 2. Run the task on 3–5 representative inputs. 3. Diff outputs vs. uncompressed baseline. 4. If behavior drifts, restore the smallest removed fragment that fixes it.
- Track compression ratio (tokens_before / tokens_after) and task success rate. A 3x compression at 98% success beats 5x at 85%.

## Don'ts

- Don't summarize code into prose and delete the code. Don't compress away the definition of "done" (acceptance criteria stay explicit). Don't optimize prompts nobody sends twice — compression pays off on repeated/system prompts, not one-offs.

## Compression budgets by prompt type

| Prompt type | Target ratio | Technique priority |
|---|---|---|
| System prompt (sent every call) | 3–5x | Structure first, then semantic; verify heavily |
| Skill/router body (retrieved on demand) | 2–3x | Structure; keep all code examples intact |
| One-off user request rewrite | 1.5–2x | Strip obvious only — not worth deep work |
| Few-shot examples block | 2–4x | Cut redundant examples, keep edge cases |

## The 5-minute compression pass (checklist)

1. Delete openers/closers/thanks/apologies.
2. Sentences → imperative bullets.
3. Attribute lists → tables.
4. Repeated examples → one schema or one example.
5. Restated context → back-reference ("as defined above").
6. Triple-stated constraints → one statement.
7. Prose explanation of adjacent code → delete the prose.
8. Measure tokens before/after; run the 3-case verification.

## Tokenizer quick reference

- ~4 chars ≈ 1 token for English prose; code is denser (~3 chars/token for symbols-heavy code).
- A 500-word system prompt ≈ 650–750 tokens. At 1M calls/day, every 100 tokens saved = 100M tokens/day.
- Measure with the actual model's tokenizer (tiktoken for OpenAI-compatible), not character estimates, before reporting savings.
