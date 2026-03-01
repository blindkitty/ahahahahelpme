// =============================================
// cards.ts — Определения колод ONO 99 и UNO Flip
// =============================================

// === ТИПЫ ДЛЯ ONO 99 ===
export type OnoCardType = 'number' | 'reverse' | 'skip' | 'double';

export interface OnoCard {
  id: string;
  type: OnoCardType;
  value: number; // для number карт: 0-10, для спецкарт: -1
  label: string;
}

// === ТИПЫ ДЛЯ UNO FLIP ===
export type UnoColor = 'red' | 'blue' | 'green' | 'yellow' | 'pink' | 'teal' | 'orange' | 'purple' | 'wild';
export type UnoSide = 'light' | 'dark';
export type UnoCardType = 'number' | 'draw_one' | 'draw_five' | 'reverse' | 'skip' | 'skip_everyone' | 'flip' | 'wild' | 'wild_draw_two' | 'wild_draw_color';

export interface UnoCard {
  id: string;
  lightSide: {
    color: UnoColor;
    type: UnoCardType;
    value: number; // 0-9 для number, -1 для спец
    label: string;
  };
  darkSide: {
    color: UnoColor;
    type: UnoCardType;
    value: number;
    label: string;
  };
  chosenColor?: UnoColor; // для wild карт — выбранный цвет
}

// Получить текущую сторону карты UNO
export function getActiveSide(card: UnoCard, side: UnoSide) {
  return side === 'light' ? card.lightSide : card.darkSide;
}

// Цвета Light side
const LIGHT_COLORS: UnoColor[] = ['red', 'blue', 'green', 'yellow'];
// Цвета Dark side
const DARK_COLORS: UnoColor[] = ['pink', 'teal', 'orange', 'purple'];

// Маппинг light → dark цвет (парные)
export const COLOR_PAIRS: Record<string, UnoColor> = {
  'red': 'pink',
  'blue': 'teal',
  'green': 'orange',
  'yellow': 'purple',
  'pink': 'red',
  'teal': 'blue',
  'orange': 'green',
  'purple': 'yellow',
};

let cardIdCounter = 0;
function nextId(prefix: string): string {
  return `${prefix}_${cardIdCounter++}`;
}

// === ГЕНЕРАЦИЯ КОЛОДЫ ONO 99 ===
export function createOnoDeck(): OnoCard[] {
  cardIdCounter = 0;
  const deck: OnoCard[] = [];

  // Числовые карты 0-9: по 4 копии каждой
  for (let v = 0; v <= 9; v++) {
    for (let i = 0; i < 4; i++) {
      deck.push({ id: nextId('ono'), type: 'number', value: v, label: `${v}` });
    }
  }

  // Карта 10 (вычитает 10): 4 копии
  for (let i = 0; i < 4; i++) {
    deck.push({ id: nextId('ono'), type: 'number', value: -10, label: '-10' });
  }

  // Reverse: 4 копии
  for (let i = 0; i < 4; i++) {
    deck.push({ id: nextId('ono'), type: 'reverse', value: -1, label: '⇄' });
  }

  // Skip: 4 копии
  for (let i = 0; i < 4; i++) {
    deck.push({ id: nextId('ono'), type: 'skip', value: -1, label: '⊘' });
  }

  // Double: 4 копии
  for (let i = 0; i < 4; i++) {
    deck.push({ id: nextId('ono'), type: 'double', value: -1, label: '×2' });
  }

  return deck;
}

// === ГЕНЕРАЦИЯ КОЛОДЫ UNO FLIP ===
export function createUnoFlipDeck(): UnoCard[] {
  cardIdCounter = 0;
  const deck: UnoCard[] = [];

  // Для каждого цвета: числа 1-9 по 2 копии + один 0
  for (let ci = 0; ci < 4; ci++) {
    const lc = LIGHT_COLORS[ci];
    const dc = DARK_COLORS[ci];

    // Одна карта 0
    deck.push({
      id: nextId('uno'),
      lightSide: { color: lc, type: 'number', value: 0, label: '0' },
      darkSide: { color: dc, type: 'number', value: 0, label: '0' },
    });

    // Числа 1-9 по 2 копии
    for (let v = 1; v <= 9; v++) {
      for (let i = 0; i < 2; i++) {
        deck.push({
          id: nextId('uno'),
          lightSide: { color: lc, type: 'number', value: v, label: `${v}` },
          darkSide: { color: dc, type: 'number', value: v, label: `${v}` },
        });
      }
    }

    // Light спецкарты: Draw One, Reverse, Skip, Flip — по 2 каждой
    for (let i = 0; i < 2; i++) {
      deck.push({
        id: nextId('uno'),
        lightSide: { color: lc, type: 'draw_one', value: -1, label: '+1' },
        darkSide: { color: dc, type: 'draw_five', value: -1, label: '+5' },
      });
    }
    for (let i = 0; i < 2; i++) {
      deck.push({
        id: nextId('uno'),
        lightSide: { color: lc, type: 'reverse', value: -1, label: '⇄' },
        darkSide: { color: dc, type: 'reverse', value: -1, label: '⇄' },
      });
    }
    for (let i = 0; i < 2; i++) {
      deck.push({
        id: nextId('uno'),
        lightSide: { color: lc, type: 'skip', value: -1, label: '⊘' },
        darkSide: { color: dc, type: 'skip_everyone', value: -1, label: '⊘ALL' },
      });
    }
    for (let i = 0; i < 2; i++) {
      deck.push({
        id: nextId('uno'),
        lightSide: { color: lc, type: 'flip', value: -1, label: 'FLIP' },
        darkSide: { color: dc, type: 'flip', value: -1, label: 'FLIP' },
      });
    }
  }

  // Wild карты (по 4)
  for (let i = 0; i < 4; i++) {
    deck.push({
      id: nextId('uno'),
      lightSide: { color: 'wild', type: 'wild', value: -1, label: 'W' },
      darkSide: { color: 'wild', type: 'wild', value: -1, label: 'W' },
    });
  }

  // Wild Draw Two (light) / Wild Draw Color (dark) — по 4
  for (let i = 0; i < 4; i++) {
    deck.push({
      id: nextId('uno'),
      lightSide: { color: 'wild', type: 'wild_draw_two', value: -1, label: 'W+2' },
      darkSide: { color: 'wild', type: 'wild_draw_color', value: -1, label: 'W+C' },
    });
  }

  return deck;
}

// Перемешать массив (Fisher-Yates)
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Цвета для отображения
export const COLOR_MAP: Record<string, string> = {
  red: '#EF4444',
  blue: '#3B82F6',
  green: '#22C55E',
  yellow: '#EAB308',
  pink: '#EC4899',
  teal: '#14B8A6',
  orange: '#F97316',
  purple: '#A855F7',
  wild: '#666',
};

export const COLOR_BG_MAP: Record<string, string> = {
  red: 'bg-red-500',
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  yellow: 'bg-yellow-400',
  pink: 'bg-pink-500',
  teal: 'bg-teal-500',
  orange: 'bg-orange-500',
  purple: 'bg-purple-500',
  wild: 'bg-gray-600',
};
