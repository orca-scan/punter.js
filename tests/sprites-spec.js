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
            punter.sprites.forEach(function (s) { s.destroy(); });
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
            try { punter.createSprite({ id: 's1', image: 'hero' }); } catch (e) { errors.push('no-x'); }
            return errors;
        });
        expect(result).toContain('no-opts');
        expect(result).toContain('no-x');
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

    it('errors when an SVG is missing viewBox, width or height', async function () {
        var svgPage = await setup.newPageAt('/tests/fixtures/svg-invalid.html');
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
        expect(result.error).toContain('must have viewBox, width and height');
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
});
