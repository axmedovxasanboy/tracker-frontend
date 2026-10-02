import type { en_analytics } from './en.analytics'

/**
 * Uzbek for Analytics. NOT partial, unlike the older dictionaries: the type makes a missing key a
 * compile error, so the two key sets cannot drift apart.
 *
 * Kirim / Chiqim come from `shell.history.*` and Ajratildi from `fix.setAside`, as in English.
 * Only ʻ (U+02BB) is used, never an ASCII apostrophe. A month name before "-dan" is the lowercase
 * name without the year ("sentabrdan"); the page passes it in that form.
 */
export const uz_analytics: Record<keyof typeof en_analytics, string> = {
  // ── Navigatsiya va davr ─────────────────────────────────────────────────────────────────────
  'shell.nav.analytics': 'Tahlil',
  'analytics.nav.totals': 'Jami',
  'analytics.nav.in': 'Kirim',
  'analytics.nav.out': 'Chiqim',
  'analytics.nav.setAside': 'Jamgʻarma',
  'analytics.nav.goals': 'Maqsadlar',
  'analytics.nav.year': '12 oy',
  'an.nav.label': 'Tahlil sahifalari',
  'analytics.tab.yearLockReason': 'Ikki oylik yozuv kerak',
  'analytics.tab.yearLocked': '{month} oyida birinchi yozuv boʻlganda ochiladi.',
  'analytics.tab.yearLockedNoData': 'Ikki oyda yozuv boʻlganda ochiladi.',
  'analytics.backToMonth': 'Qaytish: {month}',
  'analytics.outdated': 'Tahlilni koʻrish uchun serverni yangilang.',
  'analytics.fromHistory': '{month} — Tahlilda koʻrish',

  // ── Chiqim qismlari va qolgani ──────────────────────────────────────────────────────────────
  'analytics.group.everyday': 'Kundalik xarajatlar',
  'analytics.group.bills': 'Toʻlovlar',
  'analytics.group.loans': 'Qarz toʻlovlari',
  'analytics.group.leftOver': 'Ortib qoldi',
  'analytics.b.uncategorised': 'Kategoriyasiz',
  'analytics.b.notItemised': 'Tafsilotsiz',
  'analytics.b.notItemisedHint': 'hamyon tekshiruvidan',
  'analytics.d.kind.bill': 'oylik toʻlov',
  'analytics.g.notCounting': '{names} hisobga olinmagan (summa nomaʼlum)',

  // ── Sarlavha qatori ─────────────────────────────────────────────────────────────────────────
  'an.day': '{days} kundan {day}-kun',
  'an.basis.one': 'Kutilgan: {count} oy oʻrtachasi ({months})',
  'an.basis.many': 'Kutilgan: {count} oy oʻrtachasi ({months})',
  'an.basis.none': 'Solishtirish uchun oldingi oy yoʻq',
  'an.basis.skipped': '(yozuvsiz: {months})',
  'an.unit': 'UZS',
  'an.notYetOne': 'keyingi sanadagi {count} ta yozuv hali hisobga olinmagan',
  'an.notYet': 'keyingi sanadagi {count} ta yozuv hali hisobga olinmagan',

  // ── Hozircha va kutilgan ────────────────────────────────────────────────────────────────────
  'an.expected': '{amount} kutilgan',
  'an.toCome': 'yana {amount} kutilmoqda',
  'an.over': '{amount} ortiq',
  'an.more': '{amount} koʻp',
  'an.less': '{amount} kam',
  'an.asExpected': 'kutilganidek',
  'an.inclBonus': 'shundan premiya {amount}',
  'an.stableIncome': 'Oylik daromad: {amount}',
  'an.inclBills': 'shundan toʻlovlar {amount}',
  'an.paidOff': 'toʻlab boʻlingan',
  'an.loansPaidOff': '{amount} toʻlab boʻlingan qarzlar uchun',
  'an.new': 'yangi',
  'an.sr.more': 'kutilganidan koʻp',
  'an.sr.less': 'kutilganidan kam',
  'an.sr.about': 'kutilganidek',

  // ── Hisobga kirmaydi ────────────────────────────────────────────────────────────────────────
  'an.notCounted': 'Kirim yoki chiqimga kirmaydi',
  'an.notCountedIn': 'Kirimga kirmaydi',
  'an.notCountedOut': 'Chiqimga kirmaydi',
  'an.borrowed': 'Qarz olindi',
  'an.lent': 'Qarz berildi',
  'an.returned': 'Sizga qaytarildi',
  'an.fromSavings': 'Jamgʻarmadan',
  'an.nothingFromSavings': 'Jamgʻarmadan hech narsa olinmadi.',

  // ── Kirim ───────────────────────────────────────────────────────────────────────────────────
  'an.receivedOn': 'shundan {amount} {date} kuni kelgan',
  'an.countsIn': '{date} kuni kelgan {amount} {month} oyiga hisoblandi',
  'an.receivedOnMany': 'shundan {amount} boshqa oylarda kelgan',
  'an.countsInMany': 'bu oyda kelgan {amount} boshqa oylarga hisoblandi',
  'an.sources': 'Manbalar',

  // ── Chiqim ──────────────────────────────────────────────────────────────────────────────────
  'an.byCategory': 'Turkum boʻyicha',
  'an.perDay': 'kuniga {amount}',
  'an.byToday': 'Bugungacha tafsilotli: {amount}, kutilgan {expected}',
  'an.itemised': 'Tafsilotli: {amount}, kutilgan {expected}',
  'an.itemisedOnly': 'Tafsilotli: {amount}',
  'an.smaller': 'Kichikroqlari ({count})',
  'an.allInHistory': 'Hammasi Tarixda',
  'an.throughMonth': 'Oy davomida',
  'an.table.days': 'Kunlar',
  'an.table.itemised': 'Tafsilotli',
  'an.table.month': 'Oy',
  'an.bankLoan': 'Bank krediti',

  // ── Ajratildi ───────────────────────────────────────────────────────────────────────────────
  'an.group.INVESTMENTS': 'Investitsiyalar',
  'an.group.EMERGENCY': 'Zaxira fondi',
  'an.group.GOALS': 'Maqsadlar',
  'an.group.DONATIONS': 'Xayriya',
  'an.emergencyNoAccount': 'Zaxira fondi (hisobsiz)',
  'an.stocksNoAccount': 'Aksiyalar (hisobsiz)',
  'an.sinceStart': '{month}dan beri ajratildi',
  'an.sinceStartOut': '{month}dan beri jamgʻarmadan olindi: {amount}',
  'an.worthNow': 'Hozirgi qiymati',
  'an.worthNote': '{month}dan oldingi pul va oʻsish ham kiradi.',

  // ── Maqsadlar ───────────────────────────────────────────────────────────────────────────────
  'an.goals.putIn': 'Maqsadlarga qoʻyildi',
  'an.goals.ofAsked': 'soʻralgan: {amount}',
  'an.goals.putOfAsked': '{putIn}, soʻralgan {asked}',
  'an.goals.of': '{value} / {target}',
  'an.goals.month': '{month}: {amount}',
  'an.goals.asksNothing': 'hech narsa soʻramaydi',
  'an.goals.up': '+{amount} qoʻyildi',
  'an.goals.fromSavings': 'jamgʻarmadan {amount}',
  'an.goals.since': '{month}dan beri pul qoʻyilmagan',
  'an.goals.showAll': 'Hammasini koʻrsatish ({count})',
  'an.goals.nothingYet': 'Hali pul qoʻyilmagan',
  'an.goals.by': 'Muddat: {month}',
  'an.goals.empty': 'Hali maqsad yoʻq.',
  'an.goals.noneInMonth': '{month}: maqsad yoʻq.',
  'an.goals.newOnSavings': 'Jamgʻarmalarda yangi maqsad',

  // ── 12 oy ───────────────────────────────────────────────────────────────────────────────────
  'an.year.range': '{count} oy',
  'an.year.rangeOne': '{count} oy',
  'an.year.basisOne': 'oyiga = {count} toʻliq oy oʻrtachasi',
  'an.year.basisMany': 'oyiga = {count} toʻliq oy oʻrtachasi',
  'an.year.aMonth': 'oyiga {amount}',
  'an.year.monthByMonth': 'Oyma-oy',
  'an.year.soFar': 'hozircha',
  'an.year.noEntries': 'yozuv yoʻq',
  'an.year.more': 'yana {count} ta',
  'an.year.inMonths': '{count} oyda',
  'an.open': 'Ochish',
  'an.sheetTitle': '{page} · 12 oy',

  // ── Boʻsh sahifalar ─────────────────────────────────────────────────────────────────────────
  'an.empty.none': 'Hali hech narsa yozilmagan.',
  'an.empty.month': '{month}: hech narsa yozilmagan. Oʻrtachaga kirmaydi.',
}
