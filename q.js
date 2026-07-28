// ==UserScript==
// @name         Quetta Indestructible Fullscreen Button
// @namespace    http://tampermonkey.net/
// @version      4.0
// @description  Unkillable fullscreen button with a transparent control panel, session toggles, and permanent keep-alive states.
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
            background: rgba(0, 0, 0, 0.65) !important; /* Transparent dark background */
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
            display: none; /* Hidden by default */
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
            color: rgba(255, 255, 255, 0.9) !important; /* Improved visibility */
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

    // 1. Open/Close Control Panel
    let isMenuOpen = false;
    toggle.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        isMenuOpen = !isMenuOpen;
        panel.style.setProperty('display', isMenuOpen ? 'flex' : 'none', 'important');
        toggle.innerHTML = isMenuOpen ? '&gt;' : '&lt;';
    });

    // 2. Update button texts and colors based on state
    function updateStateUI() {
        const isFs = !!document.fullscreenElement;
        const isLocked = localStorage.getItem('quetta_fs_locked') === 'true';

        // Update Session Fullscreen Button
        btnFs.textContent = isFs ? 'FS Session: ON' : 'FS Session: OFF';
        btnFs.className = isFs ? 'status-on' : 'status-off';

        // Update Permanent Lock Button
        btnLock.textContent = isLocked ? 'Permanent: ON' : 'Permanent: OFF';
        btnLock.className = isLocked ? 'status-on' : 'status-off';
    }

    // 3. Session Fullscreen Toggle Click
    btnFs.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
        } else {
            document.exitFullscreen().catch(() => {});
        }
    });

    // 4. Permanent Lock Toggle Click
    btnLock.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const isLocked = localStorage.getItem('quetta_fs_locked') === 'true';
        localStorage.setItem('quetta_fs_locked', !isLocked); // Toggle state
        updateStateUI();
    });

    document.addEventListener('fullscreenchange', updateStateUI);
    updateStateUI(); // Initial UI update

    // --- PERSISTENT KEEP-ALIVE LOGIC ---
    // If "Permanent: ON" is active, it waits for your first interaction (click/scroll)
    // on a new page to force it back into fullscreen automatically.
    function checkPersistedState() {
        if (localStorage.getItem('quetta_fs_locked') === 'true') {
            const triggerRestore = (e) => {
                // Don't auto-trigger if we are clicking our own menu
                if (e.composedPath().includes(host)) return;
                
                if (!document.fullscreenElement) {
                    document.documentElement.requestFullscreen().catch(() => {});
                }
                
                // Once triggered, remove the event listeners so it doesn't fire constantly
                ['click', 'touchstart', 'pointerdown', 'scroll'].forEach(evt => {
                    window.removeEventListener(evt, triggerRestore, true);
                });
            };

            // Attach passive listeners to catch the very first interaction
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

    // Keep it alive every second
    setInterval(revive, 1000);
    
    // Fast init to set it up immediately when the page starts loading
    const fastInit = setInterval(() => {
        if (document.documentElement) {
            revive();
            checkPersistedState();
            clearInterval(fastInit);
        }
    }, 50);

})();
