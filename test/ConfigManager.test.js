import { describe, it, expect, beforeEach, jest } from "@jest/globals"
import { ConfigManager } from "../src/ConfigManager.js"
import { CONFIG } from "../src/config.js"

describe('ConfigManager', () => {
    let storedHiddenIds
    let storedHiddenPosts
    let storedMediaTargets
    let storedTextWords

    beforeEach(() => {
        storedHiddenIds = CONFIG.DEFAULT_HIDDEN_USER_IDS.slice()
        storedHiddenPosts = CONFIG.POST_FILTER.DEFAULT_ENTRIES.slice()
        storedMediaTargets = CONFIG.MEDIA_FILTER.DEFAULT_TARGET_LISTS.slice()
        storedTextWords = CONFIG.TEXT_FILTER.DEFAULT_WORDS.slice()

        global.GM_getValues = jest.fn(defaults => {
            if (Object.prototype.hasOwnProperty.call(defaults, CONFIG.STORAGE_KEY)) {
                return {
                    [CONFIG.STORAGE_KEY]: storedHiddenIds
                }
            }
            if (
                Object.prototype.hasOwnProperty.call(
                    defaults,
                    CONFIG.POST_FILTER.STORAGE_KEY
                )
            ) {
                return {
                    [CONFIG.POST_FILTER.STORAGE_KEY]: storedHiddenPosts
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
            if (
                Object.prototype.hasOwnProperty.call(
                    defaults,
                    CONFIG.TEXT_FILTER.STORAGE_KEY
                )
            ) {
                return {
                    [CONFIG.TEXT_FILTER.STORAGE_KEY]: storedTextWords
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
                    CONFIG.POST_FILTER.STORAGE_KEY
                )
            ) {
                storedHiddenPosts = update[CONFIG.POST_FILTER.STORAGE_KEY]
            }
            if (
                Object.prototype.hasOwnProperty.call(
                    update,
                    CONFIG.MEDIA_FILTER.STORAGE_KEY
                )
            ) {
                storedMediaTargets = update[CONFIG.MEDIA_FILTER.STORAGE_KEY]
            }
            if (
                Object.prototype.hasOwnProperty.call(
                    update,
                    CONFIG.TEXT_FILTER.STORAGE_KEY
                )
            ) {
                storedTextWords = update[CONFIG.TEXT_FILTER.STORAGE_KEY]
            }
        })
    })

    it('sanitizeIdsでトリムと重複排除が行われる', () => {
        const manager = new ConfigManager()
        const result = manager.sanitizeIds(['  Alice ', 'ALICE', '', 'Bob', 'bob ', null])
        expect(result).toEqual(['Alice', 'ALICE', 'Bob', 'bob'])
    })

    it('sanitizeWordsで小文字化し重複排除する', () => {
        const manager = new ConfigManager()
        const result = manager.sanitizeWords([' Hello ', 'hello', 'WORLD', 'world '])
        expect(result).toEqual(['hello', 'world'])
    })

    it('sanitizePostEntriesで有効期限の新しい方を採用する', () => {
        const manager = new ConfigManager()
        const entries = [
            { id: '123', expiresAt: 100 },
            { id: '123', expiresAt: 200 },
            { id: '', expiresAt: 300 },
            { id: '456', expiresAt: 'not-number' }
        ]
        expect(manager.sanitizePostEntries(entries)).toEqual([
            { id: '123', expiresAt: 200 }
        ])
    })

    it('loadで保存済みの値を読み込む', () => {
        storedHiddenIds = ['  Alice ', 'Bob', 'ALICE']
        const now = Date.now()
        storedHiddenPosts = [{ id: '999', expiresAt: now + 1000 }]
        storedMediaTargets = ['ListX']
        storedTextWords = ['Spam']
        const manager = new ConfigManager()
        expect(manager.getIds()).toEqual(['Alice', 'Bob', 'ALICE'])
        expect(manager.getHiddenPosts()).toEqual([
            { id: '999', expiresAt: storedHiddenPosts[0].expiresAt }
        ])
        expect(manager.getMediaFilterTargets()).toEqual(['ListX'])
        expect(manager.getTextFilterWords()).toEqual(['spam'])
    })

    it('saveでユーザーIDを保存する', () => {
        const manager = new ConfigManager()
        manager.save(['  Carol ', 'dave', 'CAROL'])
        expect(manager.getIds()).toEqual(['Carol', 'dave', 'CAROL'])
        expect(global.GM_setValues).toHaveBeenCalledWith({
            [CONFIG.STORAGE_KEY]: ['Carol', 'dave', 'CAROL']
        })
    })

    it('saveTextFilterWordsでNGワードを小文字で保存する', () => {
        const manager = new ConfigManager()
        manager.saveTextFilterWords(['Spam', 'ham'])
        expect(manager.getTextFilterWords()).toEqual(['spam', 'ham'])
        expect(global.GM_setValues).toHaveBeenCalledWith({
            [CONFIG.TEXT_FILTER.STORAGE_KEY]: ['spam', 'ham']
        })
    })

    it('upsertHiddenPostIdでポストIDを保存し期限を設定する', () => {
        const manager = new ConfigManager()
        const now = 1000
        manager.upsertHiddenPostId('1998', now)
        expect(storedHiddenPosts[0].id).toBe('1998')
        expect(storedHiddenPosts[0].expiresAt).toBe(now + CONFIG.POST_FILTER.TTL_MS)
    })

    it('extendHiddenPostExpiryで期限を延長する', () => {
        const now = Date.now()
        storedHiddenPosts = [{ id: '1998', expiresAt: now + 1000 }]
        const manager = new ConfigManager()
        manager.extendHiddenPostExpiry('1998', now)
        expect(storedHiddenPosts[0].expiresAt).toBe(
            Math.max(now, now + 1000) + CONFIG.POST_FILTER.TTL_MS
        )
    })

    it('purgeExpiredHiddenPostsで期限切れを削除する', () => {
        const now = Date.now()
        storedHiddenPosts = [
            { id: 'alive', expiresAt: now + 1000 },
            { id: 'expired', expiresAt: now - 1000 }
        ]
        const manager = new ConfigManager()
        manager.purgeExpiredHiddenPosts(now)
        expect(storedHiddenPosts).toEqual([{ id: 'alive', expiresAt: now + 1000 }])
    })

    it('createExportPayloadで全リストを含める', () => {
        storedHiddenIds = ['User1']
        storedHiddenPosts = [{ id: '1998', expiresAt: 123 }]
        storedMediaTargets = ['List1']
        storedTextWords = ['spam']
        const manager = new ConfigManager()
        const payload = manager.createExportPayload()
        expect(payload.content).toContain('"hiddenUserIds"')
        expect(payload.content).toContain('"hiddenPosts"')
        expect(payload.content).toContain('"mediaFilterTargets"')
        expect(payload.content).toContain('"textFilterWords"')
    })

    it('parseImportPayloadで各リストを整形して返す', () => {
        const manager = new ConfigManager()
        const text = JSON.stringify({
            storageKey: CONFIG.STORAGE_KEY,
            version: CONFIG.EXPORT_VERSION,
            exportedAt: '2025-01-01T00:00:00.000Z',
            hiddenUserIds: [' Alice '],
            hiddenPosts: [{ id: '1998', expiresAt: 123 }],
            mediaFilterTargets: [' List1 '],
            textFilterWords: [' SPAM ', 'Egg']
        })
        const parsed = manager.parseImportPayload(text)
        expect(parsed.ids).toEqual(['Alice'])
        expect(parsed.hiddenPosts).toEqual([{ id: '1998', expiresAt: 123 }])
        expect(parsed.mediaFilterTargets).toEqual(['List1'])
        expect(parsed.textFilterWords).toEqual(['spam', 'egg'])
    })

    it('parseImportPayloadでバージョン1でも読み込める', () => {
        const manager = new ConfigManager()
        const text = JSON.stringify({
            storageKey: CONFIG.STORAGE_KEY,
            version: 1,
            exportedAt: '2025-01-01T00:00:00.000Z',
            hiddenUserIds: [' Alice ']
        })
        const parsed = manager.parseImportPayload(text)
        expect(parsed.ids).toEqual(['Alice'])
        expect(parsed.hiddenPosts).toEqual([])
        expect(parsed.textFilterWords).toEqual([])
    })
})
