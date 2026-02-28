# Pokechill Auto Fight Again

Automatically clicks **Fight Again** after each battle in [Pokechill](https://play-pokechill.github.io/). Optionally stops when a specific ability or move is learned.

---

## Features

- Automatically clicks Fight Again after every battle
- **Ability/Move Target** — enter a name and auto-fight pauses the moment that ability appears in the results screen
- Configurable delay before clicking (so you can see the results screen)
- Refight counter persists across sessions
- Toggle on/off with a checkbox or `Alt+Q`

---

## Requirements

- [Tampermonkey](https://www.tampermonkey.net/) browser extension
  - Available for Chrome, Firefox, Edge, Safari, and Opera

---

## Installation

1. **Install Tampermonkey** from [tampermonkey.net](https://www.tampermonkey.net/) if you haven't already.

2. **Open the Tampermonkey dashboard:**
   - Click the Tampermonkey icon in your browser toolbar
   - Select **Dashboard**

3. **Create a new script:**
   - Click the **+** tab to create a new script
   - Delete all existing placeholder code

4. **Paste the script:**
   - Open [`auto-fight-again.user.js`](./auto-fight-again.user.js) from this repo
   - Copy the entire contents and paste it into the Tampermonkey editor

5. **Save:**
   - Press `Ctrl+S` or click **File → Save**

6. **Open Pokechill:**
   - Go to [https://play-pokechill.github.io/](https://play-pokechill.github.io/)
   - The **⚔ AUTO FIGHT** panel will appear in the bottom-right corner of the screen

---

## Usage

### Basic Auto-Fight

1. Navigate to the explore/training screen in Pokechill and start a battle
2. The script runs automatically — after each battle ends, it waits the configured delay then clicks **Fight Again**
3. The refight counter in the panel tracks how many times it has refought

### Stop When a Specific Ability is Learned (Training Mode)

This is the main reason to use this script for training:

1. In the **⚔ AUTO FIGHT** panel, find the **"Stop when ability learned"** input box
2. Type the exact name (or partial name) of the ability/move you are training for
   - Example: `Flamethrower`, `Swift`, `Immunity`
   - The check is **case-insensitive**, so `immunity` works the same as `Immunity`
   - The results screen shows text like *"M. Manectric now has Immunity!"* — just enter the ability name, not the full sentence
3. Start your training battle and let the script run
4. When that ability appears in the battle results screen, the script will:
   - **Pause auto-fight** automatically
   - Show a **green notification banner** at the top of the screen
   - The panel status will change to `Target found!`
5. You can then dismiss the banner and manually continue — or clear the ability box to resume unrestricted auto-fighting

> **Tip:** Leave the ability box empty if you just want endless auto-fighting with no stop condition.

### Controls

| Control | Action |
|---|---|
| Checkbox in panel | Enable / pause auto-fight |
| `Alt+Q` | Keyboard shortcut to toggle on/off |
| Delay input | Milliseconds to wait on the results screen before clicking Fight Again (default: 2000ms) |
| Ability input | Ability/move name to stop on (leave blank to disable) |

---

## Settings are Saved

All settings persist across page refreshes using `localStorage`:

- Delay value
- Target ability name
- Refight counter

---

## Troubleshooting

**The panel doesn't appear**
- Make sure Tampermonkey is enabled and the script is active (green dot in the Tampermonkey dashboard)
- Refresh the Pokechill page

**Fight Again isn't being clicked**
- Confirm the toggle checkbox in the panel is checked
- Try increasing the delay — the button may not be fully visible yet when the script checks

**Ability target isn't being detected**
- Double-check the spelling against what appears on the results screen (e.g. `Immunity`, not `Immune`)
- The match is a substring search, so a partial name like `flame` will match `Flamethrower`
- The script reads the "now has X!" line — make sure you are in training mode where that line appears

**Script stopped after a page refresh**
- This is normal — Tampermonkey re-injects the script on each page load, so it will resume automatically. Your settings are restored from localStorage.

---

## How It Works

The script uses a `MutationObserver` to watch the page DOM for changes. When the **Fight Again** button (`#area-rejoin`) becomes visible, it means a battle has ended. Before clicking the button, it checks the text content of `#area-end-moves-title` — the element that shows lines like *"M. Manectric now has Immunity!"* — against your target ability name. If the element is hidden (no move was learned this round), it counts as not found. If the ability is found, it pauses; otherwise it clicks Fight Again and continues.

No server calls are made — everything runs entirely in your browser.

---

## Attribution

Inspired by:
- [EricSpeidel/pokechill-automation](https://github.com/EricSpeidel/pokechill-automation)
- [Pokechill Auto Rejoin Area userscript](https://greasyfork.org/en/scripts/560607-pokechill-auto-rejoin-area/code)
