import dialogHtml from './templates/settings-dialog.html'
import dialogCss from './styles/settings-dialog.css'

/**
 * 設定ダイアログの表示と操作を管理するクラス。
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
   * ダイアログを開く。
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
   * テンプレートを展開し、DOM参照とイベントをセットする。
   */
  ensureElements () {
    if (this.elements.overlay) {
      this.updateActiveTabState()
      return
    }

    this.injectStyle()

    const template = document.createElement('template')
    template.innerHTML = dialogHtml
    const fragment = template.content.cloneNode(true)

    const overlay = fragment.querySelector('.cxp-overlay')
    const dialog = overlay.querySelector('.cxp-dialog')
    const tabs = overlay.querySelector('.cxp-tabs')
    const status = overlay.querySelector('[data-role="status"]')
    const content = overlay.querySelector('.cxp-content')
    const toast = overlay.querySelector('[data-role="toast"]')
    const closeButton = overlay.querySelector('[data-role="close"]')

    this.elements = {
      overlay,
      dialog,
      tabs,
      status,
      content,
      toast,
      closeButton,
      tabButtons: Array.from(tabs.querySelectorAll('.cxp-tab-button')),
      panels: {
        users: overlay.querySelector('[data-panel="users"]'),
        posts: overlay.querySelector('[data-panel="posts"]'),
        keywords: overlay.querySelector('[data-panel="keywords"]'),
        settings: overlay.querySelector('[data-panel="settings"]')
      },
      userTitle: overlay.querySelector('[data-role="user-title"]'),
      userInput: overlay.querySelector('[data-role="user-input"]'),
      userAddButton: overlay.querySelector('[data-role="user-add"]'),
      userList: overlay.querySelector('[data-role="user-list"]'),
      postTitle: overlay.querySelector('[data-role="post-title"]'),
      postInput: overlay.querySelector('[data-role="post-input"]'),
      postAddButton: overlay.querySelector('[data-role="post-add"]'),
      postList: overlay.querySelector('[data-role="post-list"]'),
      keywordTitle: overlay.querySelector('[data-role="keyword-title"]'),
      keywordInput: overlay.querySelector('[data-role="keyword-input"]'),
      keywordAddButton: overlay.querySelector('[data-role="keyword-add"]'),
      keywordList: overlay.querySelector('[data-role="keyword-list"]'),
      importInput: overlay.querySelector('[data-role="import-input"]'),
      importSelect: overlay.querySelector('[data-role="import-select"]'),
      importFileName: overlay.querySelector('[data-role="import-file-name"]'),
      importButton: overlay.querySelector('[data-role="import-button"]'),
      exportButton: overlay.querySelector('[data-role="export-button"]')
    }

    this.elements.tabButtons.forEach(button => {
      button.addEventListener('click', () => this.switchTab(button.dataset.tab))
    })
    closeButton.addEventListener('click', () => this.close())
    overlay.addEventListener('click', event => {
      if (event.target === overlay) {
        this.close()
      }
    })

    this.elements.userAddButton.addEventListener('click', () =>
      this.handleAddUser(this.elements.userInput)
    )
    this.elements.userInput.addEventListener('keypress', event => {
      if (event.key === 'Enter') {
        this.handleAddUser(this.elements.userInput)
      }
    })

    this.elements.postAddButton.addEventListener('click', () =>
      this.handleAddPost(this.elements.postInput)
    )
    this.elements.postInput.addEventListener('keypress', event => {
      if (event.key === 'Enter') {
        this.handleAddPost(this.elements.postInput)
      }
    })

    this.elements.keywordAddButton.addEventListener('click', () =>
      this.handleAddKeyword(this.elements.keywordInput)
    )
    this.elements.keywordInput.addEventListener('keypress', event => {
      if (event.key === 'Enter') {
        this.handleAddKeyword(this.elements.keywordInput)
      }
    })

    this.elements.importSelect.addEventListener('click', () =>
      this.elements.importInput.click()
    )
    this.elements.importInput.addEventListener('change', () => {
      const file = this.elements.importInput.files?.[0]
      this.elements.importFileName.textContent = file ? file.name : '未選択'
    })
    this.elements.importButton.addEventListener('click', () =>
      this.handleImport(this.elements.importInput)
    )
    this.elements.exportButton.addEventListener('click', () =>
      this.handleExport()
    )

    document.body.appendChild(overlay)
  }

  /**
   * ダイアログ用のスタイルを注入する。
   */
  injectStyle () {
    const styleId = 'cxp-dialog-style'
    if (document.getElementById(styleId)) {
      return
    }
    const style = document.createElement('style')
    style.id = styleId
    style.textContent = dialogCss
    document.head.appendChild(style)
  }

  /**
   * アクティブなタブを切り替える。
   * @param {string} tabKey - 切り替え先のタブキー
   */
  switchTab (tabKey) {
    this.currentTab = tabKey
    this.renderCurrentTab()
  }

  /**
   * タブボタンとパネルの選択状態を反映する。
   */
  updateActiveTabState () {
    if (!this.elements.tabButtons) return
    this.elements.tabButtons.forEach(button => {
      button.classList.toggle('active', button.dataset.tab === this.currentTab)
    })
    if (this.elements.panels) {
      Object.entries(this.elements.panels).forEach(([key, panel]) => {
        if (panel) {
          panel.classList.toggle('active', key === this.currentTab)
        }
      })
    }
  }

  /**
   * 現在のタブを描画する。
   */
  renderCurrentTab () {
    this.clearStatus()
    this.updateActiveTabState()
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
   * ステータスとトーストをクリアする。
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
   * エラーを表示する。
   * @param {string} message - 表示するメッセージ
   */
  showError (message) {
    if (!this.elements.status) return
    this.elements.status.textContent = message || ''
  }

  /**
   * トーストを表示する。
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
    const count = this.configManager.getIds().length
    if (this.elements.userTitle) {
      this.elements.userTitle.textContent = `ユーザーIDの管理 (${count}件)`
    }
    this.renderUserList(this.elements.userList)
  }

  /**
   * ユーザーIDリストを描画する。
   * @param {HTMLElement} container - 描画先の要素
   */
  renderUserList (container) {
    if (!container) return
    container.innerHTML = ''
    const ids = this.configManager.getIds()
    if (!ids.length) {
      const empty = document.createElement('div')
      empty.className = 'cxp-empty'
      empty.textContent = 'まだ追加されていません'
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
    const count = this.configManager.getHiddenPosts().length
    if (this.elements.postTitle) {
      this.elements.postTitle.textContent = `ポストIDの管理 (${count}件)`
    }
    this.renderPostList(this.elements.postList)
  }

  /**
   * ポストIDリストを描画する。
   * @param {HTMLElement} container - 描画先の要素
   */
  renderPostList (container) {
    if (!container) return
    container.innerHTML = ''
    const posts = this.configManager.getHiddenPosts()
    if (!posts.length) {
      const empty = document.createElement('div')
      empty.className = 'cxp-empty'
      empty.textContent = 'まだ追加されていません'
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
   * NGワードタブを描画する。
   */
  renderKeywordTab () {
    const count = this.configManager.getTextFilterWords().length
    if (this.elements.keywordTitle) {
      this.elements.keywordTitle.textContent = `NGワードの管理 (${count}件)`
    }
    this.renderKeywordList(this.elements.keywordList)
  }

  /**
   * NGワードリストを描画する。
   * @param {HTMLElement} container - 描画先の要素
   */
  renderKeywordList (container) {
    if (!container) return
    container.innerHTML = ''
    const words = this.configManager.getTextFilterWords()
    if (!words.length) {
      const empty = document.createElement('div')
      empty.className = 'cxp-empty'
      empty.textContent = 'まだ追加されていません'
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
    if (this.elements.importInput) {
      this.elements.importInput.value = ''
    }
    if (this.elements.importFileName) {
      this.elements.importFileName.textContent = '未選択'
    }
  }

  /**
   * ユーザーIDを追加する。
   * @param {HTMLInputElement} input - 入力要素
   */
  handleAddUser (input) {
    this.clearStatus()
    const value = (input?.value || '').trim()
    if (!value) {
      this.showError('ユーザーIDを入力してください')
      return
    }
    if (!this.configManager.isValidUserId(value)) {
      this.showError(
        'ユーザーIDは半角英数字とアンダースコアのみで入力してください'
      )
      return
    }
    const current = this.configManager.getIds()
    if (current.includes(value)) {
      this.showError('同じユーザーIDがすでに追加されています')
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
   * @param {string} id - 削除するID
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
   * @param {HTMLInputElement} input - 入力要素
   */
  handleAddPost (input) {
    this.clearStatus()
    const value = (input?.value || '').trim()
    if (!value) {
      this.showError('ポストのURLまたはIDを入力してください')
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
   * @param {string} postId - 削除するポストID
   */
  handleRemovePost (postId) {
    this.clearStatus()
    this.configManager.removeHiddenPostId(postId)
    this.renderPostList(this.elements.postList)
    this.showToast('削除しました')
    this.onChange()
  }

  /**
   * NGワードを追加する。
   * @param {HTMLInputElement} input - 入力要素
   */
  handleAddKeyword (input) {
    this.clearStatus()
    const value = (input?.value || '').trim().toLowerCase()
    if (!value) {
      this.showError('NGワードを入力してください')
      return
    }
    const current = this.configManager.getTextFilterWords()
    if (current.includes(value)) {
      this.showError('同じNGワードがすでに追加されています')
      return
    }
    this.configManager.saveTextFilterWords([...current, value], [value])
    input.value = ''
    this.renderKeywordList(this.elements.keywordList)
    this.showToast('NGワードを追加しました')
    this.onChange()
  }

  /**
   * NGワードを削除する。
   * @param {string} word - 削除するNGワード
   */
  handleRemoveKeyword (word) {
    this.clearStatus()
    this.configManager.removeTextFilterWord(word)
    this.renderKeywordList(this.elements.keywordList)
    this.showToast('削除しました')
    this.onChange()
  }

  /**
   * 設定をインポートする。
   * @param {HTMLInputElement} input - ファイル入力要素
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
    if (this.elements.importFileName) {
      this.elements.importFileName.textContent = '未選択'
    }

    this.renderCurrentTab()
    this.showToast('インポートが完了しました')
    this.onChange()
  }

  /**
   * 設定をエクスポートする。
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
    this.showToast('エクスポートが完了しました')
  }
}
