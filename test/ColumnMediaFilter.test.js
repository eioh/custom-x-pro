import { describe, it, expect, jest } from '@jest/globals'
import { ColumnMediaFilter } from '../src/ColumnMediaFilter.js'
import { CONFIG } from '../src/config.js'

const createElement = (selectors = []) => {
  const classSet = new Set()
  const element = {
    selectors: new Set(selectors),
    children: [],
    textContent: '',
    classList: {
      toggle (name, force) {
        if (force === undefined) {
          if (classSet.has(name)) {
            classSet.delete(name)
            return false
          }
          classSet.add(name)
          return true
        }
        if (force) {
          classSet.add(name)
          return true
        }
        classSet.delete(name)
        return false
      },
      contains (name) {
        return classSet.has(name)
      }
    },
    appendChild (child) {
      this.children.push(child)
      child._parent = this
    },
    contains (node) {
      if (this === node) {
        return true
      }
      return this.children.some(
        child => typeof child.contains === 'function' && child.contains(node)
      )
    },
    querySelectorAll (selector) {
      let matched = this.selectors.has(selector) ? [this] : []
      this.children.forEach(child => {
        matched = matched.concat(child.querySelectorAll(selector))
      })
      return matched
    },
    querySelector (selector) {
      return this.querySelectorAll(selector)[0] || null
    }
  }
  return element
}

const buildFilter = () =>
  new ColumnMediaFilter({
    getMediaFilterTargets: () => []
  })

describe('ColumnMediaFilter', () => {
  it('引用カード内にメディアがある場合はツイートを非表示にする', () => {
    const tweet = createElement()
    const quoteContainer = createElement([
      CONFIG.POST_FILTER.QUOTE_CONTAINER_SELECTOR
    ])
    const quotedMedia = createElement([CONFIG.MEDIA_FILTER.MEDIA_SELECTORS[0]])
    quoteContainer.appendChild(quotedMedia)
    tweet.appendChild(quoteContainer)

    const filter = buildFilter()
    expect(filter.shouldHideTweet(tweet)).toBe(true)
  })

  it('親ツイートにメディアがあれば親ツイートのみで判定する', () => {
    const tweet = createElement()
    const quoteContainer = createElement([
      CONFIG.POST_FILTER.QUOTE_CONTAINER_SELECTOR
    ])
    tweet.appendChild(quoteContainer)
    const parentMedia = createElement([CONFIG.MEDIA_FILTER.MEDIA_SELECTORS[0]])
    tweet.appendChild(parentMedia)

    const filter = buildFilter()
    expect(filter.shouldHideTweet(tweet)).toBe(false)
  })

  it('引用がない場合は従来どおりメディア有無で判定する', () => {
    const tweetWithMedia = createElement([
      CONFIG.MEDIA_FILTER.MEDIA_SELECTORS[0]
    ])
    const tweetWithoutMedia = createElement()
    const filter = buildFilter()

    expect(filter.shouldHideTweet(tweetWithMedia)).toBe(false)
    expect(filter.shouldHideTweet(tweetWithoutMedia)).toBe(true)
  })

  it('getTargetListKeywordsで空白を除去して返す', () => {
    const filter = new ColumnMediaFilter({
      getMediaFilterTargets: () => [' ListA ', '']
    })
    expect(filter.getTargetListKeywords()).toEqual(['ListA'])
  })

  it('getTargetColumnsでヘッダー名に一致するカラムのみを対象とする', () => {
    const column = createElement([CONFIG.MEDIA_FILTER.COLUMN_SELECTOR])
    const header = createElement([CONFIG.MEDIA_FILTER.HEADER_SELECTOR])
    header.textContent = 'My Target List'
    column.appendChild(header)
    const otherColumn = createElement([CONFIG.MEDIA_FILTER.COLUMN_SELECTOR])
    const filter = new ColumnMediaFilter({
      getMediaFilterTargets: () => ['Target']
    })
    const originalDocument = global.document
    global.document = {
      querySelectorAll: selector =>
        selector === CONFIG.MEDIA_FILTER.COLUMN_SELECTOR
          ? [column, otherColumn]
          : []
    }

    const result = filter.getTargetColumns(['Target'])

    global.document = originalDocument
    expect(result).toEqual([column])
  })

  it('shouldSkipでスキップ対象文言なら非表示にしない', () => {
    const tweet = createElement()
    tweet.textContent = CONFIG.MEDIA_FILTER.SKIP_TEXTS[0]
    const filter = buildFilter()
    expect(filter.shouldHideTweet(tweet)).toBe(false)
  })

  it('hasMediaで除外コンテナ内のメディアは数えない', () => {
    const tweet = createElement()
    const quoteContainer = createElement()
    const quotedMedia = createElement([CONFIG.MEDIA_FILTER.MEDIA_SELECTORS[0]])
    quoteContainer.appendChild(quotedMedia)
    tweet.appendChild(quoteContainer)
    const parentMedia = createElement([CONFIG.MEDIA_FILTER.MEDIA_SELECTORS[0]])
    tweet.appendChild(parentMedia)
    const filter = buildFilter()
    expect(filter.hasMedia(tweet, [quoteContainer])).toBe(true)
    expect(filter.hasMedia(tweet, [quoteContainer, parentMedia])).toBe(false)
  })

  it('filterで対象カラム内のツイートに非表示クラスを付与する', () => {
    const column = createElement([CONFIG.MEDIA_FILTER.COLUMN_SELECTOR])
    const header = createElement([CONFIG.MEDIA_FILTER.HEADER_SELECTOR])
    header.textContent = 'Media List'
    column.appendChild(header)
    const hideTweet = createElement([CONFIG.SELECTORS.CELL])
    const showTweet = createElement([CONFIG.SELECTORS.CELL])
    column.appendChild(hideTweet)
    column.appendChild(showTweet)
    const filter = new ColumnMediaFilter({
      getMediaFilterTargets: () => ['Media']
    })
    filter.shouldHideTweet = jest.fn(node => node === hideTweet)
    const originalDocument = global.document
    try {
      global.document = {
        querySelectorAll: selector =>
          selector === CONFIG.MEDIA_FILTER.COLUMN_SELECTOR ? [column] : []
      }

      filter.filter()

      expect(
        hideTweet.classList.contains(CONFIG.MEDIA_FILTER.HIDDEN_CLASS_NAME)
      ).toBe(true)
      expect(
        showTweet.classList.contains(CONFIG.MEDIA_FILTER.HIDDEN_CLASS_NAME)
      ).toBe(false)
      expect(filter.shouldHideTweet).toHaveBeenCalledTimes(2)
    } finally {
      global.document = originalDocument
    }
  })
})
