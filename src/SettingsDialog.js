import { CONFIG } from './config.js'

/**
 * 設定ダイアログの表示と操作を担当するクラス。
 */
export class SettingsDialog {
  constructor ({ configManager, onChange, extractPostIds, downloadExport }) {
    this.configManager = configManager
    this.onChange = typeof onChange === 'function' ? onChange : () => {}
    this.extractPostIds =
      typeof extractPostIds === 'function' ? extractPostIds : () => []
    this.downloadExport =
      typeof downloadExport === 'function' ? downloadExport : null
    this.currentTab = 'users'
    this.elements = {}
  }

  /**
   * ダイアログを表示する。
   */
  open () {
    this.ensureElements()
    this.switchTab(this.currentTab)
    this.elements.overlay.style.display = 'flex'
  }

  /**
   * ダイアログを閉じる。
   */
  close () {
    if (!this.elements.overlay) {
      return
    }
    this.elements.overlay.style.display = 'none'
    this.clearStatus()
  }

  /**
   * DOM要素の生成とイベント登録を行う。
   */
  ensureElements () {
    if (this.elements.overlay) {
      this.renderCurrentTab()
      return
    }

    this.injectStyle()

    const overlay = document.createElement('div')
    overlay.className = 'cxp-overlay'

    const dialog = document.createElement('div')
    dialog.className = 'cxp-dialog'

    const header = document.createElement('div')
    header.className = 'cxp-header'
    header.textContent = 'Custom X Pro'

    const body = document.createElement('div')
    body.className = 'cxp-body'

    const tabs = document.createElement('div')
    tabs.className = 'cxp-tabs'

    const main = document.createElement('div')
    main.className = 'cxp-main'

    const status = document.createElement('div')
    status.className = 'cxp-status'

    const content = document.createElement('div')
    content.className = 'cxp-content'

    const footer = document.createElement('div')
    footer.className = 'cxp-footer'

    const closeButton = document.createElement('button')
    closeButton.className = 'cxp-button cxp-secondary'
    closeButton.textContent = '閉じる'
    closeButton.addEventListener('click', () => this.close())

    footer.appendChild(closeButton)

    const tabList = [
      { key: 'users', label: 'ユーザーID' },
      { key: 'posts', label: 'ポストID' },
      { key: 'keywords', label: 'キーワード' },
      { key: 'settings', label: '設定' }
    ]
    tabList.forEach(tab => {
      const button = document.createElement('button')
      button.className = 'cxp-tab-button'
      button.dataset.tab = tab.key
      button.textContent = tab.label
      button.addEventListener('click', () => this.switchTab(tab.key))
      tabs.appendChild(button)
    })

    main.appendChild(status)
    main.appendChild(content)

    body.appendChild(tabs)
    body.appendChild(main)

    dialog.appendChild(header)
    dialog.appendChild(body)
    dialog.appendChild(footer)

    const toast = document.createElement('div')
    toast.className = 'cxp-toast'

    overlay.appendChild(dialog)
    overlay.appendChild(toast)

    overlay.addEventListener('click', event => {
      if (event.target === overlay) {
        this.close()
      }
    })

    document.body.appendChild(overlay)

    this.elements = {
      overlay,
      dialog,
      tabs,
      content,
      status,
      toast
    }
  }

  /**
   * スタイルを注入する。
   */
  injectStyle () {
    const styleId = 'cxp-dialog-style'
    if (document.getElementById(styleId)) {
      return
    }
    const style = document.createElement('style')
    style.id = styleId
    style.textContent = `
      .cxp-overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.6); display: none; align-items: center; justify-content: center; z-index: 9999; }
      .cxp-dialog { width: 720px; max-width: 92vw; background: #2f2f32; color: #f6f7f9; border-radius: 14px; box-shadow: 0 12px 32px rgba(0,0,0,0.55); overflow: hidden; font-family: 'Segoe UI', Arial, sans-serif; position: relative; }
      .cxp-header { padding: 14px 18px; font-weight: 700; border-bottom: 1px solid rgba(255,255,255,0.08); background: linear-gradient(135deg, #3b3b3e, #2c2c2e); }
      .cxp-body { display: grid; grid-template-columns: 160px 1fr; min-height: 360px; max-height: 520px; }
      .cxp-tabs { background: #3a3a3d; padding: 8px; display: flex; flex-direction: column; gap: 8px; border-right: 1px solid rgba(255,255,255,0.08); }
      .cxp-tab-button { background: #4a4a4d; color: #f6f7f9; border: none; padding: 12px; border-radius: 8px; text-align: left; font-weight: 600; cursor: pointer; transition: background 0.2s ease; }
      .cxp-tab-button:hover { background: #5a5a5d; }
      .cxp-tab-button.active { background: #4a90e2; color: #fff; }
      .cxp-main { padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; overflow: hidden; }
      .cxp-status { min-height: 20px; color: #ff6b6b; font-size: 13px; }
      .cxp-content { background: #242426; border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 12px; display: flex; flex-direction: column; gap: 12px; flex: 1; overflow: hidden; }
      .cxp-section-title { font-weight: 700; margin-bottom: 4px; }
      .cxp-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
      .cxp-input { flex: 1; min-width: 240px; padding: 10px 12px; border-radius: 18px; border: 1px solid rgba(255,255,255,0.15); background: #1e1e20; color: #fff; }
      .cxp-button { padding: 9px 14px; border-radius: 16px; border: none; cursor: pointer; font-weight: 700; }
      .cxp-primary { background: #4a90e2; color: #fff; }
      .cxp-danger { background: #e74c3c; color: #fff; }
      .cxp-secondary { background: #4a4a4d; color: #fff; }
      .cxp-row-between { justify-content: space-between; align-items: center; }
      .cxp-row-start { justify-content: flex-start; align-items: center; gap: 12px; }
      .cxp-row-right { justify-content: flex-end; align-items: center; gap: 8px; flex-wrap: wrap; }
      .cxp-row-tight { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
      .cxp-column { display: flex; flex-direction: column; gap: 8px; }
      .cxp-list { border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 8px; background: #1f1f21; flex: 1; min-height: 160px; max-height: 280px; overflow-y: auto; }
      .cxp-list-item { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 10px; border-bottom: 1px solid rgba(255,255,255,0.05); }
      .cxp-list-item:last-child { border-bottom: none; }
      .cxp-label { color: #d1d5db; word-break: break-all; }
      .cxp-empty { color: #888; padding: 12px; text-align: center; }
      .cxp-footer { padding: 10px 14px; border-top: 1px solid rgba(255,255,255,0.08); display: flex; justify-content: flex-end; background: #2f2f32; }
      .cxp-toast { position: absolute; bottom: 14px; right: 20px; background: rgba(74,144,226,0.95); color: #fff; padding: 10px 14px; border-radius: 12px; opacity: 0; pointer-events: none; transition: opacity 0.2s ease; box-shadow: 0 6px 16px rgba(0,0,0,0.25); }
      .cxp-toast.show { opacity: 1; }
      .cxp-file-label { min-width: 210px; color: #d1d5db; }
      .cxp-file-name { color: #d1d5db; font-size: 13px; min-width: 140px; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .cxp-scroll { overflow-y: auto; }
    `
    document.head.appendChild(style)
  }

  /**
   * タブ切り替えと描画を行う。
   * @param {string} tabKey - 表示対象のタブキー
   */
  switchTab (tabKey) {
    this.currentTab = tabKey
    Array.from(this.elements.tabs.querySelectorAll('.cxp-tab-button')).forEach(
      button => {
        button.classList.toggle('active', button.dataset.tab === tabKey)
      }
    )
    this.renderCurrentTab()
  }

  /**
   * 現在のタブ内容を描画する。
   */
  renderCurrentTab () {
    this.clearStatus()
    switch (this.currentTab) {
      case 'users':
        this.renderUserTab()
        break
      case 'posts':
        this.renderPostTab()
        break
      case 'keywords':
        this.renderKeywordTab()
        break
      case 'settings':
      default:
        this.renderSettingsTab()
        break
    }
  }

  /**
   * エラーとトースト表示をリセットする。
   */
  clearStatus () {
    if (this.elements.status) {
      this.elements.status.textContent = ''
    }
    if (this.elements.toast) {
      this.elements.toast.classList.remove('show')
      this.elements.toast.textContent = ''
    }
  }

  /**
   * エラーを赤字で表示する。
   * @param {string} message - 表示するメッセージ
   */
  showError (message) {
    if (!this.elements.status) return
    this.elements.status.textContent = message || ''
  }

  /**
   * 成功トーストを表示する。
   * @param {string} message - 表示するメッセージ
   */
  showToast (message) {
    if (!this.elements.toast) return
    this.elements.toast.textContent = message
    this.elements.toast.classList.add('show')
    setTimeout(() => this.elements.toast.classList.remove('show'), 1700)
  }

  /**
   * ユーザーIDタブを描画する。
   */
  renderUserTab () {
    const content = this.elements.content
    content.innerHTML = ''

    const headerRow = document.createElement('div')
    headerRow.className = 'cxp-row'
    const title = document.createElement('div')
    title.className = 'cxp-section-title'
    const count = this.configManager.getIds().length
    title.textContent = `ユーザーIDを追加 (${count}件)`

    const input = document.createElement('input')
    input.type = 'text'
    input.placeholder = 'ユーザーIDを入力'
    input.className = 'cxp-input'

    const addButton = document.createElement('button')
    addButton.className = 'cxp-button cxp-secondary'
    addButton.textContent = '追加'
    addButton.addEventListener('click', () => this.handleAddUser(input))
    input.addEventListener('keypress', event => {
      if (event.key === 'Enter') {
        this.handleAddUser(input)
      }
    })

    headerRow.appendChild(title)
    headerRow.appendChild(input)
    headerRow.appendChild(addButton)

    const listContainer = document.createElement('div')
    listContainer.className = 'cxp-list'

    this.renderUserList(listContainer)

    content.appendChild(headerRow)
    content.appendChild(listContainer)

    this.elements.userInput = input
    this.elements.userList = listContainer
  }

  /**
   * ユーザーIDリストを描画する。
   * @param {HTMLElement} container - リスト表示先
   */
  renderUserList (container) {
    container.innerHTML = ''
    const ids = this.configManager.getIds()
    if (!ids.length) {
      const empty = document.createElement('div')
      empty.className = 'cxp-empty'
      empty.textContent = 'データなし'
      container.appendChild(empty)
      return
    }
    ids.forEach(id => {
      const item = document.createElement('div')
      item.className = 'cxp-list-item'
      const label = document.createElement('div')
      label.className = 'cxp-label'
      label.textContent = id
      const remove = document.createElement('button')
      remove.className = 'cxp-button cxp-danger'
      remove.textContent = '削除'
      remove.addEventListener('click', () => this.handleRemoveUser(id))
      item.appendChild(label)
      item.appendChild(remove)
      container.appendChild(item)
    })
  }

  /**
   * ポストIDタブを描画する。
   */
  renderPostTab () {
    const content = this.elements.content
    content.innerHTML = ''

    const headerRow = document.createElement('div')
    headerRow.className = 'cxp-row'
    const title = document.createElement('div')
    title.className = 'cxp-section-title'
    const count = this.configManager.getHiddenPosts().length
    title.textContent = `ポストIDを追加 (${count}件)`

    const input = document.createElement('input')
    input.type = 'text'
    input.placeholder = 'ポストURLまたはIDを入力'
    input.className = 'cxp-input'

    const addButton = document.createElement('button')
    addButton.className = 'cxp-button cxp-primary'
    addButton.textContent = '追加'
    addButton.addEventListener('click', () => this.handleAddPost(input))
    input.addEventListener('keypress', event => {
      if (event.key === 'Enter') {
        this.handleAddPost(input)
      }
    })

    headerRow.appendChild(title)
    headerRow.appendChild(input)
    headerRow.appendChild(addButton)

    const listContainer = document.createElement('div')
    listContainer.className = 'cxp-list'

    this.renderPostList(listContainer)

    content.appendChild(headerRow)
    content.appendChild(listContainer)

    this.elements.postInput = input
    this.elements.postList = listContainer
  }

  /**
   * ポストIDリストを描画する。
   * @param {HTMLElement} container - リスト表示先
   */
  renderPostList (container) {
    container.innerHTML = ''
    const posts = this.configManager.getHiddenPosts()
    if (!posts.length) {
      const empty = document.createElement('div')
      empty.className = 'cxp-empty'
      empty.textContent = 'データなし'
      container.appendChild(empty)
      return
    }
    posts.forEach(entry => {
      const item = document.createElement('div')
      item.className = 'cxp-list-item'
      const label = document.createElement('div')
      label.className = 'cxp-label'
      label.textContent = entry.id
      const remove = document.createElement('button')
      remove.className = 'cxp-button cxp-danger'
      remove.textContent = '削除'
      remove.addEventListener('click', () => this.handleRemovePost(entry.id))
      item.appendChild(label)
      item.appendChild(remove)
      container.appendChild(item)
    })
  }

  /**
   * キーワードタブを描画する。
   */
  renderKeywordTab () {
    const content = this.elements.content
    content.innerHTML = ''

    const headerRow = document.createElement('div')
    headerRow.className = 'cxp-row'
    const title = document.createElement('div')
    title.className = 'cxp-section-title'
    const count = this.configManager.getTextFilterWords().length
    title.textContent = `キーワードを追加 (${count}件)`

    const input = document.createElement('input')
    input.type = 'text'
    input.placeholder = 'NGワードを入力'
    input.className = 'cxp-input'

    const addButton = document.createElement('button')
    addButton.className = 'cxp-button cxp-primary'
    addButton.textContent = '追加'
    addButton.addEventListener('click', () => this.handleAddKeyword(input))
    input.addEventListener('keypress', event => {
      if (event.key === 'Enter') {
        this.handleAddKeyword(input)
      }
    })

    headerRow.appendChild(title)
    headerRow.appendChild(input)
    headerRow.appendChild(addButton)

    const listContainer = document.createElement('div')
    listContainer.className = 'cxp-list'

    this.renderKeywordList(listContainer)

    content.appendChild(headerRow)
    content.appendChild(listContainer)

    this.elements.keywordInput = input
    this.elements.keywordList = listContainer
  }

  /**
   * キーワードリストを描画する。
   * @param {HTMLElement} container - リスト表示先
   */
  renderKeywordList (container) {
    container.innerHTML = ''
    const words = this.configManager.getTextFilterWords()
    if (!words.length) {
      const empty = document.createElement('div')
      empty.className = 'cxp-empty'
      empty.textContent = 'データなし'
      container.appendChild(empty)
      return
    }
    words.forEach(word => {
      const item = document.createElement('div')
      item.className = 'cxp-list-item'
      const label = document.createElement('div')
      label.className = 'cxp-label'
      label.textContent = word
      const remove = document.createElement('button')
      remove.className = 'cxp-button cxp-danger'
      remove.textContent = '削除'
      remove.addEventListener('click', () => this.handleRemoveKeyword(word))
      item.appendChild(label)
      item.appendChild(remove)
      container.appendChild(item)
    })
  }

  /**
   * 設定タブを描画する。
   */
  renderSettingsTab () {
    const content = this.elements.content
    content.innerHTML = ''

    const importSection = document.createElement('div')
    importSection.className = 'cxp-column'
    const importLabel = document.createElement('div')
    importLabel.className = 'cxp-file-label'
    importLabel.textContent = 'ファイルをインポートする'
    const importRow = document.createElement('div')
    importRow.className = 'cxp-row cxp-row-between'
    const importLeft = document.createElement('div')
    importLeft.className = 'cxp-row-tight'
    const importControls = document.createElement('div')
    importControls.className = 'cxp-row-tight'
    const importInput = document.createElement('input')
    importInput.type = 'file'
    importInput.accept = 'application/json'
    importInput.style.display = 'none'
    const importSelect = document.createElement('button')
    importSelect.className = 'cxp-button cxp-secondary'
    importSelect.textContent = 'ファイルを選択'
    const importFileName = document.createElement('div')
    importFileName.className = 'cxp-file-name'
    importFileName.textContent = '未選択'
    importSelect.addEventListener('click', () => importInput.click())
    importInput.addEventListener('change', () => {
      const file = importInput.files && importInput.files[0]
      importFileName.textContent = file ? file.name : '未選択'
    })
    const importButton = document.createElement('button')
    importButton.className = 'cxp-button cxp-secondary'
    importButton.textContent = 'インポート'
    importButton.addEventListener('click', () => this.handleImport(importInput))

    importControls.appendChild(importSelect)
    importControls.appendChild(importFileName)
    importControls.appendChild(importInput)
    importLeft.appendChild(importControls)

    const importRight = document.createElement('div')
    importRight.className = 'cxp-row-right'
    importRight.appendChild(importButton)

    importRow.appendChild(importLeft)
    importRow.appendChild(importRight)
    importSection.appendChild(importLabel)
    importSection.appendChild(importRow)

    const exportRow = document.createElement('div')
    exportRow.className = 'cxp-row cxp-row-between'
    const exportLabel = document.createElement('div')
    exportLabel.className = 'cxp-file-label'
    exportLabel.textContent = 'エクスポート'
    const exportButton = document.createElement('button')
    exportButton.className = 'cxp-button cxp-secondary'
    exportButton.textContent = 'エクスポート'
    exportButton.addEventListener('click', () => this.handleExport())

    exportRow.appendChild(exportLabel)
    exportRow.appendChild(exportButton)

    content.appendChild(importSection)
    content.appendChild(exportRow)

    this.elements.importInput = importInput
  }

  /**
   * ユーザーIDを追加する。
   * @param {HTMLInputElement} input - 入力欄
   */
  handleAddUser (input) {
    this.clearStatus()
    const value = (input.value || '').trim()
    if (!value) {
      this.showError('ユーザーIDを入力してください')
      return
    }
    if (!this.configManager.isValidUserId(value)) {
      this.showError('ユーザーIDは英数字とアンダースコアのみ利用できます')
      return
    }
    const current = this.configManager.getIds()
    if (current.includes(value)) {
      this.showError('既に追加済みのユーザーIDです')
      return
    }
    this.configManager.save([...current, value], [value])
    input.value = ''
    this.renderUserList(this.elements.userList)
    this.showToast('ユーザーIDを追加しました')
    this.onChange()
  }

  /**
   * ユーザーIDを削除する。
   * @param {string} id - 削除対象ID
   */
  handleRemoveUser (id) {
    this.clearStatus()
    this.configManager.removeHiddenUserId(id)
    this.renderUserList(this.elements.userList)
    this.showToast('削除しました')
    this.onChange()
  }

  /**
   * ポストIDを追加する。
   * @param {HTMLInputElement} input - 入力欄
   */
  handleAddPost (input) {
    this.clearStatus()
    const value = (input.value || '').trim()
    if (!value) {
      this.showError('ポストIDまたはURLを入力してください')
      return
    }
    const extracted = this.extractPostIds(value) || []
    const candidates = extracted.length ? extracted : [value]
    const normalized = []
    candidates.forEach(id => {
      const trimmed = (id || '').trim()
      if (!trimmed) return
      if (!normalized.includes(trimmed)) {
        normalized.push(trimmed)
      }
    })
    if (!normalized.length) {
      this.showError('ポストIDを抽出できませんでした')
      return
    }
    normalized.forEach(id => this.configManager.upsertHiddenPostId(id))
    input.value = ''
    this.renderPostList(this.elements.postList)
    this.showToast('ポストIDを追加しました')
    this.onChange()
  }

  /**
   * ポストIDを削除する。
   * @param {string} postId - 削除対象ID
   */
  handleRemovePost (postId) {
    this.clearStatus()
    this.configManager.removeHiddenPostId(postId)
    this.renderPostList(this.elements.postList)
    this.showToast('削除しました')
    this.onChange()
  }

  /**
   * キーワードを追加する。
   * @param {HTMLInputElement} input - 入力欄
   */
  handleAddKeyword (input) {
    this.clearStatus()
    const value = (input.value || '').trim().toLowerCase()
    if (!value) {
      this.showError('キーワードを入力してください')
      return
    }
    const current = this.configManager.getTextFilterWords()
    if (current.includes(value)) {
      this.showError('既に追加済みのキーワードです')
      return
    }
    this.configManager.saveTextFilterWords([...current, value], [value])
    input.value = ''
    this.renderKeywordList(this.elements.keywordList)
    this.showToast('キーワードを追加しました')
    this.onChange()
  }

  /**
   * キーワードを削除する。
   * @param {string} word - 削除対象
   */
  handleRemoveKeyword (word) {
    this.clearStatus()
    this.configManager.removeTextFilterWord(word)
    this.renderKeywordList(this.elements.keywordList)
    this.showToast('削除しました')
    this.onChange()
  }

  /**
   * インポート処理。
   * @param {HTMLInputElement} input - ファイル入力
   */
  async handleImport (input) {
    this.clearStatus()
    const file = input?.files?.[0]
    if (!file) {
      this.showError('インポートするファイルを選択してください')
      return
    }
    let text = ''
    try {
      text = await file.text()
    } catch (error) {
      this.showError('ファイルの読み込みに失敗しました')
      return
    }

    let parsed = null
    try {
      parsed = this.configManager.parseImportPayload(text)
    } catch (error) {
      this.showError(error?.message || 'インポートに失敗しました')
      return
    }

    const now = Date.now()
    const filteredPosts = parsed.hiddenPosts.filter(
      entry => !this.configManager.isExpired(entry, now)
    )

    this.configManager.save(parsed.ids)
    this.configManager.saveHiddenPosts(filteredPosts)
    this.configManager.saveMediaFilterTargets(parsed.mediaFilterTargets)
    this.configManager.saveTextFilterWords(parsed.textFilterWords)

    if (input) {
      input.value = ''
    }

    this.renderCurrentTab()
    this.showToast('インポートが完了しました')
    this.onChange()
  }

  /**
   * エクスポート処理。
   */
  handleExport () {
    this.clearStatus()
    const payload = this.configManager.createExportPayload()
    if (!payload?.content) {
      this.showError('エクスポートに失敗しました')
      return
    }
    if (this.downloadExport) {
      this.downloadExport(payload)
    } else {
      const blob = new Blob([payload.content], {
        type: `${payload.mimeType};charset=utf-8`
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = payload.fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    }
    this.showToast('エクスポートを開始しました')
  }
}
