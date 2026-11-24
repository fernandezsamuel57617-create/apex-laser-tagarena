import { Headphones, HeadphoneOff, Mic, MicOff, PhoneOff, Radio, Users, Volume2 } from 'lucide-react';
import { useState } from 'react';
import type { PlayerSnapshot } from '../shared/types';
import type { VoiceStatus } from '../voice/voiceManager';

interface VoiceChatPanelProps {
  voiceStatus: VoiceStatus;
  players: PlayerSnapshot[];
  myId: string | null;
  onJoinRoom: (room: string) => void;
  onLeaveRoom: () => void;
  onToggleMicMute: () => void;
  onToggleDeafen: () => void;
}

export function VoiceChatPanel({
  voiceStatus,
  players,
  myId,
  onJoinRoom,
  onLeaveRoom,
  onToggleMicMute,
  onToggleDeafen,
}: VoiceChatPanelProps) {
  const [roomInput, setRoomInput] = useState('amigos');
  const [expanded, setExpanded] = useState(false);

  const peersInRoom = voiceStatus.connected
    ? players.filter((p) => !p.isBot && p.voiceRoom === voiceStatus.room)
    : [];

  const activeRoomsMap = new Map<string, number>();
  for (const p of players) {
    if (!p.isBot && p.voiceRoom) {
      activeRoomsMap.set(p.voiceRoom, (activeRoomsMap.get(p.voiceRoom) ?? 0) + 1);
    }
  }

  const handleJoin = (e?: React.FormEvent) => {
    e?.preventDefault();
    const target = roomInput.trim().toLowerCase().slice(0, 24) || 'amigos';
    setRoomInput(target);
    onJoinRoom(target);
    setExpanded(true);
  };

  if (!voiceStatus.connected && !expanded) {
    const activeCount = Array.from(activeRoomsMap.values()).reduce((a, b) => a + b, 0);
    return (
      <div className="pointer-events-auto flex items-center gap-2">
        <button
          type="button"
          onClick={() => handleJoin()}
          className="flex items-center gap-2 rounded-lg border border-emerald-500/60 bg-[#0B101B]/92 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/15 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Radio className="h-3.5 w-3.5" />
          <span>Voz Amigos</span>
          {activeCount > 0 && (
            <span className="font-mono-tab rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] text-emerald-200">
              {activeCount}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="rounded-lg border border-slate-700/80 bg-[#0B101B]/92 px-2.5 py-1.5 text-[11px] font-medium text-slate-300 hover:text-white hover:border-slate-500 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          Sala
        </button>
      </div>
    );
  }

  return (
    <div className="pointer-events-auto w-64 rounded-xl border border-slate-700/80 bg-[#0B101B]/94 p-3 shadow-xl">
      <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Radio
            className={`h-3.5 w-3.5 shrink-0 ${
              voiceStatus.connected ? 'text-emerald-400' : 'text-slate-400'
            }`}
          />
          <span className="font-display text-xs font-bold text-white truncate">
            {voiceStatus.connected ? `Voz · #${voiceStatus.room}` : 'Chat de Voz Amigos'}
          </span>
        </div>

        {voiceStatus.connected ? (
          <button
            type="button"
            onClick={onLeaveRoom}
            title="Salir del chat de voz"
            className="flex items-center gap-1 rounded bg-rose-500/15 px-2 py-0.5 text-[11px] font-semibold text-rose-300 hover:bg-rose-500/25 transition-colors cursor-pointer"
          >
            <PhoneOff className="h-3 w-3" />
            <span>Salir</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="text-[11px] font-medium text-slate-400 hover:text-white cursor-pointer"
          >
            Cerrar
          </button>
        )}
      </div>

      {!voiceStatus.connected ? (
        <form onSubmit={handleJoin} className="mt-2.5 space-y-2">
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">
              Código de sala (compártelo con tus amigos)
            </label>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={roomInput}
                onChange={(e) => setRoomInput(e.target.value)}
                maxLength={24}
                placeholder="amigos"
                className="w-full rounded-lg border border-slate-700 bg-slate-900/90 px-2.5 py-1.5 text-xs text-white placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
              />
              <button
                type="submit"
                className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-emerald-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Entrar
              </button>
            </div>
          </div>

          {activeRoomsMap.size > 0 && (
            <div className="pt-1">
              <div className="text-[10px] font-medium text-slate-400 mb-1">Salas activas:</div>
              <div className="flex flex-wrap gap-1.5">
                {Array.from(activeRoomsMap.entries()).map(([rName, count]) => (
                  <button
                    key={rName}
                    type="button"
                    onClick={() => {
                      setRoomInput(rName);
                      onJoinRoom(rName);
                    }}
                    className="flex items-center gap-1 rounded border border-slate-700 bg-slate-900 px-2 py-0.5 text-[11px] text-slate-200 hover:border-emerald-400/60 hover:text-emerald-300 cursor-pointer"
                  >
                    <span>#{rName}</span>
                    <span className="font-mono-tab text-[10px] text-slate-400">({count})</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </form>
      ) : (
        <div className="mt-2.5 space-y-2.5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleMicMute}
              disabled={!voiceStatus.hasMic}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                !voiceStatus.hasMic
                  ? 'border-slate-800 bg-slate-900/50 text-slate-500 cursor-not-allowed'
                  : voiceStatus.micMuted
                    ? 'border-rose-500/50 bg-rose-500/15 text-rose-300'
                    : voiceStatus.speaking
                      ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
                      : 'border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-500'
              }`}
            >
              {voiceStatus.micMuted || !voiceStatus.hasMic ? (
                <MicOff className="h-3.5 w-3.5" />
              ) : (
                <Mic className="h-3.5 w-3.5" />
              )}
              <span>{voiceStatus.micMuted ? 'Muteado [M]' : 'Mic Activo [M]'}</span>
            </button>

            <button
              type="button"
              onClick={onToggleDeafen}
              title={voiceStatus.deafened ? 'Escuchar amigos' : 'Silenciar audio entrante'}
              className={`flex h-8 w-9 items-center justify-center rounded-lg border transition-colors cursor-pointer ${
                voiceStatus.deafened
                  ? 'border-amber-500/60 bg-amber-500/15 text-amber-300'
                  : 'border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-500'
              }`}
            >
              {voiceStatus.deafened ? (
                <HeadphoneOff className="h-3.5 w-3.5" />
              ) : (
                <Headphones className="h-3.5 w-3.5" />
              )}
            </button>
          </div>

          {voiceStatus.error && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-200">
              {voiceStatus.error}
            </div>
          )}

          <div className="max-h-28 overflow-y-auto space-y-1">
            <div className="flex items-center justify-between text-[10px] font-medium text-slate-400">
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                En sala
              </span>
              <span className="font-mono-tab">{peersInRoom.length}</span>
            </div>

            {peersInRoom.map((p) => {
              const isMe = p.id === myId;
              const isTalking = isMe
                ? voiceStatus.speaking && !voiceStatus.micMuted
                : p.voiceSpeaking;
              return (
                <div
                  key={p.id}
                  className={`flex items-center justify-between rounded-md px-2 py-1 text-xs border ${
                    isTalking
                      ? 'border-emerald-400/60 bg-emerald-500/15 text-emerald-100'
                      : 'border-transparent bg-slate-900/70 text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: p.accentColor }}
                    />
                    <span className="truncate font-medium">
                      {p.name}
                      {isMe ? ' (Tú)' : ''}
                    </span>
                  </div>
                  {isTalking ? (
                    <Volume2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  ) : isMe && voiceStatus.micMuted ? (
                    <MicOff className="h-3 w-3 text-rose-400 shrink-0" />
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
