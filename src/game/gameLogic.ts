// =============================================
// gameLogic.ts — Логика игры Double UNO
// =============================================

import {
  OnoCard, UnoCard, UnoColor, UnoSide,
  createOnoDeck, createUnoFlipDeck, shuffle, getActiveSide,
} from './cards';

// === ТИПЫ СОСТОЯНИЯ ИГРЫ ===
export interface Player {
  id: string;
  name: string;
  lives: number; // жизни для ONO 99
  onoHand: OnoCard[];
  unoHand: UnoCard[];
  saidUno: boolean;
  isAlive: boolean; // жив ли в ONO 99
}

export type GamePhase = 'ono' | 'uno' | 'waiting' | 'ono_double'; // ono_double — нужно сыграть 2 карты

export interface OnoState {
  counter: number;
  currentPlayerIndex: number;
  direction: 1 | -1; // 1 = по часовой, -1 = против
  deck: OnoCard[];
  discardPile: OnoCard[];
  doublesRemaining: number; // сколько ещё карт нужно сыграть (для Double)
}

export interface UnoState {
  currentPlayerIndex: number;
  direction: 1 | -1;
  side: UnoSide;
  deck: UnoCard[];
  discardPile: UnoCard[];
  topCard: UnoCard | null;
  mustDraw: number; // сколько карт нужно взять
  drawPending: boolean; // ожидается ли взятие карт
}

export interface GameState {
  players: Player[];
  phase: GamePhase;
  onoState: OnoState;
  unoState: UnoState;
  turnOrder: string[]; // порядок по кругу (id игроков)
  winner: string | null; // общий победитель (когда оба режима завершены)
  onoWinner: string | null; // победитель в ONO 99
  unoWinner: string | null; // победитель в UNO Flip
  message: string; // сообщение для UI
  onoRoundOver: boolean;
  waitingForColorChoice: boolean;
  gameOver: boolean;
  turnStartTime: number; // Время начала текущего хода (timestamp)
  hostId: string; // ID хоста (админа)
}

// Количество начальных жизней
const INITIAL_LIVES = 3;
// Карт ONO на руке
const ONO_HAND_SIZE = 4;
// Карт UNO на руке
const UNO_HAND_SIZE = 7;

// === ИНИЦИАЛИЗАЦИЯ ИГРЫ ===
// playerIds — реальные ID из Firebase, playerNames — имена
export function initializeGame(playerIds: string[], playerNames: string[]): GameState {
  const players: Player[] = playerIds.map((id, i) => ({
    id,
    name: playerNames[i] || `Игрок ${i + 1}`,
    lives: INITIAL_LIVES,
    onoHand: [],
    unoHand: [],
    saidUno: false,
    isAlive: true,
  }));

  const turnOrder = players.map(p => p.id);

  // Создать и перемешать колоды
  let onoDeck = shuffle(createOnoDeck());
  let unoFlipDeck = shuffle(createUnoFlipDeck());

  // Раздать карты ONO 99
  for (const player of players) {
    player.onoHand = onoDeck.splice(0, ONO_HAND_SIZE);
  }

  // Раздать карты UNO Flip
  for (const player of players) {
    player.unoHand = unoFlipDeck.splice(0, UNO_HAND_SIZE);
  }

  // Положить первую карту в UNO Flip (не wild и не спец)
  let firstUnoCard: UnoCard | null = null;
  for (let i = 0; i < unoFlipDeck.length; i++) {
    const side = unoFlipDeck[i].lightSide;
    if (side.type === 'number' && side.color !== 'wild') {
      firstUnoCard = unoFlipDeck.splice(i, 1)[0];
      break;
    }
  }
  if (!firstUnoCard) {
    firstUnoCard = unoFlipDeck.shift()!;
  }

  const state: GameState = {
    players,
    phase: 'ono',
    onoState: {
      counter: 0,
      currentPlayerIndex: 0,
      direction: 1,
      deck: onoDeck,
      discardPile: [],
      doublesRemaining: 0,
    },
    unoState: {
      currentPlayerIndex: 0,
      direction: 1,
      side: 'light',
      deck: unoFlipDeck,
      discardPile: [firstUnoCard],
      topCard: firstUnoCard,
      mustDraw: 0,
      drawPending: false,
    },
    turnOrder,
    winner: null,
    onoWinner: null,
    unoWinner: null,
    message: `Ход ONO 99: ${players[0].name}`,
    onoRoundOver: false,
    waitingForColorChoice: false,
    gameOver: false,
    turnStartTime: Date.now(),
    hostId: players[0].id,
  };

  return state;
}

// === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===

// Получить следующего живого игрока в ONO 99
function getNextOnoPlayer(state: GameState, fromIndex: number, skip: number = 1): number {
  const n = state.players.length;
  let idx = fromIndex;
  let skipped = 0;
  while (skipped < skip) {
    idx = ((idx + state.onoState.direction) % n + n) % n;
    if (state.players[idx].isAlive) {
      skipped++;
    }
  }
  return idx;
}

// Получить следующего игрока в UNO Flip
function getNextUnoPlayer(state: GameState, fromIndex: number, skip: number = 1): number {
  const n = state.players.length;
  let idx = fromIndex;
  let skipped = 0;
  while (skipped < skip) {
    idx = ((idx + state.unoState.direction) % n + n) % n;
    skipped++;
  }
  return idx;
}

// Добрать карту ONO из колоды
function drawOnoCard(state: GameState): OnoCard | null {
  if (state.onoState.deck.length === 0) {
    if (state.onoState.discardPile.length === 0) return null;
    state.onoState.deck = shuffle(state.onoState.discardPile);
    state.onoState.discardPile = [];
  }
  return state.onoState.deck.pop() || null;
}

// Добрать карту UNO из колоды
function drawUnoCard(state: GameState): UnoCard | null {
  if (state.unoState.deck.length === 0) {
    if (state.unoState.discardPile.length <= 1) return null;
    const top = state.unoState.discardPile.pop()!;
    state.unoState.deck = shuffle(state.unoState.discardPile);
    state.unoState.discardPile = [top];
  }
  return state.unoState.deck.pop() || null;
}

// === ВАЛИДАЦИЯ ХОДА ONO 99 ===
export function canPlayOnoCard(card: OnoCard, counter: number): boolean {
  if (card.type === 'reverse' || card.type === 'skip' || card.type === 'double') {
    return true;
  }
  if (card.value === -10) return true;
  if (card.value === 0) return true;
  return counter + card.value <= 99;
}

export function hasPlayableOnoCard(player: Player, counter: number): boolean {
  return player.onoHand.some(c => canPlayOnoCard(c, counter));
}

// === СЫГРАТЬ КАРТУ ONO 99 ===
export function playOnoCard(state: GameState, playerId: string, cardId: string): GameState {
  const newState = deepClone(state);
  const playerIdx = newState.players.findIndex(p => p.id === playerId);
  const player = newState.players[playerIdx];

  if (newState.phase !== 'ono' && newState.phase !== 'ono_double') {
    newState.message = 'Сейчас не фаза ONO 99!';
    return newState;
  }
  if (playerIdx !== newState.onoState.currentPlayerIndex) {
    newState.message = 'Сейчас не ваш ход в ONO 99!';
    return newState;
  }

  const cardIdx = player.onoHand.findIndex(c => c.id === cardId);
  if (cardIdx === -1) {
    newState.message = 'Карта не найдена!';
    return newState;
  }

  const card = player.onoHand[cardIdx];

  if (!canPlayOnoCard(card, newState.onoState.counter)) {
    newState.message = 'Нельзя сыграть эту карту — счётчик превысит 99!';
    return newState;
  }

  // Убрать карту из руки
  player.onoHand.splice(cardIdx, 1);
  newState.onoState.discardPile.push(card);

  // Применить эффект
  let busted = false;
  switch (card.type) {
    case 'number':
      newState.onoState.counter += card.value;
      if (newState.onoState.counter > 99) {
        busted = true;
      }
      newState.message = `${player.name} играет ${card.label}. Счётчик: ${newState.onoState.counter}`;
      break;

    case 'reverse':
      newState.onoState.direction = (newState.onoState.direction === 1 ? -1 : 1) as 1 | -1;
      newState.message = `${player.name} играет Reverse! Направление ONO изменено.`;
      break;

    case 'skip':
      newState.message = `${player.name} играет Skip! Следующий игрок ONO пропускается.`;
      break;

    case 'double':
      newState.message = `${player.name} играет Double! Следующий игрок должен сыграть 2 карты.`;
      break;
  }

  // Добрать карту
  const drawn = drawOnoCard(newState);
  if (drawn) {
    player.onoHand.push(drawn);
  }

  // Если bust
  if (busted) {
    player.lives--;
    newState.message = `💀 ${player.name} превысил 99! Потерял жизнь. Осталось: ${player.lives}`;
    if (player.lives <= 0) {
      player.isAlive = false;
      newState.message += ` — ${player.name} выбывает из ONO 99!`;
    }

    const alivePlayers = newState.players.filter(p => p.isAlive);
    if (alivePlayers.length <= 1) {
      // 🏆 ПОБЕДА В ONO
      newState.onoWinner = alivePlayers[0]?.id || null;
      newState.message = `🏆 ${alivePlayers[0]?.name || 'Никто'} победил в ONO 99!`;
      
      if (newState.unoWinner) {
        // Если и UNO уже выиграно -> КОНЕЦ ИГРЫ
        newState.gameOver = true;
        newState.winner = newState.onoWinner; // Последний победитель
        newState.phase = 'waiting';
        return newState;
      } else {
        // Иначе продолжаем только UNO
        newState.message += " Игра продолжается в UNO Flip!";
        // Переходим к фазе UNO, так как ONO завершено
        newState.phase = 'uno';
        const unoPlayer = newState.players[newState.unoState.currentPlayerIndex];
        newState.message += ` → Ход UNO Flip: ${unoPlayer.name}`;
        newState.turnStartTime = Date.now();
        return newState;
      }
    }

    resetOnoRound(newState);
    
    // Если UNO уже выиграно, остаемся в ONO
    if (newState.unoWinner) {
        newState.phase = 'ono';
        const nextOnoPlayer = newState.players[newState.onoState.currentPlayerIndex];
        newState.message += ` → Ход ONO 99: ${nextOnoPlayer.name}`;
    } else {
        newState.phase = 'uno';
        const unoPlayer = newState.players[newState.unoState.currentPlayerIndex];
        newState.message += ` → Ход UNO Flip: ${unoPlayer.name}`;
    }
    
    return newState;
  }

  // Обработка Double
  if (newState.phase === 'ono_double') {
    newState.onoState.doublesRemaining--;
    if (newState.onoState.doublesRemaining > 0) {
      newState.message += ` (осталось сыграть: ${newState.onoState.doublesRemaining})`;
      return newState;
    }
  }

  // Определить следующего игрока
  if (card.type === 'skip') {
    newState.onoState.currentPlayerIndex = getNextOnoPlayer(newState, playerIdx, 2);
  } else if (card.type === 'double') {
    const nextIdx = getNextOnoPlayer(newState, playerIdx);
    newState.onoState.currentPlayerIndex = nextIdx;
    newState.onoState.doublesRemaining = 2;
    newState.phase = 'ono_double';
    newState.message += ` Ход ONO: ${newState.players[nextIdx].name} (2 карты)`;
    newState.turnStartTime = Date.now();
    return newState;
  } else {
    newState.onoState.currentPlayerIndex = getNextOnoPlayer(newState, playerIdx);
  }

  // Переход к следующей фазе
  if (newState.unoWinner) {
      // Если UNO выиграно -> остаемся в ONO
      newState.phase = 'ono';
      const nextOnoPlayer = newState.players[newState.onoState.currentPlayerIndex];
      newState.message += ` → Ход ONO 99: ${nextOnoPlayer.name}`;
  } else {
      // Иначе переходим к UNO
      newState.phase = 'uno';
      const unoPlayer = newState.players[newState.unoState.currentPlayerIndex];
      newState.message += ` → Ход UNO Flip: ${unoPlayer.name}`;
  }

  newState.turnStartTime = Date.now();

  return newState;
}

// === ВАЛИДАЦИЯ ХОДА UNO FLIP ===
export function canPlayUnoCard(card: UnoCard, topCard: UnoCard | null, side: UnoSide, mustDraw: number): boolean {
  if (mustDraw > 0) return false;
  if (!topCard) return true;

  const cardSide = getActiveSide(card, side);
  const topSide = getActiveSide(topCard, side);

  if (cardSide.color === 'wild') return true;

  const effectiveTopColor = topCard.chosenColor || topSide.color;
  if (cardSide.color === effectiveTopColor) return true;

  if (cardSide.type === topSide.type && cardSide.type === 'number' && cardSide.value === topSide.value) return true;
  if (cardSide.type !== 'number' && cardSide.type === topSide.type) return true;

  return false;
}

export function hasPlayableUnoCard(player: Player, topCard: UnoCard | null, side: UnoSide, mustDraw: number): boolean {
  return player.unoHand.some(c => canPlayUnoCard(c, topCard, side, mustDraw));
}

// === СЫГРАТЬ КАРТУ UNO FLIP ===
export function playUnoCard(state: GameState, playerId: string, cardId: string, chosenColor?: UnoColor): GameState {
  const newState = deepClone(state);
  const playerIdx = newState.players.findIndex(p => p.id === playerId);
  const player = newState.players[playerIdx];

  if (newState.phase !== 'uno') {
    newState.message = 'Сейчас не фаза UNO Flip!';
    return newState;
  }
  if (playerIdx !== newState.unoState.currentPlayerIndex) {
    newState.message = 'Сейчас не ваш ход в UNO Flip!';
    return newState;
  }

  const cardIdx = player.unoHand.findIndex(c => c.id === cardId);
  if (cardIdx === -1) return newState;

  const card = player.unoHand[cardIdx];
  const side = newState.unoState.side;
  const cardSide = getActiveSide(card, side);

  if (!canPlayUnoCard(card, newState.unoState.topCard, side, newState.unoState.mustDraw)) {
    newState.message = 'Нельзя сыграть эту карту!';
    return newState;
  }

  player.unoHand.splice(cardIdx, 1);

  if (cardSide.color === 'wild' && chosenColor) {
    card.chosenColor = chosenColor;
  }

  newState.unoState.discardPile.push(card);
  newState.unoState.topCard = card;

  newState.message = `${player.name} играет ${cardSide.label} ${cardSide.color === 'wild' ? '' : cardSide.color}`;

  if (player.unoHand.length === 1) {
    player.saidUno = false;
  }

  if (player.unoHand.length === 0) {
    // 🏆 ПОБЕДА В UNO
    newState.unoWinner = player.id;
    newState.message = `🏆 ${player.name} победил в UNO Flip!`;
    
    if (newState.onoWinner) {
      // Если и ONO уже выиграно -> КОНЕЦ ИГРЫ
      newState.gameOver = true;
      newState.winner = player.id;
      newState.phase = 'waiting';
      return newState;
    } else {
       // Иначе продолжаем только ONO
       newState.message += " Игра продолжается в ONO 99!";
       newState.phase = 'ono';
       const onoPlayer = newState.players[newState.onoState.currentPlayerIndex];
       newState.message += ` → Ход ONO 99: ${onoPlayer.name}`;
       
       // Проверка играбельности ONO
       if (!hasPlayableOnoCard(onoPlayer, newState.onoState.counter)) {
         handleOnoDeath(newState, onoPlayer);
       }
       
       newState.turnStartTime = Date.now();
       return newState;
    }
  }

  let skipAmount = 1;

  switch (cardSide.type) {
    case 'reverse':
      newState.unoState.direction = (newState.unoState.direction === 1 ? -1 : 1) as 1 | -1;
      if (newState.players.length === 2) {
        skipAmount = 2;
      }
      newState.message += ' — Reverse!';
      break;

    case 'skip':
      skipAmount = 2;
      newState.message += ' — Skip!';
      break;

    case 'skip_everyone':
      skipAmount = 0;
      newState.message += ' — Skip Everyone!';
      break;

    case 'draw_one':
      {
        const nextIdx = getNextUnoPlayer(newState, playerIdx);
        const nextPlayer = newState.players[nextIdx];
        const drawnCard = drawUnoCard(newState);
        if (drawnCard) nextPlayer.unoHand.push(drawnCard);
        skipAmount = 2;
        newState.message += ` — ${nextPlayer.name} берёт 1 карту!`;
      }
      break;

    case 'draw_five':
      {
        const nextIdx = getNextUnoPlayer(newState, playerIdx);
        const nextPlayer = newState.players[nextIdx];
        for (let i = 0; i < 5; i++) {
          const drawnCard = drawUnoCard(newState);
          if (drawnCard) nextPlayer.unoHand.push(drawnCard);
        }
        skipAmount = 2;
        newState.message += ` — ${nextPlayer.name} берёт 5 карт!`;
      }
      break;

    case 'flip':
      newState.unoState.side = side === 'light' ? 'dark' : 'light';
      newState.message += ` — FLIP! Теперь ${newState.unoState.side} side!`;
      break;

    case 'wild':
      if (chosenColor) {
        newState.message += ` — Выбран цвет: ${chosenColor}`;
      }
      break;

    case 'wild_draw_two':
      {
        const nextIdx = getNextUnoPlayer(newState, playerIdx);
        const nextPlayer = newState.players[nextIdx];
        for (let i = 0; i < 2; i++) {
          const drawnCard = drawUnoCard(newState);
          if (drawnCard) nextPlayer.unoHand.push(drawnCard);
        }
        skipAmount = 2;
        if (chosenColor) {
          newState.message += ` — ${nextPlayer.name} берёт 2 карты! Цвет: ${chosenColor}`;
        }
      }
      break;

    case 'wild_draw_color':
      {
        const nextIdx = getNextUnoPlayer(newState, playerIdx);
        const nextPlayer = newState.players[nextIdx];
        let count = 0;
        for (let i = 0; i < 10; i++) {
          const drawnCard = drawUnoCard(newState);
          if (!drawnCard) break;
          nextPlayer.unoHand.push(drawnCard);
          count++;
          const drawnSide = getActiveSide(drawnCard, newState.unoState.side);
          if (chosenColor && drawnSide.color === chosenColor) break;
        }
        skipAmount = 2;
        newState.message += ` — ${nextPlayer.name} берёт ${count} карт!`;
      }
      break;
  }

  // Переход к следующему ходу
  if (skipAmount === 0) {
    // skip_everyone — остаёмся на том же
  } else {
    newState.unoState.currentPlayerIndex = getNextUnoPlayer(newState, playerIdx, skipAmount);
  }

  // Переход к следующей фазе
  if (newState.onoWinner) {
      // Если ONO выиграно -> остаемся в UNO
      newState.phase = 'uno';
      const nextUnoPlayer = newState.players[newState.unoState.currentPlayerIndex];
      newState.message += ` → Ход UNO Flip: ${nextUnoPlayer.name}`;
  } else {
      // Иначе переходим к ONO
      newState.phase = 'ono';
      const onoPlayer = newState.players[newState.onoState.currentPlayerIndex];
      newState.message += ` → Ход ONO: ${onoPlayer.name}`;

      // Проверяем может ли ONO-игрок сыграть
      if (!hasPlayableOnoCard(onoPlayer, newState.onoState.counter)) {
        handleOnoDeath(newState, onoPlayer);
      }
  }

  newState.turnStartTime = Date.now();
  return newState;
}

// Вынесли логику смерти в отдельную функцию, чтобы не дублировать
function handleOnoDeath(state: GameState, player: Player) {
    player.lives--;
    state.message = `💀 ${player.name} не может сыграть в ONO 99! Потерял жизнь.`;
    if (player.lives <= 0) {
      player.isAlive = false;
      state.message += ` — ${player.name} выбывает из ONO 99!`;
    }
    const alivePlayers = state.players.filter(p => p.isAlive);
    if (alivePlayers.length <= 1) {
      // 🏆 ПОБЕДА В ONO (повторная логика, можно вынести, но пока так)
      state.onoWinner = alivePlayers[0]?.id || null;
      state.message = `🏆 ${alivePlayers[0]?.name || 'Никто'} победил в ONO 99!`;
      
      if (state.unoWinner) {
        state.gameOver = true;
        state.winner = state.onoWinner;
        state.phase = 'waiting';
      } else {
        state.message += " Игра продолжается в UNO Flip!";
        // Переходим обратно в UNO? 
        // Мы пришли из UNO -> хотели в ONO -> умерли -> ONO закончилось -> надо в UNO.
        state.phase = 'uno';
        const nextUnoPlayer = state.players[state.unoState.currentPlayerIndex]; // тот кто только что походил в UNO?
        // Нет, currentPlayerIndex в UNO уже сдвинут. Значит следующий.
        state.message += ` → Ход UNO Flip: ${nextUnoPlayer.name}`;
      }
      return;
    }
    
    resetOnoRound(state);
    
    // Если мы "умерли" и раунд сбросился, но игра продолжается:
    // Мы должны остаться в ONO или вернуться в UNO?
    // Обычно после сброса раунда ONO мы идем в UNO.
    // Если UNO выиграно -> остаемся в ONO.
    if (state.unoWinner) {
         state.phase = 'ono';
         // Следующий игрок ONO?
         // Если текущий игрок умер, но не выбыл (lives > 0), он продолжает?
         // Если выбыл, то getNextOnoPlayer его пропустит.
         // Но мы уже установили currentPlayerIndex для ONO до вызова этой функции (в playUnoCard не устанавливали, он остался прежним).
         // Если игрок выбыл, нужно сдвинуть currentPlayerIndex.
         if (!player.isAlive) {
             state.onoState.currentPlayerIndex = getNextOnoPlayer(state, state.onoState.currentPlayerIndex);
         }
         const nextOnoPlayer = state.players[state.onoState.currentPlayerIndex];
         state.message += ` → Ход ONO 99: ${nextOnoPlayer.name}`;
    } else {
        state.phase = 'uno';
    }
}

// === ВЗЯТЬ КАРТУ UNO ===
export function drawUnoCardAction(state: GameState, playerId: string): GameState {
  const newState = deepClone(state);
  const playerIdx = newState.players.findIndex(p => p.id === playerId);
  const player = newState.players[playerIdx];

  if (newState.phase !== 'uno') return newState;
  if (playerIdx !== newState.unoState.currentPlayerIndex) return newState;

  const card = drawUnoCard(newState);
  if (card) {
    player.unoHand.push(card);
    newState.message = `${player.name} берёт карту из колоды UNO.`;
  }

  newState.unoState.currentPlayerIndex = getNextUnoPlayer(newState, playerIdx);
  
  if (newState.onoWinner) {
      // Если ONO выиграно -> остаемся в UNO
      newState.phase = 'uno';
      const nextUnoPlayer = newState.players[newState.unoState.currentPlayerIndex];
      newState.message += ` → Ход UNO Flip: ${nextUnoPlayer.name}`;
  } else {
      newState.phase = 'ono';
      const onoPlayer = newState.players[newState.onoState.currentPlayerIndex];
      newState.message += ` → Ход ONO: ${onoPlayer.name}`;
      
      // Проверяем может ли ONO-игрок сыграть
      if (!hasPlayableOnoCard(onoPlayer, newState.onoState.counter)) {
        handleOnoDeath(newState, onoPlayer);
      }
  }

  newState.turnStartTime = Date.now();

  return newState;
}

// === НАЖАТЬ UNO! ===
export function sayUno(state: GameState, playerId: string): GameState {
  const newState = deepClone(state);
  const player = newState.players.find(p => p.id === playerId);
  if (player) {
    player.saidUno = true;
    newState.message = `${player.name} кричит UNO! 🔔`;
  }
  return newState;
}

// === ПЕРЕЗАПУСК РАУНДА ONO ===
function resetOnoRound(state: GameState) {
  state.onoState.counter = 0;
  let allCards: OnoCard[] = [...state.onoState.deck, ...state.onoState.discardPile];
  for (const p of state.players) {
    allCards = allCards.concat(p.onoHand);
    p.onoHand = [];
  }
  state.onoState.deck = shuffle(allCards);
  state.onoState.discardPile = [];

  for (const p of state.players) {
    if (p.isAlive) {
      p.onoHand = state.onoState.deck.splice(0, ONO_HAND_SIZE);
    }
  }
}

// === ОБРАБОТКА ТАЙМАУТА ===
export function handleTimeout(state: GameState): GameState {
  const newState = deepClone(state);
  
  if (newState.gameOver || newState.phase === 'waiting') {
    return newState;
  }
  
  if (newState.phase === 'uno') {
      // Таймаут в UNO
      // Передаем ход следующему
      newState.unoState.currentPlayerIndex = getNextUnoPlayer(newState, newState.unoState.currentPlayerIndex);
      
      // Следующая фаза
      if (newState.onoWinner) {
          newState.phase = 'uno';
          const nextPlayer = newState.players[newState.unoState.currentPlayerIndex];
          newState.message = `⏰ Время вышло! Ход UNO Flip переходит к ${nextPlayer.name}`;
      } else {
          newState.phase = 'ono';
          const onoPlayer = newState.players[newState.onoState.currentPlayerIndex];
          newState.message = `⏰ Время вышло! Ход ONO 99 переходит к ${onoPlayer.name}`;
          
          if (!hasPlayableOnoCard(onoPlayer, newState.onoState.counter)) {
            handleOnoDeath(newState, onoPlayer);
          }
      }
  } else {
      // Таймаут в ONO
      // Передаем ход следующему
      newState.onoState.currentPlayerIndex = getNextOnoPlayer(newState, newState.onoState.currentPlayerIndex);
      newState.onoState.doublesRemaining = 0; // Сбрасываем double
      
      // Следующая фаза
      if (newState.unoWinner) {
          newState.phase = 'ono';
          const nextPlayer = newState.players[newState.onoState.currentPlayerIndex];
          newState.message = `⏰ Время вышло! Ход ONO 99 переходит к ${nextPlayer.name}`;
      } else {
          newState.phase = 'uno';
          const unoPlayer = newState.players[newState.unoState.currentPlayerIndex];
          newState.message = `⏰ Время вышло! Ход UNO Flip переходит к ${unoPlayer.name}`;
      }
  }

  newState.turnStartTime = Date.now();
  return newState;
}

// === АДМИНСКИЕ ФУНКЦИИ ===

// Смена имени игрока
export function adminChangeName(state: GameState, targetPlayerId: string, newName: string): GameState {
  const newState = deepClone(state);
  const player = newState.players.find(p => p.id === targetPlayerId);
  if (player) {
    const oldName = player.name;
    player.name = newName;
    newState.message = `👮 Админ изменил имя игрока: ${oldName} → ${newName}`;
  }
  return newState;
}

// Кикнуть игрока (установить 0 жизней и isAlive = false)
// Полное удаление сложно из-за индексов, поэтому просто "убиваем"
export function adminKillPlayer(state: GameState, targetPlayerId: string): GameState {
  const newState = deepClone(state);
  const player = newState.players.find(p => p.id === targetPlayerId);
  
  if (player && player.isAlive) {
    player.lives = 0;
    player.isAlive = false;
    newState.message = `👮 Админ исключил игрока ${player.name} из раунда ONO.`;
    
    // Если это был текущий игрок, нужно передать ход
    // Проверка победы и передача хода
    const alivePlayers = newState.players.filter(p => p.isAlive);
    if (alivePlayers.length <= 1) {
      // 🏆 ПОБЕДА В ONO
      newState.onoWinner = alivePlayers[0]?.id || null;
      newState.message = `🏆 ${alivePlayers[0]?.name || 'Никто'} победил в ONO 99!`;
      
      if (newState.unoWinner) {
        newState.gameOver = true;
        newState.winner = newState.onoWinner;
        newState.phase = 'waiting';
        return newState;
      } else {
        newState.message += " Игра продолжается в UNO Flip!";
        newState.phase = 'uno';
        const unoPlayer = newState.players[newState.unoState.currentPlayerIndex];
        newState.message += ` → Ход UNO Flip: ${unoPlayer.name}`;
        newState.turnStartTime = Date.now();
        return newState;
      }
    }
    
    // Если кикнутый был активным, передаем ход
    // Можно использовать логику handleTimeout для простоты
    if (newState.players[newState.onoState.currentPlayerIndex].id === targetPlayerId) {
        return handleTimeout(newState);
    }
  }
  return newState;
}

// Перезапуск игры (с теми же игроками)
export function adminRestartGame(state: GameState): GameState {
    const playerIds = state.players.map(p => p.id);
    const playerNames = state.players.map(p => p.name);
    // Сохраняем хоста
    const newState = initializeGame(playerIds, playerNames);
    newState.hostId = state.hostId; 
    newState.message = '👮 Админ перезапустил игру!';
    return newState;
}

// Пропустить ход текущего игрока
export function adminSkipTurn(state: GameState): GameState {
    const newState = handleTimeout(state);
    newState.message = '👮 Админ принудительно завершил ход.';
    return newState;
}

// Глубокое клонирование
function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

// Получить текущего игрока ONO
export function getCurrentOnoPlayer(state: GameState): Player {
  return state.players[state.onoState.currentPlayerIndex];
}

// Получить текущего игрока UNO
export function getCurrentUnoPlayer(state: GameState): Player {
  return state.players[state.unoState.currentPlayerIndex];
}
