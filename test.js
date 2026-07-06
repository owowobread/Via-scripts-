script_content = """// ==UserScript==
// @name         Quetta Smart Fullscreen (Absolute Instant)
// @namespace    http://tampermonkey.net/
// @version      1.4
// @description  Triggers fullscreen at the absolute minimum finger movement.
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

        let distanceY = e.changedTouches[0].screenY - startY;

        // Trigger instantly at just 2 pixels of movement
        if (distanceY < -2) { 
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(() => {});
            }
            isDragging = false; // Lock until next touch
        } 
        else if (distanceY > 2) { 
            if (document.fullscreenElement) {
                document.exitFullscreen().catch(() => {});
            }
            isDragging = false; // Lock until next touch
        }
    }, { passive: true });

    window.addEventListener('touchend', () => {
        isDragging = false;
    }, { passive: true });
})();
"""

file_path = "quetta_fullscreen_script.txt"
with open(file_path, "w", encoding="utf-8") as f:
    f.write(script_content)

print(file_path)

