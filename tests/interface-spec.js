'use strict';

var setup = require('./setup');

describe('Interface', function () {

    var page;

    beforeAll(async function () {
        page = await setup.newPage();
    });

    afterAll(async function () {
        await page.close();
    });

    // --- public API surface ---

    it('exposes the expected methods', async function () {
        var result = await page.evaluate(function () {
            return {
                setup: typeof punter.setup,
                scene: typeof punter.scene,
                go: typeof punter.go,
                on: typeof punter.on,
                createSprite: typeof punter.createSprite,
                getSprite: typeof punter.getSprite,
                playSound: typeof punter.playSound,
                stopSound: typeof punter.stopSound,
                pause: typeof punter.pause,
                resume: typeof punter.resume,
                clearInput: typeof punter.clearInput,
                redraw: typeof punter.redraw
            };
        });
        Object.keys(result).forEach(function (key) {
            expect(result[key]).toBe('function');
        });
    });

    it('exposes keys and mouse objects', async function () {
        var result = await page.evaluate(function () {
            return {
                keysType: typeof punter.keys,
                mouseType: typeof punter.mouse
            };
        });
        expect(result.keysType).toBe('object');
        expect(result.mouseType).toBe('object');
    });

    // --- computed properties ---

    it('width and height return the canvas dimensions', async function () {
        var result = await page.evaluate(function () {
            return { width: punter.width, height: punter.height };
        });
        expect(typeof result.width).toBe('number');
        expect(typeof result.height).toBe('number');
        expect(result.width).toBeGreaterThan(0);
        expect(result.height).toBeGreaterThan(0);
    });

    it('dpr is a number between 1 and 2', async function () {
        var result = await page.evaluate(function () {
            return punter.dpr;
        });
        expect(typeof result).toBe('number');
        expect(result).toBeGreaterThanOrEqual(1);
        expect(result).toBeLessThanOrEqual(2);
    });

    it('frame is a non-negative number', async function () {
        var result = await page.evaluate(function () {
            return punter.frame;
        });
        expect(typeof result).toBe('number');
        expect(result).toBeGreaterThanOrEqual(0);
    });

    it('totalFrames is a non-negative number', async function () {
        var result = await page.evaluate(function () {
            return punter.totalFrames;
        });
        expect(typeof result).toBe('number');
        expect(result).toBeGreaterThanOrEqual(0);
    });

    it('sprites returns an array', async function () {
        var result = await page.evaluate(function () {
            return Array.isArray(punter.sprites);
        });
        expect(result).toBe(true);
    });

    it('orientation is "portrait" or "landscape"', async function () {
        var result = await page.evaluate(function () {
            return punter.orientation;
        });
        expect(['portrait', 'landscape']).toContain(result);
    });

    it('isMobile and isDesktop are booleans and mutually exclusive', async function () {
        var result = await page.evaluate(function () {
            return { isMobile: punter.isMobile, isDesktop: punter.isDesktop };
        });
        expect(typeof result.isMobile).toBe('boolean');
        expect(typeof result.isDesktop).toBe('boolean');
        expect(result.isMobile).not.toBe(result.isDesktop);
    });

    it('sceneName is a string', async function () {
        var result = await page.evaluate(function () {
            return typeof punter.sceneName;
        });
        expect(result).toBe('string');
    });

    // --- debug flag ---

    it('debug can be toggled on and off', async function () {
        var result = await page.evaluate(function () {
            punter.debug = true;
            var on = punter.debug;
            punter.debug = false;
            return { on: on, off: punter.debug };
        });
        expect(result.on).toBe(true);
        expect(result.off).toBe(false);
    });

    it('debug only accepts boolean true; other values are treated as false', async function () {
        var result = await page.evaluate(function () {
            punter.debug = 'yes';
            var afterString = punter.debug;
            punter.debug = 1;
            var afterNumber = punter.debug;
            punter.debug = false;
            return { afterString: afterString, afterNumber: afterNumber };
        });
        expect(result.afterString).toBe(false);
        expect(result.afterNumber).toBe(false);
    });

    // --- event handlers ---

    it('on() registers a handler for known events without throwing', async function () {
        var threw = await page.evaluate(function () {
            var events = ['ready', 'update', 'draw', 'resize', 'go'];
            try {
                events.forEach(function (e) { punter.on(e, function () {}); });
                return false;
            } catch (e) { return true; }
        });
        expect(threw).toBe(false);
    });

    it('on() throws for an unknown event name', async function () {
        var threw = await page.evaluate(function () {
            try { punter.on('unknownEvent', function () {}); return false; }
            catch (e) { return true; }
        });
        expect(threw).toBe(true);
    });

    // --- pause / resume ---

    it('pause() sets paused to true and running to false', async function () {
        var result = await page.evaluate(function () {
            punter.scene('pauseScene', function () {});
            punter.go('pauseScene');
            punter.pause();
            return { paused: punter.paused, running: punter.running };
        });
        expect(result.paused).toBe(true);
        expect(result.running).toBe(false);
    });

    it('resume() sets running to true and paused to false', async function () {
        var result = await page.evaluate(function () {
            punter.scene('resumeScene', function () {});
            punter.go('resumeScene');
            punter.pause();
            punter.resume();
            return { paused: punter.paused, running: punter.running };
        });
        expect(result.running).toBe(true);
        expect(result.paused).toBe(false);
    });

    // --- redraw ---

    it('redraw() does not throw', async function () {
        var threw = await page.evaluate(function () {
            try { punter.redraw(); return false; }
            catch (e) { return true; }
        });
        expect(threw).toBe(false);
    });
});
