function htmlAsString () {
  return {
    name: 'html-as-string',
    transform (code, id) {
      if (!id.endsWith('.html')) {
        return null
      }
      return {
        code: `export default ${JSON.stringify(code)};`,
        map: { mappings: '' }
      }
    }
  }
}

export default {
  input: 'src/index.js',
  plugins: [htmlAsString()],
  output: {
    file: 'dist/main.js',
    format: 'iife',
    banner: `// ==UserScript==
// @name         New Userscript
// @namespace    http://tampermonkey.net/
// @version      2025-11-06
// @description  try to take over the world!
// @author       You
// @match        https://pro.x.com/i/decks/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=x.com
// @grant        GM_getValues
// @grant        GM_setValues
// @grant        GM_download
// @grant        GM_registerMenuCommand
// ==/UserScript==`
  }
}
