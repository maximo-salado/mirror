/**
 * Mirror - Popup Script
 *
 * Settings and today's stats in the extension popup.
 * Storage functions inlined since storage.js only runs in content scripts.
 */

const PopupStorage = {
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
  },
};

document.addEventListener('DOMContentLoaded', async () => {
  const settings = await PopupStorage.getSettings();

  // --- Toggles ---
  const toggleEnabled = document.getElementById('toggle-enabled');
  const toggleBadge = document.getElementById('toggle-badge');
  const toggleAlerts = document.getElementById('toggle-alerts');

  function applyToggle(el, value) {
    el.classList.toggle('active', value);
  }

  applyToggle(toggleEnabled, settings.enabled);
  applyToggle(toggleBadge, settings.showBadge);
  applyToggle(toggleAlerts, settings.alertsEnabled);

  toggleEnabled.addEventListener('click', async () => {
    const newVal = !settings.enabled;
    settings.enabled = newVal;
    applyToggle(toggleEnabled, newVal);
    await PopupStorage.updateSettings({ enabled: newVal });
  });

  toggleBadge.addEventListener('click', async () => {
    const newVal = !settings.showBadge;
    settings.showBadge = newVal;
    applyToggle(toggleBadge, newVal);
    await PopupStorage.updateSettings({ showBadge: newVal });
  });

  toggleAlerts.addEventListener('click', async () => {
    const newVal = !settings.alertsEnabled;
    settings.alertsEnabled = newVal;
    applyToggle(toggleAlerts, newVal);
    await PopupStorage.updateSettings({ alertsEnabled: newVal });
  });

  // --- Today's stats ---
  const sessions = await PopupStorage.getSessions();
  const today = new Date().toISOString().split('T')[0];
  const todaySessions = sessions.filter(s =>
    s.startTime && new Date(s.startTime).toISOString().split('T')[0] === today
  );

  const statsEl = document.getElementById('today-stats');
  if (todaySessions.length === 0) {
    statsEl.innerHTML = '<div class="no-data">No sessions yet today</div>';
  } else {
    let totalMsgs = 0, totalTime = 0, totalOffload = 0;
    for (const s of todaySessions) {
      totalMsgs += s.userMessages + s.aiMessages;
      totalTime += s.duration || 0;
      totalOffload += s.offloadingEvents || 0;
    }
    statsEl.innerHTML = `
      <div class="stat-row"><span class="stat-label">Sessions</span><span class="stat-value">${todaySessions.length}</span></div>
      <div class="stat-row"><span class="stat-label">Messages</span><span class="stat-value">${totalMsgs}</span></div>
      <div class="stat-row"><span class="stat-label">Total time</span><span class="stat-value">${Math.round(totalTime / 60000)} min</span></div>
      <div class="stat-row"><span class="stat-label">Offload events</span><span class="stat-value">${totalOffload}</span></div>
    `;
  }

  // --- Clear data ---
  document.getElementById('btn-clear').addEventListener('click', async () => {
    if (confirm('Clear all Mirror data? This cannot be undone.')) {
      await PopupStorage.clearAll();
      statsEl.innerHTML = '<div class="no-data">Data cleared</div>';
    }
  });
});
