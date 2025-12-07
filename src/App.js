import { CONFIG } from './config.js';
import { ConfigManager } from './ConfigManager.js';
import { FilterEngine } from './FilterEngine.js';

/**
 * ユーザースクリプトの機能を統括するメインアプリケーションクラス
 */
export class App {
    constructor () {
        this.configManager = new ConfigManager()
        this.filterEngine = new FilterEngine(this.configManager)
        this.observer = null
    }

    /**
     * アプリケーションを初期化する
     */
    init () {
        this.ensureHiddenStyle()
        this.registerMenu()
        this.startObserver()
        this.filterCells()
    }

    /**
     * ユーザーIDを追加するためのTampermonkeyメニューコマンドを登録する
     */
    registerMenu () {
        GM_registerMenuCommand('ユーザーIDを追加して非表示', () => {
            const input = window.prompt(
                '追加したいユーザーIDを改行区切りで入力してください。',
                ''
            )
            if (input === null) {
                return
            }
            const additions = this.configManager.sanitizeIds(input.split(/\r?\n/))
            if (!additions.length) {
                console.log('追加IDなし: 変更を行いませんでした')
                return
            }
            this.configManager.save([...this.configManager.getIds(), ...additions])
            this.filterCells()
        })

        GM_registerMenuCommand('非表示リストをエクスポート', () => {
            const payload = this.configManager.createExportPayload()
            this.downloadExport(payload)
        })

        GM_registerMenuCommand('非表示リストをインポート', () => {
            this.promptImportFile()
        })
    }

    /**
     * セルを非表示にするためのCSSスタイルがドキュメントに挿入されていることを確認する
     */
    ensureHiddenStyle () {
        if (document.getElementById(CONFIG.HIDDEN_STYLE_ID)) {
            return
        }
        // display: none を適用するスタイルを一度だけ挿入
        const style = document.createElement('style')
        style.id = CONFIG.HIDDEN_STYLE_ID
        style.textContent = `.${CONFIG.HIDDEN_CLASS_NAME} { display: none !important; }`
        document.head.appendChild(style)
    }

    /**
     * ドキュメント内の全セルをフィルタリングし、非表示ユーザーIDに一致するものを隠す
     */
    filterCells () {
        // セルごとにユーザーIDのマッチ判定を実施
        const cells = Array.from(
            document.querySelectorAll(CONFIG.SELECTORS.CELL)
        )
        cells.forEach(cell => {
            const shouldHide = this.filterEngine.shouldHide(cell)
            cell.classList.toggle(CONFIG.HIDDEN_CLASS_NAME, shouldHide)
        })
    }

    /**
     * DOMの変更を監視し、フィルタリングを再適用するためのMutationObserverを開始する
     */
    startObserver () {
        this.observer = new MutationObserver(() => this.filterCells())
        this.observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true
        })
    }

    /**
     * エクスポート対象のJSON文字列をダウンロードさせる
     * @param {{ fileName: string, mimeType: string, content: string }} payload - エクスポート情報
     */
    downloadExport (payload) {
        if (!payload || !payload.content) {
            console.warn('エクスポート対象のデータが存在しません')
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
     * ファイル選択ダイアログを表示し、選択されたJSONを読み込む
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
     * 選択されたJSONファイルを読み取る
     * @param {File} file - 読み込むファイル
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
     * インポート処理を実行し、ユーザーに確認のうえ保存する
     * @param {string} text - ファイルから取得したJSON文字列
     */
    processImportedText (text) {
        let parsed = null
        try {
            parsed = this.configManager.parseImportPayload(text)
        } catch (error) {
            window.alert(error?.message || 'インポートに失敗しました')
            return
        }

        const confirmMessage = `非表示リストを上書きします。\nエクスポート日時: ${parsed.meta.exportedAt}\nユーザー数: ${parsed.ids.length}\nよろしいですか？`
        const shouldOverwrite = window.confirm(confirmMessage)
        if (!shouldOverwrite) {
            return
        }

        this.configManager.save(parsed.ids)
        window.alert('非表示リストを更新しました')
        this.filterCells()
    }
}
