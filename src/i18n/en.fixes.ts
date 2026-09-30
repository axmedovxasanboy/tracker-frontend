/**
 * Strings added by the 2026-09-30 usability fixes (UX-FIXES-SPEC.md). Merged into the main
 * dictionary by LanguageContext.
 *
 * The word list these follow (§1 of the spec): Add writes money down · New creates a thing ·
 * Put in / Give / Pay are the three ways money leaves for a purpose · Move is between your own
 * wallets · "Saved" never includes donations — those are "Given" · what the month asks for,
 * saved and given together, is "Set aside".
 */
export const en_fixes = {

  // ── The word list ─────────────────────────────────────────────────────────────────────────────
  'action.new': 'New',
  'fix.give': 'Give',
  'fix.giveMore': 'Give more',
  'fix.given': 'Given',
  'fix.setAside': 'Set aside',
  'fix.whatKind': 'What kind',
  'fix.s.give': 'Give {amount} as a donation',

  // ── Analytics: saved and given apart ──────────────────────────────────────────────────────────
  'fix.savedGiven': 'Saved {saved} · Given {given}.',

  // ── Profile ───────────────────────────────────────────────────────────────────────────────────
  'fix.profile.lead': 'This month: set aside {total} — {percent}% of {base}.',
  'fix.profile.leadCarried': 'Plus {amount} left from earlier months.',
  'fix.profile.leadNone': 'This month nothing is asked to be set aside.',
  'fix.profile.levelLine': '{amount} a month left after bills · Level {n} at {next}',
  'fix.profile.payFor': 'Pay for {month}',

  // ── Goals: plans and wishes ───────────────────────────────────────────────────────────────────
  'fix.goals.plans': 'Plans',
  'fix.goals.wishes': 'Wishes',
  'fix.goals.noPlans': 'No plans yet. A wish becomes a plan when it gets a monthly payment.',
  'fix.goals.doesNotFit': 'Plans ask {goals} a month. In a month without a bonus, {room} is left after bills, loans and what you set aside.',
  'fix.goals.tight': 'After your plans, {left} a month is left to live on — you spend about {pace}.',
  'fix.goal.status.doesNotFit': 'Doesn’t fit your income',
  'fix.goal.makeWish': 'Make it a wish',
  'fix.goal.makePlan': 'Make it a plan',
  'fix.goal.nowWish': '{name} is a wish now — nothing is set aside for it.',
  'fix.goal.nowPlan': '{name} is a plan again — {amount} a month.',
  'fix.goal.kind': 'Plan or wish',
  'fix.goal.kind.plan': 'Plan',
  'fix.goal.kind.wish': 'Wish',
  'fix.goal.kind.planHelp': 'Has a monthly payment. Money is set aside for it every month.',
  'fix.goal.kind.wishHelp': 'Kept on your list. It asks for nothing until you make it a plan.',
  'fix.goal.tooMuch': 'With this, plans ask {amount} more a month than a normal month has.',

  // ── Loans & bills ─────────────────────────────────────────────────────────────────────────────
  'fix.loans.leftToRepay': 'Left to repay',
  'fix.loans.toRepayFast': '{amount} of it to repay fast',
  'fix.owed.loansOne': '{count} loan',
  'fix.owed.loansMany': '{count} loans',
  'fix.people.title': 'People',

  // ── The phone's bottom bar ────────────────────────────────────────────────────────────────────
  'fix.nav.more': 'More',
  'fix.nav.bar': 'Main places',

  // ── Home: the daily figure when the pace cannot be kept ───────────────────────────────────────
  'fix.hero.overLabel': 'At your pace, money runs out',
  'fix.hero.causeGoals': 'Your plans take {goals} before {until}. Without them you could spend {safe} a day.',
  'fix.hero.causeSavings': 'What you set aside takes {savings} before {until}. Without it: {safe} a day.',
  'fix.hero.causePace': 'You spend about {pace} a day. Even with nothing set aside there is room for {safe} a day.',
  'fix.hero.paceOnly': 'You spend about {pace} a day.',
  'fix.hero.toReach': 'To reach {until}: {safe} a day.',
  'fix.hero.reviewPlans': 'Review plans',

  // ── A normal month with nothing left, or already short, before the plans ──────────────────────
  'fix.goals.doesNotFitNone': 'Plans ask {goals} a month. In a month without a bonus, nothing is left after bills, loans and what you set aside.',
  'fix.goals.doesNotFitShort': 'Plans ask {goals} a month. A month without a bonus is already short by {amount} after bills, loans and what you set aside — before any plan.',
  'fix.goals.tightNone': 'After your plans, nothing is left to live on in a month without a bonus — you spend about {pace}.',
  'fix.goal.noRoom': 'A month without a bonus has nothing left for a plan after bills, loans and what you set aside.',
  'fix.goal.noRoomShort': 'A month without a bonus is already short by {amount} before any plan.',

  // ── History: one row per move, one per wallet check, loans in words ───────────────────────────
  'fix.history.moved': 'Moved money',
  'fix.history.from': 'from {wallet}',
  'fix.history.to': 'to {wallet}',
  'fix.history.check': 'Wallet check',
  'fix.history.checkShort': '{amount} not itemised',
  'fix.history.checkMore': '{amount} more than expected',
  'fix.history.checkEven': 'nothing missing',
  'fix.history.walletsMany': '{count} wallets',
  'fix.history.returned': 'Paid back to you: {amount}',
  'fix.chip.borrowed': 'Borrowed',
  'fix.chip.lent': 'Lent',
  'fix.chip.paidBack': 'Paid back',
  'fix.chip.loanPayment': 'Loan payment',
  'fix.history.notItemised': 'not itemised',
  'fix.history.more': 'more than expected',
} as const
