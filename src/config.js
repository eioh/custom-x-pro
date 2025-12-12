/**
 * 設定定数
 */
export const CONFIG = {
    STORAGE_KEY: 'hiddenUserIds',
    EXPORT_VERSION: 2,
    DEFAULT_HIDDEN_USER_IDS: [],
    HIDDEN_CLASS_NAME: 'tm-hidden-cell',
    HIDDEN_STYLE_ID: 'tm-hidden-cell-style',
    POST_FILTER: {
        STORAGE_KEY: 'hiddenPosts',
        DEFAULT_ENTRIES: [],
        TTL_MS: 1000 * 60 * 60 * 24 * 30, // 30日
        SELECTOR: 'a[href*="/status/"][href$="/analytics"]',
        QUOTE_CONTAINER_SELECTOR: 'div[role="link"][tabindex="0"]'
    },
    MEDIA_FILTER: {
        HIDDEN_CLASS_NAME: 'tm-hidden-no-media',
        STORAGE_KEY: 'mediaFilterTargetLists',
        DEFAULT_TARGET_LISTS: [],
        COLUMN_SELECTOR: 'section[role="region"].css-175oi2r.r-18u37iz.r-2llsf.r-1ny4l3l',
        HEADER_SELECTOR: '[data-testid="column-title-wrapper"]',
        SKIP_TEXTS: ['ポストをさらに表示'],
        MEDIA_SELECTORS: [
            '[data-testid="tweetPhoto"]',
            '[data-testid="videoPlayer"]',
            '[data-testid="gifPlayer"]',
            'a[href*="/photo/"]',
            'a[href*="/video/"]'
        ]
    },
    SELECTORS: {
        CELL: '[data-testid="cellInnerDiv"]',
        USER_NAME: '[data-testid="User-Name"] a'
    }
};
