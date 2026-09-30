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
  'analytics.tab.yearLockReason': 'Opens when there are two months to compare',
  'analytics.tab.yearLocked': 'There is one month so far. Month-by-month comparison starts when {month} has its first entry.',
  'analytics.tab.yearLockedNoData': 'Nothing is recorded yet. Month-by-month comparison starts when two months have entries.',
  'analytics.backToMonth': 'Back to {month}',
  'analytics.period.last12': 'Last 12 months',
  'analytics.period.last12Text': 'the last 12 months',
  'analytics.outdated': 'Update the server to see Analytics.',
  'analytics.fromHistory': 'See {month} in Analytics',
  'analytics.seeHistory': 'See {month} in History',
  'analytics.shareOfIn': '{percent}% of what came in.',
  'analytics.perMonth': 'About {amount} a month.',

  // ── The four places money goes, and what is left ────────────────────────────────────────────
  'analytics.group.everyday': 'Everyday spending',
  'analytics.group.bills': 'Bills',
  'analytics.group.loans': 'Loan payments',
  'analytics.group.given': 'Given',
  'analytics.group.leftOver': 'Left over',

  // ── A. The period in one line ───────────────────────────────────────────────────────────────
  'analytics.a.leftOver': '{period} · left over',
  'analytics.a.short': '{period} · short',
  'analytics.a.kept': 'You kept {amount} of the {in} that came in.',
  'analytics.a.even': 'Everything that came in was spent or saved.',
  'analytics.a.over': 'You spent and saved {amount} more than came in.',
  'analytics.a.overSpent': 'You spent {amount} more than came in.',
  'analytics.a.empty': 'Nothing recorded in {month}.',
  'analytics.a.justStarted': '{month} has just started.',
  'analytics.a.seeMonth': 'See {month}',
  'analytics.a.pay': 'Pay',
  'analytics.a.bonus': 'Bonus',
  'analytics.a.otherIncome': 'Other income',
  'analytics.a.moreThanIn': '{amount} more than came in',
  'analytics.a.withoutBonus': 'Without the bonus this month would be {amount} short.',
  'analytics.a.withoutBonusRange': 'Without the bonuses these months would be {amount} short.',
  'analytics.a.outMore': 'Out was {amount} more than in {month}.',
  'analytics.a.outLess': 'Out was {amount} less than in {month}.',
  'analytics.a.outSame': 'Out was about the same as in {month}.',
  'analytics.a.alsoMoved': 'Also moved, not counted as income or spending:',
  'analytics.a.borrowed': 'Borrowed {amount}',
  'analytics.a.lent': 'Lent {amount}',
  'analytics.a.returned': 'Paid back to you {amount}',
  'analytics.a.fromSavings': 'Taken from savings {amount}',
  'analytics.a.notYetOne': '{count} entry dated later this month is not counted yet.',
  'analytics.a.notYet': '{count} entries dated later this month are not counted yet.',
  'analytics.a.how.borrowed': 'Borrowed',
  'analytics.a.how.lent': 'Lent',
  'analytics.a.how.returned': 'Paid back to you',
  'analytics.a.how.fromSavings': 'Taken from savings',
  'analytics.a.walletsChanged': 'Your wallets changed by',
  'analytics.a.perMonth': 'About {in} a month came in, {out} went out.',
  'analytics.a.goTo': 'Show the details below',

  // ── B. Everyday spending ────────────────────────────────────────────────────────────────────
  'analytics.b.biggest': 'The biggest part is {category} — {amount}.',
  'analytics.b.uncategorised': 'No category',
  'analytics.b.notItemised': 'Not itemised',
  'analytics.b.notItemisedHint': 'found by wallet checks — no details',
  'analytics.b.more': '{amount} more than {month}',
  'analytics.b.less': '{amount} less than {month}',
  'analytics.b.seeInHistory': 'See these in History',
  'analytics.b.empty': 'Nothing spent in {month}.',

  // ── C. Through the month ────────────────────────────────────────────────────────────────────
  'analytics.c.title': 'Through the month',
  'analytics.c.perDay': 'About {amount} a day',
  'analytics.c.plainOne': '{amount} of everyday spending in {count} day.',
  'analytics.c.plain': '{amount} of everyday spending in {count} days.',
  'analytics.c.lessThan': 'By {date} you had spent {amount} less than by the same day in {month}.',
  'analytics.c.moreThan': 'By {date} you had spent {amount} more than by the same day in {month}.',
  'analytics.c.sameAs': 'By {date} you had spent about the same as by the same day in {month}.',
  'analytics.c.spentThatDay': 'spent that day',
  'analytics.c.soFar': 'So far',
  'analytics.c.includesCheck': 'includes {amount} found by a wallet check',
  'analytics.c.biggestDays': 'Biggest days',
  'analytics.c.showNumbers': 'Show the numbers',
  'analytics.c.colDays': 'Days',
  'analytics.c.colSpent': 'Spent',

  // ── C′. Month by month ──────────────────────────────────────────────────────────────────────
  'analytics.m.title': 'Month by month',
  'analytics.m.someOver': 'In {n} of {m} months more went out than came in.',
  'analytics.m.noneOver': 'Every month so far, less went out than came in.',
  'analytics.m.soFar': 'so far',
  'analytics.m.colMonth': 'Month',
  'analytics.m.unit': 'Amounts in UZS',
  'analytics.m.open': 'Open {month}',

  // ── D. Bills and loans ──────────────────────────────────────────────────────────────────────
  'analytics.d.title': 'Bills and loans',
  'analytics.d.meter': '{paid} of your {income} monthly pay',
  'analytics.d.overPay': 'More than your monthly pay.',
  'analytics.d.kind.bill': 'bill',
  'analytics.d.kind.bank': 'bank loan',
  'analytics.d.kind.monthly': 'monthly loan',
  'analytics.d.kind.asap': 'repay fast',
  'analytics.d.open': 'Open Loans & bills',
  'analytics.d.empty': 'No bills or loan payments in {month}.',

  // ── E. Saved ────────────────────────────────────────────────────────────────────────────────
  'analytics.e.empty': 'Nothing saved in {month}.',

  // ── F. Biggest purchases ────────────────────────────────────────────────────────────────────
  'analytics.f.title': 'Biggest purchases',
  'analytics.f.empty': 'No purchases recorded in {month}.',

  // ── G. Own and owe ──────────────────────────────────────────────────────────────────────────
  'analytics.g.title': 'Own and owe',
  'analytics.g.net': 'Own minus loans',
  'analytics.g.sentence': 'You own {own}. {loans} of loans is left to repay.',
  'analytics.g.sentenceNoLoans': 'You own {own}. There are no loans to repay.',
  'analytics.g.sentenceOwnOnly': 'You own {own}.',
  'analytics.g.own': 'You own',
  'analytics.g.leftToRepay': 'Left to repay',
  'analytics.g.owedToYou': 'Owed to you: {amount}',
  'analytics.g.paidOffBy': '{monthly} a month · paid off by {month}',
  'analytics.g.unknown': 'amount left not known',
  'analytics.g.notCounting': 'Not counting {names} — the amount left is not known.',
} as const
