# Glimpse — UX & Narrative Plan

## The Metaphor

> **You** are the driver.  
> **The AI chat** is the car — the machine you operate, the thing responding to your inputs.  
> **Glimpse** is the nerdy, well-read passenger in the seat beside you.

Glimpse doesn't drive. Glimpse doesn't grab the wheel. Glimpse glances out the window, notices things you're too focused to see, and occasionally says something worth hearing. Then goes quiet again.

## The Persona

Glimpse is THAT friend. The one who:

- Read the EFF's latest post and can summarize it in two sentences
- Knows what "enshittification" means and when it's happening
- Switched to Signal in 2016 and is still gently working on you
- Cites actual studies but never sounds like a lecture
- Gets genuinely excited when you notice a pattern yourself
- Trusts your judgment — if you ignore a flag, they let it go

Glimpse is informed, slightly nerdy, evidence-aware, and deeply cares about your digital agency. Not a coach. Not a therapist. A well-read passenger who happens to know a lot about how AI shapes thinking.

## Voice Principles

| Principle | Meaning |
|-----------|---------|
| **Suggests, never commands** | "You might want to..." never "You should..." |
| **Evidence-backed warmth** | "There's a pattern called cognitive offloading — it happens when..." — cites the concept, not just the number |
| **Positive first** | Before flagging anything, Glimpse notices what's going well. |
| **One per session** | Never flags the same thing twice. Said it, you heard it. |
| **Trusts the driver** | If you ignore a flag, Glimpse quiets down. No nagging. |
| **Brief by default** | A dot is enough. Words are for when words matter. |

## UX States

### 1. Dormant
**What the user sees:** A tiny amber dot in the bottom-right corner. That's it.

Glimpse is present but silent. Most of the time, this is all you see.

### 2. Observing
**What the user sees:** Dot + one-line summary on hover or after first message exchange.

```
● 12m · 5/8 · GPT-5
```

No judgment. Just letting you know it's paying attention.

### 3. Flagging
**What the user sees:** The card expands conversationally. Three parts:

1. **What's happening** — the pattern, framed as an observation
2. **Why it matters** — the concept behind it, in Glimpse's voice
3. **What you can do** — a gentle, actionable nudge

Example flags:

**Offloading detected:**

> You've sent 4 short messages and the AI is writing long replies each time. This is called *cognitive offloading* — when we delegate thinking instead of collaborating. Totally normal, and sometimes exactly what you want. But if you're doing it without noticing, you're letting the car steer.
>
> Try leading the next question yourself — more detail, more direction.

**Rapid-fire detected:**

> Fast back-and-forth — 3+ messages in under a minute. Quick exchanges can feel productive, but [research shows](https://example.com) a pause between replies leads to sharper questions and less impulsivity.
>
> Breathe between messages. Your second thought is usually better than your first.

**Long session detected:**

> You've been here 45 minutes. Your brain processes information differently after extended focus — creativity dips, confirmation bias rises. This isn't you; it's biology.
>
> A 5-minute stretch or walk brings fresh perspective. Glimpse will still be here.

**High AI ratio detected:**

> The AI is talking a lot more than you are — you're consuming more than directing. You're the one with taste and judgment here. The AI is a tool; you're the craftsperson.
>
> Try asking a question that makes the AI work for *your* approval, not the other way around.

### 4. Session Close
**What the user sees:** When the conversation ends or switches, a quiet summary.

> You spent 25 minutes here. You led most of the conversation — the AI followed your direction well. One offloading stretch in the middle, but you pulled it back.

No scores. No grades. Just Glimpse recapping what it saw, like a passenger saying "good drive" as they get out.

## Technical Triggers → Conversation Mapping

| Metric | Threshold | Flag (Glimpse's words) |
|--------|-----------|------------------------|
| Offloading | 3+ short-ask/long-reply pairs | "The AI is doing the heavy thinking..." |
| Rapid fire | 3 user messages < 60s | "Quick replies — a pause sharpens questions..." |
| Session time | > 30 min, then > 60 min | "30 minutes. Your brain deserves a reset..." |
| AI ratio | AI msgs > 2× user msgs | "You're consuming more than directing..." |

Only the first occurrence of each pattern triggers a flag per session.

## What Glimpse Never Does

- ❌ Claims to know what you're thinking about
- ❌ Reads or analyzes the content of messages
- ❌ Sends data anywhere — zero network
- ❌ Uses another AI to "watch" the AI
- ❌ Judges you — it reflects, it doesn't grade
- ❌ Nags — one flag per topic, then it trusts you
- ❌ Blocks or modifies AI behavior — it is a mirror, not a muzzle

## Design Language

- **Color:** Amber (`#f7b955`) — warm, alert without alarm, distinct from ChatGPT's UI
- **Shape:** Rounded card with a dot origin — grows from the dot, returns to the dot
- **Motion:** Expand from dot, collapse to dot. Subtle. Nothing bouncy or attention-seeking.
- **Sound:** None. Glimpse is silent unless you choose otherwise.
- **Typography:** System font stack. Glimpse doesn't need its own font; it's part of your environment.

## Implementation Phases

### Phase 1 — Persona & Language (do first)
- Replace all current labels/alert text with Glimpse-voiced conversation strings
- Implement "positive first" logic (one positive observation per session)
- Implement "one flag per topic per session" logic
- Session-close summary with Glimpse voice

### Phase 2 — Dormant → Observing → Flagging transitions
- Default state: amber dot only (no card)
- First message exchange: card appears with one-line summary
- Pattern detected: card expands conversationally
- After flagging: card returns to observing state
- 10 minutes of no flags: card shrinks to dot

### Phase 3 — Content strategy & polish
- Write 3+ variant messages per flag type (avoid repetition across sessions)
- Add "nice stretch of road" positive observations (e.g., "You've been leading well this session")
- Test voice consistency — does every string sound like Glimpse?
