const DEFAULTS = {
  enabled: true,
}

//initialize defaults on install
chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.local.get('settings')
  if (!existing.settings) {
    await chrome.storage.local.set({ settings: DEFAULTS })
  }
})

//we listen for changes in settings to notify open tabs immediately
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.settings) {
    const isEnabled = changes.settings.newValue.enabled
    updateBadgeStatus(isEnabled)

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

//helper to set visual state based on Enabled/Disabled only
const updateBadgeStatus = (enabled) => {
  if (!enabled) {
    chrome.action.setBadgeText({ text: 'OFF' })
    chrome.action.setBadgeBackgroundColor({ color: '#9e9e9e' })
  } else {
    chrome.action.setBadgeBackgroundColor({ color: '#e10f1a' })
  }
}

//listen for the blocked count from content.js
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type === 'blocked-count' && sender.tab?.id) {
    //only show number if > 0
    const text = msg.count > 0 ? `${msg.count}` : ''
    chrome.action.setBadgeText({
      tabId: sender.tab.id,
      text: text,
    })
    chrome.action.setBadgeBackgroundColor({
      tabId: sender.tab.id,
      color: '#e10f1a',
    })
  }
})

//first check on tab update
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (
    changeInfo.status === 'complete' &&
    tab.url &&
    /marca\.com/.test(tab.url)
  ) {
    const { settings } = await chrome.storage.local.get('settings')
    if (settings && !settings.enabled) {
      chrome.action.setBadgeText({ tabId, text: 'OFF' })
      chrome.action.setBadgeBackgroundColor({ tabId, color: '#9e9e9e' })
    }
  }
})
