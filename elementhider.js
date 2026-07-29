// ==UserScript==
// @name         Via Element Hider
// @namespace    http://tampermonkey.net/
// @version      2.1
// @description  figure it out low iq autist
// @author       You
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    const STORAGE_KEY = 'via_global_hidden_elements';
    let pressTimer;
    let isSelectionMode = false;
    let tempHiddenElements = [];
    let host = window.location.hostname;

    // --- Global Storage Wrappers ---
    function loadData() {
        try {
            if (typeof GM_getValue !== 'undefined') {
                const gmData = GM_getValue(STORAGE_KEY);
                if (gmData) return JSON.parse(gmData);
            }
            const localData = localStorage.getItem(STORAGE_KEY);
            if (localData) return JSON.parse(localData);
        } catch (e) {
            console.error("Via Hider: Error loading data", e);
        }
        return {};
    }

    function saveData(dataObj) {
        try {
            if (typeof GM_setValue !== 'undefined') {
                GM_setValue(STORAGE_KEY, JSON.stringify(dataObj));
            } else {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(dataObj));
            }
        } catch (e) {
            console.error("Via Hider: Error saving data", e);
        }
    }

    // --- Layout Collapse & DOM Removal ---
    function applySavedFilters() {
        try {
            const saved = loadData();
            const siteFilters = Array.isArray(saved[host]) ? saved[host] : [];
            
            // 1. Inject Aggressive CSS to guarantee space collapses ("fullscreen" effect)
            let styleTag = document.getElementById('via-hider-applied-styles');
            if (styleTag) styleTag.remove();
            
            if (siteFilters.length > 0) {
                styleTag = document.createElement('style');
                styleTag.id = 'via-hider-applied-styles';
                
                const aggressiveCSS = ` {
                    display: none !important;
                    visibility: hidden !important;
                    opacity: 0 !important;
                    width: 0 !important;
                    height: 0 !important;
                    min-width: 0 !important;
                    min-height: 0 !important;
                    max-width: 0 !important;
                    max-height: 0 !important;
                    padding: 0 !important;
                    margin: 0 !important;
                    position: absolute !important; 
                    z-index: -9999 !important;
                    pointer-events: none !important;
                }`;
                
                styleTag.textContent = siteFilters.map(selector => `${selector}${aggressiveCSS}`).join('\n');
                
                const inject = () => {
                    if (document.head) document.head.appendChild(styleTag);
                    else if (document.documentElement) document.documentElement.appendChild(styleTag);
                    else setTimeout(inject, 50);
                };
                inject();

                // 2. Physically remove elements from DOM (StackOverflow #44413284)
                const removeElements = () => {
                    siteFilters.forEach(selector => {
                        try {
                            const matchedElements = document.querySelectorAll(selector);
                            for (let j = 0; j < matchedElements.length; j++) {
                                const matchedElem = matchedElements[j];
                                if (matchedElem && matchedElem.parentNode) {
                                    matchedElem.parentNode.removeChild(matchedElem);
                                }
                            }
                        } catch(e) {} // Catch invalid selectors silently
                    });
                };

                removeElements();
                
                // Observe dynamic content loading (Infinite scrolling)
                if (!window.viaHiderObserver) {
                    window.viaHiderObserver = new MutationObserver(() => removeElements());
                    const startObserver = () => {
                        if (document.documentElement) {
                            window.viaHiderObserver.observe(document.documentElement, { childList: true, subtree: true });
                        } else {
                            setTimeout(startObserver, 50);
                        }
                    };
                    startObserver();
                }
            } else if (window.viaHiderObserver) {
                window.viaHiderObserver.disconnect();
                window.viaHiderObserver = null;
            }
        } catch (err) {
            console.error("Via Hider: Error applying filters", err);
        }
    }

    applySavedFilters();
    window.addEventListener('DOMContentLoaded', applySavedFilters);

    // Single Page Application (SPA) Navigation Support
    // Retriggers rules when you click a link but the page doesn't hard-reload
    window.addEventListener('popstate', applySavedFilters);
    const originalPushState = history.pushState;
    history.pushState = function() {
        originalPushState.apply(this, arguments);
        applySavedFilters();
    };
    const originalReplaceState = history.replaceState;
    history.replaceState = function() {
        originalReplaceState.apply(this, arguments);
        applySavedFilters();
    };

    const escapeCSS = (str) => {
        return (window.CSS && window.CSS.escape) ? CSS.escape(str) : str;
    };

    // --- Smarter CSS Path Generator (Global Website Targeter) ---
    function getCssPath(el) {
        if (!(el instanceof Element)) return null;
        let path = [];
        let current = el;
        
        // Limit to 3 levels deep to create broad rules that work on every page of the site
        for (let i = 0; i < 3; i++) {
            if (!current || current.nodeName.toLowerCase() === 'html') break;

            let selector = current.nodeName.toLowerCase();

            // 1. Prioritize IDs (Ignore long random numbers often used dynamically)
            if (current.id && !/\d{4,}/.test(current.id)) {
                selector += '#' + escapeCSS(current.id);
                path.unshift(selector);
                break; // IDs are unique, no need to go higher
            }
            
            // 2. Prioritize Classes
            if (current.className && typeof current.className === 'string') {
                let classes = current.className.trim().split(/\s+/).filter(c => 
                    c && c !== 'via-temp-hidden' && !/^(active|hover|focus|visited|link|dark|light)$/i.test(c)
                );
                
                if (classes.length > 0) {
                    // Use up to 3 classes to prevent rule breakage on other pages
                    selector += '.' + classes.slice(0, 3).map(c => escapeCSS(c)).join('.');
                    path.unshift(selector);
                    current = current.parentNode;
                    continue;
                }
            }

            // 3. Fallback to positional tracking if no ID/Class exists
            let sib = current, nth = 1;
            while (sib = sib.previousElementSibling) {
                if (sib.nodeName.toLowerCase() === current.nodeName.toLowerCase()) nth++;
            }
            if (nth > 1) selector += `:nth-of-type(${nth})`;
            
            path.unshift(selector);
            current = current.parentNode;
        }
        
        return path.join(" > ");
    }

    // --- UI Creation ---
    const injectUI = () => {
        if (document.getElementById('via-hider-toolbar')) return;
        
        const uiStyle = document.createElement('style');
        uiStyle.textContent = `
            #via-hider-toolbar {
                position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%);
                background: #2b3036; border-radius: 12px; display: flex; align-items: center;
                padding: 8px 12px; z-index: 2147483647; box-shadow: 0 4px 15px rgba(0,0,0,0.5);
                gap: 15px; transition: opacity 0.2s;
            }
            #via-hider-toolbar.hidden { display: none; }
            .via-btn {
                background: transparent; border: none; padding: 8px; color: #fff;
                display: flex; align-items: center; justify-content: center;
                border-radius: 50%; width: 40px; height: 40px; cursor: pointer;
            }
            .via-btn:active { background: rgba(255,255,255,0.1); }
            .via-btn.active-btn { background: #4a5159; border-radius: 8px; }
            .via-icon { width: 22px; height: 22px; fill: currentColor; pointer-events: none; }
            
            #via-hider-settings {
                position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                background: #000; z-index: 2147483647; display: flex; flex-direction: column;
                color: #fff; font-family: sans-serif; box-sizing: border-box;
            }
            #via-hider-settings.hidden { display: none; }
            .via-settings-header {
                display: flex; align-items: center; padding: 16px; font-size: 18px; font-weight: bold;
            }
            .via-settings-back {
                background: none; border: none; color: #fff; font-size: 24px; margin-right: 16px; padding: 4px; cursor: pointer;
            }
            .via-settings-body { padding: 16px; overflow-y: auto; flex: 1; }
            
            .via-card-dark {
                background: #2a2a2a; border-radius: 12px; padding: 16px; margin-bottom: 16px;
                word-wrap: break-word; font-family: monospace; font-size: 14px; color: #ccc;
                max-height: 150px; overflow-y: auto; line-height: 1.4;
            }
            .via-filter-text { color: #ff6b6b; font-size: 14px; margin-bottom: 16px; display: block;}
            
            .via-item-row {
                background: #1a1a1a; border-radius: 16px; padding: 16px; margin-bottom: 10px;
                display: flex; align-items: center; justify-content: space-between; cursor: pointer;
                transition: background 0.1s;
            }
            .via-item-row:active { background: #252525; }
            .via-item-icon {
                width: 40px; height: 40px; border-radius: 50%; background: #332233; color: #ff66aa;
                display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 16px; flex-shrink: 0;
            }
            .via-item-info { flex: 1; margin: 0 12px; overflow: hidden; }
            .via-item-title { font-size: 16px; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .via-item-sub { font-size: 12px; color: #888; margin: 4px 0 0 0; }
            .via-item-delete {
                background: none; border: none; color: #ff4444; font-size: 20px; padding: 8px; cursor: pointer;
            }
            .via-item-delete > svg { pointer-events: none; }
            
            .via-temp-hidden { opacity: 0.2 !important; outline: 2px dashed red !important; pointer-events: none !important; }
            
            /* Fullscreen Layout Stretch Fix & Shorts-like Swiper */
            :fullscreen body, :fullscreen html { padding: 0 !important; margin: 0 !important; max-width: 100% !important; overflow-x: hidden !important; scroll-snap-type: y mandatory !important; overflow-y: scroll !important; }
            :-webkit-full-screen body, :-webkit-full-screen html { padding: 0 !important; margin: 0 !important; max-width: 100% !important; overflow-x: hidden !important; scroll-snap-type: y mandatory !important; overflow-y: scroll !important; }
            
            :fullscreen *:has(video), :-webkit-full-screen *:has(video) { height: auto !important; min-height: 100vh !important; max-height: none !important; overflow: visible !important; flex-shrink: 0 !important; contain: none !important; }
            
            :fullscreen video, :-webkit-full-screen video { width: 100vw !important; height: 100vh !important; min-height: 100vh !important; min-width: 100vw !important; object-fit: cover !important; margin: 0 !important; padding: 0 !important; display: block !important; flex-shrink: 0 !important; scroll-snap-align: start !important; pointer-events: none !important; position: relative !important; z-index: 9999 !important; }
            
            :fullscreen body.via-aspect-contain video, :-webkit-full-screen body.via-aspect-contain video { object-fit: contain !important; }
        `;
        document.head.appendChild(uiStyle);

        // Toolbar HTML
        const toolbar = document.createElement('div');
        toolbar.id = 'via-hider-toolbar';
        toolbar.className = 'hidden';
        toolbar.innerHTML = `
            <button class="via-btn" id="via-close"><svg class="via-icon" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg></button>
            <button class="via-btn active-btn" id="via-undo"><svg class="via-icon" viewBox="0 0 24 24"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg></button>
            <button class="via-btn" id="via-preview"><svg class="via-icon" viewBox="0 0 24 24"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg></button>
            <button class="via-btn" id="via-fullscreen"><svg class="via-icon" viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg></button>
            <button class="via-btn" id="via-aspect"><svg class="via-icon" viewBox="0 0 24 24"><path d="M19 12h-2v3h-3v2h5v-5zM7 9h3V7H5v5h2V9zm14-6H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16.01H3V4.99h18v14.02z"/></svg></button>
            <button class="via-btn" id="via-settings-btn"><svg class="via-icon" viewBox="0 0 24 24"><path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.06-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.73,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.06,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.43-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.49-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/></svg></button>
            <button class="via-btn" id="via-confirm"><svg class="via-icon" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg></button>
        `;
        document.body.appendChild(toolbar);

        // --- Draggable Toolbar Logic ---
        let dragActive = false, currentX, currentY, initialX, initialY, xOffset = 0, yOffset = 0;

        const dragStart = (e) => {
            initialX = (e.type === "touchstart" ? e.touches[0].clientX : e.clientX) - xOffset;
            initialY = (e.type === "touchstart" ? e.touches[0].clientY : e.clientY) - yOffset;
            dragActive = true;
        };

        const dragEnd = () => { dragActive = false; };

        const drag = (e) => {
            if (dragActive) {
                e.preventDefault(); // Prevents page scrolling while dragging the toolbar
                currentX = (e.type === "touchmove" ? e.touches[0].clientX : e.clientX) - initialX;
                currentY = (e.type === "touchmove" ? e.touches[0].clientY : e.clientY) - initialY;
                xOffset = currentX;
                yOffset = currentY;
                // Merge offsets with the initial bottom-center CSS transform logic
                toolbar.style.transform = `translate(calc(-50% + ${currentX}px), ${currentY}px)`;
            }
        };

        // Touch Events for Mobile
        toolbar.addEventListener("touchstart", dragStart, { passive: false });
        toolbar.addEventListener("touchend", dragEnd);
        toolbar.addEventListener("touchmove", drag, { passive: false });

        // Mouse Events for testing/desktop compatibility
        toolbar.addEventListener("mousedown", dragStart);
        window.addEventListener("mouseup", dragEnd);
        window.addEventListener("mousemove", drag, { passive: false });
        // -------------------------------

        // Settings HTML
        const settingsMenu = document.createElement('div');
        settingsMenu.id = 'via-hider-settings';
        settingsMenu.className = 'hidden';
        settingsMenu.innerHTML = `
            <div class="via-settings-header">
                <button class="via-settings-back" id="via-settings-close">←</button>
                Create custom filters
            </div>
            <div class="via-settings-body">
                <div class="via-card-dark" id="via-rules-preview">Tap a website below to view its filters.</div>
                <span class="via-filter-text">Be sure to use the Content Filter Syntax</span>
                <div id="via-site-list"></div>
            </div>
        `;
        document.body.appendChild(settingsMenu);
        attachUIListeners();
    };

    window.addEventListener('DOMContentLoaded', injectUI);

    // --- Core Interaction Logic ---
    function startSelectionMode() {
        if (!document.getElementById('via-hider-toolbar')) injectUI();
        isSelectionMode = true;
        document.getElementById('via-hider-toolbar').classList.remove('hidden');
        document.addEventListener('click', captureClick, true);
    }

    function stopSelectionMode() {
        isSelectionMode = false;
        document.getElementById('via-hider-toolbar').classList.add('hidden');
        document.removeEventListener('click', captureClick, true);
        tempHiddenElements.forEach(el => {
            if(el && el.classList) el.classList.remove('via-temp-hidden');
        });
        tempHiddenElements = [];
    }

    function captureClick(e) {
        if (!isSelectionMode) return;
        if (e.target.closest('#via-hider-toolbar') || e.target.closest('#via-hider-settings')) return;

        e.preventDefault();
        e.stopPropagation();

        const el = e.target;
        el.classList.add('via-temp-hidden');
        tempHiddenElements.push(el);
    }

    // --- UI Listeners & Settings Management ---
    function renderSettingsList() {
        const saved = loadData();
        const listContainer = document.getElementById('via-site-list');
        listContainer.innerHTML = '';
        
        const domains = Object.keys(saved).filter(key => Array.isArray(saved[key]) && saved[key].length > 0);
        
        if (domains.length === 0) {
            listContainer.innerHTML = '<p style="color:#888;text-align:center;margin-top:20px;">No custom filters found across any website.</p>';
            document.getElementById('via-rules-preview').textContent = 'No data available.';
            return;
        }

        domains.forEach(domain => {
            const count = saved[domain].length;
            const row = document.createElement('div');
            row.className = 'via-item-row';
            row.dataset.domain = domain;
            
            row.innerHTML = `
                <div class="via-item-icon">${domain.substring(0,2).toUpperCase()}</div>
                <div class="via-item-info">
                    <p class="via-item-title">${domain}</p>
                    <p class="via-item-sub">${count} item(s) have been marked</p>
                </div>
                <button class="via-item-delete" data-domain="${domain}">
                    <svg style="width:24px;height:24px;fill:currentColor" viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                </button>
            `;
            
            row.addEventListener('click', (e) => {
                if (e.target.closest('.via-item-delete')) return; 
                const siteData = loadData()[domain] || [];
                const previewStr = siteData.length > 0 ? `${domain}##` + siteData.join('\n' + domain + '##') : 'No active filters.';
                document.getElementById('via-rules-preview').textContent = previewStr;
            });
            
            const deleteBtn = row.querySelector('.via-item-delete');
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const latestData = loadData();
                delete latestData[domain];
                saveData(latestData);
                
                if (domain === host) {
                    location.reload(); 
                } else {
                    renderSettingsList(); 
                }
            });
            
            listContainer.appendChild(row);
        });

        if (saved[host] && saved[host].length > 0) {
            document.getElementById('via-rules-preview').textContent = `${host}##` + saved[host].join('\n' + host + '##');
        }
    }

    function attachUIListeners() {
        document.getElementById('via-close').addEventListener('click', stopSelectionMode);

        document.getElementById('via-undo').addEventListener('click', () => {
            if (tempHiddenElements.length > 0) {
                const el = tempHiddenElements.pop();
                if(el && el.classList) el.classList.remove('via-temp-hidden');
            }
        });

        document.getElementById('via-confirm').addEventListener('click', () => {
            try {
                if (tempHiddenElements.length > 0) {
                    const saved = loadData();
                    const siteFilters = Array.isArray(saved[host]) ? saved[host] : [];
                    
                    tempHiddenElements.forEach(el => {
                        if (el && el.classList) el.classList.remove('via-temp-hidden');
                        const selector = getCssPath(el);
                        if (selector && !siteFilters.includes(selector)) {
                            siteFilters.push(selector);
                        }
                    });
                    
                    saved[host] = siteFilters;
                    saveData(saved);
                    applySavedFilters();
                }
            } catch (err) {
                console.error("Via Hider: Failed to confirm and save.", err);
            } finally {
                stopSelectionMode();
            }
        });
        
        // Setup Fullscreen toggling logic
        document.getElementById('via-fullscreen').addEventListener('click', () => {
            const docElm = document.documentElement;
            // Determine primary orientation (portrait vs landscape) to securely lock it without failing
            const targetOrientation = window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
        
            if (!document.fullscreenElement && !document.webkitFullscreenElement) {
                const fsPromise = docElm.requestFullscreen 
                    ? docElm.requestFullscreen() 
                    : (docElm.webkitRequestFullscreen ? Promise.resolve(docElm.webkitRequestFullscreen()) : Promise.resolve());
                
                fsPromise.then(() => {
                    // Lock to the general orientation to prevent Chrome's auto-landscape rotation
                    if (screen.orientation && screen.orientation.lock) {
                        screen.orientation.lock(targetOrientation).catch(()=>{});
                    }
                    
                    // Force a layout recalculation so the page stretches into the missing header's space
                    window.dispatchEvent(new Event('resize'));
                }).catch(()=>{});
            } else {
                const exitPromise = document.exitFullscreen 
                    ? document.exitFullscreen() 
                    : (document.webkitExitFullscreen ? Promise.resolve(document.webkitExitFullscreen()) : Promise.resolve());
                                    
                exitPromise.then(() => {
                    if (screen.orientation && screen.orientation.unlock) {
                        screen.orientation.unlock();
                    }
                }).catch(()=>{});
            }
        });

        // Setup Aspect Ratio toggling logic
        document.getElementById('via-aspect').addEventListener('click', () => {
            document.body.classList.toggle('via-aspect-contain');
        });

        document.getElementById('via-settings-btn').addEventListener('click', () => {
            renderSettingsList();
            document.getElementById('via-hider-settings').classList.remove('hidden');
        });
        
        document.getElementById('via-settings-close').addEventListener('click', () => {
            document.getElementById('via-hider-settings').classList.add('hidden');
        });
    }

    // --- Long Press Detection ---
    window.addEventListener('touchstart', (e) => {
        if (e.target.closest('#via-hider-toolbar') || e.target.closest('#via-hider-settings')) return;
        
        pressTimer = setTimeout(() => {
            startSelectionMode();
            if (navigator.vibrate) navigator.vibrate(50);
        }, 4000);
    });

    window.addEventListener('touchend', () => clearTimeout(pressTimer));
    window.addEventListener('touchmove', () => clearTimeout(pressTimer));
    window.addEventListener('touchcancel', () => clearTimeout(pressTimer));

})();
