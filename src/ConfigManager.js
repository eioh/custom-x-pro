import { CONFIG } from './config.js'

/**
 * 設定の読み書きを担うヘルパークラス
 */
export class ConfigManager {
    constructor () {
        this.hiddenUserIds = CONFIG.DEFAULT_HIDDEN_USER_IDS.slice()
        this.hiddenPosts = CONFIG.POST_FILTER.DEFAULT_ENTRIES.slice()
        this.mediaFilterTargets = CONFIG.MEDIA_FILTER.DEFAULT_TARGET_LISTS.slice()
        this.textFilterWords = CONFIG.TEXT_FILTER.DEFAULT_WORDS.slice()
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
     * ユーザーIDリストを形式チェック込みで整形する
     * @param {string[]} ids - 整形対象のユーザーIDリスト
     * @returns {string[]} 整形済みのユーザーIDリスト
     */
    sanitizeUserIds (ids) {
        const result = []
        const seen = new Set()
        ids.forEach(id => {
            if (typeof id !== 'string') {
                return
            }
            const trimmed = id.trim()
            if (!trimmed) {
                return
            }
            if (!this.isValidUserId(trimmed)) {
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
     * ユーザーIDの形式（半角英数字とアンダースコアのみ）を判定する
     * @param {string} id - 判定対象のユーザーID
     * @returns {boolean} 許容形式ならtrue
     */
    isValidUserId (id) {
        return /^[A-Za-z0-9_]+$/.test(id)
    }

    /**
     * NGワードリストを整形（トリム＋小文字化＋重複排除）する
     * @param {string[]} words - 整形するNGワード配列
     * @returns {string[]} 整形済みNGワード配列（小文字）
     */
    sanitizeWords (words) {
        const result = []
        const seen = new Set()
        words.forEach(word => {
            const normalized = (word || '').trim().toLowerCase()
            if (!normalized) {
                return
            }
            if (seen.has(normalized)) {
                return
            }
            seen.add(normalized)
            result.push(normalized)
        })
        return result
    }

    /**
     * ポストIDエントリを整形（最新期限優先で重複排除）
     * @param {Array<{ id?: string, expiresAt?: number }>} entries - 整形するエントリ
     * @returns {{ id: string, expiresAt: number }[]} 整形済みエントリ
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
     * @returns {{ id: string, expiresAt: number } | null} 正規化後のエントリ、無効ならnull
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
     * 保存済みデータをまとめて読み込む
     */
    load () {
        this.loadHiddenUserIds()
        this.loadHiddenPosts()
        this.loadMediaFilterTargets()
        this.loadTextFilterWords()
    }

    /**
     * ユーザーIDリストを取得する
     * @returns {string[]} 読み込み済みユーザーIDリスト
     */
    loadHiddenUserIds () {
        const storedValues = GM_getValues({
            [CONFIG.STORAGE_KEY]: CONFIG.DEFAULT_HIDDEN_USER_IDS
        })
        const stored = storedValues?.[CONFIG.STORAGE_KEY]
        let ids = CONFIG.DEFAULT_HIDDEN_USER_IDS.slice()

        if (Array.isArray(stored)) {
            ids = this.sanitizeUserIds(stored)
        } else if (typeof stored === 'string') {
            ids = this.sanitizeUserIds(stored.split(/[\s,]+/))
        }

        this.hiddenUserIds = ids
        return this.hiddenUserIds
    }

    /**
     * ポストIDエントリを取得する
     * @returns {{ id: string, expiresAt: number }[]} 読み込み済みポストエントリ
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
     * メディアフィルター対象リスト名を取得する
     * @returns {string[]} 読み込み済みリスト名配列
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
     * NGワードを取得する
     * @returns {string[]} 読み込み済みNGワード配列（小文字）
     */
    loadTextFilterWords () {
        const storedValues = GM_getValues({
            [CONFIG.TEXT_FILTER.STORAGE_KEY]: CONFIG.TEXT_FILTER.DEFAULT_WORDS
        })
        const stored = storedValues?.[CONFIG.TEXT_FILTER.STORAGE_KEY]
        let words = CONFIG.TEXT_FILTER.DEFAULT_WORDS.slice()

        if (Array.isArray(stored)) {
            words = this.sanitizeWords(stored)
        } else if (typeof stored === 'string') {
            words = this.sanitizeWords(stored.split(/[\r\n,]+/))
        }

        this.textFilterWords = words
        return this.textFilterWords
    }

    /**
     * ユーザーIDリストを保存する
     * @param {string[]} ids - 保存対象ユーザーID
     */
    save (ids) {
        const sanitized = this.sanitizeUserIds(ids)
        this.hiddenUserIds = sanitized
        GM_setValues({
            [CONFIG.STORAGE_KEY]: this.hiddenUserIds
        })
        console.log('hiddenUserIds 更新:', this.hiddenUserIds)
    }

    /**
     * ポストIDエントリを保存する
     * @param {{ id: string, expiresAt: number }[]} entries - 保存対象エントリ
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
     * メディアフィルター対象リスト名を保存する
     * @param {string[]} lists - 保存対象リスト名
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
     * NGワードを保存する
     * @param {string[]} words - 保存対象ワード
     */
    saveTextFilterWords (words) {
        const sanitized = this.sanitizeWords(words)
        this.textFilterWords = sanitized
        GM_setValues({
            [CONFIG.TEXT_FILTER.STORAGE_KEY]: this.textFilterWords
        })
        console.log('textFilterWords 更新:', this.textFilterWords)
    }

    /**
     * ユーザーIDリストを取得する
     * @returns {string[]} ユーザーIDリスト
     */
    getIds () {
        return this.hiddenUserIds
    }

    /**
     * ポストエントリを取得する
     * @returns {{ id: string, expiresAt: number }[]} ポストエントリ
     */
    getHiddenPosts () {
        return this.hiddenPosts
    }

    /**
     * メディアフィルター対象リスト名を取得する
     * @returns {string[]} 対象リスト名
     */
    getMediaFilterTargets () {
        return this.mediaFilterTargets
    }

    /**
     * NGワード一覧を取得する
     * @returns {string[]} NGワード配列（小文字）
     */
    getTextFilterWords () {
        return this.textFilterWords
    }

    /**
     * ポストIDを追加・更新する（TTL延長）
     * @param {string} postId - 保存対象ポストID
     * @param {number} [now=Date.now()] - 現在時刻
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
     * ポストIDの期限を延長する
     * @param {string} postId - 対象ポストID
     * @param {number} [now=Date.now()] - 現在時刻
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
     * ポストIDが非表示対象かどうかを判定する
     * @param {string} postId - 判定するポストID
     * @returns {boolean} 対象ならtrue
     */
    hasHiddenPostId (postId) {
        if (!postId) {
            return false
        }
        return this.hiddenPosts.some(entry => entry.id === postId)
    }

    /**
     * 期限切れのポストエントリを除去する
     * @param {number} [now=Date.now()] - 現在時刻
     */
    purgeExpiredHiddenPosts (now = Date.now()) {
        const filtered = this.hiddenPosts.filter(entry => !this.isExpired(entry, now))
        if (filtered.length !== this.hiddenPosts.length) {
            this.saveHiddenPosts(filtered)
        }
    }

    /**
     * エントリが期限切れかを判定する
     * @param {{ expiresAt: number }} entry - 判定対象
     * @param {number} now - 現在時刻
     * @returns {boolean} 期限切れならtrue
     */
    isExpired (entry, now) {
        return typeof entry?.expiresAt === 'number' && entry.expiresAt <= now
    }

    /**
     * エクスポート用JSON文字列を生成する
     * @returns {{ fileName: string, mimeType: string, content: string }} エクスポートデータ
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
            mediaFilterTargets: this.getMediaFilterTargets(),
            textFilterWords: this.getTextFilterWords()
        }
        return {
            fileName: `hidden-entries-${sanitizedNow}.json`,
            mimeType: 'application/json',
            content: JSON.stringify(payload, null, 2)
        }
    }

    /**
     * エクスポートJSON文字列を受け取りバリデーションを行う
     * @param {string} jsonText - 取り込むJSON文字列
     * @returns {{ ids: string[], hiddenPosts: { id: string, expiresAt: number }[], mediaFilterTargets: string[], textFilterWords: string[], meta: { exportedAt: string, version: number } }}
     * パース済みデータ
     */
    parseImportPayload (jsonText) {
        if (typeof jsonText !== 'string') {
            throw new Error('JSON文字列を指定してください')
        }

        let parsed = null
        try {
            parsed = JSON.parse(jsonText)
        } catch (error) {
            throw new Error('JSONの読み込みに失敗しました')
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

        const sanitizedIds = this.sanitizeUserIds(parsed.hiddenUserIds)

        let mediaFilterTargets = CONFIG.MEDIA_FILTER.DEFAULT_TARGET_LISTS.slice()
        if (Array.isArray(parsed.mediaFilterTargets)) {
            mediaFilterTargets = this.sanitizeIds(parsed.mediaFilterTargets)
        }

        let hiddenPosts = CONFIG.POST_FILTER.DEFAULT_ENTRIES.slice()
        if (Array.isArray(parsed.hiddenPosts)) {
            hiddenPosts = this.sanitizePostEntries(parsed.hiddenPosts)
        }

        let textFilterWords = CONFIG.TEXT_FILTER.DEFAULT_WORDS.slice()
        if (Array.isArray(parsed.textFilterWords)) {
            textFilterWords = this.sanitizeWords(parsed.textFilterWords)
        } else if (parsed.version === 1 && Array.isArray(parsed.ngWords)) {
            // 将来の後方互換余地（予約）
            textFilterWords = this.sanitizeWords(parsed.ngWords)
        }

        return {
            ids: sanitizedIds,
            hiddenPosts,
            mediaFilterTargets,
            textFilterWords,
            meta: {
                exportedAt: parsed.exportedAt,
                version: parsed.version
            }
        }
    }
}
