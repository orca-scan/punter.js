'use strict';

var setup = require('./setup');

describe('Setup error handling', function () {

    var page;

    beforeAll(async function () {
        page = await setup.newPageAt('/tests/fixtures/bad-setup.html');
        // wait for the catch to run: loading attr removed or error attr set
        await page.waitForFunction(
            'document.documentElement.hasAttribute("data-punter-error") || !document.documentElement.hasAttribute("data-punter-loading")',
            { timeout: 5000 }
        );
    });

    afterAll(async function () {
        await page.close();
    });

    it('removes data-punter-loading when setup fails', async function () {
        var result = await page.evaluate(function () {
            return document.documentElement.hasAttribute('data-punter-loading');
        });
        expect(result).toBe(false);
    });

    it('sets data-punter-error with an error message when setup fails', async function () {
        var result = await page.evaluate(function () {
            return document.documentElement.getAttribute('data-punter-error');
        });
        expect(result).not.toBeNull();
        expect(result.length).toBeGreaterThan(0);
    });
});
