import { describe, expect, it } from 'vitest'
import {
  createBuildRoutes,
  normalizeSingleItemRecords
} from '../../src/renderer/service/champion-build-routes.js'

describe('champion build routes', () => {
  it('flattens and deduplicates next item records by item id', () => {
    const records = normalizeSingleItemRecords([
      { itemIds: [3075, 3065], games: 40, wins: 22 },
      { itemIds: [3075], games: 203, wins: 118, winRate: 0.58 },
      { itemIds: [3065], games: 110, wins: 61, winRate: 0.55 },
    ])

    expect(records.map(record => record.itemId)).toEqual(['3075', '3065'])
    expect(records[0].games).toBe(203)
    expect(records[1].games).toBe(110)
  })

  it('keeps repeated item extensions to one visible next item per route', () => {
    const routes = createBuildRoutes({
      builds: [
        {
          tags: { style: 'Tank' },
          patch: '16.12',
          stats: { games: 1000, winRate: 0.54 },
          coreItems: [
            { itemIds: [3084, 3111, 2502], games: 968, winRate: 0.56 },
          ],
          itemExtensions: [
            { coreItemIds: [3084, 3111, 3748], itemIds: [3075], games: 59, winRate: 0.53 },
            { coreItemIds: [2502, 3047, 3084], itemIds: [3075], games: 81, winRate: 0.56 },
            { coreItemIds: [3084, 3111, 6664], itemIds: [3075], games: 203, winRate: 0.57 },
            { coreItemIds: [2502, 3084, 3111], itemIds: [3065], games: 110, winRate: 0.55 },
            { coreItemIds: [2502, 3084, 3111], itemIds: [3065], games: 97, winRate: 0.54 },
            { coreItemIds: [2502, 3084, 3111], itemIds: [3083], games: 68, winRate: 0.52 },
          ],
          situationalItems: [
            { id: 2504, games: 1165, winRate: 0.54, averageIndex: 2.8 },
            { itemId: 2504, games: 200, winRate: 0.58, averageIndex: 3.4 },
          ],
        },
      ],
    })

    expect(routes).toHaveLength(1)
    expect(routes[0].itemExtensions.map(item => item.itemId)).toEqual(['3075', '3065', '3083'])
    expect(routes[0].itemExtensions[0].games).toBe(203)
    expect(routes[0].situationalItems.map(item => item.itemId)).toEqual(['2504'])
    expect(routes[0].situationalItems[0].distinctiveScore).toBe(3.4)
  })
})
