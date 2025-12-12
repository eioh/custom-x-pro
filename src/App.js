import { CONFIG } from "./config.js"
import { ConfigManager } from "./ConfigManager.js"
import { FilterEngine } from "./FilterEngine.js"
import { ColumnMediaFilter } from "./ColumnMediaFilter.js"

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
        GM_registerMenuCommand('ユーザーIDを追加して非表示', () => {
            const input = window.prompt(
                '非表示にするユーザーIDを入力（改行区切り）してください',
                ''
            )
            if (input === null) {
                return
            }
            const rawIds = input.split(/\r?\n/)
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
                window.alert(
                    `ユーザーIDは半角英数字とアンダースコアのみ使用できます。\n無効: ${invalidIds.join(', ')}`
                )
                return
            }
            const additions = this.configManager.sanitizeUserIds(validCandidates)
            if (!additions.length) {
                window.alert('追加できるIDがありません')
                return
            }
            this.configManager.save([...this.configManager.getIds(), ...additions])
            this.applyFilters()
        })

        GM_registerMenuCommand('ポストURLを追加して非表示', () => {
            const input = window.prompt(
                '非表示にするポストURLを入力してください。例: https://x.com/example_user/status/1234567890123456789?s=20',
                ''
            )
            if (input === null) {
                return
            }
            const postIds = this.extractPostIdsFromText(input)
            if (!postIds.length) {
                window.alert('ポストURLからIDを抽出できませんでした')
                return
            }
            postIds.forEach(id => this.configManager.upsertHiddenPostId(id))
            this.applyFilters()
        })

        GM_registerMenuCommand('非表示リストをエクスポート', () => {
            const payload = this.configManager.createExportPayload()
            this.downloadExport(payload)
        })

        GM_registerMenuCommand('非表示リストをインポート', () => {
            this.promptImportFile()
        })

        GM_registerMenuCommand('メディアのみカラム対象リストを追加', () => {
            this.promptAddMediaFilterList()
        })

        GM_registerMenuCommand('NGワードを追加して非表示', () => {
            this.promptAddTextFilterWords()
        })
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
        const cells = Array.from(
            document.querySelectorAll(CONFIG.SELECTORS.CELL)
        )
        cells.forEach(cell => {
            const shouldHide = this.filterEngine.shouldHide(cell)
            cell.classList.toggle(CONFIG.HIDDEN_CLASS_NAME, shouldHide)
        })
    }

    /**
     * DOM変更を監視し再フィルタリングする
     */
    startObserver () {
        this.observer = new MutationObserver(() => this.applyFilters())
        this.observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true
        })
    }

    /**
     * エクスポートファイルをダウンロードする
     * @param {{ fileName: string, mimeType: string, content: string }} payload - ダウンロードデータ
     */
    downloadExport (payload) {
        if (!payload || !payload.content) {
            console.warn('エクスポートデータが空です')
            return
        }

        const dataUrl = `data:${payload.mimeType};charset=utf-8,${encodeURIComponent(payload.content)}`
        const canUseGmDownload = typeof GM_download === 'function'

        if (canUseGmDownload) {
            try {
                GM_download({
                    url: dataUrl,
                    name: payload.fileName,
                    saveAs: true
                })
                return
            } catch (error) {
                console.error('GM_downloadでのエクスポートに失敗しました', error)
            }
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
     * メディア専用カラム対象リスト名を追加する
     */
    promptAddMediaFilterList () {
        const input = window.prompt(
            'メディアのみカラムで対象とするリスト名を入力してください（改行区切り）',
            ''
        )
        if (input === null) {
            return
        }
        const additions = this.configManager.sanitizeIds(input.split(/\r?\n/))
        if (!additions.length) {
            window.alert('追加できるリスト名がありません')
            return
        }
        const updated = [
            ...this.configManager.getMediaFilterTargets(),
            ...additions
        ]
        this.configManager.saveMediaFilterTargets(updated)
        window.alert('メディア対象リストを更新しました')
        this.applyFilters()
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

    /**
     * NGワードを追加する
     */
    promptAddTextFilterWords () {
        const input = window.prompt(
            '非表示にしたいNGワードを入力してください（改行区切り、大小区別なし）',
            ''
        )
        if (input === null) {
            return
        }
        const additions = this.configManager.sanitizeWords(input.split(/\r?\n/))
        if (!additions.length) {
            window.alert('追加できるNGワードがありません')
            return
        }
        const updated = [
            ...this.configManager.getTextFilterWords(),
            ...additions
        ]
        this.configManager.saveTextFilterWords(updated)
        window.alert('NGワードを更新しました')
        this.applyFilters()
    }
}
