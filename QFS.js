// ==UserScript==
// @name         Quetta Fullscreen Persistent Toggle
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Sticky toggle that remembers fullscreen state and auto-restores on first tap after refresh.
// @match        *://*/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const btn = document.createElement('div');
    btn.innerHTML = '&lt;';
    
    Object.assign(btn.style, {
        position: 'fixed',
        top: '50%',
        right: '0',
        transform: 'translateY(-50%)',
        width: '40px',
        height: '60px',
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        color: 'white',
        fontSize: '24px',
        fontWeight: 'bold',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        cursor: 'pointer',
        zIndex: '2147483647',
        borderTopLeftRadius: '10px',
        borderBottomLeftRadius: '10px',
        userSelect: 'none',
        backdropFilter: 'blur(3px)'
    });

    const init = setInterval(() => {
        if (document.body) {
            document.body.appendChild(btn);
            clearInterval(init);
            checkPersistedState();
        }
    }, 100);

    function goFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().then(() => {
                btn.innerHTML = '&gt;';
                btn.style.backgroundColor = 'rgba(0, 0, 0, 0.1)';
                sessionStorage.setItem('quetta_fs_locked', 'true');
            }).catch(err => console.error("Fullscreen failed:", err));
        }
    }

    function exitFullscreen() {
        if (document.fullscreenElement) {
            document.exitFullscreen().then(() => {
                btn.innerHTML = '&lt;';
                btn.style.backgroundColor = 'rgba(0, 0, 0, 0.4)';
                sessionStorage.setItem('quetta_fs_locked', 'false');
            });
        }
    }

    btn.addEventListener('click', (e) => {
        e.stopPropagation(); 
        if (!document.fullscreenElement) goFullscreen();
        else exitFullscreen();
    });

    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement) {
            btn.innerHTML = '&lt;';
            btn.style.backgroundColor = 'rgba(0, 0, 0, 0.4)';
            // If exited by OS (e.g., swipe), the locked state remains true.
        }
    });

    // Auto-restore workaround
    function checkPersistedState() {
        if (sessionStorage.getItem('quetta_fs_locked') === 'true') {
            const restoreFS = () => {
                goFullscreen();
                document.removeEventListener('click', restoreFS, true);
                document.removeEventListener('touchstart', restoreFS, true);
            };
            // Catches your first interaction with the page and fires fullscreen instantly
            document.addEventListener('click', restoreFS, true);
            document.addEventListener('touchstart', restoreFS, true);
        }
    }
})();
