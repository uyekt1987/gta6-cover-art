// Vice Cover Studio — the editor.
//
// Wires the controls in index.html to the renderer in cover.js: photos
// (samples and uploads), panel selection with drag-to-pan and scroll-to-zoom,
// layout / grade / caption / size, live preview and PNG export. Photos are
// read on this machine and never uploaded anywhere.

import {
  LAYOUTS, GRADES, SIZES, CAPTION_COLORS, drawCover, panLimits,
} from './cover.js';

const $ = (sel) => document.querySelector(sel);
const canvas = $('#preview');
const ctx = canvas.getContext('2d');
const statusEl = $('#status');

// One photo slot: the image, where it came from, and its crop.
function emptySlot() {
  return { img: null, src: '', name: 'Empty', zoom: 1, panX: 0, panY: 0 };
}

const state = {
  layout: 'strip',
  grade: 'sunset',
  size: 'wide',
  caption: 'Neon Nights',
  sub: 'Shot on the boulevard at dusk',
  captionColor: '#ffffff',
  captionPos: 'bottom',
  photos: [emptySlot(), emptySlot(), emptySlot()],
};

let selected = 0; // which panel the controls and dragging act on
let previewW = 640; // logical display size of the preview canvas
let previewH = 360;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${src}`));
    img.src = src;
  });
}

function setStatus(text) {
  statusEl.textContent = text;
}

// --- rendering ------------------------------------------------------------

function fitDisplay(w, h, maxSide) {
  const scale = Math.min(1, maxSide / Math.max(w, h));
  return { w: Math.round(w * scale), h: Math.round(h * scale) };
}

function render() {
  const size = SIZES[state.size];
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const fit = fitDisplay(size.w, size.h, 720);
  previewW = fit.w;
  previewH = fit.h;
  canvas.width = Math.round(fit.w * dpr);
  canvas.height = Math.round(fit.h * dpr);
  canvas.style.width = `${fit.w}px`;
  canvas.style.height = `${fit.h}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawCover(ctx, fit.w, fit.h, state);
  drawSelection();
}

function drawSelection() {
  const layout = LAYOUTS[state.layout];
  const panels = layout.panels(previewW, previewH);
  // Outline every panel the selected slot fills, so the maker sees the crop.
  ctx.save();
  ctx.strokeStyle = '#ff2daa';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 6]);
  panels.forEach((p, i) => {
    if (layout.slots[i] === selected) ctx.strokeRect(p.x, p.y, p.w, p.h);
  });
  ctx.restore();
}

function clampPan(slot, panel) {
  const limits = panLimits(panel, slot.img, slot.zoom);
  slot.panX = Math.max(-limits.x, Math.min(limits.x, slot.panX));
  slot.panY = Math.max(-limits.y, Math.min(limits.y, slot.panY));
}

// --- controls -------------------------------------------------------------

function buildButtons(container, entries, key, onPick) {
  const box = $(container);
  box.innerHTML = '';
  for (const [id, def] of Object.entries(entries)) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn small';
    btn.textContent = def.label;
    btn.dataset[key] = id;
    btn.addEventListener('click', () => onPick(id));
    box.appendChild(btn);
  }
}

function markActive(container, attr, value) {
  document.querySelectorAll(`${container} [data-${attr}]`).forEach((b) => {
    b.classList.toggle('active', b.dataset[attr] === value);
  });
}

function syncControls() {
  markActive('#layoutBtns', 'layout', state.layout);
  markActive('#sizeBtns', 'size', state.size);
  markActive('#posBtns', 'pos', state.captionPos);
  document.querySelectorAll('#gradeBtns .swatch').forEach((b) => {
    b.classList.toggle('active', b.dataset.grade === state.grade);
  });
  document.querySelectorAll('#colorBtns .swatch').forEach((b) => {
    b.classList.toggle('active', b.dataset.color === state.captionColor);
  });
  $('#lookHint').textContent =
    `${LAYOUTS[state.layout].hint} · ${GRADES[state.grade].hint}.`;
  document.querySelectorAll('.panel-row').forEach((row, i) => {
    row.classList.toggle('active', i === selected);
    row.querySelector('.pphoto').textContent = state.photos[i].name;
    row.querySelector('input[type="range"]').value = state.photos[i].zoom;
  });
  document.querySelectorAll('.sample-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.sample === state.photos[selected].src);
  });
  const size = SIZES[state.size];
  setStatus(`Ready — ${state.photos.filter((p) => p.img).length} photo(s), ` +
    `${GRADES[state.grade].label} grade, ${size.label}.`);
}

function buildPanelRows() {
  const list = $('#panelList');
  list.innerHTML = '';
  for (let i = 0; i < 3; i += 1) {
    const row = document.createElement('div');
    row.className = 'panel-row';
    row.dataset.panel = String(i);
    row.innerHTML =
      `<div><div class="pname">Panel ${i + 1}</div>` +
      `<div class="pphoto">Empty</div></div>` +
      `<input type="range" min="1" max="3" step="0.05" value="1" ` +
      `aria-label="Zoom panel ${i + 1}">` +
      `<button type="button" class="centre-btn">Centre</button>`;
    row.addEventListener('click', (e) => {
      if (e.target.matches('input, button')) return;
      selected = i;
      render();
      syncControls();
    });
    row.querySelector('input').addEventListener('input', (e) => {
      selected = i;
      const slot = state.photos[i];
      slot.zoom = Number(e.target.value);
      const layout = LAYOUTS[state.layout];
      const panels = layout.panels(previewW, previewH);
      const panel = panels[layout.slots.indexOf(i)] || panels[0];
      clampPan(slot, panel);
      render();
    });
    row.querySelector('.centre-btn').addEventListener('click', () => {
      selected = i;
      const slot = state.photos[i];
      slot.zoom = 1;
      slot.panX = 0;
      slot.panY = 0;
      render();
      syncControls();
    });
    list.appendChild(row);
  }
}

function buildSwatches(container, entries, attr, colors) {
  const box = $(container);
  box.innerHTML = '';
  for (const [id, def] of Object.entries(entries)) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'swatch';
    btn.dataset[attr] = id;
    btn.textContent = def.label;
    btn.style.background = colors[id];
    btn.addEventListener('click', () => {
      if (attr === 'grade') state.grade = id;
      if (attr === 'color') state.captionColor = id;
      render();
      syncControls();
    });
    box.appendChild(btn);
  }
}

function assignPhoto(slotIndex, img, src, name) {
  const slot = state.photos[slotIndex];
  slot.img = img;
  slot.src = src;
  slot.name = name;
  slot.zoom = 1;
  slot.panX = 0;
  slot.panY = 0;
}

// --- preview interaction: click to select, drag to pan, scroll to zoom ---

function panelAt(x, y) {
  const layout = LAYOUTS[state.layout];
  const panels = layout.panels(previewW, previewH);
  for (let i = panels.length - 1; i >= 0; i -= 1) {
    const p = panels[i];
    if (x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) {
      return layout.slots[i];
    }
  }
  return -1;
}

function canvasPoint(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (previewW / rect.width),
    y: (e.clientY - rect.top) * (previewH / rect.height),
  };
}

let dragging = null;

canvas.addEventListener('pointerdown', (e) => {
  const pt = canvasPoint(e);
  const slot = panelAt(pt.x, pt.y);
  if (slot >= 0) {
    selected = slot;
    syncControls();
    dragging = { x: pt.x, y: pt.y };
    canvas.setPointerCapture(e.pointerId);
  }
});

canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const pt = canvasPoint(e);
  const slot = state.photos[selected];
  if (!slot.img) return;
  const layout = LAYOUTS[state.layout];
  const panels = layout.panels(previewW, previewH);
  const panel = panels[layout.slots.indexOf(selected)] || panels[0];
  slot.panX += (pt.x - dragging.x) / panel.w;
  slot.panY += (pt.y - dragging.y) / panel.h;
  clampPan(slot, panel);
  dragging = { x: pt.x, y: pt.y };
  render();
});

canvas.addEventListener('pointerup', () => { dragging = null; });
canvas.addEventListener('pointercancel', () => { dragging = null; });

canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const slot = state.photos[selected];
  if (!slot.img) return;
  slot.zoom = Math.max(1, Math.min(3, slot.zoom * (e.deltaY < 0 ? 1.12 : 0.9)));
  const layout = LAYOUTS[state.layout];
  const panels = layout.panels(previewW, previewH);
  const panel = panels[layout.slots.indexOf(selected)] || panels[0];
  clampPan(slot, panel);
  render();
  syncControls();
}, { passive: false });

// --- export ---------------------------------------------------------------

function exportPNG() {
  const size = SIZES[state.size];
  const off = document.createElement('canvas');
  off.width = size.w;
  off.height = size.h;
  const offCtx = off.getContext('2d');
  drawCover(offCtx, size.w, size.h, state);
  off.toBlob((blob) => {
    if (!blob) {
      setStatus('Export failed — the browser could not make the PNG.');
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vice-cover-${size.w}x${size.h}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    setStatus(`Exported vice-cover-${size.w}x${size.h}.png — check your downloads.`);
  }, 'image/png');
}

$('#exportBtn').addEventListener('click', exportPNG);

// --- startup --------------------------------------------------------------

async function start() {
  buildPanelRows();
  buildButtons('#layoutBtns', LAYOUTS, 'layout', (id) => {
    state.layout = id;
    render();
    syncControls();
  });
  buildButtons('#sizeBtns', SIZES, 'size', (id) => {
    state.size = id;
    render();
    syncControls();
  });
  buildButtons('#posBtns', { top: { label: 'Top' }, bottom: { label: 'Bottom' } },
    'pos', (id) => {
      state.captionPos = id;
      render();
      syncControls();
    });
  buildSwatches('#gradeBtns', GRADES, 'grade', {
    sunset: 'linear-gradient(135deg,#ff7a18,#c2187a)',
    neon: 'linear-gradient(135deg,#ff2daa,#00bfff)',
    dusk: 'linear-gradient(135deg,#465adc,#28105a)',
    mono: 'linear-gradient(135deg,#888,#222)',
  });
  const colorNames = { '#ffffff': 'White', '#ffd23f': 'Gold', '#ff5da2': 'Pink', '#37e6ff': 'Cyan' };
  buildSwatches('#colorBtns',
    Object.fromEntries(CAPTION_COLORS.map((c) => [c, { label: colorNames[c] || c }])),
    'color',
    Object.fromEntries(CAPTION_COLORS.map((c) => [c, c])));

  // The caption fields drive the poster live.
  $('#captionInput').addEventListener('input', (e) => {
    state.caption = e.target.value;
    render();
  });
  $('#subInput').addEventListener('input', (e) => {
    state.sub = e.target.value;
    render();
  });

  // Samples and uploads go into the selected panel.
  document.querySelectorAll('.sample-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        const img = await loadImage(btn.dataset.sample);
        assignPhoto(selected, img, btn.dataset.sample,
          btn.querySelector('span').textContent);
        render();
        syncControls();
      } catch (err) {
        setStatus(`Could not load that sample (${err.message}).`);
      }
    });
  });

  $('#uploadBtn').addEventListener('click', () => $('#photoFile').click());
  $('#photoFile').addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const img = await loadImage(reader.result);
        assignPhoto(selected, img, 'upload', file.name);
        render();
        syncControls();
      } catch (err) {
        setStatus(`Could not read that photo (${err.message}).`);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  });

  $('#fillAllBtn').addEventListener('click', () => {
    const source = state.photos[selected];
    if (!source.img) {
      setStatus('Pick a photo for a panel first, then fill all panels with it.');
      return;
    }
    for (let i = 0; i < 3; i += 1) {
      assignPhoto(i, source.img, source.src, source.name);
    }
    render();
    syncControls();
    setStatus(`All three panels now show “${source.name}”.`);
  });

  // Load the display face, then the three built-in photos, then paint.
  try {
    await document.fonts.load('100px Anton');
  } catch (err) {
    // The canvas falls back to a narrow sans if the face is missing.
    setStatus('Display font did not load; using a fallback face.');
  }
  const samples = [
    ['samples/boulevard.jpg', 'Boulevard'],
    ['samples/pier.jpg', 'Neon pier'],
    ['samples/skyline.jpg', 'Skyline'],
  ];
  for (let i = 0; i < samples.length; i += 1) {
    try {
      const img = await loadImage(samples[i][0]);
      assignPhoto(i, img, samples[i][0], samples[i][1]);
    } catch (err) {
      setStatus(`Sample ${samples[i][1]} did not load (${err.message}).`);
    }
  }
  render();
  syncControls();
  window.__viceReady = true;
  // A handle the screenshot script uses: export at any size, get a data URL.
  window.__vice = {
    state,
    exportDataURL() {
      const size = SIZES[state.size];
      const off = document.createElement('canvas');
      off.width = size.w;
      off.height = size.h;
      drawCover(off.getContext('2d'), size.w, size.h, state);
      return off.toDataURL('image/png');
    },
  };
}

start();
