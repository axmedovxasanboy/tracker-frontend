import type { en_fixes } from './en.fixes'

/** Uzbek for the usability-fix strings. Not partial: a missing key is a compile error. */
export const uz_fixes: Record<keyof typeof en_fixes, string> = {

  // ── The word list ─────────────────────────────────────────────────────────────────────────────
  'action.new': 'Yangi',
  'fix.give': 'Xayriya qilish',
  'fix.giveMore': 'Yana xayriya qilish',
  'fix.given': 'Xayriya',
  'fix.setAside': 'Ajratildi',
  'fix.whatKind': 'Qanday turi',
  'fix.s.give': '{amount} xayriya qiling',

  // ── Analytics: saved and given apart ──────────────────────────────────────────────────────────
  'fix.savedGiven': 'Jamgʻarildi {saved} · Xayriya {given}.',

  // ── Profile ───────────────────────────────────────────────────────────────────────────────────
  'fix.profile.lead': 'Shu oy: {total} ajrating — {base} ning {percent}%.',
  'fix.profile.leadCarried': 'Yana oldingi oylardan qolgan {amount}.',
  'fix.profile.leadNone': 'Shu oy hech narsa ajratish soʻralmaydi.',
  'fix.profile.levelLine': 'Toʻlovlardan keyin oyiga {amount} qoladi · {n}-daraja: {next} dan',
  'fix.profile.payFor': '{month} uchun maosh',

  // ── Goals: plans and wishes ───────────────────────────────────────────────────────────────────
  'fix.goals.plans': 'Rejalar',
  'fix.goals.wishes': 'Orzular',
  'fix.goals.noPlans': 'Hali reja yoʻq. Orzuga oylik toʻlov belgilansa, u rejaga aylanadi.',
  'fix.goals.doesNotFit': 'Rejalar oyiga {goals} soʻraydi. Bonussiz oyda toʻlovlar, qarzlar va ajratiladigan puldan keyin {room} qoladi.',
  'fix.goals.tight': 'Rejalardan keyin yashashga oyiga {left} qoladi — siz taxminan {pace} sarflaysiz.',
  'fix.goal.status.doesNotFit': 'Daromadingizga sigʻmaydi',
  'fix.goal.makeWish': 'Orzuga aylantirish',
  'fix.goal.makePlan': 'Rejaga aylantirish',
  'fix.goal.nowWish': '{name} endi orzu — u uchun hech narsa ajratilmaydi.',
  'fix.goal.nowPlan': '{name} yana reja — oyiga {amount}.',
  'fix.goal.kind': 'Reja yoki orzu',
  'fix.goal.kind.plan': 'Reja',
  'fix.goal.kind.wish': 'Orzu',
  'fix.goal.kind.planHelp': 'Oylik toʻlovi bor. Har oy u uchun pul ajratiladi.',
  'fix.goal.kind.wishHelp': 'Roʻyxatda turadi. Rejaga aylantirmaguningizcha hech narsa soʻramaydi.',
  'fix.goal.tooMuch': 'Bu bilan rejalar oddiy oyda boridan oyiga {amount} koʻp soʻraydi.',

  // ── Loans & bills ─────────────────────────────────────────────────────────────────────────────
  'fix.loans.leftToRepay': 'Qaytarish kerak',
  'fix.loans.toRepayFast': 'shundan {amount} tez qaytariladi',
  'fix.owed.loansOne': '{count} ta qarz',
  'fix.owed.loansMany': '{count} ta qarz',
  'fix.people.title': 'Odamlar',

  // ── The phone's bottom bar ────────────────────────────────────────────────────────────────────
  'fix.nav.more': 'Yana',
  'fix.nav.bar': 'Asosiy boʻlimlar',

  // ── Home: the daily figure when the pace cannot be kept ───────────────────────────────────────
  'fix.hero.overLabel': 'Shu surʼatda pul tugaydi',
  'fix.hero.causeGoals': 'Rejalaringiz {until} gacha {goals} oladi. Ularsiz kuniga {safe} sarflashingiz mumkin edi.',
  'fix.hero.causeSavings': 'Ajratiladigan pul {until} gacha {savings} oladi. Usiz: kuniga {safe}.',
  'fix.hero.causePace': 'Kuniga taxminan {pace} sarflayapsiz. Hech narsa ajratmasangiz ham, kuniga faqat {safe} ga joy bor.',
  'fix.hero.paceOnly': 'Kuniga taxminan {pace} sarflayapsiz.',
  'fix.hero.toReach': '{until} gacha yetishi uchun: kuniga {safe}.',
  'fix.hero.reviewPlans': 'Rejalarni koʻrib chiqish',

  // ── A normal month with nothing left, or already short, before the plans ──────────────────────
  'fix.goals.doesNotFitNone': 'Rejalar oyiga {goals} soʻraydi. Bonussiz oyda toʻlovlar, qarzlar va ajratiladigan puldan keyin hech narsa qolmaydi.',
  'fix.goals.doesNotFitShort': 'Rejalar oyiga {goals} soʻraydi. Bonussiz oyda toʻlovlar, qarzlar va ajratiladigan puldan keyin — rejalarsiz ham — {amount} yetmaydi.',
  'fix.goals.tightNone': 'Rejalardan keyin bonussiz oyda yashashga hech narsa qolmaydi — siz taxminan {pace} sarflaysiz.',
  'fix.goal.noRoom': 'Bonussiz oyda toʻlovlar, qarzlar va ajratiladigan puldan keyin reja uchun hech narsa qolmaydi.',
  'fix.goal.noRoomShort': 'Bonussiz oyda rejalarsiz ham {amount} yetmaydi.',

  // ── History: one row per move, one per wallet check, loans in words ───────────────────────────
  'fix.history.moved': 'Pul koʻchirildi',
  'fix.history.from': 'qayerdan: {wallet}',
  'fix.history.to': 'qayerga: {wallet}',
  'fix.history.check': 'Hamyon tekshiruvi',
  'fix.history.checkShort': '{amount} tafsilotsiz',
  'fix.history.checkMore': 'kutilgandan {amount} koʻp',
  'fix.history.checkEven': 'farq yoʻq',
  'fix.history.walletsMany': '{count} ta hamyon',
  'fix.history.returned': 'Sizga qaytarildi: {amount}',
  'fix.chip.borrowed': 'Qarz olindi',
  'fix.chip.lent': 'Qarz berildi',
  'fix.chip.paidBack': 'Qaytarildi',
  'fix.chip.loanPayment': 'Qarz toʻlovi',
  'fix.history.notItemised': 'tafsilotsiz',
  'fix.history.more': 'kutilgandan koʻp',

  // ── Monthly income by month ───────────────────────────────────────────────────────────────────
  'fix.income.from': 'Qaysi oydan boshlab?',
  'fix.income.fromNote': 'Undan oldingi oylarning maqsadlari oʻzgarmaydi.',
  'fix.income.entry': '{amount} — {month} dan',
  'fix.income.remove': '{month} dagi {amount} ni olib tashlash',
  'fix.income.removeConfirm': '{month} dan boshlab oylar bundan oldingi summaga qaytadi.',
  'fix.income.removeTitle': 'Bu oʻzgarish olib tashlansinmi?',
  'fix.income.removed': 'Olib tashlandi. {month} dan: {amount}.',
  'fix.income.savedFrom': 'Saqlandi: {amount} — {month} dan.',
}
