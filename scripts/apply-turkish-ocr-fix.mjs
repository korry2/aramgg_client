import fs from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const target = path.join(root, 'src', 'main', 'image-analyzer.ts')
const source = await fs.readFile(target, 'utf8')

const replacements = [
  {
    label: 'OCR locale normalization',
    from: `function getSupportedOcrLocales() {\n    const locales = SUPPORTED_DATA_LOCALES.map(locale => locale.code)\n    return [DEFAULT_DATA_LOCALE, ...locales.filter(locale => locale !== DEFAULT_DATA_LOCALE)]\n}\n\nfunction extractRiotLocaleHintDetail(payload) {`,
    to: `function getSupportedOcrLocales() {\n    const locales = SUPPORTED_DATA_LOCALES.map(locale => locale.code)\n    return [...new Set([DEFAULT_DATA_LOCALE, ...locales, 'tr-TR'])]\n}\n\nfunction normalizeOcrLocaleHint(value) {\n    const normalized = String(value || '')\n        .trim()\n        .replace(/_/g, '-')\n        .toLowerCase()\n\n    if (normalized === 'tr' || normalized === 'tr-tr') {\n        return 'tr-TR'\n    }\n\n    return tryNormalizeDataLocale(value)\n}\n\nfunction extractRiotLocaleHintDetail(payload) {`,
  },
  {
    label: 'Riot locale payload normalization',
    from: `            locale: tryNormalizeDataLocale(payload),`,
    to: `            locale: normalizeOcrLocaleHint(payload),`,
  },
  {
    label: 'Riot locale field normalization',
    from: `        const locale = tryNormalizeDataLocale(payload[key])`,
    to: `        const locale = normalizeOcrLocaleHint(payload[key])`,
  },
  {
    label: 'CommunityDragon Turkish augment loader',
    from: `async function loadAugmentOcrLocale(locale) {\n    if (loadedAugmentLocales.has(locale)) {`,
    to: `const COMMUNITY_DRAGON_TURKISH_AUGMENTS_URL =\n    'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/tr_tr/v1/augments.json'\n\nasync function loadCommunityDragonTurkishAugments() {\n    const response = await axios.get(COMMUNITY_DRAGON_TURKISH_AUGMENTS_URL, {\n        timeout: 8000,\n        headers: { accept: 'application/json' },\n    })\n\n    const payload = response?.data\n    const augments = Array.isArray(payload)\n        ? payload\n        : Array.isArray(payload?.augments)\n            ? payload.augments\n            : []\n\n    const normalized = augments\n        .map(augment => ({\n            id: augment?.id ?? augment?.augmentId,\n            name: String(augment?.name || augment?.displayName || '').trim(),\n            rarity: augment?.rarity ?? augment?.rarityName ?? augment?.tier,\n            iconPath: augment?.iconPath || augment?.iconUrl || null,\n        }))\n        .filter(augment => augment.id != null && augment.name)\n\n    if (normalized.length === 0) {\n        throw new Error('CommunityDragon Turkish augment payload is empty')\n    }\n\n    logger.info('[augment-ocr] CommunityDragon Turkish augment names loaded', {\n        source: COMMUNITY_DRAGON_TURKISH_AUGMENTS_URL,\n        augmentCount: normalized.length,\n    })\n\n    return {\n        locale: 'tr-TR',\n        dataVersion: 'communitydragon-latest',\n        augments: normalized,\n        source: 'remote',\n    }\n}\n\nasync function loadAugmentOcrLocale(locale) {\n    if (loadedAugmentLocales.has(locale)) {`,
  },
  {
    label: 'Turkish OCR data source selection',
    from: `            const result = await loadAugmentBaseForOcrLocale(locale)`,
    to: `            const result = locale === 'tr-TR'\n                ? await loadCommunityDragonTurkishAugments()\n                : await loadAugmentBaseForOcrLocale(locale)`,
  },
]

let updated = source
for (const replacement of replacements) {
  if (!updated.includes(replacement.from)) {
    throw new Error(`Patch target not found: ${replacement.label}`)
  }
  updated = updated.replace(replacement.from, replacement.to)
}

if (updated === source) {
  throw new Error('No changes were made; Turkish OCR fix may already be applied')
}

await fs.writeFile(target, updated, 'utf8')
console.log(`Applied Turkish OCR fix to ${path.relative(root, target)}`)
console.log('Next: npm run dev')
