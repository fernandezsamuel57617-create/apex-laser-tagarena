import { onAuthStateChanged, type User } from 'firebase/auth';
import { useCallback, useEffect, useRef, useState } from 'react';
import { soundEngine } from './audio/soundEngine';
import { CdmCommandModal, type CdmPowersState } from './components/CdmCommandModal';
import { CharacterSelectScreen } from './components/CharacterSelectScreen';
import { DailyMissionsModal } from './components/DailyMissionsModal';
import { EmoteWheelModal } from './components/EmoteWheelModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FriendsModal } from './components/FriendsModal';
import { GameHud, type DamagePopup, type DeathCamHudState } from './components/GameHud';
import { InventoryModal } from './components/InventoryModal';
import { LeaderboardModal, type LeaderboardTab } from './components/LeaderboardModal';
import { OfflineIndicator } from './components/PWAInstallButton';
import type { CreateCustomRoomInput, UpdateRoomRulesInput } from './components/RoomVoiceModal';
import { SplashIntroOverlay, GAME_LOGO_URL } from './components/SplashIntroOverlay';
import { TutorialOverlay } from './components/TutorialOverlay';
import {
  auth,
  claimDailyMissionRewardInProfile,
  loadUserProfile,
  refreshCurrentUser,
  registerWithEmailPassword,
  resendVerificationEmail,
  resetPasswordByEmail,
  respondToRoomInvite,
  saveDailyMissionsProgressToProfile,
  saveEquippedKnifeToProfile,
  saveEquippedOutfitToProfile,
  saveEquippedWeaponSkinToProfile,
  saveEquippedWeaponToProfile,
  saveKnifePurchaseToProfile,
  saveMatchProgressToProfile,
  saveOutfitPurchaseToProfile,
  saveOutfitUpgradeToProfile,
  saveUserProfile,
  saveWeaponPurchaseToProfile,
  saveWeaponSkinPurchaseToProfile,
  sendRoomInvite,
  signInWithEmailPassword,
  signInWithGoogle,
  signInWithGoogleIdToken,
  signInWithSocialProvider,
  signOutGoogle,
  subscribeToIncomingRoomInvites,
  updateUserPresence,
  type FriendProfileItem,
  type RoomInviteRecord,
  type SavedPlayerProfile,
  type SocialAuthProviderId,
} from './firebase';
import { ArenaEngine, type WeaponHudState } from './game/ArenaEngine';
import {
  DAILY_MISSIONS,
  applyMatchStatsToDailyMissions,
  createEmptyDailyMissions,
  ensureTodayDailyMissions,
  getDailyMissionById,
  isMissionCompleted,
  type DailyMissionId,
  type DailyMissionsProgress,
} from './shared/dailyMissions';
import { EMOTES, type EmoteId } from './shared/emotes';
import { getKnifeById, type KnifeId } from './shared/knives';
import {
  getOutfitById,
  getOutfitLevel,
  getOutfitUpgradeCost,
  type OutfitId,
} from './shared/outfits';
import {
  loadPlayerSettings,
  savePlayerSettings,
  type PlayerSettings,
} from './shared/playerSettings';
import { getWeaponById, isSidearmWeapon, type WeaponId } from './shared/weapons';
import { getWeaponSkinById, type WeaponSkinId } from './shared/weaponSkins';
import type {
  ArenaMapId,
  BannedPlayerRecord,
  CdmCommandId,
  ChatMessageEvent,
  ClientToServerMessage,
  GamePhase,
  Gender,
  KillFeedEvent,
  LeaderboardEntry,
  MatchMode,
  OwnerAnnouncement,
  PublicRoomSummary,
  ServerStatePayload,
  ServerToClientMessage,
  TeamMode,
  Vec3,
  VoiceSignalData,
  WeaponSlot,
} from './shared/types';
import { VoiceManager, type VoiceStatus } from './voice/voiceManager';

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<ArenaEngine | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const [webglOk, setWebglOk] = useState(true);
  const [splashDone, setSplashDone] = useState(false);
  const [joined, setJoined] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  const [authReady, setAuthReady] = useState(false);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authEmailVerified, setAuthEmailVerified] = useState(false);
  const [savedProfile, setSavedProfile] = useState<SavedPlayerProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [myId, setMyId] = useState<string | null>(null);
  const [pingMs, setPingMs] = useState<number | null>(null);
  const [serverState, setServerState] = useState<ServerStatePayload | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [leaderboardTab, setLeaderboardTab] = useState<LeaderboardTab>('global');
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [missionsOpen, setMissionsOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [incomingInvites, setIncomingInvites] = useState<RoomInviteRecord[]>([]);
  const [emoteOpen, setEmoteOpen] = useState(false);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [publicRooms, setPublicRooms] = useState<PublicRoomSummary[]>([]);
  const [dailyMissions, setDailyMissions] = useState<DailyMissionsProgress>(() =>
    createEmptyDailyMissions(),
  );
  const [chatMessages, setChatMessages] = useState<ChatMessageEvent[]>([]);
  const [chatBlockedReason, setChatBlockedReason] = useState<string | null>(null);
  const [chatFocusSignal, setChatFocusSignal] = useState(0);
  const [touchInputMode, setTouchInputMode] = useState(false);
  const [playerSettings, setPlayerSettings] = useState<PlayerSettings>(() =>
    loadPlayerSettings(),
  );
  const [reportedIds, setReportedIds] = useState<Record<string, boolean>>({});
  const [reportFeedback, setReportFeedback] = useState<string | null>(null);

  const [muted, setMuted] = useState(false);
  const [cdmOpen, setCdmOpen] = useState(false);
  const [cdmFeedback, setCdmFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [bannedPlayers, setBannedPlayers] = useState<BannedPlayerRecord[]>([]);
  const [ownerAnnouncement, setOwnerAnnouncement] = useState<OwnerAnnouncement | null>(null);
  const [ownerAnnouncementLog, setOwnerAnnouncementLog] = useState<OwnerAnnouncement[]>([]);
  const [bannerLogoFailed, setBannerLogoFailed] = useState(false);
  const [cdmPowers, setCdmPowers] = useState<CdmPowersState>({
    canFly: false,
    speedBoosted: false,
    godMode: false,
    infiniteAmmo: false,
    infiniteCoins: false,
  });
  const [killFeed, setKillFeed] = useState<KillFeedEvent[]>([]);
  const [hitMarker, setHitMarker] = useState({ active: false, isCrit: false, killed: false });
  const [damagePopups, setDamagePopups] = useState<DamagePopup[]>([]);
  const [damageFlash, setDamageFlash] = useState(false);
  const [deathCam, setDeathCam] = useState<DeathCamHudState | null>(null);
  const [weaponState, setWeaponState] = useState<WeaponHudState>({
    weaponId: 'pulse_carbine',
    activeSlot: 'primary',
    primaryWeaponId: 'pulse_carbine',
    sidearmWeaponId: 'tactical_pistol',
    knifeId: 'tactical_blade',
    isAiming: false,
    ammo: 12,
    maxAmmo: 12,
    primaryAmmo: 12,
    primaryMaxAmmo: 12,
    sidearmAmmo: 10,
    sidearmMaxAmmo: 10,
    isReloading: false,
    reloadProgress: 0,
    sprintEnergy: 100,
    isSprinting: false,
    isSliding: false,
    isCrouching: false,
    canFly: false,
    zone: 'lobby',
  });
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>({
    connected: false,
    room: null,
    micMuted: false,
    deafened: false,
    hasMic: false,
    speaking: false,
    error: null,
  });

  const voiceManagerRef = useRef<VoiceManager | null>(null);
  const hitTimerRef = useRef<number>(0);
  const dmgTimerRef = useRef<number>(0);
  const damagePopupSeqRef = useRef<number>(0);
  const recentDamageComboRef = useRef<{ total: number; lastAt: number }>({ total: 0, lastAt: 0 });
  const reportFeedbackTimerRef = useRef<number>(0);
  const lastCountdownSecRef = useRef<number>(0);
  const prevPhaseRef = useRef<GamePhase>('lobby');
  const myIdRef = useRef<string | null>(null);
  const authUserRef = useRef<User | null>(null);
  const savedProfileRef = useRef<SavedPlayerProfile | null>(null);
  const dailyMissionsRef = useRef<DailyMissionsProgress>(dailyMissions);
  const pendingInviteFriendRef = useRef<FriendProfileItem | null>(null);
  const autoEnteredUidRef = useRef<string | null>(null);

  useEffect(() => {
    authUserRef.current = authUser;
  }, [authUser]);

  useEffect(() => {
    engineRef.current?.setPointerLockSuppressed(cdmOpen);
  }, [cdmOpen]);

  useEffect(() => {
    if (!ownerAnnouncement) return;
    const remaining = ownerAnnouncement.expiresAt - Date.now();
    if (remaining <= 0) {
      setOwnerAnnouncement(null);
      return;
    }
    const timer = window.setTimeout(() => {
      setOwnerAnnouncement(null);
    }, remaining + 80);
    return () => window.clearTimeout(timer);
  }, [ownerAnnouncement]);

  useEffect(() => {
    savedProfileRef.current = savedProfile;
    if (savedProfile?.dailyMissions) {
      setDailyMissions(ensureTodayDailyMissions(savedProfile.dailyMissions));
    }
  }, [savedProfile]);

  useEffect(() => {
    dailyMissionsRef.current = dailyMissions;
  }, [dailyMissions]);

  const sendWs = useCallback((msg: ClientToServerMessage) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }, []);

  // Fetch initial persistent leaderboard
  useEffect(() => {
    fetch('/api/leaderboard')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.leaderboard)) {
          setLeaderboard(data.leaderboard);
        }
      })
      .catch(() => {});
  }, []);

  // Listen for Google Auth state & load saved user profile from Firestore
  useEffect(() => {
    const fallbackTimer = window.setTimeout(() => {
      setAuthReady(true);
    }, 2500);

    const unsub = onAuthStateChanged(auth, async (user) => {
      window.clearTimeout(fallbackTimer);
      setAuthUser(user);
      setAuthEmailVerified(Boolean(user?.emailVerified));
      setAuthError(null);
      if (!user) {
        setSavedProfile(null);
        setProfileLoading(false);
        setAuthReady(true);
        return;
      }

      setProfileLoading(true);
      try {
        const profile = await loadUserProfile(user.uid);
        setSavedProfile(profile);
      } catch (err) {
        console.error('Error loading profile:', err);
        setAuthError('No se pudo cargar tu perfil guardado de Firebase.');
      } finally {
        setProfileLoading(false);
        setAuthReady(true);
      }
    });
    return () => {
      window.clearTimeout(fallbackTimer);
      unsub();
    };
  }, []);

  // Subscribe to incoming private room invitations from friends
  useEffect(() => {
    if (!authUser || !authUser.emailVerified) {
      setIncomingInvites([]);
      return;
    }
    const unsub = subscribeToIncomingRoomInvites(authUser.uid, (invites) => {
      setIncomingInvites(invites);
    });
    return () => unsub();
  }, [authUser]);

  // Publish live online presence & active room code while authenticated and profile exists
  useEffect(() => {
    if (!authUser || !authUser.emailVerified || !savedProfile) return;
    const status =
      joined && serverState?.phase === 'playing' ? ('in_match' as const) : ('online' as const);
    const roomCode = joined && serverState?.roomCode ? serverState.roomCode : 'PUBLIC';

    void updateUserPresence(authUser.uid, status, roomCode).catch(() => {});
    const timer = window.setInterval(() => {
      void updateUserPresence(authUser.uid, status, roomCode).catch(() => {});
    }, 35_000);
    return () => window.clearInterval(timer);
  }, [authUser, savedProfile, joined, serverState?.phase, serverState?.roomCode]);

  // Monitor WebSocket RTT latency every 2 seconds while connected
  useEffect(() => {
    if (!joined) {
      setPingMs(null);
      return;
    }
    const sendPing = () => {
      sendWs({ type: 'ping', t: performance.now() });
    };
    sendPing();
    const timer = window.setInterval(sendPing, 2000);
    return () => window.clearInterval(timer);
  }, [joined, sendWs]);

  // Mount isolated Three.js canvas once
  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    const engine = new ArenaEngine(container, {
      onSendMove: (x, y, z, yaw, pitch, sliding, crouching, zone) => {
        sendWs({ type: 'move', x, y, z, yaw, pitch, sliding, crouching, zone });
      },
      onSendShoot: (origin: Vec3, dir: Vec3) => {
        sendWs({ type: 'shoot', origin, dir });
      },
      onSendMeleeSlash: (origin: Vec3, dir: Vec3) => {
        sendWs({ type: 'melee_slash', origin, dir });
      },
      onSendSwitchSlot: (slot: WeaponSlot) => {
        sendWs({ type: 'switch_slot', slot });
      },
      onSendReload: () => {
        sendWs({ type: 'reload' });
      },
      onWeaponStateChange: (nextWeapon) => {
        setWeaponState(nextWeapon);
      },
      onPointerLockChange: () => {},
      onWebGLStatus: (ok) => {
        setWebglOk(ok);
      },
      onTouchModeChange: (isTouch) => {
        setTouchInputMode(isTouch);
      },
    });
    const initialSettings = loadPlayerSettings();
    engine.setLookSensitivity(initialSettings.sensitivity);
    engine.setGraphicsQuality(initialSettings.graphicsQuality);
    engineRef.current = engine;
    setTouchInputMode(engine.isTouchInputMode());

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, [sendWs]);

  // Persist and apply sensitivity & graphics settings live to ArenaEngine
  useEffect(() => {
    savePlayerSettings(playerSettings);
    engineRef.current?.setLookSensitivity(playerSettings.sensitivity);
    engineRef.current?.setGraphicsQuality(playerSettings.graphicsQuality);
  }, [playerSettings]);

  // Instantiate WebRTC VoiceManager once
  useEffect(() => {
    const vm = new VoiceManager({
      onSendSignal: (targetId: string, signal: VoiceSignalData) => {
        sendWs({ type: 'voice:signal', targetId, signal });
      },
      onSpeakingChange: (speaking: boolean) => {
        sendWs({ type: 'voice:speaking', speaking });
      },
      onStatusChange: (status: VoiceStatus) => {
        setVoiceStatus(status);
      },
    });
    voiceManagerRef.current = vm;

    return () => {
      vm.dispose();
      voiceManagerRef.current = null;
    };
  }, [sendWs]);

  // Sync WebRTC peers when players in the same voice room change
  useEffect(() => {
    if (!serverState || !voiceStatus.connected || !voiceStatus.room) return;
    const peerIds = serverState.players
      .filter((p) => !p.isBot && p.voiceRoom === voiceStatus.room)
      .map((p) => p.id);
    voiceManagerRef.current?.syncPeers(peerIds);
  }, [serverState, voiceStatus.connected, voiceStatus.room]);

  // Countdown audio cues, pointer lock release on results, and clean UI return to lobby
  useEffect(() => {
    if (!serverState) return;
    const prevPhase = prevPhaseRef.current;
    prevPhaseRef.current = serverState.phase;

    if (serverState.phase === 'countdown') {
      const sec = Math.max(1, Math.ceil((serverState.phaseEndsAt - serverState.serverTime) / 1000));
      if (sec !== lastCountdownSecRef.current) {
        lastCountdownSecRef.current = sec;
        soundEngine.playCountdownBeep(false);
      }
    } else if (serverState.phase === 'playing' && lastCountdownSecRef.current > 0) {
      lastCountdownSecRef.current = 0;
      soundEngine.playCountdownBeep(true);
    } else if (serverState.phase === 'results') {
      engineRef.current?.exitPointerLock();
    } else if (serverState.phase === 'lobby' && prevPhase === 'results') {
      lastCountdownSecRef.current = 0;
      setLeaderboardOpen(false);
    }
  }, [serverState]);

  const formatAuthError = (err: unknown, providerLabel = 'este método'): string => {
    const code = (err as { code?: string } | null)?.code || '';
    const msg = err instanceof Error ? err.message : String(err ?? '');
    if (code === 'auth/operation-not-allowed') {
      return `El acceso con ${providerLabel} aún no está activado en Firebase Console (Authentication → Sign-in method).`;
    }
    if (code === 'auth/account-exists-with-different-credential') {
      return 'Ya existe una cuenta registrada con ese correo usando otro método (por ejemplo Google). Inicia sesión con ese método primero.';
    }
    if (code === 'auth/email-already-in-use') {
      return 'Ese correo ya tiene una cuenta registrada. Cambia a "Iniciar sesión" o usa "Olvidé mi clave".';
    }
    if (code === 'auth/invalid-email') {
      return 'El formato del correo electrónico no es válido.';
    }
    if (code === 'auth/weak-password') {
      return 'La contraseña debe tener al menos 6 caracteres.';
    }
    if (
      code === 'auth/invalid-credential' ||
      code === 'auth/wrong-password' ||
      code === 'auth/user-not-found'
    ) {
      return 'Correo o contraseña incorrectos.';
    }
    if (code === 'auth/too-many-requests') {
      return 'Demasiados intentos seguidos. Espera un momento antes de volver a intentarlo.';
    }
    if (code === 'auth/popup-closed-by-user' || msg.includes('popup-closed-by-user')) {
      return `La ventana de ${providerLabel} se cerró antes de completar el acceso. Si estás dentro de una vista previa, abre el juego en una pestaña nueva o usa Correo y contraseña.`;
    }
    if (code === 'auth/popup-blocked' || msg.includes('popup-blocked')) {
      return 'El navegador bloqueó la ventana emergente. Permite ventanas emergentes o abre el juego en una pestaña nueva.';
    }
    if (code === 'auth/unauthorized-domain' || msg.includes('unauthorized-domain')) {
      return `Dominio no autorizado en Firebase (${window.location.hostname}). Agrégalo en Firebase Console → Authentication → Settings → Authorized domains.`;
    }
    if (code === 'auth/cancelled-popup-request') {
      return 'Se canceló la solicitud anterior. Intenta iniciar sesión nuevamente.';
    }
    return `No se pudo iniciar sesión con ${providerLabel} (${code || 'error de conexión'}).`;
  };

  const handleGoogleCredential = useCallback(async (idToken: string) => {
    setSigningIn(true);
    setAuthError(null);
    try {
      await signInWithGoogleIdToken(idToken);
    } catch (err) {
      console.error('Google GIS credential error:', err);
      setAuthError(formatAuthError(err, 'Google'));
    } finally {
      setSigningIn(false);
    }
  }, []);

  const handleGoogleSignIn = useCallback(async () => {
    setSigningIn(true);
    setAuthError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error('Google Popup error:', err);
      setAuthError(formatAuthError(err, 'Google'));
    } finally {
      setSigningIn(false);
    }
  }, []);

  const handleSocialSignIn = useCallback(async (providerId: SocialAuthProviderId) => {
    const labelMap: Record<SocialAuthProviderId, string> = {
      google: 'Google',
      github: 'GitHub',
      microsoft: 'Microsoft',
      facebook: 'Facebook',
      twitter: 'X (Twitter)',
    };
    setSigningIn(true);
    setAuthError(null);
    try {
      await signInWithSocialProvider(providerId);
    } catch (err) {
      console.error(`Social auth (${providerId}) error:`, err);
      setAuthError(formatAuthError(err, labelMap[providerId]));
    } finally {
      setSigningIn(false);
    }
  }, []);

  const handleEmailSignIn = useCallback(async (email: string, password: string) => {
    setSigningIn(true);
    setAuthError(null);
    try {
      await signInWithEmailPassword(email, password);
    } catch (err) {
      console.error('Email sign-in error:', err);
      setAuthError(formatAuthError(err, 'Correo y contraseña'));
    } finally {
      setSigningIn(false);
    }
  }, []);

  const handleEmailRegister = useCallback(
    async (email: string, password: string, displayName?: string) => {
      setSigningIn(true);
      setAuthError(null);
      try {
        await registerWithEmailPassword(email, password, displayName);
      } catch (err) {
        console.error('Email register error:', err);
        setAuthError(formatAuthError(err, 'registro por correo'));
      } finally {
        setSigningIn(false);
      }
    },
    [],
  );

  const handleResetPassword = useCallback(async (email: string): Promise<boolean> => {
    setSigningIn(true);
    setAuthError(null);
    try {
      await resetPasswordByEmail(email);
      return true;
    } catch (err) {
      console.error('Password reset error:', err);
      setAuthError(formatAuthError(err, 'recuperación de contraseña'));
      return false;
    } finally {
      setSigningIn(false);
    }
  }, []);

  const handleResendVerification = useCallback(async (): Promise<boolean> => {
    setAuthError(null);
    try {
      await resendVerificationEmail();
      return true;
    } catch (err) {
      console.error('Resend verification error:', err);
      setAuthError(formatAuthError(err, 'envío de verificación'));
      return false;
    }
  }, []);

  const handleRefreshVerification = useCallback(async (): Promise<boolean> => {
    setAuthError(null);
    try {
      const verified = await refreshCurrentUser();
      setAuthEmailVerified(verified);
      if (verified && auth.currentUser) {
        const profile = await loadUserProfile(auth.currentUser.uid);
        setSavedProfile(profile);
        if (joined && wsRef.current?.readyState === WebSocket.OPEN) {
          const token = await auth.currentUser.getIdToken(true).catch(() => '');
          if (token) {
            sendWs({ type: 'auth_refresh', authIdToken: token });
          }
        }
      }
      return verified;
    } catch (err) {
      console.error('Refresh verification error:', err);
      return false;
    }
  }, [joined, sendWs]);

  const handleGoogleSignOut = useCallback(async () => {
    setAuthError(null);
    try {
      if (authUserRef.current && savedProfileRef.current) {
        await updateUserPresence(authUserRef.current.uid, 'offline', 'PUBLIC').catch(() => {});
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      autoEnteredUidRef.current = null;
      setJoined(false);
      setConnecting(false);
      setServerState(null);
      myIdRef.current = null;
      setMyId(null);
      engineRef.current?.setMode('preview');
      await signOutGoogle();
      setAuthEmailVerified(false);
      setSavedProfile(null);
    } catch {
      setAuthError('No se pudo cerrar la sesión.');
    }
  }, []);

  const handleEnterLobby = useCallback(
    async (
      name: string,
      gender: Gender,
      country?: string,
      options?: { skipTutorial?: boolean },
    ) => {
      const cleanName = name.trim().slice(0, 18) || 'Agente';
      const cleanCountry = country?.trim().toUpperCase() || savedProfileRef.current?.country;
      setConnectError(null);
      setAuthError(null);
      setRoomError(null);

      let activeProfile = savedProfileRef.current;

      if (authUser && authUser.emailVerified && !activeProfile) {
        setSavingProfile(true);
        try {
          const updated = await saveUserProfile(authUser.uid, cleanName, gender, cleanCountry);
          setSavedProfile(updated);
          activeProfile = updated;
        } catch (err) {
          console.error('Failed to save user profile:', err);
          setAuthError('No se pudo guardar tu perfil en Firestore.');
          setSavingProfile(false);
          return;
        }
        setSavingProfile(false);
      }

      setConnecting(true);

      let authIdToken: string | undefined;
      const currentAuthUser = authUser ?? authUserRef.current;
      if (currentAuthUser && currentAuthUser.emailVerified) {
        try {
          authIdToken = await currentAuthUser.getIdToken();
        } catch {
          authIdToken = undefined;
        }
      }

      if (wsRef.current) {
        const prevWs = wsRef.current;
        wsRef.current = null;
        prevWs.close();
      }
      myIdRef.current = null;

      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${proto}//${window.location.host}/ws`);
      wsRef.current = ws;

      let welcomed = false;

      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            type: 'join',
            name: cleanName,
            gender,
            country: cleanCountry,
            coins: activeProfile?.coins ?? 0,
            rankedWins: activeProfile?.rankedWins ?? 0,
            ownedOutfits: activeProfile?.ownedOutfits ?? ['default'],
            equippedOutfit: activeProfile?.equippedOutfit ?? 'default',
            outfitLevels: activeProfile?.outfitLevels ?? { default: 1 },
            ownedWeapons: activeProfile?.ownedWeapons ?? ['pulse_carbine', 'tactical_pistol'],
            equippedWeapon: activeProfile?.equippedWeapon ?? 'pulse_carbine',
            equippedSidearm: activeProfile?.equippedSidearm ?? 'tactical_pistol',
            ownedKnives: activeProfile?.ownedKnives ?? ['tactical_blade'],
            equippedKnife: activeProfile?.equippedKnife ?? 'tactical_blade',
            ownedWeaponSkins: activeProfile?.ownedWeaponSkins ?? ['default'],
            equippedWeaponSkin: activeProfile?.equippedWeaponSkin ?? 'default',
            ...(authIdToken ? { authIdToken } : {}),
          } satisfies ClientToServerMessage),
        );
      };

      ws.onmessage = (event) => {
        let msg: ServerToClientMessage;
        try {
          msg = JSON.parse(event.data);
        } catch {
          return;
        }

        if (msg.type === 'welcome') {
          welcomed = true;
          myIdRef.current = msg.playerId;
          setMyId(msg.playerId);
          voiceManagerRef.current?.setMyId(msg.playerId);
          setServerState(msg.state);
          setLeaderboard(msg.leaderboard);
          setDeathCam(null);
          setChatMessages([]);
          setChatBlockedReason(null);
          setCdmOpen(false);
          setCdmFeedback(null);
          setBannedPlayers([]);
          setOwnerAnnouncement(msg.ownerAnnouncement ?? null);
          if (msg.ownerAnnouncement) {
            setOwnerAnnouncementLog((prev) =>
              prev.some((a) => a.id === msg.ownerAnnouncement!.id)
                ? prev
                : [...prev, msg.ownerAnnouncement!].slice(-20),
            );
          }
          setCdmPowers({
            canFly: false,
            speedBoosted: false,
            godMode: false,
            infiniteAmmo: false,
            infiniteCoins: false,
          });
          setReportedIds({});
          setReportFeedback(null);
          setJoined(true);
          setConnecting(false);
          if (!options?.skipTutorial) {
            setTutorialOpen(true);
          }
          engineRef.current?.setMode('play');
          engineRef.current?.applyServerState(msg.state, msg.playerId);
        } else if (msg.type === 'state') {
          setServerState(msg.state);
          engineRef.current?.applyServerState(msg.state, myIdRef.current);
          if (msg.state.phase !== 'lobby') {
            setInventoryOpen(false);
          }
          if (msg.state.phase !== 'playing') {
            setDamagePopups([]);
          }
          const localMe = msg.state.players.find((p) => p.id === myIdRef.current);
          if (msg.state.phase !== 'playing' || localMe?.alive) {
            setDeathCam(null);
          }
        } else if (msg.type === 'beam') {
          engineRef.current?.spawnBeam(msg.beam);
        } else if (msg.type === 'hit_confirm') {
          soundEngine.playHitConfirm(msg.isCrit);
          engineRef.current?.triggerHitFeel(msg.killed);
          setHitMarker({ active: true, isCrit: msg.isCrit, killed: msg.killed });
          window.clearTimeout(hitTimerRef.current);
          hitTimerRef.current = window.setTimeout(() => {
            setHitMarker({ active: false, isCrit: false, killed: false });
          }, 160);

          const nowPerf = performance.now();
          const comboActive = nowPerf - recentDamageComboRef.current.lastAt <= 1350;
          const nextComboTotal = (comboActive ? recentDamageComboRef.current.total : 0) + msg.damage;
          recentDamageComboRef.current = { total: nextComboTotal, lastAt: nowPerf };

          const projected = msg.hitPos ? engineRef.current?.projectWorldToScreen(msg.hitPos) : null;
          const fallbackX = window.innerWidth * 0.5;
          const fallbackY = window.innerHeight * 0.44;
          const baseX = projected?.visible ? projected.x : fallbackX;
          const baseY = projected?.visible ? projected.y : fallbackY;
          const jitterX = (Math.random() - 0.5) * 26;
          const jitterY = -12 + (Math.random() - 0.5) * 14;
          const clampedX = Math.max(48, Math.min(window.innerWidth - 48, baseX + jitterX));
          const clampedY = Math.max(60, Math.min(window.innerHeight - 60, baseY + jitterY));
          const popupId = ++damagePopupSeqRef.current;

          setDamagePopups((prev) => [
            ...prev.slice(-11),
            {
              id: popupId,
              damage: msg.damage,
              isCrit: msg.isCrit,
              killed: msg.killed,
              x: clampedX,
              y: clampedY,
              comboTotal: nextComboTotal,
            },
          ]);
          window.setTimeout(() => {
            setDamagePopups((prev) => prev.filter((item) => item.id !== popupId));
          }, 850);
        } else if (msg.type === 'damaged') {
          engineRef.current?.triggerDamagedFeel();
          setDamageFlash(true);
          window.clearTimeout(dmgTimerRef.current);
          dmgTimerRef.current = window.setTimeout(() => {
            setDamageFlash(false);
          }, 170);
        } else if (msg.type === 'eliminated') {
          engineRef.current?.triggerDeathCam(msg.killerId, msg.deathCamDurationMs);
          setDeathCam({
            killerId: msg.killerId,
            killerName: msg.killerName,
            killerGender: msg.killerGender,
            killerCountry: msg.killerCountry,
            killerOutfit: msg.killerOutfit,
            isCrit: msg.isCrit,
            endsAt: performance.now() + msg.deathCamDurationMs,
            totalMs: msg.deathCamDurationMs,
          });
        } else if (msg.type === 'match_reward') {
          const user = authUserRef.current;
          const nextMissions = applyMatchStatsToDailyMissions(dailyMissionsRef.current, {
            tags: msg.tags,
            won: msg.won,
            bestStreak: msg.bestStreak,
          });
          setDailyMissions(nextMissions);
          const safeTotalCoins = Math.min(
            1_000_000,
            (savedProfileRef.current?.coins ?? 0) + msg.coinsEarned,
          );
          if (user && user.emailVerified) {
            void saveMatchProgressToProfile(
              user.uid,
              safeTotalCoins,
              msg.matchMode === 'ranked' ? msg.rankedWins : undefined,
              msg.coinsEarned,
            ).catch((err) => {
              console.error('Failed to persist match progress:', err);
            });
            void saveDailyMissionsProgressToProfile(user.uid, nextMissions).catch((err) => {
              console.error('Failed to persist daily missions:', err);
            });
          }
          setSavedProfile((prev) =>
            prev
              ? {
                  ...prev,
                  coins: safeTotalCoins,
                  rankedWins: msg.rankedWins,
                  dailyMissions: nextMissions,
                }
              : prev,
          );
        } else if (msg.type === 'killfeed') {
          setKillFeed((prev) => [msg.event, ...prev].slice(0, 6));
        } else if (msg.type === 'leaderboard') {
          setLeaderboard(msg.leaderboard);
        } else if (msg.type === 'player_emote') {
          engineRef.current?.applyRemoteEmote(
            msg.playerId,
            msg.emote,
            Math.max(500, msg.expiresAt - Date.now()),
          );
        } else if (msg.type === 'chat') {
          setChatMessages((prev) => [...prev, msg.message].slice(-40));
          setChatBlockedReason(null);
        } else if (msg.type === 'chat_blocked') {
          setChatBlockedReason(msg.reason);
        } else if (msg.type === 'room_error') {
          setRoomError(msg.message);
        } else if (msg.type === 'public_rooms') {
          setPublicRooms(msg.rooms);
        } else if (msg.type === 'cdm_response') {
          if (msg.authorized) {
            if (Array.isArray(msg.bannedPlayers)) {
              setBannedPlayers(msg.bannedPlayers);
            }
            if (msg.activePowers) {
              setCdmPowers({
                canFly: Boolean(msg.activePowers.canFly),
                speedBoosted: Boolean(msg.activePowers.speedBoosted),
                godMode: Boolean(msg.activePowers.godMode),
                infiniteAmmo: Boolean(msg.activePowers.infiniteAmmo),
                infiniteCoins: Boolean(msg.activePowers.infiniteCoins),
              });
            }
            if (msg.openPanel) {
              engineRef.current?.exitPointerLock();
              setCdmOpen(true);
            }
            if (msg.message) {
              setCdmFeedback({ ok: msg.ok !== false, text: msg.message });
            }
            setChatBlockedReason(null);
          } else {
            const deniedMsg = msg.message || 'No se pudo abrir CDM.';
            setCdmOpen(false);
            setCdmPowers({
              canFly: false,
              speedBoosted: false,
              godMode: false,
              infiniteAmmo: false,
              infiniteCoins: false,
            });
            setChatBlockedReason(deniedMsg);
          }
        } else if (msg.type === 'report_ack') {
          if (msg.accepted) {
            setReportedIds((prev) => ({ ...prev, [msg.targetId]: true }));
          }
          setReportFeedback(msg.message);
          window.clearTimeout(reportFeedbackTimerRef.current);
          reportFeedbackTimerRef.current = window.setTimeout(() => {
            setReportFeedback(null);
          }, 4200);
        } else if (msg.type === 'voice:signal') {
          voiceManagerRef.current?.handleSignal(msg.fromId, msg.signal);
        } else if (msg.type === 'voice:peer_left') {
          voiceManagerRef.current?.removePeer(msg.peerId);
        } else if (msg.type === 'teleport_to') {
          engineRef.current?.teleportTo(msg.zone, msg.x, msg.y, msg.z, msg.yaw);
        } else if (msg.type === 'owner_announcement') {
          const nextAnn = msg.announcement ?? null;
          setOwnerAnnouncement(nextAnn);
          if (nextAnn) {
            setOwnerAnnouncementLog((prev) =>
              prev.some((a) => a.id === nextAnn.id) ? prev : [...prev, nextAnn].slice(-20),
            );
          }
        } else if (msg.type === 'pong') {
          const rtt = Math.max(1, Math.round(performance.now() - msg.t));
          setPingMs(rtt);
        }
      };

      ws.onerror = () => {
        if (wsRef.current !== ws) return;
        if (!welcomed) {
          setConnecting(false);
          setConnectError('No se pudo conectar con el servidor multijugador.');
        }
      };

      ws.onclose = (event) => {
        if (wsRef.current !== ws) return;
        wsRef.current = null;
        voiceManagerRef.current?.leaveRoom();
        setPingMs(null);
        setCdmOpen(false);
        setOwnerAnnouncement(null);
        myIdRef.current = null;
        setMyId(null);
        const isBannedClose = event.code === 4003 || event.reason === 'banned';
        if (!welcomed) {
          setConnecting(false);
          setConnectError(
            isBannedClose
              ? 'Has sido expulsado y baneado por el administrador del servidor.'
              : 'Conexión cerrada antes de entrar al lobby.',
          );
        } else {
          setJoined(false);
          setServerState(null);
          setConnecting(false);
          setConnectError(
            isBannedClose
              ? 'Has sido expulsado y baneado por el administrador del servidor.'
              : 'Se perdió la conexión con el servidor. Vuelve a entrar.',
          );
          engineRef.current?.setMode('preview');
        }
      };
    },
    [authUser],
  );

  // Keep latest myId in ref for ws.onmessage closure
  useEffect(() => {
    myIdRef.current = myId;
  }, [myId]);

  // Automatically enter Lobby once splash finishes if user already has a saved Google account
  useEffect(() => {
    if (
      !splashDone ||
      !authReady ||
      profileLoading ||
      !authUser ||
      !savedProfile ||
      joined ||
      connecting ||
      connectError
    ) {
      return;
    }
    if (autoEnteredUidRef.current === authUser.uid) return;
    autoEnteredUidRef.current = authUser.uid;
    void handleEnterLobby(savedProfile.playerName, savedProfile.gender, savedProfile.country, {
      skipTutorial: true,
    });
  }, [
    splashDone,
    authReady,
    profileLoading,
    authUser,
    savedProfile,
    joined,
    connecting,
    connectError,
    handleEnterLobby,
  ]);

  // Sync Firebase auth token with active WebSocket session if login state changes
  useEffect(() => {
    if (!joined || wsRef.current?.readyState !== WebSocket.OPEN) {
      return;
    }
    let cancelled = false;
    const syncAuth = async () => {
      let token = '';
      if (authUser && authUser.emailVerified) {
        try {
          token = await authUser.getIdToken();
        } catch {
          token = '';
        }
      }
      if (!cancelled && wsRef.current?.readyState === WebSocket.OPEN) {
        sendWs({ type: 'auth_refresh', authIdToken: token });
      }
    };
    void syncAuth();
    return () => {
      cancelled = true;
    };
  }, [authUser, joined, sendWs]);

  // Cleanup WebSocket on unmount
  useEffect(() => {
    return () => {
      wsRef.current?.close();
    };
  }, []);

  // Global keyboard shortcuts inside Lobby & Match
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!joined) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (
        e.code === 'Enter' &&
        serverState?.phase === 'lobby' &&
        !leaderboardOpen &&
        !inventoryOpen &&
        !missionsOpen &&
        !tutorialOpen &&
        !friendsOpen &&
        !emoteOpen &&
        !cdmOpen
      ) {
        e.preventDefault();
        sendWs({ type: 'start_match' });
        engineRef.current?.requestPointerLock();
      } else if (e.code === 'KeyT' && serverState?.phase !== 'results') {
        e.preventDefault();
        engineRef.current?.exitPointerLock();
        setChatFocusSignal((n) => n + 1);
      } else if (e.code === 'KeyG' && !cdmOpen) {
        e.preventDefault();
        engineRef.current?.toggleKnifeSlot();
      } else if (e.code === 'KeyB' && !cdmOpen) {
        e.preventDefault();
        setEmoteOpen((open) => {
          const next = !open;
          if (next) engineRef.current?.exitPointerLock();
          return next;
        });
      } else if (
        ['Digit1', 'Digit2', 'Digit3'].includes(e.code) &&
        !leaderboardOpen &&
        !inventoryOpen &&
        !missionsOpen &&
        !tutorialOpen &&
        !friendsOpen &&
        !emoteOpen &&
        !cdmOpen
      ) {
        e.preventDefault();
        if (e.code === 'Digit1') engineRef.current?.switchSlot('primary');
        else if (e.code === 'Digit2') engineRef.current?.switchSlot('sidearm');
        else if (e.code === 'Digit3') engineRef.current?.switchSlot('knife');
      } else if (
        ['Digit4', 'Digit5', 'Digit6'].includes(e.code) &&
        !leaderboardOpen &&
        !inventoryOpen &&
        !missionsOpen &&
        !tutorialOpen &&
        !friendsOpen &&
        !emoteOpen &&
        !cdmOpen
      ) {
        const idx = ['Digit4', 'Digit5', 'Digit6'].indexOf(e.code) + 3;
        const emoteDef = EMOTES[idx];
        if (emoteDef) {
          e.preventDefault();
          sendWs({ type: 'emote', emote: emoteDef.id });
        }
      } else if (e.code === 'KeyI' && serverState?.phase === 'lobby' && !cdmOpen) {
        e.preventDefault();
        engineRef.current?.exitPointerLock();
        setInventoryOpen((open) => !open);
      } else if (e.code === 'Tab') {
        e.preventDefault();
        engineRef.current?.exitPointerLock();
        setLeaderboardTab(serverState?.phase === 'playing' ? 'live' : 'global');
        setLeaderboardOpen((open) => !open);
      } else if (e.code === 'KeyM' && voiceStatus.connected) {
        e.preventDefault();
        voiceManagerRef.current?.toggleMicMute();
      } else if (e.code === 'F4') {
        const currentMe = serverState?.players.find((p) => p.id === myIdRef.current);
        if (!currentMe?.isAdmin) return;
        e.preventDefault();
        if (cdmOpen) {
          setCdmOpen(false);
        } else {
          sendWs({ type: 'cdm_request', commandLine: 'cdm' });
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    joined,
    serverState?.phase,
    serverState?.players,
    leaderboardOpen,
    inventoryOpen,
    missionsOpen,
    tutorialOpen,
    friendsOpen,
    emoteOpen,
    cdmOpen,
    voiceStatus.connected,
    sendWs,
  ]);

  const handleToggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      soundEngine.setMuted(next);
      return next;
    });
  }, []);

  const handleJoinVoiceRoom = useCallback(
    async (room: string) => {
      const clean = room.trim().toLowerCase().slice(0, 24) || 'amigos';
      await voiceManagerRef.current?.joinRoom(clean);
      sendWs({ type: 'voice:join', room: clean });
    },
    [sendWs],
  );

  const handleLeaveVoiceRoom = useCallback(() => {
    voiceManagerRef.current?.leaveRoom();
    sendWs({ type: 'voice:leave' });
  }, [sendWs]);

  const handleToggleMicMute = useCallback(() => {
    voiceManagerRef.current?.toggleMicMute();
  }, []);

  const handleToggleDeafen = useCallback(() => {
    voiceManagerRef.current?.toggleDeafen();
  }, []);

  const handleStartMatch = useCallback(() => {
    sendWs({ type: 'start_match' });
    engineRef.current?.requestPointerLock();
  }, [sendWs]);

  const handleReturnLobby = useCallback(() => {
    sendWs({ type: 'return_lobby' });
  }, [sendWs]);

  const handleToggleBots = useCallback(() => {
    sendWs({ type: 'toggle_bots', enabled: !(serverState?.botsEnabled ?? true) });
  }, [sendWs, serverState?.botsEnabled]);

  const handleVoteMap = useCallback(
    (mapId: ArenaMapId) => {
      sendWs({ type: 'vote_map', mapId });
    },
    [sendWs],
  );

  const handleOpenInventory = useCallback(() => {
    engineRef.current?.exitPointerLock();
    setInventoryOpen(true);
  }, []);

  const handleBuyOutfit = useCallback(
    (outfitId: OutfitId) => {
      const outfit = getOutfitById(outfitId);
      const me = serverState?.players.find((p) => p.id === myId);
      const hasInfCoins = Boolean(me?.infiniteCoins || cdmPowers.infiniteCoins);
      const currentCoins = me?.coins ?? savedProfileRef.current?.coins ?? 0;
      const currentOwned = me?.ownedOutfits ?? savedProfileRef.current?.ownedOutfits ?? ['default'];
      const currentLevels = me?.outfitLevels ?? savedProfileRef.current?.outfitLevels ?? { default: 1 };
      if (currentOwned.includes(outfitId) || (!hasInfCoins && currentCoins < outfit.price)) return;

      const savedCoins = savedProfileRef.current?.coins ?? 0;
      const nextCoins = hasInfCoins ? savedCoins : currentCoins - outfit.price;
      const nextOwned = [...currentOwned, outfitId];
      const nextLevels = { ...currentLevels, [outfitId]: currentLevels[outfitId] ?? 1 };
      sendWs({ type: 'buy_outfit', outfitId });

      if (authUserRef.current?.emailVerified && (!hasInfCoins || savedCoins >= outfit.price)) {
        const persistedCoins = Math.max(0, savedCoins - outfit.price);
        void saveOutfitPurchaseToProfile(
          authUserRef.current.uid,
          persistedCoins,
          nextOwned,
          outfitId,
          nextLevels,
        ).catch((err) => {
          console.error('Failed to persist suit purchase:', err);
        });
      }
      setSavedProfile((prev) =>
        prev
          ? {
              ...prev,
              coins: hasInfCoins
                ? savedCoins >= outfit.price
                  ? savedCoins - outfit.price
                  : prev.coins
                : nextCoins,
              ownedOutfits: nextOwned,
              equippedOutfit: outfitId,
              outfitLevels: nextLevels,
            }
          : prev,
      );
    },
    [cdmPowers.infiniteCoins, myId, sendWs, serverState?.players],
  );

  const handleEquipOutfit = useCallback(
    (outfitId: OutfitId) => {
      const me = serverState?.players.find((p) => p.id === myId);
      const currentOwned = me?.ownedOutfits ?? savedProfileRef.current?.ownedOutfits ?? ['default'];
      if (!currentOwned.includes(outfitId)) return;

      sendWs({ type: 'equip_outfit', outfitId });

      if (authUserRef.current?.emailVerified) {
        void saveEquippedOutfitToProfile(authUserRef.current.uid, outfitId).catch((err) => {
          console.error('Failed to persist equipped suit:', err);
        });
      }
      setSavedProfile((prev) => (prev ? { ...prev, equippedOutfit: outfitId } : prev));
    },
    [myId, sendWs, serverState?.players],
  );

  const handleUpgradeOutfit = useCallback(
    (outfitId: OutfitId) => {
      const me = serverState?.players.find((p) => p.id === myId);
      const hasInfCoins = Boolean(me?.infiniteCoins || cdmPowers.infiniteCoins);
      const currentCoins = me?.coins ?? savedProfileRef.current?.coins ?? 0;
      const currentOwned = me?.ownedOutfits ?? savedProfileRef.current?.ownedOutfits ?? ['default'];
      const currentLevels =
        me?.outfitLevels ?? savedProfileRef.current?.outfitLevels ?? { default: 1 };
      if (!currentOwned.includes(outfitId)) return;

      const currentLvl = getOutfitLevel(currentLevels, outfitId);
      const cost = getOutfitUpgradeCost(currentLvl);
      if (cost === null || (!hasInfCoins && currentCoins < cost)) return;

      const savedCoins = savedProfileRef.current?.coins ?? 0;
      const nextCoins = hasInfCoins ? savedCoins : currentCoins - cost;
      const nextLevels = { ...currentLevels, [outfitId]: currentLvl + 1 };
      sendWs({ type: 'upgrade_outfit', outfitId });

      if (authUserRef.current?.emailVerified && (!hasInfCoins || savedCoins >= cost)) {
        const persistedCoins = Math.max(0, savedCoins - cost);
        void saveOutfitUpgradeToProfile(
          authUserRef.current.uid,
          persistedCoins,
          nextLevels,
          currentOwned,
        ).catch((err) => {
          console.error('Failed to persist suit upgrade:', err);
        });
      }
      setSavedProfile((prev) =>
        prev
          ? {
              ...prev,
              coins: hasInfCoins ? (savedCoins >= cost ? savedCoins - cost : prev.coins) : nextCoins,
              outfitLevels: nextLevels,
            }
          : prev,
      );
    },
    [cdmPowers.infiniteCoins, myId, sendWs, serverState?.players],
  );

  const handleBuyWeapon = useCallback(
    (weaponId: WeaponId) => {
      const weapon = getWeaponById(weaponId);
      const isSidearm = isSidearmWeapon(weaponId);
      const me = serverState?.players.find((p) => p.id === myId);
      const hasInfCoins = Boolean(me?.infiniteCoins || cdmPowers.infiniteCoins);
      const currentCoins = me?.coins ?? savedProfileRef.current?.coins ?? 0;
      const currentOwned =
        me?.ownedWeapons ?? savedProfileRef.current?.ownedWeapons ?? ['pulse_carbine', 'tactical_pistol'];
      if (currentOwned.includes(weaponId) || (!hasInfCoins && currentCoins < weapon.price)) return;

      const savedCoins = savedProfileRef.current?.coins ?? 0;
      const nextCoins = hasInfCoins ? savedCoins : currentCoins - weapon.price;
      const nextOwned = [...currentOwned, weaponId];
      sendWs({ type: 'buy_weapon', weaponId });

      if (authUserRef.current?.emailVerified && (!hasInfCoins || savedCoins >= weapon.price)) {
        const persistedCoins = Math.max(0, savedCoins - weapon.price);
        void saveWeaponPurchaseToProfile(
          authUserRef.current.uid,
          persistedCoins,
          nextOwned,
          weaponId,
        ).catch((err) => {
          console.error('Failed to persist weapon purchase:', err);
        });
      }
      setSavedProfile((prev) =>
        prev
          ? {
              ...prev,
              coins: hasInfCoins
                ? savedCoins >= weapon.price
                  ? savedCoins - weapon.price
                  : prev.coins
                : nextCoins,
              ownedWeapons: nextOwned,
              ...(isSidearm ? { equippedSidearm: weaponId } : { equippedWeapon: weaponId }),
            }
          : prev,
      );
    },
    [cdmPowers.infiniteCoins, myId, sendWs, serverState?.players],
  );

  const handleEquipWeapon = useCallback(
    (weaponId: WeaponId) => {
      const isSidearm = isSidearmWeapon(weaponId);
      const me = serverState?.players.find((p) => p.id === myId);
      const currentOwned =
        me?.ownedWeapons ?? savedProfileRef.current?.ownedWeapons ?? ['pulse_carbine', 'tactical_pistol'];
      if (!currentOwned.includes(weaponId)) return;

      sendWs({ type: 'equip_weapon', weaponId });

      if (authUserRef.current?.emailVerified) {
        void saveEquippedWeaponToProfile(authUserRef.current.uid, weaponId).catch((err) => {
          console.error('Failed to persist equipped weapon:', err);
        });
      }
      setSavedProfile((prev) =>
        prev
          ? {
              ...prev,
              ...(isSidearm ? { equippedSidearm: weaponId } : { equippedWeapon: weaponId }),
            }
          : prev,
      );
    },
    [myId, sendWs, serverState?.players],
  );

  const handleBuyKnife = useCallback(
    (knifeId: KnifeId) => {
      const knife = getKnifeById(knifeId);
      const me = serverState?.players.find((p) => p.id === myId);
      const hasInfCoins = Boolean(me?.infiniteCoins || cdmPowers.infiniteCoins);
      const currentCoins = me?.coins ?? savedProfileRef.current?.coins ?? 0;
      const currentOwned =
        me?.ownedKnives ?? savedProfileRef.current?.ownedKnives ?? ['tactical_blade'];
      if (currentOwned.includes(knifeId) || (!hasInfCoins && currentCoins < knife.price)) return;

      const savedCoins = savedProfileRef.current?.coins ?? 0;
      const nextCoins = hasInfCoins ? savedCoins : currentCoins - knife.price;
      const nextOwned = [...currentOwned, knifeId];
      sendWs({ type: 'buy_knife', knifeId });

      if (authUserRef.current?.emailVerified && (!hasInfCoins || savedCoins >= knife.price)) {
        const persistedCoins = Math.max(0, savedCoins - knife.price);
        void saveKnifePurchaseToProfile(
          authUserRef.current.uid,
          persistedCoins,
          nextOwned,
          knifeId,
        ).catch((err) => {
          console.error('Failed to persist knife purchase:', err);
        });
      }
      setSavedProfile((prev) =>
        prev
          ? {
              ...prev,
              coins: hasInfCoins
                ? savedCoins >= knife.price
                  ? savedCoins - knife.price
                  : prev.coins
                : nextCoins,
              ownedKnives: nextOwned,
              equippedKnife: knifeId,
            }
          : prev,
      );
    },
    [cdmPowers.infiniteCoins, myId, sendWs, serverState?.players],
  );

  const handleEquipKnife = useCallback(
    (knifeId: KnifeId) => {
      const me = serverState?.players.find((p) => p.id === myId);
      const currentOwned =
        me?.ownedKnives ?? savedProfileRef.current?.ownedKnives ?? ['tactical_blade'];
      if (!currentOwned.includes(knifeId)) return;

      sendWs({ type: 'equip_knife', knifeId });

      if (authUserRef.current?.emailVerified) {
        void saveEquippedKnifeToProfile(authUserRef.current.uid, knifeId).catch((err) => {
          console.error('Failed to persist equipped knife:', err);
        });
      }
      setSavedProfile((prev) => (prev ? { ...prev, equippedKnife: knifeId } : prev));
    },
    [myId, sendWs, serverState?.players],
  );

  const handleBuyWeaponSkin = useCallback(
    (skinId: WeaponSkinId) => {
      const skin = getWeaponSkinById(skinId);
      const me = serverState?.players.find((p) => p.id === myId);
      const hasInfCoins = Boolean(me?.infiniteCoins || cdmPowers.infiniteCoins);
      const currentCoins = me?.coins ?? savedProfileRef.current?.coins ?? 0;
      const currentOwned =
        me?.ownedWeaponSkins ?? savedProfileRef.current?.ownedWeaponSkins ?? ['default'];
      if (currentOwned.includes(skinId) || (!hasInfCoins && currentCoins < skin.price)) return;

      const savedCoins = savedProfileRef.current?.coins ?? 0;
      const nextCoins = hasInfCoins ? savedCoins : currentCoins - skin.price;
      const nextOwned = [...currentOwned, skinId];
      sendWs({ type: 'buy_weapon_skin', skinId });

      if (authUserRef.current?.emailVerified && (!hasInfCoins || savedCoins >= skin.price)) {
        const persistedCoins = Math.max(0, savedCoins - skin.price);
        void saveWeaponSkinPurchaseToProfile(
          authUserRef.current.uid,
          persistedCoins,
          nextOwned,
          skinId,
        ).catch((err) => {
          console.error('Failed to persist weapon skin purchase:', err);
        });
      }
      setSavedProfile((prev) =>
        prev
          ? {
              ...prev,
              coins: hasInfCoins
                ? savedCoins >= skin.price
                  ? savedCoins - skin.price
                  : prev.coins
                : nextCoins,
              ownedWeaponSkins: nextOwned,
              equippedWeaponSkin: skinId,
            }
          : prev,
      );
    },
    [cdmPowers.infiniteCoins, myId, sendWs, serverState?.players],
  );

  const handleEquipWeaponSkin = useCallback(
    (skinId: WeaponSkinId) => {
      const me = serverState?.players.find((p) => p.id === myId);
      const currentOwned =
        me?.ownedWeaponSkins ?? savedProfileRef.current?.ownedWeaponSkins ?? ['default'];
      if (!currentOwned.includes(skinId)) return;

      sendWs({ type: 'equip_weapon_skin', skinId });

      if (authUserRef.current?.emailVerified) {
        void saveEquippedWeaponSkinToProfile(authUserRef.current.uid, skinId).catch((err) => {
          console.error('Failed to persist equipped weapon skin:', err);
        });
      }
      setSavedProfile((prev) => (prev ? { ...prev, equippedWeaponSkin: skinId } : prev));
    },
    [myId, sendWs, serverState?.players],
  );

  const handleTriggerEmote = useCallback(
    (emote: EmoteId) => {
      sendWs({ type: 'emote', emote });
    },
    [sendWs],
  );

  const handleOpenEmotes = useCallback(() => {
    engineRef.current?.exitPointerLock();
    setEmoteOpen(true);
  }, []);

  const handleOpenFriends = useCallback(() => {
    engineRef.current?.exitPointerLock();
    setFriendsOpen(true);
  }, []);

  const handleOpenMissions = useCallback(() => {
    engineRef.current?.exitPointerLock();
    setMissionsOpen(true);
  }, []);

  const handleOpenTutorial = useCallback(() => {
    engineRef.current?.exitPointerLock();
    setTutorialOpen(true);
  }, []);

  const handleToggleTeamMode = useCallback(
    (teamMode: TeamMode) => {
      sendWs({ type: 'toggle_team_mode', teamMode });
    },
    [sendWs],
  );

  const handleToggleMatchMode = useCallback(
    (matchMode: MatchMode) => {
      sendWs({ type: 'toggle_match_mode', matchMode });
    },
    [sendWs],
  );

  const handleSendChat = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const lower = trimmed.toLowerCase();
      const currentMe = serverState?.players.find((p) => p.id === myIdRef.current);
      if (
        (currentMe?.isAdmin && lower === 'cdm') ||
        lower === '/cdm' ||
        trimmed.startsWith('/')
      ) {
        setChatBlockedReason(null);
        sendWs({ type: 'cdm_request', commandLine: trimmed });
        return;
      }
      setChatBlockedReason(null);
      sendWs({ type: 'chat', text: trimmed });
    },
    [sendWs, serverState?.players],
  );

  const handleToggleCdmPanel = useCallback(() => {
    const currentMe = serverState?.players.find((p) => p.id === myIdRef.current);
    if (!currentMe?.isAdmin) {
      setCdmOpen(false);
      return;
    }
    if (cdmOpen) {
      setCdmOpen(false);
      return;
    }
    sendWs({ type: 'cdm_request', commandLine: 'cdm' });
  }, [cdmOpen, sendWs, serverState?.players]);

  const handleExecuteCdmCommand = useCallback(
    (command: CdmCommandId, targetId?: string) => {
      sendWs({ type: 'cdm_execute', command, targetId });
    },
    [sendWs],
  );

  const handleSubmitCdmCommandLine = useCallback(
    (commandLine: string) => {
      sendWs({ type: 'cdm_request', commandLine });
    },
    [sendWs],
  );

  const handleClaimMissionReward = useCallback(
    (missionId: DailyMissionId) => {
      const def = getDailyMissionById(missionId);
      const currentProgress = ensureTodayDailyMissions(dailyMissionsRef.current);
      if (
        !isMissionCompleted(def, currentProgress) ||
        currentProgress.claimedIds.includes(missionId)
      ) {
        return;
      }

      const me = serverState?.players.find((p) => p.id === myId);
      const currentCoins = me?.coins ?? savedProfileRef.current?.coins ?? 0;
      const nextCoins = Math.min(1_000_000, currentCoins + def.rewardCoins);
      const nextProgress: DailyMissionsProgress = {
        ...currentProgress,
        claimedIds: [...currentProgress.claimedIds, missionId],
      };

      setDailyMissions(nextProgress);
      sendWs({ type: 'claim_mission_reward', missionId });

      if (authUserRef.current?.emailVerified) {
        void claimDailyMissionRewardInProfile(
          authUserRef.current.uid,
          nextCoins,
          nextProgress,
        ).catch((err) => {
          console.error('Failed to persist daily mission reward:', err);
        });
      }
      setSavedProfile((prev) =>
        prev ? { ...prev, coins: nextCoins, dailyMissions: nextProgress } : prev,
      );
    },
    [myId, sendWs, serverState?.players],
  );

  const handleCreatePrivateRoom = useCallback(() => {
    setRoomError(null);
    sendWs({ type: 'create_private_room' });
  }, [sendWs]);

  const handleJoinRoom = useCallback(
    (roomCode: string) => {
      setRoomError(null);
      sendWs({ type: 'join_room', roomCode });
    },
    [sendWs],
  );

  const handleLeavePrivateRoom = useCallback(() => {
    setRoomError(null);
    sendWs({ type: 'leave_private_room' });
  }, [sendWs]);

  const handleCreateCustomRoom = useCallback(
    (input: CreateCustomRoomInput) => {
      setRoomError(null);
      sendWs({
        type: 'create_custom_room',
        isPrivate: input.isPrivate,
        customCode: input.customCode,
        roomName: input.roomName,
        preset: input.preset,
        mapId: input.mapId,
        allowedWeapons: input.allowedWeapons,
        infiniteEnergy: input.infiniteEnergy,
        darkHideAndSeek: input.darkHideAndSeek,
        matchMode: input.matchMode,
        teamMode: input.teamMode,
        botsEnabled: input.botsEnabled,
      });
    },
    [sendWs],
  );

  const handleUpdateRoomRules = useCallback(
    (input: UpdateRoomRulesInput) => {
      setRoomError(null);
      sendWs({
        type: 'update_room_rules',
        roomPreset: input.roomPreset,
        roomName: input.roomName,
        mapId: input.mapId,
        allowedWeapons: input.allowedWeapons,
        infiniteEnergy: input.infiniteEnergy,
        darkHideAndSeek: input.darkHideAndSeek,
        botsEnabled: input.botsEnabled,
      });
    },
    [sendWs],
  );

  const handleSelectMatchWeapon = useCallback(
    (weaponId: WeaponId) => {
      sendWs({ type: 'select_match_weapon', weaponId });
    },
    [sendWs],
  );

  const handleRequestPublicRooms = useCallback(() => {
    sendWs({ type: 'request_public_rooms' });
  }, [sendWs]);

  const mePlayer = serverState?.players.find((p) => p.id === myId) ?? null;
  const claimableMissionsCount = DAILY_MISSIONS.filter(
    (m) => isMissionCompleted(m, dailyMissions) && !dailyMissions.claimedIds.includes(m.id),
  ).length;

  // Flush queued friend invite right after creating a private room on the server
  useEffect(() => {
    const pending = pendingInviteFriendRef.current;
    if (
      !pending ||
      !serverState?.isPrivateRoom ||
      !serverState.roomCode ||
      serverState.roomCode === 'PUBLIC' ||
      !authUser ||
      !authUser.emailVerified
    ) {
      return;
    }
    pendingInviteFriendRef.current = null;
    void sendRoomInvite({
      fromUid: authUser.uid,
      fromName: savedProfileRef.current?.playerName || mePlayer?.name || 'Agente',
      fromCountry: savedProfileRef.current?.country || mePlayer?.country,
      toUid: pending.uid,
      toName: pending.playerName,
      roomCode: serverState.roomCode,
    }).catch((err) => {
      console.error('Failed to send queued room invite:', err);
    });
  }, [
    serverState?.isPrivateRoom,
    serverState?.roomCode,
    authUser,
    mePlayer?.name,
    mePlayer?.country,
  ]);

  const handleInviteFriend = useCallback(
    async (friend: FriendProfileItem) => {
      const user = authUserRef.current;
      if (!user || !user.emailVerified) return;

      if (serverState?.isPrivateRoom && serverState.roomCode && serverState.roomCode !== 'PUBLIC') {
        await sendRoomInvite({
          fromUid: user.uid,
          fromName: savedProfileRef.current?.playerName || mePlayer?.name || 'Agente',
          fromCountry: savedProfileRef.current?.country || mePlayer?.country,
          toUid: friend.uid,
          toName: friend.playerName,
          roomCode: serverState.roomCode,
        });
      } else {
        pendingInviteFriendRef.current = friend;
        setRoomError(null);
        sendWs({ type: 'create_private_room' });
      }
    },
    [serverState?.isPrivateRoom, serverState?.roomCode, mePlayer?.name, mePlayer?.country, sendWs],
  );

  const handleAcceptInvite = useCallback(
    async (invite: RoomInviteRecord) => {
      setRoomError(null);
      sendWs({ type: 'join_room', roomCode: invite.roomCode });
      setFriendsOpen(false);
      await respondToRoomInvite(invite.id, 'accepted').catch((err) => {
        console.error('Failed to mark invite accepted:', err);
      });
    },
    [sendWs],
  );

  const handleDeclineInvite = useCallback(async (invite: RoomInviteRecord) => {
    await respondToRoomInvite(invite.id, 'declined').catch((err) => {
      console.error('Failed to mark invite declined:', err);
    });
  }, []);

  const handleReportPlayer = useCallback(
    async (targetId: string, targetName: string, reason: string) => {
      if (!targetId || targetId === myId) return;
      const showFeedback = (message: string) => {
        setReportFeedback(message);
        window.clearTimeout(reportFeedbackTimerRef.current);
        reportFeedbackTimerRef.current = window.setTimeout(() => {
          setReportFeedback(null);
        }, 4200);
      };

      const isLivePlayer = Boolean(
        serverState?.players.some((p) => p.id === targetId && !p.isBot),
      );
      if (wsRef.current?.readyState === WebSocket.OPEN && isLivePlayer) {
        sendWs({ type: 'report_player', targetId, reason });
        return;
      }

      try {
        const reporterName =
          mePlayer?.name ?? savedProfileRef.current?.playerName ?? 'Agente';
        const res = await fetch('/api/report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetId,
            targetName,
            reason,
            reporterName,
            roomCode: serverState?.roomCode ?? 'PUBLIC',
          }),
        });
        const data = (await res.json().catch(() => null)) as {
          ok?: boolean;
          message?: string;
        } | null;
        if (res.ok && data?.ok) {
          setReportedIds((prev) => ({ ...prev, [targetId]: true }));
          showFeedback(
            data.message ?? `Reporte registrado para ${targetName}.`,
          );
        } else {
          showFeedback(
            data?.message ?? 'No se pudo enviar el reporte en este momento.',
          );
        }
      } catch {
        showFeedback('Error de red al enviar el reporte.');
      }
    },
    [mePlayer?.name, myId, sendWs, serverState?.players, serverState?.roomCode],
  );

  const handleSplashComplete = useCallback(() => {
    setSplashDone(true);
  }, []);

  return (
    <ErrorBoundary>
      <div className="relative h-[100dvh] w-screen overflow-hidden bg-[#080C14]">
        {/* Isolated Three.js WebGL Mount */}
        <div ref={canvasMountRef} className="fixed inset-0 h-full w-full" />

        {!webglOk && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#080C14] p-6 text-center">
            <div className="max-w-md rounded-xl border border-slate-700 bg-[#0D1422] p-6">
              <h2 className="font-display text-xl font-bold text-white">
                WebGL no disponible
              </h2>
              <p className="mt-2 text-sm text-slate-300">
                Tu navegador o entorno gráfico suspendió el contexto 3D. Recarga la página o activa la aceleración por hardware.
              </p>
            </div>
          </div>
        )}

        {!joined ? (
          <CharacterSelectScreen
            authReady={authReady}
            authUser={authUser}
            authEmailVerified={authEmailVerified}
            savedProfile={savedProfile}
            profileLoading={profileLoading}
            signingIn={signingIn}
            savingProfile={savingProfile}
            authError={authError}
            onGoogleCredential={handleGoogleCredential}
            onGoogleSignIn={handleGoogleSignIn}
            onSocialSignIn={handleSocialSignIn}
            onEmailSignIn={handleEmailSignIn}
            onEmailRegister={handleEmailRegister}
            onResetPassword={handleResetPassword}
            onResendVerification={handleResendVerification}
            onRefreshVerification={handleRefreshVerification}
            onGoogleSignOut={handleGoogleSignOut}
            onClearAuthError={() => setAuthError(null)}
            onEnterLobby={handleEnterLobby}
            connecting={connecting}
            errorMsg={connectError}
            leaderboard={leaderboard}
            onOpenLeaderboard={() => {
              setLeaderboardTab('global');
              setLeaderboardOpen(true);
            }}
            muted={muted}
            onToggleMute={handleToggleMute}
          />
        ) : (
          serverState && (
            <GameHud
              state={serverState}
              myId={myId}
              pingMs={pingMs}
              hitMarker={hitMarker}
              damagePopups={damagePopups}
              damageFlash={damageFlash}
              deathCam={deathCam}
              weaponState={weaponState}
              killFeed={killFeed}
              muted={muted}
              voiceStatus={voiceStatus}
              roomError={roomError}
              incomingInvites={incomingInvites}
              chatMessages={chatMessages}
              chatBlockedReason={chatBlockedReason}
              chatFocusSignal={chatFocusSignal}
              claimableMissionsCount={claimableMissionsCount}
              onJoinVoiceRoom={handleJoinVoiceRoom}
              onLeaveVoiceRoom={handleLeaveVoiceRoom}
              onToggleMicMute={handleToggleMicMute}
              onToggleDeafen={handleToggleDeafen}
              onToggleMute={handleToggleMute}
              onStartMatch={handleStartMatch}
              onReturnLobby={handleReturnLobby}
              onToggleBots={handleToggleBots}
              onToggleTeamMode={handleToggleTeamMode}
              onToggleMatchMode={handleToggleMatchMode}
              onVoteMap={handleVoteMap}
              onOpenInventory={handleOpenInventory}
              onOpenMissions={handleOpenMissions}
              onOpenTutorial={handleOpenTutorial}
              onOpenFriends={handleOpenFriends}
              onAcceptInvite={handleAcceptInvite}
              onDeclineInvite={handleDeclineInvite}
              onOpenEmotes={handleOpenEmotes}
              onTriggerEmote={handleTriggerEmote}
              onCreatePrivateRoom={handleCreatePrivateRoom}
              onJoinRoom={handleJoinRoom}
              onLeavePrivateRoom={handleLeavePrivateRoom}
              onClearRoomError={() => setRoomError(null)}
              publicRooms={publicRooms}
              onCreateCustomRoom={handleCreateCustomRoom}
              onUpdateRoomRules={handleUpdateRoomRules}
              onSelectMatchWeapon={handleSelectMatchWeapon}
              onRefreshPublicRooms={handleRequestPublicRooms}
              onSendChat={handleSendChat}
              onClearChatBlocked={() => setChatBlockedReason(null)}
              onReload={() => engineRef.current?.triggerReload()}
              onSwitchSlot={(slot) => engineRef.current?.switchSlot(slot)}
              onOpenLeaderboard={(tab) => {
                engineRef.current?.exitPointerLock();
                setLeaderboardTab(tab);
                setLeaderboardOpen(true);
              }}
              onSignOut={authUser ? handleGoogleSignOut : undefined}
              reportedIds={reportedIds}
              reportFeedback={reportFeedback}
              onReportPlayer={handleReportPlayer}
              touchInputMode={touchInputMode}
              settings={playerSettings}
              onUpdateSettings={setPlayerSettings}
              onTouchMove={(strafe, forward) => {
                engineRef.current?.setTouchMoveVector(strafe, forward);
              }}
              onTouchFireChange={(firing) => {
                engineRef.current?.setTouchFiring(firing);
              }}
              onTouchJump={() => {
                engineRef.current?.triggerTouchJump();
              }}
              onTouchSlide={() => {
                engineRef.current?.triggerTouchSlide();
              }}
              onTouchAimChange={(aiming) => {
                engineRef.current?.setTouchAiming(aiming);
              }}
              onTouchSprintChange={(sprinting) => {
                engineRef.current?.setTouchSprinting(sprinting);
              }}
              onTouchCrouchChange={(crouching) => {
                engineRef.current?.setTouchCrouching(crouching);
              }}
              cdmOpen={cdmOpen}
              onOpenCdm={handleToggleCdmPanel}
            />
          )
        )}

        <SplashIntroOverlay open={!splashDone} onComplete={handleSplashComplete} />

        <TutorialOverlay
          open={tutorialOpen}
          onClose={() => setTutorialOpen(false)}
          isTouchMode={touchInputMode}
        />

        <DailyMissionsModal
          open={missionsOpen}
          onClose={() => setMissionsOpen(false)}
          progress={dailyMissions}
          coins={mePlayer?.coins ?? savedProfile?.coins ?? 0}
          infiniteCoins={Boolean(mePlayer?.infiniteCoins || cdmPowers.infiniteCoins)}
          onClaimReward={handleClaimMissionReward}
        />

        <EmoteWheelModal
          open={emoteOpen}
          onClose={() => setEmoteOpen(false)}
          onSelectEmote={handleTriggerEmote}
        />

        <InventoryModal
          open={inventoryOpen}
          onClose={() => setInventoryOpen(false)}
          coins={mePlayer?.coins ?? savedProfile?.coins ?? 0}
          infiniteCoins={Boolean(mePlayer?.infiniteCoins || cdmPowers.infiniteCoins)}
          gender={mePlayer?.gender ?? savedProfile?.gender ?? 'male'}
          playerName={mePlayer?.name ?? savedProfile?.playerName ?? 'Agente'}
          accentColor={mePlayer?.accentColor ?? '#06B6D4'}
          ownedOutfits={mePlayer?.ownedOutfits ?? savedProfile?.ownedOutfits ?? ['default']}
          equippedOutfit={mePlayer?.equippedOutfit ?? savedProfile?.equippedOutfit ?? 'default'}
          outfitLevels={
            mePlayer?.outfitLevels ?? savedProfile?.outfitLevels ?? { default: 1 }
          }
          ownedWeapons={
            mePlayer?.ownedWeapons ??
            savedProfile?.ownedWeapons ?? ['pulse_carbine', 'tactical_pistol']
          }
          equippedWeapon={
            mePlayer?.equippedWeapon ?? savedProfile?.equippedWeapon ?? 'pulse_carbine'
          }
          equippedSidearm={
            mePlayer?.equippedSidearm ?? savedProfile?.equippedSidearm ?? 'tactical_pistol'
          }
          ownedKnives={
            mePlayer?.ownedKnives ?? savedProfile?.ownedKnives ?? ['tactical_blade']
          }
          equippedKnife={
            mePlayer?.equippedKnife ?? savedProfile?.equippedKnife ?? 'tactical_blade'
          }
          ownedWeaponSkins={
            mePlayer?.ownedWeaponSkins ?? savedProfile?.ownedWeaponSkins ?? ['default']
          }
          equippedWeaponSkin={
            mePlayer?.equippedWeaponSkin ?? savedProfile?.equippedWeaponSkin ?? 'default'
          }
          onBuyOutfit={handleBuyOutfit}
          onEquipOutfit={handleEquipOutfit}
          onUpgradeOutfit={handleUpgradeOutfit}
          onBuyWeapon={handleBuyWeapon}
          onEquipWeapon={handleEquipWeapon}
          onBuyKnife={handleBuyKnife}
          onEquipKnife={handleEquipKnife}
          onBuyWeaponSkin={handleBuyWeaponSkin}
          onEquipWeaponSkin={handleEquipWeaponSkin}
        />

        <FriendsModal
          open={friendsOpen}
          onClose={() => setFriendsOpen(false)}
          isSignedIn={Boolean(authUser && authUser.emailVerified)}
          myUid={authUser?.uid ?? null}
          isPrivateRoom={Boolean(serverState?.isPrivateRoom)}
          currentRoomCode={serverState?.roomCode ?? 'PUBLIC'}
          incomingInvites={incomingInvites}
          onInviteFriend={handleInviteFriend}
          onAcceptInvite={handleAcceptInvite}
          onDeclineInvite={handleDeclineInvite}
        />

        <LeaderboardModal
          open={leaderboardOpen}
          onClose={() => setLeaderboardOpen(false)}
          globalEntries={leaderboard}
          livePlayers={serverState?.players ?? []}
          myId={myId}
          myName={mePlayer?.name ?? savedProfile?.playerName}
          myRankedWins={mePlayer?.rankedWins ?? savedProfile?.rankedWins ?? 0}
          initialTab={leaderboardTab}
          onTabChange={setLeaderboardTab}
          reportedIds={reportedIds}
          reportFeedback={reportFeedback}
          onReportPlayer={handleReportPlayer}
        />

        {joined && ownerAnnouncement && (
          <div
            role="status"
            aria-live="polite"
            className={`pointer-events-none fixed left-1/2 z-20 flex max-w-[min(88vw,480px)] -translate-x-1/2 items-center gap-2 rounded-lg border border-amber-400/50 bg-[#080D18]/92 px-2.5 py-1 shadow-lg backdrop-blur-md transition-all ${
              serverState?.phase === 'countdown' ||
              (serverState?.phase === 'lobby' && (serverState?.voteCountdownEndsAt ?? 0) > 0)
                ? 'top-[196px] sm:top-[232px]'
                : serverState?.phase === 'playing'
                  ? 'top-[108px] sm:top-[128px]'
                  : 'top-[72px] sm:top-[68px]'
            }`}
          >
            {!bannerLogoFailed ? (
              <img
                src={GAME_LOGO_URL}
                alt="Apex Laser Tag"
                referrerPolicy="no-referrer"
                onError={() => setBannerLogoFailed(true)}
                className="h-5 w-5 shrink-0 rounded border border-amber-400/40 bg-[#060B16] object-contain p-0.5"
              />
            ) : (
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-amber-400/40 bg-slate-900 font-display text-[9px] font-bold text-amber-300">
                AX
              </span>
            )}
            <span className="shrink-0 whitespace-nowrap font-display text-[11px] font-bold text-amber-300">
              Dueño:
            </span>
            <span className="min-w-0 truncate text-[11px] font-medium text-white sm:text-xs">
              {ownerAnnouncement.text}
            </span>
          </div>
        )}

        {serverState && mePlayer?.isAdmin && (
          <CdmCommandModal
            open={cdmOpen}
            onClose={() => setCdmOpen(false)}
            state={serverState}
            me={mePlayer}
            powers={cdmPowers}
            feedback={cdmFeedback}
            bannedPlayers={bannedPlayers}
            activeAnnouncement={ownerAnnouncement}
            announcementLog={ownerAnnouncementLog}
            onExecuteCommand={handleExecuteCdmCommand}
            onSubmitCommandLine={handleSubmitCdmCommandLine}
          />
        )}
        <OfflineIndicator />
      </div>
    </ErrorBoundary>
  );
}
