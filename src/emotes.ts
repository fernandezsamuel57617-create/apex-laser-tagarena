export type EmoteId = 'wave' | 'laugh' | 'celebrate' | 'gg' | 'heart' | 'taunt';

export interface EmoteDefinition {
  id: EmoteId;
  label: string;
  emoji: string;
  color: string;
  shortcut: string;
  chatCmd: string;
}

export const EMOTES: EmoteDefinition[] = [
  { id: 'wave', label: 'Saludar', emoji: '👋', color: '#06B6D4', shortcut: '1', chatCmd: '/wave' },
  { id: 'laugh', label: 'Reír', emoji: '😂', color: '#F59E0B', shortcut: '2', chatCmd: '/laugh' },
  { id: 'celebrate', label: 'Celebrar', emoji: '🎉', color: '#10B981', shortcut: '3', chatCmd: '/celebrate' },
  { id: 'gg', label: 'GG', emoji: '🔥', color: '#F43F5E', shortcut: '4', chatCmd: '/gg' },
  { id: 'heart', label: 'Corazón', emoji: '❤️', color: '#EC4899', shortcut: '5', chatCmd: '/heart' },
  { id: 'taunt', label: 'Desafío', emoji: '⚡', color: '#38BDF8', shortcut: '6', chatCmd: '/taunt' },
];

export const VALID_EMOTE_IDS = new Set<EmoteId>(EMOTES.map((e) => e.id));

export function isValidEmoteId(val: unknown): val is EmoteId {
  return typeof val === 'string' && VALID_EMOTE_IDS.has(val as EmoteId);
}

export function getEmoteById(id: EmoteId): EmoteDefinition {
  return EMOTES.find((e) => e.id === id) ?? EMOTES[0];
}
