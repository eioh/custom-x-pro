import { CONFIG } from './config.js';

/**
 * セルを非表示にするかどうかの判定ロジックを扱うクラス
 */
export class FilterEngine {
    /**
     * @param {ConfigManager} configManager - 設定マネージャーのインスタンス
     */
    constructor (configManager) {
        this.configManager = configManager
    }

    /**
     * ユーザーIDに基づいてセル要素を非表示にすべきか判定する
     * @param {HTMLElement} cell - チェックするセル要素
     * @returns {boolean} 非表示にすべき場合はtrue、そうでない場合はfalse
     */
    shouldHide (cell) {
        const userNameLink = cell.querySelector(CONFIG.SELECTORS.USER_NAME)
        if (!userNameLink) {
            return false
        }
        const href = userNameLink.getAttribute('href') || ''
        const hrefMatch = href.match(/^https?:\/\/(?:www\.)?x\.com\/([^/?#]+)/i)
        let userId = null
        if (hrefMatch) {
            userId = hrefMatch[1]
        }

        const targetId = userId || ''
        if (!targetId) {
            return false
        }

        const shouldHide = this.configManager.getIds().some(keyword =>
            targetId === keyword
        )
        return shouldHide
    }
}
