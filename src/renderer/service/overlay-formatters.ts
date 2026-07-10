function normalizeRateValue(value: unknown): number | null {
  if (value == null || value === '') return null
  const number = Number(value)
  if (!Number.isFinite(number)) return null
  return number > 1 ? number / 100 : number
}

export function getLocalizedText(value: unknown): string {
  if (typeof value === 'string') {
    return value
  }

  if (!value || typeof value !== 'object') {
    return ''
  }

  const localized = value as Record<string, unknown>
  const text = localized.zh_CN || localized.zh_cn || localized.en_us || localized.en_US
  return typeof text === 'string' ? text : ''
}

export function normalizeTooltipText(value: unknown): string {
  const raw = getLocalizedText(value)
  if (!raw) {
    return ''
  }

  return raw
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

export function formatPercent(value: unknown): string {
  const normalized = normalizeRateValue(value)
  return normalized == null ? '--' : `${(normalized * 100).toFixed(1)}%`
}

export function getWinRateClass(value: unknown): string {
  const normalized = normalizeRateValue(value)
  if (!normalized) return ''
  if (normalized >= 0.55) return 'high'
  if (normalized >= 0.5) return 'medium'
  return 'low'
}

export function formatNumber(value: unknown): string {
  const number = Number(value)
  if (!Number.isFinite(number) || number === 0) return '--'
  return number >= 10000 ? `${(number / 10000).toFixed(1)}万` : String(number)
}

export function formatDataSource(source: unknown): string {
  const labels: Record<string, string> = {
    local: '本地',
    remote: '远程数据',
    pending: '加载中',
    unavailable: '不可用',
    test: '测试',
    'auto-analysis': '自动识别',
    'local-analysis': '本地识别',
    fallback: '备用数据',
  }
  const key = typeof source === 'string' ? source : ''
  return labels[key] || key || '未知'
}

export function formatTime(value: unknown): string {
  if (!value) return ''
  const date = new Date(value as string | number | Date)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString('zh-CN')
}

export function handleImageError(event: Event): void {
  if (event.target instanceof HTMLImageElement) {
    event.target.style.display = 'none'
  }
}
