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

    it('playing the same sound multiple times does not throw', async function () {
        var threw = await page.evaluate(function () {
            try {
                punter.stopSound('beep');
                punter.playSound('beep');
                punter.playSound('beep');
                punter.playSound('beep');
                punter.playSound('beep'); // 4th triggers internal cap eviction
                return false;
            } catch (e) { return true; }
        });
        expect(threw).toBe(false);
    });

    it('playSound with loop:true does not throw when called twice', async function () {
        var threw = await page.evaluate(function () {
            try {
                punter.stopSound('beep');
                punter.playSound('beep', { loop: true });
                punter.playSound('beep', { loop: true });
                punter.stopSound('beep');
                return false;
            } catch (e) { return true; }
        });
        expect(threw).toBe(false);
    });

    it('playSound with restart:true does not throw', async function () {
        var threw = await page.evaluate(function () {
            try {
                punter.stopSound('beep');
                punter.playSound('beep');
                punter.playSound('beep', { restart: true });
                return false;
            } catch (e) { return true; }
        });
        expect(threw).toBe(false);
    });

    it('stopSound after multiple plays does not throw', async function () {
        var threw = await page.evaluate(function () {
            try {
                punter.playSound('beep');
                punter.playSound('beep');
                punter.stopSound('beep');
                return false;
            } catch (e) { return true; }
        });
        expect(threw).toBe(false);
    });

    it('each playSound call creates one AudioBufferSource', async function () {
        var count = await page.evaluate(function () {
            punter.stopSound('beep'); // clear state before spy
            var original = AudioContext.prototype.createBufferSource;
            var calls = 0;
            AudioContext.prototype.createBufferSource = function () {
                calls++;
                return original.apply(this, arguments);
            };
            punter.playSound('beep');
            punter.playSound('beep');
            punter.stopSound('beep');
            AudioContext.prototype.createBufferSource = original;
            return calls;
        });
        expect(count).toBe(2);
    });

    it('playSound with loop:true stops the previous instance before replaying', async function () {
        var stopCount = await page.evaluate(function () {
            punter.stopSound('beep'); // clear state before spy
            var stopped = 0;
            var originalStop = AudioBufferSourceNode.prototype.stop;
            AudioBufferSourceNode.prototype.stop = function () {
                stopped++;
                return originalStop.apply(this, arguments);
            };
            punter.playSound('beep', { loop: true }); // source 1 tracked
            punter.playSound('beep', { loop: true }); // stops source 1, tracks source 2
            punter.stopSound('beep');                 // stops source 2
            AudioBufferSourceNode.prototype.stop = originalStop;
            return stopped;
        });
        expect(stopCount).toBe(2);
    });

    it('playSound with once:true does not track the source for stopping', async function () {
        var stopCount = await page.evaluate(function () {
            punter.stopSound('beep'); // clear state before spy
            var stopped = 0;
            var originalStop = AudioBufferSourceNode.prototype.stop;
            AudioBufferSourceNode.prototype.stop = function () {
                stopped++;
                return originalStop.apply(this, arguments);
            };
            punter.playSound('beep', { once: true }); // not added to activeSounds
            punter.stopSound('beep');                 // no tracked source, stop is a no-op
            AudioBufferSourceNode.prototype.stop = originalStop;
            return stopped;
        });
        expect(stopCount).toBe(0);
    });

    it('scene transition stops all playing sounds', async function () {
        var stopCount = await page.evaluate(function () {
            punter.stopSound('beep'); // clear state before spy
            punter.scene('_audio-test', function () {});
            var stopped = 0;
            var originalStop = AudioBufferSourceNode.prototype.stop;
            AudioBufferSourceNode.prototype.stop = function () {
                stopped++;
                return originalStop.apply(this, arguments);
            };
            punter.playSound('beep', { loop: true }); // 1 tracked source
            punter.go('_audio-test');                 // calls audio.stopAll()
            AudioBufferSourceNode.prototype.stop = originalStop;
            return stopped;
        });
        expect(stopCount).toBe(1);
    });

    describe('before setup', function () {

        var rawPage;

        beforeAll(async function () {
            rawPage = await setup.newPageAt('/tests/fixtures/no-setup.html');
        });

        afterAll(async function () {
            await rawPage.close();
        });

        it('playSound throws before punter.setup is called', async function () {
            var message = await rawPage.evaluate(function () {
                try { punter.playSound('beep'); return null; }
                catch (e) { return e.message; }
            });
            expect(message).toBe('punter.setup must be called first');
        });

        it('stopSound throws before punter.setup is called', async function () {
            var message = await rawPage.evaluate(function () {
                try { punter.stopSound('beep'); return null; }
                catch (e) { return e.message; }
            });
            expect(message).toBe('punter.setup must be called first');
        });

    });

});
