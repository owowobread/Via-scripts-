// ==UserScript==
// @name         Instagram Ultimate Nuke v28.28 (The Seamless Shorts Engine)
// @namespace    https://viayoo.com/
// @version      28.28.2
// @description  Perfect 100vw/100vh Cover, True YouTube Shorts Snap-Scrolling, Hardcore Capture-Phase Profile Playlist Engine, Touch Gesture Engine.
// @author       You
// @run-at       document-start
// @match        https://*.instagram.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // =========================================================================
    // 0. POPUP TAB BOT WORKER
    // =========================================================================
    if (window.location.search.includes('auto_save_bot=true')) {
        document.documentElement.style.opacity = '0';
        document.documentElement.style.pointerEvents = 'none';
        document.body.style.backgroundColor = '#000';
        
        let botAttempts = 0;
        const botInt = setInterval(() => {
            botAttempts++;
            if (botAttempts > 200) { 
                clearInterval(botInt);
                localStorage.setItem('ig_bot_result', 'timeout');
                window.close(); 
                return;
            }

            const svgs = document.querySelectorAll('svg');
            for (let svg of svgs) {
                let label = (svg.getAttribute('aria-label') || '').trim();
                if (label === 'Save' || label === 'Remove') {
                    clearInterval(botInt);
                    const btn = svg.closest('button, [role="button"], a') || svg;
                    btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                    btn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
                    btn.click();
                    localStorage.setItem('ig_bot_result', label === 'Remove' ? 'removed' : 'saved');
                    setTimeout(() => window.close(), 800);
                    return;
                }
                const poly = svg.querySelector('polygon');
                const path = svg.querySelector('path');
                if ((poly && poly.getAttribute('points') && poly.getAttribute('points').includes('20 21 12')) || 
                    (path && path.getAttribute('d') && path.getAttribute('d').includes('20 21 12'))) {
                    clearInterval(botInt);
                    const btn = svg.closest('button, [role="button"], a') || svg;
                    btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                    btn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
                    btn.click();
                    localStorage.setItem('ig_bot_result', 'toggled');
                    setTimeout(() => window.close(), 800);
                    return;
                }
            }
        }, 50);
        return; 
    }

    // =========================================================================
    // 1. KILL ADAPTIVE STREAMING ENGINE
    // =========================================================================
    try {
        Object.defineProperty(window, 'MediaSource', { get: () => undefined });
        Object.defineProperty(window, 'WebKitMediaSource', { get: () => undefined });
    } catch (e) {}

    // =========================================================================
    // 2. THE DATA MUTATOR
    // =========================================================================
    function nukeLowQuality(obj) {
        if (!obj || typeof obj !== 'object') return;
        if (obj.dash_manifest) delete obj.dash_manifest;
        if (Array.isArray(obj.video_versions) && obj.video_versions.length > 0) {
            let staticFiles = obj.video_versions.filter(v => v.url && !v.url.includes('.m3u8') && !v.url.includes('.mpd'));
            if (staticFiles.length > 0) {
                staticFiles.sort((a, b) => ((b.width || 0) * (b.height || 0)) - ((a.width || 0) * (a.height || 0)));
                obj.video_versions = [staticFiles[0]];
            }
        }
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                if (typeof obj[key] === 'object' && obj[key] !== null) {
                    nukeLowQuality(obj[key]);
                }
            }
        }
    }

    // =========================================================================
    // 3. FETCH INTERCEPTOR
    // =========================================================================
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
        const url = args[0] && typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url ? args[0].url : '');
        const response = await originalFetch.apply(this, args);
        if (url.includes('/graphql/') || url.includes('/api/')) {
            try {
                const clone = response.clone();
                const json = await clone.json();
                nukeLowQuality(json);
                return new Response(JSON.stringify(json), {
                    status: response.status,
                    statusText: response.statusText,
                    headers: response.headers
                });
            } catch (e) { return response; }
        }
        return response;
    };

    // =========================================================================
    // 4. STRICT PRELOAD & BUFFER MANAGER
    // =========================================================================
    const originalPlay = HTMLVideoElement.prototype.play;
    HTMLVideoElement.prototype.play = function() {
        this.preload = 'auto';
        if (this.readyState < 3) {
            return new Promise((resolve, reject) => {
                const playWhenReady = () => {
                    this.removeEventListener('canplay', playWhenReady);
                    this.removeEventListener('canplaythrough', playWhenReady);
                    originalPlay.apply(this).then(resolve).catch(reject);
                };
                this.addEventListener('canplaythrough', playWhenReady);
                this.addEventListener('canplay', playWhenReady); 
                this.load(); 
            });
        }
        return originalPlay.apply(this);
    };

    // =========================================================================
    // 5. MAIN SCRIPT
    // =========================================================================
    document.addEventListener("DOMContentLoaded", () => {
        let currentPlaybackSpeed = parseFloat(localStorage.getItem('ig_nuke_speed')) || 1;
        let globalMuteState = false;
        
        let isMasterEnabled = localStorage.getItem('ig_nuke_master_state') === 'true';

        if (window.location.pathname === '/' || window.location.pathname === '/reels/') {
            localStorage.removeItem('ig_nuke_playlist');
            localStorage.removeItem('ig_nuke_playlist_time');
        }

        // --- 5A-1. FORCE PORTRAIT MODE (VIA BROWSER FIX) ---
        [{ name: "screen-orientation", content: "portrait" },
         { name: "x5-orientation", content: "portrait" },
         { name: "orientation", content: "portrait" }].forEach(m => {
            let meta = document.createElement('meta');
            meta.name = m.name;
            meta.content = m.content;
            document.head.appendChild(meta);
        });

        // --- 5A-2. ENFORCED QUALITY CSS ---
        const qualityStyle = document.createElement('style');
        qualityStyle.id = 'ig-max-quality-css';
        qualityStyle.innerHTML = `video, img { filter: none !important; image-rendering: high-quality !important; -webkit-font-smoothing: antialiased !important; }`;
        document.head.appendChild(qualityStyle);

        // --- 5B. THE CORE LAYOUT ENGINE ---
        const globalStyle = document.createElement('style');
        globalStyle.id = 'ig-global-override';
        globalStyle.innerHTML = `
            nav, header, footer, [role="navigation"], [role="tablist"], [role="banner"],
            svg:not(#ig-control-panel svg), 
            button:not(#ig-control-panel button), 
            [role="button"]:not(#ig-control-panel [role="button"]),
            img[alt*="profile" i], 
            span, h1, h2, h3, p, time, marquee {
                display: none !important; opacity: 0 !important; pointer-events: none !important;
            }

            [role="progressbar"] {
                opacity: 0 !important; pointer-events: none !important; height: 1px !important; margin: 10px 0 !important;
            }

            div[style*="position: fixed"][style*="bottom"]:not(#ig-control-panel):not(#ig-toast):not(#ig-scrubber-bar),
            div[style*="position:fixed"][style*="bottom"]:not(#ig-control-panel):not(#ig-toast):not(#ig-scrubber-bar),
            div[style*="position: fixed"][style*="top"]:not(#ig-control-panel):not(#ig-toast):not(#ig-scrubber-bar),
            div[style*="position:fixed"][style*="top"]:not(#ig-control-panel):not(#ig-toast):not(#ig-scrubber-bar) {
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

            #ig-control-panel {
                display: flex !important;
                visibility: visible !important;
                opacity: 1 !important;
                pointer-events: auto !important;
                z-index: 9999999 !important;
            }
        `;
        document.head.appendChild(globalStyle);

        // --- 5C. ASPECT RATIO MANAGER ---
        const ratioStyle = document.createElement('style');
        ratioStyle.id = 'ig-ratio-override';
        document.head.appendChild(ratioStyle);

        const targetFeed = `article video:not(a video), article img:not([alt*="profile" i]):not(a img)`;
        const targetModal = `div[role="dialog"] video:not(a video), div[role="dialog"] img:not([alt*="profile" i]):not(a img)`;

        const modes = [
            { name: "Mode: Cover Fullscreen", css: `
                article div, div[role="dialog"] div {
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

        let currentMode = 0; 
        ratioStyle.innerHTML = modes[currentMode].css; 

        // --- 5D. BACKGROUND SPEED ENGINE & SPA SAFEGUARD ---
        setInterval(() => {
            if (!document.getElementById('ig-global-override')) document.head.appendChild(globalStyle);
            if (!document.getElementById('ig-ratio-override')) document.head.appendChild(ratioStyle);
            if (!document.getElementById('ig-max-quality-css')) document.head.appendChild(qualityStyle);
            if (!document.getElementById('ig-control-panel')) document.body.appendChild(panel);
            if (!document.getElementById('ig-toast')) document.body.appendChild(toast);

            if (globalStyle.disabled !== !isMasterEnabled) globalStyle.disabled = !isMasterEnabled;
            if (ratioStyle.disabled !== !isMasterEnabled) ratioStyle.disabled = !isMasterEnabled;
            if (qualityStyle.disabled !== !isMasterEnabled) qualityStyle.disabled = !isMasterEnabled;

            if (!isMasterEnabled) return;
            
            document.querySelectorAll('video').forEach(video => {
                if (!video.hasAttribute('playsinline')) video.setAttribute('playsinline', '');
                if (!video.hasAttribute('webkit-playsinline')) video.setAttribute('webkit-playsinline', '');

                // Prevent resetting speed if user is actively holding 2x speed
                if (video.playbackRate !== currentPlaybackSpeed && (!gestureState.isPressing || gestureState.video !== video)) {
                    video.playbackRate = currentPlaybackSpeed;
                }
                if (globalMuteState !== null && video.muted !== globalMuteState) {
                    video.muted = globalMuteState;
                }
            });

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
                        if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
                            p.style.setProperty('scroll-snap-type', 'y mandatory', 'important');
                        }
                        p = p.parentElement;
                    }
                }
            }
        }, 500);

        // --- 5E. VIDEO TAP TO CHANGE ASPECT RATIO & ORIENTATION LOCK ---
        document.addEventListener('click', (e) => {
            try { screen.orientation.lock('portrait').catch(()=>{}); } catch(err) {}
            if (!isMasterEnabled) return;
            if (e.target && (e.target.tagName === 'VIDEO' || e.target.tagName === 'IMG')) {
                currentMode = (currentMode + 1) % modes.length; 
                ratioStyle.innerHTML = modes[currentMode].css;
                showToast(modes[currentMode].name);
            }
        });

        // --- 5F. CREATE CONTROL PANEL & TOAST ---
        const panel = document.createElement('div');
        panel.id = 'ig-control-panel'; 
        panel.style.cssText = 'position:fixed;bottom:20px;right:0;display:flex;align-items:center;z-index:9999999;transition:transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);transform:translateX(calc(100% - 30px));';

        const chevronLeft = `<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"></polyline></svg>`;
        const chevronRight = `<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"></polyline></svg>`;

        const slideTab = document.createElement('button');
        slideTab.style.cssText = 'width:30px;height:60px;background:transparent;border:none;color:#fff;cursor:pointer;display:flex;justify-content:center;align-items:center;padding:0;outline:none;box-shadow:none;margin-right:-1px;';
        slideTab.innerHTML = chevronLeft;

        const contentBox = document.createElement('div');
        contentBox.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:16px;background:rgba(0,0,0,0.7);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,0.1);border-right:none;padding:16px;border-radius:25px 0 0 25px;box-shadow:-4px 0 15px rgba(0,0,0,0.5);';

        const menuTray = document.createElement('div');
        menuTray.style.cssText = 'display:grid;grid-template-columns:repeat(3, 40px);gap:12px;';

        const btnBase = 'width:40px;height:40px;border-radius:50%;border:none;background:transparent;color:#fff;cursor:pointer;display:flex;justify-content:center;align-items:center;transition:all 0.2s ease;padding:0;outline:none;';
        const btnHover = 'background:rgba(255,255,255,0.25);transform:scale(1.05);';

        const toast = document.createElement('div');
        toast.id = 'ig-toast';
        toast.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%, -50%);background:rgba(0,0,0,0.8);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,0.1);color:white;padding:12px 24px;border-radius:30px;font-family:sans-serif;font-weight:bold;font-size:14px;z-index:1000000;opacity:0;pointer-events:none;transition:opacity 0.1s;';
        document.body.appendChild(toast);

        let toastTimeout;
        const showToast = (msg, keepAlive = false) => {
            toast.innerText = msg;
            toast.style.setProperty('opacity', '1', 'important');
            toast.style.setProperty('display', 'block', 'important');
            clearTimeout(toastTimeout);
            if (!keepAlive) toastTimeout = setTimeout(() => {
                toast.style.setProperty('opacity', '0', 'important');
            }, 100);
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
                        if (fiber.memoizedProps) {
                            const p = fiber.memoizedProps;
                            if (p.post && p.post.shortcode) return p.post.shortcode;
                            if (p.media && p.media.code) return p.media.code;
                            if (p.xdt_shortcode) return p.xdt_shortcode;
                            if (p.shortcode) return p.shortcode;
                        }
                        fiber = fiber.return;
                    }
                }
                node = node.parentElement;
            }
            return null;
        }

        // Helper to grab the active video in the viewport center
        const getActiveVideoFromCenter = () => {
            const mediaElements = Array.from(document.querySelectorAll('video'));
            let activeMedia = null;
            let minDistance = Infinity;
            const centerY = window.innerHeight / 2;
            mediaElements.forEach(media => {
                const rect = media.getBoundingClientRect();
                if (rect.height === 0 || rect.width === 0) return; 
                const mediaCenter = rect.top + rect.height / 2;
                const distance = Math.abs(centerY - mediaCenter);
                if (distance < minDistance) { minDistance = distance; activeMedia = media; }
            });
            return activeMedia;
        };

        // --- 5G. SEAMLESS PROFILE PLAYLIST ENGINE (CAPTURE PHASE) ---
        let touchStartY = 0;
        let touchStartX = 0;
        let isNavigating = false;

        setInterval(() => {
            if (!isMasterEnabled) return;
            const links = Array.from(document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]'));
            if (links.length > 0) {
                const currentExtracted = links.map(a => {
                    const match = a.href.match(/\/(?:p|reel|reels)\/([^\/?]+)/);
                    return match ? match[1] : null;
                }).filter(Boolean);
                
                if (currentExtracted.length > 0) {
                    let existing = [];
                    try { existing = JSON.parse(localStorage.getItem('ig_nuke_playlist') || '[]'); } catch(e) {}
                    let updatedPlaylist = [...new Set([...existing, ...currentExtracted])];
                    if (updatedPlaylist.length > 300) {
                        updatedPlaylist = updatedPlaylist.slice(-300);
                    }
                    localStorage.setItem('ig_nuke_playlist', JSON.stringify(updatedPlaylist));
                    localStorage.setItem('ig_nuke_playlist_time', Date.now().toString());
                }
            }
        }, 1000);

        const executeNavigation = (direction) => {
            if (isNavigating || !isMasterEnabled) return;
            const path = window.location.pathname;
            const currentMatch = path.match(/\/(?:p|reel|reels)\/([^\/?]+)/);
            if (!currentMatch) return; 
            const currentShortcode = currentMatch[1];
            
            try {
                const savedStr = localStorage.getItem('ig_nuke_playlist');
                if (savedStr) {
                    const playlist = JSON.parse(savedStr);
                    const currentIndex = playlist.indexOf(currentShortcode);
                    
                    if (currentIndex !== -1) {
                        let targetShortcode = null;
                        if (direction === 'next' && currentIndex < playlist.length - 1) {
                            targetShortcode = playlist[currentIndex + 1];
                        } else if (direction === 'prev' && currentIndex > 0) {
                            targetShortcode = playlist[currentIndex - 1];
                        }
                        
                        if (targetShortcode) {
                            isNavigating = true;
                            const loader = document.createElement('div');
                            loader.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100dvh;background:#000;z-index:99999999;display:flex;justify-content:center;align-items:center;color:white;font-family:sans-serif;font-weight:bold;font-size:16px;flex-direction:column;gap:20px;';
                            loader.innerHTML = `
                                <svg width="40" height="40" viewBox="0 0 50 50" style="animation: spin 1s linear infinite;">
                                    <circle cx="25" cy="25" r="20" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="4"></circle>
                                    <circle cx="25" cy="25" r="20" fill="none" stroke="#fff" stroke-width="4" stroke-dasharray="31.4 125.6" stroke-linecap="round"></circle>
                                </svg>
                                <div>Loading ${direction === 'next' ? 'Next' : 'Previous'}...</div>
                                <style>@keyframes spin { 100% { transform: rotate(360deg); } }</style>
                            `;
                            document.body.appendChild(loader);

                            const type = path.includes('/reel') ? 'reel' : 'p';
                            window.location.assign(`/${type}/${targetShortcode}/`);
                        } else {
                            showToast(direction === 'next' ? 'End of loaded grid.' : 'Already at the first post.');
                        }
                    }
                }
            } catch(e) {}
        };

        window.addEventListener('touchstart', (e) => {
            if (!isMasterEnabled || e.touches.length > 1) return;
            touchStartY = e.touches[0].clientY;
            touchStartX = e.touches[0].clientX;
        }, { capture: true, passive: true });

        window.addEventListener('touchend', (e) => {
            if (!isMasterEnabled) return;
            const touchEndY = e.changedTouches[0].clientY;
            const touchEndX = e.changedTouches[0].clientX;
            
            const diffY = touchStartY - touchEndY;
            const diffX = touchStartX - touchEndX;
            
            // Allow Gesture Engine to process horizontal moves
            if (Math.abs(diffX) > Math.abs(diffY)) return;

            if (diffY > 100) executeNavigation('next');
            else if (diffY < -100) executeNavigation('prev');
        }, { capture: true, passive: true });

        let wheelTimeout;
        window.addEventListener('wheel', (e) => {
            if (!isMasterEnabled) return;
            clearTimeout(wheelTimeout);
            wheelTimeout = setTimeout(() => {
                if (e.deltaY > 60) executeNavigation('next');
                else if (e.deltaY < -60) executeNavigation('prev');
            }, 100);
        }, { capture: true, passive: true });


        // =========================================================================
        // 5H. CUSTOM TOUCH GESTURE ENGINE (Hold-to-Speed & Swipe-to-Seek)
        // =========================================================================
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

        // Scrubber Bar UI Injection
        const scrubberBar = document.createElement('div');
        scrubberBar.id = 'ig-scrubber-bar';
        scrubberBar.style.cssText = 'position:fixed;bottom:0;left:0;height:3px;background:rgba(255,255,255,1);z-index:9999998;width:0%;pointer-events:none;box-shadow:0 -1px 5px rgba(0,0,0,0.7);transition:opacity 0.2s ease;opacity:0;';
        document.body.appendChild(scrubberBar);

        // Hardware accelerated dynamic UI update loop
        const updateScrubber = () => {
            if (isMasterEnabled) {
                const video = gestureState.isScrubbing && gestureState.video ? gestureState.video : getActiveVideoFromCenter();
                if (video && video.duration) {
                    scrubberBar.style.opacity = '1';
                    scrubberBar.style.width = `${(video.currentTime / video.duration) * 100}%`;
                } else {
                    scrubberBar.style.opacity = '0';
                }
            } else {
                scrubberBar.style.opacity = '0';
            }
            requestAnimationFrame(updateScrubber);
        };
        requestAnimationFrame(updateScrubber);

        // Global Click Interceptor (Prevents pausing/unmuting during/after gestures)
        window.addEventListener('click', (e) => {
            if (gestureState.preventClick) {
                e.stopPropagation();
                e.preventDefault();
            }
        }, { capture: true });

        window.addEventListener('touchstart', (e) => {
            if (!isMasterEnabled || e.touches.length > 1) return;
            
            // Ensure UI touches are ignored
            const path = e.composedPath();
            if (path.some(el => el.id === 'ig-control-panel')) return;

            gestureState.video = getActiveVideoFromCenter();
            if (!gestureState.video) return;

            gestureState.startX = e.touches[0].clientX;
            gestureState.startY = e.touches[0].clientY;
            gestureState.startVideoTime = gestureState.video.currentTime;
            gestureState.isPressing = false;
            gestureState.isScrubbing = false;
            gestureState.preventClick = false;

            // Trigger Hold-to-Fast-Forward
            gestureState.timer = setTimeout(() => {
                gestureState.isPressing = true;
                gestureState.preventClick = true; // Sets flag to stop accidental un-mute clicks on release
                gestureState.video.playbackRate = 2.0;
                showToast("2x Speed");
            }, 350);

        }, { capture: true, passive: true });

        window.addEventListener('touchmove', (e) => {
            if (!isMasterEnabled || !gestureState.video) return;

            const deltaX = e.touches[0].clientX - gestureState.startX;
            const deltaY = e.touches[0].clientY - gestureState.startY;

            // Cancel 2x speed hold if horizontal movement detected early
            if (gestureState.timer && !gestureState.isPressing && Math.abs(deltaX) > 10) {
                clearTimeout(gestureState.timer);
                gestureState.timer = null;
            }

            // Swipe-to-Seek Check (Requires predominant horizontal movement)
            if (!gestureState.isPressing && Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
                gestureState.isScrubbing = true;
                gestureState.preventClick = true; 

                // Map screen width to video duration for intuitive dragging
                const scaleFactor = window.innerWidth / 1.5; 
                let timeOffset = (deltaX / scaleFactor) * gestureState.video.duration;
                let newTime = gestureState.startVideoTime + timeOffset;

                // Clamp time constraints safely 
                newTime = Math.max(0, Math.min(newTime, gestureState.video.duration - 0.1));
                gestureState.video.currentTime = newTime;
            }
        }, { capture: true, passive: true });

        window.addEventListener('touchend', (e) => {
            if (!isMasterEnabled) return;

            if (gestureState.timer) {
                clearTimeout(gestureState.timer);
                gestureState.timer = null;
            }

            // Clean up Hold-to-Fast-Forward phase
            if (gestureState.isPressing) {
                gestureState.isPressing = false;
                if (gestureState.video) gestureState.video.playbackRate = currentPlaybackSpeed;
            }

            // Clean up Swipe-to-Seek phase
            if (gestureState.isScrubbing) {
                gestureState.isScrubbing = false;
            }

            // Delay removing the click guard to properly catch the upcoming synthetic 'click' event
            if (gestureState.preventClick) {
                setTimeout(() => { gestureState.preventClick = false; }, 100);
            }
        }, { capture: true, passive: true });


        // =========================================================================
        // --- ALL ORIGINAL BUTTONS RESTORED ---
        // =========================================================================
        const aspectRatioBtn = document.createElement('button');
        aspectRatioBtn.style.cssText = btnBase;
        aspectRatioBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg>`;
        aspectRatioBtn.onmouseenter = () => aspectRatioBtn.style.cssText = btnBase + btnHover;
        aspectRatioBtn.onmouseleave = () => aspectRatioBtn.style.cssText = btnBase;
        aspectRatioBtn.onclick = () => {
            currentMode = (currentMode + 1) % modes.length; 
            ratioStyle.innerHTML = modes[currentMode].css;
            aspectRatioBtn.style.transform = 'scale(0.8)';
            setTimeout(() => aspectRatioBtn.style.transform = 'scale(1)', 150);
            showToast(modes[currentMode].name);
        };

        const saveBtn = document.createElement('button');
        saveBtn.style.cssText = btnBase;
        saveBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>`;
        saveBtn.onmouseenter = () => saveBtn.style.cssText = btnBase + btnHover;
        saveBtn.onmouseleave = () => saveBtn.style.cssText = btnBase;
        saveBtn.onclick = () => {
            const activeMedia = getActiveVideoFromCenter() || document.querySelector('img:not([alt*="profile" i])');
            if (activeMedia) {
                saveBtn.style.transform = 'scale(0.8)';
                setTimeout(() => saveBtn.style.transform = 'scale(1)', 150);

                const postContainer = activeMedia.closest('article, [role="presentation"], main') || activeMedia.parentElement.parentElement;
                
                if (postContainer) {
                    const svgs = postContainer.querySelectorAll('svg');
                    let nativeClicked = false;
                    for (let svg of svgs) {
                        let label = (svg.getAttribute('aria-label') || '').trim();
                        if (label === 'Save' || label === 'Remove') {
                            const btn = svg.closest('button, [role="button"], a') || svg;
                            btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                            btn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
                            btn.click();
                            showToast(label === 'Remove' ? "Removed from Profile!" : "Saved to Profile!");
                            nativeClicked = true;
                            break;
                        }
                        const poly = svg.querySelector('polygon');
                        const path = svg.querySelector('path');
                        if ((poly && poly.getAttribute('points') && poly.getAttribute('points').includes('20 21 12')) || 
                            (path && path.getAttribute('d') && path.getAttribute('d').includes('20 21 12'))) {
                            const btn = svg.closest('button, [role="button"], a') || svg;
                            btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                            btn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
                            btn.click();
                            showToast("Bookmark Toggled!");
                            nativeClicked = true;
                            break;
                        }
                    }
                    if (nativeClicked) return; 
                }
                
                let shortcode = extractShortcode(activeMedia);
                if (!shortcode) {
                    let link = postContainer ? postContainer.querySelector('a[href*="/p/"], a[href*="/reel/"], a[href*="/reels/"]') : null;
                    if (link) {
                        const match = link.href.match(/\/(?:p|reel|reels)\/([^\/?]+)/);
                        if (match) shortcode = match[1];
                    }
                }
                if (!shortcode) {
                    const urlMatch = window.location.pathname.match(/\/(?:p|reel|reels)\/([^\/?]+)/);
                    if (urlMatch) shortcode = urlMatch[1];
                }

                if (shortcode) {
                    localStorage.removeItem('ig_bot_result');
                    const botTab = window.open(`/p/${shortcode}/?auto_save_bot=true`, 'ig_bot_tab', 'width=100,height=100,left=-1000,top=-1000');
                    if (!botTab) return showToast("Browser blocked popup! Allow popups.");
                    showToast("Bot opening tab...", true);

                    let checkAttempts = 0;
                    const statusChecker = setInterval(() => {
                        checkAttempts++;
                        if (checkAttempts > 150) { 
                            clearInterval(statusChecker);
                            if (botTab && !botTab.closed) botTab.close();
                            return showToast("Tab timeout: Connection too slow");
                        }
                        const result = localStorage.getItem('ig_bot_result');
                        if (result) {
                            clearInterval(statusChecker);
                            localStorage.removeItem('ig_bot_result');
                            if (botTab && !botTab.closed) botTab.close();
                            if (result === 'saved') showToast("Saved to Profile!");
                            else if (result === 'removed') showToast("Removed from Profile!");
                            else if (result === 'toggled') showToast("Bookmark Toggled!");
                            else showToast("Bot Error: Button missing in tab");
                        }
                    }, 100);
                } else { showToast('Error: Cannot extract post URL'); }
            } else { showToast('No active post found on screen'); }
        };

        const speedBtn = document.createElement('button');
        speedBtn.style.cssText = btnBase + 'font-family:sans-serif;font-size:14px;font-weight:bold;color:rgba(255,255,255,0.9);text-shadow:0px 1px 3px rgba(0,0,0,0.8);';
        speedBtn.innerText = currentPlaybackSpeed + 'x'; 
        speedBtn.onmouseenter = () => speedBtn.style.cssText = btnBase + btnHover + 'font-family:sans-serif;font-size:14px;font-weight:bold;color:rgba(255,255,255,0.9);text-shadow:0px 1px 3px rgba(0,0,0,0.8);';
        speedBtn.onmouseleave = () => speedBtn.style.cssText = btnBase + 'font-family:sans-serif;font-size:14px;font-weight:bold;color:rgba(255,255,255,0.9);text-shadow:0px 1px 3px rgba(0,0,0,0.8);';

        const speeds = [0.25, 0.5, 0.75, 1, 2, 3];
        let speedIdx = speeds.indexOf(currentPlaybackSpeed);
        if (speedIdx === -1) speedIdx = 3;
        speedBtn.onclick = () => {
            speedIdx = (speedIdx + 1) % speeds.length;
            currentPlaybackSpeed = speeds[speedIdx];
            localStorage.setItem('ig_nuke_speed', currentPlaybackSpeed);
            speedBtn.innerText = currentPlaybackSpeed + 'x';
            document.querySelectorAll('video').forEach(video => video.playbackRate = currentPlaybackSpeed);
            speedBtn.style.transform = 'scale(0.9)';
            setTimeout(() => speedBtn.style.transform = 'scale(1)', 150);
            showToast(`Speed: ${currentPlaybackSpeed}x`);
        };

        const muteBtn = document.createElement('button');
        muteBtn.style.cssText = btnBase;
        muteBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>`;
        muteBtn.onmouseenter = () => muteBtn.style.cssText = btnBase + btnHover;
        muteBtn.onmouseleave = () => muteBtn.style.cssText = btnBase;
        muteBtn.onclick = () => {
            globalMuteState = !globalMuteState;
            document.querySelectorAll('video').forEach(video => { video.muted = globalMuteState; });
            muteBtn.style.transform = 'scale(0.9)';
            setTimeout(() => muteBtn.style.transform = 'scale(1)', 150);
            showToast(globalMuteState ? 'Muted' : 'Unmuted');
        };

        const profileBtn = document.createElement('button');
        profileBtn.style.cssText = btnBase;
        profileBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
        profileBtn.onmouseenter = () => profileBtn.style.cssText = btnBase + btnHover;
        profileBtn.onmouseleave = () => profileBtn.style.cssText = btnBase;
        profileBtn.onclick = () => {
            const activeMedia = getActiveVideoFromCenter() || document.querySelector('img:not([alt*="profile" i])');

            if (activeMedia) {
                profileBtn.style.transform = 'scale(0.8)';
                setTimeout(() => profileBtn.style.transform = 'scale(1)', 150);
                let username = null;
                const postContainer = activeMedia.closest('article, [role="presentation"], main') || activeMedia.parentElement.parentElement;

                if (postContainer) {
                    const links = Array.from(postContainer.querySelectorAll('a[href]'));
                    const ignore = ['p', 'reel', 'reels', 'explore', 'direct', 'stories', 'audio', 'tags', 'your_activity'];
                    for (let link of links) {
                        let path = link.getAttribute('href');
                        if (path && path.startsWith('/') && path.length > 2) {
                            let parts = path.split('/').filter(Boolean);
                            if (parts.length > 0 && !ignore.includes(parts[0])) { username = parts[0]; break; }
                        }
                    }
                }

                if (!username) {
                    let node = activeMedia;
                    for (let i = 0; i < 15; i++) {
                        if (!node) break;
                        const reactKey = Object.keys(node).find(k => k.startsWith('__reactFiber$'));
                        if (reactKey) {
                            let fiber = node[reactKey];
                            for (let j = 0; j < 20; j++) {
                                if (!fiber) break;
                                if (fiber.memoizedProps) {
                                    const p = fiber.memoizedProps;
                                    if (p.media && p.media.owner && p.media.owner.username) { username = p.media.owner.username; break; }
                                    if (p.post && p.post.user && p.post.user.username) { username = p.post.user.username; break; }
                                    if (p.xdt_shortcode && p.xdt_shortcode.owner && p.xdt_shortcode.owner.username) { username = p.xdt_shortcode.owner.username; break; }
                                }
                                fiber = fiber.return;
                            }
                        }
                        if (username) break;
                        node = node.parentElement;
                    }
                }
                if (username) window.location.href = `/${username}/`;
                else showToast('Error: Cannot extract profile');
            } else { showToast('No active post found'); }
        };

        const followBtn = document.createElement('button');
        followBtn.style.cssText = btnBase;
        followBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>`;
        followBtn.onmouseenter = () => followBtn.style.cssText = btnBase + btnHover;
        followBtn.onmouseleave = () => followBtn.style.cssText = btnBase;
        followBtn.onclick = () => {
            followBtn.style.transform = 'scale(0.8)';
            setTimeout(() => followBtn.style.transform = 'scale(1)', 150);

            const activeMedia = getActiveVideoFromCenter() || document.querySelector('img:not([alt*="profile" i])');

            let found = false;
            const searchAndClickFollow = (root) => {
                const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
                let textNode;
                while (textNode = walker.nextNode()) {
                    const val = textNode.nodeValue.trim().toLowerCase();
                    if (val === 'follow' || val === 'follow back') {
                        const clickable = textNode.parentElement.closest('button, [role="button"], a') || textNode.parentElement;
                        clickable.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                        clickable.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
                        clickable.click();
                        showToast('Follow Triggered!');
                        return true;
                    } else if (val === 'following') {
                        showToast('Already Following!');
                        return true;
                    }
                }
                return false;
            };

            if (activeMedia) {
                const postContainer = activeMedia.closest('article, [role="presentation"], main') || activeMedia.parentElement.parentElement;
                if (postContainer) found = searchAndClickFollow(postContainer);
            }
            if (!found) found = searchAndClickFollow(document.body);
            if (!found) showToast('Follow button not found');
        };

        const feedToggleBtn = document.createElement('button');
        feedToggleBtn.style.cssText = btnBase;
        feedToggleBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect><line x1="7" y1="2" x2="7" y2="22"></line><line x1="17" y1="2" x2="17" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line><line x1="2" y1="7" x2="7" y2="7"></line><line x1="2" y1="17" x2="7" y2="17"></line><line x1="17" y1="17" x2="22" y2="17"></line><line x1="17" y1="7" x2="22" y2="7"></line></svg>`;
        feedToggleBtn.onmouseenter = () => feedToggleBtn.style.cssText = btnBase + btnHover;
        feedToggleBtn.onmouseleave = () => feedToggleBtn.style.cssText = btnBase;
        feedToggleBtn.onclick = () => {
            feedToggleBtn.style.transform = 'scale(0.8)';
            setTimeout(() => feedToggleBtn.style.transform = 'scale(1)', 150);
            localStorage.removeItem('ig_nuke_playlist'); 
            const onReels = window.location.pathname.includes('/reels') || window.location.pathname.includes('/reel');
            window.location.href = onReels ? '/' : '/reels/';
        };

        const savedSectionBtn = document.createElement('button');
        savedSectionBtn.style.cssText = btnBase;
        savedSectionBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>`;
        savedSectionBtn.onmouseenter = () => savedSectionBtn.style.cssText = btnBase + btnHover;
        savedSectionBtn.onmouseleave = () => savedSectionBtn.style.cssText = btnBase;
        savedSectionBtn.onclick = () => {
            savedSectionBtn.style.transform = 'scale(0.8)';
            setTimeout(() => savedSectionBtn.style.transform = 'scale(1)', 150);
            
            let username = null;
            const navLinks = document.querySelectorAll('a[href]');
            for (let a of navLinks) {
                const img = a.querySelector('img[alt*="profile"]');
                if (img) {
                    const parts = a.getAttribute('href').split('/').filter(Boolean);
                    if (parts.length === 1) {
                        username = parts[0];
                        break;
                    }
                }
            }
            if (!username) {
                try {
                    const scripts = Array.from(document.querySelectorAll('script'));
                    for(let s of scripts) {
                        if (s.innerText.includes('"username":"')) {
                            const match = s.innerText.match(/"username":"([^"]+)"/);
                            if (match && match[1]) {
                                username = match[1];
                                break;
                            }
                        }
                    }
                } catch(e) {}
            }
            
            if (username) {
                window.location.href = `/${username}/saved/`;
            } else {
                showToast("Cannot determine username. Navigating to profile...");
                const profileBtnNode = document.querySelector('a[href] img[alt*="profile"]');
                if (profileBtnNode && profileBtnNode.closest('a')) {
                    profileBtnNode.closest('a').click();
                } else {
                    showToast("Error locating user profile");
                }
            }
        };

        const refreshBtn = document.createElement('button');
        refreshBtn.style.cssText = btnBase;
        refreshBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2v6h-6"></path><path d="M21 13a9 9 0 1 1-3-7.7L21 8"></path></svg>`;
        refreshBtn.onmouseenter = () => refreshBtn.style.cssText = btnBase + btnHover;
        refreshBtn.onmouseleave = () => refreshBtn.style.cssText = btnBase;
        refreshBtn.onclick = () => {
            refreshBtn.style.transform = 'scale(0.8)';
            setTimeout(() => refreshBtn.style.transform = 'scale(1)', 150);
            localStorage.removeItem('ig_nuke_playlist');
            window.location.reload();
        };

        let isAutoScrollEnabled = localStorage.getItem('ig_nuke_autoscroll') === 'true';
        let autoScrollIntervalTimer = null;
        let lastActiveVideo = null;
        let lastVideoTime = 0;
        
        const autoScrollBtn = document.createElement('button');
        autoScrollBtn.style.cssText = btnBase;
        autoScrollBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="7 13 12 18 17 13"></polyline><polyline points="7 6 12 11 17 6"></polyline></svg>`;
        autoScrollBtn.onmouseenter = () => { if (!isAutoScrollEnabled) autoScrollBtn.style.cssText = btnBase + btnHover; };
        autoScrollBtn.onmouseleave = () => { if (!isAutoScrollEnabled) autoScrollBtn.style.cssText = btnBase; };
        
        const handleAutoScrollLogic = () => {
            if (!isAutoScrollEnabled) return;
            const activeMedia = getActiveVideoFromCenter();

            if (activeMedia) {
                if (activeMedia !== lastActiveVideo) {
                    lastActiveVideo = activeMedia;
                    lastVideoTime = activeMedia.currentTime;
                } else {
                    const hasLooped = (lastVideoTime - activeMedia.currentTime) > 1; 
                    const hasEnded = activeMedia.currentTime >= activeMedia.duration - 0.2;
                    
                    if (hasLooped || hasEnded) {
                        const currentContainer = activeMedia.closest('article, [role="dialog"]');
                        if (currentContainer && currentContainer.nextElementSibling) {
                            currentContainer.nextElementSibling.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        } else {
                            executeNavigation('next');
                        }
                        
                        lastVideoTime = 0; 
                        lastActiveVideo = null; 
                        return; 
                    }
                    lastVideoTime = activeMedia.currentTime;
                }
            }
        };

        autoScrollBtn.onclick = () => {
            isAutoScrollEnabled = !isAutoScrollEnabled;
            localStorage.setItem('ig_nuke_autoscroll', isAutoScrollEnabled);
            autoScrollBtn.style.transform = 'scale(0.8)';
            setTimeout(() => autoScrollBtn.style.transform = 'scale(1)', 150);
            
            if (isAutoScrollEnabled) {
                autoScrollBtn.style.background = 'rgba(255,255,255,0.25)';
                showToast('Auto-scroll: ON');
                autoScrollIntervalTimer = setInterval(handleAutoScrollLogic, 500);
            } else {
                autoScrollBtn.style.background = 'transparent';
                showToast('Auto-scroll: OFF');
                clearInterval(autoScrollIntervalTimer);
                lastActiveVideo = null;
            }
        };

        if (isAutoScrollEnabled) {
            autoScrollBtn.style.background = 'rgba(255,255,255,0.25)';
            autoScrollIntervalTimer = setInterval(handleAutoScrollLogic, 500);
        }

        const mainFab = document.createElement('button');
        mainFab.style.cssText = 'width:50px;height:50px;border-radius:50%;border:1px solid rgba(255,255,255,0.2);background:transparent;color:#fff;cursor:pointer;display:flex;justify-content:center;align-items:center;box-shadow:0 4px 12px rgba(0,0,0,0.5);transition:all 0.3s cubic-bezier(0.4, 0, 0.2, 1);padding:0;outline:none;';
        
        const syncUIState = () => {
            if (isMasterEnabled) {
                globalStyle.disabled = false;
                ratioStyle.disabled = false;
                qualityStyle.disabled = false;
                document.querySelectorAll('video').forEach(video => { video.playbackRate = currentPlaybackSpeed; });
                
                mainFab.style.background = 'transparent';
                mainFab.style.color = '#fff';
                mainFab.style.borderColor = 'rgba(255,255,255,0.2)';
                mainFab.innerHTML = `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path><line x1="12" y1="2" x2="12" y2="12"></line></svg>`;
            } else {
                globalStyle.disabled = true;
                ratioStyle.disabled = true;
                qualityStyle.disabled = true;
                document.querySelectorAll('video').forEach(video => { video.playbackRate = 1; });
                
                mainFab.style.background = 'rgba(255,68,68,0.2)';
                mainFab.style.color = '#ff4444';
                mainFab.style.borderColor = 'rgba(255,68,68,0.5)';
                mainFab.innerHTML = `<svg width="24" height="24" fill="none" stroke="#ff4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path><line x1="12" y1="2" x2="12" y2="12"></line></svg>`;
            }
        };

        mainFab.onclick = () => {
            isMasterEnabled = !isMasterEnabled;
            localStorage.setItem('ig_nuke_master_state', isMasterEnabled);
            syncUIState();
            showToast(isMasterEnabled ? 'Normal Mode: OFF' : 'Normal Mode: ON');
            
            mainFab.style.transform = 'scale(0.9)';
            setTimeout(() => mainFab.style.transform = 'scale(1)', 150);
        };

        let panelOpen = false;
        slideTab.onclick = () => {
            panelOpen = !panelOpen;
            if (panelOpen) {
                panel.style.transform = 'translateX(0)';
                slideTab.innerHTML = chevronRight;
            } else {
                panel.style.transform = 'translateX(calc(100% - 30px))';
                slideTab.innerHTML = chevronLeft;
            }
        };

        const closeMenuOnScroll = () => {
            if (panelOpen) { 
                panelOpen = false; 
                panel.style.transform = 'translateX(calc(100% - 30px))';
                slideTab.innerHTML = chevronLeft;
            }
        };
        
        window.addEventListener('scroll', closeMenuOnScroll, { capture: true, passive: true });
        window.addEventListener('wheel', closeMenuOnScroll, { capture: true, passive: true });
        window.addEventListener('touchmove', closeMenuOnScroll, { capture: true, passive: true });

        menuTray.appendChild(speedBtn);
        menuTray.appendChild(muteBtn);
        menuTray.appendChild(saveBtn);
        menuTray.appendChild(profileBtn);
        menuTray.appendChild(followBtn);
        menuTray.appendChild(aspectRatioBtn); 
        menuTray.appendChild(feedToggleBtn);
        menuTray.appendChild(savedSectionBtn);
        menuTray.appendChild(refreshBtn);
        menuTray.appendChild(autoScrollBtn);

        contentBox.appendChild(menuTray);
        contentBox.appendChild(mainFab);

        panel.appendChild(slideTab);
        panel.appendChild(contentBox);

        document.body.appendChild(panel);
        syncUIState();
    });
})();
