
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
    var log = (typeof SimpleLog === 'function') ? new SimpleLog('engine', '#6899E1', true) : console.log.bind(console, '[engine]');

    var images = {};
    var sounds = {};
    var playingSounds = {};
    var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    var _isMobile = /Mobi|Android|iPhone/i.test(navigator.userAgent);

    var _canvas;
    var _canvasCtx;
    var _boundsCanvas;
    var _dpr = Math.min(window.devicePixelRatio || 1, 2);
    var _boundsCtx;
    var _initilised = false;
    var _scenes = {};
    var _currentScene = null;
    var _running = false;
    var _paused = false;
    var _frame = 0;
    var _totalFrames = 0;
    var _resized = false;
    var _loopId = null;
    var _sprites = {}; // key: id, value: sprite
    var eventHandlers = {
        ready: function() {},
        update: function() {},
        draw: function() {},
        resize: function() {},
        go: function() {}
    };
    var htmlEl = document.documentElement;

    htmlEl.setAttribute('data-punter-loading', 'true');

    var keys = {};
    var mouse = { x: 0, y: 0, clicked: false };
    var skipNextMouse = false;

    window.addEventListener('keydown', function (e) { keys[e.key] = true; });
    window.addEventListener('keyup', function (e) { keys[e.key] = false; });

    function registerClick(clientX, clientY) {
        mouse.clicked = true;
        if (!_canvas) { mouse.x = clientX; mouse.y = clientY; return; }
        var rect = _canvas.getBoundingClientRect();
        var canvasScale = _canvas.width / rect.width;
        mouse.x = Math.round((clientX - rect.left) * canvasScale);
        mouse.y = Math.round((clientY - rect.top) * canvasScale);
    }

    document.addEventListener('touchstart', function (e) {

        e.preventDefault();

        if (e.touches.length) {
            skipNextMouse = true;
            var touch = e.touches[0];
            registerClick(touch.clientX, touch.clientY);
        }
    }, { capture: true });

    document.addEventListener('mousedown', function (e) {
        if (skipNextMouse) { skipNextMouse = false; return; }
        registerClick(e.clientX, e.clientY);
    });

    /**
     * boundingCache - Simple fixed-size cache for sprite bounds
     * Used to avoid re-running getBounds() on sprites
     */
    var boundingCache = (function () {
        var MAX = 1000;
        var store = Object.create(null);
        var keys = [];
        
        return {
            get: function (key) {
                return store[key] || null;
            },
            set: function (key, value) {
                if (!store[key]) {
                    if (keys.length >= MAX) {
                        var oldest = keys.shift();
                        delete store[oldest];
                    }
                    keys.push(key);
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
        }
        else if (config.canvas instanceof HTMLCanvasElement) {
            _canvas = config.canvas;
        }
        else {
            throw new Error('Invalid config.canvas');
        }

        // ensure canvas has connect styles
        _canvas.style.position = 'absolute';
        _canvas.style.top = '50%';
        _canvas.style.left = '50%';
        _canvas.style.bottom = '';
        _canvas.style.right = '';
        _canvas.style.transformOrigin = 'center center';
        _canvas.style.imageRendering = 'pixelated';
        _canvas.style.touchAction = 'none';
        _canvas.style.overflow = 'hidden';
        _canvas.style.webkitTouchCallout = 'none';
        _canvas.style.webkitTapHighlightColor = 'transparent';
        _canvas.style.touchAction = 'none';
        _canvas.style.pointerEvents = 'none';
        _canvas.style.contain = 'strict';
        _canvas.style.willChange = 'transform';
        _canvas.style.transform = 'translateZ(0)';

        setTimeout(resize, 0);
        setupResponsiveResize();

        // create a background canvas to speed up getBounds
        _boundsCanvas = document.createElement('canvas');
        _boundsCtx = _boundsCanvas.getContext('2d', { willReadFrequently: true });

        loadImages(config.images || {}).then(function() {

            // precompute bounds for all sprite frames
            if (config.images) {
                for (var key in config.images) {
                    var img = images[key];
                    if (img && img.complete && img.naturalWidth) {
                        // this warms up the boundingCache
                        var cache = boundingCache.get(key);
                        if (!cache) {
                            var bounds = getBounds(img, 1);
                            boundingCache.set(key, bounds);
                        }
                    }
                }
            }
        })
        .then(function() {
            return loadSounds(config.sounds || {});  
        })
        .then(function() {
            _initilised = true;
            htmlEl.removeAttribute('data-punter-loading');
            eventHandlers.ready();
        })
        .catch(function() {
            _initilised = false;
        });
    }

    /**
     * Loads and decodes all images
     * @param {Object} images - Key-value map of image keys to image URLs
     * @returns {Promise} - Resolves when all images are loaded and decoded
     */
    function loadImages(imageMap) {

        var keys = Object.keys(imageMap);
        var total = keys.length;

        if (!total) return Promise.resolve();

        return new Promise(function (resolve, reject) {
            var loaded = 0;
            var failed = false;

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

            function handleError(key, url) {
                this.onload = null;
                this.onerror = null;
                if (failed) return;
                failed = true;
                reject(new Error('Failed to load sprite "' + key + '" from ' + url));
            }

            for (var i = 0; i < total; i++) {
                var key = keys[i];
                var url = imageMap[key];
                var img = new Image();
                img.key = key; // for debugging
                img.onload = handleLoad.bind(img, key);
                img.onerror = handleError.bind(img, key, url);
                img.src = url;
            }
        });
    }

    function loadSounds(audioMap) {

        var keys = Object.keys(audioMap);
        var total = keys.length;
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
                (function (key, url) {
                    fetch(url).then(function (res) {
                        return res.arrayBuffer();
                    }).then(function (buffer) {
                        decodeAndStore(key, url, buffer);
                    }).catch(function () {
                        handleError(key, url);
                    });
                })(keys[i], audioMap[keys[i]]);
            }
        });
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
                return Math.floor(base * (pct / 100));
                // return Math.round(base * (pct / 100));
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
     * @param {number} canvasH - height of the canvas
     * @returns {void}
     */
    function drawSpriteLabels(ctx, dx, dy, dw, dh, canvasH) {

        var label = [
            'x=' + Math.floor(dx) + ' ',
            'y=' + Math.floor(dy) + ' ',
            '(' + Math.floor(dw) + 'x' + Math.floor(dh) + ')'
        ].join('');

        ctx.font = _debugFont;
        var metrics = ctx.measureText(label);
        var textWidth = metrics.width;

        var ascent = metrics.actualBoundingBoxAscent || 10;
        var descent = metrics.actualBoundingBoxDescent || 4;
        var textHeight = ascent + descent;

        var textX = Math.floor(dx + (dw - textWidth) / 2);
        var textY;

        if (dy + dh + textHeight + 2 < canvasH) {
            textY = dy + dh + textHeight;
        }
        else {
            textY = dy - 4;
        }

        // draw background box
        ctx.fillStyle = _debugBackgroundColor;
        ctx.fillRect(textX - 2, textY - textHeight + 2, textWidth + 4, textHeight);

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
     * Creates a sprite with optional animation, scaling, and collision bounds
     * @param {Object} opts - Sprite config
     * @param {string} opts.id - unique id for the sprite
     * @param {string|string[]} opts.key - sprite key used when loading sprite (use array for animations)
     * @param {number} opts.x - x position
     * @param {number} opts.y - y position
     * @param {number} [opts.w] - width
     * @param {number} [opts.h] - height
     * @param {boolean} [opts.preserveAspect=true] - maintain image aspect ratio
     * @param {boolean} [collidable=true] - whether to compute collision bounds (default = true)
     * @returns {Object} new sprite object
     */
    function Sprite(opts) {

        if (!opts || typeof opts !== 'object') throw new Error('Sprite: missing opts param');
        if (!opts.id || _sprites[opts.id]) throw new Error('Sprite: id must be unique');
        if (!opts.key) throw new Error('Sprite: missing key');
        if (typeof opts.x === 'undefined') throw new Error('Sprite: missing x');
        if (typeof opts.y === 'undefined') throw new Error('Sprite: missing y');

        // option values
        this.id = opts.id;
        this.key = opts.key;
        this.preserveAspect = (opts.preserveAspect !== false);
        this.collidable = (opts.collidable !== false);
        this.outline = (typeof opts.outline === 'string') ? opts.outline : null;
        this.frame = null; // optional override by game logic
        this.repeatX = (opts.repeatX === true);
        this.repeatY = (opts.repeatY === true);
        this.clipHeight = (typeof opts.clipHeight === 'number') ? opts.clipHeight : null;
        this.clipFrom = opts.clipFrom === 'top' ? 'top' : 'bottom';

        // w/h
        this.originalW = (typeof opts.w !== 'undefined') ? opts.w : null;
        this.originalH = (typeof opts.h !== 'undefined') ? opts.h : null;
        this.originalCanvasW = engine.width;
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
        if (this.x < 0) this.x = 0;
        if (this.y < 0) this.y = 0;
        this.initialX = this.x;
        this.initialY = this.y;

        if (this.repeatX && this.repeatY) {
            throw new Error('Sprite: cannot set both repeatX and repeatY');
        }

        this._frameIndex = 0;
        this._animated = Array.isArray(this.key);

        var initialDrawKey = Array.isArray(this.key) ? this.key[0] : this.key;
        var img = images[initialDrawKey];

        if (!img || !img.complete || !img.naturalWidth) throw new Error('Sprite: image not loaded ' + initialDrawKey);

        // infer size immediately if needed
        this.aspectRatio = img.naturalHeight > 0 ? img.naturalWidth / img.naturalHeight : 1;

        // now get the final size
        var finalSize = finalizeSize(this.w, this.h, this.preserveAspect, this.aspectRatio, img.naturalWidth, img.naturalHeight);

        this.w = finalSize.w;
        this.h = finalSize.h;

        // cache sprite in memory
        _sprites[this.id] = this;
    }
    Sprite.prototype.getFrameKey = function () {
        if (!this._animated) return this.key;

        var index = (typeof this.frame === 'number' && this.frame >= 0) ? this.frame : this._frameIndex;

        return this.key[index % this.key.length];        
    };
    Sprite.prototype.update = function () {};
    Sprite.prototype.draw = function (ctx) {

        ctx = ctx || _canvasCtx;

        if (this.destroyed) return;

        // always track visibility for seen
        if (!this._seen && this.visible) {
            this._seen = true;
        }

        if (this.repeatX) return this.drawRepeatX(ctx);
        if (this.repeatY) return this.drawRepeatY(ctx);

        var drawKey = this.getFrameKey();               // frame key to draw (single or animated)
        var img = images[drawKey];                      // loaded image object
        if (!img || !img.complete || !img.naturalWidth) return;

        var dw = Math.floor(this.w);    // draw width (scaled)
        var dh = Math.floor(this.h);    // draw height (scaled)
        var dx = Math.floor(this.x);    // draw x position
        var dy = Math.floor(this.y);    // draw y position

        var canvasW = engine.width;    // canvas width
        var canvasH = engine.height;   // canvas height

        // skip draw if fully offscreen
        if (dx + dw <= 0 || dy + dh <= 0 || dx >= canvasW || dy >= canvasH) return;

        var sx = 0;                                     // source crop x
        var sy = 0;                                     // source crop y
        var sw = img.naturalWidth;                      // source width
        var sh = img.naturalHeight;                     // source height

        // vertical clipping if clipHeight is set
        if (this.clipHeight != null && this.clipHeight < dh) {
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
            var overflow = (dx + dw) - canvasW;         // overflow right
            sw -= (overflow / dw) * sw;                 // reduce crop width
            dw -= overflow;                             // reduce draw width
        }

        // draw if everything valid
        if (dw > 0 && dh > 0 && sw > 0 && sh > 0) {
            ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);

            if (this.outline) {
                // draw box around the destination area
                ctx.strokeStyle = this.outline; // outline color
                ctx.lineWidth = 1;              // outline thickness
                ctx.strokeRect(dx, dy, dw, dh);
            }
        }

        if (_debuggingEnabled) {
            drawSpriteLabels(ctx, dx, dy, dw, dh, canvasH);
        }

        if (this.collidable) {
            this._drawWidth = dw;
            this._drawHeight = dh;
            this.computeBounds(img);
        }
    };
    Sprite.prototype.resize = function () {

        if (this.destroyed) return;

        var imgKey = this.getFrameKey();
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

        var scaleW = engine.width / this.originalCanvasW;
        var scaleH = engine.height / this.originalCanvasH;

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
        var finalSize = finalizeSize(this.w, this.h, this.preserveAspect, this.aspectRatio, img.naturalWidth, img.naturalHeight);
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
            this.computeBounds(img);
        }

        // now update canvas ref so future resize is from here
        this.originalCanvasW = engine.width;
        this.originalCanvasH = engine.height;
    };
    /**
     * Computes bounding box from image and caches relative bounds
     * @param {HTMLImageElement} img - Sprite image
     * @returns {void}
     */
    Sprite.prototype.computeBounds = function (img) {
        var frameKey = this.getFrameKey();

        if (!this.relBounds || this._lastBoundsKey !== frameKey) {
            this.relBounds = boundingCache.get(frameKey);
            if (!this.relBounds) {
                this.relBounds = getBounds(img, 1);
                boundingCache.set(frameKey, this.relBounds);
            }
            this._lastBoundsKey = frameKey;
        }

        // scale relBounds from image space into sprite draw space
        var scaleX = (this._drawWidth || this.w) / img.naturalWidth;
        var scaleY = (this._drawHeight || this.h) / img.naturalHeight;

        this.bounds = {
            x: this.x + this.relBounds.x * scaleX,
            y: this.y + this.relBounds.y * scaleY,
            w: this.relBounds.w * scaleX,
            h: this.relBounds.h * scaleY
        };

        if (_debuggingEnabled) {
            _canvasCtx.strokeStyle = 'red';
            _canvasCtx.lineWidth = 1;
            _canvasCtx.strokeRect(this.bounds.x, this.bounds.y, this.bounds.w, this.bounds.h);
        }
    };
    Sprite.prototype.drawRepeatX = function (ctx) {

        var imgKey = this.getFrameKey();
        var img = images[imgKey];
        if (!img || !img.complete || !img.naturalWidth) return;

        var x = Math.floor(this.x);
        var y = Math.floor(this.y);
        var w = this.w;
        var h = this.h;

        if (w <= 0 || h <= 0) return;

        var sw = img.naturalWidth;
        var sh = img.naturalHeight;

        var startX = Math.floor(x % w);

        for (var px = startX - w; px < engine.width; px += w) {
            ctx.drawImage(img, 0, 0, sw, sh, Math.floor(px), y, w, h);
        }
    };
    Sprite.prototype.drawRepeatY = function (ctx) {

        var imgKey = this.getFrameKey();
        var img = images[imgKey];
        if (!img || !img.naturalHeight) return;

        var x = Math.floor(this.x);
        var y = Math.floor(this.y);
        var w = this.w;
        var h = this.h;

        if (w <= 0 || h <= 0) return;

        var sw = img.naturalWidth;
        var sh = img.naturalHeight;

        var startY = Math.floor(y % h);

        for (var py = startY - h; py < engine.height; py += h) {
            ctx.drawImage(img, 0, 0, sw, sh, x, Math.floor(py), w, h);
        }
    };
    Sprite.prototype.animate = function (delayBetweenFrames) {
        if (!this._animated) return;

        var now = Date.now();
        this._lastFrameTime = this._lastFrameTime || now;

        if (now - this._lastFrameTime >= delayBetweenFrames) {
            this._lastFrameTime = now;
            this._frameIndex = (this._frameIndex + 1) % this.key.length;
        }
    };
    Sprite.prototype.moveX = function (dx) {
        this.x = this.x + dx;
    };
    Sprite.prototype.moveY = function (dy) {
        this.y = this.y + dy;
    };
    Sprite.prototype.center = function (offsetX, offsetY) {
        this.centerX(offsetX);
        this.centerY(offsetY);
    };
    Sprite.prototype.centerX = function (offsetX) {
        offsetX = offsetX || 0;
        this.x = Math.floor((engine.width - this.w) / 2) + offsetX;
    };
    Sprite.prototype.centerY = function (offsetY) {
        offsetY = offsetY || 0;
        this.y = Math.floor((engine.height - this.h) / 2) + offsetY;
    };
    Sprite.prototype.bounce = function (range, speed) {
        range = (typeof range === 'number') ? range : 8;
        speed = (typeof speed === 'number') ? speed : 10;

        this.bounceTick = (this.bounceTick === undefined) ? 0 : this.bounceTick + 1;
        this.y = Math.floor(this.initialY + Math.sin(this.bounceTick / speed) * range);
    };
    /**
     * Scrolls a sprite in the X direction and respawns after delay if offscreen
     * @param {number} speed - horizontal speed in pixels per frame
     * @param {number} respawnAfterMs - delay in ms before respawning
     * @param {number} [offset=50] - extra offset beyond screen edge for respawn
     * @returns {void}
     */
    Sprite.prototype.parallaxScrollX = function(speed, respawnAfterMs, offset) {
        if (this.destroyed) return;

        var now = performance.now();
        var extra = (typeof offset === 'number') ? offset : 50;

        // if waiting to respawn
        if (this.respawnAt) {
            if (now >= this.respawnAt) {
                this.x = (speed < 0)
                    ? engine.width + extra + Math.floor(Math.random() * 100)
                    : -this.w - extra - Math.floor(Math.random() * 100);

                this.respawnAt = null;
            }

            return;
        }

        // move sprite
        this.moveX(speed);

        // start respawn timer if offscreen in current direction
        if ((speed < 0 && this.x + this.w < 0) || (speed > 0 && this.x > engine.width)) {
            this.respawnAt = now + respawnAfterMs;
        }
    };
    /**
     * Scrolls a sprite in the Y direction and respawns after delay if offscreen
     * @param {number} speed - vertical speed in pixels per frame (negative = up, positive = down)
     * @param {number} respawnAfterMs - delay in ms before respawning
     * @param {number} [offset=50] - extra offset beyond screen edge for respawn
     * @returns {void}
     */
    Sprite.prototype.parallaxScrollY = function(speed, respawnAfterMs, offset) {
        if (this.destroyed) return;

        var now = performance.now();
        var extra = (typeof offset === 'number') ? offset : 50;

        // if waiting to respawn
        if (this.respawnAt) {
            if (now >= this.respawnAt) {
                this.y = (speed < 0)
                    ? engine.height + extra + Math.floor(Math.random() * 100)
                    : -this.h - extra - Math.floor(Math.random() * 100);

                this.respawnAt = null;
            }

            return;
        }

        // move sprite
        this.moveY(speed);

        // start respawn timer if offscreen in current direction
        if ((speed < 0 && this.y + this.h < 0) || (speed > 0 && this.y > engine.height)) {
            this.respawnAt = now + respawnAfterMs;
        }
    };
    /**
     * Scrolls sprite in X direction and loops immediately after leaving screen
     * @param {number} speed - horizontal speed in pixels per frame
     * @returns {void}
     */
    Sprite.prototype.loopScrollX = function(speed) {
        if (this.destroyed) return;

        this.moveX(speed);

        if (speed < 0 && this.x + this.w < 0) {
            this.x += this.w;
        }

        if (speed > 0 && this.x > engine.width) {
            this.x -= this.w;
        }
    };
    Sprite.prototype.isCollidingWith = function (target) {
        if (!this.bounds || !target.bounds) return false;

        var ab = this.bounds;
        var bb = target.bounds;

        return !(
            ab.x + ab.w <= bb.x ||
            ab.x >= bb.x + bb.w ||
            ab.y + ab.h <= bb.y ||
            ab.y >= bb.y + bb.h
        );
    };
    Sprite.prototype.destroy = function () {
        this.destroyed = true; // let anyone with a reference to this know its dead
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
                return Math.floor(this.clipHeight != null ? this.clipHeight : this.h);
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
     * Computes the tight bounding box around solid (alpha ≥ threshold) pixels
     * @param {HTMLImageElement} img - Image to analyze
     * @param {number} [threshold=1] - Minimum alpha value to consider a pixel solid
     * @returns {object} { x:number, y:number, w:number, h:number }
     */
    function getBounds(img, threshold) {

        log('getBounds('+img.key+','+threshold+')');

        var w = img.naturalWidth;
        var h = img.naturalHeight;

        _boundsCanvas.width = w;
        _boundsCanvas.height = h;
        _boundsCtx.clearRect(0, 0, w, h);
        _boundsCtx.drawImage(img, 0, 0, w, h);

        var data = _boundsCtx.getImageData(0, 0, w, h).data;

        var minX = w, minY = h, maxX = -1, maxY = -1;

        for (var y = 0; y < h; y++) {
            for (var x = 0; x < w; x++) {
                var alpha = data[(y * w + x) * 4 + 3];
                if (alpha >= threshold) {
                    if (x < minX) minX = x;
                    if (y < minY) minY = y;
                    if (x > maxX) maxX = x;
                    if (y > maxY) maxY = y;
                }
            }
        }

        if (maxX < minX || maxY < minY) {
            return { x: 0, y: 0, w: 0, h: 0 };
        }

        return {
            x: minX,
            y: minY,
            w: maxX - minX + 1,
            h: maxY - minY + 1
        };
    }

    /**
     * Starts the game loop
     */
    function startLoop() {

        if (!_initilised) throw new Error('punter.setup must be called first');

        _canvasCtx = _canvas.getContext('2d', { alpha: true, desynchronized: true });
        _canvasCtx.imageSmoothingEnabled = false;

        _frame = 1;

        var now, last = performance.now(), accumulator = 0, step = 1000 / 60;
        var fps = 0;
        var fpsCounter = 0;
        var fpsTimer = performance.now();

        function loop(timestamp) {
            now = timestamp;
            var frameTime = now - last;
            frameTime = Math.min(frameTime, 100); // max 100ms delay
            // if (frameTime > 1000) frameTime = step;
            last = now;
            accumulator += frameTime;

            while (accumulator >= step) {
                eventHandlers.update();
                mouse.clicked = false;
                _frame++;
                _totalFrames++;
                if (_frame > 60) {
                    _frame = 0;
                }
                accumulator -= step;
            }

            // clear screen
            _canvasCtx.clearRect(0, 0, engine.width, engine.height);

            // draw everything
            eventHandlers.draw.call(_canvasCtx);

            // reset the flag after draw
            _resized = false;
            
            fpsCounter++;

            // update fps every 1000ms
            if (now - fpsTimer >= 1000) {
                fps = fpsCounter;
                fpsCounter = 0;
                fpsTimer = now;
            }

            // debug overlay
            if (_debuggingEnabled) {
                drawDebugInfo(_canvasCtx, _frame, fps, engine.width, engine.height);
            }

            _loopId = requestAnimationFrame(loop);
        }

        _paused = false;
        _loopId = requestAnimationFrame(loop);
        _running = true;
    }

    function pauseLoop() {

        if (!_initilised) throw new Error('punter.setup must be called first');

        if (_loopId !== null) {
            cancelAnimationFrame(_loopId);
            _loopId = null;
        }

        _paused = true;
        _running = false;
    }

    /**
     * Plays a sound from the loaded buffer
     * @param {string} name - name of the sound buffer
     * @param {Object} [options] - optional settings
     * @param {number} [options.volume] - volume from 0 to 1
     * @param {boolean} [options.loop] - whether to loop the sound
     * @param {boolean} [options.once] - if true, don't track for stopping
     * @param {number} [options.speed] - playback speed multiplier (1 = normal)
     * @returns {void}
     */
    function playSound(name, options) {

        if (!_initilised) throw new Error('punter.setup must be called first');

        var buffer = sounds[name];
        if (!buffer) return;

        try {

            // always stop if sound already playing
            stopSound(name);

            var source = audioCtx.createBufferSource();
            source.buffer = buffer;

            var gainNode = audioCtx.createGain();
            gainNode.gain.value = (options && options.volume != null) ? options.volume : 1;

            source.loop = !!(options && options.loop);

            // apply playback speed if provided
            source.playbackRate.value = (options && options.speed != null) ? options.speed : 1;

            source.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            source.start(0);

            if (!options || !options.once) {
                if (!playingSounds[name]) playingSounds[name] = [];
                playingSounds[name].push(source);
                source.onended = function () {
                    var arr = playingSounds[name];
                    if (arr) {
                        var idx = arr.indexOf(source);
                        if (idx !== -1) arr.splice(idx, 1);
                    }
                };
            }
        } catch (e) { }
    }

    function stopSound(name) {

        if (!_initilised) throw new Error('punter.setup must be called first');

        var arr = playingSounds[name];
        if (!arr || !arr.length) return;
        for (var i = 0; i < arr.length; i++) {
            try { arr[i].stop(0); } catch (e) { }
        }
        playingSounds[name] = [];
    }

    function clearInput() {
        for (var key in keys) {
            keys[key] = false;
        }
        mouse.clicked = false;
    };

    /**
     * Get the actual size of the viewport
     * @returns {object}
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
        if (engine.sceneName) {
            setAttribute(htmlEl, 'data-punter-scene', engine.sceneName);
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

        if (screenRatio > baseRatio) {
            internalH = baseH;
            internalW = Math.round(internalH * screenRatio);
        }
        else {
            internalW = baseW;
            internalH = Math.round(internalW / screenRatio);
        }

        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        _dpr = dpr;

        if (dpr > 1) {
            _canvas.width = internalW * dpr;
            _canvas.height = internalH * dpr;
        }
        else {
            _canvas.width = internalW;
            _canvas.height = internalH;
        }

        var scaleX = screenW / internalW;
        var scaleY = screenH / internalH;
        var scale = Math.min(scaleX, scaleY);

        _canvas.style.width = internalW + 'px';
        _canvas.style.height = internalH + 'px';
        _canvas.style.transform = 'translate(-50%, -50%) scale(' + scale + ')';

        setDevVars();
        _resized = true;

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

        function handleResizeEvent() {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(resize, 3);
        }

        window.addEventListener('resize', handleResizeEvent);
        window.addEventListener('orientationchange', handleResizeEvent);
    }

    /* --- public api --- */

    var api = {

        // initialization
        setup: setup,

        // scene lifecycle
        scene: function (name, handler) {
            _scenes[name] = handler;
        },
        go: function (name) {

            if (!_initilised) throw new Error('punter.setup must be called first');
            if (!_scenes[name]) throw new Error('punter.go: unknown scene "' + name + '"');

            // remove existing game loop handlers
            eventHandlers.update = function () {};
            eventHandlers.draw = function () {};

            // ensure we clear all input from last scene
            engine.clearInput();

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
        resume: function () {
            if (_loopId === null && _canvas && _initilised) {
                startLoop();
            }
        },
        redraw: function () {
            if (!this.canvas || !this.ctx) return;

            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

            for (var id in _sprites) {
                if (Object.prototype.hasOwnProperty.call(_sprites, id)) {
                    var sprite = _sprites[id];
                    if (!sprite.destroyed) {
                        sprite.draw(this.ctx);
                    }
                }
            }
        },

        // sprite factory
        createSprite: function(opts) {
            if (!_initilised) throw new Error('createSprite: punter.setup must be called first');
            return new Sprite(opts);
        },
        getSprite: function(id) {
            return _sprites[id] ? _sprites[id] : null;
        },

         // input handling
        clearInput: clearInput,
        keys: keys,
        mouse: mouse,

        // event listeners
        on: function (event, handler) {
            if (!eventHandlers.hasOwnProperty(event)) throw new Error('punter.on: unknown event "' + event + '"');
            eventHandlers[event] = handler;
        },

        // sound control
        playSound: playSound,
        stopSound: stopSound
    };

    Object.defineProperties(api, {
        sceneName: {
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
        ctx: {
            get: function () {
                return _canvasCtx ? _canvasCtx : null;
            },
            enumerable: true
        },
        width: {
            get: function () {
                return _canvas ? _canvas.width : null;
            },
            set: function (value) {
                if (_canvas && typeof value === 'number') {
                    _canvas.width = value;
                }
            },
            enumerable: true
        },
        height: {
            get: function () {
                return _canvas ? _canvas.height : null;
            },
            set: function (value) {
                if (_canvas && typeof value === 'number') {
                    _canvas.height = value;
                }
            },
            enumerable: true
        },
        frame: {
            get: function () {
                return _frame;
            },
            enumerable: true
        },
        totalFrames: {
            get: function () {
                return _totalFrames;
            },
            enumerable: true
        },
        running: {
            get: function () {
                return _running;
            },
            enumerable: true
        },
        paused: {
            get: function () {
                return _paused;
            },
            enumerable: true
        },
        resized: {
            get: function () {
                return _resized;
            },
            enumerable: true
        },
        sprites: {
            get: function () {
                var arr = [];
                for (var key in _sprites) {
                    if (_sprites[key]) arr.push(_sprites[key]);
                }
                return arr;
            },
            enumerable: true
        },
        dpr: {
            get: function () {
                return _dpr;
            },
            enumerable: true
        },
        isMobile: {
            get: function() {
                return _isMobile;
            }
        },
        isDesktop: {
            get: function() {
                return !_isMobile;
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
        _debugFont = getCssVar('punter-debug-font', '12px monospace');

        setDevVars();
    });

    window.addEventListener('error', function (event) {
        log('[Global Error]', event.message, 'at', event.filename + ':' + event.lineno + ':' + event.colno, event.error);
    });

    window.addEventListener('unhandledrejection', function (event) {
        log('[Unhandled Promise Rejection]', event.reason);
    });

})(window);
