import { CONFIG } from './config.js'

/**
 * セルの非表示判定を行うエンジンクラス
 */
export class FilterEngine {
  /**
   * @param {ConfigManager} configManager - 設定を保持するインスタンス
   */
  constructor (configManager) {
    this.configManager = configManager
  }

  /**
   * セルを非表示にするべきか判定する
   * @param {HTMLElement} cell - 対象セル
   * @returns {boolean} 非表示ならtrue
   */
  shouldHide (cell) {
    const result = this.evaluateCell(cell)
    return result.hide
  }

  /**
   * セルの非表示判定結果を返す
   * @param {HTMLElement} cell - 判定対象セル
   * @returns {{ hide: boolean, matches: { parentPost: boolean, quotedPost: boolean, parentUser: boolean, quotedUser: boolean, parentText: boolean, quotedText: boolean }, ids: { parentPostId: string|null, quotedPostIds: string[], parentUserId: string|null, quotedUserIds: string[] }, texts: { parentTexts: string[], quotedTexts: string[] } }}
   */
  evaluateCell (cell) {
    const hiddenUserIds = this.configManager.getIds()
    const textFilterWords = this.configManager.getTextFilterWords() || []
    const { parentPostId, quotedPostIds } = this.extractPostIds(cell)
    const { parentUserId, quotedUserIds } = this.extractUserIds(cell)
    const { parentTexts, quotedTexts } = this.extractTexts(cell)

    const matches = {
      parentPost: false,
      quotedPost: false,
      parentUser: false,
      quotedUser: false,
      parentText: false,
      quotedText: false
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

    if (textFilterWords.length > 0) {
      matches.parentText = this.hasTextMatch(parentTexts, textFilterWords)
      matches.quotedText = this.hasTextMatch(quotedTexts, textFilterWords)
    }

    return {
      hide: Object.values(matches).some(Boolean),
      matches,
      ids: {
        parentPostId,
        quotedPostIds,
        parentUserId,
        quotedUserIds
      },
      texts: {
        parentTexts,
        quotedTexts
      }
    }
  }

  /**
   * ポストIDを抽出する（親/引用を判定）
   * @param {HTMLElement} cell - 対象セル
   * @returns {{ parentPostId: string|null, quotedPostIds: string[] }} 抽出結果
   */
  extractPostIds (cell) {
    const postLinks = Array.from(
      cell.querySelectorAll(CONFIG.POST_FILTER.SELECTOR)
    )
    const quoteContainers = this.getQuoteContainers(cell)

    const quotedPostIds = []
    const quotedSet = new Set()

    postLinks.forEach(link => {
      const isQuoted = quoteContainers.some(
        container =>
          typeof container.contains === 'function' && container.contains(link)
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
          const isQuoted = quoteContainers.some(
            container =>
              typeof container.contains === 'function' &&
              container.contains(item.link)
          )
          return !isQuoted
        })?.id || null

    return { parentPostId, quotedPostIds }
  }

  /**
   * ポストIDをリンクから抽出する
   * @param {HTMLAnchorElement} postLink - ポストへのリンク
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
   * ユーザーIDを抽出する（先頭を親、残りを引用として扱う）
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
   * @param {HTMLAnchorElement} userLink - ユーザーリンク
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

  /**
   * テキストを抽出し親/引用に振り分ける
   * @param {HTMLElement} cell - 対象セル
   * @returns {{ parentTexts: string[], quotedTexts: string[] }} テキスト配列
   */
  extractTexts (cell) {
    const textNodes = Array.from(
      cell.querySelectorAll(CONFIG.SELECTORS.TWEET_TEXT)
    )
    const quoteContainers = this.getQuoteContainers(cell)
    const parentTexts = []
    const quotedTexts = []

    textNodes.forEach(node => {
      const text = (node.textContent || '').trim()
      if (!text) {
        return
      }
      const isQuoted = quoteContainers.some(
        container =>
          typeof container.contains === 'function' && container.contains(node)
      )
      if (isQuoted) {
        quotedTexts.push(text)
      } else {
        parentTexts.push(text)
      }
    })

    return { parentTexts, quotedTexts }
  }

  /**
   * テキストにNGワードが含まれるか判定する（大文字小文字無視）
   * @param {string[]} texts - 判定対象テキスト
   * @param {string[]} words - NGワード（小文字）
   * @returns {boolean} 含まれていればtrue
   */
  hasTextMatch (texts, words) {
    if (!texts.length || !words.length) {
      return false
    }
    return texts.some(text => {
      const lowered = text.toLowerCase()
      return words.some(word => lowered.includes(word))
    })
  }

  /**
   * 引用カードのコンテナ一覧を取得する
   * @param {HTMLElement} cell - 対象セル
   * @returns {HTMLElement[]} コンテナ配列
   */
  getQuoteContainers (cell) {
    return Array.from(
      cell.querySelectorAll(CONFIG.POST_FILTER.QUOTE_CONTAINER_SELECTOR)
    )
  }
}
