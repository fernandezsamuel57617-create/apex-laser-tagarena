import type { User } from 'firebase/auth';
import {
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  Globe,
  KeyRound,
  LogOut,
  Mail,
  RefreshCw,
  Search,
  ShieldCheck,
  Trophy,
  UserCheck,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  googleOAuthClientId,
  type SavedPlayerProfile,
  type SocialAuthProviderId,
} from '../firebase';
import {
  WORLD_COUNTRIES,
  countryCodeToFlag,
  getCountryByCode,
  normalizeCountrySearch,
} from '../shared/countries';
import type { Gender, LeaderboardEntry } from '../shared/types';
import { GENDER_PORTRAIT } from './LeaderboardModal';
import { PWAInstallButton } from './PWAInstallButton';
import { GAME_LOGO_URL } from './SplashIntroOverlay';

interface GoogleAccountsWindow extends Window {
  google?: {
    accounts?: {
      id?: {
        initialize: (config: {
          client_id: string;
          callback: (resp: { credential?: string }) => void;
          use_fedcm_for_prompt?: boolean;
          use_fedcm_for_button?: boolean;
          context?: string;
        }) => void;
        renderButton: (
          parent: HTMLElement,
          options: {
            theme?: 'outline' | 'filled_blue' | 'filled_black';
            size?: 'large' | 'medium' | 'small';
            text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
            shape?: 'rectangular' | 'pill' | 'circle' | 'square';
            width?: number;
            locale?: string;
          },
        ) => void;
      };
    };
  };
}

interface CharacterSelectScreenProps {
  authReady: boolean;
  authUser: User | null;
  authEmailVerified: boolean;
  savedProfile: SavedPlayerProfile | null;
  profileLoading: boolean;
  signingIn: boolean;
  savingProfile: boolean;
  authError: string | null;
  onGoogleCredential: (idToken: string) => void;
  onGoogleSignIn: () => void;
  onSocialSignIn: (providerId: SocialAuthProviderId) => void;
  onEmailSignIn: (email: string, password: string) => Promise<void>;
  onEmailRegister: (email: string, password: string, displayName?: string) => Promise<void>;
  onResetPassword: (email: string) => Promise<boolean>;
  onResendVerification: () => Promise<boolean>;
  onRefreshVerification: () => Promise<boolean>;
  onGoogleSignOut: () => void;
  onClearAuthError?: () => void;
  onEnterLobby: (name: string, gender: Gender, country?: string) => void;
  connecting: boolean;
  errorMsg: string | null;
  leaderboard: LeaderboardEntry[];
  onOpenLeaderboard: () => void;
  muted: boolean;
  onToggleMute: () => void;
}

export function CharacterSelectScreen({
  authReady,
  authUser,
  authEmailVerified,
  savedProfile,
  profileLoading,
  signingIn,
  savingProfile,
  authError,
  onGoogleCredential,
  onGoogleSignIn,
  onSocialSignIn,
  onEmailSignIn,
  onEmailRegister,
  onResetPassword,
  onResendVerification,
  onRefreshVerification,
  onGoogleSignOut,
  onClearAuthError,
  onEnterLobby,
  connecting,
  errorMsg,
  leaderboard,
  onOpenLeaderboard,
  muted,
  onToggleMute,
}: CharacterSelectScreenProps) {
  const [guestMode, setGuestMode] = useState(false);
  const [authTab, setAuthTab] = useState<'social' | 'email'>('social');
  const [emailMode, setEmailMode] = useState<'login' | 'register' | 'reset'>('login');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [emailDisplayName, setEmailDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailNotice, setEmailNotice] = useState<string | null>(null);
  const [verifyNotice, setVerifyNotice] = useState<string | null>(null);
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [gender, setGender] = useState<Gender>('male');
  const [name, setName] = useState<string>('Agente 01');
  const [country, setCountry] = useState<string>('');
  const [countrySearch, setCountrySearch] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'country' | 'character'>('character');
  const [gisReady, setGisReady] = useState(false);
  const gsiBtnRef = useRef<HTMLDivElement | null>(null);
  const onGoogleCredentialRef = useRef(onGoogleCredential);
  onGoogleCredentialRef.current = onGoogleCredential;
  const lastAuthUidRef = useRef<string | null>(null);

  useEffect(() => {
    if (savedProfile) {
      setGender(savedProfile.gender);
      setName(savedProfile.playerName);
      if (savedProfile.country) {
        setCountry(savedProfile.country);
      }
    } else if (authUser?.displayName) {
      const clean = authUser.displayName.trim().slice(0, 18);
      if (clean) setName(clean);
    }
  }, [savedProfile, authUser]);

  // When a verified user logs in, surface the World Countries tab automatically if no country is saved yet
  useEffect(() => {
    if (!authUser) {
      lastAuthUidRef.current = null;
      return;
    }
    if (profileLoading || !authEmailVerified) return;
    if (lastAuthUidRef.current !== authUser.uid) {
      lastAuthUidRef.current = authUser.uid;
      if (!savedProfile?.country) {
        setActiveTab('country');
      }
    }
  }, [authUser, authEmailVerified, profileLoading, savedProfile]);

  const filteredCountries = useMemo(() => {
    const q = normalizeCountrySearch(countrySearch);
    if (!q) return WORLD_COUNTRIES;
    return WORLD_COUNTRIES.filter((c) => {
      const haystack = normalizeCountrySearch(`${c.name} ${c.aliases ?? ''} ${c.code}`);
      return haystack.includes(q);
    });
  }, [countrySearch]);

  const selectedCountryObj = useMemo(() => getCountryByCode(country), [country]);

  const showAuthGate = !authUser && !guestMode;

  const isInIframe = typeof window !== 'undefined' && window.self !== window.top;

  // Render Google Identity Services sign-in button when on Step 1 (avoid forcing FedCM inside cross-origin iframes)
  useEffect(() => {
    if (!authReady || !showAuthGate || !googleOAuthClientId) return;

    let cancelled = false;
    let attempts = 0;

    const tryInitGis = () => {
      if (cancelled) return;
      const gWin = window as GoogleAccountsWindow;
      const gsi = gWin.google?.accounts?.id;
      const container = gsiBtnRef.current;
      if (gsi && container) {
        try {
          gsi.initialize({
            client_id: googleOAuthClientId,
            callback: (resp) => {
              if (resp.credential) {
                onGoogleCredentialRef.current(resp.credential);
              }
            },
            use_fedcm_for_prompt: false,
            use_fedcm_for_button: false,
            context: 'signin',
          });
          container.innerHTML = '';
          const btnWidth = Math.max(240, Math.min(340, container.clientWidth || 320));
          gsi.renderButton(container, {
            theme: 'outline',
            size: 'large',
            text: 'continue_with',
            shape: 'rectangular',
            width: btnWidth,
            locale: 'es',
          });
          setGisReady(true);
        } catch {
          setGisReady(false);
        }
        return;
      }

      attempts += 1;
      if (attempts < 25) {
        window.setTimeout(tryInitGis, 200);
      }
    };

    tryInitGis();
    return () => {
      cancelled = true;
    };
  }, [authReady, showAuthGate]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (connecting || savingProfile) return;
    onEnterLobby(name.trim() || 'Agente', gender, country || undefined);
  };

  const handleEmailAuthSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (signingIn) return;
    setEmailNotice(null);
    onClearAuthError?.();
    const cleanEmail = emailInput.trim();
    if (!cleanEmail) {
      setEmailNotice('Escribe tu correo electrónico.');
      return;
    }
    if (emailMode === 'reset') {
      const ok = await onResetPassword(cleanEmail);
      if (ok) {
        setEmailNotice(
          `Enviamos un enlace para restablecer tu contraseña a ${cleanEmail}. Revisa tu bandeja o spam.`,
        );
      }
      return;
    }
    if (passwordInput.length < 6) {
      setEmailNotice('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (emailMode === 'register') {
      await onEmailRegister(cleanEmail, passwordInput, emailDisplayName.trim() || undefined);
    } else {
      await onEmailSignIn(cleanEmail, passwordInput);
    }
  };

  const handleCheckVerification = async () => {
    if (verifyBusy) return;
    setVerifyBusy(true);
    setVerifyNotice(null);
    const verified = await onRefreshVerification();
    setVerifyNotice(
      verified
        ? '¡Correo verificado! Ya puedes guardar tu progreso.'
        : 'Aún no aparece verificado. Abre el enlace en tu correo y vuelve a intentar.',
    );
    setVerifyBusy(false);
  };

  const handleSendVerificationAgain = async () => {
    if (verifyBusy) return;
    setVerifyBusy(true);
    setVerifyNotice(null);
    const ok = await onResendVerification();
    if (ok) {
      setVerifyNotice('Te reenviamos el correo de verificación. Revisa tu bandeja o spam.');
    }
    setVerifyBusy(false);
  };

  const topThree = leaderboard.slice(0, 3);

  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-between overflow-y-auto bg-[#080C14]/84 p-3.5 sm:p-6 md:p-10 pt-safe pb-safe">
      {/* Top minimal utility bar */}
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-2 sm:gap-4">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <img
            src={GAME_LOGO_URL}
            alt="Apex Laser Tag Arena"
            referrerPolicy="no-referrer"
            className="h-9 sm:h-10 w-auto rounded-md border border-amber-400/35 bg-[#060B16] object-contain p-0.5 shrink-0"
          />
          <span className="font-display text-sm sm:text-lg font-bold tracking-wider text-white truncate">
            APEX LASER TAG
          </span>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <PWAInstallButton />

          <button
            type="button"
            onClick={onOpenLeaderboard}
            className="flex min-h-[44px] items-center gap-1.5 sm:gap-2 rounded-lg border border-slate-700 bg-[#0D1422] px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-slate-100 hover:border-amber-400/60 hover:text-amber-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Trophy className="h-4 w-4 text-amber-400" />
            <span className="hidden xs:inline sm:inline">Tabla de Líderes</span>
            <span className="sm:hidden">Ranking</span>
          </button>

          <button
            type="button"
            onClick={onToggleMute}
            aria-label={muted ? 'Activar sonido' : 'Silenciar sonido'}
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-700 bg-[#0D1422] text-slate-200 hover:border-slate-500 transition-colors cursor-pointer"
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto my-auto w-full max-w-5xl py-4 sm:py-6">
        {!authReady || profileLoading ? (
          <div className="mx-auto max-w-md rounded-xl border border-slate-800 bg-[#0D1422] p-6 sm:p-8 text-center">
            <div className="font-display text-lg font-bold text-white">
              Conectando con tu cuenta...
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Verificando sesión de Google y perfil guardado.
            </p>
          </div>
        ) : authUser && savedProfile ? (
          <div className="mx-auto max-w-md rounded-xl border border-cyan-500/40 bg-[#0D1422] p-5 sm:p-8 text-center shadow-2xl">
            <img
              src={GAME_LOGO_URL}
              alt="Apex Laser Tag Arena"
              referrerPolicy="no-referrer"
              className="mx-auto h-20 sm:h-24 w-auto rounded-xl border border-amber-400/35 bg-[#060B16] p-1 object-contain"
            />
            <div className="mt-4 font-display text-xl font-bold text-white">
              Bienvenido de vuelta, {savedProfile.playerName}
            </div>
            <p className="mt-1.5 text-xs text-cyan-300">
              {connecting
                ? 'Entrando directamente al Lobby 3D...'
                : 'Cuenta guardada cargada. Listo para desplegar.'}
            </p>
            {(errorMsg || authError) && (
              <div className="mt-4 rounded-lg border border-rose-500/40 bg-rose-950/50 px-3 py-2 text-xs text-rose-200">
                {errorMsg || authError}
              </div>
            )}
            <div className="mt-5 flex flex-col gap-2.5">
              <button
                type="button"
                disabled={connecting}
                onClick={() =>
                  onEnterLobby(savedProfile.playerName, savedProfile.gender, savedProfile.country)
                }
                className="min-h-[46px] w-full rounded-lg bg-cyan-500 px-5 py-3 font-display text-sm font-bold text-slate-950 hover:bg-cyan-400 disabled:opacity-60 transition-colors cursor-pointer"
              >
                {connecting ? 'Conectando al Lobby...' : 'Entrar al Lobby'}
              </button>
              <button
                type="button"
                onClick={onGoogleSignOut}
                className="flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Cambiar de cuenta</span>
              </button>
            </div>
          </div>
        ) : showAuthGate ? (
          <div className="grid grid-cols-1 gap-5 sm:gap-8 lg:grid-cols-12 items-stretch">
            <div className="lg:col-span-7 flex flex-col justify-center rounded-xl border border-slate-800 bg-[#0D1422] p-5 sm:p-7 md:p-8">
              <div className="inline-flex w-fit items-center gap-2 rounded-md border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-300">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Paso 1 de 2 · Cuenta y Progreso</span>
              </div>

              <h1 className="mt-3 sm:mt-4 font-display text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-white">
                Inicia sesión para jugar y guardar
              </h1>
              <p className="mt-2.5 text-sm md:text-base text-slate-300">
                Conecta una cuenta para guardar tu{' '}
                <strong className="text-cyan-300">nombre, monedas, armas y trajes</strong>{' '}
                entre dispositivos.
              </p>

              {/* Auth Method Switcher */}
              <div className="mt-5 grid grid-cols-2 gap-2 rounded-lg border border-slate-800 bg-[#090E18] p-1">
                <button
                  type="button"
                  onClick={() => {
                    setAuthTab('social');
                    setEmailNotice(null);
                    onClearAuthError?.();
                  }}
                  className={`flex min-h-[40px] items-center justify-center gap-2 rounded-md px-3 py-2 text-xs sm:text-sm font-bold transition-colors cursor-pointer ${
                    authTab === 'social'
                      ? 'bg-cyan-500 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <ShieldCheck className="h-4 w-4" />
                  <span>Acceso rápido</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthTab('email');
                    setEmailNotice(null);
                    onClearAuthError?.();
                  }}
                  className={`flex min-h-[40px] items-center justify-center gap-2 rounded-md px-3 py-2 text-xs sm:text-sm font-bold transition-colors cursor-pointer ${
                    authTab === 'email'
                      ? 'bg-amber-400 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Mail className="h-4 w-4" />
                  <span>Correo y contraseña</span>
                </button>
              </div>

              {authError && (
                <div className="mt-4 rounded-lg border border-rose-500/40 bg-rose-950/50 px-3.5 py-2.5 text-xs text-rose-200 space-y-2">
                  <div>{authError}</div>
                  <a
                    href={typeof window !== 'undefined' ? window.location.href : '/'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 font-semibold text-cyan-300 hover:text-cyan-200 underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>Abrir juego en una pestaña nueva para iniciar sesión</span>
                  </a>
                </div>
              )}

              {authTab === 'social' ? (
                <div className="mt-4 flex flex-col gap-3">
                  {/* Official Google Identity Services button (works with FedCM inside iframes) */}
                  <div
                    ref={gsiBtnRef}
                    className={
                      gisReady ? 'flex w-full justify-center rounded-lg bg-white py-1' : 'hidden'
                    }
                  />

                  <button
                    type="button"
                    onClick={onGoogleSignIn}
                    disabled={signingIn}
                    className="flex min-h-[44px] w-full items-center justify-center gap-3 rounded-lg bg-white px-5 py-2.5 font-display text-sm md:text-base font-bold text-slate-950 hover:bg-slate-100 disabled:opacity-60 transition-colors cursor-pointer"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        fill="#4285F4"
                        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96z"
                      />
                    </svg>
                    <span>
                      {signingIn
                        ? 'Conectando...'
                        : gisReady
                          ? 'Continuar con ventana de Google'
                          : 'Continuar con Google'}
                    </span>
                  </button>

                  {/* Additional OAuth Providers */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <button
                      type="button"
                      onClick={() => onSocialSignIn('github')}
                      disabled={signingIn}
                      className="flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-slate-700 bg-[#161B22] px-3 py-2 text-xs sm:text-sm font-semibold text-white hover:border-slate-500 hover:bg-[#1F2630] disabled:opacity-60 transition-colors cursor-pointer"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                      </svg>
                      <span>GitHub</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onSocialSignIn('facebook')}
                      disabled={signingIn}
                      className="flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-[#1877F2]/50 bg-[#1877F2]/15 px-3 py-2 text-xs sm:text-sm font-semibold text-blue-200 hover:border-[#1877F2] hover:bg-[#1877F2]/25 disabled:opacity-60 transition-colors cursor-pointer"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="#1877F2" aria-hidden="true">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                      </svg>
                      <span>Facebook</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onSocialSignIn('twitter')}
                      disabled={signingIn}
                      className="flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs sm:text-sm font-semibold text-white hover:border-slate-500 hover:bg-slate-900 disabled:opacity-60 transition-colors cursor-pointer"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                      </svg>
                      <span>X (Twitter)</span>
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleEmailAuthSubmit} className="mt-4 space-y-3">
                  <div className="flex flex-wrap gap-1.5 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setEmailMode('login');
                        setEmailNotice(null);
                        onClearAuthError?.();
                      }}
                      className={`rounded-md border px-2.5 py-1.5 font-semibold transition-colors cursor-pointer ${
                        emailMode === 'login'
                          ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200'
                          : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-white'
                      }`}
                    >
                      Iniciar sesión
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEmailMode('register');
                        setEmailNotice(null);
                        onClearAuthError?.();
                      }}
                      className={`rounded-md border px-2.5 py-1.5 font-semibold transition-colors cursor-pointer ${
                        emailMode === 'register'
                          ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                          : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-white'
                      }`}
                    >
                      Crear cuenta
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEmailMode('reset');
                        setEmailNotice(null);
                        onClearAuthError?.();
                      }}
                      className={`rounded-md border px-2.5 py-1.5 font-semibold transition-colors cursor-pointer ${
                        emailMode === 'reset'
                          ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
                          : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-white'
                      }`}
                    >
                      Olvidé mi clave
                    </button>
                  </div>

                  {emailMode === 'register' && (
                    <div>
                      <label htmlFor="auth-display-name" className="block text-xs font-medium text-slate-300">
                        Nombre de agente (opcional)
                      </label>
                      <input
                        id="auth-display-name"
                        type="text"
                        maxLength={18}
                        value={emailDisplayName}
                        onChange={(e) => setEmailDisplayName(e.target.value)}
                        placeholder="Ej. ShadowFox"
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
                      />
                    </div>
                  )}

                  <div>
                    <label htmlFor="auth-email-input" className="block text-xs font-medium text-slate-300">
                      Correo electrónico
                    </label>
                    <input
                      id="auth-email-input"
                      type="email"
                      autoComplete="email"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      placeholder="tu@correo.com"
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
                    />
                  </div>

                  {emailMode !== 'reset' && (
                    <div>
                      <label htmlFor="auth-password-input" className="block text-xs font-medium text-slate-300">
                        Contraseña
                      </label>
                      <div className="relative mt-1">
                        <input
                          id="auth-password-input"
                          type={showPassword ? 'text' : 'password'}
                          autoComplete={emailMode === 'register' ? 'new-password' : 'current-password'}
                          value={passwordInput}
                          onChange={(e) => setPasswordInput(e.target.value)}
                          placeholder="Mínimo 6 caracteres"
                          className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2.5 pl-3.5 pr-10 text-sm text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((prev) => !prev)}
                          aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  )}

                  {emailNotice && (
                    <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/40 px-3 py-2 text-xs text-emerald-200">
                      {emailNotice}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={signingIn}
                    className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-amber-400 px-5 py-2.5 font-display text-sm font-bold text-slate-950 hover:bg-amber-300 disabled:opacity-60 transition-colors cursor-pointer"
                  >
                    <KeyRound className="h-4 w-4" />
                    <span>
                      {signingIn
                        ? 'Procesando...'
                        : emailMode === 'register'
                          ? 'Crear cuenta y verificar correo'
                          : emailMode === 'reset'
                            ? 'Enviar enlace de recuperación'
                            : 'Iniciar sesión con correo'}
                    </span>
                  </button>
                </form>
              )}

              <div className="mt-4 flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    onClearAuthError?.();
                    setGuestMode(true);
                  }}
                  className="w-full rounded-lg border border-slate-700/80 bg-slate-900/70 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:border-slate-500 hover:text-white transition-colors cursor-pointer"
                >
                  Continuar sin guardar (modo invitado)
                </button>

                {isInIframe && (
                  <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3.5 py-2.5 text-xs text-slate-300 flex flex-wrap items-center justify-between gap-2">
                    <span>¿Problemas con ventanas emergentes dentro de esta vista previa?</span>
                    <a
                      href={window.location.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 font-semibold text-cyan-300 hover:text-cyan-200 underline shrink-0"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      <span>Abrir en pestaña nueva</span>
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Preview Top 3 + Characters Teaser */}
            <div className="lg:col-span-5 flex flex-col justify-between rounded-xl border border-slate-800 bg-[#0D1422] p-6">
              <div>
                <div className="text-xs font-semibold text-slate-400">
                  Paso 2 · Personajes Disponibles
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-slate-800 bg-[#0B111E] p-3 text-center">
                    <img
                      src={GENDER_PORTRAIT.male}
                      alt="Hombre"
                      referrerPolicy="no-referrer"
                      className="mx-auto h-32 w-full object-contain"
                    />
                    <div className="mt-2 font-display text-sm font-bold text-cyan-300">Hombre</div>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-[#0B111E] p-3 text-center">
                    <img
                      src={GENDER_PORTRAIT.female}
                      alt="Mujer"
                      referrerPolicy="no-referrer"
                      className="mx-auto h-32 w-full object-contain"
                    />
                    <div className="mt-2 font-display text-sm font-bold text-amber-300">Mujer</div>
                  </div>
                </div>
              </div>

              <div className="mt-6 border-t border-slate-800 pt-5">
                <div className="flex items-center justify-between">
                  <span className="font-display text-sm font-bold text-slate-200">
                    Mejores Puntuaciones
                  </span>
                  <button
                    type="button"
                    onClick={onOpenLeaderboard}
                    className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 cursor-pointer"
                  >
                    Ver todo
                  </button>
                </div>

                {topThree.length === 0 ? (
                  <p className="mt-3 text-xs text-slate-400">
                    Sé el primero en encabezar la tabla de líderes hoy.
                  </p>
                ) : (
                  <div className="mt-3 space-y-2.5">
                    {topThree.map((entry, idx) => (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between text-xs text-slate-200"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="font-mono-tab font-bold text-amber-400 w-4">
                            {idx + 1}.
                          </span>
                          <img
                            src={GENDER_PORTRAIT[entry.gender]}
                            alt={entry.name}
                            referrerPolicy="no-referrer"
                            className="h-7 w-7 rounded object-cover object-top bg-slate-800 shrink-0"
                          />
                          <span className="truncate font-medium">{entry.name}</span>
                        </div>
                        <span className="font-mono-tab font-bold text-cyan-300 shrink-0">
                          {entry.totalScore} pts
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4 sm:space-y-5">
            {/* Step 2 Tab Bar (World Countries Tab + Character & Name Tab) */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-3 rounded-xl border border-slate-800 bg-[#0D1422] p-2">
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setActiveTab('country')}
                  className={`flex min-h-[42px] flex-1 sm:flex-initial items-center justify-center gap-2 rounded-lg px-3.5 sm:px-4 py-2 font-display text-xs sm:text-sm font-bold transition-colors cursor-pointer ${
                    activeTab === 'country'
                      ? 'bg-cyan-500 text-slate-950'
                      : 'bg-slate-900/80 text-slate-300 hover:text-white'
                  }`}
                >
                  <Globe className="h-4 w-4" />
                  <span>Países del Mundo</span>
                  {selectedCountryObj && (
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs ${
                        activeTab === 'country'
                          ? 'bg-slate-950/20 text-slate-950'
                          : 'bg-slate-800 text-cyan-300'
                      }`}
                    >
                      {countryCodeToFlag(selectedCountryObj.code)} {selectedCountryObj.code}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('character')}
                  className={`flex min-h-[42px] flex-1 sm:flex-initial items-center justify-center gap-2 rounded-lg px-3.5 sm:px-4 py-2 font-display text-xs sm:text-sm font-bold transition-colors cursor-pointer ${
                    activeTab === 'character'
                      ? 'bg-amber-400 text-slate-950'
                      : 'bg-slate-900/80 text-slate-300 hover:text-white'
                  }`}
                >
                  <UserCheck className="h-4 w-4" />
                  <span>Personaje y Nombre</span>
                </button>
              </div>

              {selectedCountryObj && (
                <div className="px-3 text-xs text-slate-300">
                  País elegido:{' '}
                  <strong className="text-white">
                    {countryCodeToFlag(selectedCountryObj.code)} {selectedCountryObj.name}
                  </strong>
                </div>
              )}
            </div>

            {activeTab === 'country' ? (
              <div className="rounded-xl border border-slate-800 bg-[#0D1422] p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight text-white">
                      Selecciona tu país del mundo
                    </h1>
                    <p className="mt-1 text-xs md:text-sm text-slate-400">
                      Busca entre los {WORLD_COUNTRIES.length} países del mundo para mostrar tu bandera junto a tu nombre en el lobby y la arena.
                    </p>
                  </div>

                  <div className="relative w-full md:w-80">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={countrySearch}
                      onChange={(e) => setCountrySearch(e.target.value)}
                      placeholder="Buscar país o código (ej. México, ES)..."
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2.5 pl-9 pr-4 text-sm text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                  <span>
                    Mostrando <strong className="text-cyan-300">{filteredCountries.length}</strong> de{' '}
                    {WORLD_COUNTRIES.length} países
                  </span>
                  {country && (
                    <button
                      type="button"
                      onClick={() => setCountry('')}
                      className="text-xs font-semibold text-slate-400 hover:text-white cursor-pointer"
                    >
                      Quitar selección
                    </button>
                  )}
                </div>

                <div className="mt-3 grid max-h-[340px] grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredCountries.length === 0 ? (
                    <div className="col-span-full rounded-lg border border-slate-800 bg-slate-950/60 py-10 text-center text-sm text-slate-400">
                      No se encontró ningún país que coincida con &ldquo;{countrySearch}&rdquo;.
                    </div>
                  ) : (
                    filteredCountries.map((c) => {
                      const selected = country === c.code;
                      return (
                        <button
                          key={c.code}
                          type="button"
                          onClick={() => setCountry(c.code)}
                          className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-colors cursor-pointer ${
                            selected
                              ? 'border-cyan-400 bg-cyan-500/15 text-white'
                              : 'border-slate-800 bg-[#0B111E] text-slate-200 hover:border-slate-600'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="text-lg leading-none shrink-0">
                              {countryCodeToFlag(c.code)}
                            </span>
                            <span className="truncate font-medium">{c.name}</span>
                          </div>
                          <span className="font-mono-tab text-[11px] font-bold text-slate-400 shrink-0">
                            {c.code}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-4">
                  <div className="text-xs text-slate-400">
                    {selectedCountryObj
                      ? `Seleccionado: ${countryCodeToFlag(selectedCountryObj.code)} ${selectedCountryObj.name}`
                      : 'Opcional: puedes elegir tu país o continuar directo al personaje.'}
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('character')}
                    className="rounded-lg bg-amber-400 px-5 py-2.5 font-display text-sm font-bold text-slate-950 hover:bg-amber-300 transition-colors cursor-pointer"
                  >
                    Continuar a Personaje y Nombre
                  </button>
                </div>
              </div>
            ) : (
              <form
                onSubmit={handleSubmit}
                className="grid grid-cols-1 gap-5 sm:gap-8 lg:grid-cols-12 items-stretch"
              >
                {/* Left Column: Gender Character Cards */}
                <div className="lg:col-span-7 flex flex-col justify-center">
                  <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-white">
                    Elige tu personaje y tu nombre
                  </h1>
                  <p className="mt-1.5 sm:mt-2 text-xs sm:text-sm md:text-base text-slate-300">
                    Selecciona <strong className="text-cyan-300">Hombre</strong> o{' '}
                    <strong className="text-amber-300">Mujer</strong>, escribe tu nombre y entra al lobby externo multijugador.
                  </p>

              <div className="mt-4 sm:mt-6 grid grid-cols-2 gap-3 sm:gap-4">
                {/* Hombre Card */}
                <button
                  type="button"
                  onClick={() => setGender('male')}
                  className={`group relative flex flex-col items-center rounded-xl border p-3 sm:p-4 text-left transition-all cursor-pointer ${
                    gender === 'male'
                      ? 'border-cyan-400 bg-[#0F1B2E] shadow-lg shadow-cyan-500/15'
                      : 'border-slate-800 bg-[#0B111E] hover:border-slate-600'
                  }`}
                >
                  <div className="w-full h-32 sm:h-56 md:h-64 overflow-hidden rounded-lg bg-slate-900/90 flex items-center justify-center p-2">
                    <img
                      src={GENDER_PORTRAIT.male}
                      alt="Personaje Hombre"
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-contain transition-transform duration-200 group-hover:scale-[1.03]"
                    />
                  </div>
                  <div className="mt-2.5 sm:mt-4 flex w-full items-center justify-between">
                    <div>
                      <div className="font-display text-base sm:text-lg font-bold text-white">Hombre</div>
                      <div className="text-[11px] sm:text-xs text-slate-400 hidden sm:block">Chaqueta denim · Tenis blancos</div>
                    </div>
                    <span
                      className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        gender === 'male' ? 'border-cyan-400' : 'border-slate-600'
                      }`}
                    >
                      {gender === 'male' && <span className="h-2.5 w-2.5 rounded-full bg-cyan-400" />}
                    </span>
                  </div>
                </button>

                {/* Mujer Card */}
                <button
                  type="button"
                  onClick={() => setGender('female')}
                  className={`group relative flex flex-col items-center rounded-xl border p-3 sm:p-4 text-left transition-all cursor-pointer ${
                    gender === 'female'
                      ? 'border-amber-400 bg-[#1B1916] shadow-lg shadow-amber-500/15'
                      : 'border-slate-800 bg-[#0B111E] hover:border-slate-600'
                  }`}
                >
                  <div className="w-full h-32 sm:h-56 md:h-64 overflow-hidden rounded-lg bg-slate-900/90 flex items-center justify-center p-2">
                    <img
                      src={GENDER_PORTRAIT.female}
                      alt="Personaje Mujer"
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-contain transition-transform duration-200 group-hover:scale-[1.03]"
                    />
                  </div>
                  <div className="mt-2.5 sm:mt-4 flex w-full items-center justify-between">
                    <div>
                      <div className="font-display text-base sm:text-lg font-bold text-white">Mujer</div>
                      <div className="text-[11px] sm:text-xs text-slate-400 hidden sm:block">Sudadera oliva · Tenis oliva</div>
                    </div>
                    <span
                      className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        gender === 'female' ? 'border-amber-400' : 'border-slate-600'
                      }`}
                    >
                      {gender === 'female' && <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />}
                    </span>
                  </div>
                </button>
              </div>
            </div>

            {/* Right Column: Google Account Bar + Callsign + Enter Lobby CTA */}
            <div className="lg:col-span-5 flex flex-col justify-between rounded-xl border border-slate-800 bg-[#0D1422] p-4 sm:p-6">
              <div>
                {authUser ? (
                  <div className="space-y-2.5">
                    <div
                      className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 ${
                        authEmailVerified
                          ? 'border-emerald-500/35 bg-emerald-500/10'
                          : 'border-amber-500/40 bg-amber-500/10'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {authUser.photoURL ? (
                          <img
                            src={authUser.photoURL}
                            alt={authUser.email || authUser.displayName || 'Cuenta'}
                            referrerPolicy="no-referrer"
                            className="h-7 w-7 rounded-full border border-emerald-400/50 shrink-0"
                          />
                        ) : (
                          <CheckCircle2
                            className={`h-5 w-5 shrink-0 ${
                              authEmailVerified ? 'text-emerald-400' : 'text-amber-300'
                            }`}
                          />
                        )}
                        <div className="min-w-0">
                          <div className="truncate text-xs font-semibold text-white">
                            {authUser.email || authUser.displayName || 'Cuenta conectada'}
                          </div>
                          <div
                            className={`text-[11px] ${
                              authEmailVerified ? 'text-emerald-300' : 'text-amber-300'
                            }`}
                          >
                            {!authEmailVerified
                              ? 'Correo pendiente de verificación'
                              : profileLoading
                                ? 'Cargando perfil guardado...'
                                : savedProfile
                                  ? 'Perfil guardado cargado'
                                  : 'Se guardará tu nombre y género'}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={onGoogleSignOut}
                        title="Cerrar sesión"
                        className="flex items-center gap-1 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] font-semibold text-slate-300 hover:text-white cursor-pointer shrink-0"
                      >
                        <LogOut className="h-3 w-3" />
                        <span>Salir</span>
                      </button>
                    </div>

                    {!authEmailVerified && (
                      <div className="rounded-lg border border-amber-500/35 bg-amber-950/40 px-3 py-2.5 text-[11px] text-amber-100 space-y-2">
                        <p>
                          {authUser.email
                            ? `Para guardar tu progreso en la nube, verifica el enlace enviado a ${authUser.email} (revisa spam).`
                            : 'Este proveedor no compartió un correo verificado; puedes jugar ahora o usar Google/Correo para guardar progreso en la nube.'}
                        </p>
                        {verifyNotice && (
                          <div className="text-cyan-200 font-medium">{verifyNotice}</div>
                        )}
                        {authUser.email && (
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={verifyBusy}
                              onClick={handleCheckVerification}
                              className="inline-flex items-center gap-1 rounded border border-cyan-400/60 bg-cyan-500/20 px-2.5 py-1 font-semibold text-cyan-200 hover:bg-cyan-500/30 disabled:opacity-60 cursor-pointer"
                            >
                              <RefreshCw className={`h-3 w-3 ${verifyBusy ? 'animate-spin' : ''}`} />
                              <span>Ya verifiqué</span>
                            </button>
                            <button
                              type="button"
                              disabled={verifyBusy}
                              onClick={handleSendVerificationAgain}
                              className="rounded border border-slate-600 bg-slate-900 px-2.5 py-1 font-semibold text-slate-200 hover:border-slate-400 disabled:opacity-60 cursor-pointer"
                            >
                              Reenviar correo
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-700/80 bg-slate-900/70 px-3 py-2">
                    <span className="text-xs text-slate-400">Modo invitado (no se guarda)</span>
                    <button
                      type="button"
                      onClick={() => setGuestMode(false)}
                      className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 cursor-pointer"
                    >
                      Iniciar sesión
                    </button>
                  </div>
                )}

                <label htmlFor="callsign-input" className="mt-4 block text-sm font-medium text-slate-200">
                  Nombre del jugador
                </label>
                <input
                  id="callsign-input"
                  type="text"
                  maxLength={18}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Escribe tu nombre..."
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-base font-medium text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
                />

                <div className="mt-4 flex items-center justify-between border-t border-slate-800 pt-3.5 text-sm">
                  <span className="text-slate-400">País</span>
                  <button
                    type="button"
                    onClick={() => setActiveTab('country')}
                    className="flex items-center gap-1.5 font-medium text-cyan-300 hover:text-cyan-200 cursor-pointer"
                  >
                    {selectedCountryObj ? (
                      <>
                        <span>{countryCodeToFlag(selectedCountryObj.code)}</span>
                        <span>{selectedCountryObj.name}</span>
                      </>
                    ) : (
                      <span>Elegir país</span>
                    )}
                  </button>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-slate-800 pt-3.5 text-sm">
                  <span className="text-slate-400">Personaje seleccionado</span>
                  <span className="font-display font-bold text-white">
                    {gender === 'male' ? 'Hombre' : 'Mujer'}
                  </span>
                </div>

                {(errorMsg || authError) && (
                  <div className="mt-4 rounded-lg border border-rose-500/40 bg-rose-950/50 px-3 py-2 text-xs text-rose-200">
                    {errorMsg || authError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={connecting || savingProfile || profileLoading}
                  className="mt-6 w-full rounded-lg bg-cyan-500 px-6 py-3.5 font-display text-lg font-bold text-slate-950 hover:bg-cyan-400 disabled:opacity-60 transition-colors whitespace-nowrap cursor-pointer"
                >
                  {savingProfile
                    ? 'Guardando perfil...'
                    : connecting
                      ? 'Cargando Lobby 3D...'
                      : authUser
                        ? 'Guardar y Entrar al Lobby'
                        : 'Entrar al Lobby'}
                </button>
              </div>

              {/* Compact Top 3 Leaderboard Preview */}
              <div className="mt-6 border-t border-slate-800 pt-5">
                <div className="flex items-center justify-between">
                  <span className="font-display text-sm font-bold text-slate-200">
                    Mejores Puntuaciones
                  </span>
                  <button
                    type="button"
                    onClick={onOpenLeaderboard}
                    className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 cursor-pointer"
                  >
                    Ver todo
                  </button>
                </div>

                {topThree.length === 0 ? (
                  <p className="mt-3 text-xs text-slate-400">
                    Sé el primero en encabezar la tabla de líderes hoy.
                  </p>
                ) : (
                  <div className="mt-3 space-y-2.5">
                    {topThree.map((entry, idx) => (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between text-xs text-slate-200"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="font-mono-tab font-bold text-amber-400 w-4">
                            {idx + 1}.
                          </span>
                          <img
                            src={GENDER_PORTRAIT[entry.gender]}
                            alt={entry.name}
                            referrerPolicy="no-referrer"
                            className="h-7 w-7 rounded object-cover object-top bg-slate-800 shrink-0"
                          />
                          <span className="truncate font-medium">{entry.name}</span>
                        </div>
                        <span className="font-mono-tab font-bold text-cyan-300 shrink-0">
                          {entry.totalScore} pts
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </form>
            )}
          </div>
        )}
      </div>

      {/* Single flat control-hint line */}
      <div className="mx-auto w-full max-w-5xl text-center text-[11px] sm:text-xs text-slate-400 pt-2">
        <span className="hidden sm:inline">
          WASD Mover · Shift Correr · C Deslizarse · Espacio Saltar · Clic Izq Disparar · Clic Der / V Apuntar · R Recargar · G Emotes · T Chat · Enter Empezar
        </span>
        <span className="sm:hidden">
          Táctil en Teléfono (Joystick + Botones) · PC: WASD + Ratón
        </span>
      </div>
    </div>
  );
}
