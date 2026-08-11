// ==UserScript==
// @name         Touch to Search
// @namespace    http://tampermonkey.net/
// @version      3.0
// @description  AMOLED glass sheet. Reverted to pure, instant iframe. Uses Google Web Mode (udm=14) and no-personalization (pws=0) to bypass login captchas.
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// @grant        GM.xmlHttpRequest
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // 1. Host Element & Shadow DOM Safe Mounting
    const host = document.createElement('div');
    host.id = 'touch-search-host';
    host.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100vh; 
        height: 100dvh; 
        z-index: 2147483647;
        pointer-events: none;
        display: flex;
        flex-direction: column;
        justify-content: flex-end; 
    `;

    function mountHost() {
        const target = document.body || document.documentElement;
        if (target && !document.getElementById('touch-search-host')) {
            target.appendChild(host);
        }
    }
    mountHost();
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mountHost, { capture: true, once: true });
    }

    const shadow = host.attachShadow({mode: 'closed'});

    // 2. Encapsulated Styles
    const style = document.createElement('style');
    style.textContent = `
        #panel {
            background: rgba(5, 5, 5, 0.75); 
            backdrop-filter: blur(24px) saturate(180%);
            -webkit-backdrop-filter: blur(24px) saturate(180%);
            border-top: 1px solid rgba(255, 255, 255, 0.15); 
            border-left: 1px solid rgba(255, 255, 255, 0.05);
            border-right: 1px solid rgba(255, 255, 255, 0.05);
            box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.8);
            
            color: #ffffff;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            border-radius: 24px 24px 0 0;
            transform: translateY(150%);
            transition: transform 0.35s cubic-bezier(0.1, 0.9, 0.2, 1), height 0.35s cubic-bezier(0.1, 0.9, 0.2, 1);
            display: flex;
            flex-direction: column;
            user-select: none;
            pointer-events: auto;
            height: auto;
            max-height: 50dvh; 
            overflow: hidden;
            margin: 0; 
            position: relative;
            z-index: 1;
        }
        #panel.open {
            transform: translateY(0);
        }
        #panel.expanded {
            height: 50dvh; 
            background: rgba(0, 0, 0, 0.9); 
        }
        .drag-area {
            width: 100%;
            padding: 16px 0;
            display: flex;
            justify-content: center;
            cursor: pointer;
            flex-shrink: 0;
        }
        .pull-pill {
            width: 40px;
            height: 5px;
            background: rgba(255, 255, 255, 0.3);
            border-radius: 3px;
        }
        #summary-content {
            display: flex;
            align-items: flex-start;
            gap: 16px;
            padding: 0 20px 20px 20px;
            cursor: pointer;
        }
        #panel.expanded #summary-content {
            display: none;
        }
        .icon {
            width: 46px;
            height: 46px;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.1); 
            border: 1px solid rgba(255, 255, 255, 0.1);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
            color: white;
            flex-shrink: 0;
            overflow: hidden;
            margin-top: 2px;
            position: relative;
        }
        .icon img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        .text-container {
            display: flex;
            flex-direction: column;
            overflow: hidden;
            text-shadow: 0 1px 3px rgba(0,0,0,0.5); 
        }
        .title {
            font-size: 19px;
            font-weight: 500;
            margin-bottom: 4px;
            line-height: 1.2;
            letter-spacing: 0.3px;
        }
        .subtitle {
            font-size: 14px;
            color: rgba(255, 255, 255, 0.7);
            line-height: 1.4;
            display: -webkit-box;
            -webkit-line-clamp: 3;
            -webkit-box-orient: vertical;
            overflow: hidden;
        }
        #expanded-content {
            display: none;
            width: 100%;
            height: 100%;
            flex-direction: column;
            background: #202124; 
        }
        #panel.expanded #expanded-content {
            display: flex;
        }
        iframe {
            width: 100%;
            height: 100%;
            border: none;
            flex-grow: 1;
        }

        /* Lightbox Styles */
        #lightbox {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.6);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            z-index: 10;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.3s ease;
        }
        #lightbox.show {
            opacity: 1;
            pointer-events: auto;
        }
        #lightbox img {
            max-width: 90%;
            max-height: 85%;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.8);
            transform: scale(0.9);
            transition: transform 0.3s cubic-bezier(0.1, 0.9, 0.2, 1);
            object-fit: contain;
        }
        #lightbox.show img {
            transform: scale(1);
        }
    `;
    shadow.appendChild(style);

    // 3. Create UI Panel & Lightbox
    const panel = document.createElement('div');
    panel.id = 'panel';
    panel.innerHTML = `
        <div class="drag-area" id="drag-area">
            <div class="pull-pill"></div>
        </div>
        <div id="summary-content">
            <div class="icon" id="ts-icon">🔍</div>
            <div class="text-container">
                <div class="title" id="ts-title">Search</div>
                <div class="subtitle" id="ts-subtitle">Select text to look up</div>
            </div>
        </div>
        <div id="expanded-content">
            <iframe id="ts-iframe" src="" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>
        </div>
    `;
    shadow.appendChild(panel);

    const lightbox = document.createElement('div');
    lightbox.id = 'lightbox';
    lightbox.innerHTML = `<img id="lightbox-img" src="">`;
    shadow.appendChild(lightbox);

    const titleEl = shadow.getElementById('ts-title');
    const subtitleEl = shadow.getElementById('ts-subtitle');
    const iconEl = shadow.getElementById('ts-icon');
    const summaryContent = shadow.getElementById('summary-content');
    const iframeEl = shadow.getElementById('ts-iframe');
    const dragArea = shadow.getElementById('drag-area');
    const lightboxImg = shadow.getElementById('lightbox-img');

    let activeSelection = "";
    let activeHighResImage = "";
    let hideTimeout;

    // 4. API Fetching for the Summary (Wiki/Dict)
    function gmFetchJson(url) {
        return new Promise((resolve, reject) => {
            const gmRequest = (typeof GM_xmlhttpRequest !== 'undefined') ? GM_xmlhttpRequest :
                              (typeof GM !== 'undefined' && GM.xmlHttpRequest) ? GM.xmlHttpRequest : null;
            if (gmRequest) {
                gmRequest({
                    method: 'GET',
                    url: url,
                    headers: { 'Accept': 'application/json' },
                    onload: (res) => {
                        if (res.status >= 200 && res.status < 300) {
                            try { resolve(JSON.parse(res.responseText)); } catch(e) { reject(e); }
                        } else {
                            reject(new Error(`HTTP ${res.status}`));
                        }
                    },
                    onerror: (err) => reject(err),
                    ontimeout: () => reject(new Error('Timeout'))
                });
            } else {
                fetch(url).then(res => res.json()).then(resolve).catch(reject);
            }
        });
    }

    // 5. Panel Controls
    function showPanel(title, subtitle, iconContent, isImage = false, highResUrl = "") {
        titleEl.textContent = title;
        subtitleEl.textContent = subtitle;
        activeHighResImage = highResUrl || iconContent; 
        
        if (isImage) {
            iconEl.innerHTML = `<img src="${iconContent}" alt="thumbnail">`;
            iconEl.style.background = 'transparent';
        } else {
            iconEl.innerHTML = iconContent;
            activeHighResImage = ""; 
        }
        panel.classList.add('open');
    }

    function collapsePanel() {
        panel.classList.remove('expanded');
        setTimeout(() => { iframeEl.src = ""; }, 350); 
    }

    function hidePanel() {
        panel.classList.remove('open');
        lightbox.classList.remove('show');
        collapsePanel();
    }

    // 6. Processing Selection
    async function processSelection() {
        const sel = window.getSelection();
        const rawText = sel ? sel.toString().trim() : "";
        const text = rawText.replace(/\s+/g, ' ');
        
        if (!text || text === activeSelection || text.length > 80) {
            if (!text && !panel.classList.contains('expanded') && !lightbox.classList.contains('show')) {
                hidePanel();
                activeSelection = "";
            }
            return;
        }
        
        activeSelection = text;
        collapsePanel(); 
        showPanel(text, 'Looking up...', '🔍');

        const isSingleWord = !text.includes(' ') && /^[a-zA-Z\u00C0-\u024F]+$/.test(text);

        if (isSingleWord) {
            try {
                const data = await gmFetchJson(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(text.toLowerCase())}`);
                if (Array.isArray(data) && data.length > 0) {
                    const entry = data[0];
                    const phonetic = entry.phonetic || (entry.phonetics && entry.phonetics.find(p => p.text) || {}).text || '';
                    const meaning = entry.meanings && entry.meanings[0];
                    if (meaning && meaning.definitions && meaning.definitions[0]) {
                        const def = meaning.definitions[0].definition;
                        showPanel(`${entry.word} ${phonetic}`, `${meaning.partOfSpeech} · ${def}`, '📖');
                        return;
                    }
                }
            } catch(e) {} 
        }

        try {
            const data = await gmFetchJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(text)}`);
            if (data && data.type !== 'disambiguation' && data.title) {
                const desc = data.description || data.extract;
                if (desc) {
                    if (data.thumbnail && data.thumbnail.source) {
                        const highRes = (data.originalimage && data.originalimage.source) ? data.originalimage.source : data.thumbnail.source;
                        showPanel(data.title, desc, data.thumbnail.source, true, highRes);
                    } else {
                        showPanel(data.title, desc, '🌐');
                    }
                    return;
                }
            }
        } catch(e) {}

        showPanel(text, 'Tap to search Google', '🔍');
    }

    // 7. Event Listeners using Capture Phase
    document.addEventListener('selectionchange', () => {
        clearTimeout(hideTimeout);
        hideTimeout = setTimeout(() => {
            const selText = window.getSelection().toString().trim();
            if (selText) {
                processSelection();
            } else {
                if (!panel.classList.contains('expanded') && !lightbox.classList.contains('show')) {
                    hidePanel();
                    activeSelection = "";
                }
            }
        }, 300); 
    }, true);

    const handleSelectionRelease = () => {
        setTimeout(() => {
            const selText = window.getSelection().toString().trim();
            if (selText && selText !== activeSelection) {
                processSelection();
            }
        }, 100);
    };
    document.addEventListener('mouseup', handleSelectionRelease, true);
    document.addEventListener('touchend', handleSelectionRelease, true);

    const closeOnEmpty = (e) => {
        if (lightbox.classList.contains('show')) return; 

        const path = e.composedPath ? e.composedPath() : [];
        if (panel.classList.contains('expanded') && path.includes(panel)) return;
        if (path.includes(host)) return;

        const currentSel = window.getSelection().toString().trim();
        if (currentSel === "" && !panel.classList.contains('expanded')) {
            hidePanel();
            activeSelection = "";
        } else if (panel.classList.contains('expanded') && !path.includes(panel)) {
            hidePanel();
            activeSelection = "";
        }
    };
    document.addEventListener('mousedown', closeOnEmpty, true);
    document.addEventListener('touchstart', closeOnEmpty, { passive: true, capture: true });

    let lastScrollY = window.scrollY;
    window.addEventListener('scroll', () => {
        if (panel.classList.contains('open') && Math.abs(window.scrollY - lastScrollY) > 20) {
            hidePanel();
            activeSelection = "";
            window.getSelection().removeAllRanges(); 
        }
        lastScrollY = window.scrollY;
    }, { passive: true, capture: true });
    
    // 8. THE FIX: Reverted to pure iframe load.
    // &igu=1 allows it to be embedded.
    // &pws=0 simulates a logged-out, non-personalized session.
    // &udm=14 strips the AI/bloat scripts that Google's bot-detection flags.
    summaryContent.addEventListener('click', () => {
         if (activeSelection) {
             panel.classList.add('expanded');
             iframeEl.src = `https://www.google.com/search?q=${encodeURIComponent(activeSelection)}&igu=1&pws=0&udm=14`;
             window.getSelection().removeAllRanges(); 
         }
    });

    // 9. Lightbox & Drag Area Logic
    iconEl.addEventListener('click', (e) => {
        const img = iconEl.querySelector('img');
        if (img && activeHighResImage) {
            e.stopPropagation();
            lightboxImg.src = activeHighResImage;
            lightbox.classList.add('show');
            window.getSelection().removeAllRanges();
        }
    });

    lightbox.addEventListener('click', (e) => {
        e.stopPropagation();
        lightbox.classList.remove('show');
        if (window.getSelection().toString().trim() === "") {
            hidePanel();
            activeSelection = "";
        }
    });
    
    lightbox.addEventListener('mousedown', e => e.stopPropagation());
    lightbox.addEventListener('touchstart', e => e.stopPropagation(), {passive: true});

    dragArea.addEventListener('click', (e) => {
        if (panel.classList.contains('expanded')) {
            e.stopPropagation(); 
            collapsePanel();
        }
    });

})();
