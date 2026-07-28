// ==UserScript==
// @name         RedGIFs Ultimate Nuke v1.2 (Cinematic Mode & Infinite Carousel)
// @namespace    https://viayoo.com/
// @version      1.2.0
// @description  Hides native navigation bars, integrates a fully functional aspect ratio toggle (Original vs Crop Full), and adds an infinitely sliding bottom action panel.
// @author       You
// @run-at       document-start
// @match        https://*.redgifs.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const fallbackAvatar = "data:image/svg+xml;charset=UTF-8,%3csvg viewBox='0 0 24 24' fill='%23ffffff' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z'/%3e%3c/svg%3e";

    // =========================================================================
    // 1. ENGINE & QUALITY PRESERVATION
    // =========================================================================
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
        const url = args[0] && typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url ? args[0].url : '');
        const response = await originalFetch.apply(this, args);
        
        if (url.includes('api.redgifs.com/v2/gifs')) {
            try {
                const clone = response.clone();
                const json = await clone.json();
                if (json.gif && json.gif.urls) {
                    if (json.gif.urls.hd) json.gif.urls.sd = json.gif.urls.hd; 
                } else if (json.gifs && Array.isArray(json.gifs)) {
                    json.gifs.forEach(g => { if (g.urls && g.urls.hd) g.urls.sd = g.urls.hd; });
                }
                return new Response(JSON.stringify(json), { status: response.status, statusText: response.statusText, headers: response.headers });
            } catch (e) { return response; }
        }
        return response;
    };

    const originalPlay = HTMLVideoElement.prototype.play;
    HTMLVideoElement.prototype.play = function() {
        this.preload = 'auto';
        this.setAttribute('playsinline', 'true');
        return originalPlay.apply(this).catch(() => {});
    };

    // =========================================================================
    // MEDIA SELECTOR
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

    // =========================================================================
    // 2. MAIN SCRIPT & BOTTOM UI CONSTRUCTION
    // =========================================================================
    document.addEventListener("DOMContentLoaded", () => {
        let currentPlaybackSpeed = parseFloat(localStorage.getItem('rg_nuke_speed')) || 1;
        let storedMute = localStorage.getItem('rg_nuke_muted');
        let globalMuteState = storedMute !== null ? storedMute === 'true' : true; 
        let isMasterEnabled = localStorage.getItem('rg_nuke_master_state') !== 'false';
        let controlsVisible = false;
        
        [{ name: "screen-orientation", content: "portrait" }, { name: "x5-orientation", content: "portrait" }, { name: "orientation", content: "portrait" }].forEach(m => { let meta = document.createElement('meta'); meta.name = m.name; meta.content = m.content; document.head.appendChild(meta); });

        // --- CORE CSS (Hides persistent bottom navbar/toolbars from screenshot and native UI) ---
        const globalStyle = document.createElement('style'); globalStyle.id = 'rg-global-override';
        globalStyle.innerHTML = `
            :not(#rg-bottom-ui):not(#rg-bottom-ui *):not(#rg-master-rescue-fab):not(#rg-master-rescue-fab *):not(#rg-scrub-toast) > header,
            :not(#rg-bottom-ui):not(#rg-bottom-ui *):not(#rg-master-rescue-fab):not(#rg-master-rescue-fab *):not(#rg-scrub-toast) > nav,
            .Sidebar, .Header, .VideoPlayer-UI, .Feed-Item-Info, .Feed-Item-Actions, .UserFeed-Header, .TopBar, .BottomNav,
            div[class*="Overlay"], div[class*="VideoPlayer_ui"], div[class*="Sidebar"], div[class*="BottomBar"],
            .SoundControls, .PlayControls, .VideoHoverUI, .GifDetails, .Feed-Item-Audio,
            nav[class*="navbar"], div[class*="navbar"], nav[class*="footer"], div[class*="footer"],
            div[style*="position: fixed"][style*="bottom"], div[style*="position:fixed"][style*="bottom"] {
                display: none !important; opacity: 0 !important; pointer-events: none !important;
            }
            
            html, body, #app, main {
                background-color: #000 !important;
                margin: 0 !important;
                padding: 0 !important;
                border: none !important;
                box-sizing: border-box !important;
                overscroll-behavior-y: none;
            }

            video { filter: none !important; image-rendering: high-quality !important; }
        `;
        document.head.appendChild(globalStyle);

        const ratioStyle = document.createElement('style'); ratioStyle.id = 'rg-ratio-override'; document.head.appendChild(ratioStyle);
        const modes = [
            { name: "Mode: Cover Fullscreen", css: `video { position: absolute !important; top: 0 !important; left: 0 !important; width: 100vw !important; height: 100vh !important; object-fit: cover !important; object-position: center !important; z-index: 99990 !important; transform: none !important; margin: 0 !important; padding: 0 !important; }` },
            { name: "Mode: Original Size", css: `video { position: absolute !important; top: 0 !important; left: 0 !important; width: 100vw !important; height: 100vh !important; object-fit: contain !important; object-position: center !important; z-index: 99990 !important; transform: none !important; margin: 0 !important; padding: 0 !important; }` }
        ];
        let currentMode = 0; ratioStyle.innerHTML = modes[currentMode].css;

        // --- SPATIAL / INFINITELY SLIDING CONTROL PANEL DESIGN ---
        const uiStyle = document.createElement('style');
        uiStyle.innerHTML = `
            #rg-bottom-ui { box-sizing: border-box; position: fixed; bottom: 0; left: 0; width: 100vw; display: flex; flex-direction: column; justify-content: flex-end; z-index: 9999999; padding: 0 16px max(24px, env(safe-area-inset-bottom)); background: linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.4) 50%, transparent 100%); pointer-events: none; font-family: -apple-system, sans-serif; transition: opacity 0.3s cubic-bezier(0.2, 0.8, 0.2, 1); opacity: 0; }
            #rg-bottom-ui * { box-sizing: border-box; }
            .rg-pointer { pointer-events: auto; }
            
            .rg-profile-row { display: flex; align-items: center; gap: 14px; margin-bottom: 8px; width: 100%; text-shadow: 0 2px 10px rgba(0,0,0,0.9); }
            .rg-avatar { width: 44px; height: 44px; border-radius: 50%; object-fit: cover; flex-shrink: 0; cursor: pointer; transition: transform 0.2s; border: 1.5px solid rgba(255,255,255,0.9); box-shadow: 0 4px 15px rgba(0,0,0,0.5); }
            .rg-user-info { display: flex; flex-direction: column; justify-content: center; cursor: pointer; flex-grow: 1; }
            .rg-username { color: #fff; font-weight: 700; font-size: 16px; display: flex; align-items: center; gap: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            
            .rg-follow-btn { margin-left: auto; background: transparent; color: #fff; font-weight: 700; border-radius: 99px; padding: 6px 14px; font-size: 13.5px; cursor: pointer; transition: all 0.25s; flex-shrink: 0; display: flex; align-items: center; gap: 4px; border: 1.5px solid rgba(255,255,255,0.8); }
            .rg-follow-btn.following { border-color: rgba(255,255,255,0.2); color: rgba(255,255,255,0.6); }
            
            .rg-caption { color: rgba(255,255,255,0.9); font-size: 14.5px; font-weight: 400; text-shadow: 0 2px 8px rgba(0,0,0,0.9); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; margin-bottom: 24px; }
            
            /* Infinite Sliding Carousel Action Row */
            .rg-action-row { display: flex; gap: 32px; overflow-x: hidden; padding: 12px 16px; margin: 0 -16px; width: calc(100% + 32px); touch-action: pan-y; align-items: center; justify-content: flex-start; mask-image: linear-gradient(to right, transparent 0%, black 12%, black 88%, transparent 100%); -webkit-mask-image: linear-gradient(to right, transparent 0%, black 12%, black 88%, transparent 100%); }
            .rg-action-row::-webkit-scrollbar { display: none; }
            
            .rg-action-btn { width: 32px; height: 32px; border: none; background: transparent; color: rgba(255,255,255,0.85); cursor: pointer; display: flex; justify-content: center; align-items: center; transition: transform 0.2s; flex-shrink: 0; }
            .rg-action-btn:active { transform: scale(0.7); }
            .rg-action-btn svg { width: 26px; height: 26px; stroke-width: 2.5px; filter: drop-shadow(0 2px 6px rgba(0,0,0,0.6)); }
            .rg-speed-text { font-size: 16px; font-weight: 800; filter: drop-shadow(0 2px 6px rgba(0,0,0,0.6)); display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; }
            
            #rg-toast { position: fixed; top: 40%; left: 50%; transform: translate(-50%, -50%) scale(0.9); color: #fff; text-shadow: 0 0 16px rgba(255,255,255,0.5), 0 2px 8px rgba(0,0,0,0.9); font-weight: 700; font-size: 15px; z-index: 10000002; opacity: 0; transition: opacity 0.3s, transform 0.3s; pointer-events: none; }
            #rg-toast.show { opacity: 1; transform: translate(-50%, -50%) scale(1); }

            #rg-scrub-toast { position: fixed; top: 40px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.7); color: #fff; font-family: monospace; font-size: 18px; font-weight: bold; padding: 6px 16px; border-radius: 20px; z-index: 10000003; opacity: 0; transition: opacity 0.2s; pointer-events: none; text-shadow: 0 2px 4px rgba(0,0,0,0.5); backdrop-filter: blur(4px); }
        `;
        document.head.appendChild(uiStyle);

        const bottomUI = document.createElement('div'); bottomUI.id = 'rg-bottom-ui';
        bottomUI.innerHTML = `
            <div class="rg-profile-row rg-pointer">
                <img class="rg-avatar" id="ui-avatar" src="${fallbackAvatar}" />
                <div class="rg-user-info" id="ui-profile-link"><div class="rg-username"><span id="ui-username">Loading...</span></div></div>
                <button class="rg-follow-btn" id="ui-btn-follow"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg> Follow</button>
            </div>
            <div class="rg-caption rg-pointer" id="ui-caption"></div>
            <div class="rg-action-row rg-pointer">
                <button class="rg-action-btn rg-speed-text" id="ui-btn-speed">1x</button>
                <button class="rg-action-btn" id="ui-btn-mute"><svg id="ui-icon-mute" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg></button>
                <button class="rg-action-btn" id="ui-btn-save"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg></button>
                <button class="rg-action-btn" id="ui-btn-aspect"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg></button>
                <button class="rg-action-btn" id="ui-btn-feed"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg></button>
                <button class="rg-action-btn" id="ui-btn-autoscroll"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><polyline points="7 13 12 18 17 13"></polyline><polyline points="7 6 12 11 17 6"></polyline></svg></button>
                <button class="rg-action-btn" id="ui-btn-master"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path><line x1="12" y1="2" x2="12" y2="12"></line></svg></button>
            </div>
            <div id="rg-toast"></div>
            <div id="rg-scrub-toast">0:00 / 0:00</div>
        `;
        document.body.appendChild(bottomUI);

        // --- INFINITE CAROUSEL DRAG/WHEEL LOGIC FOR ACTION ROW ---
        const actionRow = bottomUI.querySelector('.rg-action-row');
        if (actionRow) {
            let dragStartX = 0;
            let dragAccumulator = 0;
            const dragThreshold = 40; 
            
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

        // --- SCRUBBER BAR ---
        const scrubberBar = document.createElement('div');
        scrubberBar.id = 'rg-scrubber-bar';
        scrubberBar.style.cssText = 'position:fixed;bottom:4px;left:0;height:2px;background:#fff;z-index:9999998;width:0%;pointer-events:none;box-shadow:0 0 8px rgba(255,255,255,1);transition:opacity 0.3s;opacity:0;';
        document.body.appendChild(scrubberBar);

        // --- RESCUE FAB ---
        const masterToggleFab = document.createElement('button');
        masterToggleFab.id = 'rg-master-rescue-fab';
        masterToggleFab.style.cssText = 'position:fixed;bottom:20px;right:20px;width:44px;height:44px;border-radius:50%;border:none;background:rgba(255,68,68,0.25);color:#ff4444;cursor:pointer;display:none;justify-content:center;align-items:center;z-index:9999999;backdrop-filter:blur(8px);';
        masterToggleFab.innerHTML = `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path><line x1="12" y1="2" x2="12" y2="12"></line></svg>`;
        document.body.appendChild(masterToggleFab);

        masterToggleFab.onclick = () => { isMasterEnabled = true; localStorage.setItem('rg_nuke_master_state', true); syncMasterUIState(); };

        const toast = document.getElementById('rg-toast');
        let toastTimeout;
        const showToast = (msg) => {
            toast.innerText = msg; toast.classList.add('show');
            clearTimeout(toastTimeout); toastTimeout = setTimeout(() => toast.classList.remove('show'), 1500);
        };

        // =========================================================================
        // DOM SCRAPER (Profiles & Links)
        // =========================================================================
        const uiAvatar = document.getElementById('ui-avatar');
        const uiUsername = document.getElementById('ui-username');
        const uiCaption = document.getElementById('ui-caption');
        let currentExtractedVideo = null;

        const fetchProfileData = (video) => {
            if (!video) return null;
            let container = video.closest('.Feed-Item, .VideoPlayer') || video.parentElement.parentElement;
            if (!container) container = document.body;
            
            let username = 'User';
            let avatar = fallbackAvatar;
            let caption = '';

            const links = Array.from(container.querySelectorAll('a[href*="/users/"]'));
            if (links.length > 0) {
                const uLink = links.find(a => a.textContent.trim().length > 0);
                if (uLink) username = uLink.textContent.trim();
                
                const img = container.querySelector('img.Avatar, img[src*="avatar"]');
                if (img && img.src) avatar = img.src;
            }

            const titleEl = container.querySelector('.GifTitle, h1, h2');
            if (titleEl) caption = titleEl.textContent.trim();

            return { username, avatar, caption };
        };

        // =========================================================================
        // BUTTON LOGICS
        // =========================================================================
        
        const goToProfile = () => { const u = uiUsername.innerText; if (u && u !== 'User') window.location.href = `/users/${u}`; };
        uiAvatar.onclick = goToProfile; document.getElementById('ui-profile-link').onclick = goToProfile;

        document.getElementById('ui-btn-follow').onclick = function() {
            const activeVid = getActiveVideoFromCenter();
            const container = activeVid?.closest('.Feed-Item, .VideoPlayer') || document;
            const followBtn = Array.from(container.querySelectorAll('button')).find(b => (b.innerText||'').toLowerCase().includes('follow'));
            if (followBtn) {
                followBtn.click();
                this.classList.toggle('following');
                this.innerHTML = this.classList.contains('following') ? 'Following' : 'Follow';
                showToast(this.classList.contains('following') ? 'Followed' : 'Unfollowed');
            } else showToast("Follow button not found in DOM");
        };

        document.getElementById('ui-btn-save').onclick = function() {
            const activeVid = getActiveVideoFromCenter();
            const container = activeVid?.closest('.Feed-Item, .VideoPlayer') || document;
            const likeBtn = container.querySelector('button[aria-label="Like"], .LikeButton');
            if (likeBtn) {
                likeBtn.click();
                const svg = this.querySelector('svg');
                const isLiked = svg.style.fill === 'white';
                svg.style.fill = isLiked ? 'none' : 'white';
                showToast(isLiked ? 'Unliked' : 'Liked');
            } else showToast("Like button not found in DOM");
        };

        const speeds = [0.25, 0.5, 0.75, 1, 1.5, 2];
        let speedIdx = speeds.indexOf(currentPlaybackSpeed); if (speedIdx === -1) speedIdx = 3;
        const uiBtnSpeed = document.getElementById('ui-btn-speed'); uiBtnSpeed.innerText = currentPlaybackSpeed + 'x';
        uiBtnSpeed.onclick = () => { 
            speedIdx = (speedIdx + 1) % speeds.length; currentPlaybackSpeed = speeds[speedIdx]; 
            localStorage.setItem('rg_nuke_speed', currentPlaybackSpeed); uiBtnSpeed.innerText = currentPlaybackSpeed + 'x'; 
            const activeVid = getActiveVideoFromCenter(); if(activeVid) activeVid.playbackRate = currentPlaybackSpeed;
            showToast(`Speed: ${currentPlaybackSpeed}x`); 
        };

        const updateMuteVisuals = () => { 
            document.getElementById('ui-icon-mute').innerHTML = globalMuteState 
                ? `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line>` 
                : `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>`; 
        };
        updateMuteVisuals();
        document.getElementById('ui-btn-mute').onclick = () => { 
            globalMuteState = !globalMuteState; localStorage.setItem('rg_nuke_muted', globalMuteState); 
            const activeVid = getActiveVideoFromCenter(); 
            if(activeVid) { activeVid.muted = globalMuteState; if(!globalMuteState) activeVid.volume = 1; }
            updateMuteVisuals(); showToast(globalMuteState ? 'Muted' : 'Unmuted'); 
        };

        // Aspect ratio button functionality cycling through Original Size -> Crop Full
        document.getElementById('ui-btn-aspect').onclick = () => { 
            currentMode = (currentMode + 1) % modes.length; 
            ratioStyle.innerHTML = modes[currentMode].css; 
            showToast(modes[currentMode].name); 
        };

        document.getElementById('ui-btn-feed').onclick = () => { window.location.href = '/'; };

        let isAutoScrollEnabled = localStorage.getItem('rg_nuke_autoscroll') === 'true';
        const autoScrollBtn = document.getElementById('ui-btn-autoscroll');
        if (isAutoScrollEnabled) autoScrollBtn.style.color = '#1d9bf0';
        
        let lastVideoTime = 0; let lastActiveVideo = null;
        const handleAutoScrollLogic = () => {
            if (!isAutoScrollEnabled) return; 
            const activeMedia = getActiveVideoFromCenter();
            if (activeMedia) {
                if (activeMedia !== lastActiveVideo) { lastActiveVideo = activeMedia; lastVideoTime = activeMedia.currentTime; } 
                else {
                    const hasLooped = (lastVideoTime - activeMedia.currentTime) > 1; 
                    const hasEnded = activeMedia.currentTime >= activeMedia.duration - 0.2;
                    if ((hasLooped || hasEnded) && activeMedia.duration > 1) {
                        executeNavigation('next');
                        lastVideoTime = 0; lastActiveVideo = null; return; 
                    }
                    lastVideoTime = activeMedia.currentTime;
                }
            }
        };

        autoScrollBtn.onclick = () => { 
            isAutoScrollEnabled = !isAutoScrollEnabled; localStorage.setItem('rg_nuke_autoscroll', isAutoScrollEnabled); 
            autoScrollBtn.style.color = isAutoScrollEnabled ? '#1d9bf0' : 'rgba(255,255,255,0.85)';
            showToast(isAutoScrollEnabled ? 'Auto-scroll: ON' : 'Auto-scroll: OFF');
            lastActiveVideo = null;
        };
        setInterval(handleAutoScrollLogic, 500);

        // =========================================================================
        // STATE SYNC & LOOP
        // =========================================================================
        
        const syncMasterUIState = () => {
            globalStyle.disabled = !isMasterEnabled; 
            ratioStyle.disabled = !isMasterEnabled; 
            
            if (!isMasterEnabled) { 
                document.getElementById('ui-btn-master').style.color = '#ff4444'; 
                bottomUI.style.display = 'none';
                scrubberBar.style.display = 'none';
                masterToggleFab.style.display = 'flex';
            } else { 
                document.getElementById('ui-btn-master').style.color = 'rgba(255,255,255,0.85)'; 
                bottomUI.style.display = 'flex';
                scrubberBar.style.display = 'block';
                masterToggleFab.style.display = 'none';
            }
        };
        document.getElementById('ui-btn-master').onclick = () => {
            isMasterEnabled = false; localStorage.setItem('rg_nuke_master_state', false); syncMasterUIState();
            showToast('Normal Mode: ON');
        };
        syncMasterUIState();

        const updateScrubber = () => {
            if (isMasterEnabled) {
                const activeVid = getActiveVideoFromCenter();
                if (activeVid && activeVid.duration) {
                    scrubberBar.style.opacity = controlsVisible ? '1' : '0';
                    scrubberBar.style.width = `${(activeVid.currentTime / activeVid.duration) * 100}%`;
                    
                    if (activeVid.playbackRate !== currentPlaybackSpeed && !gestureState.isPressing) activeVid.playbackRate = currentPlaybackSpeed;
                    if (activeVid.muted !== globalMuteState) { activeVid.muted = globalMuteState; if (!globalMuteState) activeVid.volume = 1; }
                    
                    if (activeVid !== currentExtractedVideo) {
                        const pData = fetchProfileData(activeVid);
                        if (pData) {
                            currentExtractedVideo = activeVid;
                            uiUsername.innerText = pData.username;
                            uiAvatar.src = pData.avatar;
                            uiCaption.innerText = pData.caption;
                            uiCaption.style.display = pData.caption ? '-webkit-box' : 'none';
                        }
                    }
                } else scrubberBar.style.opacity = '0';
                
                document.querySelectorAll('video').forEach(v => {
                    if (v !== activeVid) { v.muted = true; v.pause(); }
                    else if (v.paused && !gestureState.isScrubbing) v.play().catch(()=>{});
                });
            }
            requestAnimationFrame(updateScrubber);
        };
        requestAnimationFrame(updateScrubber);

        // =========================================================================
        // GESTURE ENGINE (Scrub, Hold-Speed, Swipe Nav)
        // =========================================================================
        
        let globalTouchStartY = 0; let globalTouchStartX = 0;
        const gestureState = { timer: null, isPressing: false, isScrubbing: false, preventClick: false, startVideoTime: 0, video: null };

        ['touchstart', 'click', 'keydown'].forEach(evt => { window.addEventListener(evt, () => { if(isMasterEnabled) { const v = getActiveVideoFromCenter(); if(v && !globalMuteState){ v.muted=false; v.volume=1; } } }, { once: true, passive: true }); });

        const hideUI = () => { if (!controlsVisible) return; controlsVisible = false; bottomUI.style.opacity = '0'; Array.from(bottomUI.children).forEach(child => child.style.pointerEvents = 'none'); };
        const showUI = () => { if (controlsVisible) return; controlsVisible = true; bottomUI.style.opacity = '1'; Array.from(bottomUI.children).forEach(child => child.style.pointerEvents = 'auto'); };

        window.addEventListener('click', (e) => { 
            if (!isMasterEnabled) return;
            if (gestureState.preventClick) { e.stopPropagation(); e.preventDefault(); return; }
            if (e.clientX < window.innerWidth * 0.15 || e.clientX > window.innerWidth * 0.85) return; 
            const path = e.composedPath();
            if (!path.some(el => (el.tagName === 'BUTTON' || (el.classList && el.classList.contains('rg-pointer'))))) {
                controlsVisible ? hideUI() : showUI();
            }
        }, { capture: true });

        const formatTime = (s) => {
            const m = Math.floor(s/60);
            const sec = Math.floor(s%60).toString().padStart(2,'0');
            return `${m}:${sec}`;
        };

        window.addEventListener('touchstart', (e) => {
            if (!isMasterEnabled || e.touches.length > 1) return; 
            globalTouchStartY = e.touches[0].clientY; globalTouchStartX = e.touches[0].clientX;
            
            if (e.composedPath().some(el => el.id === 'rg-bottom-ui')) return; 

            gestureState.video = getActiveVideoFromCenter();
            if (!gestureState.video) return;

            gestureState.startVideoTime = gestureState.video.currentTime;
            gestureState.isPressing = false; gestureState.isScrubbing = false; gestureState.preventClick = false;

            gestureState.timer = setTimeout(() => {
                gestureState.isPressing = true; gestureState.preventClick = true; 
                gestureState.video.playbackRate = 2.0; showToast("2x Speed");
            }, 350);
        }, { capture: true, passive: true });
        
        window.addEventListener('touchmove', (e) => {
            if (!isMasterEnabled || e.composedPath().some(el => el.id === 'rg-bottom-ui')) return; 
            const deltaY = e.touches[0].clientY - globalTouchStartY;
            const deltaX = e.touches[0].clientX - globalTouchStartX;

            if (Math.abs(deltaY) > 8 && !gestureState.isScrubbing) hideUI();
            if (!gestureState.video) return;

            if (gestureState.timer && !gestureState.isPressing && Math.abs(deltaX) > 10) { clearTimeout(gestureState.timer); gestureState.timer = null; }

            // SLIDE TO SEEK (SCRUB)
            if (!gestureState.isPressing && Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
                gestureState.isScrubbing = true; gestureState.preventClick = true; 
                const scaleFactor = window.innerWidth / 1.5; 
                let newTime = gestureState.startVideoTime + ((deltaX / scaleFactor) * gestureState.video.duration);
                newTime = Math.max(0, Math.min(newTime, gestureState.video.duration - 0.1));
                gestureState.video.currentTime = newTime;

                const scrubToast = document.getElementById('rg-scrub-toast');
                if (scrubToast) {
                    scrubToast.innerText = `${formatTime(newTime)} / ${formatTime(gestureState.video.duration)}`;
                    scrubToast.style.opacity = '1';
                }
            }
        }, { capture: true, passive: true });
        
        window.addEventListener('touchend', (e) => {
            if (!isMasterEnabled || e.composedPath().some(el => el.id === 'rg-bottom-ui')) return; 

            if (gestureState.timer) { clearTimeout(gestureState.timer); gestureState.timer = null; }
            if (gestureState.isPressing) { gestureState.isPressing = false; if (gestureState.video) gestureState.video.playbackRate = currentPlaybackSpeed; }
            if (gestureState.isScrubbing) { 
                gestureState.isScrubbing = false; 
                const scrubToast = document.getElementById('rg-scrub-toast');
                if (scrubToast) scrubToast.style.opacity = '0';
            }
            if (gestureState.preventClick) setTimeout(() => { gestureState.preventClick = false; }, 100);

            const diffY = globalTouchStartY - e.changedTouches[0].clientY; 
            const diffX = globalTouchStartX - e.changedTouches[0].clientX;

            if (Math.abs(diffX) > Math.abs(diffY)) return; 
            if (diffY > 100) executeNavigation('next'); 
            else if (diffY < -100) executeNavigation('prev');
        }, { capture: true, passive: true });

        let wheelTimeout;
        window.addEventListener('wheel', (e) => {
            if (!isMasterEnabled || e.composedPath().some(el => el.id === 'rg-bottom-ui')) return;
            hideUI();
            clearTimeout(wheelTimeout);
            wheelTimeout = setTimeout(() => {
                if (e.deltaY > 50) executeNavigation('next');
                else if (e.deltaY < -50) executeNavigation('prev');
            }, 100);
        }, { capture: true, passive: true });

        // =========================================================================
        // NAVIGATION (RedGIFs SPA Router)
        // =========================================================================
        const executeNavigation = (dir) => {
            if (!isMasterEnabled) return;
            const key = dir === 'next' ? 'ArrowDown' : 'ArrowUp';
            const keyCode = dir === 'next' ? 40 : 38;
            window.dispatchEvent(new KeyboardEvent('keydown', { key: key, code: key, keyCode: keyCode, bubbles: true }));
        };
    });
})();
