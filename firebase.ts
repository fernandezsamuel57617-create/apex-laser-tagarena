import { initializeApp } from 'firebase/app';
import {
  FacebookAuthProvider,
  GithubAuthProvider,
  GoogleAuthProvider,
  TwitterAuthProvider,
  createUserWithEmailAndPassword,
  getAuth,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type UserCredential,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getFirestore,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import {
  createEmptyDailyMissions,
  ensureTodayDailyMissions,
  getTodayDateKey,
  isValidDailyMissionId,
  type DailyMissionsProgress,
} from './shared/dailyMissions';
import {
  getKnifeById,
  isValidKnifeId,
  type KnifeId,
} from './shared/knives';
import {
  getOutfitById,
  isValidOutfitId,
  sanitizeOutfitLevels,
  type OutfitId,
} from './shared/outfits';
import type { Gender } from './shared/types';
import {
  getWeaponById,
  isPrimaryWeapon,
  isSidearmWeapon,
  isValidWeaponId,
  type WeaponId,
} from './shared/weapons';
import { getWeaponSkinById, isValidWeaponSkinId, type WeaponSkinId } from './shared/weaponSkins';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleOAuthClientId = firebaseConfig.oAuthClientId || '';

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

export const githubProvider = new GithubAuthProvider();
githubProvider.addScope('user:email');

export const facebookProvider = new FacebookAuthProvider();
facebookProvider.addScope('email');

export const twitterProvider = new TwitterAuthProvider();

export type SocialAuthProviderId = 'google' | 'github' | 'facebook' | 'twitter';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function formatFirestoreErrorMessage(error: unknown, fallback: string): string {
  const raw = error instanceof Error ? error.message : String(error ?? '');
  let inner = raw;
  let op = '';
  let verifiedTag = '';
  try {
    const parsed = JSON.parse(raw) as {
      error?: unknown;
      operationType?: unknown;
      authInfo?: { emailVerified?: unknown; providerInfo?: { providerId?: unknown }[] };
    };
    if (typeof parsed?.error === 'string' && parsed.error.trim()) {
      inner = parsed.error;
    }
    if (typeof parsed?.operationType === 'string' && parsed.operationType) {
      op = parsed.operationType;
    }
    if (parsed?.authInfo) {
      const ev = parsed.authInfo.emailVerified;
      const prov = Array.isArray(parsed.authInfo.providerInfo)
        ? parsed.authInfo.providerInfo
            .map((p) => (typeof p?.providerId === 'string' ? p.providerId : ''))
            .filter(Boolean)
            .join(',')
        : '';
      verifiedTag = ` · verificado: ${String(ev)}${prov ? ` · ${prov}` : ''}`;
    }
  } catch {
    // raw is already a plain error message
  }
  const lower = inner.toLowerCase();
  if (lower.includes('quota exceeded') || lower.includes('resource-exhausted')) {
    return 'Se alcanzó el límite diario gratuito de Firestore (Quota exceeded). Intenta más tarde.';
  }
  if (
    lower.includes('permission-denied') ||
    lower.includes('missing or insufficient permissions')
  ) {
    const opLabel = op ? ` en "${op}"` : '';
    return `${fallback} (permisos insuficientes${opLabel}${verifiedTag}).`;
  }
  if (
    lower.includes('client is offline') ||
    lower.includes('unavailable') ||
    lower.includes('network')
  ) {
    return `${fallback} (sin conexión con Firestore; revisa tu internet).`;
  }
  if (lower.includes('unauthenticated')) {
    return `${fallback} (la sesión expiró; vuelve a iniciar sesión).`;
  }
  const cleanDetail = inner.trim().slice(0, 140);
  return cleanDetail ? `${fallback} (${cleanDetail})` : fallback;
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

void testConnection();

export type OnlineStatus = 'online' | 'in_match' | 'offline';

export interface SavedPlayerProfile {
  uid: string;
  playerName: string;
  gender: Gender;
  country?: string;
  coins: number;
  rankedWins: number;
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
  dailyMissions: DailyMissionsProgress;
  onlineStatus?: OnlineStatus;
  currentRoomCode?: string;
  lastSeenAtMs?: number;
}

export interface FriendProfileItem {
  uid: string;
  playerName: string;
  gender: Gender;
  country?: string;
  onlineStatus: OnlineStatus;
  currentRoomCode?: string;
  lastSeenAtMs: number;
}

export interface RoomInviteRecord {
  id: string;
  fromUid: string;
  fromName: string;
  fromCountry?: string;
  toUid: string;
  toName: string;
  roomCode: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAtMs: number;
}

function sanitizeOwnedOutfits(raw: unknown): OutfitId[] {
  if (!Array.isArray(raw)) return ['default'];
  const unique = Array.from(new Set(raw.filter(isValidOutfitId)));
  if (!unique.includes('default')) unique.unshift('default');
  return unique.slice(0, 10);
}

function sanitizeOwnedWeapons(raw: unknown): WeaponId[] {
  if (!Array.isArray(raw)) return ['pulse_carbine', 'tactical_pistol'];
  const unique = Array.from(new Set(raw.filter(isValidWeaponId)));
  if (!unique.includes('pulse_carbine')) unique.unshift('pulse_carbine');
  if (!unique.includes('tactical_pistol')) unique.push('tactical_pistol');
  return unique.slice(0, 11);
}

function sanitizeOwnedKnives(raw: unknown): KnifeId[] {
  if (!Array.isArray(raw)) return ['tactical_blade'];
  const unique = Array.from(new Set(raw.filter(isValidKnifeId)));
  if (!unique.includes('tactical_blade')) unique.unshift('tactical_blade');
  return unique.slice(0, 5);
}

function sanitizeOwnedWeaponSkins(raw: unknown): WeaponSkinId[] {
  if (!Array.isArray(raw)) return ['default'];
  const unique = Array.from(new Set(raw.filter(isValidWeaponSkinId)));
  if (!unique.includes('default')) unique.unshift('default');
  return unique.slice(0, 6);
}

function extractDailyMissions(data: Record<string, unknown>): DailyMissionsProgress {
  const today = getTodayDateKey();
  const dateKey =
    typeof data.dailyMissionsDate === 'string' && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(data.dailyMissionsDate)
      ? data.dailyMissionsDate
      : today;
  if (dateKey !== today) {
    return createEmptyDailyMissions(today);
  }
  const claimed = Array.isArray(data.dailyClaimedIds)
    ? Array.from(new Set(data.dailyClaimedIds.filter(isValidDailyMissionId))).slice(0, 4)
    : [];
  return ensureTodayDailyMissions(
    {
      dateKey,
      elims: typeof data.dailyElims === 'number' ? data.dailyElims : 0,
      wins: typeof data.dailyWins === 'number' ? data.dailyWins : 0,
      matches: typeof data.dailyMatches === 'number' ? data.dailyMatches : 0,
      bestStreak: typeof data.dailyBestStreak === 'number' ? data.dailyBestStreak : 0,
      claimedIds: claimed,
    },
    today,
  );
}

function timestampToMs(val: unknown): number {
  if (val instanceof Timestamp) return val.toMillis();
  if (val && typeof (val as { toMillis?: unknown }).toMillis === 'function') {
    return (val as { toMillis: () => number }).toMillis();
  }
  return 0;
}

export async function signInWithGoogle(): Promise<UserCredential> {
  return signInWithPopup(auth, googleProvider);
}

export async function signInWithSocialProvider(
  providerId: SocialAuthProviderId,
): Promise<UserCredential> {
  switch (providerId) {
    case 'google':
      return signInWithPopup(auth, googleProvider);
    case 'github':
      return signInWithPopup(auth, githubProvider);
    case 'facebook':
      return signInWithPopup(auth, facebookProvider);
    case 'twitter':
      return signInWithPopup(auth, twitterProvider);
  }
}

export async function signInWithEmailPassword(
  email: string,
  password: string,
): Promise<UserCredential> {
  return signInWithEmailAndPassword(auth, email.trim(), password);
}

export async function registerWithEmailPassword(
  email: string,
  password: string,
  displayName?: string,
): Promise<UserCredential> {
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
  const cleanName = displayName?.trim().slice(0, 18);
  if (cleanName) {
    await updateProfile(cred.user, { displayName: cleanName }).catch(() => {});
  }
  await sendEmailVerification(cred.user).catch(() => {});
  return cred;
}

export async function resendVerificationEmail(): Promise<void> {
  if (!auth.currentUser) return;
  await sendEmailVerification(auth.currentUser);
}

export async function refreshCurrentUser(): Promise<boolean> {
  if (!auth.currentUser) return false;
  await reload(auth.currentUser);
  if (auth.currentUser.emailVerified) {
    await auth.currentUser.getIdToken(true).catch(() => {});
  }
  return Boolean(auth.currentUser?.emailVerified);
}

export async function resetPasswordByEmail(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim());
}

export async function signInWithGoogleIdToken(idToken: string): Promise<UserCredential> {
  const credential = GoogleAuthProvider.credential(idToken);
  return signInWithCredential(auth, credential);
}

export async function signOutGoogle(): Promise<void> {
  return signOut(auth);
}

function isVerifiedSession(uid: string): boolean {
  const user = auth.currentUser;
  return Boolean(user && user.uid === uid && user.emailVerified);
}

export async function loadUserProfile(uid: string): Promise<SavedPlayerProfile | null> {
  if (!isVerifiedSession(uid)) return null;
  const path = `userProfiles/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'userProfiles', uid));
    if (!snap.exists()) return null;
    const data = snap.data();
    const playerName =
      typeof data.playerName === 'string' ? data.playerName.trim().slice(0, 18) : '';
    const gender: Gender = data.gender === 'female' ? 'female' : 'male';
    if (!playerName) return null;

    const coins =
      typeof data.coins === 'number' && Number.isInteger(data.coins)
        ? Math.max(0, Math.min(1_000_000, data.coins))
        : 0;
    const rankedWins =
      typeof data.rankedWins === 'number' && Number.isInteger(data.rankedWins)
        ? Math.max(0, Math.min(10_000, data.rankedWins))
        : 0;
    const ownedOutfits = sanitizeOwnedOutfits(data.ownedOutfits);
    const equippedOutfit: OutfitId =
      isValidOutfitId(data.equippedOutfit) && ownedOutfits.includes(data.equippedOutfit)
        ? data.equippedOutfit
        : 'default';
    const outfitLevels = sanitizeOutfitLevels(data.outfitLevels, ownedOutfits);

    const ownedWeapons = sanitizeOwnedWeapons(data.ownedWeapons);
    const equippedWeapon: WeaponId =
      isPrimaryWeapon(data.equippedWeapon as string) &&
      ownedWeapons.includes(data.equippedWeapon as WeaponId)
        ? (data.equippedWeapon as WeaponId)
        : 'pulse_carbine';
    const equippedSidearm: WeaponId =
      isSidearmWeapon(data.equippedSidearm as string) &&
      ownedWeapons.includes(data.equippedSidearm as WeaponId)
        ? (data.equippedSidearm as WeaponId)
        : 'tactical_pistol';

    const ownedKnives = sanitizeOwnedKnives(data.ownedKnives);
    const equippedKnife: KnifeId =
      isValidKnifeId(data.equippedKnife) && ownedKnives.includes(data.equippedKnife)
        ? data.equippedKnife
        : 'tactical_blade';

    const ownedWeaponSkins = sanitizeOwnedWeaponSkins(data.ownedWeaponSkins);
    const equippedWeaponSkin: WeaponSkinId =
      isValidWeaponSkinId(data.equippedWeaponSkin) && ownedWeaponSkins.includes(data.equippedWeaponSkin)
        ? data.equippedWeaponSkin
        : 'default';

    const country =
      typeof data.country === 'string' && /^[A-Z]{2}$/.test(data.country)
        ? data.country
        : undefined;

    const onlineStatus: OnlineStatus =
      data.onlineStatus === 'in_match'
        ? 'in_match'
        : data.onlineStatus === 'online'
          ? 'online'
          : 'offline';

    const currentRoomCode =
      typeof data.currentRoomCode === 'string' && /^[A-Z0-9]{1,16}$/.test(data.currentRoomCode)
        ? data.currentRoomCode
        : undefined;

    return {
      uid,
      playerName,
      gender,
      country,
      coins,
      rankedWins,
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
      dailyMissions: extractDailyMissions(data as Record<string, unknown>),
      onlineStatus,
      currentRoomCode,
      lastSeenAtMs: timestampToMs(data.lastSeenAt),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function saveUserProfile(
  uid: string,
  playerName: string,
  gender: Gender,
  country?: string,
): Promise<SavedPlayerProfile> {
  const cleanName = playerName.trim().slice(0, 18) || 'Agente';
  const cleanGender: Gender = gender === 'female' ? 'female' : 'male';
  const cleanCountry =
    typeof country === 'string' && /^[A-Z]{2}$/.test(country) ? country : undefined;
  const path = `userProfiles/${uid}`;
  const docRef = doc(db, 'userProfiles', uid);

  if (auth.currentUser && auth.currentUser.uid === uid) {
    await auth.currentUser.getIdToken(true).catch(() => {});
  }

  let existingData: Record<string, unknown> | null = null;
  try {
    const existingSnap = await getDoc(docRef);
    existingData = existingSnap.exists() ? (existingSnap.data() as Record<string, unknown>) : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }

  if (existingData) {
    const allowedProfileKeys = new Set([
      'uid',
      'playerName',
      'gender',
      'country',
      'coins',
      'rankedWins',
      'ownedOutfits',
      'equippedOutfit',
      'outfitLevels',
      'ownedWeapons',
      'equippedWeapon',
      'equippedSidearm',
      'ownedKnives',
      'equippedKnife',
      'ownedWeaponSkins',
      'equippedWeaponSkin',
      'onlineStatus',
      'currentRoomCode',
      'dailyMissionsDate',
      'dailyElims',
      'dailyWins',
      'dailyMatches',
      'dailyBestStreak',
      'dailyClaimedIds',
      'lastSeenAt',
      'createdAt',
      'updatedAt',
    ]);
    const hasExtraKeys = Object.keys(existingData).some((k) => !allowedProfileKeys.has(k));
    const hasValidCreatedAt =
      existingData.createdAt instanceof Timestamp ||
      (Boolean(existingData.createdAt) &&
        typeof (existingData.createdAt as { toMillis?: unknown }).toMillis === 'function');
    const hasValidOwnedWeapons =
      Array.isArray(existingData.ownedWeapons) &&
      existingData.ownedWeapons.length > 0 &&
      existingData.ownedWeapons.includes('tactical_pistol');
    const hasInvalidCountryField =
      'country' in existingData &&
      !(typeof existingData.country === 'string' && /^[A-Z]{2}$/.test(existingData.country));

    const ownedOutfits = sanitizeOwnedOutfits(existingData.ownedOutfits);
    const equippedOutfit: OutfitId =
      isValidOutfitId(existingData.equippedOutfit) && ownedOutfits.includes(existingData.equippedOutfit)
        ? existingData.equippedOutfit
        : 'default';
    const outfitLevels = sanitizeOutfitLevels(existingData.outfitLevels, ownedOutfits);
    const ownedWeapons = sanitizeOwnedWeapons(existingData.ownedWeapons);
    const equippedWeapon: WeaponId =
      isPrimaryWeapon(existingData.equippedWeapon as string) &&
      ownedWeapons.includes(existingData.equippedWeapon as WeaponId)
        ? (existingData.equippedWeapon as WeaponId)
        : 'pulse_carbine';
    const equippedSidearm: WeaponId =
      isSidearmWeapon(existingData.equippedSidearm as string) &&
      ownedWeapons.includes(existingData.equippedSidearm as WeaponId)
        ? (existingData.equippedSidearm as WeaponId)
        : 'tactical_pistol';
    const ownedKnives = sanitizeOwnedKnives(existingData.ownedKnives);
    const equippedKnife: KnifeId =
      isValidKnifeId(existingData.equippedKnife) && ownedKnives.includes(existingData.equippedKnife)
        ? existingData.equippedKnife
        : 'tactical_blade';
    const ownedWeaponSkins = sanitizeOwnedWeaponSkins(existingData.ownedWeaponSkins);
    const equippedWeaponSkin: WeaponSkinId =
      isValidWeaponSkinId(existingData.equippedWeaponSkin) &&
      ownedWeaponSkins.includes(existingData.equippedWeaponSkin)
        ? existingData.equippedWeaponSkin
        : 'default';
    const coins =
      typeof existingData.coins === 'number' && Number.isInteger(existingData.coins)
        ? Math.max(0, Math.min(1_000_000, existingData.coins))
        : 0;
    const rankedWins =
      typeof existingData.rankedWins === 'number' && Number.isInteger(existingData.rankedWins)
        ? Math.max(0, Math.min(10_000, existingData.rankedWins))
        : 0;
    const resolvedCountry =
      cleanCountry ??
      (typeof existingData.country === 'string' && /^[A-Z]{2}$/.test(existingData.country)
        ? existingData.country
        : undefined);
    const dailyMissions = extractDailyMissions(existingData);

    const needsSchemaRepair =
      hasExtraKeys ||
      !hasValidCreatedAt ||
      typeof existingData.coins !== 'number' ||
      !Number.isInteger(existingData.coins) ||
      !Array.isArray(existingData.ownedOutfits) ||
      !existingData.outfitLevels ||
      typeof existingData.outfitLevels !== 'object' ||
      !hasValidOwnedWeapons ||
      !isSidearmWeapon(existingData.equippedSidearm as string) ||
      !Array.isArray(existingData.ownedKnives) ||
      !Array.isArray(existingData.ownedWeaponSkins) ||
      hasInvalidCountryField;

    try {
      if (needsSchemaRepair) {
        await setDoc(docRef, {
          uid,
          playerName: cleanName,
          gender: cleanGender,
          ...(resolvedCountry ? { country: resolvedCountry } : {}),
          coins,
          rankedWins,
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
          dailyMissionsDate: dailyMissions.dateKey,
          dailyElims: dailyMissions.elims,
          dailyWins: dailyMissions.wins,
          dailyMatches: dailyMissions.matches,
          dailyBestStreak: dailyMissions.bestStreak,
          dailyClaimedIds: dailyMissions.claimedIds,
          onlineStatus: 'online',
          currentRoomCode: 'PUBLIC',
          lastSeenAt: serverTimestamp(),
          createdAt: hasValidCreatedAt ? existingData.createdAt : serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        await updateDoc(docRef, {
          playerName: cleanName,
          gender: cleanGender,
          ...(resolvedCountry ? { country: resolvedCountry } : {}),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }

    return {
      uid,
      playerName: cleanName,
      gender: cleanGender,
      country: resolvedCountry,
      coins,
      rankedWins,
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
      dailyMissions,
    };
  }

  const initialDaily = createEmptyDailyMissions();
  try {
    await setDoc(docRef, {
      uid,
      playerName: cleanName,
      gender: cleanGender,
      ...(cleanCountry ? { country: cleanCountry } : {}),
      coins: 0,
      rankedWins: 0,
      ownedOutfits: ['default'],
      equippedOutfit: 'default',
      outfitLevels: { default: 1 },
      ownedWeapons: ['pulse_carbine', 'tactical_pistol'],
      equippedWeapon: 'pulse_carbine',
      equippedSidearm: 'tactical_pistol',
      ownedKnives: ['tactical_blade'],
      equippedKnife: 'tactical_blade',
      ownedWeaponSkins: ['default'],
      equippedWeaponSkin: 'default',
      dailyMissionsDate: initialDaily.dateKey,
      dailyElims: 0,
      dailyWins: 0,
      dailyMatches: 0,
      dailyBestStreak: 0,
      dailyClaimedIds: [],
      onlineStatus: 'online',
      currentRoomCode: 'PUBLIC',
      lastSeenAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }

  return {
    uid,
    playerName: cleanName,
    gender: cleanGender,
    country: cleanCountry,
    coins: 0,
    rankedWins: 0,
    ownedOutfits: ['default'],
    equippedOutfit: 'default',
    outfitLevels: { default: 1 },
    ownedWeapons: ['pulse_carbine', 'tactical_pistol'],
    equippedWeapon: 'pulse_carbine',
    equippedSidearm: 'tactical_pistol',
    ownedKnives: ['tactical_blade'],
    equippedKnife: 'tactical_blade',
    ownedWeaponSkins: ['default'],
    equippedWeaponSkin: 'default',
    dailyMissions: initialDaily,
    onlineStatus: 'online',
    currentRoomCode: 'PUBLIC',
  };
}

export async function saveMatchProgressToProfile(
  uid: string,
  totalCoins: number,
  rankedWins?: number,
  coinsEarned?: number,
): Promise<void> {
  if (!isVerifiedSession(uid)) return;
  const path = `userProfiles/${uid}`;
  const docRef = doc(db, 'userProfiles', uid);
  const cleanCoins = Math.max(0, Math.min(1_000_000, Math.floor(totalCoins)));
  const cleanEarned =
    typeof coinsEarned === 'number' && Number.isFinite(coinsEarned)
      ? Math.max(0, Math.min(250, Math.floor(coinsEarned)))
      : undefined;
  const cleanRankedWins =
    typeof rankedWins === 'number' && Number.isFinite(rankedWins)
      ? Math.max(0, Math.min(10_000, Math.floor(rankedWins)))
      : undefined;
  try {
    const snap = await getDoc(docRef);
    if (!snap.exists()) return;
    const data = snap.data();
    if (typeof data.coins !== 'number') {
      await updateDoc(docRef, {
        coins: Math.min(250, cleanEarned ?? cleanCoins),
        rankedWins: cleanRankedWins !== undefined ? Math.min(1, cleanRankedWins) : 0,
        ownedOutfits: ['default'],
        equippedOutfit: 'default',
        outfitLevels: { default: 1 },
        ownedWeapons: ['pulse_carbine', 'tactical_pistol'],
        equippedWeapon: 'pulse_carbine',
        equippedSidearm: 'tactical_pistol',
        ownedKnives: ['tactical_blade'],
        equippedKnife: 'tactical_blade',
        ownedWeaponSkins: ['default'],
        equippedWeaponSkin: 'default',
        updatedAt: serverTimestamp(),
      });
    } else {
      const existingCoins = Math.max(0, Math.min(1_000_000, Math.floor(data.coins)));
      const targetCoins =
        cleanEarned !== undefined ? existingCoins + cleanEarned : cleanCoins;
      const safeCoins = Math.max(
        existingCoins,
        Math.min(1_000_000, existingCoins + 250, targetCoins),
      );
      const existingWins =
        typeof data.rankedWins === 'number' && Number.isFinite(data.rankedWins)
          ? Math.max(0, Math.min(10_000, Math.floor(data.rankedWins)))
          : 0;
      const safeWins =
        cleanRankedWins !== undefined
          ? Math.max(existingWins, Math.min(10_000, existingWins + 1, cleanRankedWins))
          : undefined;

      await updateDoc(docRef, {
        coins: safeCoins,
        ...(safeWins !== undefined ? { rankedWins: safeWins } : {}),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveOutfitPurchaseToProfile(
  uid: string,
  nextCoins: number,
  ownedOutfits: OutfitId[],
  equippedOutfit: OutfitId,
  outfitLevels?: Partial<Record<OutfitId, number>>,
): Promise<void> {
  if (!isVerifiedSession(uid)) return;
  const path = `userProfiles/${uid}`;
  const docRef = doc(db, 'userProfiles', uid);
  const cleanOwned = sanitizeOwnedOutfits(ownedOutfits);
  const cleanEquip = cleanOwned.includes(equippedOutfit) ? equippedOutfit : 'default';
  try {
    const snap = await getDoc(docRef);
    if (!snap.exists()) return;
    const data = snap.data();
    if (typeof data.coins !== 'number' || !Array.isArray(data.ownedOutfits)) return;

    const existingOwned = sanitizeOwnedOutfits(data.ownedOutfits);
    const mergedOwned = Array.from(new Set([...existingOwned, ...cleanOwned])).slice(0, 10);
    const existingCoins = Math.max(0, Math.floor(data.coins));
    const outfitPrice = getOutfitById(cleanEquip).price;
    if (existingOwned.includes(cleanEquip) || outfitPrice <= 0) {
      await saveEquippedOutfitToProfile(uid, cleanEquip);
      return;
    }
    const candidateCoins = Math.max(
      0,
      Math.min(existingCoins - 1, Math.floor(nextCoins), existingCoins - outfitPrice),
    );
    if (existingCoins < 1 || candidateCoins >= existingCoins) return;

    const mergedLevels = sanitizeOutfitLevels(
      { ...sanitizeOutfitLevels(data.outfitLevels, mergedOwned), ...outfitLevels },
      mergedOwned,
    );
    await updateDoc(docRef, {
      coins: candidateCoins,
      ownedOutfits: mergedOwned,
      equippedOutfit: mergedOwned.includes(cleanEquip) ? cleanEquip : 'default',
      outfitLevels: mergedLevels,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveEquippedOutfitToProfile(
  uid: string,
  equippedOutfit: OutfitId,
): Promise<void> {
  if (!isVerifiedSession(uid) || !isValidOutfitId(equippedOutfit)) return;
  const path = `userProfiles/${uid}`;
  const docRef = doc(db, 'userProfiles', uid);
  try {
    const snap = await getDoc(docRef);
    if (!snap.exists()) return;
    const data = snap.data();
    if (!Array.isArray(data.ownedOutfits) || !data.ownedOutfits.includes(equippedOutfit)) {
      return;
    }
    await updateDoc(docRef, {
      equippedOutfit,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveOutfitUpgradeToProfile(
  uid: string,
  nextCoins: number,
  outfitLevels: Partial<Record<OutfitId, number>>,
  ownedOutfits?: OutfitId[],
): Promise<void> {
  if (!isVerifiedSession(uid)) return;
  const path = `userProfiles/${uid}`;
  const docRef = doc(db, 'userProfiles', uid);
  try {
    const snap = await getDoc(docRef);
    if (!snap.exists()) return;
    const data = snap.data();
    if (typeof data.coins !== 'number' || !Array.isArray(data.ownedOutfits)) return;

    const existingCoins = Math.max(0, Math.floor(data.coins));
    const candidateCoins = Math.max(0, Math.min(existingCoins - 1, Math.floor(nextCoins)));
    if (existingCoins < 1 || candidateCoins >= existingCoins) return;

    const existingOwned = sanitizeOwnedOutfits(data.ownedOutfits);
    const allowedOutfits = Array.from(new Set([...existingOwned, ...(ownedOutfits ?? [])])).filter(
      (id) => existingOwned.includes(id),
    );
    const existingLevels = sanitizeOutfitLevels(data.outfitLevels, existingOwned);
    const incomingLevels = sanitizeOutfitLevels(outfitLevels, allowedOutfits);
    const mergedLevels: Partial<Record<OutfitId, number>> = { ...existingLevels };
    for (const [key, val] of Object.entries(incomingLevels) as Array<[OutfitId, number]>) {
      mergedLevels[key] = Math.max(existingLevels[key] ?? 1, val);
    }

    await updateDoc(docRef, {
      coins: candidateCoins,
      outfitLevels: mergedLevels,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveWeaponPurchaseToProfile(
  uid: string,
  nextCoins: number,
  ownedWeapons: WeaponId[],
  equippedWeaponOrSidearm: WeaponId,
): Promise<void> {
  if (!isVerifiedSession(uid)) return;
  const path = `userProfiles/${uid}`;
  const docRef = doc(db, 'userProfiles', uid);
  const cleanOwned = sanitizeOwnedWeapons(ownedWeapons);
  const cleanTarget = isValidWeaponId(equippedWeaponOrSidearm)
    ? equippedWeaponOrSidearm
    : 'pulse_carbine';
  const def = getWeaponById(cleanTarget);
  try {
    const snap = await getDoc(docRef);
    if (!snap.exists()) return;
    const data = snap.data();
    if (typeof data.coins !== 'number') return;

    const existingOwned = sanitizeOwnedWeapons(data.ownedWeapons);
    const mergedOwned = Array.from(new Set([...existingOwned, ...cleanOwned])).slice(0, 11);
    const existingCoins = Math.max(0, Math.floor(data.coins));
    const weaponPrice = def.price;
    if ((Array.isArray(data.ownedWeapons) && data.ownedWeapons.includes(cleanTarget)) || weaponPrice <= 0) {
      await saveEquippedWeaponToProfile(uid, cleanTarget);
      return;
    }
    const candidateCoins = Math.max(
      0,
      Math.min(existingCoins - 1, Math.floor(nextCoins), existingCoins - weaponPrice),
    );
    if (existingCoins < 1 || candidateCoins >= existingCoins) return;

    const equipField =
      def.slot === 'sidearm'
        ? { equippedSidearm: mergedOwned.includes(cleanTarget) ? cleanTarget : 'tactical_pistol' }
        : { equippedWeapon: mergedOwned.includes(cleanTarget) ? cleanTarget : 'pulse_carbine' };

    await updateDoc(docRef, {
      coins: candidateCoins,
      ownedWeapons: mergedOwned,
      ...equipField,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveEquippedWeaponToProfile(
  uid: string,
  weaponId: WeaponId,
): Promise<void> {
  if (!isVerifiedSession(uid) || !isValidWeaponId(weaponId)) return;
  const path = `userProfiles/${uid}`;
  const docRef = doc(db, 'userProfiles', uid);
  const def = getWeaponById(weaponId);
  try {
    const snap = await getDoc(docRef);
    if (!snap.exists()) return;
    const data = snap.data();
    if (!Array.isArray(data.ownedWeapons)) {
      await updateDoc(docRef, {
        ownedWeapons: ['pulse_carbine', 'tactical_pistol'],
        equippedWeapon: 'pulse_carbine',
        equippedSidearm: 'tactical_pistol',
        updatedAt: serverTimestamp(),
      });
    } else if (def.slot === 'sidearm') {
      if (data.ownedWeapons.includes(weaponId)) {
        await updateDoc(docRef, {
          equippedSidearm: weaponId,
          updatedAt: serverTimestamp(),
        });
      } else if (weaponId === 'tactical_pistol') {
        const nextOwned = Array.from(new Set([...data.ownedWeapons.filter(isValidWeaponId), 'tactical_pistol'])).slice(0, 11);
        await updateDoc(docRef, {
          ownedWeapons: nextOwned,
          equippedSidearm: 'tactical_pistol',
          updatedAt: serverTimestamp(),
        });
      }
    } else if (data.ownedWeapons.includes(weaponId)) {
      await updateDoc(docRef, {
        equippedWeapon: weaponId,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveKnifePurchaseToProfile(
  uid: string,
  nextCoins: number,
  ownedKnives: KnifeId[],
  equippedKnife: KnifeId,
): Promise<void> {
  if (!isVerifiedSession(uid)) return;
  const path = `userProfiles/${uid}`;
  const docRef = doc(db, 'userProfiles', uid);
  const cleanOwned = sanitizeOwnedKnives(ownedKnives);
  const cleanEquip = cleanOwned.includes(equippedKnife) ? equippedKnife : 'tactical_blade';
  try {
    const snap = await getDoc(docRef);
    if (!snap.exists()) return;
    const data = snap.data();
    if (typeof data.coins !== 'number') return;

    const existingOwned = sanitizeOwnedKnives(data.ownedKnives);
    const mergedOwned = Array.from(new Set([...existingOwned, ...cleanOwned])).slice(0, 5);
    const existingCoins = Math.max(0, Math.floor(data.coins));
    const knifePrice = getKnifeById(cleanEquip).price;
    if (
      (Array.isArray(data.ownedKnives) && data.ownedKnives.includes(cleanEquip)) ||
      knifePrice <= 0
    ) {
      await saveEquippedKnifeToProfile(uid, cleanEquip);
      return;
    }
    const candidateCoins = Math.max(
      0,
      Math.min(existingCoins - 1, Math.floor(nextCoins), existingCoins - knifePrice),
    );
    if (existingCoins < 1 || candidateCoins >= existingCoins) return;

    await updateDoc(docRef, {
      coins: candidateCoins,
      ownedKnives: mergedOwned,
      equippedKnife: mergedOwned.includes(cleanEquip) ? cleanEquip : 'tactical_blade',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveEquippedKnifeToProfile(
  uid: string,
  equippedKnife: KnifeId,
): Promise<void> {
  if (!isVerifiedSession(uid) || !isValidKnifeId(equippedKnife)) return;
  const path = `userProfiles/${uid}`;
  const docRef = doc(db, 'userProfiles', uid);
  try {
    const snap = await getDoc(docRef);
    if (!snap.exists()) return;
    const data = snap.data();
    if (!Array.isArray(data.ownedKnives)) {
      await updateDoc(docRef, {
        ownedKnives: ['tactical_blade'],
        equippedKnife: 'tactical_blade',
        updatedAt: serverTimestamp(),
      });
    } else if (data.ownedKnives.includes(equippedKnife)) {
      await updateDoc(docRef, {
        equippedKnife,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveWeaponSkinPurchaseToProfile(
  uid: string,
  nextCoins: number,
  ownedWeaponSkins: WeaponSkinId[],
  equippedWeaponSkin: WeaponSkinId,
): Promise<void> {
  if (!isVerifiedSession(uid)) return;
  const path = `userProfiles/${uid}`;
  const docRef = doc(db, 'userProfiles', uid);
  const cleanOwned = sanitizeOwnedWeaponSkins(ownedWeaponSkins);
  const cleanEquip = cleanOwned.includes(equippedWeaponSkin) ? equippedWeaponSkin : 'default';
  try {
    const snap = await getDoc(docRef);
    if (!snap.exists()) return;
    const data = snap.data();
    if (typeof data.coins !== 'number') return;

    const existingOwned = sanitizeOwnedWeaponSkins(data.ownedWeaponSkins);
    const mergedOwned = Array.from(new Set([...existingOwned, ...cleanOwned])).slice(0, 6);
    const existingCoins = Math.max(0, Math.floor(data.coins));
    const skinPrice = getWeaponSkinById(cleanEquip).price;
    if (existingOwned.includes(cleanEquip) || skinPrice <= 0) {
      await saveEquippedWeaponSkinToProfile(uid, cleanEquip);
      return;
    }
    const candidateCoins = Math.max(
      0,
      Math.min(existingCoins - 1, Math.floor(nextCoins), existingCoins - skinPrice),
    );
    if (existingCoins < 1 || candidateCoins >= existingCoins) return;

    await updateDoc(docRef, {
      coins: candidateCoins,
      ownedWeaponSkins: mergedOwned,
      equippedWeaponSkin: mergedOwned.includes(cleanEquip) ? cleanEquip : 'default',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveEquippedWeaponSkinToProfile(
  uid: string,
  equippedWeaponSkin: WeaponSkinId,
): Promise<void> {
  if (!isVerifiedSession(uid) || !isValidWeaponSkinId(equippedWeaponSkin)) return;
  const path = `userProfiles/${uid}`;
  const docRef = doc(db, 'userProfiles', uid);
  try {
    const snap = await getDoc(docRef);
    if (!snap.exists()) return;
    const data = snap.data();
    if (!Array.isArray(data.ownedWeaponSkins)) {
      await updateDoc(docRef, {
        ownedWeaponSkins: ['default'],
        equippedWeaponSkin: 'default',
        updatedAt: serverTimestamp(),
      });
    } else if (data.ownedWeaponSkins.includes(equippedWeaponSkin)) {
      await updateDoc(docRef, {
        equippedWeaponSkin,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateUserPresence(
  uid: string,
  onlineStatus: OnlineStatus,
  currentRoomCode?: string,
): Promise<void> {
  if (!isVerifiedSession(uid)) return;
  const path = `userProfiles/${uid}`;
  const docRef = doc(db, 'userProfiles', uid);
  const cleanRoom =
    typeof currentRoomCode === 'string' && /^[A-Z0-9]{1,16}$/.test(currentRoomCode)
      ? currentRoomCode
      : 'PUBLIC';
  try {
    const snap = await getDoc(docRef);
    if (!snap.exists()) return;
    await updateDoc(docRef, {
      onlineStatus,
      currentRoomCode: cleanRoom,
      lastSeenAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function fetchUserProfilesForFriends(myUid?: string): Promise<FriendProfileItem[]> {
  const path = 'userProfiles';
  try {
    const snap = await getDocs(query(collection(db, 'userProfiles'), limit(60)));
    const now = Date.now();
    const list: FriendProfileItem[] = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      const uid = typeof data.uid === 'string' ? data.uid : docSnap.id;
      if (myUid && uid === myUid) return;
      const playerName =
        typeof data.playerName === 'string' ? data.playerName.trim().slice(0, 18) : '';
      if (!playerName) return;

      const gender: Gender = data.gender === 'female' ? 'female' : 'male';
      const country =
        typeof data.country === 'string' && /^[A-Z]{2}$/.test(data.country)
          ? data.country
          : undefined;
      const lastSeenAtMs = timestampToMs(data.lastSeenAt) || timestampToMs(data.updatedAt);
      const rawStatus: OnlineStatus =
        data.onlineStatus === 'in_match'
          ? 'in_match'
          : data.onlineStatus === 'online'
            ? 'online'
            : 'offline';
      const isFresh = lastSeenAtMs > 0 && now - lastSeenAtMs < 95_000;
      const onlineStatus: OnlineStatus = isFresh && rawStatus !== 'offline' ? rawStatus : 'offline';
      const currentRoomCode =
        typeof data.currentRoomCode === 'string' && /^[A-Z0-9]{1,16}$/.test(data.currentRoomCode)
          ? data.currentRoomCode
          : undefined;

      list.push({
        uid,
        playerName,
        gender,
        country,
        onlineStatus,
        currentRoomCode,
        lastSeenAtMs,
      });
    });

    const rankWeight = (status: OnlineStatus) =>
      status === 'in_match' ? 2 : status === 'online' ? 1 : 0;
    return list.sort(
      (a, b) =>
        rankWeight(b.onlineStatus) - rankWeight(a.onlineStatus) ||
        b.lastSeenAtMs - a.lastSeenAtMs ||
        a.playerName.localeCompare(b.playerName),
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function sendRoomInvite(params: {
  fromUid: string;
  fromName: string;
  fromCountry?: string;
  toUid: string;
  toName: string;
  roomCode: string;
}): Promise<string> {
  const cleanRoom = params.roomCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
  if (
    !isVerifiedSession(params.fromUid) ||
    !params.toUid ||
    params.fromUid === params.toUid ||
    !/^[A-Z0-9]{4,10}$/.test(cleanRoom)
  ) {
    return '';
  }
  const inviteId = `inv_${params.fromUid.slice(0, 12)}_${params.toUid.slice(0, 12)}_${Date.now().toString(36)}`;
  const path = `roomInvites/${inviteId}`;
  const cleanCountry =
    typeof params.fromCountry === 'string' && /^[A-Z]{2}$/.test(params.fromCountry)
      ? params.fromCountry
      : undefined;

  try {
    await setDoc(doc(db, 'roomInvites', inviteId), {
      fromUid: params.fromUid,
      fromName: params.fromName.trim().slice(0, 18) || 'Agente',
      ...(cleanCountry ? { fromCountry: cleanCountry } : {}),
      toUid: params.toUid,
      toName: params.toName.trim().slice(0, 18) || 'Agente',
      roomCode: cleanRoom,
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return inviteId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export function subscribeToIncomingRoomInvites(
  myUid: string,
  onInvites: (invites: RoomInviteRecord[]) => void,
): Unsubscribe {
  const path = 'roomInvites';
  const q = query(collection(db, 'roomInvites'), where('toUid', '==', myUid), limit(25));
  return onSnapshot(
    q,
    (snap) => {
      const now = Date.now();
      const invites: RoomInviteRecord[] = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.status !== 'pending') return;
        const createdAtMs = timestampToMs(data.createdAt);
        // Only surface fresh invitations from the last 10 minutes
        if (createdAtMs > 0 && now - createdAtMs > 600_000) return;
        const roomCode = typeof data.roomCode === 'string' ? data.roomCode : '';
        if (!/^[A-Z0-9]{4,10}$/.test(roomCode)) return;
        invites.push({
          id: docSnap.id,
          fromUid: String(data.fromUid || ''),
          fromName: String(data.fromName || 'Agente'),
          fromCountry:
            typeof data.fromCountry === 'string' && /^[A-Z]{2}$/.test(data.fromCountry)
              ? data.fromCountry
              : undefined,
          toUid: String(data.toUid || ''),
          toName: String(data.toName || 'Agente'),
          roomCode,
          status: 'pending',
          createdAtMs,
        });
      });
      invites.sort((a, b) => b.createdAtMs - a.createdAtMs);
      onInvites(invites);
    },
    (error) => {
      console.warn('Room invites listener warning:', {
        path,
        error: error instanceof Error ? error.message : String(error),
      });
      onInvites([]);
    },
  );
}

export async function respondToRoomInvite(
  inviteId: string,
  status: 'accepted' | 'declined',
): Promise<void> {
  const path = `roomInvites/${inviteId}`;
  try {
    await updateDoc(doc(db, 'roomInvites', inviteId), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveDailyMissionsProgressToProfile(
  uid: string,
  progress: DailyMissionsProgress,
): Promise<void> {
  if (!isVerifiedSession(uid)) return;
  const path = `userProfiles/${uid}`;
  const docRef = doc(db, 'userProfiles', uid);
  const clean = ensureTodayDailyMissions(progress);
  try {
    const snap = await getDoc(docRef);
    if (!snap.exists()) return;
    const data = snap.data();
    const existingClaimed =
      data.dailyMissionsDate === clean.dateKey && Array.isArray(data.dailyClaimedIds)
        ? data.dailyClaimedIds.filter(isValidDailyMissionId)
        : [];
    const mergedClaimed = Array.from(new Set([...existingClaimed, ...clean.claimedIds])).slice(0, 4);

    await updateDoc(docRef, {
      dailyMissionsDate: clean.dateKey,
      dailyElims: clean.elims,
      dailyWins: clean.wins,
      dailyMatches: clean.matches,
      dailyBestStreak: clean.bestStreak,
      dailyClaimedIds: mergedClaimed,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function claimDailyMissionRewardInProfile(
  uid: string,
  nextCoins: number,
  progress: DailyMissionsProgress,
): Promise<void> {
  if (!isVerifiedSession(uid)) return;
  const path = `userProfiles/${uid}`;
  const docRef = doc(db, 'userProfiles', uid);
  const clean = ensureTodayDailyMissions(progress);
  try {
    const snap = await getDoc(docRef);
    if (!snap.exists()) return;
    const data = snap.data();
    if (typeof data.coins !== 'number') return;

    const existingCoins = Math.max(0, Math.floor(data.coins));
    const existingClaimed =
      data.dailyMissionsDate === clean.dateKey && Array.isArray(data.dailyClaimedIds)
        ? Array.from(new Set(data.dailyClaimedIds.filter(isValidDailyMissionId)))
        : [];
    const newlyClaimed = clean.claimedIds.filter((id) => !existingClaimed.includes(id));
    if (newlyClaimed.length === 0) return;

    const nextClaimed = [...existingClaimed, newlyClaimed[0]].slice(0, 4);
    const safeCoins = Math.min(
      1_000_000,
      existingCoins + 120,
      Math.max(existingCoins + 1, Math.floor(nextCoins)),
    );
    if (safeCoins <= existingCoins) return;

    await updateDoc(docRef, {
      coins: safeCoins,
      dailyMissionsDate: clean.dateKey,
      dailyElims: clean.elims,
      dailyWins: clean.wins,
      dailyMatches: clean.matches,
      dailyBestStreak: clean.bestStreak,
      dailyClaimedIds: nextClaimed,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

