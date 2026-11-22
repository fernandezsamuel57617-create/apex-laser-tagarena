import {
  ArrowUpCircle,
  Check,
  Coins,
  Crosshair,
  Lock,
  Palette,
  RotateCw,
  Shield,
  Shirt,
  Sparkles,
  Swords,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  createCharacterRig,
  createStandaloneBlasterPreview,
  createStandaloneKnifePreview,
} from '../game/characterModels';
import { disposeObjectTree, isSoftwareGlEnvironment } from '../game/webglUtils';
import { KNIVES, getKnifeById, type KnifeId } from '../shared/knives';
import {
  MAX_OUTFIT_LEVEL,
  OUTFITS,
  getOutfitBonusHp,
  getOutfitById,
  getOutfitLevel,
  getOutfitLevelTitle,
  getOutfitMaxHp,
  getOutfitUpgradeCost,
  type OutfitId,
} from '../shared/outfits';
import type { Gender } from '../shared/types';
import {
  PRIMARY_WEAPONS,
  SIDEARM_WEAPONS,
  getWeaponById,
  type WeaponId,
} from '../shared/weapons';
import {
  WEAPON_SKINS,
  getWeaponSkinById,
  type WeaponSkinId,
} from '../shared/weaponSkins';

export type InventoryTab = 'primaries' | 'sidearms' | 'knives' | 'skins' | 'outfits';

interface InventoryModalProps {
  open: boolean;
  onClose: () => void;
  coins: number;
  infiniteCoins?: boolean;
  gender: Gender;
  playerName: string;
  accentColor: string;
  ownedOutfits: OutfitId[];
  equippedOutfit: OutfitId;
  outfitLevels: Partial<Record<OutfitId, number>>;
  ownedWeapons: WeaponId[];
  equippedWeapon: WeaponId;
  equippedSidearm: WeaponId;
  ownedKnives: KnifeId[];
  equippedKnife: KnifeId;
  ownedWeaponSkins: WeaponSkinId[];
  equippedWeaponSkin: WeaponSkinId;
  onBuyOutfit: (outfitId: OutfitId) => void;
  onEquipOutfit: (outfitId: OutfitId) => void;
  onUpgradeOutfit: (outfitId: OutfitId) => void;
  onBuyWeapon: (weaponId: WeaponId) => void;
  onEquipWeapon: (weaponId: WeaponId) => void;
  onBuyKnife: (knifeId: KnifeId) => void;
  onEquipKnife: (knifeId: KnifeId) => void;
  onBuyWeaponSkin: (skinId: WeaponSkinId) => void;
  onEquipWeaponSkin: (skinId: WeaponSkinId) => void;
}

export function InventoryModal({
  open,
  onClose,
  coins,
  infiniteCoins = false,
  gender,
  playerName,
  accentColor,
  ownedOutfits,
  equippedOutfit,
  outfitLevels,
  ownedWeapons,
  equippedWeapon,
  equippedSidearm,
  ownedKnives,
  equippedKnife,
  ownedWeaponSkins,
  equippedWeaponSkin,
  onBuyOutfit,
  onEquipOutfit,
  onUpgradeOutfit,
  onBuyWeapon,
  onEquipWeapon,
  onBuyKnife,
  onEquipKnife,
  onBuyWeaponSkin,
  onEquipWeaponSkin,
}: InventoryModalProps) {
  const [activeTab, setActiveTab] = useState<InventoryTab>('primaries');
  const [previewOutfitId, setPreviewOutfitId] = useState<OutfitId>(equippedOutfit);
  const [previewWeaponId, setPreviewWeaponId] = useState<WeaponId>(equippedWeapon);
  const [previewSidearmId, setPreviewSidearmId] = useState<WeaponId>(equippedSidearm);
  const [previewKnifeId, setPreviewKnifeId] = useState<KnifeId>(equippedKnife);
  const [previewWeaponSkinId, setPreviewWeaponSkinId] =
    useState<WeaponSkinId>(equippedWeaponSkin);

  const previewHostRef = useRef<HTMLDivElement | null>(null);
  const previewSceneRef = useRef<THREE.Scene | null>(null);
  const previewPivotRef = useRef<THREE.Group | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  useEffect(() => {
    if (open) {
      setPreviewOutfitId(equippedOutfit);
      setPreviewWeaponId(equippedWeapon);
      setPreviewSidearmId(equippedSidearm);
      setPreviewKnifeId(equippedKnife);
      setPreviewWeaponSkinId(equippedWeaponSkin);
    }
  }, [
    open,
    equippedOutfit,
    equippedWeapon,
    equippedSidearm,
    equippedKnife,
    equippedWeaponSkin,
  ]);

  // Isolated 3D WebGL preview renderer lifecycle while modal is open
  useEffect(() => {
    if (!open) return;
    const host = previewHostRef.current;
    if (!host) return;

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

    const width = Math.max(240, host.clientWidth || 280);
    const height = Math.max(220, host.clientHeight || 280);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    previewSceneRef.current = scene;

    const pmrem = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmrem.fromScene(roomEnv, 0.04);
    scene.environment = envTarget.texture;
    roomEnv.dispose();
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 50);
    camera.position.set(0, 0.45, 2.35);
    camera.lookAt(0, 0.1, 0);
    cameraRef.current = camera;

    const hemi = new THREE.HemisphereLight(0x93c5fd, 0x0f172a, 1.0);
    const keyLight = new THREE.DirectionalLight(0xfff4e0, 1.65);
    keyLight.position.set(2.5, 4.2, 3.5);
    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.05);
    rimLight.position.set(-3.0, 2.0, -2.5);
    scene.add(hemi, keyLight, rimLight);

    const pedestalGeo = new THREE.CylinderGeometry(0.78, 0.86, 0.06, 32);
    const pedestalMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.35,
      metalness: 0.75,
    });
    const pedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
    pedestal.position.y = -0.62;
    scene.add(pedestal);

    const ringGeo = new THREE.TorusGeometry(0.8, 0.015, 8, 48);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.59;
    scene.add(ring);

    const pivot = new THREE.Group();
    scene.add(pivot);
    previewPivotRef.current = pivot;

    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let userYaw = 0.65;
    let userPitch = 0.12;

    const onPointerDown = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      userYaw += dx * 0.012;
      userPitch = THREE.MathUtils.clamp(userPitch + dy * 0.008, -0.45, 0.55);
    };
    const onPointerUp = () => {
      dragging = false;
    };

    const domEl = renderer.domElement;
    domEl.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    const onResize = () => {
      if (!host) return;
      const w = Math.max(220, host.clientWidth || 280);
      const h = Math.max(200, host.clientHeight || 280);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    let rafId = 0;
    let timerId = 0;
    let disposed = false;
    const clock = new THREE.Clock();

    const renderLoop = () => {
      if (disposed) return;
      const dt = Math.min(clock.getDelta(), 0.05);
      if (!dragging) {
        userYaw += dt * 0.65;
      }
      if (previewPivotRef.current) {
        previewPivotRef.current.rotation.y = userYaw;
        previewPivotRef.current.rotation.x = userPitch;
      }
      renderer.render(scene, camera);
      if (isSoftwareGl) {
        timerId = window.setTimeout(renderLoop, 80);
      } else {
        rafId = requestAnimationFrame(renderLoop);
      }
    };
    rafId = requestAnimationFrame(renderLoop);

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      clearTimeout(timerId);
      domEl.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('resize', onResize);

      if (previewPivotRef.current) {
        disposeObjectTree(previewPivotRef.current);
        previewPivotRef.current.clear();
      }
      pedestalGeo.dispose();
      pedestalMat.dispose();
      ringGeo.dispose();
      ringMat.dispose();
      envTarget.dispose();
      renderer.dispose();
      if (domEl.parentElement === host) {
        host.removeChild(domEl);
      }
      previewPivotRef.current = null;
      previewSceneRef.current = null;
      cameraRef.current = null;
    };
  }, [open]);

  const previewOutfitLevel = getOutfitLevel(outfitLevels, previewOutfitId);

  // Swap the 3D model inside the preview pivot whenever tab/selection/upgrade changes
  useEffect(() => {
    if (!open) return;
    const pivot = previewPivotRef.current;
    const cam = cameraRef.current;
    if (!pivot || !cam) return;

    while (pivot.children.length > 0) {
      const old = pivot.children[0];
      pivot.remove(old);
      disposeObjectTree(old);
    }

    if (activeTab === 'primaries' || activeTab === 'sidearms' || activeTab === 'skins') {
      const displayWeaponId = activeTab === 'sidearms' ? previewSidearmId : previewWeaponId;
      const blasterModel = createStandaloneBlasterPreview(
        previewWeaponSkinId,
        accentColor,
        displayWeaponId,
      );
      blasterModel.position.y = 0.08;
      pivot.add(blasterModel);
      cam.position.set(0, 0.35, activeTab === 'sidearms' ? 1.85 : 2.05);
      cam.lookAt(0, 0.04, 0);
    } else if (activeTab === 'knives') {
      const knifeModel = createStandaloneKnifePreview(previewKnifeId);
      knifeModel.position.y = 0.06;
      pivot.add(knifeModel);
      cam.position.set(0, 0.3, 1.82);
      cam.lookAt(0, 0.05, 0);
    } else {
      const rig = createCharacterRig(
        gender,
        playerName || 'Agente',
        false,
        accentColor,
        previewOutfitId,
        undefined,
        previewWeaponSkinId,
        previewWeaponId,
        previewOutfitLevel,
        previewKnifeId,
      );
      rig.nameplate.visible = false;
      rig.emoteSprite.visible = false;
      rig.root.scale.setScalar(0.86);
      rig.root.position.set(0, -0.58, 0);
      rig.bodyGroup.rotation.y = Math.PI;
      pivot.add(rig.root);
      cam.position.set(0, 0.55, 2.75);
      cam.lookAt(0, 0.22, 0);
    }
  }, [
    open,
    activeTab,
    previewOutfitId,
    previewOutfitLevel,
    previewWeaponId,
    previewSidearmId,
    previewKnifeId,
    previewWeaponSkinId,
    gender,
    playerName,
    accentColor,
  ]);

  if (!open) return null;

  const selectedOutfit = getOutfitById(previewOutfitId);
  const selectedGun = getWeaponById(
    activeTab === 'sidearms' ? previewSidearmId : previewWeaponId,
  );
  const selectedKnife = getKnifeById(previewKnifeId);
  const selectedSkin = getWeaponSkinById(previewWeaponSkinId);

  const renderGunCards = (weaponsList: typeof PRIMARY_WEAPONS, equippedId: WeaponId, setPreview: (id: WeaponId) => void, previewId: WeaponId) =>
    weaponsList.map((weapon) => {
      const owned = ownedWeapons.includes(weapon.id);
      const equipped = equippedId === weapon.id;
      const isPreviewed = previewId === weapon.id;
      const canAfford = infiniteCoins || coins >= weapon.price;
      const totalDamage = weapon.damage * weapon.pellets;

      return (
        <div
          key={weapon.id}
          onMouseEnter={() => setPreview(weapon.id)}
          onClick={() => setPreview(weapon.id)}
          className={`flex flex-col justify-between rounded-xl border p-3.5 transition-colors cursor-pointer ${
            equipped
              ? 'border-emerald-400/70 bg-emerald-500/10'
              : isPreviewed
                ? 'border-cyan-400/70 bg-slate-900/90'
                : owned
                  ? 'border-slate-700 bg-slate-900/60'
                  : 'border-slate-800 bg-[#0A0F1A]'
          }`}
        >
          <div>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-cyan-300">
                  {weapon.category}
                </div>
                <h3 className="font-display text-sm font-bold text-white">
                  {weapon.name}
                </h3>
              </div>
              <div className="text-xs font-mono-tab font-bold text-amber-300 shrink-0">
                {weapon.price === 0 ? 'Incluida' : `${weapon.price} $`}
              </div>
            </div>

            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              {weapon.description}
            </p>

            {/* Compact Weapon Stats Bars */}
            <div className="mt-3 space-y-1.5 text-[11px]">
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-400 w-16">Daño</span>
                <div className="h-1.5 flex-1 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-rose-400"
                    style={{ width: `${Math.min(100, (totalDamage / 95) * 100)}%` }}
                  />
                </div>
                <span className="font-mono-tab text-slate-200 w-7 text-right">
                  {totalDamage}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-400 w-16">Cadencia</span>
                <div className="h-1.5 flex-1 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-amber-400"
                    style={{
                      width: `${Math.min(100, (1000 / weapon.fireCooldownMs / 9) * 100)}%`,
                    }}
                  />
                </div>
                <span className="font-mono-tab text-slate-200 w-7 text-right">
                  {Math.round(1000 / weapon.fireCooldownMs)}/s
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-400 w-16">Cargador</span>
                <div className="h-1.5 flex-1 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-cyan-400"
                    style={{ width: `${Math.min(100, (weapon.maxAmmo / 36) * 100)}%` }}
                  />
                </div>
                <span className="font-mono-tab text-slate-200 w-7 text-right">
                  {weapon.maxAmmo}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-800/80">
            {equipped ? (
              <div className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/15 py-2 text-xs font-bold text-emerald-300">
                <Check className="h-3.5 w-3.5" />
                <span>Equipada</span>
              </div>
            ) : owned ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setPreview(weapon.id);
                  onEquipWeapon(weapon.id);
                }}
                className="w-full rounded-lg border border-cyan-500/50 bg-cyan-500/15 py-2 text-xs font-bold text-cyan-200 hover:bg-cyan-500/25 transition-colors cursor-pointer"
              >
                Equipar {weapon.slot === 'sidearm' ? 'pistola' : 'arma'}
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setPreview(weapon.id);
                  onBuyWeapon(weapon.id);
                }}
                disabled={!canAfford}
                className={`flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-colors ${
                  canAfford
                    ? 'bg-amber-400 text-slate-950 hover:bg-amber-300 cursor-pointer'
                    : 'border border-slate-800 bg-slate-900 text-slate-500 cursor-not-allowed'
                }`}
              >
                {canAfford ? (
                  <>
                    <Coins className="h-3.5 w-3.5" />
                    <span>Comprar · {weapon.price}</span>
                  </>
                ) : (
                  <>
                    <Lock className="h-3.5 w-3.5" />
                    <span>Faltan {weapon.price - coins}</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      );
    });

  return (
    <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-[#060911]/90 p-2.5 sm:p-4">
      <div className="flex w-full max-w-5xl max-h-[92dvh] flex-col overflow-hidden rounded-xl border border-slate-700 bg-[#0D1320] p-3.5 sm:p-5 md:p-6 shadow-2xl">
        {/* Modal Header */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-800 pb-3 sm:pb-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-cyan-500/40 bg-cyan-500/10 text-cyan-300 shrink-0">
              {activeTab === 'primaries' || activeTab === 'sidearms' ? (
                <Crosshair className="h-5 w-5" />
              ) : activeTab === 'knives' ? (
                <Swords className="h-5 w-5" />
              ) : activeTab === 'skins' ? (
                <Palette className="h-5 w-5" />
              ) : (
                <Shirt className="h-5 w-5" />
              )}
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-base sm:text-xl font-bold text-white">
                Arsenal, Cuchillos y Trajes
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-400 hidden sm:block">
                Lleva 1 arma larga + 1 pistola pequeña + 1 cuchillo (Tecla G) en todos los modos.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
            <div className="flex items-center gap-2 ml-auto sm:ml-0 order-1 sm:order-2">
              <div className="flex items-center gap-1.5 rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-1.5 sm:py-2">
                <Coins className="h-4 w-4 text-amber-400" />
                <span className="font-mono-tab text-sm sm:text-base font-bold text-amber-300">
                  {infiniteCoins ? '∞' : coins}
                </span>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar inventario"
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Category Tabs */}
            <div className="order-2 sm:order-1 flex w-full sm:w-auto items-center overflow-x-auto rounded-lg border border-slate-800 bg-slate-950 p-1 gap-0.5">
              <button
                type="button"
                onClick={() => setActiveTab('primaries')}
                className={`flex min-h-[36px] items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === 'primaries'
                    ? 'bg-cyan-500 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Crosshair className="h-3.5 w-3.5" />
                <span>Armas</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('sidearms')}
                className={`flex min-h-[36px] items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === 'sidearms'
                    ? 'bg-cyan-500 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Pistolas</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('knives')}
                className={`flex min-h-[36px] items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === 'knives'
                    ? 'bg-amber-400 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Swords className="h-3.5 w-3.5" />
                <span>Cuchillos</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('skins')}
                className={`flex min-h-[36px] items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === 'skins'
                    ? 'bg-cyan-500 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Palette className="h-3.5 w-3.5" />
                <span>Skins</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('outfits')}
                className={`flex min-h-[36px] items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === 'outfits'
                    ? 'bg-cyan-500 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Shirt className="h-3.5 w-3.5" />
                <span>Trajes</span>
              </button>
            </div>
          </div>
        </div>

        {/* Main Content: 3D Preview Container (Left) + Catalog Grid (Right) */}
        <div className="mt-3.5 sm:mt-5 flex-1 min-h-0 overflow-y-auto lg:overflow-hidden grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-12">
          {/* Interactive 3D Model Preview Viewport */}
          <div className="lg:col-span-5 flex flex-col justify-between rounded-xl border border-slate-700/80 bg-[#080C16] p-3.5 sm:p-4">
            <div className="flex items-center justify-between text-xs">
              <span className="font-display font-bold uppercase tracking-wider text-cyan-300">
                Vista Previa 3D
              </span>
              <span className="flex items-center gap-1 text-[11px] text-slate-400">
                <RotateCw className="h-3 w-3" />
                Arrastra para rotar
              </span>
            </div>

            <div
              ref={previewHostRef}
              className="touch-none my-2.5 sm:my-3 h-44 sm:h-64 w-full cursor-grab active:cursor-grabbing rounded-lg border border-slate-800/90 bg-gradient-to-b from-[#0E1729] to-[#060911] overflow-hidden"
              aria-label="Contenedor de vista previa 3D"
            />

            {activeTab === 'primaries' || activeTab === 'sidearms' ? (
              <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-cyan-300">
                      {selectedGun.slot === 'sidearm'
                        ? `Pistola Secundaria (Tecla 2) · ${selectedGun.category}`
                        : `Arma Larga (Tecla 1) · ${selectedGun.category}`}
                    </div>
                    <div className="font-display text-base font-bold text-white">
                      {selectedGun.name}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {selectedGun.description}
                    </div>
                  </div>
                  <div className="font-mono-tab text-xs font-bold text-amber-300 shrink-0">
                    {selectedGun.price === 0 ? 'Gratis' : `${selectedGun.price} $`}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 border-t border-slate-800 pt-2 text-center font-mono-tab text-[11px]">
                  <div>
                    <div className="text-slate-400">Daño</div>
                    <div className="font-bold text-rose-300">
                      {selectedGun.damage * selectedGun.pellets}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400">Cargador</div>
                    <div className="font-bold text-cyan-300">{selectedGun.maxAmmo}</div>
                  </div>
                  <div>
                    <div className="text-slate-400">Cadencia</div>
                    <div className="font-bold text-amber-300">
                      {Math.round(1000 / selectedGun.fireCooldownMs)}/s
                    </div>
                  </div>
                </div>
              </div>
            ) : activeTab === 'knives' ? (
              <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-amber-300">
                      Cuchillo Táctico (Tecla G)
                    </div>
                    <div className="font-display text-base font-bold text-white">
                      {selectedKnife.name}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {selectedKnife.description}
                    </div>
                  </div>
                  <div className="font-mono-tab text-xs font-bold text-amber-300 shrink-0">
                    {selectedKnife.price === 0 ? 'Gratis' : `${selectedKnife.price} $`}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 border-t border-slate-800 pt-2 text-center font-mono-tab text-[11px]">
                  <div>
                    <div className="text-slate-400">Daño</div>
                    <div className="font-bold text-rose-300">{selectedKnife.damage}</div>
                  </div>
                  <div>
                    <div className="text-slate-400">Alcance</div>
                    <div className="font-bold text-cyan-300">{selectedKnife.range} m</div>
                  </div>
                  <div>
                    <div className="text-slate-400">Movilidad</div>
                    <div className="font-bold text-emerald-300">
                      +{Math.round(selectedKnife.speedBonus * 100)}%
                    </div>
                  </div>
                </div>
              </div>
            ) : activeTab === 'skins' ? (
              <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-cyan-300">
                      Aplicada sobre {selectedGun.name}
                    </div>
                    <div className="font-display text-base font-bold text-white">
                      {selectedSkin.name}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {selectedSkin.description}
                    </div>
                  </div>
                  <div className="font-mono-tab text-xs font-bold text-amber-300 shrink-0">
                    {selectedSkin.price === 0 ? 'Gratis' : `${selectedSkin.price} $`}
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                      {getOutfitLevelTitle(previewOutfitLevel)} · {getOutfitMaxHp(previewOutfitLevel)} HP
                    </div>
                    <div className="font-display text-base font-bold text-white">
                      {selectedOutfit.name}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {selectedOutfit.description}
                    </div>
                  </div>
                  <div className="font-mono-tab text-xs font-bold text-amber-300 shrink-0">
                    {selectedOutfit.price === 0 ? 'Gratis' : `${selectedOutfit.price} $`}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Items Grid */}
          <div className="lg:col-span-7 grid lg:max-h-[58vh] grid-cols-1 gap-3 lg:overflow-y-auto pr-1 sm:grid-cols-2">
            {activeTab === 'primaries'
              ? renderGunCards(PRIMARY_WEAPONS, equippedWeapon, setPreviewWeaponId, previewWeaponId)
              : activeTab === 'sidearms'
                ? renderGunCards(SIDEARM_WEAPONS, equippedSidearm, setPreviewSidearmId, previewSidearmId)
                : activeTab === 'knives'
                  ? KNIVES.map((knife) => {
                      const owned = ownedKnives.includes(knife.id);
                      const equipped = equippedKnife === knife.id;
                      const isPreviewed = previewKnifeId === knife.id;
                      const canAfford = infiniteCoins || coins >= knife.price;

                      return (
                        <div
                          key={knife.id}
                          onMouseEnter={() => setPreviewKnifeId(knife.id)}
                          onClick={() => setPreviewKnifeId(knife.id)}
                          className={`flex flex-col justify-between rounded-xl border p-3.5 transition-colors cursor-pointer ${
                            equipped
                              ? 'border-emerald-400/70 bg-emerald-500/10'
                              : isPreviewed
                                ? 'border-amber-400/70 bg-slate-900/90'
                                : owned
                                  ? 'border-slate-700 bg-slate-900/60'
                                  : 'border-slate-800 bg-[#0A0F1A]'
                          }`}
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="text-[10px] font-bold uppercase tracking-wider text-amber-300">
                                  Cuerpo a Cuerpo · Tecla G
                                </div>
                                <h3 className="font-display text-sm font-bold text-white">
                                  {knife.name}
                                </h3>
                              </div>
                              <div className="text-xs font-mono-tab font-bold text-amber-300 shrink-0">
                                {knife.price === 0 ? 'Incluido' : `${knife.price} $`}
                              </div>
                            </div>

                            <p className="mt-2 text-xs leading-relaxed text-slate-400">
                              {knife.description}
                            </p>

                            <div className="mt-3 space-y-1.5 text-[11px]">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-slate-400 w-16">Corte</span>
                                <div className="h-1.5 flex-1 rounded-full bg-slate-800 overflow-hidden">
                                  <div
                                    className="h-full bg-rose-400"
                                    style={{ width: `${Math.min(100, (knife.damage / 80) * 100)}%` }}
                                  />
                                </div>
                                <span className="font-mono-tab text-slate-200 w-7 text-right">
                                  {knife.damage}
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-slate-400 w-16">Velocidad</span>
                                <div className="h-1.5 flex-1 rounded-full bg-slate-800 overflow-hidden">
                                  <div
                                    className="h-full bg-emerald-400"
                                    style={{
                                      width: `${Math.min(100, (knife.speedBonus / 0.25) * 100)}%`,
                                    }}
                                  />
                                </div>
                                <span className="font-mono-tab text-slate-200 w-7 text-right">
                                  +{Math.round(knife.speedBonus * 100)}%
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="mt-3 pt-2.5 border-t border-slate-800/80">
                            {equipped ? (
                              <div className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/15 py-2 text-xs font-bold text-emerald-300">
                                <Check className="h-3.5 w-3.5" />
                                <span>Cuchillo equipado</span>
                              </div>
                            ) : owned ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPreviewKnifeId(knife.id);
                                  onEquipKnife(knife.id);
                                }}
                                className="w-full rounded-lg border border-amber-400/50 bg-amber-500/15 py-2 text-xs font-bold text-amber-200 hover:bg-amber-500/25 transition-colors cursor-pointer"
                              >
                                Equipar cuchillo
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPreviewKnifeId(knife.id);
                                  onBuyKnife(knife.id);
                                }}
                                disabled={!canAfford}
                                className={`flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-colors ${
                                  canAfford
                                    ? 'bg-amber-400 text-slate-950 hover:bg-amber-300 cursor-pointer'
                                    : 'border border-slate-800 bg-slate-900 text-slate-500 cursor-not-allowed'
                                }`}
                              >
                                {canAfford ? (
                                  <>
                                    <Coins className="h-3.5 w-3.5" />
                                    <span>Comprar · {knife.price}</span>
                                  </>
                                ) : (
                                  <>
                                    <Lock className="h-3.5 w-3.5" />
                                    <span>Faltan {knife.price - coins}</span>
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
              : activeTab === 'skins'
                ? WEAPON_SKINS.map((skin) => {
                    const owned = ownedWeaponSkins.includes(skin.id);
                    const equipped = equippedWeaponSkin === skin.id;
                    const isPreviewed = previewWeaponSkinId === skin.id;
                    const canAfford = infiniteCoins || coins >= skin.price;

                    return (
                      <div
                        key={skin.id}
                        onMouseEnter={() => setPreviewWeaponSkinId(skin.id)}
                        onClick={() => setPreviewWeaponSkinId(skin.id)}
                        className={`flex flex-col justify-between rounded-xl border p-3.5 transition-colors cursor-pointer ${
                          equipped
                            ? 'border-emerald-400/70 bg-emerald-500/10'
                            : isPreviewed
                              ? 'border-cyan-400/70 bg-slate-900/90'
                              : owned
                                ? 'border-slate-700 bg-slate-900/60'
                                : 'border-slate-800 bg-[#0A0F1A]'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-700 bg-slate-950">
                              <span
                                className="h-3 w-6 rounded-xs border border-white/20"
                                style={{
                                  background: `linear-gradient(90deg, ${skin.bodyHex} 45%, ${skin.coreHex} 100%)`,
                                }}
                              />
                            </div>
                            <div>
                              <h3 className="font-display text-sm font-bold text-white">
                                {skin.name}
                              </h3>
                              <div className="text-xs font-mono-tab text-amber-300">
                                {skin.price === 0 ? 'Incluido' : `${skin.price} monedas`}
                              </div>
                            </div>
                          </div>

                          <p className="mt-2.5 text-xs leading-relaxed text-slate-400">
                            {skin.description}
                          </p>

                          <div className="mt-2.5 flex items-center gap-2 text-[11px] text-slate-400">
                            <span
                              className="inline-block h-2.5 w-2.5 rounded-xs border border-white/20"
                              style={{ backgroundColor: skin.bodyHex }}
                            />
                            <span
                              className="inline-block h-2.5 w-2.5 rounded-xs border border-white/20"
                              style={{ backgroundColor: skin.railHex }}
                            />
                            <span
                              className="inline-block h-2.5 w-2.5 rounded-xs border border-white/20"
                              style={{ backgroundColor: skin.coreHex }}
                            />
                            <span>Núcleo láser</span>
                          </div>
                        </div>

                        <div className="mt-3 pt-2.5 border-t border-slate-800/80">
                          {equipped ? (
                            <div className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/15 py-2 text-xs font-bold text-emerald-300">
                              <Check className="h-3.5 w-3.5" />
                              <span>Skin equipada</span>
                            </div>
                          ) : owned ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPreviewWeaponSkinId(skin.id);
                                onEquipWeaponSkin(skin.id);
                              }}
                              className="w-full rounded-lg border border-cyan-500/50 bg-cyan-500/15 py-2 text-xs font-bold text-cyan-200 hover:bg-cyan-500/25 transition-colors cursor-pointer"
                            >
                              Equipar skin
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPreviewWeaponSkinId(skin.id);
                                onBuyWeaponSkin(skin.id);
                              }}
                              disabled={!canAfford}
                              className={`flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-colors ${
                                canAfford
                                  ? 'bg-amber-400 text-slate-950 hover:bg-amber-300 cursor-pointer'
                                  : 'border border-slate-800 bg-slate-900 text-slate-500 cursor-not-allowed'
                              }`}
                            >
                              {canAfford ? (
                                <>
                                  <Coins className="h-3.5 w-3.5" />
                                  <span>Comprar · {skin.price}</span>
                                </>
                              ) : (
                                <>
                                  <Lock className="h-3.5 w-3.5" />
                                  <span>Faltan {skin.price - coins}</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                : OUTFITS.map((outfit) => {
                    const owned = ownedOutfits.includes(outfit.id);
                    const equipped = equippedOutfit === outfit.id;
                    const isPreviewed = previewOutfitId === outfit.id;
                    const canAfford = infiniteCoins || coins >= outfit.price;
                    const level = getOutfitLevel(outfitLevels, outfit.id);
                    const upgradeCost = getOutfitUpgradeCost(level);
                    const canUpgrade = owned && upgradeCost !== null && (infiniteCoins || coins >= upgradeCost);
                    const bonusHp = getOutfitBonusHp(level);

                    return (
                      <div
                        key={outfit.id}
                        onMouseEnter={() => setPreviewOutfitId(outfit.id)}
                        onClick={() => setPreviewOutfitId(outfit.id)}
                        className={`flex flex-col justify-between rounded-xl border p-3.5 transition-colors cursor-pointer ${
                          equipped
                            ? 'border-emerald-400/70 bg-emerald-500/10'
                            : isPreviewed
                              ? 'border-cyan-400/70 bg-slate-900/90'
                              : owned
                                ? 'border-slate-700 bg-slate-900/60'
                                : 'border-slate-800 bg-[#0A0F1A]'
                        }`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2.5">
                              <div
                                className="relative flex h-10 w-10 flex-col items-center justify-center rounded-lg border border-slate-700 bg-slate-950 overflow-hidden shrink-0"
                                aria-hidden="true"
                              >
                                <span
                                  className="h-2 w-5 rounded-xs border border-black/30"
                                  style={{
                                    backgroundColor: outfit.hasVisor ? outfit.trimHex : '#7a4b31',
                                  }}
                                />
                                <span
                                  className="mt-0.5 h-3.5 w-6 rounded-xs border border-black/30"
                                  style={{ backgroundColor: outfit.topHex }}
                                />
                                <span
                                  className="mt-0.5 h-2.5 w-4 rounded-xs border border-black/30"
                                  style={{ backgroundColor: outfit.pantsHex }}
                                />
                              </div>

                              <div>
                                <h3 className="font-display text-sm font-bold text-white">
                                  {outfit.name}
                                </h3>
                                <div className="text-xs font-mono-tab text-amber-300">
                                  {outfit.price === 0 ? 'Incluido' : `${outfit.price} monedas`}
                                </div>
                              </div>
                            </div>

                            {owned && (
                              <span className="rounded border border-cyan-500/40 bg-cyan-500/15 px-1.5 py-0.5 font-mono-tab text-[10px] font-bold text-cyan-200 shrink-0">
                                Nv.{level}/{MAX_OUTFIT_LEVEL}
                              </span>
                            )}
                          </div>

                          <p className="mt-2 text-xs leading-relaxed text-slate-400">
                            {outfit.description}
                          </p>

                          {/* Upgrade Level Progress & Shield Bonus */}
                          <div className="mt-2.5 flex items-center justify-between text-[11px]">
                            <span className="flex items-center gap-1 text-emerald-300 font-semibold">
                              <Shield className="h-3 w-3" />
                              {100 + bonusHp} HP máx
                              {bonusHp > 0 ? ` (+${bonusHp})` : ''}
                            </span>
                            <div className="flex items-center gap-1">
                              {[1, 2, 3, 4].map((step) => (
                                <span
                                  key={step}
                                  className={`h-1.5 w-4 rounded-xs ${
                                    step <= level ? 'bg-amber-400' : 'bg-slate-800'
                                  }`}
                                />
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 pt-2.5 border-t border-slate-800/80 space-y-2">
                          {equipped ? (
                            <div className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/15 py-1.5 text-xs font-bold text-emerald-300">
                              <Check className="h-3.5 w-3.5" />
                              <span>Traje equipado</span>
                            </div>
                          ) : owned ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPreviewOutfitId(outfit.id);
                                onEquipOutfit(outfit.id);
                              }}
                              className="w-full rounded-lg border border-cyan-500/50 bg-cyan-500/15 py-1.5 text-xs font-bold text-cyan-200 hover:bg-cyan-500/25 transition-colors cursor-pointer"
                            >
                              Equipar traje
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPreviewOutfitId(outfit.id);
                                onBuyOutfit(outfit.id);
                              }}
                              disabled={!canAfford}
                              className={`flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-colors ${
                                canAfford
                                  ? 'bg-amber-400 text-slate-950 hover:bg-amber-300 cursor-pointer'
                                  : 'border border-slate-800 bg-slate-900 text-slate-500 cursor-not-allowed'
                              }`}
                            >
                              {canAfford ? (
                                <>
                                  <Coins className="h-3.5 w-3.5" />
                                  <span>Comprar traje · {outfit.price}</span>
                                </>
                              ) : (
                                <>
                                  <Lock className="h-3.5 w-3.5" />
                                  <span>Faltan {outfit.price - coins}</span>
                                </>
                              )}
                            </button>
                          )}

                          {/* Coin-Based Suit Upgrade Button */}
                          {owned && (
                            upgradeCost !== null ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPreviewOutfitId(outfit.id);
                                  onUpgradeOutfit(outfit.id);
                                }}
                                disabled={!canUpgrade}
                                className={`flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-[11px] font-bold transition-colors ${
                                  canUpgrade
                                    ? 'border border-amber-400/70 bg-amber-400/15 text-amber-200 hover:bg-amber-400/25 cursor-pointer'
                                    : 'border border-slate-800 bg-slate-900 text-slate-500 cursor-not-allowed'
                                }`}
                              >
                                <ArrowUpCircle className="h-3.5 w-3.5" />
                                <span>
                                  {canUpgrade
                                    ? `Mejorar a Nv.${level + 1} (+10 HP) · ${upgradeCost} $`
                                    : `Mejorar Nv.${level + 1} · Faltan ${upgradeCost - coins} $`}
                                </span>
                              </button>
                            ) : (
                              <div className="flex w-full items-center justify-center gap-1 rounded-lg border border-purple-500/40 bg-purple-500/15 py-1.5 text-[11px] font-bold text-purple-200">
                                <span>Traje al Máximo (Nv. 4 · +30 HP)</span>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    );
                  })}
          </div>
        </div>
      </div>
    </div>
  );
}
