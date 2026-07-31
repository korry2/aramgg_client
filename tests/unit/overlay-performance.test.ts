import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { shouldRaiseOverlayWindow } from '../../src/main/modules/overlay-window-state.ts'

describe('augment overlay performance safeguards', () => {
  it('raises an overlay only while it is hidden', () => {
    expect(shouldRaiseOverlayWindow({ isVisible: () => false })).toBe(true)
    expect(shouldRaiseOverlayWindow({ isVisible: () => true })).toBe(false)
  })

  it('keeps overlay rendering free of persistent blur and pulse effects', async () => {
    const [floatingOverlay, sidePanelOverlay] = await Promise.all([
      readFile(
        new URL('../../src/renderer/components/AugmentFloatingOverlay.vue', import.meta.url),
        'utf8',
      ),
      readFile(
        new URL('../../src/renderer/components/AugmentWinrateOverlay.vue', import.meta.url),
        'utf8',
      ),
    ])

    expect(floatingOverlay).not.toContain('backdrop-filter')
    expect(floatingOverlay).not.toContain('animation: pulse')
    expect(floatingOverlay).not.toContain('@keyframes pulse')
    expect(sidePanelOverlay).not.toContain('backdrop-filter')
  })

  it('uses rank-backed recommendations while displaying grouped augment tiers', async () => {
    const [floatingOverlay, championDetailOverlay] = await Promise.all([
      readFile(
        new URL('../../src/renderer/components/AugmentFloatingOverlay.vue', import.meta.url),
        'utf8',
      ),
      readFile(
        new URL('../../src/renderer/components/AugmentWinrateOverlay.vue', import.meta.url),
        'utf8',
      ),
    ])

    expect(floatingOverlay).toContain('formatPercent(augment.pickRate)')
    expect(floatingOverlay).toContain("t('augment.tierLabel')")
    expect(floatingOverlay).toContain('formatAugmentTier(augment.tier)')
    expect(floatingOverlay).not.toContain('formatAugmentTier(augment.rank)')
    expect(championDetailOverlay).toContain('rankAugmentRecommendations')
    expect(championDetailOverlay).toContain("t('augment.tierLabel')")
    expect(championDetailOverlay).toContain('formatAugmentTier(augment.tier)')
    expect(championDetailOverlay).not.toContain('formatAugmentTier(augment.rank)')
  })

  it('uses Electron background throttling defaults and guards every overlay raise path', async () => {
    const [windowManager, autoScreenshotService, appConfig, ipcHandlers] = await Promise.all([
      readFile(new URL('../../src/main/modules/window-manager.ts', import.meta.url), 'utf8'),
      readFile(new URL('../../src/main/auto-screenshot-service.ts', import.meta.url), 'utf8'),
      readFile(new URL('../../src/main/modules/app-config.ts', import.meta.url), 'utf8'),
      readFile(new URL('../../src/main/modules/ipc-handlers.ts', import.meta.url), 'utf8'),
    ])

    expect(windowManager).not.toContain('backgroundThrottling')
    expect(windowManager).toContain('!shouldRaiseOverlayWindow(window)')
    expect(autoScreenshotService.match(/if \(shouldRaiseOverlayWindow\(/g)).toHaveLength(2)
    expect(appConfig.match(/if \(shouldRaiseOverlayWindow\(/g)).toHaveLength(2)
    expect(ipcHandlers.match(/if \(shouldRaiseOverlayWindow\(/g)).toHaveLength(4)
  })
})
