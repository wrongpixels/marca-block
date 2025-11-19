const SECTION_LABELS = {
  TV_SOCIEDAD: 'TV/Sociedad/Bazar',
  PRENSA: 'Prensa externa (El Mundo, Tiramillas...)',
  APUESTAS: 'Apuestas',
  MARCA_TV: 'Marca TV',
  SPONSORED: 'Contenido patrocinado',
  EMBEDDED_VIDEOS: 'Artículos que lleven a un vídeo',
  AUTOPLAY_IFRAMES: 'Vídeos de Marca',
  VIDEO_AUTOPLAY: 'Vídeos flotantes con autoplay',
  ARTICLE_SECONDARY_COLUMN:
    'Columnas adicionales (Últimas noticias, relacionado...), ',
}

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

let currentSettings = { ...DEFAULTS }
let lastSavedSettings = { ...DEFAULTS }
let unsavedChanges = false

const init = async () => {
  const data = await chrome.storage.local.get('settings')
  if (data.settings) {
    currentSettings = {
      ...DEFAULTS,
      ...data.settings,
      sectionToggles: {
        ...DEFAULTS.sectionToggles,
        ...(data.settings.sectionToggles || {}),
      },
    }
  }
  renderAll()
}

const renderAll = () => {
  renderList('authors-list', currentSettings.authors, (idx) =>
    removeItem('authors', idx)
  )
  renderList('keywords-list', currentSettings.keywords, (idx) =>
    removeItem('keywords', idx)
  )
  renderList('kickers-list', currentSettings.kickers, (idx) =>
    removeItem('kickers', idx)
  )
  renderToggles()
  updateSaveButton()
}

const renderList = (elementId, items, removeCb) => {
  const container = document.getElementById(elementId)
  container.innerHTML = ''
  items.forEach((item, idx) => {
    const tag = document.createElement('div')
    tag.className = 'tag'
    tag.innerHTML = `${item} <span>&times;</span>`
    tag.querySelector('span').onclick = () => {
      removeCb(idx)
      updateSaveButton()
    }
    container.appendChild(tag)
  })
}

const renderToggles = () => {
  const container = document.getElementById('toggles-container')
  container.innerHTML = ''
  Object.keys(SECTION_LABELS).forEach((key) => {
    const div = document.createElement('div')
    div.className = 'toggle-item'

    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    checkbox.id = `toggle-${key}`
    checkbox.checked = currentSettings.sectionToggles[key]
    checkbox.onchange = (e) => {
      currentSettings.sectionToggles[key] = e.target.checked
      unsavedChanges = true
      updateSaveButton()
    }

    const label = document.createElement('label')
    label.htmlFor = `toggle-${key}`
    label.textContent = SECTION_LABELS[key]

    div.appendChild(checkbox)
    div.appendChild(label)
    container.appendChild(div)
  })
}

const removeItem = (type, index) => {
  currentSettings[type].splice(index, 1)
  renderAll()
  unsavedChanges = true
  updateSaveButton()
}

const addItem = (type, inputId) => {
  const input = document.getElementById(inputId)
  const val = input.value.trim()
  if (val) {
    currentSettings[type].push(val)
    input.value = ''
    renderAll()
    unsavedChanges = true
    updateSaveButton()
  }
}

const updateSaveButton = (status) => {
  const saveButton = document.getElementById('save')
  saveButton.style.opacity = unsavedChanges ? 1 : 0.2
  saveButton.ariaDisabled = !unsavedChanges
  saveButton.disabled = !unsavedChanges
  saveButton.style.cursor = unsavedChanges ? 'pointer' : 'default'
  const reminder = document.getElementById('save-reminder')
  if (unsavedChanges) {
    document.getElementById('status').style.display = 'none'
    if (reminder.style.opacity === 0 || reminder.style.display === 'none') {
      reminder.style.display = 'inline'
      setTimeout(() => (reminder.style.opacity = '1'), 100)
    }
  } else {
    reminder.style.opacity = 0
    reminder.style.display = 'none'
  }
}

const setupEnterKey = (inputId, btnId) => {
  document.getElementById(inputId).addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      document.getElementById(btnId).click()
    }
  })
}

document.addEventListener('DOMContentLoaded', () => {
  //listeners
  document.getElementById('add-author').onclick = () =>
    addItem('authors', 'author-input')
  document.getElementById('add-keyword').onclick = () =>
    addItem('keywords', 'keyword-input')
  document.getElementById('add-kicker').onclick = () =>
    addItem('kickers', 'kicker-input')

  setupEnterKey('author-input', 'add-author')
  setupEnterKey('keyword-input', 'add-keyword')
  setupEnterKey('kicker-input', 'add-kicker')

  document.getElementById('save').onclick = async () => {
    await chrome.storage.local.set({ settings: currentSettings })
    lastSavedSettings = currentSettings
    unsavedChanges = false
    updateSaveButton()
    const status = document.getElementById('status')
    status.style.display = 'inline'
    setTimeout(() => (status.style.opacity = '1'), 100)
    setTimeout(() => (status.style.opacity = '0'), 4000)

    chrome.tabs.query({ url: '*://*.marca.com/*' }, (tabs) => {
      tabs.forEach((tab) => {
        chrome.tabs
          .sendMessage(tab.id, { type: 'settings-updated' })
          .catch(() => {})
      })
    })
  }

  init()
})
