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
        const result = this.evaluateCell(cell)
        return result.hide
    }

    /**
     * セルの非表示判定と一致箇所を返す
     * @param {HTMLElement} cell - 対象セル
     * @returns {{ hide: boolean, matches: { parentPost: boolean, quotedPost: boolean, parentUser: boolean, quotedUser: boolean }, ids: { parentPostId: string|null, quotedPostIds: string[], parentUserId: string|null, quotedUserIds: string[] } }}
     */
    evaluateCell (cell) {
        const hiddenUserIds = this.configManager.getIds()
        const { parentPostId, quotedPostIds } = this.extractPostIds(cell)
        const { parentUserId, quotedUserIds } = this.extractUserIds(cell)

        const matches = {
            parentPost: false,
            quotedPost: false,
            parentUser: false,
            quotedUser: false
        }

        if (parentPostId && this.configManager.hasHiddenPostId(parentPostId)) {
            matches.parentPost = true
            this.configManager.extendHiddenPostExpiry(parentPostId)
        }

        const matchedQuotedPostId = quotedPostIds.find(id =>
            this.configManager.hasHiddenPostId(id)
        )
        if (matchedQuotedPostId) {
            matches.quotedPost = true
            this.configManager.extendHiddenPostExpiry(matchedQuotedPostId)
        }

        if (parentUserId && hiddenUserIds.includes(parentUserId)) {
            matches.parentUser = true
        }

        if (quotedUserIds.some(id => hiddenUserIds.includes(id))) {
            matches.quotedUser = true
        }

        return {
            hide: Object.values(matches).some(Boolean),
            matches,
            ids: {
                parentPostId,
                quotedPostIds,
                parentUserId,
                quotedUserIds
            }
        }
    }

    /**
     * ポストIDを抽出する（親と引用を判別）
     * @param {HTMLElement} cell - 対象セル
     * @returns {{ parentPostId: string|null, quotedPostIds: string[] }} 抽出結果
     */
    extractPostIds (cell) {
        const postLinks = Array.from(
            cell.querySelectorAll(CONFIG.POST_FILTER.SELECTOR)
        )
        const quoteContainers = Array.from(
            cell.querySelectorAll(CONFIG.POST_FILTER.QUOTE_CONTAINER_SELECTOR)
        )

        const quotedPostIds = []
        const quotedSet = new Set()

        postLinks.forEach(link => {
            // 引用カード(div[role="link"][tabindex="0"])配下なら引用ポスト扱い
            const isQuoted = quoteContainers.some(container =>
                typeof container.contains === 'function' &&
                container.contains(link)
            )
            const postId = this.extractPostIdFromLink(link)
            if (!postId) {
                return
            }
            if (isQuoted) {
                if (!quotedSet.has(postId)) {
                    quotedSet.add(postId)
                    quotedPostIds.push(postId)
                }
            }
        })

        const parentPostId =
            postLinks
                .map(link => ({
                    link,
                    id: this.extractPostIdFromLink(link)
                }))
                .find(item => {
                    if (!item.id) {
                        return false
                    }
                    // コンテナ外の最初のリンクを親ポストとみなす
                    const isQuoted = quoteContainers.some(container =>
                        typeof container.contains === 'function' &&
                        container.contains(item.link)
                    )
                    return !isQuoted
                })?.id || null

        return { parentPostId, quotedPostIds }
    }

    /**
     * ポストIDをリンクから抽出する
     * @param {HTMLAnchorElement} postLink - ポストリンク要素
     * @returns {string|null} ポストID
     */
    extractPostIdFromLink (postLink) {
        const href = postLink.getAttribute('href') || ''
        const match = href.match(/status\/(\d+)/)
        if (!match) {
            return null
        }
        return match[1]
    }

    /**
     * ユーザーIDを抽出する（親と引用を判別）
     * @param {HTMLElement} cell - 対象セル
     * @returns {{ parentUserId: string|null, quotedUserIds: string[] }} 抽出結果
     */
    extractUserIds (cell) {
        const userLinks = Array.from(
            cell.querySelectorAll(CONFIG.SELECTORS.USER_NAME)
        )
        const ids = userLinks
            .map(link => this.extractUserIdFromLink(link))
            .filter(Boolean)
        const [parentUserId = null, ...quotedUserIds] = ids
        return { parentUserId, quotedUserIds }
    }

    /**
     * ユーザーIDをリンクから抽出する
     * @param {HTMLAnchorElement} userLink - ユーザー名リンク
     * @returns {string|null} ユーザーID
     */
    extractUserIdFromLink (userLink) {
        const href = userLink.getAttribute('href') || ''
        const hrefMatch = href.match(/^https?:\/\/(?:www\.)?x\.com\/([^/?#]+)/i)
        if (!hrefMatch) {
            return null
        }
        return hrefMatch[1]
    }
}
