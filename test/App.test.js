import { jest, describe, it, expect } from '@jest/globals'
import { App } from '../src/App.js'
import { CONFIG } from '../src/config.js'

const createFakeElement = (tagName = '') => {
  const classSet = new Set()
  return {
    tagName,
    children: [],
    attributes: {},
    parentNode: null,
    textContent: '',
    id: '',
    datasetTestid: '',
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
      child.parentNode = this
    },
    removeChild (child) {
      this.children = this.children.filter(node => node !== child)
      child.parentNode = null
    },
    setAttribute (name, value) {
      this.attributes[name] = String(value)
      if (name === 'id') {
        this.id = String(value)
      }
      if (name === 'data-testid') {
        this.datasetTestid = String(value)
      }
      if (name === 'role') {
        this.role = String(value)
      }
      if (name === 'tabindex') {
        this.tabindex = String(value)
      }
      if (name === 'href') {
        this.href = value || ''
      }
    },
    getAttribute (name) {
      if (name === 'data-testid') {
        return this.datasetTestid
      }
      if (name === 'href') {
        return this.href || ''
      }
      return this.attributes[name] || ''
    },
    contains (node) {
      return (
        this === node ||
        this.children.some(
          child => typeof child.contains === 'function' && child.contains(node)
        )
      )
    },
    matches (selector) {
      if (selector.startsWith('#')) {
        return this.id === selector.slice(1)
      }
      const dataTestMatch = selector.match(/^\[data-testid="([^"]+)"\]$/)
      if (dataTestMatch) {
        return this.datasetTestid === dataTestMatch[1]
      }
      if (selector === CONFIG.SELECTORS.CELL) {
        return this.datasetTestid === 'cellInnerDiv'
      }
      if (selector === CONFIG.SELECTORS.TWEET_TEXT) {
        return this.datasetTestid === 'tweetText'
      }
      if (selector === CONFIG.POST_FILTER.QUOTE_CONTAINER_SELECTOR) {
        return (
          this.tagName === 'div' &&
          this.role === 'link' &&
          this.tabindex === '0'
        )
      }
      return false
    },
    querySelectorAll (selector) {
      let matched = []
      this.children.forEach(child => {
        if (child.matches(selector)) {
          matched.push(child)
        }
        matched = matched.concat(child.querySelectorAll(selector))
      })
      return matched
    },
    querySelector (selector) {
      return this.querySelectorAll(selector)[0] || null
    },
    click: jest.fn()
  }
}

const createFakeDocument = () => {
  const head = createFakeElement('head')
  const body = createFakeElement('body')
  const doc = {
    head,
    body,
    createElement: tagName => createFakeElement(tagName),
    getElementById: id => {
      const search = node => {
        if (node.id === id) {
          return node
        }
        for (const child of node.children) {
          const found = search(child)
          if (found) {
            return found
          }
        }
        return null
      }
      return search(head) || search(body)
    },
    querySelectorAll: selector =>
      head.querySelectorAll(selector).concat(body.querySelectorAll(selector)),
    querySelector: selector =>
      head.querySelector(selector) || body.querySelector(selector)
  }
  head.parentNode = doc
  body.parentNode = doc
  return doc
}

describe('App', () => {
  let app
  let observerInstance
  let originalConsoleWarn
  let originalDocument
  let originalWindow

  beforeEach(() => {
    originalDocument = global.document
    originalWindow = global.window
    const fakeDocument = createFakeDocument()
    global.document = fakeDocument
    global.window = {
      prompt: jest.fn(),
      alert: jest.fn(),
      confirm: jest.fn()
    }
    observerInstance = null
    global.MutationObserver = class {
      constructor (callback) {
        this.callback = callback
        this.observe = jest.fn()
        this.disconnect = jest.fn()
        observerInstance = this
      }
    }
    global.GM_getValues = jest.fn(() => ({
      [CONFIG.STORAGE_KEY]: [],
      [CONFIG.POST_FILTER.STORAGE_KEY]: [],
      [CONFIG.MEDIA_FILTER.STORAGE_KEY]: [],
      [CONFIG.TEXT_FILTER.STORAGE_KEY]: []
    }))
    global.GM_setValues = jest.fn()
    global.GM_registerMenuCommand = jest.fn()
    global.GM_download = undefined
    global.URL = {
      createObjectURL: jest.fn(() => 'blob:url'),
      revokeObjectURL: jest.fn()
    }
    originalConsoleWarn = console.warn
    console.warn = jest.fn()
    app = new App()
  })

  afterEach(() => {
    console.warn = originalConsoleWarn
    global.document = originalDocument
    global.window = originalWindow
  })

  it('initでスタイル付与とフィルタ処理を呼び出す', () => {
    const ensureSpy = jest.spyOn(app, 'ensureHiddenStyle')
    const registerSpy = jest.spyOn(app, 'registerMenu')
    const startSpy = jest.spyOn(app, 'startObserver')
    const applySpy = jest.spyOn(app, 'applyFilters')
    const purgeSpy = jest.spyOn(app.configManager, 'purgeExpiredHiddenPosts')

    app.init()

    expect(ensureSpy).toHaveBeenCalled()
    expect(purgeSpy).toHaveBeenCalled()
    expect(registerSpy).toHaveBeenCalled()
    expect(startSpy).toHaveBeenCalled()
    expect(applySpy).toHaveBeenCalled()
    const style = document.getElementById(CONFIG.HIDDEN_STYLE_ID)
    expect(style).not.toBeNull()
    expect(style.textContent).toContain(`.${CONFIG.HIDDEN_CLASS_NAME}`)
  })

  it('ensureHiddenStyleは重複してstyle要素を増やさない', () => {
    app.ensureHiddenStyle()
    app.ensureHiddenStyle()
    expect(document.querySelectorAll(`#${CONFIG.HIDDEN_STYLE_ID}`).length).toBe(
      1
    )
  })

  it('filterCellsで非表示クラスを付与/解除する', () => {
    const hiddenCell = document.createElement('div')
    hiddenCell.setAttribute('data-testid', 'cellInnerDiv')
    const visibleCell = document.createElement('div')
    visibleCell.setAttribute('data-testid', 'cellInnerDiv')
    document.body.appendChild(hiddenCell)
    document.body.appendChild(visibleCell)
    app.filterEngine = {
      shouldHide: jest.fn(cell => cell === hiddenCell)
    }

    app.filterCells()

    expect(hiddenCell.classList.contains(CONFIG.HIDDEN_CLASS_NAME)).toBe(true)
    expect(visibleCell.classList.contains(CONFIG.HIDDEN_CLASS_NAME)).toBe(false)
  })

  it('startObserverでMutationObserverを登録し変化時に再評価する', () => {
    const applySpy = jest.spyOn(app, 'applyFilters')

    app.startObserver()

    expect(observerInstance).not.toBeNull()
    expect(observerInstance.observe).toHaveBeenCalled()
    observerInstance.callback()
    expect(applySpy).toHaveBeenCalled()
  })

  it('registerMenuでメニュー登録と各ハンドラ呼び出しを行う', () => {
    app.addHiddenUserIdsFromInput = jest.fn()
    app.addHiddenPostIdsFromInput = jest.fn()
    app.addTextFilterWordsFromInput = jest.fn()
    app.addMediaFilterTargetsFromInput = jest.fn()
    app.promptImportFile = jest.fn()
    app.downloadExport = jest.fn()
    app.configManager = {
      createExportPayload: jest.fn(() => ({
        fileName: 'export.json',
        mimeType: 'application/json',
        content: '{}'
      }))
    }
    window.prompt.mockReturnValue('input-text')

    app.registerMenu()

    expect(GM_registerMenuCommand).toHaveBeenCalledTimes(6)
    GM_registerMenuCommand.mock.calls[0][1]()
    expect(app.addHiddenUserIdsFromInput).toHaveBeenCalledWith('input-text')
    GM_registerMenuCommand.mock.calls[1][1]()
    expect(app.addHiddenPostIdsFromInput).toHaveBeenCalledWith('input-text')
    GM_registerMenuCommand.mock.calls[2][1]()
    expect(app.addTextFilterWordsFromInput).toHaveBeenCalledWith('input-text')
    GM_registerMenuCommand.mock.calls[3][1]()
    expect(app.addMediaFilterTargetsFromInput).toHaveBeenCalledWith(
      'input-text'
    )
    GM_registerMenuCommand.mock.calls[4][1]()
    expect(app.promptImportFile).toHaveBeenCalled()
    GM_registerMenuCommand.mock.calls[5][1]()
    expect(app.configManager.createExportPayload).toHaveBeenCalled()
    expect(app.downloadExport).toHaveBeenCalledWith({
      fileName: 'export.json',
      mimeType: 'application/json',
      content: '{}'
    })
  })

  it('addHiddenUserIdsFromInputで不正IDを検出する', () => {
    const result = app.addHiddenUserIdsFromInput('invalid-id')
    expect(result.message).toContain('invalid-id')
  })

  it('addHiddenUserIdsFromInputで保存と再適用を行う', () => {
    const applySpy = jest
      .spyOn(app, 'applyFilters')
      .mockImplementation(() => {})
    const result = app.addHiddenUserIdsFromInput('valid_user')
    expect(result).toEqual({})
    expect(app.configManager.getIds()).toContain('valid_user')
    expect(applySpy).toHaveBeenCalled()
  })

  it('addHiddenPostIdsFromInputでURLからIDを抽出し保存する', () => {
    const upsertSpy = jest.spyOn(app.configManager, 'upsertHiddenPostId')
    const text =
      'https://x.com/user/status/123/analytics\nhttps://x.com/user/status/456?s=20'

    const result = app.addHiddenPostIdsFromInput(text)

    expect(result).toEqual({})
    expect(upsertSpy).toHaveBeenCalledWith('123')
    expect(upsertSpy).toHaveBeenCalledWith('456')
  })

  it('addTextFilterWordsFromInputで既存語に包含される場合は追加しない', () => {
    app.configManager.saveTextFilterWords(['spam'])
    const result = app.addTextFilterWordsFromInput('spammer')
    expect(result.message).toBeDefined()
    expect(app.configManager.getTextFilterWords()).toEqual(['spam'])
  })

  it('addMediaFilterTargetsFromInputで一覧を保存する', () => {
    const saveSpy = jest.spyOn(app.configManager, 'saveMediaFilterTargets')
    const result = app.addMediaFilterTargetsFromInput('ListA\nListB')
    expect(result).toEqual({})
    expect(saveSpy).toHaveBeenCalled()
    expect(app.configManager.getMediaFilterTargets()).toEqual([
      'ListA',
      'ListB'
    ])
  })

  it('extractPostIdsFromTextで複数のIDを抽出する', () => {
    const ids = app.extractPostIdsFromText(
      'check https://x.com/u/status/1?s=20 and https://x.com/u/status/2'
    )
    expect(ids).toEqual(['1', '2'])
  })

  it('downloadExportでGM_download未定義の場合は警告して終了する', () => {
    const payload = { fileName: 'f', mimeType: 'text/plain', content: '' }
    app.downloadExport({ ...payload, content: '' })
    expect(console.warn).toHaveBeenCalled()
  })

  it('downloadExportでGM_downloadがあれば使用する', () => {
    global.GM_download = jest.fn()
    const payload = {
      fileName: 'f.json',
      mimeType: 'application/json',
      content: '{"a":1}'
    }
    app.downloadExport(payload)
    expect(GM_download).toHaveBeenCalled()
    const args = GM_download.mock.calls[0][0]
    expect(args.name).toBe('f.json')
    expect(args.saveAs).toBe(true)
  })

  it('processImportedTextでJSONエラー時にアラートする', () => {
    app.processImportedText('not-json')
    expect(window.alert).toHaveBeenCalled()
  })

  it('processImportedTextで確認後に保存と再適用を行う', () => {
    app.configManager = {
      parseImportPayload: jest.fn(() => ({
        ids: ['u1'],
        hiddenPosts: [{ id: 'p1', expiresAt: 1 }],
        mediaFilterTargets: ['List'],
        textFilterWords: ['spam'],
        meta: { exportedAt: 'now', version: 2 }
      })),
      save: jest.fn(),
      saveHiddenPosts: jest.fn(),
      saveMediaFilterTargets: jest.fn(),
      saveTextFilterWords: jest.fn()
    }
    const applySpy = jest
      .spyOn(app, 'applyFilters')
      .mockImplementation(() => {})
    window.confirm.mockReturnValue(true)
    app.processImportedText('{}')
    expect(app.configManager.save).toHaveBeenCalledWith(['u1'])
    expect(app.configManager.saveHiddenPosts).toHaveBeenCalledWith([
      { id: 'p1', expiresAt: 1 }
    ])
    expect(app.configManager.saveMediaFilterTargets).toHaveBeenCalledWith([
      'List'
    ])
    expect(app.configManager.saveTextFilterWords).toHaveBeenCalledWith(['spam'])
    expect(window.alert).toHaveBeenCalled()
    expect(applySpy).toHaveBeenCalled()
  })
})
