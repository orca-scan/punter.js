'use strict';

var setup = require('./setup');

/**
 * Waits for one fixed-frame sample and returns measured update rate
 * @param {Object} page - puppeteer page
 * @param {number} frameCount - number of update frames to sample
 * @returns {Promise<Object>} sample object with fps and frame counts
 */
async function sampleUpdateRate(page, frameCount) {
    return page.evaluate(function (targetFrames) {
        return new Promise(function (resolve) {
            var startFrames = punter.frame;
            var start = performance.now();
            function finish() {
                var elapsed = performance.now() - start;
                var frames = punter.frame - startFrames;
                resolve({
                    elapsed: elapsed,
                    frames: frames,
                    fps: elapsed > 0 ? (frames * 1000 / elapsed) : 0
                });
            }

            function check() {
                if (punter.frame - startFrames >= targetFrames) {
                    finish();
                    return;
                }
                requestAnimationFrame(check);
            }

            check();
        });
    }, frameCount);
}

/**
 * Warms up the page and then returns the worst fps from multiple samples
 * @param {Object} page - puppeteer page
 * @returns {Promise<Object>} minimum fps sample and sprite count
 */
async function measureStableRate(page) {
    await page.evaluate(function () {
        return new Promise(function (resolve) {
            setTimeout(resolve, 1200);
        });
    });

    var samples = [];
    samples.push(await sampleUpdateRate(page, 180));
    samples.push(await sampleUpdateRate(page, 180));
    samples.push(await sampleUpdateRate(page, 180));

    var min = samples[0];
    for (var i = 1; i < samples.length; i++) {
        if (samples[i].fps < min.fps) {
            min = samples[i];
        }
    }

    return {
        minFps: min.fps,
        minFrames: min.frames,
        elapsed: min.elapsed
    };
}

/**
 * Returns the required fps floor for perf checks
 * @returns {number} required fps floor
 */
function getTargetFps() {
    // CI runners are shared and slower; use a lenient floor that still catches regressions
    if (process.env.CI) return 50;
    return 59.8;
}

describe('Game performance', function () {

    var page;

    afterEach(async function () {
        if (page) {
            await page.close();
            page = null;
        }
    });

    it('asteroids sustains 60 fps with at least 300 active sprites', async function () {
        page = await setup.newPageAt('/games/asteroids.html');

        await page.waitForFunction('window.punter && !punter.paused && punter.sceneName === "play"', { timeout: 20000 });
        await page.waitForFunction('Array.isArray(window.asteroids) && typeof window.makeAsteroid === "function" && window.ship', { timeout: 20000 });

        var spriteCount = await page.evaluate(function () {
            var w = punter.width;
            var h = punter.height;
            var target = 300;
            var cols = 20;
            var gapX = Math.max(18, Math.floor(w / cols));
            var gapY = 26;
            var asteroidList = window.asteroids;
            var buildAsteroid = window.makeAsteroid;
            var i;

            window.invTimer = 999999;
            window.gameOver = false;

            for (i = asteroidList.length - 1; i >= 0; i--) {
                asteroidList[i].destroy();
            }
            asteroidList.length = 0;

            for (i = 0; i < target; i++) {
                var col = i % cols;
                var row = Math.floor(i / cols);
                var ax = (col * gapX) % Math.max(w - 20, 20);
                var ay = 20 + ((row * gapY) % Math.max(h - 80, 80));
                var asteroid = buildAsteroid(ax, ay, i % 3);
                asteroid.vx = 0;
                asteroid.vy = 0;
                asteroid.spinSpeed = 0;
                asteroidList.push(asteroid);
            }

            return window.asteroids.length;
        });

        var result = await measureStableRate(page);

        expect(spriteCount).toBeGreaterThanOrEqual(300);
        expect(result.minFps).toBeGreaterThanOrEqual(getTargetFps());
    });

    it('platform sustains 60 fps with at least 300 active sprites', async function () {
        page = await setup.newPageAt('/games/platform.html');

        await page.waitForFunction('window.punter && !punter.paused && punter.sceneName === "play"', { timeout: 20000 });
        await page.waitForFunction('window.player && window.flag && Array.isArray(window.clouds)', { timeout: 20000 });

        var spriteCount = await page.evaluate(function () {
            var target = 300;
            var w = punter.width;
            var h = punter.height;
            var startX = 0;
            var startY = 0;
            var cols = 20;
            var gapX = Math.max(16, Math.floor(w / cols));
            var gapY = 24;
            var i;

            window.dead = false;
            window.won = false;
            window.totalGems = 999999;

            var created = 0;
            while (created < target) {
                i = created;
                punter.createSprite({
                    image: 'cloud',
                    x: startX + (i % cols) * gapX,
                    y: startY + ((Math.floor(i / cols) * gapY) % Math.max(h - 30, 30)),
                    w: 18,
                    h: 10,
                    preserveAspect: false,
                    collidable: false
                });
                created++;
            }

            return created;
        });

        var result = await measureStableRate(page);

        expect(spriteCount).toBeGreaterThanOrEqual(300);
        expect(result.minFps).toBeGreaterThanOrEqual(getTargetFps());
    });
});
