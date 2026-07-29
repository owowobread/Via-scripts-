// ==UserScript==
// @name         Quetta Invisible Auto-Fullscreen
// @namespace    http://tampermonkey.net/
// @version      7.1
// @description  Scroll up to enter fullscreen, scroll down to exit fullscreen.
// @match        *://*/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    if (window.top !== window.self) return;

    // The function that forces fullscreen
    function enforceFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {
                // Silently fail if blocked
            });
        }
    }

    // The function that brings the search bar back
    function exitFullscreen() {
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {
                // Silently fail if blocked
            });
        }
    }

    let startY = 0;

    function attachListeners() {
        // Record where the finger first touches the screen
        window.addEventListener('touchstart', (e) => {
            startY = e.touches[0].clientY;
        }, { capture: true, passive: true });

        // Calculate the direction when the finger leaves the screen
        window.addEventListener('touchend', (e) => {
            let endY = e.changedTouches[0].clientY;
            let deltaY = endY - startY;

            // Swiping DOWN (which scrolls the page UP)
            if (deltaY > 50) {
                enforceFullscreen();
            } 
            // Swiping UP (which scrolls the page DOWN)
            else if (deltaY < -50) {
                exitFullscreen();
            }
        }, { capture: true, passive: true });
    }

    // Start listening as soon as the script runs
    attachListeners();

})();
