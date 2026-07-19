import { describe, expect, it } from 'vitest'
import {
  getChangelogEntries,
  LOCAL_CHANGELOG_ENTRIES,
  normalizeChangelogEntries,
} from '../../src/main/changelog.ts'

describe('changelog entries', () => {
  it('includes the latest window and post-game experience announcement', () => {
    const latestEntry = LOCAL_CHANGELOG_ENTRIES[0]

    expect(latestEntry.version).toBe('0.2.2')
    expect(latestEntry.date).toBe('2026-07-19')
    expect(latestEntry.changes).toEqual(expect.arrayContaining([
      expect.stringContaining('对局结束时不再自动跳出'),
      expect.stringContaining('英雄胜率窗口会记住'),
      expect.stringContaining('自动展示赛后海报'),
      expect.stringContaining('语言切换统计'),
    ]))
  })

  it('normalizes array based remote changelog entries', () => {
    const entries = normalizeChangelogEntries([
      {
        version: 'v0.2.0',
        publishedAt: '2026-07-01T10:00:00.000Z',
        title: 'Release notes',
        changes: ['New control panel', { text: 'Better update prompt' }],
      },
    ])

    expect(entries).toEqual([
      {
        version: '0.2.0',
        date: '2026-07-01T10:00:00.000Z',
        title: 'Release notes',
        summary: '',
        changes: ['New control panel', 'Better update prompt'],
      },
    ])
  })

  it('normalizes version keyed changelog objects', () => {
    const entries = normalizeChangelogEntries({
      '0.2.0': ['Add update log', 'Improve tray menu'],
      '0.1.15': 'Stabilize augment overlays',
    })

    expect(entries.map((entry) => entry.version)).toEqual(['0.2.0', '0.1.15'])
    expect(entries[0].changes).toEqual(['Add update log', 'Improve tray menu'])
    expect(entries[1].changes).toEqual(['Stabilize augment overlays'])
  })

  it('prefers remote client changelog and falls back to local entries', () => {
    const remoteEntries = getChangelogEntries(
      {},
      {
        changelog: {
          version: '0.2.0',
          changes: ['Remote entry'],
        },
      }
    )
    const fallbackEntries = getChangelogEntries({}, {})

    expect(remoteEntries).toHaveLength(1)
    expect(remoteEntries[0].changes).toEqual(['Remote entry'])
    expect(fallbackEntries[0].version).toBe(LOCAL_CHANGELOG_ENTRIES[0].version)
  })
})
