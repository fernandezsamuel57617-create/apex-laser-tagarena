import * as THREE from 'three';
import { countryCodeToFlag } from '../shared/countries';
import { getEmoteById, type EmoteId } from '../shared/emotes';
import type { ArenaFloorPattern } from '../shared/arenaData';
import type { Gender } from '../shared/types';

export interface ProceduralSurfaceOptions {
  baseHex?: string;
  tileHex?: string;
  pattern?: ArenaFloorPattern;
}

export function createArenaFloorTexture(
  maxAnisotropy: number,
  gridHex = '#1e293b',
  accentHex = '#06b6d4',
  options?: ProceduralSurfaceOptions,
): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const pattern = options?.pattern ?? 'cyber_grid';
  const baseHex = options?.baseHex ?? '#0c1220';
  const tileHex = options?.tileHex ?? '#101828';

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, size, size);

  if (pattern === 'volcanic_lava') {
    // Basalt plates + glowing molten magma fissures
    ctx.fillStyle = tileHex;
    ctx.fillRect(10, 10, size / 2 - 20, size / 2 - 20);
    ctx.fillRect(size / 2 + 10, size / 2 + 10, size / 2 - 20, size / 2 - 20);
    ctx.fillRect(size / 2 + 10, 10, size / 2 - 20, size / 2 - 20);
    ctx.fillRect(10, size / 2 + 10, size / 2 - 20, size / 2 - 20);

    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(0, size / 2);
    ctx.lineTo(size, size / 2);
    ctx.moveTo(size / 2, 0);
    ctx.lineTo(size / 2, size);
    ctx.stroke();

    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, size / 2);
    ctx.lineTo(size, size / 2);
    ctx.moveTo(size / 2, 0);
    ctx.lineTo(size / 2, size);
    ctx.stroke();
  } else if (pattern === 'arctic_ice') {
    ctx.fillStyle = tileHex;
    ctx.fillRect(6, 6, size / 2 - 12, size / 2 - 12);
    ctx.fillRect(size / 2 + 6, size / 2 + 6, size / 2 - 12, size / 2 - 12);

    // Glacial fracture cracks & frost shimmer
    ctx.strokeStyle = 'rgba(224, 242, 254, 0.38)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(30, 40);
    ctx.lineTo(145, 130);
    ctx.lineTo(230, 115);
    ctx.lineTo(390, 260);
    ctx.moveTo(145, 130);
    ctx.lineTo(110, 290);
    ctx.moveTo(460, 70);
    ctx.lineTo(350, 200);
    ctx.lineTo(420, 390);
    ctx.stroke();

    ctx.strokeStyle = gridHex;
    ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, size - 4, size - 4);
  } else if (pattern === 'sandstone_ruin') {
    // Ancient carved sandstone flagstones
    const blocks = [
      [8, 8, 240, 152],
      [258, 8, 246, 152],
      [8, 170, 160, 166],
      [178, 170, 168, 166],
      [356, 170, 148, 166],
      [8, 346, 250, 158],
      [268, 346, 236, 158],
    ];
    for (let i = 0; i < blocks.length; i++) {
      const [bx, by, bw, bh] = blocks[i];
      ctx.fillStyle = i % 2 === 0 ? tileHex : baseHex;
      ctx.fillRect(bx, by, bw, bh);
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.3)';
      ctx.lineWidth = 2;
      ctx.strokeRect(bx + 6, by + 6, bw - 12, bh - 12);
    }
  } else if (pattern === 'colosseum_tile') {
    ctx.fillStyle = tileHex;
    ctx.fillRect(8, 8, size / 2 - 16, size / 2 - 16);
    ctx.fillRect(size / 2 + 8, size / 2 + 8, size / 2 - 16, size / 2 - 16);
    ctx.strokeStyle = accentHex;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 4;
    ctx.strokeRect(18, 18, size - 36, size - 36);
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size * 0.28, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  } else if (pattern === 'obsidian_hex') {
    ctx.fillStyle = tileHex;
    ctx.beginPath();
    ctx.moveTo(size / 2, 14);
    ctx.lineTo(size - 14, size / 2);
    ctx.lineTo(size / 2, size - 14);
    ctx.lineTo(14, size / 2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = accentHex;
    ctx.globalAlpha = 0.38;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.globalAlpha = 1;
  } else if (pattern === 'sky_cloud') {
    ctx.fillStyle = tileHex;
    ctx.fillRect(10, 10, size - 20, size - 20);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.26)';
    ctx.lineWidth = 4;
    ctx.strokeRect(10, 10, size - 20, size - 20);
    ctx.strokeStyle = accentHex;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 2;
    ctx.strokeRect(26, 26, size - 52, size - 52);
    ctx.globalAlpha = 1;
  } else if (pattern === 'orbital_deck') {
    ctx.fillStyle = tileHex;
    ctx.fillRect(8, 8, size / 2 - 12, size - 16);
    ctx.fillRect(size / 2 + 4, 8, size / 2 - 12, size - 16);
    ctx.strokeStyle = 'rgba(129, 140, 248, 0.35)';
    ctx.lineWidth = 3;
    ctx.strokeRect(4, 4, size - 8, size - 8);
    ctx.fillStyle = accentHex;
    ctx.globalAlpha = 0.35;
    ctx.fillRect(size / 2 - 4, 24, 8, size - 48);
    ctx.globalAlpha = 1;
  } else {
    // Default tactical cyber grid
    ctx.fillStyle = tileHex;
    ctx.fillRect(6, 6, size / 2 - 12, size / 2 - 12);
    ctx.fillRect(size / 2 + 6, size / 2 + 6, size / 2 - 12, size / 2 - 12);

    ctx.strokeStyle = gridHex;
    ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, size - 4, size - 4);

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
    ctx.lineWidth = 1;
    const step = size / 4;
    for (let i = 1; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(i * step, 0);
      ctx.lineTo(i * step, size);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, i * step);
      ctx.lineTo(size, i * step);
      ctx.stroke();
    }
  }

  // Subtle corner micro-accents
  ctx.fillStyle = accentHex;
  ctx.globalAlpha = 0.45;
  ctx.fillRect(10, 10, 14, 3);
  ctx.fillRect(10, 10, 3, 14);
  ctx.fillRect(size - 24, size - 13, 14, 3);
  ctx.fillRect(size - 13, size - 24, 3, 14);
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createPanelWallTexture(
  maxAnisotropy: number,
  options?: { baseHex?: string; accentHex?: string; pattern?: ArenaFloorPattern },
): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const pattern = options?.pattern ?? 'cyber_grid';
  const baseHex = options?.baseHex ?? '#161f30';
  const accentHex = options?.accentHex ?? '#06b6d4';

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, size, size);

  if (pattern === 'sandstone_ruin') {
    // Ancient stone block masonry courses
    ctx.strokeStyle = 'rgba(69, 26, 3, 0.35)';
    ctx.lineWidth = 4;
    for (let y = 0; y < size; y += 64) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(size, y);
      ctx.stroke();
      const offset = (y / 64) % 2 === 0 ? 0 : 64;
      for (let x = offset; x < size; x += 128) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + 64);
        ctx.stroke();
      }
    }
  } else if (pattern === 'arctic_ice') {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.32)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 60);
    ctx.lineTo(120, 140);
    ctx.lineTo(256, 85);
    ctx.moveTo(90, 0);
    ctx.lineTo(155, 256);
    ctx.stroke();
  } else if (pattern === 'volcanic_lava') {
    ctx.strokeStyle = 'rgba(249, 115, 22, 0.45)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(20, 0);
    ctx.lineTo(80, 110);
    ctx.lineTo(45, 256);
    ctx.moveTo(190, 0);
    ctx.lineTo(140, 160);
    ctx.lineTo(220, 256);
    ctx.stroke();
  } else {
    // Diagonal tech/architectural ribbing
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 4;
    for (let i = -size; i < size * 2; i += 24) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + size, size);
      ctx.stroke();
    }
  }

  ctx.strokeStyle = accentHex;
  ctx.globalAlpha = 0.22;
  ctx.lineWidth = 3;
  ctx.strokeRect(4, 4, size - 8, size - 8);
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(
    size / 2,
    size / 2,
    4,
    size / 2,
    size / 2,
    size / 2,
  );
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.65)');
  grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.25)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createNameplateSprite(
  name: string,
  gender: Gender,
  isBot: boolean,
  accentColor: string,
  country?: string,
): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 560;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Dark backing plate
  ctx.fillStyle = 'rgba(8, 12, 20, 0.88)';
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(18, 22, 524, 84, 14);
  ctx.fill();
  ctx.stroke();

  // Left role/country-code tag
  ctx.font = '700 20px "Chakra Petch", sans-serif';
  ctx.fillStyle = accentColor;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const badge = isBot ? 'BOT' : country ? country : gender === 'male' ? 'H' : 'M';
  ctx.fillText(badge, 36, 65);

  // Flag directly next to Player Name
  const cleanName = name.slice(0, 16);
  const displayLabel = !isBot && country ? `${countryCodeToFlag(country)} ${cleanName}` : cleanName;
  ctx.font =
    '700 30px "Plus Jakarta Sans", "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
  ctx.fillStyle = '#f8fafc';
  ctx.textAlign = 'center';
  ctx.fillText(displayLabel, 306, 65, 420);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthTest: true,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(2.0, 0.46, 1);
  sprite.position.set(0, 2.28, 0);
  return sprite;
}

const emoteTextureCache = new Map<EmoteId, THREE.CanvasTexture>();

export function getEmoteTexture(emoteId: EmoteId): THREE.CanvasTexture {
  const cached = emoteTextureCache.get(emoteId);
  if (cached) return cached;

  const def = getEmoteById(emoteId);
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 176;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Speech-bubble rounded box
  ctx.fillStyle = 'rgba(8, 12, 22, 0.94)';
  ctx.strokeStyle = def.color;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.roundRect(16, 12, 288, 124, 26);
  ctx.fill();
  ctx.stroke();

  // Small pointer triangle at bottom
  ctx.fillStyle = def.color;
  ctx.beginPath();
  ctx.moveTo(146, 136);
  ctx.lineTo(174, 136);
  ctx.lineTo(160, 160);
  ctx.closePath();
  ctx.fill();

  // Large Emoji
  ctx.font = '56px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(def.emoji, 78, 76);

  // Emote Label
  ctx.font = '700 34px "Chakra Petch", "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = '#f8fafc';
  ctx.textAlign = 'left';
  ctx.fillText(def.label, 124, 76);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.userData = { ...tex.userData, isSharedCache: true };
  emoteTextureCache.set(emoteId, tex);
  return tex;
}

export function createEmoteSprite(): THREE.Sprite {
  const mat = new THREE.SpriteMaterial({
    map: getEmoteTexture('wave'),
    transparent: true,
    opacity: 1,
    depthTest: true,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(1.55, 0.85, 1);
  sprite.position.set(0, 2.95, 0);
  sprite.visible = false;
  return sprite;
}

export function createPortalSignSprite(
  title: string,
  subtitle: string,
  accentColor = '#10b981',
): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 176;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = 'rgba(8, 12, 20, 0.9)';
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.roundRect(18, 18, 604, 140, 18);
  ctx.fill();
  ctx.stroke();

  ctx.font = '800 42px "Chakra Petch", sans-serif';
  ctx.fillStyle = accentColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, canvas.width / 2, 68);

  ctx.font = '600 26px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = '#e2e8f0';
  ctx.fillText(subtitle, canvas.width / 2, 118);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthTest: true,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(4.6, 1.26, 1);
  return sprite;
}

