import { CONFIG } from './config.js'
import { ConfigManager } from './ConfigManager.js'
import { FilterEngine } from './FilterEngine.js'
import { ColumnMediaFilter } from './ColumnMediaFilter.js'

/**
 * アプリケーション全体を管理するオーケストレーションクラス
 */
export class App {
  constructor () {
    this.configManager = new ConfigManager()
    this.filterEngine = new FilterEngine(this.configManager)
    this.columnMediaFilter = new ColumnMediaFilter(this.configManager)
    this.observer = null
  }

  /**
   * アプリケーションを初期化する
   */
  init () {
    this.ensureHiddenStyle()
    this.configManager.purgeExpiredHiddenPosts()
    this.registerMenu()
    this.startObserver()
    this.applyFilters()
  }

  /**
   * Tampermonkeyメニューに操作項目を登録する
   */
  registerMenu () {
    GM_registerMenuCommand('👤 ユーザーIDを追加して非表示', () => {
      const input = window.prompt(
        '非表示にするユーザーIDを入力（改行区切り）してください',
        ''
      )
      if (input === null) {
        return
      }
      const result = this.addHiddenUserIdsFromInput(input)
      if (result?.message) {
        window.alert(result.message)
      }
    })

    GM_registerMenuCommand('🔗 ポストURLを追加して非表示', () => {
      const input = window.prompt(
        '非表示にするポストURLを入力してください。例: https://x.com/example_user/status/1234567890123456789?s=20',
        ''
      )
      if (input === null) {
        return
      }
      const result = this.addHiddenPostIdsFromInput(input)
      if (result?.message) {
        window.alert(result.message)
      }
    })

    GM_registerMenuCommand('📝 NGワードを追加して非表示', () => {
      const input = window.prompt(
        '非表示にしたいNGワードを入力してください（改行区切り、大小区別なし）',
        ''
      )
      if (input === null) {
        return
      }
      const result = this.addTextFilterWordsFromInput(input)
      if (result?.message) {
        window.alert(result.message)
      }
    })

    GM_registerMenuCommand('🖼️ メディアのみカラム対象リストを追加', () => {
      const input = window.prompt(
        'メディアのみカラムで対象とするリスト名を入力してください（改行区切り）',
        ''
      )
      if (input === null) {
        return
      }
      const result = this.addMediaFilterTargetsFromInput(input)
      if (result?.message) {
        window.alert(result.message)
      }
    })

    GM_registerMenuCommand('📥 非表示リストをインポート', () => {
      this.promptImportFile()
    })

    GM_registerMenuCommand('📤 非表示リストをエクスポート', () => {
      const payload = this.configManager.createExportPayload()
      this.downloadExport(payload)
    })
  }

  /**
   * ユーザーID追加メニューの入力を処理する
   * @param {string} inputText - プロンプトで入力された文字列
   * @returns {{ message?: string }} アラート表示用メッセージ
   */
  addHiddenUserIdsFromInput (inputText) {
    const rawIds = (inputText || '').split(/\r?\n/)
    const validCandidates = []
    const invalidIds = []
    rawIds.forEach(id => {
      const trimmed = (id || '').trim()
      if (!trimmed) {
        return
      }
      if (!this.configManager.isValidUserId(trimmed)) {
        invalidIds.push(trimmed)
        return
      }
      validCandidates.push(trimmed)
    })
    if (invalidIds.length) {
      return {
        message: `ユーザーIDは半角英数字とアンダースコアのみ使用できます。\n無効: ${invalidIds.join(
          ', '
        )}`
      }
    }
    const additions = this.configManager.sanitizeUserIds(validCandidates)
    if (!additions.length) {
      return { message: '追加できるIDがありません' }
    }
    const currentIds = this.configManager.getIds()
    const uniqueAdditions = additions.filter(id => !currentIds.includes(id))
    if (!uniqueAdditions.length) {
      return { message: '新しく追加できるユーザーIDがありません' }
    }
    this.configManager.save([...currentIds, ...uniqueAdditions])
    this.applyFilters()
    return {}
  }

  /**
   * ポストURL追加メニューの入力を処理する
   * @param {string} inputText - プロンプトで入力された文字列
   * @returns {{ message?: string }} アラート表示用メッセージ
   */
  addHiddenPostIdsFromInput (inputText) {
    const postIds = this.extractPostIdsFromText(inputText)
    if (!postIds.length) {
      return { message: 'ポストURLからIDを抽出できませんでした' }
    }
    postIds.forEach(id => this.configManager.upsertHiddenPostId(id))
    this.applyFilters()
    return {}
  }

  /**
   * メディア専用カラム対象リスト入力を処理する
   * @param {string} inputText - プロンプトで入力された文字列
   * @returns {{ message?: string }} アラート表示用メッセージ
   */
  addMediaFilterTargetsFromInput (inputText) {
    const additions = this.configManager.sanitizeIds(
      (inputText || '').split(/\r?\n/)
    )
    if (!additions.length) {
      return { message: '追加できるリスト名がありません' }
    }
    const updated = [
      ...this.configManager.getMediaFilterTargets(),
      ...additions
    ]
    this.configManager.saveMediaFilterTargets(updated)
    this.applyFilters()
    return {}
  }

  /**
   * NGワード追加メニューの入力を処理する
   * @param {string} inputText - プロンプトで入力された文字列
   * @returns {{ message?: string }} アラート表示用メッセージ
   */
  addTextFilterWordsFromInput (inputText) {
    const additions = this.configManager.sanitizeWords(
      (inputText || '').split(/\r?\n/)
    )
    if (!additions.length) {
      return { message: '追加できるNGワードがありません' }
    }
    const currentWords = this.configManager.getTextFilterWords()
    const filteredAdditions = []
    additions.forEach(word => {
      const isCovered =
        currentWords.some(existing => word.includes(existing)) ||
        filteredAdditions.some(existing => word.includes(existing))
      if (!isCovered) {
        filteredAdditions.push(word)
      }
    })
    if (!filteredAdditions.length) {
      return { message: '追加できるNGワードがありません' }
    }
    filteredAdditions.forEach(word => {
      console.log('追加したNGワード:', word)
    })
    const updated = [...currentWords, ...filteredAdditions]
    this.configManager.saveTextFilterWords(updated)
    this.applyFilters()
    return {}
  }

  /**
   * 非表示用のスタイルを注入する
   */
  ensureHiddenStyle () {
    if (document.getElementById(CONFIG.HIDDEN_STYLE_ID)) {
      return
    }
    const style = document.createElement('style')
    style.id = CONFIG.HIDDEN_STYLE_ID
    const hiddenSelectors = [
      CONFIG.HIDDEN_CLASS_NAME,
      CONFIG.MEDIA_FILTER.HIDDEN_CLASS_NAME
    ]
      .filter(Boolean)
      .map(className => `.${className}`)
      .join(', ')
    style.textContent = `${hiddenSelectors} { display: none !important; }`
    document.head.appendChild(style)
  }

  /**
   * 画面上のセルにフィルターを適用する
   */
  applyFilters () {
    this.filterCells()
    this.columnMediaFilter.filter()
  }

  /**
   * タイムライン上のセルへ非表示判定を適用する
   */
  filterCells () {
    const cells = Array.from(document.querySelectorAll(CONFIG.SELECTORS.CELL))
    cells.forEach(cell => {
      const shouldHide = this.filterEngine.shouldHide(cell)
      cell.classList.toggle(CONFIG.HIDDEN_CLASS_NAME, shouldHide)
    })
  }

  /**
   * DOM変更を監視し再フィルタリングする
   */
  startObserver () {
    const target = this.getObserverTarget()
    if (!target) {
      console.warn('MutationObserver監視対象が見つかりませんでした')
      return
    }
    const targetLabel =
      target === document.body
        ? 'document.body'
        : `${target.tagName || 'UNKNOWN'}#${target.id || ''}.${target.className || ''}`
    console.log('MutationObserver監視対象:', targetLabel)
    this.observer = new MutationObserver(() => this.applyFilters())
    this.observer.observe(target, {
      childList: true,
      subtree: true,
      attributes: false
    })
  }

  /**
   * 監視対象ノードをカラム領域に絞り、不要な属性変化の監視を避ける
   * @returns {HTMLElement|null} 監視対象ノード
   */
  getObserverTarget () {
    const column = document.querySelector(CONFIG.MEDIA_FILTER.COLUMN_SELECTOR)
    if (column?.parentElement) {
      return column.parentElement
    }
    return document.body || null
  }

  /**
   * エクスポートファイルをダウンロードする
   * @param {{ fileName: string, mimeType: string, content: string }} payload - ダウンロードデータ
   */
  downloadExport (payload) {
    const canUseGmDownload = typeof GM_download === 'function'

    if (!canUseGmDownload) {
      console.warn('GM_downloadが未定義のため、エクスポートを中止します')
      return
    }

    if (!payload || !payload.content) {
      console.warn('エクスポートデータが空です')
      return
    }

    const dataUrl = `data:${
      payload.mimeType
    };charset=utf-8,${encodeURIComponent(payload.content)}`

    try {
      GM_download({
        url: dataUrl,
        name: payload.fileName,
        saveAs: true
      })
      return
    } catch (error) {
      console.warn('GM_downloadでのエクスポートに失敗したためフォールバックします', error)
    }

    const blob = new Blob([payload.content], {
      type: `${payload.mimeType};charset=utf-8`
    })
    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = payload.fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(objectUrl)
  }

  /**
   * ファイル選択ダイアログを開く
   */
  promptImportFile () {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json'

    const handleChange = () => {
      const file = input.files && input.files[0]
      input.removeEventListener('change', handleChange)
      if (!file) {
        return
      }
      this.readImportFile(file)
    }

    input.addEventListener('change', handleChange, { once: true })
    input.click()
  }

  /**
   * インポートするファイルを読み込む
   * @param {File} file - 取り込むファイル
   */
  readImportFile (file) {
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      this.processImportedText(result)
    }
    reader.onerror = () => {
      window.alert('ファイルの読み込みに失敗しました')
    }
    reader.readAsText(file, 'utf-8')
  }

  /**
   * インポートテキストをパースする
   * @param {string} text - 取り込みJSON文字列
   */
  processImportedText (text) {
    let parsed = null
    try {
      parsed = this.configManager.parseImportPayload(text)
    } catch (error) {
      window.alert(error?.message || 'JSONの読み込みに失敗しました')
      return
    }

    const confirmMessage = `非表示リストを上書きしますか？\nエクスポート日時: ${parsed.meta.exportedAt}\nユーザーID: ${parsed.ids.length}件\nポストID: ${parsed.hiddenPosts.length}件\nメディアなし対象リスト: ${parsed.mediaFilterTargets.length}件\nNGワード: ${parsed.textFilterWords.length}件`
    const shouldOverwrite = window.confirm(confirmMessage)
    if (!shouldOverwrite) {
      return
    }

    this.configManager.save(parsed.ids)
    this.configManager.saveHiddenPosts(parsed.hiddenPosts)
    this.configManager.saveMediaFilterTargets(parsed.mediaFilterTargets)
    this.configManager.saveTextFilterWords(parsed.textFilterWords)
    window.alert('非表示リストをインポートしました')
    this.applyFilters()
  }

  /**
   * テキストからポストIDを抽出する
   * @param {string} text - URLを含むテキスト
   * @returns {string[]} 抽出したポストID配列
   */
  extractPostIdsFromText (text) {
    if (typeof text !== 'string') {
      return []
    }
    const ids = []
    const regex = /\/status\/(\d+)/g
    let match = regex.exec(text)
    while (match) {
      ids.push(match[1])
      match = regex.exec(text)
    }
    return this.configManager.sanitizeIds(ids)
  }
}
