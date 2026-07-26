import { describe, expect, it } from 'vitest'
import { mapChampionBuilds } from '../../src/main/data-loader.ts'

describe('champion build mapping', () => {
  it('maps the public builds array as the only build source', () => {
    const mapped = mapChampionBuilds({
      builds: [
        {
          queueId: 450,
          tags: { damage: 'AP' },
          stats: { games: 1000, wins: 540, winRate: 0.54, pickRate: 0.2 },
          startingItems: [{ items: [1056, 2003], games: 200, wins: 110 }],
          coreItems: [{ items: [6653, 3020, 4645], games: 500, wins: 275 }],
          itemExtensions: [{ items: [3089], games: 80, wins: 45 }],
          situationalItems: [{ items: [3157], games: 90, wins: 50 }],
          summonerSpells: [
            {
              summonerSpellIds: [4, 32],
              games: 720,
              wins: 400,
              pick_rate: 0.72,
              win_rate: 0.556,
            },
          ],
          skillOrders: [
            {
              skillOrder: [1, 2, 3, 1, 1, 4, 1, 2, 1, 2, 4, 2, 2, 3, 3, 4, 3, 3],
              games: 680,
              wins: 370,
              pick_rate: 0.68,
              win_rate: 0.544,
            },
          ],
        },
        {
          queueId: 450,
          tags: { damage: 'Burn' },
          stats: { games: 800, wins: 420, winRate: 0.525, pickRate: 0.16 },
          coreItems: [{ itemIds: [6655, 3020, 4646], games: 320, wins: 170 }],
        },
      ],
    }, 1)

    expect(mapped.builds).toHaveLength(2)
    expect(mapped.coreItems[0].itemIds).toEqual(['6653', '3020', '4645'])
    expect(mapped.startingItems[0].itemIds).toEqual(['1056', '2003'])
    expect(mapped.situationalItems[0].itemId).toBe('3157')
    expect(mapped.summonerSpells[0]).toMatchObject({
      summonerSpellIds: [4, 32],
      games: 720,
      pickRate: 0.72,
      winRate: 0.556,
    })
    expect(mapped.skillOrders[0]).toMatchObject({
      skillOrder: [1, 2, 3, 1, 1, 4, 1, 2, 1, 2, 4, 2, 2, 3, 3, 4, 3, 3],
      games: 680,
      pickRate: 0.68,
      winRate: 0.544,
    })
  })
})
