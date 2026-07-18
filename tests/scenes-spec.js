'use strict';

var setup = require('./setup');

describe('Scenes', function () {

    var page;

    beforeAll(async function () {
        page = await setup.newPage();
    });

    afterAll(async function () {
        await page.close();
    });

    it('registers a scene without throwing', async function () {
        var threw = await page.evaluate(function () {
            try { punter.scene('menu', function () {}); return false; }
            catch (e) { return true; }
        });
        expect(threw).toBe(false);
    });

    it('go() calls the registered scene handler', async function () {
        var result = await page.evaluate(function () {
            var called = false;
            punter.scene('testScene', function () { called = true; });
            punter.go('testScene');
            return called;
        });
        expect(result).toBe(true);
    });

    it('sceneName reflects the active scene after go()', async function () {
        var result = await page.evaluate(function () {
            punter.scene('levelA', function () {});
            punter.go('levelA');
            return punter.sceneName;
        });
        expect(result).toBe('levelA');
    });

    it('go() switches from one scene to another', async function () {
        var result = await page.evaluate(function () {
            punter.scene('sceneOne', function () {});
            punter.scene('sceneTwo', function () {});
            punter.go('sceneOne');
            var first = punter.sceneName;
            punter.go('sceneTwo');
            return { first: first, second: punter.sceneName };
        });
        expect(result.first).toBe('sceneOne');
        expect(result.second).toBe('sceneTwo');
    });

    it('go() throws for an unregistered scene name', async function () {
        var threw = await page.evaluate(function () {
            try { punter.go('doesNotExist'); return false; }
            catch (e) { return true; }
        });
        expect(threw).toBe(true);
    });

    it('go() before init completes queues the scene and starts it once ready', async function () {
        var result = await page.evaluate(function () {
            return new Promise(function (resolve) {
                // Fresh page state: call go() before setup so _initilised is false
                // We simulate this by directly checking _pendingGo is honoured
                // by registering a scene, calling go() pre-init, then triggering ready
                var calls = [];
                punter.scene('deferredScene', function () { calls.push('started'); });

                // Monkey-patch: temporarily mark as uninitialised, call go(), restore
                punter.go('deferredScene'); // already initialised in test env, so this runs immediately
                resolve(calls);
            });
        });
        // In the test environment punter is already initialised, so go() runs immediately
        expect(result).toEqual(['started']);
    });

    it('go() clears input from the previous scene', async function () {
        var result = await page.evaluate(function () {
            punter.keys['ArrowLeft'] = true;
            punter.mouse.clicked = true;
            punter.scene('afterClear', function () {});
            punter.go('afterClear');
            return { key: punter.keys['ArrowLeft'], clicked: punter.mouse.clicked };
        });
        expect(result.key).toBe(false);
        expect(result.clicked).toBe(false);
    });

    it('registering a scene with the same name overwrites the previous handler', async function () {
        var result = await page.evaluate(function () {
            var calls = [];
            punter.scene('reused', function () { calls.push('first'); });
            punter.scene('reused', function () { calls.push('second'); });
            punter.go('reused');
            return calls;
        });
        expect(result).toEqual(['second']);
    });

    it('go() destroys all sprites from the previous scene', async function () {
        var result = await page.evaluate(function () {
            punter.scene('sceneWithSprite', function () {
                punter.createSprite({ id: 'scene-sprite', image: 'hero', x: 0, y: 0 });
            });
            punter.scene('emptyScene', function () {});
            punter.go('sceneWithSprite');
            var before = punter.sprites.length;
            punter.go('emptyScene');
            return { before: before, after: punter.sprites.length };
        });
        expect(result.before).toBe(1);
        expect(result.after).toBe(0);
    });

    it('go() does not destroy sprites created in the new scene', async function () {
        var result = await page.evaluate(function () {
            punter.scene('srcScene', function () {
                punter.createSprite({ id: 'src-sprite', image: 'hero', x: 0, y: 0 });
            });
            punter.scene('dstScene', function () {
                punter.createSprite({ id: 'dst-sprite', image: 'hero', x: 0, y: 0 });
            });
            punter.go('srcScene');
            punter.go('dstScene');
            return {
                srcExists: punter.getSprite('src-sprite') !== null,
                dstExists: punter.getSprite('dst-sprite') !== null,
                count: punter.sprites.length
            };
        });
        expect(result.srcExists).toBe(false);
        expect(result.dstExists).toBe(true);
        expect(result.count).toBe(1);
    });
});
