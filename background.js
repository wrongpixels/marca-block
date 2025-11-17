const DEFAULTS = {
  enabled: true,
  sectionToggles: {
    TV_SOCIEDAD: true,
    PRENSA: true,
    APUESTAS: true,
    MARCA_TV: true,
    SPONSORED: true,
    EMBEDDED_VIDEOS: true,
    AUTOPLAY_IFRAMES: true,
    VIDEO_AUTOPLAY: true,
    ARTICLE_SECONDARY_COLUMN: true,
  },
  authors: [],
  keywords: [],
  kickers: [],
}

const getSettings = async () => {
  const obj = await chrome.storage.local.get('settings')
  if (!obj.settings) return DEFAULTS
  return {
    ...DEFAULTS,
    ...obj.settings,
    sectionToggles: {
      ...DEFAULTS.sectionToggles,
      ...(obj.settings.sectionToggles || {}),
    },
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.local.get('settings')
  if (!existing.settings) {
    await chrome.storage.local.set({ settings: DEFAULTS })
  }
})

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.settings) {
    chrome.tabs.query(
      { url: ['https://www.marca.com/*', 'https://marca.com/*'] },
      (tabs) => {
        for (const t of tabs) {
          if (t.id) {
            chrome.tabs
              .sendMessage(t.id, { type: 'settings-updated' })
              .catch(() => {})
          }
        }
      }
    )
  }
})

//to listen to know if the plugin is active or not
chrome.tabs.onUpdated.addListener(async (tabId, _changeInfo, tab) => {
  if (!tab.url || !/\.?marca\.com/.test(new URL(tab.url).hostname)) {
    return
  }
  const s = await getSettings()
  chrome.action.setBadgeText({ tabId, text: s.enabled ? 'ON' : 'OFF' })
  chrome.action.setBadgeBackgroundColor({
    tabId,
    color: s.enabled ? '#2e7d32' : '#9e9e9e',
  })
})

//to listen to the aprox count of blocked elements
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type === 'blocked-count' && sender.tab?.id) {
    chrome.action.setBadgeText({
      tabId: sender.tab.id,
      text: msg.count > 0 ? `${msg.count}` : 'ON',
    })
    chrome.action.setBadgeBackgroundColor({
      tabId: sender.tab.id,
      color: '#ff9800',
    })
  }
})
