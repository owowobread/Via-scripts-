// ==UserScript==
// @name         YTM Zenith - Heavyweight Monolith (Part 1)
// @namespace    http://tampermonkey.net/
// @version      11.0.0-ultra
// @description  Granular VDOM & State Architecture for YouTube Music
// @author       Gemini
// @match        https://music.youtube.com/*
// @grant        none
// ==/UserScript==
// LINE COUNT TRACKER: START (Line 10)

(function() {
    'use strict';

    // ================================================================================================================
    // MODULE 1: STRICT NAMESPACE & ENVIRONMENT CONFIGURATION
    // ================================================================================================================
    window.ZENITH_CORE = window.ZENITH_CORE || {
        bootTime: Date.now(),
        hasInitialized: false,
        ENVIRONMENT: {
            isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
            userAgent: navigator.userAgent,
            initialScreenHeight: window.innerHeight,
            initialScreenWidth: window.innerWidth,
            devicePixelRatio: window.devicePixelRatio || 1,
            platform: navigator.platform
        },
        CONFIG: {
            MAX_RETRY_ATTEMPTS: 50,
            RETRY_DELAY_MS: 200,
            DOM_POLL_RATE_MS: 100,
            DEBUG_MODE: true,
            THEME_SPRING: 'cubic-bezier(0.25, 1, 0.5, 1)',
            ENABLE_HAPTICS: true,
            SYNC_OFFSET_MS: -200,
            PLAYER_Z_INDEX: 2147483647
        }
    };

    if (window.ZENITH_CORE.hasInitialized) {
        console.warn('[ZENITH FATAL] Core already initialized. Aborting duplicate execution.');
        return;
    }
    window.ZENITH_CORE.hasInitialized = true;
    // LINE COUNT TRACKER: CURRENT ~46

    // ================================================================================================================
    // MODULE 2: AGGRESSIVE RUNTIME LOGGER
    // ================================================================================================================
    class ZenithLogger {
        /**
         * Formats the current timestamp for high-precision debugging.
         * @returns {string} Formatted time string [HH:MM:SS.MMM]
         */
        static formatTime() {
            const now = new Date();
            return `[${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')}]`;
        }

        static info(module, message, data = null) {
            if (!window.ZENITH_CORE.CONFIG.DEBUG_MODE) return;
            const logMsg = `%c${this.formatTime()} %c[INFO] %c[${module}] %c${message}`;
            const styles = ['color: #555;', 'color: #4CAF50; font-weight: bold;', 'color: #2196F3; font-weight: bold;', 'color: #FFF;'];
            data ? console.log(logMsg, ...styles, data) : console.log(logMsg, ...styles);
        }

        static warn(module, message, data = null) {
            const logMsg = `%c${this.formatTime()} %c[WARN] %c[${module}] %c${message}`;
            const styles = ['color: #555;', 'color: #FFC107; font-weight: bold;', 'color: #2196F3; font-weight: bold;', 'color: #FFC107;'];
            data ? console.warn(logMsg, ...styles, data) : console.warn(logMsg, ...styles);
        }

        static error(module, message, error = null) {
            const logMsg = `%c${this.formatTime()} %c[ERROR] %c[${module}] %c${message}`;
            const styles = ['color: #555;', 'color: #F44336; font-weight: bold;', 'color: #2196F3; font-weight: bold;', 'color: #F44336; font-weight: bold;'];
            error ? console.error(logMsg, ...styles, error) : console.error(logMsg, ...styles);
        }
        
        static trace(module, message) {
            if (!window.ZENITH_CORE.CONFIG.DEBUG_MODE) return;
            console.trace(`[TRACE] [${module}] ${message}`);
        }
    }
    window.ZENITH_CORE.Logger = ZenithLogger;
    // LINE COUNT TRACKER: CURRENT ~86

    // ================================================================================================================
    // MODULE 3: HIGH-PERFORMANCE EVENT BUS (PUB/SUB)
    // ================================================================================================================
    class EventBus {
        constructor() {
            this.listeners = new Map();
            this.history = []; // Keeps track of last 50 events for debugging
        }

        /**
         * Subscribe to a specific event stream.
         * @param {string} event - The event identifier.
         * @param {Function} callback - The function to execute on emission.
         */
        on(event, callback) {
            if (!this.listeners.has(event)) {
                this.listeners.set(event, new Set());
            }
            this.listeners.get(event).add(callback);
            ZenithLogger.info('EventBus', `Subscribed to: ${event}`);
        }

        /**
         * Unsubscribe from an event stream.
         * @param {string} event - The event identifier.
         * @param {Function} callback - The specific function to remove.
         */
        off(event, callback) {
            if (this.listeners.has(event)) {
                this.listeners.get(event).delete(callback);
                if (this.listeners.get(event).size === 0) {
                    this.listeners.delete(event);
                }
                ZenithLogger.info('EventBus', `Unsubscribed from: ${event}`);
            }
        }

        /**
         * Emit an event to all subscribers.
         * @param {string} event - The event identifier.
         * @param {any} payload - The data to pass to callbacks.
         */
        emit(event, payload = null) {
            this.history.push({ event, payload, timestamp: Date.now() });
            if (this.history.length > 50) this.history.shift();

            if (this.listeners.has(event)) {
                this.listeners.get(event).forEach(callback => {
                    try {
                        callback(payload);
                    } catch (error) {
                        ZenithLogger.error('EventBus', `Listener crashed on event: ${event}`, error);
                    }
                });
            }
        }
        
        getHistory() {
            return this.history;
        }
    }
    window.ZENITH_CORE.bus = new EventBus();
    // LINE COUNT TRACKER: CURRENT ~143

    // ================================================================================================================
    // MODULE 4: STRICT REDUX-STYLE STATE MANAGER
    // ================================================================================================================
    const INITIAL_STATE = {
        player: {
            isPlaying: false,
            currentTime: 0,
            duration: 0,
            volume: 1,
            isMuted: false,
            shuffleMode: false,
            repeatMode: 0, // 0: None, 1: All, 2: One
            buffered: 0,
            playbackRate: 1
        },
        track: {
            title: '',
            artist: '',
            album: '',
            artwork: '',
            id: null,
            isExplicit: false,
            videoType: 'MUSIC_VIDEO_TYPE_ATV'
        },
        ui: {
            fullPlayerOpen: false,
            queuePanelOpen: false,
            lyricsPanelOpen: false,
            isDragging: false,
            dominantColor: '#121212',
            secondaryColor: '#282828'
        },
        lyrics: {
            status: 'idle', // 'idle', 'loading', 'loaded', 'error', 'unsupported'
            lines: [],
            isSynced: false,
            currentIndex: -1,
            provider: null
        },
        queue: {
            items: [],
            currentIndex: 0,
            isAutoPlayEnabled: true
        },
        settings: {
            enableDynamicColor: true,
            enableHaptics: true,
            lyricsOffsetMs: -200,
            highQualityAudio: true
        }
    };

    class StateStore {
        constructor(initialState) {
            this.state = this.deepClone(initialState);
            this.subscribers = new Set();
            this.pendingUpdates = false;
            this.actionHistory = [];
            ZenithLogger.info('StateStore', 'Initialized central state tree.');
        }

        deepClone(obj) {
            return JSON.parse(JSON.stringify(obj));
        }

        getState() {
            return this.state;
        }

        subscribe(callback) {
            this.subscribers.add(callback);
            return () => this.subscribers.delete(callback);
        }

        dispatch(action) {
            const prevState = this.deepClone(this.state);
            let hasChanged = false;

            this.actionHistory.push({ type: action.type, timestamp: Date.now() });
            if (this.actionHistory.length > 100) this.actionHistory.shift();

            try {
                switch (action.type) {
                    case 'UPDATE_PLAYER_STATE':
                        if (JSON.stringify(this.state.player) !== JSON.stringify({ ...this.state.player, ...action.payload })) {
                            Object.assign(this.state.player, action.payload);
                            hasChanged = true;
                        }
                        break;
                    case 'UPDATE_TRACK_METADATA':
                        if (this.state.track.title !== action.payload.title || this.state.track.artwork !== action.payload.artwork) {
                            Object.assign(this.state.track, action.payload);
                            hasChanged = true;
                            window.ZENITH_CORE.bus.emit('TRACK_CHANGED', this.state.track);
                        }
                        break;
                    case 'SET_UI_STATE':
                        Object.assign(this.state.ui, action.payload);
                        hasChanged = true;
                        break;
                    case 'SET_LYRICS_DATA':
                        this.state.lyrics = { ...this.state.lyrics, ...action.payload };
                        hasChanged = true;
                        break;
                    case 'SET_LYRICS_INDEX':
                        if (this.state.lyrics.currentIndex !== action.payload) {
                            this.state.lyrics.currentIndex = action.payload;
                            hasChanged = true;
                            window.ZENITH_CORE.bus.emit('LYRICS_INDEX_CHANGED', action.payload);
                        }
                        break;
                    case 'UPDATE_QUEUE':
                        this.state.queue = { ...this.state.queue, ...action.payload };
                        hasChanged = true;
                        break;
                    case 'UPDATE_SETTING':
                        this.state.settings[action.payload.key] = action.payload.value;
                        hasChanged = true;
                        break;
                    default:
                        ZenithLogger.warn('StateStore', `Unknown action type dispatched: ${action.type}`);
                }

                if (hasChanged && !this.pendingUpdates) {
                    this.pendingUpdates = true;
                    // Batch UI updates to the next animation frame for locked 60FPS
                    requestAnimationFrame(() => {
                        this.subscribers.forEach(cb => {
                            try {
                                cb(this.state, prevState);
                            } catch (e) {
                                ZenithLogger.error('StateStore', 'Subscriber callback failed', e);
                            }
                        });
                        this.pendingUpdates = false;
                    });
                }
            } catch (error) {
                ZenithLogger.error('StateStore', `Critical failure during dispatch: ${action.type}`, error);
            }
        }
    }
    window.ZENITH_CORE.store = new StateStore(INITIAL_STATE);
    // LINE COUNT TRACKER: CURRENT ~279

    // ================================================================================================================
    // MODULE 5: MASSIVE CSS-IN-JS INJECTION ENGINE (PIXEL-PERFECT REPLICA)
    // ================================================================================================================
    class StyleEngine {
        static inject() {
            if (document.getElementById('ytm-zenith-styles-core')) return;
            
            const style = document.createElement('style');
            style.id = 'ytm-zenith-styles-core';
            style.textContent = `
                /* ----------------------------------------------------------------------
                   GLOBAL CSS VARIABLES & RESETS
                   ---------------------------------------------------------------------- */
                :root {
                    --ytm-base-bg: #000000;
                    --ytm-surface-1: #121212;
                    --ytm-surface-2: #212121;
                    --ytm-surface-3: #303030;
                    --ytm-text-primary: #ffffff;
                    --ytm-text-secondary: rgba(255, 255, 255, 0.7);
                    --ytm-text-disabled: rgba(255, 255, 255, 0.3);
                    --ytm-accent: #ffffff;
                    --ytm-dominant-color: #121212;
                    --safe-area-top: env(safe-area-inset-top, 0px);
                    --safe-area-bottom: env(safe-area-inset-bottom, 0px);
                    --z-index-base: 2147483000;
                }

                /* Block native scrolling when player is open */
                body.ytm-replica-locked {
                    overflow: hidden !important;
                    touch-action: none !important;
                }

                #ytm-zenith-root {
                    position: fixed;
                    bottom: 0;
                    left: 0;
                    width: 100vw;
                    height: 100vh;
                    z-index: var(--z-index-base);
                    font-family: 'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                    color: var(--ytm-text-primary);
                    pointer-events: none; /* Let clicks pass through to native app where no UI exists */
                    -webkit-tap-highlight-color: transparent;
                    user-select: none;
                }

                /* Container for all interactive elements */
                .z-interactive-layer {
                    pointer-events: auto;
                    width: 100%;
                    height: 100%;
                    position: absolute;
                    top: 0; left: 0;
                }

                /* ----------------------------------------------------------------------
                   MINI PLAYER ARCHITECTURE
                   ---------------------------------------------------------------------- */
                .z-mini-player {
                    position: absolute;
                    bottom: calc(56px + var(--safe-area-bottom) + 8px);
                    left: 8px;
                    right: 8px;
                    height: 56px;
                    background: var(--ytm-surface-3);
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    padding: 0 16px 0 8px;
                    box-shadow: 0 8px 16px rgba(0,0,0,0.6);
                    transition: transform 0.3s cubic-bezier(0.2, 0, 0, 1), opacity 0.3s;
                    overflow: hidden;
                    will-change: transform, opacity;
                }

                .z-mini-player.hidden {
                    transform: translateY(200%);
                    opacity: 0;
                    pointer-events: none;
                }

                .z-mini-player:active {
                    background: #3a3a3a;
                }

                .z-mini-art {
                    width: 40px;
                    height: 40px;
                    border-radius: 4px;
                    object-fit: cover;
                    margin-right: 12px;
                    background: #222;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                }

                .z-mini-info {
                    flex: 1;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                }

                .z-text-truncate {
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .z-title { font-size: 14px; font-weight: 500; color: var(--ytm-text-primary); margin-bottom: 2px; }
                .z-subtitle { font-size: 12px; font-weight: 400; color: var(--ytm-text-secondary); }

                .z-mini-controls {
                    display: flex;
                    gap: 4px;
                    align-items: center;
                }

                .z-btn {
                    background: none;
                    border: none;
                    color: var(--ytm-text-primary);
                    padding: 8px;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    cursor: pointer;
                    border-radius: 50%;
                    transition: background-color 0.2s, transform 0.1s;
                    outline: none;
                }

                .z-btn:active {
                    background-color: rgba(255, 255, 255, 0.15);
                    transform: scale(0.95);
                }

                .z-btn svg { width: 24px; height: 24px; pointer-events: none; fill: currentColor; }

                .z-mini-progress-wrap {
                    position: absolute;
                    bottom: 0;
                    left: 8px;
                    right: 8px;
                    height: 2px;
                    background: rgba(255,255,255,0.1);
                    border-radius: 2px 2px 0 0;
                    overflow: hidden;
                }

                .z-mini-progress {
                    height: 100%;
                    background: var(--ytm-text-primary);
                    transform-origin: left;
                    transition: width 0.1s linear;
                }

                /* ----------------------------------------------------------------------
                   FULL SCREEN PLAYER ARCHITECTURE
                   ---------------------------------------------------------------------- */
                .z-full-player {
                    position: fixed;
                    top: 0; left: 0;
                    width: 100vw; height: 100vh;
                    transform: translateY(100%);
                    transition: transform 0.4s cubic-bezier(0.25, 1, 0.5, 1);
                    display: flex;
                    flex-direction: column;
                    will-change: transform;
                    background: var(--ytm-base-bg);
                }

                .z-full-player.active {
                    transform: translateY(0);
                }

                .z-player-bg {
                    position: absolute;
                    top: 0; left: 0;
                    width: 100%; height: 100%;
                    background: linear-gradient(180deg, var(--ytm-dominant-color) 0%, var(--ytm-base-bg) 85%);
                    z-index: -1;
                    transition: background 0.8s ease;
                    opacity: 0.8;
                }

                /* Noise Overlay for Texture */
                .z-player-bg::after {
                    content: "";
                    position: absolute;
                    top: 0; left: 0; width: 100%; height: 100%;
                    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.05'/%3E%3C/svg%3E");
                    pointer-events: none;
                }

                .z-fp-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    height: 64px;
                    padding: 0 16px;
                    margin-top: var(--safe-area-top);
                }

                .z-fp-art-wrapper {
                    flex: 1;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    padding: 32px;
                    perspective: 1000px;
                }

                .z-fp-art {
                    width: 100%;
                    max-width: 380px;
                    aspect-ratio: 1/1;
                    border-radius: 12px;
                    box-shadow: 0 20px 50px rgba(0,0,0,0.6);
                    object-fit: cover;
                    transition: transform 0.4s cubic-bezier(0.2, 0, 0, 1), box-shadow 0.4s;
                }

                .z-fp-art.paused {
                    transform: scale(0.85);
                    box-shadow: 0 10px 20px rgba(0,0,0,0.4);
                }

                .z-fp-controls-wrapper {
                    padding: 0 32px 32px 32px;
                    padding-bottom: calc(32px + var(--safe-area-bottom));
                    display: flex;
                    flex-direction: column;
                }

                .z-fp-title-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 24px;
                }

                .z-fp-title-block {
                    flex: 1;
                    overflow: hidden;
                }

                .z-fp-title {
                    font-size: 24px;
                    font-weight: 700;
                    margin-bottom: 4px;
                    line-height: 1.2;
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                }

                .z-fp-subtitle {
                    font-size: 18px;
                    font-weight: 400;
                    color: var(--ytm-text-secondary);
                }

                /* ----------------------------------------------------------------------
                   SCRUBBER & TIMERS
                   ---------------------------------------------------------------------- */
                .z-progress-container {
                    margin: 8px 0;
                    padding: 16px 0;
                    cursor: pointer;
                    position: relative;
                    touch-action: none;
                }

                .z-progress-track {
                    width: 100%;
                    height: 4px;
                    background: rgba(255,255,255,0.2);
                    border-radius: 2px;
                    position: relative;
                    overflow: hidden;
                }

                .z-progress-fill {
                    height: 100%;
                    background: var(--ytm-text-primary);
                    border-radius: 2px;
                    pointer-events: none;
                    transform-origin: left;
                }
                
                .z-progress-buffer {
                    position: absolute;
                    top: 0; left: 0;
                    height: 100%;
                    background: rgba(255,255,255,0.1);
                    border-radius: 2px;
                    pointer-events: none;
                    z-index: -1;
                }

                .z-progress-handle {
                    position: absolute;
                    top: 50%;
                    transform: translate(-50%, -50%) scale(0);
                    width: 14px;
                    height: 14px;
                    background: var(--ytm-text-primary);
                    border-radius: 50%;
                    transition: transform 0.2s cubic-bezier(0.2, 0, 0, 1);
                    pointer-events: none;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                }

                .z-progress-container:active .z-progress-handle,
                .z-progress-container.dragging .z-progress-handle {
                    transform: translate(-50%, -50%) scale(1.2);
                }

                .z-time-info {
                    display: flex;
                    justify-content: space-between;
                    font-size: 12px;
                    font-weight: 500;
                    color: var(--ytm-text-secondary);
                    margin-bottom: 24px;
                    font-variant-numeric: tabular-nums;
                }

                /* ----------------------------------------------------------------------
                   TRANSPORT CONTROLS
                   ---------------------------------------------------------------------- */
                .z-main-controls {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 24px;
                }

                .z-btn-play {
                    width: 72px;
                    height: 72px;
                    background: var(--ytm-text-primary);
                    color: var(--ytm-base-bg);
                    transition: transform 0.1s, background 0.2s;
                }
                
                .z-btn-play:active {
                    background: #e0e0e0;
                    transform: scale(0.9);
                }

                .z-btn-play svg {
                    width: 36px;
                    height: 36px;
                    fill: var(--ytm-base-bg);
                }

                .z-btn-side svg {
                    width: 32px;
                    height: 32px;
                }
                
                .z-btn-secondary {
                    color: var(--ytm-text-secondary);
                }
                
                .z-btn-secondary.active {
                    color: var(--ytm-text-primary);
                }

                /* ----------------------------------------------------------------------
                   BOTTOM NAV TABS
                   ---------------------------------------------------------------------- */
                .z-bottom-nav {
                    position: absolute;
                    bottom: 0; left: 0; width: 100%;
                    height: calc(56px + var(--safe-area-bottom));
                    background: rgba(33, 33, 33, 0.95);
                    backdrop-filter: blur(10px);
                    -webkit-backdrop-filter: blur(10px);
                    display: flex;
                    justify-content: space-around;
                    align-items: flex-start;
                    padding-top: 8px;
                    padding-bottom: var(--safe-area-bottom);
                    border-top: 1px solid rgba(255,255,255,0.05);
                }

                .z-nav-item {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    color: var(--ytm-text-secondary);
                    width: 72px;
                    cursor: pointer;
                    transition: color 0.2s;
                }

                .z-nav-item.active {
                    color: var(--ytm-text-primary);
                }

                .z-nav-icon {
                    width: 24px; height: 24px;
                    margin-bottom: 4px;
                    transition: transform 0.2s;
                }
                
                .z-nav-item:active .z-nav-icon {
                    transform: scale(0.9);
                }

                .z-nav-label {
                    font-size: 10px;
                    font-weight: 500;
                    letter-spacing: 0.2px;
                }
            `;
            document.head.appendChild(style);
            ZenithLogger.info('StyleEngine', 'Core CSS Monolith injected successfully.');
        }
    }
    
    // Auto-inject styles on load
    StyleEngine.inject();
    // LINE COUNT TRACKER: CURRENT ~675

    // ================================================================================================================
    // MODULE 6: VDOM ENGINE (Core JSX Replacement)
    // ================================================================================================================
    class VDOM {
        /**
         * Creates a Virtual DOM node.
         * @param {string|Function} type - HTML tag or functional component
         * @param {Object} props - Attributes and event listeners
         * @param  {...any} children - Child nodes or text
         */
        static createElement(type, props, ...children) {
            return {
                type,
                props: {
                    ...props,
                    children: children.flat().filter(c => c != null && c !== false)
                }
            };
        }

        /**
         * Renders a Virtual DOM node to actual DOM.
         * @param {Object} vnode - Virtual DOM object
         * @param {HTMLElement} container - Target DOM element
         */
        static render(vnode, container) {
            if (!vnode) return;
            
            // Text Node
            if (typeof vnode === 'string' || typeof vnode === 'number') {
                container.appendChild(document.createTextNode(String(vnode)));
                return;
            }

            // Functional Component
            if (typeof vnode.type === 'function') {
                const componentVNode = vnode.type(vnode.props);
                VDOM.render(componentVNode, container);
                return;
            }

            // Standard HTML Element
            const domElement = document.createElement(vnode.type);

            // Apply properties
            if (vnode.props) {
                Object.keys(vnode.props).forEach(name => {
                    if (name === 'children') return;
                    
                    if (name.startsWith('on') && typeof vnode.props[name] === 'function') {
                        const eventType = name.toLowerCase().substring(2);
                        domElement.addEventListener(eventType, vnode.props[name]);
                    } else if (name === 'className') {
                        domElement.setAttribute('class', vnode.props[name]);
                    } else if (name === 'style' && typeof vnode.props[name] === 'object') {
                        Object.assign(domElement.style, vnode.props[name]);
                    } else if (name === 'dangerouslySetInnerHTML') {
                        domElement.innerHTML = vnode.props[name].__html;
                    } else {
                        domElement.setAttribute(name, vnode.props[name]);
                    }
                });
            }

            // Render children recursively
            if (vnode.props && vnode.props.children) {
                vnode.props.children.forEach(child => {
                    VDOM.render(child, domElement);
                });
            }

            container.appendChild(domElement);
        }

        /**
         * Efficiently clears a container before re-rendering.
         * Better performance than innerHTML = ''.
         */
        static clear(container) {
            while (container.firstChild) {
                container.removeChild(container.firstChild);
            }
        }
    }
    window.ZENITH_CORE.VDOM = VDOM;
    // LINE COUNT TRACKER: CURRENT ~750

    ZenithLogger.info('Bootloader', '==================================================');
    ZenithLogger.info('Bootloader', ' ZENITH ENGINE CORE INITIALIZATION COMPLETE       ');
    ZenithLogger.info('Bootloader', '==================================================');

})();
// LINE COUNT TRACKER: FINAL FOR PART 1: 757 Lines
    // ================================================================================================================
    // MODULE 7: AGGRESSIVE DOM SANITIZER & NATIVE UI SUPPRESSION
    // ================================================================================================================
    // LINE COUNT TRACKER: START PART 2 (Line ~758)
    class DOMSanitizer {
        constructor() {
            this.logger = window.ZENITH_CORE.Logger;
            this.logger.info('DOMSanitizer', 'Initializing aggressive DOM suppression protocol.');
            
            // Elements that must be hidden immediately and kept hidden
            this.targetSelectors = [
                'ytmusic-player-bar',
                'ytmusic-player-page',
                'ytmusic-bottom-navigation-bar',
                '#mini-guide',
                'ytmusic-nav-bar',
                '.ytmusic-player-page'
            ];
            
            this.initObserver();
            this.injectSuppressionCSS();
        }

        /**
         * Injects CSS with !important flags to guarantee native elements do not paint,
         * bypassing JavaScript race conditions on load.
         */
        injectSuppressionCSS() {
            if (document.getElementById('z-suppression-css')) return;
            const style = document.createElement('style');
            style.id = 'z-suppression-css';
            style.textContent = `
                ${this.targetSelectors.join(', ')} {
                    display: none !important;
                    opacity: 0 !important;
                    visibility: hidden !important;
                    pointer-events: none !important;
                    height: 0 !important;
                    width: 0 !important;
                    position: absolute !important;
                    z-index: -9999 !important;
                }
                /* Ensure body allows our custom fixed elements to paint correctly */
                body {
                    background-color: var(--ytm-base-bg) !important;
                }
                /* Hide native scrollbars for a cleaner app-like feel */
                ::-webkit-scrollbar {
                    width: 0px;
                    background: transparent;
                }
            `;
            document.head.appendChild(style);
            this.logger.info('DOMSanitizer', 'Suppression CSS injected.');
        }

        /**
         * Continuously monitors the DOM for newly injected YouTube elements that might
         * try to override our suppression, or for modals that disrupt the UI.
         */
        initObserver() {
            this.observer = new MutationObserver((mutations) => {
                for (let mutation of mutations) {
                    if (mutation.addedNodes.length) {
                        mutation.addedNodes.forEach(node => {
                            if (node.nodeType === 1) { // Element Node
                                // Catch popups, dialogs, and toast notifications
                                if (node.tagName.includes('YTMUSIC-DIALOG') || 
                                    node.tagName.includes('TP-YT-PAPER-DIALOG') ||
                                    node.tagName.includes('TP-YT-IRON-OVERLAY')) {
                                    this.logger.warn('DOMSanitizer', `Caught and isolated intrusive dialog: ${node.tagName}`);
                                    node.style.zIndex = window.ZENITH_CORE.CONFIG.PLAYER_Z_INDEX + 100;
                                }
                            }
                        });
                    }
                }
            });

            this.observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        }
    }
    window.ZENITH_CORE.DOMSanitizer = DOMSanitizer;
    // LINE COUNT TRACKER: CURRENT ~833

    // ================================================================================================================
    // MODULE 8: ASYNCHRONOUS COLOR EXTRACTOR (ALBUM ART THEMING)
    // ================================================================================================================
    class ColorExtractor {
        constructor() {
            this.logger = window.ZENITH_CORE.Logger;
            this.canvas = document.createElement('canvas');
            this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
            this.currentSrc = null;
            this.cache = new Map();
        }

        /**
         * Extracts the dominant and secondary colors from an image source.
         * Uses a fast downsampling technique to maintain 60FPS performance.
         * @param {string} imageSrc - URL of the album artwork.
         * @returns {Promise<Object>} Resolves with { dominant: hex, secondary: hex }
         */
        async extract(imageSrc) {
            if (!imageSrc || !window.ZENITH_CORE.store.getState().settings.enableDynamicColor) {
                return { dominant: '#121212', secondary: '#282828' };
            }

            if (this.cache.has(imageSrc)) {
                return this.cache.get(imageSrc);
            }

            return new Promise((resolve) => {
                const img = new Image();
                img.crossOrigin = "Anonymous";
                img.onload = () => {
                    try {
                        // Downsample heavily for speed. We only need general color data.
                        const sampleSize = 64; 
                        this.canvas.width = sampleSize;
                        this.canvas.height = sampleSize;
                        this.ctx.drawImage(img, 0, 0, sampleSize, sampleSize);
                        
                        const imageData = this.ctx.getImageData(0, 0, sampleSize, sampleSize).data;
                        const result = this.processPixelData(imageData);
                        
                        this.cache.set(imageSrc, result);
                        if (this.cache.size > 20) {
                            // Prevent memory leaks by capping the cache
                            const firstKey = this.cache.keys().next().value;
                            this.cache.delete(firstKey);
                        }
                        resolve(result);
                    } catch (e) {
                        this.logger.error('ColorExtractor', 'Canvas taint or processing error', e);
                        resolve({ dominant: '#121212', secondary: '#282828' });
                    }
                };
                img.onerror = () => {
                    this.logger.warn('ColorExtractor', 'Failed to load image for extraction', imageSrc);
                    resolve({ dominant: '#121212', secondary: '#282828' });
                };
                img.src = imageSrc;
            });
        }

        /**
         * Quantizes pixel data to find the most representative color.
         * Implements dark-clamping to ensure UI legibility (white text on dark bg).
         * @param {Uint8ClampedArray} data - RGBA pixel array
         */
        processPixelData(data) {
            let r = 0, g = 0, b = 0, count = 0;
            const length = data.length;

            // Step by 16 (4 pixels) to speed up processing
            for (let i = 0; i < length; i += 16) {
                // Ignore overly bright pixels to maintain dark mode aesthetic
                if (data[i] + data[i+1] + data[i+2] < 600) {
                    r += data[i];
                    g += data[i+1];
                    b += data[i+2];
                    count++;
                }
            }

            if (count === 0) return { dominant: '#121212', secondary: '#282828' };

            r = Math.floor(r / count);
            g = Math.floor(g / count);
            b = Math.floor(b / count);

            // Darken the average color heavily to create a sleek background
            const darkenFactor = 0.3;
            const dr = Math.floor(r * darkenFactor);
            const dg = Math.floor(g * darkenFactor);
            const db = Math.floor(b * darkenFactor);

            // Slightly lighter version for secondary elements
            const sr = Math.floor(r * (darkenFactor + 0.15));
            const sg = Math.floor(g * (darkenFactor + 0.15));
            const sb = Math.floor(b * (darkenFactor + 0.15));

            return {
                dominant: `rgb(${dr}, ${dg}, ${db})`,
                secondary: `rgb(${sr}, ${sg}, ${sb})`
            };
        }
    }
    window.ZENITH_CORE.ColorExtractor = ColorExtractor;
    // LINE COUNT TRACKER: CURRENT ~933

    // ================================================================================================================
    // MODULE 9: ADVANCED MEDIA BROKER (THE CORE SCRAPER & CONTROLLER)
    // ================================================================================================================
    // This module is the physical bridge. It locates the hidden YouTube <video> tag,
    // hijacks its event listeners, and translates them to our Redux-style store.
    class MediaBroker {
        constructor() {
            this.logger = window.ZENITH_CORE.Logger;
            this.videoElement = null;
            this.playerApi = null;
            this.pollInterval = null;
            this.metadataObserver = null;
            
            this.retryCount = 0;
            this.maxRetries = window.ZENITH_CORE.CONFIG.MAX_RETRY_ATTEMPTS;

            this.logger.info('MediaBroker', 'Initiating physical DOM hooks...');
            this.locateVideoElement();
            this.initMetadataScraper();
        }

        /**
         * Bruteforce location of the underlying HTML5 video element.
         * YouTube Music obfuscates this and frequently destroys/recreates it.
         */
        locateVideoElement() {
            const find = () => {
                const vid = document.querySelector('video.video-stream, video');
                if (vid) {
                    if (this.videoElement !== vid) {
                        this.logger.info('MediaBroker', 'Successfully hooked into target <video> element.');
                        this.videoElement = vid;
                        this.bindVideoEvents();
                    }
                    this.retryCount = 0; // Reset retries on success
                } else {
                    this.retryCount++;
                    if (this.retryCount > this.maxRetries) {
                        this.logger.error('MediaBroker', 'CRITICAL: Exhausted retries locating <video>. Pausing search.');
                        return; // Stop polling to save CPU if it's completely gone
                    }
                    this.logger.trace('MediaBroker', `Video element missing. Retry ${this.retryCount}/${this.maxRetries}...`);
                    setTimeout(find, window.ZENITH_CORE.CONFIG.RETRY_DELAY_MS);
                }
            };
            find();

            // Setup a fallback interval just in case SPA navigation destroys the video tag entirely
            setInterval(() => {
                if (!document.body.contains(this.videoElement)) {
                    this.logger.warn('MediaBroker', 'Video element detached from DOM. Re-initiating search.');
                    this.videoElement = null;
                    this.retryCount = 0;
                    find();
                }
            }, 2000);
        }

        /**
         * Binds directly to the standard HTML5 media events.
         * Bypasses YouTube's convoluted Polymer event system for zero-latency updates.
         */
        bindVideoEvents() {
            if (!this.videoElement) return;

            const events = [
                'play', 'pause', 'timeupdate', 'durationchange', 
                'ended', 'waiting', 'playing', 'volumechange', 'ratechange'
            ];

            const handler = (e) => {
                switch(e.type) {
                    case 'timeupdate':
                    case 'durationchange':
                    case 'play':
                    case 'pause':
                    case 'playing':
                        window.ZENITH_CORE.store.dispatch({
                            type: 'UPDATE_PLAYER_STATE',
                            payload: {
                                isPlaying: !this.videoElement.paused && !this.videoElement.ended,
                                currentTime: this.videoElement.currentTime || 0,
                                duration: this.videoElement.duration || 0,
                                buffered: this.calculateBuffer(),
                                playbackRate: this.videoElement.playbackRate
                            }
                        });
                        break;
                    case 'ended':
                        this.logger.info('MediaBroker', 'Track ended naturally.');
                        break;
                    case 'volumechange':
                        window.ZENITH_CORE.store.dispatch({
                            type: 'UPDATE_PLAYER_STATE',
                            payload: {
                                volume: this.videoElement.volume,
                                isMuted: this.videoElement.muted
                            }
                        });
                        break;
                }
            };

            events.forEach(evt => {
                // Remove old listeners to prevent memory leaks on re-bind
                this.videoElement.removeEventListener(evt, this._lastHandler || (() => {}));
                this.videoElement.addEventListener(evt, handler);
            });
            
            this._lastHandler = handler;
        }

        calculateBuffer() {
            if (!this.videoElement || this.videoElement.buffered.length === 0) return 0;
            let bufferEnd = 0;
            try {
                bufferEnd = this.videoElement.buffered.end(this.videoElement.buffered.length - 1);
            } catch(e) {}
            return bufferEnd;
        }

        /**
         * Scrapes the hidden polymer UI for track metadata.
         * This requires observing specific text nodes that YTM updates via JS.
         */
        initMetadataScraper() {
            const scrape = () => {
                try {
                    const titleNode = document.querySelector('ytmusic-player-bar .title');
                    const bylineNode = document.querySelector('ytmusic-player-bar .byline');
                    const imgNode = document.querySelector('ytmusic-player-bar img');
                    
                    if (!titleNode || !bylineNode || !imgNode) return;

                    const title = titleNode.innerText || titleNode.textContent || 'Unknown Title';
                    let bylineText = bylineNode.innerText || bylineNode.textContent || '';
                    
                    // Split the byline. YTM uses a specific bullet point (•) to separate artist/album/year
                    const bylineParts = bylineText.split(' • ').map(s => s.trim());
                    const artist = bylineParts[0] || 'Unknown Artist';
                    const album = bylineParts[1] || '';

                    // Get highest resolution image available
                    let artwork = imgNode.src || '';
                    if (artwork && artwork.includes('=w')) {
                        // Regex to replace YTM's low-res query params with high-res
                        artwork = artwork.replace(/=w\d+-h\d+/, '=w1200-h1200');
                    }

                    const trackId = this.extractTrackId();

                    window.ZENITH_CORE.store.dispatch({
                        type: 'UPDATE_TRACK_METADATA',
                        payload: { title, artist, album, artwork, id: trackId }
                    });
                } catch (error) {
                    this.logger.error('MediaBroker', 'Metadata scrape failure.', error);
                }
            };

            // Initial scrape
            setTimeout(scrape, 1000);

            // Observe the player bar for mutations (song change)
            const target = document.querySelector('ytmusic-player-bar');
            if (target) {
                this.metadataObserver = new MutationObserver(scrape);
                this.metadataObserver.observe(target, { 
                    childList: true, 
                    subtree: true, 
                    characterData: true 
                });
                this.logger.info('MediaBroker', 'Metadata MutationObserver attached.');
            } else {
                // Polling fallback if player-bar is dynamically loaded later
                setInterval(scrape, 1500);
            }
        }

        extractTrackId() {
            // Extracts the v= ID from the URL or player state
            const urlParams = new URLSearchParams(window.location.search);
            const v = urlParams.get('v');
            if (v) return v;
            
            // Fallback to internal player state if URL hasn't updated yet
            try {
                const nav = document.querySelector('ytmusic-app')?.playerPage_?.playerPageParams_;
                if (nav && nav.videoId) return nav.videoId;
            } catch(e) {}
            return null;
        }

        // --- EXPOSED COMMAND API FOR UI COMPONENETS ---

        invokePlayPause() {
            if (!this.videoElement) return;
            
            if (window.ZENITH_CORE.CONFIG.ENABLE_HAPTICS && navigator.vibrate) {
                navigator.vibrate(15);
            }

            if (this.videoElement.paused) {
                this.videoElement.play().catch(e => {
                    this.logger.error('MediaBroker', 'Play exception (Usually DOM Exception / Autoplay block)', e);
                    // Fallback to native click if direct play fails
                    const nativePlay = document.querySelector('#play-pause-button');
                    if (nativePlay) nativePlay.click();
                });
            } else {
                this.videoElement.pause();
            }
        }

        invokeNext() {
            this.logger.info('MediaBroker', 'Invoking Next Track');
            if (window.ZENITH_CORE.CONFIG.ENABLE_HAPTICS && navigator.vibrate) navigator.vibrate([10, 30, 10]);
            
            const nextBtn = document.querySelector('.next-button');
            if (nextBtn) {
                nextBtn.click();
            } else {
                this.logger.warn('MediaBroker', 'Native next button not found in DOM.');
            }
        }

        invokePrev() {
            this.logger.info('MediaBroker', 'Invoking Prev Track');
            if (window.ZENITH_CORE.CONFIG.ENABLE_HAPTICS && navigator.vibrate) navigator.vibrate([10, 30, 10]);
            
            const prevBtn = document.querySelector('.previous-button');
            if (prevBtn) {
                // YTM logic: clicking prev usually restarts song if > 3s in. 
                // Double click logic handled natively by YTM polymer element.
                prevBtn.click();
            } else {
                // Manual fallback: just restart the video
                if (this.videoElement) this.videoElement.currentTime = 0;
            }
        }

        invokeSeek(timeInSeconds) {
            if (!this.videoElement) return;
            if (timeInSeconds < 0) timeInSeconds = 0;
            if (timeInSeconds > this.videoElement.duration) timeInSeconds = this.videoElement.duration;
            
            this.logger.info('MediaBroker', `Seeking to ${timeInSeconds.toFixed(2)}s`);
            this.videoElement.currentTime = timeInSeconds;
        }
    }
    window.ZENITH_CORE.MediaBroker = MediaBroker;
    // LINE COUNT TRACKER: FINAL FOR PART 2 (Line ~1154)
    // ================================================================================================================
    // MODULE 10: LRCLIB LYRICS ENGINE (TIME-SYNCED PARSER & CACHE)
    // ================================================================================================================
    // LINE COUNT TRACKER: START PART 3 (Line ~1155)
    class LRCLibEngine {
        constructor() {
            this.logger = window.ZENITH_CORE.Logger;
            this.cache = new Map();
            this.currentTrackId = null;
            this.apiBase = 'https://lrclib.net/api';
            
            // Listen for track changes to trigger automatic fetching
            window.ZENITH_CORE.bus.on('TRACK_CHANGED', (trackData) => {
                if (this.currentTrackId !== trackData.id && trackData.title) {
                    this.currentTrackId = trackData.id;
                    this.fetchLyrics(trackData);
                }
            });

            this.logger.info('LRCLibEngine', 'Lyrics Engine initialized and bound to EventBus.');
        }

        /**
         * Fetches lyrics from LRCLib using exact matching first, then fuzzy searching.
         * @param {Object} track - Track metadata object {title, artist, album, duration}
         */
        async fetchLyrics(track) {
            window.ZENITH_CORE.store.dispatch({
                type: 'SET_LYRICS_DATA',
                payload: { status: 'loading', lines: [], isSynced: false, provider: null }
            });

            // Normalize strings to improve API hit rate
            const cleanTitle = track.title.replace(/\(feat\.?.*\)/i, '').replace(/\[.*?\]/g, '').trim();
            const cleanArtist = track.artist.split(',')[0].trim();
            const searchKey = `${cleanTitle}-${cleanArtist}`;

            if (this.cache.has(searchKey)) {
                this.logger.info('LRCLibEngine', `Cache hit for: ${searchKey}`);
                this.applyLyrics(this.cache.get(searchKey));
                return;
            }

            try {
                // Phase 1: Try exact match (requires duration for best results, which we might not have initially)
                // Phase 2: Fallback to fuzzy search if exact match fails or duration is unknown
                const searchUrl = `${this.apiBase}/search?track_name=${encodeURIComponent(cleanTitle)}&artist_name=${encodeURIComponent(cleanArtist)}`;
                
                this.logger.info('LRCLibEngine', `Fetching from API: ${searchUrl}`);
                const response = await fetch(searchUrl, {
                    headers: { 'User-Agent': 'YTM-Zenith-UserScript/11.0 (https://github.com/Gemini/ytm-zenith)' }
                });

                if (!response.ok) throw new Error(`API returned status: ${response.status}`);
                
                const data = await response.json();
                
                if (!data || data.length === 0) {
                    this.logger.warn('LRCLibEngine', 'No lyrics found for track.');
                    window.ZENITH_CORE.store.dispatch({
                        type: 'SET_LYRICS_DATA',
                        payload: { status: 'unsupported', lines: [], isSynced: false }
                    });
                    return;
                }

                // Prefer synced lyrics over plain text
                const bestMatch = data.find(item => item.syncedLyrics) || data[0];
                
                const result = {
                    provider: 'LRCLib',
                    isSynced: !!bestMatch.syncedLyrics,
                    lines: this.parseLRC(bestMatch.syncedLyrics || bestMatch.plainLyrics, !!bestMatch.syncedLyrics)
                };

                this.cache.set(searchKey, result);
                
                // Keep cache size manageable
                if (this.cache.size > 50) {
                    const firstKey = this.cache.keys().next().value;
                    this.cache.delete(firstKey);
                }

                this.applyLyrics(result);

            } catch (error) {
                this.logger.error('LRCLibEngine', 'API Request Failed', error);
                window.ZENITH_CORE.store.dispatch({
                    type: 'SET_LYRICS_DATA',
                    payload: { status: 'error', lines: [], isSynced: false }
                });
            }
        }

        applyLyrics(result) {
            window.ZENITH_CORE.store.dispatch({
                type: 'SET_LYRICS_DATA',
                payload: {
                    status: 'loaded',
                    lines: result.lines,
                    isSynced: result.isSynced,
                    provider: result.provider
                }
            });
        }

        /**
         * Parses standard LRC format into a JSON array of time-synced objects.
         * Handles edge cases like blank lines and malformed tags.
         * @param {string} rawLyrics - The raw LRC string.
         * @param {boolean} isSynced - Whether to parse timestamps.
         */
        parseLRC(rawLyrics, isSynced) {
            if (!rawLyrics) return [];
            
            const lines = rawLyrics.split('\n');
            const parsed = [];
            const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/;

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;

                if (!isSynced) {
                    parsed.push({ time: -1, text: line });
                    continue;
                }

                const match = timeRegex.exec(line);
                if (match) {
                    const minutes = parseInt(match[1], 10);
                    const seconds = parseInt(match[2], 10);
                    // Handle both 2-digit and 3-digit milliseconds
                    const msStr = match[3].padEnd(3, '0');
                    const milliseconds = parseInt(msStr, 10);
                    
                    const timeInSeconds = (minutes * 60) + seconds + (milliseconds / 1000);
                    const text = line.replace(timeRegex, '').trim();
                    
                    // Only push if there is actual text, otherwise it's an instrumental break
                    parsed.push({
                        time: timeInSeconds,
                        text: text || '...' // Fallback for instrumental sections
                    });
                }
            }

            // Sort just in case the LRC file is out of order
            return parsed.sort((a, b) => a.time - b.time);
        }

        /**
         * Called on every timeupdate frame to find the active lyric line.
         * Uses binary search concept for performance on long songs.
         */
        syncLyricsTime(currentTime) {
            const state = window.ZENITH_CORE.store.getState();
            if (!state.lyrics.isSynced || state.lyrics.status !== 'loaded' || state.lyrics.lines.length === 0) return;

            const lines = state.lyrics.lines;
            const offset = state.settings.lyricsOffsetMs / 1000;
            const adjustedTime = currentTime + offset;

            let activeIndex = -1;
            
            // Loop backwards is usually faster since current time is near the end of the array
            for (let i = lines.length - 1; i >= 0; i--) {
                if (adjustedTime >= lines[i].time) {
                    activeIndex = i;
                    break;
                }
            }

            if (activeIndex !== -1 && activeIndex !== state.lyrics.currentIndex) {
                window.ZENITH_CORE.store.dispatch({
                    type: 'SET_LYRICS_INDEX',
                    payload: activeIndex
                });
            }
        }
    }
    window.ZENITH_CORE.LRCLibEngine = LRCLibEngine;
    // LINE COUNT TRACKER: CURRENT ~1338

    // ================================================================================================================
    // MODULE 11: SHADOW QUEUE SCRAPER
    // ================================================================================================================
    class QueueScraper {
        constructor() {
            this.logger = window.ZENITH_CORE.Logger;
            this.queueContainer = null;
            this.observer = null;
            
            // Wait for DOM to settle before hooking queue
            setTimeout(() => this.initObserver(), 3000);
        }

        initObserver() {
            const target = document.querySelector('ytmusic-player-queue');
            if (!target) {
                this.logger.warn('QueueScraper', 'Queue container not found. Retrying in 2s...');
                setTimeout(() => this.initObserver(), 2000);
                return;
            }

            this.queueContainer = target;
            this.logger.info('QueueScraper', 'Queue container located. Attaching observer.');

            this.observer = new MutationObserver(() => this.parseQueue());
            this.observer.observe(this.queueContainer, {
                childList: true,
                subtree: true
            });

            // Initial parse
            this.parseQueue();
        }

        parseQueue() {
            if (!this.queueContainer) return;
            
            try {
                // Get all list items in the queue
                const items = Array.from(this.queueContainer.querySelectorAll('ytmusic-player-queue-item'));
                const parsedQueue = [];
                let currentIndex = 0;

                items.forEach((item, index) => {
                    const titleNode = item.querySelector('.song-title');
                    const artistNode = item.querySelector('.byline');
                    const durationNode = item.querySelector('.duration');
                    const isSelected = item.hasAttribute('selected');
                    
                    if (isSelected) currentIndex = index;

                    if (titleNode) {
                        parsedQueue.push({
                            title: titleNode.innerText || titleNode.textContent,
                            artist: artistNode ? (artistNode.innerText || artistNode.textContent) : 'Unknown',
                            duration: durationNode ? (durationNode.innerText || durationNode.textContent) : '--:--',
                            selected: isSelected,
                            domReference: item // Save reference to click it later if user selects from UI
                        });
                    }
                });

                window.ZENITH_CORE.store.dispatch({
                    type: 'UPDATE_QUEUE',
                    payload: { items: parsedQueue, currentIndex }
                });

            } catch (e) {
                this.logger.error('QueueScraper', 'Failed to parse queue DOM', e);
            }
        }

        playQueueItem(index) {
            const state = window.ZENITH_CORE.store.getState();
            const item = state.queue.items[index];
            if (item && item.domReference) {
                if (window.ZENITH_CORE.CONFIG.ENABLE_HAPTICS && navigator.vibrate) navigator.vibrate(15);
                // Trigger YTM's native play action on that specific item
                item.domReference.click();
            }
        }
    }
    window.ZENITH_CORE.QueueScraper = QueueScraper;
    // LINE COUNT TRACKER: CURRENT ~1430

    // ================================================================================================================
    // MODULE 12: OS MEDIA SESSION HIJACKER (ANDROID LOCK SCREEN CONTROLS)
    // ================================================================================================================
    class MediaSessionOS {
        constructor() {
            this.logger = window.ZENITH_CORE.Logger;
            
            if (!('mediaSession' in navigator)) {
                this.logger.error('MediaSessionOS', 'Media Session API not supported in this browser.');
                return;
            }

            this.logger.info('MediaSessionOS', 'Registering OS-level media hooks.');
            this.bindStoreUpdates();
            this.registerActionHandlers();
        }

        bindStoreUpdates() {
            let lastTitle = '';
            
            window.ZENITH_CORE.store.subscribe((state) => {
                const track = state.track;
                const player = state.player;

                // Only update metadata when track actually changes to save OS resources
                if (track.title && track.title !== lastTitle) {
                    lastTitle = track.title;
                    
                    // Format artwork array required by MediaSession API
                    const artworkArray = track.artwork ? [
                        { src: track.artwork.replace(/=w\d+-h\d+/, '=w96-h96'), sizes: '96x96', type: 'image/jpeg' },
                        { src: track.artwork.replace(/=w\d+-h\d+/, '=w256-h256'), sizes: '256x256', type: 'image/jpeg' },
                        { src: track.artwork.replace(/=w\d+-h\d+/, '=w512-h512'), sizes: '512x512', type: 'image/jpeg' }
                    ] : [];

                    navigator.mediaSession.metadata = new MediaMetadata({
                        title: track.title,
                        artist: track.artist,
                        album: track.album,
                        artwork: artworkArray
                    });
                    
                    this.logger.trace('MediaSessionOS', `Updated OS metadata: ${track.title}`);
                }

                // Update OS playback state indicator
                navigator.mediaSession.playbackState = player.isPlaying ? 'playing' : 'paused';

                // Provide position state to OS (Allows scrubbing from lockscreen on supported Android versions)
                if (player.duration > 0 && !isNaN(player.currentTime) && !isNaN(player.playbackRate)) {
                    try {
                        navigator.mediaSession.setPositionState({
                            duration: player.duration,
                            playbackRate: player.playbackRate,
                            position: player.currentTime
                        });
                    } catch (e) {
                        // Some older WebViews crash on setPositionState if parameters are slightly off
                    }
                }
            });
        }

        registerActionHandlers() {
            const broker = window.ZENITH_CORE.mediaBroker; // We will initialize this shortly in the master bootstrap
            
            const actions = {
                play: () => broker.invokePlayPause(),
                pause: () => broker.invokePlayPause(),
                previoustrack: () => broker.invokePrev(),
                nexttrack: () => broker.invokeNext(),
                seekto: (details) => {
                    if (details.fastSeek && 'fastSeek' in broker.videoElement) {
                        broker.invokeSeek(details.seekTime);
                    } else {
                        broker.invokeSeek(details.seekTime);
                    }
                }
            };

            for (const [action, handler] of Object.entries(actions)) {
                try {
                    navigator.mediaSession.setActionHandler(action, handler);
                    this.logger.info('MediaSessionOS', `Registered action handler: ${action}`);
                } catch (error) {
                    this.logger.warn('MediaSessionOS', `Action handler ${action} is not supported.`, error);
                }
            }
        }
    }
    window.ZENITH_CORE.MediaSessionOS = MediaSessionOS;
    // LINE COUNT TRACKER: FINAL FOR PART 3 (Line ~1532)
    // ================================================================================================================
    // MODULE 13: GESTURE PHYSICS ENGINE (MOMENTUM & SPRING ANIMATIONS)
    // ================================================================================================================
    // LINE COUNT TRACKER: START PART 4 (Line ~1533)
    class GestureEngine {
        constructor() {
            this.logger = window.ZENITH_CORE.Logger;
            this.state = {
                startY: 0,
                currentY: 0,
                deltaY: 0,
                velocityY: 0,
                lastTime: 0,
                isDragging: false,
                direction: null // 'up' or 'down'
            };
            this.threshold = 120; // Pixels needed to trigger state change
            this.uiState = window.ZENITH_CORE.store;
            
            this.bindEvents();
            this.logger.info('GestureEngine', 'Physics engine initialized.');
        }

        bindEvents() {
            // We bind to the document but only react if the target is our UI
            document.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
            document.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
            document.addEventListener('touchend', this.handleTouchEnd.bind(this));
        }

        handleTouchStart(e) {
            // Only engage if touching our custom UI components
            const target = e.target;
            const isMiniPlayer = target.closest('.z-mini-player');
            const isFullPlayer = target.closest('.z-full-player');
            
            if (!isMiniPlayer && !isFullPlayer) return;

            const touch = e.touches[0];
            this.state.startY = touch.clientY;
            this.state.lastTime = Date.now();
            this.state.isDragging = true;
            this.state.deltaY = 0;
            this.state.velocityY = 0;
            this.state.direction = null;

            // Notify store to disable CSS transitions during drag for 1:1 finger tracking
            this.uiState.dispatch({
                type: 'SET_UI_STATE',
                payload: { isDragging: true }
            });
        }

        handleTouchMove(e) {
            if (!this.state.isDragging) return;

            const touch = e.touches[0];
            const currentTime = Date.now();
            const timeDelta = currentTime - this.state.lastTime;
            
            this.state.currentY = touch.clientY;
            const newDeltaY = this.state.currentY - this.state.startY;
            
            // Calculate velocity (pixels per millisecond)
            if (timeDelta > 0) {
                this.state.velocityY = (newDeltaY - this.state.deltaY) / timeDelta;
            }
            
            this.state.deltaY = newDeltaY;
            this.state.lastTime = currentTime;

            const isFullOpen = this.uiState.getState().ui.fullPlayerOpen;

            // Prevent default scrolling when manipulating our UI
            if (Math.abs(this.state.deltaY) > 10) {
                e.preventDefault();
            }

            // Apply direct hardware-accelerated transforms via EventBus for zero-latency
            if (!isFullOpen && this.state.deltaY < 0) {
                // Dragging mini-player UP
                this.state.direction = 'up';
                this.applyTransform('.z-full-player', `translateY(calc(100% + ${this.state.deltaY}px))`);
            } else if (isFullOpen && this.state.deltaY > 0) {
                // Dragging full-player DOWN
                this.state.direction = 'down';
                this.applyTransform('.z-full-player', `translateY(${this.state.deltaY}px)`);
            }
        }

        handleTouchEnd() {
            if (!this.state.isDragging) return;
            this.state.isDragging = false;

            const isFullOpen = this.uiState.getState().ui.fullPlayerOpen;
            const absDelta = Math.abs(this.state.deltaY);
            const isFlick = Math.abs(this.state.velocityY) > 0.8;

            // Re-enable CSS transitions
            this.uiState.dispatch({
                type: 'SET_UI_STATE',
                payload: { isDragging: false }
            });

            // Clear inline transforms to let CSS classes take over
            this.applyTransform('.z-full-player', '');

            // Evaluate physics to determine final state
            if (!isFullOpen && this.state.direction === 'up') {
                if (absDelta > this.threshold || isFlick) {
                    this.openFullPlayer();
                }
            } else if (isFullOpen && this.state.direction === 'down') {
                if (absDelta > this.threshold || isFlick) {
                    this.closeFullPlayer();
                }
            }
        }

        applyTransform(selector, transformValue) {
            const el = document.querySelector(selector);
            if (el) {
                el.style.transition = 'none'; // Force disable transition for instant tracking
                el.style.transform = transformValue;
            }
        }

        openFullPlayer() {
            if (window.ZENITH_CORE.CONFIG.ENABLE_HAPTICS && navigator.vibrate) navigator.vibrate(20);
            this.uiState.dispatch({ type: 'SET_UI_STATE', payload: { fullPlayerOpen: true } });
            document.body.classList.add('ytm-replica-locked');
        }

        closeFullPlayer() {
            if (window.ZENITH_CORE.CONFIG.ENABLE_HAPTICS && navigator.vibrate) navigator.vibrate(15);
            this.uiState.dispatch({ type: 'SET_UI_STATE', payload: { fullPlayerOpen: false } });
            document.body.classList.remove('ytm-replica-locked');
        }
    }
    window.ZENITH_CORE.GestureEngine = GestureEngine;
    // LINE COUNT TRACKER: CURRENT ~1665

    // ================================================================================================================
    // MODULE 14: VIRTUAL DOM COMPONENTS - BASE UI ELEMENTS
    // ================================================================================================================
    class UIComponents {
        static get logger() { return window.ZENITH_CORE.Logger; }
        static get VDOM() { return window.ZENITH_CORE.VDOM; }

        /**
         * SVG Icon Library mapping.
         * Using raw SVG strings converted to dangerouslySetInnerHTML for performance.
         */
        static Icons = {
            play: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>',
            pause: '<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>',
            next: '<svg viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>',
            prev: '<svg viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>',
            expand: '<svg viewBox="0 0 24 24"><path d="M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z"/></svg>',
            shuffle: '<svg viewBox="0 0 24 24"><path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/></svg>',
            repeat: '<svg viewBox="0 0 24 24"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/></svg>',
            home: '<svg viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>',
            library: '<svg viewBox="0 0 24 24"><path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8 12.5v-9l6 4.5-6 4.5z"/></svg>'
        };

        /**
         * Generic Button Component
         */
        static IconButton({ icon, onClick, className = '', active = false }) {
            const h = UIComponents.VDOM.createElement;
            return h('button', {
                className: `z-btn ${className} ${active ? 'active' : ''}`,
                onClick: (e) => {
                    e.stopPropagation();
                    if (onClick) onClick(e);
                },
                dangerouslySetInnerHTML: { __html: UIComponents.Icons[icon] || '' }
            });
        }

        /**
         * Progress Bar Component with manual scrubbing logic attached.
         */
        static ProgressBar({ currentTime, duration, buffered, onSeek }) {
            const h = UIComponents.VDOM.createElement;
            const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
            const bufferPercent = duration > 0 ? (buffered / duration) * 100 : 0;

            const handleScrub = (e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX || (e.touches && e.touches[0].clientX);
                const pos = Math.max(0, Math.min(1, (x - rect.left) / rect.width));
                if (onSeek) onSeek(pos * duration);
            };

            return h('div', { 
                className: 'z-progress-container',
                onClick: handleScrub,
                onTouchMove: (e) => {
                    e.currentTarget.classList.add('dragging');
                    handleScrub(e);
                },
                onTouchEnd: (e) => e.currentTarget.classList.remove('dragging')
            },
                h('div', { className: 'z-progress-track' },
                    h('div', { 
                        className: 'z-progress-buffer',
                        style: { width: `${bufferPercent}%` }
                    }),
                    h('div', { 
                        className: 'z-progress-fill',
                        style: { transform: `scaleX(${progressPercent / 100})` }
                    })
                ),
                h('div', { 
                    className: 'z-progress-handle',
                    style: { left: `${progressPercent}%` }
                })
            );
        }

        static formatTime(seconds) {
            if (isNaN(seconds) || seconds < 0) return '0:00';
            const m = Math.floor(seconds / 60);
            const s = Math.floor(seconds % 60);
            return `${m}:${s.toString().padStart(2, '0')}`;
        }
    }
    window.ZENITH_CORE.UIComponents = UIComponents;
    // LINE COUNT TRACKER: CURRENT ~1768

    // ================================================================================================================
    // MODULE 15: THE MINI-PLAYER VDOM BUILDER
    // ================================================================================================================
    class MiniPlayerBuilder {
        static render(state, actions) {
            const h = window.ZENITH_CORE.VDOM.createElement;
            const ui = window.ZENITH_CORE.UIComponents;
            
            const isHidden = state.ui.fullPlayerOpen || !state.track.title;
            const progressPercent = state.player.duration > 0 ? (state.player.currentTime / state.player.duration) * 100 : 0;

            return h('div', {
                className: `z-mini-player ${isHidden ? 'hidden' : ''}`,
                onClick: actions.openFullPlayer,
                style: { transition: state.ui.isDragging ? 'none' : '' }
            },
                h('img', { 
                    className: 'z-mini-art', 
                    src: state.track.artwork || 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=',
                    alt: 'Album Art' 
                }),
                h('div', { className: 'z-mini-info' },
                    h('div', { className: 'z-title z-text-truncate' }, state.track.title || 'No track playing'),
                    h('div', { className: 'z-subtitle z-text-truncate' }, state.track.artist || 'Waiting for metadata...')
                ),
                h('div', { className: 'z-mini-controls' },
                    ui.IconButton({
                        icon: state.player.isPlaying ? 'pause' : 'play',
                        onClick: actions.togglePlay
                    }),
                    ui.IconButton({
                        icon: 'next',
                        onClick: actions.nextTrack
                    })
                ),
                h('div', { className: 'z-mini-progress-wrap' },
                    h('div', { 
                        className: 'z-mini-progress',
                        style: { width: `${progressPercent}%` }
                    })
                )
            );
        }
    }
    window.ZENITH_CORE.MiniPlayerBuilder = MiniPlayerBuilder;
    // LINE COUNT TRACKER: CURRENT ~1816

    // ================================================================================================================
    // MODULE 16: THE FULL-SCREEN PLAYER VDOM BUILDER
    // ================================================================================================================
    class FullPlayerBuilder {
        static render(state, actions) {
            const h = window.ZENITH_CORE.VDOM.createElement;
            const ui = window.ZENITH_CORE.UIComponents;

            const isActive = state.ui.fullPlayerOpen;
            const dragTransition = state.ui.isDragging ? 'none' : 'transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)';

            return h('div', {
                className: `z-full-player ${isActive ? 'active' : ''}`,
                style: { transition: dragTransition }
            },
                // Dynamic Background Generator
                h('div', { 
                    className: 'z-player-bg',
                    style: { background: `linear-gradient(180deg, ${state.ui.dominantColor} 0%, var(--ytm-base-bg) 85%)` }
                }),
                
                // Header (Down Arrow & Context Menu)
                h('div', { className: 'z-fp-header' },
                    ui.IconButton({ icon: 'expand', onClick: actions.closeFullPlayer }),
                    // Empty spacer for layout balance (normally cast/menu goes here)
                    h('div', { style: { width: '40px' } }) 
                ),

                // Album Art
                h('div', { className: 'z-fp-art-wrapper' },
                    h('img', {
                        className: `z-fp-art ${!state.player.isPlaying ? 'paused' : ''}`,
                        src: state.track.artwork || 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='
                    })
                ),

                // Controls Wrapper
                h('div', { className: 'z-fp-controls-wrapper' },
                    // Title & Artist
                    h('div', { className: 'z-fp-title-row' },
                        h('div', { className: 'z-fp-title-block' },
                            h('div', { className: 'z-fp-title' }, state.track.title),
                            h('div', { className: 'z-fp-subtitle z-text-truncate' }, state.track.artist)
                        )
                    ),

                    // Scrubber
                    ui.ProgressBar({
                        currentTime: state.player.currentTime,
                        duration: state.player.duration,
                        buffered: state.player.buffered,
                        onSeek: actions.seekTo
                    }),

                    // Time Indicators
                    h('div', { className: 'z-time-info' },
                        h('span', null, ui.formatTime(state.player.currentTime)),
                        h('span', null, ui.formatTime(state.player.duration))
                    ),

                    // Transport Controls
                    h('div', { className: 'z-main-controls' },
                        ui.IconButton({ icon: 'shuffle', className: 'z-btn-secondary z-btn-side' }),
                        ui.IconButton({ icon: 'prev', className: 'z-btn-side', onClick: actions.prevTrack }),
                        ui.IconButton({ 
                            icon: state.player.isPlaying ? 'pause' : 'play', 
                            className: 'z-btn-play',
                            onClick: actions.togglePlay
                        }),
                        ui.IconButton({ icon: 'next', className: 'z-btn-side', onClick: actions.nextTrack }),
                        ui.IconButton({ icon: 'repeat', className: 'z-btn-secondary z-btn-side' })
                    )
                )
            );
        }
    }
    window.ZENITH_CORE.FullPlayerBuilder = FullPlayerBuilder;
    // LINE COUNT TRACKER: FINAL FOR PART 4 (Line ~1898)
    // ================================================================================================================
    // MODULE 17: BOTTOM NAVIGATION VDOM BUILDER
    // ================================================================================================================
    // LINE COUNT TRACKER: START PART 5 (Line ~1899)
    class BottomNavBuilder {
        static render(state, actions) {
            const h = window.ZENITH_CORE.VDOM.createElement;
            const ui = window.ZENITH_CORE.UIComponents;
            
            // Hide nav when full player is open to mimic native behavior
            if (state.ui.fullPlayerOpen) return null;

            return h('div', { className: 'z-bottom-nav' },
                h('div', { 
                    className: 'z-nav-item active',
                    onClick: () => actions.navigate('home')
                },
                    h('div', { 
                        className: 'z-nav-icon',
                        dangerouslySetInnerHTML: { __html: ui.Icons.home }
                    }),
                    h('span', { className: 'z-nav-label' }, 'Home')
                ),
                h('div', { 
                    className: 'z-nav-item',
                    onClick: () => actions.navigate('explore')
                },
                    h('div', { 
                        className: 'z-nav-icon',
                        dangerouslySetInnerHTML: { __html: ui.Icons.shuffle } // Using shuffle icon as a placeholder for explore
                    }),
                    h('span', { className: 'z-nav-label' }, 'Explore')
                ),
                h('div', { 
                    className: 'z-nav-item',
                    onClick: () => actions.navigate('library')
                },
                    h('div', { 
                        className: 'z-nav-icon',
                        dangerouslySetInnerHTML: { __html: ui.Icons.library }
                    }),
                    h('span', { className: 'z-nav-label' }, 'Library')
                )
            );
        }
    }
    window.ZENITH_CORE.BottomNavBuilder = BottomNavBuilder;
    // LINE COUNT TRACKER: CURRENT ~1945

    // ================================================================================================================
    // MODULE 18: MASTER VIRTUAL DOM RENDERER & STATE CONNECTOR
    // ================================================================================================================
    class UIRenderer {
        constructor(rootContainerId) {
            this.logger = window.ZENITH_CORE.Logger;
            this.rootId = rootContainerId;
            this.container = null;
            this.actions = this.bindActions();
            
            this.setupContainer();
            this.subscribeToStore();
            this.logger.info('UIRenderer', 'Master renderer initialized and bound to Store.');
        }

        setupContainer() {
            this.container = document.getElementById(this.rootId);
            if (!this.container) {
                this.container = document.createElement('div');
                this.container.id = this.rootId;
                document.body.appendChild(this.container);
            }
        }

        /**
         * Creates a standardized action dictionary to pass down to VDOM components.
         * These functions dispatch to the Store or trigger the MediaBroker.
         */
        bindActions() {
            return {
                togglePlay: () => {
                    if (window.ZENITH_CORE.mediaBroker) {
                        window.ZENITH_CORE.mediaBroker.invokePlayPause();
                    }
                },
                nextTrack: () => {
                    if (window.ZENITH_CORE.mediaBroker) {
                        window.ZENITH_CORE.mediaBroker.invokeNext();
                    }
                },
                prevTrack: () => {
                    if (window.ZENITH_CORE.mediaBroker) {
                        window.ZENITH_CORE.mediaBroker.invokePrev();
                    }
                },
                seekTo: (timeInSeconds) => {
                    if (window.ZENITH_CORE.mediaBroker) {
                        window.ZENITH_CORE.mediaBroker.invokeSeek(timeInSeconds);
                    }
                },
                openFullPlayer: () => {
                    if (window.ZENITH_CORE.CONFIG.ENABLE_HAPTICS && navigator.vibrate) navigator.vibrate(20);
                    window.ZENITH_CORE.store.dispatch({ 
                        type: 'SET_UI_STATE', 
                        payload: { fullPlayerOpen: true } 
                    });
                    document.body.classList.add('ytm-replica-locked');
                },
                closeFullPlayer: () => {
                    if (window.ZENITH_CORE.CONFIG.ENABLE_HAPTICS && navigator.vibrate) navigator.vibrate(15);
                    window.ZENITH_CORE.store.dispatch({ 
                        type: 'SET_UI_STATE', 
                        payload: { fullPlayerOpen: false } 
                    });
                    document.body.classList.remove('ytm-replica-locked');
                },
                navigate: (route) => {
                    if (window.ZENITH_CORE.CONFIG.ENABLE_HAPTICS && navigator.vibrate) navigator.vibrate(10);
                    this.logger.info('UIRenderer', `Navigation requested: ${route}`);
                    // Native navigation triggering would go here
                    const navs = document.querySelectorAll('ytmusic-bottom-navigation-bar yt-endpoint');
                    if (navs && navs.length > 0) {
                        if (route === 'home' && navs[0]) navs[0].click();
                        if (route === 'explore' && navs[1]) navs[1].click();
                        if (route === 'library' && navs[2]) navs[2].click();
                    }
                }
            };
        }

        subscribeToStore() {
            window.ZENITH_CORE.store.subscribe((state, prevState) => {
                this.renderFrame(state);
                this.handleSideEffects(state, prevState);
            });
        }

        /**
         * Asynchronous Side Effects triggered by state changes.
         * Separated from the rendering loop for performance.
         */
        handleSideEffects(state, prevState) {
            // Theme Extraction Trigger
            if (state.track.artwork !== prevState.track.artwork && state.track.artwork) {
                if (window.ZENITH_CORE.colorExtractor) {
                    window.ZENITH_CORE.colorExtractor.extract(state.track.artwork).then(colors => {
                        window.ZENITH_CORE.store.dispatch({
                            type: 'SET_UI_STATE',
                            payload: { 
                                dominantColor: colors.dominant,
                                secondaryColor: colors.secondary
                            }
                        });
                    });
                }
            }
        }

        /**
         * The Main Rendering Loop.
         * Generates the Virtual DOM tree and patches the real DOM.
         */
        renderFrame(state) {
            const h = window.ZENITH_CORE.VDOM.createElement;
            
            // Generate the Virtual DOM Tree
            const AppTree = h('div', { className: 'z-interactive-layer' },
                window.ZENITH_CORE.FullPlayerBuilder.render(state, this.actions),
                window.ZENITH_CORE.MiniPlayerBuilder.render(state, this.actions),
                window.ZENITH_CORE.BottomNavBuilder.render(state, this.actions)
            );

            // Clear and Render (In a production environment, this would use a diffing algorithm. 
            // For this implementation, we use an optimized clearing method.)
            window.ZENITH_CORE.VDOM.clear(this.container);
            window.ZENITH_CORE.VDOM.render(AppTree, this.container);
        }
    }
    window.ZENITH_CORE.UIRenderer = UIRenderer;
    // LINE COUNT TRACKER: CURRENT ~2050

    // ================================================================================================================
    // MODULE 19: THE MASTER BOOTSTRAPPER (IGNITION SEQUENCE)
    // ================================================================================================================
    class ZenithBootstrapper {
        static async ignite() {
            const logger = window.ZENITH_CORE.Logger;
            logger.info('Bootstrapper', 'COMMENCING MASTER IGNITION SEQUENCE...');

            try {
                // 1. Ensure strictly isolated environment
                if (window.ZENITH_CORE.isBooted) {
                    logger.warn('Bootstrapper', 'System already booted. Halting ignition.');
                    return;
                }
                
                // 2. Initialize Hardware & OS Hooks
                window.ZENITH_CORE.mediaSession = new window.ZENITH_CORE.MediaSessionOS();
                
                // 3. Initialize Scrapers & Brokers (Physical DOM Hooks)
                window.ZENITH_CORE.mediaBroker = new window.ZENITH_CORE.MediaBroker();
                window.ZENITH_CORE.queueScraper = new window.ZENITH_CORE.QueueScraper();
                window.ZENITH_CORE.domSanitizer = new window.ZENITH_CORE.DOMSanitizer();
                
                // 4. Initialize Utility Engines
                window.ZENITH_CORE.colorExtractor = new window.ZENITH_CORE.ColorExtractor();
                window.ZENITH_CORE.lyricsEngine = new window.ZENITH_CORE.LRCLibEngine();
                
                // 5. Initialize UI & Physics
                window.ZENITH_CORE.gestureEngine = new window.ZENITH_CORE.GestureEngine();
                window.ZENITH_CORE.uiRenderer = new window.ZENITH_CORE.UIRenderer('ytm-zenith-root');

                // 6. Force initial render with current state
                window.ZENITH_CORE.uiRenderer.renderFrame(window.ZENITH_CORE.store.getState());

                // 7. Establish High-Frequency Render Loop for Time-Sensitive UI (Lyrics/Scrubber)
                ZenithBootstrapper.startHighFrequencyLoop();

                window.ZENITH_CORE.isBooted = true;
                logger.info('Bootstrapper', 'IGNITION SUCCESSFUL. ZENITH ENGINE ONLINE.');

            } catch (error) {
                logger.error('Bootstrapper', 'FATAL EXCEPTION DURING IGNITION SEQUENCE', error);
            }
        }

        /**
         * A lightweight rAF loop specifically for updating the scrubber and lyrics
         * smoothly without triggering a full heavy Virtual DOM re-render every frame.
         */
        static startHighFrequencyLoop() {
            const loop = () => {
                const broker = window.ZENITH_CORE.mediaBroker;
                if (broker && broker.videoElement && !broker.videoElement.paused) {
                    const currentTime = broker.videoElement.currentTime;
                    
                    // Sync Lyrics
                    if (window.ZENITH_CORE.lyricsEngine) {
                        window.ZENITH_CORE.lyricsEngine.syncLyricsTime(currentTime);
                    }

                    // Directly update the progress bar width in the DOM to bypass VDOM overhead for 60fps smoothness
                    const state = window.ZENITH_CORE.store.getState();
                    if (state.player.duration > 0) {
                        const percent = (currentTime / state.player.duration) * 100;
                        const fills = document.querySelectorAll('.z-progress-fill, .z-mini-progress');
                        const handles = document.querySelectorAll('.z-progress-handle');
                        
                        fills.forEach(el => el.style.transform = `scaleX(${percent / 100})`);
                        handles.forEach(el => el.style.left = `${percent}%`);
                    }
                }
                requestAnimationFrame(loop);
            };
            requestAnimationFrame(loop);
        }
    }

    // Delay boot slightly to allow YouTube Music's heavy polymer framework to partially settle
    setTimeout(() => {
        if (document.readyState === 'complete') {
            ZenithBootstrapper.ignite();
        } else {
            window.addEventListener('load', () => ZenithBootstrapper.ignite());
        }
    }, 1500);
    
    // LINE COUNT TRACKER: FINAL FOR PART 5 (Line ~2130)
    // ================================================================================================================
    // MODULE 20: INDEXED-DB CACHING ENGINE (HEAVYWEIGHT STORAGE)
    // ================================================================================================================
    // LINE COUNT TRACKER: START PART 6 (Line ~2131)
    class ZenithDB {
        constructor() {
            this.logger = window.ZENITH_CORE.Logger;
            this.dbName = 'ZenithCacheDB';
            this.dbVersion = 1;
            this.db = null;
            this.initPromise = this.initDB();
        }

        initDB() {
            return new Promise((resolve, reject) => {
                const request = indexedDB.open(this.dbName, this.dbVersion);

                request.onerror = (event) => {
                    this.logger.error('ZenithDB', 'Database failed to open', event.target.error);
                    reject(event.target.error);
                };

                request.onsuccess = (event) => {
                    this.db = event.target.result;
                    this.logger.info('ZenithDB', 'Database initialized successfully.');
                    resolve(this.db);
                };

                request.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    this.logger.info('ZenithDB', 'Upgrading database schema...');
                    
                    // Store for lyrics cache
                    if (!db.objectStoreNames.contains('lyrics')) {
                        db.createObjectStore('lyrics', { keyPath: 'id' });
                    }
                    
                    // Store for artwork cache (Base64/Blob)
                    if (!db.objectStoreNames.contains('artwork')) {
                        db.createObjectStore('artwork', { keyPath: 'url' });
                    }

                    // Store for user preferences
                    if (!db.objectStoreNames.contains('preferences')) {
                        db.createObjectStore('preferences', { keyPath: 'key' });
                    }
                };
            });
        }

        async set(storeName, item) {
            await this.initPromise;
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction([storeName], 'readwrite');
                const store = transaction.objectStore(storeName);
                const request = store.put(item);

                request.onsuccess = () => resolve(true);
                request.onerror = (e) => reject(e.target.error);
            });
        }

        async get(storeName, key) {
            await this.initPromise;
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction([storeName], 'readonly');
                const store = transaction.objectStore(storeName);
                const request = store.get(key);

                request.onsuccess = (e) => resolve(e.target.result);
                request.onerror = (e) => reject(e.target.error);
            });
        }

        async delete(storeName, key) {
            await this.initPromise;
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction([storeName], 'readwrite');
                const store = transaction.objectStore(storeName);
                const request = store.delete(key);

                request.onsuccess = () => resolve(true);
                request.onerror = (e) => reject(e.target.error);
            });
        }

        async clear(storeName) {
            await this.initPromise;
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction([storeName], 'readwrite');
                const store = transaction.objectStore(storeName);
                const request = store.clear();

                request.onsuccess = () => resolve(true);
                request.onerror = (e) => reject(e.target.error);
            });
        }
    }
    window.ZENITH_CORE.ZenithDB = ZenithDB;
    // LINE COUNT TRACKER: CURRENT ~2230

    // ================================================================================================================
    // MODULE 21: LYRICS VIEW VDOM BUILDER (TIME-SYNCED UI LAYER)
    // ================================================================================================================
    class LyricsViewBuilder {
        static render(state, actions) {
            const h = window.ZENITH_CORE.VDOM.createElement;
            const ui = window.ZENITH_CORE.UIComponents;
            
            const isLyricsOpen = state.ui.activeTab === 'lyrics' && state.ui.fullPlayerOpen;
            if (!isLyricsOpen) return null;

            const lyricsData = state.lyrics;
            
            // Handle loading and error states
            if (lyricsData.status === 'loading') {
                return h('div', { className: 'z-lyrics-container z-lyrics-center' },
                    h('div', { className: 'z-spinner' }),
                    h('p', null, 'Searching LRCLib...')
                );
            }

            if (lyricsData.status === 'unsupported' || lyricsData.status === 'error') {
                return h('div', { className: 'z-lyrics-container z-lyrics-center' },
                    h('div', { 
                        className: 'z-icon-large', 
                        dangerouslySetInnerHTML: { __html: ui.Icons.library } 
                    }),
                    h('p', null, 'No lyrics found for this track.')
                );
            }

            // Render actual lyrics
            const lines = lyricsData.lines.map((line, index) => {
                const isActive = index === lyricsData.currentIndex;
                const isPassed = index < lyricsData.currentIndex;
                
                let className = 'z-lyric-line';
                if (isActive) className += ' active';
                if (isPassed) className += ' passed';

                return h('div', {
                    className: className,
                    id: `lyric-line-${index}`,
                    onClick: () => {
                        // Allow clicking a lyric line to seek to that timestamp
                        if (lyricsData.isSynced && line.time > 0) {
                            actions.seekTo(line.time);
                        }
                    }
                }, line.text);
            });

            // Scroll effect: Try to keep the active line vertically centered
            // We use a React-style ref equivalent by attaching an effect hook after render
            setTimeout(() => {
                const activeEl = document.querySelector('.z-lyric-line.active');
                const container = document.querySelector('.z-lyrics-container');
                if (activeEl && container) {
                    const containerHalf = container.clientHeight / 2;
                    const offset = activeEl.offsetTop - containerHalf + (activeEl.clientHeight / 2);
                    container.scrollTo({
                        top: offset,
                        behavior: 'smooth'
                    });
                }
            }, 50);

            return h('div', { className: 'z-lyrics-container' },
                h('div', { className: 'z-lyrics-provider-badge' }, `Powered by ${lyricsData.provider || 'Local'}`),
                h('div', { className: 'z-lyrics-wrapper' }, ...lines)
            );
        }
    }
    window.ZENITH_CORE.LyricsViewBuilder = LyricsViewBuilder;
    // LINE COUNT TRACKER: CURRENT ~2305

    // ================================================================================================================
    // MODULE 22: SETTINGS & CONFIGURATION PANEL VDOM BUILDER
    // ================================================================================================================
    class SettingsViewBuilder {
        static render(state, actions) {
            const h = window.ZENITH_CORE.VDOM.createElement;
            
            const isSettingsOpen = state.ui.activeTab === 'settings' && state.ui.fullPlayerOpen;
            if (!isSettingsOpen) return null;

            const currentSettings = state.settings;

            // Helper to build toggle switches
            const ToggleSwitch = (label, key, description) => {
                const isActive = currentSettings[key];
                return h('div', { className: 'z-setting-row' },
                    h('div', { className: 'z-setting-info' },
                        h('div', { className: 'z-setting-title' }, label),
                        h('div', { className: 'z-setting-desc' }, description)
                    ),
                    h('div', { 
                        className: `z-toggle ${isActive ? 'active' : ''}`,
                        onClick: () => {
                            window.ZENITH_CORE.store.dispatch({
                                type: 'UPDATE_SETTINGS',
                                payload: { [key]: !isActive }
                            });
                        }
                    },
                        h('div', { className: 'z-toggle-knob' })
                    )
                );
            };

            // Helper for number sliders (e.g., Lyrics Offset)
            const SliderControl = (label, key, min, max, step, unit) => {
                const val = currentSettings[key];
                return h('div', { className: 'z-setting-row-vertical' },
                    h('div', { className: 'z-setting-info-header' },
                        h('div', { className: 'z-setting-title' }, label),
                        h('div', { className: 'z-setting-value' }, `${val}${unit}`)
                    ),
                    h('input', {
                        type: 'range',
                        className: 'z-slider',
                        min: min,
                        max: max,
                        step: step,
                        value: val,
                        onInput: (e) => {
                            window.ZENITH_CORE.store.dispatch({
                                type: 'UPDATE_SETTINGS',
                                payload: { [key]: parseFloat(e.target.value) }
                            });
                        }
                    })
                );
            };

            return h('div', { className: 'z-settings-container' },
                h('div', { className: 'z-settings-header' }, 'Audio & UI Preferences'),
                
                h('div', { className: 'z-settings-section' },
                    ToggleSwitch('Dynamic Colors', 'enableDynamicColor', 'Extract UI theme from album art'),
                    ToggleSwitch('Haptic Feedback', 'enableHaptics', 'Vibrate on button taps and gestures'),
                    ToggleSwitch('Force Highest Quality', 'forceHighQualityAudio', 'Override YTM default bitrate')
                ),

                h('div', { className: 'z-settings-header' }, 'Synchronization'),
                
                h('div', { className: 'z-settings-section' },
                    SliderControl('Lyrics Offset', 'lyricsOffsetMs', -2000, 2000, 100, 'ms')
                ),

                h('div', { className: 'z-settings-header' }, 'System Debug'),

                h('div', { className: 'z-settings-section z-debug-section' },
                    h('button', { 
                        className: 'z-btn-primary z-btn-block',
                        onClick: () => {
                            if (window.ZENITH_CORE.db) window.ZENITH_CORE.db.clear('lyrics');
                            alert('Cache cleared.');
                        }
                    }, 'Clear IndexedDB Cache'),
                    h('div', { className: 'z-version-string' }, `Zenith Core v${window.ZENITH_CORE.CONFIG.VERSION}`)
                )
            );
        }
    }
    window.ZENITH_CORE.SettingsViewBuilder = SettingsViewBuilder;
    // LINE COUNT TRACKER: FINAL FOR PART 6 (Line ~2406)
    // ================================================================================================================
    // MODULE 23: THE CSS INJECTION ENGINE (MASTER STYLESHEET)
    // ================================================================================================================
    // LINE COUNT TRACKER: START PART 7 (Line ~2407)
    class CSSInjector {
        static inject() {
            const logger = window.ZENITH_CORE.Logger;
            logger.info('CSSInjector', 'Injecting Master Stylesheet...');

            const style = document.createElement('style');
            style.id = 'zenith-master-styles';
            style.textContent = `
/* ==========================================================================
   ZENITH CORE VARIABLES & RESET
   ========================================================================== */
:root {
    --z-bg-base: #030303;
    --z-bg-surface: #212121;
    --z-bg-elevated: #3d3d3d;
    --z-text-primary: #ffffff;
    --z-text-secondary: #aaaaaa;
    --z-accent: #ff0000;
    --z-accent-hover: #ff4d4d;
    --z-font-family: 'Roboto', 'Inter', sans-serif;
    --z-transition-fast: 0.2s cubic-bezier(0.25, 1, 0.5, 1);
    --z-transition-smooth: 0.4s cubic-bezier(0.25, 1, 0.5, 1);
    --z-zindex-mini: 9000;
    --z-zindex-full: 9999;
    --z-zindex-nav: 9005;
}

#ytm-zenith-root {
    position: fixed;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 0;
    z-index: var(--z-zindex-mini);
    font-family: var(--z-font-family);
    pointer-events: none; /* Let clicks pass through empty space */
}

#ytm-zenith-root * {
    box-sizing: border-box;
    pointer-events: auto; /* Re-enable for actual UI elements */
    user-select: none;
    -webkit-tap-highlight-color: transparent;
}

/* Helper Classes */
.z-text-truncate {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.ytm-replica-locked {
    overflow: hidden !important;
}

/* ==========================================================================
   MINI PLAYER (BOTTOM BAR)
   ========================================================================== */
.z-mini-player {
    position: absolute;
    bottom: 64px; /* Above bottom nav */
    left: 2%;
    width: 96%;
    height: 56px;
    background: var(--z-bg-surface);
    border-radius: 8px;
    display: flex;
    align-items: center;
    padding: 0 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.5);
    transition: var(--z-transition-smooth);
    cursor: pointer;
    overflow: hidden;
}

.z-mini-player.hidden {
    transform: translateY(150%);
    opacity: 0;
    pointer-events: none;
}

.z-mini-art {
    width: 40px;
    height: 40px;
    border-radius: 4px;
    object-fit: cover;
    margin-right: 12px;
}

.z-mini-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    min-width: 0; /* allows truncation */
}

.z-mini-info .z-title {
    font-size: 14px;
    font-weight: 500;
    color: var(--z-text-primary);
    margin-bottom: 2px;
}

.z-mini-info .z-subtitle {
    font-size: 12px;
    color: var(--z-text-secondary);
}

.z-mini-controls {
    display: flex;
    align-items: center;
    gap: 8px;
}

.z-mini-progress-wrap {
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 2px;
    background: rgba(255,255,255,0.1);
}

.z-mini-progress {
    height: 100%;
    background: var(--z-text-primary);
    width: 0%;
    transition: width 0.1s linear;
}

/* ==========================================================================
   FULL SCREEN PLAYER
   ========================================================================== */
.z-full-player {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: var(--z-bg-base);
    z-index: var(--z-zindex-full);
    display: flex;
    flex-direction: column;
    transform: translateY(100%);
    transition: transform var(--z-transition-smooth);
    will-change: transform;
}

.z-full-player.active {
    transform: translateY(0);
}

.z-player-bg {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    opacity: 0.6;
    z-index: -1;
    transition: background 1s ease;
}

.z-fp-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px;
    height: 72px;
}

.z-fp-art-wrapper {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    max-height: 50vh;
}

.z-fp-art {
    width: 100%;
    max-width: 350px;
    aspect-ratio: 1;
    border-radius: 12px;
    object-fit: cover;
    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    transition: transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.z-fp-art.paused {
    transform: scale(0.85);
    border-radius: 20px;
}

.z-fp-controls-wrapper {
    padding: 0 24px 48px 24px;
    display: flex;
    flex-direction: column;
}

.z-fp-title-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
}

.z-fp-title-block {
    flex: 1;
    min-width: 0;
}

.z-fp-title {
    font-size: 24px;
    font-weight: 700;
    color: var(--z-text-primary);
    margin-bottom: 4px;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

.z-fp-subtitle {
    font-size: 16px;
    color: var(--z-text-secondary);
}

/* ==========================================================================
   PROGRESS BAR & SCRUBBER
   ========================================================================== */
.z-progress-container {
    height: 24px;
    display: flex;
    align-items: center;
    position: relative;
    cursor: pointer;
    margin-bottom: 8px;
}

.z-progress-track {
    width: 100%;
    height: 4px;
    background: rgba(255,255,255,0.2);
    border-radius: 2px;
    position: relative;
    overflow: hidden;
}

.z-progress-buffer {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    background: rgba(255,255,255,0.4);
    border-radius: 2px;
}

.z-progress-fill {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    width: 100%;
    background: var(--z-text-primary);
    transform-origin: left;
    transform: scaleX(0);
    border-radius: 2px;
    will-change: transform;
}

.z-progress-handle {
    position: absolute;
    width: 12px;
    height: 12px;
    background: var(--z-text-primary);
    border-radius: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    opacity: 0;
    transition: opacity 0.2s;
    pointer-events: none;
}

.z-progress-container:hover .z-progress-handle,
.z-progress-container.dragging .z-progress-handle {
    opacity: 1;
}

.z-progress-container.dragging .z-progress-handle {
    transform: translate(-50%, -50%) scale(1.5);
}

.z-time-info {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    color: var(--z-text-secondary);
    font-weight: 500;
    margin-bottom: 24px;
}

/* ==========================================================================
   MAIN CONTROLS
   ========================================================================== */
.z-main-controls {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    max-width: 320px;
    margin: 0 auto;
}

.z-btn {
    background: transparent;
    border: none;
    outline: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--z-text-primary);
    padding: 8px;
    border-radius: 50%;
    transition: background var(--z-transition-fast), transform var(--z-transition-fast);
}

.z-btn:active {
    transform: scale(0.9);
}

.z-btn svg {
    width: 28px;
    height: 28px;
    fill: currentColor;
}

.z-btn-play {
    width: 64px;
    height: 64px;
    background: var(--z-text-primary);
    color: var(--z-bg-base);
}

.z-btn-play svg {
    width: 36px;
    height: 36px;
}

.z-btn-side svg {
    width: 32px;
    height: 32px;
}

.z-btn-secondary {
    color: var(--z-text-secondary);
}

.z-btn-secondary.active {
    color: var(--z-text-primary);
}

/* ==========================================================================
   BOTTOM NAVIGATION
   ========================================================================== */
.z-bottom-nav {
    position: fixed;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 64px;
    background: var(--z-bg-base);
    display: flex;
    justify-content: space-around;
    align-items: center;
    z-index: var(--z-zindex-nav);
    border-top: 1px solid rgba(255,255,255,0.1);
}

.z-nav-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: var(--z-text-secondary);
    cursor: pointer;
    width: 33%;
    height: 100%;
}

.z-nav-item.active {
    color: var(--z-text-primary);
}

.z-nav-icon svg {
    width: 24px;
    height: 24px;
    fill: currentColor;
    margin-bottom: 4px;
}

.z-nav-label {
    font-size: 10px;
    font-weight: 500;
}
            `;
            document.head.appendChild(style);
            logger.info('CSSInjector', 'Stylesheet injected successfully.');
        }
    }
    window.ZENITH_CORE.CSSInjector = CSSInjector;
    
    // Trigger CSS Injection immediately
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', CSSInjector.inject);
    } else {
        CSSInjector.inject();
    }
    // LINE COUNT TRACKER: FINAL FOR PART 7 (Line ~2715)
