import { Activity, AlertTriangle, Crosshair, Filter, RefreshCw, ShieldAlert, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import type {
  AuditEventType,
  AuditLogEntry,
  MonitorStatePayload,
  PlayerTelemetrySnapshot,
} from '../shared/types';

interface InGameMonitorOverlayProps {
  open: boolean;
  onClose: () => void;
  monitor: MonitorStatePayload | null;
  fallbackAuditLogs: AuditLogEntry[];
  onRefreshAudit: () => void;
}

const EVENT_LABELS: Record<AuditEventType, string> = {
  ABNORMAL_SPEED: 'Velocidad Anómala',
  INSTANT_RESPAWN_HACK: 'Respawn Hack',
  ABNORMAL_FIRE_RATE: 'Cadencia Anómala',
  SUSPICIOUS_ACCURACY: 'Precisión Sospechosa',
  PLAYER_REPORT: 'Reporte Jugador',
};

function formatTime(ts: number): string {
  try {
    return new Date(ts).toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return '--:--:--';
  }
}

export function InGameMonitorOverlay({
  open,
  onClose,
  monitor,
  fallbackAuditLogs,
  onRefreshAudit,
}: InGameMonitorOverlayProps) {
  const [playerFilter, setPlayerFilter] = useState<'all' | 'humans' | 'flagged'>('all');
  const [logFilter, setLogFilter] = useState<'ALL' | AuditEventType>('ALL');

  const logs = useMemo(() => {
    const src = monitor?.auditLogs?.length ? monitor.auditLogs : fallbackAuditLogs;
    if (logFilter === 'ALL') return src;
    return src.filter((entry) => entry.type === logFilter);
  }, [monitor?.auditLogs, fallbackAuditLogs, logFilter]);

  const allPlayers: PlayerTelemetrySnapshot[] = monitor?.players ?? [];
  const visiblePlayers = useMemo(() => {
    if (playerFilter === 'humans') return allPlayers.filter((p) => !p.isBot);
    if (playerFilter === 'flagged') return allPlayers.filter((p) => p.flagsCount > 0);
    return allPlayers;
  }, [allPlayers, playerFilter]);

  if (!open) return null;

  const allLogs = monitor?.auditLogs?.length ? monitor.auditLogs : fallbackAuditLogs;
  const speedAlerts = allLogs.filter((l) => l.type === 'ABNORMAL_SPEED').length;
  const exploitAlerts = allLogs.filter(
    (l) => l.type === 'INSTANT_RESPAWN_HACK' || l.type === 'ABNORMAL_FIRE_RATE',
  ).length;
  const aimAndReports = allLogs.filter(
    (l) => l.type === 'SUSPICIOUS_ACCURACY' || l.type === 'PLAYER_REPORT',
  ).length;

  return (
    <div className="pointer-events-auto fixed inset-0 z-40 flex items-center justify-center bg-[#04070E]/82 p-3 md:p-6">
      <div className="flex max-h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-cyan-500/45 bg-[#090E19]/97 shadow-2xl">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-5 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-cyan-400/50 bg-cyan-500/15 text-cyan-300">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-base md:text-lg font-bold tracking-wide text-white">
                  Monitor en Tiempo Real · Admin / Dev
                </h2>
                <span className="rounded border border-emerald-400/40 bg-emerald-500/15 px-2 py-0.5 font-mono-tab text-[10px] font-bold text-emerald-300">
                  SALA {monitor?.roomCode ?? 'PUBLIC'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Supervisión de velocidad (u/s), vector de movimiento, precisión (%) y registro de auditoría del servidor · [F9]
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRefreshAudit}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-cyan-400/60 hover:text-cyan-200 transition-colors cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Actualizar</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar monitor"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Summary Counters */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 border-b border-slate-800/90 bg-[#070B14] px-5 py-3">
          <div className="rounded-lg border border-slate-800 bg-[#0C1322] px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Jugadores Activos
            </div>
            <div className="mt-0.5 font-mono-tab text-lg font-bold text-cyan-300">
              {allPlayers.length}{' '}
              <span className="text-xs font-normal text-slate-400">
                ({allPlayers.filter((p) => !p.isBot).length} humanos)
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-slate-800 bg-[#0C1322] px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Alertas Velocidad
            </div>
            <div className="mt-0.5 font-mono-tab text-lg font-bold text-amber-300">
              {speedAlerts}
            </div>
          </div>

          <div className="rounded-lg border border-slate-800 bg-[#0C1322] px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Respawn / Cadencia
            </div>
            <div className="mt-0.5 font-mono-tab text-lg font-bold text-rose-400">
              {exploitAlerts}
            </div>
          </div>

          <div className="rounded-lg border border-slate-800 bg-[#0C1322] px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Aimbot / Reportes
            </div>
            <div className="mt-0.5 font-mono-tab text-lg font-bold text-slate-100">
              {aimAndReports}
            </div>
          </div>
        </div>

        {/* Main 2-Column Workspace */}
        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-800">
          {/* Left: Live Player Telemetry Table */}
          <div className="lg:col-span-7 flex min-h-0 flex-col p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-300">
                <Crosshair className="h-4 w-4" />
                <span>Métricas en Vivo</span>
              </div>

              <div className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 p-0.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => setPlayerFilter('all')}
                  className={`rounded px-2.5 py-1 font-semibold cursor-pointer ${
                    playerFilter === 'all' ? 'bg-cyan-500 text-slate-950' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Todos
                </button>
                <button
                  type="button"
                  onClick={() => setPlayerFilter('humans')}
                  className={`rounded px-2.5 py-1 font-semibold cursor-pointer ${
                    playerFilter === 'humans' ? 'bg-cyan-500 text-slate-950' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Humanos
                </button>
                <button
                  type="button"
                  onClick={() => setPlayerFilter('flagged')}
                  className={`rounded px-2.5 py-1 font-semibold cursor-pointer ${
                    playerFilter === 'flagged' ? 'bg-rose-500 text-white' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Con Alertas
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-slate-800 bg-[#070B14]">
              <table className="w-full border-collapse text-left text-xs">
                <thead className="sticky top-0 bg-[#0D1424] border-b border-slate-800 text-[11px] font-semibold text-slate-400">
                  <tr>
                    <th className="px-3 py-2.5">Jugador</th>
                    <th className="px-3 py-2.5 text-right">Velocidad</th>
                    <th className="px-3 py-2.5">Vector (vx, vy, vz)</th>
                    <th className="px-3 py-2.5 text-right">Precisión</th>
                    <th className="px-3 py-2.5 text-right">Alertas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {visiblePlayers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                        No hay jugadores que coincidan con este filtro.
                      </td>
                    </tr>
                  ) : (
                    visiblePlayers.map((p) => {
                      const highSpeed = p.speed > 26 || p.peakSpeed > 31;
                      const highAcc = p.shotsFired >= 10 && p.accuracyPct >= 85;
                      return (
                        <tr
                          key={p.id}
                          className={
                            p.flagsCount > 0 || highSpeed || highAcc
                              ? 'bg-rose-500/8 hover:bg-rose-500/12'
                              : 'hover:bg-slate-800/35'
                          }
                        >
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`h-2 w-2 rounded-full shrink-0 ${
                                  p.alive ? 'bg-emerald-400' : 'bg-rose-500'
                                }`}
                                title={p.alive ? 'Vivo' : 'Eliminado'}
                              />
                              <span className="font-semibold text-slate-100 truncate max-w-[125px]">
                                {p.name}
                              </span>
                              {p.isBot && (
                                <span className="rounded bg-slate-800 px-1 py-0.2 text-[9px] font-bold text-slate-400">
                                  BOT
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono-tab">
                              {p.zone.toUpperCase()} · {p.tags}T / {p.deaths}B
                            </div>
                          </td>

                          <td className="px-3 py-2.5 text-right font-mono-tab">
                            <div
                              className={`font-bold ${
                                p.speed > 31
                                  ? 'text-rose-400'
                                  : p.speed > 18
                                    ? 'text-amber-300'
                                    : 'text-cyan-300'
                              }`}
                            >
                              {p.speed.toFixed(1)} u/s
                            </div>
                            <div className="text-[10px] text-slate-400">
                              Máx {p.peakSpeed.toFixed(1)}
                            </div>
                          </td>

                          <td className="px-3 py-2.5 font-mono-tab text-[11px] text-slate-300 whitespace-nowrap">
                            ({p.velocity.x.toFixed(1)}, {p.velocity.y.toFixed(1)},{' '}
                            {p.velocity.z.toFixed(1)})
                          </td>

                          <td className="px-3 py-2.5 text-right font-mono-tab">
                            <div
                              className={`font-bold ${
                                highAcc ? 'text-amber-300' : 'text-emerald-300'
                              }`}
                            >
                              {p.accuracyPct}%{' '}
                              <span className="text-[10px] font-normal text-slate-400">
                                ({p.shotsHit}/{p.shotsFired})
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400">
                              Crít {p.critPct}%
                            </div>
                          </td>

                          <td className="px-3 py-2.5 text-right font-mono-tab">
                            {p.flagsCount > 0 ? (
                              <div className="inline-flex flex-col items-end">
                                <span className="inline-flex items-center gap-1 rounded border border-rose-500/50 bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-bold text-rose-200">
                                  <AlertTriangle className="h-3 w-3" />
                                  {p.flagsCount}
                                </span>
                                {p.lastFlagType && (
                                  <span className="mt-0.5 text-[9px] text-rose-300">
                                    {EVENT_LABELS[p.lastFlagType]}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-500">0</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right: Server-Side Audit Log */}
          <div className="lg:col-span-5 flex min-h-0 flex-col p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-300">
                <ShieldAlert className="h-4 w-4" />
                <span>Registro de Auditoría ({logs.length})</span>
              </div>

              <div className="flex items-center gap-1.5">
                <Filter className="h-3.5 w-3.5 text-slate-400" />
                <select
                  value={logFilter}
                  onChange={(e) => setLogFilter(e.target.value as 'ALL' | AuditEventType)}
                  className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] font-semibold text-slate-200 focus:border-cyan-400 focus:outline-none cursor-pointer"
                >
                  <option value="ALL">Todos los eventos</option>
                  <option value="ABNORMAL_SPEED">Velocidad Anómala</option>
                  <option value="INSTANT_RESPAWN_HACK">Respawn Hack</option>
                  <option value="ABNORMAL_FIRE_RATE">Cadencia Anómala</option>
                  <option value="SUSPICIOUS_ACCURACY">Precisión Sospechosa</option>
                  <option value="PLAYER_REPORT">Reportes Jugadores</option>
                </select>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto space-y-2 pr-1">
              {logs.length === 0 ? (
                <div className="rounded-lg border border-slate-800 bg-[#070B14] px-4 py-10 text-center text-xs text-slate-400">
                  Sin incidentes registrados todavía. El servidor monitorea velocidad, respawns, cadencia y reportes.
                </div>
              ) : (
                logs.map((entry) => (
                  <div
                    key={entry.id}
                    className={`rounded-lg border p-2.5 text-xs ${
                      entry.severity === 'high'
                        ? 'border-rose-500/45 bg-rose-950/25'
                        : entry.severity === 'medium'
                          ? 'border-amber-500/40 bg-amber-950/20'
                          : 'border-cyan-500/35 bg-[#0C1322]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`rounded px-1.5 py-0.5 font-mono-tab text-[10px] font-bold uppercase ${
                          entry.severity === 'high'
                            ? 'bg-rose-500/25 text-rose-200'
                            : entry.severity === 'medium'
                              ? 'bg-amber-400/20 text-amber-200'
                              : 'bg-cyan-500/20 text-cyan-200'
                        }`}
                      >
                        {EVENT_LABELS[entry.type]}
                      </span>
                      <span className="font-mono-tab text-[10px] text-slate-400">
                        {formatTime(entry.timestamp)} · {entry.roomCode}
                      </span>
                    </div>
                    <div className="mt-1.5 font-semibold text-white">
                      {entry.playerName}
                      {entry.reportedByName && (
                        <span className="ml-1.5 text-[11px] font-normal text-slate-400">
                          (reportado por {entry.reportedByName})
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-300 leading-snug">
                      {entry.details}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
