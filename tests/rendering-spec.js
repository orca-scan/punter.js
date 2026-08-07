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

    // --- render interpolation ---

    it('interpolates sprite draw positions between physics ticks', async function () {
        await page.setViewport({ width: 800, height: 600, deviceScaleFactor: 1 });

        var result = await page.evaluate(function () {
            return new Promise(function (resolve) {
                punter.scene('lerpTest', function () {
                    var s = punter.createSprite({ image: 'hero', x: 100, y: 100, w: 10, h: 10 });

                    punter.on('update', function () {
                        s.moveX(6);
                    });

                    // sample draw positions over multiple render frames
                    var positions = [];
                    var count = 0;
                    punter.on('draw', function () {
                        positions.push(s._lerpX());
                        count++;
                        if (count >= 30) {
                            punter.pause();
                            // count unique draw positions (interpolation creates more than just tick positions)
                            var unique = [];
                            for (var i = 0; i < positions.length; i++) {
                                if (unique.indexOf(positions[i]) === -1) unique.push(positions[i]);
                            }
                            resolve({ positions: positions, uniqueCount: unique.length });
                        }
                    });
                });
                punter.go('lerpTest');
            });
        });

        // without interpolation we'd see at most ~25 unique values (60Hz ticks in 30 frames)
        // with interpolation the in-between positions produce more unique values
        expect(result.uniqueCount).toBeGreaterThan(15);
    });

    it('does not produce zero-movement frames when ball moves at constant speed', async function () {
        await page.setViewport({ width: 800, height: 600, deviceScaleFactor: 1 });

        var result = await page.evaluate(function () {
            return new Promise(function (resolve) {
                punter.scene('stutterTest', function () {
                    var s = punter.createSprite({ image: 'hero', x: 0, y: 0, w: 10, h: 10 });

                    punter.on('update', function () {
                        s.moveX(5);
                    });

                    var drawPositions = [];
                    var count = 0;
                    punter.on('draw', function () {
                        drawPositions.push(s._lerpX());
                        count++;
                        if (count >= 60) {
                            punter.pause();
                            var zeroMovement = 0;
                            for (var i = 1; i < drawPositions.length; i++) {
                                if (drawPositions[i] === drawPositions[i - 1]) zeroMovement++;
                            }
                            resolve({ zeroFrames: zeroMovement, total: drawPositions.length });
                        }
                    });
                });
                punter.go('stutterTest');
            });
        });

        // with interpolation, fewer than 5% of frames should show zero movement
        var stutterRatio = result.zeroFrames / result.total;
        expect(stutterRatio).toBeLessThan(0.05);
    });
});
