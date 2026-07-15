'use strict';

var setup = require('./setup');

describe('Sounds', function () {

    var page;

    beforeAll(async function () {
        page = await setup.newPage();
    });

    afterAll(async function () {
        await page.close();
    });

    it('playSound does not throw for a loaded sound', async function () {
        var threw = await page.evaluate(function () {
            try { punter.playSound('beep'); return false; }
            catch (e) { return true; }
        });
        expect(threw).toBe(false);
    });

    it('playSound does not throw for an unknown sound key', async function () {
        var threw = await page.evaluate(function () {
            try { punter.playSound('nonExistentSound'); return false; }
            catch (e) { return true; }
        });
        expect(threw).toBe(false);
    });

    it('playSound respects volume option without throwing', async function () {
        var threw = await page.evaluate(function () {
            try { punter.playSound('beep', { volume: 0.5 }); return false; }
            catch (e) { return true; }
        });
        expect(threw).toBe(false);
    });

    it('playSound respects loop option without throwing', async function () {
        var threw = await page.evaluate(function () {
            try { punter.playSound('beep', { loop: true }); return false; }
            catch (e) { return true; }
        });
        expect(threw).toBe(false);
    });

    it('playSound respects speed option without throwing', async function () {
        var threw = await page.evaluate(function () {
            try { punter.playSound('beep', { speed: 1.5 }); return false; }
            catch (e) { return true; }
        });
        expect(threw).toBe(false);
    });

    it('stopSound does not throw when the sound is playing', async function () {
        var threw = await page.evaluate(function () {
            try {
                punter.playSound('beep');
                punter.stopSound('beep');
                return false;
            } catch (e) { return true; }
        });
        expect(threw).toBe(false);
    });

    it('stopSound does not throw when nothing is playing', async function () {
        var threw = await page.evaluate(function () {
            try { punter.stopSound('beep'); return false; }
            catch (e) { return true; }
        });
        expect(threw).toBe(false);
    });

    it('stopSound does not throw for an unknown sound key', async function () {
        var threw = await page.evaluate(function () {
            try { punter.stopSound('nonExistentSound'); return false; }
            catch (e) { return true; }
        });
        expect(threw).toBe(false);
    });
});
