import { CONFIG } from './config.js';

/**
 * 設定の読み書きを担当するユーティリティクラス
 */
export class ConfigManager {
    constructor () {
        this.hiddenUserIds = CONFIG.DEFAULT_HIDDEN_USER_IDS.slice()
        this.hiddenPosts = CONFIG.POST_FILTER.DEFAULT_ENTRIES.slice()
        this.mediaFilterTargets = CONFIG.MEDIA_FILTER.DEFAULT_TARGET_LISTS.slice()
        this.load()
        this.purgeExpiredHiddenPosts()
    }

    /**
     * ユーザーIDリストを整形（トリム＋重複排除）する
     * @param {string[]} ids - 整形するユーザーIDの配列
     * @returns {string[]} 整形済みのユーザーID配列
     */
    sanitizeIds (ids) {
        const result = []
        const seen = new Set()
        ids.forEach(id => {
            const trimmed = (id || '').trim()
            if (!trimmed) {
                return
            }
            if (seen.has(trimmed)) {
                return
            }
            seen.add(trimmed)
            result.push(trimmed)
        })
        return result
    }

    /**
     * ポストIDエントリ配列を整形（不正値除去＋重複解消）する
     * @param {Array<{ id?: string, expiresAt?: number }>} entries - 整形するエントリ配列
     * @returns {{ id: string, expiresAt: number }[]} 整形済みエントリ配列
     */
    sanitizePostEntries (entries) {
        const seen = new Map()
        entries.forEach(entry => {
            const normalized = this.normalizePostEntry(entry)
            if (!normalized) {
                return
            }
            const existing = seen.get(normalized.id)
            if (!existing || existing.expiresAt < normalized.expiresAt) {
                seen.set(normalized.id, normalized)
            }
        })
        return Array.from(seen.values())
    }

    /**
     * ポストIDエントリを正規化する
     * @param {{ id?: string, expiresAt?: number }} entry - 正規化対象
     * @returns {{ id: string, expiresAt: number } | null} 正規化結果（不正時はnull）
     */
    normalizePostEntry (entry) {
        if (!entry || typeof entry !== 'object') {
            return null
        }
        const id = (entry.id || '').trim()
        const expiresAt = Number(entry.expiresAt)
        if (!id || Number.isNaN(expiresAt)) {
            return null
        }
        return { id, expiresAt }
    }

    /**
     * 設定をすべて読み込む
     */
    load () {
        this.loadHiddenUserIds()
        this.loadHiddenPosts()
        this.loadMediaFilterTargets()
    }

    /**
     * TampermonkeyストレージからユーザーIDリストを読み込む
     * @returns {string[]} 読み込み済みユーザーIDリスト
     */
    loadHiddenUserIds () {
        const storedValues = GM_getValues({
            [CONFIG.STORAGE_KEY]: CONFIG.DEFAULT_HIDDEN_USER_IDS
        })
        const stored = storedValues?.[CONFIG.STORAGE_KEY]
        let ids = CONFIG.DEFAULT_HIDDEN_USER_IDS.slice()

        if (Array.isArray(stored)) {
            ids = this.sanitizeIds(stored)
        } else if (typeof stored === 'string') {
            ids = this.sanitizeIds(stored.split(/[\s,]+/))
        }

        this.hiddenUserIds = ids
        return this.hiddenUserIds
    }

    /**
     * TampermonkeyストレージからポストIDエントリを読み込む
     * @returns {{ id: string, expiresAt: number }[]} 読み込み済みポストIDエントリ
     */
    loadHiddenPosts () {
        const storedValues = GM_getValues({
            [CONFIG.POST_FILTER.STORAGE_KEY]: CONFIG.POST_FILTER.DEFAULT_ENTRIES
        })
        const stored = storedValues?.[CONFIG.POST_FILTER.STORAGE_KEY]
        let entries = CONFIG.POST_FILTER.DEFAULT_ENTRIES.slice()

        if (Array.isArray(stored)) {
            entries = this.sanitizePostEntries(stored)
        }

        this.hiddenPosts = entries
        return this.hiddenPosts
    }

    /**
     * Tampermonkeyストレージからメディアなしフィルタ対象リストを読み込む
     * @returns {string[]} 読み込み済みリスト
     */
    loadMediaFilterTargets () {
        const storedValues = GM_getValues({
            [CONFIG.MEDIA_FILTER.STORAGE_KEY]:
                CONFIG.MEDIA_FILTER.DEFAULT_TARGET_LISTS
        })
        const stored = storedValues?.[CONFIG.MEDIA_FILTER.STORAGE_KEY]
        let lists = CONFIG.MEDIA_FILTER.DEFAULT_TARGET_LISTS.slice()

        if (Array.isArray(stored)) {
            lists = this.sanitizeIds(stored)
        } else if (typeof stored === 'string') {
            lists = this.sanitizeIds(stored.split(/[\r\n,]+/))
        }

        this.mediaFilterTargets = lists
        return this.mediaFilterTargets
    }

    /**
     * ユーザーIDリストを保存する
     * @param {string[]} ids - 保存するユーザーIDリスト
     */
    save (ids) {
        const sanitized = this.sanitizeIds(ids)
        this.hiddenUserIds = sanitized
        GM_setValues({
            [CONFIG.STORAGE_KEY]: this.hiddenUserIds
        })
        console.log('hiddenUserIds 更新:', this.hiddenUserIds)
    }

    /**
     * ポストIDエントリ一覧を保存する
     * @param {{ id: string, expiresAt: number }[]} entries - 保存するエントリ一覧
     */
    saveHiddenPosts (entries) {
        const sanitized = this.sanitizePostEntries(entries)
        this.hiddenPosts = sanitized
        GM_setValues({
            [CONFIG.POST_FILTER.STORAGE_KEY]: this.hiddenPosts
        })
        console.log('hiddenPosts 更新:', this.hiddenPosts)
    }

    /**
     * メディアなしフィルタ対象リストを保存する
     * @param {string[]} lists - 保存するリスト名配列
     */
    saveMediaFilterTargets (lists) {
        const sanitized = this.sanitizeIds(lists)
        this.mediaFilterTargets = sanitized
        GM_setValues({
            [CONFIG.MEDIA_FILTER.STORAGE_KEY]: this.mediaFilterTargets
        })
        console.log('mediaFilterTargets 更新:', this.mediaFilterTargets)
    }

    /**
     * 非表示ユーザーIDを取得する
     * @returns {string[]} ユーザーIDリスト
     */
    getIds () {
        return this.hiddenUserIds
    }

    /**
     * 非表示ポストIDエントリを取得する
     * @returns {{ id: string, expiresAt: number }[]} ポストIDエントリ一覧
     */
    getHiddenPosts () {
        return this.hiddenPosts
    }

    /**
     * メディアなしフィルタ対象リストを取得する
     * @returns {string[]} 対象リスト名一覧
     */
    getMediaFilterTargets () {
        return this.mediaFilterTargets
    }

    /**
     * ポストIDを追加または更新し、期限を設定する
     * @param {string} postId - 追加するポストID
     * @param {number} [now=Date.now()] - 現在時刻（テスト用）
     */
    upsertHiddenPostId (postId, now = Date.now()) {
        const normalizedId = (postId || '').trim()
        if (!normalizedId) {
            return
        }
        const current = this.hiddenPosts.find(entry => entry.id === normalizedId)
        const base = current && !this.isExpired(current, now)
            ? Math.max(now, current.expiresAt)
            : now
        const expiresAt = base + CONFIG.POST_FILTER.TTL_MS
        const nextEntries = [
            ...this.hiddenPosts.filter(entry => entry.id !== normalizedId),
            { id: normalizedId, expiresAt }
        ]
        this.saveHiddenPosts(nextEntries)
    }

    /**
     * ポストIDの期限を延長する（存在する場合のみ）
     * @param {string} postId - 対象ポストID
     * @param {number} [now=Date.now()] - 現在時刻（テスト用）
     */
    extendHiddenPostExpiry (postId, now = Date.now()) {
        const target = this.hiddenPosts.find(entry => entry.id === postId)
        if (!target) {
            return
        }
        const base = Math.max(now, target.expiresAt)
        const expiresAt = base + CONFIG.POST_FILTER.TTL_MS
        const updated = this.hiddenPosts.map(entry =>
            entry.id === postId ? { ...entry, expiresAt } : entry
        )
        this.saveHiddenPosts(updated)
    }

    /**
     * ポストIDが非表示対象に含まれるか判定する
     * @param {string} postId - 判定対象ポストID
     * @returns {boolean} 含まれる場合true
     */
    hasHiddenPostId (postId) {
        if (!postId) {
            return false
        }
        return this.hiddenPosts.some(entry => entry.id === postId)
    }

    /**
     * 期限切れのポストIDエントリを削除する
     * @param {number} [now=Date.now()] - 現在時刻
     */
    purgeExpiredHiddenPosts (now = Date.now()) {
        const filtered = this.hiddenPosts.filter(entry => !this.isExpired(entry, now))
        if (filtered.length !== this.hiddenPosts.length) {
            this.saveHiddenPosts(filtered)
        }
    }

    /**
     * エントリが期限切れか判定する
     * @param {{ expiresAt: number }} entry - 判定対象
     * @param {number} now - 現在時刻
     * @returns {boolean} 期限切れならtrue
     */
    isExpired (entry, now) {
        return typeof entry?.expiresAt === 'number' && entry.expiresAt <= now
    }

    /**
     * エクスポート用のJSONペイロードを作成する
     * @returns {{ fileName: string, mimeType: string, content: string }} エクスポートペイロード
     */
    createExportPayload () {
        const now = new Date().toISOString()
        const sanitizedNow = now.replace(/[:.]/g, '-')
        const payload = {
            storageKey: CONFIG.STORAGE_KEY,
            version: CONFIG.EXPORT_VERSION,
            exportedAt: now,
            hiddenUserIds: this.getIds(),
            hiddenPosts: this.getHiddenPosts(),
            mediaFilterTargets: this.getMediaFilterTargets()
        }
        return {
            fileName: `hidden-entries-${sanitizedNow}.json`,
            mimeType: 'application/json',
            content: JSON.stringify(payload, null, 2)
        }
    }

    /**
     * エクスポートJSONテキストをパースしてバリデーションする
     * @param {string} jsonText - パース対象JSON文字列
     * @returns {{ ids: string[], hiddenPosts: { id: string, expiresAt: number }[], mediaFilterTargets: string[], meta: { exportedAt: string, version: number } }}
     * バリデーション済みデータ
     */
    parseImportPayload (jsonText) {
        if (typeof jsonText !== 'string') {
            throw new Error('JSON文字列を指定してください')
        }

        let parsed = null
        try {
            parsed = JSON.parse(jsonText)
        } catch (error) {
            throw new Error('JSONのパースに失敗しました')
        }

        if (!parsed || typeof parsed !== 'object') {
            throw new Error('JSONの形式が正しくありません')
        }

        if (parsed.storageKey !== CONFIG.STORAGE_KEY) {
            throw new Error('storageKeyが一致しません')
        }

        if (typeof parsed.version !== 'number') {
            throw new Error('versionが正しくありません')
        }

        const isSupportedVersion =
            parsed.version === CONFIG.EXPORT_VERSION || parsed.version === 1
        if (!isSupportedVersion) {
            throw new Error('versionが一致しません')
        }

        if (typeof parsed.exportedAt !== 'string' || !parsed.exportedAt) {
            throw new Error('exportedAtが正しくありません')
        }

        if (!Array.isArray(parsed.hiddenUserIds)) {
            throw new Error('hiddenUserIdsの形式が正しくありません')
        }

        const sanitizedIds = this.sanitizeIds(parsed.hiddenUserIds)

        let mediaFilterTargets = CONFIG.MEDIA_FILTER.DEFAULT_TARGET_LISTS.slice()
        if (Array.isArray(parsed.mediaFilterTargets)) {
            mediaFilterTargets = this.sanitizeIds(parsed.mediaFilterTargets)
        }

        let hiddenPosts = CONFIG.POST_FILTER.DEFAULT_ENTRIES.slice()
        if (Array.isArray(parsed.hiddenPosts)) {
            hiddenPosts = this.sanitizePostEntries(parsed.hiddenPosts)
        }

        return {
            ids: sanitizedIds,
            hiddenPosts,
            mediaFilterTargets,
            meta: {
                exportedAt: parsed.exportedAt,
                version: parsed.version
            }
        }
    }
}
