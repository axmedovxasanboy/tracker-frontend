/**
 * Strings for the 2026-09 rebuild's Home, Savings and the add / pay forms. Merged into the main
 * dictionary by LanguageContext.
 *
 * One name per thing: "You have" (wallet total), "Earned / Spent in {month}", "Coming up" (bills and
 * loan payments due), "Savings", "Loans & bills". Buttons say Add, Pay or Save. None of these
 * strings may talk about levels, buckets, allocation, marks or closing a month.
 */
export const en_home = {
  // ── Home: this month in and out ─────────────────────────────────────────────────────────────
  'home.month.earned': 'Earned in {month}',
  'home.month.spent': 'Spent in {month}',
  'home.hero.noIncome': 'Set your monthly income first — Tracker needs it before anything can be recorded.',

  // A tile of its own, when the plans ask more than a normal month has.
  'home.plans.title': 'Plans don’t fit your income',
  'home.plans.change': 'Change',

  // ── Home: Coming up ─────────────────────────────────────────────────────────────────────────
  'home.upcoming.title': 'Coming up',
  'home.upcoming.all': 'All loans & bills',
  'home.upcoming.empty': 'Nothing due in the next 5 weeks.',
  'home.upcoming.overdue': 'Overdue',
  'home.upcoming.repayFast': 'Repay fast',
  // Entered ahead for its day: the money leaves then, and there is nothing to pay now.
  'home.upcoming.recorded': 'Recorded',

  // ── Home + Savings: this month's savings ────────────────────────────────────────────────────
  'home.savings.title': 'To set aside this month',
  'home.savings.open': 'Open Savings',
  'home.savings.ofTarget': '{paid} of {target}',
  'home.savings.page': 'Savings',
  'home.savings.thisMonth': 'To set aside this month',
  'home.savings.leftCaption': 'still to set aside this month',
  'home.savings.allDone': 'Everything for this month is set aside.',
  'home.savings.nothing': 'Nothing to set aside this month.',
  'home.savings.addMore': 'Put in more',
  'home.savings.over': '+{amount} more than asked',
  'home.savings.carried': 'incl. {amount} from {month}',

  // ── Home: You have ──────────────────────────────────────────────────────────────────────────
  'home.have.checkedToday': 'Checked today',
  'home.have.checkedAgoOne': 'Checked {days} day ago',
  'home.have.checkedAgo': 'Checked {days} days ago',
  'home.have.notChecked': 'Not checked yet',

  // ── Home: new suggestion codes ──────────────────────────────────────────────────────────────
  'home.s.paceWarning': 'At your recent pace ({pace} a day) your money runs out around {date}. Try to keep to {safe} a day.',
  'home.s.short': 'You’ll be short {amount} on {date}.',

  // ── Savings page ────────────────────────────────────────────────────────────────────────────
  'home.goals.title': 'Goals',
  'home.goals.empty': 'Saving for a home, a car, a trip? Add it as a goal.',
  'home.goals.ofTarget': '{value} of {target}',
  'home.goals.perMonth': '{amount} a month',
  'home.goals.perMonthFrom': '{amount} a month from {month}',
  'home.goals.by': 'by {month}',
  'home.goals.onTrack': 'On track',
  'home.goals.behind': 'Behind — about {amount} a month needed',
  'home.emergency.empty': 'Nothing in the emergency fund yet.',
  'home.donations.thisYear': 'Given in {year}',
  'home.list.showAll': 'Show all ({count})',
  'home.list.showLess': 'Show less',

  // ── Short forms: a goal ─────────────────────────────────────────────────────────────────────
  'home.goal.addTitle': 'New goal',
  'home.goal.editTitle': 'Edit goal',
  'home.goal.name': 'Name',
  'home.goal.namePlaceholder': 'A home, a car, a trip…',
  'home.goal.target': 'Target amount',
  'home.goal.have': 'I already have',
  'home.goal.haveHelp': 'Money already put by for this. No wallet is touched.',
  'home.goal.monthly': 'Monthly payment',
  'home.goal.monthlySuggested': 'Suggested from your target and deadline — change it if you like.',
  'home.goal.start': 'Payments start',
  'home.goal.deadline': 'Deadline',
  'home.goal.reachBy': 'At {monthly} a month you’ll reach it around {month}.',
  'home.goal.reachLate': 'At {monthly} a month you’ll reach it around {month} — that’s after your deadline. About {needed} a month would make it.',
  'home.goal.err.monthly': 'Enter how much you’ll put in each month.',
  'home.goal.err.start': 'Pick the month payments start.',
  // Only while the server still refuses a goal that starts from nothing.
  'home.goal.err.zeroStart': 'Couldn’t save with nothing already put by — try again in a minute.',
  'home.goal.err.name': 'Give the goal a name.',
  'home.goal.err.target': 'Enter how much the goal needs.',
  'home.goal.addedToast': 'Goal added · {name}',
  'home.goal.savedToast': 'Goal saved · {name}',
  'home.goal.confirmDelete': 'Delete this goal?',
  'home.goal.deletedToast': 'Goal deleted',

  // ── Short forms: an investment ──────────────────────────────────────────────────────────────
  'home.investment.addedToast': 'Investment added · {name}',

  // ── The wallet question, in every form ──────────────────────────────────────────────────────
  'home.wallet.from': 'From',
  'home.wallet.to': 'To',
  'home.wallet.split': 'Split between card and cash',
  'home.wallet.noSplit': 'Don’t split',
  'home.wallet.none': 'Not from a wallet',
  'home.wallet.noneHelp': 'The money was already there — no wallet is touched.',
  'home.wallet.alreadyOwn': 'I already own it',
  'home.wallet.alreadyOwnHelp': 'Bought before — no wallet is touched.',

  // ── Add and pay forms ───────────────────────────────────────────────────────────────────────
  'home.form.everydaySpending': 'Everyday spending (from a wallet check)',
  'home.form.cashPart': 'Paid in cash',
  'home.form.cardPart': 'On the card: {amount}',
  'home.form.err.splitParts': 'Enter the cash part — more than 0 and less than the amount.',
  'home.form.pickCategory': 'Pick a category',
  'home.form.elseSavings': 'Savings',
  'home.form.usualAmount': 'Usually {amount}',
  'home.form.useAsUsual': 'Make {amount} the usual amount from now on',
  'home.form.suggested': 'This month: {amount}.',
  'home.form.fundName': 'Fund name',
  'home.form.bank.none': 'No bank loan has a monthly payment yet. Add it in Loans & bills.',
  'home.form.loan.title': 'Pay back a loan',
  'home.form.loan.pick': 'Who are you paying?',
  'home.form.loan.thisMonth': 'This month',
  'home.form.repay.returnedTitle': 'Money paid back to you',
  'home.form.repay.leftToPay': 'Left to pay: {amount}',
  'home.form.repay.stillOwedToYou': 'Still owed to you: {amount}',
  'home.form.repay.leftAfter': 'Left to pay after this: {amount}',
  'home.form.repay.stillOwedAfter': 'Still owed to you after this: {amount}',

  // ── Check wallets ───────────────────────────────────────────────────────────────────────────
  'home.checkIn.title': 'Check wallets · {date}',
  'home.checkIn.intro': 'Type what is really in each wallet now. Any gap from the app’s figure is saved as everyday spending.',
  'home.checkIn.locked': 'This month can’t be changed any more.',
} as const
