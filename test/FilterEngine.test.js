import { describe, it, expect, jest } from '@jest/globals'
import { FilterEngine } from '../src/FilterEngine.js'
import { CONFIG } from '../src/config.js'

const buildElement = () => {
    const children = []
    return {
        children,
        appendChild (child) {
            children.push(child)
            child._parent = this
        },
        contains (node) {
            return this.children.includes(node)
        }
    }
}

const buildLink = href => ({
    _parent: null,
    getAttribute: () => href
})

const buildCell = ({
    userHrefs = [],
    postHrefs = [],
    quoteLinkIndexes = []
} = {}) => {
    const userLinks = userHrefs.map(href => buildLink(href))
    const postLinks = postHrefs.map(href => buildLink(href))

    const quoteContainer = buildElement()
    quoteLinkIndexes.forEach(index => {
        const target = postLinks[index]
        if (target) {
            quoteContainer.appendChild(target)
        }
    })

    const quoteContainers =
        quoteLinkIndexes.length > 0 ? [quoteContainer] : []

    return {
        querySelectorAll (selector) {
            if (selector === CONFIG.SELECTORS.USER_NAME) {
                return userLinks
            }
            if (selector === CONFIG.POST_FILTER.SELECTOR) {
                return postLinks
            }
            if (selector === CONFIG.POST_FILTER.QUOTE_CONTAINER_SELECTOR) {
                return quoteContainers
            }
            return []
        },
        querySelector (selector) {
            const list = this.querySelectorAll(selector)
            return list[0] || null
        }
    }
}

describe('FilterEngine', () => {
    it('親ポストがhiddenPostsに一致すると判定しTTLを延長する', () => {
        const configManager = {
            hasHiddenPostId: jest.fn(id => id === '1998'),
            extendHiddenPostExpiry: jest.fn(),
            getIds: jest.fn(() => [])
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

    it('引用ポストだけがhiddenPostsに一致する場合を判定できる', () => {
        const configManager = {
            hasHiddenPostId: jest.fn(id => id === '2000'),
            extendHiddenPostExpiry: jest.fn(),
            getIds: jest.fn(() => [])
        }
        const cell = buildCell({
            postHrefs: [
                'https://x.com/user/status/1998/analytics', // 親
                'https://x.com/user/status/2000/analytics' // 引用
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

    it('親の投稿者がhiddenUserIdsに一致すると判定する', () => {
        const configManager = {
            hasHiddenPostId: jest.fn(() => false),
            extendHiddenPostExpiry: jest.fn(),
            getIds: jest.fn(() => ['Target'])
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

    it('引用元の投稿者だけがhiddenUserIdsに一致する場合を判定する', () => {
        const configManager = {
            hasHiddenPostId: jest.fn(() => false),
            extendHiddenPostExpiry: jest.fn(),
            getIds: jest.fn(() => ['Quoted'])
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

    it('一致がなければ非表示にしない', () => {
        const configManager = {
            hasHiddenPostId: jest.fn(() => false),
            extendHiddenPostExpiry: jest.fn(),
            getIds: jest.fn(() => [])
        }
        const cell = buildCell({
            userHrefs: ['https://x.com/Parent'],
            postHrefs: ['https://x.com/user/status/1998/analytics']
        })
        const engine = new FilterEngine(configManager)
        const result = engine.evaluateCell(cell)
        expect(result.hide).toBe(false)
    })
})
