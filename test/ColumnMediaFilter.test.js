import { describe, it, expect } from '@jest/globals'
import { ColumnMediaFilter } from '../src/ColumnMediaFilter.js'
import { CONFIG } from '../src/config.js'

const createElement = (selectors = []) => {
    const element = {
        selectors: new Set(selectors),
        children: [],
        textContent: '',
        appendChild (child) {
            this.children.push(child)
            child._parent = this
        },
        contains (node) {
            if (this === node) {
                return true
            }
            return this.children.some(child =>
                typeof child.contains === 'function' && child.contains(node)
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

const buildFilter = () => new ColumnMediaFilter({
    getMediaFilterTargets: () => []
})

describe('ColumnMediaFilter', () => {
    it('引用元だけにメディアがある場合は非表示にする', () => {
        const tweet = createElement()
        const quoteContainer = createElement([CONFIG.POST_FILTER.QUOTE_CONTAINER_SELECTOR])
        const quotedMedia = createElement([CONFIG.MEDIA_FILTER.MEDIA_SELECTORS[0]])
        quoteContainer.appendChild(quotedMedia)
        tweet.appendChild(quoteContainer)

        const filter = buildFilter()
        expect(filter.shouldHideTweet(tweet)).toBe(true)
    })

    it('引用していても引用側にメディアがあれば表示する', () => {
        const tweet = createElement()
        const quoteContainer = createElement([CONFIG.POST_FILTER.QUOTE_CONTAINER_SELECTOR])
        tweet.appendChild(quoteContainer)
        const parentMedia = createElement([CONFIG.MEDIA_FILTER.MEDIA_SELECTORS[0]])
        tweet.appendChild(parentMedia)

        const filter = buildFilter()
        expect(filter.shouldHideTweet(tweet)).toBe(false)
    })

    it('引用がない場合は従来どおりメディア有無で判定する', () => {
        const tweetWithMedia = createElement([CONFIG.MEDIA_FILTER.MEDIA_SELECTORS[0]])
        const tweetWithoutMedia = createElement()
        const filter = buildFilter()

        expect(filter.shouldHideTweet(tweetWithMedia)).toBe(false)
        expect(filter.shouldHideTweet(tweetWithoutMedia)).toBe(true)
    })
})
