# Coding rules

* Use plain ES5 JavaScript
* Keep code simple enough for a junior developer to understand
* Follow the existing project structure and coding style
* Use minimal semantic HTML
* Use single quotes
* Always use semicolons
* Use var; do not use const or let
* Do not use arrow functions
* Do not use classes
* Do not use async or await
* Do not use map, filter or reduce
* Avoid unnecessary abstractions
* Avoid dependencies, frameworks and build tools
* Keep examples in a single HTML file where practical
* Use small, clearly named functions
* Add concise JSDoc to reusable functions
* Do not end JSDoc descriptions with periods
* Keep comments lowercase and concise
* Format and indent code consistently
* Make the smallest change needed
* Do not rewrite or rename unrelated code
* Before finishing, check that the code works directly in a browser
* Check for console errors

# 2D game instructions

When asked to create or modify a 2D game:

* Use the existing Punter.js engine and its current APIs
* Inspect the engine source and relevant existing games before writing code
* Follow the structure of the most relevant simple example
* Keep the game in a single HTML file unless asked otherwise
* Reuse Punter.js features instead of recreating them
* Do not invent Punter.js methods or options
* When unsure about an API, inspect the engine source or existing examples
* Use punter.createSprite for visible game objects
* Use Punter.js collision methods instead of custom collision detection
* Avoid direct canvas drawing unless Punter.js cannot provide the required result
* Register Punter.js callbacks inline, for example: punter.on('update', function () {});
* Keep game settings near the top of the script
* Use clearly named variables for game state
* Preserve existing controls, scoring and gameplay unless asked to change them
* Ensure newly added state is reset when the game restarts
* Ensure keyboard and pointer controls continue to work
* Use the timing values supplied by Punter.js rather than creating separate timers
* Check asset paths before referencing images or sounds
* Store game sprites as PNG files in /images/<game-name>/
* Keep sprite filenames lowercase and descriptive
* After making changes, test starting, playing, losing and restarting the game
* Check for obvious collision, movement and scoring issues