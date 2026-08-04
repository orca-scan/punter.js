(function () {
  'use strict';

  // --- constants ---

  var STORAGE_KEY = 'punter-studio-v1';
  var HTML_FOLD_KEY = 'punter-studio-html-folded';

  // whitelisted example names — prevents path traversal via ?learn=
  var KNOWN_EXAMPLES = ['move', 'keyboard', 'collision', 'pointer'];
  var DEFAULT_EXAMPLE = 'move';
  var KNOWN_GAMES = ['asteroids', 'breakout', 'first-game', 'platform', 'pong', 'snake', 'tetris'];

  // --- state ---

  var currentExample = DEFAULT_EXAMPLE;  // currently selected example name
  var originalCode = '';                 // code of the current example as loaded from file
  var previewFrame = null;               // current iframe element
  var isGameMode = false;                // true when a full game HTML file is loaded

  // --- element refs ---

  var selectEl    = document.getElementById('st-example-select');
  var runBtn      = document.getElementById('st-run-btn');
  var resetBtn    = document.getElementById('st-reset-btn');
  var downloadBtn = document.getElementById('st-download-btn');
  var outputEl    = document.getElementById('st-output');
  var previewEl     = document.querySelector('.st-preview');
  var editorPaneEl  = document.querySelector('.st-editor-pane');
  var placeholder   = document.getElementById('st-placeholder');

  // --- html/css fold ---

  /**
   * Returns whether the HTML/CSS block should be folded (default: true)
   * @returns {boolean}
   */
  function isHtmlFolded() {
    try {
      var val = localStorage.getItem(HTML_FOLD_KEY);
      return val === null || val === 'true';
    } catch (e) {
      return true;
    }
  }

  /**
   * Saves the HTML/CSS fold preference to localStorage
   * @param {boolean} folded
   */
  function setHtmlFolded(folded) {
    try {
      localStorage.setItem(HTML_FOLD_KEY, String(folded));
    } catch (e) {}
  }

  /**
   * Finds the line number of the <head> tag in the editor
   * @returns {number} -1 if not found
   */
  function findHeadLine() {
    var cm = window.studioEditor;
    if (!cm) return -1;
    for (var i = 0; i < cm.lineCount(); i++) {
      if (cm.getLine(i).trim().indexOf('<head') === 0) return i;
    }
    return -1;
  }

  /**
   * Folds or unfolds the <head> block using CodeMirror xml-fold
   * @param {string} force - 'fold' or 'unfold'
   */
  function foldHeadBlock(force) {
    var cm = window.studioEditor;
    if (!cm || !CodeMirror.fold || !CodeMirror.fold.xml) return;
    var line = findHeadLine();
    if (line < 0) return;
    var col = cm.getLine(line).indexOf('<');
    cm.foldCode(CodeMirror.Pos(line, col), CodeMirror.fold.xml, force);
  }

  // --- editor abstraction ---
  // both functions work whether CodeMirror is loaded or not

  /**
   * Returns the current code from CodeMirror or the textarea fallback
   * @returns {string}
   */
  function getCode() {
    if (window.studioEditor) {
      return window.studioEditor.getValue();
    }
    return document.getElementById('st-textarea').value;
  }

  /**
   * Sets code in CodeMirror or the textarea fallback
   * @param {string} code
   */
  function setCode(code) {
    if (window.studioEditor) {
      window.studioEditor.setValue(code);
      return;
    }
    document.getElementById('st-textarea').value = code;
  }

  // --- output helpers ---

  /**
   * Clears all lines from the output panel
   */
  function clearOutput() {
    outputEl.innerHTML = '';
  }

  /**
   * Appends a line to the output panel
   * @param {string} text - message to display
   * @param {string} cssClass - CSS modifier class controlling the line colour
   */
  function appendOutput(text, cssClass) {
    var line = document.createElement('div');
    line.className = 'st-output-line ' + cssClass;
    line.textContent = text;
    outputEl.appendChild(line);
    outputEl.scrollTop = outputEl.scrollHeight;
  }

  // --- load example from /learn/{name}.html ---

  /**
   * Fetches an example file and extracts its inline script
   * @param {string} name - example name, must be in KNOWN_EXAMPLES
   * @param {function} callback - called with (err, code)
   */
  function loadExample(name, callback) {
    // resolve to the repository root regardless of where the page is hosted
    var base = location.pathname.replace(/studio\/?.*$/, '');
    var url = base + 'learn/' + name + '.html';

    fetch(url).then(function (res) {
      if (!res.ok) throw new Error('Could not load example: ' + name);
      return res.text();
    }).then(function (html) {
      var code = extractScript(html);
      if (typeof callback === 'function') callback(null, code);
    }).catch(function (err) {
      if (typeof callback === 'function') callback(err, null);
    });
  }

  /**
   * Strips the common leading whitespace from all non-empty lines
   * @param {string} str
   * @returns {string}
   */
  function dedent(str) {
    var lines = str.split('\n');
    while (lines.length && lines[0].trim() === '') lines.shift();
    while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
    if (!lines.length) return '';
    var min = Infinity;
    for (var i = 0; i < lines.length; i++) {
      if (lines[i].trim() === '') continue;
      var spaces = lines[i].match(/^(\s*)/)[1].length;
      if (spaces < min) min = spaces;
    }
    if (min === 0 || min === Infinity) return lines.join('\n');
    return lines.map(function (l) { return l.slice(min); }).join('\n');
  }

  /**
   * Extracts the content of the last inline script tag from an HTML string
   * @param {string} html
   * @returns {string}
   */
  function extractScript(html) {
    // use a temporary element to parse the HTML safely
    var tmp = document.createElement('div');
    tmp.innerHTML = html;
    var scripts = tmp.querySelectorAll('script:not([src])');
    if (!scripts.length) return '';
    return dedent(scripts[scripts.length - 1].textContent);
  }

  // --- load a full game HTML file ---

  /**
   * Fetches a full game HTML file
   * @param {string} name - game name, must be in KNOWN_GAMES
   * @param {function} callback - called with (err, html)
   */
  function loadGame(name, callback) {
    var base = location.pathname.replace(/studio\/?.*$/, '');
    var url = base + 'games/' + name + '.html';

    fetch(url).then(function (res) {
      if (!res.ok) throw new Error('Could not load game: ' + name);
      return res.text();
    }).then(function (html) {
      if (typeof callback === 'function') callback(null, html);
    }).catch(function (err) {
      if (typeof callback === 'function') callback(err, null);
    });
  }

  /**
   * Removes the "Edit in Studio" anchor that is added as a meta-link in game files
   * @param {string} html
   * @returns {string}
   */
  function stripEditLink(html) {
    return html.replace(/<a\b[^>]*\?game=[^>]*>[\s\S]*?<\/a>\s*/g, '');
  }

  /**
   * Loads a full game HTML file into the editor and immediately runs it
   * @param {string} name - game name, must be in KNOWN_GAMES
   */
  function loadGameIntoEditor(name) {
    isGameMode = true;
    setEditorMode('htmlmixed');
    loadGame(name, function (err, html) {
      if (err) {
        appendOutput('Could not load game: ' + name, 'st-output-line--error');
        return;
      }
      var cleaned = stripEditLink(html);
      originalCode = cleaned;
      setCode(cleaned);
      // wait for CM to parse htmlmixed content before applying default fold
      setTimeout(function () { foldHeadBlock(isHtmlFolded() ? 'fold' : 'unfold'); }, 50);
      clearOutput();
      runGame();
    });
  }

  /**
   * Changes the CodeMirror syntax-highlight mode
   * @param {string} mode - e.g. 'javascript' or 'htmlmixed'
   */
  function setEditorMode(mode) {
    if (window.studioEditor) {
      window.studioEditor.setOption('mode', mode);
    }
  }

  // --- select and load an example ---

  /**
   * Loads an example by name; prompts before replacing unsaved changes
   * @param {string} name - example name
   * @param {boolean} forceLoad - skip the unsaved-changes confirmation
   */
  function selectExample(name, forceLoad) {
    isGameMode = false;
    setEditorMode('javascript');
    // fall back to default for unknown names
    if (KNOWN_EXAMPLES.indexOf(name) === -1) name = DEFAULT_EXAMPLE;

    // confirm if the learner has unsaved changes (unless forced)
    if (!forceLoad && originalCode && getCode() !== originalCode) {
      if (!confirm('Replace your code with the "' + name + '" example?')) return;
    }

    currentExample = name;
    selectEl.value = name;

    loadExample(name, function (err, code) {
      if (err) {
        appendOutput('Could not load example: ' + name, 'st-output-line--error');
        return;
      }
      originalCode = code;
      setCode(code);
      clearOutput();
      saveToStorage();
      runGame();
    });
  }

  // --- run the game in a sandboxed iframe ---

  /**
   * Creates a sandboxed iframe and runs the current editor code inside it
   */
  function runGame() {
    clearOutput();

    var code = getCode();
    var html = isGameMode ? buildGameIframeDocument(code) : buildIframeDocument(code);

    // destroy old iframe so previous game loops and handlers are removed
    if (previewFrame) {
      previewFrame.remove();
      previewFrame = null;
    }

    placeholder.style.display = 'none';

    var frame = document.createElement('iframe');
    frame.title = 'Game preview';
    // game mode: allow-same-origin lets localStorage and same-origin fetch (sounds) work
    // learn mode: no allow-same-origin — isolates learner code from parent page
    frame.setAttribute('sandbox', isGameMode ? 'allow-scripts allow-same-origin' : 'allow-scripts');
    frame.srcdoc = html;

    previewEl.appendChild(frame);
    previewFrame = frame;

    // defer one tick so the button click doesn't steal focus back
    var capturedFrame = frame;
    setTimeout(function () {
      capturedFrame.focus();
      previewEl.classList.add('is-focused');
      editorPaneEl.classList.remove('is-focused');
    }, 0);

    saveToStorage();
  }

  /**
   * Builds a complete HTML document for use as the iframe srcdoc
   * includes a bridge script that forwards errors and console output to the parent via postMessage
   * @param {string} userCode - raw JS from the editor
   * @returns {string}
   */
  function buildIframeDocument(userCode) {
    // resolve the origin so relative game asset paths work (e.g. ../images/)
    var base = location.origin + location.pathname.replace(/studio\/?.*$/, '');

    // the bridge script captures errors and console output
    // LINE_OFFSET is the line where the learner's code begins in the document
    // (used to show accurate line numbers in error messages)
    var BRIDGE_LINE_OFFSET = 18; // lines before user code in the iframe doc

    var bridge = [
      '(function () {',
      '  var OFFSET = ' + BRIDGE_LINE_OFFSET + ';',
      '  window.onerror = function (msg, url, line, col, err) {',
      '    parent.postMessage({ type: \'studio-error\', message: msg, line: line - OFFSET }, \'*\');',
      '    return true;',
      '  };',
      '  window.addEventListener(\'unhandledrejection\', function (e) {',
      '    parent.postMessage({ type: \'studio-error\', message: String(e.reason) }, \'*\');',
      '  });',
      '  [\'log\', \'warn\', \'error\'].forEach(function (m) {',
      '    var orig = console[m];',
      '    console[m] = function () {',
      '      var args = Array.prototype.slice.call(arguments);',
      '      parent.postMessage({ type: \'studio-console\', level: m, text: args.join(\' \') }, \'*\');',
      '      orig.apply(console, args);',
      '    };',
      '  });',
      '}());'
    ].join('\n');

    return [
      '<!doctype html>',
      '<html>',
      '<head>',
      '  <meta charset="utf-8">',
      '  <meta name="viewport" content="width=device-width, initial-scale=1">',
      // base href so ../images/ and ../sounds/ resolve correctly from punterjs.org/
      '  <base href="' + base + '">',
      '  <style>',
      '    * { margin: 0; padding: 0; box-sizing: border-box; }',
      '    html, body { width: 100%; height: 100%; overflow: hidden; background: #1b2125; }',
      '    canvas { display: block; }',
      '  </style>',
      '  <script src="src/punter.js"><\/script>',
      '</head>',
      '<body>',
      '<canvas id="game"></canvas>',
      '<script>',
      bridge,
      '<\/script>',
      '<script>',
      userCode,
      '<\/script>',
      '</body>',
      '</html>'
    ].join('\n');
  }

  /**
   * Injects a base href into a full game HTML string so relative asset paths resolve correctly
   * @param {string} html - full game HTML
   * @returns {string}
   */
  function buildGameIframeDocument(html) {
    var base = location.origin + location.pathname.replace(/studio\/?.*$/, '') + 'games/';
    return html.replace('<head>', '<head>\n  <base href="' + base + '">');
  }

  // --- listen for messages from the iframe ---

  window.addEventListener('message', function (e) {
    // only accept messages from our own preview iframe
    if (!previewFrame || e.source !== previewFrame.contentWindow) return;

    var data = e.data;
    if (!data || typeof data.type !== 'string') return;

    if (data.type === 'studio-error') {
      var prefix = (typeof data.line === 'number' && data.line > 0)
        ? 'Line ' + data.line + ': '
        : 'Error: ';
      appendOutput(prefix + (data.message || 'Unknown error'), 'st-output-line--error');
    }

    if (data.type === 'studio-console') {
      var cssClass = data.level === 'error' ? 'st-output-line--error'
                   : data.level === 'warn'  ? 'st-output-line--warn'
                   : 'st-output-line--log';
      appendOutput(data.text || '', cssClass);
    }
  });

  // --- reset ---

  /**
   * Resets the editor to the original example; prompts before discarding unsaved changes
   */
  function resetExample() {
    if (!originalCode || getCode() === originalCode) {
      // no changes — just reload silently
      setCode(originalCode);
      runGame();
      return;
    }
    if (confirm('Reset to the original example? Your changes will be lost.')) {
      setCode(originalCode);
      runGame();
    }
  }

  // --- download ---

  /**
   * Downloads the current editor content as a standalone HTML file
   */
  function downloadGame() {
    var userCode = getCode();
    var html;

    if (isGameMode) {
      // fix the local engine path for standalone use; images/sounds still need a local server
      html = userCode.replace('../src/punter.js', 'https://punterjs.org/src/punter.js');
    } else {
      html = [
        '<!doctype html>',
        '<html>',
        '<head>',
        '  <title>My Punter.js Game</title>',
        '  <meta charset="utf-8">',
        '  <meta name="viewport" content="width=device-width, initial-scale=1">',
        '  <style>',
        '    * { margin: 0; padding: 0; box-sizing: border-box; }',
        '    html, body { width: 100%; height: 100%; overflow: hidden; background: #1b2125; }',
        '    canvas { display: block; }',
        '  </style>',
        '  <!-- Punter.js game engine -->',
        '  <script src="https://punterjs.org/src/punter.js"><\/script>',
        '</head>',
        '<body>',
        '<canvas id="game"></canvas>',
        '',
        '<!--',
        '  Edit your game code between the <script> tags below.',
        '  To use images or sounds, open this file through a local web server',
        '  rather than double-clicking it — browsers block local asset loading',
        '  from file:// URLs. Run: npx http-server . and open http://localhost:8080',
        '-->',
        '<script>',
        userCode,
        '<\/script>',
        '</body>',
        '</html>'
      ].join('\n');
    }

    var blob = new Blob([html], { type: 'text/html' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'my-game.html';
    a.click();
    URL.revokeObjectURL(url);
  }

  // --- localStorage ---

  /**
   * Saves the current code and example name to localStorage
   */
  function saveToStorage() {
    if (isGameMode) return;
    try {
      var data = JSON.stringify({ code: getCode(), example: currentExample });
      localStorage.setItem(STORAGE_KEY, data);
    } catch (e) {
      // storage unavailable — non-fatal
    }
  }

  /**
   * Reads saved code and example name from localStorage
   * @returns {{code: string, example: string}|null}
   */
  function loadFromStorage() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (typeof data.code !== 'string') return null;
      return data;
    } catch (e) {
      return null;
    }
  }

  // --- URL parameters ---

  /**
   * Returns the whitelisted value of the ?learn= query param, or null
   * @returns {string|null}
   */
  function getLearnParam() {
    var params = new URLSearchParams(location.search);
    var name = params.get('learn');
    if (!name) return null;
    // whitelist to prevent path traversal
    if (KNOWN_EXAMPLES.indexOf(name) === -1) return null;
    return name;
  }

  /**
   * Returns the whitelisted value of the ?game= query param, or null
   * @returns {string|null}
   */
  function getGameParam() {
    var params = new URLSearchParams(location.search);
    var name = params.get('game');
    if (!name) return null;
    // whitelist to prevent path traversal
    if (KNOWN_GAMES.indexOf(name) === -1) return null;
    return name;
  }

  // --- button events ---

  // when focus moves into the iframe the parent window blurs
  window.addEventListener('blur', function () {
    if (!previewFrame) return;
    previewEl.classList.add('is-focused');
    editorPaneEl.classList.remove('is-focused');
  });

  // when focus returns to the parent window the editor pane is active
  window.addEventListener('focus', function () {
    previewEl.classList.remove('is-focused');
  });

  runBtn.addEventListener('click', function () {
    runGame();
  });

  resetBtn.addEventListener('click', function () {
    resetExample();
  });

  downloadBtn.addEventListener('click', function () {
    downloadGame();
  });

  selectEl.addEventListener('change', function () {
    var val = selectEl.value;
    if (val.indexOf('game:') === 0) {
      var gameName = val.slice(5);
      if (KNOWN_GAMES.indexOf(gameName) !== -1) {
        loadGameIntoEditor(gameName);
      }
    } else {
      selectExample(val, false);
    }
    // return focus to the preview pane
    setTimeout(function () {
      if (previewFrame) {
        previewFrame.focus();
        previewEl.classList.add('is-focused');
        editorPaneEl.classList.remove('is-focused');
      }
    }, 100);
  });

  // auto-save on editor changes (debounced 1s)
  var saveTimer;

  /**
   * Schedules an auto-save 1 second after the last editor change
   */
  function scheduleAutoSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveToStorage, 1000);
  }

  // auto-save fallback for plain textarea (when CodeMirror is unavailable)
  document.getElementById('st-textarea').addEventListener('input', scheduleAutoSave);

  // --- autocomplete ---

  // methods carry a params string; properties omit it so they display without ()
  var PUNTER_DEFS = {
    setup:         { params: 'config',                   info: 'initialise the engine with images, sounds and canvas' },
    scene:         { params: 'name, fn',                 info: 'register a named scene handler' },
    go:            { params: 'name',                     info: 'transition to a named scene' },
    on:            { params: 'event, fn',                info: "register a handler — events: 'ready', 'update', 'draw', 'resize', 'go'" },
    createSprite:  { params: 'opts',                     info: 'create and register a new sprite' },
    getSprite:     { params: 'id',                       info: 'retrieve a sprite by id, returns null if not found' },
    isKeyDown:     { params: '...keys',                  info: "true if any key is held — e.g. 'left', 'space', 'shift+a'" },
    isPointerDown: { params: "'left'|'right'|'middle'",  info: 'true if the pointer button is held' },
    clearInput:    { params: '',                         info: 'reset all keyboard and pointer state' },
    playSound:     { params: 'name [, opts]',            info: 'play a loaded sound' },
    stopSound:     { params: 'name',                     info: 'stop all instances of a named sound' },
    pause:         { params: '',                         info: 'pause the game loop' },
    resume:        { params: '',                         info: 'resume a paused game loop' },
    redraw:        { params: '',                         info: 'repaint the canvas while paused' },
    canvas:        {                                     info: 'the HTMLCanvasElement', browser: 'HTMLCanvasElement' },
    width:         {                                     info: 'canvas logical width in pixels' },
    height:        {                                     info: 'canvas logical height in pixels' },
    frame:         {                                     info: 'current frame number 0-59, loops each second' },
    totalFrames:   {                                     info: 'total frames elapsed since the game started' },
    running:       {                                     info: 'true if the game loop is active' },
    paused:        {                                     info: 'true if the game loop is paused' },
    resized:       {                                     info: 'true on the first frame after a resize event' },
    sprites:       {                                     info: 'array of all active (non-destroyed) sprites' },
    pointer:       {                                     info: 'pointer state object — x, y, down, clicked' },
    orientation:   {                                     info: "'portrait' or 'landscape'" },
    sceneName:     {                                     info: 'name of the currently active scene' },
    debug:         {                                     info: 'set true to enable the debug overlay' },
    isMobile:      {                                     info: 'true if running on a mobile device' },
    isDesktop:     {                                     info: 'true if running on a desktop device' }
  };

  var POINTER_DEFS = {
    x:       { info: 'pointer x position in logical pixels' },
    y:       { info: 'pointer y position in logical pixels' },
    down:    { info: 'true while the pointer is pressed' },
    clicked: { info: 'true for one frame after a tap or click' }
  };

  var SPRITE_DEFS = {
    animate:         { params: 'delayMs',                          info: 'advance animation frame; call each update tick' },
    blink:           { params: 'ms [, durationMs]',                info: 'flash on/off every ms; call blink(0) to stop' },
    bounce:          { params: '[range [, speed]]',                info: 'sinusoidal vertical bounce; call each update tick' },
    center:          { params: '[offsetX [, offsetY]]',            info: 'center on both axes' },
    centerX:         { params: '[offsetX]',                        info: 'center horizontally' },
    centerY:         { params: '[offsetY]',                        info: 'center vertically' },
    destroy:         { params: '',                                 info: 'remove sprite from the engine registry' },
    getFrameImage:   { params: '',                                 info: 'image key for the current animation frame' },
    isCollidingWith: { params: 'target',                           info: 'true if bounding boxes overlap' },
    loopScrollX:     { params: 'speed',                            info: 'scroll and wrap seamlessly at screen edge' },
    moveX:           { params: 'dx',                               info: 'move horizontally by dx pixels' },
    moveY:           { params: 'dy',                               info: 'move vertically by dy pixels' },
    parallaxScrollX: { params: 'speed, respawnAfterMs [, offset]', info: 'scroll and respawn after leaving the screen' },
    parallaxScrollY: { params: 'speed, respawnAfterMs [, offset]', info: 'scroll vertically and respawn' },
    rotate:          { params: 'amount',                           info: 'add amount (radians) to this.angle' },
    actualH:         { info: 'draw height accounting for clipHeight' },
    actualW:         { info: 'draw width as an integer' },
    angle:           { info: 'current rotation in radians (used by rotate())' },
    boundsMode:      { info: "'pixel' (default) or 'rect'" },
    clipHeight:      { info: 'visible height in pixels from the bottom edge' },
    collidable:      { info: 'false to exclude from collision checks' },
    destroyed:       { info: 'true after destroy() has been called' },
    frame:           { info: 'override animation frame index' },
    h:               { info: 'sprite height in pixels' },
    id:              { info: 'unique string identifier' },
    image:           { info: 'image key or array of keys for animation' },
    initialX:        { info: 'x anchor used by bounce() and centerX()' },
    initialY:        { info: 'y anchor used by bounce() and centerY()' },
    outline:         { info: 'CSS colour string for a debug outline' },
    repeatX:         { info: 'tile the sprite across the full canvas width' },
    repeatY:         { info: 'tile the sprite across the full canvas height' },
    seen:            { info: 'true once the sprite has been visible on screen' },
    vector:          { info: 'draw function called each frame with (ctx, w, h)' },
    visible:         { info: 'true if the sprite is within the canvas bounds' },
    w:               { info: 'sprite width in pixels' },
    x:               { info: 'x position in logical pixels' },
    y:               { info: 'y position in logical pixels' }
  };

  // CanvasRenderingContext2D — shown only when cursor is inside a function(ctx) body
  var CTX_DEFS = {
    save:                     { params: '' },
    restore:                  { params: '' },
    translate:                { params: 'x, y' },
    rotate:                   { params: 'angle' },
    scale:                    { params: 'x, y' },
    transform:                { params: 'a, b, c, d, e, f' },
    setTransform:             { params: 'a, b, c, d, e, f' },
    resetTransform:           { params: '' },
    fillRect:                 { params: 'x, y, w, h' },
    strokeRect:               { params: 'x, y, w, h' },
    clearRect:                { params: 'x, y, w, h' },
    fillText:                 { params: 'text, x, y' },
    strokeText:               { params: 'text, x, y' },
    measureText:              { params: 'text' },
    beginPath:                { params: '' },
    closePath:                { params: '' },
    moveTo:                   { params: 'x, y' },
    lineTo:                   { params: 'x, y' },
    arc:                      { params: 'x, y, radius, startAngle, endAngle' },
    arcTo:                    { params: 'x1, y1, x2, y2, radius' },
    bezierCurveTo:            { params: 'cp1x, cp1y, cp2x, cp2y, x, y' },
    quadraticCurveTo:         { params: 'cpx, cpy, x, y' },
    rect:                     { params: 'x, y, w, h' },
    fill:                     { params: '' },
    stroke:                   { params: '' },
    clip:                     { params: '' },
    drawImage:                { params: 'image, dx, dy [, dw, dh]' },
    createLinearGradient:     { params: 'x1, y1, x2, y2' },
    createRadialGradient:     { params: 'x1, y1, r1, x2, y2, r2' },
    createPattern:            { params: 'image, repetition' },
    getImageData:             { params: 'x, y, w, h' },
    putImageData:             { params: 'imageData, dx, dy' },
    fillStyle:                {},
    strokeStyle:              {},
    lineWidth:                {},
    lineCap:                  {},
    lineJoin:                 {},
    font:                     {},
    textAlign:                {},
    textBaseline:             {},
    globalAlpha:              {},
    globalCompositeOperation: {},
    shadowBlur:               {},
    shadowColor:              {},
    shadowOffsetX:            {},
    shadowOffsetY:            {}
  };

  var HINT_JS_GLOBALS = [
    'Array', 'Boolean', 'console', 'Date', 'document', 'Error',
    'JSON', 'Math', 'Number', 'Object', 'Promise', 'RegExp',
    'String', 'window'
  ];

  // curated property-to-values map; only properties a game dev would commonly use
  var CSS_PROP_VALUES = {
    'display':                   ['block', 'inline', 'inline-block', 'flex', 'inline-flex', 'grid', 'none', 'table', 'table-cell'],
    'position':                  ['static', 'relative', 'absolute', 'fixed', 'sticky'],
    'visibility':                ['visible', 'hidden', 'collapse'],
    'overflow':                  ['visible', 'hidden', 'scroll', 'auto', 'clip'],
    'overflow-x':                ['visible', 'hidden', 'scroll', 'auto'],
    'overflow-y':                ['visible', 'hidden', 'scroll', 'auto'],
    'box-sizing':                ['border-box', 'content-box'],
    'float':                     ['left', 'right', 'none'],
    'clear':                     ['left', 'right', 'both', 'none'],
    'flex-direction':            ['row', 'row-reverse', 'column', 'column-reverse'],
    'flex-wrap':                 ['nowrap', 'wrap', 'wrap-reverse'],
    'justify-content':           ['flex-start', 'flex-end', 'center', 'space-between', 'space-around', 'space-evenly'],
    'align-items':               ['flex-start', 'flex-end', 'center', 'stretch', 'baseline'],
    'align-self':                ['auto', 'flex-start', 'flex-end', 'center', 'stretch', 'baseline'],
    'text-align':                ['left', 'right', 'center', 'justify'],
    'text-decoration':           ['none', 'underline', 'overline', 'line-through'],
    'text-transform':            ['none', 'uppercase', 'lowercase', 'capitalize'],
    'vertical-align':            ['baseline', 'top', 'middle', 'bottom', 'text-top', 'text-bottom', 'sub', 'super'],
    'white-space':               ['normal', 'nowrap', 'pre', 'pre-wrap', 'pre-line'],
    'word-break':                ['normal', 'break-all', 'keep-all', 'break-word'],
    'font-style':                ['normal', 'italic', 'oblique'],
    'font-weight':               ['normal', 'bold', 'bolder', 'lighter', '100', '200', '300', '400', '500', '600', '700', '800', '900'],
    'font-variant':              ['normal', 'small-caps'],
    'background-repeat':         ['repeat', 'no-repeat', 'repeat-x', 'repeat-y', 'round', 'space'],
    'background-size':           ['auto', 'cover', 'contain'],
    'background-attachment':     ['scroll', 'fixed', 'local'],
    'background-position':       ['center', 'top', 'bottom', 'left', 'right', 'top left', 'top right', 'bottom left', 'bottom right'],
    'border-style':              ['none', 'solid', 'dashed', 'dotted', 'double', 'groove', 'ridge', 'inset', 'outset', 'hidden'],
    'border-collapse':           ['separate', 'collapse'],
    'cursor':                    ['auto', 'default', 'pointer', 'crosshair', 'text', 'move', 'grab', 'grabbing', 'zoom-in', 'zoom-out', 'not-allowed', 'none', 'wait', 'progress', 'help', 'ns-resize', 'ew-resize'],
    'pointer-events':            ['auto', 'none', 'all'],
    'user-select':               ['none', 'auto', 'text', 'all'],
    '-webkit-user-select':       ['none', 'auto', 'text', 'all'],
    'touch-action':              ['auto', 'none', 'pan-x', 'pan-y', 'pan-left', 'pan-right', 'pan-up', 'pan-down', 'pinch-zoom', 'manipulation'],
    'resize':                    ['none', 'both', 'horizontal', 'vertical'],
    'object-fit':                ['fill', 'contain', 'cover', 'none', 'scale-down'],
    'mix-blend-mode':            ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference', 'exclusion'],
    'list-style-type':           ['none', 'disc', 'circle', 'square', 'decimal', 'lower-alpha', 'upper-alpha', 'lower-roman', 'upper-roman'],
    'table-layout':              ['auto', 'fixed'],
    'direction':                 ['ltr', 'rtl'],
    'animation-direction':       ['normal', 'reverse', 'alternate', 'alternate-reverse'],
    'animation-fill-mode':       ['none', 'forwards', 'backwards', 'both'],
    'animation-play-state':      ['running', 'paused'],
    'transition-timing-function': ['ease', 'linear', 'ease-in', 'ease-out', 'ease-in-out', 'step-start', 'step-end'],
    'animation-timing-function': ['ease', 'linear', 'ease-in', 'ease-out', 'ease-in-out', 'step-start', 'step-end'],
    'appearance':                ['none', 'auto'],
    'outline-style':             ['none', 'solid', 'dashed', 'dotted', 'double', 'groove', 'ridge', 'inset', 'outset']
  };

  /**
   * Builds a CodeMirror hint list from a definitions object
   * @param {Object} defs - map of name to {params, info}
   * @param {string} partial - typed prefix to filter completions by
   * @returns {Array}
   */
  function buildHints(defs, partial) {
    var keys = Object.keys(defs);
    var i, k, def, displayText, results;
    if (partial) {
      var filtered = [];
      for (i = 0; i < keys.length; i++) {
        if (keys[i].indexOf(partial) === 0) filtered.push(keys[i]);
      }
      keys = filtered;
    }
    results = [];
    for (i = 0; i < keys.length; i++) {
      k = keys[i];
      def = defs[k];
      if (def && typeof def.params !== 'undefined') {
        displayText = def.params !== '' ? k + '(' + def.params + ')' : k + '()';
      } else {
        displayText = k;
      }
      results.push({ text: k, displayText: displayText });
    }
    return results;
  }

  /**
   * Returns true if the cursor is inside a function body whose param list contains 'ctx'
   * @param {Object} cm - CodeMirror instance
   * @param {Object} cur - cursor position
   * @returns {boolean}
   */
  function isCtxInScope(cm, cur) {
    var content = cm.getRange({ line: 0, ch: 0 }, cur);
    var pattern = /function\s*\w*\s*\([^)]*\bctx\b[^)]*\)/g;
    var match, lastIdx = -1;
    while ((match = pattern.exec(content)) !== null) {
      lastIdx = match.index + match[0].length;
    }
    if (lastIdx === -1) return false;
    var body = content.slice(lastIdx);
    var opens = (body.match(/{/g) || []).length;
    var closes = (body.match(/}/g) || []).length;
    return opens > closes;
  }

  /**
   * Custom CodeMirror autocomplete for punter, sprite and ctx members
   * @param {Object} cm - CodeMirror instance
   * @param {Object} options - hint options passed by CodeMirror
   * @returns {Object|null}
   */
  function punterHint(cm, options) {
    var cur = cm.getCursor();
    var before = cm.getLine(cur.line).slice(0, cur.ch);
    var partial, list, dotMatch, preObj, pointerMatch, punterMatch;

    pointerMatch = before.match(/punter\.pointer\.(\w*)$/);
    if (pointerMatch) {
      partial = pointerMatch[1];
      list = buildHints(POINTER_DEFS, partial);
      return { list: list, from: CodeMirror.Pos(cur.line, cur.ch - partial.length), to: CodeMirror.Pos(cur.line, cur.ch) };
    }

    punterMatch = before.match(/(?:^|[^\w.])punter\.(\w*)$/);
    if (punterMatch) {
      partial = punterMatch[1];
      list = buildHints(PUNTER_DEFS, partial);
      return { list: list, from: CodeMirror.Pos(cur.line, cur.ch - partial.length), to: CodeMirror.Pos(cur.line, cur.ch) };
    }

    dotMatch = before.match(/\.(\w*)$/);
    if (dotMatch) {
      preObj = before.slice(0, before.length - dotMatch[0].length).match(/(\w+)$/);
      if (preObj && preObj[1] === 'ctx' && isCtxInScope(cm, cur)) {
        partial = dotMatch[1];
        list = buildHints(CTX_DEFS, partial);
        return { list: list, from: CodeMirror.Pos(cur.line, cur.ch - partial.length), to: CodeMirror.Pos(cur.line, cur.ch) };
      }
      if (!preObj || HINT_JS_GLOBALS.indexOf(preObj[1]) === -1) {
        partial = dotMatch[1];
        list = buildHints(SPRITE_DEFS, partial);
        if (list.length) {
          return { list: list, from: CodeMirror.Pos(cur.line, cur.ch - partial.length), to: CodeMirror.Pos(cur.line, cur.ch) };
        }
      }
    }

    if (CodeMirror.hint && CodeMirror.hint.javascript) {
      return CodeMirror.hint.javascript(cm, options);
    }
    return null;
  }

  /**
   * Context-aware hint dispatcher: routes to HTML, CSS, or Punter/JS hints based on inner mode
   * @param {Object} cm - CodeMirror instance
   * @param {Object} options - hint options passed by CodeMirror
   * @returns {Object|null}
   */
  function studioHint(cm, options) {
    var cur = cm.getCursor();
    var inner = cm.getModeAt(cur);
    var outerMode = cm.getOption('mode');

    if (inner && inner.name === 'css') {
      // check if cursor is in value position: "property: <partial>"
      var before = cm.getLine(cur.line).slice(0, cur.ch);
      var valMatch = before.match(/([\.\w-]+)\s*:\s*([\w-]*)$/);
      if (valMatch) {
        var prop = valMatch[1];
        var partial = valMatch[2];
        var values = CSS_PROP_VALUES[prop];
        if (values) {
          var list = values.filter(function (v) {
            return v.indexOf(partial) === 0;
          });
          return {
            list: list,
            from: CodeMirror.Pos(cur.line, cur.ch - partial.length),
            to: CodeMirror.Pos(cur.line, cur.ch)
          };
        }
      }
      return CodeMirror.hint.css ? CodeMirror.hint.css(cm, options) : null;
    }

    if (outerMode === 'htmlmixed' && (!inner || inner.name !== 'javascript')) {
      return CodeMirror.hint.html ? CodeMirror.hint.html(cm, options) : null;
    }

    return punterHint(cm, options);
  }

  // --- initialise CodeMirror 5 ---
  // codemirror.min.js loads before this script so CodeMirror is available globally
  // fromTextArea replaces the textarea in-place; its current value is used as initial content
  if (window.CodeMirror) {
    window.studioEditor = CodeMirror.fromTextArea(
      document.getElementById('st-textarea'),
      {
        mode: 'javascript',
        theme: 'dracula',
        lineNumbers: true,
        lineWrapping: false,
        indentWithTabs: false,
        tabSize: 2,
        matchBrackets: true,
        styleActiveLine: true,
        autofocus: false,
        extraKeys: {
          'Ctrl-Space': function (cm) { cm.showHint({ hint: studioHint, completeSingle: false }); },
          Tab: function (cm) { cm.replaceSelection('  '); }
        }
      }
    );
    // foldGutter must be set after init so it can correctly append to the gutters list
    window.studioEditor.setOption('foldGutter', true);
    window.studioEditor.setOption('gutters', ['CodeMirror-linenumbers', 'CodeMirror-foldgutter']);
    window.studioEditor.on('change', scheduleAutoSave);
    // save <head> fold state when user clicks the fold gutter
    window.studioEditor.on('gutterClick', function (cm, line, gutter) {
      if (gutter !== 'CodeMirror-foldgutter') return;
      var headLine = findHeadLine();
      if (line !== headLine) return;
      setTimeout(function () {
        var marks = cm.findMarks(CodeMirror.Pos(headLine, 0), CodeMirror.Pos(headLine + 1, 0));
        var folded = marks.some(function (m) { return m.__isFold; });
        setHtmlFolded(folded);
      }, 0);
    });
    // auto-show hints: dot in JS, < or word-char in HTML, word-char or hyphen in CSS
    window.studioEditor.on('inputRead', function (cm, change) {
      var cur = cm.getCursor();
      var inner = cm.getModeAt(cur);
      var outerMode = cm.getOption('mode');
      var inJs = outerMode === 'javascript' || (inner && inner.name === 'javascript');
      var inCss = inner && inner.name === 'css';
      var inHtml = outerMode === 'htmlmixed' && !inJs && !inCss;
      var ch = change.text[0];

      if (ch === '.' && inJs) {
        cm.showHint({ hint: studioHint, completeSingle: false });
      } else if (inHtml && (ch === '<' || /\w/.test(ch))) {
        cm.showHint({ hint: studioHint, completeSingle: false });
      } else if (inCss && (/[\w-]/.test(ch) || ch === ':')) {
        cm.showHint({ hint: studioHint, completeSingle: false });
      }
    });
    window.studioEditor.on('focus', function () {
      editorPaneEl.classList.add('is-focused');
      previewEl.classList.remove('is-focused');
    });
    window.studioEditor.on('blur', function () {
      editorPaneEl.classList.remove('is-focused');
    });

    // use capture phase so we intercept before the browser opens its native find bar
    document.addEventListener('keydown', function (e) {
      if (!window.studioEditor) return;
      var isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      var mod = isMac ? e.metaKey : e.ctrlKey;
      if (!mod) return;
      var cmd = (e.key === 'f' || e.key === 'F') ? 'find'
              : (e.key === 'h' || e.key === 'H') ? 'replace'
              : null;
      if (!cmd) return;
      e.preventDefault();
      window.studioEditor.focus();
      // defer exec until after focus has transferred
      setTimeout(function () { window.studioEditor.execCommand(cmd); }, 0);
    }, true);
  }

  // --- initialise on load ---

  /**
   * Initialises the page: resolves URL params, localStorage and loads the default example
   */
  function init() {
    var gameParam = getGameParam();
    var learnParam = getLearnParam();
    var stored = loadFromStorage();

    if (gameParam) {
      // ?game= param loads a full game HTML file into the editor
      selectEl.value = 'game:' + gameParam;
      loadGameIntoEditor(gameParam);
    } else if (learnParam) {
      // URL param takes priority over localStorage
      selectExample(learnParam, true);
    } else if (stored && KNOWN_EXAMPLES.indexOf(stored.example) !== -1) {
      // restore from localStorage — load the original, then overwrite with saved code
      currentExample = stored.example;
      selectEl.value = stored.example;
      loadExample(stored.example, function (err, original) {
        if (err) {
          selectExample(DEFAULT_EXAMPLE, true);
          return;
        }
        originalCode = original;
        setCode(stored.code);
        clearOutput();
        runGame();
      });
    } else {
      selectEl.value = 'game:pong';
      loadGameIntoEditor('pong');
    }
  }

  init();

}());
