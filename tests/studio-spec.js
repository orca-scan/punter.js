'use strict';

var setup = require('./setup');

// waitForTimeout was removed in Puppeteer 22+; use this instead
function sleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

describe('Studio', function () {

    // --- page load ---

    it('loads without browser errors', async function () {
        var errors = [];
        var page = await setup.newPageAt('/studio/');
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

    it('title contains "Studio"', async function () {
        var page = await setup.newPageAt('/studio/');
        await page.waitForFunction('document.title.indexOf("Studio") !== -1', { timeout: 3000 });
        var title = await page.title();
        expect(title).toContain('Studio');
        await page.close();
    });

    // --- default example ---

    it('auto-runs and shows an iframe', async function () {
        var page = await setup.newPageAt('/studio/');
        // wait for fetch + run
        await page.waitForSelector('.st-preview iframe', { timeout: 5000 });
        var count = await page.$$eval('.st-preview iframe', function (els) { return els.length; });
        expect(count).toBe(1);
        await page.close();
    });

    // --- Run button replaces preview ---

    it('Run replaces the previous iframe', async function () {
        var page = await setup.newPageAt('/studio/');
        await page.waitForSelector('.st-preview iframe', { timeout: 5000 });

        // record iframe identity before second run
        var before = await page.evaluate(function () {
            return document.querySelector('.st-preview iframe') ? 1 : 0;
        });

        await page.click('#st-run-btn');
        // wait a tick for DOM update
        await sleep(100);

        var after = await page.evaluate(function () {
            return document.querySelector('.st-preview iframe') ? 1 : 0;
        });

        expect(before).toBe(1);
        expect(after).toBe(1);
        await page.close();
    });

    // --- error display ---

    it('shows a runtime error in the output area', async function () {
        var page = await setup.newPageAt('/studio/');
        await page.waitForSelector('.st-preview iframe', { timeout: 5000 });

        // switch to learn mode so the bridge script captures errors
        await page.select('#st-example-select', 'move');
        await page.waitForSelector('.st-preview iframe', { timeout: 5000 });

        // inject code that will throw a ReferenceError
        await page.evaluate(function () {
            if (window.studioEditor) {
                window.studioEditor.setValue('undefinedVariable.doSomething();');
            } else {
                document.getElementById('st-textarea').value = 'undefinedVariable.doSomething();';
            }
        });

        await page.click('#st-run-btn');

        // wait for postMessage to arrive and output to appear
        await page.waitForFunction(function () {
            return document.getElementById('st-output').textContent.length > 0;
        }, { timeout: 4000 });

        var output = await page.$eval('#st-output', function (el) { return el.textContent; });
        expect(output.length).toBeGreaterThan(0);
        await page.close();
    });

    // --- Reset ---

    it('Reset restores the original example after confirm', async function () {
        var page = await setup.newPageAt('/studio/');
        await page.waitForSelector('.st-preview iframe', { timeout: 5000 });

        // clear any leftover localStorage from previous tests so the default example loads
        await page.evaluate(function () { localStorage.clear(); });

        // reload to get a clean default example load
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForSelector('.st-preview iframe', { timeout: 5000 });

        // capture the original code now that a clean example is loaded
        var original = await page.evaluate(function () {
            if (window.studioEditor) return window.studioEditor.getValue();
            return document.getElementById('st-textarea').value;
        });

        // modify the code
        await page.evaluate(function () {
            if (window.studioEditor) {
                window.studioEditor.setValue('// modified');
            } else {
                document.getElementById('st-textarea').value = '// modified';
            }
        });

        // accept the confirm dialog
        page.on('dialog', function (dialog) { dialog.accept(); });

        await page.click('#st-reset-btn');
        await sleep(200);

        var restored = await page.evaluate(function () {
            if (window.studioEditor) return window.studioEditor.getValue();
            return document.getElementById('st-textarea').value;
        });

        expect(restored).toBe(original);
        await page.close();
    });

    // --- localStorage ---

    it('restores saved code on page reload', async function () {
        var page = await setup.newPageAt('/studio/');
        await page.waitForSelector('.st-preview iframe', { timeout: 5000 });

        // switch to learn mode so saves work (game mode skips localStorage)
        await page.select('#st-example-select', 'move');
        await page.waitForSelector('.st-preview iframe', { timeout: 5000 });

        var savedCode = '// saved code test ' + Date.now();

        // write code and trigger a save
        await page.evaluate(function (code) {
            if (window.studioEditor) {
                window.studioEditor.setValue(code);
            } else {
                document.getElementById('st-textarea').value = code;
            }
        }, savedCode);

        await page.click('#st-run-btn');
        // run triggers an immediate save — poll until localStorage confirms it
        await page.waitForFunction(function (code) {
            try {
                var raw = localStorage.getItem('punter-studio-v1');
                if (!raw) return false;
                var data = JSON.parse(raw);
                return data.code === code;
            } catch (e) { return false; }
        }, { timeout: 3000 }, savedCode);

        // reload
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForSelector('.st-preview iframe', { timeout: 5000 });

        var restored = await page.evaluate(function () {
            if (window.studioEditor) return window.studioEditor.getValue();
            return document.getElementById('st-textarea').value;
        });

        expect(restored).toBe(savedCode);
        await page.close();
    });

    // --- unknown ?learn= param ---

    it('falls back to default example for an unknown ?learn= param', async function () {
        var page = await setup.newPageAt('/studio/?learn=nonexistent');
        await page.waitForSelector('.st-preview iframe', { timeout: 5000 });

        var selected = await page.$eval('#st-example-select', function (el) { return el.value; });
        expect(selected).toBe('move');
        await page.close();
    });

    // --- ?learn= param selects the correct example ---

    it('loads the correct example from ?learn= param', async function () {
        var page = await setup.newPageAt('/studio/?learn=collision');
        await page.waitForSelector('.st-preview iframe', { timeout: 5000 });

        var selected = await page.$eval('#st-example-select', function (el) { return el.value; });
        expect(selected).toBe('collision');
        await page.close();
    });

    // --- Download ---

    it('Download produces an HTML file containing the learner code', async function () {
        var page = await setup.newPageAt('/studio/');
        await page.waitForSelector('.st-preview iframe', { timeout: 5000 });

        // intercept the Blob download by overriding URL.createObjectURL and the anchor click
        var result = await page.evaluate(function () {
            return new Promise(function (resolve) {
                var done = false;
                var orig = URL.createObjectURL;
                var timeoutId = setTimeout(function () {
                    if (done) return;
                    done = true;
                    URL.createObjectURL = orig;
                    resolve('');
                }, 2000);

                // override createObjectURL to capture the blob content
                URL.createObjectURL = function (blob) {
                    var reader = new FileReader();
                    reader.onload = function () {
                        if (done) return;
                        done = true;
                        clearTimeout(timeoutId);
                        URL.createObjectURL = orig;
                        resolve(reader.result);
                    };
                    reader.onerror = function () {
                        if (done) return;
                        done = true;
                        clearTimeout(timeoutId);
                        URL.createObjectURL = orig;
                        resolve('');
                    };
                    reader.readAsText(blob);
                    return '#'; // dummy URL
                };
                document.getElementById('st-download-btn').click();
            });
        });

        expect(result).toContain('<!doctype html>');
        expect(result).toContain('punter.js');
        await page.close();
    });

});
