// ==UserScript==
// @name         Quetta Persistent Floating Fullscreen Button
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Unkillable pure text `<` button that auto-restores fullscreen on post-refresh interaction.
// @match        *://*/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // 1. Create a isolated host element to prevent Instagram from modifying or hiding the button
    const host = document.createElement('div');
    host.id = 'quetta-fs-host';
    Object.assign(host.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '0',
        height: '0',
        zIndex: '2147483647',
        pointerEvents: 'none'
    });

    const shadow = host.attachShadow({ mode: 'closed' });

    // 2. Create the pure "<" button without any background box
    const btn = document.createElement('div');
    btn.innerHTML = '&lt;';
    Object.assign(btn.style, {
        position: 'fixed',
        top: '50%',
        right: '12px',
        transform: 'translateY(-50%)',
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: '28px',
        fontWeight: '900',
        fontFamily: 'monospace, sans-serif',
        cursor: 'pointer',
        userSelect: 'none',
        webkitUserSelect: 'none',
        pointerEvents: 'auto',
        textShadow: '0px 0px 4px rgba(0, 0, 0, 0.8), 0px 0px 8px rgba(0, 0, 0, 0.5)',
        lineHeight: '1',
        padding: '0',
        margin: '0',
        background: 'transparent',
        border: 'none',
        outline: 'none'
    });

    shadow.appendChild(btn);

    // 3. Keep host attached even if Instagram clears or changes the DOM
    function ensureMounted() {
        if (!document.body) return;
        if (!document.body.contains(host)) {
            document.body.appendChild(host);
        }
    }

    const observer = new MutationObserver(ensureMounted);

    function init() {
        ensureMounted();
        if (document.body) {
            observer.observe(document.body, { childList: true, subtree: true });
        }
        checkPersistedState();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // 4. Fullscreen Execution Logic
    function goFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().then(() => {
                btn.innerHTML = '&gt;';
                sessionStorage.setItem('quetta_fs_locked', 'true');
            }).catch(() => {});
        }
    }

    function exitFullscreen() {
        if (document.fullscreenElement) {
            document.exitFullscreen().then(() => {
                btn.innerHTML = '&lt;';
                sessionStorage.setItem('quetta_fs_locked', 'false');
            });
        }
    }

    btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!document.fullscreenElement) goFullscreen();
        else exitFullscreen();
    }, true);

    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement) {
            btn.innerHTML = '&lt;';
        }
    });

    // 5. Instantly restore fullscreen on ANY user interaction after refresh
    function checkPersistedState() {
        if (sessionStorage.getItem('quetta_fs_locked') === 'true') {
            const triggerRestore = (e) => {
                goFullscreen();
                ['click', 'touchstart', 'pointerdown', 'scroll'].forEach(evt => {
                    window.removeEventListener(evt, triggerRestore, true);
                });
            };

            ['click', 'touchstart', 'pointerdown', 'scroll'].forEach(evt => {
                window.addEventListener(evt, triggerRestore, { capture: true, passive: true });
            });
        }
    }
})();
