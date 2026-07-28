// ==UserScript==
// @name         Quetta Persistent Floating Fullscreen Button (Aggressive)
// @namespace    http://tampermonkey.net/
// @version      2.1
// @description  Unkillable pure text `<` button. Remembers state forever and snaps to fullscreen on first touch.
// @match        *://*/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

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

    const btn = document.createElement('div');
    // Set initial icon based on saved state
    btn.innerHTML = localStorage.getItem('quetta_fs_locked') === 'true' ? '&gt;' : '&lt;';
    
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

    function goFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().then(() => {
                btn.innerHTML = '&gt;';
                localStorage.setItem('quetta_fs_locked', 'true');
            }).catch(() => {});
        }
    }

    function exitFullscreen() {
        if (document.fullscreenElement) {
            document.exitFullscreen().then(() => {
                btn.innerHTML = '&lt;';
                localStorage.setItem('quetta_fs_locked', 'false');
            });
        }
    }

    btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Manual override toggle
        if (localStorage.getItem('quetta_fs_locked') === 'true') {
            exitFullscreen();
        } else {
            goFullscreen();
        }
    }, true);

    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement) {
            // If Android system exits fullscreen, update icon but keep the lock state active
            // so it goes back to fullscreen on next load/touch unless toggled manually.
            btn.innerHTML = '&lt;';
        } else {
            btn.innerHTML = '&gt;';
        }
    });

    // Aggressive Auto-Restore
    function checkPersistedState() {
        if (localStorage.getItem('quetta_fs_locked') === 'true') {
            const triggerRestore = (e) => {
                // Ignore the event if the user is directly clicking the toggle button
                if (e.target === btn || e.target === host) return;
                
                goFullscreen();
                
                // Once triggered, remove the listeners so it doesn't spam the browser
                ['click', 'touchstart', 'pointerdown', 'scroll'].forEach(evt => {
                    window.removeEventListener(evt, triggerRestore, true);
                });
            };

            // Hook into the absolute first sign of user life on the page
            ['click', 'touchstart', 'pointerdown', 'scroll'].forEach(evt => {
                window.addEventListener(evt, triggerRestore, { capture: true, passive: true });
            });
        }
    }
})();
