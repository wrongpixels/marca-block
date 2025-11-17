const SELECTORS = {
  TV_SOCIEDAD: '[data-flex-name="portada/flex-list-ad-2"]',
  PRENSA: '[data-flex-name="portada/flex-list-ad-bt"]',
  APUESTAS: '.ue-l-cover-grid.flex-territorio-apuestas',
  MARCA_TV: '.ue-l-cover-grid.flex-video-marca-tv',
  SPONSORED: '[aria-roledescription="Publicidad"]',
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
let blockedCount = 0

const normalizeString = (string) => (string || '').trim().toLowerCase()

const buildCssFromToggles = (s) => {
  if (!s.enabled) {
    return ''
  }
  const hideList = []
  for (const [key, on] of Object.entries(s.sectionToggles)) {
    if (!on) {
      continue
    }
    const sel = SELECTORS[key]
    if (sel) {
      hideList.push(sel)
    }
  }
  return hideList.length
    ? `${hideList.join(', ')} { display: none !important; }`
    : ''
}

const ensureStyle = (css) => {
  if (!styleTag) {
    styleTag = document.createElement('style')
    styleTag.id = 'marca-custom-blocker-style'
    ;(document.head || document.documentElement).appendChild(styleTag)
  }
  styleTag.textContent = css
}

//to get the parent element of the article to block
const getArticleUnit = (el) => {
  let parent = el
  while (parent && !parent.classList.contains('ue-l-cover-grid__unit')) {
    parent = parent.parentElement
  }
  return parent
}

//what actually hides the element. Returns 1 if worked to count hidden elements
const hideElement = (el) => {
  if (!el) {
    return 0
  }
  el.style.setProperty('display', 'none', 'important')
  {
    return 1
  }
}

//our logic to hide elements in a list. Returns the number of blocked elements for our count
const blockByList = (units, checkFn, list) => {
  let count = 0
  if (list.length === 0) {
    return count
  }
  const normList = list.map(normalizeString).filter(Boolean)
  units.forEach((unit) => {
    if (checkFn(unit, normList)) {
      count += hideElement(unit)
    }
  })
  return count
}

//checks if the article unit has been written by a specific author
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

//checks if an article unit contains any blocked string in the headline
const checkWordsInHeadline = (unit, normList) => {
  const headline = unit.querySelector('.ue-c-cover-content__headline')
  return (
    headline &&
    normList.some((k) => normalizeString(headline.textContent).includes(k))
  )
}

//to check the "section name" (FÚTBOL, BUNDESLIGA...) above the headlines, called "kicker"
const checkWordsInKicker = (unit, normList) => {
  const kicker = unit.querySelector('.ue-c-cover-content__kicker')
  return (
    kicker &&
    normList.some((k) => normalizeString(kicker.textContent).includes(k))
  )
}

//to block MarcaTV videos from the frontpage
const blockEmbeddedVideos = () => {
  let count = 0
  document.querySelectorAll(SELECTORS.EMBEDDED_VIDEOS).forEach((icon) => {
    const unit = getArticleUnit(icon)
    if (unit) {
      count += hideElement(unit)
    }
  })
  return count
}

//to block videos with an autoplay iFrame
const blockAutoplayIframes = () => {
  let count = 0
  document.querySelectorAll(SELECTORS.AUTOPLAY_IFRAMES).forEach((iframe) => {
    const unit = getArticleUnit(iframe)
    if (unit) {
      count += hideElement(unit)
    }
  })
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
    blockedCount = 0
    ensureStyle('')
    return
  }
  blockedCount = 0
  const css = buildCssFromToggles(settingsCache)
  ensureStyle(css)

  const units = Array.from(document.querySelectorAll('.ue-l-cover-grid__unit'))

  //for lists
  blockedCount += blockByList(units, checkAuthor, settingsCache.authors)
  blockedCount += blockByList(
    units,
    checkWordsInHeadline,
    settingsCache.keywords
  )
  blockedCount += blockByList(units, checkWordsInKicker, settingsCache.kickers)

  //for individual elements
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
      applyAll()
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
