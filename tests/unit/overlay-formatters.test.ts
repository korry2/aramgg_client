import { describe, expect, it } from 'vitest'
import {
  formatAugmentRank,
  formatDataSource,
  formatNumber,
  formatPercent,
  getLocalizedText,
  normalizeTooltipText,
} from '../../src/renderer/service/overlay-formatters.ts'

describe('overlay formatters', () => {
  it('normalizes fractional and percentage rate values', () => {
    expect(formatPercent(0.523)).toBe('52.3%')
    expect(formatPercent(52.3)).toBe('52.3%')
    expect(formatPercent(null)).toBe('--')
  })

  it('formats augment recommendation ranks as T labels', () => {
    expect(formatAugmentRank(1)).toBe('T1')
    expect(formatAugmentRank('12')).toBe('T12')
    expect(formatAugmentRank(0)).toBe('--')
    expect(formatAugmentRank(null)).toBe('--')
  })

  it('uses stable localized text fallbacks and strips tooltip markup', () => {
    expect(getLocalizedText({ zh_CN: '中文', en_US: 'English' })).toBe('中文')
    expect(normalizeTooltipText('<p>造成&nbsp;伤害</p><br>持续 3 秒')).toBe('造成 伤害\n\n持续 3 秒')
  })

  it('formats compact counts and known data sources', () => {
    expect(formatNumber(12345)).toBe('1.2万')
    expect(formatNumber(0)).toBe('--')
    expect(formatDataSource('auto-analysis')).toBe('自动识别')
    expect(formatDataSource('custom')).toBe('custom')
  })
})
