import { CONFIG } from './config.js';

/**
 * 指定されたリストカラムでメディア付きポストのみを表示するフィルター
 */
export class ColumnMediaFilter {
    /**
     * @param {ConfigManager} configManager - 設定管理インスタンス
     */
    constructor (configManager) {
        this.configManager = configManager
        this.mediaSelectors = CONFIG.MEDIA_FILTER.MEDIA_SELECTORS || []
        this.skipTexts = CONFIG.MEDIA_FILTER.SKIP_TEXTS || []
    }

    /**
     * 対象カラムを走査してメディア無しポストを非表示にする
     */
    filter () {
        const keywords = this.getTargetListKeywords()
        if (!keywords.length) {
            return
        }
        const columns = this.getTargetColumns(keywords)
        columns.forEach(column => {
            const tweets = column.querySelectorAll(CONFIG.SELECTORS.CELL)
            tweets.forEach(tweet => {
                const shouldHide = this.shouldHideTweet(tweet)
                tweet.classList.toggle(
                    CONFIG.MEDIA_FILTER.HIDDEN_CLASS_NAME,
                    shouldHide
                )
            })
        })
    }

    /**
     * 対象のリストカラムを取得する
     * @returns {HTMLElement[]} カラム要素の配列
     */
    getTargetColumns (keywords) {
        const columns = Array.from(
            document.querySelectorAll(CONFIG.MEDIA_FILTER.COLUMN_SELECTOR)
        )
        return columns.filter(column => {
            const header = column.querySelector(CONFIG.MEDIA_FILTER.HEADER_SELECTOR)
            if (!header) {
                return false
            }
            const listName = (header.textContent || '').trim()
            return keywords.some(keyword =>
                keyword && listName.includes(keyword)
            )
        })
    }

    /**
     * 現在のターゲットリスト名を取得する
     * @returns {string[]} リスト名キーワード配列
     */
    getTargetListKeywords () {
        const lists = this.configManager.getMediaFilterTargets() || []
        return lists.map(name => (name || '').trim()).filter(Boolean)
    }

    /**
     * ポストを非表示にすべきか判定する
     * @param {HTMLElement} tweet - 判定対象の要素
     * @returns {boolean} 非表示にする場合はtrue
     */
    shouldHideTweet (tweet) {
        if (!tweet) {
            return false
        }
        if (this.shouldSkip(tweet)) {
            return false
        }
        const hasMedia = this.mediaSelectors.some(selector =>
            tweet.querySelector(selector)
        )
        return !hasMedia
    }

    /**
     * スキップ対象のセルかどうかを判定する
     * @param {HTMLElement} tweet - チェック対象
     * @returns {boolean} スキップすべき場合はtrue
     */
    shouldSkip (tweet) {
        const text = (tweet.textContent || '').trim()
        return this.skipTexts.some(label => label === text)
    }
}
