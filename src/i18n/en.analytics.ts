/**
 * Strings for Analytics (ANALYTICS-V2-SPEC.md §5.4). Merged into the main dictionary by
 * LanguageContext.
 *
 * Analytics says what happened, in one name per figure: In and Out come from `shell.history.*`,
 * Set aside from `fix.setAside`, and are not restated here. Nothing in this file gives advice,
 * names a budget, or talks about levels, buckets or allocation. Every figure on these pages is
 * printed without its unit; "UZS" is said once, in the header line (`an.unit`).
 */
export const en_analytics = {
  // ── Navigation and the period ───────────────────────────────────────────────────────────────
  'shell.nav.analytics': 'Analytics',
  // The six tabs. Their own keys on purpose: the owner may rename a tab ("Income", "Expense",
  // "Savings") without touching the figure of the same name anywhere else.
  'analytics.nav.totals': 'Totals',
  'analytics.nav.in': 'Income',
  'analytics.nav.out': 'Expense',
  'analytics.nav.setAside': 'Savings',
  'analytics.nav.goals': 'Goals',
  'analytics.nav.year': '12 months',
  'an.nav.label': 'Analytics pages',
  'analytics.tab.yearLockReason': 'Needs two months of entries',
  'analytics.tab.yearLocked': 'Opens when {month} has its first entry.',
  'analytics.tab.yearLockedNoData': 'Opens once two months have entries.',
  'analytics.backToMonth': 'Back to {month}',
  'analytics.outdated': 'Update the server to see Analytics.',
  // History's link into this page.
  'analytics.fromHistory': 'See {month} in Analytics',

  // ── The parts of Out, and what is left (History and Loans use these too) ────────────────────
  'analytics.group.everyday': 'Everyday spending',
  'analytics.group.bills': 'Bills',
  'analytics.group.loans': 'Loan payments',
  'analytics.group.leftOver': 'Left over',
  'analytics.b.uncategorised': 'No category',
  'analytics.b.notItemised': 'Not itemised',
  'analytics.b.notItemisedHint': 'from wallet checks',
  'analytics.d.kind.bill': 'bill',
  'analytics.g.notCounting': '{names} not counted (amount unknown)',

  // ── The header line ─────────────────────────────────────────────────────────────────────────
  'an.day': 'Day {day} of {days}',
  'an.basis.one': 'Expected: average of {count} month ({months})',
  'an.basis.many': 'Expected: average of {count} months ({months})',
  'an.basis.none': 'Nothing earlier to compare with',
  'an.basis.skipped': '(no entries: {months})',
  'an.unit': 'UZS',
  'an.notYetOne': '{count} later-dated entry not counted yet',
  'an.notYet': '{count} later-dated entries not counted yet',

  // ── So far against expected (§1.2) ──────────────────────────────────────────────────────────
  'an.expected': '{amount} expected',
  'an.toCome': '{amount} to come',
  'an.over': '{amount} over',
  'an.more': '{amount} more',
  'an.less': '{amount} less',
  'an.asExpected': 'as expected',
  'an.inclBonus': 'incl. {amount} bonus',
  'an.stableIncome': 'Monthly income: {amount}',
  'an.inclBills': 'incl. {amount} bills',
  'an.paidOff': 'paid off',
  'an.loansPaidOff': '{amount} for paid-off loans',
  'an.new': 'new',
  'an.sr.more': 'more than expected',
  'an.sr.less': 'less than expected',
  'an.sr.about': 'about as expected',

  // ── Not counted ─────────────────────────────────────────────────────────────────────────────
  'an.notCounted': 'Not counted as In or Out',
  'an.notCountedIn': 'Not counted as In',
  'an.notCountedOut': 'Not counted as Out',
  'an.borrowed': 'Borrowed',
  'an.lent': 'Lent',
  'an.returned': 'Paid back to you',
  'an.fromSavings': 'From savings',
  'an.nothingFromSavings': 'Nothing taken from savings.',

  // ── In ──────────────────────────────────────────────────────────────────────────────────────
  'an.receivedOn': '{amount} of it received {date}',
  'an.countsIn': '{amount} received {date} counts in {month}',
  'an.receivedOnMany': '{amount} of it received in other months',
  'an.countsInMany': '{amount} received here counts in other months',
  'an.sources': 'Sources',

  // ── Out ─────────────────────────────────────────────────────────────────────────────────────
  'an.byCategory': 'By category',
  'an.perDay': '{amount} a day',
  'an.byToday': 'Itemised by today: {amount} of {expected} expected',
  'an.itemised': 'Itemised: {amount} of {expected} expected',
  'an.itemisedOnly': 'Itemised: {amount}',
  'an.smaller': 'Smaller ({count})',
  'an.allInHistory': 'All in History',
  'an.throughMonth': 'Through the month',
  'an.table.days': 'Days',
  'an.table.itemised': 'Itemised',
  'an.table.month': 'Month',
  // A bank installment that matches no bank loan (Loan payments, opened).
  'an.bankLoan': 'Bank loan',

  // ── Set aside ───────────────────────────────────────────────────────────────────────────────
  'an.group.INVESTMENTS': 'Investments',
  'an.group.EMERGENCY': 'Emergency fund',
  'an.group.GOALS': 'Goals',
  'an.group.DONATIONS': 'Donations',
  'an.emergencyNoAccount': 'Emergency fund (no account)',
  'an.stocksNoAccount': 'Stocks (no account)',
  'an.sinceStart': 'Set aside since {month}',
  'an.sinceStartOut': 'From savings since {month}: {amount}',
  'an.worthNow': 'Worth now',
  'an.worthNote': 'Includes money from before {month} and growth.',

  // ── Goals ───────────────────────────────────────────────────────────────────────────────────
  'an.goals.putIn': 'Put into goals',
  'an.goals.ofAsked': 'of {amount} asked',
  'an.goals.putOfAsked': '{putIn} of {asked} asked',
  'an.goals.of': '{value} of {target}',
  'an.goals.month': '{month}: {amount}',
  'an.goals.asksNothing': 'asks nothing',
  'an.goals.up': '+{amount} put in',
  'an.goals.fromSavings': '{amount} from savings',
  'an.goals.since': 'Nothing put in since {month}',
  'an.goals.showAll': 'Show all ({count})',
  'an.goals.nothingYet': 'Nothing put in yet',
  'an.goals.by': 'By {month}',
  'an.goals.empty': 'No goals yet.',
  'an.goals.noneInMonth': 'No goals in {month}.',
  'an.goals.newOnSavings': 'New goal on Savings',

  // ── 12 months ───────────────────────────────────────────────────────────────────────────────
  'an.year.range': '{count} months',
  'an.year.rangeOne': '{count} month',
  'an.year.basisOne': 'a month = average of {count} full month',
  'an.year.basisMany': 'a month = average of {count} full months',
  'an.year.aMonth': '{amount} a month',
  'an.year.monthByMonth': 'Month by month',
  'an.year.soFar': 'so far',
  'an.year.noEntries': 'no entries',
  'an.year.more': '+{count} more',
  'an.year.inMonths': 'in {count} months',
  'an.open': 'Open',
  'an.sheetTitle': '{page} · 12 months',

  // ── Empty pages ─────────────────────────────────────────────────────────────────────────────
  'an.empty.none': 'Nothing recorded yet.',
  'an.empty.month': '{month}: nothing recorded. Not counted in averages.',
} as const
