# Glimpse — Interaction Blueprint

## Architecture: The Three States

```
DORMANT ──────────────► OBSERVING ──────────────► FLAGGING
  ●                    ● 12m · 5/8               card expands
   ^                                               │
   │         (10 min no flags)                     │
   └───────────────────────────────────────────────┘
                   (collapses back)
```

**Dormant:** Amber dot only. Glimpse is present, silent. Default state.
**Observing:** Dot + one-line summary. "I'm paying attention, nothing to report."
**Flagging:** Card expands conversationally. Glimpse has something to say.

---

## Interaction 1: First Install — Hello

**When:** Extension loads for the very first time on chatgpt.com.

**What the user sees:**

The amber dot appears. After 3 seconds, it gently pulses once, then the card expands briefly:

> ● Glimpse  
> I'll keep an eye on things while you chat.  
> If I notice something, I'll let you know. Otherwise I'll stay out of your way.  
> — *collapses to dot after 5 seconds*

No settings. No tour. No "accept terms." Just presence and a promise.

---

## Interaction 2: Session Start — The Dot

**When:** User navigates to chatgpt.com. Conversation begins with first message.

**What the user sees:**

The amber dot is in the bottom-right corner. That's it. If the user hovers over it, it shows:

> ● Glimpse

On click (not hover — too intrusive), the card opens to observing state.

---

## Interaction 3: First Exchange — Transition to Observing

**When:** The first user message + AI reply pair is detected.

**What the user sees:**

The dot expands slightly to show a one-line summary. This happens automatically — no user action needed.

> ● 1m · 1/1 · GPT-5

After 15 seconds of no interaction with Glimpse, it shrinks back to just the dot. The summary is available on demand — hover or click.

---

## Interaction 4: Positive Observation — "Nice Stretch of Road"

**When:** 10 messages exchanged, and no flags have triggered yet. Glimpse notices the user is leading well.

**What the user sees:**

The card expands gently:

> ● Glimpse  
> You've been leading this conversation well — clear questions, good pace.  
> — *collapses to dot after 8 seconds*

This happens once per session, around message 10. It's not "stats." It's a passenger saying "nice driving."

**Design note:** This positive beat is critical. Without it, Glimpse only speaks up for problems. That's not a passenger; that's a backseat driver. The positive observation establishes that Glimpse notices the good stuff too.

---

## Interaction 5: Offloading Flag

**When:** 3+ short-ask/long-reply pairs detected. User messages < 200 chars, AI replies > 400 chars. Pattern repeated.

**What the user sees:**

The card expands conversationally. Glimpse's voice — informed, warm, not lecturing.

**Message A (default):**

> ● Glimpse  
> You've sent a few short messages and the AI is writing long replies each time. This is called *cognitive offloading* — when we delegate thinking instead of collaborating.
>
> Totally normal, and sometimes exactly what you want. But if you're doing it without noticing, you're letting the car steer.
>
> Try making your next question more detailed. Lead with your own thoughts first, then ask.

**Message B (variant — for alternate sessions):**

> ● Glimpse  
> Quick asks, long answers. Feels efficient, right? But there's a pattern here — the AI is doing the heavy thinking while you're in receive mode.
>
> This happens to everyone. The fix isn't to stop — it's to notice and choose. Your next message could lead instead of follow.
>
> Want to try framing the question differently this time?

**After the flag:**
- Card stays expanded for 12 seconds, then returns to observing state.
- Offloading won't be flagged again this session.
- If the user clicks the card while it's open, it stays open until manually collapsed.

---

## Interaction 6: Rapid-Fire Flag

**When:** 3+ user messages sent within 60 seconds of each other.

**What the user sees:**

**Message A (default):**

> ● Glimpse  
> Quick back-and-forth — 3 messages in under a minute. Fast exchanges can feel productive, but research suggests a pause between replies leads to sharper questions and less impulsivity.
>
> Your second thought is usually better than your first. Take a breath between messages — the AI will wait.

**Message B (variant):**

> ● Glimpse  
> You're firing off questions fast. It's easy to do — the text box is right there, the AI responds instantly. But fast exchanges often mean reactive thinking instead of deliberate thinking.
>
> Try pausing before your next message. Even 10 seconds. See if what you want to ask changes.

---

## Interaction 7: Long Session Flag

**When:** Session exceeds 30 minutes, then again at 60 minutes.

**What the user sees:**

**At 30 minutes:**

> ● Glimpse  
> 30 minutes. Your brain processes information differently after extended focus — creativity dips, confirmation bias rises. This isn't you; it's biology.
>
> A quick stretch or a glass of water. Glimpse will still be here.

**At 60 minutes:**

> ● Glimpse  
> One hour. That's a long drive.
>
> Seriously — your brain needs a reset. Even 5 minutes away from the screen makes a difference. The conversation will still be here.

---

## Interaction 8: High AI Ratio Flag

**When:** AI messages outnumber user messages by 2:1 or more (e.g., 4 user, 9 AI).

**What the user sees:**

> ● Glimpse  
> The AI is talking a lot more than you are — you're consuming more than you're directing.
>
> You're the one with taste and judgment here. The AI is a tool; you're the craftsperson. Try asking a question that makes the AI work for *your* approval, not the other way around.

---

## Interaction 9: Flag Suppression — "You Heard Me"

**When:** A flag type has already been shown this session and would trigger again.

**What happens:** Nothing. Glimpse stays quiet. It already said it. It trusts you.

---

## Interaction 10: Manual Check-In

**When:** User clicks the dot or the one-line summary at any time.

**What the user sees:** Observing state card with current metrics.

> ● Glimpse  
> Session 18m · 6/9 · GPT-5  
> Offloading ×2 (not yet flagged)  
> Rapid fire — none

If no flags are active, the tone is neutral. If a flag is building but hasn't hit threshold yet, Glimpse shows the numbers without the conversation expansion — "just letting you know, not worried yet."

---

## Interaction 11: Expand for Context

**When:** User clicks the ▸ arrow in the observing card.

**What the user sees:** The card widens with explanations under each metric (the current "expand" behavior, but rewritten in Glimpse's voice).

> ● Glimpse  
> Session 18m — How long you've been here. Longer sessions can shift how you think.  
> Messages 6/9 — You vs the AI. You're the director here.  
> Model GPT-5 — Different models have different capabilities and costs.  
> Offloading ×2 — Short asks, long answers. Not a problem at 2. I'll mention it if it hits 3.

---

## Interaction 12: Session Close — The Debrief

**When:** User navigates away, closes the tab, or a new conversation starts on chatgpt.com.

**What the user sees:**

The card expands one final time. Glimpse's voice — reflective, not evaluative.

**Example 1 (clean session):**

> ● Glimpse  
> You spent 22 minutes here. You led well — the AI followed your direction.  
> Good drive.

**Example 2 (offloading detected but resolved):**

> ● Glimpse  
> 35 minutes. A stretch in the middle where the AI did the heavy lifting — you noticed and pulled it back.  
> That's the whole point. Good drive.

**Example 3 (heavy offloading, long session):**

> ● Glimpse  
> 52 minutes. The AI carried a lot of the thinking today — 5 offloading stretches. No judgment. Just something to notice for next time.  
> The awareness is the win. See you next drive.

The debrief appears for 10 seconds, then the card fades to just the dot. Then gone.

---

## Interaction 13: Dismissal

**When:** User clicks the `−` minimize button or drags the card off-screen.

**What happens:** Glimpse minimizes to the dot. It doesn't take it personally.

---

## Timing & Cadence

| Event | Timing |
|-------|--------|
| Hello (first install) | Once, first session ever |
| Dot → observing | Automatic after first AI reply |
| Positive observation | Around message 10, once per session |
| Any flag | When threshold hit, max once per type per session |
| Flag display duration | 12 seconds then auto-collapse to observing |
| Session close debrief | On tab close / navigation away |
| Debrief display duration | 10 seconds then fade |

---

## What Glimpse Never Does

- Explains itself more than once ("hello" is once ever, not once per session)
- Uses exclamation marks
- Says "don't worry" or "it's okay" — that's reassurance-seeking, not agency-building
- References itself in third person ("Glimpse thinks...") — it speaks directly
- Interrupts mid-message — flags only appear between exchanges
- Uses the word "should"
- Explains what the dot is more than once
