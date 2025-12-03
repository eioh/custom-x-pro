import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ConfigManager } from '../src/ConfigManager.js';
import { CONFIG } from '../src/config.js';

describe('ConfigManager', () => {
    beforeEach(() => {
        global.GM_getValues = jest.fn(() => ({
            [CONFIG.STORAGE_KEY]: CONFIG.DEFAULT_HIDDEN_USER_IDS
        }))
        global.GM_setValues = jest.fn()
    })

    it('sanitizeIdsでトリムと大文字小文字を保持したまま重複排除を行う', () => {
        const manager = new ConfigManager()
        const result = manager.sanitizeIds(['  Alice ', 'ALICE', '', 'Bob', 'bob ', null])
        expect(result).toEqual(['Alice', 'ALICE', 'Bob', 'bob'])
    })

    it('loadで保存済みの配列を正しく読み込む', () => {
        global.GM_getValues.mockReturnValue({
            [CONFIG.STORAGE_KEY]: ['  Alice ', 'Bob', 'ALICE']
        })
        const manager = new ConfigManager()
        expect(manager.getIds()).toEqual(['Alice', 'Bob', 'ALICE'])
    })

    it('loadで文字列保存のIDを整形して読み込む', () => {
        global.GM_getValues.mockReturnValue({
            [CONFIG.STORAGE_KEY]: ' Alice, Bob\ncarol '
        })
        const manager = new ConfigManager()
        expect(manager.getIds()).toEqual(['Alice', 'Bob', 'carol'])
    })

    it('saveで整形後のIDを保存して内部状態も更新する', () => {
        const manager = new ConfigManager()
        manager.save(['  Carol ', 'dave', 'CAROL'])
        expect(manager.getIds()).toEqual(['Carol', 'dave', 'CAROL'])
        expect(global.GM_setValues).toHaveBeenCalledWith({
            [CONFIG.STORAGE_KEY]: ['Carol', 'dave', 'CAROL']
        })
    })
})
