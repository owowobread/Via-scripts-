// ==UserScript==
// @name         Quetta Smart Fullscreen (Instant)
// @namespace    http://tampermonkey.net/
// @version      1.3
// @description  Instantly enters/exits fullscreen during the scroll, without waiting for finger release.
// @author       You
// @match        *://*/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    let startY = 0;
    let isDragging = false;

    window.addEventListener('touchstart', (e) => {
        startY = e.changedTouches[0].screenY;
        isDragging = true;
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
        if (!isDragging) return;

        // Prevent triggering on text inputs or buttons
        const activeTags = ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'];
        if (e.target && activeTags.includes(e.target.tagName)) return;

        let currentY = e.changedTouches[0].screenY;
        let distanceY = currentY - startY;

        // Trigger instantly at 15px of movement while finger is still down
        if (distanceY < -15) { 
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(() => {});
            }
            isDragging = false; // Lock until the next new touch
        } 
        else if (distanceY > 15) { 
            if (document.fullscreenElement) {
                document.exitFullscreen().catch(() => {});
            }
            isDragging = false; // Lock until the next new touch
        }
    }, { passive: true });

    window.addEventListener('touchend', () => {
        isDragging = false;
    }, { passive: true });
})();
