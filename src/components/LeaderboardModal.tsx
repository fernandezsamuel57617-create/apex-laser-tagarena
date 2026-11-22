import { Flag, Shield, Trophy, X } from 'lucide-react';
import { useState } from 'react';
import { countryCodeToFlag } from '../shared/countries';
import { RANK_TIERS, getNextRankProgress, getRankByWins } from '../shared/ranks';
import type { LeaderboardEntry, PlayerSnapshot } from '../shared/types';
import { RankBadge, RankEmblemSvg } from './RankBadge';

const REPORT_REASONS = [
  'Velocidad anormal / Teleport',
  'Reaparición instantánea',
  'Disparo rápido / Aimbot',
  'Comportamiento sospechoso',
] as const;

export const GENDER_PORTRAIT: Record<'male' | 'female', string> = {
  male: '/assets/aistudio/Captura_de_pantalla_2026-11-16_161406_5e3ea922.png',
  female: '/assets/aistudio/Captura_de_pantalla_2026-11-16_161605_65709189.png',
};

export type LeaderboardTab = 'global' | 'live' | 'ranked';

interface LeaderboardModalProps {
  open: boolean;
  onClose: () => void;
  globalEntries: LeaderboardEntry[];
  livePlayers?: PlayerSnapshot[];
  myId?: string | null;
  myName?: string;
  myRankedWins?: number;
  initialTab?: LeaderboardTab;
  onTabChange?: (tab: LeaderboardTab) => void;
  reportedIds?: Record<string, boolean>;
  reportFeedback?: string | null;
  onReportPlayer?: (targetId: string, targetName: string, reason: string) => void;
}

export function LeaderboardModal({
  open,
  onClose,
  globalEntries,
  livePlayers = [],
  myId = null,
  myName,
  myRankedWins = 0,
  initialTab = 'global',
  onTabChange,
  reportedIds = {},
  reportFeedback = null,
  onReportPlayer,
}: LeaderboardModalProps) {
  const [reportingTarget, setReportingTarget] = useState<{ id: string; name: string } | null>(null);

  if (!open) return null;

  const sortedLive = [...livePlayers].sort((a, b) => b.score - a.score || b.tags - a.tags);
  const maxKills = sortedLive.reduce((max, p) => Math.max(max, p.tags), 0);
  const mvpPlayerId =
    maxKills > 0
      ? ([...sortedLive].sort((a, b) => b.tags - a.tags || b.score - a.score)[0]?.id ?? null)
      : null;

  const showLive = initialTab === 'live' && livePlayers.length > 0;
  const showRanked = initialTab === 'ranked';
  const sortedRanked = [...globalEntries].sort(
    (a, b) =>
      (b.rankedWins ?? 0) - (a.rankedWins ?? 0) ||
      b.wins - a.wins ||
      b.totalScore - a.totalScore,
  );
  const myProgress = getNextRankProgress(myRankedWins);

  const submitReport = (reason: string) => {
    if (!reportingTarget || !onReportPlayer) return;
    onReportPlayer(reportingTarget.id, reportingTarget.name, reason);
    setReportingTarget(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#060911]/88 p-3 sm:p-4">
      <div className="flex w-full max-w-3xl max-h-[92dvh] flex-col rounded-xl border border-slate-700/80 bg-[#0D1320] shadow-2xl overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-3 border-b border-slate-800 px-4 py-3 sm:px-6 sm:py-4 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3">
            {showRanked ? (
              <Shield className="h-5 w-5 text-amber-400 shrink-0" />
            ) : (
              <Trophy className="h-5 w-5 text-amber-400 shrink-0" />
            )}
            <h2 className="font-display text-lg sm:text-xl font-bold tracking-wide text-slate-50">
              {showRanked ? 'Clasificatoria · Rangos' : 'Tabla de Líderes'}
            </h2>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 max-w-full">
            {onTabChange && (
              <div className="flex items-center rounded-lg bg-slate-900 p-1 border border-slate-800 overflow-x-auto max-w-full">
                {livePlayers.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onTabChange('live')}
                    className={`min-h-[36px] px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      showLive
                        ? 'bg-cyan-500 text-slate-950'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    Partida Actual
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onTabChange('global')}
                  className={`min-h-[36px] px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    !showLive && !showRanked
                      ? 'bg-cyan-500 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Ranking Global
                </button>
                <button
                  type="button"
                  onClick={() => onTabChange('ranked')}
                  className={`min-h-[36px] px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    showRanked
                      ? 'bg-amber-400 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Rangos
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar tabla de líderes"
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-700/80 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6">
          {reportFeedback && (
            <div className="mb-4 rounded-lg border border-amber-400/50 bg-amber-500/10 px-3.5 py-2 text-xs font-semibold text-amber-200">
              {reportFeedback}
            </div>
          )}

          {reportingTarget && (
            <div className="mb-4 rounded-xl border border-rose-500/50 bg-rose-950/35 p-3.5">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-bold text-rose-200">
                  Reportar conducta sospechosa: <span className="text-white">{reportingTarget.name}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setReportingTarget(null)}
                  className="text-[11px] font-semibold text-slate-400 hover:text-white cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {REPORT_REASONS.map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => submitReport(reason)}
                    className="rounded-lg border border-rose-400/40 bg-slate-900/90 px-2.5 py-1.5 text-[11px] font-semibold text-rose-100 hover:border-rose-400 hover:bg-rose-500/20 transition-colors cursor-pointer"
                  >
                    {reason}
                  </button>
                ))}
              </div>
            </div>
          )}
          {showRanked ? (
            <div className="space-y-5">
              {/* Personal Ranked Progress Card */}
              <div className="rounded-xl border border-amber-400/40 bg-[#0A101D] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-700 bg-slate-900">
                      <RankEmblemSvg tierId={myProgress.current.id} size={28} />
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Tu Rango Clasificatorio
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`font-display text-lg font-bold ${myProgress.current.textClass}`}>
                          {myProgress.current.name}
                        </span>
                        <span className="font-mono-tab text-xs text-slate-300">
                          ({myRankedWins} {myRankedWins === 1 ? 'victoria' : 'victorias'} en Rangos)
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right text-xs text-slate-300">
                    {myProgress.next ? (
                      <>
                        Siguiente: <strong className={myProgress.next.textClass}>{myProgress.next.name}</strong>
                        <div className="font-mono-tab text-[11px] text-amber-300">
                          Faltan {myProgress.winsNeededForNext} victorias
                        </div>
                      </>
                    ) : (
                      <span className="font-display font-bold text-purple-300">
                        Rango Máximo Alcanzado
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full bg-amber-400 transition-all duration-300"
                    style={{ width: `${myProgress.pct}%` }}
                  />
                </div>
                <p className="mt-2 text-[11px] text-slate-400">
                  Solo las partidas ganadas en el <strong className="text-amber-300">Modo Rangos</strong> aumentan tu nivel de rango.
                </p>
              </div>

              {/* 5 Rank Tiers Legend */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {RANK_TIERS.map((tier) => {
                  const active = myProgress.current.id === tier.id;
                  return (
                    <div
                      key={tier.id}
                      className={`rounded-lg border p-2.5 text-center ${
                        active ? tier.badgeClass : 'border-slate-800 bg-slate-900/60'
                      }`}
                    >
                      <div className="flex justify-center">
                        <RankEmblemSvg tierId={tier.id} size={22} />
                      </div>
                      <div className={`mt-1 font-display text-xs font-bold ${tier.textClass}`}>
                        {tier.name}
                      </div>
                      <div className="font-mono-tab text-[10px] text-slate-400">
                        {tier.minWins}+ vic.
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Ranked Leaderboard Table */}
              {sortedRanked.length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-400">
                  Aún no hay jugadores clasificados. Activa el Modo Rangos en el Lobby para comenzar tu ascenso.
                </div>
              ) : (
                <div className="overflow-x-auto -mx-1 px-1">
                <table className="w-full min-w-[540px] text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-xs font-semibold text-slate-400">
                      <th className="pb-3 pr-3">#</th>
                      <th className="pb-3 pr-3">Agente</th>
                      <th className="pb-3 pr-3">Rango</th>
                      <th className="pb-3 pr-3 text-right">Victorias Rangos</th>
                      <th className="pb-3 pr-3 text-right">Tags</th>
                      <th className="pb-3 pr-3 text-right">Puntos</th>
                      {onReportPlayer && <th className="pb-3 text-right">Acción</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70 text-sm">
                    {sortedRanked.map((entry, idx) => {
                      const rankedWins = entry.rankedWins ?? 0;
                      const tier = getRankByWins(rankedWins);
                      const isSelf = Boolean(myName && entry.name.toLowerCase() === myName.toLowerCase());
                      const alreadyReported = Boolean(reportedIds[entry.id]);
                      return (
                        <tr key={entry.id} className="hover:bg-slate-800/35 transition-colors">
                          <td className="py-3 pr-3 font-mono-tab font-bold text-slate-400">
                            {idx + 1}
                          </td>
                          <td className="py-3 pr-3">
                            <div className="flex items-center gap-3">
                              <img
                                src={GENDER_PORTRAIT[entry.gender]}
                                alt={entry.name}
                                referrerPolicy="no-referrer"
                                className="h-9 w-9 rounded-md object-cover object-top bg-slate-800 border border-slate-700"
                              />
                              <div>
                                <div className="font-semibold text-slate-100">{entry.name}</div>
                                <div className="text-xs text-slate-400">
                                  {entry.gender === 'male' ? 'Hombre' : 'Mujer'} · {entry.matchesPlayed}{' '}
                                  {entry.matchesPlayed === 1 ? 'partida' : 'partidas'}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 pr-3">
                            <RankBadge rankedWins={rankedWins} showLabel size="sm" />
                          </td>
                          <td className={`py-3 pr-3 text-right font-mono-tab font-bold ${tier.textClass}`}>
                            {rankedWins}
                          </td>
                          <td className="py-3 pr-3 text-right font-mono-tab text-cyan-300">
                            {entry.totalTags}
                          </td>
                          <td className="py-3 pr-3 text-right font-mono-tab font-bold text-white">
                            {entry.totalScore}
                          </td>
                          {onReportPlayer && (
                            <td className="py-3 text-right">
                              {!isSelf && (
                                <button
                                  type="button"
                                  disabled={alreadyReported}
                                  onClick={() => setReportingTarget({ id: entry.id, name: entry.name })}
                                  className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors ${
                                    alreadyReported
                                      ? 'border-slate-700 bg-slate-900 text-slate-500 cursor-default'
                                      : 'border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 cursor-pointer'
                                  }`}
                                >
                                  <Flag className="h-3 w-3" />
                                  <span>{alreadyReported ? 'Reportado' : 'Reportar'}</span>
                                </button>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>
              )}
            </div>
          ) : showLive ? (
            <div className="overflow-x-auto -mx-1 px-1">
            <table className="w-full min-w-[540px] text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-xs font-semibold text-slate-400">
                  <th className="pb-3 pr-3">#</th>
                  <th className="pb-3 pr-3">Agente</th>
                  <th className="pb-3 pr-3 text-right">Tags</th>
                  <th className="pb-3 pr-3 text-right">Bajas</th>
                  <th className="pb-3 pr-3 text-right">Mejor Racha</th>
                  <th className="pb-3 pr-3 text-right">Puntos</th>
                  {onReportPlayer && <th className="pb-3 text-right">Acción</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 text-sm">
                {sortedLive.map((p, idx) => {
                  const isMvp = p.id === mvpPlayerId;
                  const canReport = Boolean(onReportPlayer && !p.isBot && p.id !== myId);
                  const alreadyReported = Boolean(reportedIds[p.id]);
                  return (
                    <tr
                      key={p.id}
                      className={`transition-colors ${
                        isMvp ? 'bg-amber-500/10 hover:bg-amber-500/15' : 'hover:bg-slate-800/35'
                      }`}
                    >
                      <td className="py-3 pr-3 font-mono-tab font-bold text-slate-400">
                        {idx + 1}
                      </td>
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={GENDER_PORTRAIT[p.gender]}
                            alt={p.name}
                            referrerPolicy="no-referrer"
                            className={`h-9 w-9 rounded-md object-cover object-top bg-slate-800 border ${
                              isMvp ? 'border-amber-400' : 'border-slate-700'
                            }`}
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <RankBadge rankedWins={p.rankedWins ?? 0} size="sm" />
                              <span className="font-semibold text-slate-100">
                                {p.country ? `${countryCodeToFlag(p.country)} ` : ''}
                                {p.name}
                              </span>
                              {isMvp && (
                                <span className="rounded border border-amber-400/70 bg-amber-400/20 px-1.5 py-0.5 font-display text-[10px] font-bold tracking-wider text-amber-300">
                                  MVP
                                </span>
                              )}
                              {(p.flagCount ?? 0) > 0 && (
                                <span className="rounded border border-rose-500/60 bg-rose-500/15 px-1.5 py-0.5 font-mono-tab text-[10px] font-bold text-rose-300">
                                  {p.flagCount} alerta{(p.flagCount ?? 0) > 1 ? 's' : ''}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-400">
                              {p.gender === 'male' ? 'Hombre' : 'Mujer'}
                              {p.isBot ? ' · Dron' : ''}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-3 text-right font-mono-tab text-cyan-300 font-semibold">
                        {p.tags}
                      </td>
                      <td className="py-3 pr-3 text-right font-mono-tab text-slate-400">
                        {p.deaths}
                      </td>
                      <td className="py-3 pr-3 text-right font-mono-tab text-amber-300">
                        {p.bestStreak}
                      </td>
                      <td className="py-3 pr-3 text-right font-mono-tab font-bold text-white">
                        {p.score}
                      </td>
                      {onReportPlayer && (
                        <td className="py-3 text-right">
                          {canReport && (
                            <button
                              type="button"
                              disabled={alreadyReported}
                              onClick={() => setReportingTarget({ id: p.id, name: p.name })}
                              className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors ${
                                alreadyReported
                                  ? 'border-slate-700 bg-slate-900 text-slate-500 cursor-default'
                                  : 'border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 cursor-pointer'
                              }`}
                            >
                              <Flag className="h-3 w-3" />
                              <span>{alreadyReported ? 'Reportado' : 'Reportar'}</span>
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          ) : globalEntries.length === 0 ? (
            <div className="py-12 text-center">
              <p className="font-display text-lg font-semibold text-slate-200">
                Aún no hay partidas registradas
              </p>
              <p className="mt-1 text-sm text-slate-400">
                Completa una partida en la arena para registrar tu puntuación en el ranking global.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-1 px-1">
            <table className="w-full min-w-[660px] text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-xs font-semibold text-slate-400">
                  <th className="pb-3 pr-3">#</th>
                  <th className="pb-3 pr-3">Agente</th>
                  <th className="pb-3 pr-3 text-right">Victorias</th>
                  <th className="pb-3 pr-3 text-right">Tags</th>
                  <th className="pb-3 pr-3 text-right">Máx Kills</th>
                  <th className="pb-3 pr-3 text-right">Mejor Racha</th>
                  <th className="pb-3 pr-3 text-right">Máx Puntos</th>
                  <th className="pb-3 pr-3 text-right">Puntos Totales</th>
                  {onReportPlayer && <th className="pb-3 text-right">Acción</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 text-sm">
                {globalEntries.map((entry, idx) => {
                  const isSelf = Boolean(myName && entry.name.toLowerCase() === myName.toLowerCase());
                  const alreadyReported = Boolean(reportedIds[entry.id]);
                  return (
                  <tr key={entry.id} className="hover:bg-slate-800/35 transition-colors">
                    <td
                      className={`py-3 pr-3 font-mono-tab font-bold ${
                        idx === 0
                          ? 'text-amber-400'
                          : idx === 1
                            ? 'text-slate-200'
                            : idx === 2
                              ? 'text-amber-600'
                              : 'text-slate-400'
                      }`}
                    >
                      {idx + 1}
                    </td>
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={GENDER_PORTRAIT[entry.gender]}
                          alt={entry.name}
                          referrerPolicy="no-referrer"
                          className="h-9 w-9 rounded-md object-cover object-top bg-slate-800 border border-slate-700"
                        />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <RankBadge rankedWins={entry.rankedWins ?? 0} size="xs" />
                            <span className="font-semibold text-slate-100">{entry.name}</span>
                          </div>
                          <div className="text-xs text-slate-400">
                            {entry.gender === 'male' ? 'Hombre' : 'Mujer'} · {entry.matchesPlayed}{' '}
                            {entry.matchesPlayed === 1 ? 'partida' : 'partidas'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-3 text-right font-mono-tab text-emerald-400 font-semibold">
                      {entry.wins}
                    </td>
                    <td className="py-3 pr-3 text-right font-mono-tab text-cyan-300">
                      {entry.totalTags}
                    </td>
                    <td className="py-3 pr-3 text-right font-mono-tab text-rose-300 font-semibold">
                      {entry.bestMatchTags ?? 0}
                    </td>
                    <td className="py-3 pr-3 text-right font-mono-tab text-amber-300">
                      {entry.bestStreak}
                    </td>
                    <td className="py-3 pr-3 text-right font-mono-tab text-sky-300 font-semibold">
                      {entry.bestMatchScore ?? 0}
                    </td>
                    <td className="py-3 pr-3 text-right font-mono-tab font-bold text-white">
                      {entry.totalScore}
                    </td>
                    {onReportPlayer && (
                      <td className="py-3 text-right">
                        {!isSelf && (
                          <button
                            type="button"
                            disabled={alreadyReported}
                            onClick={() => setReportingTarget({ id: entry.id, name: entry.name })}
                            className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors ${
                              alreadyReported
                                ? 'border-slate-700 bg-slate-900 text-slate-500 cursor-default'
                                : 'border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 cursor-pointer'
                            }`}
                          >
                            <Flag className="h-3 w-3" />
                            <span>{alreadyReported ? 'Reportado' : 'Reportar'}</span>
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
