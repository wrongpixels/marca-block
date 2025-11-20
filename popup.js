const DEFAULTS = { enabled: true }

const getSettings = async () => {
  const obj = await chrome.storage.local.get('settings')
  return { ...DEFAULTS, ...(obj.settings || {}) }
}

document.addEventListener('DOMContentLoaded', async () => {
  let state = await getSettings()

  const enabledEl = document.getElementById('enabled')
  const statusText = document.getElementById('status-text')
  const refreshBtn = document.getElementById('refresh')
  const optionsBtn = document.getElementById('open-options')

  const updateUI = () => {
    enabledEl.checked = state.enabled
    statusText.textContent = state.enabled ? 'Activo' : 'Inactivo'
    statusText.style.color = state.enabled ? '#01a373' : '#999'
  }

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs[0]
    if (activeTab && activeTab.url) {
      try {
        const url = new URL(activeTab.url)
        if (url.hostname.includes('marca.com')) {
          refreshBtn.style.display = 'flex'
        }
      } catch (e) {}
    }
  })

  if (enabledEl) {
    updateUI()
    enabledEl.addEventListener('change', async () => {
      state.enabled = enabledEl.checked
      updateUI()
      const current = await getSettings()
      current.enabled = state.enabled
      await chrome.storage.local.set({ settings: current })
      reloadCurrentTabIfMarca()
    })
  }

  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) chrome.tabs.reload(tabs[0].id)
        window.close()
      })
    })
  }

  if (optionsBtn) {
    optionsBtn.addEventListener('click', () => {
      if (chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage()
      } else {
        window.open(chrome.runtime.getURL('options.html'))
      }
    })
  }
})

const reloadCurrentTabIfMarca = () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs[0]

    if (activeTab && activeTab.url) {
      try {
        const currentUrl = new URL(activeTab.url)
        if (currentUrl.hostname.includes('marca.com')) {
          chrome.tabs.reload(activeTab.id)
        }
      } catch (_e) {}
    }
  })
}
