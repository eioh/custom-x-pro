import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ConfigManager } from '../src/ConfigManager.js';
import { CONFIG } from '../src/config.js';

describe('ConfigManager', () => {
    let storedHiddenIds
    let storedMediaTargets

    beforeEach(() => {
        storedHiddenIds = CONFIG.DEFAULT_HIDDEN_USER_IDS.slice()
        storedMediaTargets = CONFIG.MEDIA_FILTER.DEFAULT_TARGET_LISTS.slice()

        global.GM_getValues = jest.fn(defaults => {
            if (Object.prototype.hasOwnProperty.call(defaults, CONFIG.STORAGE_KEY)) {
                return {
                    [CONFIG.STORAGE_KEY]: storedHiddenIds
                }
            }
            if (
                Object.prototype.hasOwnProperty.call(
                    defaults,
                    CONFIG.MEDIA_FILTER.STORAGE_KEY
                )
            ) {
                return {
                    [CONFIG.MEDIA_FILTER.STORAGE_KEY]: storedMediaTargets
                }
            }
            return defaults
        })

        global.GM_setValues = jest.fn(update => {
            if (Object.prototype.hasOwnProperty.call(update, CONFIG.STORAGE_KEY)) {
                storedHiddenIds = update[CONFIG.STORAGE_KEY]
            }
            if (
                Object.prototype.hasOwnProperty.call(
                    update,
                    CONFIG.MEDIA_FILTER.STORAGE_KEY
                )
            ) {
                storedMediaTargets = update[CONFIG.MEDIA_FILTER.STORAGE_KEY]
            }
        })
    })

    it('sanitizeIdsでトリムと大文字小文字を保持したまま重複排除を行う', () => {
        const manager = new ConfigManager()
        const result = manager.sanitizeIds(['  Alice ', 'ALICE', '', 'Bob', 'bob ', null])
        expect(result).toEqual(['Alice', 'ALICE', 'Bob', 'bob'])
    })

    it('loadで保存済みの配列を正しく読み込む', () => {
        storedHiddenIds = ['  Alice ', 'Bob', 'ALICE']
        const manager = new ConfigManager()
        expect(manager.getIds()).toEqual(['Alice', 'Bob', 'ALICE'])
    })

    it('loadで文字列保存のIDを整形して読み込む', () => {
        storedHiddenIds = ' Alice, Bob\ncarol '
        const manager = new ConfigManager()
        expect(manager.getIds()).toEqual(['Alice', 'Bob', 'carol'])
    })

    it('saveで整形後のIDを保存して内部状態も更新する', () => {
        const manager = new ConfigManager()
        manager.save(['  Carol ', 'dave', 'CAROL'])
        expect(manager.getIds()).toEqual(['Carol', 'dave', 'CAROL'])
        expect(global.GM_setValues).toHaveBeenCalledWith({
            [CONFIG.STORAGE_KEY]: ['Carol', 'dave', 'CAROL']
        })
    })

    it('loadMediaFilterTargetsで保存済みのリスト名を取得する', () => {
        storedMediaTargets = ['ListA', ' listB ']
        const manager = new ConfigManager()
        expect(manager.getMediaFilterTargets()).toEqual(['ListA', 'listB'])
    })

    it('saveMediaFilterTargetsで整形したリスト名を保存する', () => {
        const manager = new ConfigManager()
        manager.saveMediaFilterTargets([' ListA ', 'ListA', 'ListB'])
        expect(manager.getMediaFilterTargets()).toEqual(['ListA', 'ListB'])
        expect(global.GM_setValues).toHaveBeenCalledWith({
            [CONFIG.MEDIA_FILTER.STORAGE_KEY]: ['ListA', 'ListB']
        })
    })

    it('createExportPayloadでメディアフィルタ設定も含める', () => {
        storedHiddenIds = ['User1']
        storedMediaTargets = ['List1']
        const manager = new ConfigManager()
        const payload = manager.createExportPayload()
        expect(payload.content).toContain('"hiddenUserIds"')
        expect(payload.content).toContain('"mediaFilterTargets"')
    })

    it('parseImportPayloadでメディアフィルタ設定を復元する', () => {
        const manager = new ConfigManager()
        const text = JSON.stringify({
            storageKey: CONFIG.STORAGE_KEY,
            version: CONFIG.EXPORT_VERSION,
            exportedAt: '2025-01-01T00:00:00.000Z',
            hiddenUserIds: [' Alice '],
            mediaFilterTargets: [' List1 ']
        })
        const parsed = manager.parseImportPayload(text)
        expect(parsed.ids).toEqual(['Alice'])
        expect(parsed.mediaFilterTargets).toEqual(['List1'])
    })
})
