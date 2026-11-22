export interface ChatModerationResult {
  allowed: boolean;
  cleanText: string;
  reason?: string;
}

// Single-word insults / slurs across Spanish, English, Portuguese, French, German, Italian,
// Russian/Romanized, Turkish, Polish, Dutch, etc. (matched on normalized word tokens, never naive substrings inside clean words like "computadora")
const EXACT_PROFANE_WORDS = new Set<string>([
  // Spanish
  'puta', 'puto', 'putas', 'putos', 'putita', 'putito', 'putona', 'puton',
  'mierda', 'mierdas', 'pendejo', 'pendeja', 'pendejos', 'pendejas', 'pendejada',
  'cabron', 'cabrona', 'cabrones', 'cabronas', 'chinga', 'chingar', 'chingada', 'chingado',
  'chingatumadre', 'verga', 'vergas', 'vergazo', 'culero', 'culera', 'culeros',
  'maricon', 'marica', 'maricas', 'maricones', 'joto', 'jotos', 'puñal', 'punal',
  'imbecil', 'imbeciles', 'idiota', 'idiotas', 'estupido', 'estupida', 'estupidos',
  'zorra', 'zorras', 'perra', 'perras', 'gilipollas', 'capullo', 'joder', 'cono',
  'mamaguevo', 'mamahuevo', 'gonorrea', 'malparido', 'malparida', 'hijueputa', 'hijoputa',
  'hdp', 'ctm', 'ptm', 'conchatumadre', 'conchetumare', 'boludo', 'boluda', 'pelotudo',
  'pelotuda', 'culiao', 'culiada', 'weon', 'huevon', 'huevonazo', 'carajo', 'pinche',
  'ojete', 'culo', 'mamon', 'mamona', 'soplapollas', 'subnormal', 'retrasado', 'bastardo',
  'bastarda', 'tarado', 'tarada', 'pajero', 'pajera', 'chupapollas', 'chupamela', 'follar',

  // English
  'fuck', 'fucker', 'fucking', 'fucked', 'fucks', 'motherfucker', 'mf', 'mofo',
  'shit', 'shitty', 'bullshit', 'bitch', 'bitches', 'bitching', 'asshole', 'assholes',
  'bastard', 'bastards', 'cunt', 'cunts', 'dick', 'dicks', 'dickhead', 'cock', 'cocks',
  'cocksucker', 'whore', 'whores', 'slut', 'sluts', 'faggot', 'fag', 'fags', 'dyke',
  'nigger', 'niggers', 'nigga', 'niggas', 'retard', 'retarded', 'retards', 'wanker',
  'tosser', 'twat', 'prick', 'douchebag', 'jackass', 'dumbass', 'dipshit', 'stfu', 'kys',

  // Portuguese
  'porra', 'caralho', 'buceta', 'boceta', 'viado', 'veado', 'arrombado', 'arrombada',
  'desgracado', 'desgracada', 'fdp', 'foda', 'fodase', 'foder', 'merda', 'otario',
  'otaria', 'corno', 'corna', 'piranha', 'vadia', 'babaca', 'cuzão', 'cuzao', 'bosta',

  // French
  'putain', 'merde', 'salope', 'salopard', 'encule', 'enculer', 'connard', 'connasse',
  'conne', 'batard', 'nique', 'ntm', 'fdp', 'pute', 'couille', 'bordel', 'branleur',

  // German
  'scheisse', 'scheiss', 'fick', 'ficken', 'arschloch', 'hurensohn', 'hure', 'fotze',
  'wichser', 'schlampe', 'missgeburt', 'spast', 'schwuchtel', 'drecksau',

  // Italian
  'cazzo', 'vaffanculo', 'stronzo', 'stronza', 'troia', 'puttana', 'coglione',
  'coglioni', 'merda', 'figa', 'minchia', 'bastardo', 'pezzo', 'frocio',

  // Russian / Slavic (Romanized + Cyrillic)
  'blyat', 'blyad', 'suka', 'cyka', 'pizda', 'pizdec', 'khuy', 'hui', 'ebat', 'yebat',
  'pidor', 'pidoras', 'mudak', 'gandon', 'kurwa', 'kurva', 'chuj', 'jebac', 'pierdol',
  'блядь', 'блять', 'сука', 'хуй', 'пизда', 'ебать', 'пидор', 'мудак', 'гандон',

  // Turkish / Dutch / Other
  'orospu', 'sikim', 'siktir', 'amk', 'piç', 'yarak', 'klootzak', 'kanker', 'hoer', 'lul',
]);

// Multi-word phrases & non-Latin/CJK/Arabic insult patterns
const PHRASE_PATTERNS: RegExp[] = [
  /\b(?:hijo|hija)\s+de\s+(?:puta|perra|mil\s+putas)\b/i,
  /\bchinga\s+tu\s+madre\b/i,
  /\bchupa\s+(?:la|me\s+la|pija|verga|polla)\b/i,
  /\bvete\s+a\s+la\s+(?:mierda|verga)\b/i,
  /\bfuck\s+(?:you|off|this|u)\b/i,
  /\bsuck\s+(?:my|a)\s+(?:dick|cock)\b/i,
  /\bkill\s+yourself\b/i,
  /\bfilho\s+da\s+puta\b/i,
  /\bvai\s+tomar\s+no\s+cu\b/i,
  /\bta\s+mere\s+la\s+pute\b/i,
  /\bnike\s+ta\s+mere\b/i,
  /\bfick\s+dich\b/i,
  /\bva\s+a\s+fanculo\b/i,
  // Arabic insults
  /(?:كس\s*امك|شرموطة|شرموطه|قحبة|ابن\s*الكلب|يلعن|منيوك)/u,
  // Chinese insults
  /(?:他妈的|操你妈|傻逼|草泥马|滚蛋|去死|妈逼)/u,
  // Japanese insults
  /(?:くそったれ|死ね|ばかやろう|きさま|ちくしょう|ファック)/u,
  // Korean insults
  /(?:씨발|시발|개새끼|병신|존나|미친놈|좆같)/u,
];

function normalizeLeetToken(token: string): string {
  return token
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[@4]/g, 'a')
    .replace(/3/g, 'e')
    .replace(/[1!|]/g, 'i')
    .replace(/0/g, 'o')
    .replace(/[$5]/g, 's')
    .replace(/7/g, 't')
    .replace(/[^a-zа-яё\u0600-\u06ff\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/giu, '');
}

function collapseRepeatedLetters(word: string): string {
  return word.replace(/(.)\1{1,}/gu, '$1');
}

export function containsProfanity(rawText: string): boolean {
  const trimmed = rawText.trim();
  if (!trimmed) return false;

  // 1. Check multi-word phrases and non-Latin regexes on cleaned spacing
  const collapsedSpaces = trimmed.replace(/\s+/g, ' ');
  for (const rx of PHRASE_PATTERNS) {
    if (rx.test(collapsedSpaces)) return true;
  }

  // 2. Check spaced-out single-letter obfuscation like "p u t a" or "f u c k"
  const spacedTokens = collapsedSpaces.split(' ');
  let singleCharRun = '';
  for (const part of spacedTokens) {
    const cleanPart = normalizeLeetToken(part);
    if (cleanPart.length === 1) {
      singleCharRun += cleanPart;
      if (EXACT_PROFANE_WORDS.has(singleCharRun)) return true;
    } else {
      if (singleCharRun.length >= 3 && EXACT_PROFANE_WORDS.has(singleCharRun)) return true;
      singleCharRun = '';
    }
  }
  if (singleCharRun.length >= 3 && EXACT_PROFANE_WORDS.has(singleCharRun)) return true;

  // 3. Check each whitespace-separated word (preserving punctuation-stripped obfuscations like p.u.t.a or f*ck)
  for (const rawWord of spacedTokens) {
    const normalized = normalizeLeetToken(rawWord);
    if (!normalized) continue;
    if (EXACT_PROFANE_WORDS.has(normalized)) return true;
    const deduplicated = collapseRepeatedLetters(normalized);
    if (EXACT_PROFANE_WORDS.has(deduplicated)) return true;
  }

  return false;
}

export function validateChatMessage(rawText: string): ChatModerationResult {
  const cleanText = rawText.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 140);
  if (!cleanText) {
    return { allowed: false, cleanText: '', reason: 'Escribe un mensaje.' };
  }
  if (containsProfanity(cleanText)) {
    return {
      allowed: false,
      cleanText: '',
      reason: 'Mensaje bloqueado: no se permiten insultos ni lenguaje ofensivo en ningún idioma.',
    };
  }
  return { allowed: true, cleanText };
}
