import type { en_home } from './en.home'

/** Uzbek for the Home / Savings / forms strings. Partial is fine — missing keys fall back to English. */
export const uz_home: Partial<Record<keyof typeof en_home, string>> = {
  // ── Bosh sahifa: kunlik summa ───────────────────────────────────────────────────────────────
  'home.hero.label': 'Sarflashingiz mumkin',
  'home.hero.perDay': 'kuniga',
  'home.hero.until': '{date} gacha · toʻlovlar, qarzlar va jamgʻarmalardan keyin',
  'home.hero.shortLabel': 'Pul yetmay qoladi',
  'home.hero.shortOn': '{date} kuni — hech narsa sarflamasangiz ham.',
  'home.hero.seeDue': 'Nimalar toʻlanishini koʻrish',
  'home.hero.paceRunsOut': 'Soʻnggi paytda kuniga taxminan {pace} sarflayapsiz. Shu surʼatda pulingiz taxminan {date} kuni tugaydi.',
  'home.hero.paceOk': 'Soʻnggi paytda kuniga taxminan {pace} sarflayapsiz — chegaradan oshmayapsiz.',
  'home.hero.noIncome': 'Oylik daromadingizni kiriting — har kuni qancha sarflash mumkinligini koʻrsataman.',

  'home.how.toggle': 'Bu qanday hisoblanadi?',
  'home.how.have': 'Sizda bor',
  'home.how.comingIn': '{date} gacha keladi',
  'home.how.goingOut': 'Toʻlovlar va qarzlar',
  'home.how.savings': 'Jamgʻarmalar',
  'home.how.result': '= {net} — {days} uchun ≈ kuniga {perDay}',
  'home.how.dayOne': '{count} kun',
  'home.how.dayMany': '{count} kun',
  'home.how.salaryNote': 'Ehtiyot uchun maosh Sozlamalardagi oylik daromaddan koʻp hisoblanmaydi.',

  // ── Yaqin toʻlovlar ─────────────────────────────────────────────────────────────────────────
  'home.upcoming.title': 'Yaqin toʻlovlar',
  'home.upcoming.all': 'Barcha qarz va toʻlovlar',
  'home.upcoming.empty': 'Keyingi 5 haftada toʻlanadigan narsa yoʻq.',
  'home.upcoming.overdue': 'Muddati oʻtgan',
  'home.upcoming.recorded': 'Yozilgan',

  // ── Shu oydagi jamgʻarmalar ─────────────────────────────────────────────────────────────────
  'home.savings.title': 'Shu oydagi jamgʻarmalar',
  'home.savings.open': 'Jamgʻarmalarni ochish',
  'home.savings.ofTarget': '{target} dan {paid}',
  'home.savings.page': 'Jamgʻarmalar',
  'home.savings.thisMonth': 'Shu oy',
  'home.savings.leftCaption': 'shu oy hali yigʻish kerak',
  'home.savings.allDone': 'Shu oydagi jamgʻarmalar toʻliq bajarildi.',
  'home.savings.nothing': 'Shu oy yigʻiladigan narsa yoʻq.',
  'home.savings.addMore': 'Yana qoʻshish',

  // ── Sizda bor ───────────────────────────────────────────────────────────────────────────────
  'home.have.checkedToday': 'Bugun tekshirilgan',
  'home.have.checkedAgoOne': '{days} kun oldin tekshirilgan',
  'home.have.checkedAgo': '{days} kun oldin tekshirilgan',
  'home.have.notChecked': 'Hali tekshirilmagan',

  // ── Yangi maslahatlar ───────────────────────────────────────────────────────────────────────
  'home.s.paceWarning': 'Soʻnggi surʼatingizda (kuniga {pace}) pulingiz taxminan {date} kuni tugaydi. Kuniga {safe} dan oshirmaslikka harakat qiling.',
  'home.s.short': '{date} kuni {amount} yetmay qoladi.',

  // ── Jamgʻarmalar sahifasi ───────────────────────────────────────────────────────────────────
  'home.goals.title': 'Maqsadlar',
  'home.goals.empty': 'Uy, mashina yoki sayohat uchun yigʻyapsizmi? Uni maqsad sifatida qoʻshing.',
  'home.goals.ofTarget': '{target} dan {value}',
  'home.emergency.empty': 'Favqulodda jamgʻarmada hali hech narsa yoʻq.',
  'home.donations.thisYear': '{year}-yilda berilgan',
  'home.list.showAll': 'Hammasini koʻrsatish ({count})',
  'home.list.showLess': 'Kamroq koʻrsatish',

  // ── Qisqa shakllar: maqsad ──────────────────────────────────────────────────────────────────
  'home.goal.addTitle': 'Maqsad qoʻshish',
  'home.goal.editTitle': 'Maqsadni tahrirlash',
  'home.goal.name': 'Nomi',
  'home.goal.namePlaceholder': 'Uy, mashina, sayohat…',
  'home.goal.target': 'Kerakli summa',
  'home.goal.have': 'Menda allaqachon bor',
  'home.goal.haveHelp': 'Bu maqsad uchun oldindan yigʻilgan pul. Hech bir hamyonga tegilmaydi.',
  'home.goal.err.name': 'Maqsadga nom bering.',
  'home.goal.err.target': 'Maqsad uchun qancha kerakligini kiriting.',
  'home.goal.addedToast': 'Maqsad qoʻshildi · {name}',
  'home.goal.savedToast': 'Maqsad saqlandi · {name}',
  'home.goal.confirmDelete': 'Bu maqsad oʻchirilsinmi?',
  'home.goal.deletedToast': 'Maqsad oʻchirildi',

  // ── Qisqa shakllar: investitsiya ────────────────────────────────────────────────────────────
  'home.investment.addedToast': 'Investitsiya qoʻshildi · {name}',

  // ── Hamyon savoli ───────────────────────────────────────────────────────────────────────────
  'home.wallet.from': 'Qayerdan',
  'home.wallet.to': 'Qayerga',
  'home.wallet.split': 'Karta va naqdga boʻlish',
  'home.wallet.noSplit': 'Boʻlmaslik',
  'home.wallet.none': 'Hamyondan emas',
  'home.wallet.noneHelp': 'Pul allaqachon oʻsha yerda edi — hech bir hamyonga tegilmaydi.',
  'home.wallet.alreadyOwn': 'Bu menda allaqachon bor',
  'home.wallet.alreadyOwnHelp': 'Avval sotib olingan — hech bir hamyonga tegilmaydi.',

  // ── Qoʻshish va toʻlash shakllari ───────────────────────────────────────────────────────────
  'home.form.everydaySpending': 'Kundalik xarajat (hamyon tekshiruvidan)',
  'home.form.cashPart': 'Naqd toʻlangan qismi',
  'home.form.cardPart': 'Kartadan: {amount}',
  'home.form.err.splitParts': 'Naqd qismini kiriting — 0 dan koʻp va summadan kam boʻlsin.',
  'home.form.pickCategory': 'Kategoriyani tanlang',
  'home.form.elseSavings': 'Jamgʻarmalar',
  'home.form.usualAmount': 'Odatda {amount}',
  'home.form.useAsUsual': 'Bundan buyon {amount} odatiy summa boʻlsin',
  'home.form.suggested': 'Shu oy: {amount}.',
  'home.form.fundName': 'Jamgʻarma nomi',
  'home.form.bank.none': 'Hali oylik toʻlovi belgilangan bank krediti yoʻq. Uni «Qarz va toʻlovlar» boʻlimida qoʻshing.',
  'home.form.loan.title': 'Qarzni qaytarish',
  'home.form.loan.pick': 'Kimga toʻlayapsiz?',
  'home.form.loan.thisMonth': 'Shu oy',
  'home.form.repay.returnedTitle': 'Sizga qaytarilgan pul',
  'home.form.repay.leftToPay': 'Toʻlash qoldi: {amount}',
  'home.form.repay.stillOwedToYou': 'Sizga hali qarz: {amount}',
  'home.form.repay.leftAfter': 'Shundan keyin toʻlash qoladi: {amount}',
  'home.form.repay.stillOwedAfter': 'Shundan keyin sizga hali qarz: {amount}',

  // ── Hamyonlarni tekshirish ──────────────────────────────────────────────────────────────────
  'home.checkIn.title': 'Hamyonlarni tekshirish · {date}',
  'home.checkIn.intro': 'Har bir hamyonda hozir aslida qancha borligini kiriting. Ilova hisobidan farqi kundalik xarajat sifatida saqlanadi.',
  'home.checkIn.locked': 'Bu oyni endi oʻzgartirib boʻlmaydi.',
}
