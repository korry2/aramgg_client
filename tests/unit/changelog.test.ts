import { describe, expect, it } from 'vitest'
import {
  getChangelogEntries,
  normalizeChangelogEntries,
} from '../../src/main/changelog.ts'

describe('changelog entries', () => {
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
    expect(fallbackEntries[0].version).toBe('0.1.15')
  })
})
