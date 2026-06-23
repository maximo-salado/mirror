# Mirror

A local-only browser extension that makes invisible AI interaction patterns visible. No data ever leaves your machine. No accounts. No servers. No AI reading AI conversations.

## Philosophy

> Make users aware of the invisible psychological patterns in AI interactions (offloading, agreeability, engagement hooks) so they can *choose* how to engage rather than being shaped by default designs.

Mirror is a **mirror, not a muzzle**. It doesn't block or modify AI behavior — it just shows you what's happening so you can decide for yourself.

## What it tracks

- **Session timer** — how long you've been in a conversation
- **Message ratio** — how many messages you send vs the AI sends
- **Offloading patterns** — short prompts followed by long AI replies, repeated
- **Model in use** — which model is responding
- **Rapid-fire mode** — many fast consecutive messages

## What it does NOT do

- ❌ No content analysis — it doesn't know what the topic is
- ❌ No second AI reading the conversation
- ❌ No data leaves the browser — zero network permissions
- ❌ No accounts, no login, no cloud sync
- ❌ The AI never knows the extension exists

## Privacy

Mirror runs entirely in your browser. It stores data in `chrome.storage.local`, which is scoped to your browser profile and never sent to any server. The extension requests zero network permissions. You can clear all data with one click in the settings popup.

## Development

### Prerequisites

- Chrome or Chromium browser
- The `mirror/` directory on your machine

### Loading the extension

1. Open `chrome://extensions`
2. Enable "Developer mode" (toggle top-right)
3. Click "Load unpacked" → select the `mirror/` directory
4. The Mirror icon appears in the toolbar
5. Navigate to `https://chatgpt.com` to test

### Iteration loop

1. Edit files in `mirror/`
2. Go to `chrome://extensions`
3. Click the refresh icon on the Mirror card
4. Reload the ChatGPT tab
5. Open DevTools Console to see `[Mirror]` log messages

## License

MIT
