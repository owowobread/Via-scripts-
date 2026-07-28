// ==UserScript==
// @name         Quetta Indestructible Fullscreen Button
// @namespace    http://tampermonkey.net/
// @version      5.0
// @description  Unkillable fullscreen button. Session persists across refreshes, Permanent persists across the whole site.
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

    // --- SHADOW DOM (Protects our UI from page CSS) ---
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
            background: rgba(0, 0, 0, 0.65) !important;
            backdrop-filter: blur(5px) !important;
            border-radius: 12px 0 0 12px !important;
            pointer-events: auto !important;
            color: white !important;
            font-family: monospace, sans-serif !important;
            user-select: none !important;
            box-shadow: -2px 0 8px rgba(0, 0, 0, 0.5) !important;
            border: 1px solid rgba(255, 255, 255, 0.1) !important;
            border-right: none !important;
            z-index: 2147483647 !important;
        }
        #panel {
            display: none;
            flex-direction: column !important;
            gap: 10px !important;
            padding: 15px !important;
            border-right: 1px solid rgba(255, 255, 255, 0.15) !important;
        }
        #toggle {
            padding: 20px 15px !important;
            font-size: 20px !important;
            font-weight: 900 !important;
            cursor: pointer !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            text-shadow: 0px 0px 4px rgba(0, 0, 0, 0.8) !important;
            color: rgba(255, 255, 255, 0.9) !important;
        }
        button {
            background: rgba(0, 0, 0, 0.3) !important;
            border: 1px solid rgba(255, 255, 255, 0.3) !important;
            color: white !important;
            padding: 10px 15px !important;
            border-radius: 6px !important;
            cursor: pointer !important;
            font-family: sans-serif !important;
            font-size: 14px !important;
            font-weight: bold !important;
            white-space: nowrap !important;
            transition: all 0.2s ease !important;
        }
        button:hover {
            background: rgba(255, 255, 255, 0.15) !important;
        }
        .status-on {
            color: #4ade80 !important; /* Bright green */
            border-color: #4ade80 !important;
            box-shadow: 0 0 5px rgba(74, 222, 128, 0.3) !important;
        }
        .status-off {
            color: #f87171 !important; /* Bright red */
            border-color: rgba(255, 255, 255, 0.3) !important;
        }
    `;
    shadow.appendChild(style);

    // Build UI Elements
    const wrapper = document.createElement('div');
    wrapper.id = 'wrapper';

    const panel = document.createElement('div');
    panel.id = 'panel';

    const btnFs = document.createElement('button');
    const btnLock = document.createElement('button');

    panel.appendChild(btnFs);
    panel.appendChild(btnLock);

    const toggle = document.createElement('div');
    toggle.id = 'toggle';
    toggle.innerHTML = '&lt;';

    wrapper.appendChild(panel);
    wrapper.appendChild(toggle);
    shadow.appendChild(wrapper);

    // --- UI INTERACTION LOGIC ---

    let isMenuOpen = false;
    toggle.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        isMenuOpen = !isMenuOpen;
        panel.style.setProperty('display', isMenuOpen ? 'flex' : 'none', 'important');
        toggle.innerHTML = isMenuOpen ? '&gt;' : '&lt;';
    });

    // Update button texts and colors based on saved states
    function updateStateUI() {
        const isSessionOn = sessionStorage.getItem('quetta_fs_session') === 'true' || !!document.fullscreenElement;
        const isLocked = localStorage.getItem('quetta_fs_locked') === 'true';

        btnFs.textContent = isSessionOn ? 'FS Session: ON' : 'FS Session: OFF';
        btnFs.className = isSessionOn ? 'status-on' : 'status-off';

        btnLock.textContent = isLocked ? 'Permanent: ON' : 'Permanent: OFF';
        btnLock.className = isLocked ? 'status-on' : 'status-off';
    }

    // Session Fullscreen Toggle (Saves to sessionStorage to survive refreshes)
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

    // Permanent Lock Toggle (Saves to localStorage to survive across tabs/closing browser)
    btnLock.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const isLocked = localStorage.getItem('quetta_fs_locked') === 'true';
        localStorage.setItem('quetta_fs_locked', !isLocked);
        updateStateUI();
    });

    // Sync button states if you press the 'Esc' key to exit fullscreen
    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement) {
            sessionStorage.setItem('quetta_fs_session', 'false'); // Turn off session if exited manually
        } else {
            sessionStorage.setItem('quetta_fs_session', 'true');
        }
        updateStateUI();
    });

    updateStateUI();

    // --- PERSISTENT KEEP-ALIVE LOGIC ---
    // Waits for your first interaction (click/scroll) on a refreshed page to automatically force fullscreen
    function checkPersistedState() {
        const wantsFs = localStorage.getItem('quetta_fs_locked') === 'true' || 
                        sessionStorage.getItem('quetta_fs_session') === 'true';

        if (wantsFs) {
            const triggerRestore = (e) => {
                // Don't auto-trigger if we are clicking our own menu
                if (e.composedPath().includes(host)) return;
                
                // Double check that the user hasn't turned it off in the split second before interacting
                const stillWantsFs = localStorage.getItem('quetta_fs_locked') === 'true' || 
                                     sessionStorage.getItem('quetta_fs_session') === 'true';
                
                if (stillWantsFs && !document.fullscreenElement) {
                    document.documentElement.requestFullscreen().catch(() => {});
                }
                
                // Once triggered, remove the listeners so they don't fire constantly
                ['click', 'touchstart', 'pointerdown', 'scroll'].forEach(evt => {
                    window.removeEventListener(evt, triggerRestore, true);
                });
            };

            ['click', 'touchstart', 'pointerdown', 'scroll'].forEach(evt => {
                window.addEventListener(evt, triggerRestore, { capture: true, passive: true });
            });
        }
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
