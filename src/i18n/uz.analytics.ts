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
  'analytics.tab.yearLockReason': 'Ikki oylik yozuv kerak',
  'analytics.tab.yearLocked': '{month} oyida birinchi yozuv boʻlganda ochiladi.',
  'analytics.tab.yearLockedNoData': 'Ikki oyda yozuv boʻlganda ochiladi.',
  'analytics.backToMonth': 'Qaytish: {month}',
  'analytics.period.last12': 'Soʻnggi 12 oy',
  'analytics.outdated': 'Tahlilni koʻrish uchun serverni yangilang.',
  'analytics.fromHistory': '{month} — Tahlilda koʻrish',
  'analytics.seeHistory': '{month} — Tarixda koʻrish',
  'analytics.shareOfIn': 'Kirimning {percent}%',
  'analytics.perMonth': 'Oyiga taxminan {amount}',

  // ── Pul ketadigan toʻrt joy va qolgani ──────────────────────────────────────────────────────
  'analytics.group.everyday': 'Kundalik xarajatlar',
  'analytics.group.bills': 'Toʻlovlar',
  'analytics.group.loans': 'Qarz toʻlovlari',
  'analytics.group.leftOver': 'Ortib qoldi',

  // ── A. Davr bir qatorda ─────────────────────────────────────────────────────────────────────
  'analytics.a.leftOver': '{period} · ortib qoldi',
  'analytics.a.short': '{period} · yetmadi',
  'analytics.a.empty': 'Hech narsa yozilmagan.',
  'analytics.a.justStarted': 'Oy endi boshlandi.',
  'analytics.a.seeMonth': '{month} oyini koʻrish',
  'analytics.a.pay': 'Maosh',
  'analytics.a.bonus': 'Bonus',
  'analytics.a.otherIncome': 'Boshqa daromad',
  'analytics.a.moreThanIn': 'Kirimdan {amount} koʻp',
  'analytics.a.withoutBonus': 'Bonussiz: {amount} yetmas edi.',
  'analytics.a.withoutBonusRange': 'Bonuslarsiz: {amount} yetmas edi.',
  'analytics.a.outMore': 'Chiqim: {month} oyidan {amount} koʻp.',
  'analytics.a.outLess': 'Chiqim: {month} oyidan {amount} kam.',
  'analytics.a.outSame': 'Chiqim: {month} oyi bilan deyarli bir xil.',
  'analytics.a.alsoMoved': 'Daromad ham, xarajat ham emas:',
  'analytics.a.borrowed': 'Qarz olindi {amount}',
  'analytics.a.lent': 'Qarz berildi {amount}',
  'analytics.a.returned': 'Sizga qaytarildi {amount}',
  'analytics.a.fromSavings': 'Jamgʻarmadan olindi {amount}',
  'analytics.a.notYetOne': 'Keyingi sanadagi {count} ta yozuv hali hisobga olinmagan.',
  'analytics.a.notYet': 'Keyingi sanadagi {count} ta yozuv hali hisobga olinmagan.',
  'analytics.a.how.borrowed': 'Qarz olindi',
  'analytics.a.how.lent': 'Qarz berildi',
  'analytics.a.how.returned': 'Sizga qaytarildi',
  'analytics.a.how.fromSavings': 'Jamgʻarmadan olindi',
  'analytics.a.walletsChanged': 'Hamyonlaringizdagi oʻzgarish',
  'analytics.a.perMonth': 'Oyiga: kirim {in}, chiqim {out}.',

  // ── B. Kundalik xarajatlar ──────────────────────────────────────────────────────────────────
  'analytics.b.uncategorised': 'Kategoriyasiz',
  'analytics.b.notItemised': 'Tafsilotsiz',
  'analytics.b.notItemisedHint': 'hamyon tekshiruvidan',
  'analytics.b.more': '{month} oyidagidan {amount} koʻp',
  'analytics.b.less': '{month} oyidagidan {amount} kam',
  'analytics.b.seeInHistory': 'Bularni Tarixda koʻrish',
  'analytics.b.empty': 'Xarajat yoʻq.',

  // ── C. Oy davomida ──────────────────────────────────────────────────────────────────────────
  'analytics.c.title': 'Oy davomida',
  'analytics.c.perDay': 'Kuniga {amount}',
  'analytics.c.plainOne': '{count} kunda {amount} kundalik xarajat.',
  'analytics.c.plain': '{count} kunda {amount} kundalik xarajat.',
  'analytics.c.lessThan': '{date} holatiga: {month} oyidan {amount} kam.',
  'analytics.c.moreThan': '{date} holatiga: {month} oyidan {amount} koʻp.',
  'analytics.c.sameAs': '{date} holatiga: {month} oyi bilan deyarli bir xil.',
  'analytics.c.spentThatDay': 'shu kuni sarflandi',
  'analytics.c.soFar': 'Shu kungacha',
  'analytics.c.includesCheck': 'shundan {amount} hamyon tekshiruvidan',
  'analytics.c.biggestDays': 'Eng koʻp sarflangan kunlar',
  'analytics.c.showNumbers': 'Raqamlarni koʻrsatish',
  'analytics.c.colDays': 'Kunlar',
  'analytics.c.colSpent': 'Sarflandi',

  // ── C′. Oyma-oy ─────────────────────────────────────────────────────────────────────────────
  'analytics.m.title': 'Oyma-oy',
  'analytics.m.someOver': 'Chiqim kirimdan koʻp: {m} oydan {n} tasida.',
  'analytics.m.noneOver': 'Har oy chiqim kirimdan kam.',
  'analytics.m.soFar': 'hozircha',
  'analytics.m.colMonth': 'Oy',
  'analytics.m.unit': 'Summalar UZS da',
  'analytics.m.open': 'Ochish: {month}',

  // ── D. Toʻlovlar va qarzlar ─────────────────────────────────────────────────────────────────
  'analytics.d.title': 'Toʻlovlar va qarzlar',
  'analytics.d.meter': 'Oylik maosh {income} dan {paid}',
  'analytics.d.overPay': 'Oylik maoshdan koʻp.',
  'analytics.d.kind.bill': 'oylik toʻlov',
  'analytics.d.kind.bank': 'bank krediti',
  'analytics.d.kind.monthly': 'oylik qarz',
  'analytics.d.kind.asap': 'tez qaytariladigan',
  'analytics.d.open': 'Qarzlar va toʻlovlarni ochish',
  'analytics.d.empty': 'Toʻlov yoki qarz toʻlovi yoʻq.',

  // ── E. Jamgʻarildi ──────────────────────────────────────────────────────────────────────────
  'analytics.e.empty': 'Hech narsa jamgʻarilmagan.',

  // ── F. Eng katta xaridlar ───────────────────────────────────────────────────────────────────
  'analytics.f.title': 'Eng katta xaridlar',
  'analytics.f.empty': 'Xarid yoʻq.',

  // ── G. Mulk va qarzlar ──────────────────────────────────────────────────────────────────────
  'analytics.g.title': 'Mulk va qarzlar',
  'analytics.g.net': 'Mulk minus qarzlar',
  'analytics.g.own': 'Mulkingiz',
  'analytics.g.leftToRepay': 'Qaytarish kerak',
  'analytics.g.owedToYou': 'Sizga qarzdorlar: {amount}',
  'analytics.g.paidOffBy': 'oyiga {monthly} · {month} gacha',
  'analytics.g.unknown': 'summa nomaʼlum',
  'analytics.g.notCounting': '{names} hisobga olinmagan (summa nomaʼlum)',
}
