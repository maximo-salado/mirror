/**
 * Mirror - Storage Layer
 *
 * chrome.storage.local wrapper for persistent session data.
 * Zero network. No accounts. All data stays in the browser.
 */

const Storage = {
  /** Save a completed session record */
  async saveSession(sessionData) {
    const data = await chrome.storage.local.get('mirror_sessions');
    const sessions = data.mirror_sessions || [];
    sessions.push(sessionData);

    // Keep last 100 sessions to avoid unbounded growth
    if (sessions.length > 100) sessions.splice(0, sessions.length - 100);

    await chrome.storage.local.set({ mirror_sessions: sessions });
  },

  /** Get all stored session records */
  async getSessions() {
    const data = await chrome.storage.local.get('mirror_sessions');
    return data.mirror_sessions || [];
  },

  /** Get current user settings */
  async getSettings() {
    const data = await chrome.storage.local.get('mirror_settings');
    return data.mirror_settings || {
      enabled: true,
      showBadge: true,
      alertsEnabled: true,
    };
  },

  /** Update one or more settings (partial merge) */
  async updateSettings(updates) {
    const settings = await this.getSettings();
    Object.assign(settings, updates);
    await chrome.storage.local.set({ mirror_settings: settings });
  },

  /** Wipe all stored data */
  async clearAll() {
    await chrome.storage.local.remove(['mirror_sessions', 'mirror_settings']);
  },
};
