import {
  Check,
  Mail,
  RefreshCw,
  Search,
  Send,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchUserProfilesForFriends,
  type FriendProfileItem,
  type RoomInviteRecord,
} from '../firebase';
import { countryCodeToFlag, getCountryByCode } from '../shared/countries';
import { GENDER_PORTRAIT } from './LeaderboardModal';

interface FriendsModalProps {
  open: boolean;
  onClose: () => void;
  isSignedIn: boolean;
  myUid: string | null;
  isPrivateRoom: boolean;
  currentRoomCode: string;
  incomingInvites: RoomInviteRecord[];
  onInviteFriend: (friend: FriendProfileItem) => Promise<void>;
  onAcceptInvite: (invite: RoomInviteRecord) => Promise<void>;
  onDeclineInvite: (invite: RoomInviteRecord) => Promise<void>;
}

export function FriendsModal({
  open,
  onClose,
  isSignedIn,
  myUid,
  isPrivateRoom,
  currentRoomCode,
  incomingInvites,
  onInviteFriend,
  onAcceptInvite,
  onDeclineInvite,
}: FriendsModalProps) {
  const [friends, setFriends] = useState<FriendProfileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [invitedUids, setInvitedUids] = useState<Record<string, boolean>>({});
  const [invitingUid, setInvitingUid] = useState<string | null>(null);

  const loadFriends = useCallback(async () => {
    if (!isSignedIn || !myUid) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const profiles = await fetchUserProfilesForFriends(myUid);
      setFriends(profiles);
    } catch (err) {
      console.error('Failed to load friends from Firestore:', err);
      setErrorMsg('No se pudo cargar la lista de amigos desde Firestore.');
    } finally {
      setLoading(false);
    }
  }, [isSignedIn, myUid]);

  useEffect(() => {
    if (open && isSignedIn && myUid) {
      void loadFriends();
    }
  }, [open, isSignedIn, myUid, loadFriends]);

  const filteredFriends = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return friends;
    return friends.filter((f) => {
      const countryName = f.country ? getCountryByCode(f.country)?.name.toLowerCase() ?? '' : '';
      return (
        f.playerName.toLowerCase().includes(q) ||
        (f.country ?? '').toLowerCase().includes(q) ||
        countryName.includes(q)
      );
    });
  }, [friends, searchQuery]);

  if (!open) return null;

  const handleInviteClick = async (friend: FriendProfileItem) => {
    setInvitingUid(friend.uid);
    try {
      await onInviteFriend(friend);
      setInvitedUids((prev) => ({ ...prev, [friend.uid]: true }));
      window.setTimeout(() => {
        setInvitedUids((prev) => ({ ...prev, [friend.uid]: false }));
      }, 3500);
    } catch {
      setErrorMsg('No se pudo enviar la invitación.');
    } finally {
      setInvitingUid(null);
    }
  };

  return (
    <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-[#060911]/88 p-3 sm:p-4">
      <div className="flex w-full max-w-2xl max-h-[92dvh] flex-col overflow-hidden rounded-xl border border-slate-700 bg-[#0D1320] p-4 sm:p-6 shadow-2xl">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-cyan-500/40 bg-cyan-500/10 text-cyan-300 shrink-0">
              <Users className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-lg sm:text-xl font-bold text-white truncate">
                Amigos y Salas Privadas
              </h2>
              <p className="text-xs text-slate-400 line-clamp-2">
                {isPrivateRoom
                  ? `Tu sala privada actual: ${currentRoomCode}`
                  : 'Invita a tus amigos (se creará una sala privada automáticamente si estás en Pública)'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {isSignedIn && (
              <button
                type="button"
                onClick={() => void loadFriends()}
                disabled={loading}
                aria-label="Actualizar lista de amigos"
                className="flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-slate-500 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Actualizar</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar amigos"
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-slate-300 hover:text-white cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {!isSignedIn ? (
          <div className="my-8 rounded-xl border border-slate-800 bg-slate-950/70 p-6 text-center">
            <UserCheck className="mx-auto h-9 w-9 text-cyan-400" />
            <h3 className="mt-3 font-display text-lg font-bold text-white">
              Inicia sesión con Google para ver tus Amigos
            </h3>
            <p className="mt-1.5 text-sm text-slate-400">
              Conecta tu cuenta de Google en la pantalla inicial para consultar el estado en línea de otros jugadores e invitarlos a salas privadas.
            </p>
          </div>
        ) : (
          <div className="mt-4 flex flex-1 min-h-0 flex-col gap-3 sm:gap-4">
            {/* Incoming Room Invitations */}
            {incomingInvites.length > 0 && (
              <div className="shrink-0 rounded-xl border border-amber-400/50 bg-amber-500/10 p-3.5 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                  <Mail className="h-4 w-4" />
                  <span>Invitaciones a Sala Privada ({incomingInvites.length})</span>
                </div>
                <div className="space-y-2">
                  {incomingInvites.map((inv) => (
                    <div
                      key={inv.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-400/30 bg-[#0A0F1A] px-3 py-2.5"
                    >
                      <div className="text-xs">
                        <span className="font-bold text-white">
                          {inv.fromCountry ? `${countryCodeToFlag(inv.fromCountry)} ` : ''}
                          {inv.fromName}
                        </span>{' '}
                        <span className="text-slate-300">te invitó a la sala</span>{' '}
                        <span className="font-mono-tab font-bold text-amber-300">
                          {inv.roomCode}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void onAcceptInvite(inv)}
                          className="min-h-[38px] rounded-md bg-emerald-400 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-emerald-300 cursor-pointer"
                        >
                          Unirse
                        </button>
                        <button
                          type="button"
                          onClick={() => void onDeclineInvite(inv)}
                          className="min-h-[38px] rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:text-white cursor-pointer"
                        >
                          Rechazar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Search Input */}
            <div className="relative shrink-0">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar amigo por nombre o país..."
                className="min-h-[42px] w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-9 pr-3 text-sm text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
              />
            </div>

            {errorMsg && (
              <div className="shrink-0 rounded-lg border border-rose-500/40 bg-rose-950/60 px-3 py-2 text-xs text-rose-200">
                {errorMsg}
              </div>
            )}

            {/* Profiles List */}
            <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
              {loading && friends.length === 0 ? (
                <div className="py-10 text-center text-sm text-slate-400">
                  Cargando jugadores desde Firestore...
                </div>
              ) : filteredFriends.length === 0 ? (
                <div className="py-10 text-center text-sm text-slate-400">
                  {friends.length === 0
                    ? 'Aún no hay otros jugadores registrados con cuenta Google.'
                    : 'Ningún jugador coincide con tu búsqueda.'}
                </div>
              ) : (
                filteredFriends.map((friend) => {
                  const statusLabel =
                    friend.onlineStatus === 'in_match'
                      ? 'En partida'
                      : friend.onlineStatus === 'online'
                        ? 'En línea'
                        : 'Desconectado';
                  const statusStyle =
                    friend.onlineStatus === 'in_match'
                      ? 'border-amber-400/50 bg-amber-500/15 text-amber-300'
                      : friend.onlineStatus === 'online'
                        ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-300'
                        : 'border-slate-700 bg-slate-900 text-slate-400';

                  const alreadyInvited = Boolean(invitedUids[friend.uid]);
                  const isInviting = invitingUid === friend.uid;

                  return (
                    <div
                      key={friend.uid}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-[#0A0F1A] px-3.5 py-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={GENDER_PORTRAIT[friend.gender]}
                          alt={friend.playerName}
                          referrerPolicy="no-referrer"
                          className="h-10 w-10 rounded-lg object-cover object-top bg-slate-800 border border-slate-700 shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-display text-sm font-bold text-white">
                              {friend.country ? `${countryCodeToFlag(friend.country)} ` : ''}
                              {friend.playerName}
                            </span>
                            <span
                              className={`rounded border px-2 py-0.5 text-[10px] font-bold shrink-0 ${statusStyle}`}
                            >
                              {statusLabel}
                            </span>
                          </div>
                          <div className="mt-0.5 text-[11px] text-slate-400">
                            {friend.country
                              ? getCountryByCode(friend.country)?.name ?? friend.country
                              : 'Sin país'}
                            {friend.onlineStatus !== 'offline' && friend.currentRoomCode
                              ? ` · Sala ${
                                  friend.currentRoomCode === 'PUBLIC'
                                    ? 'Pública'
                                    : friend.currentRoomCode
                                }`
                              : ''}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={isInviting || alreadyInvited}
                        onClick={() => void handleInviteClick(friend)}
                        className={`flex min-h-[40px] items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-colors shrink-0 ${
                          alreadyInvited
                            ? 'border border-emerald-500/50 bg-emerald-500/15 text-emerald-300 cursor-default'
                            : 'bg-amber-400 text-slate-950 hover:bg-amber-300 cursor-pointer disabled:opacity-60'
                        }`}
                      >
                        {alreadyInvited ? (
                          <>
                            <Check className="h-3.5 w-3.5" />
                            <span>Invitación enviada</span>
                          </>
                        ) : (
                          <>
                            <Send className="h-3.5 w-3.5" />
                            <span>
                              {isInviting ? 'Enviando...' : 'Invitar a Sala'}
                            </span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
