Original prompt: the game canvas and the buttons are too large with view in 100% in both portrait and landscape

- Initial review: responsive sizing is split between `public/styles.css` and `updateFieldLayout()` in `public/client.js`.
- Current suspicion: the field width clamp and virtual control size clamps are too aggressive for 100% viewport rendering, especially on coarse-pointer portrait and landscape layouts.
- Implemented: reduced the field-width budget in `updateFieldLayout()` by increasing reserved viewport padding/height and trimming landscape virtual-control side space.
- Implemented: reduced menu panel width/padding, tightened form spacing, and shrank virtual joystick/action/pause button clamps in both portrait and landscape media rules.
- Verification: Playwright MCP checks at 430x932 and 932x430 show the canvas reduced from 410px to 394px in portrait and from 545px to 490px in landscape; action buttons also render smaller.
- Verification: started a CPU match after the layout change and confirmed no console errors through the browser tool.
- Note: the `$WEB_GAME_CLIENT` script could not be run directly because the local Node environment does not have the `playwright` module installed; browser-tool verification was used instead.
