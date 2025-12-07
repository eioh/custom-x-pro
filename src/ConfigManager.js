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

    /**
     * 現在の設定をJSON形式でエクスポートするための情報を生成する
     * @returns {{ fileName: string, mimeType: string, content: string }} エクスポートに必要な情報
     */
    createExportPayload () {
        const now = new Date().toISOString()
        const sanitizedNow = now.replace(/[:.]/g, '-')
        const payload = {
            storageKey: CONFIG.STORAGE_KEY,
            version: CONFIG.EXPORT_VERSION,
            exportedAt: now,
            hiddenUserIds: this.getIds()
        }
        return {
            fileName: `hidden-user-ids-${sanitizedNow}.json`,
            mimeType: 'application/json',
            content: JSON.stringify(payload, null, 2)
        }
    }

    /**
     * エクスポートJSON文字列を検証してインポート情報を返す
     * @param {string} jsonText - 読み込んだJSON文字列
     * @returns {{ ids: string[], meta: { exportedAt: string, version: number } }} インポートに使用する情報
     */
    parseImportPayload (jsonText) {
        if (typeof jsonText !== 'string') {
            throw new Error('JSON文字列を取得できませんでした')
        }

        let parsed = null
        try {
            parsed = JSON.parse(jsonText)
        } catch (error) {
            throw new Error('JSONの解析に失敗しました')
        }

        if (!parsed || typeof parsed !== 'object') {
            throw new Error('JSONオブジェクトではありません')
        }

        if (parsed.storageKey !== CONFIG.STORAGE_KEY) {
            throw new Error('storageKeyが一致しません')
        }

        if (typeof parsed.version !== 'number') {
            throw new Error('versionが不正です')
        }

        if (parsed.version !== CONFIG.EXPORT_VERSION) {
            throw new Error('versionが一致しません')
        }

        if (typeof parsed.exportedAt !== 'string' || !parsed.exportedAt) {
            throw new Error('exportedAtが不正です')
        }

        if (!Array.isArray(parsed.hiddenUserIds)) {
            throw new Error('hiddenUserIdsが配列ではありません')
        }

        const sanitized = this.sanitizeIds(parsed.hiddenUserIds)
        return {
            ids: sanitized,
            meta: {
                exportedAt: parsed.exportedAt,
                version: parsed.version
            }
        }
    }
}
