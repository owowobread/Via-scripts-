// ==UserScript==
// @name         Quetta Invisible Auto-Fullscreen
// @namespace    http://tampermonkey.net/
// @version      7.0
// @description  No buttons, no UI. Instantly forces fullscreen the millisecond you touch, click, or start to scroll the page.
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
            document.documentElement.requestFullscreen().then(() => {
                // Once successful, stop listening to avoid spamming the browser
                removeListeners();
            }).catch(() => {
                // If the browser blocks it (e.g., page still loading), it silently fails 
                // and keeps the listeners active for the next touch.
            });
        } else {
            removeListeners(); // Already in fullscreen
        }
    }

    // List of valid gestures the browser accepts for Fullscreen
    // 'touchstart' is what catches your finger the moment you try to scroll
    const triggerEvents = ['touchstart', 'click', 'keydown'];

    function attachListeners() {
        triggerEvents.forEach(evt => {
            window.addEventListener(evt, enforceFullscreen, { capture: true, passive: true });
        });
    }

    function removeListeners() {
        triggerEvents.forEach(evt => {
            window.removeEventListener(evt, enforceFullscreen, true);
        });
    }

    // Start listening as soon as the script runs
    attachListeners();

    // If you ever manually exit fullscreen (like using the phone's back gesture),
    // this detects it and re-arms the script so the NEXT touch puts you right back in.
    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement) {
            attachListeners();
        }
    });

})();
