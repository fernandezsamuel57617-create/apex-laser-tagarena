import { Gift, Sparkles, Terminal, X } from 'lucide-react';
import { useEffect, useState, type CSSProperties } from 'react';
import { soundEngine } from '../audio/soundEngine';

export interface PendingAdminGift {
  giftId: string;
  senderName: string;
  message: string;
}

interface AdminGiftModalProps {
  gift: PendingAdminGift | null;
  onClose: () => void;
  onOpenCdm: () => void;
}

const CONFETTI_PARTICLES: Array<{ tx: string; ty: string; rot: string; color: string }> = [
  { tx: '-110px', ty: '-95px', rot: '-140deg', color: '#22D3EE' },
  { tx: '-70px', ty: '-125px', rot: '110deg', color: '#FBBF24' },
  { tx: '-18px', ty: '-138px', rot: '-90deg', color: '#34D399' },
  { tx: '28px', ty: '-134px', rot: '160deg', color: '#F43F5E' },
  { tx: '78px', ty: '-118px', rot: '-120deg', color: '#FBBF24' },
  { tx: '116px', ty: '-88px', rot: '130deg', color: '#38BDF8' },
  { tx: '-124px', ty: '-22px', rot: '95deg', color: '#A78BFA' },
  { tx: '126px', ty: '-18px', rot: '-110deg', color: '#34D399' },
  { tx: '-88px', ty: '52px', rot: '150deg', color: '#FBBF24' },
  { tx: '92px', ty: '48px', rot: '-150deg', color: '#22D3EE' },
];

export function AdminGiftModal({ gift, onClose, onOpenCdm }: AdminGiftModalProps) {
  const [clicks, setClicks] = useState(0);
  const [shakeKey, setShakeKey] = useState(0);

  useEffect(() => {
    setClicks(0);
    setShakeKey(0);
  }, [gift?.giftId]);

  if (!gift) return null;

  const isOpened = clicks >= 3;
  const remaining = Math.max(0, 3 - clicks);

  const handleGiftTap = () => {
    if (isOpened) return;
    const next = clicks + 1;
    setClicks(next);
    setShakeKey((k) => k + 1);
    if (next >= 3) {
      soundEngine.playGiftOpen();
    } else {
      soundEngine.playGiftTap(next);
    }
  };

  const lidClass =
    clicks === 0
      ? 'translate-y-0 rotate-0'
      : clicks === 1
        ? '-translate-y-2.5 -rotate-3'
        : clicks === 2
          ? '-translate-y-5 -rotate-6'
          : '-translate-y-12 -rotate-12 opacity-0';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Regalo de Comandos de Admin"
      onKeyDown={(e) => e.stopPropagation()}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm"
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-amber-400/55 bg-[#0B111E] p-6 text-center shadow-2xl">
        {isOpened && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
            {CONFETTI_PARTICLES.map((particle, idx) => (
              <span
                key={`${gift.giftId}-${idx}`}
                style={
                  {
                    '--tx': particle.tx,
                    '--ty': particle.ty,
                    '--rot': particle.rot,
                    backgroundColor: particle.color,
                  } as CSSProperties
                }
                className="animate-gift-confetti absolute h-2.5 w-2.5 rounded-sm"
              />
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar regalo"
          className="absolute top-3 right-3 flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500 hover:text-white cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>

        {!isOpened ? (
          <div className="flex flex-col items-center">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-300">
              <Gift className="h-4 w-4" />
              <span>Regalo del Administrador</span>
            </div>

            <h2 className="mt-2 font-display text-xl font-bold text-white">
              {gift.senderName} te envió un regalo
            </h2>
            <p className="mt-1 text-xs text-slate-300">
              Dale <span className="font-bold text-amber-300">3 clics</span> a la caja para abrirlo
            </p>

            <button
              key={shakeKey}
              type="button"
              onClick={handleGiftTap}
              aria-label={`Abrir regalo (${clicks} de 3 clics)`}
              className={`group relative mt-6 mb-5 flex h-44 w-44 items-center justify-center rounded-2xl border border-amber-400/35 bg-slate-900/80 shadow-inner transition-transform active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                shakeKey > 0 ? 'animate-gift-shake' : 'animate-gift-float'
              }`}
            >
              {/* Inner glow intensifies with each click */}
              <div
                className="pointer-events-none absolute inset-4 rounded-xl bg-amber-400/20 blur-xl transition-opacity duration-200"
                style={{ opacity: 0.25 + clicks * 0.3 }}
              />

              <svg
                viewBox="0 0 160 160"
                className="relative h-36 w-36 drop-shadow-lg"
                aria-hidden="true"
              >
                {/* Box Body */}
                <rect x="26" y="68" width="108" height="72" rx="10" fill="#0E7490" stroke="#22D3EE" strokeWidth="3" />
                <rect x="70" y="68" width="20" height="72" fill="#F59E0B" />
                <rect x="26" y="96" width="108" height="14" fill="#F59E0B" opacity="0.92" />

                {/* Gift Lid + Bow */}
                <g className={`origin-bottom-left transition-transform duration-200 ${lidClass}`}>
                  <rect x="18" y="48" width="124" height="24" rx="7" fill="#155E75" stroke="#38BDF8" strokeWidth="3" />
                  <rect x="70" y="48" width="20" height="24" fill="#FBBF24" />
                  <path
                    d="M80 48 C62 24, 34 32, 50 48 Z"
                    fill="#FBBF24"
                    stroke="#FDE68A"
                    strokeWidth="2"
                  />
                  <path
                    d="M80 48 C98 24, 126 32, 110 48 Z"
                    fill="#FBBF24"
                    stroke="#FDE68A"
                    strokeWidth="2"
                  />
                  <circle cx="80" cy="46" r="7" fill="#FDE68A" />
                </g>
              </svg>
            </button>

            {/* 3-Click Progress Steps */}
            <div className="flex items-center gap-2.5">
              {[1, 2, 3].map((step) => {
                const filled = clicks >= step;
                return (
                  <span
                    key={step}
                    className={`h-2.5 w-10 rounded-full transition-colors ${
                      filled ? 'bg-amber-400' : 'bg-slate-800 border border-slate-700'
                    }`}
                  />
                );
              })}
            </div>

            <div className="mt-3 font-mono-tab text-xs font-bold text-cyan-300">
              {clicks === 0
                ? 'Clics: 0 / 3 · Toca la caja'
                : `Clics: ${clicks} / 3 · ¡Falta${remaining === 1 ? '' : 'n'} ${remaining}!`}
            </div>
          </div>
        ) : (
          <div className="animate-gift-pop relative flex flex-col items-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-400/60 bg-amber-500/20 text-amber-300">
              <Terminal className="h-8 w-8" />
            </div>

            <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-300">
              <Sparkles className="h-3.5 w-3.5" />
              <span>¡Regalo Abierto!</span>
            </div>

            <h2 className="mt-1 font-display text-xl font-bold text-white">
              Comandos de Admin Desbloqueados
            </h2>

            <div className="mt-3 w-full rounded-xl border border-cyan-500/40 bg-slate-950/90 p-3 text-left">
              <div className="text-[11px] font-bold uppercase tracking-wider text-cyan-300">
                Acceso CDM Activado
              </div>
              <p className="mt-1 text-xs text-slate-200 leading-relaxed">
                Ya puedes abrir el panel{' '}
                <span className="font-mono-tab font-bold text-amber-300">Admin CDM [F4]</span> o escribir{' '}
                <span className="font-mono-tab text-cyan-300">cdm</span>,{' '}
                <span className="font-mono-tab text-cyan-300">/fly</span>,{' '}
                <span className="font-mono-tab text-cyan-300">/god</span>,{' '}
                <span className="font-mono-tab text-cyan-300">/speed</span>,{' '}
                <span className="font-mono-tab text-cyan-300">/ammo</span> y eventos en el chat.
              </p>
            </div>

            {/* Custom sender text rendered cleanly underneath */}
            <div className="mt-3 w-full rounded-xl border border-amber-400/45 bg-amber-950/20 p-3 text-left">
              <div className="text-[11px] font-bold text-amber-300">
                Mensaje de {gift.senderName}:
              </div>
              <p className="mt-1 break-words text-sm font-medium text-white leading-snug">
                {gift.message}
              </p>
            </div>

            <div className="mt-5 flex w-full items-center gap-2.5">
              <button
                type="button"
                onClick={onOpenCdm}
                className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 py-2 font-display text-sm font-bold text-slate-950 hover:bg-cyan-300 transition-colors cursor-pointer"
              >
                <Terminal className="h-4 w-4" />
                <span>Abrir Comandos</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex min-h-[44px] items-center justify-center rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 hover:border-slate-500 hover:text-white transition-colors cursor-pointer"
              >
                Jugar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
