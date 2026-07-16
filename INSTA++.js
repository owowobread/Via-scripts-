// ==UserScript==
// @name         Instagram Reels ++
// @namespace    http://tampermonkey.net/
// @version      4.0.2
// @description  Instagram Script that enables TikTok like Mode to Browser Profiles and Home Page, Also enahnced the Reels section.
// @author       Kristijan1001
// @match        https://www.instagram.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=instagram.com
// @grant        none
// @run-at       document-start
// @license      MIT
// @downloadURL https://update.greasyfork.org/scripts/551737/Instagram%20Reels%20%2B%2B.user.js
// @updateURL https://update.greasyfork.org/scripts/551737/Instagram%20Reels%20%2B%2B.meta.js
// ==/UserScript==

(function () {
    'use strict';

    // Shared version — shown on the trigger so the running build is verifiable.
    const IG_VERSION = '4.0.0';
    // Zoom-mode oversize factor. Must match `width/height` in .igr-fit-zoom CSS
    // (130%). Used by setPan to convert the 0..100 pan value into a px offset.
    const IG_ZOOM = 1.30;

    /* ════════════════════════════════════════════════════════════════════
       PART 1 — NATIVE /reels/ ENHANCER
       (sidebar Favorites/Saved/Liked links, snap-scroll, smart auto-loader,
        floating up/down nav buttons)
       ════════════════════════════════════════════════════════════════════ */
    (function () {
        'use strict';

        // --- GLOBAL STATE ---
        let currentUsername = null;
        let wheelTimeout = null;
        let lastWheelTime = 0;
        let isSnapping = false;
        let currentIndex = 0;

        let navButtonsEl = null;

        let isLoadingMore = false;
        let loaderEl = null;
        let videosObserver = null;
        let lastVideoCount = 0;
        let loadTimeout = null;
        const LOAD_TIMEOUT = 8000;
        const SNAP_COOLDOWN = 350;

        function getCurrentUsername() {
            try {
                const navLinks = document.querySelectorAll('div.x1iyjqo2 a[href^="/"], .PolarisNavigationIcons a[href^="/"], div[role="navigation"] a[href^="/"]');
                for (const link of navLinks) {
                    const hasImg = link.querySelector('img');
                    const href = link.getAttribute('href');
                    if (hasImg && href && href !== '/' && !href.startsWith('/reels/') && !href.startsWith('/explore/')) {
                        const match = href.match(/^\/([a-zA-Z0-9_.]+)\/?$/);
                        if (match) {
                            const candidate = match[1];
                            if (!['home', 'inbox', 'explore', 'reels', 'stories'].includes(candidate)) {
                                return candidate;
                            }
                        }
                    }
                }
                const scripts = document.querySelectorAll('script');
                for (const s of scripts) {
                    const text = s.textContent;
                    if (text.includes('"viewer"')) {
                        const match = text.match(/"username":"([a-zA-Z0-9_.]+)"/);
                        if (match) return match[1];
                    }
                }
            } catch (e) {
                console.error("Username detection error:", e);
            }
            return null;
        }

        function updateUsername() {
            const username = getCurrentUsername();
            if (username && username !== currentUsername) {
                currentUsername = username;
                const bookLink = document.getElementById('bookmarks-nav-item');
                if (bookLink) {
                    bookLink.href = `/${currentUsername}/saved/all-posts/`;
                }
                updateButtonStates();
            }
        }

        const style = document.createElement('style');
        style.id = 'insta-reel-fix';
        style.textContent = `
            * { scroll-snap-type: none !important; scroll-snap-align: none !important; }
            ::-webkit-scrollbar { display: none !important; width: 0 !important; }
            body { scrollbar-width: none !important; }
            main[role="main"] > div > div > div {
                height: 100dvh !important; max-height: 100dvh !important; width: auto !important;
                margin: 0 !important; padding: 0 !important; box-sizing: border-box !important;
            }
            video { max-height: 100dvh !important; width: auto !important; object-fit: contain !important; }
            body:has(a[href*="/reels/"]) main[role="main"] {
                height: 100dvh !important; max-height: 100dvh !important; overflow-y: auto !important; scroll-behavior: auto !important;
            }
            [style*="--x-height: 16px"] { display: none !important; }
            div[role="toolbar"][aria-label="Reels navigation controls"] { display: none !important; }
            .reels-loader {
                position: fixed !important; right: 20px !important; top: -200px !important;
                background: linear-gradient(135deg, rgba(131, 58, 180, 0.95) 0%, rgba(253, 29, 29, 0.95) 50%, rgba(252, 176, 69, 0.95) 100%) !important;
                color: white !important; padding: 16px 20px !important; border-radius: 16px !important;
                font-family: system-ui, -apple-system, sans-serif !important; font-size: 14px !important;
                font-weight: 600 !important; z-index: 999999 !important; display: flex !important;
                flex-direction: column !important; align-items: center !important; gap: 10px !important;
                box-shadow: 0 10px 40px rgba(0,0,0,0.6), 0 0 20px rgba(253, 29, 29, 0.3) !important;
                pointer-events: none !important; transition: top 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) !important;
                backdrop-filter: blur(10px) !important; border: 2px solid rgba(255, 255, 255, 0.2) !important; min-width: 120px !important;
            }
            .reels-loader.visible { top: 140px !important; }
            .reels-loader-spinner { width: 32px !important; height: 32px !important; position: relative !important; }
            .reels-loader-spinner::before, .reels-loader-spinner::after { content: '' !important; position: absolute !important; border-radius: 50% !important; }
            .reels-loader-spinner::before { width: 32px !important; height: 32px !important; border: 3px solid transparent !important; border-top-color: white !important; border-right-color: white !important; animation: spin 1s cubic-bezier(0.68, -0.55, 0.265, 1.55) infinite !important; }
            .reels-loader-spinner::after { width: 22px !important; height: 22px !important; top: 5px !important; left: 5px !important; border: 3px solid transparent !important; border-bottom-color: rgba(255, 255, 255, 0.7) !important; border-left-color: rgba(255, 255, 255, 0.7) !important; animation: spin 0.7s cubic-bezier(0.68, -0.55, 0.265, 1.55) infinite reverse !important; }
            .reels-loader-text { font-size: 12px !important; letter-spacing: 0.5px !important; text-transform: uppercase !important; animation: pulse 1.5s ease-in-out infinite !important; text-shadow: 0 2px 4px rgba(0,0,0,0.3) !important; }
            .reels-loader-dots { display: flex !important; gap: 4px !important; margin-top: -4px !important; }
            .reels-loader-dot { width: 5px !important; height: 5px !important; background: white !important; border-radius: 50% !important; animation: bounce 1.4s ease-in-out infinite !important; box-shadow: 0 2px 4px rgba(0,0,0,0.2) !important; }
            .reels-loader-dot:nth-child(1) { animation-delay: 0s !important; }
            .reels-loader-dot:nth-child(2) { animation-delay: 0.2s !important; }
            .reels-loader-dot:nth-child(3) { animation-delay: 0.4s !important; }
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.8; transform: scale(0.98); } }
            @keyframes bounce { 0%, 80%, 100% { transform: translateY(0) scale(1); opacity: 0.7; } 40% { transform: translateY(-8px) scale(1.1); opacity: 1; } }
            @keyframes pulse-ring { 0% { transform: scale(0.95); opacity: 1; } 50% { transform: scale(1.05); opacity: 0.7; } 100% { transform: scale(1.15); opacity: 0; } }
            @keyframes float-up { 0% { transform: translateY(0) scale(1); opacity: 1; } 100% { transform: translateY(-8px) scale(1.1); opacity: 0; } }
            @keyframes float-down { 0% { transform: translateY(0) scale(1); opacity: 1; } 100% { transform: translateY(8px) scale(1.1); opacity: 0; } }
            .reels-nav-container { position: fixed !important; right: 25px !important; top: 50% !important; transform: translateY(-50%) !important; display: flex !important; flex-direction: column !important; gap: 20px !important; z-index: 99999 !important; }
            .reels-nav-btn {
                width: 54px !important; height: 54px !important; border-radius: 50% !important;
                background: linear-gradient(135deg, rgba(100, 150, 255, 0.25) 0%, rgba(70, 120, 255, 0.25) 100%) !important;
                border: 1px solid rgba(100, 150, 255, 0.5) !important; color: white !important; cursor: pointer !important;
                display: flex !important; align-items: center !important; justify-content: center !important;
                transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) !important; backdrop-filter: blur(20px) saturate(180%) !important;
                box-shadow: 0 8px 32px rgba(100, 150, 255, 0.35), 0 0 20px rgba(100, 150, 255, 0.2) inset !important;
                position: relative !important; overflow: visible !important;
            }
            .reels-nav-btn:hover { transform: translateY(-4px) scale(1.1) !important; box-shadow: 0 12px 40px rgba(100, 150, 255, 0.4), 0 0 30px rgba(100, 150, 255, 0.3) inset !important; }
            .reels-nav-btn:active { transform: translateY(-2px) scale(0.98) !important; }
            .reels-nav-btn svg { width: 26px !important; height: 26px !important; stroke-width: 2.5 !important; transition: all 0.3s ease !important; filter: drop-shadow(0 2px 8px rgba(0,0,0,0.4)) !important; }
            .reels-nav-btn.up-btn:hover svg { animation: float-up 0.6s ease infinite !important; }
            .reels-nav-btn.down-btn:hover svg { animation: float-down 0.6s ease infinite !important; }
            .pulse-ring { position: absolute !important; inset: -2px !important; border-radius: 50% !important; border: 2px solid rgba(100, 150, 255, 0.6) !important; opacity: 0 !important; pointer-events: none !important; }
            .reels-nav-btn:hover .pulse-ring { animation: pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite !important; }
        `;

        let lastUrl = location.href;
        let isActive = false;

        function checkUrlAndToggle() {
            const currentUrl = location.href;
            const isOnReels = location.pathname.startsWith('/reels/');
            if (currentUrl !== lastUrl) {
                lastUrl = currentUrl;
                if (!isOnReels && isActive) { disableScript(); isActive = false; }
                else if (isOnReels && !isActive) { enableScript(); isActive = true; }
                setTimeout(updateButtonStates, 100);
            } else if (isOnReels && !isActive) { enableScript(); isActive = true; }
        }

        function disableScript() {
            const container = findScrollContainer();
            if (container) {
                container.removeEventListener('wheel', handleWheel, { capture: true });
                container.style.removeProperty('scroll-snap-type');
                container.style.removeProperty('overflow-y');
                container.style.removeProperty('scroll-behavior');
            }
            document.removeEventListener('wheel', handleWheel, { capture: true });
            const styleEl = document.getElementById('insta-reel-fix'); if (styleEl) styleEl.remove();
            if (navButtonsEl) navButtonsEl.remove();
            navButtonsEl = null;
            if (wheelTimeout) clearTimeout(wheelTimeout);
            resetLoadingState();
            isSnapping = false; currentIndex = 0; lastWheelTime = 0;
        }

        function enableScript() {
            if (!location.pathname.startsWith('/reels/')) return;
            if (!document.getElementById('insta-reel-fix')) { if (document.head) document.head.appendChild(style); }
            setTimeout(initialize, 1000);
            addFloatingNavigation();
        }

        function findScrollContainer() { return document.querySelector('main[role="main"]') || document.querySelector('.x1qjc9v5.x9f619.x78zum5.xg7h5cd'); }

        function getVideos() {
            let videos = Array.from(document.querySelectorAll('video'));
            let cards = videos.map(v => v.closest('main[role="main"] > div > div > div')).filter(p => p !== null);
            return [...new Set(cards)];
        }

        function findCurrentIndex() {
            const videos = getVideos();
            const container = findScrollContainer();
            if (!container || videos.length === 0) return 0;
            const containerRect = container.getBoundingClientRect();
            const viewportCenter = containerRect.top + (containerRect.height / 2);
            let closestIndex = 0; let minDistance = Infinity;
            videos.forEach((video, index) => {
                const rect = video.getBoundingClientRect();
                const videoCenter = rect.top + (rect.height / 2);
                const distance = Math.abs(videoCenter - viewportCenter);
                if (distance < minDistance) { minDistance = distance; closestIndex = index; }
            });
            return closestIndex;
        }

        function scrollToVideo(index) {
            const videos = getVideos();
            if (!videos[index]) return;
            isSnapping = true;
            videos[index].scrollIntoView({ behavior: 'smooth', block: 'end' });
            currentIndex = index;
            if (wheelTimeout) clearTimeout(wheelTimeout);
            wheelTimeout = setTimeout(() => { isSnapping = false; }, SNAP_COOLDOWN);
        }

        function createLoader() {
            if (!loaderEl) {
                loaderEl = document.createElement('div');
                loaderEl.className = 'reels-loader';
                loaderEl.innerHTML = `<div class="reels-loader-spinner"></div><div class="reels-loader-text">Loading</div><div class="reels-loader-dots"><div class="reels-loader-dot"></div><div class="reels-loader-dot"></div><div class="reels-loader-dot"></div></div>`;
                document.body.appendChild(loaderEl);
            }
        }
        function showLoader() { createLoader(); loaderEl.classList.add('visible'); }
        function hideLoader() { if (loaderEl) loaderEl.classList.remove('visible'); }

        function triggerInstagramLoad() {
            const container = findScrollContainer();
            if (!container) return false;
            container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
            return true;
        }

        function waitForNewVideos(targetIndex) {
            if (isLoadingMore) return;
            isLoadingMore = true;
            lastVideoCount = getVideos().length;
            showLoader();
            triggerInstagramLoad();
            if (videosObserver) videosObserver.disconnect();
            const container = findScrollContainer();
            if (!container) { resetLoadingState(); return; }
            videosObserver = new MutationObserver(() => {
                const currentVideos = getVideos();
                if (currentVideos.length > lastVideoCount) {
                    if (videosObserver) videosObserver.disconnect();
                    if (loadTimeout) clearTimeout(loadTimeout);
                    isLoadingMore = false;
                    hideLoader();
                    setTimeout(() => {
                        const nextIndex = targetIndex + 1;
                        if (nextIndex < currentVideos.length) scrollToVideo(nextIndex);
                    }, 200);
                }
            });
            videosObserver.observe(container, { childList: true, subtree: true });
            loadTimeout = setTimeout(() => { resetLoadingState(); }, LOAD_TIMEOUT);
        }

        function resetLoadingState() {
            isLoadingMore = false;
            hideLoader();
            if (videosObserver) videosObserver.disconnect();
            if (loadTimeout) clearTimeout(loadTimeout);
        }

        function handleWheel(e) {
            if (!location.pathname.startsWith('/reels/')) return;
            const videos = getVideos();
            if (videos.length === 0) return;
            if (isLoadingMore) { e.preventDefault(); e.stopPropagation(); return false; }
            const currentVisualIndex = findCurrentIndex();
            if (e.deltaY > 0 && currentVisualIndex >= videos.length - 1) {
                e.preventDefault(); e.stopPropagation();
                waitForNewVideos(currentVisualIndex);
                return false;
            }
            e.preventDefault(); e.stopPropagation();
            if (isSnapping) return false;
            const now = Date.now();
            if (Math.abs(e.deltaY) < 4 || (now - lastWheelTime < 40)) return false;
            lastWheelTime = now;
            let nextIndex = currentVisualIndex;
            if (e.deltaY > 0) nextIndex = currentVisualIndex + 1;
            else nextIndex = currentVisualIndex - 1;
            if (nextIndex < 0) nextIndex = 0;
            if (nextIndex !== currentVisualIndex && nextIndex < videos.length) {
                scrollToVideo(nextIndex);
            }
            return false;
        }

        function addFloatingNavigation() {
            if (document.querySelector('.reels-nav-container')) return;
            navButtonsEl = document.createElement('div');
            navButtonsEl.className = 'reels-nav-container';
            const upBtn = document.createElement('div');
            upBtn.className = 'reels-nav-btn up-btn';
            upBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg><div class="pulse-ring"></div>`;
            upBtn.onclick = () => { const current = findCurrentIndex(); if (current > 0) scrollToVideo(current - 1); };
            const downBtn = document.createElement('div');
            downBtn.className = 'reels-nav-btn down-btn';
            downBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12l7 7 7-7"/></svg><div class="pulse-ring"></div>`;
            downBtn.onclick = () => {
                const current = findCurrentIndex(); const videos = getVideos();
                if (current >= videos.length - 1) { waitForNewVideos(current); } else { scrollToVideo(current + 1); }
            };
            navButtonsEl.appendChild(upBtn);
            navButtonsEl.appendChild(downBtn);
            document.body.appendChild(navButtonsEl);
        }

        const ICONS = {
            favorites: {
                outlined: '<polygon fill="none" points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></polygon>',
                filled: '<path d="M12.001 1.505A10.499 10.499 0 1 0 22.5 12 10.51 10.51 0 0 0 12.001 1.505Zm5.635 11.758h-3.414l-1.037 3.55a1.056 1.056 0 0 1-2.052-.016l-1.017-3.534H6.626a.925.925 0 0 1-.564-1.666l2.87-2.133-1.01-3.32a.964.964 0 0 1 1.51-1.045l2.915 2.152 2.898-2.148a.962.962 0 0 1 1.508 1.043l-1.006 3.322 2.859 2.13a.926.926 0 0 1-.606 1.666Z"></path>'
            },
            saved: {
                outlined: '<polygon fill="none" points="20 21 12 13.44 4 21 4 3 20 3 20 21" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></polygon>',
                filled: '<path d="M20 22a.999.999 0 0 1-.687-.273L12 14.815l-7.313 6.912A1 1 0 0 1 3 21V3a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1Z"></path>'
            },
            liked: {
                outlined: '<path d="M16.792 3.904A4.989 4.989 0 0 1 21.5 9.122c0 3.072-2.652 4.959-5.197 7.222-2.512 2.243-3.865 3.469-4.303 3.752-.477-.309-2.143-1.823-4.303-3.752C5.141 14.072 2.5 12.167 2.5 9.122a4.989 4.989 0 0 1 4.708-5.218 4.21 4.21 0 0 1 3.675 1.941c.84 1.175.98 1.763 1.12 1.763s.278-.588 1.11-1.766a4.17 4.17 0 0 1 3.679-1.938m0-2a6.04 6.04 0 0 0-4.797 2.127 6.052 6.052 0 0 0-4.787-2.127A6.985 6.985 0 0 0 .5 9.122c0 3.61 2.55 5.827 5.015 7.97.283.246.569.494.853.747l1.027.918a44.998 44.998 0 0 0 3.518 3.018 2 2 0 0 0 2.174 0 45.263 45.263 0 0 0 3.626-3.115l.922-.824c.293-.26.59-.519.885-.774 2.334-2.025 4.98-4.32 4.98-7.94a6.985 6.985 0 0 0-6.708-7.218Z"></path>',
                filled: '<path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="currentColor"></path>'
            }
        };

        function navigateToUrl(url) {
            history.pushState(null, '', url);
            window.dispatchEvent(new PopStateEvent('popstate'));
            setTimeout(updateButtonStates, 50);
        }

        function updateButtonStates() {
            const path = window.location.pathname;
            const search = window.location.search;
            const username = currentUsername || getCurrentUsername();
            const updateItem = (id, isActive, iconSet) => {
                const link = document.getElementById(id);
                if (!link) return;
                const currentState = link.getAttribute('data-active-state');
                const targetState = isActive ? 'active' : 'inactive';
                if (currentState === targetState) return;
                link.setAttribute('data-active-state', targetState);
                const svgContainer = link.querySelector('svg');
                if (svgContainer) { svgContainer.innerHTML = isActive ? iconSet.filled : iconSet.outlined; }
                const textSpans = link.querySelectorAll('span.x1lliihq.x193iq5w.x6ikm8r.x10wlt62.xlyipyv.xuxw1ft');
                textSpans.forEach(span => { span.style.fontWeight = isActive ? '700' : 'normal'; });
            };
            updateItem('favorites-nav-item', search.includes('variant=favorites'), ICONS.favorites);
            const isSaved = username && path.includes(`/${username}/saved/`);
            updateItem('bookmarks-nav-item', isSaved, ICONS.saved);
            const isLiked = path.includes('/interactions/likes/');
            updateItem('liked-nav-item', isLiked, ICONS.liked);
        }

        function addCustomNavButtons() {
            if (!window.location.hostname.includes('instagram.com')) return;
            if (document.getElementById('favorites-nav-item')) return;
            const reelsNavItem = Array.from(document.querySelectorAll('a[href="/reels/"]')).find(a => a.querySelector('svg') || a.textContent.includes('Reels'));
            if (!reelsNavItem) return;
            const parentContainer = reelsNavItem.parentElement.parentElement;
            updateUsername();
            const username = currentUsername || 'instagram';
            const createNavItem = (id, href, label) => {
                const item = reelsNavItem.parentElement.cloneNode(true);
                const link = item.querySelector('a');
                link.id = id;
                link.href = href;
                link.onclick = (e) => {
                    e.preventDefault();
                    if (id === 'bookmarks-nav-item') {
                        const fresh = getCurrentUsername();
                        if (fresh) currentUsername = fresh;
                        link.href = `/${currentUsername}/saved/all-posts/`;
                    }
                    navigateToUrl(link.href);
                };
                const textSpans = link.querySelectorAll('span.x1lliihq.x193iq5w.x6ikm8r.x10wlt62.xlyipyv.xuxw1ft');
                textSpans.forEach(span => { span.textContent = label; span.style.fontWeight = 'normal'; });
                const svgContainer = link.querySelector('svg');
                if (svgContainer) {
                    svgContainer.setAttribute('aria-label', label);
                    const title = svgContainer.querySelector('title');
                    if (title) title.textContent = label;
                }
                return item;
            };
            const favItem = createNavItem('favorites-nav-item', '/?variant=favorites', 'Favorites');
            const saveItem = createNavItem('bookmarks-nav-item', `/${username}/saved/all-posts/`, 'Saved');
            const likeItem = createNavItem('liked-nav-item', '/your_activity/interactions/likes/', 'Liked');
            parentContainer.appendChild(favItem);
            parentContainer.appendChild(saveItem);
            parentContainer.appendChild(likeItem);
            updateButtonStates();
            syncInjectedNavItems();
        }

        // Instagram animates the sidebar expand/collapse by setting inline style on
        // each native item's text-container div and toggling classes on the wrapper.
        // Our cloneNode() items aren't React-tracked, so IG never updates them and
        // their labels stay hidden. Mirror a native item's state onto ours, reactively.
        let _navSyncObserver = null;
        function syncInjectedNavItems() {
            const TEXT_DIV_SEL = '.x6s0dn4.x9f619.xxk0z11.x6ikm8r.xeq5yr9';
            const WRAPPER_SEL  = '.x9f619.x3nfvp2';
            const EXPAND_CLASSES = ['x6s0dn4', 'x1q0g3np', 'xh8yej3'];
            const injectedIds = ['favorites-nav-item', 'bookmarks-nav-item', 'liked-nav-item'];
            const referenceItem = document.querySelector('a[href="/reels/"]');
            const referenceTextDiv = referenceItem?.querySelector(TEXT_DIV_SEL);
            if (!referenceTextDiv) return;
            const apply = () => {
                const refStyle = referenceTextDiv.getAttribute('style') || '';
                const isExpanded = refStyle.includes('display: flex') || refStyle.includes('opacity: 1');
                for (const id of injectedIds) {
                    const link = document.getElementById(id);
                    if (!link) continue;
                    const textDiv = link.querySelector(TEXT_DIV_SEL);
                    if (textDiv) textDiv.setAttribute('style', refStyle);
                    const wrapper = link.querySelector(WRAPPER_SEL);
                    if (wrapper) {
                        if (isExpanded) wrapper.classList.add(...EXPAND_CLASSES);
                        else            wrapper.classList.remove(...EXPAND_CLASSES);
                    }
                }
            };
            apply(); // sync immediately to the current state
            if (_navSyncObserver) _navSyncObserver.disconnect();
            _navSyncObserver = new MutationObserver(apply);
            _navSyncObserver._node = referenceTextDiv;   // remember what we're watching
            _navSyncObserver.observe(referenceTextDiv, { attributes: true, attributeFilter: ['style', 'class'] });
        }

        function observeAndMaintainButtons() {
            const observer = new MutationObserver(() => {
                if (!document.getElementById('favorites-nav-item')) addCustomNavButtons();
                // re-bind the sync observer if our reference/items were re-rendered
                else if (!_navSyncObserver) syncInjectedNavItems();
            });
            observer.observe(document.body, { childList: true, subtree: true });
        }

        function initialize() {
            if (!location.pathname.startsWith('/reels/')) return;
            const container = findScrollContainer();
            if (container) {
                currentIndex = findCurrentIndex();
                lastVideoCount = getVideos().length;
                const videos = getVideos();
                videos.forEach(v => v.style.setProperty('scroll-snap-align', 'none', 'important'));
                container.style.setProperty('scroll-snap-type', 'none', 'important');
                container.removeEventListener('wheel', handleWheel);
                document.removeEventListener('wheel', handleWheel);
                container.addEventListener('wheel', handleWheel, { passive: false, capture: true });
                document.addEventListener('wheel', handleWheel, { passive: false, capture: true });
                createLoader();
            } else {
                setTimeout(initialize, 500);
            }
        }

        // boot Part 1 once the DOM is ready (we run at document-start)
        function bootPart1() {
            updateUsername();
            setTimeout(addCustomNavButtons, 1000);
            observeAndMaintainButtons();
            setInterval(checkUrlAndToggle, 500);
            setInterval(updateUsername, 2000);
            setInterval(() => {
                if (!document.getElementById('favorites-nav-item')) addCustomNavButtons();
                updateButtonStates();
                // If IG re-rendered the native Reels item, our sync observer is now
                // watching a detached node — re-bind it so labels keep tracking.
                if (_navSyncObserver && _navSyncObserver._node && !_navSyncObserver._node.isConnected) {
                    syncInjectedNavItems();
                }
            }, 500);
            console.log("Instagram Reels ++ v" + IG_VERSION + " — native reels enhancer ready");
        }
        if (document.body) bootPart1();
        else document.addEventListener('DOMContentLoaded', bootPart1);
    })();

    /* ════════════════════════════════════════════════════════════════════
       PART 2 — FULL-SCREEN MAX-QUALITY VIEWER (press X)
       ════════════════════════════════════════════════════════════════════ */
    (function () {
        'use strict';

        class InstagramFeed {
            constructor() {
                this.activePost = { element: null };
                this.activeDisplayedMedia = { element: null, placeholder: null, isClone: false };
                this.isActive = false;
                this.isNavigating = false;
                this.isWaitingForModal = false;
                this.container = null;
                this.uiElements = {};
                this.modalObserver = null;
                this.savedVolume = Math.min(1, Math.max(0, parseFloat(localStorage.getItem('igreels_volume')) || 0.7));
                this.savedMuted = localStorage.getItem('igreels_muted') === 'true';
                this.savedPlaybackRate = parseFloat(localStorage.getItem('igreels_playbackRate')) || 1.0;
                this.autoScrollDelay = parseInt(localStorage.getItem('igreels_autoScrollDelay') || '0', 10);
                this.skipCarouselMode = localStorage.getItem('igreels_skipCarousel') === 'true';
                this.autoScrollTimeoutId = null;
                this.videoEndedListener = null;
                this.boundHandleKeydown = this.handleKeydown.bind(this);
                this.isProcessingInteraction = false;
                this.userIntendedPause = false;
            }

            getHighQualityUrl(imgElement) {
                let bestUrl = imgElement.src;
                if (imgElement.srcset) {
                    const candidates = imgElement.srcset.split(',').map(s => {
                        const parts = s.trim().split(/\s+/);
                        return { url: parts[0], width: parts[1] ? parseInt(parts[1].replace('w', '')) : 0 };
                    });
                    candidates.sort((a, b) => b.width - a.width);
                    if (candidates.length > 0) bestUrl = candidates[0].url;
                }
                try {
                    const urlObj = new URL(bestUrl);
                    const cleanedPath = urlObj.pathname.replace(/\/([sp]\d+x\d+|e\d+)\//g, '/');
                    if (cleanedPath !== urlObj.pathname) { urlObj.pathname = cleanedPath; return urlObj.toString(); }
                } catch (e) { /* ignore */ }
                return bestUrl;
            }

            setupWheelListener() {
                this.removeWheelListener();
                this.boundHandleWheel = this.handleWheel.bind(this);
                document.addEventListener('wheel', this.boundHandleWheel, { passive: false, capture: true });
            }
            removeWheelListener() {
                if (this.boundHandleWheel) { document.removeEventListener('wheel', this.boundHandleWheel, { capture: true }); this.boundHandleWheel = null; }
            }
            handleWheel(e) {
                if (!this.isActive) return;
                if (e.target.closest('.video-controls-overlay') || e.target.closest('#igreels-autoscroll-menu')) return;
                e.preventDefault(); e.stopPropagation();
                const now = Date.now();
                if (now - (this.lastWheelTime || 0) < 300) return;
                this.lastWheelTime = now;
                if (this.skipCarouselMode) {
                    if (e.deltaY > 0) this.smartNavigate('next'); else this.smartNavigate('prev');
                    return;
                }
                const mediaContainer = this.activePost.element?.firstElementChild;
                if (e.deltaY > 0) {
                    const hasNextMedia = mediaContainer?.querySelector('button[aria-label="Next"]');
                    if (hasNextMedia) this.navigateMedia('next'); else this.smartNavigate('next');
                } else {
                    const hasPrevMedia = mediaContainer?.querySelector('button[aria-label="Go back"]');
                    if (hasPrevMedia) this.navigateMedia('prev'); else this.smartNavigate('prev');
                }
            }

            sleep(ms) { return new Promise(res => setTimeout(res, ms)); }
            intersectionArea(a, b) {
                const xOverlap = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
                const yOverlap = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
                return xOverlap * yOverlap;
            }
            extractBackgroundImageUrl(styleStr) {
                if (!styleStr || styleStr === 'none') return null;
                const m = /url\((['"]?)(.*?)\1\)/.exec(styleStr);
                return m ? m[2] : null;
            }
            async waitForImageToLoad(imgEl, timeout = 2000) {
                try {
                    if (imgEl.complete && imgEl.naturalWidth > 0) return true;
                    let ok = false;
                    const race = new Promise((resolve) => {
                        const onload = () => { ok = true; cleanup(); resolve(true); };
                        const onerror = () => { cleanup(); resolve(false); };
                        const cleanup = () => { imgEl.removeEventListener('load', onload); imgEl.removeEventListener('error', onerror); };
                        imgEl.addEventListener('load', onload);
                        imgEl.addEventListener('error', onerror);
                        if (imgEl.decode) { imgEl.decode().then(() => { ok = true; cleanup(); resolve(true); }).catch(() => {}); }
                    });
                    const timer = new Promise(res => setTimeout(res, timeout, false));
                    return await Promise.race([race, timer]) || ok;
                } catch (e) { return false; }
            }
            async waitForVideoReady(videoEl, timeout = 2000) {
                const HAVE_ENOUGH = 4;
                if (videoEl.readyState >= HAVE_ENOUGH) return true;
                return new Promise((resolve) => {
                    const oncan = () => { cleanup(); resolve(true); };
                    const onerr = () => { cleanup(); resolve(false); };
                    const cleanup = () => { videoEl.removeEventListener('canplay', oncan); videoEl.removeEventListener('error', onerr); };
                    videoEl.addEventListener('canplay', oncan);
                    videoEl.addEventListener('error', onerr);
                    setTimeout(() => { cleanup(); resolve(videoEl.readyState >= HAVE_ENOUGH); }, timeout);
                });
            }

            init() {
                if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
                document.removeEventListener('keydown', this.boundHandleKeydown, { capture: true });
                document.addEventListener('keydown', this.boundHandleKeydown, { capture: true });
                // Tag touch devices so hover effects can be disabled (no stuck buttons).
                try {
                    const touch = (window.matchMedia && matchMedia('(pointer: coarse)').matches) || ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
                    if (touch) document.documentElement.classList.add('igr-touch');
                } catch {}
                const setupTrigger = () => {
                    const oldTrigger = document.getElementById('ig-reels-trigger');
                    if (oldTrigger) oldTrigger.remove();
                    this.addManualTrigger();
                };
                setTimeout(setupTrigger, 2000);
                this.setupUrlChangeObserver(setupTrigger);
                this.injectStyles();
            }

            injectStyles() {
                if (document.getElementById('igreels-styles')) return;
                const css = `
                    #ig-feed-container { overflow: hidden !important; }
                    .igreels-controls-column { position: absolute; right: 18px; bottom: 100px; display: flex; flex-direction: column; gap: 12px; z-index: 1000002; align-items: center; pointer-events: auto; }
                    .igreels-btn { background: rgba(255,255,255,0.2); border: none; border-radius: 50%; width: 45px; height: 45px; font-size: 20px; color: white; display: flex; align-items: center; justify-content: center; cursor: pointer; backdrop-filter: blur(10px); box-shadow: 0 2px 10px rgba(0,0,0,0.3); transition: all 0.3s ease; }
                    .custom-video-container input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 12px; height: 12px; border-radius: 50%; background: #f09433; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.3); }
                    .custom-video-container input[type="range"]::-moz-range-thumb { width: 12px; height: 12px; border-radius: 50%; background: #f09433; cursor: pointer; border: none; box-shadow: 0 2px 4px rgba(0,0,0,0.3); }
                    .video-controls-overlay:hover .progress-fill .progress-thumb { opacity: 1; }
                    .custom-video-container:hover .video-controls-overlay { opacity: 1; }
                    @keyframes pulse-ring { 0% { transform: scale(0.95); opacity: 1; } 50% { transform: scale(1.05); opacity: 0.7; } 100% { transform: scale(1.15); opacity: 0; } }
                    @keyframes pulse-rect { 0% { transform: scale(0.98); opacity: 1; } 50% { transform: scale(1.02); opacity: 0.7; } 100% { transform: scale(1.06); opacity: 0; } }
                    @keyframes heart-beat { 0%, 100% { transform: scale(1); } 25% { transform: scale(1.2); } 50% { transform: scale(1.1); } 75% { transform: scale(1.25); } }
                    @keyframes float-up { 0% { transform: translateY(0) scale(1); opacity: 1; } 100% { transform: translateY(-8px) scale(1.1); opacity: 0; } }
                    @keyframes float-down { 0% { transform: translateY(0) scale(1); opacity: 1; } 100% { transform: translateY(8px) scale(1.1); opacity: 0; } }
                    @keyframes bookmark-fill { 0%, 100% { transform: scale(1) rotateZ(0deg); } 50% { transform: scale(1.2) rotateZ(-5deg); } }
                    @keyframes exit-shake { 0%, 100% { transform: translateX(0) rotate(0deg); } 25% { transform: translateX(-3px) rotate(-5deg); } 75% { transform: translateX(3px) rotate(5deg); } }
                    @keyframes fit-pop { 0% { transform: scale(1) rotate(0deg); } 40% { transform: scale(1.28) rotate(-6deg); } 70% { transform: scale(0.94) rotate(4deg); } 100% { transform: scale(1) rotate(0deg); } }
                    /* Smooth media entrance — same scale-in the X script uses. Applied
                       to the wrapper (not the <video>), so there's no persistent
                       transform on the video = no WebView black-screen. */
                    @keyframes igr-media-in { from { opacity: 0; transform: scale(0.85); } to { opacity: 1; transform: scale(1); } }
                    /* no fill — clear the transform after the anim (WebView video safety) */
                    .igr-media-enter { animation: igr-media-in 0.28s cubic-bezier(0.34, 1.2, 0.64, 1); }
                    .fancy-exit-btn { position: relative; }
                    .fancy-exit-btn::before { content: ''; position: absolute; inset: 0; border-radius: 16px; background: radial-gradient(circle at center, rgba(255,255,255,0.3) 0%, transparent 70%); opacity: 0; transition: opacity 0.4s ease; pointer-events: none; z-index: 1; }
                    .fancy-action-btn { position: relative; }
                    .fancy-action-btn::before { content: ''; position: absolute; inset: 0; border-radius: 50%; background: radial-gradient(circle at center, rgba(255,255,255,0.3) 0%, transparent 70%); opacity: 0; transition: opacity 0.4s ease; pointer-events: none; z-index: 1; }
                    .fancy-action-btn:active { transform: translateY(-2px) scale(1.02); transition: all 0.1s ease; }
                    .igreels-liked .heart-path { fill: #ff306c !important; stroke: #ff306c !important; animation: heart-beat 0.6s cubic-bezier(0.34, 1.56, 0.64, 1); transform-origin: center; }
                    .igreels-liked { background: linear-gradient(135deg, rgba(255, 48, 108, 0.5) 0%, rgba(237, 29, 82, 0.5) 100%) !important; border-color: rgba(255, 48, 108, 0.8) !important; box-shadow: 0 12px 40px rgba(255, 48, 108, 0.5), 0 0 30px rgba(255, 48, 108, 0.3) inset !important; }
                    .igreels-bookmarked .bookmark-path { fill: #ffc107 !important; stroke: #ffc107 !important; animation: bookmark-fill 0.6s cubic-bezier(0.34, 1.56, 0.64, 1); transform-origin: center; }
                    .igreels-bookmarked { background: linear-gradient(135deg, rgba(255, 193, 7, 0.5) 0%, rgba(255, 152, 0, 0.5) 100%) !important; border-color: rgba(255, 193, 7, 0.8) !important; box-shadow: 0 12px 40px rgba(255, 193, 7, 0.5), 0 0 30px rgba(255, 193, 7, 0.3) inset !important; }
                    .igreels-following .follow-plus-v, .igreels-following .follow-plus-h { opacity: 0; transform: scale(0); }
                    .igreels-following { background: linear-gradient(135deg, rgba(131, 58, 180, 0.5) 0%, rgba(195, 42, 163, 0.5) 100%) !important; border-color: rgba(131, 58, 180, 0.8) !important; box-shadow: 0 12px 40px rgba(131, 58, 180, 0.5), 0 0 30px rgba(131, 58, 180, 0.3) inset !important; }
                    .igreels-following::after { content: '✓'; position: absolute; top: 50%; right: -4px; transform: translate(0, -50%); font-size: 14px; color: white; font-weight: bold; z-index: 3; text-shadow: 0 2px 8px rgba(0,0,0,0.4); }
                    .custom-video-container button:active { transform: scale(0.95); }
                    .custom-video-container button::before { content: ''; position: absolute; inset: 0; border-radius: 50%; background: radial-gradient(circle, rgba(255,255,255,0.3) 0%, transparent 70%); opacity: 0; transition: opacity 0.3s ease; pointer-events: none; }
                    /* Hover effects only on real-hover (PC) — never on touch (avoids stuck buttons). */
                    html:not(.igr-touch) .fancy-exit-btn:hover::before { opacity: 1; }
                    html:not(.igr-touch) .fancy-exit-btn:hover { transform: translateY(-3px) scale(1.05); background: linear-gradient(135deg, rgba(239, 68, 68, 0.5) 0%, rgba(220, 38, 38, 0.5) 100%) !important; border-color: rgba(239, 68, 68, 0.9) !important; box-shadow: 0 12px 40px rgba(239, 68, 68, 0.5), 0 0 30px rgba(239, 68, 68, 0.3) inset !important; }
                    html:not(.igr-touch) .fancy-exit-btn:hover svg { animation: exit-shake 0.5s ease; }
                    html:not(.igr-touch) .fancy-exit-btn:hover .exit-pulse { animation: pulse-rect 1s cubic-bezier(0.4, 0, 0.6, 1) infinite !important; }
                    html:not(.igr-touch) .fancy-exit-btn:active { transform: translateY(-1px) scale(1.02); transition: all 0.1s ease; }
                    html:not(.igr-touch) .fancy-action-btn:hover::before { opacity: 1; }
                    html:not(.igr-touch) .fancy-action-btn:hover { transform: translateY(-4px) scale(1.08); }
                    html:not(.igr-touch) .fancy-action-btn:hover .like-icon, html:not(.igr-touch) .fancy-action-btn:hover .save-icon, html:not(.igr-touch) .fancy-action-btn:hover .follow-icon, html:not(.igr-touch) .fancy-action-btn:hover .arrow-icon, html:not(.igr-touch) .fancy-action-btn:hover .fit-icon { transform: scale(1.15); }
                    html:not(.igr-touch) #igreels-like:hover .pulse-ring { animation: pulse-ring 1s cubic-bezier(0.4, 0, 0.6, 1) infinite !important; }
                    html:not(.igr-touch) #igreels-prev:hover .arrow-icon { animation: float-up 0.6s ease infinite; }
                    html:not(.igr-touch) #igreels-next:hover .arrow-icon { animation: float-down 0.6s ease infinite; }
                    html:not(.igr-touch) #igreels-fit:hover .fit-icon { animation: fit-pop 0.45s cubic-bezier(0.34,1.56,0.64,1); }
                    html:not(.igr-touch) .custom-video-container button:hover { background: rgba(255,255,255,0.25) !important; border-color: rgba(255,255,255,0.4) !important; transform: scale(1.1); box-shadow: 0 6px 20px rgba(0,0,0,0.4) !important; }
                    html:not(.igr-touch) .custom-video-container button:hover::before { opacity: 1; }

                    /* Video fit modes (class on #ig-feed-container). No CSS transform
                       on <video> (would black-screen in WebView). Zoom = whole media
                       (black bars are fine) at a moderate oversize, panned by shifting
                       the element via 'left' — a layout offset that actually pans any
                       aspect ratio, unlike object-position on a portrait video. */
                    #ig-feed-container.igr-fit-contain video, #ig-feed-container.igr-fit-contain img { object-fit: contain !important; }
                    #ig-feed-container.igr-fit-cover video, #ig-feed-container.igr-fit-cover img { object-fit: cover !important; object-position: 50% 50% !important; }
                    #ig-feed-container.igr-fit-zoom video, #ig-feed-container.igr-fit-zoom img {
                        object-fit: contain !important; width: 130% !important; height: 130% !important;
                        max-width: none !important; flex-shrink: 0 !important;
                        position: relative !important;
                        left: var(--igr-pan-x-px, 0px) !important;
                    }
                `;
                const s = document.createElement('style');
                s.type = 'text/css';
                s.id = 'igreels-styles';
                s.appendChild(document.createTextNode(css));
                document.head.appendChild(s);
            }

            setupUrlChangeObserver(callback) {
                let lastUrl = location.href;
                new MutationObserver(() => {
                    const url = location.href;
                    if (url !== lastUrl) { lastUrl = url; setTimeout(callback, 1000); }
                }).observe(document.body, { subtree: true, childList: true });
            }

            addManualTrigger() {
                if (document.getElementById('ig-reels-trigger')) return;
                const trigger = document.createElement('div');
                trigger.id = 'ig-reels-trigger';
                trigger.innerHTML = `
                    <div class="trigger-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M19.59 10.59L12 3l-7.59 7.59-1.42-1.41L12 0l8.99 9-1.4 1.59z" fill="currentColor"/>
                            <path d="M12 3v18M3 12h18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                    </div>
                    <div class="trigger-content">
                        <div class="trigger-title">IG Max</div>
                        <div class="trigger-subtitle">Press X · v${IG_VERSION}</div>
                    </div>
                `;
                trigger.style.cssText = `
                    position: fixed; top: 20px; right: 20px; z-index: 1000000; display: flex; align-items: center; gap: 12px; padding: 14px 20px;
                    background: linear-gradient(135deg, rgba(15, 15, 15, 0.95) 0%, rgba(30, 30, 30, 0.95) 100%);
                    border: 1px solid rgba(255, 0, 80, 0.3); border-radius: 16px; cursor: pointer; user-select: none;
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05) inset, 0 0 20px rgba(255, 0, 80, 0.15);
                    backdrop-filter: blur(20px) saturate(180%); -webkit-backdrop-filter: blur(20px) saturate(180%);
                    transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1); transform: translateY(0) scale(1); opacity: 1;
                `;
                const style = document.createElement('style');
                style.textContent = `
                    #ig-reels-trigger { animation: slideInDown 0.5s cubic-bezier(0.34, 1.56, 0.64, 1); }
                    #ig-reels-trigger .trigger-icon { width: 42px; height: 42px; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #ff0050 0%, #ff4081 100%); border-radius: 10px; flex-shrink: 0; box-shadow: 0 4px 16px rgba(255, 0, 80, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1) inset; transition: all 0.3s ease; }
                    #ig-reels-trigger .trigger-icon svg { color: white; width: 22px; height: 22px; animation: iconPulse 2.5s ease-in-out infinite; }
                    #ig-reels-trigger .trigger-content { display: flex; flex-direction: column; gap: 1px; }
                    #ig-reels-trigger .trigger-title { color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 15px; font-weight: 700; letter-spacing: 0.5px; line-height: 1.2; }
                    #ig-reels-trigger .trigger-subtitle { color: rgba(255, 255, 255, 0.55); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 11px; font-weight: 500; letter-spacing: 0.3px; }
                    html:not(.igr-touch) #ig-reels-trigger:hover { transform: translateY(-3px) scale(1.02); border-color: rgba(255, 0, 80, 0.5); box-shadow: 0 10px 32px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.1) inset, 0 0 25px rgba(255, 0, 80, 0.25); }
                    html:not(.igr-touch) #ig-reels-trigger:hover .trigger-icon { transform: scale(1.08) rotate(5deg); box-shadow: 0 5px 16px rgba(255, 0, 80, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.2) inset; }
                    html:not(.igr-touch) #ig-reels-trigger:hover .trigger-icon svg { animation: iconSpin 0.5s cubic-bezier(0.34, 1.56, 0.64, 1); }
                    #ig-reels-trigger:active { transform: translateY(-1px) scale(0.98); transition: all 0.1s ease; }
                    @keyframes slideInDown { from { opacity: 0; transform: translateY(-30px) scale(0.9); } to { opacity: 1; transform: translateY(0) scale(1); } }
                    @keyframes iconPulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.05); opacity: 0.9; } }
                    @keyframes iconSpin { from { transform: rotate(0deg) scale(1); } to { transform: rotate(360deg) scale(1.08); } }
                    @media (max-width: 768px) { #ig-reels-trigger { top: 12px; right: 12px; padding: 8px 12px; gap: 8px; } #ig-reels-trigger .trigger-icon { width: 32px; height: 32px; } #ig-reels-trigger .trigger-icon svg { width: 16px; height: 16px; } #ig-reels-trigger .trigger-title { font-size: 12px; } #ig-reels-trigger .trigger-subtitle { font-size: 9px; } }
                `;
                if (!document.getElementById('ig-reels-pulse-style')) { style.id = 'ig-reels-pulse-style'; document.head.appendChild(style); }
                trigger.addEventListener('click', (e) => { e.stopPropagation(); this.armFeedStart(); });
                document.body.appendChild(trigger);
            }

            armFeedStart() {
                if (this.isActive || this.isWaitingForModal) return;
                const existing = this.getCurrentArticle();
                if (existing) { this.startFeed(existing); return; }
                const isBookmarksPage = window.location.pathname.includes('/saved/');
                if (!isBookmarksPage) { console.warn('No posts found on the page'); return; }
                this.isWaitingForModal = true;
                const trigger = document.getElementById('ig-reels-trigger');
                if (trigger) { const subtitle = trigger.querySelector('.trigger-subtitle'); if (subtitle) subtitle.textContent = "Click a post..."; }
                this.modalObserver = new MutationObserver((mutations) => {
                    for (const mutation of mutations) {
                        for (const node of mutation.addedNodes) {
                            if (node.nodeType === 1 && node.querySelector('div[role="dialog"] article')) {
                                this.startFeed(node.querySelector('div[role="dialog"] article'));
                                return;
                            }
                        }
                    }
                });
                this.modalObserver.observe(document.body, { childList: true, subtree: true });
            }

            getCurrentArticle() {
                const modalArticle = document.querySelector('div[role="dialog"] article');
                if (modalArticle) return modalArticle;
                return this.findCentralArticle();
            }

            findCentralArticle() {
                const allArticles = Array.from(document.querySelectorAll('article'));
                if (allArticles.length === 0) return null;
                const viewportHeight = window.innerHeight;
                const viewportCenter = viewportHeight / 2;
                let closestArticle = null;
                let minDistance = Infinity;
                for (const article of allArticles) {
                    if (!this.isValidArticle(article)) continue;
                    const rect = article.getBoundingClientRect();
                    if (rect.bottom > 0 && rect.top < viewportHeight) {
                        const articleCenter = rect.top + rect.height / 2;
                        const distance = Math.abs(viewportCenter - articleCenter);
                        if (distance < minDistance) { minDistance = distance; closestArticle = article; }
                    }
                }
                return closestArticle;
            }

            startFeed(initialPostElement) {
                if (this.isWaitingForModal) { this.isWaitingForModal = false; if (this.modalObserver) this.modalObserver.disconnect(); }
                this.isActive = true;
                this.setupWheelListener();
                const trig = document.getElementById('ig-reels-trigger');
                if (trig) trig.style.display = 'none';
                this.createContainer();
                this.updateView(initialPostElement);
            }

            exit() {
                if (!this.isActive) return;
                this.isActive = false;
                this.isProcessingInteraction = false;
                this.stopAutoScrollTimer();
                this.removeWheelListener();
                this.restoreOriginalMediaPosition();
                if (this.container) this.container.remove();
                this.container = null;
                const closeButton = document.querySelector('div[role="dialog"] svg[aria-label="Close"]')?.closest('div[role="button"]');
                if (closeButton) closeButton.click();
                setTimeout(() => {
                    const trigger = document.getElementById('ig-reels-trigger');
                    if (trigger) {
                        trigger.style.display = 'flex';
                        const subtitle = trigger.querySelector('.trigger-subtitle');
                        if (subtitle) subtitle.textContent = "Press X · v" + IG_VERSION;
                    } else { this.addManualTrigger(); }
                }, 50);
            }

            isValidArticle(article) {
                if (!article) return false;
                // IG now serves post media from *.fbcdn.net (not cdninstagram). Match
                // both, plus a generic fallback of any non-tiny <img>, so image-only
                // posts pass validation and aren't skipped during navigation / open.
                const hasMedia = article.querySelector('video, img[src*="cdninstagram"], img[src*="fbcdn"], div[style*="background-image"]')
                    || Array.from(article.querySelectorAll('img')).find(img => { const r = img.getBoundingClientRect(); return r.width > 100 && r.height > 100; });
                if (!hasMedia) return false;
                const hasSuggestedText = article.textContent.includes('Suggested for you');
                const hasCloseButton = article.querySelector('svg[aria-label="Close"]');
                if (hasSuggestedText && hasCloseButton) {
                    const rect = article.getBoundingClientRect();
                    if (rect.height < 200) return false;
                }
                const rect = article.getBoundingClientRect();
                if (rect.height < 100) return false;
                article.dataset.isSuggested = hasSuggestedText ? 'true' : 'false';
                return true;
            }

            createContainer() {
                this.container = document.createElement('div');
                this.container.id = 'ig-feed-container';
                this.container.classList.add('igr-fit-' + this.videoFit());
                this.container.style.cssText = `position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0, 0, 0, 0.95); z-index: 2147483000; pointer-events: none; overflow: hidden;`;
                this.container.innerHTML = `
                    <div class="media-wrapper" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; pointer-events: auto; overflow: hidden;"></div>
                    <div class="ui-container" style="position: relative; z-index: 1000002; width: 100%; height: 100%; pointer-events: none;">
                        <div style="position: absolute; top: 20px; left: 20px; display: flex; flex-direction: column; align-items: flex-start; gap: 5px; pointer-events: auto;">
                            <div class="info-controls-wrapper" style="color: rgba(255,255,255,0.9); background: rgba(0,0,0,0.6); padding: 6px 10px; border-radius: 15px; font-size: 12px; backdrop-filter: blur(10px); pointer-events: auto; transition: all 0.3s ease;">
                                <div class="info-header" style="color: white; cursor: pointer; text-align: left; display: flex; align-items: center; justify-content: flex-start; gap: 5px;">
                                    Keyboard Shortcuts
                                    <span style="display: inline-block; width: 12px; height: 12px; background-image: url('data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%0A%3Cpath%20d%3D%22M7.41%208.59L12%2013.17L16.59%208.59L18%2010L12%2016L6%2010L7.41%208.59Z%22%20fill%3D%22%23f09433%22%2F%3E%0A%3C%2Fsvg%3E'); background-repeat: no-repeat; background-position: center; background-size: contain; transform: rotate(0deg); transition: transform 0.3s ease-out;"></span>
                                </div>
                                <div class="controls-expanded" style="max-height: 0; overflow: hidden; opacity: 0; transition: max-height 0.3s ease-out, opacity 0.3s ease-out; padding-top: 0; font-weight: 400;">
                                    • X: <span style="color:#f09433;">Enter/Exit Feed</span> <br>
                                    • Scroll: <span style="color:#f09433;">⬆️/⬇️</span> <br>
                                    • Cycle Media: <span style="color:#f09433;">⬅️/➡️</span> <br>
                                    • Space: <span style="color:#f09433;">Play/Pause</span> <br>
                                    • &lt; / &gt; : <span style="color:#f09433;">Scrub ±5s</span> <br>
                                    • L: <span style="color:#f09433;">Like</span> <br>
                                    • S: <span style="color:#f09433;">Save</span> <br>
                                    • F: <span style="color:#f09433;">Follow</span> <br>
                                    • V: <span style="color:#f09433;">Fit/Zoom/Fill</span> <br>
                                    • Q/Esc: <span style="color:#f09433;">Exit</span>
                                </div>
                            </div>
                        </div>
                        <div style="position: absolute; top: 20px; right: 20px; display: flex; flex-direction: column; align-items: flex-end; gap: 8px; pointer-events: auto;">
                            <button id="igreels-exit" class="igreels-btn igreels-exit fancy-exit-btn" style="background: linear-gradient(135deg, rgba(239, 68, 68, 0.3) 0%, rgba(220, 38, 38, 0.3) 100%); border: 1px solid rgba(239, 68, 68, 0.6); padding: 10px 16px; border-radius: 16px; width: auto; height: auto; font-size: 13px; font-weight: 700; backdrop-filter: blur(20px) saturate(180%); box-shadow: 0 8px 32px rgba(239, 68, 68, 0.35), 0 0 20px rgba(239, 68, 68, 0.15) inset; transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1); display: flex; align-items: center; gap: 8px; position: relative; overflow: hidden;" title="Exit (Q/Esc)">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="transition: all 0.3s ease;">
                                    <path d="M18 6L6 18M6 6l12 12" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.4));"/>
                                </svg>
                                <span style="position: relative; z-index: 2;">Exit</span>
                                <div class="exit-pulse" style="position: absolute; inset: -2px; border-radius: 16px; border: 2px solid rgba(239, 68, 68, 0.6); opacity: 0; animation: pulse-rect 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;"></div>
                            </button>
                            <div style="color: white; background: rgba(0,0,0,0.6); padding: 8px 12px; border-radius: 15px; font-size: 12px; font-weight: 600; backdrop-filter: blur(10px); display: flex; align-items: center; gap: 8px; pointer-events: auto; cursor: pointer;" id="igreels-autoscroll-container">  <span>Auto: <span id="igreels-autoscroll-display" style="color: #f09433;">Off</span></span>  <span style="color: #f09433;">▼</span></div><div id="igreels-autoscroll-menu" style="display: none; position: absolute; top: 90px; right: 20px; background: rgba(0,0,0,0.9); border-radius: 10px; padding: 8px; backdrop-filter: blur(10px); pointer-events: auto; z-index: 10000000;">  <div class="autoscroll-option" data-value="0" style="padding: 8px 16px; cursor: pointer; color: #f09433; border-radius: 5px; transition: background 0.2s;">Off</div>  <div class="autoscroll-option" data-value="-1" style="padding: 8px 16px; cursor: pointer; color: white; border-radius: 5px; transition: background 0.2s;">Auto (Smart)</div>  <div class="autoscroll-option" data-value="1000" style="padding: 8px 16px; cursor: pointer; color: white; border-radius: 5px; transition: background 0.2s;">1s</div>  <div class="autoscroll-option" data-value="2000" style="padding: 8px 16px; cursor: pointer; color: white; border-radius: 5px; transition: background 0.2s;">2s</div>  <div class="autoscroll-option" data-value="3000" style="padding: 8px 16px; cursor: pointer; color: white; border-radius: 5px; transition: background 0.2s;">3s</div>  <div class="autoscroll-option" data-value="5000" style="padding: 8px 16px; cursor: pointer; color: white; border-radius: 5px; transition: background 0.2s;">5s</div>  <div class="autoscroll-option" data-value="8000" style="padding: 8px 16px; cursor: pointer; color: white; border-radius: 5px; transition: background 0.2s;">8s</div>  <div class="autoscroll-option" data-value="30000" style="padding: 8px 16px; cursor: pointer; color: white; border-radius: 5px; transition: background 0.2s;">30s</div>  <div class="autoscroll-option" data-value="60000" style="padding: 8px 16px; cursor: pointer; color: white; border-radius: 5px; transition: background 0.2s;">60s</div></div>
                            <div style="color: white; background: rgba(0,0,0,0.6); padding: 8px 12px; border-radius: 15px; font-size: 12px; font-weight: 600; backdrop-filter: blur(10px); display: flex; align-items: center; gap: 8px; pointer-events: auto; cursor: pointer;">
                                <input type="checkbox" id="igreels-skip-media" style="cursor: pointer; width: 16px; height: 16px; accent-color: #f09433;">
                                <label for="igreels-skip-media" style="cursor: pointer; user-select: none;">Skip carousel</label>
                            </div>
                        </div>
                        <div class="info" style="position: absolute; bottom: 75px; left: 20px; right: 100px; color: white; background: rgba(0,0,0,0.0); padding: 20px; border-radius: 16px; max-height: 120px; overflow-y: hidden; text-shadow: 1px 1px 4px rgba(0,0,0,0.8); word-wrap: break-word; overflow-wrap: break-word; white-space: normal; pointer-events: auto;"></div>
                    </div>
                `;
                const controls = document.createElement('div');
                controls.className = 'igreels-controls-column';
                controls.innerHTML = `
                    <button id="igreels-like" class="igreels-btn fancy-action-btn" style="background: linear-gradient(135deg, rgba(255, 48, 108, 0.25) 0%, rgba(237, 29, 82, 0.25) 100%); border: 1px solid rgba(255, 48, 108, 0.5); border-radius: 50%; width: 48px; height: 48px; cursor: pointer; backdrop-filter: blur(20px) saturate(180%); box-shadow: 0 8px 32px rgba(255, 48, 108, 0.35), 0 0 20px rgba(255, 48, 108, 0.2) inset; transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1); display: flex; align-items: center; justify-content: center; position: relative; overflow: visible;" title="Like (L)">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="like-icon" style="position: relative; z-index: 2; transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1); overflow: visible;">
                            <path class="heart-path" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="none" stroke="white" stroke-width="2" stroke-linejoin="round" style="filter: drop-shadow(0 2px 8px rgba(0,0,0,0.4)); transition: all 0.4s ease;"/>
                        </svg>
                        <div class="pulse-ring" style="position: absolute; inset: -2px; border-radius: 50%; border: 2px solid rgba(255, 48, 108, 0.6); opacity: 0;"></div>
                    </button>
                    <button id="igreels-save" class="igreels-btn fancy-action-btn" style="background: linear-gradient(135deg, rgba(255, 193, 7, 0.25) 0%, rgba(255, 152, 0, 0.25) 100%); border: 1px solid rgba(255, 193, 7, 0.5); border-radius: 50%; width: 48px; height: 48px; cursor: pointer; backdrop-filter: blur(20px) saturate(180%); box-shadow: 0 8px 32px rgba(255, 193, 7, 0.35), 0 0 20px rgba(255, 193, 7, 0.2) inset; transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1); display: flex; align-items: center; justify-content: center; position: relative; overflow: visible;" title="Save (S)">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="save-icon" style="position: relative; z-index: 2; transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);">
                            <path class="bookmark-path" d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z" fill="none" stroke="white" stroke-width="2" stroke-linejoin="round" style="filter: drop-shadow(0 2px 8px rgba(0,0,0,0.4)); transition: all 0.4s ease;"/>
                        </svg>
                        <div class="pulse-ring" style="position: absolute; inset: -2px; border-radius: 50%; border: 2px solid rgba(255, 193, 7, 0.6); opacity: 0;"></div>
                    </button>
                    <button id="igreels-follow" class="igreels-btn fancy-action-btn" style="background: linear-gradient(135deg, rgba(131, 58, 180, 0.25) 0%, rgba(195, 42, 163, 0.25) 100%); border: 1px solid rgba(131, 58, 180, 0.5); border-radius: 50%; width: 48px; height: 48px; cursor: pointer; backdrop-filter: blur(20px) saturate(180%); box-shadow: 0 8px 32px rgba(131, 58, 180, 0.35), 0 0 20px rgba(131, 58, 180, 0.2) inset; transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1); display: flex; align-items: center; justify-content: center; position: relative; overflow: visible;" title="Follow (F)">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="follow-icon" style="position: relative; z-index: 2; transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);">
                            <circle cx="12" cy="8" r="4" stroke="white" stroke-width="2" fill="none" style="filter: drop-shadow(0 2px 8px rgba(0,0,0,0.4));"/>
                            <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" stroke="white" stroke-width="2" stroke-linecap="round" style="filter: drop-shadow(0 2px 8px rgba(0,0,0,0.4));"/>
                            <line x1="19" y1="8" x2="19" y2="14" stroke="white" stroke-width="2" stroke-linecap="round" class="follow-plus-v" style="filter: drop-shadow(0 2px 8px rgba(0,0,0,0.4)); transition: all 0.3s ease;"/>
                            <line x1="16" y1="11" x2="22" y2="11" stroke="white" stroke-width="2" stroke-linecap="round" class="follow-plus-h" style="filter: drop-shadow(0 2px 8px rgba(0,0,0,0.4)); transition: all 0.3s ease;"/>
                        </svg>
                        <div class="pulse-ring" style="position: absolute; inset: -2px; border-radius: 50%; border: 2px solid rgba(131, 58, 180, 0.6); opacity: 0;"></div>
                    </button>
                    <button id="igreels-fit" class="igreels-btn fancy-action-btn" style="background: linear-gradient(135deg, rgba(255, 180, 80, 0.25) 0%, rgba(255, 150, 40, 0.25) 100%); border: 1px solid rgba(255, 180, 80, 0.5); border-radius: 50%; width: 48px; height: 48px; cursor: pointer; backdrop-filter: blur(20px) saturate(180%); box-shadow: 0 8px 32px rgba(255, 180, 80, 0.35), 0 0 20px rgba(255, 180, 80, 0.2) inset; transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1); display: flex; align-items: center; justify-content: center; position: relative; overflow: visible;" title="Fit / Zoom / Fill (V)"></button>
                    <button id="igreels-prev" class="igreels-btn fancy-action-btn" style="background: linear-gradient(135deg, rgba(100, 150, 255, 0.25) 0%, rgba(70, 120, 255, 0.25) 100%); border: 1px solid rgba(100, 150, 255, 0.5); border-radius: 50%; width: 48px; height: 48px; cursor: pointer; backdrop-filter: blur(20px) saturate(180%); box-shadow: 0 8px 32px rgba(100, 150, 255, 0.35), 0 0 20px rgba(100, 150, 255, 0.2) inset; transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1); display: flex; align-items: center; justify-content: center; position: relative; overflow: visible;" title="Previous (↑)">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="arrow-icon" style="position: relative; z-index: 2; transition: all 0.3s ease;">
                            <path d="M12 19V5M5 12l7-7 7 7" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0 2px 8px rgba(0,0,0,0.4));"/>
                        </svg>
                        <div class="pulse-ring" style="position: absolute; inset: -2px; border-radius: 50%; border: 2px solid rgba(100, 150, 255, 0.6); opacity: 0;"></div>
                    </button>
                    <button id="igreels-next" class="igreels-btn fancy-action-btn" style="background: linear-gradient(135deg, rgba(100, 150, 255, 0.25) 0%, rgba(70, 120, 255, 0.25) 100%); border: 1px solid rgba(100, 150, 255, 0.5); border-radius: 50%; width: 48px; height: 48px; cursor: pointer; backdrop-filter: blur(20px) saturate(180%); box-shadow: 0 8px 32px rgba(100, 150, 255, 0.35), 0 0 20px rgba(100, 150, 255, 0.2) inset; transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1); display: flex; align-items: center; justify-content: center; position: relative; overflow: visible;" title="Next (↓)">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="arrow-icon" style="position: relative; z-index: 2; transition: all 0.3s ease;">
                            <path d="M12 5v14M5 12l7 7 7-7" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0 2px 8px rgba(0,0,0,0.4));"/>
                        </svg>
                        <div class="pulse-ring" style="position: absolute; inset: -2px; border-radius: 50%; border: 2px solid rgba(100, 150, 255, 0.6); opacity: 0;"></div>
                    </button>
                `;
                this.container.querySelector('.ui-container').appendChild(controls);
                document.body.appendChild(this.container);
                this.uiElements = {
                    mediaWrapper: this.container.querySelector('.media-wrapper'),
                    info: this.container.querySelector('.info'),
                    exitButton: this.container.querySelector('#igreels-exit'),
                    prevButton: this.container.querySelector('#igreels-prev'),
                    nextButton: this.container.querySelector('#igreels-next'),
                    likeButton: this.container.querySelector('#igreels-like'),
                    saveButton: this.container.querySelector('#igreels-save'),
                    followButton: this.container.querySelector('#igreels-follow'),
                    fitButton: this.container.querySelector('#igreels-fit'),
                };
                this.uiElements.exitButton.addEventListener('click', (e) => { e.stopPropagation(); this.exit(); });
                this.uiElements.prevButton.addEventListener('click', (e) => { e.stopPropagation(); this.smartNavigate('prev'); });
                this.uiElements.nextButton.addEventListener('click', (e) => { e.stopPropagation(); this.smartNavigate('next'); });
                this.uiElements.likeButton.addEventListener('click', (e) => { e.stopPropagation(); this.toggleAction('like'); });
                this.uiElements.saveButton.addEventListener('click', (e) => { e.stopPropagation(); this.toggleAction('save'); });
                this.uiElements.followButton.addEventListener('click', (e) => { e.stopPropagation(); this.toggleFollow(); });
                this.uiElements.fitButton.addEventListener('click', (e) => { e.stopPropagation(); this.toggleFit(); });
                this.uiElements.fitButton.innerHTML = this.fitIcon(this.videoFit());
                this.setupKeyboardShortcutsToggle();
                this.setupSkipCarouselToggle();
                this.setupAutoScrollControls();
                this.setupPan();
                for (const btn of Object.values(this.uiElements)) {
                    if (btn && btn.addEventListener) { btn.addEventListener('mousedown', (ev) => ev.preventDefault()); }
                }
            }

            /* ---- video fit (contain / zoom / cover) ---- */
            videoFit() { return localStorage.getItem('igreels_fit') || 'contain'; }
            fitIcon(mode) {
                const open = `<svg class="fit-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="position:relative;z-index:2;filter:drop-shadow(0 2px 8px rgba(0,0,0,0.4));transition:all 0.3s ease;">`;
                if (mode === 'cover')
                    return `${open}<path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3"/></svg>`;
                if (mode === 'zoom')
                    return `${open}<circle cx="10.5" cy="10.5" r="6.5"/><line x1="20" y1="20" x2="15.5" y2="15.5"/><line x1="10.5" y1="7.8" x2="10.5" y2="13.2"/><line x1="7.8" y1="10.5" x2="13.2" y2="10.5"/></svg>`;
                return `${open}<rect x="3" y="6" width="18" height="12" rx="2"/><line x1="3" y1="9.6" x2="21" y2="9.6"/><line x1="3" y1="14.4" x2="21" y2="14.4"/></svg>`;
            }
            applyFit() {
                if (!this.container) return;
                const f = this.videoFit();
                this.container.classList.remove('igr-fit-contain', 'igr-fit-zoom', 'igr-fit-cover');
                this.container.classList.add('igr-fit-' + f);
            }
            toggleFit() {
                const next = { contain: 'zoom', zoom: 'cover', cover: 'contain' };
                const f = next[this.videoFit()] || 'contain';
                localStorage.setItem('igreels_fit', f);
                this._panX = 50;
                this.container && this.container.style.setProperty('--igr-pan-x-px', '0px');
                if (this.uiElements.fitButton) this.uiElements.fitButton.innerHTML = this.fitIcon(f);
                this.applyFit();
            }
            // Pan helper. _panX stays a 0..100 value (50 = centred); we translate
            // it into a px `left` offset for the oversized zoom element. The element
            // is IG_ZOOM× wide, overflowing the viewport by (IG_ZOOM-1)·width total,
            // half pannable on each side.
            setPan(p) {
                p = Math.max(0, Math.min(100, p));
                this._panX = p;
                const overflow = (IG_ZOOM - 1) * (window.innerWidth || 400) / 2;
                const px = (50 - p) / 50 * overflow;
                this.container && this.container.style.setProperty('--igr-pan-x-px', px.toFixed(1) + 'px');
            }
            // Drag-to-pan (zoom mode only) — mouse on PC, touch on phone.
            setupPan() {
                this._panX = 50;
                const wrap = this.uiElements.mediaWrapper;
                if (!wrap) return;
                // mouse
                let down = false, startX = 0, panStart = 50, moved = false;
                wrap.addEventListener('mousedown', (e) => {
                    if (this.videoFit() !== 'zoom' || e.button !== 0) return;
                    down = true; moved = false; startX = e.clientX; panStart = this._panX;
                });
                window.addEventListener('mousemove', (e) => {
                    if (!down) return;
                    const dx = e.clientX - startX;
                    if (Math.abs(dx) > 3) moved = true;
                    this.setPan(panStart - dx * (100 / (window.innerWidth || 800)));
                });
                window.addEventListener('mouseup', () => {
                    if (!down) return; down = false;
                    if (moved) { const sw = ev => { ev.stopPropagation(); ev.preventDefault(); wrap.removeEventListener('click', sw, true); };
                        wrap.addEventListener('click', sw, true); setTimeout(() => wrap.removeEventListener('click', sw, true), 60); }
                });
                // touch
                let tStartX = 0, tStartY = 0, tPanStart = 50, tPan = false, tMode = false;
                wrap.addEventListener('touchstart', (e) => {
                    tMode = (this.videoFit() === 'zoom'); tPan = false;
                    tStartX = e.touches[0].clientX; tStartY = e.touches[0].clientY; tPanStart = this._panX;
                }, { passive: true });
                wrap.addEventListener('touchmove', (e) => {
                    if (!tMode || e.touches.length !== 1) return;
                    const dx = e.touches[0].clientX - tStartX, dy = e.touches[0].clientY - tStartY;
                    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 8) {
                        tPan = true; this._didTouchPan = true;
                        if (e.cancelable) e.preventDefault();
                        this.setPan(tPanStart - dx * (100 / (window.innerWidth || 400)));
                    }
                }, { passive: false });
                wrap.addEventListener('touchend', () => { setTimeout(() => { this._didTouchPan = false; }, 50); });
            }

            setupKeyboardShortcutsToggle() {
                const infoControlsWrapper = this.container.querySelector('.info-controls-wrapper');
                const controlsExpanded = this.container.querySelector('.controls-expanded');
                const infoHeader = this.container.querySelector('.info-header');
                const infoArrow = infoHeader.querySelector('span');
                let isHoveringInfo = false; let isInfoExpanded = false; let hideInfoTimeoutId = null;
                infoControlsWrapper.addEventListener('mouseenter', () => {
                    isHoveringInfo = true; clearTimeout(hideInfoTimeoutId);
                    if (!isInfoExpanded) { controlsExpanded.style.maxHeight = '220px'; controlsExpanded.style.opacity = '1'; controlsExpanded.style.paddingTop = '8px'; infoArrow.style.transform = 'rotate(180deg)'; isInfoExpanded = true; }
                });
                infoControlsWrapper.addEventListener('mouseleave', () => {
                    isHoveringInfo = false;
                    hideInfoTimeoutId = setTimeout(() => { if (!isHoveringInfo) { controlsExpanded.style.maxHeight = '0'; controlsExpanded.style.opacity = '0'; controlsExpanded.style.paddingTop = '0'; infoArrow.style.transform = 'rotate(0deg)'; isInfoExpanded = false; } }, 500);
                });
            }

            setupSkipCarouselToggle() {
                const checkbox = this.container.querySelector('#igreels-skip-media');
                if (checkbox) {
                    checkbox.checked = this.skipCarouselMode;
                    checkbox.addEventListener('change', (e) => {
                        this.skipCarouselMode = e.target.checked;
                        localStorage.setItem('igreels_skipCarousel', this.skipCarouselMode.toString());
                    });
                }
            }

            setupAutoScrollControls() {
                const container = document.getElementById('igreels-autoscroll-container');
                const menu = document.getElementById('igreels-autoscroll-menu');
                const display = document.getElementById('igreels-autoscroll-display');
                const timeLabels = { 0: 'Off', '-1': 'Auto (Smart)', 1000: '1s', 2000: '2s', 3000: '3s', 5000: '5s', 8000: '8s', 30000: '30s', 60000: '60s' };
                display.textContent = timeLabels[this.autoScrollDelay] || 'Off';
                container.addEventListener('click', (e) => { e.stopPropagation(); menu.style.display = menu.style.display === 'none' ? 'block' : 'none'; });
                document.querySelectorAll('.autoscroll-option').forEach(option => {
                    option.addEventListener('mouseenter', () => { option.style.background = 'rgba(255,255,255,0.1)'; });
                    option.addEventListener('mouseleave', () => { option.style.background = 'transparent'; });
                    option.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const value = parseInt(option.dataset.value, 10);
                        this.autoScrollDelay = value;
                        localStorage.setItem('igreels_autoScrollDelay', value.toString());
                        display.textContent = timeLabels[value];
                        menu.style.display = 'none';
                        if (this.isActive && (value > 0 || value === -1)) this.startAutoScrollTimer();
                        else if (value === 0) this.stopAutoScrollTimer();
                    });
                });
                document.addEventListener('click', () => { if (menu) menu.style.display = 'none'; });
            }

            startAutoScrollTimer() {
                this.stopAutoScrollTimer();
                if (!this.isActive || this.isProcessingInteraction) return;
                if (this.autoScrollDelay === -1) {
                    const video = this.uiElements.mediaWrapper.querySelector('video');
                    if (video) {
                        const onEnded = () => {
                            if (!this.isActive || this.isProcessingInteraction) return;
                            this.userIntendedPause = false;
                            if (this.skipCarouselMode) this.navigatePost('next'); else this.smartNavigate('next');
                        };
                        this.videoEndedListener = onEnded;
                        video.addEventListener('ended', onEnded);
                    } else {
                        this.autoScrollTimeoutId = setTimeout(() => {
                            if (!this.isActive || this.isProcessingInteraction) return;
                            if (this.skipCarouselMode) this.navigatePost('next'); else this.smartNavigate('next');
                        }, 3000);
                    }
                } else if (this.autoScrollDelay > 0) {
                    this.autoScrollTimeoutId = setTimeout(() => {
                        if (!this.isActive || this.isProcessingInteraction) return;
                        this.userIntendedPause = false;
                        if (this.skipCarouselMode) this.navigatePost('next'); else this.smartNavigate('next');
                    }, this.autoScrollDelay);
                }
            }
            stopAutoScrollTimer() {
                if (this.autoScrollTimeoutId) { clearTimeout(this.autoScrollTimeoutId); this.autoScrollTimeoutId = null; }
                if (this.videoEndedListener) {
                    const video = this.uiElements?.mediaWrapper?.querySelector('video');
                    if (video) video.removeEventListener('ended', this.videoEndedListener);
                    this.videoEndedListener = null;
                }
            }

            findCandidateMedia(article) {
                if (!article) return null;
                const articleRect = article.getBoundingClientRect();
                const candidates = [];
                const carouselContainer = article.querySelector('ul[style*="flex-direction"]') || article.querySelector('div[style*="flex-direction"] ul') || article.querySelector('div._ac7v');
                article.querySelectorAll('video, img').forEach(el => {
                    const rect = el.getBoundingClientRect();
                    if (rect.width < 12 || rect.height < 12) return;
                    const alt = (el.alt || '').toLowerCase();
                    const src = (el.src || '').toLowerCase();
                    if (alt.includes('profile') || alt.includes('avatar') || src.includes('profile') || src.includes('avatar') || (rect.width <= 48 && rect.height <= 48)) return;
                    let carouselOrder = -1;
                    if (carouselContainer) {
                        const carouselItems = Array.from(carouselContainer.querySelectorAll('li'));
                        for (let i = 0; i < carouselItems.length; i++) { if (carouselItems[i].contains(el)) { carouselOrder = i; break; } }
                    }
                    const isInView = rect.top >= 0 && rect.left >= 0 && rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) && rect.right <= (window.innerWidth || document.documentElement.clientWidth);
                    candidates.push({ el, rect, kind: el.tagName.toLowerCase(), isInView, area: rect.width * rect.height, carouselOrder });
                });
                article.querySelectorAll('*').forEach(el => {
                    try {
                        const cs = getComputedStyle(el);
                        const bg = cs.backgroundImage;
                        if (bg && bg !== 'none') {
                            const rect = el.getBoundingClientRect();
                            if (rect.width >= 100 && rect.height >= 100) candidates.push({ el, rect, kind: 'background', bg, area: rect.width * rect.height, carouselOrder: -1 });
                        }
                    } catch (e) { /* ignore */ }
                });
                if (candidates.length === 0) return null;
                let best = null; let bestScore = -Infinity;
                for (const c of candidates) {
                    const intersectArea = this.intersectionArea(c.rect, articleRect);
                    const centerDist = Math.hypot((c.rect.left + c.rect.right) / 2 - (articleRect.left + articleRect.right) / 2, (c.rect.top + c.rect.bottom) / 2 - (articleRect.top + articleRect.bottom) / 2);
                    let score = intersectArea - centerDist;
                    if (c.isInView && c.carouselOrder >= 0) score += 50000 - (c.carouselOrder * 1000);
                    else if (c.isInView) score += 10000;
                    if (c.area > 50000) score += 2000;
                    if (score > bestScore) { bestScore = score; best = c; }
                }
                return best ? best.el : null;
            }

            getMediaIdentifier(el) {
                if (!el) return null;
                if (el.tagName === 'IMG') return el.currentSrc || el.src || el.getAttribute('src') || el.getAttribute('data-src') || null;
                if (el.tagName === 'VIDEO') return el.currentSrc || el.src || (el.querySelector('source')?.src) || null;
                const bg = getComputedStyle(el).backgroundImage;
                return this.extractBackgroundImageUrl(bg);
            }

            async pickActiveMediaWithWait(article, maxAttempts = 25, interval = 150) {
                const isSuggested = article.dataset.isSuggested === 'true';
                const adjustedAttempts = isSuggested ? 8 : maxAttempts;
                for (let attempt = 0; attempt < adjustedAttempts; attempt++) {
                    const candidate = this.findCandidateMedia(article);
                    if (candidate) {
                        const id = this.getMediaIdentifier(candidate);
                        if (candidate.tagName === 'IMG') {
                            const rect = candidate.getBoundingClientRect();
                            if (rect.width > 50 && rect.height > 50) {
                                if (isSuggested) { if (attempt > 0 || candidate.complete) return { el: candidate, id }; }
                                else { const loaded = await this.waitForImageToLoad(candidate, 1500); if (loaded) return { el: candidate, id }; }
                            }
                        } else if (candidate.tagName === 'VIDEO') {
                            if (isSuggested) { if (candidate.readyState > 0 || attempt > 1) return { el: candidate, id }; }
                            else { const ready = await this.waitForVideoReady(candidate, 1500); if (ready) return { el: candidate, id }; }
                        } else {
                            const bg = getComputedStyle(candidate).backgroundImage;
                            const url = this.extractBackgroundImageUrl(bg);
                            if (url) return { el: candidate, id: url };
                        }
                    }
                    const waitTime = isSuggested ? 50 : Math.min(interval * (1 + attempt * 0.2), 500);
                    await this.sleep(waitTime);
                }
                return null;
            }

            async mountMediaForDisplay(mediaEl) {
                this.restoreOriginalMediaPosition();
                if (mediaEl.tagName !== 'IMG' && mediaEl.tagName !== 'VIDEO') {
                    const bg = getComputedStyle(mediaEl).backgroundImage;
                    const url = this.extractBackgroundImageUrl(bg);
                    if (!url) return null;
                    const img = document.createElement('img');
                    img.className = 'igr-media-enter';
                    img.style.cssText = 'width: 100%; height: 100%; object-fit: contain; background: black; pointer-events: auto;';
                    img.src = url;
                    this.uiElements.mediaWrapper.appendChild(img);
                    this.activeDisplayedMedia = { element: img, placeholder: null, isClone: true, original: mediaEl };
                    await this.waitForImageToLoad(img, 1500);
                    return img;
                }
                const rect = mediaEl.getBoundingClientRect();
                const placeholder = document.createElement('div');
                placeholder.style.cssText = `width: ${rect.width}px; height: ${rect.height}px; flex-shrink: 0; display: block; background: transparent;`;
                if (mediaEl.parentNode) { try { mediaEl.parentNode.replaceChild(placeholder, mediaEl); } catch (e) { /* ignore */ } }
                this.activeDisplayedMedia = { element: mediaEl, placeholder, isClone: false, originalParent: placeholder.parentNode };
                if (mediaEl.tagName === 'VIDEO') {
                    mediaEl.setAttribute('preload', 'auto');
                    if (mediaEl.videoWidth > 0 && mediaEl.videoHeight > 0) { mediaEl.style.width = '100vw'; mediaEl.style.height = '100vh'; }
                    this.userIntendedPause = false;
                    this.displayVideo(mediaEl);
                } else {
                    const originalSrc = mediaEl.src;
                    const highResUrl = this.getHighQualityUrl(mediaEl);
                    mediaEl.style.cssText = `width: 100%; height: 100%; object-fit: contain; background: black; pointer-events: auto;`;
                    if (highResUrl && highResUrl !== originalSrc) {
                        mediaEl.onerror = () => { mediaEl.src = originalSrc; mediaEl.onerror = null; };
                        mediaEl.src = highResUrl;
                    }
                    this.uiElements.mediaWrapper.appendChild(mediaEl);
                    // re-trigger the fade even though this <img> may be a reused node
                    mediaEl.classList.remove('igr-media-enter'); void mediaEl.offsetWidth; mediaEl.classList.add('igr-media-enter');
                }
                return mediaEl;
            }

            displayVideo(videoElement) {
                const mediaWrapper = this.uiElements.mediaWrapper;
                const videoContainer = document.createElement('div');
                videoContainer.className = 'custom-video-container igr-media-enter';
                videoContainer.style.cssText = `position: relative; width: 100%; height: 100%; background: black; display: flex; align-items: center; justify-content: center; cursor: pointer; pointer-events: auto;`;
                videoElement.style.cssText = `width: 100%; height: 100%; object-fit: contain; border-radius: 0; display: block; background: black;`;
                videoElement.muted = this.savedMuted;
                videoElement.volume = this.savedVolume;
                videoElement.playbackRate = this.savedPlaybackRate;
                videoElement.loop = false;
                videoElement.controls = false;
                videoElement.preload = 'auto';

                const controlsOverlay = document.createElement('div');
                controlsOverlay.className = 'video-controls-overlay';
                controlsOverlay.style.cssText = `position: absolute; bottom: 0; left: 0; right: 0; background: linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.4) 50%, transparent 100%); padding: 12px 30px 12px 12px; opacity: 0; transition: opacity 0.3s ease; pointer-events: all; z-index: 1000010;`;

                const progressContainer = document.createElement('div');
                progressContainer.style.cssText = `width: 100%; height: 14px; background: transparent; border-radius: 10px; margin-bottom: 10px; cursor: pointer; pointer-events: all; position: relative; display: flex; align-items: center; padding: 5px 0;`;
                const progressBackground = document.createElement('div');
                progressBackground.style.cssText = `width: 100%; height: 4px; background: rgba(255,255,255,0.3); border-radius: 2px; position: relative;`;
                const progressBar = document.createElement('div');
                progressBar.className = 'progress-fill';
                progressBar.style.cssText = `height: 100%; background: linear-gradient(90deg, #f09433, #e6683c); border-radius: 3px; width: 0%; transition: width 0.1s ease; position: relative;`;
                const progressThumb = document.createElement('div');
                progressThumb.className = 'progress-thumb';
                progressThumb.style.cssText = `position: absolute; right: -5px; top: 50%; transform: translateY(-50%); width: 10px; height: 10px; background: #f09433; border-radius: 50%; opacity: 0; transition: opacity 0.3s ease; box-shadow: 0 2px 8px rgba(0,0,0,0.3);`;
                progressBar.appendChild(progressThumb); progressBackground.appendChild(progressBar); progressContainer.appendChild(progressBackground);

                const controlsContainer = document.createElement('div');
                controlsContainer.style.cssText = `display: flex; align-items: center; gap: 15px; pointer-events: all;`;
                const playButton = document.createElement('button');
                playButton.innerHTML = `
                    <svg class="play-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="transition: all 0.3s ease;"><path d="M8 5v14l11-7z" fill="white" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.4));"/></svg>
                    <svg class="pause-icon" style="display: none; transition: all 0.3s ease;" width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" fill="white" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.4));"/></svg>`;
                playButton.style.cssText = `background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.2); color: white; font-size: 16px; cursor: pointer; padding: 0; border-radius: 50%; transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; position: relative; overflow: hidden; backdrop-filter: blur(10px); box-shadow: 0 4px 12px rgba(0,0,0,0.3); flex-shrink: 0;`;
                const updatePlayPauseIcon = () => {
                    const playIcon = playButton.querySelector('.play-icon');
                    const pauseIcon = playButton.querySelector('.pause-icon');
                    if (playIcon && pauseIcon) {
                        if (videoElement.paused) { playIcon.style.display = 'block'; pauseIcon.style.display = 'none'; }
                        else { playIcon.style.display = 'none'; pauseIcon.style.display = 'block'; }
                    }
                };
                const timeDisplay = document.createElement('div');
                timeDisplay.style.cssText = `color: white; font-size: 11px; font-weight: 600; min-width: 70px; text-shadow: 0 1px 2px rgba(0,0,0,0.8);`;
                timeDisplay.textContent = '0:00 / 0:00';
                const speedButton = document.createElement('button');
                speedButton.innerHTML = this.savedPlaybackRate.toFixed(2) + 'x';
                speedButton.style.cssText = `background: rgba(255,255,255,0.2); border: none; color: white; font-size: 11px; font-weight: 600; cursor: pointer; padding: 4px 8px; border-radius: 12px; transition: all 0.3s ease; min-width: 35px;`;
                speedButton.title = 'Playback Speed';
                const volumeContainer = document.createElement('div');
                volumeContainer.style.cssText = `display: flex; align-items: center; gap: 10px; margin-left: auto; margin-right: 25px;`;
                const muteButton = document.createElement('button');
                muteButton.innerHTML = this.savedMuted ? '🔇' : '🔊';
                muteButton.style.cssText = `background: none; border: none; color: white; font-size: 16px; cursor: pointer; padding: 6px; border-radius: 4px; transition: background 0.3s ease; flex-shrink: 0;`;
                const volumeSliderContainer = document.createElement('div');
                volumeSliderContainer.style.cssText = `width: 80px; height: 20px; display: flex; align-items: center; cursor: pointer; position: relative;`;
                const volumeTrack = document.createElement('div');
                volumeTrack.style.cssText = `width: 100%; height: 4px; background: rgba(255,255,255,0.3); border-radius: 2px; position: relative;`;
                const volumeFill = document.createElement('div');
                volumeFill.style.cssText = `height: 100%; background: linear-gradient(90deg, #f09433, #e6683c); border-radius: 2px; width: ${this.savedVolume * 100}%; position: relative;`;
                const volumeThumb = document.createElement('div');
                volumeThumb.style.cssText = `position: absolute; top: 50%; right: -6px; transform: translateY(-50%); width: 12px; height: 12px; background: white; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.3); cursor: grab;`;
                volumeTrack.appendChild(volumeFill); volumeFill.appendChild(volumeThumb); volumeSliderContainer.appendChild(volumeTrack);
                volumeContainer.appendChild(muteButton); volumeContainer.appendChild(volumeSliderContainer);
                controlsContainer.appendChild(playButton); controlsContainer.appendChild(timeDisplay); controlsContainer.appendChild(speedButton); controlsContainer.appendChild(volumeContainer);
                controlsOverlay.appendChild(progressContainer); controlsOverlay.appendChild(controlsContainer);
                videoContainer.appendChild(videoElement); videoContainer.appendChild(controlsOverlay);
                mediaWrapper.appendChild(videoContainer);

                let isDragging = false; let isVolumeDragging = false;
                const applyVolumeSettings = () => { videoElement.muted = this.savedMuted; videoElement.volume = this.savedVolume; muteButton.innerHTML = this.savedMuted ? '🔇' : '🔊'; volumeFill.style.width = (this.savedVolume * 100) + '%'; };
                const saveVolumeSettings = () => { this.savedVolume = videoElement.volume; this.savedMuted = videoElement.muted; localStorage.setItem('igreels_volume', this.savedVolume.toString()); localStorage.setItem('igreels_muted', this.savedMuted.toString()); };
                const updateVolume = (clientX) => { const rect = volumeTrack.getBoundingClientRect(); const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)); videoElement.volume = percent; if (percent > 0 && videoElement.muted) videoElement.muted = false; saveVolumeSettings(); applyVolumeSettings(); };
                volumeSliderContainer.addEventListener('mousedown', (e) => {
                    e.stopPropagation(); isVolumeDragging = true; volumeThumb.style.cursor = 'grabbing'; updateVolume(e.clientX);
                    const onMouseMove = (e) => { if (isVolumeDragging) updateVolume(e.clientX); };
                    const onMouseUp = () => { isVolumeDragging = false; volumeThumb.style.cursor = 'grab'; document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp); };
                    document.addEventListener('mousemove', onMouseMove); document.addEventListener('mouseup', onMouseUp);
                });

                const togglePlayPause = () => {
                    this.stopAutoScrollTimer(); this.isProcessingInteraction = true;
                    if (videoElement.paused) { this.userIntendedPause = false; applyVolumeSettings(); videoElement.play().catch(err => {}); }
                    else { this.userIntendedPause = true; videoElement.pause(); }
                    setTimeout(() => { this.isProcessingInteraction = false; if (!videoElement.paused) this.startAutoScrollTimer(); }, 300);
                };
                playButton.addEventListener('click', (e) => { e.stopPropagation(); togglePlayPause(); });

                // v13: single tap shows controls; DOUBLE-tap toggles play/pause (mobile-friendly).
                // Single click on desktop still toggles. Touch uses dblclick via native event.
                let lastTap = 0;
                videoElement.addEventListener('click', (e) => {
                    if (this._didTouchPan) return; // ignore the click that ends a pan drag
                    const isTouch = document.documentElement.classList.contains('igr-touch');
                    if (!isTouch) { togglePlayPause(); return; }
                    const now = Date.now();
                    if (now - lastTap < 300) { lastTap = 0; togglePlayPause(); }
                    else { lastTap = now; controlsOverlay.style.opacity = '1'; clearTimeout(this._ctrlHide); this._ctrlHide = setTimeout(() => controlsOverlay.style.opacity = '0', 2500); }
                });

                const toggleMute = () => { videoElement.muted = !videoElement.muted; saveVolumeSettings(); applyVolumeSettings(); };
                videoElement.addEventListener('dblclick', (e) => { e.stopPropagation(); /* dblclick handled via click counter on touch; on desktop keep mute */ if (!document.documentElement.classList.contains('igr-touch')) toggleMute(); });
                muteButton.addEventListener('click', (e) => { e.stopPropagation(); toggleMute(); });

                const speedOptions = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 3.5, 4];
                speedButton.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const currentIndex = speedOptions.indexOf(this.savedPlaybackRate);
                    const nextIndex = (currentIndex + 1) % speedOptions.length;
                    this.savedPlaybackRate = speedOptions[nextIndex];
                    videoElement.playbackRate = this.savedPlaybackRate;
                    speedButton.innerHTML = this.savedPlaybackRate.toFixed(2) + 'x';
                    localStorage.setItem('igreels_playbackRate', this.savedPlaybackRate.toString());
                });

                const updateProgress = () => { if (!isDragging && videoElement.duration) progressBar.style.width = (videoElement.currentTime / videoElement.duration) * 100 + '%'; };
                const updateTime = () => { const formatTime = s => `${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,'0')}`; timeDisplay.textContent = `${formatTime(videoElement.currentTime||0)} / ${formatTime(videoElement.duration||0)}`; };
                videoElement.addEventListener('timeupdate', () => { updateProgress(); updateTime(); });
                videoElement.addEventListener('loadedmetadata', () => { updateTime(); applyVolumeSettings(); videoElement.playbackRate = this.savedPlaybackRate; });
                videoElement.addEventListener('play', updatePlayPauseIcon);
                videoElement.addEventListener('pause', updatePlayPauseIcon);
                videoElement.addEventListener('loadeddata', () => { applyVolumeSettings(); videoElement.playbackRate = this.savedPlaybackRate; updatePlayPauseIcon(); });
                videoElement.addEventListener('canplay', () => { applyVolumeSettings(); videoElement.playbackRate = this.savedPlaybackRate; });
                videoElement.addEventListener('pause', (e) => {
                    if (this.isActive && !this.userIntendedPause && !this.isNavigating && !this.isProcessingInteraction) {
                        videoElement.play().catch(()=>{});
                        if (this.activePost.element) this.activePost.element.scrollIntoView({ behavior: 'auto', block: 'center' });
                    }
                });
                const enforceSpeed = () => { if (Math.abs(videoElement.playbackRate - this.savedPlaybackRate) > 0.01) videoElement.playbackRate = this.savedPlaybackRate; };
                videoElement.addEventListener('ratechange', enforceSpeed);
                videoElement.addEventListener('playing', enforceSpeed);
                videoElement.addEventListener('play', enforceSpeed);

                const handleProgressClick = (e) => {
                    this.stopAutoScrollTimer(); this.isProcessingInteraction = true;
                    const rect = progressBackground.getBoundingClientRect();
                    if (videoElement.duration) videoElement.currentTime = ((e.clientX - rect.left) / rect.width) * videoElement.duration;
                    setTimeout(() => { this.isProcessingInteraction = false; this.startAutoScrollTimer(); }, 300);
                };
                progressContainer.addEventListener('mousedown', (e) => {
                    e.stopPropagation(); isDragging = true; handleProgressClick(e);
                    const onMove = (e) => { if (isDragging) handleProgressClick(e); };
                    const onUp = () => { isDragging = false; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
                    document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
                });

                let isHoveringControls = false; const controlsHoverZone = 150;
                videoContainer.addEventListener('mousemove', (e) => {
                    const rect = videoContainer.getBoundingClientRect();
                    const distanceFromBottom = rect.bottom - e.clientY;
                    if (distanceFromBottom <= controlsHoverZone) { if (!isHoveringControls) { isHoveringControls = true; controlsOverlay.style.opacity = '1'; } }
                    else { if (isHoveringControls) { isHoveringControls = false; if (!isDragging && !isVolumeDragging) controlsOverlay.style.opacity = '0'; } }
                });
                videoContainer.addEventListener('mouseleave', () => { isHoveringControls = false; if (!isDragging && !isVolumeDragging) controlsOverlay.style.opacity = '0'; });

                applyVolumeSettings(); videoElement.playbackRate = this.savedPlaybackRate; speedButton.innerHTML = this.savedPlaybackRate.toFixed(2) + 'x'; updatePlayPauseIcon();
                const playVideo = async () => {
                    try {
                        if (videoElement.readyState < 2) {
                            await new Promise((resolve) => {
                                const onReady = () => { videoElement.removeEventListener('canplay', onReady); videoElement.removeEventListener('loadeddata', onReady); resolve(); };
                                videoElement.addEventListener('canplay', onReady); videoElement.addEventListener('loadeddata', onReady);
                                setTimeout(resolve, 1500);
                            });
                        }
                        applyVolumeSettings(); videoElement.playbackRate = this.savedPlaybackRate;
                        await videoElement.play();
                        applyVolumeSettings(); videoElement.playbackRate = this.savedPlaybackRate;
                    } catch (err) {}
                };
                playVideo();
            }

            restoreOriginalMediaPosition() {
                const info = this.activeDisplayedMedia;
                if (!info || (!info.element && !info.placeholder)) {
                    this.activeDisplayedMedia = { element: null, placeholder: null, isClone: false };
                    if (this.uiElements.mediaWrapper) this.uiElements.mediaWrapper.innerHTML = '';
                    return;
                }
                try {
                    if (info.isClone) { if (info.element && info.element.parentNode) info.element.parentNode.removeChild(info.element); }
                    else {
                        const { element, placeholder } = info;
                        if (element && placeholder && placeholder.parentNode) {
                            if (element.tagName === 'VIDEO') element.pause();
                            element.style.cssText = '';
                            placeholder.parentNode.replaceChild(element, placeholder);
                        } else if (element && element.parentNode) { element.parentNode.removeChild(element); }
                    }
                } catch (e) {}
                this.activeDisplayedMedia = { element: null, placeholder: null, isClone: false };
                if (this.uiElements.mediaWrapper) this.uiElements.mediaWrapper.innerHTML = '';
            }

            async updateView(postElement) {
                const article = postElement || document.querySelector('div[role="dialog"] article');
                if (!article) { this.exit(); return; }
                this.activePost.element = article;
                const currentVolume = this.savedVolume; const currentMuted = this.savedMuted; const currentPlaybackRate = this.savedPlaybackRate;
                const picked = await this.pickActiveMediaWithWait(article, 30, 110);
                if (!picked) { return; }
                const mediaEl = picked.el;
                await this.mountMediaForDisplay(mediaEl);
                this._panX = 50; this.container && this.container.style.setProperty('--igr-pan-x-px', '0px');
                this.applyFit();
                this.savedVolume = currentVolume; this.savedMuted = currentMuted; this.savedPlaybackRate = currentPlaybackRate;
                let authorLink = article.querySelector('header a[role="link"]');
                if (!authorLink) authorLink = article.querySelector('a[role="link"] span');
                const author = authorLink?.textContent?.trim() || authorLink?.getAttribute('href')?.replace(/\//g, '') || 'Unknown';
                let caption = '';
                const captionContainer = article.querySelector('h1._aaco, h1, div[class*="Caption"], span[class*="caption"]');
                if (captionContainer) caption = captionContainer.innerHTML || captionContainer.textContent;
                else { const possibleCaption = article.querySelector('div[style*="webkit-box"]'); if (possibleCaption) caption = possibleCaption.innerHTML; }
                this.uiElements.info.innerHTML = `<div class="author-name" style="font-weight: 700; font-size: 16px; margin-bottom: 8px; cursor: pointer;">${author}</div><div style="font-size: 14px; line-height: 1.4; opacity: 0.9; word-wrap: break-word; overflow-wrap: break-word; white-space: normal;">${caption}</div>`;
                const authorElement = this.uiElements.info.querySelector('.author-name');
                if (authorElement) authorElement.addEventListener('click', (e) => { e.stopPropagation(); window.open(`https://instagram.com/${author}`, '_blank'); });
                this.updateActionButtonStates();
                this.startAutoScrollTimer();
            }

            async attemptScrollToPost(element, attempts = 0, maxAttempts = 8, interval = 55) {
                if (!element || attempts >= maxAttempts) return;
                element.scrollIntoView({ behavior: 'auto', block: 'center' });
                await new Promise(resolve => setTimeout(resolve, interval));
                const rect = element.getBoundingClientRect();
                const viewportHeight = window.innerHeight; const margin = 50;
                const isInView = rect.top >= -margin && rect.bottom <= viewportHeight + margin;
                if (!isInView) await this.attemptScrollToPost(element, attempts + 1, maxAttempts, interval);
            }

            // Stable per-post identifier (the post permalink) — does NOT change
            // when you cycle carousel images, unlike a media URL.
            _postHref(article) {
                if (!article) return null;
                const a = article.querySelector('a[href*="/p/"], a[href*="/reel/"]');
                if (!a) return null;
                const m = (a.getAttribute('href') || '').match(/\/(p|reel)\/([^/?#]+)/);
                return m ? m[2] : null;
            }
            // Find the index of the current post in the live article list, even if
            // the original element was virtualised away — relocate by permalink.
            _currentArticleIndex(currentArticle, allArticles) {
                let i = allArticles.indexOf(currentArticle);
                if (i !== -1) return i;
                if (this._currentPostHref) {
                    i = allArticles.findIndex(a => this._postHref(a) === this._currentPostHref);
                    if (i !== -1) return i;
                }
                // last resort: nearest to viewport centre
                const cy = window.innerHeight / 2; let bd = Infinity, best = -1;
                allArticles.forEach((a, idx) => { const r = a.getBoundingClientRect(); const d = Math.abs(cy - (r.top + r.height / 2)); if (d < bd) { bd = d; best = idx; } });
                return best;
            }
            findNextArticle(currentArticle) {
                const allArticles = Array.from(document.querySelectorAll('article'));
                const currentIndex = this._currentArticleIndex(currentArticle, allArticles);
                for (let i = currentIndex + 1; i < allArticles.length; i++) {
                    if (allArticles[i] !== currentArticle && this.isValidArticle(allArticles[i])) return allArticles[i];
                }
                return null;
            }
            findPrevArticle(currentArticle) {
                const allArticles = Array.from(document.querySelectorAll('article'));
                const currentIndex = this._currentArticleIndex(currentArticle, allArticles);
                if (currentIndex <= 0) return null;
                for (let i = currentIndex - 1; i >= 0; i--) {
                    if (allArticles[i] !== currentArticle && this.isValidArticle(allArticles[i])) return allArticles[i];
                }
                return null;
            }

            updateActionButtonStates() {
                if (!this.activePost.element) return;
                // remember the current post's permalink (used to relocate it after
                // Instagram virtualises/unmounts it) — stable across carousel images.
                this._currentPostHref = this._postHref(this.activePost.element);
                const isLiked = this.activePost.element.querySelector('section svg[aria-label="Unlike"]');
                const heartPath = this.uiElements.likeButton.querySelector('.heart-path');
                if (isLiked) { this.uiElements.likeButton.classList.add('igreels-liked'); if (heartPath) { heartPath.setAttribute('fill', '#ff306c'); heartPath.setAttribute('stroke', '#ff306c'); } }
                else { this.uiElements.likeButton.classList.remove('igreels-liked'); if (heartPath) { heartPath.setAttribute('fill', 'none'); heartPath.setAttribute('stroke', 'white'); } }
                const isSaved = this.activePost.element.querySelector('section svg[aria-label="Remove"]');
                const bookmarkPath = this.uiElements.saveButton.querySelector('.bookmark-path');
                if (isSaved) { this.uiElements.saveButton.classList.add('igreels-bookmarked'); if (bookmarkPath) { bookmarkPath.setAttribute('fill', '#ffc107'); bookmarkPath.setAttribute('stroke', '#ffc107'); } }
                else { this.uiElements.saveButton.classList.remove('igreels-bookmarked'); if (bookmarkPath) { bookmarkPath.setAttribute('fill', 'none'); bookmarkPath.setAttribute('stroke', 'white'); } }
                let isFollowing = false;
                const isModal = !!document.querySelector('div[role="dialog"]');
                if (isModal) {
                    const headerButtons = this.activePost.element.querySelectorAll('header button');
                    for (const btn of headerButtons) { const text = btn.textContent.trim(); if (text === 'Following' || text === 'Requested') { isFollowing = true; break; } }
                } else {
                    const articleHeader = this.activePost.element.querySelector('header');
                    if (articleHeader) {
                        const divButtons = articleHeader.querySelectorAll('div[role="button"]');
                        for (const btn of divButtons) { const text = btn.textContent.trim(); if (text === 'Following' || text === 'Requested') { isFollowing = true; break; } }
                        if (!isFollowing) { const buttons = articleHeader.querySelectorAll('button'); for (const btn of buttons) { const text = btn.textContent.trim(); if (text === 'Following' || text === 'Requested') { isFollowing = true; break; } } }
                    }
                }
                if (!isFollowing) { const followingSvg = this.activePost.element.querySelector('svg[aria-label="Following"]'); if (followingSvg) isFollowing = true; }
                if (isFollowing) this.uiElements.followButton.classList.add('igreels-following');
                else this.uiElements.followButton.classList.remove('igreels-following');
            }

            smartNavigate(direction) {
                if (this.skipCarouselMode) { this.navigatePost(direction); return; }
                const mediaContainer = this.activePost.element?.firstElementChild;
                if (!mediaContainer) return;
                const nextButton = mediaContainer.querySelector('button[aria-label="Next"]');
                const prevButton = mediaContainer.querySelector('button[aria-label="Go back"]');
                if (direction === 'next' && nextButton) this.navigateMedia('next');
                else if (direction === 'prev' && prevButton) this.navigateMedia('prev');
                else this.navigatePost(direction);
            }

            async navigatePost(direction) {
                if (this.isNavigating) return;
                this.isNavigating = true; this.stopAutoScrollTimer(); this.isProcessingInteraction = true;
                const currentId = this.getMediaIdentifier(this.activeDisplayedMedia.element);
                const dialog = document.querySelector('div[role="dialog"]');
                if (dialog) {
                    const svgSelector = direction === 'next' ? 'svg[aria-label="Next"]' : 'svg[aria-label="Go back"]';
                    const navButton = Array.from(dialog.querySelectorAll(svgSelector)).find(svg => !svg.closest('article'))?.closest('button');
                    if (!navButton) { this.isNavigating = false; this.isProcessingInteraction = false; this.startAutoScrollTimer(); return; }
                    navButton.click();
                    const start = Date.now(); let success = false;
                    while (Date.now() - start < 5000) {
                        await this.sleep(120);
                        const newArticle = document.querySelector('div[role="dialog"] article');
                        if (!newArticle) continue;
                        const picked = await this.pickActiveMediaWithWait(newArticle, 12, 100);
                        const newId = picked ? this.getMediaIdentifier(picked.el) : null;
                        if (newId && newId !== currentId) { await this.updateView(newArticle); success = true; break; }
                    }
                } else {
                    document.body.style.scrollBehavior = 'auto';
                    let nextPostElement = (direction === 'prev') ? this.findPrevArticle(this.activePost.element) : this.findNextArticle(this.activePost.element);
                    if (nextPostElement) {
                        // Short settle after the scroll — updateView() then waits for the
                        // media to be ready itself, so no big fixed delay needed.
                        await this.attemptScrollToPost(nextPostElement); await this.sleep(120); await this.updateView(nextPostElement);
                    } else if (direction === 'next') {
                        window.scrollTo({ top: document.body.scrollHeight, behavior: 'auto' });
                        setTimeout(() => window.scrollBy(0, 100), 50);
                        const start = Date.now(); let foundNew = false;
                        while (Date.now() - start < 2500) {
                            await this.sleep(100);
                            const newlyLoadedPost = this.findNextArticle(this.activePost.element);
                            if (newlyLoadedPost && newlyLoadedPost !== this.activePost.element) {
                                await this.attemptScrollToPost(newlyLoadedPost); await this.sleep(120); await this.updateView(newlyLoadedPost); foundNew = true; break;
                            }
                        }
                    }
                }
                this.isNavigating = false; this.isProcessingInteraction = false; this.startAutoScrollTimer();
            }

            async navigateMedia(direction) {
                if (this.isNavigating) return;
                this.isNavigating = true; this.stopAutoScrollTimer(); this.isProcessingInteraction = true;
                const mediaContainer = this.activePost.element?.firstElementChild;
                if (!mediaContainer) { this.isNavigating = false; this.isProcessingInteraction = false; this.startAutoScrollTimer(); return; }
                const selector = direction === 'next' ? 'button[aria-label="Next"]' : 'button[aria-label="Go back"]';
                const button = mediaContainer.querySelector(selector);
                if (!button) { this.isNavigating = false; this.isProcessingInteraction = false; this.startAutoScrollTimer(); return; }
                const currentId = this.getMediaIdentifier(this.activeDisplayedMedia.element);
                button.click();
                const start = Date.now(); let success = false;
                while (Date.now() - start < 3500) {
                    await this.sleep(120);
                    const picked = await this.pickActiveMediaWithWait(this.activePost.element, 10, 100);
                    if (!picked) continue;
                    const newId = this.getMediaIdentifier(picked.el);
                    if (newId && newId !== currentId) { await this.updateView(this.activePost.element); success = true; break; }
                }
                if (!success) { await this.sleep(260); await this.updateView(this.activePost.element); }
                this.isNavigating = false; this.isProcessingInteraction = false; this.startAutoScrollTimer();
            }

            async toggleAction(type) {
                if (!this.activePost.element) return;
                const selectors = { like: 'section svg[aria-label="Like"], section svg[aria-label="Unlike"]', save: 'section svg[aria-label="Save"], section svg[aria-label="Remove"]' };
                const uiButton = type === 'like' ? this.uiElements.likeButton : this.uiElements.saveButton;
                uiButton.style.transform = 'scale(1.3)'; uiButton.style.filter = 'brightness(1.5)';
                const svgElement = this.activePost.element.querySelector(selectors[type]);
                if (!svgElement) { setTimeout(() => { uiButton.style.transform = 'scale(1)'; uiButton.style.filter = 'brightness(1)'; }, 200); return; }
                let clickableElement = svgElement.closest('[role="button"], button');
                if (clickableElement) { clickableElement.click(); await this.sleep(500); this.updateActionButtonStates(); }
                setTimeout(() => { uiButton.style.transform = 'scale(1)'; uiButton.style.filter = 'brightness(1)'; }, 200);
            }

            async toggleFollow() {
                if (!this.activePost.element) return;
                this.uiElements.followButton.style.transform = 'scale(1.3)'; this.uiElements.followButton.style.filter = 'brightness(1.5)';
                const isModal = !!document.querySelector('div[role="dialog"]');
                let followButton = null;
                if (isModal) {
                    const headerButtons = this.activePost.element.querySelectorAll('header button');
                    for (const btn of headerButtons) { const text = btn.textContent.trim(); if (text === 'Follow' || text === 'Following' || text === 'Unfollow' || text === 'Requested') { followButton = btn; break; } }
                } else {
                    const articleHeader = this.activePost.element.querySelector('header');
                    if (articleHeader) {
                        const divButtons = articleHeader.querySelectorAll('div[role="button"]');
                        for (const btn of divButtons) { const text = btn.textContent.trim(); if (text === 'Follow' || text === 'Following' || text === 'Unfollow' || text === 'Requested') { followButton = btn; break; } }
                        if (!followButton) { const buttons = articleHeader.querySelectorAll('button'); for (const btn of buttons) { const text = btn.textContent.trim(); if (text === 'Follow' || text === 'Following' || text.includes('Follow')) { followButton = btn; break; } } }
                    }
                }
                if (!followButton) { const allDivButtons = this.activePost.element.querySelectorAll('div[role="button"]'); for (const btn of allDivButtons) { const text = btn.textContent.trim(); if (text === 'Follow' || text === 'Following') { followButton = btn; break; } } }
                if (!followButton) { const allButtons = this.activePost.element.querySelectorAll('button'); for (const btn of allButtons) { const text = btn.textContent.trim(); if (text === 'Follow' || text === 'Following') { followButton = btn; break; } } }
                if (!followButton) { const followSvg = this.activePost.element.querySelector('svg[aria-label="Follow"], svg[aria-label="Following"]'); if (followSvg) followButton = followSvg.closest('button, div[role="button"]'); }
                if (followButton) { followButton.click(); await this.sleep(500); this.updateActionButtonStates(); }
                setTimeout(() => { this.uiElements.followButton.style.transform = 'scale(1)'; this.uiElements.followButton.style.filter = 'brightness(1)'; }, 200);
            }

            handleKeydown(e) {
                if (e.key.toLowerCase() === 'x') {
                    e.preventDefault(); e.stopImmediatePropagation();
                    if (this.isActive) this.exit(); else this.armFeedStart();
                    return;
                }
                if (!this.isActive) return;
                if (/TEXTAREA|INPUT/.test(document.activeElement.tagName)) {
                    if (e.key.toLowerCase() === 'q' || e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); this.exit(); }
                    return;
                }
                try { e.preventDefault(); e.stopImmediatePropagation(); } catch (err) {}
                const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
                const keyMap = {
                    'ArrowUp': () => this.smartNavigate('prev'),
                    'ArrowDown': () => this.smartNavigate('next'),
                    'ArrowLeft': () => this.navigateMedia('prev'),
                    'ArrowRight': () => this.navigateMedia('next'),
                    'l': () => this.toggleAction('like'),
                    's': () => this.toggleAction('save'),
                    'f': () => this.toggleFollow(),
                    'v': () => this.toggleFit(),
                    ' ': () => {
                        this.stopAutoScrollTimer(); this.isProcessingInteraction = true;
                        const video = this.uiElements.mediaWrapper.querySelector('video');
                        if (video) { if (video.paused) { this.userIntendedPause = false; video.play(); } else { this.userIntendedPause = true; video.pause(); } }
                        setTimeout(() => { this.isProcessingInteraction = false; const videoCheck = this.uiElements.mediaWrapper.querySelector('video'); if (videoCheck && !videoCheck.paused) this.startAutoScrollTimer(); }, 300);
                    },
                    ',': () => this.scrubVideo(-5),
                    '<': () => this.scrubVideo(-5),
                    '.': () => this.scrubVideo(5),
                    '>': () => this.scrubVideo(5),
                    'Escape': () => this.exit(),
                    'q': () => this.exit(),
                };
                const fn = keyMap[key];
                if (fn) fn();
            }

            scrubVideo(seconds) {
                this.stopAutoScrollTimer(); this.isProcessingInteraction = true;
                const video = this.uiElements.mediaWrapper.querySelector('video');
                if (video) video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + seconds));
                setTimeout(() => { this.isProcessingInteraction = false; this.startAutoScrollTimer(); }, 300);
            }
        }

        if (window.instagramFeedInstance) { try { window.instagramFeedInstance.exit(); } catch (e) {} }
        window.instagramFeedInstance = new InstagramFeed();
        window.instagramFeedInstance.init();
    })();

})();

