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

const save = async (s) => {
  await chrome.storage.local.set({ settings: s })
}

document.addEventListener('DOMContentLoaded', async () => {
  let state = await getSettings()
  const enabledEl = document.getElementById('enabled')
  const refreshBtn = document.getElementById('refresh')

  enabledEl.checked = state.enabled

  enabledEl.addEventListener('change', async () => {
    state.enabled = enabledEl.checked
    await save(state)
  })

  refreshBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tab && tab.id) {
      try {
        await chrome.tabs.sendMessage(tab.id, { type: 'settings-updated' })
      } catch (e) {}
    }
    window.close()
  })
})
