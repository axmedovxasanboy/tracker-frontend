/**
 * English strings for the Investments page (INVEST-SPEC.md §2, Batch 78).
 * `uz.invest.ts` is a full Record of these keys, so a missing translation is a compile error.
 */
export const en_invest = {
  'invest.nav': 'Investments',
  'invest.title': 'Investments',
  'invest.total': 'In investments',
  'invest.putIn': 'Put in: {amount}',
  'invest.placesOne': 'In 1 place',
  'invest.places': 'In {count} places',
  'invest.hint': 'Money kept safe here: a business or an Islamic bank. A move is neither spending nor income.',
  'invest.move': 'Move',
  'invest.moveNeedsTwo': 'Add a second investment to move money between them.',
  'invest.share': '{pct}% of the total',
  'invest.lastMoved': 'Last move: {date}',
  'invest.recent': 'Recent moves',
  'invest.recentRow': '{from} → {to}',
  'invest.undo': 'Undo',
  'invest.undoConfirm': 'Undo this move? {amount} goes back from {to} to {from}.',
  'invest.undoneToast': 'Move undone',
  'invest.empty.title': 'No investments yet',
  'invest.empty.body': 'Add the business or Islamic bank where your money is kept. Choose "I already own it" for money that is there already.',
  'invest.seeAll': 'All',

  // ── The move sheet ──
  'invest.moveSheet.title': 'Move between investments',
  'invest.moveSheet.from': 'From',
  'invest.moveSheet.to': 'To',
  'invest.moveSheet.all': 'All of it: {amount}',
  'invest.moveSheet.note': 'Note',
  'invest.moveSheet.notePlaceholder': 'Why it moved',
  'invest.moveSheet.hint': 'No wallet changes: this is neither spending nor income.',
  'invest.moveSheet.preview': '{name}: {before} → {after}',
  'invest.moveSheet.submit': 'Move',
  'invest.moveSheet.saving': 'Moving…',
  'invest.moveSheet.doneToast': '{amount} moved to {name}',
  'invest.moveSheet.err.pick': 'Choose where from and where to.',
  'invest.moveSheet.err.differ': 'Choose two different investments.',
  'invest.moveSheet.err.amount': 'Enter an amount above 0.',
  'invest.moveSheet.err.tooMuch': '{name} has only {amount}.',
  'invest.moveSheet.err.future': 'The date cannot be in the future.',

  // ── A holding's money in and out ──
  'invest.history.movedOut': 'Moved → {name}',
  'invest.history.movedIn': 'Moved in ← {name}',
} as const
