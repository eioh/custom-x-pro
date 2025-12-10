import { CONFIG } from './config.js';
import { ConfigManager } from './ConfigManager.js';
import { FilterEngine } from './FilterEngine.js';
import { ColumnMediaFilter } from './ColumnMediaFilter.js';

/**
 * 全体のライフサイクルを管理するアプリケーションクラス
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
     * Tampermonkeyメニューを登録する
     */
    registerMenu () {
        GM_registerMenuCommand('ユーザーIDを追加して非表示', () => {
            const input = window.prompt(
                '非表示にしたいユーザーIDを1行ずつ入力してください',
                ''
            )
            if (input === null) {
                return
            }
            const additions = this.configManager.sanitizeIds(input.split(/\r?\n/))
            if (!additions.length) {
                window.alert('追加するIDがありません')
                return
            }
            this.configManager.save([...this.configManager.getIds(), ...additions])
            this.applyFilters()
        })

        GM_registerMenuCommand('ポストURLを追加して非表示', () => {
            const input = window.prompt(
                '非表示にしたいポストのURLを1行ずつ入力してください（例: https://x.com/example_user/status/1234567890123456789?s=20）',
                ''
            )
            if (input === null) {
                return
            }
            const postIds = this.extractPostIdsFromText(input)
            if (!postIds.length) {
                window.alert('ポストURLからIDを取得できませんでした')
                return
            }
            postIds.forEach(id => this.configManager.upsertHiddenPostId(id))
            this.applyFilters()
        })

        GM_registerMenuCommand('非表示リストを書き出し', () => {
            const payload = this.configManager.createExportPayload()
            this.downloadExport(payload)
        })

        GM_registerMenuCommand('非表示リストを読み込み', () => {
            this.promptImportFile()
        })

        GM_registerMenuCommand('メディアなしフィルタ対象リストを追加', () => {
            this.promptAddMediaFilterList()
        })
    }

    /**
     * 非表示用CSSを挿入する
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
     * 登録済みフィルタを適用する
     */
    applyFilters () {
        this.filterCells()
        this.columnMediaFilter.filter()
    }

    /**
     * タイムラインのセルにフィルタを適用する
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
     * MutationObserverでDOM変化を監視する
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
     * エクスポート用JSONペイロードをダウンロードする
     * @param {{ fileName: string, mimeType: string, content: string }} payload - ダウンロード対象
     */
    downloadExport (payload) {
        if (!payload || !payload.content) {
            console.warn('エクスポートペイロードが空です')
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
     * インポート用ファイル選択ダイアログを表示する
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
     * メディアなしフィルタ対象リストを追加する
     */
    promptAddMediaFilterList () {
        const input = window.prompt(
            'メディアなしフィルタ対象に追加したいリスト名を1行ずつ入力してください',
            ''
        )
        if (input === null) {
            return
        }
        const additions = this.configManager.sanitizeIds(input.split(/\r?\n/))
        if (!additions.length) {
            window.alert('追加するリスト名がありません')
            return
        }
        const updated = [
            ...this.configManager.getMediaFilterTargets(),
            ...additions
        ]
        this.configManager.saveMediaFilterTargets(updated)
        window.alert('メディアなしフィルタ対象リストを更新しました')
        this.applyFilters()
    }

    /**
     * インポート用ファイルを読み取る
     * @param {File} file - 選択されたファイル
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
     * インポートされたJSONテキストを処理する
     * @param {string} text - インポートされたJSON文字列
     */
    processImportedText (text) {
        let parsed = null
        try {
            parsed = this.configManager.parseImportPayload(text)
        } catch (error) {
            window.alert(error?.message || 'JSONの読み込みに失敗しました')
            return
        }

        const confirmMessage = `非表示リストを上書きしますか？\nエクスポート日時: ${parsed.meta.exportedAt}\nユーザーID: ${parsed.ids.length}件\nポストID: ${parsed.hiddenPosts.length}件\nメディアなし対象リスト: ${parsed.mediaFilterTargets.length}件`
        const shouldOverwrite = window.confirm(confirmMessage)
        if (!shouldOverwrite) {
            return
        }

        this.configManager.save(parsed.ids)
        this.configManager.saveHiddenPosts(parsed.hiddenPosts)
        this.configManager.saveMediaFilterTargets(parsed.mediaFilterTargets)
        window.alert('非表示リストをインポートしました')
        this.applyFilters()
    }

    /**
     * テキストからポストIDを抽出する
     * @param {string} text - URLが含まれるテキスト
     * @returns {string[]} 抽出したポストID一覧
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
