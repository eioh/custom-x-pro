// ==UserScript==
// @name         New Userscript
// @namespace    http://tampermonkey.net/
// @version      2025-11-06
// @description  try to take over the world!
// @author       You
// @match        https://pro.x.com/i/decks/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=x.com
// @grant        GM_getValues
// @grant        GM_setValues
// @grant        GM_registerMenuCommand
// ==/UserScript==

;(function () {
    'use strict'

    /**
     * 設定定数
     */
    const CONFIG = {
        STORAGE_KEY: 'hiddenUserIds',
        DEFAULT_HIDDEN_USER_IDS: [],
        HIDDEN_CLASS_NAME: 'tm-hidden-cell',
        HIDDEN_STYLE_ID: 'tm-hidden-cell-style',
        SELECTORS: {
            CELL: '[data-testid="cellInnerDiv"]',
            USER_NAME: '[data-testid="User-Name"] a'
        }
    }

    /**
     * 設定とストレージの永続化を管理するクラス
     */
    class ConfigManager {
        constructor () {
            this.hiddenUserIds = []
            this.normalizedHiddenUserIds = []
            this.load()
        }

        /**
         * ユーザーIDリストを整形（トリム＋重複排除）する
         * @param {string[]} ids - 整形するユーザーIDの配列
         * @returns {string[]} 整形済みのユーザーID配列
         */
        sanitizeIds (ids) {
            const result = []
            const seen = new Set()
            ids.forEach(id => {
                const trimmed = (id || '').trim()
                if (!trimmed) {
                    return
                }
                const key = trimmed.toLowerCase()
                if (seen.has(key)) {
                    return
                }
                seen.add(key)
                result.push(trimmed)
            })
            return result
        }

        /**
         * 大文字小文字を区別しない比較のためにユーザーIDを正規化（小文字化）する
         * @param {string[]} ids - ユーザーIDの配列
         * @returns {string[]} 小文字化されたユーザーIDの配列
         */
        buildNormalizedHiddenUserIds (ids) {
            return ids.map(id => id.toLowerCase())
        }

        /**
         * Tampermonkeyストレージから非表示ユーザーIDを読み込む
         * @returns {string[]} 読み込まれた非表示ユーザーIDの配列
         */
        load () {
            const storedValues = GM_getValues({
                [CONFIG.STORAGE_KEY]: CONFIG.DEFAULT_HIDDEN_USER_IDS
            })
            const stored = storedValues?.[CONFIG.STORAGE_KEY]
            let ids = CONFIG.DEFAULT_HIDDEN_USER_IDS.slice()

            if (Array.isArray(stored)) {
                ids = this.sanitizeIds(stored)
            } else if (typeof stored === 'string') {
                ids = this.sanitizeIds(stored.split(/[\s,]+/))
            }

            this.hiddenUserIds = ids
            this.normalizedHiddenUserIds = this.buildNormalizedHiddenUserIds(ids)
            return this.hiddenUserIds
        }

        /**
         * 非表示ユーザーIDのリストをTampermonkeyストレージに保存する
         * @param {string[]} ids - 保存するユーザーIDの配列
         */
        save (ids) {
            const sanitized = this.sanitizeIds(ids)
            this.hiddenUserIds = sanitized
            this.normalizedHiddenUserIds = this.buildNormalizedHiddenUserIds(this.hiddenUserIds)
            GM_setValues({
                [CONFIG.STORAGE_KEY]: this.hiddenUserIds
            })
            console.log('hiddenUserIds 更新:', this.hiddenUserIds)
        }

        /**
         * 現在の非表示ユーザーIDリストを取得する
         * @returns {string[]} 非表示ユーザーIDの配列
         */
        getIds () {
            return this.hiddenUserIds
        }

        /**
         * 正規化（小文字化）された非表示ユーザーIDリストを取得する
         * @returns {string[]} 正規化された非表示ユーザーIDの配列
         */
        getNormalizedIds () {
            return this.normalizedHiddenUserIds
        }
    }

    const configManager = new ConfigManager()

    /**
     * セルを非表示にするかどうかの判定ロジックを扱うクラス
     */
    class FilterEngine {
        /**
         * @param {ConfigManager} configManager - 設定マネージャーのインスタンス
         */
        constructor (configManager) {
            this.configManager = configManager
        }

        /**
         * ユーザーIDに基づいてセル要素を非表示にすべきか判定する
         * @param {HTMLElement} cell - チェックするセル要素
         * @returns {boolean} 非表示にすべき場合はtrue、そうでない場合はfalse
         */
        shouldHide (cell) {
            const userNameLink = cell.querySelector(CONFIG.SELECTORS.USER_NAME)
            if (!userNameLink) {
                return false
            }
            const href = userNameLink.getAttribute('href') || ''
            const hrefMatch = href.match(/^https?:\/\/(?:www\.)?x\.com\/([^/?#]+)/i)
            let userId = null
            if (hrefMatch) {
                userId = hrefMatch[1]
            }

            const normalizedId = (userId || '').toLowerCase()
            if (!normalizedId) {
                return false
            }

            const shouldHide = this.configManager.getNormalizedIds().some(keyword =>
                normalizedId.includes(keyword)
            )
            return shouldHide
        }
    }

    /**
     * ユーザースクリプトの機能を統括するメインアプリケーションクラス
     */
    class App {
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

    new App().init()
})()
