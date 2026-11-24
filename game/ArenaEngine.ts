import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { soundEngine } from '../audio/soundEngine';
import {
  ARENA_HALF_SIZE,
  LOBBY_BOXES,
  LOBBY_CENTER_Z,
  LOBBY_FLOOR_Y,
  LOBBY_HALF_SIZE,
  LOBBY_START_PAD,
  MOVE_SPEED,
  OBBY_FINISH_PAD,
  PLAYER_EYE_HEIGHT,
  SPRINT_SPEED_MULTIPLIER,
  getMapConfig,
  getZoneBoxes,
  raycastZoneGeometry,
  resolvePlayerMovement,
} from '../shared/arenaData';
import type { EmoteId } from '../shared/emotes';
import { getKnifeById, type KnifeId } from '../shared/knives';
import { getOutfitLevel, type OutfitId } from '../shared/outfits';
import type { GraphicsQuality } from '../shared/playerSettings';
import { getWeaponById, isSidearmWeapon, type WeaponId } from '../shared/weapons';
import { getWeaponSkinById, type WeaponSkinId } from '../shared/weaponSkins';
import type {
  ArenaDropSnapshot,
  ArenaMapId,
  ArenaMeteorSnapshot,
  BoostPadSnapshot,
  GamePhase,
  Gender,
  LaserBeamEvent,
  ServerStatePayload,
  Vec3,
  WeaponSlot,
  ZoneId,
} from '../shared/types';
import {
  createCharacterRig,
  createFirstPersonArms,
  createFirstPersonBlaster,
  createFirstPersonKnife,
  type BlasterViewmodel,
  type CharacterRig,
  type FirstPersonArmsViewmodel,
  type KnifeViewmodel,
} from './characterModels';
import {
  createArenaFloorTexture,
  createPanelWallTexture,
  createPortalSignSprite,
  getEmoteTexture,
} from './proceduralAssets';
import { disposeObjectTree, isSoftwareGlEnvironment } from './webglUtils';

// Pre-allocated scratch math helpers (zero GC in render loop)
const _vec3A = new THREE.Vector3();
const _vec3B = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _quat = new THREE.Quaternion();
const _euler = new THREE.Euler(0, 0, 0, 'YXZ');

interface RemoteActor {
  id: string;
  rig: CharacterRig;
  targetPos: THREE.Vector3;
  targetYaw: number;
  currentPos: THREE.Vector3;
  currentYaw: number;
  lastGender: string;
  lastName: string;
  lastAccent: string;
  lastOutfit: OutfitId;
  lastOutfitLevel: number;
  lastWeapon: WeaponId;
  lastWeaponSkin: WeaponSkinId;
  lastKnife: KnifeId;
  lastCountry?: string;
  activeEmote: EmoteId | null;
  activeEmoteUntil: number;
  isSliding: boolean;
  isCrouching: boolean;
}

interface ActiveBeam {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  bornAt: number;
  lifeMs: number;
}

interface SparkParticle {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  bornAt: number;
  lifeMs: number;
  active: boolean;
}

export interface WeaponHudState {
  weaponId: WeaponId;
  activeSlot: WeaponSlot;
  primaryWeaponId: WeaponId;
  sidearmWeaponId: WeaponId;
  knifeId: KnifeId;
  isAiming: boolean;
  ammo: number;
  maxAmmo: number;
  primaryAmmo: number;
  primaryMaxAmmo: number;
  sidearmAmmo: number;
  sidearmMaxAmmo: number;
  isReloading: boolean;
  reloadProgress: number;
  sprintEnergy: number;
  isSprinting: boolean;
  isSliding: boolean;
  isCrouching: boolean;
  canFly: boolean;
  zone: ZoneId;
}

export interface EngineCallbacks {
  onSendMove: (
    x: number,
    y: number,
    z: number,
    yaw: number,
    pitch: number,
    sliding: boolean,
    crouching: boolean,
    zone: ZoneId,
  ) => void;
  onSendShoot: (origin: Vec3, dir: Vec3) => void;
  onSendMeleeSlash?: (origin: Vec3, dir: Vec3) => void;
  onSendSwitchSlot?: (slot: WeaponSlot) => void;
  onSendReload: () => void;
  onWeaponStateChange: (weapon: WeaponHudState) => void;
  onPointerLockChange: (locked: boolean) => void;
  onTouchModeChange?: (isTouch: boolean) => void;
  onWebGLStatus: (ok: boolean) => void;
}

export class ArenaEngine {
  private container: HTMLElement;
  private callbacks: EngineCallbacks;
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private isSoftwareGl = false;
  private frameId = 0;
  private disposed = false;

  private lobbyGroup = new THREE.Group();
  private arenaGroup = new THREE.Group();
  private dynamicGroup = new THREE.Group();

  private hemiLight!: THREE.HemisphereLight;
  private keyLight!: THREE.DirectionalLight;
  private rimLight!: THREE.DirectionalLight;
  private envTexture: THREE.Texture | null = null;
  private darkAuraLight!: THREE.PointLight;
  private darkFlashlight!: THREE.SpotLight;
  private darkHideAndSeek = false;
  private infiniteEnergy = false;
  private biomeParticles: THREE.Points | null = null;
  private biomeParticleMode: 'none' | 'snow' | 'embers' | 'dust' | 'stars' = 'none';
  private biomeOrbitGroup: THREE.Object3D | null = null;

  private blaster!: BlasterViewmodel;
  private knifeView!: KnifeViewmodel;
  private fpArms!: FirstPersonArmsViewmodel;
  private remoteActors = new Map<string, RemoteActor>();
  private boostPadMeshes = new Map<string, THREE.Group>();
  private dropMeshes = new Map<
    string,
    { group: THREE.Group; kind: ArenaDropSnapshot['kind']; baseY: number }
  >();
  private meteorMeshes = new Map<
    string,
    { group: THREE.Group; core: THREE.Mesh; ring: THREE.Mesh; landY: number }
  >();
  private startPortalRing!: THREE.Mesh;
  private obbyFinishRing!: THREE.Mesh;
  private centerBeaconCore!: THREE.Mesh;

  private activeBeams: ActiveBeam[] = [];
  private sparkPool: SparkParticle[] = [];

  // Local player simulation state
  private activeMode: 'preview' | 'play' = 'preview';
  private localPlayerId: string | null = null;
  private currentPhase: GamePhase = 'lobby';
  private currentZone: ZoneId = 'lobby';
  private currentMapId: ArenaMapId = 'neon_reactor';
  private localPos = new THREE.Vector3(0, LOBBY_FLOOR_Y, LOBBY_CENTER_Z - 8);
  private localVelY = 0;
  private localGrounded = true;
  private localYaw = Math.PI;
  private localPitch = 0;
  private localAlive = true;
  private localBoosted = false;
  private canFly = false;
  private speedBoosted = false;
  private infiniteAmmo = false;
  private lowGravityActive = false;
  private turboArenaActive = false;
  private superJumpActive = false;
  private bigHeadsActive = false;
  private iceFloorActive = false;
  private rainbowChaosActive = false;
  private iceVelX = 0;
  private iceVelZ = 0;
  private localAccent = '#06B6D4';
  private localGender: Gender = 'male';
  private localOutfit: OutfitId = 'default';
  private activeSlot: WeaponSlot = 'primary';
  private previousGunSlot: 'primary' | 'sidearm' = 'primary';
  private localPrimaryWeapon: WeaponId = 'pulse_carbine';
  private localSidearmWeapon: WeaponId = 'tactical_pistol';
  private localKnife: KnifeId = 'tactical_blade';
  private localWeapon: WeaponId = 'pulse_carbine';
  private localWeaponSkin: WeaponSkinId = 'default';
  private deathCamKillerId: string | null = null;
  private deathCamUntil = 0;
  private arenaDisposables: Array<{ dispose: () => void }> = [];
  private arenaTrimEntries: Array<{ mat: THREE.MeshStandardMaterial; baseIntensity: number }> = [];
  private arenaSceneryGroup: THREE.Group | null = null;
  private arenaBeaconMat: THREE.MeshStandardMaterial | null = null;
  private boostPadMatList: THREE.MeshStandardMaterial[] = [];

  // Feel, sprint energy & kinematics
  private heldKeys = new Set<string>();
  private jumpBufferUntil = 0;
  private coyoteUntil = 0;
  private lastShotAt = 0;
  private lastMeleeAt = 0;
  private knifeSlashStartAt = 0;
  private knifeSlashEndAt = 0;
  private isFiringHeld = false;
  private blasterRecoil = 0;
  private muzzleFlashUntil = 0;
  private cameraShake = 0;
  private hitstopUntil = 0;
  private walkBobPhase = 0;
  private armVisibilityAlpha = 0;
  private isWalkingNow = false;
  private sprintEnergy = 100;
  private sprintExhausted = false;
  private lastSprintAt = 0;
  private isSprintingNow = false;
  private slideUntil = 0;
  private slideCooldownUntil = 0;
  private slideDirX = 0;
  private slideDirZ = 0;
  private currentEyeHeight = PLAYER_EYE_HEIGHT;
  private cameraRoll = 0;
  private lastSentSlidingState = false;
  private lastSentCrouchingState = false;
  private lastNetworkSyncAt = 0;
  private isPointerLocked = false;
  private pointerLockSuppressed = false;
  private isDraggingLook = false;
  private isRightMouseAiming = false;
  private lastMouseX = 0;
  private lastMouseY = 0;
  private inputMode: 'mouse' | 'touch' = 'mouse';
  private lastTouchEventAt = 0;
  private touchLookId: number | null = null;
  private lastTouchLookX = 0;
  private lastTouchLookY = 0;
  private touchMoveForward = 0;
  private touchMoveStrafe = 0;
  private touchFiring = false;
  private touchAiming = false;
  private touchSprinting = false;
  private touchCrouching = false;
  private lookSensitivity = 1.0;
  private graphicsQuality: GraphicsQuality = 'high';

  // Aiming (ADS) & Laser Ammo / Reload
  private aimAlpha = 0;
  private reloadAlpha = 0;
  private localAmmo = 12;
  private localMaxAmmo = 12;
  private primaryAmmo = 12;
  private primaryMaxAmmo = 12;
  private sidearmAmmo = 10;
  private sidearmMaxAmmo = 10;
  private localReloadStartAt = 0;
  private localReloadEndAt = 0;
  private lastEmptyClickAt = 0;
  private lastHudWeaponPushAt = 0;
  private lastSentAiming = false;
  private lastSentAmmo = -1;
  private lastSentMaxAmmo = -1;
  private lastSentWeapon: WeaponId = 'pulse_carbine';
  private lastSentSlot: WeaponSlot = 'primary';
  private lastSentKnife: KnifeId = 'tactical_blade';
  private lastSentPrimaryWeapon: WeaponId = 'pulse_carbine';
  private lastSentSidearmWeapon: WeaponId = 'tactical_pistol';
  private lastSentPrimaryAmmo = 12;
  private lastSentSidearmAmmo = 10;
  private lastSentReloading = false;
  private lastSentSprintEnergy = 100;
  private lastSentSprinting = false;
  private lastSentSliding = false;
  private lastSentCrouching = false;
  private lastSentCanFly = false;
  private lastSentZone: ZoneId = 'lobby';

  private clock = new THREE.Clock();
  private disposables: Array<{ dispose: () => void }> = [];

  constructor(container: HTMLElement, callbacks: EngineCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    if (!this.initRenderer()) {
      return;
    }
    this.initScene();
    this.buildLobbyWorld();
    this.rebuildCombatArena(this.currentMapId);
    this.initSparkPool();
    this.detectInitialInputMode();
    this.bindEvents();
    this.startLoop();
  }

  private detectInitialInputMode() {
    if (typeof window === 'undefined') return;
    const coarse = window.matchMedia?.('(pointer: coarse)')?.matches ?? false;
    const hasTouch = 'ontouchstart' in window || (navigator.maxTouchPoints ?? 0) > 0;
    this.setInputMode(coarse && hasTouch ? 'touch' : 'mouse');
  }

  private setInputMode(mode: 'mouse' | 'touch') {
    if (this.inputMode === mode) return;
    this.inputMode = mode;
    this.callbacks.onTouchModeChange?.(mode === 'touch');
  }

  public isTouchInputMode(): boolean {
    return this.inputMode === 'touch';
  }

  public setTouchMoveVector(strafe: number, forward: number) {
    this.setInputMode('touch');
    this.lastTouchEventAt = performance.now();
    this.touchMoveStrafe = THREE.MathUtils.clamp(strafe, -1, 1);
    this.touchMoveForward = THREE.MathUtils.clamp(forward, -1, 1);
  }

  public setTouchFiring(firing: boolean) {
    this.setInputMode('touch');
    this.lastTouchEventAt = performance.now();
    this.touchFiring = firing;
    if (firing && this.activeMode === 'play' && (this.currentZone === 'arena' || this.activeSlot === 'knife')) {
      this.tryShoot();
    }
  }

  public triggerTouchJump() {
    this.setInputMode('touch');
    this.lastTouchEventAt = performance.now();
    if (this.activeMode === 'play') {
      this.jumpBufferUntil = performance.now() + 140;
    }
  }

  public triggerTouchSlide() {
    this.setInputMode('touch');
    this.lastTouchEventAt = performance.now();
    this.triggerSlide();
  }

  public setTouchAiming(aiming: boolean) {
    this.setInputMode('touch');
    this.lastTouchEventAt = performance.now();
    this.touchAiming = aiming;
  }

  public setTouchSprinting(sprinting: boolean) {
    this.setInputMode('touch');
    this.lastTouchEventAt = performance.now();
    this.touchSprinting = sprinting;
  }

  public setTouchCrouching(crouching: boolean) {
    this.setInputMode('touch');
    this.lastTouchEventAt = performance.now();
    this.touchCrouching = crouching;
  }

  public teleportTo(zone: ZoneId, x: number, y: number, z: number, yaw: number) {
    const zoneChanged = this.currentZone !== zone;
    this.currentZone = zone;
    this.localPos.set(x, y, z);
    this.localYaw = yaw;
    this.localPitch = 0;
    this.localVelY = 0;
    this.iceVelX = 0;
    this.iceVelZ = 0;
    this.slideUntil = 0;
    this.localGrounded = !this.canFly && y <= (zone === 'lobby' ? LOBBY_FLOOR_Y + 0.05 : 0.05);
    this.lobbyGroup.visible = this.currentZone === 'lobby';
    this.arenaGroup.visible = this.currentZone === 'arena';
    if (zoneChanged) {
      this.applyZoneAtmosphere();
    }
    this.camera.position.set(x, y + this.currentEyeHeight, z);
    _euler.set(this.localPitch, this.localYaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(_euler);
    this.callbacks.onSendMove(x, y, z, yaw, 0, false, false, zone);
  }

  private initRenderer(): boolean {
    this.isSoftwareGl = isSoftwareGlEnvironment();

    try {
      this.renderer = new THREE.WebGLRenderer({
        antialias: !this.isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      this.callbacks.onWebGLStatus(false);
      return false;
    }

    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.setPixelRatio(this.getTargetPixelRatio());
    this.renderer.shadowMap.enabled = !this.isSoftwareGl && this.graphicsQuality !== 'low';
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(this.container.clientWidth || window.innerWidth, this.container.clientHeight || window.innerHeight);

    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.touchAction = 'none';
    this.container.appendChild(this.renderer.domElement);

    this.renderer.domElement.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.callbacks.onWebGLStatus(false);
    });
    this.renderer.domElement.addEventListener('webglcontextrestored', () => {
      this.callbacks.onWebGLStatus(true);
    });
    return true;
  }

  private initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x080c14);
    this.scene.fog = new THREE.FogExp2(0x080c14, 0.0072);

    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(74, w / h, 0.08, 280);
    this.scene.add(this.camera);

    // Studio environment reflection via PMREMGenerator + RoomEnvironment
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmrem.fromScene(roomEnv, 0.04);
    this.envTexture = envTarget.texture;
    this.scene.environment = this.envTexture;
    this.disposables.push(envTarget);
    roomEnv.dispose();
    pmrem.dispose();

    // 3-Point Stadium Lighting Rig (1 shadow-casting warm key + cool hemi + rim fill)
    this.hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x0f172a, 0.9);
    this.scene.add(this.hemiLight);

    this.keyLight = new THREE.DirectionalLight(0xfff4e0, 1.45);
    this.keyLight.position.set(22, 46, 10);
    this.keyLight.castShadow = !this.isSoftwareGl;
    this.keyLight.shadow.mapSize.set(1024, 1024);
    this.keyLight.shadow.camera.near = 2;
    this.keyLight.shadow.camera.far = 160;
    const d = 68;
    this.keyLight.shadow.camera.left = -d;
    this.keyLight.shadow.camera.right = d;
    this.keyLight.shadow.camera.top = d;
    this.keyLight.shadow.camera.bottom = -d;
    this.keyLight.shadow.bias = -0.0005;
    this.keyLight.shadow.normalBias = 0.02;
    this.scene.add(this.keyLight);

    this.rimLight = new THREE.DirectionalLight(0x38bdf8, 0.65);
    this.rimLight.position.set(-28, 24, -60);
    this.scene.add(this.rimLight);

    // Personal mini light bubble & short flashlight cone for Dark Hide & Seek mode (Three.js r187 physical units)
    this.darkAuraLight = new THREE.PointLight(0xdbeafe, 0, 14, 1.1);
    this.darkAuraLight.position.set(0, -0.1, 0);
    this.camera.add(this.darkAuraLight);

    this.darkFlashlight = new THREE.SpotLight(0xf0f9ff, 0, 18, Math.PI / 3.2, 0.72, 1.0);
    this.darkFlashlight.position.set(0, -0.06, -0.1);
    this.darkFlashlight.target.position.set(0, -0.15, -6);
    this.camera.add(this.darkFlashlight);
    this.camera.add(this.darkFlashlight.target);

    // First-person Blaster attached to camera (Arena only)
    this.blaster = createFirstPersonBlaster(this.localAccent, this.localWeaponSkin, this.localWeapon);
    this.blaster.group.position.set(0.27, -0.24, -0.34);
    this.blaster.group.visible = false;
    this.camera.add(this.blaster.group);

    // First-person Melee Knife attached to camera (Lobby & Arena when equipped via G)
    this.knifeView = createFirstPersonKnife(this.localKnife);
    this.knifeView.group.position.set(0.29, -0.26, -0.36);
    this.knifeView.group.visible = false;
    this.camera.add(this.knifeView.group);

    // First-person Arms Viewmodel attached to camera (Lobby walking-only)
    this.fpArms = createFirstPersonArms(this.localGender, this.localOutfit);
    this.fpArms.group.visible = false;
    this.camera.add(this.fpArms.group);

    this.scene.add(this.lobbyGroup);
    this.scene.add(this.arenaGroup);
    this.scene.add(this.dynamicGroup);

    // Hide the Combat Arena while players are inside the Lobby / Obby
    this.lobbyGroup.visible = true;
    this.arenaGroup.visible = false;

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }
  }

  private buildBoxesIntoGroup(
    targetGroup: THREE.Group,
    boxes: typeof LOBBY_BOXES,
    panelTex: THREE.CanvasTexture,
    tracker: Array<{ dispose: () => void }> = this.disposables,
    surfaceTheme?: {
      wallHex?: string;
      platformHex?: string;
      wallRoughness?: number;
      wallMetalness?: number;
    },
  ) {
    const baseWallMat = new THREE.MeshStandardMaterial({
      map: panelTex,
      color: surfaceTheme?.wallHex ? new THREE.Color(surfaceTheme.wallHex) : 0x1e293b,
      roughness: surfaceTheme?.wallRoughness ?? 0.55,
      metalness: surfaceTheme?.wallMetalness ?? 0.45,
    });
    const platformMat = new THREE.MeshStandardMaterial({
      map: panelTex,
      color: surfaceTheme?.platformHex ? new THREE.Color(surfaceTheme.platformHex) : 0x162235,
      roughness: Math.max(0.18, (surfaceTheme?.wallRoughness ?? 0.42) - 0.08),
      metalness: Math.min(0.85, (surfaceTheme?.wallMetalness ?? 0.58) + 0.08),
    });
    const obbyMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.35,
      metalness: 0.65,
    });
    tracker.push(baseWallMat, platformMat, obbyMat);

    for (const box of boxes) {
      const w = box.maxX - box.minX;
      const h = box.maxY - box.minY;
      const d = box.maxZ - box.minZ;
      const cx = (box.minX + box.maxX) / 2;
      const cy = (box.minY + box.maxY) / 2;
      const cz = (box.minZ + box.maxZ) / 2;

      const geo = new THREE.BoxGeometry(w, h, d);
      const mat =
        box.kind === 'obby'
          ? obbyMat
          : box.kind === 'platform'
            ? platformMat
            : baseWallMat;

      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(cx, cy, cz);
      mesh.castShadow = box.kind !== 'wall';
      mesh.receiveShadow = true;
      targetGroup.add(mesh);
      tracker.push(geo);

      // Add crisp neon trim strip on cover, platforms, obby, and beacons
      if (box.accent) {
        const trimColor = new THREE.Color(box.accent);
        const trimMat = new THREE.MeshStandardMaterial({
          color: trimColor,
          emissive: trimColor,
          emissiveIntensity: 1.5,
          roughness: 0.2,
          metalness: 0.3,
        });
        tracker.push(trimMat);
        if (targetGroup === this.arenaGroup) {
          this.arenaTrimEntries.push({ mat: trimMat, baseIntensity: 1.5 });
        }

        if (box.kind === 'obby' || box.kind === 'platform') {
          const trimGeo = new THREE.BoxGeometry(w + 0.04, 0.08, d + 0.04);
          const trim = new THREE.Mesh(trimGeo, trimMat);
          trim.position.set(cx, box.maxY - 0.04, cz);
          targetGroup.add(trim);
          tracker.push(trimGeo);
        } else if (box.kind === 'wall') {
          const stripW = w > d ? w - 1 : 0.14;
          const stripD = d > w ? d - 1 : 0.14;
          const stripGeo = new THREE.BoxGeometry(stripW, 0.16, stripD);
          const strip = new THREE.Mesh(stripGeo, trimMat);
          strip.position.set(cx, box.minY + Math.min(2.4, h * 0.72), cz);
          targetGroup.add(strip);
          tracker.push(stripGeo);
        } else {
          const capGeo = new THREE.BoxGeometry(w + 0.05, 0.1, d + 0.05);
          const cap = new THREE.Mesh(capGeo, trimMat);
          cap.position.set(cx, box.maxY - 0.12, cz);
          targetGroup.add(cap);
          tracker.push(capGeo);
        }
      }
    }
  }

  private buildLobbyWorld() {
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    const floorTex = createArenaFloorTexture(maxAniso, '#1e3a5f', '#10b981');
    floorTex.repeat.set(16, 16);
    const panelTex = createPanelWallTexture(maxAniso);
    this.disposables.push(floorTex, panelTex);

    const floorGeo = new THREE.PlaneGeometry(LOBBY_HALF_SIZE * 2, LOBBY_HALF_SIZE * 2);
    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTex,
      roughness: 0.55,
      metalness: 0.25,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, LOBBY_FLOOR_Y + 0.02, LOBBY_CENTER_Z);
    floor.receiveShadow = true;
    this.lobbyGroup.add(floor);
    this.disposables.push(floorGeo, floorMat);

    this.buildBoxesIntoGroup(this.lobbyGroup, LOBBY_BOXES, panelTex);

    // Glowing Start Gate Archway over the External Lobby Start Dais
    const archMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x10b981,
      emissiveIntensity: 1.8,
      roughness: 0.2,
      metalness: 0.4,
    });
    const archTop = new THREE.Mesh(new THREE.BoxGeometry(9.3, 0.55, 0.9), archMat);
    archTop.position.set(0, LOBBY_FLOOR_Y + 4.35, LOBBY_START_PAD.z);
    this.lobbyGroup.add(archTop);
    this.disposables.push(archMat, archTop.geometry);

    this.startPortalRing = new THREE.Mesh(
      new THREE.TorusGeometry(LOBBY_START_PAD.radius, 0.12, 12, 36),
      archMat,
    );
    this.startPortalRing.rotation.x = Math.PI / 2;
    this.startPortalRing.position.set(LOBBY_START_PAD.x, LOBBY_FLOOR_Y + 0.3, LOBBY_START_PAD.z);
    this.lobbyGroup.add(this.startPortalRing);
    this.disposables.push(this.startPortalRing.geometry);

    const startSign = createPortalSignSprite(
      'PORTAL · EMPEZAR',
      'Entra aquí para iniciar partida',
      '#10b981',
    );
    startSign.position.set(LOBBY_START_PAD.x, LOBBY_FLOOR_Y + 5.6, LOBBY_START_PAD.z);
    this.lobbyGroup.add(startSign);
    this.disposables.push(startSign.material);
    if ((startSign.material as THREE.SpriteMaterial).map) {
      this.disposables.push((startSign.material as THREE.SpriteMaterial).map!);
    }

    // Obby Finish Portal atop obby_balcony
    this.obbyFinishRing = new THREE.Mesh(
      new THREE.TorusGeometry(OBBY_FINISH_PAD.radius, 0.11, 12, 36),
      archMat,
    );
    this.obbyFinishRing.rotation.x = Math.PI / 2;
    this.obbyFinishRing.position.set(OBBY_FINISH_PAD.x, OBBY_FINISH_PAD.y + 0.14, OBBY_FINISH_PAD.z);
    this.lobbyGroup.add(this.obbyFinishRing);
    this.disposables.push(this.obbyFinishRing.geometry);

    const obbySign = createPortalSignSprite(
      'META OBBY · EMPEZAR',
      'Sube aquí para iniciar partida',
      '#f59e0b',
    );
    obbySign.position.set(OBBY_FINISH_PAD.x, OBBY_FINISH_PAD.y + 2.4, OBBY_FINISH_PAD.z);
    this.lobbyGroup.add(obbySign);
    this.disposables.push(obbySign.material);
    if ((obbySign.material as THREE.SpriteMaterial).map) {
      this.disposables.push((obbySign.material as THREE.SpriteMaterial).map!);
    }
  }

  private applyZoneAtmosphere() {
    if (!this.scene || !this.hemiLight || !this.keyLight || !this.rimLight) return;

    const isDarkArena = this.currentZone === 'arena' && this.darkHideAndSeek;
    if (this.arenaSceneryGroup) {
      this.arenaSceneryGroup.visible = !isDarkArena;
    }
    for (const entry of this.arenaTrimEntries) {
      entry.mat.emissiveIntensity = isDarkArena ? 0.06 : entry.baseIntensity;
    }
    if (this.arenaBeaconMat) {
      this.arenaBeaconMat.emissiveIntensity = isDarkArena ? 0.15 : 2.0;
    }
    for (const padMat of this.boostPadMatList) {
      padMat.emissiveIntensity = isDarkArena ? 0.18 : 1.7;
    }

    if (this.currentZone === 'lobby') {
      this.scene.environment = this.envTexture;
      if (this.darkAuraLight) this.darkAuraLight.intensity = 0;
      if (this.darkFlashlight) this.darkFlashlight.intensity = 0;
      this.scene.background = new THREE.Color(0x080c14);
      this.scene.fog = new THREE.FogExp2(0x080c14, 0.0072);
      this.hemiLight.color.setHex(0x93c5fd);
      this.hemiLight.groundColor.setHex(0x0f172a);
      this.hemiLight.intensity = 0.9;
      this.keyLight.color.setHex(0xfff4e0);
      this.keyLight.intensity = 1.45;
      this.rimLight.color.setHex(0x38bdf8);
      this.rimLight.intensity =
        this.graphicsQuality === 'low' ? 0.3 : this.graphicsQuality === 'medium' ? 0.5 : 0.65;
      return;
    }

    if (this.darkHideAndSeek) {
      this.scene.environment = null;
      this.scene.background = new THREE.Color(0x010206);
      this.scene.fog = new THREE.Fog(0x010206, 4.5, 14.2);
      this.hemiLight.color.setHex(0x1e293b);
      this.hemiLight.groundColor.setHex(0x010308);
      this.hemiLight.intensity = 0.015;
      this.keyLight.intensity = 0.0;
      this.rimLight.intensity = 0.0;
      if (this.darkAuraLight) this.darkAuraLight.intensity = 28;
      if (this.darkFlashlight) this.darkFlashlight.intensity = 52;
      return;
    }

    this.scene.environment = this.envTexture;
    if (this.darkAuraLight) this.darkAuraLight.intensity = 0;
    if (this.darkFlashlight) this.darkFlashlight.intensity = 0;
    const { theme } = getMapConfig(this.currentMapId);
    this.scene.background = new THREE.Color(this.iceFloorActive ? 0x0c283d : theme.skyHex);
    this.scene.fog = new THREE.FogExp2(
      this.iceFloorActive ? 0x38bdf8 : theme.fogHex,
      this.iceFloorActive ? 0.011 : theme.fogDensity,
    );
    this.hemiLight.color.set(this.iceFloorActive ? 0xbae6fd : theme.hemiSkyHex);
    this.hemiLight.groundColor.set(theme.hemiGroundHex);
    this.hemiLight.intensity = theme.hemiIntensity;
    this.keyLight.color.set(theme.keyHex);
    this.keyLight.intensity = theme.keyIntensity;
    this.rimLight.color.set(theme.rimHex);
    this.rimLight.intensity =
      this.graphicsQuality === 'low' ? theme.rimIntensity * 0.5 : theme.rimIntensity;
  }

  private buildBiomeScenery(mapCfg: ReturnType<typeof getMapConfig>) {
    const { propStyle } = mapCfg.theme;
    this.biomeParticles = null;
    this.biomeParticleMode = 'none';
    this.biomeOrbitGroup = null;
    const sceneryGroup = new THREE.Group();
    this.arenaGroup.add(sceneryGroup);
    this.arenaSceneryGroup = sceneryGroup;

    const addPoints = (
      count: number,
      colorHex: number,
      size: number,
      minY: number,
      maxY: number,
      spread: number,
      mode: 'snow' | 'embers' | 'dust' | 'stars',
    ) => {
      const positions = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        positions[i * 3] = (Math.random() - 0.5) * spread;
        positions[i * 3 + 1] = minY + Math.random() * (maxY - minY);
        positions[i * 3 + 2] = (Math.random() - 0.5) * spread;
      }
      const pGeo = new THREE.BufferGeometry();
      pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const pMat = new THREE.PointsMaterial({
        color: colorHex,
        size,
        transparent: true,
        opacity: mode === 'stars' ? 0.9 : 0.78,
        depthWrite: false,
      });
      const points = new THREE.Points(pGeo, pMat);
      sceneryGroup.add(points);
      this.arenaDisposables.push(pGeo, pMat);
      this.biomeParticles = points;
      this.biomeParticleMode = mode;
    };

    if (propStyle === 'volcanic') {
      // Glowing molten lava pools around outer perimeter & rising embers
      const lavaMat = new THREE.MeshStandardMaterial({
        color: 0xf97316,
        emissive: 0xea580c,
        emissiveIntensity: 2.2,
        roughness: 0.3,
      });
      this.arenaDisposables.push(lavaMat);
      const moatCoords: Array<[number, number, number, number]> = [
        [0, -32, 62, 3.8],
        [0, 32, 62, 3.8],
        [-32, 0, 3.8, 56],
        [32, 0, 3.8, 56],
      ];
      for (const [mx, mz, mw, md] of moatCoords) {
        const moatGeo = new THREE.PlaneGeometry(mw, md);
        const moat = new THREE.Mesh(moatGeo, lavaMat);
        moat.rotation.x = -Math.PI / 2;
        moat.position.set(mx, 0.03, mz);
        sceneryGroup.add(moat);
        this.arenaDisposables.push(moatGeo);
      }
      addPoints(150, 0xfb923c, 0.34, 0.5, 22, 74, 'embers');
    } else if (propStyle === 'arctic') {
      // Translucent ice crystal spires outside corners + snowfall
      const crystalMat = new THREE.MeshStandardMaterial({
        color: 0xbae6fd,
        emissive: 0x0284c7,
        emissiveIntensity: 0.45,
        roughness: 0.12,
        metalness: 0.25,
        transparent: true,
        opacity: 0.82,
      });
      const spireGeo = new THREE.ConeGeometry(2.6, 15, 5);
      this.arenaDisposables.push(crystalMat, spireGeo);
      const corners = [
        [-45, -45],
        [45, -45],
        [-45, 45],
        [45, 45],
        [0, -49],
        [0, 49],
      ];
      for (const [cx, cz] of corners) {
        const spire = new THREE.Mesh(spireGeo, crystalMat);
        spire.position.set(cx, 7.5, cz);
        spire.rotation.y = (cx + cz) * 0.2;
        sceneryGroup.add(spire);
      }
      addPoints(180, 0xf0f9ff, 0.32, 0.5, 26, 80, 'snow');
    } else if (propStyle === 'temple') {
      // Radiant solar disc + desert sandstone obelisks outside walls + warm dust motes
      const sunGeo = new THREE.CircleGeometry(14, 32);
      const sunMat = new THREE.MeshBasicMaterial({
        color: 0xfde047,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
      });
      const sunMesh = new THREE.Mesh(sunGeo, sunMat);
      sunMesh.position.set(0, 32, -88);
      sceneryGroup.add(sunMesh);
      this.arenaDisposables.push(sunGeo, sunMat);

      const obGeo = new THREE.CylinderGeometry(1.1, 2.2, 16, 4);
      const obMat = new THREE.MeshStandardMaterial({
        color: 0xd9a05b,
        roughness: 0.85,
        metalness: 0.05,
      });
      this.arenaDisposables.push(obGeo, obMat);
      for (const [ox, oz] of [
        [-44, -44],
        [44, -44],
        [-44, 44],
        [44, 44],
      ]) {
        const ob = new THREE.Mesh(obGeo, obMat);
        ob.position.set(ox, 8, oz);
        ob.rotation.y = Math.PI / 4;
        sceneryGroup.add(ob);
      }
      addPoints(130, 0xfef08a, 0.28, 0.6, 18, 72, 'dust');
    } else if (propStyle === 'orbital') {
      // Distant ringed planet + rotating orbital space rings overhead + starfield
      const orbitGroup = new THREE.Group();
      const planetGeo = new THREE.SphereGeometry(16, 24, 24);
      const planetMat = new THREE.MeshStandardMaterial({
        color: 0x312e81,
        emissive: 0x1e1b4b,
        emissiveIntensity: 0.7,
        roughness: 0.5,
      });
      const planet = new THREE.Mesh(planetGeo, planetMat);
      planet.position.set(48, 38, -72);

      const pRingGeo = new THREE.RingGeometry(21, 28, 40);
      const pRingMat = new THREE.MeshBasicMaterial({
        color: 0x22d3ee,
        transparent: true,
        opacity: 0.45,
        side: THREE.DoubleSide,
      });
      const pRing = new THREE.Mesh(pRingGeo, pRingMat);
      pRing.position.copy(planet.position);
      pRing.rotation.x = Math.PI * 0.36;
      pRing.rotation.y = 0.25;

      const haloGeo = new THREE.TorusGeometry(26, 0.22, 8, 48);
      const haloMat = new THREE.MeshBasicMaterial({ color: 0x818cf8 });
      const halo = new THREE.Mesh(haloGeo, haloMat);
      halo.position.set(0, 18, 0);
      halo.rotation.x = Math.PI / 2;

      orbitGroup.add(planet, pRing, halo);
      sceneryGroup.add(orbitGroup);
      this.arenaDisposables.push(planetGeo, planetMat, pRingGeo, pRingMat, haloGeo, haloMat);
      this.biomeOrbitGroup = orbitGroup;
      addPoints(200, 0xe0e7ff, 0.45, 16, 75, 150, 'stars');
    } else if (propStyle === 'sky') {
      // Drifting sunlit cloud rings floating around the sky citadel
      const cloudGroup = new THREE.Group();
      const cloudGeo = new THREE.SphereGeometry(4.5, 12, 10);
      const cloudMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xe0f2fe,
        emissiveIntensity: 0.25,
        roughness: 0.9,
      });
      this.arenaDisposables.push(cloudGeo, cloudMat);
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2;
        const cluster = new THREE.Group();
        cluster.position.set(Math.cos(ang) * 56, 12 + (i % 2) * 5, Math.sin(ang) * 56);
        const c1 = new THREE.Mesh(cloudGeo, cloudMat);
        c1.scale.set(1.6, 0.55, 1.0);
        const c2 = new THREE.Mesh(cloudGeo, cloudMat);
        c2.position.set(3.6, 0.4, 0.8);
        c2.scale.set(1.1, 0.48, 0.9);
        cluster.add(c1, c2);
        cloudGroup.add(cluster);
      }
      sceneryGroup.add(cloudGroup);
      this.biomeOrbitGroup = cloudGroup;
    } else if (propStyle === 'colosseum') {
      // Overhead colosseum golden ring & radial spotlight beams
      const archRingGeo = new THREE.TorusGeometry(36, 0.55, 8, 48);
      const archRingMat = new THREE.MeshStandardMaterial({
        color: 0xfbbf24,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.8,
      });
      const archRing = new THREE.Mesh(archRingGeo, archRingMat);
      archRing.rotation.x = Math.PI / 2;
      archRing.position.set(0, 12.5, 0);
      sceneryGroup.add(archRing);
      this.arenaDisposables.push(archRingGeo, archRingMat);
    } else if (propStyle === 'obsidian') {
      // Floating dark crimson/violet shard pylons
      const shardGroup = new THREE.Group();
      const shardGeo = new THREE.OctahedronGeometry(2.2, 0);
      const shardMat = new THREE.MeshStandardMaterial({
        color: 0x3b0764,
        emissive: 0xf43f5e,
        emissiveIntensity: 1.1,
        roughness: 0.15,
        metalness: 0.7,
      });
      this.arenaDisposables.push(shardGeo, shardMat);
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2;
        const m = new THREE.Mesh(shardGeo, shardMat);
        m.position.set(Math.cos(ang) * 44, 14, Math.sin(ang) * 44);
        m.scale.set(0.8, 2.2, 0.8);
        shardGroup.add(m);
      }
      sceneryGroup.add(shardGroup);
      this.biomeOrbitGroup = shardGroup;
    } else {
      // Reactor Central rotating overhead energy halo
      const ringGroup = new THREE.Group();
      const ringGeo = new THREE.TorusGeometry(12, 0.2, 8, 36);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4 });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(0, 13.5, 0);
      ringGroup.add(ring);
      sceneryGroup.add(ringGroup);
      this.arenaDisposables.push(ringGeo, ringMat);
      this.biomeOrbitGroup = ringGroup;
    }
  }

  private rebuildCombatArena(mapId: ArenaMapId) {
    this.currentMapId = mapId;
    while (this.arenaGroup.children.length > 0) {
      this.arenaGroup.remove(this.arenaGroup.children[0]);
    }
    this.boostPadMeshes.clear();
    this.arenaTrimEntries = [];
    this.boostPadMatList = [];
    this.arenaSceneryGroup = null;
    this.arenaBeaconMat = null;
    for (const d of this.arenaDisposables) {
      d.dispose();
    }
    this.arenaDisposables = [];

    const mapCfg = getMapConfig(mapId);
    const { theme } = mapCfg;
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    const floorTex = createArenaFloorTexture(maxAniso, mapCfg.floorGridHex, mapCfg.floorAccentHex, {
      baseHex: theme.floorBaseHex,
      tileHex: theme.floorTileHex,
      pattern: theme.floorPattern,
    });
    floorTex.repeat.set(28, 28);
    const panelTex = createPanelWallTexture(maxAniso, {
      baseHex: theme.wallHex,
      accentHex: mapCfg.floorAccentHex,
      pattern: theme.floorPattern,
    });
    this.arenaDisposables.push(floorTex, panelTex);

    const floorGeo = new THREE.PlaneGeometry(ARENA_HALF_SIZE * 2, ARENA_HALF_SIZE * 2);
    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTex,
      roughness: Math.min(0.9, Math.max(0.22, theme.wallRoughness)),
      metalness: Math.max(0.05, theme.wallMetalness * 0.6),
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.arenaGroup.add(floor);
    this.arenaDisposables.push(floorGeo, floorMat);

    this.buildBoxesIntoGroup(this.arenaGroup, mapCfg.boxes, panelTex, this.arenaDisposables, {
      wallHex: theme.wallHex,
      platformHex: theme.platformHex,
      wallRoughness: theme.wallRoughness,
      wallMetalness: theme.wallMetalness,
    });

    this.buildBiomeScenery(mapCfg);

    const beaconColor = new THREE.Color(mapCfg.floorAccentHex);
    const beaconGeo = new THREE.OctahedronGeometry(1.15, 0);
    const beaconMat = new THREE.MeshStandardMaterial({
      color: beaconColor,
      emissive: beaconColor,
      emissiveIntensity: 2.0,
      roughness: 0.15,
      metalness: 0.4,
      wireframe: true,
    });
    this.arenaBeaconMat = beaconMat;
    this.centerBeaconCore = new THREE.Mesh(beaconGeo, beaconMat);
    this.centerBeaconCore.position.set(0, 8.4, 0);
    this.arenaGroup.add(this.centerBeaconCore);
    this.arenaDisposables.push(beaconGeo, beaconMat);

    this.applyZoneAtmosphere();
  }

  private initSparkPool() {
    const geo = new THREE.BoxGeometry(0.09, 0.09, 0.09);
    const mat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });
    this.disposables.push(geo, mat);
    for (let i = 0; i < 48; i++) {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      this.dynamicGroup.add(mesh);
      this.sparkPool.push({
        mesh,
        vel: new THREE.Vector3(),
        bornAt: 0,
        lifeMs: 260,
        active: false,
      });
    }
  }

  private spawnSparks(pos: Vec3, count = 8) {
    const now = performance.now();
    let spawned = 0;
    for (const sp of this.sparkPool) {
      if (!sp.active) {
        sp.active = true;
        sp.bornAt = now;
        sp.lifeMs = 220 + Math.random() * 140;
        sp.mesh.position.set(pos.x, pos.y, pos.z);
        sp.mesh.scale.setScalar(1);
        sp.mesh.visible = true;
        sp.vel.set(
          (Math.random() - 0.5) * 9,
          1.5 + Math.random() * 5,
          (Math.random() - 0.5) * 9,
        );
        spawned += 1;
        if (spawned >= count) break;
      }
    }
  }

  public spawnBeam(beam: LaserBeamEvent) {
    if (beam.zone !== this.currentZone || this.currentZone === 'lobby') return;
    const start = _vec3A.set(beam.from.x, beam.from.y, beam.from.z);
    const end = _vec3B.set(beam.to.x, beam.to.y, beam.to.z);
    const dist = start.distanceTo(end);
    if (dist < 0.05) return;

    const radius = beam.beamRadius ?? (beam.isCrit ? 0.048 : 0.032);
    const geo = new THREE.CylinderGeometry(radius, radius, dist, 6);
    geo.translate(0, dist / 2, 0);
    geo.rotateX(Math.PI / 2);

    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(beam.color),
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(start);
    mesh.lookAt(end);
    this.dynamicGroup.add(mesh);

    this.activeBeams.push({
      mesh,
      mat,
      bornAt: performance.now(),
      lifeMs: 185,
    });

    this.spawnSparks(beam.to, beam.hitPlayerId ? 12 : 6);
  }

  public applyRemoteEmote(playerId: string, emote: EmoteId, durationMs = 3200) {
    const actor = this.remoteActors.get(playerId);
    if (!actor) return;
    actor.activeEmote = emote;
    actor.activeEmoteUntil = performance.now() + durationMs;
    const mat = actor.rig.emoteSprite.material as THREE.SpriteMaterial;
    mat.map = getEmoteTexture(emote);
    mat.needsUpdate = true;
  }

  public triggerDeathCam(killerId: string, durationMs: number) {
    this.deathCamKillerId = killerId;
    this.deathCamUntil = performance.now() + durationMs;
    this.isFiringHeld = false;
  }

  private getTargetPixelRatio(): number {
    if (this.isSoftwareGl) return 1;
    const dpr = window.devicePixelRatio || 1;
    if (this.graphicsQuality === 'low') return Math.min(dpr, 0.85);
    if (this.graphicsQuality === 'medium') return Math.min(dpr, 1.25);
    return Math.min(dpr, 2);
  }

  public setLookSensitivity(value: number) {
    if (!Number.isFinite(value)) return;
    this.lookSensitivity = THREE.MathUtils.clamp(value, 0.3, 2.5);
  }

  public setGraphicsQuality(quality: GraphicsQuality) {
    this.graphicsQuality = quality;
    if (!this.renderer || this.disposed) return;

    this.renderer.setPixelRatio(this.getTargetPixelRatio());
    const shadowsAllowed = !this.isSoftwareGl && quality !== 'low';
    this.renderer.shadowMap.enabled = shadowsAllowed;
    if (this.keyLight) {
      this.keyLight.castShadow = shadowsAllowed;
    }
    if (this.rimLight) {
      if (this.currentZone === 'arena' && this.darkHideAndSeek) {
        this.rimLight.intensity = 0;
      } else {
        this.rimLight.intensity = quality === 'low' ? 0.3 : quality === 'medium' ? 0.5 : 0.65;
      }
    }
    this.renderer.toneMappingExposure =
      quality === 'low' ? 1.08 : quality === 'medium' ? 1.12 : 1.15;
    this.renderer.shadowMap.needsUpdate = true;
  }

  public applyServerState(state: ServerStatePayload, myId: string | null) {
    if (!this.renderer || this.disposed) return;
    this.localPlayerId = myId;
    const prevPhase = this.currentPhase;
    this.currentPhase = state.phase;
    const now = Date.now();

    const nextDark = Boolean(state.darkHideAndSeek);
    const darkChanged = nextDark !== this.darkHideAndSeek;
    this.darkHideAndSeek = nextDark;
    this.infiniteEnergy = Boolean(state.infiniteEnergy);
    this.lowGravityActive = (state.lowGravityUntil ?? 0) > now;
    this.turboArenaActive = (state.turboArenaUntil ?? 0) > now;
    this.superJumpActive = (state.superJumpUntil ?? 0) > now;
    this.bigHeadsActive = (state.bigHeadsUntil ?? 0) > now;
    const nextIceFloor = (state.iceFloorUntil ?? 0) > now;
    const iceChanged = nextIceFloor !== this.iceFloorActive;
    this.iceFloorActive = nextIceFloor;
    if (!this.iceFloorActive) {
      this.iceVelX = 0;
      this.iceVelZ = 0;
    }
    this.rainbowChaosActive = (state.rainbowChaosUntil ?? 0) > now;
    if (this.infiniteEnergy) {
      this.sprintEnergy = 100;
      this.sprintExhausted = false;
    }

    if (state.currentMapId && state.currentMapId !== this.currentMapId) {
      this.rebuildCombatArena(state.currentMapId);
    } else if (darkChanged || iceChanged) {
      this.applyZoneAtmosphere();
    }

    // Update local player authoritative zone/alive/boost state
    if (myId) {
      const me = state.players.find((p) => p.id === myId);
      if (me) {
        this.canFly = Boolean(me.canFly);
        this.speedBoosted = Boolean(me.speedBoosted);
        this.infiniteAmmo = Boolean(me.infiniteAmmo);
        if (this.infiniteAmmo) {
          this.localReloadEndAt = 0;
        }
        this.localAccent = me.accentColor;
        const targetPrimary = me.activeWeapon ?? me.equippedWeapon ?? 'pulse_carbine';
        const targetSidearm = me.equippedSidearm ?? 'tactical_pistol';
        const targetKnife = me.equippedKnife ?? 'tactical_blade';
        const targetWeaponSkin = me.equippedWeaponSkin ?? 'default';

        this.localPrimaryWeapon = targetPrimary;
        this.localSidearmWeapon = targetSidearm;
        this.primaryMaxAmmo = me.primaryMaxAmmo ?? getWeaponById(targetPrimary).maxAmmo;
        this.sidearmMaxAmmo = me.sidearmMaxAmmo ?? getWeaponById(targetSidearm).maxAmmo;

        if (targetKnife !== this.localKnife) {
          this.localKnife = targetKnife;
          if (this.knifeView) {
            this.camera.remove(this.knifeView.group);
            disposeObjectTree(this.knifeView.group);
          }
          this.knifeView = createFirstPersonKnife(this.localKnife);
          this.knifeView.group.position.set(0.29, -0.26, -0.36);
          this.knifeView.group.visible =
            this.activeMode === 'play' && this.localAlive && this.activeSlot === 'knife';
          this.camera.add(this.knifeView.group);
        }

        const targetActiveGun =
          this.activeSlot === 'sidearm' ? this.localSidearmWeapon : this.localPrimaryWeapon;

        if (targetActiveGun !== this.localWeapon || targetWeaponSkin !== this.localWeaponSkin) {
          this.localWeapon = targetActiveGun;
          this.localWeaponSkin = targetWeaponSkin;
          this.rebuildLocalBlasterMesh();
        }

        const coreHex =
          this.localWeaponSkin === 'default'
            ? me.accentColor
            : getWeaponSkinById(this.localWeaponSkin).coreHex;
        this.blaster.coreMat.color.set(coreHex);
        this.blaster.coreMat.emissive.set(coreHex);

        if (me.gender !== this.localGender || me.equippedOutfit !== this.localOutfit) {
          this.localGender = me.gender;
          this.localOutfit = me.equippedOutfit;
          if (this.fpArms) {
            this.camera.remove(this.fpArms.group);
            disposeObjectTree(this.fpArms.group);
          }
          this.fpArms = createFirstPersonArms(this.localGender, this.localOutfit);
          this.fpArms.group.visible = false;
          this.camera.add(this.fpArms.group);
        }

        const phaseResetToMatchOrLobby =
          prevPhase !== state.phase &&
          (state.phase === 'lobby' ||
            state.phase === 'countdown' ||
            (prevPhase !== 'countdown' && state.phase === 'playing'));

        if (me.zone !== this.currentZone || phaseResetToMatchOrLobby) {
          this.currentZone = me.zone;
          this.localPos.set(me.x, me.y, me.z);
          this.localYaw = me.yaw;
          this.localPitch = me.pitch;
          this.localVelY = 0;
          this.localGrounded = true;
          this.primaryAmmo = this.primaryMaxAmmo;
          this.sidearmAmmo = this.sidearmMaxAmmo;
          this.localAmmo = this.activeSlot === 'sidearm' ? this.sidearmAmmo : this.primaryAmmo;
          this.localMaxAmmo =
            this.activeSlot === 'sidearm' ? this.sidearmMaxAmmo : this.primaryMaxAmmo;
          this.localReloadEndAt = 0;
          this.isFiringHeld = false;
          this.touchFiring = false;
          this.touchAiming = false;
          this.touchSprinting = false;
          this.touchCrouching = false;
          this.slideUntil = 0;
          this.slideCooldownUntil = 0;
          this.lastSentSlidingState = false;
          this.lastSentCrouchingState = false;
          this.deathCamKillerId = null;
          this.deathCamUntil = 0;
        }

        // Keep Combat Arena hidden when inside Lobby / Obby and sync biome sky/fog/lights
        const zoneVisibleChanged =
          this.lobbyGroup.visible !== (this.currentZone === 'lobby') ||
          this.arenaGroup.visible !== (this.currentZone === 'arena');
        this.lobbyGroup.visible = this.currentZone === 'lobby';
        this.arenaGroup.visible = this.currentZone === 'arena';
        if (zoneVisibleChanged) {
          this.applyZoneAtmosphere();
        }

        // Snap on respawn transition
        if (!this.localAlive && me.alive) {
          this.localPos.set(me.x, me.y, me.z);
          this.localYaw = me.yaw;
          this.localVelY = 0;
          this.primaryAmmo = this.primaryMaxAmmo;
          this.sidearmAmmo = this.sidearmMaxAmmo;
          this.localAmmo = this.activeSlot === 'sidearm' ? this.sidearmAmmo : this.primaryAmmo;
          this.localReloadEndAt = 0;
          this.deathCamKillerId = null;
          this.deathCamUntil = 0;
        }
        this.localAlive = me.alive;

        this.localMaxAmmo =
          this.activeSlot === 'sidearm' ? this.sidearmMaxAmmo : this.primaryMaxAmmo;
        if (me.reloadingUntil === 0 && this.localReloadEndAt === 0 && performance.now() - this.lastShotAt > 350) {
          if (typeof me.primaryAmmo === 'number') this.primaryAmmo = me.primaryAmmo;
          if (typeof me.sidearmAmmo === 'number') this.sidearmAmmo = me.sidearmAmmo;
          this.localAmmo = this.activeSlot === 'sidearm' ? this.sidearmAmmo : this.primaryAmmo;
        }

        const nowBoosted = me.boostUntil > now;
        if (nowBoosted && !this.localBoosted) {
          soundEngine.playBoostPickup();
        }
        this.localBoosted = nowBoosted;
      }
    }

    // Sync all remote players in the world
    const seenIds = new Set<string>();
    const perfNow = performance.now();
    for (const p of state.players) {
      if (p.id === myId) continue;
      seenIds.add(p.id);

      let actor = this.remoteActors.get(p.id);
      const playerPrimary = p.activeWeapon ?? p.equippedWeapon ?? 'pulse_carbine';
      const playerSidearm = p.equippedSidearm ?? 'tactical_pistol';
      const playerSlot = p.activeSlot ?? 'primary';
      const playerWeapon = playerSlot === 'sidearm' ? playerSidearm : playerPrimary;
      const playerKnife = p.equippedKnife ?? 'tactical_blade';
      const playerWeaponSkin = p.equippedWeaponSkin ?? 'default';
      const playerOutfitLevel = getOutfitLevel(p.outfitLevels, p.equippedOutfit);
      if (
        !actor ||
        actor.lastGender !== p.gender ||
        actor.lastName !== p.name ||
        actor.lastAccent !== p.accentColor ||
        actor.lastOutfit !== p.equippedOutfit ||
        actor.lastOutfitLevel !== playerOutfitLevel ||
        actor.lastWeapon !== playerWeapon ||
        actor.lastWeaponSkin !== playerWeaponSkin ||
        actor.lastKnife !== playerKnife ||
        actor.lastCountry !== p.country
      ) {
        if (actor) {
          this.dynamicGroup.remove(actor.rig.root);
          disposeObjectTree(actor.rig.root);
        }
        const rig = createCharacterRig(
          p.gender,
          p.name,
          p.isBot,
          p.accentColor,
          p.equippedOutfit,
          p.country,
          playerWeaponSkin,
          playerWeapon,
          playerOutfitLevel,
          playerKnife,
        );
        rig.root.position.set(p.x, p.y, p.z);
        this.dynamicGroup.add(rig.root);
        actor = {
          id: p.id,
          rig,
          targetPos: new THREE.Vector3(p.x, p.y, p.z),
          targetYaw: p.yaw,
          currentPos: new THREE.Vector3(p.x, p.y, p.z),
          currentYaw: p.yaw,
          lastGender: p.gender,
          lastName: p.name,
          lastAccent: p.accentColor,
          lastOutfit: p.equippedOutfit,
          lastOutfitLevel: playerOutfitLevel,
          lastWeapon: playerWeapon,
          lastWeaponSkin: playerWeaponSkin,
          lastKnife: playerKnife,
          lastCountry: p.country,
          activeEmote: null,
          activeEmoteUntil: 0,
          isSliding: Boolean(p.sliding),
          isCrouching: Boolean(p.crouching),
        };
        this.remoteActors.set(p.id, actor);
      }

      actor.targetPos.set(p.x, p.y, p.z);
      actor.targetYaw = p.yaw;
      actor.isSliding = Boolean(p.sliding);
      actor.isCrouching = Boolean(p.crouching);
      const inSameZone = p.zone === this.currentZone;
      const holdingKnife = playerSlot === 'knife';
      actor.rig.root.visible = p.alive && inSameZone;
      actor.rig.blasterMesh.visible = p.zone === 'arena' && !holdingKnife;
      actor.rig.knifeMesh.visible = holdingKnife;
      actor.rig.shieldBubble.visible = p.alive && inSameZone && p.shieldUntil > now;

      if (p.activeEmote && p.activeEmoteUntil > state.serverTime) {
        if (actor.activeEmote !== p.activeEmote) {
          const mat = actor.rig.emoteSprite.material as THREE.SpriteMaterial;
          mat.map = getEmoteTexture(p.activeEmote);
          mat.needsUpdate = true;
        }
        actor.activeEmote = p.activeEmote;
        actor.activeEmoteUntil = perfNow + (p.activeEmoteUntil - state.serverTime);
      }
    }

    for (const [id, actor] of this.remoteActors.entries()) {
      if (!seenIds.has(id)) {
        this.dynamicGroup.remove(actor.rig.root);
        disposeObjectTree(actor.rig.root);
        this.remoteActors.delete(id);
      }
    }

    // Sync boost pads & live command event drops/meteors
    this.syncBoostPads(state.boostPads);
    this.syncArenaDrops(state.drops ?? []);
    this.syncArenaMeteors(state.meteors ?? []);
  }

  private rebuildLocalBlasterMesh() {
    if (this.blaster) {
      this.camera.remove(this.blaster.group);
      disposeObjectTree(this.blaster.group);
    }
    this.blaster = createFirstPersonBlaster(
      this.localAccent,
      this.localWeaponSkin,
      this.localWeapon,
    );
    const sidearm = isSidearmWeapon(this.localWeapon);
    this.blaster.group.position.set(sidearm ? 0.24 : 0.27, sidearm ? -0.21 : -0.24, sidearm ? -0.31 : -0.34);
    this.blaster.group.visible =
      this.activeMode === 'play' &&
      this.currentZone === 'arena' &&
      this.localAlive &&
      this.activeSlot !== 'knife';
    this.camera.add(this.blaster.group);
  }

  public switchSlot(slot: WeaponSlot, silent = false) {
    if (this.activeMode !== 'play' || !this.localAlive || this.currentPhase === 'results') return;
    if (slot === this.activeSlot) return;

    if (slot === 'primary' || slot === 'sidearm') {
      this.previousGunSlot = slot;
    }
    this.activeSlot = slot;
    this.localReloadEndAt = 0;
    this.isFiringHeld = false;
    this.touchFiring = false;
    this.isRightMouseAiming = false;
    this.touchAiming = false;

    if (slot !== 'knife') {
      const targetGun = slot === 'sidearm' ? this.localSidearmWeapon : this.localPrimaryWeapon;
      if (targetGun !== this.localWeapon) {
        this.localWeapon = targetGun;
        this.rebuildLocalBlasterMesh();
      }
      this.localAmmo = slot === 'sidearm' ? this.sidearmAmmo : this.primaryAmmo;
      this.localMaxAmmo = slot === 'sidearm' ? this.sidearmMaxAmmo : this.primaryMaxAmmo;
    }

    if (this.blaster) {
      this.blaster.group.visible =
        this.activeMode === 'play' &&
        this.currentZone === 'arena' &&
        this.localAlive &&
        this.activeSlot !== 'knife';
    }
    if (this.knifeView) {
      this.knifeView.group.visible =
        this.activeMode === 'play' && this.localAlive && this.activeSlot === 'knife';
    }

    if (!silent) {
      soundEngine.playWeaponSwitch(slot === 'knife');
    }
    this.callbacks.onSendSwitchSlot?.(slot);
    this.pushWeaponHud(performance.now(), true);
  }

  public toggleKnifeSlot() {
    if (this.activeSlot === 'knife') {
      this.switchSlot(this.previousGunSlot);
    } else {
      this.switchSlot('knife');
    }
  }

  private syncBoostPads(pads: BoostPadSnapshot[]) {
    for (const pad of pads) {
      let meshGroup = this.boostPadMeshes.get(pad.id);
      if (!meshGroup) {
        meshGroup = new THREE.Group();
        meshGroup.position.set(pad.x, pad.y, pad.z);
        const color = pad.kind === 'overcharge' ? 0xf59e0b : 0x10b981;
        const padMat = new THREE.MeshStandardMaterial({
          color,
          emissive: color,
          emissiveIntensity: this.darkHideAndSeek && this.currentZone === 'arena' ? 0.18 : 1.7,
          roughness: 0.25,
          metalness: 0.5,
        });
        this.boostPadMatList.push(padMat);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.08, 10, 24), padMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0.08;
        const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.36, 0), padMat);
        crystal.position.y = 0.85;
        meshGroup.add(ring, crystal);
        this.arenaGroup.add(meshGroup);
        this.arenaDisposables.push(padMat, ring.geometry, crystal.geometry);
        this.boostPadMeshes.set(pad.id, meshGroup);
      }
      const crystal = meshGroup.children[1];
      if (crystal) {
        crystal.visible = pad.active;
      }
    }
  }

  private syncArenaDrops(drops: ArenaDropSnapshot[]) {
    const activeIds = new Set<string>();
    const visibleInArena = this.currentZone === 'arena';

    for (const drop of drops) {
      activeIds.add(drop.id);
      let entry = this.dropMeshes.get(drop.id);
      if (!entry) {
        const group = new THREE.Group();
        const color =
          drop.kind === 'weapon' ? 0x22d3ee : drop.kind === 'shield' ? 0x10b981 : 0xfbbf24;
        const accent =
          drop.kind === 'weapon' ? 0xf59e0b : drop.kind === 'shield' ? 0x34d399 : 0xfef08a;

        const mat = new THREE.MeshStandardMaterial({
          color,
          emissive: color,
          emissiveIntensity: this.darkHideAndSeek ? 0.5 : 1.5,
          roughness: 0.28,
          metalness: 0.6,
        });
        const ringMat = new THREE.MeshBasicMaterial({
          color: accent,
          transparent: true,
          opacity: 0.72,
          side: THREE.DoubleSide,
        });

        let coreMesh: THREE.Mesh;
        if (drop.kind === 'weapon') {
          coreMesh = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.42, 0.68), mat);
        } else if (drop.kind === 'shield') {
          coreMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), mat);
        } else {
          const coinGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.12, 16);
          coinGeo.rotateX(Math.PI / 2);
          coreMesh = new THREE.Mesh(coinGeo, mat);
        }
        coreMesh.position.y = 0.48;

        const halo = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.72, 20), ringMat);
        halo.rotation.x = -Math.PI / 2;
        halo.position.y = 0.08;

        group.add(coreMesh, halo);
        group.position.set(drop.x, drop.y, drop.z);
        group.visible = visibleInArena;
        this.dynamicGroup.add(group);
        entry = { group, kind: drop.kind, baseY: drop.y };
        this.dropMeshes.set(drop.id, entry);
      }

      entry.baseY = drop.y;
      entry.group.position.x = drop.x;
      entry.group.position.z = drop.z;
      entry.group.visible = visibleInArena;
    }

    for (const [id, entry] of this.dropMeshes.entries()) {
      if (!activeIds.has(id)) {
        this.dynamicGroup.remove(entry.group);
        disposeObjectTree(entry.group);
        this.dropMeshes.delete(id);
      }
    }
  }

  private syncArenaMeteors(meteors: ArenaMeteorSnapshot[]) {
    const activeIds = new Set<string>();

    for (const meteor of meteors) {
      activeIds.add(meteor.id);
      let entry = this.meteorMeshes.get(meteor.id);
      if (!entry) {
        const group = new THREE.Group();
        const rockMat = new THREE.MeshStandardMaterial({
          color: 0xf97316,
          emissive: 0xea580c,
          emissiveIntensity: 2.1,
          roughness: 0.35,
          metalness: 0.2,
        });
        const core = new THREE.Mesh(new THREE.DodecahedronGeometry(0.82, 0), rockMat);
        core.position.set(meteor.x, meteor.y, meteor.z);

        const ringMat = new THREE.MeshBasicMaterial({
          color: 0xf43f5e,
          transparent: true,
          opacity: 0.72,
          side: THREE.DoubleSide,
        });
        const ring = new THREE.Mesh(new THREE.RingGeometry(2.8, 3.6, 28), ringMat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(meteor.x, meteor.landY + 0.08, meteor.z);

        group.add(core, ring);
        this.dynamicGroup.add(group);
        entry = { group, core, ring, landY: meteor.landY };
        this.meteorMeshes.set(meteor.id, entry);
      }

      entry.landY = meteor.landY;
      entry.core.position.set(meteor.x, meteor.y, meteor.z);
      entry.ring.position.set(meteor.x, meteor.landY + 0.08, meteor.z);
    }

    for (const [id, entry] of this.meteorMeshes.entries()) {
      if (!activeIds.has(id)) {
        this.dynamicGroup.remove(entry.group);
        disposeObjectTree(entry.group);
        this.meteorMeshes.delete(id);
      }
    }
  }

  public setMode(mode: 'preview' | 'play') {
    this.activeMode = mode;
    if (this.blaster) {
      this.blaster.group.visible =
        mode === 'play' && this.currentZone === 'arena' && this.activeSlot !== 'knife';
    }
    if (this.knifeView) {
      this.knifeView.group.visible = mode === 'play' && this.activeSlot === 'knife';
    }
    if (this.fpArms) {
      this.fpArms.group.visible = false;
    }
    if (mode === 'preview') {
      this.exitPointerLock();
    }
  }

  public setPointerLockSuppressed(suppressed: boolean) {
    this.pointerLockSuppressed = suppressed;
    if (suppressed) {
      this.exitPointerLock();
    }
  }

  public requestPointerLock() {
    if (!this.renderer || this.activeMode !== 'play' || this.pointerLockSuppressed) return;
    try {
      this.renderer.domElement.requestPointerLock?.();
    } catch {
      // Fallback drag/keyboard look handles locked restrictions
    }
  }

  public exitPointerLock() {
    if (!this.renderer) return;
    if (document.pointerLockElement === this.renderer.domElement) {
      document.exitPointerLock?.();
    }
  }

  private triggerHaptic(pattern: number | number[]) {
    if (this.inputMode !== 'touch') return;
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
    try {
      navigator.vibrate(pattern);
    } catch {
      // Ignore blocked or unsupported vibration environments
    }
  }

  public triggerHitFeel(killed: boolean) {
    this.cameraShake = Math.max(this.cameraShake, killed ? 0.055 : 0.025);
    this.triggerHaptic(killed ? [45, 30, 75] : [22]);
    if (killed) {
      this.hitstopUntil = performance.now() + 42;
      soundEngine.playElimination();
    }
  }

  public triggerDamagedFeel() {
    this.cameraShake = Math.max(this.cameraShake, 0.065);
    this.triggerHaptic([60, 25, 45]);
    soundEngine.playDamaged();
  }

  public triggerReload() {
    if (
      this.activeMode !== 'play' ||
      !this.localAlive ||
      this.currentZone === 'lobby' ||
      this.activeSlot === 'knife' ||
      this.infiniteAmmo
    ) {
      return;
    }
    const now = performance.now();
    if (this.localReloadEndAt > now) return;
    if (this.localAmmo >= this.localMaxAmmo) return;

    const weaponDef = getWeaponById(this.localWeapon);
    this.localReloadStartAt = now;
    this.localReloadEndAt = now + weaponDef.reloadDurationMs;
    this.isFiringHeld = false;
    soundEngine.playReloadStart();
    this.callbacks.onSendReload();
    this.pushWeaponHud(now, true);
  }

  private isReloading(now = performance.now()): boolean {
    return this.localReloadEndAt > now;
  }

  private isAimingNow(now = performance.now()): boolean {
    if (
      this.activeMode !== 'play' ||
      !this.localAlive ||
      this.currentZone === 'lobby' ||
      this.activeSlot === 'knife' ||
      this.isReloading(now)
    ) {
      return false;
    }
    return this.isRightMouseAiming || this.touchAiming || this.heldKeys.has('KeyV');
  }

  private triggerSlide() {
    if (
      this.activeMode !== 'play' ||
      !this.localAlive ||
      this.currentPhase === 'results' ||
      this.currentPhase === 'countdown'
    ) {
      return;
    }
    const now = performance.now();
    if (!this.localGrounded || now < this.slideUntil || now < this.slideCooldownUntil) return;

    const inArena = this.currentZone === 'arena';
    if (inArena && !this.infiniteEnergy && this.sprintEnergy < 12) return;
    if (inArena && !this.infiniteEnergy) {
      this.sprintEnergy = Math.max(0, this.sprintEnergy - 15);
      this.lastSprintAt = now;
    }

    const keyFwd = (this.heldKeys.has('KeyW') ? 1 : 0) - (this.heldKeys.has('KeyS') ? 1 : 0);
    const keyStrafe = (this.heldKeys.has('KeyD') ? 1 : 0) - (this.heldKeys.has('KeyA') ? 1 : 0);
    const fwd = THREE.MathUtils.clamp(keyFwd + this.touchMoveForward, -1, 1);
    const strafe = THREE.MathUtils.clamp(keyStrafe + this.touchMoveStrafe, -1, 1);
    const sinY = Math.sin(this.localYaw);
    const cosY = Math.cos(this.localYaw);

    let dirX = -sinY;
    let dirZ = -cosY;
    if (fwd !== 0 || strafe !== 0) {
      const mag = Math.hypot(fwd, strafe);
      const nf = fwd / mag;
      const ns = strafe / mag;
      dirX = -sinY * nf + cosY * ns;
      dirZ = -cosY * nf - sinY * ns;
    }

    this.slideDirX = dirX;
    this.slideDirZ = dirZ;
    this.slideUntil = now + 620;
    this.slideCooldownUntil = now + 1050;
    soundEngine.playSlide();
    this.pushWeaponHud(now, true);
  }

  private isCrouchingNow(): boolean {
    if (this.activeMode !== 'play' || !this.localAlive || this.currentPhase === 'results') {
      return false;
    }
    return (
      this.heldKeys.has('ControlLeft') ||
      this.heldKeys.has('ControlRight') ||
      this.touchCrouching
    );
  }

  private pushWeaponHud(now: number, force = false) {
    const reloading = !this.infiniteAmmo && this.isReloading(now);
    const aiming = this.isAimingNow(now);
    const sliding = this.localAlive && this.currentPhase !== 'results' && now < this.slideUntil;
    const crouching = !sliding && this.isCrouchingNow();
    const reloadDuration = Math.max(200, this.localReloadEndAt - this.localReloadStartAt);
    const progress = reloading
      ? Math.min(1, Math.max(0, (now - this.localReloadStartAt) / reloadDuration))
      : 0;
    const roundedEnergy = Math.round(this.sprintEnergy);

    const changed =
      force ||
      this.localWeapon !== this.lastSentWeapon ||
      this.activeSlot !== this.lastSentSlot ||
      this.localKnife !== this.lastSentKnife ||
      this.localPrimaryWeapon !== this.lastSentPrimaryWeapon ||
      this.localSidearmWeapon !== this.lastSentSidearmWeapon ||
      this.primaryAmmo !== this.lastSentPrimaryAmmo ||
      this.sidearmAmmo !== this.lastSentSidearmAmmo ||
      aiming !== this.lastSentAiming ||
      this.localAmmo !== this.lastSentAmmo ||
      this.localMaxAmmo !== this.lastSentMaxAmmo ||
      reloading !== this.lastSentReloading ||
      roundedEnergy !== this.lastSentSprintEnergy ||
      this.isSprintingNow !== this.lastSentSprinting ||
      sliding !== this.lastSentSliding ||
      crouching !== this.lastSentCrouching ||
      this.canFly !== this.lastSentCanFly ||
      this.currentZone !== this.lastSentZone ||
      (reloading && now - this.lastHudWeaponPushAt > 45);

    if (changed) {
      this.lastSentWeapon = this.localWeapon;
      this.lastSentSlot = this.activeSlot;
      this.lastSentKnife = this.localKnife;
      this.lastSentPrimaryWeapon = this.localPrimaryWeapon;
      this.lastSentSidearmWeapon = this.localSidearmWeapon;
      this.lastSentPrimaryAmmo = this.primaryAmmo;
      this.lastSentSidearmAmmo = this.sidearmAmmo;
      this.lastSentAiming = aiming;
      this.lastSentAmmo = this.localAmmo;
      this.lastSentMaxAmmo = this.localMaxAmmo;
      this.lastSentReloading = reloading;
      this.lastSentSprintEnergy = roundedEnergy;
      this.lastSentSprinting = this.isSprintingNow;
      this.lastSentSliding = sliding;
      this.lastSentCrouching = crouching;
      this.lastSentCanFly = this.canFly;
      this.lastSentZone = this.currentZone;
      this.lastHudWeaponPushAt = now;
      this.callbacks.onWeaponStateChange({
        weaponId: this.localWeapon,
        activeSlot: this.activeSlot,
        primaryWeaponId: this.localPrimaryWeapon,
        sidearmWeaponId: this.localSidearmWeapon,
        knifeId: this.localKnife,
        isAiming: aiming,
        ammo: this.localAmmo,
        maxAmmo: this.localMaxAmmo,
        primaryAmmo: this.primaryAmmo,
        primaryMaxAmmo: this.primaryMaxAmmo,
        sidearmAmmo: this.sidearmAmmo,
        sidearmMaxAmmo: this.sidearmMaxAmmo,
        isReloading: reloading,
        reloadProgress: progress,
        sprintEnergy: roundedEnergy,
        isSprinting: this.isSprintingNow,
        isSliding: sliding,
        isCrouching: crouching,
        canFly: this.canFly,
        zone: this.currentZone,
      });
    }
  }

  private tryMeleeSlash() {
    if (this.activeMode !== 'play' || !this.localAlive) return;
    if (this.currentPhase === 'countdown' || this.currentPhase === 'results') return;
    const now = performance.now();
    const knifeDef = getKnifeById(this.localKnife);
    if (now - this.lastMeleeAt < knifeDef.cooldownMs) return;

    this.lastMeleeAt = now;
    this.knifeSlashStartAt = now;
    this.knifeSlashEndAt = now + Math.min(280, knifeDef.cooldownMs * 0.72);
    this.cameraShake = Math.max(this.cameraShake, 0.016);
    soundEngine.playKnifeSlash();

    if (this.currentZone === 'arena' && this.currentPhase === 'playing') {
      this.camera.getWorldPosition(_vec3A);
      this.camera.getWorldDirection(_dir);
      this.callbacks.onSendMeleeSlash?.(
        { x: _vec3A.x, y: _vec3A.y, z: _vec3A.z },
        { x: _dir.x, y: _dir.y, z: _dir.z },
      );

      const wallDist = raycastZoneGeometry(
        this.currentZone,
        { x: _vec3A.x, y: _vec3A.y, z: _vec3A.z },
        { x: _dir.x, y: _dir.y, z: _dir.z },
        knifeDef.range,
        this.currentMapId,
      );
      if (wallDist < knifeDef.range - 0.1) {
        this.spawnSparks(
          {
            x: _vec3A.x + _dir.x * wallDist,
            y: _vec3A.y + _dir.y * wallDist,
            z: _vec3A.z + _dir.z * wallDist,
          },
          5,
        );
      }
    }
  }

  private tryShoot() {
    if (this.activeMode !== 'play' || !this.localAlive) return;
    if (this.activeSlot === 'knife') {
      this.tryMeleeSlash();
      return;
    }
    if (this.currentZone === 'lobby') return;
    if (this.currentPhase === 'countdown' || this.currentPhase === 'results') return;
    const now = performance.now();
    if (!this.infiniteAmmo && this.isReloading(now)) {
      if (now - this.lastEmptyClickAt > 280) {
        this.lastEmptyClickAt = now;
        soundEngine.playEmptyClick();
      }
      return;
    }
    if (!this.infiniteAmmo && this.localAmmo <= 0) {
      this.triggerReload();
      return;
    }

    const weaponDef = getWeaponById(this.localWeapon);
    const baseCooldown = this.localBoosted ? weaponDef.boostedCooldownMs : weaponDef.fireCooldownMs;
    const eventMult = (this.turboArenaActive ? 0.58 : 1) * (this.rainbowChaosActive ? 0.55 : 1);
    const cooldown = Math.max(50, Math.round(baseCooldown * eventMult));
    if (now - this.lastShotAt < cooldown) return;
    this.lastShotAt = now;
    if (!this.infiniteAmmo) {
      this.localAmmo = Math.max(0, this.localAmmo - 1);
      if (this.activeSlot === 'sidearm') {
        this.sidearmAmmo = this.localAmmo;
      } else {
        this.primaryAmmo = this.localAmmo;
      }
    }

    this.blasterRecoil =
      this.localWeapon === 'rail_sniper' || this.localWeapon === 'plasma_cannon'
        ? 1.45
        : this.localWeapon === 'scatter_shotgun'
          ? 1.35
          : 1.0;
    this.muzzleFlashUntil = now + 55;
    this.cameraShake = Math.max(
      this.cameraShake,
      this.localWeapon === 'rail_sniper' || this.localWeapon === 'plasma_cannon'
        ? 0.024
        : this.localWeapon === 'scatter_shotgun'
          ? 0.022
          : this.isAimingNow(now)
            ? 0.008
            : 0.014,
    );
    soundEngine.playLaserShot(this.localBoosted);

    // Compute exact ray from camera center
    this.camera.getWorldPosition(_vec3A);
    this.camera.getWorldDirection(_dir);

    this.callbacks.onSendShoot(
      { x: _vec3A.x, y: _vec3A.y, z: _vec3A.z },
      { x: _dir.x, y: _dir.y, z: _dir.z },
    );

    const dist = raycastZoneGeometry(
      this.currentZone,
      { x: _vec3A.x, y: _vec3A.y, z: _vec3A.z },
      { x: _dir.x, y: _dir.y, z: _dir.z },
      120,
      this.currentMapId,
    );
    if (dist < 119) {
      this.spawnSparks(
        {
          x: _vec3A.x + _dir.x * dist,
          y: _vec3A.y + _dir.y * dist,
          z: _vec3A.z + _dir.z * dist,
        },
        4,
      );
    }

    if (!this.infiniteAmmo && this.localAmmo === 0) {
      this.triggerReload();
    } else {
      this.pushWeaponHud(now, true);
    }
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (this.activeMode !== 'play') return;
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.code === 'ControlLeft' || e.code === 'ControlRight') {
      e.preventDefault();
    }
    this.heldKeys.add(e.code);
    if (e.code === 'Space') {
      this.jumpBufferUntil = performance.now() + 140;
    } else if (e.code === 'KeyR') {
      this.triggerReload();
    } else if (e.code === 'KeyC' && !e.repeat) {
      this.triggerSlide();
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.heldKeys.delete(e.code);
  };

  private onWindowBlur = () => {
    this.heldKeys.clear();
    this.isFiringHeld = false;
    this.touchFiring = false;
    this.touchAiming = false;
    this.touchSprinting = false;
    this.touchCrouching = false;
    this.touchMoveForward = 0;
    this.touchMoveStrafe = 0;
    this.touchLookId = null;
    this.isDraggingLook = false;
    this.isRightMouseAiming = false;
  };

  private onPointerDown = (e: PointerEvent) => {
    if (e.pointerType === 'touch') {
      this.lastTouchEventAt = performance.now();
      this.setInputMode('touch');
    } else if (e.pointerType === 'mouse' && performance.now() - this.lastTouchEventAt > 750) {
      this.setInputMode('mouse');
    }
  };

  private onTouchStart = (e: TouchEvent) => {
    this.lastTouchEventAt = performance.now();
    this.setInputMode('touch');
    if (this.activeMode !== 'play' || !this.renderer) return;
    if (e.target !== this.renderer.domElement) return;
    if (this.touchLookId === null && e.changedTouches.length > 0) {
      const t = e.changedTouches[0];
      this.touchLookId = t.identifier;
      this.lastTouchLookX = t.clientX;
      this.lastTouchLookY = t.clientY;
    }
  };

  private onTouchMove = (e: TouchEvent) => {
    this.lastTouchEventAt = performance.now();
    this.setInputMode('touch');
    if (this.activeMode !== 'play' || this.touchLookId === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === this.touchLookId) {
        const dx = t.clientX - this.lastTouchLookX;
        const dy = t.clientY - this.lastTouchLookY;
        this.lastTouchLookX = t.clientX;
        this.lastTouchLookY = t.clientY;
        const touchSens = (this.isAimingNow() ? 0.0032 : 0.005) * this.lookSensitivity;
        this.localYaw -= dx * touchSens;
        this.localPitch = THREE.MathUtils.clamp(
          this.localPitch - dy * touchSens,
          -1.45,
          1.45,
        );
        break;
      }
    }
  };

  private onTouchEnd = (e: TouchEvent) => {
    this.lastTouchEventAt = performance.now();
    if (this.touchLookId === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === this.touchLookId) {
        this.touchLookId = null;
        break;
      }
    }
  };

  private onMouseMove = (e: MouseEvent) => {
    if (performance.now() - this.lastTouchEventAt > 750) {
      this.setInputMode('mouse');
    }
    if (this.activeMode !== 'play') return;
    const baseSens = (this.isAimingNow() ? 0.00125 : 0.0022) * this.lookSensitivity;
    if (this.isPointerLocked) {
      this.localYaw -= e.movementX * baseSens;
      this.localPitch = THREE.MathUtils.clamp(
        this.localPitch - e.movementY * baseSens,
        -1.45,
        1.45,
      );
    } else if (this.isDraggingLook) {
      const dx = e.clientX - this.lastMouseX;
      const dy = e.clientY - this.lastMouseY;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
      const dragSens = 0.004 * this.lookSensitivity;
      this.localYaw -= dx * dragSens;
      this.localPitch = THREE.MathUtils.clamp(this.localPitch - dy * dragSens, -1.45, 1.45);
    }
  };

  private onMouseDown = (e: MouseEvent) => {
    if (performance.now() - this.lastTouchEventAt <= 750) return;
    this.setInputMode('mouse');
    if (this.activeMode !== 'play') return;
    if (e.target !== this.renderer?.domElement) return;

    if (e.button === 0) {
      if (!this.isPointerLocked && !this.pointerLockSuppressed) {
        this.requestPointerLock();
      }
      this.isFiringHeld = true;
      this.tryShoot();
    } else if (e.button === 2) {
      if (this.isPointerLocked) {
        this.isRightMouseAiming = true;
      } else {
        this.isDraggingLook = true;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
      }
    }
  };

  private onMouseUp = (e: MouseEvent) => {
    if (e.button === 0) this.isFiringHeld = false;
    if (e.button === 2) {
      this.isDraggingLook = false;
      this.isRightMouseAiming = false;
    }
  };

  private onContextMenu = (e: MouseEvent) => {
    if (this.activeMode === 'play' && e.target === this.renderer?.domElement) {
      e.preventDefault();
    }
  };

  private onPointerLockChange = () => {
    this.isPointerLocked = document.pointerLockElement === this.renderer?.domElement;
    this.callbacks.onPointerLockChange(this.isPointerLocked);
  };

  private onResize = () => {
    if (!this.renderer || !this.camera) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(this.getTargetPixelRatio());
  };

  private bindEvents() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onWindowBlur);
    window.addEventListener('pointerdown', this.onPointerDown, { passive: true });
    window.addEventListener('touchstart', this.onTouchStart, { passive: true });
    window.addEventListener('touchmove', this.onTouchMove, { passive: true });
    window.addEventListener('touchend', this.onTouchEnd, { passive: true });
    window.addEventListener('touchcancel', this.onTouchEnd, { passive: true });
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('contextmenu', this.onContextMenu);
    window.addEventListener('resize', this.onResize);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
  }

  private startLoop() {
    const afterDraw = (cb: () => void) => {
      const gl = this.renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync?.(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (this.disposed) return;
        const state = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
        if (state === gl.UNSIGNALED) {
          this.frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          this.frameId = window.setTimeout(cb, 80);
        }
      };
      this.frameId = window.setTimeout(poll, 5);
    };

    const tick = () => {
      if (this.disposed) return;
      const rawDt = this.clock.getDelta();
      const dt = Math.min(rawDt, 0.05);
      const now = performance.now();

      if (now >= this.hitstopUntil) {
        this.stepSimulation(dt, now);
      }

      if (this.renderer && this.scene && this.camera) {
        this.renderer.render(this.scene, this.camera);
      }

      if (this.isSoftwareGl) {
        afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    this.frameId = requestAnimationFrame(tick);
  }

  private stepSimulation(dt: number, now: number) {
    // Animate lobby start ring, obby finish ring & arena beacon
    if (this.startPortalRing) {
      this.startPortalRing.rotation.z += dt * 1.1;
    }
    if (this.obbyFinishRing) {
      this.obbyFinishRing.rotation.z -= dt * 1.35;
    }
    if (this.centerBeaconCore) {
      this.centerBeaconCore.rotation.y += dt * 0.9;
      this.centerBeaconCore.rotation.x += dt * 0.45;
    }
    if (this.currentZone === 'arena') {
      if (this.biomeOrbitGroup) {
        this.biomeOrbitGroup.rotation.y += dt * 0.12;
      }
      if (this.biomeParticles && this.biomeParticleMode !== 'none') {
        const attr = this.biomeParticles.geometry.getAttribute('position') as THREE.BufferAttribute;
        const arr = attr.array as Float32Array;
        if (this.biomeParticleMode === 'snow') {
          for (let i = 1; i < arr.length; i += 3) {
            arr[i] -= dt * 3.4;
            if (arr[i] < 0.2) arr[i] = 26;
          }
          attr.needsUpdate = true;
        } else if (this.biomeParticleMode === 'embers') {
          for (let i = 1; i < arr.length; i += 3) {
            arr[i] += dt * 2.6;
            if (arr[i] > 22) arr[i] = 0.4;
          }
          attr.needsUpdate = true;
        } else if (this.biomeParticleMode === 'dust') {
          for (let i = 0; i < arr.length; i += 3) {
            arr[i] += dt * 1.1;
            if (arr[i] > 36) arr[i] = -36;
          }
          attr.needsUpdate = true;
        } else if (this.biomeParticleMode === 'stars') {
          this.biomeParticles.rotation.y += dt * 0.018;
        }
      }
    }
    for (const padGroup of this.boostPadMeshes.values()) {
      const crystal = padGroup.children[1];
      if (crystal) {
        crystal.rotation.y += dt * 2.2;
        crystal.position.y = 0.85 + Math.sin(now * 0.004) * 0.12;
      }
    }
    for (const entry of this.dropMeshes.values()) {
      if (!entry.group.visible) continue;
      entry.group.rotation.y += dt * (entry.kind === 'coin' ? 3.2 : 1.7);
      entry.group.position.y = entry.baseY + Math.sin(now * 0.005) * 0.08;
    }
    for (const m of this.meteorMeshes.values()) {
      m.core.rotation.x += dt * 4.5;
      m.core.rotation.y += dt * 3.8;
      const pulse = 0.88 + Math.sin(now * 0.02) * 0.12;
      m.ring.scale.set(pulse, pulse, 1);
    }

    // Preview camera pan inside the External Sky-Lobby (Combat Arena hidden)
    if (this.activeMode === 'preview') {
      const t = now * 0.00024;
      this.camera.position.set(Math.sin(t) * 14, LOBBY_FLOOR_Y + 5.2, LOBBY_CENTER_Z + Math.cos(t) * 14);
      this.camera.lookAt(-3, LOBBY_FLOOR_Y + 1.8, LOBBY_CENTER_Z);
    } else if (!this.localAlive && this.deathCamKillerId && now < this.deathCamUntil) {
      // 3-second Death Cam: 3rd-person spectator tracking of the opponent who eliminated you
      this.blaster.group.visible = false;
      this.knifeView.group.visible = false;
      this.fpArms.group.visible = false;
      const killer = this.remoteActors.get(this.deathCamKillerId);
      if (killer) {
        const orbitAngle = killer.currentYaw + Math.PI + (now * 0.0006);
        const rawDirX = Math.sin(orbitAngle);
        const rawDirZ = Math.cos(orbitAngle);
        const lookOrigin = {
          x: killer.currentPos.x,
          y: killer.currentPos.y + 1.45,
          z: killer.currentPos.z,
        };
        const dirLen = Math.hypot(rawDirX, 0.35, rawDirZ);
        const rayDir = {
          x: rawDirX / dirLen,
          y: 0.35 / dirLen,
          z: rawDirZ / dirLen,
        };
        const wallDist = raycastZoneGeometry(
          this.currentZone,
          lookOrigin,
          rayDir,
          4.3,
          this.currentMapId,
        );
        const safeDist = Math.max(1.2, wallDist - 0.45);
        const targetCamX = lookOrigin.x + rayDir.x * safeDist;
        const targetCamY = lookOrigin.y + rayDir.y * safeDist;
        const targetCamZ = lookOrigin.z + rayDir.z * safeDist;

        this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, targetCamX, 10, dt);
        this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, targetCamY, 10, dt);
        this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, targetCamZ, 10, dt);
        this.camera.lookAt(killer.currentPos.x, killer.currentPos.y + 1.35, killer.currentPos.z);
      }
      if (Math.abs(this.camera.fov - 68) > 0.1) {
        this.camera.fov = THREE.MathUtils.damp(this.camera.fov, 68, 12, dt);
        this.camera.updateProjectionMatrix();
      }
    } else {
      const inArena = this.currentZone === 'arena';
      const holdingKnife = this.activeSlot === 'knife';
      this.blaster.group.visible = inArena && this.localAlive && !holdingKnife;
      this.knifeView.group.visible = this.localAlive && holdingKnife && this.currentPhase !== 'results';

      // First-person movement & keyboard look fallback
      if (this.heldKeys.has('ArrowLeft')) this.localYaw += dt * 2.1;
      if (this.heldKeys.has('ArrowRight')) this.localYaw -= dt * 2.1;
      if (this.heldKeys.has('ArrowUp')) {
        this.localPitch = THREE.MathUtils.clamp(this.localPitch + dt * 1.6, -1.45, 1.45);
      }
      if (this.heldKeys.has('ArrowDown')) {
        this.localPitch = THREE.MathUtils.clamp(this.localPitch - dt * 1.6, -1.45, 1.45);
      }

      if ((inArena || holdingKnife) && (this.isFiringHeld || this.touchFiring)) {
        this.tryShoot();
      }

      this.isWalkingNow = false;
      this.isSprintingNow = false;
      const isSlidingNow =
        this.localAlive &&
        this.currentPhase !== 'results' &&
        this.currentPhase !== 'countdown' &&
        now < this.slideUntil;
      const isCrouchingNow = !isSlidingNow && this.isCrouchingNow();

      if (this.localAlive && this.currentPhase !== 'results' && this.currentPhase !== 'countdown') {
        const keyFwd = (this.heldKeys.has('KeyW') ? 1 : 0) - (this.heldKeys.has('KeyS') ? 1 : 0);
        const keyStrafe = (this.heldKeys.has('KeyD') ? 1 : 0) - (this.heldKeys.has('KeyA') ? 1 : 0);
        const fwd = THREE.MathUtils.clamp(keyFwd + this.touchMoveForward, -1, 1);
        const strafe = THREE.MathUtils.clamp(keyStrafe + this.touchMoveStrafe, -1, 1);

        let moveX = 0;
        let moveZ = 0;
        const mag = Math.hypot(fwd, strafe);
        this.isWalkingNow = mag > 0;

        const wantsSprint =
          !isSlidingNow &&
          !(isCrouchingNow && !this.canFly) &&
          this.isWalkingNow &&
          !this.isAimingNow(now) &&
          (this.heldKeys.has('ShiftLeft') ||
            this.heldKeys.has('ShiftRight') ||
            this.touchSprinting);

        if (this.infiniteEnergy || this.speedBoosted || this.turboArenaActive) {
          this.sprintEnergy = 100;
          this.sprintExhausted = false;
          this.isSprintingNow = wantsSprint;
        } else if (wantsSprint && !this.sprintExhausted && this.sprintEnergy > 0) {
          this.isSprintingNow = true;
          this.sprintEnergy = Math.max(0, this.sprintEnergy - 28 * dt);
          this.lastSprintAt = now;
          if (this.sprintEnergy <= 0) {
            this.sprintExhausted = true;
            this.isSprintingNow = false;
          }
        } else if (!isSlidingNow && now - this.lastSprintAt > 450) {
          this.sprintEnergy = Math.min(100, this.sprintEnergy + 22 * dt);
          if (this.sprintExhausted && this.sprintEnergy >= 20) {
            this.sprintExhausted = false;
          }
        }

        const knifeSpeedMult = holdingKnife ? getKnifeById(this.localKnife).speedBonus : 1;
        const crouchMult = isCrouchingNow && !this.canFly ? 0.62 : 1;
        const adminSpeedMult = this.speedBoosted ? 1.7 : 1;
        const turboMult = this.turboArenaActive ? 1.35 : 1;

        if (isSlidingNow) {
          const slideProgress = Math.max(0, Math.min(1, (this.slideUntil - now) / 620));
          const slideSpeed =
            MOVE_SPEED *
            (1.35 + slideProgress * 0.65) *
            (this.localBoosted ? 1.15 : 1) *
            knifeSpeedMult *
            adminSpeedMult *
            turboMult;
          moveX = this.slideDirX * slideSpeed;
          moveZ = this.slideDirZ * slideSpeed;
          this.walkBobPhase = 0;
        } else if (mag > 0) {
          const nf = fwd / mag;
          const ns = strafe / mag;
          const speed =
            MOVE_SPEED *
            (this.localBoosted ? 1.24 : 1) *
            knifeSpeedMult *
            crouchMult *
            adminSpeedMult *
            turboMult *
            (this.isSprintingNow ? SPRINT_SPEED_MULTIPLIER : 1);
          const sinY = Math.sin(this.localYaw);
          const cosY = Math.cos(this.localYaw);
          moveX = (-sinY * nf + cosY * ns) * speed;
          moveZ = (-cosY * nf - sinY * ns) * speed;
          this.walkBobPhase +=
            dt * (this.isSprintingNow ? 14.5 : isCrouchingNow ? 6.5 : this.localBoosted ? 12.5 : 10);
        } else {
          this.walkBobPhase = 0;
        }

        if (this.iceFloorActive && !this.canFly && !isSlidingNow) {
          const iceAccel = mag > 0 ? 3.2 : 1.35;
          this.iceVelX = THREE.MathUtils.damp(this.iceVelX, moveX * 1.18, iceAccel, dt);
          this.iceVelZ = THREE.MathUtils.damp(this.iceVelZ, moveZ * 1.18, iceAccel, dt);
          moveX = this.iceVelX;
          moveZ = this.iceVelZ;
        } else {
          this.iceVelX = moveX;
          this.iceVelZ = moveZ;
        }

        if (this.localGrounded) {
          this.coyoteUntil = now + 110;
        }

        const wantJump = !this.canFly && now < this.jumpBufferUntil && now < this.coyoteUntil;
        if (wantJump) {
          this.jumpBufferUntil = 0;
          this.coyoteUntil = 0;
          this.slideUntil = 0;
          soundEngine.playJump();
        }

        const flyVertical = this.canFly
          ? (this.heldKeys.has('Space') || now < this.jumpBufferUntil ? 1 : 0) -
            (isCrouchingNow ? 1 : 0)
          : 0;

        const resolved = resolvePlayerMovement(
          this.currentZone,
          { x: this.localPos.x, y: this.localPos.y, z: this.localPos.z },
          this.localVelY,
          moveX,
          moveZ,
          wantJump,
          this.localGrounded || wantJump,
          dt,
          this.currentMapId,
          {
            gravityMult: this.lowGravityActive ? 0.42 : 1,
            jumpMult: this.superJumpActive ? 1.65 : 1,
            flyMode: this.canFly,
            flyVertical,
            flySpeed: this.speedBoosted ? 22 : 14,
          },
        );

        this.localPos.set(resolved.x, resolved.y, resolved.z);
        this.localVelY = resolved.velY;
        this.localGrounded = resolved.grounded;

        // Sync movement to server at ~20Hz or on slide/crouch edge
        if (
          now - this.lastNetworkSyncAt > 45 ||
          isSlidingNow !== this.lastSentSlidingState ||
          isCrouchingNow !== this.lastSentCrouchingState
        ) {
          this.lastNetworkSyncAt = now;
          this.lastSentSlidingState = isSlidingNow;
          this.lastSentCrouchingState = isCrouchingNow;
          this.callbacks.onSendMove(
            this.localPos.x,
            this.localPos.y,
            this.localPos.z,
            this.localYaw,
            this.localPitch,
            isSlidingNow,
            isCrouchingNow,
            this.currentZone,
          );
        }
      } else if (now - this.lastSprintAt > 450) {
        this.sprintEnergy = Math.min(100, this.sprintEnergy + 22 * dt);
        if (this.sprintExhausted && this.sprintEnergy >= 20) {
          this.sprintExhausted = false;
        }
      }

      // Position & orient camera with smooth crouch/slide dip, subtle walk bob & decaying shake
      this.currentEyeHeight = THREE.MathUtils.damp(
        this.currentEyeHeight,
        isSlidingNow ? 0.92 : isCrouchingNow && !this.canFly ? 1.04 : PLAYER_EYE_HEIGHT,
        16,
        dt,
      );
      this.cameraRoll = THREE.MathUtils.damp(
        this.cameraRoll,
        isSlidingNow ? -0.055 : 0,
        14,
        dt,
      );
      const bobY =
        !isSlidingNow && this.localGrounded && this.walkBobPhase > 0
          ? Math.sin(this.walkBobPhase) * 0.045
          : 0;
      const shakeX = (Math.random() - 0.5) * this.cameraShake;
      const shakeY = (Math.random() - 0.5) * this.cameraShake;
      this.cameraShake = THREE.MathUtils.damp(this.cameraShake, 0, 14, dt);

      this.camera.position.set(
        this.localPos.x + shakeX,
        this.localPos.y + this.currentEyeHeight + bobY + shakeY,
        this.localPos.z,
      );
      _euler.set(this.localPitch, this.localYaw, this.cameraRoll, 'YXZ');
      this.camera.quaternion.setFromEuler(_euler);

      // Complete reload timer cleanly (Arena only)
      if (inArena && !holdingKnife && this.localReloadEndAt > 0 && now >= this.localReloadEndAt) {
        this.localReloadEndAt = 0;
        this.localAmmo = this.localMaxAmmo;
        if (this.activeSlot === 'sidearm') {
          this.sidearmAmmo = this.localAmmo;
        } else {
          this.primaryAmmo = this.localAmmo;
        }
        soundEngine.playReloadComplete();
        this.pushWeaponHud(now, true);
      }

      const aiming = this.isAimingNow(now);
      const reloading = inArena && !holdingKnife && this.isReloading(now);
      this.aimAlpha = THREE.MathUtils.damp(this.aimAlpha, aiming ? 1 : 0, 16, dt);
      this.reloadAlpha = THREE.MathUtils.damp(this.reloadAlpha, reloading ? 1 : 0, 14, dt);
      this.pushWeaponHud(now);

      // FOV transition: Boosted + Sprint + Slide + Weapon-specific ADS Aim Zoom
      const baseFov =
        (this.localBoosted ? 82 : 74) + (this.isSprintingNow ? 6 : 0) + (isSlidingNow ? 7 : 0);
      const weaponAdsFov = getWeaponById(this.localWeapon).adsFov;
      const adsFov = this.localBoosted ? Math.min(64, weaponAdsFov + 5) : weaponAdsFov;
      const targetFov = THREE.MathUtils.lerp(baseFov, adsFov, this.aimAlpha);
      if (Math.abs(this.camera.fov - targetFov) > 0.08) {
        this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 14, dt);
        this.camera.updateProjectionMatrix();
      }

      // Lobby walking-only First-Person Arms (visible ONLY when walking unarmed in lobby)
      const showWalkArms =
        !inArena && !holdingKnife && this.localAlive && this.isWalkingNow && this.currentPhase !== 'results';
      this.armVisibilityAlpha = THREE.MathUtils.damp(
        this.armVisibilityAlpha,
        showWalkArms ? 1 : 0,
        showWalkArms ? 18 : 14,
        dt,
      );
      this.fpArms.group.visible =
        !inArena && !holdingKnife && this.localAlive && this.armVisibilityAlpha > 0.03;
      if (this.fpArms.group.visible) {
        const swing = Math.sin(this.walkBobPhase) * 0.24;
        const lift = (1 - this.armVisibilityAlpha) * -0.28;
        this.fpArms.leftArm.position.set(-0.34, -0.32 + lift + Math.abs(swing) * 0.04, -0.22 - swing * 0.18);
        this.fpArms.rightArm.position.set(0.34, -0.32 + lift + Math.abs(swing) * 0.04, -0.22 + swing * 0.18);
        this.fpArms.leftArm.rotation.x = swing * 0.42;
        this.fpArms.rightArm.rotation.x = -swing * 0.42;
      }

      // First-Person Knife animation (Lobby & Arena when equipped)
      if (this.knifeView.group.visible) {
        const bobX = Math.cos(this.walkBobPhase * 0.5) * 0.015;
        const bobY = Math.abs(Math.sin(this.walkBobPhase * 0.5)) * -0.012;
        let slashThrust = 0;
        let slashRotX = 0;
        let slashRotY = 0;
        let slashRotZ = 0;
        if (this.knifeSlashEndAt > this.knifeSlashStartAt && now < this.knifeSlashEndAt) {
          const p = (now - this.knifeSlashStartAt) / (this.knifeSlashEndAt - this.knifeSlashStartAt);
          const arc = Math.sin(p * Math.PI);
          slashThrust = arc * 0.22;
          slashRotX = -arc * 0.95;
          slashRotY = arc * 0.68;
          slashRotZ = arc * 0.85;
        }
        this.knifeView.group.position.set(0.28 + bobX - slashThrust * 0.4, -0.25 + bobY, -0.36 - slashThrust);
        this.knifeView.group.rotation.set(slashRotX, slashRotY, slashRotZ);
      }

      // Blaster ADS alignment, reload tilt, recoil & walk sway (Arena only)
      if (inArena && !holdingKnife) {
        this.blasterRecoil = THREE.MathUtils.damp(this.blasterRecoil, 0, 16, dt);
        const swayScale = 1 - this.aimAlpha * 0.78;
        const bobSwayX = Math.cos(this.walkBobPhase * 0.5) * 0.012 * swayScale;
        const bobSwayY = Math.abs(Math.sin(this.walkBobPhase * 0.5)) * -0.01 * swayScale;

        const sidearm = isSidearmWeapon(this.localWeapon);
        const hipX = sidearm ? 0.24 : 0.27;
        const hipY = sidearm ? -0.21 : -0.24;
        const hipZ = sidearm ? -0.31 : -0.34;
        const adsX = 0.0;
        const adsY = sidearm ? -0.135 : -0.145;
        const adsZ = sidearm ? -0.22 : -0.24;

        const baseX = THREE.MathUtils.lerp(hipX, adsX, this.aimAlpha);
        const baseY = THREE.MathUtils.lerp(hipY, adsY, this.aimAlpha) - this.reloadAlpha * 0.11;
        const baseZ = THREE.MathUtils.lerp(hipZ, adsZ, this.aimAlpha) + this.reloadAlpha * 0.05;

        this.blaster.group.position.set(
          baseX + bobSwayX,
          baseY + bobSwayY + this.blasterRecoil * 0.016,
          baseZ + this.blasterRecoil * 0.075,
        );
        this.blaster.group.rotation.x = this.blasterRecoil * 0.14 - this.reloadAlpha * 0.45;
        this.blaster.group.rotation.z = this.reloadAlpha * 0.52;
        this.blaster.coreMat.emissiveIntensity = reloading ? 0.45 : 2.2;
        this.blaster.muzzleFlash.visible = now < this.muzzleFlashUntil;
      }
    }

    // Interpolate remote characters, animate limbs, dark hide&seek visibility & 3D emotes
    const isDarkArena = this.currentZone === 'arena' && this.darkHideAndSeek;
    for (const actor of this.remoteActors.values()) {
      const prevX = actor.currentPos.x;
      const prevZ = actor.currentPos.z;
      actor.currentPos.x = THREE.MathUtils.damp(actor.currentPos.x, actor.targetPos.x, 14, dt);
      actor.currentPos.y = THREE.MathUtils.damp(actor.currentPos.y, actor.targetPos.y, 16, dt);
      actor.currentPos.z = THREE.MathUtils.damp(actor.currentPos.z, actor.targetPos.z, 14, dt);

      // Smooth angle wraparound
      let diff = actor.targetYaw - actor.currentYaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      actor.currentYaw += diff * (1 - Math.exp(-14 * dt));

      actor.rig.root.position.copy(actor.currentPos);
      actor.rig.bodyGroup.rotation.y = actor.currentYaw;

      if (isDarkArena) {
        _vec3A.set(actor.currentPos.x, actor.currentPos.y + 1.4, actor.currentPos.z);
        const dist = this.camera.position.distanceTo(_vec3A);
        let hasLos = false;
        if (dist < 10.5) {
          _dir.copy(_vec3A).sub(this.camera.position).normalize();
          const losDist = raycastZoneGeometry(
            'arena',
            this.camera.position,
            _dir,
            dist,
            this.currentMapId,
          );
          hasLos = losDist >= dist - 0.55;
        }
        actor.rig.nameplate.visible = dist < 10.5 && hasLos;
        for (const mat of actor.rig.emissiveMaterials) {
          mat.emissiveIntensity = 0.04;
        }
        (actor.rig.shieldBubble.material as THREE.MeshBasicMaterial).opacity = 0.04;
      } else {
        actor.rig.nameplate.visible = true;
        for (const mat of actor.rig.emissiveMaterials) {
          mat.emissiveIntensity = 1.45;
        }
        (actor.rig.shieldBubble.material as THREE.MeshBasicMaterial).opacity = 0.24;
      }

      const targetHeadScale = this.bigHeadsActive ? 2.35 : 1;
      const curHeadScale = actor.rig.headGroup.scale.x;
      if (Math.abs(curHeadScale - targetHeadScale) > 0.01) {
        const nextScale = THREE.MathUtils.damp(curHeadScale, targetHeadScale, 12, dt);
        actor.rig.headGroup.scale.setScalar(nextScale);
      }
      actor.rig.nameplate.position.y = this.bigHeadsActive ? 2.6 : 2.18;

      const speed = Math.hypot(actor.currentPos.x - prevX, actor.currentPos.z - prevZ) / Math.max(dt, 0.001);
      const hasWeaponInHand = actor.rig.blasterMesh.visible || actor.rig.knifeMesh.visible;
      const emoteActive = Boolean(actor.activeEmote && now < actor.activeEmoteUntil);

      if (actor.isSliding) {
        actor.rig.leftLeg.rotation.x = THREE.MathUtils.damp(actor.rig.leftLeg.rotation.x, 1.15, 16, dt);
        actor.rig.rightLeg.rotation.x = THREE.MathUtils.damp(actor.rig.rightLeg.rotation.x, 0.85, 16, dt);
        actor.rig.leftArm.rotation.x = THREE.MathUtils.damp(actor.rig.leftArm.rotation.x, -0.45, 14, dt);
        if (!hasWeaponInHand) {
          actor.rig.rightArm.rotation.x = THREE.MathUtils.damp(actor.rig.rightArm.rotation.x, -0.3, 14, dt);
        }
      } else if (actor.isCrouching) {
        const crouchSwing = speed > 0.35 ? Math.sin(now * 0.01) * 0.25 : 0;
        actor.rig.leftLeg.rotation.x = THREE.MathUtils.damp(actor.rig.leftLeg.rotation.x, -0.55 + crouchSwing, 14, dt);
        actor.rig.rightLeg.rotation.x = THREE.MathUtils.damp(actor.rig.rightLeg.rotation.x, -0.55 - crouchSwing, 14, dt);
        actor.rig.leftArm.rotation.x = THREE.MathUtils.damp(actor.rig.leftArm.rotation.x, -crouchSwing * 0.4, 14, dt);
        if (!hasWeaponInHand) {
          actor.rig.rightArm.rotation.x = THREE.MathUtils.damp(actor.rig.rightArm.rotation.x, crouchSwing * 0.4, 14, dt);
        }
      } else if (speed > 0.35) {
        const freq = speed > 9.5 ? 0.017 : 0.012;
        const swing = Math.sin(now * freq) * 0.55;
        actor.rig.leftLeg.rotation.x = swing;
        actor.rig.rightLeg.rotation.x = -swing;
        actor.rig.leftArm.rotation.x = -swing * 0.55;
        if (!hasWeaponInHand) {
          actor.rig.rightArm.rotation.x = swing * 0.55;
        }
      } else {
        actor.rig.leftLeg.rotation.x = THREE.MathUtils.damp(actor.rig.leftLeg.rotation.x, 0, 12, dt);
        actor.rig.rightLeg.rotation.x = THREE.MathUtils.damp(actor.rig.rightLeg.rotation.x, 0, 12, dt);
        actor.rig.leftArm.rotation.x = THREE.MathUtils.damp(actor.rig.leftArm.rotation.x, 0, 12, dt);
        if (!hasWeaponInHand) {
          actor.rig.rightArm.rotation.x = THREE.MathUtils.damp(actor.rig.rightArm.rotation.x, 0, 12, dt);
        }
      }

      if (hasWeaponInHand) {
        actor.rig.rightArm.rotation.x = Math.PI * 0.42;
      }

      if (actor.isSliding) {
        actor.rig.bodyGroup.position.y = THREE.MathUtils.damp(actor.rig.bodyGroup.position.y, -0.46, 16, dt);
        actor.rig.bodyGroup.rotation.x = THREE.MathUtils.damp(actor.rig.bodyGroup.rotation.x, 0.58, 16, dt);
        if (!emoteActive) {
          actor.activeEmote = null;
          actor.rig.emoteSprite.visible = false;
        }
      } else if (actor.isCrouching) {
        actor.rig.bodyGroup.position.y = THREE.MathUtils.damp(actor.rig.bodyGroup.position.y, -0.42, 16, dt);
        actor.rig.bodyGroup.rotation.x = THREE.MathUtils.damp(actor.rig.bodyGroup.rotation.x, 0.16, 16, dt);
        if (!emoteActive) {
          actor.activeEmote = null;
          actor.rig.emoteSprite.visible = false;
        }
      } else if (emoteActive && actor.activeEmote) {
        const remaining = actor.activeEmoteUntil - now;
        const mat = actor.rig.emoteSprite.material as THREE.SpriteMaterial;
        actor.rig.emoteSprite.visible = true;
        actor.rig.emoteSprite.position.y = 2.95 + Math.sin(now * 0.008) * 0.1;
        mat.opacity = remaining < 400 ? Math.max(0, remaining / 400) : 1;

        if (actor.activeEmote === 'wave') {
          actor.rig.leftArm.rotation.x = -2.35;
          actor.rig.leftArm.rotation.z = -0.35 + Math.sin(now * 0.015) * 0.38;
        } else if (actor.activeEmote === 'celebrate') {
          actor.rig.leftArm.rotation.x = -2.55 + Math.sin(now * 0.014) * 0.25;
          if (!hasWeaponInHand) actor.rig.rightArm.rotation.x = -2.55 - Math.sin(now * 0.014) * 0.25;
          actor.rig.bodyGroup.position.y = Math.abs(Math.sin(now * 0.01)) * 0.18;
        } else if (actor.activeEmote === 'laugh') {
          actor.rig.bodyGroup.rotation.x = Math.sin(now * 0.018) * 0.15;
        }
      } else {
        actor.activeEmote = null;
        actor.rig.emoteSprite.visible = false;
        actor.rig.leftArm.rotation.z = THREE.MathUtils.damp(actor.rig.leftArm.rotation.z, 0, 12, dt);
        actor.rig.bodyGroup.position.y = THREE.MathUtils.damp(actor.rig.bodyGroup.position.y, 0, 12, dt);
        actor.rig.bodyGroup.rotation.x = THREE.MathUtils.damp(actor.rig.bodyGroup.rotation.x, 0, 12, dt);
      }
    }

    // Fade active laser beams
    for (let i = this.activeBeams.length - 1; i >= 0; i--) {
      const b = this.activeBeams[i];
      const age = now - b.bornAt;
      if (age >= b.lifeMs) {
        this.dynamicGroup.remove(b.mesh);
        b.mesh.geometry.dispose();
        b.mat.dispose();
        this.activeBeams.splice(i, 1);
      } else {
        b.mat.opacity = 1 - age / b.lifeMs;
      }
    }

    // Update impact sparks
    for (const sp of this.sparkPool) {
      if (!sp.active) continue;
      const age = now - sp.bornAt;
      if (age >= sp.lifeMs) {
        sp.active = false;
        sp.mesh.visible = false;
      } else {
        sp.vel.y -= 18 * dt;
        sp.mesh.position.addScaledVector(sp.vel, dt);
        const s = 1 - age / sp.lifeMs;
        sp.mesh.scale.setScalar(s);
      }
    }
  }

  public projectWorldToScreen(pos: Vec3): { x: number; y: number; visible: boolean } {
    if (!this.camera || !this.renderer || this.disposed) {
      return { x: 0, y: 0, visible: false };
    }
    this.camera.updateMatrixWorld();
    _vec3A.set(pos.x, pos.y, pos.z).project(this.camera);
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (_vec3A.z < -1 || _vec3A.z > 1 || rect.width <= 0 || rect.height <= 0) {
      return { x: 0, y: 0, visible: false };
    }
    return {
      x: (_vec3A.x * 0.5 + 0.5) * rect.width + rect.left,
      y: (-_vec3A.y * 0.5 + 0.5) * rect.height + rect.top,
      visible: true,
    };
  }

  public dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onWindowBlur);
    window.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('touchstart', this.onTouchStart);
    window.removeEventListener('touchmove', this.onTouchMove);
    window.removeEventListener('touchend', this.onTouchEnd);
    window.removeEventListener('touchcancel', this.onTouchEnd);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('contextmenu', this.onContextMenu);
    window.removeEventListener('resize', this.onResize);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);

    this.exitPointerLock();

    if (this.blaster) {
      this.camera?.remove(this.blaster.group);
      disposeObjectTree(this.blaster.group);
    }
    if (this.knifeView) {
      this.camera?.remove(this.knifeView.group);
      disposeObjectTree(this.knifeView.group);
    }
    if (this.fpArms) {
      this.camera?.remove(this.fpArms.group);
      disposeObjectTree(this.fpArms.group);
    }
    for (const actor of this.remoteActors.values()) {
      this.dynamicGroup.remove(actor.rig.root);
      disposeObjectTree(actor.rig.root);
    }
    this.remoteActors.clear();
    for (const entry of this.dropMeshes.values()) {
      this.dynamicGroup.remove(entry.group);
      disposeObjectTree(entry.group);
    }
    this.dropMeshes.clear();
    for (const entry of this.meteorMeshes.values()) {
      this.dynamicGroup.remove(entry.group);
      disposeObjectTree(entry.group);
    }
    this.meteorMeshes.clear();
    for (const b of this.activeBeams) {
      this.dynamicGroup.remove(b.mesh);
      b.mesh.geometry.dispose();
      b.mat.dispose();
    }
    this.activeBeams = [];

    for (const item of this.disposables) {
      item.dispose();
    }
    for (const item of this.arenaDisposables) {
      item.dispose();
    }
    this.renderer?.dispose();
    if (this.renderer?.domElement && this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}

// Keep unused imports clean
void getZoneBoxes;
void _up;
void _quat;
