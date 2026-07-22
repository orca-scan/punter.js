'use strict';

var http = require('http');
var fs = require('fs');
var path = require('path');
var ROOT = path.resolve(__dirname, '..');
var MIME = { '.html': 'text/html', '.js': 'application/javascript', '.wav': 'audio/wav', '.png': 'image/png', '.svg': 'image/svg+xml' };

var _server, _browser, _baseUrl;
var _started = null; // promise to ensure single init

function serve(req, res) {
    var filePath = path.join(ROOT, decodeURIComponent(req.url));
    fs.readFile(filePath, function (err, data) {
        if (err) { res.writeHead(404); res.end(); return; }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
        res.end(data);
    });
}

function ensureStarted() {
    if (_started) return _started;
    _started = (async function () {
        await new Promise(function (resolve) {
            _server = http.createServer(serve);
            _server.listen(0, '127.0.0.1', resolve);
        });
        _baseUrl = 'http://127.0.0.1:' + _server.address().port;
        var puppeteer = (await import('puppeteer')).default;
        _browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
    })();
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

async function stop() {
    if (_browser) await _browser.close();
    if (_server) await new Promise(function (r) { _server.close(r); });
}

module.exports = { newPage: newPage, newPageAt: newPageAt, stop: stop };
