/**
 * English is the source dictionary — every key must exist here. `uz.ts` may be partial;
 * the provider falls back to this file, then to the key itself, so a missing translation
 * degrades to English rather than blanking the UI.
 *
 * Category names are NOT here: they are user data, translated via Category.nameUz.
 *
 * Naming rule for the page/nav titles below: one key per destination, and the key name
 * matches the user-visible name. `nav.dashboard` / `nav.overview` / `nav.cards` and their
 * `page.*` twins are deprecated aliases of `nav.home` / `nav.plan` / `nav.wallets`; they
 * still carry the correct new wording so nothing reads the old name, but wire new call
 * sites to the canonical keys.
 */
export const en = {
  // ── Navigation ──────────────────────────────────────────────────────────
  'nav.home': 'Home',
  'nav.plan': 'Plan',
  'nav.months': 'Months',
  'nav.transactions': 'Transactions',
  'nav.wallets': 'Wallets',
  'nav.finance': 'Finance',
  'nav.categories': 'Categories',
  'nav.settings': 'Settings',
  'nav.developer': 'Developer',
  'nav.openMenu': 'Open menu',
  'nav.skipToContent': 'Skip to content',
  'nav.signedInAs': 'Signed in as',
  'nav.logout': 'Log out',
  // The sidebar's standing block: which month is running, and how long is left to record
  // into it. `{count}` is the day count — the singular form exists for "1 day".
  'nav.thisMonth': 'This month',
  'nav.monthClosesInOne': 'Closes in {count} day',
  'nav.monthClosesInMany': 'Closes in {count} days',
  'nav.monthClosesToday': 'Closes today',
  // Connection status is rendered only when the backend is unreachable; the healthy
  // line is kept so the Sidebar keeps compiling while it migrates.
  'nav.online': 'Backend online',
  'nav.offline': 'Backend offline',
  'nav.language': 'Language',

  // Deprecated nav aliases — same words as the canonical keys above. Do not add call sites.
  'nav.dashboard': 'Home',
  'nav.overview': 'Plan',
  'nav.cards': 'Wallets',

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
  // One write verb across the app: "Add" (+ object). `action.record` is kept because
  // several call sites still read it, but it must never say anything but "Add".
  'action.record': 'Add',
  'action.history': 'History',
  'action.saving': 'Saving…',
  'action.transfer': 'Transfer',
  'action.openSettings': 'Open Settings',

  // ── Shared UI vocabulary (primitives in src/components/ui) ──────────────
  'ui.error.title': 'Can\'t reach your server',
  'ui.error.retry': 'Retry',
  'ui.error.body': '{message}',
  'ui.loading': 'Loading…',
  'ui.more': 'More',
  'ui.moreOptions': 'More options',
  'ui.actions': 'Actions',
  'ui.close': 'Close',
  'ui.locked': 'Not available yet',
  'ui.discard.title': 'Discard this entry?',
  'ui.discard.body': 'You have unsaved changes. Closing now loses them.',
  'ui.discard.confirm': 'Discard',
  'ui.discard.cancel': 'Keep editing',
  // A scope word sits beside every money figure — these are the only four allowed.
  'ui.scope.target': 'Target',
  'ui.scope.paid': 'Paid',
  'ui.scope.setAside': 'Set aside',
  'ui.scope.left': 'Left',
  'ui.scope.allTime': 'All time',
  'ui.scope.thisMonth': 'This month',
  'ui.status.done': 'Done',
  'ui.status.ahead': '+{amount} ahead',
  'ui.status.due': '{amount} to go',
  'ui.exactValue': 'Exact: {value}',

  // ── Confirm dialog / toast defaults (were hard-coded English) ───────────
  'confirm.title': 'Are you sure?',
  'confirm.deleteTitle': 'Delete?',
  'toast.error': 'Something went wrong',
  'toast.success': 'Done',
  'toast.warning': 'Heads up',
  'toast.info': 'Note',

  // ── Request failures (were hard-coded English in api/client.ts) ─────────
  'error.network': 'Your server did not respond. Check your connection and try again.',
  'error.requestFailed': 'Request failed ({status})',

  // ── Page titles / headers ───────────────────────────────────────────────
  // One key per destination; the key name matches the user-visible name.
  'page.home': 'Home',
  'page.plan': 'Plan',
  'page.transactions': 'Transactions',
  'page.wallets': 'Wallets',
  'page.categories': 'Categories',
  'page.finance': 'Finance',
  'page.months': 'Months',
  'page.settings': 'Settings',
  'page.developer': 'Developer',
  'page.investments': 'Investments',
  'page.donations': 'Donations',
  'page.emergencies': 'Emergency fund',

  // Deprecated page-title aliases — same words as the canonical keys above.
  'page.dashboard': 'Home',
  'page.overview': 'Plan',
  'page.cards': 'Wallets',

  // ── Home's two panels ───────────────────────────────────────────────────
  // Tab labels are navigation, so they live with the other destination names. Summary holds what
  // you hold and what this month asks; Activity holds what has moved.
  'page.home.tabSummary': 'Summary',
  'page.home.tabActivity': 'Activity',
  // The difference between the money in and the money out over the charted months.
  'page.home.difference': 'Difference',
  // The scope beside every figure in the Activity row: the months those figures cover.
  'page.home.range': '{from} – {to} {year}',
  'page.home.rangeOne': '{month} {year}',

  // ── Transactions ────────────────────────────────────────────────────────
  'tx.addTransaction': 'Add transaction',
  'tx.addIncome': 'Income',
  'tx.addExpense': 'Expense',
  'tx.addOther': 'Add other',
  'tx.editTransaction': 'Edit transaction',
  'tx.newTransaction': 'New transaction',
  'tx.none': 'No transactions found',
  'tx.noneYet': 'Nothing recorded yet',
  'tx.noneYetAction': 'Add your first expense',
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
  'cat.addCategory': 'Add category',
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
  'income.requiredTitle': 'Tell Tracker your monthly pay first.',
  'income.requiredBody': 'Your usual monthly pay. Tracker uses it to suggest how much to set aside — nothing can be recorded until it is set.',
  'income.requiredAction': 'Set it up',

  // ── Month names for charts (the backend sends English ones) ─────────────
  'month.short.1': 'Jan',
  'month.short.2': 'Feb',
  'month.short.3': 'Mar',
  'month.short.4': 'Apr',
  'month.short.5': 'May',
  'month.short.6': 'Jun',
  'month.short.7': 'Jul',
  'month.short.8': 'Aug',
  'month.short.9': 'Sep',
  'month.short.10': 'Oct',
  'month.short.11': 'Nov',
  'month.short.12': 'Dec',

  // ── Misc ────────────────────────────────────────────────────────────────
  'common.loading': 'Loading…',
  'common.none': '—',
  'common.all': 'All',
  'common.yes': 'Yes',
  'common.no': 'No',
  'common.required': 'required',
  'common.optional': 'optional',
} as const
