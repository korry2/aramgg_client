import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'fs/promises'
import os from 'os'
import path from 'path'
import {
  DEFAULT_CLIENT_DATA_LOCALE,
  SUPPORTED_CLIENT_DATA_LOCALES,
  getLocalePointerFileName,
  getLocaleVersionRelativePath,
  shouldPruneVersionDirectory,
} from '../../scripts/fetch-client-data.mjs'

let tempRoot = ''

async function writeJson(filePath: string, payload: any): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, JSON.stringify(payload), 'utf8')
}

function jsonResponse(payload: any): any {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => payload,
  }
}

async function seedOcrLocale(locale: string, dataVersion: string, augmentName: string): Promise<void> {
  const dataRoot = path.join(tempRoot, 'data')
  const pointerName = locale === DEFAULT_CLIENT_DATA_LOCALE
    ? 'current.json'
    : `current.${locale}.json`
  const versionDir = locale === DEFAULT_CLIENT_DATA_LOCALE
    ? path.join(dataRoot, 'versions', dataVersion)
    : path.join(dataRoot, 'versions', locale, dataVersion)

  await writeJson(path.join(dataRoot, pointerName), {
    schemaVersion: 3,
    locale,
    dataVersion,
  })
  await writeJson(path.join(versionDir, 'manifest.json'), {
    locale,
    dataVersion,
    files: [{ path: 'augments.json' }],
  })
  await writeJson(path.join(versionDir, 'augments.json'), {
    augments: [{ id: 1001, name: augmentName, rarity: 'gold' }],
  })
}

async function seedCompleteChampionLocale(locale: string, dataVersion: string): Promise<void> {
  const dataRoot = path.join(tempRoot, 'data')
  const pointerName = `current.${locale}.json`
  const versionDir = path.join(dataRoot, 'versions', locale, dataVersion)
  const files = [
    'manifest.json',
    'augments.json',
    'champions.json',
    'items.json',
    'champion-shards/index.json',
    'champion-shards/0.json',
  ]

  await writeJson(path.join(dataRoot, pointerName), {
    schemaVersion: 3,
    locale,
    dataVersion,
  })
  await writeJson(path.join(versionDir, 'manifest.json'), {
    locale,
    dataVersion,
    files: files.map((filePath) => ({ path: filePath })),
  })
  await writeJson(path.join(versionDir, 'augments.json'), {
    augments: [{ id: 1001, name: 'Scoped Weapons', rarity: 'gold' }],
  })
  await writeJson(path.join(versionDir, 'champions.json'), {
    champions: [{
      id: 8,
      name: 'Vladimir',
      alias: 'Vladimir',
      stats: { games: 100, wins: 55, winRate: 0.55, pickRate: 0.1 },
    }],
  })
  await writeJson(path.join(versionDir, 'items.json'), {
    items: [{ id: 6653, name: 'Liandry\'s Torment', description: 'Burns enemies.' }],
  })
  await writeJson(path.join(versionDir, 'champion-shards', 'index.json'), {
    shards: [{ path: 'champion-shards/0.json', championIds: [8] }],
  })
  await writeJson(path.join(versionDir, 'champion-shards', '0.json'), {
    champions: {
      8: {
        champion: { id: 8, name: 'Vladimir', alias: 'Vladimir' },
        builds: [{
          stats: { games: 100, wins: 55, winRate: 0.55 },
          coreItems: [{ items: [6653] }],
        }],
        augments: [{
          id: 1001,
          stats: { games: 80, wins: 48, winRate: 0.6, pickRate: 0.2 },
        }],
      },
    },
  })
}

describe('packaged client data locale layout', () => {
  it('keeps the runtime and packaging locale lists aligned', async () => {
    const source = await readFile(
      path.resolve('src/main/data-loader.ts'),
      'utf8'
    )

    expect(SUPPORTED_CLIENT_DATA_LOCALES).toEqual(['zh-CN', 'en-US', 'zh-TW'])
    for (const locale of SUPPORTED_CLIENT_DATA_LOCALES) {
      expect(source).toContain(`code: '${locale}'`)
    }
  })

  it('uses legacy-compatible default paths and locale-scoped non-default paths', () => {
    expect(getLocalePointerFileName('zh-CN')).toBe('current.json')
    expect(getLocalePointerFileName('en-US')).toBe('current.en-US.json')
    expect(getLocalePointerFileName('zh-TW')).toBe('current.zh-TW.json')
    expect(getLocaleVersionRelativePath('zh-CN', '16.13.3')).toBe(
      path.join('versions', '16.13.3')
    )
    expect(getLocaleVersionRelativePath('en-US', '16.13.3')).toBe(
      path.join('versions', 'en-US', '16.13.3')
    )
  })

  it('does not prune locale directories while cleaning default data versions', () => {
    expect(shouldPruneVersionDirectory('zh-CN', '16.12.1', '16.13.3')).toBe(true)
    expect(shouldPruneVersionDirectory('zh-CN', '16.13.3', '16.13.3')).toBe(false)
    expect(shouldPruneVersionDirectory('zh-CN', 'en-US', '16.13.3')).toBe(false)
    expect(shouldPruneVersionDirectory('zh-CN', 'zh-TW', '16.13.3')).toBe(false)
    expect(shouldPruneVersionDirectory('en-US', '16.12.1', '16.13.3')).toBe(true)
  })
})

describe('runtime client data locale validation', () => {
  beforeEach(async () => {
    vi.resetModules()
    vi.unstubAllGlobals()
    tempRoot = await mkdtemp(path.join(os.tmpdir(), 'aramgg-locale-data-'))
    vi.doMock('../../src/main/modules/app-paths.ts', () => ({
      getAppDataDir: () => tempRoot,
      getLogDir: () => path.join(tempRoot, 'logs'),
    }))
  })

  afterEach(async () => {
    vi.unstubAllGlobals()
    vi.resetModules()
    await rm(tempRoot, { recursive: true, force: true })
    tempRoot = ''
  })

  it('does not label an undeclared config response as the requested non-default locale', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({
      dataVersion: '16.13.3',
      manifest: '/api/client/v1/data/16.13.3/manifest.json',
    })))

    const { loadDataApiConfig, clearCache } = await import('../../src/main/data-loader.ts')
    try {
      const config = await loadDataApiConfig({ locale: 'en-US' })
      expect(config.locale).toBe('zh-CN')
    } finally {
      clearCache()
    }
  })

  it('loads OCR names from a partial locale cache without requesting full champion data', async () => {
    await seedOcrLocale('en-US', '16.13.3-en', 'Scoped Weapons')
    const fetchMock = vi.fn(async (input: any) => {
      throw new Error(`Unexpected remote request: ${String(input)}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const { loadAugmentBaseForOcrLocale, clearCache } = await import('../../src/main/data-loader.ts')
    try {
      const result = await loadAugmentBaseForOcrLocale('en-US')
      expect(result.locale).toBe('en-US')
      expect(result.dataVersion).toBe('16.13.3-en')
      expect(result.augments).toMatchObject([{ id: 1001, name: 'Scoped Weapons' }])
      expect(fetchMock).not.toHaveBeenCalled()
    } finally {
      clearCache()
    }
  })

  it('keeps an aggregated champion response on one explicitly requested locale', async () => {
    await seedCompleteChampionLocale('en-US', '16.13.3-en')
    vi.stubGlobal('fetch', vi.fn(async (input: any) => {
      throw new Error(`Background refresh unavailable: ${String(input)}`)
    }))

    const { getChampionDetailData, clearCache } = await import('../../src/main/data-loader.ts')
    try {
      const detail = await getChampionDetailData(8, 'en-US')
      expect(detail.locale).toBe('en-US')
      expect(detail.dataVersion).toBe('16.13.3-en')
      expect(detail.championName.nameCN).toBe('Vladimir')
      expect(detail.augmentBase).toMatchObject([{ id: 1001, name: 'Scoped Weapons' }])
      expect(detail.items[0].name.en_us).toBe("Liandry's Torment")
    } finally {
      clearCache()
    }
  })
})
