/**
 * Mirror - Content Script
 *
 * DOM observer + heuristic engine + floating overlay.
 * Runs on https://chatgpt.com/*.
 *
 * Zero network. No data leaves the browser.
 */

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const session = {
  messages: [],      // { type, text, charCount, model, ts, turnNum }
  startTime: null,
  model: null,
};

const processedIds = new Set();
let streamDebounceTimer = null;
let sessionTimer = null;
const SESSION_TIMEOUT = 15 * 60 * 1000; // 15 min inactivity

// ---------------------------------------------------------------------------
// Safe DOM helpers
// ---------------------------------------------------------------------------

function safeQuery(selector, parent) {
  try {
    return (parent || document).querySelectorAll(selector);
  } catch (e) {
    console.warn('[Mirror] Selector failed:', selector, e);
    return [];
  }
}

function safeQueryOne(selector, parent) {
  try {
    return (parent || document).querySelector(selector);
  } catch (e) {
    console.warn('[Mirror] Selector one failed:', selector, e);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Text extraction
// ---------------------------------------------------------------------------

function extractText(messageEl) {
  if (!messageEl) return '';
  // User messages: whitespace-pre-wrap div inside the bubble
  const userText = messageEl.querySelector('[whitespace-pre-wrap]');
  if (userText) return userText.textContent;
  // Assistant messages: markdown container
  const md = messageEl.querySelector('.markdown');
  if (md) return md.textContent;
  // Fallback
  return messageEl.textContent || '';
}

// ---------------------------------------------------------------------------
// Heuristic engine
// ---------------------------------------------------------------------------

function getSessionDuration() {
  if (session.messages.length < 2) return 0;
  const first = session.messages[0].ts;
  const last = session.messages[session.messages.length - 1].ts;
  return last - first;
}

function getMessageRatio() {
  let user = 0, ai = 0;
  for (const m of session.messages) {
    if (m.type === 'user') user++;
    else ai++;
  }
  return { user, ai };
}

function getMessagePace() {
  const userMsgs = session.messages.filter(m => m.type === 'user');
  if (userMsgs.length < 2) return 0;
  let totalGap = 0;
  for (let i = 1; i < userMsgs.length; i++) {
    totalGap += userMsgs[i].ts - userMsgs[i - 1].ts;
  }
  return totalGap / (userMsgs.length - 1);
}

function detectOffloading() {
  const msgs = session.messages;

  let offloadCount = 0;

  for (let i = 0; i < msgs.length - 1; i++) {
    if (msgs[i].type === 'user' && msgs[i].charCount < 200 &&
        msgs[i + 1].type === 'assistant' && msgs[i + 1].charCount > 400) {
      offloadCount++;
      console.log(`[Mirror] Offload pair #${offloadCount} at [${i}]: ${msgs[i].charCount}c → ${msgs[i+1].charCount}c`);
      i++; // skip the AI reply we just counted
    }
  }

  console.log(`[Mirror] Offloading check: ${offloadCount} short/long pairs (need 3+)`);
  return { active: offloadCount >= 3, count: offloadCount };
}

function detectRapidFire() {
  const userMsgs = session.messages.filter(m => m.type === 'user');
  if (userMsgs.length < 3) return false;

  const last3 = userMsgs.slice(-3);
  const gaps = [];
  for (let i = 1; i < last3.length; i++) {
    gaps.push(last3[i].ts - last3[i - 1].ts);
  }
  return gaps.every(g => g < 60000); // all within 60 seconds
}

function getCurrentModel() {
  for (let i = session.messages.length - 1; i >= 0; i--) {
    if (session.messages[i].type === 'assistant' && session.messages[i].model) {
      return session.messages[i].model;
    }
  }
  return null;
}

function runHeuristics() {
  session.model = getCurrentModel();
}

// ---------------------------------------------------------------------------
// Session lifecycle
// ---------------------------------------------------------------------------

function resetSessionTimer() {
  if (sessionTimer) clearTimeout(sessionTimer);
  sessionTimer = setTimeout(finalizeSession, SESSION_TIMEOUT);
}

async function finalizeSession() {
  if (session.messages.length === 0) return;

  const offloading = detectOffloading();
  const ratio = getMessageRatio();

  const sessionData = {
    id: new Date().toISOString(),
    startTime: session.startTime,
    endTime: Date.now(),
    duration: Date.now() - session.startTime,
    userMessages: ratio.user,
    aiMessages: ratio.ai,
    model: session.model,
    offloadingEvents: offloading.count,
    rapidFireEvents: detectRapidFire() ? 1 : 0,
  };

  await Storage.saveSession(sessionData);
  console.log('[Mirror] Session saved:', sessionData.id, `(${Math.round(sessionData.duration / 60000)} min)`);
  session.messages = [];
  session.startTime = null;
}

function checkConversationSwitch(turnElement) {
  const turnAttr = turnElement.getAttribute('data-testid') || '';
  const turnNum = parseInt(turnAttr.split('-')[2]);
  if (turnNum === 1 && session.messages.length > 0) {
    console.log('[Mirror] New conversation detected — saving previous session');
    finalizeSession();
  }
}

// ---------------------------------------------------------------------------
// Turn processing
// ---------------------------------------------------------------------------

function processTurn(turnElement) {
  const messageEl = turnElement.querySelector('[data-message-id]');
  const messageId = messageEl ? messageEl.getAttribute('data-message-id') : null;
  if (!messageId) return;
  if (processedIds.has(messageId)) return; // dedup

  const role = turnElement.getAttribute('data-turn');

  // Assistant messages stream in — debounce until stable
  if (role === 'assistant') {
    if (streamDebounceTimer) clearTimeout(streamDebounceTimer);
    streamDebounceTimer = setTimeout(() => {
      if (!processedIds.has(messageId)) {
        processCompleteTurn(turnElement, messageId, role);
      }
    }, 500);
    return;
  }

  // User messages appear fully formed
  processCompleteTurn(turnElement, messageId, role);
}

function processCompleteTurn(turnElement, messageId, role) {
  processedIds.add(messageId);
  checkConversationSwitch(turnElement);

  const msgEl = safeQueryOne('[data-message-author-role]', turnElement);
  const text = extractText(msgEl);
  const ts = Date.now();

  // Extract turn number from data-testid="conversation-turn-N"
  const turnAttr = turnElement.getAttribute('data-testid') || '';
  const turnNum = parseInt(turnAttr.split('-')[2]) || 0;

  // Start session on first user message
  if (role === 'user' && !session.startTime) {
    session.startTime = ts;
  }

  if (role === 'user') {
    session.messages.push({
      type: 'user',
      charCount: text.length,
      ts,
      turnNum,
    });
  } else {
    const model = msgEl ? msgEl.getAttribute('data-message-model-slug') || 'unknown' : 'unknown';
    session.messages.push({
      type: 'assistant',
      charCount: text.length,
      model,
      ts,
      turnNum,
    });
  }

  runHeuristics();
  updateBar();
  resetSessionTimer();
}

// ---------------------------------------------------------------------------
// DOM observer
// ---------------------------------------------------------------------------

function scanExistingTurns() {
  const turns = safeQuery('[data-testid^="conversation-turn-"]');
  console.log(`[Mirror] Found ${turns.length} existing turns`);
  turns.forEach(turn => processTurn(turn));
}

const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (node.nodeType !== Node.ELEMENT_NODE) continue;
      // Check if the added node itself is a conversation turn
      if (node.matches && node.matches('[data-testid^="conversation-turn-"]')) {
        processTurn(node);
        continue;
      }
      // Or if a child was added inside a turn
      const turn = node.closest
        ? node.closest('[data-testid^="conversation-turn-"]')
        : null;
      if (turn) processTurn(turn);
    }
  }
});

// ---------------------------------------------------------------------------
// Floating Popup UI — card overlay in corner, draggable
// ---------------------------------------------------------------------------

let popupEl = null;

function injectPopup() {
  if (document.getElementById('mirror-popup')) return;

  popupEl = document.createElement('div');
  popupEl.id = 'mirror-popup';
  popupEl.innerHTML = `
    <div id="mirror-header">
      <span id="mirror-dot">●</span>
      <span id="mirror-title">Mirror</span>
      <span id="mirror-toggle">▸</span>
      <span id="mirror-minimize">−</span>
    </div>
    <div id="mirror-body">
      <div class="mirror-row"><span class="mirror-key">Session</span><span class="mirror-val" id="popup-duration">—</span></div>
      <div class="mirror-expand">How long you've been in this conversation. Longer sessions can lead to fatigue and reduced critical thinking.</div>
      <div class="mirror-row"><span class="mirror-key">Messages</span><span class="mirror-val" id="popup-msgs">—</span></div>
      <div class="mirror-expand">Your messages vs the AI's. A high AI ratio may mean you're consuming more than you're directing.</div>
      <div class="mirror-row"><span class="mirror-key">Model</span><span class="mirror-val" id="popup-model">—</span></div>
      <div class="mirror-expand">Which AI model is responding. Different models have different capabilities, costs, and environmental footprints.</div>
      <div class="mirror-alert" id="popup-offloading">⚠ Offloading ×0</div>
      <div class="mirror-expand">Short prompts followed by long AI replies, repeated. May indicate you're delegating thinking rather than collaborating.</div>
      <div class="mirror-alert" id="popup-rapidfire">⚡ Rapid fire</div>
      <div class="mirror-expand">3+ messages in under 60 seconds. Fast exchanges can reduce deliberation and increase impulsivity.</div>
    </div>
  `;

  document.body.appendChild(popupEl);

  const header = popupEl.querySelector('#mirror-header');

  // --- Expand / collapse ---
  let expanded = false;
  const toggle = popupEl.querySelector('#mirror-toggle');
  header.addEventListener('click', (e) => {
    // Don't toggle on drag — only on clean clicks
    if (Math.abs(e.movementX || 0) > 3 || Math.abs(e.movementY || 0) > 3) return;
    expanded = !expanded;
    popupEl.classList.toggle('expanded', expanded);
    toggle.textContent = expanded ? '▾' : '▸';
  });

  // --- Minimize / restore ---
  const minimizeBtn = popupEl.querySelector('#mirror-minimize');
  const dot = popupEl.querySelector('#mirror-dot');

  minimizeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    popupEl.classList.add('minimized');
  });

  dot.addEventListener('click', (e) => {
    if (!popupEl.classList.contains('minimized')) return;
    e.stopPropagation();
    popupEl.classList.remove('minimized');
    // Snap back to bottom-right
    popupEl.style.left = 'auto';
    popupEl.style.top = 'auto';
    popupEl.style.right = '20px';
    popupEl.style.bottom = '20px';
  });

  // --- Draggable ---
  let isDragging = false, offsetX, offsetY;

  header.addEventListener('mousedown', (e) => {
    isDragging = true;
    const rect = popupEl.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    popupEl.style.cursor = 'grabbing';
    popupEl.style.opacity = '0.85';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    popupEl.style.left = (e.clientX - offsetX) + 'px';
    popupEl.style.top = (e.clientY - offsetY) + 'px';
    popupEl.style.right = 'auto';
    popupEl.style.bottom = 'auto';
  });

  document.addEventListener('mouseup', () => {
    if (!isDragging) return;
    isDragging = false;
    popupEl.style.cursor = '';
    popupEl.style.opacity = '';
  });

  console.log('[Mirror] Popup injected');
}

function updatePopup() {
  if (!popupEl) return;

  const duration = getSessionDuration();
  const ratio = getMessageRatio();
  const offloading = detectOffloading();
  const rapidFire = detectRapidFire();

  const durEl = document.getElementById('popup-duration');
  if (durEl) {
    durEl.textContent = duration < 60000 ? '<1m' : `${Math.round(duration / 60000)}m`;
  }

  const msgsEl = document.getElementById('popup-msgs');
  if (msgsEl) msgsEl.textContent = `${ratio.user}/${ratio.ai}`;

  const modelEl = document.getElementById('popup-model');
  if (modelEl) modelEl.textContent = readableModelName(session.model || '—');

  const offloadEl = document.getElementById('popup-offloading');
  if (offloadEl) {
    offloadEl.classList.toggle('active', offloading.active);
    offloadEl.textContent = `⚠ Offloading ×${offloading.count}`;
  }

  const rapidEl = document.getElementById('popup-rapidfire');
  if (rapidEl) {
    rapidEl.classList.toggle('active', rapidFire);
  }
}

// Replace old bar refs
function injectBar() { injectPopup(); }
function updateBar() { updatePopup(); }

// ---------------------------------------------------------------------------
// Model name mapping — slug → readable
// ---------------------------------------------------------------------------

/** Map a data-message-model-slug value to a human-readable model name. */
function readableModelName(slug) {
  const known = {
    // GPT-4 family
    'gpt-4':          'GPT-4',
    'gpt-4-turbo':    'GPT-4 Turbo',
    'gpt-4o':         'GPT-4o',
    'gpt-4o-mini':    'GPT-4o Mini',
    'gpt-4.5':        'GPT-4.5',
    'gpt-4.1':        'GPT-4.1',
    'gpt-4.1-mini':   'GPT-4.1 Mini',
    'gpt-4.1-nano':   'GPT-4.1 Nano',
    // o-series
    'o1':             'o1',
    'o1-mini':        'o1 Mini',
    'o1-pro':         'o1 Pro',
    'o3':             'o3',
    'o3-mini':        'o3 Mini',
    'o4-mini':        'o4 Mini',
    // GPT-3.5
    'gpt-3.5-turbo':  'GPT-3.5 Turbo',
    // GPT-5 family (seen in wild: 'gpt-5-5')
    'gpt-5':          'GPT-5',
    'gpt-5-5':        'GPT-5',
    'gpt-5-mini':     'GPT-5 Mini',
    'gpt-5-nano':     'GPT-5 Nano',
    // Canvas / tools
    'gpt-4o-canmore': 'GPT-4o (Canvas)',
  };

  if (known[slug]) return known[slug];

  // Fallback for unknown slugs: strip gpt- prefix, replace hyphens with dots
  return slug
    .replace(/^gpt-/i, '')
    .replace(/-/g, '·')
    .replace(/\b\w/g, c => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// Tick — update popup every 10s while session is active
// ---------------------------------------------------------------------------

let tickInterval = null;
function startTick() {
  if (tickInterval) return;
  tickInterval = setInterval(() => {
    if (session.messages.length > 0) updatePopup();
  }, 10000);
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

async function init() {
  const settings = await Storage.getSettings();
  if (!settings.enabled) {
    console.log('[Mirror] Disabled in settings');
    return;
  }

  injectBar();
  scanExistingTurns();
  observer.observe(document.body, { childList: true, subtree: true });
  startTick();

  console.log('[Mirror] Active');
}

// Wait for DOM then initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
