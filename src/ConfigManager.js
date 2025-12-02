import { CONFIG } from './config.js';

/**
 * 設定とストレージの永続化を管理するクラス
 */
export class ConfigManager {
    constructor () {
        this.hiddenUserIds = []
        this.normalizedHiddenUserIds = []
        this.load()
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
            const key = trimmed.toLowerCase()
            if (seen.has(key)) {
                return
            }
            seen.add(key)
            result.push(trimmed)
        })
        return result
    }

    /**
     * 大文字小文字を区別しない比較のためにユーザーIDを正規化（小文字化）する
     * @param {string[]} ids - ユーザーIDの配列
     * @returns {string[]} 小文字化されたユーザーIDの配列
     */
    buildNormalizedHiddenUserIds (ids) {
        return ids.map(id => id.toLowerCase())
    }

    /**
     * Tampermonkeyストレージから非表示ユーザーIDを読み込む
     * @returns {string[]} 読み込まれた非表示ユーザーIDの配列
     */
    load () {
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
        this.normalizedHiddenUserIds = this.buildNormalizedHiddenUserIds(ids)
        return this.hiddenUserIds
    }

    /**
     * 非表示ユーザーIDのリストをTampermonkeyストレージに保存する
     * @param {string[]} ids - 保存するユーザーIDの配列
     */
    save (ids) {
        const sanitized = this.sanitizeIds(ids)
        this.hiddenUserIds = sanitized
        this.normalizedHiddenUserIds = this.buildNormalizedHiddenUserIds(this.hiddenUserIds)
        GM_setValues({
            [CONFIG.STORAGE_KEY]: this.hiddenUserIds
        })
        console.log('hiddenUserIds 更新:', this.hiddenUserIds)
    }

    /**
     * 現在の非表示ユーザーIDリストを取得する
     * @returns {string[]} 非表示ユーザーIDの配列
     */
    getIds () {
        return this.hiddenUserIds
    }

    /**
     * 正規化（小文字化）された非表示ユーザーIDリストを取得する
     * @returns {string[]} 正規化された非表示ユーザーIDの配列
     */
    getNormalizedIds () {
        return this.normalizedHiddenUserIds
    }
}
