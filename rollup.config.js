export default {
  input: 'src/index.js',
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
