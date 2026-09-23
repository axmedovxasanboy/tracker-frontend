/** Components strings. Merged into the main dictionary by LanguageContext. */
export const en_components = {
  // ── Shared field / source / error / state / hint vocabulary (reused across modals) ──────
  'cmp.field.dateRequired': 'Date *',
  'cmp.field.amountRequired': 'Amount *',

  'cmp.err.amountPositive': 'Amount must be greater than 0.',
  'cmp.err.pickCardOrCash': 'Pick a card or switch to Cash.',
  'cmp.err.pickCardForPortion': 'Pick a card for the card portion.',
  'cmp.err.cannotExceedRemaining': 'Cannot exceed remaining: {amount}',
  'cmp.err.amountCannotExceedRemaining': 'Amount cannot exceed remaining ({amount}).',
  'cmp.err.pickLoanToPay': 'Pick a loan to pay.',
  'cmp.err.pickBankLoanToPay': 'Pick a bank loan to pay.',
  'cmp.err.selectBothCards': 'Select both sides',
  'cmp.err.cashToCash': 'Pick a card on at least one side — cash to cash moves nothing.',
  'cmp.err.walletsMustDiffer': 'Source and destination must be different',
  'cmp.err.enterValidAmount': 'Enter a valid amount',
  'cmp.err.valueNegative': 'Value cannot be negative.',
  'cmp.err.nameFund': 'Name your emergency fund.',
  'cmp.err.investmentNameRequired': 'Investment name is required.',

  // ui/PageHeader — the month stepper's icon-only buttons need real labels.
  'cmp.pageHeader.prevMonth': 'Previous month',
  'cmp.pageHeader.nextMonth': 'Next month',

  'cmp.state.transferring': 'Transferring…',

  'cmp.action.topUp': 'Add money',
  'cmp.action.useThis': 'use this',

  // ── Savings names (Savings, Home) ────────────────────────────────────────────────────────
  'cmp.bucket.donation': 'Donation',
  'cmp.bucket.emergency': 'Emergency fund',
  'cmp.bucket.investments': 'Investments',

  // ── Shared investment-type labels (PayBucketModal, TransactionModal) ────────────────────
  'cmp.investmentType.realEstate': 'Real estate',
  'cmp.investmentType.bonds': 'Bonds',
  'cmp.investmentType.mutualFund': 'Mutual fund',
  'cmp.investmentType.gold': 'Gold',
  'cmp.investmentType.other': 'Other',

  // ── finance/ContributeInvestmentModal ────────────────────────────────────────────────────
  'cmp.contributeInvestment.title': 'Add to {name}',
  'cmp.contributeInvestment.submit': 'Add',

  // ── finance/UpdateValueModal ──────────────────────────────────────────────────────────────
  'cmp.updateValue.title': 'Update value — {name}',
  'cmp.updateValue.contributedSoFar': 'Contributed so far:',
  'cmp.updateValue.setCurrentValueHint': 'Set the current market value (incl. any growth/returns).',
  'cmp.updateValue.currentValueLabel': 'Current value ({currency})',
  'cmp.updateValue.submit': 'Update value',

  // ── finance/RepaymentModal ────────────────────────────────────────────────────────────────
  'cmp.repay.title.loanTaken': 'Pay back borrowed money',
  'cmp.repay.title.debt': 'Pay off debt',
  'cmp.repay.full': 'Full',
  'cmp.repay.recordedToast': 'Added · {amount}',

  // ── finance/PaySubscriptionModal ──────────────────────────────────────────────────────────
  'cmp.paySubscription.title': 'Pay {name}',

  // ── months/CheckInModal ───────────────────────────────────────────────────────────────────
  'cmp.closeMonth.noWallets': 'No wallets to reconcile.',
  'cmp.closeMonth.appThinks': 'App thinks:',
  'cmp.closeMonth.spent': 'Spent ',
  'cmp.closeMonth.surplus': 'Surplus ',
  'cmp.checkIn.recordFirst': 'Remember a purchase? Record it first — only what\'s left unexplained should become everyday spending.',
  'cmp.checkIn.walletLabel': '{name} — balance right now',
  'cmp.checkIn.matches': 'Matches',
  'cmp.checkIn.willRecord': 'Everyday spending this check-in will record: {amount}',
  'cmp.checkIn.willRecordSurplus': 'This check-in will record {amount} more than expected.',
  'cmp.checkIn.willRecordNothing': 'Everything matches — nothing will be recorded.',
  'cmp.checkIn.savedSpent': 'Check-in saved — {amount} of everyday spending recorded.',
  'cmp.checkIn.savedSurplus': 'Check-in saved — {amount} more than expected was found.',
  'cmp.checkIn.savedMatched': 'Check-in saved — your wallets already matched.',
  'cmp.checkIn.loadFailed': 'Couldn\'t load your wallets.',

  // ── overview/PayBankInstallmentModal ──────────────────────────────────────────────────────
  'cmp.payBankInstallment.title': 'Pay your bank loan',
  'cmp.payBankInstallment.pickLoan': 'Pick a bank loan',
  'cmp.payBankInstallment.perMonth': '{amount} / mo',
  'cmp.payBankInstallment.recordedToast': 'Added · bank loan payment {amount}',

  // ── overview/PayBucketModal ───────────────────────────────────────────────────────────────
  'cmp.payBucket.titleDonation': 'Add a donation',
  'cmp.payBucket.titleEmergency': 'Add to your emergency fund',
  'cmp.payBucket.titleInvestments': 'Add to investments',
  'cmp.payBucket.newEmergencyFundOption': '➕ New emergency fund…',
  'cmp.payBucket.recipient': 'Recipient',
  'cmp.payBucket.recipientPlaceholder': 'Who you donated to',
  'cmp.payBucket.anonymous': 'Anonymous',
  'cmp.payBucket.fundNamePlaceholder': 'Emergency fund, Rainy-day, etc.',
  'cmp.payBucket.investmentNamePlaceholder': 'Apple Inc., Real Estate, etc.',
  'cmp.payBucket.brokerPlatform': 'Broker / Platform',
  'cmp.payBucket.recordedToast': 'Added · {bucket} {amount}',
  'cmp.payBucket.newInvestmentOption': '➕ New investment…',
  'cmp.payBucket.emergencyFundOption': 'Emergency fund contribution',

  // ── overview/PayPersonalLoanModal ─────────────────────────────────────────────────────────
  'cmp.payPersonalLoan.noLoans': 'No personal loans with a remaining balance.',
  'cmp.payPersonalLoan.recordedToast': 'Added · {name} {amount}',

  // ── transactions/BalanceTransferModal ─────────────────────────────────────────────────────
  'cmp.balanceTransfer.title': 'Transfer balance',
  'cmp.balanceTransfer.fromCard': 'From card *',
  'cmp.balanceTransfer.toCard': 'To card *',
  'cmp.balanceTransfer.selectCard': 'Select card…',
  'cmp.balanceTransfer.fromBalance': 'From balance',
  'cmp.balanceTransfer.toBalance': 'To balance',
  'cmp.balanceTransfer.exceedsBalance': 'Exceeds available balance ({balance})',
  'cmp.balanceTransfer.descriptionPlaceholder': 'e.g. Monthly savings transfer',
  'cmp.balanceTransfer.infoPrefix': 'Two transactions will be created: an',
  'cmp.balanceTransfer.infoMid': 'on the source card and an',
  'cmp.balanceTransfer.infoSuffix': 'on the destination card. Both appear in History.',
  'cmp.transfer.success': 'Transferred {amount} successfully',

  // ── transactions/TransactionDetailModal ───────────────────────────────────────────────────
  'cmp.txDetail.title': 'Transaction details',
  'cmp.txDetail.transactionType': 'Transaction type',
  'cmp.txDetail.cardWallet': 'Card / Wallet',
  'cmp.txDetail.paymentSplit': 'Payment split',
  'cmp.txDetail.created': 'Created',
  'cmp.subType.regularIncome': 'Regular income',
  'cmp.subType.loanReceived': 'Borrowed',
  'cmp.subType.loanReturned': 'Lent money returned',
  'cmp.subType.regularExpense': 'Regular expense',
  'cmp.subType.loanGiven': 'Lent',
  'cmp.subType.loanRepayment': 'Loan repayment',
  'cmp.subType.bankLoanPayment': 'Bank loan payment',
  'cmp.subType.investment': 'Investment',
  'cmp.subType.donation': 'Donation',

  // ── transactions/TransactionFilters ───────────────────────────────────────────────────────
  'cmp.txFilters.search': 'Search',
  'cmp.txFilters.searchPlaceholder': 'Search description…',
  'cmp.txFilters.allTypes': 'All types',
  'cmp.txFilters.allCategories': 'All categories',
  'cmp.txFilters.from': 'From',
  'cmp.txFilters.to': 'To',
  'cmp.txFilters.reset': 'Reset',
  'cmp.txFilters.filters': 'Filters',
  'cmp.txFilters.filtersWithCount': 'Filters · {count}',
  'cmp.txFilters.clearAll': 'Clear all',
  'cmp.txFilters.removeFilter': 'Remove filter: {label}',
  'cmp.txFilters.searching': 'Searching…',
  'cmp.txFilters.chipType': 'Type: {value}',
  'cmp.txFilters.chipCategory': 'Category: {value}',
  'cmp.txFilters.chipCard': 'One card only',
  'cmp.txFilters.chipInvestment': 'One investment only',
  'cmp.txFilters.chipFrom': 'From {date}',
  'cmp.txFilters.chipTo': 'To {date}',

  // ── transactions/TransactionModal ─────────────────────────────────────────────────────────
  'cmp.txModal.subType.loanReceived': 'Borrowed',
  'cmp.txModal.subType.loanReturnedToMe': 'Lent money returned',
  'cmp.txModal.subType.loanGiven': 'Lent',
  'cmp.txModal.subType.loanRepayment': 'Loan repayment',
  'cmp.txModal.subType.bankLoanPayment': 'Bank loan payment',
  'cmp.txModal.subType.investment': 'Investment',
  'cmp.txModal.subType.donation': 'Donation',

  'cmp.txModal.counterparty.lenderName': 'Lender name',
  'cmp.txModal.counterparty.debtorName': 'Debtor name',
  'cmp.txModal.counterparty.borrowerName': 'Borrower name',
  'cmp.txModal.counterparty.lenderCreditor': 'Lender / Creditor',
  'cmp.txModal.counterparty.bankName': 'Bank name',
  'cmp.txModal.counterparty.assetPlatform': 'Asset / Platform',
  'cmp.txModal.counterparty.recipientName': 'Recipient name',
  'cmp.txModal.counterparty.generic': 'Counterparty',

  'cmp.txModal.err.selectCategory': 'Please select a category',
  'cmp.txModal.err.selectSubCategory': 'Please select a sub-category',
  'cmp.txModal.err.selectInvestment': 'Select an investment, or switch to "Create new"',
  'cmp.txModal.err.selectCardOrSwitch': 'Select a wallet, or pay with cash',
  'cmp.txModal.err.fillInField': 'Please fill in the {field}',
  'cmp.txModal.err.fieldRequired': '{field} is required',

  'cmp.txModal.descriptionPlaceholder': 'e.g. {example}',
  'cmp.txModal.descriptionExampleIncome': 'Monthly salary',
  'cmp.txModal.descriptionExampleExpense': 'Lunch at Chaikhana',

  'cmp.txModal.newCategory': 'New category',
  'cmp.txModal.categoryNamePlaceholder': 'Category name',
  'cmp.txModal.new': 'New',
  'cmp.txModal.subCategoryNamePlaceholder': 'Sub-category name',
  'cmp.txModal.addSubCategory': 'Add sub-category',

  'cmp.txModal.enterNamePlaceholder': 'Enter name...',
  'cmp.txModal.existingBorrowers': 'Existing borrowers',
  'cmp.txModal.anonymousDonationNotice': 'Anonymous — no recipient saved.',

  'cmp.txModal.addToExisting': 'Add to existing',
  'cmp.txModal.createNew': 'Create new',
  'cmp.txModal.noInvestmentsYet': 'None yet — switch to "Create new".',
  'cmp.txModal.selectAnInvestment': '— Select an investment —',
  'cmp.txModal.investmentType': 'Investment type',

  'cmp.txModal.insufficientBalance': 'Insufficient balance',

  'cmp.txModal.cardsLoadFailed': 'Your cards could not be loaded',

  // Field labels bound to their controls. Separate from the '… *' strings above because
  // Field draws the required marker itself, so the label must not carry a second one.
  'cmp.txModal.label.amount': 'Amount',
  'cmp.txModal.label.category': 'Category',
  'cmp.txModal.label.subCategory': 'Sub-category',
  'cmp.txModal.label.date': 'Date',
  'cmp.txModal.label.investment': 'Investment',
  'cmp.txModal.label.direction': 'Money in or out',
  'cmp.txModal.label.whatFor': 'What for',
  'cmp.txModal.elseTitle': 'Something else?',
  'cmp.txModal.elseLoans': 'Loans & bills',
  'cmp.txModal.elseTransfer': 'Move money',
  // Direction is the form's first control, so switching it mid-entry is now the common case:
  // one line says what the switch dropped, one says what it kept.
  'cmp.txModal.categoryClearedByDirection': 'Pick a category again.',
  'cmp.txModal.err.selectDate': 'Please pick a date',

  // ── ui/CacheBadge, ui/OfflineBanner ───────────────────────────────────────────────────────
  'cmp.cache.cached': 'As of {time}',
  'cmp.offline.backendOffline': 'Backend is offline',
  'cmp.offline.showingDataFrom': '— showing data from {time}',
  'cmp.offline.noCachedData': '— no cached data available yet',
  'cmp.offline.retry': 'Retry',

  // ── ui/ExplainModal, and the "What is …?" buttons that open it ─────────────────────────────
  'cmp.cardInfo.button': 'What is “{title}”?',
  'cmp.cardInfo.howItsBuilt': 'How it is worked out',
  'cmp.cardInfo.theNumbers': 'The numbers behind it',

  // ── Cards page: wallet balances ───────────────────────────────────────────────────────
  'cmp.walletInfo.card.title': 'Card balance',
  'cmp.walletInfo.card.meaning': 'What each card holds right now.',
  'cmp.walletInfo.card.formula': 'The balance you entered when you added the card, plus every transaction recorded against it since — income adds, expenses subtract, and transfers move money between one card and another.',
  'cmp.walletInfo.card.note': 'If a card looks wrong, the opening balance is usually the cause rather than the transactions. Edit the card to correct it.',
  'cmp.walletInfo.cash.title': 'Cash balance',
  'cmp.walletInfo.cash.meaning': 'The physical money you hold, tracked as a pot per currency.',
  'cmp.walletInfo.cash.formula': 'Your opening cash figure, plus every transaction that is NOT attached to a card. That is what makes something cash here: no card, rather than a category.',
  'cmp.walletInfo.cash.note': 'Tracker is UZS-only, so there is one cash pot and nothing is ever converted.',
} as const
