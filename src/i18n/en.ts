/**
 * English is the source dictionary — every key must exist here. `uz.ts` may be partial;
 * the provider falls back to this file, then to the key itself, so a missing translation
 * degrades to English rather than blanking the UI.
 *
 * Category names are NOT here: they are user data, translated via Category.nameUz.
 *
 * Naming rule for the page/nav titles below: one key per destination, and the key name
 * matches the user-visible name.
 */
export const en = {
  // ── Navigation ──────────────────────────────────────────────────────────
  'nav.home': 'Home',
  'nav.wallets': 'Wallets',
  'nav.categories': 'Categories',
  'nav.settings': 'Settings',
  'nav.openMenu': 'Open menu',
  'nav.skipToContent': 'Skip to content',
  'nav.signedInAs': 'Signed in as',
  'nav.logout': 'Log out',
  // Connection status is rendered only when the backend is unreachable.
  'nav.offline': 'Backend offline',
  'nav.language': 'Language',

  // ── Common actions ──────────────────────────────────────────────────────
  'action.save': 'Save',
  'action.cancel': 'Cancel',
  'action.back': 'Back',
  'action.delete': 'Delete',
  'action.edit': 'Edit',
  'action.add': 'Add',
  'action.create': 'Create',
  'action.update': 'Update',
  'action.close': 'Close',
  'action.confirm': 'Confirm',
  'action.clearFilters': 'Clear filters',
  'action.history': 'History',
  'action.saving': 'Saving…',
  'action.transfer': 'Transfer',

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
  'ui.status.done': 'Done',

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
  'page.wallets': 'Wallets',
  'page.categories': 'Categories',
  'page.settings': 'Settings',
  'page.developer': 'Developer',
  'page.donations': 'Donations',

  // ── Transactions ────────────────────────────────────────────────────────
  'tx.none': 'No transactions found',
  'tx.date': 'Date',
  'tx.description': 'Description',
  'tx.category': 'Category',
  'tx.amount': 'Amount',
  'tx.note': 'Note',
  'tx.type': 'Type',
  'tx.income': 'Income',
  'tx.expense': 'Expense',
  'tx.cash': 'Cash',
  'tx.card': 'Card',
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

  // ── Income guard ────────────────────────────────────────────────────────
  'income.requiredTitle': 'Tell Tracker your monthly pay first.',
  'income.requiredBody': 'Your usual monthly pay. Tracker uses it to suggest how much to set aside — nothing can be recorded until it is set.',
  'income.requiredAction': 'Set it up',

  // ── Misc ────────────────────────────────────────────────────────────────
  'common.optional': 'optional',
} as const
