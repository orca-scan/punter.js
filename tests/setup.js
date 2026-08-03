'use strict';

var http = require('http');
var fs = require('fs');
var path = require('path');
var ROOT = path.resolve(__dirname, '..');
var MIME = { '.html': 'text/html', '.js': 'application/javascript', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.png': 'image/png', '.svg': 'image/svg+xml' };

var _server = null;
var _browser = null;
var _baseUrl = null;
var _sockets = [];
var _started = null; // promise to ensure single init

function wait(ms) {
    return new Promise(function (resolve) {
        setTimeout(resolve, ms);
    });
}

function ignoreError(err) {
    if (err) {
        return;
    }
}

function startServer() {
    return new Promise(function (resolve, reject) {
        var server = http.createServer(serve);
        var sockets = [];

        server.on('connection', function (socket) {
            sockets.push(socket);
            socket.on('close', function () {
                var index = sockets.indexOf(socket);
                if (index !== -1) {
                    sockets.splice(index, 1);
                }
            });
        });

        function onError(err) {
            reject(err);
        }

        function onListening() {
            server.removeListener('error', onError);
            _server = server;
            _sockets = sockets;
            _baseUrl = 'http://127.0.0.1:' + _server.address().port;
            resolve();
        }

        server.once('error', onError);
        server.listen(0, '127.0.0.1', onListening);
    });
}

async function startBrowser() {
    var puppeteer = (await import('puppeteer')).default;
    _browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
}

function serve(req, res) {
    var urlPath = decodeURIComponent(req.url.split('?')[0]);
    var filePath = path.join(ROOT, urlPath);

    // serve index.html for directory requests
    if (urlPath.slice(-1) === '/') {
        filePath = path.join(ROOT, urlPath, 'index.html');
    }

    fs.readFile(filePath, function (err, data) {
        if (err) { res.writeHead(404); res.end(); return; }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
        res.end(data);
    });
}

function ensureStarted() {
    if (_started) return _started;
    _started = (async function () {
        await startServer();
        try {
            await startBrowser();
        } catch (err) {
            await stop();
            throw err;
        }
    })().catch(function (err) {
        _started = null;
        throw err;
    });
    return _started;
}

async function newPage() {
    await ensureStarted();
    var page = await _browser.newPage();
    await page.goto(_baseUrl + '/tests/fixtures/index.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction('window.__ready === true', { timeout: 5000 });
    return page;
}

async function newPageAt(fixturePath) {
    await ensureStarted();
    var page = await _browser.newPage();
    await page.goto(_baseUrl + fixturePath, { waitUntil: 'domcontentloaded' });
    return page;
}

async function closeBrowser() {
    var browser = _browser;
    var closed = false;
    var proc;

    _browser = null;

    if (!browser) {
        return;
    }

    proc = typeof browser.process === 'function' ? browser.process() : null;

    await Promise.race([
        browser.close().then(function () {
            closed = true;
        }).catch(function (err) {
            closed = true;
            ignoreError(err);
        }),
        wait(3000)
    ]);

    if (!closed && proc && proc.exitCode === null && !proc.killed) {
        try {
            proc.kill('SIGKILL');
        } catch (err) {
            ignoreError(err);
        }
    }
}

async function closeServer() {
    var server = _server;
    var sockets = _sockets;
    var i;

    _server = null;
    _sockets = [];
    _baseUrl = null;

    if (!server) {
        return;
    }

    for (i = 0; i < sockets.length; i++) {
        try {
            sockets[i].destroy();
        } catch (err) {
            ignoreError(err);
        }
    }

    await new Promise(function (resolve) {
        try {
            server.close(function () {
                resolve();
            });
        } catch (err) {
            ignoreError(err);
            resolve();
        }
    });
}

async function stop() {
    _started = null;
    await closeBrowser();
    await closeServer();
}

module.exports = { newPage: newPage, newPageAt: newPageAt, stop: stop };
