import { TrendingDown } from 'lucide-react'
import { Tile } from '../ui/Tile'
import { Button } from '../ui/Button'
import { IconChip } from '../ui/IconChip'
import { useLang } from '../../i18n/LanguageContext'
import { useLevels } from '../../context/LevelsContext'
import { formatDate, moneyFull } from '../../utils/format'
import { LEVEL5_PAY, percentsText } from './levelWords'

/**
 * "Back to Level 4 from May 2027" (spec §2.5): a tile, not a dialog — the way down is not an event
 * to stop the owner for. The same tile on Home and Profile; OK on either hides it on both.
 */
export function LevelDownNotice({ className = '' }: { className?: string }) {
  const { t, lang } = useLang()
  const { down, dismissDown } = useLevels()
  if (!down) return null
  const months = down.months.map(m => formatDate(m.month, lang, 'monthShort')).join(' · ')
  const vars = { amount: moneyFull(LEVEL5_PAY), months, n: down.level }
  return (
    <Tile span={12} as="section" className={className}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <IconChip tone="amber"><TrendingDown className="h-4 w-4" aria-hidden="true" /></IconChip>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-900">
              {t('lvl.down.title', { n: down.level, month: formatDate(down.from, lang, 'monthShort') })}
            </h2>
            <p className="mt-0.5 text-sm tabular-nums text-slate-600">
              {down.percents
                ? t('lvl.down.body', { ...vars, percents: percentsText(down.percents) })
                : t('lvl.down.bodyShort', vars)}
            </p>
          </div>
        </div>
        <Button label={t('lvl.ok')} onClick={dismissDown} className="shrink-0 self-end sm:self-start" />
      </div>
    </Tile>
  )
}
