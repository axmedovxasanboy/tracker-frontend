/**
 * English is the source dictionary — every key must exist here. `uz.ts` may be partial;
 * the provider falls back to this file, then to the key itself, so a missing translation
 * degrades to English rather than blanking the UI.
 *
 * Category names are NOT here: they are user data, translated via Category.nameUz.
 */
export const en = {
  // ── Navigation ──────────────────────────────────────────────────────────
  'nav.dashboard': 'Dashboard',
  'nav.overview': 'Overview',
  'nav.months': 'Months',
  'nav.transactions': 'Transactions',
  'nav.cards': 'Cards',
  'nav.finance': 'Finance',
  'nav.categories': 'Categories',
  'nav.settings': 'Settings',
  'nav.developer': 'Developer',
  'nav.signedInAs': 'Signed in as',
  'nav.logout': 'Log out',
  'nav.online': 'Backend online',
  'nav.offline': 'Backend offline',
  'nav.language': 'Language',

  // ── Common actions ──────────────────────────────────────────────────────
  'action.save': 'Save',
  'action.cancel': 'Cancel',
  'action.delete': 'Delete',
  'action.edit': 'Edit',
  'action.add': 'Add',
  'action.create': 'Create',
  'action.update': 'Update',
  'action.close': 'Close',
  'action.confirm': 'Confirm',
  'action.back': 'Back',
  'action.clear': 'Clear',
  'action.clearFilters': 'Clear filters',
  'action.record': 'Record',
  'action.history': 'History',
  'action.saving': 'Saving…',
  'action.transfer': 'Transfer',
  'action.openSettings': 'Open Settings',

  // ── Page titles / headers ───────────────────────────────────────────────
  'page.dashboard': 'Dashboard',
  'page.transactions': 'Transactions',
  'page.cards': 'Cards & Wallets',
  'page.categories': 'Categories',
  'page.finance': 'Finance',
  'page.overview': 'Overview',
  'page.months': 'Months',
  'page.settings': 'Settings',
  'page.developer': 'Developer',
  'page.investments': 'Investments',
  'page.donations': 'Donations',
  'page.emergencies': 'Emergency Fund',

  // ── Transactions ────────────────────────────────────────────────────────
  'tx.addTransaction': 'Add Transaction',
  'tx.editTransaction': 'Edit Transaction',
  'tx.newTransaction': 'New Transaction',
  'tx.none': 'No transactions found',
  'tx.records': '{count} records',
  'tx.record': '{count} record',
  'tx.date': 'Date',
  'tx.description': 'Description',
  'tx.category': 'Category',
  'tx.amount': 'Amount',
  'tx.currency': 'Currency',
  'tx.note': 'Note',
  'tx.type': 'Type',
  'tx.income': 'Income',
  'tx.expense': 'Expense',
  'tx.split': 'Split',
  'tx.cash': 'Cash',
  'tx.card': 'Card',
  'tx.both': 'Both',
  'tx.saved': 'Transaction saved',
  'tx.updated': 'Transaction updated',
  'tx.confirmDelete': 'Delete this transaction?',

  // ── Categories ──────────────────────────────────────────────────────────
  'cat.name': 'Name',
  'cat.nameEn': 'Name (English)',
  'cat.nameUz': 'Name (Uzbek)',
  'cat.nameUzHint': 'Shown when the app is in Uzbek. Leave blank to use the English name.',
  'cat.addCategory': 'Add Category',
  'cat.addSub': 'Add sub-category to "{name}"',
  'cat.edit': 'Edit "{name}"',
  'cat.subOf': 'Sub-category of',
  'cat.none': 'No categories yet',
  'cat.confirmDelete': 'Delete this category? Its transactions will be uncategorised.',

  // ── Allocation preview ──────────────────────────────────────────────────
  'alloc.countsToward': 'Counts toward',
  'alloc.target': 'Target',
  'alloc.paidSoFar': 'Paid so far',
  'alloc.afterThis': 'After this',

  // ── Income guard ────────────────────────────────────────────────────────
  'income.requiredTitle': 'Set your monthly income first.',
  'income.requiredBody': 'Nothing can be recorded until it is set — your tier and every allocation figure are calculated from it.',
  'income.requiredTooltip': 'Set your monthly income in Settings first',

  // ── Misc ────────────────────────────────────────────────────────────────
  'common.loading': 'Loading…',
  'common.none': '—',
  'common.all': 'All',
  'common.yes': 'Yes',
  'common.no': 'No',
  'common.required': 'required',
  'common.optional': 'optional',
} as const
