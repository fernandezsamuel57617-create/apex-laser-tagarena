import { MessageSquare, Send, ShieldAlert, X } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { countryCodeToFlag } from '../shared/countries';
import type { ChatMessageEvent, GamePhase } from '../shared/types';

interface MatchChatPanelProps {
  messages: ChatMessageEvent[];
  blockedReason: string | null;
  phase: GamePhase;
  focusSignal: number;
  onSendMessage: (text: string) => void;
  onClearBlocked: () => void;
  embedded?: boolean;
  mobileCompact?: boolean;
}

export function MatchChatPanel({
  messages,
  blockedReason,
  phase,
  focusSignal,
  onSendMessage,
  onClearBlocked,
  embedded = false,
  mobileCompact = false,
}: MatchChatPanelProps) {
  const [text, setText] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const prevLenRef = useRef(messages.length);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const [desktopLobbyOpen, setDesktopLobbyOpen] = useState(false);

  useEffect(() => {
    if (focusSignal > 0) {
      setMobileOpen(true);
      setDesktopLobbyOpen(true);
      window.setTimeout(() => {
        inputRef.current?.focus();
      }, 30);
    }
  }, [focusSignal]);

  useEffect(() => {
    if (messages.length > prevLenRef.current) {
      if ((mobileCompact && !mobileOpen) || (!mobileCompact && phase === 'lobby' && !desktopLobbyOpen)) {
        setUnreadCount((c) => Math.min(99, c + (messages.length - prevLenRef.current)));
      }
    }
    prevLenRef.current = messages.length;
    const el = listRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length, mobileCompact, mobileOpen, phase, desktopLobbyOpen]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) {
      inputRef.current?.blur();
      return;
    }
    onSendMessage(trimmed);
    setText('');
    inputRef.current?.blur();
  };

  if (phase === 'results') return null;

  const chatBody = (
    <>
      <div
        ref={listRef}
        className="max-h-28 min-h-[54px] overflow-y-auto space-y-1 pr-1 text-xs"
      >
        {messages.length === 0 ? (
          <div className="text-[11px] text-slate-500">
            {mobileCompact || embedded
              ? 'Escribe aquí para saludar o coordinar con tu equipo...'
              : 'Presiona [T] para saludar o coordinar con tu equipo...'}
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className="leading-snug break-words">
              <span
                className={`font-semibold ${
                  m.team === 'cyan'
                    ? 'text-cyan-300'
                    : m.team === 'rose'
                      ? 'text-rose-300'
                      : 'text-amber-300'
                }`}
              >
                {m.senderCountry ? `${countryCodeToFlag(m.senderCountry)} ` : ''}
                {m.senderName}:
              </span>{' '}
              <span className="text-slate-100">{m.text}</span>
            </div>
          ))
        )}
      </div>

      {blockedReason && (
        <div className="mt-1.5 flex items-start gap-1.5 rounded-lg border border-rose-500/50 bg-rose-950/70 px-2 py-1.5 text-[11px] text-rose-200">
          <ShieldAlert className="h-3.5 w-3.5 text-rose-400 shrink-0 mt-0.5" />
          <span>{blockedReason}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-2 flex items-center gap-1.5">
        <input
          ref={inputRef}
          type="text"
          maxLength={140}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (blockedReason) onClearBlocked();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              inputRef.current?.blur();
            }
          }}
          placeholder={mobileCompact || embedded ? 'Escribe un mensaje...' : '[T] Escribe un mensaje...'}
          className="min-h-[38px] w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
        />
        <button
          type="submit"
          aria-label="Enviar mensaje"
          className="flex h-[38px] w-[38px] items-center justify-center rounded-lg bg-cyan-500/20 border border-cyan-400/50 text-cyan-300 hover:bg-cyan-500/35 shrink-0 cursor-pointer"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </form>
    </>
  );

  if (embedded) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-2">
          <span className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
            <MessageSquare className="h-3.5 w-3.5 text-cyan-400" />
            <span>Chat de Sala</span>
          </span>
        </div>
        {chatBody}
      </div>
    );
  }

  if (mobileCompact) {
    return (
      <div className="pointer-events-auto fixed top-14 left-3 z-20">
        {!mobileOpen ? (
          <button
            type="button"
            onClick={() => {
              setMobileOpen(true);
              setUnreadCount(0);
            }}
            aria-label="Abrir chat"
            className="relative flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-700/80 bg-[#0B101B]/88 px-3 py-1.5 text-xs font-semibold text-slate-100 shadow-lg"
          >
            <MessageSquare className="h-4 w-4 text-cyan-400" />
            <span>Chat</span>
            {unreadCount > 0 && (
              <span className="rounded-full bg-amber-400 px-1.5 py-0.2 font-mono-tab text-[10px] font-bold text-slate-950">
                {unreadCount}
              </span>
            )}
          </button>
        ) : (
          <div className="w-[min(86vw,300px)] rounded-xl border border-slate-700/85 bg-[#0B101B]/95 p-3 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-2">
              <span className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                <MessageSquare className="h-3.5 w-3.5 text-cyan-400" />
                <span>Chat de Partida</span>
              </span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Cerrar chat"
                className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-700 bg-slate-900 text-slate-300"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            {chatBody}
          </div>
        )}
      </div>
    );
  }

  if (phase === 'lobby' && !desktopLobbyOpen) {
    return (
      <div className="pointer-events-auto fixed bottom-5 left-5 z-20">
        <button
          type="button"
          onClick={() => {
            setDesktopLobbyOpen(true);
            setUnreadCount(0);
          }}
          className="flex items-center gap-2 rounded-xl border border-slate-700/80 bg-[#0B101B]/90 px-3.5 py-2.5 text-xs font-semibold text-slate-200 hover:border-cyan-400/60 hover:text-white transition-colors shadow-lg cursor-pointer"
        >
          <MessageSquare className="h-4 w-4 text-cyan-400" />
          <span>Chat</span>
          <span className="font-mono-tab text-[10px] text-slate-400">[T]</span>
          {unreadCount > 0 && (
            <span className="rounded bg-amber-400 px-1.5 py-0.2 font-mono-tab text-[10px] font-bold text-slate-950">
              {unreadCount}
            </span>
          )}
        </button>
      </div>
    );
  }

  return (
    <div
      className={`pointer-events-auto fixed z-20 w-72 rounded-xl border border-slate-700/80 bg-[#0B101B]/92 p-2.5 shadow-xl ${
        phase === 'lobby' ? 'bottom-5 left-5' : 'bottom-40 left-5'
      }`}
    >
      <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-2">
        <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-200">
          <MessageSquare className="h-3.5 w-3.5 text-cyan-400" />
          <span>Chat de Sala</span>
        </span>
        {phase === 'lobby' ? (
          <button
            type="button"
            onClick={() => setDesktopLobbyOpen(false)}
            aria-label="Minimizar chat"
            className="flex h-6 w-6 items-center justify-center rounded border border-slate-700 bg-slate-900 text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="h-3 w-3" />
          </button>
        ) : (
          <span className="font-mono-tab text-[10px] text-slate-400">[T] Escribir</span>
        )}
      </div>

      {chatBody}
    </div>
  );
}
