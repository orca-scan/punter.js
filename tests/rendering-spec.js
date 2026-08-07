'use strict';

var setup = require('./setup');

describe('Rendering quality and performance', function () {

    var page;

    beforeAll(async function () {
        page = await setup.newPage();
    });

    afterAll(async function () {
        await page.close();
    });

    // --- canvas buffer sizing ---

    it('canvas buffer matches the viewport size at standard resolutions', async function () {
        await page.setViewport({ width: 1024, height: 768, deviceScaleFactor: 1 });
        await page.evaluate(function () {
            punter.scene('renderScene', function () {});
            punter.go('renderScene');
        });
        await new Promise(function (r) { setTimeout(r, 100); });
        var result = await page.evaluate(function () {
            var c = document.querySelector('canvas');
            return { bufW: c.width, bufH: c.height, innerW: window.innerWidth, innerH: window.innerHeight };
        });
        expect(result.bufW).toBe(result.innerW);
        expect(result.bufH).toBe(result.innerH);
    });

    it('canvas buffer accounts for devicePixelRatio', async function () {
        await page.setViewport({ width: 800, height: 600, deviceScaleFactor: 2 });
        await new Promise(function (r) { setTimeout(r, 100); });
        var result = await page.evaluate(function () {
            var c = document.querySelector('canvas');
            return { bufW: c.width, bufH: c.height };
        });
        // buffer should be ~2x the viewport (rounding tolerance of 1px)
        expect(Math.abs(result.bufW - 1600)).toBeLessThanOrEqual(1);
        expect(Math.abs(result.bufH - 1200)).toBeLessThanOrEqual(1);
    });

    // --- performance cap ---

    it('caps the canvas buffer at ~4M pixels on very large viewports', async function () {
        await page.setViewport({ width: 3840, height: 2160, deviceScaleFactor: 1 });
        await new Promise(function (r) { setTimeout(r, 100); });
        var result = await page.evaluate(function () {
            var c = document.querySelector('canvas');
            return { pixels: c.width * c.height };
        });
        expect(result.pixels).toBeLessThanOrEqual(4194304 + 1024); // small rounding tolerance
    });

    it('caps buffer when DPR would push it past the limit', async function () {
        await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 2 });
        await new Promise(function (r) { setTimeout(r, 100); });
        var result = await page.evaluate(function () {
            var c = document.querySelector('canvas');
            return { pixels: c.width * c.height };
        });
        // 1920*2 x 1080*2 = ~8.3M would exceed cap
        expect(result.pixels).toBeLessThanOrEqual(4194304 + 1024);
    });

    it('does not apply cap when buffer is within limits', async function () {
        await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
        await new Promise(function (r) { setTimeout(r, 100); });
        var result = await page.evaluate(function () {
            var c = document.querySelector('canvas');
            return { bufW: c.width, bufH: c.height };
        });
        expect(result.bufW).toBe(1280);
        expect(result.bufH).toBe(720);
    });

    // --- no CSS upscaling below cap ---

    it('does not use CSS transform scale when buffer fits', async function () {
        await page.setViewport({ width: 1024, height: 768, deviceScaleFactor: 1 });
        await new Promise(function (r) { setTimeout(r, 100); });
        var result = await page.evaluate(function () {
            var c = document.querySelector('canvas');
            return c.style.transform;
        });
        expect(result).toBe('translate(-50%, -50%)');
    });

    // --- resize pause/resume ---

    it('pauses during resize and resumes after', async function () {
        await page.setViewport({ width: 800, height: 600, deviceScaleFactor: 1 });
        await new Promise(function (r) { setTimeout(r, 200); });

        var before = await page.evaluate(function () { return punter.paused; });

        // capture paused state via the resize event itself
        await page.evaluate(function () {
            window.__pausedDuringResize = null;
            window.addEventListener('resize', function handler() {
                window.__pausedDuringResize = punter.paused;
                window.removeEventListener('resize', handler);
            });
        });

        await page.setViewport({ width: 1000, height: 700, deviceScaleFactor: 1 });
        await new Promise(function (r) { setTimeout(r, 50); });
        var during = await page.evaluate(function () { return window.__pausedDuringResize; });

        // wait for resume (100ms after resize completes)
        await new Promise(function (r) { setTimeout(r, 200); });
        var after = await page.evaluate(function () { return punter.paused; });

        expect(before).toBe(false);
        expect(during).toBe(true);
        expect(after).toBe(false);
    });

    it('does not resume if the game was already paused before resize', async function () {
        await page.evaluate(function () { punter.pause(); });
        await page.setViewport({ width: 900, height: 650, deviceScaleFactor: 1 });
        await new Promise(function (r) { setTimeout(r, 200); });
        var result = await page.evaluate(function () { return punter.paused; });
        expect(result).toBe(true);

        // clean up
        await page.evaluate(function () { punter.resume(); });
    });
});
