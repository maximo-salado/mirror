# Mirror — AI Interaction Awareness Browser Extension

## Development Plan v1.0

**Project:** AI Interaction Awareness Browser Extension
**Codename:** Mirror
**MVP Scope:** Local-only, zero-network, heuristic-based awareness overlay for ChatGPT
**Philosophy:** Make invisible patterns visible. Mirror, not muzzle. No AI reading AI.

---

## Architecture Overview

```
mirror/
├── manifest.json          # Chrome extension manifest (v3)
├── content.js             # DOM watcher + heuristic engine + overlay UI
├── content.css            # Styles for the floating badge
├── popup.html             # Options / settings popup
├── popup.js               # Popup logic
├── storage.js             # chrome.storage.local data layer
├── icons/                 # Extension icons (generated SVG → PNG)
│   ├── icon-16.png
│   ├── icon-48.png
│   └── icon-128.png
└── README.md              # Open source documentation
```

Data flow:

```
ChatGPT DOM ──→ content.js (MutationObserver) ──→ heuristic engine
                                                      │
                                                      ▼
                                              session store (chrome.storage.local)
                                                      │
                                                      ▼
                                              overlay.js ──→ floating badge
                                              popup.js  ──→ options page
```

---

## Phase 1: Project Scaffold

### 1.1 Create project directory
```
~/Documents/ai-monitor-browser-plugin/mirror/
```

### 1.2 manifest.json (v3)
```json
{
  "manifest_version": 3,
  "name": "Mirror",
  "version": "0.1.0",
  "description": "See how you interact with AI. Local-only awareness overlay.",
  "permissions": ["storage"],
  "host_permissions": [],
  "content_scripts": [{
    "matches": ["https://chatgpt.com/*"],
    "js": ["storage.js", "content.js"],
    "css": ["content.css"],
    "run_at": "document_idle"
  }],
  "action": {
    "default_popup": "popup.html",
    "default_title": "Mirror"
  },
  "icons": {
    "16": "icons/icon-16.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  }
}
```

**Critical:**
- `permissions: ["storage"]` — only chrome.storage.local
- `host_permissions: []` — zero network access
- `matches: ["https://chatgpt.com/*"]` — scoped to ChatGPT only (MVP)

---

## Phase 2: DOM Observer (content.js)

### 2.1 Detect conversation turns

ChatGPT DOM structure (verified from live page):

```
<section data-testid="conversation-turn-{N}" data-turn="{user|assistant}">
  <div data-message-author-role="{user|assistant}"
       data-message-id="{uuid}"
       [data-message-model-slug="{model}"]>
    <div class="markdown">...</div>       <!-- assistant -->
    <div class="user-message-bubble">    <!-- user -->
      <div whitespace-pre-wrap>...</div>
    </div>
  </div>
</section>
```

### 2.2 Observer strategy

The observer handles three cases:
1. **Initial page scan** — process any existing conversation turns at load
2. **New turns** — detect new messages as they appear via MutationObserver
3. **Stream completion** — only process assistant messages once they're fully rendered

```javascript
// Track processed message IDs to avoid duplicates
const processedIds = new Set();
let currentConversationId = null;
let streamDebounceTimer = null;

// --- Initial scan: catch existing messages on page load ---
function scanExistingTurns() {
  document.querySelectorAll('[data-testid^="conversation-turn-"]')
    .forEach(turn => processTurn(turn));
}

// --- MutationObserver: detect new turns as they arrive ---
const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const turn = node.closest('[data-testid^="conversation-turn-"]');
        if (turn) processTurn(turn);
      }
    }
  }
});

// --- Stream debounce: delay processing until content stabilizes ---
// ChatGPT streams responses token by token. Without debounce, we'd
// count each partial stream chunk as a complete message.
function processTurn(turnElement) {
  const messageId = turnElement.querySelector('[data-message-id]')?.getAttribute('data-message-id');
  if (!messageId) return;
  if (processedIds.has(messageId)) return;  // already processed

  const role = turnElement.getAttribute('data-turn');

  // For assistant messages, debounce until streaming ends
  if (role === 'assistant') {
    if (streamDebounceTimer) clearTimeout(streamDebounceTimer);
    streamDebounceTimer = setTimeout(() => {
      if (!processedIds.has(messageId)) {
        processCompleteTurn(turnElement, messageId, role);
      }
    }, 500);  // 500ms of no change = stream likely complete
    return;
  }

  // User messages appear fully formed — process immediately
  processCompleteTurn(turnElement, messageId, role);
}

// --- Conversation switch detection ---
// When ChatGPT switches to a different conversation (SPA navigation),
// a new "conversation-turn-1" appears. Finalize the current session.
function checkConversationSwitch(turnElement) {
  const turnAttr = turnElement.getAttribute('data-testid'); // "conversation-turn-3"
  const turnNum = parseInt(turnAttr.split('-')[2]);
  if (turnNum === 1 && session.messages.length > 0) {
    // New conversation detected — finalize previous
    finalizeSession();
  }
}

// --- Entry point ---
scanExistingTurns();
observer.observe(document.body, { childList: true, subtree: true });
```

### 2.3 Turn processor

```javascript
function processCompleteTurn(turnElement, messageId, role) {
  processedIds.add(messageId);  // dedup

  checkConversationSwitch(turnElement);

  const messageEl = turnElement.querySelector('[data-message-author-role]');
  const text = extractText(messageEl);
  const timestamp = Date.now();

  if (role === 'user') {
    // Token estimate: ~4 chars per token for English text.
    // This is a v0.1 approximation — code blocks and lists vary.
    const charCount = text.length;
    session.push({ type: 'user', text: text.substring(0, 100), charCount, ts: timestamp, turnNum });
  } else {
    const model = messageEl.getAttribute('data-message-model-slug') || 'unknown';
    const charCount = text.length;
    session.push({ type: 'assistant', text: text.substring(0, 100), charCount, model, ts: timestamp, turnNum });
  }

  runHeuristics();
  updateOverlay();
  resetSessionTimer();
}
```

**Token estimation:** For v0.1 we use character counts instead of estimated tokens. The offloading heuristic thresholds are:
- Short user ask: < 120 characters (roughly 1-2 lines)
- Long AI reply: > 600 characters (roughly 3-5 sentences)
- Pattern threshold: 2+ occurrences within 5 turns

These are ballpark values. They'll be refined through real use.

### 2.4 Text extraction

```javascript
function extractText(messageEl) {
  if (!messageEl) return '';
  // User message text is in whitespace-pre-wrap div
  const userText = messageEl.querySelector('[whitespace-pre-wrap]');
  if (userText) return userText.textContent;
  // Assistant text is in markdown
  const md = messageEl.querySelector('.markdown');
  if (md) return md.textContent;
  // Fallback
  return messageEl.textContent;
}
```

---

## Phase 3: Heuristic Engine (part of content.js)

### 3.1 Data model

```javascript
const session = {
  messages: [],        // { type, text, charCount, model, ts, turnNum }
  startTime: null,
  model: null,         // Most recent model detected
};
```

### 3.2 Heuristic: Session shape

```javascript
function getSessionDuration() {
  if (session.messages.length < 2) return 0;
  return session.messages[session.messages.length - 1].ts - session.messages[0].ts;
}

function getMessageRatio() {
  const user = session.messages.filter(m => m.type === 'user').length;
  const ai = session.messages.filter(m => m.type === 'assistant').length;
  return { user, ai };
}

function getMessagePace() {
  // Average time between user messages
  const userMsgs = session.messages.filter(m => m.type === 'user');
  if (userMsgs.length < 2) return 0;
  let totalGap = 0;
  for (let i = 1; i < userMsgs.length; i++) {
    totalGap += userMsgs[i].ts - userMsgs[i - 1].ts;
  }
  return totalGap / (userMsgs.length - 1);
}
```

### 3.3 Heuristic: Offloading detection

Pattern: short user message (< 120 chars) → long AI response (> 600 chars), repeated in sequence.

```javascript
function detectOffloading() {
  const msgs = session.messages;
  if (msgs.length < 4) return { active: false, count: 0 };

  let offloadCount = 0;
  for (let i = 0; i < msgs.length - 3; i++) {
    // Look for: user short (charCount < 120) → assistant long (charCount > 600)
    if (msgs[i].type === 'user' && msgs[i].charCount < 120 &&
        msgs[i+1].type === 'assistant' && msgs[i+1].charCount > 600) {
      // Check if this pattern repeats within 5 turns
      for (let j = i + 2; j < Math.min(i + 5, msgs.length - 1); j++) {
        if (msgs[j].type === 'user' && msgs[j].charCount < 120 &&
            msgs[j+1] && msgs[j+1].type === 'assistant' && msgs[j+1].charCount > 600) {
          offloadCount++;
          i = j + 1;
          break;
        }
      }
    }
  }

  return {
    active: offloadCount >= 2,      // 2+ offloading patterns detected
    count: offloadCount,
  };
}
```

### 3.4 Heuristic: Model tracking

```javascript
function getCurrentModel() {
  // Check the latest assistant message for model slug
  for (let i = session.messages.length - 1; i >= 0; i--) {
    if (session.messages[i].type === 'assistant' && session.messages[i].model) {
      return session.messages[i].model;
    }
  }
  return null;
}
```

### 3.5 Heuristic: Rapid-fire detection

```javascript
function detectRapidFire() {
  const userMsgs = session.messages.filter(m => m.type === 'user');
  if (userMsgs.length < 3) return false;

  // Check if last 3 user messages were sent within 60 seconds of each other
  const last3 = userMsgs.slice(-3);
  const gaps = [];
  for (let i = 1; i < last3.length; i++) {
    gaps.push(last3[i].ts - last3[i-1].ts);
  }
  // If all gaps < 60 seconds, rapid fire
  return gaps.every(g => g < 60000);
}
```

## Phase 4: Floating Overlay UI (in content.js + content.css)

Overlay logic is merged into content.js (no separate overlay.js needed — the update logic is ~30 lines). Styles go in content.css.

### 4.1 Overlay structure

The badge is injected into the ChatGPT page as a fixed-position element. The AI never sees it — it's outside the chat DOM tree.

```html
<!-- Injected by content.js into document.body -->
<div id="mirror-overlay">
  <div id="mirror-header">
    <span class="mirror-dot">●</span>
    Mirror
    <button id="mirror-toggle">_</button>
  </div>
  <div id="mirror-content">
    <div class="mirror-row">
      <span class="mirror-label">Session</span>
      <span class="mirror-value" id="mirror-duration">0 min</span>
    </div>
    <div class="mirror-row">
      <span class="mirror-label">Messages</span>
      <span class="mirror-value" id="mirror-messages">0 (you) / 0 (AI)</span>
    </div>
    <div class="mirror-row">
      <span class="mirror-label">Model</span>
      <span class="mirror-value" id="mirror-model">—</span>
    </div>
    <div class="mirror-alert" id="mirror-offloading" style="display:none">
      ◉ Offloading pattern detected
    </div>
    <div class="mirror-alert" id="mirror-rapidfire" style="display:none">
      ◉ Rapid-fire mode
    </div>
  </div>
</div>
```

### 4.2 Overlay styles

- Position: fixed, bottom-right corner
- Size: compact (~220px wide)
- Dark theme (matches ChatGPT dark mode)
- Semi-transparent by default, full opacity on hover
- Draggable
- Collapsible to just a dot

### 4.3 Key style decisions

```css
#mirror-overlay {
  position: fixed;
  bottom: 16px;
  right: 16px;
  z-index: 999999;
  background: rgba(15, 15, 15, 0.85);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 12px;
  padding: 10px 14px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 12px;
  color: #e0e0e0;
  min-width: 200px;
  max-width: 260px;
  user-select: none;
  cursor: move;
  transition: opacity 0.2s ease;
  opacity: 0.7;
}
#mirror-overlay:hover {
  opacity: 1;
}
.mirror-alert {
  color: #f0a030;
  font-size: 11px;
  margin-top: 4px;
  padding: 3px 6px;
  background: rgba(240, 160, 48, 0.1);
  border-radius: 4px;
}
```

---

## Phase 5: Data Persistence (storage.js)

### 5.1 Schema

```javascript
// chrome.storage.local schema — v0.1: sessions only.
// Daily aggregates can be computed on read when the popup needs them.
{
  "mirror_sessions": [
    {
      "id": "2026-06-23_18:30:00",
      "startTime": 1800000000000,
      "endTime": 1800000360000,
      "duration": 360000,
      "userMessages": 9,
      "aiMessages": 15,
      "model": "gpt-5-5",
      "offloadingEvents": 2,
      "rapidFireEvents": 1
    }
  ],
  "mirror_settings": {
    "enabled": true,
    "showBadge": true,
    "alertsEnabled": true
  }
}
```

### 5.2 Storage operations

```javascript
const Storage = {
  async saveSession(sessionData) {
    const data = await chrome.storage.local.get('mirror_sessions');
    const sessions = data.mirror_sessions || [];
    sessions.push(sessionData);

    // Limit stored sessions (keep last 100)
    if (sessions.length > 100) sessions.splice(0, sessions.length - 100);

    await chrome.storage.local.set({ mirror_sessions: sessions });
  },

  async getSessions() {
    const data = await chrome.storage.local.get('mirror_sessions');
    return data.mirror_sessions || [];
  },

  async getSettings() {
    const data = await chrome.storage.local.get('mirror_settings');
    return data.mirror_settings || { enabled: true, showBadge: true, alertsEnabled: true };
  },

  async updateSettings(updates) {
    const settings = await this.getSettings();
    Object.assign(settings, updates);
    await chrome.storage.local.set({ mirror_settings: settings });
  },

  async clearAll() {
    await chrome.storage.local.remove(['mirror_sessions', 'mirror_settings']);
  }
};
```

---

## Phase 6: Session Lifecycle

### 6.1 Session detection

A session starts when a user sends the first message. A session ends after:
- 15 minutes of inactivity (no new messages)
- OR page unload (tab close/navigate away)

```javascript
let sessionTimer = null;
const SESSION_TIMEOUT = 15 * 60 * 1000; // 15 min

function resetSessionTimer() {
  if (sessionTimer) clearTimeout(sessionTimer);
  sessionTimer = setTimeout(() => {
    finalizeSession();
  }, SESSION_TIMEOUT);
}
```

### 6.2 Session finalization

```javascript
function finalizeSession() {
  if (session.messages.length === 0) return;

  const sessionData = {
    id: new Date().toISOString(),
    startTime: session.startTime,
    endTime: Date.now(),
    duration: Date.now() - session.startTime,
    userMessages: session.messages.filter(m => m.type === 'user').length,
    aiMessages: session.messages.filter(m => m.type === 'assistant').length,
    model: session.model,
    offloadingEvents: detectOffloading(session).count,
    rapidFireEvents: detectRapidFire(session) ? 1 : 0,
  };

  Storage.saveSession(sessionData);
  session.messages = [];
  session.startTime = null;
}
```

---

## Phase 7: Options Page (popup.html + popup.js)

### 7.1 Popup content

Simple settings page:
- Enable/disable toggle
- Show/hide badge
- Enable/disable alerts
- Clear all data button
- Total stats summary today

### 7.2 Permissions hint

```
What Mirror does:
● Runs entirely in your browser — no data ever leaves
● Reads message structure only (lengths, timing, counts)
● Never reads message content or topics
● No accounts, no servers, no telemetry
```

---

## Phase 8: Error Handling & Edge Cases

### 8.1 ChatGPT DOM changes

ChatGPT A/B tests new UIs frequently. If selectors fail, the extension should degrade gracefully — hide the badge, log a warning, keep running.

```javascript
// Safe selector: returns empty array on failure instead of crashing
function safeQuery(selector, parent = document) {
  try {
    return parent.querySelectorAll(selector);
  } catch (e) {
    console.warn('[Mirror] Selector failed:', selector, e);
    return [];
  }
}
```

### 8.2 Multiple tabs

If user has multiple ChatGPT tabs open, each content script runs independently. That's fine — data is scoped per-tab in memory, only persisted on session end.

### 8.3 Page navigation

ChatGPT is a SPA. The URL changes but the page doesn't reload for conversation switches. Handled by `checkConversationSwitch()` — when `conversation-turn-1` appears mid-session, the previous session is finalized.

---
## Phase 9: Icons & Visual Assets

Chrome requires extension icons (16, 48, 128) in PNG format.

### 9.1 Icon design

For v0.1, use a simple SVG-based icon: a circle with a smaller circle inside — representing reflection/mirror.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <circle cx="64" cy="64" r="56" fill="none" stroke="#f0a030" stroke-width="6"/>
  <circle cx="64" cy="64" r="24" fill="#f0a030" opacity="0.3"/>
  <circle cx="64" cy="64" r="8" fill="#f0a030"/>
</svg>
```

Generated via: `convert -background none icon.svg icon-128.png` (ImageMagick) or an online converter.

### 9.2 Sizes

| Size | Use |
|------|-----|
| 16×16 | Browser toolbar / favicon context |
| 48×48 | Extensions management page |
| 128×128 | Chrome Web Store listing |

---

## Future (Post-MVP) Considerations

| Feature | Why cut from MVP |
|---------|-----------------|
| Claude/Gemini support | Different DOM structure — add after ChatGPT works |
| Cross-session trends dashboard | Requires popup to aggregate and display — phase 2 |
| Per-session debrief popup | Content summary — post-MVP |
| Dark/light theme sync | CSS polish — v0.2 |
| Export data | Nice to have |
| Emotional boundary detection | Requires content analysis — NOT FOR EXTENSION |

---

## Implementation Order

```
Phase 1: Project scaffold (manifest.json, dev workflow, directory)
Phase 2: storage.js (data layer with no dependencies)
Phase 3: content.js (DOM observer + heuristic engine + overlay UI)
Phase 4: content.css (floating badge styles)
Phase 5: popup.html + popup.js (settings page)
Phase 6: Icon generation (SVG → PNG for 16/48/128)
Phase 7: Integration testing on live ChatGPT
Phase 8: Polish (safe selectors, edge cases, error handling)
```

---

## Development Workflow

### Loading the extension

1. Open `chrome://extensions`
2. Enable "Developer mode" (toggle top-right)
3. Click "Load unpacked" → select `mirror/` directory
4. The extension icon appears in the toolbar
5. Navigate to `https://chatgpt.com` to test

### Iteration loop

1. Edit file in `mirror/`
2. Go to `chrome://extensions`
3. Click the refresh icon on the Mirror card
4. Reload the ChatGPT tab
5. Check console (F12 → Console tab) for `[Mirror]` logs

---

## Testing Checklist

- [ ] Extension loads without errors (check chrome://extensions)
- [ ] Badge appears on chatgpt.com
- [ ] Message count updates as conversation progresses
- [ ] Timer shows correct session duration
- [ ] Model name detected correctly
- [ ] Offloading alert triggers after pattern (short ask → long reply ×3)
- [ ] Session saves to chrome.storage.local on inactivity timeout
- [ ] Popup shows settings and stats
- [ ] "Clear all data" works
- [ ] Zero network requests made (check DevTools Network tab)
- [ ] Works after page refresh (session resets, history persists)
- [ ] Extension can be toggled off
