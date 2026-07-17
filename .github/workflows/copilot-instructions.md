# Coding rules

- Use plain JavaScript
- Use ES5 syntax only
- Keep code simple enough for a junior developer to understand
- Use minimal schemantic HTML
- Use single quotes
- Always use semicolons
- Do not use arrow functions
- Do not use classes
- Do not use async or await
- Do not use map, filter or reduce
- Do not use const
- Avoid unnecessary abstractions
- Avoid build tools and dependencies
- Keep examples in a single HTML file where possible
- Add concise JSDoc to public functions
- Do not end JSDoc descriptions with periods
- Keep comments lowercase and concise
- Preserve the existing project style
- Before finishing, check that the result works directly in a browser
- Always format/indent code to make it easier to read

## 2D game instructions

When asked to create or modify a 2D game:

- Use the existing punter.js engine and its current APIs
- Inspect existing games in the project before writing code
- Follow the structure and conventions of the simplest existing example
- Use plain ES5 JavaScript
- Keep the game in a single HTML file unless asked otherwise
- Do not add dependencies, frameworks or build tools
- Keep the code simple enough for a junior developer to understand
- Avoid classes, arrow functions, async functions and advanced patterns
- Reuse existing engine features instead of rebuilding them
- Preserve existing controls, scoring and gameplay unless asked to change them
- Do not rewrite unrelated code
- Make the smallest change needed
- Use punter.js methods for sprites and collision detection
- Keep game state in a small number of clearly named variables
- Use delta time or existing engine timing APIs where appropriate
- Ensure restart resets all game state
- Ensure keyboard and pointer controls continue to work
- Check asset paths before referencing images or sounds
- Do not invent Punter.js APIs
- When unsure about an API, inspect the engine source or existing examples
- After making changes, check for console errors and obvious gameplay issues
- Create game sprites as png files in /images/gamename/
- declare punter.js functions inline - example punter.on('update', function () {});