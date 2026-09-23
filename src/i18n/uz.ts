import type { en } from './en'

/**
 * Uzbek. Partial dictionaries are fine — anything missing falls back to English.
 * Apostrophes here are U+02BB (ʻ), the same glyph uz.pages.ts and uz.components.ts use.
 */
export const uz: Partial<Record<keyof typeof en, string>> = {
  // ── Navigatsiya ─────────────────────────────────────────────────────────
  'nav.home': 'Bosh sahifa',
  'nav.wallets': 'Hamyonlar',
  'nav.categories': 'Kategoriyalar',
  'nav.settings': 'Sozlamalar',
  'nav.openMenu': 'Menyuni ochish',
  'nav.skipToContent': 'Asosiy qismga oʻtish',
  'nav.signedInAs': 'Kirgan foydalanuvchi',
  'nav.logout': 'Chiqish',
  'nav.offline': 'Server oʻchiq',
  'nav.language': 'Til',

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
  'action.clearFilters': 'Filtrlarni tozalash',
  'action.history': 'Tarix',
  'action.saving': 'Saqlanmoqda…',
  'action.transfer': 'Oʻtkazma',

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
  'ui.status.done': 'Bajarildi',

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
  'page.wallets': 'Hamyonlar',
  'page.categories': 'Kategoriyalar',
  'page.settings': 'Sozlamalar',
  'page.developer': 'Dasturchi',
  'page.donations': 'Xayriyalar',

  // ── Tranzaksiyalar ──────────────────────────────────────────────────────
  'tx.none': 'Tranzaksiyalar topilmadi',
  'tx.date': 'Sana',
  'tx.description': 'Tavsif',
  'tx.category': 'Kategoriya',
  'tx.amount': 'Summa',
  'tx.note': 'Izoh',
  'tx.type': 'Turi',
  'tx.income': 'Daromad',
  'tx.expense': 'Xarajat',
  'tx.cash': 'Naqd',
  'tx.card': 'Karta',
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

  // ── Daromad sharti ──────────────────────────────────────────────────────
  'income.requiredTitle': 'Avval oylik daromadingizni kiriting.',
  'income.requiredBody': 'Odatdagi oylik daromadingiz. Tracker qancha ajratish kerakligini shundan hisoblaydi — u kiritilmaguncha hech narsa yozilmaydi.',
  'income.requiredAction': 'Sozlash',

  // ── Boshqa ──────────────────────────────────────────────────────────────
  'common.optional': 'ixtiyoriy',
}
