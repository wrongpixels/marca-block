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
    statusText.textContent = state.enabled ? 'Activo' : 'Pausado'
    statusText.style.color = state.enabled ? '#333' : '#999'
  }

  if (enabledEl) {
    updateUI()
    enabledEl.addEventListener('change', async () => {
      state.enabled = enabledEl.checked
      updateUI()
      const current = await getSettings()
      current.enabled = state.enabled
      await chrome.storage.local.set({ settings: current })
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
      chrome.runtime.openOptionsPage()
    })
  }
})
