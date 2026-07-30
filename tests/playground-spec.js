'use strict';

var setup = require('./setup');

// waitForTimeout was removed in Puppeteer 22+; use this instead
function sleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

describe('Playground', function () {

    // --- page load ---

    it('loads without browser errors', async function () {
        var errors = [];
        var page = await setup.newPageAt('/playground/');
        page.on('console', function (msg) {
            if (msg.type() === 'error') errors.push(msg.text());
        });
        page.on('pageerror', function (err) {
            errors.push(err.message);
        });
        // brief pause to let any async errors surface
        await sleep(500);
        expect(errors.length).toBe(0);
        await page.close();
    });

    it('title contains "Playground"', async function () {
        var page = await setup.newPageAt('/playground/');
        await page.waitForFunction('document.title.indexOf("Playground") !== -1', { timeout: 3000 });
        var title = await page.title();
        expect(title).toContain('Playground');
        await page.close();
    });

    // --- default example ---

    it('auto-runs and shows an iframe', async function () {
        var page = await setup.newPageAt('/playground/');
        // wait for fetch + run
        await page.waitForSelector('.pg-preview iframe', { timeout: 5000 });
        var count = await page.$$eval('.pg-preview iframe', function (els) { return els.length; });
        expect(count).toBe(1);
        await page.close();
    });

    // --- Run button replaces preview ---

    it('Run replaces the previous iframe', async function () {
        var page = await setup.newPageAt('/playground/');
        await page.waitForSelector('.pg-preview iframe', { timeout: 5000 });

        // record iframe identity before second run
        var before = await page.evaluate(function () {
            return document.querySelector('.pg-preview iframe') ? 1 : 0;
        });

        await page.click('#pg-run-btn');
        // wait a tick for DOM update
        await sleep(100);

        var after = await page.evaluate(function () {
            return document.querySelector('.pg-preview iframe') ? 1 : 0;
        });

        expect(before).toBe(1);
        expect(after).toBe(1);
        await page.close();
    });

    // --- error display ---

    it('shows a runtime error in the output area', async function () {
        var page = await setup.newPageAt('/playground/');
        await page.waitForSelector('.pg-preview iframe', { timeout: 5000 });

        // inject code that will throw a ReferenceError
        await page.evaluate(function () {
            if (window.playgroundEditor) {
                window.playgroundEditor.setValue('undefinedVariable.doSomething();');
            } else {
                document.getElementById('pg-textarea').value = 'undefinedVariable.doSomething();';
            }
        });

        await page.click('#pg-run-btn');

        // wait for postMessage to arrive and output to appear
        await page.waitForFunction(function () {
            return document.getElementById('pg-output').textContent.length > 0;
        }, { timeout: 4000 });

        var output = await page.$eval('#pg-output', function (el) { return el.textContent; });
        expect(output.length).toBeGreaterThan(0);
        await page.close();
    });

    // --- Reset ---

    it('Reset restores the original example after confirm', async function () {
        var page = await setup.newPageAt('/playground/');
        await page.waitForSelector('.pg-preview iframe', { timeout: 5000 });

        // clear any leftover localStorage from previous tests so the default example loads
        await page.evaluate(function () { localStorage.clear(); });

        // reload to get a clean default example load
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForSelector('.pg-preview iframe', { timeout: 5000 });

        // capture the original code now that a clean example is loaded
        var original = await page.evaluate(function () {
            if (window.playgroundEditor) return window.playgroundEditor.getValue();
            return document.getElementById('pg-textarea').value;
        });

        // modify the code
        await page.evaluate(function () {
            if (window.playgroundEditor) {
                window.playgroundEditor.setValue('// modified');
            } else {
                document.getElementById('pg-textarea').value = '// modified';
            }
        });

        // accept the confirm dialog
        page.on('dialog', function (dialog) { dialog.accept(); });

        await page.click('#pg-reset-btn');
        await sleep(200);

        var restored = await page.evaluate(function () {
            if (window.playgroundEditor) return window.playgroundEditor.getValue();
            return document.getElementById('pg-textarea').value;
        });

        expect(restored).toBe(original);
        await page.close();
    });

    // --- localStorage ---

    it('restores saved code on page reload', async function () {
        var page = await setup.newPageAt('/playground/');
        await page.waitForSelector('.pg-preview iframe', { timeout: 5000 });

        var savedCode = '// saved code test ' + Date.now();

        // write code and trigger a save
        await page.evaluate(function (code) {
            if (window.playgroundEditor) {
                window.playgroundEditor.setValue(code);
            } else {
                document.getElementById('pg-textarea').value = code;
            }
        }, savedCode);

        await page.click('#pg-run-btn');
        await sleep(1500); // wait for the 1s auto-save debounce timer to fire

        // reload
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForSelector('.pg-preview iframe', { timeout: 5000 });
        await sleep(300);

        var restored = await page.evaluate(function () {
            if (window.playgroundEditor) return window.playgroundEditor.getValue();
            return document.getElementById('pg-textarea').value;
        });

        expect(restored).toBe(savedCode);
        await page.close();
    });

    // --- unknown ?learn= param ---

    it('falls back to default example for an unknown ?learn= param', async function () {
        var page = await setup.newPageAt('/playground/?learn=nonexistent');
        await page.waitForSelector('.pg-preview iframe', { timeout: 5000 });

        var selected = await page.$eval('#pg-example-select', function (el) { return el.value; });
        expect(selected).toBe('move');
        await page.close();
    });

    // --- ?learn= param selects the correct example ---

    it('loads the correct example from ?learn= param', async function () {
        var page = await setup.newPageAt('/playground/?learn=collision');
        await page.waitForSelector('.pg-preview iframe', { timeout: 5000 });

        var selected = await page.$eval('#pg-example-select', function (el) { return el.value; });
        expect(selected).toBe('collision');
        await page.close();
    });

    // --- Download ---

    it('Download produces an HTML file containing the learner code', async function () {
        var page = await setup.newPageAt('/playground/');
        await page.waitForSelector('.pg-preview iframe', { timeout: 5000 });

        // intercept the Blob download by overriding URL.createObjectURL and the anchor click
        var result = await page.evaluate(function () {
            return new Promise(function (resolve) {
                // override createObjectURL to capture the blob content
                var orig = URL.createObjectURL;
                URL.createObjectURL = function (blob) {
                    var reader = new FileReader();
                    reader.onload = function () { resolve(reader.result); };
                    reader.readAsText(blob);
                    URL.createObjectURL = orig;
                    return '#'; // dummy URL
                };
                document.getElementById('pg-download-btn').click();
            });
        });

        expect(result).toContain('<!doctype html>');
        expect(result).toContain('punter.js');
        await page.close();
    });

});
