import type { en } from './en'

/**
 * Uzbek. Partial dictionaries are fine — anything missing falls back to English.
 * Apostrophes here are U+02BB (ʻ), the same glyph uz.pages.ts and uz.components.ts use.
 */
export const uz: Partial<Record<keyof typeof en, string>> = {
  // ── Navigatsiya ─────────────────────────────────────────────────────────
  'nav.home': 'Bosh sahifa',
  'nav.plan': 'Reja',
  'nav.months': 'Oylar',
  'nav.transactions': 'Tranzaksiyalar',
  'nav.wallets': 'Hamyonlar',
  'nav.finance': 'Moliya',
  'nav.categories': 'Kategoriyalar',
  'nav.settings': 'Sozlamalar',
  'nav.developer': 'Dasturchi',
  'nav.openMenu': 'Menyuni ochish',
  'nav.skipToContent': 'Asosiy qismga oʻtish',
  'nav.signedInAs': 'Kirgan foydalanuvchi',
  'nav.logout': 'Chiqish',
  // Oʻzbekchada son plural yasamaydi — ikkala shakl ham bir xil.
  'nav.thisMonth': 'Shu oy',
  'nav.monthClosesInOne': 'Yopilishiga {count} kun qoldi',
  'nav.monthClosesInMany': 'Yopilishiga {count} kun qoldi',
  'nav.monthClosesToday': 'Bugun yopiladi',
  'nav.online': 'Server ulangan',
  'nav.offline': 'Server oʻchiq',
  'nav.language': 'Til',

  // Eskirgan nomlar — yuqoridagi asosiy kalitlar bilan bir xil soʻzlar.
  'nav.dashboard': 'Bosh sahifa',
  'nav.overview': 'Reja',
  'nav.cards': 'Hamyonlar',

  // ── Umumiy amallar ──────────────────────────────────────────────────────
  'action.save': 'Saqlash',
  'action.cancel': 'Bekor qilish',
  'action.delete': 'Oʻchirish',
  'action.edit': 'Tahrirlash',
  'action.add': 'Qoʻshish',
  'action.create': 'Yaratish',
  'action.update': 'Yangilash',
  'action.close': 'Yopish',
  'action.confirm': 'Tasdiqlash',
  'action.back': 'Orqaga',
  'action.clear': 'Tozalash',
  'action.clearFilters': 'Filtrlarni tozalash',
  'action.record': 'Qoʻshish',
  'action.history': 'Tarix',
  'action.saving': 'Saqlanmoqda…',
  'action.transfer': 'Oʻtkazma',
  'action.openSettings': 'Sozlamalarni ochish',

  // ── Umumiy interfeys soʻzlari ───────────────────────────────────────────
  'ui.error.title': 'Serverga ulanib boʻlmadi',
  'ui.error.retry': 'Qayta urinish',
  'ui.error.body': '{message}',
  'ui.loading': 'Yuklanmoqda…',
  'ui.more': 'Yana',
  'ui.moreOptions': 'Qoʻshimcha sozlamalar',
  'ui.actions': 'Amallar',
  'ui.close': 'Yopish',
  'ui.locked': 'Hozircha mavjud emas',
  'ui.discard.title': 'Yozuv bekor qilinsinmi?',
  'ui.discard.body': 'Saqlanmagan oʻzgarishlar bor. Yopsangiz yoʻqoladi.',
  'ui.discard.confirm': 'Bekor qilish',
  'ui.discard.cancel': 'Tahrirni davom ettirish',
  'ui.scope.target': 'Maqsad',
  'ui.scope.paid': 'Toʻlangan',
  'ui.scope.setAside': 'Ajratilgan',
  'ui.scope.left': 'Qoldi',
  'ui.scope.allTime': 'Butun davr',
  'ui.scope.thisMonth': 'Shu oy',
  'ui.status.done': 'Bajarildi',
  'ui.status.ahead': '+{amount} ortiqcha',
  'ui.status.due': 'Yana {amount}',
  'ui.exactValue': 'Aniq: {value}',

  // ── Tasdiqlash oynasi / bildirishnoma sarlavhalari ──────────────────────
  'confirm.title': 'Ishonchingiz komilmi?',
  'confirm.deleteTitle': 'Oʻchirilsinmi?',
  'toast.error': 'Xatolik yuz berdi',
  'toast.success': 'Bajarildi',
  'toast.warning': 'Diqqat',
  'toast.info': 'Eslatma',

  // ── Soʻrov xatolari ─────────────────────────────────────────────────────
  'error.network': 'Server javob bermadi. Ulanishni tekshirib, qayta urinib koʻring.',
  'error.requestFailed': 'Soʻrov bajarilmadi ({status})',

  // ── Sahifa nomlari ──────────────────────────────────────────────────────
  'page.home': 'Bosh sahifa',
  'page.plan': 'Reja',
  'page.transactions': 'Tranzaksiyalar',
  'page.wallets': 'Hamyonlar',
  'page.categories': 'Kategoriyalar',
  'page.finance': 'Moliya',
  'page.months': 'Oylar',
  'page.settings': 'Sozlamalar',
  'page.developer': 'Dasturchi',
  'page.investments': 'Investitsiyalar',
  'page.donations': 'Xayriyalar',
  'page.emergencies': 'Favqulodda jamgʻarma',

  // Eskirgan sahifa nomlari — yuqoridagilar bilan bir xil.
  'page.dashboard': 'Bosh sahifa',
  'page.overview': 'Reja',
  'page.cards': 'Hamyonlar',

  // ── Bosh sahifaning ikki boʻlimi ────────────────────────────────────────
  'page.home.tabSummary': 'Xulosa',
  'page.home.tabActivity': 'Kirim-chiqim',
  'page.home.difference': 'Farq',
  'page.home.range': '{from} – {to} {year}',
  'page.home.rangeOne': '{month} {year}',

  // ── Tranzaksiyalar ──────────────────────────────────────────────────────
  'tx.addTransaction': 'Tranzaksiya qoʻshish',
  'tx.addIncome': 'Daromad',
  'tx.addExpense': 'Xarajat',
  'tx.addOther': 'Boshqa qoʻshish',
  'tx.editTransaction': 'Tranzaksiyani tahrirlash',
  'tx.newTransaction': 'Yangi tranzaksiya',
  'tx.none': 'Tranzaksiyalar topilmadi',
  'tx.noneYet': 'Hali hech narsa yozilmagan',
  'tx.noneYetAction': 'Birinchi xarajatingizni qoʻshing',
  'tx.records': '{count} ta yozuv',
  'tx.record': '{count} ta yozuv',
  'tx.date': 'Sana',
  'tx.description': 'Tavsif',
  'tx.category': 'Kategoriya',
  'tx.amount': 'Summa',
  'tx.currency': 'Valyuta',
  'tx.note': 'Izoh',
  'tx.type': 'Turi',
  'tx.income': 'Daromad',
  'tx.expense': 'Xarajat',
  'tx.split': 'Boʻlingan',
  'tx.cash': 'Naqd',
  'tx.card': 'Karta',
  'tx.both': 'Ikkalasi',
  'tx.saved': 'Tranzaksiya saqlandi',
  'tx.updated': 'Tranzaksiya yangilandi',
  'tx.confirmDelete': 'Bu tranzaksiya oʻchirilsinmi?',

  // ── Kategoriyalar ───────────────────────────────────────────────────────
  'cat.name': 'Nomi',
  'cat.nameEn': 'Nomi (inglizcha)',
  'cat.nameUz': 'Nomi (oʻzbekcha)',
  'cat.nameUzHint': 'Ilova oʻzbek tilida boʻlganda koʻrsatiladi. Boʻsh qoldirsangiz inglizcha nomi ishlatiladi.',
  'cat.addCategory': 'Kategoriya qoʻshish',
  'cat.addSub': '"{name}" uchun ichki kategoriya qoʻshish',
  'cat.edit': '"{name}" ni tahrirlash',
  'cat.subOf': 'Ichki kategoriyasi:',
  'cat.none': 'Hozircha kategoriya yoʻq',
  'cat.confirmDelete': 'Bu kategoriya oʻchirilsinmi? Tranzaksiyalari kategoriyasiz qoladi.',

  // ── Taqsimot koʻrinishi ─────────────────────────────────────────────────
  'alloc.countsToward': 'Quyidagiga hisoblanadi:',
  'alloc.target': 'Maqsad',
  'alloc.paidSoFar': 'Hozirgacha toʻlangan',
  'alloc.afterThis': 'Shundan keyin',

  // ── Daromad sharti ──────────────────────────────────────────────────────
  'income.requiredTitle': 'Avval oylik daromadingizni kiriting.',
  'income.requiredBody': 'Odatdagi oylik daromadingiz. Tracker qancha ajratish kerakligini shundan hisoblaydi — u kiritilmaguncha hech narsa yozilmaydi.',
  'income.requiredAction': 'Sozlash',

  // ── Grafik uchun oy nomlari ─────────────────────────────────────────────
  'month.short.1': 'Yan',
  'month.short.2': 'Fev',
  'month.short.3': 'Mar',
  'month.short.4': 'Apr',
  'month.short.5': 'May',
  'month.short.6': 'Iyn',
  'month.short.7': 'Iyl',
  'month.short.8': 'Avg',
  'month.short.9': 'Sen',
  'month.short.10': 'Okt',
  'month.short.11': 'Noy',
  'month.short.12': 'Dek',

  // ── Boshqa ──────────────────────────────────────────────────────────────
  'common.loading': 'Yuklanmoqda…',
  'common.none': '—',
  'common.all': 'Barchasi',
  'common.yes': 'Ha',
  'common.no': 'Yoʻq',
  'common.required': 'majburiy',
  'common.optional': 'ixtiyoriy',
}
