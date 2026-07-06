// ==UserScript==
// @name         Quetta Smart Fullscreen (Refined)
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Enters fullscreen on intentional scroll down, exits on scroll up. Optimized to prevent accidental triggers and UI conflicts.
// @author       You
// @match        *://*/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    let startY = 0;
    let startX = 0;

    window.addEventListener('touchstart', (e) => {
        startY = e.changedTouches[0].screenY;
        startX = e.changedTouches[0].screenX;
    }, { passive: true });

    window.addEventListener('touchend', (e) => {
        // Prevent triggering if the user is tapping a text input, button, or dropdown
        const activeTags = ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'];
        if (activeTags.includes(e.target.tagName)) return;

        let endY = e.changedTouches[0].screenY;
        let endX = e.changedTouches[0].screenX;
        
        let distanceY = endY - startY;
        let distanceX = Math.abs(endX - startX);

        // Ignore the action if the user is swiping horizontally (e.g., photo galleries)
        if (distanceX > 60) return; 

        // Swipe Up (Scrolling Down) -> Enter Fullscreen
        // Increased threshold to 120px to require a deliberate, long swipe
        if (distanceY < -120) {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(() => {});
            }
        } 
        // Swipe Down (Scrolling Up) -> Exit Fullscreen 
        else if (distanceY > 120) {
            if (document.fullscreenElement) {
                document.exitFullscreen().catch(() => {});
            }
        }
    }, { passive: true });
})();
