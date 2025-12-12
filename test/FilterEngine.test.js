import { describe, it, expect, jest } from "@jest/globals"
import { FilterEngine } from "../src/FilterEngine.js"
import { CONFIG } from "../src/config.js"

const createElement = (selectors = [], text = '') => {
    const element = {
        selectors: new Set(selectors),
        children: [],
        textContent: text,
        _parent: null,
        appendChild (child) {
            child._parent = this
            this.children.push(child)
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

const createLink = (href, selectors) => {
    const link = createElement(selectors)
    link.getAttribute = name => (name === 'href' ? href : '')
    return link
}

const buildCell = ({
    userHrefs = [],
    postHrefs = [],
    quoteLinkIndexes = [],
    parentTexts = [],
    quotedTexts = []
} = {}) => {
    const cell = createElement()

    userHrefs.forEach(href => {
        const link = createLink(href, [CONFIG.SELECTORS.USER_NAME])
        cell.appendChild(link)
    })

    const quoteContainer = createElement([CONFIG.POST_FILTER.QUOTE_CONTAINER_SELECTOR])

    postHrefs.forEach((href, index) => {
        const link = createLink(href, [CONFIG.POST_FILTER.SELECTOR])
        if (quoteLinkIndexes.includes(index)) {
            quoteContainer.appendChild(link)
        } else {
            cell.appendChild(link)
        }
    })

    if (quoteContainer.children.length > 0 || quotedTexts.length > 0) {
        cell.appendChild(quoteContainer)
    }

    parentTexts.forEach(text => {
        const node = createElement([CONFIG.SELECTORS.TWEET_TEXT], text)
        cell.appendChild(node)
    })

    quotedTexts.forEach(text => {
        const node = createElement([CONFIG.SELECTORS.TWEET_TEXT], text)
        quoteContainer.appendChild(node)
    })

    return cell
}

describe('FilterEngine', () => {
    it('親ポストIDがhiddenPostsに一致すればTTLを延長し非表示にする', () => {
        const configManager = {
            hasHiddenPostId: jest.fn(id => id === '1998'),
            extendHiddenPostExpiry: jest.fn(),
            getIds: jest.fn(() => []),
            getTextFilterWords: jest.fn(() => [])
        }
        const cell = buildCell({
            postHrefs: ['https://x.com/user/status/1998/analytics']
        })
        const engine = new FilterEngine(configManager)
        const result = engine.evaluateCell(cell)
        expect(result.matches.parentPost).toBe(true)
        expect(result.matches.quotedPost).toBe(false)
        expect(result.hide).toBe(true)
        expect(configManager.extendHiddenPostExpiry).toHaveBeenCalledWith('1998')
    })

    it('引用ポストIDがhiddenPostsに一致すれば非表示にする', () => {
        const configManager = {
            hasHiddenPostId: jest.fn(id => id === '2000'),
            extendHiddenPostExpiry: jest.fn(),
            getIds: jest.fn(() => []),
            getTextFilterWords: jest.fn(() => [])
        }
        const cell = buildCell({
            postHrefs: [
                'https://x.com/user/status/1998/analytics',
                'https://x.com/user/status/2000/analytics'
            ],
            quoteLinkIndexes: [1]
        })
        const engine = new FilterEngine(configManager)
        const result = engine.evaluateCell(cell)
        expect(result.matches.parentPost).toBe(false)
        expect(result.matches.quotedPost).toBe(true)
        expect(result.hide).toBe(true)
        expect(configManager.extendHiddenPostExpiry).toHaveBeenCalledWith('2000')
    })

    it('親の投稿者がhiddenUserIdsに含まれれば非表示', () => {
        const configManager = {
            hasHiddenPostId: jest.fn(() => false),
            extendHiddenPostExpiry: jest.fn(),
            getIds: jest.fn(() => ['Target']),
            getTextFilterWords: jest.fn(() => [])
        }
        const cell = buildCell({
            userHrefs: ['https://x.com/Target']
        })
        const engine = new FilterEngine(configManager)
        const result = engine.evaluateCell(cell)
        expect(result.matches.parentUser).toBe(true)
        expect(result.matches.quotedUser).toBe(false)
        expect(result.hide).toBe(true)
    })

    it('引用元の投稿者がhiddenUserIdsに含まれれば非表示', () => {
        const configManager = {
            hasHiddenPostId: jest.fn(() => false),
            extendHiddenPostExpiry: jest.fn(),
            getIds: jest.fn(() => ['Quoted']),
            getTextFilterWords: jest.fn(() => [])
        }
        const cell = buildCell({
            userHrefs: ['https://x.com/Parent', 'https://x.com/Quoted']
        })
        const engine = new FilterEngine(configManager)
        const result = engine.evaluateCell(cell)
        expect(result.matches.parentUser).toBe(false)
        expect(result.matches.quotedUser).toBe(true)
        expect(result.hide).toBe(true)
    })

    it('NGワードが親ポスト本文に含まれれば非表示（大小区別なし）', () => {
        const configManager = {
            hasHiddenPostId: jest.fn(() => false),
            extendHiddenPostExpiry: jest.fn(),
            getIds: jest.fn(() => []),
            getTextFilterWords: jest.fn(() => ['spam'])
        }
        const cell = buildCell({
            parentTexts: ['This is SpAm text']
        })
        const engine = new FilterEngine(configManager)
        const result = engine.evaluateCell(cell)
        expect(result.matches.parentText).toBe(true)
        expect(result.matches.quotedText).toBe(false)
        expect(result.hide).toBe(true)
    })

    it('NGワードが引用テキストに含まれれば非表示', () => {
        const configManager = {
            hasHiddenPostId: jest.fn(() => false),
            extendHiddenPostExpiry: jest.fn(),
            getIds: jest.fn(() => []),
            getTextFilterWords: jest.fn(() => ['spam'])
        }
        const cell = buildCell({
            quotedTexts: ['quoted spam content'],
            postHrefs: ['https://x.com/user/status/1/analytics'],
            quoteLinkIndexes: [0]
        })
        const engine = new FilterEngine(configManager)
        const result = engine.evaluateCell(cell)
        expect(result.matches.parentText).toBe(false)
        expect(result.matches.quotedText).toBe(true)
        expect(result.hide).toBe(true)
    })

    it('一致なしの場合は非表示にしない', () => {
        const configManager = {
            hasHiddenPostId: jest.fn(() => false),
            extendHiddenPostExpiry: jest.fn(),
            getIds: jest.fn(() => []),
            getTextFilterWords: jest.fn(() => ['spam'])
        }
        const cell = buildCell({
            userHrefs: ['https://x.com/Parent'],
            postHrefs: ['https://x.com/user/status/1998/analytics'],
            parentTexts: ['hello world']
        })
        const engine = new FilterEngine(configManager)
        const result = engine.evaluateCell(cell)
        expect(result.hide).toBe(false)
    })
})
