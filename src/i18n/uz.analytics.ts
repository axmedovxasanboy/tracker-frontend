import type { en_analytics } from './en.analytics'

/**
 * Uzbek for the Analytics page. NOT partial, unlike the older dictionaries: the type makes a
 * missing key a compile error, so the two key sets cannot drift apart.
 *
 * Kirim / Chiqim / Jamgʻarildi come from `shell.history.*`, as in English.
 */
export const uz_analytics: Record<keyof typeof en_analytics, string> = {
  // ── Navigatsiya va davr ─────────────────────────────────────────────────────────────────────
  'shell.nav.analytics': 'Tahlil',
  'analytics.tab.month': 'Oy',
  'analytics.tab.year': '12 oy',
  'analytics.tab.yearLockReason': 'Taqqoslash uchun ikki oy boʻlganda ochiladi',
  'analytics.tab.yearLocked': 'Hozircha bitta oy bor. Oyma-oy taqqoslash {month} oyida birinchi yozuv paydo boʻlganda boshlanadi.',
  'analytics.tab.yearLockedNoData': 'Hali hech narsa yozilmagan. Oyma-oy taqqoslash ikki oyda yozuv boʻlganda boshlanadi.',
  'analytics.backToMonth': 'Qaytish: {month}',
  'analytics.period.last12': 'Soʻnggi 12 oy',
  'analytics.period.last12Text': 'soʻnggi 12 oy',
  'analytics.outdated': 'Tahlilni koʻrish uchun serverni yangilang.',
  'analytics.fromHistory': '{month} — Tahlilda koʻrish',
  'analytics.seeHistory': '{month} — Tarixda koʻrish',
  'analytics.shareOfIn': 'Kirimning {percent}%.',
  'analytics.perMonth': 'Oyiga taxminan {amount}.',

  // ── Pul ketadigan toʻrt joy va qolgani ──────────────────────────────────────────────────────
  'analytics.group.everyday': 'Kundalik xarajatlar',
  'analytics.group.bills': 'Toʻlovlar',
  'analytics.group.loans': 'Qarz toʻlovlari',
  'analytics.group.leftOver': 'Ortib qoldi',

  // ── A. Davr bir qatorda ─────────────────────────────────────────────────────────────────────
  'analytics.a.leftOver': '{period} · ortib qoldi',
  'analytics.a.short': '{period} · yetmadi',
  'analytics.a.kept': 'Kelgan {in} dan {amount} ortib qoldi.',
  'analytics.a.even': 'Kelgan pulning hammasi sarflandi yoki jamgʻarildi.',
  'analytics.a.over': 'Kelgan puldan {amount} koʻp sarfladingiz va jamgʻardingiz.',
  'analytics.a.overSpent': 'Kelgan puldan {amount} koʻp sarfladingiz.',
  'analytics.a.empty': '{month}: hech narsa yozilmagan.',
  'analytics.a.justStarted': '{month} endi boshlandi.',
  'analytics.a.seeMonth': '{month} oyini koʻrish',
  'analytics.a.pay': 'Maosh',
  'analytics.a.bonus': 'Bonus',
  'analytics.a.otherIncome': 'Boshqa daromad',
  'analytics.a.moreThanIn': 'Kirimdan {amount} koʻp',
  'analytics.a.withoutBonus': 'Bonus boʻlmaganida bu oy {amount} yetmas edi.',
  'analytics.a.withoutBonusRange': 'Bonuslar boʻlmaganida bu oylarda {amount} yetmas edi.',
  'analytics.a.outMore': 'Chiqim {month} oyidagidan {amount} koʻp.',
  'analytics.a.outLess': 'Chiqim {month} oyidagidan {amount} kam.',
  'analytics.a.outSame': 'Chiqim {month} oyidagi bilan deyarli bir xil.',
  'analytics.a.alsoMoved': 'Bular ham boʻldi (daromad yoki xarajat hisoblanmaydi):',
  'analytics.a.borrowed': 'Qarz olindi {amount}',
  'analytics.a.lent': 'Qarz berildi {amount}',
  'analytics.a.returned': 'Sizga qaytarildi {amount}',
  'analytics.a.fromSavings': 'Jamgʻarmadan olindi {amount}',
  'analytics.a.notYetOne': 'Shu oyning keyingi sanalariga yozilgan {count} ta yozuv hali hisobga olinmagan.',
  'analytics.a.notYet': 'Shu oyning keyingi sanalariga yozilgan {count} ta yozuv hali hisobga olinmagan.',
  'analytics.a.how.borrowed': 'Qarz olindi',
  'analytics.a.how.lent': 'Qarz berildi',
  'analytics.a.how.returned': 'Sizga qaytarildi',
  'analytics.a.how.fromSavings': 'Jamgʻarmadan olindi',
  'analytics.a.walletsChanged': 'Hamyonlaringizdagi oʻzgarish',
  'analytics.a.perMonth': 'Oyiga taxminan {in} kirdi, {out} chiqdi.',
  'analytics.a.goTo': 'Tafsilotlarni pastda koʻrsatish',

  // ── B. Kundalik xarajatlar ──────────────────────────────────────────────────────────────────
  'analytics.b.biggest': 'Eng katta qismi — {category}: {amount}.',
  'analytics.b.uncategorised': 'Kategoriyasiz',
  'analytics.b.notItemised': 'Tafsilotsiz',
  'analytics.b.notItemisedHint': 'hamyon tekshiruvida topilgan — tafsiloti yoʻq',
  'analytics.b.more': '{month} oyidagidan {amount} koʻp',
  'analytics.b.less': '{month} oyidagidan {amount} kam',
  'analytics.b.seeInHistory': 'Bularni Tarixda koʻrish',
  'analytics.b.empty': '{month}: xarajat yoʻq.',

  // ── C. Oy davomida ──────────────────────────────────────────────────────────────────────────
  'analytics.c.title': 'Oy davomida',
  'analytics.c.perDay': 'Kuniga taxminan {amount}',
  'analytics.c.plainOne': '{count} kunda {amount} kundalik xarajat.',
  'analytics.c.plain': '{count} kunda {amount} kundalik xarajat.',
  'analytics.c.lessThan': '{date} holatiga {month} oyining shu kunidagidan {amount} kam sarfladingiz.',
  'analytics.c.moreThan': '{date} holatiga {month} oyining shu kunidagidan {amount} koʻp sarfladingiz.',
  'analytics.c.sameAs': '{date} holatiga {month} oyining shu kunidagi bilan deyarli bir xil sarfladingiz.',
  'analytics.c.spentThatDay': 'shu kuni sarflandi',
  'analytics.c.soFar': 'Shu kungacha',
  'analytics.c.includesCheck': 'shundan {amount} hamyon tekshiruvida topilgan',
  'analytics.c.biggestDays': 'Eng koʻp sarflangan kunlar',
  'analytics.c.showNumbers': 'Raqamlarni koʻrsatish',
  'analytics.c.colDays': 'Kunlar',
  'analytics.c.colSpent': 'Sarflandi',

  // ── C′. Oyma-oy ─────────────────────────────────────────────────────────────────────────────
  'analytics.m.title': 'Oyma-oy',
  'analytics.m.someOver': '{m} oydan {n} tasida kirimdan koʻp chiqdi.',
  'analytics.m.noneOver': 'Hozircha har oy kirimdan kam chiqdi.',
  'analytics.m.soFar': 'hozircha',
  'analytics.m.colMonth': 'Oy',
  'analytics.m.unit': 'Summalar UZS da',
  'analytics.m.open': 'Ochish: {month}',

  // ── D. Toʻlovlar va qarzlar ─────────────────────────────────────────────────────────────────
  'analytics.d.title': 'Toʻlovlar va qarzlar',
  'analytics.d.meter': 'Oylik maoshingiz {income} dan {paid}',
  'analytics.d.overPay': 'Oylik maoshingizdan koʻp.',
  'analytics.d.kind.bill': 'oylik toʻlov',
  'analytics.d.kind.bank': 'bank krediti',
  'analytics.d.kind.monthly': 'oylik qarz',
  'analytics.d.kind.asap': 'tez qaytariladigan',
  'analytics.d.open': 'Qarzlar va toʻlovlarni ochish',
  'analytics.d.empty': '{month}: toʻlov yoki qarz toʻlovi yoʻq.',

  // ── E. Jamgʻarildi ──────────────────────────────────────────────────────────────────────────
  'analytics.e.empty': '{month}: hech narsa jamgʻarilmagan.',

  // ── F. Eng katta xaridlar ───────────────────────────────────────────────────────────────────
  'analytics.f.title': 'Eng katta xaridlar',
  'analytics.f.empty': '{month}: xarid yozilmagan.',

  // ── G. Mulk va qarzlar ──────────────────────────────────────────────────────────────────────
  'analytics.g.title': 'Mulk va qarzlar',
  'analytics.g.net': 'Mulk minus qarzlar',
  'analytics.g.sentence': 'Mulkingiz {own}. Qarzlardan {loans} qaytarilishi kerak.',
  'analytics.g.sentenceNoLoans': 'Mulkingiz {own}. Qaytariladigan qarz yoʻq.',
  'analytics.g.sentenceOwnOnly': 'Mulkingiz {own}.',
  'analytics.g.own': 'Mulkingiz',
  'analytics.g.leftToRepay': 'Qaytarish kerak',
  'analytics.g.owedToYou': 'Sizga qarzdorlar: {amount}',
  'analytics.g.paidOffBy': 'oyiga {monthly} · {month} da toʻliq qaytariladi',
  'analytics.g.unknown': 'qolgan summa nomaʼlum',
  'analytics.g.notCounting': '{names} hisobga olinmagan — qolgan summasi nomaʼlum.',
}
