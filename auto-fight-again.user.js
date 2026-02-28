// ==UserScript==
// @name         Pokechill Auto Fight Again
// @namespace    pokechill-automation
// @version      2.0
// @description  Auto Fight Again with optional ability/move target — stops when the target is learned.
// @match        https://play-pokechill.github.io/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  // --- Config defaults ---
  const DEFAULT_DELAY_MS = 2000;

  // --- State ---
  let enabled = true;
  let clicked = false;
  let refightCount = parseInt(localStorage.getItem('pca-refight-count') || '0');
  let delayMs = parseInt(localStorage.getItem('pca-delay-ms') || String(DEFAULT_DELAY_MS));
  let targetAbility = localStorage.getItem('pca-target-ability') || '';

  // --- Helpers ---
  function isVisible(el) {
    return !!(el && el.offsetParent !== null && el.getClientRects().length > 0);
  }

  function saveDelay(val) {
    delayMs = val;
    localStorage.setItem('pca-delay-ms', val);
  }

  function saveTargetAbility(val) {
    targetAbility = val.trim();
    localStorage.setItem('pca-target-ability', targetAbility);
  }

  /**
   * Scans #area-end-moves-title for the target ability/move name.
   * That element contains text like "M. Manectric now has Flamethrower!"
   * Falls back to the full #area-end container if the specific element is missing.
   * Returns true if the target is found and the element is currently visible.
   */
  function targetAbilityFound() {
    if (!targetAbility) return false;

    const movesTitle = document.getElementById('area-end-moves-title');
    // Use the specific element if it exists and is visible (display !== 'none')
    if (movesTitle) {
      const style = window.getComputedStyle(movesTitle);
      if (style.display !== 'none') {
        return movesTitle.textContent.toLowerCase().includes(targetAbility.toLowerCase());
      }
      // Element exists but is hidden — ability was not learned this round
      return false;
    }

    // Fallback: scan the whole end screen
    const endScreen = document.getElementById('area-end');
    if (!endScreen) return false;
    return endScreen.textContent.toLowerCase().includes(targetAbility.toLowerCase());
  }

  /**
   * Show a highlighted notification banner when the target ability is found.
   */
  function showFoundNotification() {
    const existing = document.getElementById('pca-found-banner');
    if (existing) existing.remove();

    const banner = document.createElement('div');
    banner.id = 'pca-found-banner';
    banner.style.cssText = `
      position: fixed;
      top: 16px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 999999;
      background: #27ae60;
      color: #fff;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 15px;
      font-family: monospace;
      font-weight: bold;
      box-shadow: 0 4px 16px rgba(0,0,0,0.5);
      cursor: pointer;
      text-align: center;
    `;
    banner.innerHTML = `
      ✅ Ability found: <em style="text-decoration:underline;">${targetAbility}</em><br>
      <span style="font-size:11px; font-weight:normal; opacity:0.85;">Auto-fight paused. Click to dismiss.</span>
    `;
    banner.addEventListener('click', () => banner.remove());
    document.body.appendChild(banner);

    // Also flash the panel status
    const statusEl = document.getElementById('pca-status');
    if (statusEl) {
      statusEl.style.color = '#27ae60';
      statusEl.textContent = 'Target found!';
    }
  }

  // --- UI Panel ---
  const panel = document.createElement('div');
  panel.id = 'pca-panel';
  panel.style.cssText = `
    position: fixed;
    bottom: 60px;
    right: 10px;
    z-index: 99999;
    background: #1a1a1a;
    color: #e0e0e0;
    padding: 10px 14px;
    border-radius: 8px;
    font-size: 12px;
    font-family: monospace;
    border: 1px solid #444;
    min-width: 200px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.5);
    user-select: none;
  `;

  panel.innerHTML = `
    <div style="font-weight:bold; margin-bottom:8px; color:#aaa; letter-spacing:1px;">⚔ AUTO FIGHT</div>

    <label style="display:flex; align-items:center; gap:6px; cursor:pointer; margin-bottom:8px;">
      <input type="checkbox" id="pca-toggle" ${enabled ? 'checked' : ''}>
      <span id="pca-status">${enabled ? 'Enabled' : 'Paused'}</span>
    </label>

    <div style="margin-bottom:8px;">
      Delay:
      <input
        id="pca-delay"
        type="number"
        min="0"
        max="30000"
        step="500"
        value="${delayMs}"
        style="width:60px; background:#333; color:#eee; border:1px solid #555; border-radius:4px; padding:2px 4px; font-size:12px;"
      > ms
    </div>

    <div style="margin-bottom:4px; color:#aaa;">🎯 Stop when ability learned:</div>
    <input
      id="pca-ability"
      type="text"
      placeholder="e.g. Flamethrower"
      value="${targetAbility}"
      style="
        width: 100%;
        box-sizing: border-box;
        background: #333;
        color: #eee;
        border: 1px solid #555;
        border-radius: 4px;
        padding: 3px 6px;
        font-size: 12px;
        font-family: monospace;
        margin-bottom: 8px;
      "
    >

    <div style="color:#888;">
      Refights: <span id="pca-count" style="color:#7ec8e3;">${refightCount}</span>
    </div>
    <div style="color:#555; margin-top:6px; font-size:10px;">Alt+Q: toggle on/off</div>
  `;

  function mountPanel() {
    if (document.body) {
      document.body.appendChild(panel);
    } else {
      document.addEventListener('DOMContentLoaded', () => document.body.appendChild(panel));
    }
  }
  mountPanel();

  // --- UI Event Listeners ---
  document.addEventListener('change', (e) => {
    if (e.target.id === 'pca-toggle') {
      enabled = e.target.checked;
      const statusEl = document.getElementById('pca-status');
      if (statusEl) {
        statusEl.textContent = enabled ? 'Enabled' : 'Paused';
        statusEl.style.color = '';
      }
    }
    if (e.target.id === 'pca-delay') {
      const val = parseInt(e.target.value);
      if (!isNaN(val) && val >= 0) saveDelay(val);
    }
  });

  // Save ability target on every keystroke (input event)
  document.addEventListener('input', (e) => {
    if (e.target.id === 'pca-ability') {
      saveTargetAbility(e.target.value);
    }
  });

  // Keyboard shortcut: Alt+Q to pause/resume
  document.addEventListener('keydown', (e) => {
    if (e.altKey && e.key === 'q') {
      const toggle = document.getElementById('pca-toggle');
      if (toggle) {
        toggle.checked = !toggle.checked;
        toggle.dispatchEvent(new Event('change'));
      }
    }
  });

  // --- Core Detection ---
  const observer = new MutationObserver(() => {
    if (!enabled) return;

    const btn = document.getElementById('area-rejoin');
    if (isVisible(btn) && !clicked) {
      clicked = true;

      setTimeout(() => {
        // Re-check in case user paused during the delay
        if (!enabled) {
          clicked = false;
          return;
        }

        // --- Ability target check ---
        if (targetAbility && targetAbilityFound()) {
          // Pause auto-fight and notify user
          enabled = false;
          const toggle = document.getElementById('pca-toggle');
          if (toggle) toggle.checked = false;
          showFoundNotification();
          clicked = false;
          return;
        }

        // --- Fight again ---
        btn.click();
        refightCount++;
        const countEl = document.getElementById('pca-count');
        if (countEl) countEl.textContent = refightCount;
        localStorage.setItem('pca-refight-count', refightCount);

        clicked = false;
      }, delayMs);
    }
  });

  observer.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['style', 'class'],
  });

  console.log('[PCA] Auto Fight Again v2.0 loaded. Alt+Q to toggle.');
})();
