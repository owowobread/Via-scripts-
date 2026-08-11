// ==UserScript==
// @name         AMOLED
// @namespace    http://viabrowser.com/
// @version      18.0
// @description  Pure, lightweight AMOLED CSS injector. Zero lag, zero data left behind.
// @match        *://*/*
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    const css = `
        /* 1. Force true AMOLED black on base layers */
        html, body {
            background-color: #000000 !important;
            color: #E0E0E0 !important;
        }

        /* 2. Target common containers to ensure full coverage without breaking layouts */
        div, section, article, header, footer, nav, main, aside {
            background-color: transparent !important;
        }

        /* 3. Protect images, videos, and graphics from any modifications */
        img, video, iframe, canvas, svg, picture {
            filter: none !important;
            opacity: 1 !important;
        }

        /* 4. Ensure links remain visible and legible */
        a, a * {
            color: #39FF14 !important; /* Neon Green - Maximum contrast on black */
        }
    `;

    const styleTag = document.createElement('style');
    styleTag.type = 'text/css';
    styleTag.id = 'amoled-clean-injector';
    styleTag.textContent = css;

    if (document.head) {
        document.head.appendChild(styleTag);
    } else {
        document.documentElement.appendChild(styleTag);
    }
})();
W
