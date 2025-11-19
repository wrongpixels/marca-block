const SELECTORS = {
  TV_SOCIEDAD: '[data-flex-name="portada/flex-list-ad-2"]',
  PRENSA: '[data-flex-name="portada/flex-list-ad-bt"]',
  APUESTAS: '.ue-l-cover-grid.flex-territorio-apuestas',
  MARCA_TV: '.ue-l-cover-grid.flex-video-marca-tv',
  SPONSORED: '[aria-roledescription="Publicidad"]',
  SPONSORED_ARTICLE: '.ue-c-cover-content--is-branded',
  EMBEDDED_VIDEOS: '.ue-c-cover-content__video-duration-icon',
  AUTOPLAY_IFRAMES: 'iframe[allow*="autoplay"]',
  VIDEO_AUTOPLAY: '.ue-c-video-player-frame',
  ARTICLE_SECONDARY_COLUMN: '.ue-l-article__secondary-column',
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

let settingsCache = null
let observer = null
let styleTag = null
let debounceTimer = null

const normalizeString = (string) => (string || '').trim().toLowerCase()

const buildCssFromToggles = (s) => {
  if (!s.enabled) {
    return ''
  }

  const hideList = []
  for (const [key, on] of Object.entries(s.sectionToggles)) {
    if (key === 'EMBEDDED_VIDEOS' || key === 'AUTOPLAY_IFRAMES') {
      continue
    }

    if (on && SELECTORS[key]) {
      hideList.push(SELECTORS[key])
    }
  }
  return hideList.length
    ? `${hideList.join(', ')} { display: none !important; }`
    : ''
}

const ensureStyle = (css) => {
  if (!styleTag) {
    styleTag = document.createElement('style')
    styleTag.id = 'marca-block-style'
    ;(document.head || document.documentElement).appendChild(styleTag)
  }
  if (styleTag.textContent !== css) {
    styleTag.textContent = css
  }
}

const getArticleUnit = (el) => {
  if (!el) {
    return null
  }

  const gridUnit = el.closest('.ue-l-cover-grid__unit')
  if (gridUnit) {
    return gridUnit
  }

  const mediaWrapper = el.closest('.ue-c-article__media')
  if (mediaWrapper) {
    return mediaWrapper
  }

  return null
}

const hideElement = (el) => {
  if (!el) {
    return 0
  }
  if (el.style.display === 'none') {
    return 0
  }

  el.style.setProperty('display', 'none', 'important')
  return 1
}

const blockByList = (units, checkFn, list) => {
  let count = 0
  if (!list || list.length === 0) {
    return count
  }

  const normList = list.map(normalizeString).filter(Boolean)
  units.forEach((unit) => {
    if (unit.style.display !== 'none' && checkFn(unit, normList)) {
      count += hideElement(unit)
    }
  })
  return count
}

//to block by authors
const checkAuthor = (unit, normList) => {
  const byline = unit.querySelector('.ue-c-cover-content__byline-name')
  if (byline && byline.textContent) {
    if (normList.some((a) => normalizeString(byline.textContent).includes(a))) {
      return true
    }
  }
  const spans = unit.querySelectorAll('article span')
  for (const sp of spans) {
    if (normList.some((a) => normalizeString(sp.textContent).includes(a))) {
      return true
    }
  }
  return false
}

//to block by headline keywords
const checkWordsInHeadline = (unit, normList) => {
  const headline = unit.querySelector('.ue-c-cover-content__headline')
  return (
    headline &&
    normList.some((k) => normalizeString(headline.textContent).includes(k))
  )
}

//to block by headline kicker keywords
const checkWordsInKicker = (unit, normList) => {
  const kicker = unit.querySelector('.ue-c-cover-content__kicker')
  return (
    kicker &&
    normList.some((k) => normalizeString(kicker.textContent).includes(k))
  )
}

//to block embedded videos
const blockEmbeddedVideos = () => {
  let count = 0
  document.querySelectorAll(SELECTORS.EMBEDDED_VIDEOS).forEach((icon) => {
    const unit = getArticleUnit(icon)
    if (unit && unit.style.display !== 'none') {
      count += hideElement(unit)
    }
  })
  return count
}

//to block extra sponsored articles and content
const blockSponsoredContent = () => {
  let count = 0
  const combinedSelector = `${SELECTORS.SPONSORED_ARTICLE}, .publicidad, .sm-it-main-container, .teads-inread, .teads-ui-components-adchoices, .trc_spotlight_widget, .GoogleActiveViewInnerContainer, .commercial`

  document.querySelectorAll(combinedSelector).forEach((element) => {
    let unitToHide = getArticleUnit(element)
    if (!unitToHide) {
      unitToHide = element
    }
    if (unitToHide && unitToHide.style.display !== 'none') {
      count += hideElement(unitToHide)
    }
  })

  return count
}

//to block autoplay iFrames
const blockAutoplayIframes = () => {
  let count = 0
  document.querySelectorAll(SELECTORS.AUTOPLAY_IFRAMES).forEach((iframe) => {
    const unit = getArticleUnit(iframe)
    if (unit && unit.style.display !== 'none') {
      count += hideElement(unit)
    }
  })
  return count
}

const countCssHiddenElements = (settings) => {
  let count = 0
  for (const [key, on] of Object.entries(settings.sectionToggles)) {
    if (key === 'EMBEDDED_VIDEOS' || key === 'AUTOPLAY_IFRAMES') {
      continue
    }

    if (on && SELECTORS[key]) {
      const elements = document.querySelectorAll(SELECTORS[key])
      count += elements.length
    }
  }
  return count
}

const loadSettings = async () => {
  const { settings } = await chrome.storage.local.get('settings')
  if (!settings) {
    return DEFAULTS
  }
  return {
    ...DEFAULTS,
    ...settings,
    sectionToggles: {
      ...DEFAULTS.sectionToggles,
      ...(settings.sectionToggles || {}),
    },
  }
}

const applyAll = () => {
  if (!settingsCache || !settingsCache.enabled) {
    ensureStyle('')
    chrome.runtime
      .sendMessage({ type: 'blocked-count', count: 0 })
      .catch(() => {})
    return
  }

  let blockedCount = 0

  const css = buildCssFromToggles(settingsCache)
  ensureStyle(css)

  blockedCount += countCssHiddenElements(settingsCache)

  const units = Array.from(document.querySelectorAll('.ue-l-cover-grid__unit'))

  blockedCount += blockByList(units, checkAuthor, settingsCache.authors)
  blockedCount += blockByList(
    units,
    checkWordsInHeadline,
    settingsCache.keywords
  )
  blockedCount += blockByList(units, checkWordsInKicker, settingsCache.kickers)
  if (settingsCache.sectionToggles.SPONSORED) {
    blockedCount += blockSponsoredContent()
  }

  if (settingsCache.sectionToggles.EMBEDDED_VIDEOS) {
    blockedCount += blockEmbeddedVideos()
  }
  if (settingsCache.sectionToggles.AUTOPLAY_IFRAMES) {
    blockedCount += blockAutoplayIframes()
  }

  chrome.runtime
    .sendMessage({ type: 'blocked-count', count: blockedCount })
    .catch(() => {})
}

const startObserver = () => {
  if (observer) {
    observer.disconnect()
  }
  observer = new MutationObserver(() => {
    if (settingsCache?.enabled) {
      clearTimeout(debounceTimer)
      debounceTimer = setTimeout(applyAll, 200)
    }
  })
  observer.observe(document.documentElement, { subtree: true, childList: true })
}

const init = async () => {
  settingsCache = await loadSettings()
  applyAll()
  startObserver()

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === 'settings-updated') {
      loadSettings().then((s) => {
        settingsCache = s
        applyAll()
      })
    }
  })
}

init()
