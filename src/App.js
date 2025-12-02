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
}
