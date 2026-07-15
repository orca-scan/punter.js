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
});
