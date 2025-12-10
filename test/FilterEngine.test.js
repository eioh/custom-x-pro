import { describe, it, expect, jest } from '@jest/globals'
import { FilterEngine } from '../src/FilterEngine.js'
import { CONFIG } from '../src/config.js'

describe('FilterEngine', () => {
  const buildCell = ({ userHref, postHref } = {}) => ({
    querySelector: selector => {
      if (selector === CONFIG.SELECTORS.USER_NAME) {
        if (!userHref) {
          return null
        }
        return {
          getAttribute: () => userHref
        }
      }
      if (selector === CONFIG.POST_FILTER.SELECTOR) {
        if (!postHref) {
          return null
        }
        return {
          getAttribute: () => postHref
        }
      }
      return null
    }
  })

  it('ポストIDが一致すれば非表示にし期限を延長する', () => {
    const configManager = {
      hasHiddenPostId: jest.fn(() => true),
      extendHiddenPostExpiry: jest.fn(),
      getIds: jest.fn(() => [])
    }
    const cell = buildCell({
      postHref: 'https://x.com/example_user/status/1998/analytics'
    })
    const engine = new FilterEngine(configManager)
    expect(engine.shouldHide(cell)).toBe(true)
    expect(configManager.extendHiddenPostExpiry).toHaveBeenCalledWith('1998')
  })

  it('ユーザーIDが一致すれば非表示にする', () => {
    const configManager = {
      hasHiddenPostId: jest.fn(() => false),
      extendHiddenPostExpiry: jest.fn(),
      getIds: jest.fn(() => ['Target'])
    }
    const cell = buildCell({ userHref: 'https://x.com/Target' })
    const engine = new FilterEngine(configManager)
    expect(engine.shouldHide(cell)).toBe(true)
    expect(configManager.extendHiddenPostExpiry).not.toHaveBeenCalled()
  })

  it('一致しない場合や他ホストの場合は非表示にしない', () => {
    const configManager = {
      hasHiddenPostId: jest.fn(() => false),
      extendHiddenPostExpiry: jest.fn(),
      getIds: jest.fn(() => ['target'])
    }
    const nonTargetCell = buildCell({ userHref: 'https://x.com/another' })
    const otherHostCell = buildCell({ userHref: 'https://example.com/target' })
    const missingHrefCell = buildCell({ userHref: '' })
    const engine = new FilterEngine(configManager)
    expect(engine.shouldHide(nonTargetCell)).toBe(false)
    expect(engine.shouldHide(otherHostCell)).toBe(false)
    expect(engine.shouldHide(missingHrefCell)).toBe(false)
  })

  it('ポストリンクが無い場合はユーザー名で判定する', () => {
    const configManager = {
      hasHiddenPostId: jest.fn(() => false),
      extendHiddenPostExpiry: jest.fn(),
      getIds: jest.fn(() => ['Target'])
    }
    const cell = buildCell({ userHref: 'https://x.com/Target' })
    const engine = new FilterEngine(configManager)
    expect(engine.shouldHide(cell)).toBe(true)
  })
})
