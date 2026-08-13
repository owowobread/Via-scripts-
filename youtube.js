// ==UserScript==
// @name         YouTube Ultimate Mobile Player (MX Player Gestures)
// @namespace    http://viabrowser.com/
// @version      21.0
// @description  MX Player style massive centered gesture HUD, UI ghost-touch fix, Long Press 2x Speed
// @match        *://m.youtube.com/*
// @match        *://www.youtube.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    if (window.vCustomPlayerActive) return;
    window.vCustomPlayerActive = true;

    let policy = { createHTML: s => s };
    if (window.trustedTypes && window.trustedTypes.createPolicy) {
        try { policy = window.trustedTypes.createPolicy('v-bypass-func-qual', { createHTML: s => s }); } catch(e) {}
    }

    const ICONS = {
        sparkle: `<svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M19 8l-1 2-2 1 2 1 1 2 1-2 2-1-2-1-1-2zm-6 2l-2-4-2 4-4 2 4 2 2 4 2-4 4-2-4-2z"/></svg>`,
        fullscreen: `<svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>`,
        close: `<svg width="28" height="28" viewBox="0 0 24 24" fill="white"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`,
        dots: `<svg width="28" height="28" viewBox="0 0 24 24" fill="white"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>`,
        play: `<svg width="48" height="48" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>`,
        pause: `<svg width="48" height="48" viewBox="0 0 24 24" fill="white"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`,
        prev: `<svg width="36" height="36" viewBox="0 0 24 24" fill="white"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>`,
        next: `<svg width="36" height="36" viewBox="0 0 24 24" fill="white"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>`,
        lock: `<svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>`,
        unlock: `<svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M12 17c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm6-9h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6h1.9c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm0 12H6V10h12v10z"/></svg>`,
        sun: `<svg width="42" height="42" viewBox="0 0 24 24" fill="white"><path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .39-.39.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z"/></svg>`,
        headphone: `<svg width="42" height="42" viewBox="0 0 24 24" fill="white"><path d="M12 3a9 9 0 0 0-9 9v7c0 1.1.9 2 2 2h4v-8H5v-1c0-3.87 3.13-7 7-7s7 3.13 7 7v1h-4v8h4c1.1 0 2-.9 2-2v-7a9 9 0 0 0-9-9z"/></svg>`,
        aspect: `<svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M19 12h-2v3h-3v2h5v-5zM7 9h3V7H5v5h2V9zm14-6H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16.01H3V4.99h18v14.02z"/></svg>`,
        rotate: `<svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M16.48 2.52c3.27 1.55 5.61 4.72 5.97 8.48h1.5C23.44 4.84 18.29 0 12 0l-.66.03 3.81 3.81 1.33-1.32zm-6.25-.77c-.59-.59-1.54-.59-2.12 0L1.75 8.11c-.59.59-.59 1.54 0 2.12l12.02 12.02c.59.59 1.54.59 2.12 0l6.36-6.36c.59-.59.59-1.54 0-2.12L10.23 1.75zm4.6 19.44L2.81 9.17l6.36-6.36 12.02 12.02-6.36 6.36zm-7.31.29C4.25 19.94 1.91 16.76 1.55 13H.05C.56 19.16 5.71 24 12 24l.66-.03-3.81-3.81-1.33 1.32z"/></svg>`,
        fastforward: `<svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>`
    };

    const vState = { speed: 1.0, isLongPress2x: false, loop: false, aspect: 'contain', timerMins: 0, timerEnd: null, brightness: 1, locked: false, currentQuality: '1080p' };
    let currentUrl = location.href;
    const getVid = () => document.querySelector('video');
    const vibrate = (ms) => { if (navigator.vibrate) navigator.vibrate(ms); };

    const formatTime = (sec) => {
        if (isNaN(sec)) return "00:00";
        let m = Math.floor(sec / 60); let s = Math.floor(sec % 60);
        return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    };

    function injectStyles() {
        if (document.getElementById('v-global-styles')) return;
        const style = document.createElement('style');
        style.id = 'v-global-styles';
        style.innerHTML = policy.createHTML(`
            html.v-fs-active, body.v-fs-active { overflow: hidden !important; width: 100vw !important; height: 100vh !important; margin: 0 !important; padding: 0 !important; }
            html.v-fs-active ytm-header-bar, html.v-fs-active ytm-mobile-topbar, html.v-fs-active header, html.v-fs-active ytm-pivot-bar-renderer, html.v-fs-active .ytp-chrome-top, html.v-fs-active .ytp-chrome-bottom { display: none !important; opacity: 0 !important; pointer-events: none !important; }

            .v-stripped-parent { transform: none !important; clip-path: none !important; contain: none !important; will-change: auto !important; filter: none !important; perspective: none !important; position: static !important; z-index: auto !important; }
            video.v-fs-video { position: fixed !important; top: 0 !important; left: 0 !important; width: 100vw !important; height: 100vh !important; z-index: 2147483641 !important; background: transparent !important; pointer-events: none !important; visibility: visible !important; opacity: 1 !important; }
            html.v-audio-only video.v-fs-video { opacity: 0 !important; }

            #v-blackout-backdrop { position: fixed !important; top: 0 !important; left: 0 !important; width: 100vw !important; height: 100vh !important; background: #000000 !important; z-index: 2147483640 !important; display: none; pointer-events: none !important; }
            html.v-fs-active #v-blackout-backdrop { display: block !important; }

            #v-brightness-dimmer { position: fixed !important; top: 0 !important; left: 0 !important; width: 100vw !important; height: 100vh !important; background: #000000 !important; z-index: 2147483642 !important; opacity: 0; pointer-events: none !important; display: none; }
            html.v-fs-active #v-brightness-dimmer { display: block !important; }

            #v-custom-player { position: fixed !important; top: 0 !important; left: 0 !important; width: 100vw !important; height: 100vh !important; z-index: 2147483645 !important; display: none; flex-direction: column; justify-content: space-between; font-family: sans-serif; pointer-events: auto !important; }
            html.v-fs-active #v-custom-player { display: flex !important; }
            
            .v-ui-layer { transition: opacity 0.25s ease-in-out; }
            #v-custom-player.v-hidden-ui .v-ui-layer { opacity: 0 !important; pointer-events: none !important; }
            #v-custom-player.v-locked .v-ui-layer:not(.v-lock-btn) { opacity: 0 !important; pointer-events: none !important; }
            #v-custom-player.v-locked .v-lock-btn { opacity: 0.8 !important; pointer-events: auto !important; }
            #v-custom-player.v-locked #v-settings-menu, #v-custom-player.v-locked #v-quality-menu { right: -350px !important; }
            
            .v-gradient-top { background: linear-gradient(rgba(0,0,0,0.9), transparent); padding: 15px; display: flex; justify-content: space-between; align-items: center; pointer-events: none; }
            .v-gradient-bottom { background: linear-gradient(transparent, #000000); padding: 20px 15px; display: flex; flex-direction: column; gap: 15px; pointer-events: none; }
            .v-gradient-top button, .v-center-controls button, .v-gradient-bottom button, .v-slider, .v-settings-item, .v-quality-item { pointer-events: auto !important; cursor: pointer !important; }

            /* Strip pointer events from buttons and slider when UI is hidden or locked */
            #v-custom-player.v-hidden-ui .v-slider,
            #v-custom-player.v-hidden-ui button {
                pointer-events: none !important;
            }
            #v-custom-player.v-locked .v-slider,
            #v-custom-player.v-locked .v-gradient-bottom button,
            #v-custom-player.v-locked .v-gradient-top button,
            #v-custom-player.v-locked .v-center-controls button {
                pointer-events: none !important;
            }

            .v-center-controls { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); display: flex; gap: 40px; align-items: center; pointer-events: none; }
            .v-center-controls button { background: none; border: none; opacity: 0.9; padding: 15px; z-index: 2147483648 !important; }
            .v-lock-btn { position: absolute; right: 30px; top: 50%; transform: translateY(-50%); background: none; border: none; opacity: 0.7; pointer-events: auto !important; padding: 15px;}
            
            .v-title { color: white; font-size: 16px; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; text-align: center; margin: 0 15px; pointer-events: auto !important;}
            .v-timeline-container { display: flex; align-items: center; gap: 15px; color: white; font-size: 14px; pointer-events: auto !important; z-index: 2147483648 !important;}
            .v-slider { flex: 1; -webkit-appearance: none; background: rgba(255,255,255,0.4); height: 4px; border-radius: 2px; outline: none; z-index: 2147483648 !important;}
            .v-slider::-webkit-slider-thumb { -webkit-appearance: none; width: 18px; height: 18px; background: #E91E63; border-radius: 50%; }
            
            .v-bottom-pill { background: rgba(255,255,255,0.15); border-radius: 25px; padding: 10px 25px; display: flex; justify-content: space-between; align-items: center; pointer-events: auto !important; z-index: 2147483648 !important; margin-top: 10px;}
            .v-bottom-pill button { background: none; border: none; padding: 5px; opacity: 0.9; z-index: 2147483648 !important;}
            
            #v-settings-menu, #v-quality-menu { position: fixed; right: -350px; top: 0; width: 320px; height: 100vh; background: #000000; color: white; z-index: 2147483649 !important; transition: right 0.3s ease; display: flex; flex-direction: column; pointer-events: auto !important; box-shadow: -5px 0 20px rgba(0,0,0,0.8); }
            .v-settings-header { display: flex; align-items: center; padding: 20px; border-bottom: 1px solid rgba(255,255,255,0.1); font-size: 20px; font-weight: bold;}
            .v-settings-item, .v-quality-item { display: flex; justify-content: space-between; align-items: center; padding: 22px 20px; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 16px; }
            .v-settings-val { color: #E91E63; font-weight: bold; font-size: 15px; }
            .v-radio { width: 20px; height: 20px; border: 2px solid white; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
            .v-quality-item.active .v-radio::after { content: ''; width: 10px; height: 10px; background: white; border-radius: 50%; }

            /* Indicator Widgets */
            #v-scrub-box { position: absolute; top: 40%; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.85); border: 1px solid rgba(255,255,255,0.2); color: white; padding: 20px 40px; border-radius: 15px; display: flex; flex-direction: column; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.1s; pointer-events: none; z-index: 2147483650 !important; }
            .v-scrub-time { font-size: 32px; font-weight: bold; color: white; }
            .v-scrub-delta { font-size: 18px; color: #E91E63; margin-top: 5px; font-weight: bold; }

            /* Fast Forward 2x Badge */
            #v-ff-badge { position: absolute; top: 10%; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.8); backdrop-filter: blur(5px); border-radius: 20px; padding: 10px 20px; color: white; font-weight: bold; font-size: 15px; display: flex; align-items: center; gap: 8px; opacity: 0; transition: opacity 0.15s ease-out; pointer-events: none; z-index: 2147483655 !important; box-shadow: 0 4px 15px rgba(0,0,0,0.5); }

            /* Double Tap Ripples */
            .v-dt-ripple { position: absolute; top: 0; bottom: 0; width: 45%; display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 5px; color: white; font-size: 18px; font-weight: bold; opacity: 0; pointer-events: none; z-index: 2147483647 !important; transition: opacity 0.3s; border-radius: 50%; transform: scale(0.8); }
            #v-dt-ripple-left { left: -15%; background: radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 60%); }
            #v-dt-ripple-right { right: -15%; background: radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 60%); }
            .v-dt-ripple.active { opacity: 1 !important; transform: scale(1.1) !important; transition: all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94); }

            /* MX Player Style Centered HUD */
            #v-mx-hud { position: absolute; top: 35%; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.85); backdrop-filter: blur(8px); border-radius: 15px; padding: 25px 35px; display: flex; align-items: center; justify-content: center; gap: 25px; opacity: 0; transition: opacity 0.2s ease-out; pointer-events: none; z-index: 2147483655 !important; box-shadow: 0 10px 40px rgba(0,0,0,0.8); }
            .v-mx-left-col { display: flex; flex-direction: column; align-items: center; gap: 12px; }
            .v-mx-icon { display: flex; justify-content: center; align-items: center; }
            .v-mx-text { color: white; font-weight: bold; font-size: 26px; font-family: monospace; }
            .v-mx-bar-bg { width: 14px; height: 120px; background: rgba(255,255,255,0.2); border-radius: 7px; overflow: hidden; position: relative; }
            .v-mx-bar-fill { position: absolute; bottom: 0; left: 0; width: 100%; height: 50%; background: #E91E63; border-radius: 7px; }
        `);
        document.documentElement.appendChild(style);
    }

    function makeClickable(id, callback) {
        const el = document.getElementById(id);
        if (!el) return;
        el.onclick = null; 
        el.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); callback(e); }, { capture: true });
        el.addEventListener('touchstart', (e) => { e.stopPropagation(); }, { passive: true });
    }

    let mxHudTimer;
    function updateMxHUD(icon, value) {
        const hud = document.getElementById('v-mx-hud');
        if (!hud) return;
        
        const percent = Math.round(value * 100);
        document.getElementById('v-mx-icon-box').innerHTML = policy.createHTML(icon);
        document.getElementById('v-mx-fill-box').style.height = `${value * 100}%`;
        document.getElementById('v-mx-text-box').innerText = `${percent}%`;
        
        hud.style.opacity = '1';
        
        clearTimeout(mxHudTimer);
        mxHudTimer = setTimeout(() => { hud.style.opacity = '0'; }, 800);
    }

    function triggerDoubleTapRipple(side) {
        const ripple = document.getElementById(side === 'left' ? 'v-dt-ripple-left' : 'v-dt-ripple-right');
        if (!ripple) return;
        ripple.classList.remove('active');
        void ripple.offsetWidth;
        ripple.classList.add('active');
        setTimeout(() => { ripple.classList.remove('active'); }, 500);
    }

    function applyYouTubeQuality(qualityStr) {
        const player = document.getElementById('movie_player') || document.querySelector('.html5-video-player');
        if (player && typeof player.setPlaybackQuality === 'function') {
            let qMap = { '1080p': 'hd1080', '720p': 'hd720', '480p': 'large', '360p': 'medium', '240p': 'small', '144p': 'tiny' };
            player.setPlaybackQuality(qMap[qualityStr] || 'auto');
            return true;
        }

        const gearBtn = document.querySelector('.ytm-settings-button, .ytp-settings-button, button[aria-label*="Settings"], button[aria-label*="settings"]');
        if (gearBtn) {
            gearBtn.click();
            setTimeout(() => {
                const items = document.querySelectorAll('.ytm-menu-item, .ytp-menuitem, button, div');
                for (let item of items) {
                    if (item.textContent && item.textContent.toLowerCase().includes('quality')) {
                        item.click();
                        setTimeout(() => {
                            const options = document.querySelectorAll('.ytm-menu-item, .ytp-menuitem, span, div');
                            for (let opt of options) {
                                if (opt.textContent && opt.textContent.trim().includes(qualityStr)) {
                                    opt.click();
                                    break;
                                }
                            }
                        }, 250);
                        break;
                    }
                }
            }, 250);
            return true;
        }
        return false;
    }

    function buildUI() {
        if (!document.documentElement) return;
        injectStyles();

        if (!document.getElementById('v-blackout-backdrop')) {
            let blackout = document.createElement('div');
            blackout.id = 'v-blackout-backdrop';
            document.documentElement.appendChild(blackout);
        }
        if (!document.getElementById('v-brightness-dimmer')) {
            let dimmer = document.createElement('div');
            dimmer.id = 'v-brightness-dimmer';
            document.documentElement.appendChild(dimmer);
        }

        let pill = document.getElementById('v-pink-pill');
        if (!pill) {
            pill = document.createElement('div');
            pill.id = 'v-pink-pill';
            pill.style.cssText = 'position: fixed !important; right: 15px !important; background: #E91E63 !important; border-radius: 25px !important; z-index: 2147483647 !important; display: none; gap: 8px !important; padding: 6px 12px !important; box-shadow: 0 4px 10px rgba(0,0,0,0.5) !important; flex-direction: row !important; align-items: center !important; pointer-events: auto !important;';
            pill.innerHTML = policy.createHTML(`
                <button id="v-btn-summary" style="background:none; border:none; padding:4px; display:flex; align-items:center; pointer-events: auto !important;">${ICONS.sparkle}</button>
                <button id="v-btn-fullscreen" style="background:none; border:none; padding:4px; display:flex; align-items:center; pointer-events: auto !important;">${ICONS.fullscreen}</button>
            `);
            document.documentElement.appendChild(pill);
            
            makeClickable('v-btn-fullscreen', () => {
                document.documentElement.classList.add('v-fs-active');
                document.body.classList.add('v-fs-active');
                document.getElementById('v-custom-player').classList.remove('v-hidden-ui');
                if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
            });
        }

        let player = document.getElementById('v-custom-player');
        if (!player) {
            player = document.createElement('div');
            player.id = 'v-custom-player';
            player.innerHTML = policy.createHTML(`
                <div id="v-click-layer" style="position:absolute; top:0; left:0; width:100%; height:100%; z-index:1; pointer-events:auto !important;"></div>
                
                <!-- Fast Forward Badge -->
                <div id="v-ff-badge">
                    ${ICONS.fastforward} <span>Playing at 2x</span>
                </div>

                <!-- MX Player Style Central HUD -->
                <div id="v-mx-hud">
                    <div class="v-mx-left-col">
                        <div class="v-mx-icon" id="v-mx-icon-box"></div>
                        <div class="v-mx-text" id="v-mx-text-box">50%</div>
                    </div>
                    <div class="v-mx-bar-bg">
                        <div class="v-mx-bar-fill" id="v-mx-fill-box"></div>
                    </div>
                </div>

                <!-- Double Tap Ripples -->
                <div id="v-dt-ripple-left" class="v-dt-ripple">${ICONS.prev} <span>-10s</span></div>
                <div id="v-dt-ripple-right" class="v-dt-ripple">${ICONS.next} <span>+10s</span></div>

                <div id="v-scrub-box">
                    <div class="v-scrub-time" id="v-scrub-curr">00:00</div>
                    <div class="v-scrub-delta" id="v-scrub-diff">[+00:00]</div>
                </div>
                
                <div class="v-gradient-top v-ui-layer" style="z-index:2; position:relative;">
                    <button id="v-close">${ICONS.close}</button>
                    <div class="v-title" id="v-video-title">YouTube Video</div>
                    <button id="v-settings">${ICONS.dots}</button>
                </div>
                
                <div class="v-center-controls v-ui-layer" style="z-index:2;">
                    <button id="v-prev">${ICONS.prev}</button>
                    <button id="v-playpause">${ICONS.play}</button>
                    <button id="v-next">${ICONS.next}</button>
                </div>
                
                <button id="v-lock-btn" class="v-lock-btn v-ui-layer" style="z-index:2;">${ICONS.lock}</button>
                
                <div class="v-gradient-bottom v-ui-layer" style="z-index:2; position:relative;">
                    <div class="v-timeline-container">
                        <span id="v-curr-time">00:00</span>
                        <input type="range" id="v-progress" class="v-slider" min="0" value="0" step="0.1">
                        <span id="v-total-time">00:00</span>
                    </div>
                    <div class="v-bottom-pill">
                        <button id="v-bot-fs">${ICONS.fullscreen}</button>
                        <button id="v-bot-aspect">${ICONS.aspect}</button>
                        <button id="v-bot-audio">${ICONS.headphone}</button>
                        <button id="v-bot-rotate">${ICONS.rotate}</button>
                    </div>
                </div>
                
                <div id="v-settings-menu">
                    <div class="v-settings-header" id="v-close-settings">
                        <button id="v-close-set-btn" style="background:none; border:none; display:flex;">${ICONS.close}</button> <span>Player Settings</span>
                    </div>
                    <div class="v-settings-item" id="v-set-cc"><span>CC Subtitles</span><span class="v-settings-val" id="v-val-cc">Toggle ></span></div>
                    <div class="v-settings-item" id="v-set-qual"><span>HD Quality</span><span class="v-settings-val" id="v-val-current-qual">1080p ></span></div>
                    <div class="v-settings-item" id="v-set-speed"><span>Playback Speed</span><span class="v-settings-val" id="v-val-speed">1.0x ></span></div>
                    <div class="v-settings-item" id="v-set-loop"><span>Repeat</span><span class="v-settings-val" id="v-val-loop">Turn off ></span></div>
                </div>
                <div id="v-quality-menu">
                    <div class="v-settings-header" id="v-close-quality">
                        <button id="v-close-qual-btn" style="background:none; border:none; display:flex;">${ICONS.close}</button> <span>Quality</span>
                    </div>
                    <div class="v-quality-item active" data-q="1080p"><span>1080p</span><div class="v-radio"></div></div>
                    <div class="v-quality-item" data-q="720p"><span>720p</span><div class="v-radio"></div></div>
                    <div class="v-quality-item" data-q="480p"><span>480p</span><div class="v-radio"></div></div>
                    <div class="v-quality-item" data-q="360p"><span>360p</span><div class="v-radio"></div></div>
                </div>
            `);
            document.documentElement.appendChild(player);
            
            bindEvents();
            bindGestures();
        }

        if (location.pathname.startsWith('/watch') && !document.documentElement.classList.contains('v-fs-active')) {
            const v = getVid();
            pill.style.setProperty('display', 'flex', 'important'); 
            if (v) {
                const rect = v.getBoundingClientRect();
                if (rect.bottom > 50 && rect.height > 50) pill.style.setProperty('top', (rect.bottom - 60) + 'px', 'important');
                else pill.style.setProperty('top', '250px', 'important'); 
            } else {
                pill.style.setProperty('top', '250px', 'important'); 
            }
        } else if (pill) {
            pill.style.setProperty('display', 'none', 'important');
        }
    }

    function closeCustomPlayer() {
        document.documentElement.classList.remove('v-fs-active');
        document.body.classList.remove('v-fs-active');
        document.getElementById('v-settings-menu').style.right = '-350px';
        document.getElementById('v-quality-menu').style.right = '-350px';
        document.querySelectorAll('.v-fs-video').forEach(v => v.classList.remove('v-fs-video'));
        document.querySelectorAll('.v-stripped-parent').forEach(p => p.classList.remove('v-stripped-parent'));
        if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
    }

    function triggerPlaylistNext() {
        let btn = document.querySelector('.ytm-compact-video-renderer a, button[aria-label="Next video"], .ytp-next-button');
        if (btn) btn.click();
    }
    function triggerPlaylistPrev() { window.history.back(); }

    function bindGestures() {
        const layer = document.getElementById('v-click-layer');
        let startX, startY, currentX, currentY;
        let isSeeking = false, isVol = false, isBri = false, isSwiping = false;
        let startVol = 1, startBri = 1;
        let initialTime = 0, targetTime = 0, duration = 0;
        let wasPlaying = false;
        
        let lastTapTime = 0, lastTapX = 0, singleTapTimer, longPressTimer;

        layer.addEventListener('touchstart', (e) => {
            if (vState.locked) return;
            
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            isSeeking = isVol = isBri = isSwiping = false;
            vState.isLongPress2x = false;
            
            const v = getVid();
            if(v) {
                startVol = v.volume;
                initialTime = v.currentTime;
                duration = v.duration || 0;
                wasPlaying = !v.paused;
            }
            startBri = vState.brightness;

            // Start Long Press Timer (600ms threshold)
            clearTimeout(longPressTimer);
            longPressTimer = setTimeout(() => {
                if (!isSwiping && !vState.locked) {
                    const vid = getVid();
                    if (vid && !vid.paused) {
                        vState.isLongPress2x = true;
                        vibrate(40);
                        const badge = document.getElementById('v-ff-badge');
                        if (badge) badge.style.opacity = '1';
                    }
                }
            }, 600);

        }, { passive: true });

        layer.addEventListener('touchmove', (e) => {
            if (vState.locked) return;
            
            currentX = e.touches[0].clientX;
            currentY = e.touches[0].clientY;
            let dx = currentX - startX;
            let dy = startY - currentY;

            // Cancel long press if finger wiggles too much
            if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
                clearTimeout(longPressTimer);
            }

            if (!isSeeking && !isVol && !isBri) {
                if (Math.abs(dx) > 20) {
                    isSeeking = isSwiping = true;
                    const v = getVid();
                    if(v && wasPlaying) v.pause();
                } else if (Math.abs(dy) > 20) {
                    isSwiping = true;
                    if (startX >= window.innerWidth / 2) isVol = true;
                    else isBri = true;
                }
            }

            if (isSwiping) e.preventDefault(); 

            if (isSeeking) {
                let secondsDelta = Math.round(dx / 3); 
                targetTime = Math.max(0, Math.min(duration, initialTime + secondsDelta));
                let diff = targetTime - initialTime;
                
                const scrubBox = document.getElementById('v-scrub-box');
                scrubBox.style.opacity = '1';
                document.getElementById('v-scrub-curr').innerText = formatTime(targetTime);
                document.getElementById('v-scrub-diff').innerText = `[${diff >= 0 ? '+' : ''}${formatTime(Math.abs(diff))}]`;
                document.getElementById('v-custom-player').classList.add('v-hidden-ui'); 
                
            } else if (isVol) {
                const v = getVid();
                if(v) {
                    let delta = dy / (window.innerHeight * 0.4);
                    let newVol = Math.max(0, Math.min(1, startVol + delta));
                    v.volume = newVol;
                    if (newVol === 0 || newVol === 1) vibrate(30);
                    updateMxHUD(ICONS.headphone, newVol);
                }
            } else if (isBri) {
                let delta = dy / (window.innerHeight * 0.4);
                vState.brightness = Math.max(0, Math.min(1, startBri + delta));
                if (vState.brightness === 0 || vState.brightness === 1) vibrate(30);
                
                const dimmer = document.getElementById('v-brightness-dimmer');
                if (dimmer) dimmer.style.opacity = (1 - vState.brightness) * 0.85;
                updateMxHUD(ICONS.sun, vState.brightness);
            }
        }, { passive: false });

        layer.addEventListener('touchend', (e) => {
            if (vState.locked) return;
            
            // Clean up long press
            clearTimeout(longPressTimer);
            if (vState.isLongPress2x) {
                vState.isLongPress2x = false;
                const badge = document.getElementById('v-ff-badge');
                if (badge) badge.style.opacity = '0';
                return; // Early exit so we don't accidentally trigger UI menus
            }
            
            if (!isSwiping) {
                let now = Date.now();
                let timeDiff = now - lastTapTime;
                
                if (timeDiff < 300 && Math.abs(startX - lastTapX) < 50) {
                    clearTimeout(singleTapTimer);
                    lastTapTime = 0;
                    vibrate(40);
                    
                    const v = getVid();
                    if(v) {
                        if (startX > window.innerWidth / 2) {
                            v.currentTime = Math.min(v.duration, v.currentTime + 10);
                            triggerDoubleTapRipple('right');
                        } else {
                            v.currentTime = Math.max(0, v.currentTime - 10);
                            triggerDoubleTapRipple('left');
                        }
                    }
                } else {
                    lastTapTime = now;
                    lastTapX = startX;
                    singleTapTimer = setTimeout(() => {
                        document.getElementById('v-custom-player').classList.toggle('v-hidden-ui');
                    }, 250); 
                }
            } else {
                if (isSeeking) {
                    const v = getVid();
                    if(v) {
                        v.currentTime = targetTime;
                        if(wasPlaying) v.play();
                    }
                    document.getElementById('v-scrub-box').style.opacity = '0';
                    document.getElementById('v-custom-player').classList.remove('v-hidden-ui');
                }
            }
        });
    }

    function bindEvents() {
        makeClickable('v-lock-btn', () => {
            vState.locked = !vState.locked;
            const p = document.getElementById('v-custom-player');
            const btn = document.getElementById('v-lock-btn');
            if(vState.locked) { p.classList.add('v-locked'); btn.innerHTML = policy.createHTML(ICONS.unlock); } 
            else { p.classList.remove('v-locked'); btn.innerHTML = policy.createHTML(ICONS.lock); }
        });

        makeClickable('v-close', closeCustomPlayer);
        makeClickable('v-bot-fs', closeCustomPlayer);
        makeClickable('v-playpause', () => { const v = getVid(); if (!v) return; v.paused ? v.play() : v.pause(); });
        makeClickable('v-prev', () => { triggerPlaylistPrev(); });
        makeClickable('v-next', () => { triggerPlaylistNext(); });

        makeClickable('v-bot-aspect', () => {
            vState.aspect = vState.aspect === 'contain' ? 'cover' : 'contain';
            const v = getVid(); if (v) v.style.setProperty('object-fit', vState.aspect, 'important');
        });

        const setMenu = document.getElementById('v-settings-menu');
        const qualMenu = document.getElementById('v-quality-menu');

        makeClickable('v-settings', () => setMenu.style.right = '0');
        makeClickable('v-close-set-btn', () => setMenu.style.right = '-350px');
        makeClickable('v-set-qual', () => { setMenu.style.right = '-350px'; qualMenu.style.right = '0'; });
        makeClickable('v-close-qual-btn', () => qualMenu.style.right = '-350px');

        document.querySelectorAll('.v-quality-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault(); e.stopPropagation();
                document.querySelectorAll('.v-quality-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                
                let q = item.getAttribute('data-q');
                vState.currentQuality = q;
                document.getElementById('v-val-current-qual').innerText = q + ' >';
                applyYouTubeQuality(q);
                qualMenu.style.right = '-350px'; 
            }, {capture: true});
        });

        const progSlider = document.getElementById('v-progress');
        progSlider.addEventListener('input', (e) => {
            const v = getVid();
            if (v) {
                v.currentTime = e.target.value;
                document.getElementById('v-curr-time').innerText = formatTime(e.target.value);
            }
        });
        progSlider.addEventListener('touchstart', (e) => e.stopPropagation(), {passive:true});
    }

    setInterval(() => {
        if (currentUrl !== location.href) { currentUrl = location.href; closeCustomPlayer(); }
        buildUI();
        const v = getVid();
        if (!v) return;

        // Smart Playback Speed Manager (Accounts for standard speed vs 2x long press)
        let targetSpeed = vState.isLongPress2x ? 2.0 : vState.speed;
        if (v.playbackRate !== targetSpeed) v.playbackRate = targetSpeed;
        
        if (v.loop !== vState.loop) v.loop = vState.loop;

        if (document.documentElement.classList.contains('v-fs-active')) {
            if (!v.classList.contains('v-fs-video')) v.classList.add('v-fs-video');

            let p = v.parentNode;
            while (p && p !== document.body && p !== document.documentElement) {
                if (!p.classList.contains('v-stripped-parent')) p.classList.add('v-stripped-parent');
                p = p.parentNode;
            }

            const playBtn = document.getElementById('v-playpause');
            if (playBtn) playBtn.innerHTML = policy.createHTML(v.paused ? ICONS.play : ICONS.pause);

            const titleEl = document.getElementById('v-video-title');
            if (titleEl && titleEl.innerText !== document.title.replace(' - YouTube', '')) titleEl.innerText = document.title.replace(' - YouTube', '');

            const prog = document.getElementById('v-progress');
            if (prog && !prog.matches(':active')) {
                prog.max = v.duration || 0;
                prog.value = v.currentTime;
                document.getElementById('v-curr-time').innerText = formatTime(v.currentTime);
                document.getElementById('v-total-time').innerText = formatTime(v.duration || 0);
            }
        }
    }, 200);

})();
