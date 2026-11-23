import {
  LOBBY_START_PAD,
  getZoneBounds,
  getZoneBoxes,
} from '../shared/arenaData';
import type { ServerStatePayload, ZoneId } from '../shared/types';

interface MiniMapProps {
  state: ServerStatePayload;
  myId: string | null;
}

const MAP_SIZE = 152;
const MAP_PAD = 6;
const INNER_SIZE = MAP_SIZE - MAP_PAD * 2;
const NEARBY_RADIUS_METERS = 22;

export function MiniMap({ state, myId }: MiniMapProps) {
  const me = state.players.find((p) => p.id === myId) ?? null;
  if (!me) return null;

  const zone: ZoneId = me.zone;
  const bounds = getZoneBounds(zone);
  const widthMeters = bounds.maxX - bounds.minX;
  const depthMeters = bounds.maxZ - bounds.minZ;
  const boxes = getZoneBoxes(zone, state.currentMapId);

  const toMapX = (wx: number) =>
    MAP_PAD + ((wx - bounds.minX) / widthMeters) * INNER_SIZE;
  const toMapY = (wz: number) =>
    MAP_PAD + ((wz - bounds.minZ) / depthMeters) * INNER_SIZE;
  const scaleW = (len: number) => (len / widthMeters) * INNER_SIZE;
  const scaleH = (len: number) => (len / depthMeters) * INNER_SIZE;

  const myMapX = toMapX(me.x);
  const myMapY = toMapY(me.z);
  const myRotDeg = (-me.yaw * 180) / Math.PI;
  const nearbyRadiusPx = scaleW(NEARBY_RADIUS_METERS);

  const isDarkArena = Boolean(state.darkHideAndSeek && zone === 'arena');

  const others = state.players.filter((p) => {
    if (p.id === me.id || p.zone !== zone || !p.alive) return false;
    if (isDarkArena) {
      return state.teamMode === 'teams' && me.team !== null && p.team === me.team;
    }
    return true;
  });

  const nearbyCount = others.filter((p) => {
    const dist = Math.hypot(p.x - me.x, p.z - me.z);
    return dist <= NEARBY_RADIUS_METERS;
  }).length;

  const nearbyHumanCount = others.filter((p) => {
    if (p.isBot) return false;
    const dist = Math.hypot(p.x - me.x, p.z - me.z);
    return dist <= NEARBY_RADIUS_METERS;
  }).length;

  return (
    <div className="pointer-events-none rounded-xl border border-slate-700/80 bg-[#0B101B]/92 p-2.5 shadow-lg">
      <div className="mb-1.5 flex items-center justify-between gap-3 text-[11px]">
        <span className="font-display font-bold text-slate-100">
          {zone === 'lobby'
            ? 'Radar · Lobby Ext.'
            : isDarkArena
              ? 'Radar · Oscuridad'
              : 'Radar · Arena'}
        </span>
        <span className="font-mono-tab text-cyan-300">
          {isDarkArena
            ? 'Escondite'
            : nearbyHumanCount > 0
              ? `${nearbyHumanCount} cerca`
              : `${nearbyCount} en zona`}
        </span>
      </div>

      <svg
        width={MAP_SIZE}
        height={MAP_SIZE}
        viewBox={`0 0 ${MAP_SIZE} ${MAP_SIZE}`}
        className="block rounded-lg border border-slate-800 bg-[#070B13]"
        aria-label="Minimapa en tiempo real"
      >
        <line
          x1={MAP_SIZE / 2}
          y1={MAP_PAD}
          x2={MAP_SIZE / 2}
          y2={MAP_SIZE - MAP_PAD}
          stroke="rgba(148,163,184,0.12)"
          strokeWidth="1"
        />
        <line
          x1={MAP_PAD}
          y1={MAP_SIZE / 2}
          x2={MAP_SIZE - MAP_PAD}
          y2={MAP_SIZE / 2}
          stroke="rgba(148,163,184,0.12)"
          strokeWidth="1"
        />

        {/* Structural Boxes (skip l_deck_base full floor slab so platforms/obby stand out) */}
        {boxes.map((box) => {
          if (box.id === 'l_deck_base') return null;
          const x = toMapX(box.minX);
          const y = toMapY(box.minZ);
          const w = scaleW(box.maxX - box.minX);
          const h = scaleH(box.maxZ - box.minZ);
          const fill =
            box.kind === 'obby'
              ? 'rgba(6, 182, 212, 0.28)'
              : box.kind === 'platform'
                ? 'rgba(30, 41, 59, 0.85)'
                : box.kind === 'beacon'
                  ? 'rgba(245, 158, 11, 0.4)'
                  : box.kind === 'wall'
                    ? 'rgba(51, 65, 85, 0.9)'
                    : 'rgba(71, 85, 105, 0.72)';
          return (
            <rect
              key={box.id}
              x={x}
              y={y}
              width={Math.max(1.5, w)}
              height={Math.max(1.5, h)}
              fill={fill}
              stroke={box.accent ? box.accent : 'rgba(148,163,184,0.2)'}
              strokeOpacity={box.accent ? 0.55 : 0.35}
              strokeWidth={box.kind === 'wall' ? 0.6 : 0.75}
            />
          );
        })}

        {zone === 'lobby' && (
          <circle
            cx={toMapX(LOBBY_START_PAD.x)}
            cy={toMapY(LOBBY_START_PAD.z)}
            r={scaleW(LOBBY_START_PAD.radius)}
            fill="rgba(16, 185, 129, 0.2)"
            stroke="#10B981"
            strokeWidth="1.2"
          />
        )}

        {zone === 'arena' &&
          state.boostPads.map((pad) =>
            pad.active ? (
              <circle
                key={pad.id}
                cx={toMapX(pad.x)}
                cy={toMapY(pad.z)}
                r={2.4}
                fill={pad.kind === 'overcharge' ? '#F59E0B' : '#10B981'}
                opacity={0.85}
              />
            ) : null,
          )}

        <circle
          cx={myMapX}
          cy={myMapY}
          r={nearbyRadiusPx}
          fill="rgba(6, 182, 212, 0.06)"
          stroke="rgba(6, 182, 212, 0.32)"
          strokeDasharray="3 3"
          strokeWidth="1"
        />

        {others.map((p) => {
          const px = toMapX(p.x);
          const py = toMapY(p.z);
          const dist = Math.hypot(p.x - me.x, p.z - me.z);
          const isNearby = dist <= NEARBY_RADIUS_METERS;

          if (p.isBot) {
            return (
              <g key={p.id} transform={`translate(${px}, ${py})`}>
                <polygon
                  points="0,-3.5 3.5,0 0,3.5 -3.5,0"
                  fill={p.accentColor}
                  stroke="#080C14"
                  strokeWidth="1"
                  opacity={isNearby ? 0.95 : 0.65}
                />
              </g>
            );
          }

          return (
            <g key={p.id} transform={`translate(${px}, ${py})`}>
              {isNearby && (
                <circle
                  r={6.2}
                  fill="none"
                  stroke={p.accentColor}
                  strokeOpacity={0.5}
                  strokeWidth="1"
                />
              )}
              <circle
                r={3.8}
                fill={p.accentColor}
                stroke="#F8FAFC"
                strokeWidth="1.1"
              />
              {isNearby && (
                <text
                  x={0}
                  y={-6.5}
                  textAnchor="middle"
                  fill="#E2E8F0"
                  fontSize="7"
                  fontWeight="600"
                  fontFamily="'Plus Jakarta Sans', sans-serif"
                >
                  {p.name.slice(0, 8)}
                </text>
              )}
            </g>
          );
        })}

        {me.alive && (
          <g transform={`translate(${myMapX}, ${myMapY}) rotate(${myRotDeg})`}>
            <polygon
              points="0,0 -11,-22 11,-22"
              fill="rgba(6, 182, 212, 0.22)"
            />
            <polygon
              points="0,-6.5 4.8,4.5 0,2 -4.8,4.5"
              fill="#FFFFFF"
              stroke="#06B6D4"
              strokeWidth="1.2"
            />
          </g>
        )}
      </svg>

      <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-400">
        <span className="font-mono-tab">
          X:{Math.round(me.x)} Z:{Math.round(me.z)}
        </span>
        <span>
          {others.some((p) => !p.isBot) ? '● Jugador' : ''}
          {state.botsEnabled && zone === 'arena' ? ' ◆ Dron' : ''}
        </span>
      </div>
    </div>
  );
}
