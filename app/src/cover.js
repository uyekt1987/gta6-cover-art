// Vice Cover Studio — the cover renderer.
//
// drawCover(ctx, w, h, state) paints one poster at any size: a set of photo
// panels in a chosen layout, each with its own crop and colour grade, then a
// bold caption in the Anton display face and a thin poster frame. The same
// function draws the small live preview and the full-size exported PNG, so
// what the maker sees is exactly what the file holds.
//
// A panel's photo is drawn cover-fit: it always fills its panel, and the
// maker moves it with panX / panY (fractions of the panel) and zoom. A grade
// is a canvas filter on the photo plus a tinted gradient laid over it.

export const LAYOUTS = {
  strip: {
    label: 'Sunset Strip',
    hint: 'One wide hero panel over three below it',
    panels(w, h) {
      const m = Math.max(10, Math.round(w * 0.018));
      const g = Math.max(6, Math.round(w * 0.012));
      const ix = m, iy = m, iw = w - 2 * m, ih = h - 2 * m;
      const heroH = Math.round(ih * 0.54);
      const rowY = iy + heroH + g;
      const rowH = iy + ih - rowY;
      const colW = (iw - 2 * g) / 3;
      return [
        { x: ix, y: iy, w: iw, h: heroH },
        { x: ix, y: rowY, w: colW, h: rowH },
        { x: ix + colW + g, y: rowY, w: colW, h: rowH },
        { x: ix + 2 * (colW + g), y: rowY, w: colW, h: rowH },
      ];
    },
    // Which photo slot fills each panel (slot 0 fills two panels).
    slots: [0, 1, 2, 0],
  },
  grid: {
    label: 'Neon Grid',
    hint: 'Four panels in a square grid',
    panels(w, h) {
      const m = Math.max(10, Math.round(w * 0.018));
      const g = Math.max(6, Math.round(w * 0.012));
      const ix = m, iy = m, iw = w - 2 * m, ih = h - 2 * m;
      const colW = (iw - g) / 2;
      const rowH = (ih - g) / 2;
      return [
        { x: ix, y: iy, w: colW, h: rowH },
        { x: ix + colW + g, y: iy, w: colW, h: rowH },
        { x: ix, y: iy + rowH + g, w: colW, h: rowH },
        { x: ix + colW + g, y: iy + rowH + g, w: colW, h: rowH },
      ];
    },
    slots: [0, 1, 2, 0],
  },
  trio: {
    label: 'Vice Trio',
    hint: 'One tall panel beside a column of two',
    panels(w, h) {
      const m = Math.max(10, Math.round(w * 0.018));
      const g = Math.max(6, Math.round(w * 0.012));
      const ix = m, iy = m, iw = w - 2 * m, ih = h - 2 * m;
      const leftW = Math.round(iw * 0.46);
      const rightX = ix + leftW + g;
      const rightW = ix + iw - rightX;
      const topH = Math.round(ih * 0.52);
      return [
        { x: ix, y: iy, w: leftW, h: ih },
        { x: rightX, y: iy, w: rightW, h: topH },
        { x: rightX, y: iy + topH + g, w: rightW, h: ih - topH - g },
      ];
    },
    slots: [0, 1, 2],
  },
};

// A grade: the canvas filter run over the photo, then a tinted gradient
// laid over the panel, then the strength of the vignette at the edges.
export const GRADES = {
  sunset: {
    label: 'Sunset',
    hint: 'Warm orange into pink',
    filter: 'saturate(1.25) contrast(1.06) brightness(1.03)',
    top: 'rgba(255,122,24,0.10)',
    bottom: 'rgba(190,32,120,0.30)',
    vignette: 0.42,
  },
  neon: {
    label: 'Neon',
    hint: 'Magenta and cyan nights',
    filter: 'saturate(1.45) contrast(1.12) brightness(0.98)',
    top: 'rgba(255,45,170,0.22)',
    bottom: 'rgba(0,190,255,0.26)',
    vignette: 0.38,
  },
  dusk: {
    label: 'Dusk',
    hint: 'Cool blue hour',
    filter: 'saturate(1.1) contrast(1.05) brightness(0.92)',
    top: 'rgba(70,90,220,0.20)',
    bottom: 'rgba(40,16,90,0.34)',
    vignette: 0.48,
  },
  mono: {
    label: 'Mono',
    hint: 'Black and white with a warm duotone',
    filter: 'grayscale(1) contrast(1.12) brightness(1.02)',
    top: 'rgba(255,190,110,0.08)',
    bottom: 'rgba(30,10,60,0.30)',
    vignette: 0.45,
  },
};

export const SIZES = {
  square: { label: '1080 × 1080', w: 1080, h: 1080 },
  portrait: { label: '1080 × 1350', w: 1080, h: 1350 },
  wide: { label: '1920 × 1080', w: 1920, h: 1080 },
};

export const CAPTION_COLORS = ['#ffffff', '#ffd23f', '#ff5da2', '#37e6ff'];

// How far a panel's photo may be panned at its current zoom, so the photo
// always covers the panel: fractions of the panel size.
export function panLimits(panel, photo, zoom) {
  if (!photo || !photo.width || !photo.height) return { x: 0, y: 0 };
  const scale = Math.max(panel.w / photo.width, panel.h / photo.height);
  const dw = photo.width * scale * zoom;
  const dh = photo.height * scale * zoom;
  return {
    x: Math.max(0, (dw - panel.w) / 2 / panel.w),
    y: Math.max(0, (dh - panel.h) / 2 / panel.h),
  };
}

function drawPanelPhoto(ctx, panel, photo, grade) {
  const { zoom, panX, panY } = photo;
  const scale = Math.max(panel.w / photo.img.width,
    panel.h / photo.img.height) * zoom;
  const dw = photo.img.width * scale;
  const dh = photo.img.height * scale;
  const dx = panel.x + (panel.w - dw) / 2 + panX * panel.w;
  const dy = panel.y + (panel.h - dh) / 2 + panY * panel.h;
  ctx.save();
  ctx.beginPath();
  ctx.rect(panel.x, panel.y, panel.w, panel.h);
  ctx.clip();
  ctx.filter = grade.filter;
  ctx.drawImage(photo.img, dx, dy, dw, dh);
  ctx.filter = 'none';
  const tint = ctx.createLinearGradient(0, panel.y, 0, panel.y + panel.h);
  tint.addColorStop(0, grade.top);
  tint.addColorStop(1, grade.bottom);
  ctx.fillStyle = tint;
  ctx.fillRect(panel.x, panel.y, panel.w, panel.h);
  ctx.restore();
  // Crisp white edge around the panel, poster style.
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = Math.max(2, panel.w * 0.004);
  ctx.strokeRect(panel.x, panel.y, panel.w, panel.h);
  ctx.restore();
}

// Split a caption into at most two centred lines that fit the width.
function wrapCaption(ctx, text, maxWidth) {
  const words = String(text || '').toUpperCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines = [''];
  for (const word of words) {
    const trial = lines[lines.length - 1]
      ? lines[lines.length - 1] + ' ' + word : word;
    if (ctx.measureText(trial).width <= maxWidth || !lines[lines.length - 1]) {
      lines[lines.length - 1] = trial;
    } else if (lines.length < 2) {
      lines.push(word);
    } else {
      lines[lines.length - 1] += ' ' + word;
    }
  }
  return lines;
}

function drawCaption(ctx, w, h, state) {
  const text = (state.caption || '').trim();
  if (!text) return;
  const maxWidth = w * 0.92;
  // Find the largest Anton size that fits on at most two lines.
  let fontSize = Math.round(w * 0.115);
  let lines = [];
  while (fontSize > Math.round(w * 0.04)) {
    ctx.font = `400 ${fontSize}px Anton, "Arial Narrow", sans-serif`;
    lines = wrapCaption(ctx, text, maxWidth);
    const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
    if (widest <= maxWidth) break;
    fontSize = Math.round(fontSize * 0.92);
  }
  const lineHeight = fontSize * 1.04;
  const blockH = lines.length * lineHeight;
  const cy = state.captionPos === 'top'
    ? Math.round(h * 0.13) + blockH / 2
    : Math.round(h * 0.87) - blockH / 2;
  // A dark scrim behind the words so they read over any photo.
  const scrimH = blockH + fontSize * 0.9;
  const scrimY = cy - scrimH / 2;
  const scrim = ctx.createLinearGradient(0, scrimY, 0, scrimY + scrimH);
  scrim.addColorStop(0, 'rgba(12,6,28,0)');
  scrim.addColorStop(0.5, 'rgba(12,6,28,0.55)');
  scrim.addColorStop(1, 'rgba(12,6,28,0)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, scrimY, w, scrimH);

  ctx.save();
  ctx.translate(w / 2, cy);
  ctx.rotate(-0.026); // a slight poster tilt
  ctx.font = `400 ${fontSize}px Anton, "Arial Narrow", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = Math.round(fontSize * 0.08);
  ctx.shadowOffsetY = Math.round(fontSize * 0.045);
  ctx.strokeStyle = '#160a2b';
  ctx.lineWidth = Math.max(3, Math.round(fontSize * 0.16));
  lines.forEach((line, i) => {
    const y = (i - (lines.length - 1) / 2) * lineHeight;
    ctx.strokeText(line, 0, y);
  });
  ctx.fillStyle = state.captionColor || '#ffffff';
  lines.forEach((line, i) => {
    const y = (i - (lines.length - 1) / 2) * lineHeight;
    ctx.fillText(line, 0, y);
  });
  ctx.restore();

  // Sub-caption: small, bold, with a rule broken by the words.
  const sub = (state.sub || '').trim();
  if (sub) {
    const subSize = Math.max(14, Math.round(w * 0.026));
    ctx.save();
    ctx.font = `700 ${subSize}px "Helvetica Neue", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const subY = cy + blockH / 2 + Math.round(fontSize * 0.16);
    const subText = sub.toUpperCase();
    const subW = ctx.measureText(subText).width;
    const ruleY = subY - Math.round(subSize * 0.55);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = Math.max(2, Math.round(w * 0.002));
    const gap = Math.round(w * 0.02);
    ctx.beginPath();
    ctx.moveTo(w / 2 - subW / 2 - gap - Math.round(w * 0.10), ruleY);
    ctx.lineTo(w / 2 - subW / 2 - gap, ruleY);
    ctx.moveTo(w / 2 + subW / 2 + gap, ruleY);
    ctx.lineTo(w / 2 + subW / 2 + gap + Math.round(w * 0.10), ruleY);
    ctx.stroke();
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = Math.round(subSize * 0.25);
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.fillText(subText, w / 2, subY);
    ctx.restore();
  }
}

export function drawCover(ctx, w, h, state) {
  const layout = LAYOUTS[state.layout] || LAYOUTS.strip;
  const grade = GRADES[state.grade] || GRADES.sunset;

  // Deep violet ground; the gutters read as dark seams between panels.
  ctx.save();
  ctx.fillStyle = '#150a24';
  ctx.fillRect(0, 0, w, h);

  const panels = layout.panels(w, h);
  panels.forEach((panel, i) => {
    const photo = state.photos[layout.slots[i]];
    if (photo && photo.img) drawPanelPhoto(ctx, panel, photo, grade);
  });

  // Vignette: the edges fall away so the centre pops.
  const vg = ctx.createRadialGradient(
    w / 2, h / 2, Math.min(w, h) * 0.42,
    w / 2, h / 2, Math.max(w, h) * 0.72);
  vg.addColorStop(0, 'rgba(10,5,25,0)');
  vg.addColorStop(1, `rgba(10,5,25,${grade.vignette})`);
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);

  drawCaption(ctx, w, h, state);

  // Thin white poster frame and a tiny maker tag in the corner opposite
  // the caption, so the two never sit on each other.
  const frame = Math.max(3, Math.round(w * 0.004));
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = frame;
  ctx.strokeRect(frame, frame, w - 2 * frame, h - 2 * frame);
  const tagSize = Math.max(11, Math.round(w * 0.014));
  ctx.font = `700 ${tagSize}px "Helvetica Neue", Arial, sans-serif`;
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  if (state.captionPos === 'top') {
    ctx.textBaseline = 'bottom';
    ctx.fillText('MADE WITH VICE COVER STUDIO', w - frame - 10, h - frame - 8);
  } else {
    ctx.textBaseline = 'top';
    ctx.fillText('MADE WITH VICE COVER STUDIO', w - frame - 10, frame + 8);
  }
  ctx.restore();
}
