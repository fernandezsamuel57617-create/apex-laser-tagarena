import { SkipForward } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { soundEngine } from '../audio/soundEngine';

export const GAME_LOGO_URL = '/assets/aistudio/Captura_de_pantalla_2026-11-17_132033_ce096262.png';

interface SplashIntroOverlayProps {
  open: boolean;
  onComplete: () => void;
}

const SPARKS = [
  { left: '18%', delay: '0.25s', duration: '1.8s', color: 'bg-cyan-400' },
  { left: '28%', delay: '0.45s', duration: '2.1s', color: 'bg-amber-400' },
  { left: '39%', delay: '0.18s', duration: '1.6s', color: 'bg-cyan-300' },
  { left: '52%', delay: '0.55s', duration: '2.0s', color: 'bg-amber-300' },
  { left: '64%', delay: '0.32s', duration: '1.9s', color: 'bg-cyan-400' },
  { left: '74%', delay: '0.42s', duration: '1.7s', color: 'bg-amber-400' },
  { left: '83%', delay: '0.28s', duration: '2.2s', color: 'bg-rose-400' },
];

export function SplashIntroOverlay({ open, onComplete }: SplashIntroOverlayProps) {
  const [progress, setProgress] = useState(0);
  const [exiting, setExiting] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const firedRef = useRef(false);
  const exitTimerRef = useRef<number>(0);

  useEffect(() => {
    if (!open) {
      firedRef.current = false;
      setExiting(false);
      setProgress(0);
      return;
    }

    firedRef.current = false;

    const finishOnce = () => {
      if (firedRef.current) return;
      firedRef.current = true;
      onCompleteRef.current();
    };

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced) {
      setProgress(100);
      exitTimerRef.current = window.setTimeout(finishOnce, 450);
      return () => {
        window.clearTimeout(exitTimerRef.current);
      };
    }

    const totalMs = 2850;
    const start = performance.now();
    let completed = false;

    const tickId = window.setInterval(() => {
      const elapsed = performance.now() - start;
      const pct = Math.min(100, Math.round((elapsed / totalMs) * 100));
      setProgress(pct);
      if (elapsed >= totalMs && !completed) {
        completed = true;
        window.clearInterval(tickId);
        setExiting(true);
        exitTimerRef.current = window.setTimeout(finishOnce, 360);
      }
    }, 32);

    return () => {
      window.clearInterval(tickId);
      window.clearTimeout(exitTimerRef.current);
    };
  }, [open]);

  if (!open) return null;

  const handleSkip = () => {
    if (firedRef.current) return;
    soundEngine.playIntroSting();
    setExiting(true);
    window.clearTimeout(exitTimerRef.current);
    exitTimerRef.current = window.setTimeout(() => {
      if (firedRef.current) return;
      firedRef.current = true;
      onCompleteRef.current();
    }, 180);
  };

  return (
    <div
      onClick={() => soundEngine.playIntroSting()}
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-[#04070E] px-6 transition-opacity duration-350 ${
        exiting ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Tactical diagonal battle-royale backdrop flare */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 45%, rgba(6, 182, 212, 0.22) 0%, rgba(245, 158, 11, 0.08) 38%, rgba(4, 7, 14, 0.96) 72%)',
        }}
      />

      {/* Tactical diagonal corner accents */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 -left-24 h-64 w-64 rotate-45 border border-cyan-400/20 bg-cyan-500/5"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 -right-24 h-64 w-64 rotate-45 border border-amber-400/20 bg-amber-500/5"
      />

      {/* Rising spark embers */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        {SPARKS.map((sp, i) => (
          <span
            key={i}
            className={`absolute bottom-24 h-2 w-2 rounded-full ${sp.color}`}
            style={{
              left: sp.left,
              animation: `ffSparkRise ${sp.duration} ease-out ${sp.delay} infinite`,
            }}
          />
        ))}
      </div>

      {/* Skip intro button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          handleSkip();
        }}
        className="absolute right-5 top-5 z-20 flex items-center gap-1.5 rounded-lg border border-slate-700/80 bg-slate-950/80 px-3.5 py-2 text-xs font-bold text-slate-300 hover:border-cyan-400 hover:text-white transition-colors cursor-pointer"
      >
        <span>Saltar</span>
        <SkipForward className="h-3.5 w-3.5" />
      </button>

      {/* Center emblem slam + dual expanding shockwave rings + metallic light sweep */}
      <div className="relative flex flex-col items-center justify-center">
        <div
          aria-hidden="true"
          className="animate-ff-shockwave-cyan pointer-events-none absolute h-64 w-64 rounded-full border-4 border-cyan-400/75 opacity-0"
        />
        <div
          aria-hidden="true"
          className="animate-ff-shockwave-amber pointer-events-none absolute h-64 w-64 rounded-full border-2 border-amber-400/80 opacity-0"
        />

        <div className="animate-ff-slam relative overflow-hidden rounded-2xl border border-amber-400/35 bg-[#060B16]/90 p-2 shadow-2xl shadow-cyan-500/20">
          {!imgFailed ? (
            <img
              src={GAME_LOGO_URL}
              alt="Apex Laser Tag Arena"
              referrerPolicy="no-referrer"
              onError={() => setImgFailed(true)}
              className="h-56 w-auto max-w-[82vw] rounded-xl object-contain sm:h-72"
            />
          ) : (
            <div className="flex h-56 w-80 flex-col items-center justify-center rounded-xl bg-slate-900 px-6 text-center">
              <div className="font-display text-3xl font-bold tracking-wider text-amber-400">
                APEX
              </div>
              <div className="font-display text-xl font-bold tracking-widest text-cyan-300">
                LASER TAG ARENA
              </div>
            </div>
          )}

          {/* Diagonal light sweep across emblem */}
          <div
            aria-hidden="true"
            className="animate-ff-sweep pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-transparent via-white/45 to-transparent opacity-0"
          />
        </div>

        {/* Tactical Free Fire-style angled status & loading bar */}
        <div className="animate-ff-fadeup mt-7 w-72 sm:w-96">
          <div className="mb-2 flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.2em]">
            <span className="text-cyan-300">Desplegando Arena Táctica</span>
            <span className="font-mono-tab text-amber-300">{progress}%</span>
          </div>

          <div className="relative h-2.5 w-full overflow-hidden rounded-sm border border-slate-700 bg-slate-950">
            <div
              className="h-full bg-gradient-to-r from-cyan-400 via-sky-300 to-amber-400 transition-all duration-75"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="mt-2.5 text-center text-[11px] font-medium tracking-wider text-slate-400">
            MULTIJUGADOR EN TIEMPO REAL · 8 ARENAS TEMÁTICAS
          </div>
        </div>
      </div>
    </div>
  );
}
