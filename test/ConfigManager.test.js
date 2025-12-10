import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ConfigManager } from '../src/ConfigManager.js';
import { CONFIG } from '../src/config.js';

describe('ConfigManager', () => {
    let storedHiddenIds
    let storedHiddenPosts
    let storedMediaTargets

    beforeEach(() => {
        storedHiddenIds = CONFIG.DEFAULT_HIDDEN_USER_IDS.slice()
        storedHiddenPosts = CONFIG.POST_FILTER.DEFAULT_ENTRIES.slice()
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
        })
    })

    it('sanitizeIdsでトリムと重複排除を行う', () => {
        const manager = new ConfigManager()
        const result = manager.sanitizeIds(['  Alice ', 'ALICE', '', 'Bob', 'bob ', null])
        expect(result).toEqual(['Alice', 'ALICE', 'Bob', 'bob'])
    })

    it('sanitizePostEntriesで不正値を除去し期限が新しいものを採用する', () => {
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

    it('loadで保存済みのユーザーIDとポストIDを読み込む', () => {
        storedHiddenIds = ['  Alice ', 'Bob', 'ALICE']
        const now = Date.now()
        storedHiddenPosts = [{ id: '999', expiresAt: now + 1000 }]
        const manager = new ConfigManager()
        expect(manager.getIds()).toEqual(['Alice', 'Bob', 'ALICE'])
        expect(manager.getHiddenPosts()).toEqual([
            { id: '999', expiresAt: storedHiddenPosts[0].expiresAt }
        ])
    })

    it('saveでユーザーIDを整形して保存する', () => {
        const manager = new ConfigManager()
        manager.save(['  Carol ', 'dave', 'CAROL'])
        expect(manager.getIds()).toEqual(['Carol', 'dave', 'CAROL'])
        expect(global.GM_setValues).toHaveBeenCalledWith({
            [CONFIG.STORAGE_KEY]: ['Carol', 'dave', 'CAROL']
        })
    })

    it('upsertHiddenPostIdでポストIDを保存し期限を設定する', () => {
        const manager = new ConfigManager()
        const now = 1000
        manager.upsertHiddenPostId('1998', now)
        expect(storedHiddenPosts[0].id).toBe('1998')
        expect(storedHiddenPosts[0].expiresAt).toBe(now + CONFIG.POST_FILTER.TTL_MS)
    })

    it('extendHiddenPostExpiryで既存期限を基準に延長する', () => {
        const now = Date.now()
        storedHiddenPosts = [{ id: '1998', expiresAt: now + 1000 }]
        const manager = new ConfigManager()
        manager.extendHiddenPostExpiry('1998', now)
        expect(storedHiddenPosts[0].expiresAt).toBe(
            Math.max(now, now + 1000) + CONFIG.POST_FILTER.TTL_MS
        )
    })

    it('purgeExpiredHiddenPostsで期限切れのポストIDを削除する', () => {
        const now = Date.now()
        storedHiddenPosts = [
            { id: 'alive', expiresAt: now + 1000 },
            { id: 'expired', expiresAt: now - 1000 }
        ]
        const manager = new ConfigManager()
        manager.purgeExpiredHiddenPosts(now)
        expect(storedHiddenPosts).toEqual([{ id: 'alive', expiresAt: now + 1000 }])
    })

    it('createExportPayloadでhiddenPostsを含めてエクスポートする', () => {
        storedHiddenIds = ['User1']
        storedHiddenPosts = [{ id: '1998', expiresAt: 123 }]
        storedMediaTargets = ['List1']
        const manager = new ConfigManager()
        const payload = manager.createExportPayload()
        expect(payload.content).toContain('"hiddenUserIds"')
        expect(payload.content).toContain('"hiddenPosts"')
        expect(payload.content).toContain('"mediaFilterTargets"')
    })

    it('parseImportPayloadでhiddenPostsを読み取る', () => {
        const manager = new ConfigManager()
        const text = JSON.stringify({
            storageKey: CONFIG.STORAGE_KEY,
            version: CONFIG.EXPORT_VERSION,
            exportedAt: '2025-01-01T00:00:00.000Z',
            hiddenUserIds: [' Alice '],
            hiddenPosts: [{ id: '1998', expiresAt: 123 }],
            mediaFilterTargets: [' List1 ']
        })
        const parsed = manager.parseImportPayload(text)
        expect(parsed.ids).toEqual(['Alice'])
        expect(parsed.hiddenPosts).toEqual([{ id: '1998', expiresAt: 123 }])
        expect(parsed.mediaFilterTargets).toEqual(['List1'])
    })

    it('parseImportPayloadで旧バージョン(1)でも受け入れる', () => {
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
    })
})
