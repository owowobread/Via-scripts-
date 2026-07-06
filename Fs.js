// ==UserScript==
// @name         Quetta Always Fullscreen
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Forces fullscreen on the first screen tap and keeps the status bar hidden.
// @author       You
// @match        *://*/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    
    const enterFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
        }
        // Remove the event listeners immediately after it triggers once
        document.removeEventListener('touchstart', enterFullscreen);
        document.removeEventListener('click', enterFullscreen);
    };

    // The browser requires a physical tap/click to allow fullscreen mode
    document.addEventListener('touchstart', enterFullscreen, { once: true, passive: true });
    document.addEventListener('click', enterFullscreen, { once: true });
})();
