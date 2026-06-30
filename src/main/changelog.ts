export type ChangelogEntry = {
  version: string
  date: string
  title: string
  summary: string
  changes: string[]
}

const ENTRY_LIMIT = 8
const CHANGE_LIMIT = 8
const SHORT_TEXT_LIMIT = 120
const SUMMARY_TEXT_LIMIT = 220

export const LOCAL_CHANGELOG_ENTRIES: ChangelogEntry[] = [
  {
    version: '0.1.18',
    date: '2026-06-30',
    title: '赛后分享与本地数据体验',
    summary: '新增对局结束后的分享海报，并优化前台数据的本地优先加载体验。',
    changes: [
      '新增赛后战绩分享海报，支持在对局结束后生成分享图。',
      '英雄详情、海克斯弹窗和推荐列表优先使用完整本地数据，减少等待远端检查时的空白。',
    ],
  },
  {
    version: '0.1.17',
    date: '2026-06-29',
    title: '自动更新支持',
    summary: '新增客户端自动更新能力，为后续版本升级做准备。',
    changes: [
      '支持自动更新功能。',
    ],
  },
  {
    version: '0.1.16',
    date: '2026-06-29',
    title: '数据版本更新',
    summary: '更新客户端可用数据版本。',
    changes: [
      '支持 0.16.13 版本数据。',
    ],
  },
  {
    version: '0.1.15',
    date: '2026-06-25',
    title: '稳定推荐与快捷键',
    summary: '减少误触入口，继续打磨海克斯推荐浮窗的稳定性。',
    changes: [
      '移除隐藏的 F1 截图快捷键，避免游戏内误触。',
      '稳定海克斯推荐浮窗在推荐刷新和显示切换时的表现。',
    ],
  },
  {
    version: '0.1.14',
    date: '2026-06-22',
    title: '海克斯识别与托盘控制',
    summary: '增强部分海克斯选择场景，并补齐 Windows 托盘控制。',
    changes: [
      '支持显示部分识别到的海克斯选择结果。',
      '新增 Windows 托盘入口，便于显示、隐藏和退出应用。',
    ],
  },
  {
    version: '0.1.13',
    date: '2026-06-16',
    title: '选人推荐增强',
    summary: 'ARAM 席位推荐开始纳入队友选择信息，并修复侧边栏交互。',
    changes: [
      '席位推荐会参考队友已选英雄。',
      '修复海克斯侧边栏标签页点击区域。',
      '优化诊断日志，便于排查 LCU 与数据问题。',
    ],
  },
  {
    version: '0.1.12',
    date: '2026-06-13',
    title: '英雄详情增强',
    summary: '英雄详情窗口支持多套出装路线，推荐信息更完整。',
    changes: [
      '新增多套英雄出装洞察。',
      '英雄详情窗口继续保持 ARAM 选人推荐展示入口。',
    ],
  },
  {
    version: '0.1.11',
    date: '2026-06-11',
    title: '连接兜底与浮窗偏好',
    summary: '改善 LCU 自动发现失败时的兜底能力，并加入浮窗偏好设置。',
    changes: [
      '新增英雄联盟目录手动兜底配置。',
      '新增海克斯浮窗偏好开关。',
      '压缩海克斯列表展示，减少主界面占用。',
    ],
  },
]

function cleanText(value: unknown, maxLength = SHORT_TEXT_LIMIT): string {
  if (value === null || value === undefined) {
    return ''
  }

  const text = String(value).replace(/\s+/g, ' ').trim()
  if (text.length <= maxLength) {
    return text
  }

  return `${text.slice(0, Math.max(0, maxLength - 3)).trim()}...`
}

function stripListMarker(value: string): string {
  return value.replace(/^[-*•]\s*/, '').trim()
}

function uniqueItems(items: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const item of items) {
    const text = cleanText(stripListMarker(item))
    if (!text || seen.has(text)) {
      continue
    }

    seen.add(text)
    result.push(text)

    if (result.length >= CHANGE_LIMIT) {
      break
    }
  }

  return result
}

function normalizeChangeItem(item: unknown): string {
  if (item === null || item === undefined) {
    return ''
  }

  if (typeof item === 'object' && !Array.isArray(item)) {
    const record = item as Record<string, unknown>
    return cleanText(
      record.text ??
      record.title ??
      record.summary ??
      record.description ??
      record.message ??
      record.change
    )
  }

  return cleanText(item)
}

function normalizeChangeItems(value: unknown): string[] {
  if (value === null || value === undefined) {
    return []
  }

  if (Array.isArray(value)) {
    return uniqueItems(value.map(normalizeChangeItem))
  }

  if (typeof value === 'string') {
    return uniqueItems(value.split(/\r?\n/).map((line) => line.trim()))
  }

  return uniqueItems([normalizeChangeItem(value)])
}

function getEntryChanges(record: Record<string, unknown>): string[] {
  return uniqueItems([
    ...normalizeChangeItems(record.changes),
    ...normalizeChangeItems(record.items),
    ...normalizeChangeItems(record.highlights),
    ...normalizeChangeItems(record.features),
    ...normalizeChangeItems(record.fixes),
  ])
}

function normalizeEntry(value: unknown, fallbackVersion = ''): ChangelogEntry | null {
  if (Array.isArray(value)) {
    const changes = normalizeChangeItems(value)
    return changes.length
      ? {
          version: cleanText(fallbackVersion, 40),
          date: '',
          title: '',
          summary: '',
          changes,
        }
      : null
  }

  if (typeof value === 'string') {
    const changes = normalizeChangeItems(value)
    return changes.length
      ? {
          version: cleanText(fallbackVersion, 40),
          date: '',
          title: '',
          summary: '',
          changes,
        }
      : null
  }

  if (!value || typeof value !== 'object') {
    return null
  }

  const record = value as Record<string, unknown>
  const entry: ChangelogEntry = {
    version: cleanText(record.version ?? record.tag ?? fallbackVersion, 40).replace(/^v(?=\d)/i, ''),
    date: cleanText(
      record.date ??
      record.publishedAt ??
      record.releasedAt ??
      record.generatedAt,
      40
    ),
    title: cleanText(record.title ?? record.name, 80),
    summary: cleanText(record.summary ?? record.description ?? record.body, SUMMARY_TEXT_LIMIT),
    changes: getEntryChanges(record),
  }

  if (!entry.version && !entry.date && !entry.title && !entry.summary && entry.changes.length === 0) {
    return null
  }

  return entry
}

function looksLikeEntryRecord(record: Record<string, unknown>): boolean {
  return [
    'version',
    'tag',
    'date',
    'publishedAt',
    'releasedAt',
    'generatedAt',
    'title',
    'summary',
    'description',
    'body',
    'changes',
    'items',
    'highlights',
    'features',
    'fixes',
  ].some((key) => key in record)
}

function normalizeObjectEntries(source: Record<string, unknown>): ChangelogEntry[] {
  if (Array.isArray(source.entries)) {
    return normalizeChangelogEntries(source.entries)
  }

  if (Array.isArray(source.releases)) {
    return normalizeChangelogEntries(source.releases)
  }

  if (looksLikeEntryRecord(source)) {
    const entry = normalizeEntry(source)
    return entry ? [entry] : []
  }

  return Object.entries(source)
    .map(([version, value]) => normalizeEntry(value, version))
    .filter((entry): entry is ChangelogEntry => Boolean(entry))
    .slice(0, ENTRY_LIMIT)
}

export function normalizeChangelogEntries(source: unknown): ChangelogEntry[] {
  if (Array.isArray(source)) {
    return source
      .map((entry) => normalizeEntry(entry))
      .filter((entry): entry is ChangelogEntry => Boolean(entry))
      .slice(0, ENTRY_LIMIT)
  }

  if (typeof source === 'string') {
    const entry = normalizeEntry(source)
    return entry ? [entry] : []
  }

  if (source && typeof source === 'object') {
    return normalizeObjectEntries(source as Record<string, unknown>).slice(0, ENTRY_LIMIT)
  }

  return []
}

export function getChangelogEntries(config: Record<string, any> = {}, clientConfig: Record<string, any> = {}): ChangelogEntry[] {
  const candidates = [
    clientConfig.changelog,
    clientConfig.releaseNotes,
    clientConfig.changes,
    config.client?.changelog,
    config.client?.releaseNotes,
    config.electron?.changelog,
    config.electron?.releaseNotes,
    config.changelog,
    config.releaseNotes,
    config.changes,
  ]

  for (const candidate of candidates) {
    const entries = normalizeChangelogEntries(candidate)
    if (entries.length > 0) {
      return entries
    }
  }

  return LOCAL_CHANGELOG_ENTRIES
}
