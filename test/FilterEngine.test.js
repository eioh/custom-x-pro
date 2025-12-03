import { describe, it, expect, jest } from '@jest/globals';
import { FilterEngine } from '../src/FilterEngine.js';
import { CONFIG } from '../src/config.js';

describe('FilterEngine', () => {
    const buildCell = (href) => ({
        querySelector: (selector) => {
            if (selector !== CONFIG.SELECTORS.USER_NAME) {
                return null
            }
            if (!href) {
                return null
            }
            return {
                getAttribute: () => href
            }
        }
    })

    it('ユーザー名リンクがなければ常にfalseを返す', () => {
        const configManager = { getIds: jest.fn(() => ['target']) }
        const cellWithoutLink = { querySelector: () => null }
        const engine = new FilterEngine(configManager)
        expect(engine.shouldHide(cellWithoutLink)).toBe(false)
    })

    it('設定済みIDと完全一致した場合のみ非表示にする', () => {
        const configManager = { getIds: jest.fn(() => ['Target']) }
        const cell = buildCell('https://x.com/Target')
        const engine = new FilterEngine(configManager)
        expect(engine.shouldHide(cell)).toBe(true)
    })

    it('x.com以外や未設定IDならfalseを返す', () => {
        const configManager = { getIds: jest.fn(() => ['target']) }
        const engine = new FilterEngine(configManager)
        const nonTargetCell = buildCell('https://x.com/another')
        const otherHostCell = buildCell('https://example.com/target')
        const missingHrefCell = buildCell('')
        expect(engine.shouldHide(nonTargetCell)).toBe(false)
        expect(engine.shouldHide(otherHostCell)).toBe(false)
        expect(engine.shouldHide(missingHrefCell)).toBe(false)
    })

    it('部分一致や大文字小文字が一致しない場合は非表示にしない', () => {
        const configManager = { getIds: jest.fn(() => ['target']) }
        const partialCell = buildCell('https://x.com/target-user')
        const caseDiffCell = buildCell('https://x.com/Target')
        const engine = new FilterEngine(configManager)
        expect(engine.shouldHide(partialCell)).toBe(false)
        expect(engine.shouldHide(caseDiffCell)).toBe(false)
    })
})
