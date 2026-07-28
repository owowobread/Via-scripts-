// ==UserScript==
// @name         Quetta Indestructible Fullscreen Button
// @namespace    http://tampermonkey.net/
// @version      3.1
// @description  Unkillable pure text `<` button. Small, highly transparent, survives DOM wipes, remembers state.
// @match        *://*/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    if (window.top !== window.self) return;

    const host = document.createElement('div');
    host.id = 'quetta-indestructible-host';
    
    function enforceHostStyles() {
        host.style.setProperty('position', 'fixed', 'important');
        host.style.setProperty('top', '0', 'important');
        host.style.setProperty('left', '0', 'important');
        host.style.setProperty('width', '0', 'important');
        host.style.setProperty('height', '0', 'important');
        host.style.setProperty('z-index', '2147483647', 'important');
        host.style.setProperty('pointer-events', 'none', 'important');
        host.style.setProperty('display', 'block', 'important');
        host.style.setProperty('visibility', 'visible', 'important');
        host.style.setProperty('opacity', '1', 'important');
    }
    enforceHostStyles();

    const shadow = host.attachShadow({ mode: 'closed' });

    const btn = document.createElement('div');
    btn.innerHTML = localStorage.getItem('quetta_fs_locked') === 'true' ? '&gt;' : '&lt;';
    
    function enforceButtonStyles() {
        btn.style.setProperty('position', 'fixed', 'important');
        btn.style.setProperty('top', '50%', 'important');
        btn.style.setProperty('right', '4px', 'important');
        btn.style.setProperty('transform', 'translateY(-50%)', 'important');
        
        // VISUAL CHANGES: Highly transparent, smaller text, subtle shadow
        btn.style.setProperty('color', 'rgba(255, 255, 255, 0.25)', 'important');
        btn.style.setProperty('font-size', '14px', 'important');
        btn.style.setProperty('text-shadow', '0px 0px 2px rgba(0, 0, 0, 0.4)', 'important');
        
        btn.style.setProperty('font-weight', '900', 'important');
        btn.style.setProperty('font-family', 'monospace, sans-serif', 'important');
        btn.style.setProperty('cursor', 'pointer', 'important');
        btn.style.setProperty('user-select', 'none', 'important');
        btn.style.setProperty('-webkit-user-select', 'none', 'important');
        btn.style.setProperty('pointer-events', 'auto', 'important');
        btn.style.setProperty('line-height', '1', 'important');
        
        // Added 15px invisible padding so it remains easy to tap with a finger despite being small
        btn.style.setProperty('padding', '15px', 'important');
        btn.style.setProperty('margin', '0', 'important');
        btn.style.setProperty('background', 'transparent', 'important');
        btn.style.setProperty('border', 'none', 'important');
        btn.style.setProperty('outline', 'none', 'important');
        btn.style.setProperty('display', 'block', 'important');
        btn.style.setProperty('visibility', 'visible', 'important');
    }
    enforceButtonStyles();

    shadow.appendChild(btn);

    function revive() {
        const root = document.documentElement;
        if (root && !root.contains(host)) {
            root.appendChild(host);
        }
        enforceHostStyles();
        enforceButtonStyles();
    }

    setInterval(revive, 1000);
    
    const fastInit = setInterval(() => {
        if (document.documentElement) {
            revive();
            checkPersistedState();
            clearInterval(fastInit);
        }
    }, 50);

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
        
        if (localStorage.getItem('quetta_fs_locked') === 'true') {
            exitFullscreen();
        } else {
            goFullscreen();
        }
    }, true);

    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement) {
            btn.innerHTML = '&lt;';
        } else {
            btn.innerHTML = '&gt;';
        }
    });

    function checkPersistedState() {
        if (localStorage.getItem('quetta_fs_locked') === 'true') {
            const triggerRestore = (e) => {
                if (e.composedPath().includes(btn) || e.composedPath().includes(host)) return;
                
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
