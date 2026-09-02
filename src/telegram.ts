// Minimal Telegram Mini App integration.
//
// The SDK used to be a plain <script> in index.html, which meant every normal-browser
// visit fetched telegram.org — useless outside Telegram, render-blocking, and routinely
// blocked by privacy extensions (Chrome reports "blocked:other"). It is now injected
// on demand, only when the page is actually running inside Telegram.

interface TelegramWebApp {
  ready: () => void
  expand: () => void
}

const SDK_URL = 'https://telegram.org/js/telegram-web-app.js'

/**
 * Are we inside a Telegram Mini App? Telegram puts its launch parameters in the URL
 * (`tgWebAppData`, `tgWebAppVersion`, …) and its mobile clients expose a webview proxy.
 * Either is a reliable signal without loading anything first.
 */
function inTelegram(): boolean {
  const w = window as unknown as { TelegramWebviewProxy?: unknown; Telegram?: unknown }
  return /tgWebApp/.test(window.location.href)
    || typeof w.TelegramWebviewProxy !== 'undefined'
    || typeof w.Telegram !== 'undefined'
}

function loadSdk(): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SDK_URL}"]`)
    if (existing) { resolve(); return }
    const el = document.createElement('script')
    el.src = SDK_URL
    el.async = true
    el.onload = () => resolve()
    el.onerror = () => reject(new Error('Telegram SDK blocked or unreachable'))
    document.head.appendChild(el)
  })
}

/**
 * Signals readiness and expands the webview to full height. A no-op in a normal browser,
 * so the app behaves identically there — and a blocked or unreachable SDK is swallowed
 * rather than breaking startup.
 */
export function initTelegramWebApp(): void {
  if (!inTelegram()) return
  loadSdk()
    .then(() => {
      const tg = (window as unknown as { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp
      if (!tg) return
      try {
        tg.ready()
        tg.expand()
      } catch {
        // Older Telegram clients may not support every call — safe to ignore.
      }
    })
    .catch(() => {
      // Not fatal: the app works fine without the Mini App niceties.
    })
}
