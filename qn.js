// ==UserScript==
// @name         Quetta Indestructible Fullscreen Button
// @namespace    http://tampermonkey.net/
// @version      6.0
// @description  Hides on scroll, floating transparent < toggle, icon-based control panel, robust persistence engine.
// @match        *://*/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    if (window.top !== window.self) return;

    // --- HOST ELEMENT (Main DOM) ---
    const host = document.createElement('div');
    host.id = 'quetta-indestructible-host';
    
    function enforceHostStyles() {
        host.style.setProperty('position', 'fixed', 'important');
        host.style.setProperty('top', '0', 'important');
        host.style.setProperty('left', '0', 'important');
        host.style.setProperty('width', '0', 'important');
        host.style.setProperty('height', '0', 'important');
        host.style.setProperty('z-index', '2147483647', 'important'); // Max z-index
        host.style.setProperty('pointer-events', 'none', 'important');
        host.style.setProperty('display', 'block', 'important');
        host.style.setProperty('visibility', 'visible', 'important');
        host.style.setProperty('opacity', '1', 'important');
    }
    enforceHostStyles();

    // --- SHADOW DOM (Protects UI from page CSS) ---
    const shadow = host.attachShadow({ mode: 'closed' });

    // Inject CSS for the panel and buttons
    const style = document.createElement('style');
    style.textContent = `
        #wrapper {
            position: fixed !important;
            top: 50% !important;
            right: 0 !important;
            transform: translateY(-50%) !important;
            display: flex !important;
            align-items: center !important;
            pointer-events: auto !important;
            z-index: 2147483647 !important;
            transition: opacity 0.2s ease !important;
        }
        #panel {
            display: none;
            flex-direction: column !important;
            gap: 10px !important;
            padding: 12px !important;
            background: rgba(0, 0, 0, 0.65) !important;
            backdrop-filter: blur(5px) !important;
            border-radius: 12px 0 0 12px !important;
            border: 1px solid rgba(255, 255, 255, 0.1) !important;
            border-right: none !important;
            box-shadow: -2px 0 8px rgba(0, 0, 0, 0.5) !important;
        }
        #toggle {
            padding: 10px 5px !important;
            margin: 0 !important;
            font-size: 14px !important;
            font-weight: 900 !important;
            font-family: monospace, sans-serif !important;
            cursor: pointer !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            text-shadow: 0px 0px 4px rgba(0, 0, 0, 0.9) !important;
            color: rgba(255, 255, 255, 0.3) !important;
            background: transparent !important;
            border: none !important;
            user-select: none !important;
            line-height: 1 !important;
        }
        button {
            background: rgba(0, 0, 0, 0.4) !important;
            border: 1px solid rgba(255, 255, 255, 0.2) !important;
            color: white !important;
            padding: 8px !important;
            border-radius: 8px !important;
            cursor: pointer !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            transition: all 0.2s ease !important;
        }
        button svg {
            width: 22px !important;
            height: 22px !important;
            fill: currentColor !important;
        }
        .status-on {
            color: #4ade80 !important; /* Bright green */
            border-color: #4ade80 !important;
            background: rgba(74, 222, 128, 0.1) !important;
            box-shadow: 0 0 8px rgba(74, 222, 128, 0.2) !important;
        }
        .status-off {
            color: rgba(255, 255, 255, 0.5) !important; /* Muted gray/white */
            border-color: rgba(255, 255, 255, 0.15) !important;
        }
    `;
    shadow.appendChild(style);

    // SVGs for Icons
    const iconFsOn = `<svg viewBox="0 0 24 24"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>`;
    const iconFsOff = `<svg viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>`;
    
    const iconLockOn = `<svg viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>`;
    const iconLockOff = `<svg viewBox="0 0 24 24"><path d="M12 17c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm6-9h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6h1.9c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm0 12H6V10h12v10z"/></svg>`;

    // Build UI Elements
    const wrapper = document.createElement('div');
    wrapper.id = 'wrapper';

    const panel = document.createElement('div');
    panel.id = 'panel';

    const btnFs = document.createElement('button');
    btnFs.title = "Session Fullscreen Toggle";
    
    const btnLock = document.createElement('button');
    btnLock.title = "Permanent Keep-Alive Toggle";

    panel.appendChild(btnFs);
    panel.appendChild(btnLock);

    const toggle = document.createElement('div');
    toggle.id = 'toggle';
    toggle.innerHTML = '&lt;';

    wrapper.appendChild(panel);
    wrapper.appendChild(toggle);
    shadow.appendChild(wrapper);

    // --- SCROLL TO HIDE LOGIC ---
    let scrollTimeout;
    window.addEventListener('scroll', () => {
        wrapper.style.setProperty('opacity', '0', 'important');
        wrapper.style.setProperty('pointer-events', 'none', 'important');
        
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            wrapper.style.setProperty('opacity', '1', 'important');
            wrapper.style.setProperty('pointer-events', 'auto', 'important');
        }, 500); // Reappears 500ms after scrolling stops
    }, { capture: true, passive: true });

    // --- UI INTERACTION LOGIC ---
    let isMenuOpen = false;
    toggle.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        isMenuOpen = !isMenuOpen;
        panel.style.setProperty('display', isMenuOpen ? 'flex' : 'none', 'important');
        toggle.innerHTML = isMenuOpen ? '&gt;' : '&lt;';
    });

    // Update button states and icons
    function updateStateUI() {
        const isSessionOn = sessionStorage.getItem('quetta_fs_session') === 'true' || !!document.fullscreenElement;
        const isLocked = localStorage.getItem('quetta_fs_locked') === 'true';

        btnFs.innerHTML = isSessionOn ? iconFsOn : iconFsOff;
        btnFs.className = isSessionOn ? 'status-on' : 'status-off';

        btnLock.innerHTML = isLocked ? iconLockOn : iconLockOff;
        btnLock.className = isLocked ? 'status-on' : 'status-off';
    }

    // Session Fullscreen Toggle
    btnFs.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const isSessionOn = sessionStorage.getItem('quetta_fs_session') === 'true';
        
        if (isSessionOn || document.fullscreenElement) {
            sessionStorage.setItem('quetta_fs_session', 'false');
            if (document.fullscreenElement) {
                document.exitFullscreen().catch(() => {});
            }
        } else {
            sessionStorage.setItem('quetta_fs_session', 'true');
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(() => {});
            }
        }
        updateStateUI();
    });

    // Permanent Lock Toggle
    btnLock.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const isLocked = localStorage.getItem('quetta_fs_locked') === 'true';
        localStorage.setItem('quetta_fs_locked', !isLocked);
        updateStateUI();
    });

    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement) {
            sessionStorage.setItem('quetta_fs_session', 'false');
        } else {
            sessionStorage.setItem('quetta_fs_session', 'true');
        }
        updateStateUI();
    });

    updateStateUI();

    // --- PERSISTENT KEEP-ALIVE LOGIC (Fixed Bug) ---
    // Browsers block fullscreen from "scroll" events. By strictly using click/touch/keydown,
    // the request succeeds and functionality is no longer lost on refresh.
    function checkPersistedState() {
        const triggerRestore = (e) => {
            if (e.composedPath().includes(host)) return; // Ignore clicks on the menu itself
            
            const wantsFs = localStorage.getItem('quetta_fs_locked') === 'true' || 
                            sessionStorage.getItem('quetta_fs_session') === 'true';
            
            if (wantsFs && !document.fullscreenElement) {
                document.documentElement.requestFullscreen().then(() => {
                    // Only remove the listener if the browser actually allows fullscreen
                    removeListeners();
                }).catch(() => {
                    // If blocked (e.g. invalid gesture timing), keep listener active for next tap
                });
            } else if (document.fullscreenElement || !wantsFs) {
                removeListeners(); // Clean up if already in FS or turned off before clicking
            }
        };

        const attachListeners = () => {
            ['click', 'touchstart', 'keydown'].forEach(evt => {
                window.addEventListener(evt, triggerRestore, { capture: true, passive: true });
            });
        };

        const removeListeners = () => {
            ['click', 'touchstart', 'keydown'].forEach(evt => {
                window.removeEventListener(evt, triggerRestore, true);
            });
        };

        attachListeners();
    }

    // --- INDESTRUCTIBLE SURVIVAL MECHANISM ---
    function revive() {
        const root = document.documentElement;
        if (root && !root.contains(host)) {
            root.appendChild(host);
        }
        enforceHostStyles();
    }

    setInterval(revive, 1000);
    
    const fastInit = setInterval(() => {
        if (document.documentElement) {
            revive();
            checkPersistedState();
            clearInterval(fastInit);
        }
    }, 50);

})();
