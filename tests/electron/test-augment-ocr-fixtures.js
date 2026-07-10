import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const fixturesDir = path.resolve(__dirname, '../fixtures/augment-ocr')
const manifestPath = path.join(fixturesDir, 'manifest.json')
const originalCwd = process.cwd()
const originalHome = process.env.HOME
const originalUserProfile = process.env.USERPROFILE
const originalOcrLocale = process.env.ARAMGG_OCR_LOCALE
let testRoot = null
let shutdownImageAnalyzer = null

async function writeJson(filePath, payload) {
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, JSON.stringify(payload), 'utf8')
}

async function seedFixtureData(manifest) {
    const dataRoot = path.join(testRoot, '.aramgg_client', 'data')
    const dataVersion = 'ocr-fixtures-v1'
    const augments = [...new Map(
        manifest.flatMap(sample => sample.expectedIds.map((id, index) => [
            Number(id),
            {
                id: Number(id),
                name: sample.expectedNames[index],
                rarity: 'kGold',
                iconPath: '',
            },
        ]))
    ).values()]

    for (const locale of ['zh-CN', 'en-US', 'zh-TW']) {
        const pointerName = locale === 'zh-CN' ? 'current.json' : `current.${locale}.json`
        const versionDir = locale === 'zh-CN'
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
        await writeJson(path.join(versionDir, 'augments.json'), { augments })
    }
}

function idsOf(augments = []) {
    return augments.map(augment => Number(augment.id))
}

function namesOf(augments = []) {
    return augments.map(augment => String(augment.name))
}

function enginesOf(slotDiagnostics = []) {
    return [...new Set(slotDiagnostics.map(diagnostic => diagnostic.ocrEngine).filter(Boolean))]
}

async function main() {
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'))
    testRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'aramgg-augment-ocr-'))
    process.env.HOME = testRoot
    process.env.USERPROFILE = testRoot
    process.env.ARAMGG_OCR_LOCALE = 'zh-CN'
    process.chdir(testRoot)
    await seedFixtureData(manifest)

    const imageAnalyzer = await import('../../src/main/image-analyzer.ts')
    const analyzeScreenshot = imageAnalyzer.analyzeScreenshot
    shutdownImageAnalyzer = imageAnalyzer.shutdownImageAnalyzer

    for (const sample of manifest) {
        const imagePath = path.join(fixturesDir, sample.file)
        const result = await analyzeScreenshot(imagePath)

        assert.equal(result.success, true, `${sample.file}: analysis should succeed`)
        assert.equal(
            result.analysis.cardCount,
            sample.expectedCardCount,
            `${sample.file}: cardCount should match fixture expectation`
        )
        assert.deepEqual(
            idsOf(result.analysis.augments),
            sample.expectedIds,
            `${sample.file}: augment ids should remain stable`
        )
        assert.deepEqual(
            namesOf(result.analysis.augments),
            sample.expectedNames,
            `${sample.file}: augment names should remain stable`
        )

        const engines = enginesOf(result.analysis.slotDiagnostics)
        assert.deepEqual(engines, ['paddleocr'], `${sample.file}: OCR engine should be PaddleOCR only`)

        console.log(JSON.stringify({
            file: sample.file,
            description: sample.description,
            cardCount: result.analysis.cardCount,
            ids: idsOf(result.analysis.augments),
            names: namesOf(result.analysis.augments),
            durationMs: result.metadata.analysisDurationMs,
        }))
    }
}

main()
    .catch(error => {
        console.error(error)
        process.exitCode = 1
    })
    .finally(async () => {
        if (shutdownImageAnalyzer) {
            await shutdownImageAnalyzer()
        }
        process.chdir(originalCwd)
        if (originalHome == null) {
            delete process.env.HOME
        } else {
            process.env.HOME = originalHome
        }
        if (originalUserProfile == null) {
            delete process.env.USERPROFILE
        } else {
            process.env.USERPROFILE = originalUserProfile
        }
        if (originalOcrLocale == null) {
            delete process.env.ARAMGG_OCR_LOCALE
        } else {
            process.env.ARAMGG_OCR_LOCALE = originalOcrLocale
        }
        if (testRoot) {
            await fs.rm(testRoot, { recursive: true, force: true })
        }
    })
