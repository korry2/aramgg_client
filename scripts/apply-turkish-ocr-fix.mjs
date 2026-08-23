import fs from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const target = path.join(root, 'src', 'main', 'image-analyzer.ts')
const rawSource = await fs.readFile(target, 'utf8')
const source = rawSource.replace(/\r\n/g, '\n')

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
    to: `const COMMUNITY_DRAGON_TURKISH_AUGMENTS_URL =\n    'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/tr_tr/v1/augment-lists.json'\n\nfunction collectAugmentRecords(value, output = [], inheritedId = null) {\n    if (value == null) {\n        return output\n    }\n\n    if (Array.isArray(value)) {\n        for (const entry of value) {\n            collectAugmentRecords(entry, output, null)\n        }\n        return output\n    }\n\n    if (typeof value !== 'object') {\n        if (inheritedId != null && typeof value === 'string' && value.trim()) {\n            output.push({ id: inheritedId, name: value.trim() })\n        }\n        return output\n    }\n\n    const id = value.id ?? value.augmentId ?? value.augmentID ?? value.apiName ?? inheritedId\n    const name = value.name ?? value.displayName ?? value.localizedName ?? value.title\n    if (id != null && typeof name === 'string' && name.trim()) {\n        output.push({\n            id,\n            name: name.trim(),\n            rarity: value.rarity ?? value.rarityName ?? value.tier,\n            iconPath: value.iconPath ?? value.iconUrl ?? value.icon,\n        })\n    }\n\n    for (const [key, child] of Object.entries(value)) {\n        if (key === 'name' || key === 'displayName' || key === 'localizedName' || key === 'title') {\n            continue\n        }\n        if (child && typeof child === 'object') {\n            collectAugmentRecords(child, output, /^\\d+$/.test(key) ? key : null)\n        } else if (/^\\d+$/.test(key) && typeof child === 'string' && child.trim()) {\n            output.push({ id: key, name: child.trim() })\n        }\n    }\n\n    return output\n}\n\nasync function loadCommunityDragonTurkishAugments() {\n    const response = await axios.get(COMMUNITY_DRAGON_TURKISH_AUGMENTS_URL, {\n        timeout: 8000,\n        headers: { accept: 'application/json' },\n    })\n\n    const normalized = collectAugmentRecords(response?.data)\n        .filter(augment => augment.id != null && augment.name)\n        .filter((augment, index, list) =>\n            list.findIndex(candidate => String(candidate.id) === String(augment.id)) === index\n        )\n\n    if (normalized.length === 0) {\n        throw new Error('CommunityDragon Turkish augment list is empty or has an unexpected shape')\n    }\n\n    logger.info('[augment-ocr] CommunityDragon Turkish augment names loaded', {\n        source: COMMUNITY_DRAGON_TURKISH_AUGMENTS_URL,\n        augmentCount: normalized.length,\n    })\n\n    return {\n        locale: 'tr-TR',\n        dataVersion: 'communitydragon-latest',\n        augments: normalized,\n        source: 'remote',\n    }\n}\n\nasync function loadAugmentOcrLocale(locale) {\n    if (loadedAugmentLocales.has(locale)) {`,
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
