// ==UserScript==
// @name         Instagram Immersive Fullscreen (Quetta)
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Hides nav and status bars, auto-triggers full screen on first interaction, and forces edge-to-edge content on Instagram.
// @author       You
// @match        *://*.instagram.com/*
// @match        *://instagram.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // 1. Force the viewport to draw underneath the status and nav bars (Edge-to-Edge)
    function applyImmersiveViewport() {
        let metaViewport = document.querySelector('meta[name="viewport"]');
        if (!metaViewport) {
            metaViewport = document.createElement('meta');
            metaViewport.name = 'viewport';
            document.head.appendChild(metaViewport);
        }
        // 'viewport-fit=cover' forces the browser to ignore the safe areas (notch, nav bars)
        metaViewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';
    }

    // 2. Inject CSS to remove forced paddings and annoying "Open in App" banners
    function injectImmersiveCSS() {
        if (document.getElementById('quetta-fullscreen-css')) return;
        
        const style = document.createElement('style');
        style.id = 'quetta-fullscreen-css';
        style.innerHTML = `
            html, body {
                width: 100vw !important;
                height: 100vh !important;
                margin: 0 !important;
                padding: 0 !important;
                overflow-x: hidden !important;
            }
            /* Override Instagram's native safe-area padding to utilize the whole screen */
            #react-root, main {
                padding-top: env(safe-area-inset-top, 0px) !important;
                padding-bottom: env(safe-area-inset-bottom, 0px) !important;
            }
            /* Hide the intrusive app banners which often break fullscreen layouts */
            .mweb-unauth-banner, div[class*="AppBanner"] {
                display: none !important;
            }
        `;
        if (document.head) document.head.appendChild(style);
    }

    // 3. Request true system Fullscreen (Hides Status & Nav Bar completely)
    function requestFullScreen() {
        const docEl = document.documentElement;
        const reqFullScreen = docEl.requestFullscreen || 
                              docEl.webkitRequestFullscreen || 
                              docEl.mozRequestFullScreen || 
                              docEl.msRequestFullscreen;
        
        if (!document.fullscreenElement && reqFullScreen) {
            reqFullScreen.call(docEl).catch(err => {
                console.warn("Fullscreen request failed (likely waiting for a stronger user tap).", err);
            });
        }
    }

    // 4. Initialize the immersive settings and event listeners
    function init() {
        applyImmersiveViewport();
        injectImmersiveCSS();

        // Bind the fullscreen request to any natural interaction.
        // The moment you touch the screen, it goes full screen.
        const events = ['touchstart', 'click', 'scroll', 'pointerdown'];
        
        const triggerFullscreen = () => {
            if (!document.fullscreenElement) {
                requestFullScreen();
                applyImmersiveViewport(); // Re-apply just in case IG's routing overwrote it
            }
        };

        events.forEach(event => {
            document.addEventListener(event, triggerFullscreen, { passive: true });
        });
    }

    // Run as soon as the DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
    // Instagram is a Single Page Application (SPA). Navigating to a new page 
    // doesn't refresh the browser, but it DOES rewrite the <head> tags. 
    // This interval ensures the immersive viewport is constantly enforced.
    setInterval(() => {
        applyImmersiveViewport();
        injectImmersiveCSS();
    }, 2000);

})();
