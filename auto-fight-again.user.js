// ==UserScript==
// @name         Pokechill Auto Fight Again
// @namespace    pokechill-automation
// @version      2.2
// @description  Auto Fight Again with ability target, marked Pokemon viewer, collapsible/draggable panel, and notes tab.
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
  let collapsed = localStorage.getItem('pca-collapsed') === '1';
  let activeTab = localStorage.getItem('pca-tab') || 'fight';
  let notes = localStorage.getItem('pca-notes') || '';

  // Drag state
  let dragging = false;
  let dragOffX = 0, dragOffY = 0;

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

  function targetAbilityFound() {
    if (!targetAbility) return false;
    const movesTitle = document.getElementById('area-end-moves-title');
    if (movesTitle) {
      if (window.getComputedStyle(movesTitle).display !== 'none') {
        return movesTitle.textContent.toLowerCase().includes(targetAbility.toLowerCase());
      }
      return false;
    }
    const endScreen = document.getElementById('area-end');
    if (!endScreen) return false;
    return endScreen.textContent.toLowerCase().includes(targetAbility.toLowerCase());
  }

  function getMarkedPokemon() {
    const names = [];
    document.querySelectorAll('[data-pkmn-editor]').forEach(el => {
      if (el.querySelector('strong svg')) {
        names.push(el.getAttribute('data-pkmn-editor'));
      }
    });
    return names;
  }

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

    const statusEl = document.getElementById('pca-status');
    if (statusEl) {
      statusEl.style.color = '#27ae60';
      statusEl.textContent = 'Target found!';
    }
  }

  // --- Panel ---
  const panel = document.createElement('div');
  panel.id = 'pca-panel';
  panel.style.cssText = `
    position: fixed;
    bottom: 60px;
    right: 10px;
    z-index: 99999;
    background: #1a1a1a;
    color: #e0e0e0;
    border-radius: 8px;
    font-size: 12px;
    font-family: monospace;
    border: 1px solid #444;
    min-width: 210px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.5);
    user-select: none;
  `;

  function tabStyle(name) {
    const active = activeTab === name;
    return `
      flex:1; padding:5px 0; border:none; cursor:pointer;
      font-size:11px; font-family:monospace;
      background:${active ? '#1a1a1a' : '#222'};
      color:${active ? '#7ec8e3' : '#666'};
      border-bottom:${active ? '2px solid #7ec8e3' : '2px solid transparent'};
    `;
  }

  function renderPanel() {
    const bodyHtml = collapsed ? '' : `
      <div style="display:flex; border-bottom:1px solid #333;">
        <button id="pca-tab-fight" style="${tabStyle('fight')}">Fight</button>
        <button id="pca-tab-marked" style="${tabStyle('marked')}">Marked</button>
        <button id="pca-tab-notes" style="${tabStyle('notes')}">Notes</button>
      </div>

      ${activeTab === 'fight' ? `
        <div style="padding:10px 14px;">
          <label style="display:flex; align-items:center; gap:6px; cursor:pointer; margin-bottom:8px;">
            <input type="checkbox" id="pca-toggle" ${enabled ? 'checked' : ''}>
            <span id="pca-status">${enabled ? 'Enabled' : 'Paused'}</span>
          </label>

          <div style="margin-bottom:8px;">
            Delay:
            <input
              id="pca-delay"
              type="number" min="0" max="30000" step="500"
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
              width:100%; box-sizing:border-box;
              background:#333; color:#eee;
              border:1px solid #555; border-radius:4px;
              padding:3px 6px; font-size:12px; font-family:monospace;
              margin-bottom:8px;
            "
          >

          <div style="color:#888;">
            Refights: <span id="pca-count" style="color:#7ec8e3;">${refightCount}</span>
          </div>
          <div style="color:#555; margin-top:6px; font-size:10px;">Alt+Q: toggle on/off</div>
        </div>
      ` : ''}

      ${activeTab === 'marked' ? (() => {
        const names = getMarkedPokemon();
        const rows = names.length
          ? names.map(n => `<div style="padding:2px 0; color:#c39bd3; text-transform:capitalize;">${n}</div>`).join('')
          : '<div style="color:#555; font-style:italic;">None found on page.</div>';
        return `
          <div style="padding:8px 10px;">
            <div style="color:#aaa; margin-bottom:6px; font-size:11px;">Pokemon with marker icon on this page:</div>
            <div id="pca-marked-list" style="max-height:120px; overflow-y:auto; margin-bottom:6px;">${rows}</div>
            <button id="pca-marked-refresh" style="
              width:100%; padding:4px; background:#333; color:#aaa;
              border:1px solid #555; border-radius:4px;
              font-size:11px; font-family:monospace; cursor:pointer;
            ">Refresh</button>
          </div>
        `;
      })() : ''}

      ${activeTab === 'notes' ? `
        <div style="padding:8px 10px;">
          <textarea
            id="pca-notes-area"
            placeholder="Notes..."
            style="
              width:100%; box-sizing:border-box;
              height:100px; resize:vertical;
              background:#252525; color:#ccc;
              border:1px solid #444; border-radius:4px;
              padding:5px; font-size:11px; font-family:monospace;
              user-select:text;
            "
          >${notes}</textarea>
        </div>
      ` : ''}
    `;

    panel.innerHTML = `
      <div id="pca-header" style="
        display:flex; align-items:center; justify-content:space-between;
        padding:7px 10px;
        background:#252525;
        border-radius:${collapsed ? '8px' : '8px 8px 0 0'};
        cursor:grab;
        ${collapsed ? '' : 'border-bottom:1px solid #333;'}
      ">
        <span style="font-weight:bold; color:#aaa; letter-spacing:1px; font-size:11px;">⚔ AUTO FIGHT</span>
        <button id="pca-collapse-btn" title="Collapse/expand" style="
          background:none; border:none; color:#888;
          cursor:pointer; font-size:12px; padding:0 2px; line-height:1;
        ">${collapsed ? '▲' : '▼'}</button>
      </div>
      ${bodyHtml}
    `;

    attachEvents();
  }

  function attachEvents() {
    // Collapse
    document.getElementById('pca-collapse-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      collapsed = !collapsed;
      localStorage.setItem('pca-collapsed', collapsed ? '1' : '0');
      renderPanel();
    });

    // Tabs
    const tabFight = document.getElementById('pca-tab-fight');
    const tabMarked = document.getElementById('pca-tab-marked');
    const tabNotes = document.getElementById('pca-tab-notes');
    if (tabFight) tabFight.addEventListener('click', () => { activeTab = 'fight'; localStorage.setItem('pca-tab', 'fight'); renderPanel(); });
    if (tabMarked) tabMarked.addEventListener('click', () => { activeTab = 'marked'; localStorage.setItem('pca-tab', 'marked'); renderPanel(); });
    if (tabNotes) tabNotes.addEventListener('click', () => { activeTab = 'notes'; localStorage.setItem('pca-tab', 'notes'); renderPanel(); });

    const refreshBtn = document.getElementById('pca-marked-refresh');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        const names = getMarkedPokemon();
        const list = document.getElementById('pca-marked-list');
        if (list) {
          list.innerHTML = names.length
            ? names.map(n => `<div style="padding:2px 0; color:#c39bd3; text-transform:capitalize;">${n}</div>`).join('')
            : '<div style="color:#555; font-style:italic;">None found on page.</div>';
        }
      });
    }

    // Fight controls
    const toggle = document.getElementById('pca-toggle');
    if (toggle) {
      toggle.addEventListener('change', () => {
        enabled = toggle.checked;
        const statusEl = document.getElementById('pca-status');
        if (statusEl) { statusEl.textContent = enabled ? 'Enabled' : 'Paused'; statusEl.style.color = ''; }
      });
    }

    const delayInput = document.getElementById('pca-delay');
    if (delayInput) {
      delayInput.addEventListener('change', () => {
        const val = parseInt(delayInput.value);
        if (!isNaN(val) && val >= 0) saveDelay(val);
      });
    }

    const abilityInput = document.getElementById('pca-ability');
    if (abilityInput) {
      abilityInput.addEventListener('input', () => saveTargetAbility(abilityInput.value));
    }

    // Notes — prevent drag when interacting with textarea
    const notesArea = document.getElementById('pca-notes-area');
    if (notesArea) {
      notesArea.addEventListener('mousedown', (e) => e.stopPropagation());
      notesArea.addEventListener('input', () => {
        notes = notesArea.value;
        localStorage.setItem('pca-notes', notes);
      });
    }

    // Drag — attach to header
    const header = document.getElementById('pca-header');
    header.addEventListener('mousedown', (e) => {
      if (e.target.id === 'pca-collapse-btn') return;
      dragging = true;
      const rect = panel.getBoundingClientRect();
      dragOffX = e.clientX - rect.left;
      dragOffY = e.clientY - rect.top;
      // Switch from bottom/right to top/left for free positioning
      panel.style.bottom = '';
      panel.style.right = '';
      panel.style.top = rect.top + 'px';
      panel.style.left = rect.left + 'px';
      header.style.cursor = 'grabbing';
    });
  }

  // Global drag tracking
  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    panel.style.left = (e.clientX - dragOffX) + 'px';
    panel.style.top = (e.clientY - dragOffY) + 'px';
  });

  document.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    const header = document.getElementById('pca-header');
    if (header) header.style.cursor = 'grab';
  });

  // Alt+Q shortcut
  document.addEventListener('keydown', (e) => {
    if (e.altKey && e.key === 'q') {
      const toggle = document.getElementById('pca-toggle');
      if (toggle) { toggle.checked = !toggle.checked; toggle.dispatchEvent(new Event('change')); }
    }
  });

  // Mount
  if (document.body) {
    document.body.appendChild(panel);
    renderPanel();
  } else {
    document.addEventListener('DOMContentLoaded', () => { document.body.appendChild(panel); renderPanel(); });
  }

  // --- Core Detection ---
  const observer = new MutationObserver(() => {
    if (!enabled) return;

    const btn = document.getElementById('area-rejoin');
    if (isVisible(btn) && !clicked) {
      clicked = true;

      setTimeout(() => {
        if (!enabled) { clicked = false; return; }

        if (targetAbility && targetAbilityFound()) {
          enabled = false;
          const toggle = document.getElementById('pca-toggle');
          if (toggle) toggle.checked = false;
          showFoundNotification();
          clicked = false;
          return;
        }

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

  console.log('[PCA] Auto Fight Again v2.2 loaded. Alt+Q to toggle.');
})();
