import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createCharacterRig, createGoldCrownMesh } from '../game/characterModels';
import { disposeObjectTree, isSoftwareGlEnvironment } from '../game/webglUtils';
import { countryCodeToFlag } from '../shared/countries';
import { getOutfitLevel } from '../shared/outfits';
import type { PlayerSnapshot } from '../shared/types';

interface ResultsPodium3DProps {
  topThree: PlayerSnapshot[];
  myId: string | null;
}

interface PedestalSlot {
  player: PlayerSnapshot;
  rank: 1 | 2 | 3;
  x: number;
  targetHeight: number;
  colorHex: number;
  delaySec: number;
}

export function ResultsPodium3D({ topThree, myId }: ResultsPodium3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);

  // Order slots spatially: 2nd (Silver) Left, 1st (Gold) Center, 3rd (Bronze) Right
  const slots: PedestalSlot[] = [];
  if (topThree[1]) {
    slots.push({
      player: topThree[1],
      rank: 2,
      x: -2.35,
      targetHeight: 1.05,
      colorHex: 0xcbd5e1,
      delaySec: 0.16,
    });
  }
  if (topThree[0]) {
    slots.push({
      player: topThree[0],
      rank: 1,
      x: 0,
      targetHeight: 1.55,
      colorHex: 0xfacc15,
      delaySec: 0.32,
    });
  }
  if (topThree[2]) {
    slots.push({
      player: topThree[2],
      rank: 3,
      x: 2.35,
      targetHeight: 0.72,
      colorHex: 0xd97706,
      delaySec: 0.0,
    });
  }

  const slotKey = topThree
    .slice(0, 3)
    .map(
      (p) =>
        `${p.id}:${p.gender}:${p.equippedOutfit}:${getOutfitLevel(p.outfitLevels, p.equippedOutfit)}:${p.equippedWeapon}:${p.equippedWeaponSkin}:${p.accentColor}`,
    )
    .join('|');

  useEffect(() => {
    const container = mountRef.current;
    if (!container || slots.length === 0) return;

    const isSoftwareGl = isSoftwareGlEnvironment();

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        alpha: true,
        powerPreference: 'high-performance',
      });
    } catch {
      return;
    }

    const width = container.clientWidth || 580;
    const height = container.clientHeight || 260;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x090f1d);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmrem.fromScene(roomEnv, 0.04);
    scene.environment = envTarget.texture;
    roomEnv.dispose();
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 40);
    camera.position.set(0, 2.35, 7.6);
    camera.lookAt(0, 1.8, 0);

    const hemi = new THREE.HemisphereLight(0xe0f2fe, 0x0f172a, 1.35);
    const key = new THREE.DirectionalLight(0xffffff, 2.1);
    key.position.set(3, 6, 5);
    const rim = new THREE.DirectionalLight(0xfacc15, 1.15);
    rim.position.set(-4, 4, -3);
    scene.add(hemi, key, rim);

    const disposables: Array<{ dispose: () => void }> = [envTarget];

    // Stage floor disc
    const stageGeo = new THREE.CylinderGeometry(4.6, 4.9, 0.2, 48);
    const stageMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.5,
      roughness: 0.35,
    });
    const stage = new THREE.Mesh(stageGeo, stageMat);
    stage.position.y = -0.1;
    scene.add(stage);
    disposables.push(stageGeo, stageMat);

    const podiumActors: Array<{
      slot: PedestalSlot;
      group: THREE.Group;
      rig: ReturnType<typeof createCharacterRig>;
      crown: THREE.Group | null;
      startY: number;
    }> = [];

    for (const slot of slots) {
      const group = new THREE.Group();
      const startY = -slot.targetHeight - 0.6;
      group.position.set(slot.x, startY, 0);

      // Pedestal Base & Neon Trim Ring
      const pedGeo = new THREE.CylinderGeometry(0.95, 1.05, slot.targetHeight, 24);
      const pedMat = new THREE.MeshStandardMaterial({
        color: 0x162033,
        metalness: 0.65,
        roughness: 0.28,
      });
      const pedMesh = new THREE.Mesh(pedGeo, pedMat);
      pedMesh.position.y = slot.targetHeight / 2;
      group.add(pedMesh);
      disposables.push(pedGeo, pedMat);

      const trimGeo = new THREE.TorusGeometry(0.96, 0.045, 10, 32);
      const trimMat = new THREE.MeshStandardMaterial({
        color: slot.colorHex,
        emissive: slot.colorHex,
        emissiveIntensity: 1.5,
        metalness: 0.4,
        roughness: 0.2,
      });
      const trimRing = new THREE.Mesh(trimGeo, trimMat);
      trimRing.rotation.x = Math.PI / 2;
      trimRing.position.y = slot.targetHeight - 0.02;
      group.add(trimRing);
      disposables.push(trimGeo, trimMat);

      // Front-facing 3D character rig (eyes & chest face -Z, so rotate bodyGroup Math.PI toward camera +Z)
      const rig = createCharacterRig(
        slot.player.gender,
        slot.player.name,
        slot.player.isBot,
        slot.player.accentColor,
        slot.player.equippedOutfit,
        slot.player.country,
        slot.player.equippedWeaponSkin,
        slot.player.equippedWeapon,
        getOutfitLevel(slot.player.outfitLevels, slot.player.equippedOutfit),
      );
      rig.root.position.set(0, slot.targetHeight, 0);
      rig.bodyGroup.rotation.y = Math.PI;
      rig.nameplate.visible = false;
      rig.emoteSprite.visible = false;
      rig.shieldBubble.visible = false;
      rig.blasterMesh.visible = true;
      group.add(rig.root);

      let crown: THREE.Group | null = null;
      if (slot.rank === 1) {
        crown = createGoldCrownMesh();
        crown.position.set(0, slot.targetHeight + 2.38, 0);
        crown.scale.setScalar(1.05);
        group.add(crown);
      }

      scene.add(group);
      podiumActors.push({ slot, group, rig, crown, startY });
    }

    let disposed = false;
    let frameId = 0;
    const startTime = performance.now();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 580;
      const h = container.clientHeight || 260;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    const afterDraw = (cb: () => void) => {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync?.(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const st = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
        if (st === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    };

    const tick = () => {
      if (disposed) return;
      const now = performance.now();
      const elapsedSec = (now - startTime) / 1000;

      for (const actor of podiumActors) {
        const t = Math.max(0, Math.min(1, (elapsedSec - actor.slot.delaySec) / 0.65));
        const eased = 1 - Math.pow(1 - t, 3);
        actor.group.position.y = THREE.MathUtils.lerp(actor.startY, 0, eased);

        // Front-facing celebratory idle pose
        actor.rig.bodyGroup.rotation.y = Math.PI + Math.sin(elapsedSec * 1.4 + actor.slot.rank) * 0.14;
        if (actor.slot.rank === 1) {
          actor.rig.leftArm.rotation.x = -2.45 + Math.sin(elapsedSec * 5.2) * 0.16;
          actor.rig.rightArm.rotation.x = -0.35;
        } else if (actor.slot.rank === 2) {
          actor.rig.leftArm.rotation.x = -1.6 + Math.sin(elapsedSec * 4) * 0.2;
          actor.rig.rightArm.rotation.x = 0.25;
        } else {
          actor.rig.leftArm.rotation.x = Math.sin(elapsedSec * 3) * 0.12;
          actor.rig.rightArm.rotation.x = 0.25;
        }

        if (actor.crown) {
          actor.crown.rotation.y = elapsedSec * 1.9;
          actor.crown.position.y = actor.slot.targetHeight + 2.38 + Math.sin(elapsedSec * 3.4) * 0.08;
        }
      }

      renderer.render(scene, camera);
      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    frameId = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', handleResize);
      for (const d of disposables) {
        d.dispose();
      }
      disposeObjectTree(scene);
      renderer.dispose();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotKey]);

  const orderedCards = [
    topThree[1] ? { player: topThree[1], rank: 2 as const, label: '2° Plata', border: 'border-slate-300/60', text: 'text-slate-200', badge: 'bg-slate-300 text-slate-950' } : null,
    topThree[0] ? { player: topThree[0], rank: 1 as const, label: '1° Oro · Corona', border: 'border-amber-400/80', text: 'text-amber-300', badge: 'bg-amber-400 text-slate-950' } : null,
    topThree[2] ? { player: topThree[2], rank: 3 as const, label: '3° Bronce', border: 'border-amber-700/80', text: 'text-amber-500', badge: 'bg-amber-600 text-white' } : null,
  ].filter(Boolean);

  return (
    <div className="mt-4 rounded-xl border border-slate-700/80 bg-[#090F1D] overflow-hidden">
      <div ref={mountRef} className="h-52 w-full" />
      <div className="grid grid-cols-3 gap-2 border-t border-slate-800 bg-[#0B1220] p-2.5">
        {orderedCards.map((card) => {
          if (!card) return null;
          const isMe = card.player.id === myId;
          return (
            <div
              key={card.player.id}
              className={`rounded-lg border ${card.border} px-2.5 py-2 text-center ${
                isMe ? 'bg-cyan-500/10' : 'bg-slate-900/70'
              }`}
            >
              <span
                className={`inline-block rounded px-2 py-0.5 font-mono-tab text-[10px] font-bold ${card.badge}`}
              >
                {card.label}
              </span>
              <div className={`mt-1 truncate font-display text-xs font-bold ${card.text}`}>
                {card.player.country ? `${countryCodeToFlag(card.player.country)} ` : ''}
                {card.player.name}
                {isMe ? ' (Tú)' : ''}
              </div>
              <div className="font-mono-tab text-[11px] text-slate-300">
                {card.player.tags} tags · {card.player.score} pts
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
