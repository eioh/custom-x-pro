import { CONFIG } from './config.js';

/**
 * 設定とストレージの永続化を管理するクラス
 */
export class ConfigManager {
    constructor () {
        this.hiddenUserIds = []
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
            if (seen.has(trimmed)) {
                return
            }
            seen.add(trimmed)
            result.push(trimmed)
        })
        return result
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
        return this.hiddenUserIds
    }

    /**
     * 非表示ユーザーIDのリストをTampermonkeyストレージに保存する
     * @param {string[]} ids - 保存するユーザーIDの配列
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
     * 現在の非表示ユーザーIDリストを取得する
     * @returns {string[]} 非表示ユーザーIDの配列
     */
    getIds () {
        return this.hiddenUserIds
    }
}
