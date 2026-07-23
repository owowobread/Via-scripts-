// ==UserScript==
// @name         Instagram Ultimate Nuke v49.2 (Infinite Carousel & Icon Dynamic Sync)
// @namespace    https://viayoo.com/
// @version      49.2.1
// @description  UI hide fixed. Action row converted to infinite swipe carousel. Dynamic Home/Reels icon sync. Profile scraper fixed for Reels.
// @author       You
// @run-at       document-start
// @match        https://*.instagram.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const fallbackAvatar = "data:image/svg+xml;charset=UTF-8,%3csvg viewBox='0 0 24 24' fill='%23ffffff' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z'/%3e%3c/svg%3e";

    // =========================================================================
    // 0. POPUP TAB BOT WORKER
    // =========================================================================
    if (window.location.search.includes('auto_save_bot=true')) {
        document.documentElement.style.opacity = '0'; document.documentElement.style.pointerEvents = 'none';
        let botAttempts = 0;
        const botInt = setInterval(() => {
            botAttempts++; if (botAttempts > 200) { clearInterval(botInt); localStorage.setItem('ig_bot_result', 'timeout'); window.close(); return; }
            const svgs = document.querySelectorAll('svg');
            for (let svg of svgs) {
                let label = (svg.getAttribute('aria-label') || '').trim();
                if (label === 'Save' || label === 'Remove') {
                    clearInterval(botInt); const btn = svg.closest('button, [role="button"], a') || svg;
                    btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); btn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })); btn.click();
                    localStorage.setItem('ig_bot_result', label === 'Remove' ? 'removed' : 'saved'); setTimeout(() => window.close(), 800); return;
                }
                const poly = svg.querySelector('polygon'); const path = svg.querySelector('path');
                if ((poly && poly.getAttribute('points') && poly.getAttribute('points').includes('20 21 12')) || (path && path.getAttribute('d') && path.getAttribute('d').includes('20 21 12'))) {
                    clearInterval(botInt); const btn = svg.closest('button, [role="button"], a') || svg;
                    btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); btn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })); btn.click();
                    localStorage.setItem('ig_bot_result', 'toggled'); setTimeout(() => window.close(), 800); return;
                }
            }
        }, 50); return; 
    }

    // =========================================================================
    // 1. ENGINE PRESERVATION (KILL ADAPTIVE STREAMING)
    // =========================================================================
    try { Object.defineProperty(window, 'MediaSource', { get: () => undefined }); Object.defineProperty(window, 'WebKitMediaSource', { get: () => undefined }); } catch (e) {}

    function nukeLowQuality(obj) {
        if (!obj || typeof obj !== 'object') return;
        if (obj.dash_manifest) delete obj.dash_manifest;
        if (Array.isArray(obj.video_versions) && obj.video_versions.length > 0) {
            let staticFiles = obj.video_versions.filter(v => v.url && !v.url.includes('.m3u8') && !v.url.includes('.mpd'));
            if (staticFiles.length > 0) { staticFiles.sort((a, b) => ((b.width || 0) * (b.height || 0)) - ((a.width || 0) * (a.height || 0))); obj.video_versions = [staticFiles[0]]; }
        }
        for (const key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { if (typeof obj[key] === 'object' && obj[key] !== null) nukeLowQuality(obj[key]); } }
    }

    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
        const url = args[0] && typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url ? args[0].url : '');
        const response = await originalFetch.apply(this, args);
        if (url.includes('/graphql/') || url.includes('/api/')) {
            try { const clone = response.clone(); const json = await clone.json(); nukeLowQuality(json); return new Response(JSON.stringify(json), { status: response.status, statusText: response.statusText, headers: response.headers }); } catch (e) { return response; }
        }
        return response;
    };

    const originalPlay = HTMLVideoElement.prototype.play;
    HTMLVideoElement.prototype.play = function() {
        this.preload = 'auto';
        if (this.readyState < 3) {
            return new Promise((resolve, reject) => {
                const playWhenReady = () => { this.removeEventListener('canplay', playWhenReady); this.removeEventListener('canplaythrough', playWhenReady); originalPlay.apply(this).then(resolve).catch(reject); };
                this.addEventListener('canplaythrough', playWhenReady); this.addEventListener('canplay', playWhenReady); this.load(); 
            });
        }
        return originalPlay.apply(this);
    };

    // =========================================================================
    // SPA ROUTER: IDENTIFY IF WE ARE ON A VIDEO OR A GRID
    // =========================================================================
    const isVideoPage = () => {
        const p = window.location.pathname;
        return p === '/' || /\/(p|reel|reels|tv)\//.test(p);
    };

    // =========================================================================
    // MEDIA SELECTORS
    // =========================================================================
    const getActiveVideoFromCenter = () => {
        const mediaElements = Array.from(document.querySelectorAll('video'));
        let activeMedia = null; let minDistance = Infinity; const centerY = window.innerHeight / 2;
        mediaElements.forEach(media => { 
            const rect = media.getBoundingClientRect(); if (rect.height === 0 || rect.width === 0) return; 
            const distance = Math.abs(centerY - (rect.top + rect.height / 2)); 
            if (distance < minDistance) { minDistance = distance; activeMedia = media; } 
        });
        return activeMedia;
    };

    const getActiveMediaFromCenter = () => {
        const mediaElements = Array.from(document.querySelectorAll('video, img:not([alt*="profile" i])'));
        let activeMedia = null; let minDistance = Infinity; const centerY = window.innerHeight / 2;
        mediaElements.forEach(media => { 
            const rect = media.getBoundingClientRect(); if (rect.height === 0 || rect.width === 0) return; 
            const distance = Math.abs(centerY - (rect.top + rect.height / 2)); 
            if (distance < minDistance) { minDistance = distance; activeMedia = media; } 
        });
        return activeMedia;
    };

    // =========================================================================
    // 2. MAIN SCRIPT & BOTTOM UI CONSTRUCTION
    // =========================================================================
    document.addEventListener("DOMContentLoaded", () => {
        let currentPlaybackSpeed = parseFloat(localStorage.getItem('ig_nuke_speed')) || 1;
        
        let storedMute = localStorage.getItem('ig_nuke_muted');
        let globalMuteState = storedMute !== null ? storedMute === 'true' : false; 
        
        let isMasterEnabled = localStorage.getItem('ig_nuke_master_state') !== 'false';
        let controlsVisible = localStorage.getItem('ig_nuke_ui_visible') !== 'false';
        
        const isSpecificPostInit = /\/(p|reel|reels|tv)\/([^\/?]+)/.test(window.location.pathname);
        if (!isSpecificPostInit) { localStorage.removeItem('ig_nuke_playlist'); localStorage.removeItem('ig_nuke_playlist_time'); }
        
        [{ name: "screen-orientation", content: "portrait" }, { name: "x5-orientation", content: "portrait" }, { name: "orientation", content: "portrait" }].forEach(m => { let meta = document.createElement('meta'); meta.name = m.name; meta.content = m.content; document.head.appendChild(meta); });

        // --- CORE CSS ---
        const qualityStyle = document.createElement('style'); qualityStyle.id = 'ig-max-quality-css';
        qualityStyle.innerHTML = `video, img { filter: none !important; image-rendering: high-quality !important; -webkit-font-smoothing: antialiased !important; }`;
        document.head.appendChild(qualityStyle);

        const globalStyle = document.createElement('style'); globalStyle.id = 'ig-global-override';
        globalStyle.innerHTML = `
            :not(#ig-bottom-ui):not(#ig-bottom-ui *):not(#ig-master-rescue-fab):not(#ig-master-rescue-fab *) > nav, :not(#ig-bottom-ui):not(#ig-bottom-ui *):not(#ig-master-rescue-fab):not(#ig-master-rescue-fab *) > header, :not(#ig-bottom-ui):not(#ig-bottom-ui *):not(#ig-master-rescue-fab):not(#ig-master-rescue-fab *) > footer, :not(#ig-bottom-ui):not(#ig-bottom-ui *):not(#ig-master-rescue-fab):not(#ig-master-rescue-fab *) > [role="navigation"], :not(#ig-bottom-ui):not(#ig-bottom-ui *):not(#ig-master-rescue-fab):not(#ig-master-rescue-fab *) > [role="tablist"], :not(#ig-bottom-ui):not(#ig-bottom-ui *):not(#ig-master-rescue-fab):not(#ig-master-rescue-fab *) > [role="banner"],
            svg:not(#ig-bottom-ui svg):not(#ig-master-rescue-fab svg), button:not(#ig-bottom-ui button):not(#ig-master-rescue-fab), [role="button"]:not(#ig-bottom-ui [role="button"]), img[alt*="profile" i]:not(#ig-bottom-ui img), span:not(#ig-bottom-ui span), h1, h2, h3, p, time, marquee {
                display: none !important; opacity: 0 !important; pointer-events: none !important;
            }
            [role="progressbar"] { opacity: 0 !important; pointer-events: none !important; height: 1px !important; margin: 10px 0 !important; }
            div[style*="position: fixed"][style*="bottom"]:not(#ig-bottom-ui):not(#ig-bottom-ui *):not(#ig-scrubber-bar):not(#ig-master-rescue-fab), div[style*="position:fixed"][style*="bottom"]:not(#ig-bottom-ui):not(#ig-bottom-ui *):not(#ig-scrubber-bar):not(#ig-master-rescue-fab), div[style*="position: fixed"][style*="top"]:not(#ig-bottom-ui):not(#ig-bottom-ui *), div[style*="position:fixed"][style*="top"]:not(#ig-bottom-ui):not(#ig-bottom-ui *) {
                display: none !important; opacity: 0 !important; pointer-events: none !important;
            }
            
            html, body, #react-root, #react-root > div, #react-root > div > div, main, section {
                background-color: #000 !important;
                margin: 0 !important;
                padding: 0 !important;
                border: none !important;
                box-sizing: border-box !important;
            }

            html {
                scroll-snap-type: y mandatory !important;
                scroll-behavior: smooth !important;
            }

            article, div[role="dialog"] {
                scroll-snap-align: start !important; 
                scroll-snap-stop: always !important; 
                position: relative !important;
                width: 100vw !important;
                height: 100dvh !important;
                max-height: 100dvh !important;
                overflow: hidden !important; 
                z-index: 99990 !important;
                margin: 0 !important;
                padding: 0 !important;
                border: none !important;
            }
        `;
        document.head.appendChild(globalStyle);

        const ratioStyle = document.createElement('style'); ratioStyle.id = 'ig-ratio-override'; document.head.appendChild(ratioStyle);
        const targetFeed = `article video:not(a video), article img:not([alt*="profile" i]):not(a img)`;
        const targetModal = `div[role="dialog"] video:not(a video), div[role="dialog"] img:not([alt*="profile" i]):not(a img)`;
        
        const modes = [
            { name: "Mode: Cover Fullscreen", css: `
                article div, div[role="dialog"] div,
                article ul, div[role="dialog"] ul,
                article li, div[role="dialog"] li,
                article picture, div[role="dialog"] picture,
                article figure, div[role="dialog"] figure {
                    position: static !important;
                    width: 100% !important;
                    height: 100% !important;
                    padding: 0 !important;
                    margin: 0 !important;
                    transform: none !important;
                    overflow: visible !important;
                    clip-path: none !important;
                }
                ${targetFeed}, ${targetModal} { 
                    position: absolute !important; 
                    top: 0 !important; 
                    left: 0 !important; 
                    width: 100vw !important; 
                    height: 100vh !important; 
                    max-width: 100vw !important; 
                    max-height: 100vh !important; 
                    object-fit: cover !important; 
                    object-position: center !important; 
                    aspect-ratio: auto !important; 
                    z-index: 99995 !important; 
                    background: transparent !important; 
                    border: none !important; 
                    margin: 0 !important; 
                    padding: 0 !important; 
                    border-radius: 0 !important; 
                    transform: none !important; 
                }
            `},
            { name: "Mode: Original Size", css: `
                ${targetFeed}, ${targetModal} { 
                    position: absolute !important; 
                    top: 50% !important; 
                    left: 50% !important; 
                    transform: translate(-50%, -50%) !important; 
                    width: 100vw !important; 
                    height: auto !important; 
                    max-height: 100vh !important; 
                    object-fit: contain !important; 
                    aspect-ratio: auto !important; 
                    z-index: 99995 !important; 
                    background: transparent !important; 
                    border: none !important; 
                    margin: 0 !important; 
                    padding: 0 !important; 
                }
            `}
        ];
        let currentMode = 0; ratioStyle.innerHTML = modes[currentMode].css; 

        // --- BOTTOM UI STYLES ---
        const uiStyle = document.createElement('style');
        uiStyle.innerHTML = `
            #ig-bottom-ui { box-sizing: border-box; position: fixed; bottom: 0; left: 0; width: 100vw; max-width: 100%; display: flex; flex-direction: column; justify-content: flex-end; z-index: 9999999; padding: 20px 16px max(16px, env(safe-area-inset-bottom)); background: linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.7) 40%, transparent 100%); pointer-events: none; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; transition: opacity 0.2s ease-out; opacity: 1; }
            #ig-bottom-ui * { box-sizing: border-box; }
            .ig-pointer { pointer-events: auto; }
            
            .ig-profile-row { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; width: 100%; }
            .ig-avatar { width: 44px; height: 44px; border-radius: 50%; background: #333; border: 1.5px solid rgba(255,255,255,0.8); object-fit: cover; flex-shrink: 0; cursor: pointer; }
            .ig-user-info { display: flex; flex-direction: column; justify-content: center; cursor: pointer; flex-grow: 1; min-width: 0; }
            .ig-username { color: #fff; font-weight: 700; font-size: 15px; text-shadow: 0 1px 3px rgba(0,0,0,0.9); display: flex; align-items: center; gap: 4px; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            
            .ig-follow-btn { margin-left: auto; background: rgba(255,255,255,0.25); border: 1px solid rgba(255,255,255,0.5); color: #fff; font-weight: 700; border-radius: 9999px; padding: 6px 16px; font-size: 13px; cursor: pointer; backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); transition: all 0.2s ease; flex-shrink: 0; display: flex; align-items: center; gap: 4px; }
            .ig-follow-btn.following { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.25); color: rgba(255,255,255,0.6); }
            
            .ig-caption { color: #fff; font-size: 14px; text-shadow: 0 1px 2px rgba(0,0,0,0.8); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis; margin-bottom: 12px; line-height: 1.3; }
            
            .ig-action-row { display: flex; gap: 12px; overflow-x: hidden; padding-bottom: 4px; width: 100%; touch-action: pan-y; }
            .ig-action-row::-webkit-scrollbar { display: none; }
            
            .ig-action-btn { width: 40px; height: 40px; border-radius: 50%; border: none; background: rgba(255,255,255,0.15); backdrop-filter: blur(8px); color: #fff; cursor: pointer; display: flex; justify-content: center; align-items: center; transition: transform 0.1s, background 0.2s; padding: 0; flex-shrink: 0; }
            .ig-action-btn:active { transform: scale(0.85); }
            .ig-action-btn svg { width: 20px; height: 20px; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.5)); }
            .ig-speed-text { font-size: 14px; font-weight: bold; font-family: sans-serif; text-shadow: 0 1px 2px rgba(0,0,0,0.5); }
            
            #ig-toast { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,0.8); backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.1); color: white; padding: 12px 24px; border-radius: 30px; font-family: sans-serif; font-weight: bold; font-size: 14px; z-index: 10000002; opacity: 0; pointer-events: none; transition: opacity 0.2s; }
        `;
        document.head.appendChild(uiStyle);

        const bottomUI = document.createElement('div'); bottomUI.id = 'ig-bottom-ui';
        bottomUI.innerHTML = `
            <div class="ig-profile-row ig-pointer">
                <img class="ig-avatar" id="ui-avatar" src="${fallbackAvatar}" />
                <div class="ig-user-info" id="ui-profile-link">
                    <div class="ig-username"><span id="ui-username">Loading...</span></div>
                </div>
                <button class="ig-follow-btn" id="ui-btn-follow"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg> Follow</button>
            </div>
            <div class="ig-caption ig-pointer" id="ui-caption"></div>
            <div class="ig-action-row ig-pointer">
                <button class="ig-action-btn ig-speed-text" id="ui-btn-speed">1x</button>
                <button class="ig-action-btn" id="ui-btn-mute"><svg id="ui-icon-mute" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg></button>
                <button class="ig-action-btn" id="ui-btn-save"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg></button>
                <button class="ig-action-btn" id="ui-btn-aspect"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg></button>
                <button class="ig-action-btn" id="ui-btn-feed"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect><line x1="7" y1="2" x2="7" y2="22"></line><line x1="17" y1="2" x2="17" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line><line x1="2" y1="7" x2="7" y2="7"></line><line x1="2" y1="17" x2="7" y2="17"></line><line x1="17" y1="17" x2="22" y2="17"></line><line x1="17" y1="7" x2="22" y2="7"></line></svg></button>
                <button class="ig-action-btn" id="ui-btn-saved"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg></button>
                <button class="ig-action-btn" id="ui-btn-refresh"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2v6h-6"></path><path d="M21 13a9 9 0 1 1-3-7.7L21 8"></path></svg></button>
                <button class="ig-action-btn" id="ui-btn-autoscroll"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="7 13 12 18 17 13"></polyline><polyline points="7 6 12 11 17 6"></polyline></svg></button>
                <button class="ig-action-btn" id="ui-btn-master"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path><line x1="12" y1="2" x2="12" y2="12"></line></svg></button>
            </div>
            <div id="ig-toast"></div>
        `;
        document.body.appendChild(bottomUI);
        
        // --- INFINITE SCROLL CAROUSEL LOGIC ---
        const actionRow = bottomUI.querySelector('.ig-action-row');
        if (actionRow) {
            let dragStartX = 0;
            let dragAccumulator = 0;
            const dragThreshold = 35; 
            
            actionRow.addEventListener('touchstart', (e) => {
                dragStartX = e.touches[0].clientX;
                dragAccumulator = 0;
            }, { passive: true });
            
            actionRow.addEventListener('touchmove', (e) => {
                const currentX = e.touches[0].clientX;
                const diff = currentX - dragStartX;
                dragStartX = currentX;
                dragAccumulator += diff;
                
                if (dragAccumulator < -dragThreshold) {
                    actionRow.appendChild(actionRow.firstElementChild);
                    dragAccumulator = 0;
                } else if (dragAccumulator > dragThreshold) {
                    actionRow.insertBefore(actionRow.lastElementChild, actionRow.firstElementChild);
                    dragAccumulator = 0;
                }
            }, { passive: true });
            
            actionRow.addEventListener('wheel', (e) => {
                if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
                    e.preventDefault();
                    if (e.deltaX > 0) actionRow.appendChild(actionRow.firstElementChild);
                    else actionRow.insertBefore(actionRow.lastElementChild, actionRow.firstElementChild);
                }
            }, { passive: false });
        }

        if (!controlsVisible) {
            bottomUI.style.opacity = '0';
            Array.from(bottomUI.children).forEach(child => { child.style.pointerEvents = 'none'; });
        }

        // --- RESCUE FAB INJECTION ---
        const masterToggleFab = document.createElement('button');
        masterToggleFab.id = 'ig-master-rescue-fab';
        masterToggleFab.style.cssText = 'position:fixed;bottom:20px;right:20px;width:50px;height:50px;border-radius:50%;border:1px solid rgba(255,255,255,0.2);background:rgba(255,68,68,0.2);color:#ff4444;cursor:pointer;display:none;justify-content:center;align-items:center;box-shadow:0 4px 12px rgba(0,0,0,0.5);z-index:9999999;backdrop-filter:blur(10px);transition:all 0.3s ease;';
        masterToggleFab.innerHTML = `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path><line x1="12" y1="2" x2="12" y2="12"></line></svg>`;
        document.body.appendChild(masterToggleFab);

        masterToggleFab.onclick = () => {
            isMasterEnabled = true;
            localStorage.setItem('ig_nuke_master_state', true);
            syncMasterUIState();
            showToast('Normal Mode: OFF');
        };

        // --- SCRUBBER BAR INJECTION ---
        const scrubberBar = document.createElement('div');
        scrubberBar.id = 'ig-scrubber-bar';
        scrubberBar.style.cssText = 'position:fixed;bottom:0;left:0;height:3px;background:rgba(255,255,255,1);z-index:9999998;width:0%;pointer-events:none;box-shadow:0 -1px 5px rgba(0,0,0,0.7);transition:opacity 0.2s ease;opacity:0;';
        document.body.appendChild(scrubberBar);

        const toast = document.getElementById('ig-toast');
        let toastTimeout;
        const showToast = (msg, keepAlive = false) => {
            toast.innerText = msg; toast.style.opacity = '1';
            clearTimeout(toastTimeout);
            if (!keepAlive) toastTimeout = setTimeout(() => toast.style.opacity = '0', 1500);
        };

        function extractShortcode(element) {
            let node = element;
            for (let i = 0; i < 15; i++) {
                if (!node) break;
                const reactKey = Object.keys(node).find(k => k.startsWith('__reactFiber$'));
                if (reactKey) {
                    let fiber = node[reactKey];
                    for (let j = 0; j < 20; j++) {
                        if (!fiber) break;
                        if (fiber.memoizedProps) { const p = fiber.memoizedProps; if (p.post && p.post.shortcode) return p.post.shortcode; if (p.media && p.media.code) return p.media.code; if (p.xdt_shortcode) return p.xdt_shortcode; if (p.shortcode) return p.shortcode; }
                        fiber = fiber.return;
                    }
                }
                node = node.parentElement;
            }
            return null;
        }

        // =========================================================================
        // DYNAMIC PROFILE SCRAPER ENGINE
        // =========================================================================
        const uiAvatar = document.getElementById('ui-avatar');
        const uiUsername = document.getElementById('ui-username');
        const uiCaption = document.getElementById('ui-caption');
        const uiFollowBtn = document.getElementById('ui-btn-follow');
        let currentExtractedMedia = null;

        function findAvatarFromDOM(root, username) {
            if (!root) root = document.body;
            const imgs = Array.from(root.querySelectorAll('img'));
            for (let img of imgs) { const alt = (img.getAttribute('alt') || '').toLowerCase(); const src = img.src || ''; if (src && username && alt.includes(username.toLowerCase())) return src; }
            for (let img of imgs) { const alt = (img.getAttribute('alt') || '').toLowerCase(); const src = img.src || ''; if (src && (alt.includes('profile') || alt.includes('picture') || alt.includes('avatar'))) return src; }
            for (let img of imgs) { const src = img.src || ''; if (src && (src.includes('s150x150') || src.includes('s320x320') || src.includes('150x150') || src.includes('cdninstagram'))) return src; }
            return fallbackAvatar;
        }

        function getProfileFromFiber(mediaEl) {
            let curr = mediaEl;
            for (let i = 0; i < 25; i++) {
                if (!curr) break;
                const keys = Object.keys(curr); const fiberKey = keys.find(k => k.startsWith('__reactFiber$') || k.startsWith('__reactProps$'));
                if (fiberKey) {
                    let fiber = curr[fiberKey];
                    for (let j = 0; j < 30; j++) {
                        if (!fiber) break;
                        const props = fiber.memoizedProps || fiber.pendingProps;
                        if (props) {
                            const candidates = [props.media, props.post, props.item, props.reel, props.xdt_shortcode, props.clips_item, props.user, props.owner, props];
                            for (let c of candidates) {
                                if (!c || typeof c !== 'object') continue;
                                const u = c.owner || c.user || c.author || (c.username ? c : null);
                                if (u && typeof u.username === 'string' && u.username.length > 0) {
                                    const cap = props.media?.caption?.text || props.post?.caption?.text || props.xdt_shortcode?.edge_media_to_caption?.edges?.[0]?.node?.text;
                                    
                                    let isFollow = null;
                                    if (u.followed_by_viewer === true || u.following === true || u.is_following === true || u.viewer_has_followed === true || u.has_viewer_followed === true || (u.friendship_status && (u.friendship_status.following === true || u.friendship_status.is_following === true))) isFollow = true;
                                    else if (u.followed_by_viewer === false || u.following === false || u.is_following === false || u.viewer_has_followed === false || u.has_viewer_followed === false || (u.friendship_status && (u.friendship_status.following === false || u.friendship_status.is_following === false))) isFollow = false;
                                    
                                    return { username: u.username, avatar: u.profile_pic_url || u.profile_pic_url_hd || u.profilePicUrl || '', isFollowing: isFollow, caption: cap || '' };
                                }
                            }
                        }
                        fiber = fiber.return;
                    }
                }
                curr = curr.parentElement;
            }
            return null;
        }

        const fetchProfileData = (media) => {
            if (!media) return null;
            
            // 1. Precise DOM Isolation: Walk up the tree to find the exact boundary box 
            // of THIS specific video. This prevents scraping data from off-screen reels.
            let container = media.closest('article, div[role="dialog"]');
            if (!container) {
                let temp = media;
                for (let i = 0; i < 20; i++) {
                    if (!temp || temp.tagName === 'MAIN' || temp.tagName === 'BODY') break;
                    // Stop navigating up when we reach the wrapper containing the creator's profile picture
                    if (temp.querySelector('img[alt*="\'s profile picture" i]')) {
                        container = temp;
                        break;
                    }
                    temp = temp.parentElement;
                }
                if (!container) container = media.closest('main, section') || media.parentElement?.parentElement?.parentElement || document.body;
            }
            
            let domFollowing = null;
            const buttons = Array.from(container.querySelectorAll('button, div[role="button"], a[role="button"]'));
            for (let btn of buttons) { 
                const txt = (btn.innerText || btn.textContent || '').trim().toLowerCase(); 
                if (txt === 'following' || txt === 'requested') { domFollowing = true; break; } 
                if (txt === 'follow' || txt === 'follow back') { domFollowing = false; break; } 
            }

            // Attempt 1: Fiber Data extraction (Works well on Feed)
            const fiberData = getProfileFromFiber(media);
            if (fiberData && fiberData.username) { 
                if (!fiberData.avatar) fiberData.avatar = findAvatarFromDOM(container, fiberData.username); 
                if (domFollowing !== null) { fiberData.isFollowing = domFollowing; } 
                else if (fiberData.isFollowing === null) { fiberData.isFollowing = true; }
                return fiberData; 
            }
            
            // Attempt 2: Direct Website DOM Scraping (Extremely robust for Reels)
            const ignoreList = new Set(['p', 'reel', 'reels', 'explore', 'direct', 'stories', 'audio', 'tags', 'your_activity', 'accounts', 'privacy', 'legal', 'about', 'help', 'api', 'graphql', '']);
            let foundUsername = ''; 
            let foundAvatar = '';

            // Extract using Instagram's native image alt text layout ("Username's profile picture")
            const imgs = Array.from(container.querySelectorAll('img'));
            for (let img of imgs) {
                const alt = img.getAttribute('alt') || '';
                const match = alt.match(/^(.+?)'s profile picture$/i);
                if (match && !ignoreList.has(match[1].toLowerCase())) {
                    foundUsername = match[1];
                    foundAvatar = img.src;
                    break;
                }
            }

            // If alt text strategy misses, fallback to finding the first valid profile link anchor
            if (!foundUsername) {
                const links = Array.from(container.querySelectorAll('a[href]'));
                for (let a of links) {
                    const href = a.getAttribute('href'); if (!href || href.startsWith('#') || href.startsWith('javascript:')) continue;
                    let path = href; try { if (href.startsWith('http')) path = new URL(href).pathname; } catch(e){}
                    const parts = path.split('?')[0].split('/').filter(Boolean);
                    if (parts.length === 1 && !ignoreList.has(parts[0].toLowerCase())) { foundUsername = parts[0]; break; }
                }
            }

            if (foundUsername) {
                if (!foundAvatar) foundAvatar = findAvatarFromDOM(container, foundUsername);
                
                // Natively scrape caption from h1 or spans
                let domCaption = '';
                const h1s = Array.from(container.querySelectorAll('h1'));
                if (h1s.length > 0) {
                    domCaption = h1s[0].textContent || h1s[0].innerText || '';
                } else {
                    const spans = Array.from(container.querySelectorAll('span[dir="auto"]'));
                    for (let span of spans) {
                        const txt = (span.textContent || '').trim();
                        if (txt.length > 15 && !txt.includes(' likes') && !txt.includes(' comments')) {
                            domCaption = txt;
                            break;
                        }
                    }
                }

                return { 
                    username: foundUsername, 
                    avatar: foundAvatar || fallbackAvatar, 
                    isFollowing: domFollowing !== null ? domFollowing : true, 
                    caption: domCaption 
                };
            }
            return null;
        };

        // =========================================================================
        // BUTTON LOGICS & EVENT HANDLERS
        // =========================================================================
        
        const goToProfile = () => { const u = uiUsername.innerText; if (u && u !== 'Loading...') window.location.href = `/${u}/`; };
        uiAvatar.onclick = goToProfile; document.getElementById('ui-profile-link').onclick = goToProfile;

        uiFollowBtn.onclick = function() {
            let activeMedia = getActiveMediaFromCenter();
            
            // Apply same precise boundary box isolation for the follow button specifically
            let container = activeMedia?.closest('article, div[role="dialog"]');
            if (activeMedia && !container) {
                let temp = activeMedia;
                for (let i = 0; i < 20; i++) {
                    if (!temp || temp.tagName === 'MAIN' || temp.tagName === 'BODY') break;
                    if (temp.querySelector('img[alt*="\'s profile picture" i]')) { container = temp; break; }
                    temp = temp.parentElement;
                }
            }
            if (!container) container = document.body;

            let nativeBtn = Array.from(container.querySelectorAll('button, div[role="button"], a[role="button"]')).find(b => ['follow', 'follow back'].includes((b.innerText || '').trim().toLowerCase()));
            if (!nativeBtn && container !== document.body) nativeBtn = Array.from(document.querySelectorAll('button, div[role="button"], a[role="button"]')).find(b => ['follow', 'follow back'].includes((b.innerText || '').trim().toLowerCase()));

            if (nativeBtn) {
                nativeBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); nativeBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })); nativeBtn.click();
                this.innerHTML = 'Following'; this.classList.add('following'); showToast('Follow Triggered!');
            } else {
                if (Array.from(container.querySelectorAll('button, div[role="button"]')).some(b => (b.innerText || '').trim().toLowerCase() === 'following')) { this.innerHTML = 'Following'; this.classList.add('following'); showToast('Already Following!'); } else showToast('Follow button not found');
            }
        };

        const speeds = [0.25, 0.5, 0.75, 1, 2, 3];
        let speedIdx = speeds.indexOf(currentPlaybackSpeed); if (speedIdx === -1) speedIdx = 3;
        const uiBtnSpeed = document.getElementById('ui-btn-speed'); uiBtnSpeed.innerText = currentPlaybackSpeed + 'x';
        uiBtnSpeed.onclick = () => { 
            speedIdx = (speedIdx + 1) % speeds.length; currentPlaybackSpeed = speeds[speedIdx]; 
            localStorage.setItem('ig_nuke_speed', currentPlaybackSpeed); uiBtnSpeed.innerText = currentPlaybackSpeed + 'x'; 
            document.querySelectorAll('video').forEach(video => video.playbackRate = currentPlaybackSpeed); showToast(`Speed: ${currentPlaybackSpeed}x`); 
        };

        const muteIcon = document.getElementById('ui-icon-mute');
        const updateMuteVisuals = () => { muteIcon.innerHTML = globalMuteState ? `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line>` : `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>`; };
        updateMuteVisuals();
        document.getElementById('ui-btn-mute').onclick = () => { 
            globalMuteState = !globalMuteState; localStorage.setItem('ig_nuke_muted', globalMuteState); 
            document.querySelectorAll('video').forEach(video => { video.muted = globalMuteState; if(!globalMuteState) { video.volume = 1; video.removeAttribute('muted'); } }); 
            updateMuteVisuals(); showToast(globalMuteState ? 'Muted' : 'Unmuted'); 
        };

        document.getElementById('ui-btn-save').onclick = function() {
            const activeMedia = getActiveMediaFromCenter();
            if (activeMedia) {
                const postContainer = activeMedia.closest('article, [role="presentation"], main') || activeMedia.parentElement.parentElement;
                if (postContainer) {
                    const svgs = postContainer.querySelectorAll('svg'); let nativeClicked = false;
                    for (let svg of svgs) {
                        let label = (svg.getAttribute('aria-label') || '').trim();
                        if (label === 'Save' || label === 'Remove') {
                            const btn = svg.closest('button, [role="button"], a') || svg;
                            btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); btn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })); btn.click();
                            if(label === 'Save') { this.style.background = 'rgba(29, 155, 240, 0.5)'; showToast("Saved!"); } else { this.style.background = 'rgba(255,255,255,0.15)'; showToast("Removed!"); }
                            nativeClicked = true; break;
                        }
                        const poly = svg.querySelector('polygon'); const path = svg.querySelector('path');
                        if ((poly && poly.getAttribute('points') && poly.getAttribute('points').includes('20 21 12')) || (path && path.getAttribute('d') && path.getAttribute('d').includes('20 21 12'))) {
                            const btn = svg.closest('button, [role="button"], a') || svg;
                            btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); btn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })); btn.click();
                            showToast("Bookmark Toggled!"); nativeClicked = true; break;
                        }
                    }
                    if (nativeClicked) return; 
                }
                
                let shortcode = extractShortcode(activeMedia);
                if (!shortcode) { let link = postContainer ? postContainer.querySelector('a[href*="/p/"], a[href*="/reel/"], a[href*="/reels/"]') : null; if (link) { const match = link.href.match(/\/(?:p|reel|reels)\/([^\/?]+)/); if (match) shortcode = match[1]; } }
                if (!shortcode) { const urlMatch = window.location.pathname.match(/\/(?:p|reel|reels)\/([^\/?]+)/); if (urlMatch) shortcode = urlMatch[1]; }
                
                if (shortcode) {
                    localStorage.removeItem('ig_bot_result');
                    const botTab = window.open(`/p/${shortcode}/?auto_save_bot=true`, 'ig_bot_tab', 'width=100,height=100,left=-1000,top=-1000');
                    if (!botTab) return showToast("Browser blocked popup! Allow popups.");
                    showToast("Bot opening tab...", true);
                    let checkAttempts = 0;
                    const statusChecker = setInterval(() => {
                        checkAttempts++;
                        if (checkAttempts > 150) { clearInterval(statusChecker); if (botTab && !botTab.closed) botTab.close(); return showToast("Tab timeout"); }
                        const result = localStorage.getItem('ig_bot_result');
                        if (result) {
                            clearInterval(statusChecker); localStorage.removeItem('ig_bot_result'); if (botTab && !botTab.closed) botTab.close();
                            if (result === 'saved' || result === 'toggled') { this.style.background = 'rgba(29, 155, 240, 0.5)'; showToast("Saved to Profile!"); } 
                            else if (result === 'removed') { this.style.background = 'rgba(255,255,255,0.15)'; showToast("Removed from Profile!"); } 
                            else showToast("Bot Error");
                        }
                    }, 100);
                } else showToast('Error: Cannot extract URL');
            } else showToast('No active post found');
        };

        document.getElementById('ui-btn-aspect').onclick = () => { currentMode = (currentMode + 1) % modes.length; ratioStyle.innerHTML = modes[currentMode].css; showToast(modes[currentMode].name); };
        document.getElementById('ui-btn-feed').onclick = () => { localStorage.removeItem('ig_nuke_playlist'); window.location.href = (window.location.pathname.includes('/reels') || window.location.pathname.includes('/reel')) ? '/' : '/reels/'; };
        
        // --- DYNAMIC HOME/REELS ICON SYNC LOGIC ---
        const updateFeedIcon = () => {
            const btnFeed = document.getElementById('ui-btn-feed');
            if (!btnFeed) return;
            const isHome = window.location.pathname === '/';
            const homeSVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>`;
            const reelsSVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect><line x1="7" y1="2" x2="7" y2="22"></line><line x1="17" y1="2" x2="17" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line><line x1="2" y1="7" x2="7" y2="7"></line><line x1="2" y1="17" x2="7" y2="17"></line><line x1="17" y1="17" x2="22" y2="17"></line><line x1="17" y1="7" x2="22" y2="7"></line></svg>`;
            
            if (isHome && !btnFeed.innerHTML.includes('polyline points="9 22')) {
                btnFeed.innerHTML = homeSVG;
            } else if (!isHome && !btnFeed.innerHTML.includes('rect x="2" y="2"')) {
                btnFeed.innerHTML = reelsSVG;
            }
        };
        updateFeedIcon(); // Initialize at load
        
        document.getElementById('ui-btn-saved').onclick = () => { 
            let loggedInUser = null;
            const profileImages = document.querySelectorAll('img[alt$="\'s profile picture"]');
            for (let img of profileImages) {
                let alt = img.getAttribute('alt');
                let username = alt.replace("'s profile picture", "");
                if (username) { loggedInUser = username; break; }
            }
            if (loggedInUser) {
                window.location.href = `/${loggedInUser}/saved/`;
            } else {
                showToast("Cannot determine your username.");
            }
        };

        document.getElementById('ui-btn-refresh').onclick = () => { localStorage.removeItem('ig_nuke_playlist'); window.location.reload(); };

        let isAutoScrollEnabled = localStorage.getItem('ig_nuke_autoscroll') === 'true';
        let autoScrollIntervalTimer = null; let lastActiveVideo = null; let lastVideoTime = 0;
        const autoScrollBtn = document.getElementById('ui-btn-autoscroll');
        if (isAutoScrollEnabled) autoScrollBtn.style.background = 'rgba(255,255,255,0.4)';
        
        const handleAutoScrollLogic = () => {
            if (!isAutoScrollEnabled || !isVideoPage()) return; const activeMedia = getActiveVideoFromCenter();
            if (activeMedia) {
                if (activeMedia !== lastActiveVideo) { lastActiveVideo = activeMedia; lastVideoTime = activeMedia.currentTime; } 
                else {
                    const hasLooped = (lastVideoTime - activeMedia.currentTime) > 1; const hasEnded = activeMedia.currentTime >= activeMedia.duration - 0.2;
                    if (hasLooped || hasEnded) {
                        const currentContainer = activeMedia.closest('article, [role="dialog"]');
                        if (currentContainer && currentContainer.nextElementSibling) { currentContainer.nextElementSibling.scrollIntoView({ behavior: 'smooth', block: 'start' }); } else { executeNavigation('next'); }
                        lastVideoTime = 0; lastActiveVideo = null; return; 
                    }
                    lastVideoTime = activeMedia.currentTime;
                }
            }
        };

        autoScrollBtn.onclick = () => { 
            isAutoScrollEnabled = !isAutoScrollEnabled; localStorage.setItem('ig_nuke_autoscroll', isAutoScrollEnabled); 
            if (isAutoScrollEnabled) { autoScrollBtn.style.background = 'rgba(255,255,255,0.4)'; showToast('Auto-scroll: ON'); autoScrollIntervalTimer = setInterval(handleAutoScrollLogic, 500); } 
            else { autoScrollBtn.style.background = 'rgba(255,255,255,0.15)'; showToast('Auto-scroll: OFF'); clearInterval(autoScrollIntervalTimer); lastActiveVideo = null; } 
        };
        if (isAutoScrollEnabled) autoScrollIntervalTimer = setInterval(handleAutoScrollLogic, 500);

        // =========================================================================
        // INSTANT HIDE/SHOW LOGIC (MEMORY SECURED)
        // =========================================================================
        
        const hideUI = () => {
            if (!controlsVisible) return;
            controlsVisible = false;
            if (isVideoPage()) localStorage.setItem('ig_nuke_ui_visible', 'false');
            bottomUI.style.opacity = '0';
            Array.from(bottomUI.children).forEach(child => { child.style.pointerEvents = 'none'; });
        };

        const showUI = () => {
            if (controlsVisible) return;
            controlsVisible = true;
            if (isVideoPage()) localStorage.setItem('ig_nuke_ui_visible', 'true');
            bottomUI.style.opacity = '1';
            Array.from(bottomUI.children).forEach(child => { child.style.pointerEvents = 'auto'; });
        };

        const masterBtn = document.getElementById('ui-btn-master');
        
        const syncMasterUIState = () => {
            const active = isMasterEnabled && isVideoPage();
            
            globalStyle.disabled = !active; 
            ratioStyle.disabled = !active; 
            qualityStyle.disabled = !active;
            
            document.querySelectorAll('video').forEach(video => { video.playbackRate = active ? currentPlaybackSpeed : 1; });
            
            if (!isMasterEnabled) { 
                masterBtn.style.color = '#ff4444'; 
                masterBtn.style.background = 'rgba(255,68,68,0.2)'; 
            } else { 
                masterBtn.style.color = '#fff'; 
                masterBtn.style.background = 'rgba(255,255,255,0.15)'; 
            }

            if (active) {
                bottomUI.style.display = 'flex';
                scrubberBar.style.display = 'block';
                masterToggleFab.style.display = 'none'; 
                
                if (controlsVisible) {
                    bottomUI.style.opacity = '1';
                    scrubberBar.style.opacity = '1';
                    Array.from(bottomUI.children).forEach(child => { child.style.pointerEvents = 'auto'; });
                }
            } else {
                bottomUI.style.display = 'none';
                scrubberBar.style.display = 'none';
                if (!isMasterEnabled && isVideoPage()) {
                    masterToggleFab.style.display = 'flex';
                } else {
                    masterToggleFab.style.display = 'none';
                }
            }
        };
        
        masterBtn.onclick = () => {
            isMasterEnabled = !isMasterEnabled; 
            localStorage.setItem('ig_nuke_master_state', isMasterEnabled);
            syncMasterUIState();
            showToast(isMasterEnabled ? 'Normal Mode: OFF' : 'Normal Mode: ON');
        };

        syncMasterUIState();

        // =========================================================================
        // THE GESTURE ENGINE (Scrub, Hold-Speed, Swipe Nav)
        // =========================================================================
        
        let globalTouchStartY = 0;
        let globalTouchStartX = 0;

        const gestureState = {
            timer: null,
            isPressing: false,
            isScrubbing: false,
            preventClick: false,
            startX: 0,
            startY: 0,
            startVideoTime: 0,
            video: null
        };

        const ripMuteLock = () => { document.querySelectorAll('video').forEach(video => { video.muted = globalMuteState; if (!globalMuteState) { video.volume = 1; video.removeAttribute('muted'); video.play().catch(() => {}); } }); updateMuteVisuals(); };
        ['touchstart', 'click', 'scroll', 'wheel', 'keydown'].forEach(evt => { window.addEventListener(evt, () => { if(isVideoPage() && isMasterEnabled) ripMuteLock(); }, { once: true, passive: true }); });

        const updateScrubber = () => {
            if (isMasterEnabled && isVideoPage()) {
                const scrubVideo = gestureState.isScrubbing && gestureState.video ? gestureState.video : getActiveVideoFromCenter();
                if (scrubVideo && scrubVideo.duration && controlsVisible) {
                    scrubberBar.style.opacity = '1';
                    scrubberBar.style.width = `${(scrubVideo.currentTime / scrubVideo.duration) * 100}%`;
                } else {
                    scrubberBar.style.opacity = '0';
                }

                // Profile and Mute/Speed loop
                const media = getActiveMediaFromCenter();
                if (media) {
                    if (media !== currentExtractedMedia) {
                        const pData = fetchProfileData(media); 
                        if (pData) {
                            currentExtractedMedia = media;
                            uiUsername.innerText = pData.username || 'user';
                            uiAvatar.src = pData.avatar || fallbackAvatar;
                            uiCaption.innerText = pData.caption || '';
                            uiCaption.style.display = pData.caption ? '-webkit-box' : 'none';
                            
                            if (pData.isFollowing) { 
                                uiFollowBtn.innerHTML = 'Following'; 
                                uiFollowBtn.classList.add('following'); 
                            } else { 
                                uiFollowBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg> Follow'; 
                                uiFollowBtn.classList.remove('following'); 
                            }
                        }
                    }
                }

                const video = getActiveVideoFromCenter();
                if (video && video.duration) {
                    if(video.playbackRate !== currentPlaybackSpeed && (!gestureState.isPressing || gestureState.video !== video)) video.playbackRate = currentPlaybackSpeed;
                    if(video.muted !== globalMuteState) { video.muted = globalMuteState; if (!globalMuteState) { video.volume = 1; video.removeAttribute('muted'); } }
                }
            } else {
                scrubberBar.style.opacity = '0';
            }
            requestAnimationFrame(updateScrubber);
        };
        requestAnimationFrame(updateScrubber);

        // =========================================================================
        // GESTURE & NAVIGATION EVENT LISTENERS
        // =========================================================================

        window.addEventListener('scroll', (e) => {
            if (isMasterEnabled && isVideoPage()) {
                // Do not hide UI if the scroll target is inside the bottom UI
                if (e.target && e.target.closest && e.target.closest('#ig-bottom-ui')) return;
                hideUI();
            }
        }, { capture: true, passive: true });
        
        let wheelTimeout;
        window.addEventListener('wheel', (e) => {
            if (!isMasterEnabled || !isVideoPage()) return;
            // Prevent hiding if wheeled over bottom UI
            if (e.composedPath().some(el => el.id === 'ig-bottom-ui')) return;
            hideUI();
            clearTimeout(wheelTimeout);
            wheelTimeout = setTimeout(() => {
                if (e.deltaY > 60) executeNavigation('next');
                else if (e.deltaY < -60) executeNavigation('prev');
            }, 100);
        }, { capture: true, passive: true });

        window.addEventListener('click', (e) => { 
            if (!isMasterEnabled || !isVideoPage()) return;
            if (gestureState.preventClick) {
                e.stopPropagation();
                e.preventDefault();
                return;
            }
            const isUIClick = e.composedPath().some(el => (el.tagName === 'BUTTON' || (el.classList && el.classList.contains('ig-pointer'))));
            if (!isUIClick) { if (!controlsVisible) showUI(); else hideUI(); }
        }, { capture: true });

        window.addEventListener('touchstart', (e) => {
            if (!isMasterEnabled || !isVideoPage() || e.touches.length > 1) return; 
            
            globalTouchStartY = e.touches[0].clientY; 
            globalTouchStartX = e.touches[0].clientX;

            gestureState.video = null;
            if (gestureState.timer) clearTimeout(gestureState.timer);

            const path = e.composedPath();
            if (path.some(el => el.id === 'ig-bottom-ui')) return; 

            gestureState.video = getActiveVideoFromCenter();
            if (!gestureState.video) return;

            gestureState.startX = e.touches[0].clientX;
            gestureState.startY = e.touches[0].clientY;
            gestureState.startVideoTime = gestureState.video.currentTime;
            gestureState.isPressing = false;
            gestureState.isScrubbing = false;
            gestureState.preventClick = false;

            gestureState.timer = setTimeout(() => {
                gestureState.isPressing = true;
                gestureState.preventClick = true; 
                gestureState.video.playbackRate = 2.0;
                showToast("2x Speed");
            }, 350);

        }, { capture: true, passive: true });
        
        window.addEventListener('touchmove', (e) => {
            if (!isMasterEnabled || !isVideoPage()) return; 
            
            // Abort hide mechanics entirely if touching inside bottom UI
            if (e.composedPath().some(el => el.id === 'ig-bottom-ui')) return; 

            const deltaY = e.touches[0].clientY - globalTouchStartY;
            const deltaX = e.touches[0].clientX - globalTouchStartX;

            if (Math.abs(deltaY) > 8 && !gestureState.isScrubbing) hideUI();

            if (!gestureState.video) return;

            if (gestureState.timer && !gestureState.isPressing && Math.abs(deltaX) > 10) {
                clearTimeout(gestureState.timer);
                gestureState.timer = null;
            }

            if (!gestureState.isPressing && Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
                gestureState.isScrubbing = true;
                gestureState.preventClick = true; 

                const scaleFactor = window.innerWidth / 1.5; 
                let timeOffset = (deltaX / scaleFactor) * gestureState.video.duration;
                let newTime = gestureState.startVideoTime + timeOffset;

                newTime = Math.max(0, Math.min(newTime, gestureState.video.duration - 0.1));
                gestureState.video.currentTime = newTime;
            }
        }, { capture: true, passive: true });
        
        window.addEventListener('touchend', (e) => {
            if (!isMasterEnabled || !isVideoPage()) return; 
            if (e.composedPath().some(el => el.id === 'ig-bottom-ui')) return; 

            if (gestureState.timer) { clearTimeout(gestureState.timer); gestureState.timer = null; }
            if (gestureState.isPressing) {
                gestureState.isPressing = false;
                if (gestureState.video) gestureState.video.playbackRate = currentPlaybackSpeed;
            }
            if (gestureState.isScrubbing) { gestureState.isScrubbing = false; }
            if (gestureState.preventClick) { setTimeout(() => { gestureState.preventClick = false; }, 100); }

            const diffY = globalTouchStartY - e.changedTouches[0].clientY; 
            const diffX = globalTouchStartX - e.changedTouches[0].clientX;

            if (Math.abs(diffX) > Math.abs(diffY)) return; 
            if (diffY > 100) executeNavigation('next'); 
            else if (diffY < -100) executeNavigation('prev');
        }, { capture: true, passive: true });

        // =========================================================================
        // AGGRESSIVE SPA ROUTER
        // =========================================================================

        let lastHref = location.href;
        let wasModalOpen = document.querySelector('div[role="dialog"]') !== null;

        setInterval(() => {
            const isModalOpen = document.querySelector('div[role="dialog"]') !== null;
            
            if (location.href !== lastHref || isModalOpen !== wasModalOpen) {
                const newPath = window.location.pathname;
                const oldPath = new URL(lastHref).pathname;
                const isSpecificPost = /\/(p|reel|reels|tv)\/([^\/?]+)/.test(newPath);
                
                if (!isSpecificPost && newPath !== oldPath) {
                    localStorage.removeItem('ig_nuke_playlist');
                    localStorage.removeItem('ig_nuke_playlist_time');
                }
                
                lastHref = location.href;
                wasModalOpen = isModalOpen;
                
                if (isVideoPage()) {
                    controlsVisible = true;
                    localStorage.setItem('ig_nuke_ui_visible', 'true');
                    showUI();
                }
                syncMasterUIState();
                updateFeedIcon();
            }

            if (!isMasterEnabled || !isVideoPage()) return;

            const articles = document.querySelectorAll('article');
            if (articles.length > 0) {
                let flexParent = articles[0].parentElement;
                if (flexParent) {
                    flexParent.style.setProperty('gap', '0px', 'important');
                    flexParent.style.setProperty('padding-bottom', '50px', 'important'); 
                    flexParent.style.setProperty('margin-bottom', '0px', 'important');
                    let p = flexParent;
                    while(p && p.tagName !== 'BODY' && p.tagName !== 'HTML') {
                        const style = window.getComputedStyle(p);
                        if (style.overflowY === 'auto' || style.overflowY === 'scroll') p.style.setProperty('scroll-snap-type', 'y mandatory', 'important');
                        p = p.parentElement;
                    }
                }
            }
        }, 100);

        // =========================================================================
        // PLAYLIST BUILDER & NAVIGATOR
        // =========================================================================
        
        setInterval(() => {
            if (!isMasterEnabled) return; 
            if (!document.getElementById('ig-bottom-ui')) document.body.appendChild(bottomUI);
            const links = Array.from(document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]'));
            if (links.length > 0) {
                const ex = links.map(a => { const match = a.href.match(/\/(?:p|reel|reels)\/([^\/?]+)/); return match ? match[1] : null; }).filter(Boolean);
                if (ex.length > 0) { let existing = []; try { existing = JSON.parse(localStorage.getItem('ig_nuke_playlist') || '[]'); } catch(e) {} let updated = [...new Set([...existing, ...ex])]; if (updated.length > 300) updated = updated.slice(-300); localStorage.setItem('ig_nuke_playlist', JSON.stringify(updated)); localStorage.setItem('ig_nuke_playlist_time', Date.now().toString()); }
            }
        }, 1000);

        let isNavigating = false;
        const executeNavigation = (dir) => {
            if (isNavigating || !isMasterEnabled) return; 
            
            let currentShortcode = null;
            const pathMatch = window.location.pathname.match(/\/(?:p|reel|reels)\/([^\/?]+)/);
            if (pathMatch) {
                currentShortcode = pathMatch[1];
            } else {
                const m = getActiveMediaFromCenter();
                if (m) currentShortcode = extractShortcode(m);
            }
            if (!currentShortcode) return;
            
            try {
                const playlist = JSON.parse(localStorage.getItem('ig_nuke_playlist'));
                if (playlist) {
                    const idx = playlist.indexOf(currentShortcode);
                    if (idx !== -1) {
                        let target = null; if (dir === 'next' && idx < playlist.length - 1) target = playlist[idx + 1]; else if (dir === 'prev' && idx > 0) target = playlist[idx - 1];
                        if (target) {
                            isNavigating = true; const loader = document.createElement('div');
                            loader.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100dvh;background:#000;z-index:99999999;display:flex;justify-content:center;align-items:center;color:white;font-family:sans-serif;font-weight:bold;font-size:16px;flex-direction:column;gap:20px;';
                            loader.innerHTML = `<svg width="40" height="40" viewBox="0 0 50 50" style="animation: spin 1s linear infinite;"><circle cx="25" cy="25" r="20" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="4"></circle><circle cx="25" cy="25" r="20" fill="none" stroke="#fff" stroke-width="4" stroke-dasharray="31.4 125.6" stroke-linecap="round"></circle></svg><div>Loading ${dir === 'next' ? 'Next' : 'Previous'}...</div><style>@keyframes spin { 100% { transform: rotate(360deg); } }</style>`;
                            document.body.appendChild(loader); 
                            window.location.assign(`/p/${target}/`);
                        } else showToast(dir === 'next' ? 'End of loaded grid.' : 'Already at the first post.');
                    }
                }
            } catch(e) {}
        };
        
    });
})();
