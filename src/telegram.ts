// Minimal Telegram Mini App integration. No-op outside Telegram (window.Telegram undefined),
// so the app runs identically in a normal browser. When opened as a Telegram Web App this
// signals readiness and expands the webview to full height.
interface TelegramWebApp {
  ready: () => void
  expand: () => void
}

export function initTelegramWebApp(): void {
  const tg = (window as unknown as { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp
  if (!tg) return
  try {
    tg.ready()
    tg.expand()
  } catch {
    // Older Telegram clients may not support every call — safe to ignore.
  }
}
