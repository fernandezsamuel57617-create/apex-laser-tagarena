import { Check, Coins, Flame, Target, X } from 'lucide-react';
import {
  DAILY_MISSIONS,
  getMissionCurrentValue,
  isMissionCompleted,
  type DailyMissionId,
  type DailyMissionsProgress,
} from '../shared/dailyMissions';

interface DailyMissionsModalProps {
  open: boolean;
  onClose: () => void;
  progress: DailyMissionsProgress;
  coins: number;
  infiniteCoins?: boolean;
  onClaimReward: (missionId: DailyMissionId) => void;
}

export function DailyMissionsModal({
  open,
  onClose,
  progress,
  coins,
  infiniteCoins = false,
  onClaimReward,
}: DailyMissionsModalProps) {
  if (!open) return null;

  const completedCount = DAILY_MISSIONS.filter((m) => isMissionCompleted(m, progress)).length;

  return (
    <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-[#060911]/88 p-3 sm:p-4">
      <div className="w-full max-w-2xl max-h-[92dvh] overflow-y-auto rounded-2xl border border-slate-700 bg-[#0B111E] p-4 sm:p-6 shadow-2xl">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl border border-amber-400/40 bg-amber-500/15 text-amber-300 shrink-0">
              <Target className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-[11px] sm:text-xs font-bold uppercase tracking-wider text-amber-300">
                <Flame className="h-3.5 w-3.5" />
                <span>Misiones Diarias · {progress.dateKey}</span>
              </div>
              <h2 className="font-display text-lg sm:text-2xl font-bold text-white">
                Objetivos del Día ({completedCount}/{DAILY_MISSIONS.length})
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2.5 ml-auto">
            <div className="flex items-center gap-1.5 rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-sm font-bold text-amber-300">
              <Coins className="h-4 w-4 text-amber-400" />
              <span className="font-mono-tab">{infiniteCoins ? '∞' : coins}</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar misiones"
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500 hover:text-white cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {DAILY_MISSIONS.map((mission) => {
            const current = getMissionCurrentValue(mission, progress);
            const completed = isMissionCompleted(mission, progress);
            const claimed = progress.claimedIds.includes(mission.id);
            const pct = Math.min(100, Math.round((current / mission.target) * 100));

            return (
              <div
                key={mission.id}
                className={`rounded-xl border p-4 transition-colors ${
                  claimed
                    ? 'border-emerald-500/35 bg-emerald-950/20'
                    : completed
                      ? 'border-amber-400/60 bg-amber-500/10'
                      : 'border-slate-800 bg-slate-900/70'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-display text-base font-bold text-white">
                        {mission.title}
                      </h3>
                      <span className="rounded border border-amber-400/40 bg-amber-400/15 px-2 py-0.5 font-mono-tab text-[11px] font-bold text-amber-300">
                        +{mission.rewardCoins} monedas
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-300">{mission.description}</p>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-mono-tab text-sm font-bold text-cyan-300">
                      {current} / {mission.target}
                    </span>

                    {claimed ? (
                      <span className="flex items-center gap-1 rounded-lg border border-emerald-500/50 bg-emerald-500/15 px-3 py-2 text-xs font-bold text-emerald-300">
                        <Check className="h-3.5 w-3.5" />
                        <span>Reclamada</span>
                      </span>
                    ) : completed ? (
                      <button
                        type="button"
                        onClick={() => onClaimReward(mission.id)}
                        className="flex min-h-[40px] items-center gap-1.5 rounded-lg bg-amber-400 px-3.5 py-2 font-display text-xs font-bold text-slate-950 hover:bg-amber-300 transition-colors cursor-pointer"
                      >
                        <Coins className="h-3.5 w-3.5" />
                        <span>Reclamar +{mission.rewardCoins}</span>
                      </button>
                    ) : (
                      <span className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-400">
                        En progreso
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-800">
                  <div
                    className={`h-full transition-all duration-300 ${
                      claimed ? 'bg-emerald-400' : completed ? 'bg-amber-400' : 'bg-cyan-400'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-4 text-xs text-slate-400">
          <span>El progreso se reinicia automáticamente cada día y se guarda en tu perfil.</span>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:border-slate-500 cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
