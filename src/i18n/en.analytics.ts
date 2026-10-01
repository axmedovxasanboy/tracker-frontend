/**
 * Strings for the Analytics page (ANALYTICS-SPEC.md). Merged into the main dictionary by
 * LanguageContext.
 *
 * Analytics says what happened, in History's words: In, Out and Saved come from `shell.history.*`
 * and are not restated here. Nothing in this file gives advice, names a budget, or talks about
 * levels, buckets or allocation.
 */
export const en_analytics = {
  // ── Navigation and the period ───────────────────────────────────────────────────────────────
  'shell.nav.analytics': 'Analytics',
  'analytics.tab.month': 'Month',
  'analytics.tab.year': '12 months',
  'analytics.tab.yearLockReason': 'Needs two months of entries',
  'analytics.tab.yearLocked': 'Opens when {month} has its first entry.',
  'analytics.tab.yearLockedNoData': 'Opens once two months have entries.',
  'analytics.backToMonth': 'Back to {month}',
  'analytics.period.last12': 'Last 12 months',
  'analytics.outdated': 'Update the server to see Analytics.',
  'analytics.fromHistory': 'See {month} in Analytics',
  'analytics.seeHistory': 'See {month} in History',
  'analytics.shareOfIn': '{percent}% of what came in',
  'analytics.perMonth': 'About {amount} a month',

  // ── The four places money goes, and what is left ────────────────────────────────────────────
  'analytics.group.everyday': 'Everyday spending',
  'analytics.group.bills': 'Bills',
  'analytics.group.loans': 'Loan payments',
  'analytics.group.leftOver': 'Left over',

  // ── A. The period in one line ───────────────────────────────────────────────────────────────
  'analytics.a.leftOver': '{period} · left over',
  'analytics.a.short': '{period} · short',
  'analytics.a.empty': 'Nothing recorded.',
  'analytics.a.justStarted': 'Just started.',
  'analytics.a.seeMonth': 'See {month}',
  'analytics.a.pay': 'Pay',
  'analytics.a.bonus': 'Bonus',
  'analytics.a.otherIncome': 'Other income',
  'analytics.a.moreThanIn': '{amount} more than came in',
  'analytics.a.withoutBonus': 'Without the bonus: {amount} short.',
  'analytics.a.withoutBonusRange': 'Without the bonuses: {amount} short.',
  'analytics.a.outMore': 'Out: {amount} more than {month}.',
  'analytics.a.outLess': 'Out: {amount} less than {month}.',
  'analytics.a.outSame': 'Out: about the same as {month}.',
  'analytics.a.alsoMoved': 'Not income or spending:',
  'analytics.a.borrowed': 'Borrowed {amount}',
  'analytics.a.lent': 'Lent {amount}',
  'analytics.a.returned': 'Paid back to you {amount}',
  'analytics.a.fromSavings': 'Taken from savings {amount}',
  'analytics.a.notYetOne': '{count} later-dated entry not counted yet.',
  'analytics.a.notYet': '{count} later-dated entries not counted yet.',
  'analytics.a.how.borrowed': 'Borrowed',
  'analytics.a.how.lent': 'Lent',
  'analytics.a.how.returned': 'Paid back to you',
  'analytics.a.how.fromSavings': 'Taken from savings',
  'analytics.a.walletsChanged': 'Your wallets changed by',
  'analytics.a.perMonth': 'A month: in {in}, out {out}.',

  // ── B. Everyday spending ────────────────────────────────────────────────────────────────────
  'analytics.b.uncategorised': 'No category',
  'analytics.b.notItemised': 'Not itemised',
  'analytics.b.notItemisedHint': 'from wallet checks',
  'analytics.b.more': '{amount} more than {month}',
  'analytics.b.less': '{amount} less than {month}',
  'analytics.b.seeInHistory': 'See these in History',
  'analytics.b.empty': 'Nothing spent.',

  // ── C. Through the month ────────────────────────────────────────────────────────────────────
  'analytics.c.title': 'Through the month',
  'analytics.c.perDay': '{amount} a day',
  'analytics.c.plainOne': '{amount} of everyday spending in {count} day.',
  'analytics.c.plain': '{amount} of everyday spending in {count} days.',
  'analytics.c.lessThan': 'By {date}: {amount} less than {month}.',
  'analytics.c.moreThan': 'By {date}: {amount} more than {month}.',
  'analytics.c.sameAs': 'By {date}: about the same as {month}.',
  'analytics.c.spentThatDay': 'spent that day',
  'analytics.c.soFar': 'So far',
  'analytics.c.includesCheck': 'incl. {amount} from a wallet check',
  'analytics.c.biggestDays': 'Biggest days',
  'analytics.c.showNumbers': 'Show the numbers',
  'analytics.c.colDays': 'Days',
  'analytics.c.colSpent': 'Spent',

  // ── C′. Month by month ──────────────────────────────────────────────────────────────────────
  'analytics.m.title': 'Month by month',
  'analytics.m.someOver': 'Out beat in: {n} of {m} months.',
  'analytics.m.noneOver': 'Every month, less out than in.',
  'analytics.m.soFar': 'so far',
  'analytics.m.colMonth': 'Month',
  'analytics.m.unit': 'Amounts in UZS',
  'analytics.m.open': 'Open {month}',

  // ── D. Bills and loans ──────────────────────────────────────────────────────────────────────
  'analytics.d.title': 'Bills and loans',
  'analytics.d.meter': '{paid} of {income} monthly pay',
  'analytics.d.overPay': 'Over your monthly pay.',
  'analytics.d.kind.bill': 'bill',
  'analytics.d.kind.bank': 'bank loan',
  'analytics.d.kind.monthly': 'monthly loan',
  'analytics.d.kind.asap': 'repay fast',
  'analytics.d.open': 'Open Loans & bills',
  'analytics.d.empty': 'No bills or loan payments.',

  // ── E. Saved ────────────────────────────────────────────────────────────────────────────────
  'analytics.e.empty': 'Nothing saved.',

  // ── F. Biggest purchases ────────────────────────────────────────────────────────────────────
  'analytics.f.title': 'Biggest purchases',
  'analytics.f.empty': 'No purchases.',

  // ── G. Own and owe ──────────────────────────────────────────────────────────────────────────
  'analytics.g.title': 'Own and owe',
  'analytics.g.net': 'Own minus loans',
  'analytics.g.own': 'You own',
  'analytics.g.leftToRepay': 'Left to repay',
  'analytics.g.owedToYou': 'Owed to you: {amount}',
  'analytics.g.paidOffBy': '{monthly} a month · until {month}',
  'analytics.g.unknown': 'amount unknown',
  'analytics.g.notCounting': '{names} not counted (amount unknown)',
} as const
