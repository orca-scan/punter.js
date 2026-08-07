
/**
 * Simple 2D game engine
 */
(function (global) {

    'use strict';

    if (!window.fetch) throw new Error('window.fetch does not exist, are you missing a polyfill?');
    if (!window.Promise) throw new Error('window.Promise does not exist, are you missing a polyfill?');

    var _debuggingEnabled = false;
    var _debugBackgroundColor = '';
    var _debugTextColor = '';
    var _debugFont = '';
    var log = (typeof SimpleLog === 'function') ? new SimpleLog('punter.js', '#6899E1', true) : console.log.bind(console, '[punter.js]'); // eslint-disable-line no-console

    var images = {};
    var sounds = {};
    var _activeSounds = {};
    var audioCtx = new (window.AudioContext || window.webkitAudioContext)(); // parens required so 'new' applies to the resolved constructor

    // unlock on first user gesture; iOS Safari suspends AudioContext until then
    function _removeUnlockListeners() {
        document.removeEventListener('touchstart', _unlockAudio, true);
        document.removeEventListener('touchend', _unlockAudio, true);
        document.removeEventListener('pointerdown', _unlockAudio, true);
        document.removeEventListener('mousedown', _unlockAudio, true);
        document.removeEventListener('keydown', _unlockAudio, true);
    }
    function _unlockAudio() {
        if (audioCtx.state === 'running') {
            _removeUnlockListeners();
            return;
        }
        audioCtx.resume().then(function () {
            _removeUnlockListeners();
        });
        // play a silent buffer inside the gesture to satisfy iOS Safari
        try {
            var buf = audioCtx.createBuffer(1, 1, 22050);
            var src = audioCtx.createBufferSource();
            src.buffer = buf;
            src.connect(audioCtx.destination);
            src.start(0);
        } catch (e) { /* non-fatal if context is not yet usable */ }
    }
    document.addEventListener('touchstart', _unlockAudio, true);
    document.addEventListener('touchend', _unlockAudio, true);
    document.addEventListener('pointerdown', _unlockAudio, true);
    document.addEventListener('mousedown', _unlockAudio, true);
    document.addEventListener('keydown', _unlockAudio, true);

    // re-resume after iOS audio interruptions (phone calls, Siri, app switch)
    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible' && audioCtx.state !== 'running') {
            audioCtx.resume();
        }
    });
    window.addEventListener('focus', function () {
        if (audioCtx.state !== 'running') audioCtx.resume();
    });

    var _isMobile = /Mobi|Android|iPhone/i.test(navigator.userAgent);

    var _canvas;
    var _canvasCtx;
    var _boundsCanvas;
    var _dpr = Math.min(window.devicePixelRatio || 1, 2);
    var _renderScale = _dpr; // full transform from game coords to buffer pixels
    var _width = 0;
    var _height = 0;
    var _boundsCtx;
    var _initilised = false;
    var _scenes = {};
    var _currentScene = null;
    var _pendingGo = null;  // scene name queued before init completes
    var _paused = false;
    var _frame = 0;
    var _loopId = null;
    var _loopLast = 0;
    var _loopAccumulator = 0;
    var _loopStep = 1000 / 60;
    var _loopAlpha = 1; // interpolation fraction between previous and current position
    var _loopFps = 0;
    var _loopFpsCounter = 0;
    var _loopFpsTimer = 0;
    var _collisionMaskSize = 12;
    var _collisionSampleMax = 12;
    var _sprites = {}; // key: id, value: sprite
    var _spriteCounter = 0; // auto-increments when no id is supplied to createSprite
    var eventHandlers = {
        ready: function() {},
        update: function() {},
        draw: null,
        resize: function() {},
        go: function() {}
    };
    var htmlEl = document.documentElement;

    htmlEl.setAttribute('data-punter-loading', 'true');

    var keys = {};
    var pointer = { x: 0, y: 0, clicked: false, down: false, swiped: false, swipedUp: false, swipedDown: false, swipedLeft: false, swipedRight: false, swipeDistance: 0 };
    var _pointerButtons = { left: false, middle: false, right: false };
    var _swipeStartX = 0;
    var _swipeStartY = 0;
    var _swipeActive = false;

    // maps friendly key names to browser KeyboardEvent.key values
    var keyAliases = {
        'left':      'ArrowLeft',
        'right':     'ArrowRight',
        'up':        'ArrowUp',
        'down':      'ArrowDown',
        'space':     ' ',
        'enter':     'Enter',
        'escape':    'Escape',
        'esc':       'Escape',
        'shift':     'Shift',
        'ctrl':      'Control',
        'control':   'Control',
        'alt':       'Alt',
        'tab':       'Tab',
        'backspace': 'Backspace'
    };

    // store keys lowercase so isKeyDown('a') works even when caps lock is on
    window.addEventListener('keydown', function (e) {
        var k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
        keys[k] = true;
    });
    window.addEventListener('keyup', function (e) {
        var k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
        keys[k] = false;
    });

    // maps e.button number to a button name
    function buttonName(n) {
        if (n === 1) return 'middle';
        if (n === 2) return 'right';
        return 'left';
    }

    /**
     * Maps client coordinates to canvas-local coordinates and updates pointer.x/y
     * @param {number} clientX - client X coordinate of the input event
     * @param {number} clientY - client Y coordinate of the input event
     * @returns {void}
     */
    function updatePointerPosition(clientX, clientY) {
        if (!_canvas) { pointer.x = clientX; pointer.y = clientY; return; }
        var rect = _canvas.getBoundingClientRect();
        var scaleX = _width / rect.width;
        var scaleY = _height / rect.height;
        pointer.x = Math.round((clientX - rect.left) * scaleX);
        pointer.y = Math.round((clientY - rect.top) * scaleY);
    }

    // records touch/click start position for gesture classification on release
    function registerPress(clientX, clientY) {
        updatePointerPosition(clientX, clientY);
        _swipeStartX = pointer.x;
        _swipeStartY = pointer.y;
        _swipeActive = true;
    }

    // classifies a completed touch/click as a tap (clicked) or a swipe with direction
    function classifyGesture() {
        if (!_swipeActive) return;
        var dx = pointer.x - _swipeStartX;
        var dy = pointer.y - _swipeStartY;
        var distance = Math.sqrt(dx * dx + dy * dy);
        var threshold = Math.max(_width * 0.04, 10);
        if (distance < threshold) {
            pointer.clicked = true;
        } else {
            pointer.swiped = true;
            pointer.swipeDistance = Math.round(distance);
            if (Math.abs(dx) > Math.abs(dy)) {
                if (dx < 0) pointer.swipedLeft = true;
                else pointer.swipedRight = true;
            } else {
                if (dy < 0) pointer.swipedUp = true;
                else pointer.swipedDown = true;
            }
        }
        _swipeActive = false;
    }

    if (window.PointerEvent) {

        // Pointer Events: one unified API covering mouse, touch, and stylus/pen
        document.addEventListener('pointerdown', function (e) {
            var btn = buttonName(e.button);
            _pointerButtons[btn] = true;
            pointer.down = _pointerButtons.left;
            if (e.button === 0) registerPress(e.clientX, e.clientY);
        });

        document.addEventListener('pointerup', function (e) {
            var btn = buttonName(e.button);
            if (e.button === 0) {
                updatePointerPosition(e.clientX, e.clientY);
                classifyGesture();
            }
            _pointerButtons[btn] = false;
            pointer.down = _pointerButtons.left;
        });

        document.addEventListener('pointercancel', function (e) {
            var btn = buttonName(e.button);
            _pointerButtons[btn] = false;
            pointer.down = _pointerButtons.left;
            _swipeActive = false;
        });

        document.addEventListener('pointermove', function (e) {
            updatePointerPosition(e.clientX, e.clientY);
        });

    } else {

        // fallback for browsers without Pointer Events (old Safari, etc.)
        document.addEventListener('touchstart', function (e) {
            e.preventDefault();
            if (e.touches.length) {
                _pointerButtons.left = true;
                pointer.down = true;
                var touch = e.touches[0];
                registerPress(touch.clientX, touch.clientY);
            }
        }, { capture: true });

        document.addEventListener('touchmove', function (e) {
            if (e.touches.length) {
                updatePointerPosition(e.touches[0].clientX, e.touches[0].clientY);
            }
        }, { passive: true });

        document.addEventListener('touchend', function () {
            classifyGesture();
            _pointerButtons.left = false;
            pointer.down = false;
        });

        document.addEventListener('touchcancel', function () {
            _swipeActive = false;
            _pointerButtons.left = false;
            pointer.down = false;
        });

        document.addEventListener('mousedown', function (e) {
            var btn = buttonName(e.button);
            _pointerButtons[btn] = true;
            pointer.down = _pointerButtons.left;
            if (e.button === 0) registerPress(e.clientX, e.clientY);
        });

        document.addEventListener('mouseup', function (e) {
            var btn = buttonName(e.button);
            if (e.button === 0) {
                updatePointerPosition(e.clientX, e.clientY);
                classifyGesture();
            }
            _pointerButtons[btn] = false;
            pointer.down = _pointerButtons.left;
        });

        document.addEventListener('mousemove', function (e) {
            updatePointerPosition(e.clientX, e.clientY);
        });
    }

    /**
     * boundingCache - Simple fixed-size cache for sprite bounds
     * Used to avoid re-running getBounds() on sprites
     */
    var boundingCache = (function () {
        var MAX = 1000;
        var store = Object.create(null);
        var cacheKeys = [];
        
        return {
            get: function (key) {
                return store[key] || null;
            },
            set: function (key, value) {
                if (!store[key]) {
                    if (cacheKeys.length >= MAX) {
                        var oldest = cacheKeys.shift();
                        delete store[oldest];
                    }
                    cacheKeys.push(key);
                }
                store[key] = value;
            }
        };
    })();

    /**
     * Initialises the engine with canvas, images, sounds, and buttons
     * @param {Object} config - configuration object
     * @returns {void}
     */
    function setup(config) {

        config = config || {};

        _debuggingEnabled = (config.debug === true);

        if (typeof config.canvas === 'string') {
            _canvas = document.querySelector(config.canvas);
            if (!_canvas) throw new Error('punter.setup: could not find a canvas element matching "' + config.canvas + '". Check your selector and that the <canvas> element exists in the HTML.');
        }
        else if (config.canvas instanceof HTMLCanvasElement) {
            _canvas = config.canvas;
        }
        else {
            throw new Error('punter.setup: canvas must be a CSS selector string or a <canvas> element.');
        }

        // ensure canvas has correct styles
        _canvas.style.display = 'block';
        _canvas.style.position = 'absolute';
        _canvas.style.top = '50%';
        _canvas.style.left = '50%';
        _canvas.style.bottom = '';
        _canvas.style.right = '';
        _canvas.style.transformOrigin = 'center center';
        _canvas.style.imageRendering = '';
        _canvas.style.touchAction = 'none';
        _canvas.style.overflow = 'hidden';
        _canvas.style.webkitTouchCallout = 'none';
        _canvas.style.webkitTapHighlightColor = 'transparent';
        _canvas.style.pointerEvents = 'none';
        _canvas.style.contain = 'strict';
        _canvas.style.willChange = 'transform';
        _canvas.style.transform = 'translateZ(0)';

        setTimeout(resize, 0); // defer to let the browser apply canvas styles before measuring
        setupResponsiveResize();

        // create a background canvas to speed up getBounds
        _boundsCanvas = document.createElement('canvas');
        _boundsCtx = _boundsCanvas.getContext('2d', { willReadFrequently: true });

        loadImages(config.images || {}).then(function() {
            return loadSounds(config.sounds || {});
        })
        .then(function() {
            _initilised = true;
            htmlEl.removeAttribute('data-punter-loading');
            eventHandlers.ready();
            if (_pendingGo) { engine.go(_pendingGo); _pendingGo = null; }
        })
        .catch(function(err) {
            _initilised = false;
            htmlEl.removeAttribute('data-punter-loading');
            htmlEl.setAttribute('data-punter-error', (err && err.message) ? err.message : 'unknown error');
            log(err);
        });
    }

    /**
     * Loads and decodes all images
     * @param {Object} images - Key-value map of image keys to image URLs
     * @returns {Promise} - Resolves when all images are loaded and decoded
     */
    function loadImages(imageMap) {

        var imageKeys = Object.keys(imageMap);
        var total = imageKeys.length;

        if (!total) return Promise.resolve();

        return new Promise(function (resolve, reject) {
            var loaded = 0;
            var failed = false;

            /**
             * Handles successful image load, caches bounds, and resolves when all images are ready
             * @param {string} key - image key from the config map
             * @returns {void}
             */
            function handleLoad(key) {
                var self = this;

                self.onload = null;
                self.onerror = null;

                function finalize() {
                    
                    images[key] = self;

                    // precompute and cache bounding box for this sprite key
                    if (!boundingCache.get(key)) {
                        var bounds = getBounds(self, 1);
                        boundingCache.set(key, bounds);
                    }

                    loaded++;
                    if (loaded === total && !failed) resolve();
                }

                // only decode after image is fully loaded
                if (typeof self.decode === 'function') {
                    self.decode().then(finalize).catch(finalize); // decode may fail, not fatal
                } else {
                    finalize();
                }
            }

            /**
             * Handles image load failure and rejects the loading promise
             * @param {string} key - image key that failed to load
             * @param {string} url - URL that was attempted
             * @returns {void}
             */
            function handleError(key, url) {
                this.onload = null;
                this.onerror = null;
                if (failed) return;
                failed = true;
                reject(new Error('Failed to load sprite "' + key + '" from ' + url));
            }

            /**
             * Parses a numeric value from an SVG attribute, ignoring non-px units
             * @param {string|null} val - attribute value
             * @returns {number} parsed number or NaN if unusable
             */
            function parseSvgDimension(val) {
                if (!val) return NaN;
                var trimmed = val.trim();
                // reject non-px units (%, em, cm, in, pt, etc.)
                if (/[^0-9.\-]/.test(trimmed.replace(/px$/i, ''))) return NaN;
                return parseFloat(trimmed);
            }

            /**
             * Fetches an SVG, infers missing viewBox/width/height, then loads it as an image
             * @param {string} key - image key
             * @param {string} url - SVG file URL
             */
            function loadSvg(key, url) {
                fetch(url).then(function (res) {
                    return res.text();
                }).then(function (text) {
                    var doc = new DOMParser().parseFromString(text, 'image/svg+xml');
                    var svg = doc.querySelector('svg');

                    if (!svg) {
                        if (failed) return;
                        failed = true;
                        reject(new Error('SVG "' + key + '" is not a valid SVG document'));
                        return;
                    }

                    var vb = svg.getAttribute('viewBox');
                    var w = parseSvgDimension(svg.getAttribute('width'));
                    var h = parseSvgDimension(svg.getAttribute('height'));

                    // extract dimensions from viewBox if present
                    var vbW = NaN;
                    var vbH = NaN;
                    if (vb) {
                        var parts = vb.trim().split(/[\s,]+/);
                        if (parts.length === 4) {
                            vbW = parseFloat(parts[2]);
                            vbH = parseFloat(parts[3]);
                        }
                    }

                    // infer missing attributes from what we have
                    if (!isNaN(vbW) && !isNaN(vbH)) {
                        if (isNaN(w)) { w = vbW; svg.setAttribute('width', String(w)); }
                        if (isNaN(h)) { h = vbH; svg.setAttribute('height', String(h)); }
                    } else if (!isNaN(w) && !isNaN(h)) {
                        svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
                    } else {
                        if (failed) return;
                        failed = true;
                        reject(new Error('SVG "' + key + '" must have either a viewBox or numeric width and height attributes'));
                        return;
                    }

                    // rasterize SVGs at higher resolution so they stay crisp on large screens
                    var svgUpscale = Math.max(_dpr, 2);
                    svg.setAttribute('width', String(w * svgUpscale));
                    svg.setAttribute('height', String(h * svgUpscale));

                    var svgText = new XMLSerializer().serializeToString(svg);
                    var blob = new Blob([svgText], { type: 'image/svg+xml' });
                    var img = new Image();
                    img.key = key;
                    img._logicalW = w;
                    img._logicalH = h;
                    img.onload = handleLoad.bind(img, key);
                    img.onerror = handleError.bind(img, key, url);
                    img.src = URL.createObjectURL(blob);
                })
                .catch(function () {
                    if (failed) return;
                    failed = true;
                    reject(new Error('Failed to load sprite "' + key + '" from ' + url));
                });
            }

            for (var i = 0; i < total; i++) {
                var key = imageKeys[i];
                var url = imageMap[key];

                if (url.toLowerCase().indexOf('.svg') !== -1) {
                    loadSvg(key, url);
                }
                else {
                    var img = new Image();
                    img.key = key;
                    img.onload = handleLoad.bind(img, key);
                    img.onerror = handleError.bind(img, key, url);
                    img.src = url;
                }
            }
        });
    }

    /**
     * Fetches, decodes, and stores all audio buffers for later use with playSound
     * @param {Object} audioMap - key-value map of sound names to audio file URLs
     * @returns {Promise} resolves when all sounds are decoded and ready to play
     */
    function loadSounds(audioMap) {

        var soundKeys = Object.keys(audioMap);
        var total = soundKeys.length;
        if (!total) return Promise.resolve();

        return new Promise(function (resolve, reject) {
            var loaded = 0;
            var failed = false;

            function handleSuccess(key, buffer) {
                sounds[key] = buffer;
                loaded++;
                if (loaded === total && !failed) resolve();
            }

            function handleError(key, url) {
                if (failed) return;
                failed = true;
                reject(new Error('Failed to load sound "' + key + '" from ' + url));
            }

            function decodeAndStore(key, url, buf) {
                audioCtx.decodeAudioData(buf, function (decoded) {
                    handleSuccess(key, decoded);
                }, function () {
                    handleError(key, url);
                });
            }

            for (var i = 0; i < total; i++) {
                // iife captures key and url per-iteration (var has no block scope)
                (function (key, url) {
                    fetch(url).then(function (res) {
                        return res.arrayBuffer();
                    }).then(function (buffer) {
                        decodeAndStore(key, url, buffer);
                    }).catch(function () {
                        handleError(key, url);
                    });
                })(soundKeys[i], audioMap[soundKeys[i]]);
            }
        });
    }

    /**
     * Returns the logical width of an image (original size before SVG upscaling)
     * @param {HTMLImageElement} img
     * @returns {number}
     */
    function imgLogicalW(img) {
        return img._logicalW || img.naturalWidth;
    }

    /**
     * Returns the logical height of an image (original size before SVG upscaling)
     * @param {HTMLImageElement} img
     * @returns {number}
     */
    function imgLogicalH(img) {
        return img._logicalH || img.naturalHeight;
    }

    /**
     * Resolves a size from number or percentage string
     * @param {number|string|null} value - Size value (e.g. 100 or '25%')
     * @param {number} base - Base size to use for percentage
     * @returns {number} resolved pixel size or -1 if invalid
     */
    function resolveSize(value, base) {
        if (typeof value === 'string' && value.indexOf('%') !== -1) {
            var pct = parseFloat(value);
            if (!isNaN(pct)) {
                return Math.floor(base * (pct / 100)); // floor to avoid sub-pixel gaps
            }
        }
        else if (typeof value === 'number') {
            return Math.floor(value);
        }

        return -1;
    }

    /**
     * Resolves an x or y position from number or percentage string
     * @param {number|string|null} val - Position value (e.g. 100 or '25%')
     * @param {number} base - Base value (canvas width or height)
     * @param {number} scale - Scale factor for numeric values
     * @param {number} lastValue - Previous pixel value (for scaling)
     * @returns {number} resolved pixel position
     */
    function resolvePosition(val, base, scale, lastValue) {
        if (typeof val === 'string' && val.indexOf('%') !== -1) {
            return resolveSize(val, base); // re-evaluate based on updated base
        }

        if (typeof val === 'number') {
            return Math.floor(val * scale); // scale the original numeric value
        }

        return Math.floor(lastValue); // fallback to previous
    }

    /**
     * Finalizes sprite size using aspect ratio if needed
     * @param {number|null} w - Initial width or null
     * @param {number|null} h - Initial height or null
     * @param {boolean} preserveAspect - Whether to preserve aspect ratio
     * @param {number} ar - Aspect ratio (width / height)
     * @param {number} imgW - Image natural width
     * @param {number} imgH - Image natural height
     * @returns {{ w: number, h: number }} - Final width and height
     */
    function finalizeSize(w, h, preserveAspect, ar, imgW, imgH) {

        var finalW = w;
        var finalH = h;

        if (preserveAspect) {

            if (finalW && !finalH) {
                finalH = finalW / ar;
            }
            else if (!finalW && finalH) {
                finalW = finalH * ar;
            }
            else if (!finalW && !finalH) {
                finalW = imgW;
                finalH = imgH;
            }
            // if both are provided, do not override aspect — trust the values
        }
        else {
            if (!finalW) finalW = imgW;
            if (!finalH) finalH = imgH;
        }

        return {
            w: Math.floor(finalW),
            h: Math.floor(finalH)
        };
    }

    /**
     * Draws width x height and x y labels near sprite
     * @param {CanvasRenderingContext2D} ctx - canvas drawing context
     * @param {number} dx - x position of the sprite
     * @param {number} dy - y position of the sprite
     * @param {number} dw - draw width of the sprite
     * @param {number} dh - draw height of the sprite
     * @param {number} canvasW - width of the canvas
     * @param {number} canvasH - height of the canvas
     * @returns {void}
     */
    function drawSpriteLabels(ctx, dx, dy, dw, dh, canvasW, canvasH) {

        var label = [
            'x=' + Math.floor(dx) + ' ',
            'y=' + Math.floor(dy) + ' ',
            '(' + Math.floor(dw) + 'x' + Math.floor(dh) + ')'
        ].join('');

        ctx.font = _debugFont;
        ctx.textAlign = 'left';
        var metrics = ctx.measureText(label);
        var textWidth = metrics.width;

        var ascent = metrics.actualBoundingBoxAscent || 10;
        var descent = metrics.actualBoundingBoxDescent || 4;
        var textHeight = ascent + descent;

        // center over the sprite, then clamp so the label stays within the canvas
        var textX = Math.floor(dx + (dw - textWidth) / 2);
        textX = Math.max(2, Math.min(textX, canvasW - Math.ceil(textWidth) - 4));
        var textY;

        if (dy + dh + textHeight + 6 < canvasH) {
            textY = dy + dh + ascent + 4;   // baseline 4px below sprite bottom
        }
        else {
            textY = dy - descent - 4;       // baseline 4px above sprite top
        }

        // draw background box — 2px padding around the actual glyph bounds
        ctx.fillStyle = _debugBackgroundColor;
        ctx.fillRect(textX - 2, textY - ascent - 2, textWidth + 4, textHeight + 4);

        // draw text
        ctx.fillStyle = _debugTextColor;
        ctx.fillText(label, textX, textY);
    }

    /**
     * Renders debug info overlay in bottom-right corner of canvas
     * @param {CanvasRenderingContext2D} ctx - canvas drawing context
     * @param {number} frame - current frame count
     * @param {number} fps - current frames per second
     * @param {number} canvasW - canvas width
     * @param {number} canvasH - canvas height
     * @returns {void}
     */
    function drawDebugInfo(ctx, frame, fps, canvasW, canvasH) {

        var pad = 10;
        var textPad = 4;

        var label = 'Frame: ' + frame + '  |  FPS: ' + fps + '  |  Canvas: ' + canvasW + 'x' + canvasH + ' | ' + engine.orientation;

        ctx.font = _debugFont;
        ctx.textAlign = 'left';

        var metrics = ctx.measureText(label);
        var textW = metrics.width;

        var ascent = metrics.actualBoundingBoxAscent || 10;
        var descent = metrics.actualBoundingBoxDescent || 4;
        var textH = ascent + descent;

        var boxW = textW + textPad * 2;
        var boxH = textH + textPad * 2;

        var boxX = canvasW - boxW - pad;
        var boxY = canvasH - boxH - pad;

        ctx.fillStyle = _debugBackgroundColor;
        ctx.fillRect(boxX, boxY, boxW, boxH);

        ctx.fillStyle = _debugTextColor;
        ctx.fillText(label, boxX + textPad, boxY + textPad + ascent);
    }

    /**
     * Gets a CSS variable from :root
     * @param {string} name - css variable name (without --)
     * @param {string} fallback - fallback value if not found
     * @returns {string} resolved css value
     */
    function getCssVar(name, fallback) {
        var rootStyles = getComputedStyle(document.documentElement);
        return rootStyles.getPropertyValue('--' + name).trim() || fallback;
    }

    /**
     * Creates a sprite with optional animation, scaling, and collision bounds.
     * Supply image, vector, or both — image draws first, vector draws on top.
     * @param {Object} opts - Sprite config
     * @param {string} [opts.id] - unique id for the sprite; auto-generated if omitted
     * @param {string|string[]} [opts.image] - image name from config.images (use array for animations)
     * @param {Function} [opts.vector] - draw function called each frame with (ctx, w, h); ctx is pre-translated to the sprite's position
     * @param {number} opts.x - x position
     * @param {number} opts.y - y position
     * @param {number} [opts.w] - width (required when using vector without image)
     * @param {number} [opts.h] - height (required when using vector without image)
     * @param {boolean} [opts.preserveAspect=true] - maintain image aspect ratio
     * @param {boolean} [collidable=true] - whether to compute collision bounds (default = true)
     * @returns {Object} new sprite object
     */
    function Sprite(opts) {

        if (!opts || typeof opts !== 'object') throw new Error('punter.createSprite: pass a config object, e.g. { image: "player", x: 50, y: 100 }.');
        if (!opts.image && typeof opts.vector !== 'function') throw new Error('punter.createSprite: set image, vector, or both. e.g. image: "player" or vector: function(ctx, w, h) { ... }');
        if (!opts.image && typeof opts.vector === 'function' && (typeof opts.w === 'undefined' || typeof opts.h === 'undefined')) throw new Error('punter.createSprite: vector sprites need w and h since there is no image to measure. e.g. w: 40, h: 40');
        if (typeof opts.x === 'undefined') throw new Error('punter.createSprite: missing x. Set x to a pixel position, e.g. x: 100.');
        if (typeof opts.y === 'undefined') throw new Error('punter.createSprite: missing y. Set y to a pixel position, e.g. y: 100.');

        // option values — id is optional; auto-generate one when not provided
        this.id = opts.id || ('sprite_' + (++_spriteCounter));
        if (_sprites[this.id]) throw new Error('punter.createSprite: a sprite with id "' + this.id + '" already exists. Each sprite needs a unique id.');
        this.image = opts.image || null;
        this.vector = typeof opts.vector === 'function' ? opts.vector : null;
        this.preserveAspect = (opts.preserveAspect !== false);
        this.collidable = (opts.collidable !== false);
        // default: vectors use 'rect', images use 'pixel'; explicit boundsMode overrides
        this.boundsMode = opts.boundsMode === 'rect' ? 'rect'
            : opts.boundsMode === 'pixel' ? 'pixel'
            : (!opts.image && this.vector) ? 'rect' : 'pixel';
        this.outline = (typeof opts.outline === 'string') ? opts.outline : null;
        this.frame = null; // optional override by game logic
        this.repeatX = (opts.repeatX === true);
        this.repeatY = (opts.repeatY === true);
        this.clipHeight = (typeof opts.clipHeight === 'number') ? opts.clipHeight : null;
        this.clipFrom = opts.clipFrom === 'top' ? 'top' : 'bottom';

        // w/h
        this.originalW = (typeof opts.w !== 'undefined') ? opts.w : null;
        this.originalH = (typeof opts.h !== 'undefined') ? opts.h : null;
        this.originalCanvasW = engine.width;  // canvas size at creation; used to calc scale factors on resize
        this.originalCanvasH = engine.height;
        this.w = resolveSize(opts.w, engine.width);
        this.h = resolveSize(opts.h, engine.height);
        if (this.w < 0) this.w = null;
        if (this.h < 0) this.h = null;

        // x/y
        this.originalX = (typeof opts.x !== 'undefined') ? opts.x : 0;
        this.originalY = (typeof opts.y !== 'undefined') ? opts.y : 0;
        this.x = resolveSize(this.originalX, engine.width);
        this.y = resolveSize(this.originalY, engine.height);
        if (this.x < 0) this.x = 0; // resolveSize returns -1 for invalid values
        if (this.y < 0) this.y = 0;
        this.initialX = this.x; // anchor used by bounce() and centerX/Y()
        this.initialY = this.y;

        if (this.repeatX && this.repeatY) {
            throw new Error('Sprite: cannot set both repeatX and repeatY');
        }

        this._frameIndex = 0;
        this._animated = Array.isArray(this.image);

        if (this.image) {
            var initialDrawKey = Array.isArray(this.image) ? this.image[0] : this.image;
            var img = images[initialDrawKey];

            if (!img || !img.complete || !img.naturalWidth) {
                throw new Error('punter.createSprite: image "' + initialDrawKey + '" was not found. Add it to the images in punter.setup({ images: { "' + initialDrawKey + '": "path/to/image.png" } }).');
            }

            // infer size from the image if w or h were not provided
            this.aspectRatio = imgLogicalH(img) > 0 ? imgLogicalW(img) / imgLogicalH(img) : 1;

            var finalSize = finalizeSize(this.w, this.h, this.preserveAspect, this.aspectRatio, imgLogicalW(img), imgLogicalH(img));
            this.w = finalSize.w;
            this.h = finalSize.h;

            // pre-cache relBounds so isCollidingWith works from frame 1
            if (this.collidable && this.boundsMode === 'pixel') {
                this.relBounds = boundingCache.get(initialDrawKey);
                if (!this.relBounds) {
                    this.relBounds = getBounds(img, 1);
                    boundingCache.set(initialDrawKey, this.relBounds);
                }
                this._lastBoundsKey = initialDrawKey;
                this._baseMaskAngle = 0;
                this._srcW = img.naturalWidth;
                this._srcH = img.naturalHeight;
            }
        } else {
            // vector-only sprite — w and h were validated above, no image to measure
            this.aspectRatio = 1;

            // rasterise vector function to build pixel mask when requested
            if (this.collidable && this.boundsMode === 'pixel') {
                this.relBounds = getVectorBounds(this, this.w, this.h);
                this._baseMaskAngle = this.angle || 0;
                this._srcW = this.w;
                this._srcH = this.h;
            }
        }

        if (this.collidable) this._refreshBounds();

        this._prevX = this.x;
        this._prevY = this.y;

        // cache sprite in memory
        _sprites[this.id] = this;
    }
    /**
     * Returns the image key for the current animation frame
     * @returns {string} image key to look up in the loaded images map
     */
    Sprite.prototype.getFrameImage = function () {
        if (!this._animated) return this.image;

        var index = (typeof this.frame === 'number' && this.frame >= 0) ? this.frame : this._frameIndex;

        return this.image[index % this.image.length];
    };
    /**
     * Draws the sprite onto the canvas, handling clipping, offscreen culling, outlines, and debug overlays
     * @param {CanvasRenderingContext2D} [ctx] - canvas context to draw into; defaults to the main game canvas
     * @returns {void}
     */
    Sprite.prototype.draw = function (ctx) {

        ctx = ctx || _canvasCtx;

        if (this.destroyed) return;

        // blink: skip draw on the hidden phase; auto-clear state once duration expires
        if (typeof this._blinkStart === 'number') {
            var blinkElapsed = Date.now() - this._blinkStart;
            if (this._blinkDuration > 0 && blinkElapsed >= this._blinkDuration) {
                this._blinkStart = null; // duration expired — stop blinking, stay visible
            } else if (Math.floor(blinkElapsed / this._blinkMs) % 2 !== 0) {
                return; // hidden phase
            }
        }

        // always track visibility for seen
        if (!this._seen && this.visible) {
            this._seen = true;
        }

        if (this.repeatX) return this.drawRepeatX(ctx);
        if (this.repeatY) return this.drawRepeatY(ctx);

        // vector-only sprite: call the vector function and return early
        if (!this.image && this.vector) {
            var vx = this._lerpX();
            var vy = this._lerpY();
            var vw = Math.floor(this.w);
            var vh = Math.floor(this.h);

            // skip draw if fully offscreen
            if (vx + vw <= 0 || vy + vh <= 0 || vx >= engine.width || vy >= engine.height) return;

            ctx.save();
            ctx.translate(vx, vy);
            this.vector(ctx, vw, vh);
            ctx.restore();

            if (_debuggingEnabled) {
                drawSpriteLabels(ctx, vx, vy, vw, vh, engine.width, engine.height);
            }
            return;
        }

        var drawKey = this.getFrameImage();               // frame key to draw (single or animated)
        var img = images[drawKey];                      // loaded image object
        if (!img || !img.complete || !img.naturalWidth) return;

        var dw = Math.floor(this.w);    // draw width (scaled)
        var dh = Math.floor(this.h);    // draw height (scaled)
        var dx = this._lerpX();         // draw x position (interpolated)
        var dy = this._lerpY();         // draw y position (interpolated)

        var canvasW = engine.width;    // canvas width
        var canvasH = engine.height;   // canvas height

        // rotated images skip manual clipping and let the canvas clip naturally
        if (this.angle) {
            // expanded offscreen check for rotated sprite
            var halfDiag = Math.ceil(Math.sqrt(dw * dw + dh * dh) / 2);
            var centerX = dx + dw / 2;
            var centerY = dy + dh / 2;
            if (centerX + halfDiag <= 0 || centerX - halfDiag >= canvasW ||
                centerY + halfDiag <= 0 || centerY - halfDiag >= canvasH) return;

            ctx.save();
            ctx.translate(centerX, centerY);
            ctx.rotate(this.angle);
            ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);

            if (this.vector) {
                ctx.translate(-dw / 2, -dh / 2);
                this.vector(ctx, dw, dh);
            }

            if (this.outline) {
                ctx.strokeStyle = this.outline;
                ctx.lineWidth = 1;
                ctx.strokeRect(-dw / 2, -dh / 2, dw, dh);
            }
            ctx.restore();

            if (_debuggingEnabled) {
                drawSpriteLabels(ctx, dx, dy, dw, dh, canvasW, canvasH);
            }
            return;
        }

        // skip draw if fully offscreen
        if (dx + dw <= 0 || dy + dh <= 0 || dx >= canvasW || dy >= canvasH) return;

        var sx = 0;                                     // source crop x
        var sy = 0;                                     // source crop y
        var sw = img.naturalWidth;                      // source width
        var sh = img.naturalHeight;                     // source height

        // vertical clipping if clipHeight is set
        if (this.clipHeight !== null && this.clipHeight < dh) {
            var ratio = this.clipHeight / dh;           // visible ratio
            sh = sh * ratio;                            // shrink source height
            dh = this.clipHeight;                       // limit draw height

            if (this.clipFrom === 'bottom') {
                sy = img.naturalHeight - sh;            // shift crop from bottom
            }
        }

        // clip top if above canvas
        if (dy < 0) {
            sy += (-dy / dh) * sh;                      // shift crop y
            sh -= (-dy / dh) * sh;                      // reduce source height
            dh += dy;                                   // reduce draw height
            dy = 0;
        }
        else if (dy + dh > canvasH) {
            var overflow = (dy + dh) - canvasH;         // overflow bottom
            sh -= (overflow / dh) * sh;                 // reduce crop height
            dh -= overflow;                             // reduce draw height
        }

        // clip left if off left edge
        if (dx < 0) {
            sx = (-dx / dw) * sw;                       // shift crop x
            sw -= sx;                                   // reduce crop width
            dw += dx;                                   // reduce draw width
            dx = 0;
        }
        else if (dx + dw > canvasW) {
            overflow = (dx + dw) - canvasW;             // overflow right
            sw -= (overflow / dw) * sw;                 // reduce crop width
            dw -= overflow;                             // reduce draw width
        }

        // draw if everything valid
        if (dw > 0 && dh > 0 && sw > 0 && sh > 0) {
            ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);

            // if a vector function is also set, draw it on top of the image
            if (this.vector) {
                ctx.save();
                ctx.translate(dx, dy);
                this.vector(ctx, dw, dh);
                ctx.restore();
            }

            if (this.outline) {
                // draw box around the destination area
                ctx.strokeStyle = this.outline; // outline color
                ctx.lineWidth = 1;              // outline thickness
                ctx.strokeRect(dx, dy, dw, dh);
            }
        }

        if (_debuggingEnabled) {
            drawSpriteLabels(ctx, dx, dy, dw, dh, canvasW, canvasH);
        }
    };
    /**
     * Recalculates the sprite's size and position after a canvas resize event
     * @returns {void}
     */
    Sprite.prototype.resize = function () {

        if (this.destroyed) return;

        // vector-only sprite: rescale position and size without needing an image
        if (!this.image && this.vector) {
            // guard against originalCanvasW = 0 (sprite created before first resize)
            var vScaleW = this.originalCanvasW > 0 ? engine.width / this.originalCanvasW : 1;
            var vScaleH = this.originalCanvasH > 0 ? engine.height / this.originalCanvasH : 1;
            var vW = resolveSize(this.originalW, engine.width);
            var vH = resolveSize(this.originalH, engine.height);
            var vX = resolvePosition(this.originalX, engine.width, vScaleW, this.x);
            var vY = resolvePosition(this.originalY, engine.height, vScaleH, this.y);
            this.x = this.initialX = (vX > 0) ? vX : this.x;
            this.y = this.initialY = (vY > 0) ? vY : this.y;
            if (vW > 0) this.w = vW;
            if (vH > 0) this.h = vH;
            this.originalCanvasW = engine.width;
            this.originalCanvasH = engine.height;
            return;
        }

        var imgKey = this.getFrameImage();
        var img = images[imgKey];
        if (!img || !img.complete || !img.naturalWidth) return;

        // if (this.originalCanvasW <= 0 || this.originalCanvasH <= 0) return;

        if (_debuggingEnabled) {
            this._resizeStats = this._resizeStats || [];
            this._resizeStats.push({
                x: this.x,
                y: this.y,
                aw: this.w,
                ah: this.h
            });
        }

        // guard against originalCanvasW = 0 (sprite created before first resize)
        var scaleW = this.originalCanvasW > 0 ? engine.width / this.originalCanvasW : 1;
        var scaleH = this.originalCanvasH > 0 ? engine.height / this.originalCanvasH : 1;

        // scale proportionally
        var resolvedW = resolveSize(this.originalW, engine.width);
        var resolvedH = resolveSize(this.originalH, engine.height);
        var resolvedX = resolvePosition(this.originalX, engine.width, scaleW, this.x);
        var resolvedY = resolvePosition(this.originalY, engine.height, scaleH, this.y);

        this.w = (resolvedW > 0) ? resolvedW : null;
        this.h = (resolvedH > 0) ? resolvedH : null;
        this.x = this.initialX = (resolvedX > 0) ? resolvedX : this.x;
        this.y = this.initialY = (resolvedY > 0) ? resolvedY : this.y;

        // now get the final size
        var finalSize = finalizeSize(this.w, this.h, this.preserveAspect, this.aspectRatio, imgLogicalW(img), imgLogicalH(img));
        this.w = finalSize.w;
        this.h = finalSize.h;

        log('Resize', this.id, {
            orientation: engine.orientation,
            canvasW: engine.width,
            canvasH: engine.height,
            originalW: this.originalW,
            originalH: this.originalH,
            resolvedW: resolvedW,
            resolvedH: resolvedH,
            finalW: this.w,
            finalH: this.h,
            originalX: this.originalX,
            originalY: this.originalY,
            resolvedX: resolvedX,
            resolvedY: resolvedY
        });

        if (this.collidable && !this.repeatX && !this.repeatY) {
            this._refreshBounds();
        }

        // now update canvas ref so future resize is from here
        this.originalCanvasW = engine.width;
        this.originalCanvasH = engine.height;
    };
    /**
     * Draws the sprite tiled horizontally across the full canvas width; used for repeating backgrounds
     * @param {CanvasRenderingContext2D} ctx - canvas context to draw into
     * @returns {void}
     */
    Sprite.prototype.drawRepeatX = function (ctx) {

        var imgKey = this.getFrameImage();
        var img = images[imgKey];
        if (!img || !img.complete || !img.naturalWidth) return;

        var x = this._lerpX();
        var y = this._lerpY();
        var w = this.w;
        var h = this.h;

        if (w <= 0 || h <= 0) return;

        var sw = img.naturalWidth;
        var sh = img.naturalHeight;

        var startX = Math.floor(x % w);

        // start one tile before the viewport to fill the gap when scrolled left
        for (var px = startX - w; px < engine.width; px += w) {
            ctx.drawImage(img, 0, 0, sw, sh, Math.floor(px), y, w, h);
        }
    };
    /**
     * Draws the sprite tiled vertically across the full canvas height; used for repeating backgrounds
     * @param {CanvasRenderingContext2D} ctx - canvas context to draw into
     * @returns {void}
     */
    Sprite.prototype.drawRepeatY = function (ctx) {

        var imgKey = this.getFrameImage();
        var img = images[imgKey];
        if (!img || !img.naturalHeight) return;

        var x = this._lerpX();
        var y = this._lerpY();
        var w = this.w;
        var h = this.h;

        if (w <= 0 || h <= 0) return;

        var sw = img.naturalWidth;
        var sh = img.naturalHeight;

        var startY = Math.floor(y % h);

        // start one tile above the viewport to fill the gap when scrolled up
        for (var py = startY - h; py < engine.height; py += h) {
            ctx.drawImage(img, 0, 0, sw, sh, x, Math.floor(py), w, h);
        }
    };
    /**
     * Advances the sprite's animation to the next frame at the given interval; call each game update tick
     * @param {number} delayBetweenFrames - minimum milliseconds to wait before advancing to the next frame
     * @returns {void}
     */
    Sprite.prototype.animate = function (delayBetweenFrames) {
        if (!this._animated) return;

        var now = Date.now();
        this._lastFrameTime = this._lastFrameTime || now;

        if (now - this._lastFrameTime >= delayBetweenFrames) {
            this._lastFrameTime = now;
            this._frameIndex = (this._frameIndex + 1) % this.image.length;
        }
    };
    /**
     * Moves the sprite horizontally by the given number of pixels
     * @param {number} dx - pixels to move (negative = left, positive = right)
     * @returns {void}
     */
    Sprite.prototype.moveX = function (dx) {
        this.x = this.x + dx;
    };
    /**
     * Moves the sprite vertically by the given number of pixels
     * @param {number} dy - pixels to move (negative = up, positive = down)
     * @returns {void}
     */
    Sprite.prototype.moveY = function (dy) {
        this.y = this.y + dy;
    };
    /**
     * Returns the interpolated draw X position (smooths movement between physics ticks)
     * @returns {number}
     */
    Sprite.prototype._lerpX = function () {
        if (typeof this._prevX !== 'number') return Math.round(this.x);
        return Math.round(this._prevX + (this.x - this._prevX) * _loopAlpha);
    };
    /**
     * Returns the interpolated draw Y position (smooths movement between physics ticks)
     * @returns {number}
     */
    Sprite.prototype._lerpY = function () {
        if (typeof this._prevY !== 'number') return Math.round(this.y);
        return Math.round(this._prevY + (this.y - this._prevY) * _loopAlpha);
    };
    /**
     * Centers the sprite on both canvas axes with optional pixel offsets
     * @param {number} [offsetX=0] - horizontal offset from center in pixels
     * @param {number} [offsetY=0] - vertical offset from center in pixels
     * @returns {void}
     */
    Sprite.prototype.center = function (offsetX, offsetY) {
        this.centerX(offsetX);
        this.centerY(offsetY);
    };
    /**
     * Centers the sprite horizontally on the canvas with an optional pixel offset
     * @param {number} [offsetX=0] - horizontal offset from center in pixels
     * @returns {void}
     */
    Sprite.prototype.centerX = function (offsetX) {
        offsetX = offsetX || 0;
        this.x = Math.floor((engine.width - this.w) / 2) + offsetX;
    };
    /**
     * Centers the sprite vertically on the canvas with an optional pixel offset
     * @param {number} [offsetY=0] - vertical offset from center in pixels
     * @returns {void}
     */
    Sprite.prototype.centerY = function (offsetY) {
        offsetY = offsetY || 0;
        this.y = Math.floor((engine.height - this.h) / 2) + offsetY;
    };
    /**
     * Applies a sinusoidal vertical bounce relative to the sprite's initial Y position; call each game update tick
     * @param {number} [range=8] - amplitude of the bounce in pixels
     * @param {number} [speed=10] - higher values slow the bounce; lower values speed it up
     * @returns {void}
     */
    Sprite.prototype.bounce = function (range, speed) {
        range = (typeof range === 'number') ? range : 8;
        speed = (typeof speed === 'number') ? speed : 10;

        this.bounceTick = (this.bounceTick === undefined) ? 0 : this.bounceTick + 1;
        this.y = Math.floor(this.initialY + Math.sin(this.bounceTick / speed) * range);
    };
    /**
     * Flashes the sprite on/off every ms milliseconds; call once to start.
     * Auto-stops after durationMs if given, otherwise blinks indefinitely.
     * Call blink(0) to stop an active blink early.
     * @param {number} [ms=130] - milliseconds per on/off phase
     * @param {number} [durationMs] - total duration in ms; omit to blink indefinitely
     * @returns {void}
     */
    Sprite.prototype.blink = function (ms, durationMs) {
        if (ms === 0) {
            this._blinkStart = null; // stop an active blink
            return;
        }
        this._blinkMs       = (typeof ms === 'number' && ms > 0) ? ms : 130;
        this._blinkDuration = (typeof durationMs === 'number' && durationMs > 0) ? durationMs : 0;
        this._blinkStart    = Date.now();
    };
    /**
     * Scrolls a sprite and optionally loops or respawns when offscreen
     * @param {object} options
     * @param {number} [options.speedX=0] - horizontal speed
     * @param {number} [options.speedY=0] - vertical speed
     * @param {boolean} [options.loop] - wrap by sprite size for seamless tiling
     * @param {number} [options.respawnAfter] - ms to wait before respawning
     * @param {number} [options.offset=0] - max random distance beyond edge on respawn
     * @returns {void}
     */
    Sprite.prototype.scroll = function(options) {
        if (this.destroyed) return;

        options = options || {};

        var speedX = options.speedX || 0;
        var speedY = options.speedY || 0;
        var now = performance.now();
        var shouldLoop = options.loop === true;
        var delay = options.respawnAfter || 0;
        var offset = (typeof options.offset === 'number') ? options.offset : 0;

        // waiting to respawn after delay
        if (this.respawnAt) {
            if (now < this.respawnAt) return;

            if (speedX < 0) this.x = engine.width + Math.floor(Math.random() * (offset + 1));
            if (speedX > 0) this.x = -this.w - Math.floor(Math.random() * (offset + 1));
            if (speedY < 0) this.y = engine.height + Math.floor(Math.random() * (offset + 1));
            if (speedY > 0) this.y = -this.h - Math.floor(Math.random() * (offset + 1));

            // snap interpolation to avoid a one-frame flicker between old and new position
            this._prevX = this.x;
            this._prevY = this.y;

            this.respawnAt = null;
            return;
        }

        if (speedX) this.moveX(speedX);
        if (speedY) this.moveY(speedY);

        var offscreen =
            (speedX < 0 && this.x + this.w < 0) ||
            (speedX > 0 && this.x > engine.width) ||
            (speedY < 0 && this.y + this.h < 0) ||
            (speedY > 0 && this.y > engine.height);

        if (!offscreen) return;

        if (shouldLoop) {
            if (speedX < 0) this.x += engine.width + this.w;
            if (speedX > 0) this.x -= engine.width + this.w;
            if (speedY < 0) this.y += engine.height + this.h;
            if (speedY > 0) this.y -= engine.height + this.h;
            return;
        }

        if (delay) {
            this.respawnAt = now + delay;
        }
    };
    /**
     * Tests whether this sprite's bounding box overlaps another sprite's bounding box.
     * Automatically refreshes bounds when a sprite's position has changed since the last check
     * @param {Object} target - the other sprite to test collision against
     * @returns {boolean} true if the two bounding boxes overlap
     */
    Sprite.prototype.isCollidingWith = function (target) {
        if (!this.collidable) return false;

        // refresh bounds when position or angle has changed
        var thisQA = quantizeAngle(this.angle || 0);
        if (!this.bounds || this.x !== this._boundsX || this.y !== this._boundsY || thisQA !== this._boundsQAngle) {
            this._refreshBounds();
        }

        var ab = this.bounds;
        var bb;

        // target can be a sprite or a plain { x, y, w, h } bounding rect
        if (typeof target._refreshBounds === 'function') {
            if (!target.collidable) return false;
            var targetQA = quantizeAngle(target.angle || 0);
            if (!target.bounds || target.x !== target._boundsX || target.y !== target._boundsY || targetQA !== target._boundsQAngle) {
                target._refreshBounds();
            }
            bb = target.bounds;
        } else {
            bb = target;
        }

        // aabb test: if separated on any single axis, the boxes cannot overlap
        var overlaps = !(
            ab.x + ab.w <= bb.x ||
            ab.x >= bb.x + bb.w ||
            ab.y + ab.h <= bb.y ||
            ab.y >= bb.y + bb.h
        );

        if (!overlaps) return false;

        // only run edge-aware checks for sprites using pixel bounds mode
        var thisMask = getSpriteCollisionData(this);

        if (typeof target._refreshBounds === 'function') {
            var targetMask = getSpriteCollisionData(target);
            if (thisMask && targetMask) return hasMaskOverlap(thisMask, ab, targetMask, bb);
            if (thisMask) return hasMaskOverlap(thisMask, ab, null, bb);
            if (targetMask) return hasMaskOverlap(targetMask, bb, null, ab);
            return true;
        }

        if (thisMask) return hasMaskOverlap(thisMask, ab, null, bb);

        return true;
    };
    /**
     * Recomputes bounds from current position. For 'rect' mode uses full sprite
     * dimensions; for 'pixel' mode applies cached relBounds offset
     * @returns {void}
     */
    Sprite.prototype._refreshBounds = function () {
        var b = this.bounds || (this.bounds = {});
        var data = (this.boundsMode === 'pixel') ? getSpriteCollisionData(this) : null;

        if (data) {
            var scaleX = this.w / this._srcW;
            var scaleY = this.h / this._srcH;
            b.x = this.x + data.x * scaleX;
            b.y = this.y + data.y * scaleY;
            b.w = data.w * scaleX;
            b.h = data.h * scaleY;
        } else {
            b.x = this.x;
            b.y = this.y;
            b.w = this.w;
            b.h = this.h;
        }

        this._boundsX = this.x;
        this._boundsY = this.y;
        this._boundsQAngle = quantizeAngle(this.angle || 0);
    };
    /**
     * Gets cached collision data for a sprite frame and computes it only when missing
     * @param {Object} sprite - sprite to resolve collision data for
     * @returns {Object|null} collision data with bounds and mask, or null when unavailable
     */
    function getSpriteCollisionData(sprite) {
        if (!sprite || sprite.boundsMode !== 'pixel') return null;

        // ensure base mask is loaded (image sprites may change frame)
        if (sprite.image) {
            var frameKey = sprite.getFrameImage();
            if (!sprite.relBounds || sprite._lastBoundsKey !== frameKey) {
                sprite.relBounds = boundingCache.get(frameKey);
                if (!sprite.relBounds) {
                    var frameImg = images[frameKey];
                    if (!frameImg || !frameImg.complete || !frameImg.naturalWidth) return null;
                    sprite.relBounds = getBounds(frameImg, 1);
                    boundingCache.set(frameKey, sprite.relBounds);
                }
                sprite._lastBoundsKey = frameKey;
                sprite._baseMaskAngle = 0;
                sprite._srcW = images[frameKey].naturalWidth;
                sprite._srcH = images[frameKey].naturalHeight;
                sprite._rotationCache = null;
            }
        }

        var baseBounds = sprite.relBounds;
        if (!baseBounds) return null;

        // no rotation — return base mask directly
        var deltaAngle = (sprite.angle || 0) - (sprite._baseMaskAngle || 0);
        var qIdx = quantizeAngle(deltaAngle);
        if (qIdx === 0) return baseBounds;

        // check rotation cache
        if (!sprite._rotationCache) sprite._rotationCache = {};
        var cached = sprite._rotationCache[qIdx];
        if (cached) return cached;

        // compute rotated mask and bounds
        var gridSize = baseBounds.gridSize || _collisionMaskSize;
        var rotated = rotateRelBounds(baseBounds, sprite._srcW, sprite._srcH, deltaAngle);
        rotated.gridSize = gridSize;
        rotated.maskRows = rotateMask(baseBounds.maskRows, gridSize, deltaAngle);

        sprite._rotationCache[qIdx] = rotated;
        return rotated;
    }

    /**
     * Computes overlap rectangle for two world-space bounds
     * @param {Object} a - first bounds rectangle
     * @param {Object} b - second bounds rectangle
     * @returns {Object|null} overlap rectangle, or null when none exists
     */
    function getOverlapRect(a, b) {
        var left = Math.max(a.x, b.x);
        var top = Math.max(a.y, b.y);
        var right = Math.min(a.x + a.w, b.x + b.w);
        var bottom = Math.min(a.y + a.h, b.y + b.h);

        if (right <= left || bottom <= top) return null;

        return {
            x: left,
            y: top,
            w: right - left,
            h: bottom - top
        };
    }

    /**
     * Samples overlap region using one or two masks; maskB is nullable
     * @param {Object} maskA - collision data for sprite A
     * @param {Object} boundsA - world-space bounds for sprite A
     * @param {Object|null} maskB - collision data for sprite B (null for plain rect)
     * @param {Object} boundsB - world-space bounds for sprite B or plain rect
     * @returns {boolean} true when overlap includes solid samples in both
     */
    function hasMaskOverlap(maskA, boundsA, maskB, boundsB) {
        var overlap = getOverlapRect(boundsA, boundsB);
        if (!overlap) return false;

        var gridA = maskA.gridSize || _collisionMaskSize;
        var cellW = boundsA.w / gridA;
        var cellH = boundsA.h / gridA;

        if (maskB) {
            var gridB = maskB.gridSize || _collisionMaskSize;
            var cellWB = boundsB.w / gridB;
            var cellHB = boundsB.h / gridB;
            if (cellWB < cellW) cellW = cellWB;
            if (cellHB < cellH) cellH = cellHB;
        }

        var sampleCols = Math.ceil(overlap.w / cellW);
        var sampleRows = Math.ceil(overlap.h / cellH);
        if (sampleCols < 1) sampleCols = 1;
        if (sampleRows < 1) sampleRows = 1;
        if (sampleCols > _collisionSampleMax) sampleCols = _collisionSampleMax;
        if (sampleRows > _collisionSampleMax) sampleRows = _collisionSampleMax;

        var stepX = overlap.w / sampleCols;
        var stepY = overlap.h / sampleRows;

        // precompute scale factors to map world-space to grid cells
        var aScaleX = gridA / boundsA.w;
        var aScaleY = gridA / boundsA.h;
        var bScaleX = maskB ? ((maskB.gridSize || _collisionMaskSize) / boundsB.w) : 0;
        var bScaleY = maskB ? ((maskB.gridSize || _collisionMaskSize) / boundsB.h) : 0;
        var bGrid = maskB ? (maskB.gridSize || _collisionMaskSize) : 0;

        for (var row = 0; row < sampleRows; row++) {
            var sampleY = overlap.y + (row + 0.5) * stepY;
            var aRow = ((sampleY - boundsA.y) * aScaleY) | 0;
            if (aRow < 0) aRow = 0;
            if (aRow >= gridA) aRow = gridA - 1;
            var aRowMask = maskA.maskRows[aRow] || 0;
            if (!aRowMask) continue;

            for (var col = 0; col < sampleCols; col++) {
                var sampleX = overlap.x + (col + 0.5) * stepX;
                var aCol = ((sampleX - boundsA.x) * aScaleX) | 0;
                if (aCol < 0) aCol = 0;
                if (aCol >= gridA) aCol = gridA - 1;
                if (!(aRowMask & (1 << aCol))) continue;

                if (!maskB) return true;

                var bRow = ((sampleY - boundsB.y) * bScaleY) | 0;
                if (bRow < 0) bRow = 0;
                if (bRow >= bGrid) bRow = bGrid - 1;
                var bRowMask = maskB.maskRows[bRow] || 0;
                if (!bRowMask) continue;

                var bCol = ((sampleX - boundsB.x) * bScaleX) | 0;
                if (bCol < 0) bCol = 0;
                if (bCol >= bGrid) bCol = bGrid - 1;
                if (bRowMask & (1 << bCol)) return true;
            }
        }

        return false;
    }
    /**
     * Rotates the sprite by adding the given angle in radians to this.angle
     * @param {number} amount - radians to add
     * @returns {void}
     */
    Sprite.prototype.rotate = function (amount) {
        this.angle = (this.angle || 0) + amount;
    };
    /**
     * Marks the sprite as destroyed and removes it from the engine's sprite registry
     * @returns {void}
     */
    Sprite.prototype.destroy = function () {
        this.destroyed = true;
        delete _sprites[this.id];
    };
    Object.defineProperties(Sprite.prototype, {
        actualW: {
            get: function () {
                return Math.floor(this.w);
            }
        },
        actualH: {
            get: function () {
                return Math.floor(this.clipHeight !== null ? this.clipHeight : this.h);
            }
        },
        visible: {
            get: function () {
                return (
                    this.x + this.actualW > 0 &&
                    this.x < engine.width &&
                    this.y + this.actualH > 0 &&
                    this.y < engine.height
                );
            }
        },
        seen: {
            get: function () {
                return (this._seen === true);
            },
            set: function (value) {
                this._seen = (value === true);
            }
        }
    });

    /**
     * Scans pixel alpha data and builds tight bounds + occupancy mask
     * @param {Uint8ClampedArray} data - raw RGBA pixel data
     * @param {number} w - image width
     * @param {number} h - image height
     * @param {number} threshold - minimum alpha to consider solid
     * @returns {Object} bounds + mask
     */
    function scanPixels(data, w, h, threshold) {
        var minX = w, minY = h, maxX = -1, maxY = -1;

        for (var y = 0; y < h; y++) {
            for (var x = 0; x < w; x++) {
                if (data[(y * w + x) * 4 + 3] >= threshold) {
                    if (x < minX) minX = x;
                    if (y < minY) minY = y;
                    if (x > maxX) maxX = x;
                    if (y > maxY) maxY = y;
                }
            }
        }

        if (maxX < minX || maxY < minY) {
            return { x: 0, y: 0, w: 0, h: 0, gridSize: _collisionMaskSize, maskRows: [] };
        }

        var boundsW = maxX - minX + 1;
        var boundsH = maxY - minY + 1;
        var maskRows = [];
        for (var m = 0; m < _collisionMaskSize; m++) maskRows[m] = 0;

        for (var py = minY; py <= maxY; py++) {
            for (var px = minX; px <= maxX; px++) {
                if (data[(py * w + px) * 4 + 3] < threshold) continue;
                var localX = px - minX;
                var localY = py - minY;

                // a pixel may span multiple grid cells when image is smaller than the grid
                var gxStart = Math.floor((localX * _collisionMaskSize) / boundsW);
                var gxEnd = Math.floor((((localX + 1) * _collisionMaskSize) - 1) / boundsW);
                var gyStart = Math.floor((localY * _collisionMaskSize) / boundsH);
                var gyEnd = Math.floor((((localY + 1) * _collisionMaskSize) - 1) / boundsH);
                if (gxEnd >= _collisionMaskSize) gxEnd = _collisionMaskSize - 1;
                if (gyEnd >= _collisionMaskSize) gyEnd = _collisionMaskSize - 1;

                for (var gy = gyStart; gy <= gyEnd; gy++) {
                    for (var gx = gxStart; gx <= gxEnd; gx++) {
                        maskRows[gy] = maskRows[gy] | (1 << gx);
                    }
                }
            }
        }

        return { x: minX, y: minY, w: boundsW, h: boundsH, gridSize: _collisionMaskSize, maskRows: maskRows };
    }

    /**
     * Computes tight bounds and mask for an image sprite
     * @param {HTMLImageElement} img - image to analyze
     * @param {number} [threshold=1] - minimum alpha to consider solid
     * @returns {Object} bounds + mask
     */
    function getBounds(img, threshold) {
        log('getBounds('+img.key+','+threshold+')');

        var w = img.naturalWidth;
        var h = img.naturalHeight;
        if (!w || !h) return { x: 0, y: 0, w: 0, h: 0, gridSize: _collisionMaskSize, maskRows: [] };

        _boundsCanvas.width = w;
        _boundsCanvas.height = h;
        _boundsCtx.clearRect(0, 0, w, h);
        _boundsCtx.drawImage(img, 0, 0, w, h);

        return scanPixels(_boundsCtx.getImageData(0, 0, w, h).data, w, h, threshold);
    }

    /**
     * Rasterises a vector sprite and builds bounds + mask
     * @param {Object} sprite - the vector sprite
     * @param {number} w - render width
     * @param {number} h - render height
     * @returns {Object} bounds + mask
     */
    function getVectorBounds(sprite, w, h) {
        var rw = Math.ceil(w);
        var rh = Math.ceil(h);
        if (rw < 1 || rh < 1) return { x: 0, y: 0, w: 0, h: 0, gridSize: _collisionMaskSize, maskRows: [] };

        _boundsCanvas.width = rw;
        _boundsCanvas.height = rh;
        _boundsCtx.clearRect(0, 0, rw, rh);
        _boundsCtx.save();
        sprite.vector.call(sprite, _boundsCtx, rw, rh);
        _boundsCtx.restore();

        return scanPixels(_boundsCtx.getImageData(0, 0, rw, rh).data, rw, rh, 1);
    }

    /**
     * Quantizes an angle to a bucket index for rotation cache lookups
     * @param {number} angle - angle in radians
     * @returns {number} integer bucket index (0–59)
     */
    function quantizeAngle(angle) {
        var step = Math.PI / 30;
        var idx = Math.round(angle / step) % 60;
        return idx < 0 ? idx + 60 : idx;
    }

    /**
     * Rotates a bitmask grid mathematically via inverse-rotation sampling
     * @param {number[]} maskRows - source mask row bitmasks
     * @param {number} gridSize - grid dimension
     * @param {number} deltaAngle - rotation angle in radians
     * @returns {number[]} new rotated maskRows array
     */
    function rotateMask(maskRows, gridSize, deltaAngle) {
        var cos = Math.cos(-deltaAngle);
        var sin = Math.sin(-deltaAngle);
        var cx = (gridSize - 1) / 2;
        var cy = (gridSize - 1) / 2;
        var result = [];

        for (var row = 0; row < gridSize; row++) {
            result[row] = 0;
            for (var col = 0; col < gridSize; col++) {
                var dx = col - cx;
                var dy = row - cy;
                var srcCol = Math.round(dx * cos - dy * sin + cx);
                var srcRow = Math.round(dx * sin + dy * cos + cy);
                if (srcCol < 0 || srcRow < 0 || srcCol >= gridSize || srcRow >= gridSize) continue;
                if ((maskRows[srcRow] & (1 << srcCol)) !== 0) {
                    result[row] = result[row] | (1 << col);
                }
            }
        }

        return result;
    }

    /**
     * Computes the AABB of a rotated tight-bounds rectangle
     * @param {Object} rel - unrotated relative bounds {x, y, w, h}
     * @param {number} imgW - full image/sprite width
     * @param {number} imgH - full image/sprite height
     * @param {number} deltaAngle - rotation angle in radians
     * @returns {Object} rotated AABB relative bounds {x, y, w, h}
     */
    function rotateRelBounds(rel, imgW, imgH, deltaAngle) {
        var cx = imgW / 2;
        var cy = imgH / 2;
        var cos = Math.cos(deltaAngle);
        var sin = Math.sin(deltaAngle);

        var cornersX = [rel.x, rel.x + rel.w, rel.x + rel.w, rel.x];
        var cornersY = [rel.y, rel.y, rel.y + rel.h, rel.y + rel.h];

        var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (var i = 0; i < 4; i++) {
            var dx = cornersX[i] - cx;
            var dy = cornersY[i] - cy;
            var rx = dx * cos - dy * sin + cx;
            var ry = dx * sin + dy * cos + cy;
            if (rx < minX) minX = rx;
            if (ry < minY) minY = ry;
            if (rx > maxX) maxX = rx;
            if (ry > maxY) maxY = ry;
        }

        return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    }

    /**
     * The main game loop — called each animation frame
     * @param {number} timestamp - current time in ms from requestAnimationFrame
     * @returns {void}
     */
    function loop(timestamp) {
        var frameTime = Math.min(timestamp - _loopLast, 100); // max 100ms delay
        _loopLast = timestamp;
        _loopAccumulator += frameTime;

        // fixed timestep: run update() once per logical tick until we've consumed all elapsed time
        while (_loopAccumulator >= _loopStep) {
            // snapshot positions before the update so draw can interpolate
            for (var _sid in _sprites) {
                if (Object.prototype.hasOwnProperty.call(_sprites, _sid)) {
                    _sprites[_sid]._prevX = _sprites[_sid].x;
                    _sprites[_sid]._prevY = _sprites[_sid].y;
                }
            }
            eventHandlers.update();
            pointer.clicked = false;
            pointer.swiped = false;
            pointer.swipedUp = false;
            pointer.swipedDown = false;
            pointer.swipedLeft = false;
            pointer.swipedRight = false;
            pointer.swipeDistance = 0;
            _frame++;
            _loopAccumulator -= _loopStep;
        }

        // how far between the last tick and the next — used to smooth sprite positions during draw
        _loopAlpha = _loopAccumulator / _loopStep;

        // clear screen
        _canvasCtx.clearRect(0, 0, engine.width, engine.height);

        // auto-draw all sprites
        for (var _id in _sprites) {
            if (Object.prototype.hasOwnProperty.call(_sprites, _id) && !_sprites[_id].destroyed) {
                _sprites[_id].draw(_canvasCtx);
            }
        }

        // draw handler runs after sprites — use for text, HUD, overlays
        // ctx is passed both as the first argument and as 'this' for backwards compatibility
        if (eventHandlers.draw) {
            eventHandlers.draw.call(_canvasCtx, _canvasCtx);
        }

        _loopFpsCounter++;

        // update fps every 1000ms
        if (timestamp - _loopFpsTimer >= 1000) {
            _loopFps = _loopFpsCounter;
            _loopFpsCounter = 0;
            _loopFpsTimer = timestamp;
        }

        // debug overlay
        if (_debuggingEnabled) {
            drawDebugInfo(_canvasCtx, _frame, _loopFps, engine.width, engine.height);
        }

        _loopId = requestAnimationFrame(loop);
    }

    /**
     * Starts the game loop from scratch, resetting all frame and timing state
     * @returns {void}
     */
    function startLoop() {

        if (!_initilised) throw new Error('punter.setup must be called first');

        _canvasCtx = _canvas.getContext('2d', { alpha: true, desynchronized: true, preserveDrawingBuffer: true }); // desynchronized reduces paint latency on supported browsers
        scaleCanvasContext();

        _frame = 0;
        _loopLast = performance.now();
        _loopAccumulator = 0;
        _loopFps = 0;
        _loopFpsCounter = 0;
        _loopFpsTimer = performance.now();

        _paused = false;
        _loopId = requestAnimationFrame(loop);
    }

    /**
     * Pauses the game loop, cancelling animation frames until resumed
     * @returns {void}
     */
    function pauseLoop() {

        if (!_initilised) throw new Error('punter.setup must be called first');

        if (_loopId !== null) {
            cancelAnimationFrame(_loopId);
            _loopId = null;
        }

        _paused = true;
    }

    /**
     * Resumes the game loop after a pause without resetting frame state
     * @returns {void}
     */
    function resumeLoop() {
        _loopLast = performance.now();
        _paused = false;
        _loopId = requestAnimationFrame(loop);
    }

    /**
     * Plays a sound from the loaded buffer
     * @param {string} name - name of the sound buffer
     * @param {Object} [options] - optional settings
     * @param {number} [options.volume] - volume from 0 to 1
     * @param {boolean} [options.loop] - loops the sound; stops the previous instance of the same sound
     * @param {boolean} [options.restart] - stop any existing instance before playing
     * @param {boolean} [options.once] - if true, don't track for stopping
     * @param {number} [options.speed] - playback speed multiplier (1 = normal)
     * @returns {void}
     */
    function playSound(name, options) {

        if (!_initilised) throw new Error('punter.setup must be called first');

        var buffer = sounds[name];
        if (!buffer) return;

        options = options || {};

        // looped sounds and explicit restarts stop the previous instance; sfx allow up to 3 at once
        if (options.restart === true || options.loop === true) {
            stopSound(name);
        } else if (_activeSounds[name] && _activeSounds[name].length >= 3) {
            // evict the oldest instance to stay within the cap
            try { _activeSounds[name][0].stop(0); } catch (e) { /* already stopped */ }
            _activeSounds[name].shift();
        }

        var source = audioCtx.createBufferSource();
        source.buffer = buffer;

        var gainNode = audioCtx.createGain();
        gainNode.gain.value = (options.volume !== null && options.volume !== undefined) ? options.volume : 1;

        source.loop = !!options.loop;
        source.playbackRate.value = (options.speed !== null && options.speed !== undefined) ? options.speed : 1;

        source.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        // fallback resume for post-interruption re-suspension (primary unlock is _unlockAudio)
        if (audioCtx.state !== 'running') audioCtx.resume();

        try {
            source.start(0);
        } catch (e) {
            return; // audio errors are non-fatal; browser may restrict AudioContext
        }

        if (!options.once) {
            if (!_activeSounds[name]) _activeSounds[name] = [];
            _activeSounds[name].push(source);
            source.onended = function () {
                var arr = _activeSounds[name];
                if (arr) {
                    var idx = arr.indexOf(source);
                    if (idx !== -1) arr.splice(idx, 1);
                }
            };
        }
    }

    /**
     * Stops all currently playing sounds
     * @returns {void}
     */
    function stopAllSounds() {
        for (var name in _activeSounds) {
            stopSound(name);
        }
    }

    /**
     * Stops all currently playing instances of a named sound
     * @param {string} name - name of the sound to stop, as defined in config.sounds
     * @returns {void}
     */
    function stopSound(name) {

        if (!_initilised) throw new Error('punter.setup must be called first');

        var arr = _activeSounds[name];
        if (!arr || !arr.length) return;
        for (var i = 0; i < arr.length; i++) {
            try { arr[i].stop(0); } catch (e) { /* already stopped */ }
        }
        _activeSounds[name] = [];
    }

    /**
     * Resolves a friendly key name (e.g. 'left', 'space') to the stored key string
     * @param {string} name - friendly name or single letter
     * @returns {string} the key string used in the keys object
     */
    function resolveKey(name) {
        var lower = name.toLowerCase();
        // check alias map first (e.g. 'left' -> 'ArrowLeft')
        if (keyAliases[lower]) return keyAliases[lower];
        // single-char letters are stored lowercase
        if (lower.length === 1) return lower;
        // unrecognised — return as-is so it simply won't match anything
        return name;
    }

    /**
     * Returns true if the specified key (or any of the given keys) is currently held down.
     * Supports friendly names ('left', 'space'), letters ('a'), and + combos ('shift+a').
     * Multiple arguments use OR logic — true if any one is down.
     * A + combo uses AND logic — all parts must be down.
     * Examples:
     *   punter.isKeyDown('left')           // ArrowLeft held
     *   punter.isKeyDown('left', 'a')      // ArrowLeft OR 'a' held
     *   punter.isKeyDown('shift+a')        // Shift AND 'a' both held
     * @param {...string} keys - one or more key names
     * @returns {boolean}
     */
    function isKeyDown() {
        // no args — nothing to check
        if (arguments.length === 0) return false;

        // check each argument; return true if any one matches (OR logic)
        for (var i = 0; i < arguments.length; i++) {
            var arg = arguments[i];

            // handle + combos: 'shift+a' means shift AND a must both be down
            if (arg.indexOf('+') !== -1) {
                var parts = arg.split('+');
                var allDown = true;
                for (var j = 0; j < parts.length; j++) {
                    if (!keys[resolveKey(parts[j])]) { allDown = false; break; }
                }
                if (allDown) return true;
            } else {
                // single key
                if (keys[resolveKey(arg)]) return true;
            }
        }

        return false;
    }

    /**
     * Returns true if the specified pointer button is currently held down
     * @param {string} [button] - 'left', 'middle', or 'right' (defaults to 'left')
     * @returns {boolean}
     */
    function isPointerDown(button) {
        return _pointerButtons[button || 'left'] || false;
    }

    /**
     * Resets all keyboard and pointer states; call between scenes to avoid stale input
     * @returns {void}
     */
    function clearInput() {
        for (var key in keys) {
            keys[key] = false;
        }
        pointer.clicked = false;
        pointer.down = false;
        pointer.swiped = false;
        pointer.swipedUp = false;
        pointer.swipedDown = false;
        pointer.swipedLeft = false;
        pointer.swipedRight = false;
        pointer.swipeDistance = 0;
        _pointerButtons.left = false;
        _pointerButtons.middle = false;
        _pointerButtons.right = false;
        _swipeActive = false;
    };

    /**
     * Returns the current viewport dimensions, preferring visualViewport for accuracy on mobile
     * @returns {{ width: number, height: number }} viewport width and height in integer pixels
     */
    function getViewportSize() {

        if (window.visualViewport) {
            return {
                width: Math.floor(window.visualViewport.width),
                height: Math.floor(window.visualViewport.height)
            };            
        }

        return {
            width: Math.floor(window.innerWidth),
            height: Math.floor(window.innerHeight)
        };
    }

    /**
     * Sets HTML/CSS variables for developers
     * - css --variables
     * - html[attributes]
     * @returns {void}
     */
    function setDevVars() {

        var vpSize = getViewportSize();

        // css variables
        var docStyle = htmlEl.style;
        docStyle.setProperty('--punter-vpw', vpSize.width + 'px');
        docStyle.setProperty('--punter-vph', vpSize.height + 'px');

        // html attributes
        setAttribute(htmlEl, 'data-punter-debug', _debuggingEnabled ? 'true' : '');
        setAttribute(htmlEl, 'data-punter-device', _isMobile ? 'mobile' : 'desktop');
        setAttribute(htmlEl, 'data-punter-orientation', engine.orientation);

        // only set scene if we have a value (dev might hard code start scene)
        if (engine.currentScene) {
            setAttribute(htmlEl, 'data-punter-scene', engine.currentScene);
        }

        // force a CSS reflow
        void document.body.offsetHeight;
    }

    /**
     * Set attribute: removes if empty, only modifies if value changed
     * @param {Element} el - target element
     * @param {string} name - attribute name
     * @param {string} value - value to set
     * @returns {void}
     */
    function setAttribute(el, name, value) {

        value = String(value).trim();

        if (value === '') {
            el.removeAttribute(name);
        }
        else if (el.getAttribute(name) !== value) {
            el.setAttribute(name, value);
        }
    }

    /**
     * Scales the canvas context for high-density screens; must be called after canvas dimensions change
     * @returns {void}
     */
    function scaleCanvasContext() {
        if (!_canvasCtx) return;
        _canvasCtx.setTransform(_renderScale, 0, 0, _renderScale, 0, 0);
        _canvasCtx.imageSmoothingEnabled = true;
    }

    /**
     * Recalculates canvas dimensions to fit the viewport, rescales all active sprites, and fires the resize event
     * @returns {void}
     */
    function resize() {

        var size = getViewportSize();
        var screenW = size.width;
        var screenH = size.height;
        var screenRatio = screenW / screenH;

        // base internal resolution to maintain consistent game logic
        var baseW = 375;
        var baseH = 667;
        var baseRatio = baseW / baseH;

        var internalW, internalH;

        // lock the shorter axis to the base size so the design always fits without clipping
        if (screenRatio > baseRatio) {
            internalH = baseH;
            internalW = Math.round(internalH * screenRatio);
        }
        else {
            internalW = baseW;
            internalH = Math.round(internalW / screenRatio);
        }

        _width = internalW;
        _height = internalH;
        _dpr = Math.min(window.devicePixelRatio || 1, 2);

        var scaleX = screenW / _width;
        var scaleY = screenH / _height;
        var scale = Math.min(scaleX, scaleY);

        // render scale maps game coordinates directly to physical pixels
        _renderScale = scale * _dpr;

        // cap buffer at ~4M pixels to stay performant on very large screens
        var maxPixels = 4194304;
        var bufferW = Math.round(_width * _renderScale);
        var bufferH = Math.round(_height * _renderScale);
        if (bufferW * bufferH > maxPixels) {
            var capScale = Math.sqrt(maxPixels / (_width * _height));
            _renderScale = capScale;
            bufferW = Math.round(_width * capScale);
            bufferH = Math.round(_height * capScale);
        }

        _canvas.width = bufferW;
        _canvas.height = bufferH;

        scaleCanvasContext();

        // css size matches the logical display area; no CSS upscaling needed
        var displayW = Math.round(_width * scale);
        var displayH = Math.round(_height * scale);
        _canvas.style.width = displayW + 'px';
        _canvas.style.height = displayH + 'px';
        _canvas.style.transform = 'translate(-50%, -50%)';

        setDevVars();

        for (var id in _sprites) {
            if (Object.prototype.hasOwnProperty.call(_sprites, id)) {
                _sprites[id].resize();
            }
        }

        if (typeof eventHandlers.resize === 'function') {
            eventHandlers.resize();
        }

        engine.redraw();
    }

    /**
     * Debounced handler for resize and orientationchange events
     * Waits 5ms after last trigger before calling resize
     * @returns {void}
     */
    function setupResponsiveResize() {
        var resizeTimer;
        var resumeTimer;
        var pausedByResize = false;

        function handleResizeEvent() {
            clearTimeout(resizeTimer);
            clearTimeout(resumeTimer);

            // pause during resize to avoid wasted frames
            if (!_paused && _initilised) {
                pauseLoop();
                pausedByResize = true;
            }

            resizeTimer = setTimeout(function () {
                resize();
                // resume after resize settles
                resumeTimer = setTimeout(function () {
                    if (pausedByResize) {
                        pausedByResize = false;
                        resumeLoop();
                    }
                }, 100);
            }, 3);
        }

        window.addEventListener('resize', handleResizeEvent);
        window.addEventListener('orientationchange', handleResizeEvent);
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', handleResizeEvent);
        }
    }

    /* --- public api --- */

    var api = {

        // initialization
        setup: setup,

        // scene lifecycle
        /**
         * Registers a named scene; the handler is called each time punter.go(name) transitions to this scene
         * @param {string} name - unique scene identifier
         * @param {Function} handler - setup function called when the scene starts; create sprites and register event handlers here
         * @returns {void}
         */
        scene: function (name, handler) {
            _scenes[name] = handler;
        },
        /**
         * Transitions to a registered scene: destroys all current sprites, clears input, stops sounds, then runs the scene handler
         * @param {string} name - name of the scene to transition to
         * @returns {void}
         */
        go: function (name) {

            if (!_scenes[name]) throw new Error('punter.go: no scene named "' + name + '" has been registered. Use punter.scene("' + name + '", function () { ... }) first.');
            if (!_initilised) { _pendingGo = name; return; }

            // update is reset to a no-op (not null) because loop() always calls it without a null check
            eventHandlers.update = function () {};
            eventHandlers.draw = null;

            // destroy all sprites from the previous scene
            for (var _sid in _sprites) {
                if (Object.prototype.hasOwnProperty.call(_sprites, _sid)) {
                    _sprites[_sid].destroy();
                }
            }

            // ensure we clear all input from last scene
            engine.clearInput();
            stopAllSounds();

            // switch scenes
            _currentScene = name;
            _scenes[name]();

            setDevVars();

            log('punter.currentScene = ' + _currentScene);

            // auto-start loop if not running
            if (_loopId === null && _canvas && _initilised) {
                startLoop();
            }

            // fire engine.on('go', func) handler
            if (typeof eventHandlers.go === 'function') {
                eventHandlers.go(_currentScene);
            }
        },
        pause: pauseLoop,
        /**
         * Resumes a paused game loop without resetting frame state
         * @returns {void}
         */
        resume: function () {
            if (_loopId === null && _canvas && _initilised) {
                resumeLoop();
            }
        },
        /**
         * Clears the canvas and redraws all active sprites; useful for refreshing a static frame while paused
         * @returns {void}
         */
        redraw: function () {
            if (!_canvas || !_canvasCtx) return;

            _canvasCtx.clearRect(0, 0, _width, _height);

            for (var id in _sprites) {
                if (Object.prototype.hasOwnProperty.call(_sprites, id)) {
                    var sprite = _sprites[id];
                    if (!sprite.destroyed) {
                        sprite.draw(_canvasCtx);
                    }
                }
            }
        },

        // sprite factory
        /**
         * Creates and registers a new Sprite from a preloaded image; throws if punter.setup has not been called
         * @param {Object} opts - sprite configuration object; see Sprite constructor for all options
         * @returns {Object} the newly created Sprite instance
         */
        createSprite: function(opts) {
            if (!_initilised) throw new Error('punter.createSprite: call punter.setup() before creating sprites.');
            return new Sprite(opts);
        },
        /**
         * Retrieves a registered sprite by its unique id
         * @param {string} id - sprite id assigned at creation time
         * @returns {Object|null} the matching Sprite instance, or null if not found
         */
        getSprite: function(id) {
            return _sprites[id] ? _sprites[id] : null;
        },

         // input handling
        clearInput: clearInput,
        isKeyDown: isKeyDown,
        pointer: pointer,
        isPointerDown: isPointerDown,

        // event listeners
        /**
         * Registers a callback for a named engine event
         * @param {string} event - one of: 'ready' (setup complete), 'update' (each logic tick), 'draw' (after sprites, for HUD/overlays), 'resize' (viewport changed), 'go' (scene transition)
         * @param {Function} handler - function to call when the event fires
         * @returns {void}
         */
        on: function (event, handler) {
            if (!eventHandlers.hasOwnProperty(event)) throw new Error('punter.on: "' + event + '" is not a valid event name. Use: ready, update, draw, resize, or go.');
            eventHandlers[event] = handler;
        },

        // sound control
        playSound: playSound,
        stopSound: stopSound
    };

    Object.defineProperties(api, {
        currentScene: {
            get: function () {
                return _currentScene || '';
            },
            enumerable: true
        },
        debug: {
            get: function () {
                return _debuggingEnabled;
            },
            set: function(value) {
                _debuggingEnabled = (value === true);
            },
            enumerable: true
        },
        canvas: {
            get: function () {
                return _canvas;
            },
            enumerable: true
        },
        width: {
            get: function () {
                return _canvas ? _width : null;
            },
            enumerable: true
        },
        height: {
            get: function () {
                return _canvas ? _height : null;
            },
            enumerable: true
        },
        frame: {
            get: function () {
                return _frame;
            },
            enumerable: true
        },
        paused: {
            get: function () {
                return _paused;
            },
            enumerable: true
        },
        isMobile: {
            get: function() {
                return _isMobile;
            }
        },
        orientation: {
            get: function () {
                return window.innerHeight >= window.innerWidth ? 'portrait' : 'landscape';
            },
            enumerable: true
        }
    });

    var engine = api;
    global.punter = api;

    document.addEventListener('DOMContentLoaded', function () {
        _debugBackgroundColor = getCssVar('punter-debug-background', 'rgba(255,255,255,0.7)');
        _debugTextColor = getCssVar('punter-debug-text', 'red');
        _debugFont = getCssVar('punter-debug-font', '10px monospace');

        setDevVars();
    });

    window.addEventListener('error', function (event) {
        log('[Global Error]', event.message, 'at', event.filename + ':' + event.lineno + ':' + event.colno, event.error);
    });

    window.addEventListener('unhandledrejection', function (event) {
        log('[Unhandled Promise Rejection]', event.reason);
    });

})(window);
