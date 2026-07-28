// ==UserScript==
// @name         AMOLED Premium Reader (Smart Visibility)
// @namespace    http://tampermonkey.net/
// @version      14.0
// @description  Only loads on news sites. Bypasses paywalls, applies AMOLED, amputates subscription footers, and features a smart dictionary.
// @match        *://*.thehindu.com/*
// @match        *://*.indianexpress.com/*
// @match        *://*.thewire.in/*
// @match        *://*.theguardian.com/*
// @match        *://*.bbc.com/*
// @match        *://*.bbc.co.uk/*
// @match        *://*.nytimes.com/*
// @match        *://aeon.co/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // ==========================================
    // PHASE 1: THE APEX BYPASSER (Executes Instantly)
    // ==========================================

    if (window.location.hostname.includes('thehindu.com')) {
        try {
            localStorage.clear();
            sessionStorage.clear();
        } catch (e) {}
    }

    const originalAddEventListener = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function(type, listener, options) {
        if (type === 'wheel' || type === 'touchmove' || type === 'DOMMouseScroll') {
            if (typeof options === 'object') {
                options.passive = true;
            } else {
                options = { passive: true };
            }
        }
        return originalAddEventListener.call(this, type, listener, options);
    };

    const originalSetProperty = window.CSSStyleDeclaration.prototype.setProperty;
    window.CSSStyleDeclaration.prototype.setProperty = function(propertyName, value, priority) {
        if (propertyName === 'overflow' && (value === 'hidden' || value === 'clip')) {
            return; 
        }
        return originalSetProperty.call(this, propertyName, value, priority);
    };

    const injectShieldStyles = () => {
        if (!document.documentElement) {
            requestAnimationFrame(injectShieldStyles);
            return;
        }
        const style = document.createElement('style');
        style.innerHTML = `
            html, body { 
                overflow: auto !important; 
                height: auto !important; 
                touch-action: auto !important; 
            }
            .fc-ab-root, .tp-modal, .tp-backdrop, .tp-active, #sp-message-container { 
                opacity: 0 !important; 
                pointer-events: none !important; 
                z-index: -9999 !important; 
            }
        `;
        (document.head || document.documentElement).appendChild(style);
    };
    injectShieldStyles();

    const ghostPopup = () => {
        if (document.body && document.body.style.overflow === 'hidden') document.body.style.overflow = 'auto';
        if (document.documentElement && document.documentElement.style.overflow === 'hidden') document.documentElement.style.overflow = 'auto';

        const allElements = document.querySelectorAll('div, section');
        for (let el of allElements) {
            if (el.textContent && el.textContent.includes('price on truth')) {
                let parent = el;
                while (parent && parent.tagName !== 'BODY' && parent.tagName !== 'HTML') {
                    const compStyle = window.getComputedStyle(parent);
                    if (compStyle.position === 'fixed' || parseInt(compStyle.zIndex) > 100) {
                        parent.style.setProperty('opacity', '0', 'important');
                        parent.style.setProperty('pointer-events', 'none', 'important');
                        parent.style.setProperty('z-index', '-9999', 'important');
                        break; 
                    }
                    parent = parent.parentElement;
                }
            }
        }
    };


    // ==========================================
    // PHASE 2: DETECTION ENGINE
    // ==========================================

    function isArticlePage() {
        const host = window.location.hostname;

        // 1. Explicit Whitelist
        const newsDomains = [
            'thehindu.com', 'indianexpress.com', 'thewire.in', 
            'theguardian.com', 'bbc.com', 'bbc.co.uk', 
            'nytimes.com', 'aeon.co'
        ];
        if (newsDomains.some(domain => host.includes(domain))) return true;

        // 2. Open Graph Meta Tag (Standard for 99% of news publishers)
        const ogType = document.querySelector('meta[property="og:type"]');
        if (ogType && ogType.content.toLowerCase().includes('article')) return true;

        // 3. Schema.org SEO Data
        const scripts = document.querySelectorAll('script[type="application/ld+json"]');
        for (let s of scripts) {
            if (s.textContent.includes('"@type":"NewsArticle"') || 
                s.textContent.includes('"@type": "NewsArticle"') || 
                s.textContent.includes('"@type":"Article"')) {
                return true;
            }
        }

        // 4. HTML5 Fallback (A prominent article block exists)
        const articleTag = document.querySelector('article');
        if (articleTag && articleTag.innerText.trim().length > 600) return true;

        return false;
    }


    // ==========================================
    // PHASE 3: UI, READER ENGINE & DICTIONARY
    // ==========================================
    
    const initUI = () => {
        // KILL DUPLICATE BUTTONS: Ensures only ONE button ever exists on the screen
        if (document.getElementById('amoled-reader-btn')) return;

        // Only trigger The Hindu's specific anti-adblock sweeper if we are on The Hindu
        if (window.location.hostname.includes('thehindu.com')) {
            ghostPopup();
            setInterval(ghostPopup, 1000);
        }

        // --- REFINED ANIMATION START (Pure Mathematical Physics Engine) ---
        const btnStyle = document.createElement('style');
        btnStyle.innerHTML = `
            #amoled-reader-btn {
                position: fixed;
                bottom: 32px;
                right: 32px;
                z-index: 2147483647;
                width: 56px;
                height: 56px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 26px;
                color: rgba(255, 255, 255, 0.9);
                
                background: rgba(25, 25, 25, 0.45);
                backdrop-filter: blur(16px) saturate(180%);
                -webkit-backdrop-filter: blur(16px) saturate(180%);
                
                border: 1px solid rgba(255, 255, 255, 0.12);
                box-shadow: 
                    0 8px 32px rgba(0, 0, 0, 0.25),
                    inset 0 1px 2px rgba(255, 255, 255, 0.2),
                    inset 0 -1px 2px rgba(0, 0, 0, 0.2);
                
                cursor: pointer;
                outline: none;
                padding: 0;
                margin: 0;
                font-family: system-ui, -apple-system, sans-serif;
                transform-origin: center;
                
                transition: transform 0.35s cubic-bezier(0.5, 0, 0.1, 1),
                            border-radius 0.35s cubic-bezier(0.5, 0, 0.1, 1),
                            background 0.3s ease,
                            color 0.2s ease,
                            box-shadow 0.3s ease,
                            border-color 0.3s ease,
                            opacity 0.2s ease;
            }

            #amoled-reader-btn:not(.loading-drop):not(.vanish):hover {
                background: rgba(45, 45, 45, 0.55);
                border-color: rgba(255, 255, 255, 0.25);
                color: #ffffff;
                box-shadow: 
                    0 12px 40px rgba(0, 0, 0, 0.35),
                    inset 0 1px 3px rgba(255, 255, 255, 0.3),
                    inset 0 -1px 2px rgba(0, 0, 0, 0.2);
                transform: translateY(-4px) scale(1.04);
            }

            #amoled-reader-btn:not(.loading-drop):not(.vanish):active {
                transform: translateY(2px) scale(0.92);
            }

            /* Overrides transitions completely to hand off rendering strictly to physics keyframes */
            #amoled-reader-btn.loading-drop {
                transition: none !important; 
                backdrop-filter: none !important;
                -webkit-backdrop-filter: none !important;
                pointer-events: none !important; 
                animation: amoled-fluid-drop 0.7s forwards, drop-pulsate 0.6s infinite alternate 0.7s; 
            }

            #amoled-reader-btn.vanish {
                opacity: 0;
            }

            /* High-level physics simulation for fluid morph, hang-time, acceleration, and impact */
            @keyframes amoled-fluid-drop {
                0% {
                    transform: translateY(0) scale(1) rotate(0deg);
                    border-radius: 50%;
                    background: rgba(25, 25, 25, 0.45);
                    color: rgba(255, 255, 255, 0.9);
                    border-color: rgba(255, 255, 255, 0.12);
                }
                15% {
                    /* Phase 1: Condense into a dense fluid bead (Cloud naturally dissolves to transparent) */
                    transform: translateY(0) scale(0.75) rotate(0deg);
                    border-radius: 50%;
                    background: rgba(255, 255, 255, 1);
                    color: transparent; 
                    border-color: transparent;
                }
                30% {
                    /* Phase 2: Surface tension break. Pulls upward slightly, morphs, prepares to drop */
                    transform: translateY(-8px) scale(0.55) rotate(-45deg);
                    border-radius: 50% 0 50% 50%;
                    background: #ffffff;
                    color: transparent;
                    border-color: transparent;
                    box-shadow: 0 0 12px rgba(255, 255, 255, 0.7);
                    animation-timing-function: cubic-bezier(0.55, 0.055, 0.675, 0.19); /* Gravity Curve (Acceleration) */
                }
                75% {
                    /* Phase 3: Terminal velocity impact */
                    transform: translateY(45px) scale(0.25) rotate(-45deg);
                    border-radius: 50% 0 50% 50%;
                    background: #ffffff;
                    color: transparent;
                    border-color: transparent;
                    box-shadow: 0 0 4px rgba(255, 255, 255, 0.3);
                    animation-timing-function: cubic-bezier(0.175, 0.885, 0.32, 1.275); /* Elastic Squash Impact */
                }
                100% {
                    /* Phase 4: Settle & Stabilize */
                    transform: translateY(35px) scale(0.35) rotate(-45deg);
                    border-radius: 50% 0 50% 50%;
                    background: #ffffff;
                    color: transparent;
                    border-color: transparent;
                    box-shadow: 0 0 20px rgba(255, 255, 255, 0.9);
                }
            }

            @keyframes drop-pulsate {
                0% { transform: translateY(35px) scale(0.35) rotate(-45deg); box-shadow: 0 0 20px rgba(255, 255, 255, 0.9); }
                100% { transform: translateY(35px) scale(0.42) rotate(-45deg); box-shadow: 0 0 40px rgba(255, 255, 255, 1); }
            }

            /* The Pure Black Eruption Phase */
            .amoled-splash {
                position: fixed;
                bottom: 24px; 
                right: 59px; 
                width: 2px;
                height: 2px;
                background-color: #000000;
                border-radius: 50%;
                z-index: 2147483646; 
                transform: scale(0);
                pointer-events: none;
                transition: transform 0.35s cubic-bezier(0.7, 0, 0.1, 1); 
            }

            .amoled-splash.splash-active {
                transform: scale(3000); 
            }
        `;
        (document.head || document.documentElement).appendChild(btnStyle);

        const btn = document.createElement('button');
        btn.id = 'amoled-reader-btn';
        btn.innerHTML = '☁'; 
        document.body.appendChild(btn);
        // --- REFINED ANIMATION END ---

        const getFormattedDate = () => {
            const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric' };
            return new Date().toLocaleDateString('en-US', options);
        };

        function initDictionary() {
            const popup = document.createElement('div');
            popup.style.cssText = `
                position: fixed; left: 50%; transform: translate(-50%, -50%); 
                background: #000000; color: #ffffff; padding: 28px; 
                border-radius: 16px; border: 1px solid #333333;
                box-shadow: 0 10px 40px rgba(0,0,0,0.8); z-index: 2147483647; 
                width: 90%; max-width: 400px; font-family: "Google Sans", Roboto, Arial, sans-serif; 
                display: none; opacity: 0; transition: opacity 0.15s ease; 
                text-align: left; pointer-events: auto; word-wrap: break-word;
                -webkit-user-select: none !important; -moz-user-select: none !important;
                -ms-user-select: none !important; user-select: none !important;
                -webkit-touch-callout: none !important;
            `;
            document.body.appendChild(popup);

            let hideTimeout, fetchTimeout;
            let lastWord = '';
            const dictCache = {}; 

            const handleScroll = () => {
                if (popup.style.display === 'block' || popup.style.opacity === '1') {
                    window.getSelection().removeAllRanges();
                    hidePopup();
                    lastWord = '';
                }
            };
            window.addEventListener('scroll', handleScroll, { passive: true });
            window.addEventListener('touchmove', handleScroll, { passive: true });

            document.addEventListener('selectionchange', () => {
                const selection = window.getSelection();
                const text = selection.toString().trim();
                
                if (text.length > 1) {
                    if (text !== lastWord) {
                        lastWord = text;
                        if (selection.rangeCount > 0) {
                            const rect = selection.getRangeAt(0).getBoundingClientRect();
                            popup.style.top = rect.top > window.innerHeight / 2 ? '20%' : '80%';
                        }
                        
                        const isSingleWord = !/\s/.test(text) && /^[A-Za-z]+$/.test(text.replace(/[.,!?]/g, ''));
                        const cleanWord = text.replace(/[.,!?]/g, '');

                        clearTimeout(fetchTimeout);
                        fetchTimeout = setTimeout(() => {
                            if (isSingleWord) {
                                fetchMeaningFast(cleanWord);
                            } else if (text.length < 300) { 
                                fetchPhraseTranslation(text);
                            }
                        }, 350); 
                    }
                } else if (text.length === 0) {
                    hidePopup(); lastWord = '';
                }
            });

            popup.addEventListener('contextmenu', e => e.preventDefault());
            popup.addEventListener('pointerdown', e => {
                e.preventDefault(); 
                window.getSelection().removeAllRanges();
                hidePopup(); lastWord = '';
            });

            async function fetchMeaningFast(word) {
                const lowerWord = word.toLowerCase();
                if (dictCache[lowerWord]) {
                    showPopup(dictCache[lowerWord]); return;
                }
                showPopup(`<div style="font-size:22px; font-weight:500; color:#9aa0a6;">Loading...</div>`);

                const pTranslate = fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=hi&dt=t&q=${word}`)
                    .then(res => res.json()).then(data => {
                        const hi = data[0][0][0];
                        return (hi && hi.toLowerCase() !== lowerWord) ? `<div style="font-size:22px; font-weight:500; color:#4caf50; margin-bottom:8px;">${hi}</div>` : '';
                    }).catch(() => '');

                const pImage = fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${word}`)
                    .then(res => res.json()).then(data => {
                        return (data.thumbnail && data.thumbnail.source) ? `<img src="${data.thumbnail.source}" style="max-width: 100%; max-height: 140px; border-radius: 8px; margin-top: 8px; margin-bottom: 12px; display: block; object-fit: cover;">` : '';
                    }).catch(() => '');

                const pDict = fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`)
                    .then(res => { if (!res.ok) throw new Error(); return res.json(); });

                let finalHtml = '';
                try {
                    const results = await Promise.allSettled([pTranslate, pImage, pDict]);
                    let hindiHtml = results[0].status === 'fulfilled' ? results[0].value : '';
                    let imageHtml = results[1].status === 'fulfilled' ? results[1].value : '';

                    if (results[2].status === 'fulfilled') {
                        const data = results[2].value;
                        const phonetic = data[0].phonetic ? `<span style="margin-left:10px; font-weight:normal; font-size:18px; color:#9aa0a6;">${data[0].phonetic}</span>` : '';
                        const pos = data[0].meanings[0]?.partOfSpeech ? `<div style="font-size:18px; color:#8ab4f8; font-style:italic; margin-bottom:14px; text-transform:capitalize;">${data[0].meanings[0].partOfSpeech}</div>` : '';
                        const definition = data[0].meanings[0]?.definitions[0]?.definition || 'Definition not found.';
                        finalHtml = `
                            <div style="font-size:28px; font-weight:400; margin-bottom:6px; color:#ffffff;">${word}${phonetic}</div>
                            ${hindiHtml}${imageHtml}${pos}
                            <div style="font-size:20px; line-height:1.5; color:#e8eaed;">${definition}</div>`;
                    } else throw new Error();
                } catch (err) {
                    finalHtml = `<div style="font-size:28px; font-weight:400; margin-bottom:10px; color:#ffffff;">${word}</div><div style="font-size:20px; color:#9aa0a6;">Definition not found.</div>`;
                }
                dictCache[lowerWord] = finalHtml; showPopup(finalHtml);
            }

            async function fetchPhraseTranslation(phrase) {
                if (dictCache[phrase]) { showPopup(dictCache[phrase]); return; }
                showPopup(`<div style="font-size:22px; font-weight:500; color:#9aa0a6;">Translating...</div>`);
                try {
                    const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=hi&dt=t&q=${encodeURIComponent(phrase)}`);
                    if (res.ok) {
                        const data = await res.json();
                        let hiTrans = '';
                        if (data && data[0]) data[0].forEach(seg => { if(seg[0]) hiTrans += seg[0]; });
                        if (hiTrans) {
                            const html = `<div style="font-size:16px; font-weight:400; margin-bottom:12px; color:#9aa0a6; line-height:1.4;">${phrase}</div><div style="font-size:22px; font-weight:400; color:#4caf50; line-height:1.5;">${hiTrans}</div>`;
                            dictCache[phrase] = html; showPopup(html);
                        } else showPopup(`<div style="font-size:20px; color:#f28b82;">Translation unavailable.</div>`);
                    }
                } catch (e) { showPopup(`<div style="font-size:20px; color:#f28b82;">Network Error</div>`); }
            }

            function showPopup(htmlContent) {
                popup.innerHTML = htmlContent; popup.style.display = 'block';
                setTimeout(() => popup.style.opacity = '1', 10);
                clearTimeout(hideTimeout);
                hideTimeout = setTimeout(() => { window.getSelection().removeAllRanges(); hidePopup(); }, 10000); 
            }
            function hidePopup() { popup.style.opacity = '0'; setTimeout(() => { popup.style.display = 'none'; }, 200); }
        }

        btn.addEventListener('click', async () => {
            if (btn.classList.contains('loading-drop')) return;
            
            // Trigger the fluid morph physics animation
            btn.classList.add('loading-drop');
            
            try {
                let targetUrl = window.location.href.split('?')[0];
                if (targetUrl.includes('thehindu.com') && targetUrl.endsWith('.ece')) targetUrl += '/amp/';

                const response = await fetch(targetUrl, { method: 'GET', credentials: 'omit' });
                if (!response.ok) throw new Error("Network request failed");
                
                const rawHtml = await response.text();
                const parser = new DOMParser();
                const doc = parser.parseFromString(rawHtml, 'text/html');

                const readabilityModule = await import('https://esm.sh/@mozilla/readability');
                const Readability = readabilityModule.Readability || readabilityModule.default;
                const article = new Readability(doc).parse();

                if (!article || !article.content) {
                    throw new Error("Engine could not extract the full text.");
                }

                let cleanContent = article.content;

                const amputationRegexes = [
                    /<[a-z0-9]+[^>]*>\s*This is a premium article, available exclusively to subscribers\.?[\s\S]*/i,
                    /<[a-z0-9]+[^>]*>\s*The Hindu delivers independent, credible journalism[\s\S]*/i,
                    /<(?:ul|ol)[^>]*>[\s\S]*?1\.\s*Home[\s\S]*?<\/(?:ul|ol)>/gi 
                ];
                amputationRegexes.forEach(regex => {
                    cleanContent = cleanContent.replace(regex, '');
                });

                const junkPatterns = [
                    /<[^>]+>\s*Advertisement\s*<\/[^>]+>/gi, /Advertisement/gi,
                    /Sign up for free and get curated news updates/gi, /\bLOG IN\b/gi,
                    /Support our reporting\.?/gi, /\bSUBSCRIBE NOW\b/gi,
                    /<[a-z0-9]+[^>]*>\s*Published\s*-.*?IST\s*<\/[a-z0-9]+>/gi,
                    
                    /<[a-z0-9]+[^>]*>\s*Updated\s*-.*?IST\s*<\/[a-z0-9]+>/gi,
                    /Updated\s*-\s*[A-Za-z]+\s*\d{1,2},\s*\d{4}\s*\d{1,2}:\d{2}\s*(am|pm)\s*IST/gi,
                    /<[a-z0-9]+[^>]*>\s*Subscribe to The Hindu @ Just.*?<\/[a-z0-9]+>/gi,
                    /<[a-z0-9]+[^>]*>\s*\*Offer only for new subscribers.*?<\/[a-z0-9]+>/gi,
                    /Subscribe to The Hindu @ Just ₹1\*/gi,
                    /\*Offer only for new subscribers/gi,
                    /<[a-z0-9]+[^>]*>\s*1\.\s*Home\s*<\/[a-z0-9]+>/gi,
                    /<[a-z0-9]+[^>]*>\s*2\.\s*(Opinion|News|Cities|States|India|World|Business|Sport|Entertainment)\s*<\/[a-z0-9]+>/gi,
                    /<[a-z0-9]+[^>]*>\s*3\.\s*(Editorial|Lead|Comment|Letters|Interview|Columns)\s*<\/[a-z0-9]+>/gi,
                    /1\.\s*Home/gi,
                    /2\.\s*(Opinion|News|Cities|States|India|World|Business|Sport|Entertainment)/gi,
                    /3\.\s*(Editorial|Lead|Comment|Letters|Interview|Columns)/gi
                ];
                junkPatterns.forEach(pattern => cleanContent = cleanContent.replace(pattern, ''));
                cleanContent = cleanContent.replace(/<p>\s*<\/p>/gi, '');

                const authorText = article.byline ? `${article.byline} | ` : 'Opinions | ';
                const siteNameText = article.siteName || 'The Hindu';
                const topDate = getFormattedDate();

                const premiumCss = `
                    @import url('https://fonts.googleapis.com/css2?family=Merriweather:ital,wght@0,300;0,400;0,700;1,300&display=swap');
                    html, body { background-color: #000000 !important; margin: 0 !important; padding: 0 !important; overflow-x: hidden !important; font-family: 'Merriweather', Georgia, serif !important; text-rendering: optimizeLegibility; -webkit-font-smoothing: antialiased; }
                    #amoled-reader { max-width: 650px; margin: 0 auto; padding: 40px 24px 120px 24px; }
                    .meta-top { text-align: center; font-family: system-ui, -apple-system, sans-serif; font-size: 12px; color: #666666; margin-bottom: 20px; }
                    .article-title { font-size: 32px; font-weight: 700; text-align: center; text-transform: uppercase; letter-spacing: 1px; color: #ececec; margin: 0 0 15px 0; line-height: 1.35; }
                    .meta-bottom { text-align: center; font-family: system-ui, -apple-system, sans-serif; font-size: 13px; color: #777777; margin-bottom: 45px; }
                    .article-content, .article-content p, .article-content *:not(img):not(video):not(canvas):not(svg):not(picture):not(h2):not(h3) { font-size: 19px !important; line-height: 1.75 !important; letter-spacing: 0.2px !important; color: #d4d4d4 !important; background-color: transparent !important; border: none !important; box-shadow: none !important; }
                    .article-content p { margin-bottom: 26px !important; }
                    .article-content h2, .article-content h3 { color: #ececec !important; margin: 40px 0 20px 0 !important; line-height: 1.4 !important; font-weight: 700 !important; background: transparent !important; }
                    .article-content h2 { font-size: 24px !important; } .article-content h3 { font-size: 20px !important; }
                    .article-content a { color: #8ab4f8 !important; text-decoration: none !important; border-bottom: 1px solid rgba(138, 180, 248, 0.4) !important; }
                    .article-content img, .article-content video, .article-content figure { max-width: 100% !important; height: auto !important; display: block !important; margin: 35px auto !important; border-radius: 4px; opacity: 0.85 !important; }
                    .article-content figcaption { text-align: center !important; font-family: system-ui, -apple-system, sans-serif !important; font-size: 13px !important; color: #666666 !important; margin-top: 10px !important; }
                    .article-content script, .article-content style, .article-content noscript, .article-content iframe { display: none !important; }
                `;

                // Fetch is complete. Fire the black screen splash shockwave.
                const splash = document.createElement('div');
                splash.className = 'amoled-splash';
                document.body.appendChild(splash);
                
                // Force a browser reflow to guarantee the transition starts
                void splash.offsetWidth;
                
                // Explode the black splash and vaporize the white droplet
                splash.classList.add('splash-active');
                btn.classList.add('vanish');

                // Wait 350ms for the pitch black liquid to fully ingest the screen before swapping the DOM
                setTimeout(() => {
                    document.open();
                    document.write(`<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${article.title}</title><style>${premiumCss}</style></head><body><div id="amoled-reader"><div class="meta-top">${topDate}</div><h1 class="article-title">${article.title}</h1><div class="meta-bottom">${authorText}${siteNameText}</div><div class="article-content">${cleanContent}</div></div></body></html>`);
                    document.close();
                    initDictionary();
                }, 350);

            } catch (err) {
                console.error("Bypass Error:", err);
                
                // Reverse the drop morph on failure and show error
                btn.classList.remove('loading-drop');
                btn.innerHTML = '✕'; 
                setTimeout(() => { btn.innerHTML = '☁'; }, 2000);
            }
        });
    };

    // Safely wait for the DOM to load before running the detection engine
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            if (isArticlePage()) initUI();
        });
    } else {
        if (isArticlePage()) initUI();
    }

})();
