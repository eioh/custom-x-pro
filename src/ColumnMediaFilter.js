import { CONFIG } from './config.js'

/**
 * メディア付きポストのみを表示するカラム用フィルター
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
     * 対象カラムの全ポストにメディア判定を適用する
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
     * 判定対象となるカラム要素を取得する
     * @returns {HTMLElement[]} メディアフィルター対象カラム一覧
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
     * 判定対象リスト名のキーワードを取得する
     * @returns {string[]} リスト名キーワード配列
     */
    getTargetListKeywords () {
        const lists = this.configManager.getMediaFilterTargets() || []
        return lists.map(name => (name || '').trim()).filter(Boolean)
    }

    /**
     * ポストを非表示にするかどうかを判定する
     * @param {HTMLElement} tweet - 判定対象のセル
     * @returns {boolean} 非表示にすべき場合はtrue
     */
    shouldHideTweet (tweet) {
        if (!tweet) {
            return false
        }
        if (this.shouldSkip(tweet)) {
            return false
        }
        const quoteContainers = this.getQuoteContainers(tweet)
        if (!quoteContainers.length) {
            return !this.hasMedia(tweet)
        }
        return !this.hasMedia(tweet, quoteContainers)
    }

    /**
     * スキップ対象のセルであるかを確認する
     * @param {HTMLElement} tweet - ポストセル
     * @returns {boolean} スキップする場合はtrue
     */
    shouldSkip (tweet) {
        const text = (tweet.textContent || '').trim()
        return this.skipTexts.some(label => label === text)
    }

    /**
     * 引用カードのコンテナ要素一覧を取得する
     * @param {HTMLElement} tweet - ポストセル
     * @returns {HTMLElement[]} 引用カードコンテナ
     */
    getQuoteContainers (tweet) {
        return Array.from(
            tweet.querySelectorAll(CONFIG.POST_FILTER.QUOTE_CONTAINER_SELECTOR)
        )
    }

    /**
     * 指定の要素配下にメディアが存在するか判定する
     * @param {HTMLElement} tweet - ポストセル
     * @param {HTMLElement[]} excludeContainers - 判定から除外するコンテナ
     * @returns {boolean} メディアが存在する場合はtrue
     */
    hasMedia (tweet, excludeContainers = []) {
        const excludes = excludeContainers.filter(Boolean)
        return this.mediaSelectors.some(selector => {
            const mediaNodes = Array.from(tweet.querySelectorAll(selector))
            return mediaNodes.some(node => !this.isExcluded(node, excludes))
        })
    }

    /**
     * ノードが除外対象コンテナ内に含まれるか判定する
     * @param {HTMLElement} node - 判定するノード
     * @param {HTMLElement[]} containers - コンテナ一覧
     * @returns {boolean} containerに含まれる場合はtrue
     */
    isExcluded (node, containers) {
        return containers.some(container =>
            typeof container.contains === 'function' &&
            container.contains(node)
        )
    }
}
