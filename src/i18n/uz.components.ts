import type { en_components } from './en.components'

/** Uzbek for the components strings. Partial is fine — missing keys fall back to English. */
export const uz_components: Partial<Record<keyof typeof en_components, string>> = {
  // ── Shared vocabulary ─────────────────────────────────────────────────────
  'cmp.field.dateRequired': 'Sana *',
  'cmp.field.amountRequired': 'Summa *',

  'cmp.err.amountPositive': 'Summa noldan katta boʻlishi kerak.',
  'cmp.err.pickCardOrCash': 'Kartani tanlang yoki Naqd usuliga oʻting.',
  'cmp.err.pickCardForPortion': 'Karta qismi uchun kartani tanlang.',
  'cmp.err.cannotExceedRemaining': 'Qolgan miqdordan oshmasligi kerak: {amount}',
  'cmp.err.amountCannotExceedRemaining': 'Summa qolgan miqdordan ({amount}) oshmasligi kerak.',
  'cmp.err.pickLoanToPay': 'Toʻlash uchun qarzni tanlang.',
  'cmp.err.pickBankLoanToPay': 'Toʻlash uchun bank kreditini tanlang.',
  'cmp.err.selectBothCards': 'Ikkala tomonni ham tanlang',
  'cmp.err.cashToCash': 'Kamida bir tomonda karta tanlang — naqddan naqdga oʻtkazish hech narsani oʻzgartirmaydi.',
  'cmp.err.walletsMustDiffer': 'Joʻnatuvchi va qabul qiluvchi har xil boʻlishi kerak',
  'cmp.err.enterValidAmount': 'Toʻgʻri summa kiriting',
  'cmp.err.valueNegative': 'Qiymat manfiy boʻlishi mumkin emas.',
  'cmp.err.nameFund': 'Favqulodda jamgʻarmangizga nom bering.',
  'cmp.err.investmentNameRequired': 'Investitsiya nomi kerak.',

  'cmp.pageHeader.prevMonth': 'Oldingi oy',
  'cmp.pageHeader.nextMonth': 'Keyingi oy',

  'cmp.state.transferring': 'Oʻtkazilmoqda…',

  'cmp.action.topUp': 'Pul qoʻshish',
  'cmp.action.useThis': 'shuni ishlatish',

  // ── Savings names ─────────────────────────────────────────────────────────
  'cmp.bucket.donation': 'Xayriya',
  'cmp.bucket.emergency': 'Favqulodda jamgʻarma',
  'cmp.bucket.investments': 'Investitsiyalar',

  // ── Investment types ──────────────────────────────────────────────────────
  'cmp.investmentType.realEstate': 'Koʻchmas mulk',
  'cmp.investmentType.bonds': 'Obligatsiyalar',
  'cmp.investmentType.mutualFund': 'Investitsiya fondi',
  'cmp.investmentType.gold': 'Oltin',
  'cmp.investmentType.other': 'Boshqa',

  // ── ContributeInvestmentModal ─────────────────────────────────────────────
  'cmp.contributeInvestment.title': '{name} ga qoʻshish',
  'cmp.contributeInvestment.submit': 'Qoʻshish',

  // ── UpdateValueModal ──────────────────────────────────────────────────────
  'cmp.updateValue.title': 'Qiymatni yangilash — {name}',
  'cmp.updateValue.contributedSoFar': 'Hozirgacha kiritilgan:',
  'cmp.updateValue.setCurrentValueHint': 'Joriy bozor qiymatini kiriting (oʻsish/daromadlar bilan birga).',
  'cmp.updateValue.currentValueLabel': 'Joriy qiymat ({currency})',
  'cmp.updateValue.submit': 'Qiymatni yangilash',

  // ── RepaymentModal ────────────────────────────────────────────────────────
  'cmp.repay.title.loanTaken': 'Olingan qarzni qaytarish',
  'cmp.repay.title.debt': 'Qarzni yopish',
  'cmp.repay.full': 'Toʻliq',
  'cmp.repay.recordedToast': 'Qoʻshildi · {amount}',

  // ── PaySubscriptionModal ──────────────────────────────────────────────────
  'cmp.paySubscription.title': '{name} ni toʻlash',

  // ── CheckInModal ──────────────────────────────────────────────────────────
  'cmp.closeMonth.noWallets': 'Solishtirish uchun hamyon yoʻq.',
  'cmp.closeMonth.appThinks': 'Ilova hisobiga koʻra:',
  'cmp.closeMonth.spent': 'Sarflandi ',
  'cmp.closeMonth.surplus': 'Ortiqcha ',
  'cmp.checkIn.recordFirst': 'Biror xaridni eslayapsizmi? Avval uni yozib qoʻying — kundalik xarajatga faqat izohsiz qolgan farq aylanishi kerak.',
  'cmp.checkIn.walletLabel': '{name} — hozirgi qoldiq',
  'cmp.checkIn.matches': 'Mos keladi',
  'cmp.checkIn.willRecord': 'Bu tekshiruv yozadigan kundalik xarajat: {amount}',
  'cmp.checkIn.willRecordSurplus': 'Bu tekshiruv kutilganidan {amount} ortiq pulni yozadi.',
  'cmp.checkIn.willRecordNothing': 'Hammasi mos — hech narsa yozilmaydi.',
  'cmp.checkIn.savedSpent': 'Tekshiruv saqlandi — {amount} kundalik xarajat yozildi.',
  'cmp.checkIn.savedSurplus': 'Tekshiruv saqlandi — kutilganidan {amount} ortiq pul topildi.',
  'cmp.checkIn.savedMatched': 'Tekshiruv saqlandi — hamyonlaringiz allaqachon mos edi.',
  'cmp.checkIn.loadFailed': 'Hamyonlarni yuklab boʻlmadi.',

  // ── PayBankInstallmentModal ───────────────────────────────────────────────
  'cmp.payBankInstallment.title': 'Bank kreditingizni toʻlash',
  'cmp.payBankInstallment.pickLoan': 'Bank kreditini tanlang',
  'cmp.payBankInstallment.perMonth': '{amount} / oyiga',
  'cmp.payBankInstallment.recordedToast': 'Qoʻshildi · bank krediti toʻlovi {amount}',

  // ── PayBucketModal ────────────────────────────────────────────────────────
  'cmp.payBucket.titleDonation': 'Xayriya qoʻshish',
  'cmp.payBucket.titleEmergency': 'Favqulodda jamgʻarmangizga qoʻshish',
  'cmp.payBucket.titleInvestments': 'Investitsiyaga qoʻshish',
  'cmp.payBucket.newEmergencyFundOption': '➕ Yangi favqulodda jamgʻarma…',
  'cmp.payBucket.recipient': 'Qabul qiluvchi',
  'cmp.payBucket.recipientPlaceholder': 'Kimga xayriya qildingiz',
  'cmp.payBucket.anonymous': 'Anonim',
  'cmp.payBucket.fundNamePlaceholder': 'Favqulodda jamgʻarma, yomgʻirli kun uchun va h.k.',
  'cmp.payBucket.investmentNamePlaceholder': 'Apple Inc., Koʻchmas mulk va h.k.',
  'cmp.payBucket.brokerPlatform': 'Broker / Platforma',
  'cmp.payBucket.recordedToast': 'Qoʻshildi · {bucket} {amount}',
  'cmp.payBucket.newInvestmentOption': '➕ Yangi investitsiya…',
  'cmp.payBucket.emergencyFundOption': 'Favqulodda jamgʻarmaga hissa',

  // ── PayPersonalLoanModal ──────────────────────────────────────────────────
  'cmp.payPersonalLoan.noLoans': 'Qolgan qoldigʻi bor shaxsiy qarz yoʻq.',
  'cmp.payPersonalLoan.recordedToast': 'Qoʻshildi · {name} {amount}',

  // ── BalanceTransferModal ──────────────────────────────────────────────────
  'cmp.balanceTransfer.title': 'Balansni oʻtkazish',
  'cmp.balanceTransfer.fromCard': 'Qaysi kartadan *',
  'cmp.balanceTransfer.toCard': 'Qaysi kartaga *',
  'cmp.balanceTransfer.selectCard': 'Kartani tanlang…',
  'cmp.balanceTransfer.fromBalance': 'Manba qoldigʻi',
  'cmp.balanceTransfer.toBalance': 'Maqsad qoldigʻi',
  'cmp.balanceTransfer.exceedsBalance': 'Mavjud qoldiqdan oshadi ({balance})',
  'cmp.balanceTransfer.descriptionPlaceholder': 'masalan: Oylik jamgʻarma oʻtkazmasi',
  'cmp.balanceTransfer.infoPrefix': 'Ikkita tranzaksiya yaratiladi: manba kartada',
  'cmp.balanceTransfer.infoMid': ', maqsad kartada esa',
  'cmp.balanceTransfer.infoSuffix': '. Ikkalasi ham Tarix sahifasida koʻrinadi.',
  'cmp.transfer.success': '{amount} muvaffaqiyatli oʻtkazildi',

  // ── TransactionDetailModal ────────────────────────────────────────────────
  'cmp.txDetail.title': 'Tranzaksiya tafsilotlari',
  'cmp.txDetail.transactionType': 'Tranzaksiya turi',
  'cmp.txDetail.cardWallet': 'Karta / Hamyon',
  'cmp.txDetail.paymentSplit': 'Toʻlov boʻlinishi',
  'cmp.txDetail.created': 'Yaratilgan',
  'cmp.subType.regularIncome': 'Oddiy daromad',
  'cmp.subType.loanReceived': 'Olingan',
  'cmp.subType.loanReturned': 'Berilgan qarz qaytarildi',
  'cmp.subType.regularExpense': 'Oddiy xarajat',
  'cmp.subType.loanGiven': 'Berilgan',
  'cmp.subType.loanRepayment': 'Qarz toʻlovi',
  'cmp.subType.bankLoanPayment': 'Bank krediti toʻlovi',
  'cmp.subType.investment': 'Investitsiya',
  'cmp.subType.donation': 'Xayriya',

  // ── TransactionFilters ────────────────────────────────────────────────────
  'cmp.txFilters.search': 'Qidirish',
  'cmp.txFilters.searchPlaceholder': 'Tavsif boʻyicha qidirish…',
  'cmp.txFilters.allTypes': 'Barcha turlar',
  'cmp.txFilters.allCategories': 'Barcha kategoriyalar',
  'cmp.txFilters.from': 'Boshlanish sanasi',
  'cmp.txFilters.to': 'Tugash sanasi',
  'cmp.txFilters.reset': 'Tozalash',
  'cmp.txFilters.filters': 'Filtrlar',
  'cmp.txFilters.filtersWithCount': 'Filtrlar · {count}',
  'cmp.txFilters.clearAll': 'Hammasini tozalash',
  'cmp.txFilters.removeFilter': 'Filtrni olib tashlash: {label}',
  'cmp.txFilters.searching': 'Qidirilmoqda…',
  'cmp.txFilters.chipType': 'Turi: {value}',
  'cmp.txFilters.chipCategory': 'Kategoriya: {value}',
  'cmp.txFilters.chipCard': 'Faqat bitta karta',
  'cmp.txFilters.chipInvestment': 'Faqat bitta investitsiya',
  'cmp.txFilters.chipFrom': '{date} dan',
  'cmp.txFilters.chipTo': '{date} gacha',

  // ── TransactionModal ──────────────────────────────────────────────────────
  'cmp.txModal.subType.loanReceived': 'Olingan',
  'cmp.txModal.subType.loanReturnedToMe': 'Berilgan qarz qaytarildi',
  'cmp.txModal.subType.loanGiven': 'Berilgan',
  'cmp.txModal.subType.loanRepayment': 'Qarz toʻlovi',
  'cmp.txModal.subType.bankLoanPayment': 'Bank krediti toʻlovi',
  'cmp.txModal.subType.investment': 'Investitsiya',
  'cmp.txModal.subType.donation': 'Xayriya',

  'cmp.txModal.counterparty.lenderName': 'Qarz beruvchi nomi',
  'cmp.txModal.counterparty.debtorName': 'Qarzdor nomi',
  'cmp.txModal.counterparty.borrowerName': 'Qarz oluvchi nomi',
  'cmp.txModal.counterparty.lenderCreditor': 'Qarz beruvchi / Kreditor',
  'cmp.txModal.counterparty.bankName': 'Bank nomi',
  'cmp.txModal.counterparty.assetPlatform': 'Aktiv / Platforma',
  'cmp.txModal.counterparty.recipientName': 'Qabul qiluvchi nomi',
  'cmp.txModal.counterparty.generic': 'Kontragent',

  'cmp.txModal.err.selectCategory': 'Iltimos, kategoriyani tanlang',
  'cmp.txModal.err.selectSubCategory': 'Iltimos, ichki kategoriyani tanlang',
  'cmp.txModal.err.selectInvestment': 'Investitsiyani tanlang yoki "Yangi yaratish"ga oʻting',
  'cmp.txModal.err.selectCardOrSwitch': 'Hamyonni tanlang yoki naqd bilan toʻlang',
  'cmp.txModal.err.fillInField': 'Iltimos, {field} ni toʻldiring',
  'cmp.txModal.err.fieldRequired': '{field} kerak',

  'cmp.txModal.descriptionPlaceholder': 'masalan: {example}',
  'cmp.txModal.descriptionExampleIncome': 'Oylik maosh',
  'cmp.txModal.descriptionExampleExpense': 'Choyxonada tushlik',

  'cmp.txModal.newCategory': 'Yangi kategoriya',
  'cmp.txModal.categoryNamePlaceholder': 'Kategoriya nomi',
  'cmp.txModal.new': 'Yangi',
  'cmp.txModal.subCategoryNamePlaceholder': 'Ichki kategoriya nomi',
  'cmp.txModal.addSubCategory': 'Ichki kategoriya qoʻshish',

  'cmp.txModal.enterNamePlaceholder': 'Ismni kiriting...',
  'cmp.txModal.existingBorrowers': 'Mavjud qarzdorlar',
  'cmp.txModal.anonymousDonationNotice': 'Anonim — qabul qiluvchi saqlanmaydi.',

  'cmp.txModal.addToExisting': 'Mavjudiga qoʻshish',
  'cmp.txModal.createNew': 'Yangi yaratish',
  'cmp.txModal.noInvestmentsYet': 'Hali yoʻq — "Yangi yaratish"ga oʻting.',
  'cmp.txModal.selectAnInvestment': '— Investitsiyani tanlang —',
  'cmp.txModal.investmentType': 'Investitsiya turi',

  'cmp.txModal.insufficientBalance': 'Mablagʻ yetarli emas',

  'cmp.txModal.cardsLoadFailed': 'Kartalaringizni yuklab boʻlmadi',

  // Maydon nomlari — Field yulduzchani oʻzi chizadi, shuning uchun bu yerda yulduzcha yoʻq.
  'cmp.txModal.label.amount': 'Summa',
  'cmp.txModal.label.category': 'Kategoriya',
  'cmp.txModal.label.subCategory': 'Ichki kategoriya',
  'cmp.txModal.label.date': 'Sana',
  'cmp.txModal.label.investment': 'Investitsiya',
  'cmp.txModal.label.direction': 'Kirim yoki chiqim',
  'cmp.txModal.label.whatFor': 'Nima uchun',
  'cmp.txModal.elseTitle': 'Boshqa narsami?',
  'cmp.txModal.elseLoans': 'Qarz va toʻlovlar',
  'cmp.txModal.elseTransfer': 'Pul koʻchirish',
  // Yoʻnalish — shaklning birinchi tugmasi, shuning uchun uni oʻrtada almashtirish odatiy hol:
  // bir qator nima oʻchgani, ikkinchisi nima saqlanib qolgani haqida.
  'cmp.txModal.categoryClearedByDirection': 'Kategoriyani qaytadan tanlang.',
  'cmp.txModal.err.selectDate': 'Sanani tanlang',

  // ── CacheBadge / OfflineBanner ────────────────────────────────────────────
  'cmp.cache.cached': '{time} holatiga koʻra',
  'cmp.offline.backendOffline': 'Server oʻchiq',
  'cmp.offline.showingDataFrom': '— {time} holatidagi maʼlumotlar koʻrsatilmoqda',
  'cmp.offline.noCachedData': '— hozircha keshlangan maʼlumot yoʻq',
  'cmp.offline.retry': 'Qayta urinish',

  // ── ExplainModal va uni ochadigan “… nima?” tugmalari ─────────────────────
  'cmp.cardInfo.button': '“{title}” nima?',
  'cmp.cardInfo.howItsBuilt': 'Qanday hisoblanadi',
  'cmp.cardInfo.theNumbers': 'Ortidagi raqamlar',

  // ── Kartalar sahifasi: hamyon balanslari ──────────────────────────────────
  'cmp.walletInfo.card.title': 'Karta balansi',
  'cmp.walletInfo.card.meaning': 'Har bir kartada hozir qancha pul borligi.',
  'cmp.walletInfo.card.formula': 'Kartani qoʻshganda kiritgan balans, ustiga oʻshandan beri unga yozilgan barcha amallar — daromad qoʻshadi, xarajat ayiradi, koʻchirma esa kartalar orasida pulni siljitadi.',
  'cmp.walletInfo.card.note': 'Karta notoʻgʻri koʻrinsa, sabab odatda amallar emas, boshlangʻich balansda boʻladi. Uni kartani tahrirlab toʻgʻrilang.',
  'cmp.walletInfo.cash.title': 'Naqd pul balansi',
  'cmp.walletInfo.cash.meaning': 'Qoʻlingizdagi jonli pul, har bir valyuta uchun alohida hisoblanadi.',
  'cmp.walletInfo.cash.formula': 'Boshlangʻich naqd summangiz, ustiga kartaga bogʻlanmagan barcha amallar. Bu yerda naqd pulni belgilaydigan narsa — kategoriya emas, kartaning yoʻqligi.',
  'cmp.walletInfo.cash.note': 'Tracker faqat UZS bilan ishlaydi, shuning uchun naqd pul bitta hisobda yuritiladi va hech narsa konvertatsiya qilinmaydi.',
}
