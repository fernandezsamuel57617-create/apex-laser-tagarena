import { Send, Smile, X } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { EMOTES, type EmoteId } from '../shared/emotes';

interface EmoteWheelModalProps {
  open: boolean;
  onClose: () => void;
  onSelectEmote: (emote: EmoteId) => void;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function describeAnnularSector(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  startAngle: number,
  endAngle: number,
): string {
  const startOuter = polarToCartesian(cx, cy, outerR, endAngle);
  const endOuter = polarToCartesian(cx, cy, outerR, startAngle);
  const startInner = polarToCartesian(cx, cy, innerR, endAngle);
  const endInner = polarToCartesian(cx, cy, innerR, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? '0' : '1';
  return [
    'M',
    startOuter.x,
    startOuter.y,
    'A',
    outerR,
    outerR,
    0,
    largeArc,
    0,
    endOuter.x,
    endOuter.y,
    'L',
    endInner.x,
    endInner.y,
    'A',
    innerR,
    innerR,
    0,
    largeArc,
    1,
    startInner.x,
    startInner.y,
    'Z',
  ].join(' ');
}

export function EmoteWheelModal({ open, onClose, onSelectEmote }: EmoteWheelModalProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [chatCommand, setChatCommand] = useState('');
  const [cmdError, setCmdError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) {
      setHoveredIdx(null);
      setChatCommand('');
      setCmdError(null);
      return;
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (document.activeElement === inputRef.current) return;
      const idx = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6'].indexOf(e.code);
      if (idx !== -1 && EMOTES[idx]) {
        e.preventDefault();
        onSelectEmote(EMOTES[idx].id);
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose, onSelectEmote]);

  if (!open) return null;

  const sliceAngle = 360 / EMOTES.length;
  const hoveredEmote = hoveredIdx !== null ? EMOTES[hoveredIdx] : null;

  const handleChatSubmit = (e: FormEvent) => {
    e.preventDefault();
    const raw = chatCommand.trim().toLowerCase();
    if (!raw) return;
    const normalized = raw.startsWith('/') ? raw.slice(1) : raw;
    const match = EMOTES.find(
      (em) =>
        em.id === normalized ||
        em.chatCmd.slice(1) === normalized ||
        em.label.toLowerCase() === normalized ||
        em.shortcut === normalized,
    );
    if (!match) {
      setCmdError('Usa /wave, /laugh, /celebrate, /gg, /heart o /taunt');
      return;
    }
    setCmdError(null);
    onSelectEmote(match.id);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-[#060A14]/75 p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        className="relative flex w-full max-w-md max-h-[92dvh] overflow-y-auto flex-col items-center rounded-2xl border border-slate-700/90 bg-[#0B1220] p-4 sm:p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex w-full items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Smile className="h-4 w-4 text-cyan-400" />
            <h2 className="font-display text-base font-bold text-white">
              Menú Radial de Emotes 3D
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar menú de emotes"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-slate-300 hover:text-white cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Circular SVG Radial Wheel */}
        <div className="relative my-3 sm:my-4 h-[244px] w-[244px] sm:h-[300px] sm:w-[300px] shrink-0 select-none">
          <svg viewBox="0 0 300 300" className="h-full w-full">
            {EMOTES.map((emote, idx) => {
              const startAngle = idx * sliceAngle - sliceAngle / 2;
              const endAngle = startAngle + sliceAngle;
              const midAngle = startAngle + sliceAngle / 2;
              const isHovered = hoveredIdx === idx;
              const path = describeAnnularSector(150, 150, 56, 140, startAngle + 2, endAngle - 2);
              const labelPos = polarToCartesian(150, 150, 99, midAngle);

              return (
                <g
                  key={emote.id}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  onClick={() => {
                    onSelectEmote(emote.id);
                    onClose();
                  }}
                  className="cursor-pointer"
                >
                  <path
                    d={path}
                    fill={isHovered ? emote.color : '#111A2E'}
                    fillOpacity={isHovered ? 0.28 : 0.96}
                    stroke={isHovered ? emote.color : '#26344F'}
                    strokeWidth={isHovered ? 2.5 : 1.5}
                  />
                  <text
                    x={labelPos.x}
                    y={labelPos.y - 4}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize="26"
                  >
                    {emote.emoji}
                  </text>
                  <text
                    x={labelPos.x}
                    y={labelPos.y + 18}
                    textAnchor="middle"
                    fill="#E2E8F0"
                    fontSize="10"
                    fontWeight="700"
                    fontFamily="'Chakra Petch', sans-serif"
                  >
                    [{emote.shortcut}] {emote.label}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Center Core Readout */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full border border-slate-700 bg-[#080D18] text-center px-2">
              {hoveredEmote ? (
                <>
                  <span className="text-2xl leading-none">{hoveredEmote.emoji}</span>
                  <span className="mt-1 font-display text-xs font-bold text-white">
                    {hoveredEmote.label}
                  </span>
                  <span className="text-[10px] font-mono-tab text-cyan-300">
                    {hoveredEmote.chatCmd}
                  </span>
                </>
              ) : (
                <>
                  <span className="font-display text-xs font-bold text-cyan-300">EMOTES</span>
                  <span className="mt-0.5 text-[10px] text-slate-400">Teclas 1–6</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Chat Shortcut Input */}
        <form onSubmit={handleChatSubmit} className="w-full space-y-1.5">
          <label htmlFor="emote-chat-input" className="block text-[11px] font-medium text-slate-400">
            Atajo de chat rápido (visible en 3D sobre tu personaje)
          </label>
          <div className="flex items-center gap-2">
            <input
              id="emote-chat-input"
              ref={inputRef}
              type="text"
              value={chatCommand}
              onChange={(e) => {
                setChatCommand(e.target.value);
                if (cmdError) setCmdError(null);
              }}
              placeholder="/wave, /laugh, /celebrate, /gg..."
              className="min-h-[40px] flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-medium text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
            />
            <button
              type="submit"
              className="flex min-h-[40px] items-center gap-1.5 rounded-lg bg-cyan-500 px-3.5 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-400 cursor-pointer shrink-0"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Enviar</span>
            </button>
          </div>
          {cmdError && <p className="text-[11px] text-rose-400">{cmdError}</p>}
        </form>
      </div>
    </div>
  );
}
