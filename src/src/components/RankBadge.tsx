import { getRankByWins, type RankTierId } from '../shared/ranks';

interface RankBadgeProps {
  rankedWins: number;
  showLabel?: boolean;
  size?: 'xs' | 'sm' | 'md';
}

export function RankEmblemSvg({ tierId, size = 16 }: { tierId: RankTierId; size?: number }) {
  if (tierId === 'bronze') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M12 2.5L20 6.5V13C20 17.5 16.5 20.6 12 22C7.5 20.6 4 17.5 4 13V6.5L12 2.5Z"
          fill="#78350F"
          stroke="#D97706"
          strokeWidth="1.8"
        />
        <path d="M12 6.5L15.5 12L12 17.5L8.5 12L12 6.5Z" fill="#F59E0B" />
      </svg>
    );
  }
  if (tierId === 'silver') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M12 2L20.5 6.5V13.2C20.5 17.7 16.8 20.8 12 22.2C7.2 20.8 3.5 17.7 3.5 13.2V6.5L12 2Z"
          fill="#334155"
          stroke="#E2E8F0"
          strokeWidth="1.8"
        />
        <path d="M12 5.5L16.5 10.5L12 18L7.5 10.5L12 5.5Z" fill="#CBD5E1" />
        <path d="M12 7.5L14.2 10.5L12 14.5L9.8 10.5L12 7.5Z" fill="#F8FAFC" />
      </svg>
    );
  }
  if (tierId === 'gold') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M12 2L21 6.5V13.5C21 18 17 21 12 22.4C7 21 3 18 3 13.5V6.5L12 2Z"
          fill="#713F12"
          stroke="#FACC15"
          strokeWidth="1.8"
        />
        <path
          d="M12 5.2L14 9.5L18.5 10L15 13L16 17.5L12 15.2L8 17.5L9 13L5.5 10L10 9.5L12 5.2Z"
          fill="#FDE047"
        />
      </svg>
    );
  }
  if (tierId === 'diamond') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M12 2L21 9.5L12 22L3 9.5L12 2Z"
          fill="#0C4A6E"
          stroke="#38BDF8"
          strokeWidth="1.8"
        />
        <path d="M12 4.5L18 9.5L12 18.8L6 9.5L12 4.5Z" fill="#38BDF8" />
        <path d="M12 6.5L15 9.5L12 15L9 9.5L12 6.5Z" fill="#E0F2FE" />
      </svg>
    );
  }
  // master
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 8.5L7.5 11.5L12 4L16.5 11.5L21 8.5L19 18.5H5L3 8.5Z"
        fill="#581C87"
        stroke="#C084FC"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="13.5" r="2.6" fill="#F43F5E" stroke="#FDE047" strokeWidth="1.1" />
      <path d="M6 20.5H18" stroke="#FACC15" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function RankBadge({ rankedWins, showLabel = false, size = 'sm' }: RankBadgeProps) {
  const rank = getRankByWins(rankedWins);
  const iconPx = size === 'xs' ? 14 : size === 'md' ? 20 : 16;

  if (!showLabel) {
    return (
      <span
        title={`Rango ${rank.name} (${rankedWins} victorias clasificatorias)`}
        className="inline-flex items-center justify-center shrink-0"
      >
        <RankEmblemSvg tierId={rank.id} size={iconPx} />
      </span>
    );
  }

  return (
    <span
      title={`${rank.name} · ${rankedWins} victorias en Modo Rangos`}
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-display font-bold whitespace-nowrap shrink-0 ${rank.badgeClass} ${
        size === 'xs' ? 'text-[10px]' : size === 'md' ? 'text-xs' : 'text-[11px]'
      }`}
    >
      <RankEmblemSvg tierId={rank.id} size={iconPx - 2} />
      <span>{rank.name}</span>
    </span>
  );
}
