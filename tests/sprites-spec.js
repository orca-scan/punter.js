'use strict';

var setup = require('./setup');

describe('Sprites', function () {

    var page;

    beforeAll(async function () {
        page = await setup.newPage();
    });

    afterAll(async function () {
        await page.close();
    });

    afterEach(async function () {
        await page.evaluate(function () {
            punter.scene('_cleanup', function () {});
            punter.go('_cleanup');
        });
    });

    // --- creation ---

    it('creates a sprite with the given id, x and y', async function () {
        var result = await page.evaluate(function () {
            var s = punter.createSprite({ id: 's1', image: 'hero', x: 10, y: 20 });
            return { id: s.id, x: s.x, y: s.y };
        });
        expect(result.id).toBe('s1');
        expect(result.x).toBe(10);
        expect(result.y).toBe(20);
    });

    it('defaults width and height from the image dimensions', async function () {
        var result = await page.evaluate(function () {
            var s = punter.createSprite({ id: 's1', image: 'hero', x: 0, y: 0 });
            return { w: s.w, h: s.h };
        });
        // 1x1 pixel image → both default to 1
        expect(result.w).toBe(1);
        expect(result.h).toBe(1);
    });

    it('throws when creating a sprite with a duplicate id', async function () {
        var threw = await page.evaluate(function () {
            try {
                punter.createSprite({ id: 's1', image: 'hero', x: 0, y: 0 });
                punter.createSprite({ id: 's1', image: 'hero', x: 0, y: 0 });
                return false;
            } catch (e) { return true; }
        });
        expect(threw).toBe(true);
    });

    it('throws when the image key has not been loaded', async function () {
        var threw = await page.evaluate(function () {
            try {
                punter.createSprite({ id: 's1', image: 'missing', x: 0, y: 0 });
                return false;
            } catch (e) { return true; }
        });
        expect(threw).toBe(true);
    });

    it('throws when required opts are missing', async function () {
        var result = await page.evaluate(function () {
            var errors = [];
            try { punter.createSprite(); } catch (e) { errors.push('no-opts'); }
            try { punter.createSprite({ image: 'hero' }); } catch (e) { errors.push('no-x'); }
            return errors;
        });
        expect(result).toContain('no-opts');
        expect(result).toContain('no-x');
    });

    it('auto-generates a unique id when none is provided', async function () {
        var result = await page.evaluate(function () {
            var s = punter.createSprite({ image: 'hero', x: 0, y: 0 });
            return typeof s.id === 'string' && s.id.length > 0;
        });
        expect(result).toBe(true);
    });

    // --- retrieval ---

    it('getSprite returns the sprite by id', async function () {
        var result = await page.evaluate(function () {
            punter.createSprite({ id: 's1', image: 'hero', x: 0, y: 0 });
            var found = punter.getSprite('s1');
            return found ? found.id : null;
        });
        expect(result).toBe('s1');
    });

    it('getSprite returns null for an unknown id', async function () {
        var result = await page.evaluate(function () {
            return punter.getSprite('nope');
        });
        expect(result).toBeNull();
    });

    // --- movement ---

    it('moveX changes x position', async function () {
        var result = await page.evaluate(function () {
            var s = punter.createSprite({ id: 's1', image: 'hero', x: 50, y: 0 });
            s.moveX(10);
            var after1 = s.x;
            s.moveX(-25);
            return { after1: after1, after2: s.x };
        });
        expect(result.after1).toBe(60);
        expect(result.after2).toBe(35);
    });

    it('moveY changes y position', async function () {
        var result = await page.evaluate(function () {
            var s = punter.createSprite({ id: 's1', image: 'hero', x: 0, y: 50 });
            s.moveY(15);
            return s.y;
        });
        expect(result).toBe(65);
    });

    it('centerX positions the sprite horizontally in the middle', async function () {
        var result = await page.evaluate(function () {
            var s = punter.createSprite({ id: 's1', image: 'hero', x: 0, y: 0 });
            s.centerX();
            return { x: s.x, expected: Math.floor((punter.width - s.w) / 2) };
        });
        expect(result.x).toBe(result.expected);
    });

    it('centerY positions the sprite vertically in the middle', async function () {
        var result = await page.evaluate(function () {
            var s = punter.createSprite({ id: 's1', image: 'hero', x: 0, y: 0 });
            s.centerY();
            return { y: s.y, expected: Math.floor((punter.height - s.h) / 2) };
        });
        expect(result.y).toBe(result.expected);
    });

    // --- bounce ---

    it('bounce oscillates the sprite y around its initial position', async function () {
        var result = await page.evaluate(function () {
            var s = punter.createSprite({ id: 's1', image: 'hero', x: 0, y: 100 });
            var initial = s.initialY;
            s.bounce(8, 10);
            var firstY = s.y;
            for (var i = 0; i < 15; i++) s.bounce(8, 10);
            return { initial: initial, firstY: firstY, laterY: s.y };
        });
        expect(result.firstY).toBe(result.initial);
        expect(result.laterY).not.toBe(result.initial);
    });

    // --- visibility ---

    it('visible is true when the sprite is on screen', async function () {
        var result = await page.evaluate(function () {
            var s = punter.createSprite({ id: 's1', image: 'hero', x: 0, y: 0 });
            return s.visible;
        });
        expect(result).toBe(true);
    });

    it('visible is false when the sprite is fully off the left edge', async function () {
        var result = await page.evaluate(function () {
            var s = punter.createSprite({ id: 's1', image: 'hero', x: 0, y: 0 });
            s.moveX(-(s.w + 1));
            return s.visible;
        });
        expect(result).toBe(false);
    });

    // --- destroy ---

    it('destroy marks the sprite as destroyed and removes it from the registry', async function () {
        var result = await page.evaluate(function () {
            var s = punter.createSprite({ id: 's1', image: 'hero', x: 0, y: 0 });
            s.destroy();
            return { destroyed: s.destroyed, found: punter.getSprite('s1') };
        });
        expect(result.destroyed).toBe(true);
        expect(result.found).toBeNull();
    });

    // --- animation ---

    it('getFrameImage returns the image string for a non-animated sprite', async function () {
        var result = await page.evaluate(function () {
            var s = punter.createSprite({ id: 's1', image: 'hero', x: 0, y: 0 });
            return s.getFrameImage();
        });
        expect(result).toBe('hero');
    });

    it('getFrameImage cycles through images for an animated sprite', async function () {
        var result = await page.evaluate(function () {
            var s = punter.createSprite({ id: 's1', image: ['hero', 'hero'], x: 0, y: 0 });
            return s.getFrameImage();
        });
        expect(result).toBe('hero');
    });

    it('animate advances the frame index after the delay elapses', async function () {
        var result = await page.evaluate(function () {
            var s = punter.createSprite({ id: 's1', image: ['hero', 'hero'], x: 0, y: 0 });
            var initial = s._frameIndex;
            s.animate(0);
            var afterFirst = s._frameIndex;
            s.animate(0);
            return { initial: initial, afterFirst: afterFirst, afterSecond: s._frameIndex };
        });
        expect(result.initial).toBe(0);
        expect(result.afterFirst).toBe(1);
        expect(result.afterSecond).toBe(0);
    });

    // --- collision ---

    it('isCollidingWith returns true when bounding boxes overlap', async function () {
        var result = await page.evaluate(function () {
            var s1 = punter.createSprite({ id: 's1', image: 'hero', x: 0, y: 0, boundsMode: 'rect' });
            var s2 = punter.createSprite({ id: 's2', image: 'hero', x: 0, y: 0, boundsMode: 'rect' });
            return s1.isCollidingWith(s2);
        });
        expect(result).toBe(true);
    });

    it('isCollidingWith returns false when bounding boxes do not overlap', async function () {
        var result = await page.evaluate(function () {
            var s1 = punter.createSprite({ id: 's1', image: 'hero', x: 0, y: 0, boundsMode: 'rect' });
            var s2 = punter.createSprite({ id: 's2', image: 'hero', x: 200, y: 200, boundsMode: 'rect' });
            return s1.isCollidingWith(s2);
        });
        expect(result).toBe(false);
    });

    it('isCollidingWith returns false when either sprite is not collidable', async function () {
        var result = await page.evaluate(function () {
            var s1 = punter.createSprite({ id: 's1', image: 'hero', x: 0, y: 0 });
            var s2 = punter.createSprite({ id: 's2', image: 'hero', x: 0, y: 0, collidable: false });
            return s1.isCollidingWith(s2);
        });
        expect(result).toBe(false);
    });

    it('isCollidingWith detects collision after moveX', async function () {
        var result = await page.evaluate(function () {
            var s1 = punter.createSprite({ id: 's1', image: 'hero', x: 0, y: 0, w: 10, h: 10, boundsMode: 'rect' });
            var s2 = punter.createSprite({ id: 's2', image: 'hero', x: 20, y: 0, w: 10, h: 10, boundsMode: 'rect' });
            var before = s1.isCollidingWith(s2);
            s1.moveX(15);
            var after = s1.isCollidingWith(s2);
            return { before: before, after: after };
        });
        expect(result.before).toBe(false);
        expect(result.after).toBe(true);
    });

    it('isCollidingWith works in pixel boundsMode using relBounds', async function () {
        var result = await page.evaluate(function () {
            // pixel mode scales relBounds by sprite size / natural image size
            var s1 = punter.createSprite({ id: 's1', image: 'hero', x: 0, y: 0, w: 10, h: 10, boundsMode: 'pixel' });
            var s2 = punter.createSprite({ id: 's2', image: 'hero', x: 5, y: 5, w: 10, h: 10, boundsMode: 'pixel' });
            var overlapping = s1.isCollidingWith(s2);
            var s3 = punter.createSprite({ id: 's3', image: 'hero', x: 50, y: 50, w: 10, h: 10, boundsMode: 'pixel' });
            var separated = s1.isCollidingWith(s3);
            return { overlapping: overlapping, separated: separated };
        });
        expect(result.overlapping).toBe(true);
        expect(result.separated).toBe(false);
    });

    it('pixel boundsMode refreshes bounds after position change', async function () {
        var result = await page.evaluate(function () {
            var s1 = punter.createSprite({ id: 's1', image: 'hero', x: 0, y: 0, w: 10, h: 10, boundsMode: 'pixel' });
            var s2 = punter.createSprite({ id: 's2', image: 'hero', x: 50, y: 0, w: 10, h: 10, boundsMode: 'pixel' });
            var before = s1.isCollidingWith(s2);
            s1.moveX(45);
            var after = s1.isCollidingWith(s2);
            return { before: before, after: after };
        });
        expect(result.before).toBe(false);
        expect(result.after).toBe(true);
    });

    it('pixel boundsMode ignores transparent corner overlap for round sprites', async function () {
        var result = await page.evaluate(function () {
            var s1 = punter.createSprite({ id: 's1', image: 'circle', x: 0, y: 0, w: 40, h: 40, boundsMode: 'pixel' });
            var s2 = punter.createSprite({ id: 's2', image: 'circle', x: 29, y: 29, w: 40, h: 40, boundsMode: 'pixel' });
            var cornerOnly = s1.isCollidingWith(s2);
            s2.moveX(-8);
            s2.moveY(-8);
            var directOverlap = s1.isCollidingWith(s2);
            return { cornerOnly: cornerOnly, directOverlap: directOverlap };
        });

        expect(result.cornerOnly).toBe(false);
        expect(result.directOverlap).toBe(true);
    });

    it('pixel boundsMode vs rect only collides when solid mask area overlaps', async function () {
        var result = await page.evaluate(function () {
            var s1 = punter.createSprite({ id: 's1', image: 'circle', x: 0, y: 0, w: 40, h: 40, boundsMode: 'pixel' });
            var cornerRect = { x: 31, y: 31, w: 6, h: 6 };
            var centerRect = { x: 15, y: 15, w: 6, h: 6 };
            return {
                corner: s1.isCollidingWith(cornerRect),
                center: s1.isCollidingWith(centerRect)
            };
        });

        expect(result.corner).toBe(false);
        expect(result.center).toBe(true);
    });

    it('isCollidingWith accepts a plain { x, y, w, h } rect object', async function () {
        var result = await page.evaluate(function () {
            var s = punter.createSprite({ id: 's1', image: 'hero', x: 10, y: 10, w: 20, h: 20, boundsMode: 'rect' });
            var overlapping = s.isCollidingWith({ x: 20, y: 20, w: 20, h: 20 });
            var separated   = s.isCollidingWith({ x: 100, y: 100, w: 20, h: 20 });
            return { overlapping: overlapping, separated: separated };
        });
        expect(result.overlapping).toBe(true);
        expect(result.separated).toBe(false);
    });

    it('rotate increments sprite angle', async function () {
        var result = await page.evaluate(function () {
            var s = punter.createSprite({ id: 's1', x: 0, y: 0, w: 32, h: 32, vector: function () {} });
            s.rotate(1);
            s.rotate(0.5);
            return s.angle;
        });
        expect(result).toBeCloseTo(1.5, 5);
    });

    // --- seen flag ---

    it('seen flag starts as false and can be set', async function () {
        var result = await page.evaluate(function () {
            var s = punter.createSprite({ id: 's1', image: 'hero', x: 0, y: 0 });
            var initial = s.seen;
            s.seen = true;
            return { initial: initial, afterSet: s.seen };
        });
        expect(result.initial).toBe(false);
        expect(result.afterSet).toBe(true);
    });

    // --- svg loading ---

    it('errors when an SVG has no usable dimension attributes', async function () {
        var svgPage = await setup.newPageAt('/tests/fixtures/svg-loader.html?svg=svg-no-attrs.svg');
        await svgPage.waitForFunction(
            'document.documentElement.hasAttribute("data-punter-error") || window.__ready === true',
            { timeout: 5000 }
        );
        var result = await svgPage.evaluate(function () {
            return {
                ready: window.__ready,
                error: document.documentElement.getAttribute('data-punter-error')
            };
        });
        expect(result.ready).toBe(false);
        expect(result.error).toContain('must have either a viewBox or numeric width and height');
        await svgPage.close();
    });

    it('errors when an SVG has percentage units and no viewBox', async function () {
        var svgPage = await setup.newPageAt('/tests/fixtures/svg-loader.html?svg=svg-pct-units.svg');
        await svgPage.waitForFunction(
            'document.documentElement.hasAttribute("data-punter-error") || window.__ready === true',
            { timeout: 5000 }
        );
        var result = await svgPage.evaluate(function () {
            return {
                ready: window.__ready,
                error: document.documentElement.getAttribute('data-punter-error')
            };
        });
        expect(result.ready).toBe(false);
        expect(result.error).toContain('must have either a viewBox or numeric width and height');
        await svgPage.close();
    });

    it('loads an SVG successfully when viewBox, width and height are present', async function () {
        var svgPage = await setup.newPageAt('/tests/fixtures/svg-valid.html');
        await svgPage.waitForFunction('window.__ready === true', { timeout: 5000 });
        var result = await svgPage.evaluate(function () {
            return window.__ready;
        });
        expect(result).toBe(true);
        await svgPage.close();
    });

    it('loads an SVG with only viewBox and infers width/height', async function () {
        var svgPage = await setup.newPageAt('/tests/fixtures/svg-loader.html?svg=svg-viewbox-only.svg');
        await svgPage.waitForFunction('window.__ready === true', { timeout: 5000 });
        var result = await svgPage.evaluate(function () {
            var s = punter.createSprite({ id: 'vbOnly', image: 'icon', x: 0, y: 0 });
            return { w: s.w, h: s.h };
        });
        expect(result.w).toBe(120);
        expect(result.h).toBe(80);
        await svgPage.close();
    });

    it('loads an SVG with only width/height and infers viewBox', async function () {
        var svgPage = await setup.newPageAt('/tests/fixtures/svg-loader.html?svg=svg-wh-only.svg');
        await svgPage.waitForFunction('window.__ready === true', { timeout: 5000 });
        var result = await svgPage.evaluate(function () {
            var s = punter.createSprite({ id: 'whOnly', image: 'icon', x: 0, y: 0 });
            return { w: s.w, h: s.h };
        });
        expect(result.w).toBe(90);
        expect(result.h).toBe(60);
        await svgPage.close();
    });

    it('sprite dimensions match the SVG width and height', async function () {
        var svgPage = await setup.newPageAt('/tests/fixtures/svg-valid.html');
        await svgPage.waitForFunction('window.__ready === true', { timeout: 5000 });
        var result = await svgPage.evaluate(function () {
            var s = punter.createSprite({ id: 'svgSprite', image: 'icon', x: 0, y: 0 });
            return { w: s.w, h: s.h };
        });
        expect(result.w).toBe(73);
        expect(result.h).toBe(47);
        await svgPage.close();
    });

    // --- vector sprites ---

    it('creates a vector sprite with the given x, y, w and h', async function () {
        var result = await page.evaluate(function () {
            var s = punter.createSprite({ id: 's1', x: 10, y: 20, w: 50, h: 60, vector: function () {} });
            return { id: s.id, x: s.x, y: s.y, w: s.w, h: s.h };
        });
        expect(result.id).toBe('s1');
        expect(result.x).toBe(10);
        expect(result.y).toBe(20);
        expect(result.w).toBe(50);
        expect(result.h).toBe(60);
    });

    it('vector sprite defaults boundsMode to rect', async function () {
        var result = await page.evaluate(function () {
            var s = punter.createSprite({ id: 's1', x: 0, y: 0, w: 32, h: 32, vector: function () {} });
            return s.boundsMode;
        });
        expect(result).toBe('rect');
    });

    it('throws when vector sprite is missing w', async function () {
        var threw = await page.evaluate(function () {
            try {
                punter.createSprite({ id: 's1', x: 0, y: 0, h: 32, vector: function () {} });
                return false;
            } catch (e) { return true; }
        });
        expect(threw).toBe(true);
    });

    it('throws when vector sprite is missing h', async function () {
        var threw = await page.evaluate(function () {
            try {
                punter.createSprite({ id: 's1', x: 0, y: 0, w: 32, vector: function () {} });
                return false;
            } catch (e) { return true; }
        });
        expect(threw).toBe(true);
    });

    it('throws when neither image nor vector is provided', async function () {
        var threw = await page.evaluate(function () {
            try {
                punter.createSprite({ id: 's1', x: 0, y: 0, w: 32, h: 32 });
                return false;
            } catch (e) { return true; }
        });
        expect(threw).toBe(true);
    });

    it('vector sprite isCollidingWith returns true when bounding boxes overlap', async function () {
        var result = await page.evaluate(function () {
            var s1 = punter.createSprite({ id: 's1', x: 0, y: 0, w: 32, h: 32, vector: function () {} });
            var s2 = punter.createSprite({ id: 's2', x: 10, y: 10, w: 32, h: 32, vector: function () {} });
            return s1.isCollidingWith(s2);
        });
        expect(result).toBe(true);
    });

    it('vector sprite isCollidingWith returns false when bounding boxes do not overlap', async function () {
        var result = await page.evaluate(function () {
            var s1 = punter.createSprite({ id: 's1', x: 0, y: 0, w: 32, h: 32, vector: function () {} });
            var s2 = punter.createSprite({ id: 's2', x: 200, y: 200, w: 32, h: 32, vector: function () {} });
            return s1.isCollidingWith(s2);
        });
        expect(result).toBe(false);
    });

    it('vector sprite moveX and moveY work', async function () {
        var result = await page.evaluate(function () {
            var s = punter.createSprite({ id: 's1', x: 50, y: 60, w: 32, h: 32, vector: function () {} });
            s.moveX(10);
            s.moveY(-5);
            return { x: s.x, y: s.y };
        });
        expect(result.x).toBe(60);
        expect(result.y).toBe(55);
    });

    it('vector sprite destroy removes it from the registry', async function () {
        var result = await page.evaluate(function () {
            var s = punter.createSprite({ id: 's1', x: 0, y: 0, w: 32, h: 32, vector: function () {} });
            s.destroy();
            return { destroyed: s.destroyed, found: punter.getSprite('s1') };
        });
        expect(result.destroyed).toBe(true);
        expect(result.found).toBeNull();
    });

    it('image and vector can coexist on a sprite', async function () {
        var result = await page.evaluate(function () {
            var s = punter.createSprite({ id: 's1', image: 'hero', x: 0, y: 0, vector: function () {} });
            return { hasImage: !!s.image, hasVector: typeof s.vector === 'function' };
        });
        expect(result.hasImage).toBe(true);
        expect(result.hasVector).toBe(true);
    });

    it('vector function is called with ctx, w and h when draw is triggered', async function () {
        var result = await page.evaluate(function () {
            var args = null;
            // create an offscreen canvas to supply a real 2d context
            var canvas = document.createElement('canvas');
            canvas.width = 100;
            canvas.height = 100;
            var ctx = canvas.getContext('2d');
            var s = punter.createSprite({
                id: 's1', x: 0, y: 0, w: 40, h: 50,
                vector: function (drawCtx, w, h) {
                    args = { hasCtx: !!drawCtx, w: w, h: h };
                }
            });
            s.draw(ctx);
            return args;
        });
        expect(result.hasCtx).toBe(true);
        expect(result.w).toBe(40);
        expect(result.h).toBe(50);
    });

    // --- blink ---

    it('blink hides the sprite on the off phase and shows it on the on phase', async function () {
        var result = await page.evaluate(function () {
            var orig = Date.now;
            var fakeNow = 0;
            Date.now = function () { return fakeNow; };

            var canvas = document.createElement('canvas');
            canvas.width = 100;
            canvas.height = 100;
            var ctx = canvas.getContext('2d');
            var drawn = [];

            var s = punter.createSprite({
                id: 's1', x: 0, y: 0, w: 32, h: 32,
                vector: function () { drawn.push(fakeNow); }
            });
            s.blink(130);

            fakeNow = 0;   s.draw(ctx); // on phase — drawn
            fakeNow = 130; s.draw(ctx); // off phase — skipped
            fakeNow = 260; s.draw(ctx); // on phase — drawn

            Date.now = orig;
            return drawn;
        });
        expect(result).toEqual([0, 260]);
    });

    it('blink auto-stops after durationMs and sprite stays visible', async function () {
        var result = await page.evaluate(function () {
            var orig = Date.now;
            var fakeNow = 0;
            Date.now = function () { return fakeNow; };

            var canvas = document.createElement('canvas');
            canvas.width = 100;
            canvas.height = 100;
            var ctx = canvas.getContext('2d');
            var drawn = [];

            var s = punter.createSprite({
                id: 's1', x: 0, y: 0, w: 32, h: 32,
                vector: function () { drawn.push(fakeNow); }
            });
            s.blink(130, 200);

            fakeNow = 0;   s.draw(ctx); // on phase
            fakeNow = 130; s.draw(ctx); // off phase
            fakeNow = 200; s.draw(ctx); // duration expired — visible, blink cleared
            fakeNow = 330; s.draw(ctx); // still visible (no active blink)

            Date.now = orig;
            return drawn;
        });
        expect(result).toEqual([0, 200, 330]);
    });

    it('blink(0) stops an active blink immediately', async function () {
        var result = await page.evaluate(function () {
            var orig = Date.now;
            var fakeNow = 0;
            Date.now = function () { return fakeNow; };

            var canvas = document.createElement('canvas');
            canvas.width = 100;
            canvas.height = 100;
            var ctx = canvas.getContext('2d');
            var drawn = [];

            var s = punter.createSprite({
                id: 's1', x: 0, y: 0, w: 32, h: 32,
                vector: function () { drawn.push(fakeNow); }
            });
            s.blink(130);

            fakeNow = 130; s.draw(ctx); // off phase — skipped
            s.blink(0);                 // stop blink
            s.draw(ctx);                // visible again

            Date.now = orig;
            return drawn;
        });
        expect(result).toEqual([130]);
    });

    it('blink uses 130ms as the default phase duration', async function () {
        var result = await page.evaluate(function () {
            var s = punter.createSprite({ id: 's1', image: 'hero', x: 0, y: 0 });
            s.blink();
            return s._blinkMs;
        });
        expect(result).toBe(130);
    });

    // --- resize guard (originalCanvasW = 0) ---

    it('image sprite resize does not produce Infinity when originalCanvasW is 0', async function () {
        var result = await page.evaluate(function () {
            var s = punter.createSprite({ id: 's1', image: 'hero', x: 10, y: 20 });
            // simulate sprite created before the first resize event
            s.originalCanvasW = 0;
            s.originalCanvasH = 0;
            s.resize();
            return { x: s.x, y: s.y, xFinite: isFinite(s.x), yFinite: isFinite(s.y) };
        });
        expect(result.xFinite).toBe(true);
        expect(result.yFinite).toBe(true);
    });

    it('vector sprite resize does not produce Infinity when originalCanvasW is 0', async function () {
        var result = await page.evaluate(function () {
            var s = punter.createSprite({ id: 's1', x: 10, y: 20, w: 32, h: 32, vector: function () {} });
            // simulate sprite created before the first resize event
            s.originalCanvasW = 0;
            s.originalCanvasH = 0;
            s.resize();
            return { x: s.x, y: s.y, xFinite: isFinite(s.x), yFinite: isFinite(s.y) };
        });
        expect(result.xFinite).toBe(true);
        expect(result.yFinite).toBe(true);
    });

    // --- vector pixel bounds ---

    it('vector sprite with boundsMode pixel rejects transparent corner overlap', async function () {
        var result = await page.evaluate(function () {
            // draw a circle inside the sprite bounds — corners are transparent
            var s1 = punter.createSprite({
                id: 's1', x: 0, y: 0, w: 40, h: 40, boundsMode: 'pixel',
                vector: function (ctx, w, h) {
                    ctx.beginPath();
                    ctx.arc(w / 2, h / 2, w / 2, 0, Math.PI * 2);
                    ctx.fillStyle = '#fff';
                    ctx.fill();
                }
            });
            // place second circle so only transparent corners overlap (well past grid tolerance)
            var s2 = punter.createSprite({
                id: 's2', x: 34, y: 34, w: 40, h: 40, boundsMode: 'pixel',
                vector: function (ctx, w, h) {
                    ctx.beginPath();
                    ctx.arc(w / 2, h / 2, w / 2, 0, Math.PI * 2);
                    ctx.fillStyle = '#fff';
                    ctx.fill();
                }
            });
            var corner = s1.isCollidingWith(s2);
            s2.x = 15; s2.y = 15;
            var center = s1.isCollidingWith(s2);
            return { corner: corner, center: center };
        });
        expect(result.corner).toBe(false);
        expect(result.center).toBe(true);
    });

    // --- rotation ---

    it('rotate() updates angle on image sprites and bounds track rotation', async function () {
        var result = await page.evaluate(function () {
            var s = punter.createSprite({ id: 's1', image: 'circle', x: 0, y: 0, w: 40, h: 40, boundsMode: 'pixel' });
            var before = { x: s.bounds.x, y: s.bounds.y, w: s.bounds.w, h: s.bounds.h };
            s.rotate(Math.PI / 4);
            // force bounds refresh
            s.isCollidingWith({ x: -1000, y: -1000, w: 1, h: 1 });
            var after = { x: s.bounds.x, y: s.bounds.y, w: s.bounds.w, h: s.bounds.h };
            return { angle: s.angle, boundsChanged: (before.w !== after.w || before.h !== after.h || before.x !== after.x) };
        });
        expect(result.angle).toBeCloseTo(Math.PI / 4, 5);
        expect(result.boundsChanged).toBe(true);
    });

    it('rotated vector sprite collision uses updated mask', async function () {
        var result = await page.evaluate(function () {
            // narrow horizontal bar: only fills middle row when unrotated
            var s1 = punter.createSprite({
                id: 's1', x: 0, y: 0, w: 40, h: 40, boundsMode: 'pixel',
                vector: function (ctx, w, h) {
                    ctx.translate(w / 2, h / 2);
                    ctx.rotate(this.angle || 0);
                    ctx.fillStyle = '#fff';
                    ctx.fillRect(-w / 2, -2, w, 4);
                }
            });
            // target sitting just above center — should not collide with horizontal bar
            var target = { x: 10, y: 0, w: 20, h: 8 };
            var beforeRotate = s1.isCollidingWith(target);
            // rotate bar 90° so it becomes vertical — should now collide with top area
            s1.angle = Math.PI / 2;
            s1.relBounds = null;
            s1._rotationCache = null;
            var afterRotate = s1.isCollidingWith(target);
            return { before: beforeRotate, after: afterRotate };
        });
        expect(result.before).toBe(false);
        expect(result.after).toBe(true);
    });

    it('rotation cache reuses data for the same quantized angle', async function () {
        var result = await page.evaluate(function () {
            var s = punter.createSprite({ id: 's1', image: 'circle', x: 0, y: 0, w: 40, h: 40, boundsMode: 'pixel' });
            s.rotate(Math.PI / 4);
            s.isCollidingWith({ x: -1000, y: -1000, w: 1, h: 1 });
            var cacheSize1 = Object.keys(s._rotationCache || {}).length;
            // tiny angle change within same quantized bucket
            s.angle += 0.001;
            s.isCollidingWith({ x: -1000, y: -1000, w: 1, h: 1 });
            var cacheSize2 = Object.keys(s._rotationCache || {}).length;
            return { cacheSize1: cacheSize1, cacheSize2: cacheSize2 };
        });
        expect(result.cacheSize1).toBe(1);
        expect(result.cacheSize2).toBe(1);
    });

    // --- scroll ---

    it('scroll moves sprite horizontally', async function () {
        var result = await page.evaluate(function () {
            var s = punter.createSprite({ id: 's1', image: 'hero', x: 100, y: 0, w: 20, h: 20 });
            s.scroll(-3, 0);
            return s.x;
        });
        expect(result).toBe(97);
    });

    it('scroll moves sprite vertically', async function () {
        var result = await page.evaluate(function () {
            var s = punter.createSprite({ id: 's1', image: 'hero', x: 0, y: 100, w: 20, h: 20 });
            s.scroll(0, 2);
            return s.y;
        });
        expect(result).toBe(102);
    });

    it('scroll with loop wraps horizontally to opposite edge', async function () {
        var result = await page.evaluate(function () {
            var s = punter.createSprite({ id: 's1', image: 'hero', x: 0, y: 0, w: 20, h: 20 });
            // move offscreen left manually
            s.x = -20;
            s.scroll(-2, 0, { loop: true });
            return { x: s.x, width: punter.width };
        });
        // x was -22, wraps by +(width + w) to near the right edge
        expect(result.x).toBe(result.width - 2);
    });

    it('scroll with loop wraps vertically to opposite edge', async function () {
        var result = await page.evaluate(function () {
            var s = punter.createSprite({ id: 's1', image: 'hero', x: 0, y: 0, w: 20, h: 20 });
            s.y = -20;
            s.scroll(0, -2, { loop: true });
            return { y: s.y, height: punter.height };
        });
        // y was -22, wraps by +(height + h) to near the bottom edge
        expect(result.y).toBe(result.height - 2);
    });

    it('scroll with loop wraps a small sprite correctly regardless of canvas size', async function () {
        var result = await page.evaluate(function () {
            var s = punter.createSprite({ id: 's1', image: 'hero', x: punter.width + 1, y: 0, w: 32, h: 32 });
            s.scroll(3, 0, { loop: true });
            // sprite was at width+1, moved to width+4, triggers wrap
            var xAfter = s.x;
            // wrapped x should be off the left edge (negative) entering from left
            return { x: xAfter, width: punter.width };
        });
        // sprite should wrap to -(width + w) offset from its position
        expect(result.x).toBe(result.width + 4 - result.width - 32);
        expect(result.x).toBeLessThan(0);
    });

    it('scroll with respawnAfter sets respawnAt when offscreen', async function () {
        var result = await page.evaluate(function () {
            var s = punter.createSprite({ id: 's1', image: 'hero', x: punter.width + 1, y: 0, w: 20, h: 20 });
            s.scroll(2, 0, { respawnAfter: 1000 });
            return typeof s.respawnAt === 'number' && s.respawnAt > 0;
        });
        expect(result).toBe(true);
    });

    it('scroll respawns after delay elapses', async function () {
        var result = await page.evaluate(function () {
            var s = punter.createSprite({ id: 's1', image: 'hero', x: 0, y: 0, w: 20, h: 20 });
            // manually set respawnAt in the past to simulate elapsed delay
            s.respawnAt = performance.now() - 1;
            s.scroll(-2, 0, { respawnAfter: 1000 });
            // should have respawned to right edge
            return s.x >= punter.width;
        });
        expect(result).toBe(true);
    });

    it('scroll respawn uses random offset up to options.offset', async function () {
        var result = await page.evaluate(function () {
            var results = [];
            for (var i = 0; i < 20; i++) {
                var s = punter.createSprite({ id: 's' + i, image: 'hero', x: 0, y: 0, w: 20, h: 20 });
                s.respawnAt = performance.now() - 1;
                s.scroll(-2, 0, { respawnAfter: 0, offset: 100 });
                results.push(s.x);
                s.destroy();
            }
            var min = Math.min.apply(null, results);
            var max = Math.max.apply(null, results);
            return { min: min, max: max, width: punter.width };
        });
        // all respawn positions should be >= canvas width and <= canvas width + 100
        expect(result.min).toBeGreaterThanOrEqual(result.width);
        expect(result.max).toBeLessThanOrEqual(result.width + 100);
    });

    it('scroll does nothing when sprite is destroyed', async function () {
        var result = await page.evaluate(function () {
            var s = punter.createSprite({ id: 's1', image: 'hero', x: 50, y: 50, w: 20, h: 20 });
            s.destroy();
            s.scroll(-5, 0);
            return { x: s.x, y: s.y };
        });
        expect(result.x).toBe(50);
        expect(result.y).toBe(50);
    });
});
