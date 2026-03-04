// =============================================
// firebase.ts — Инициализация Firebase и работа с комнатами
// =============================================

import { initializeApp } from 'firebase/app';
import {
  getDatabase, ref, set, get, update, remove,
  onValue, onDisconnect, off,
} from 'firebase/database';
import type { GameState } from './game/gameLogic';

// === КОНФИГУРАЦИЯ FIREBASE ===
// ⚠️ ЗАМЕНИТЕ НА СВОИ ДАННЫЕ FIREBASE!
// 1. Создайте проект на https://console.firebase.google.com
// 2. Включите Realtime Database
// 3. Скопируйте конфиг из настроек проекта
const firebaseConfig = {
  apiKey: "AIzaSyAXSEtIXcvk2YndN-U7MPlnXVqPW  mYCuKE",
  authDomain: "unoono-bdbbe.firebaseapp.com",
  databaseURL: "https://unoono-bdbbe-default-rtdb.firebaseio.com",
  projectId: "unoono-bdbbe",
  storageBucket: "unoono-bdbbe.firebasestorage.app",
  messagingSenderId: "897401784744",
  appId: "1:897401784744:web:c862b97302c6fcc24e759d"
};

// Инициализация
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// === ГЕНЕРАЦИЯ ID ИГРОКА ===
export function getPlayerId(): string {
  let id = localStorage.getItem('doubleUno_playerId');
  if (!id) {
    id = 'p_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now().toString(36);
    localStorage.setItem('doubleUno_playerId', id);
  }
  return id;
}

// === ГЕНЕРАЦИЯ КОДА КОМНАТЫ ===
export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// === ТИПЫ ДАННЫХ КОМНАТЫ ===
export interface RoomPlayer {
  name: string;
  isHost: boolean;
  joinedAt: number;
  online: boolean;
}

export interface RoomData {
  host: string;
  status: 'lobby' | 'playing' | 'finished';
  players: Record<string, RoomPlayer>;
  gameState?: GameState;
  createdAt: number;
}

// Тип для функции отписки
type UnsubscribeFn = () => void;

// Получить ссылку на комнату
function roomRef(roomCode: string) {
  return ref(database, `rooms/${roomCode}`);
}

// === CRUD ОПЕРАЦИИ ===

// Создать комнату
export async function createRoom(roomCode: string, playerId: string, playerName: string): Promise<void> {
  const roomData: RoomData = {
    host: playerId,
    status: 'lobby',
    players: {
      [playerId]: {
        name: playerName,
        isHost: true,
        joinedAt: Date.now(),
        online: true,
      }
    },
    createdAt: Date.now(),
  };
  await set(roomRef(roomCode), roomData);

  // onDisconnect — пометить игрока как offline
  const playerOnlineRef = ref(database, `rooms/${roomCode}/players/${playerId}/online`);
  onDisconnect(playerOnlineRef).set(false);
}

// Проверить существует ли комната
export async function checkRoomExists(roomCode: string): Promise<RoomData | null> {
  const snapshot = await get(roomRef(roomCode));
  if (snapshot.exists()) {
    return snapshot.val() as RoomData;
  }
  return null;
}

// Присоединиться к комнате
export async function joinRoom(
  roomCode: string, playerId: string, playerName: string
): Promise<{ success: boolean; error?: string }> {
  const room = await checkRoomExists(roomCode);
  if (!room) {
    return { success: false, error: 'Комната не найдена!' };
  }
  if (room.status !== 'lobby') {
    return { success: false, error: 'Игра уже началась!' };
  }
  const playerCount = Object.keys(room.players || {}).length;
  if (playerCount >= 6) {
    return { success: false, error: 'Комната заполнена (максимум 6 игроков)!' };
  }

  if (room.players && room.players[playerId]) {
    await update(ref(database, `rooms/${roomCode}/players/${playerId}`), {
      online: true,
      name: playerName,
    });
  } else {
    await set(ref(database, `rooms/${roomCode}/players/${playerId}`), {
      name: playerName,
      isHost: false,
      joinedAt: Date.now(),
      online: true,
    });
  }

  const playerOnlineRef = ref(database, `rooms/${roomCode}/players/${playerId}/online`);
  onDisconnect(playerOnlineRef).set(false);

  return { success: true };
}

// Выйти из комнаты
export async function leaveRoom(roomCode: string, playerId: string): Promise<void> {
  try {
    const room = await checkRoomExists(roomCode);
    if (!room) return;

    await remove(ref(database, `rooms/${roomCode}/players/${playerId}`));

    if (room.host === playerId) {
      const remainingPlayers = Object.keys(room.players || {}).filter(id => id !== playerId);
      if (remainingPlayers.length === 0) {
        await remove(roomRef(roomCode));
      } else {
        const newHost = remainingPlayers[0];
        await update(roomRef(roomCode), { host: newHost });
        await update(ref(database, `rooms/${roomCode}/players/${newHost}`), { isHost: true });
      }
    }
  } catch (e) {
    console.error('Ошибка при выходе из комнаты:', e);
  }
}

// Начать игру
export async function startGame(roomCode: string, gameState: GameState): Promise<void> {
  // ⬇️ ВАЖНО: Убираем циклические ссылки через JSON сериализацию
  const cleanState = JSON.parse(JSON.stringify(gameState));

  await update(roomRef(roomCode), {
    status: 'playing',
    gameState: cleanState,
  });
}

// Обновить gameState после хода
export async function updateGameState(roomCode: string, gameState: GameState): Promise<void> {
  // ⬇️ ВАЖНО: Убираем циклические ссылки через JSON сериализацию
  const cleanState = JSON.parse(JSON.stringify(gameState));

  await set(ref(database, `rooms/${roomCode}/gameState`), cleanState);
}

// Обновить статус комнаты
export async function updateRoomStatus(
  roomCode: string, status: 'lobby' | 'playing' | 'finished'
): Promise<void> {
  await update(roomRef(roomCode), { status });
}

// === ПОДПИСКИ (real-time listeners) ===

// Подписаться на изменения комнаты
export function subscribeToRoom(
  roomCode: string, callback: (data: RoomData | null) => void
): UnsubscribeFn {
  const dbRef = roomRef(roomCode);
  const listener = onValue(dbRef, (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.val() as RoomData);
    } else {
      callback(null);
    }
  });
  // onValue в Firebase v9+ возвращает Unsubscribe функцию
  return typeof listener === 'function' ? listener : () => off(dbRef);
}

// Подписаться только на gameState
export function subscribeToGameState(
  roomCode: string, callback: (state: GameState | null) => void
): UnsubscribeFn {
  const gsRef = ref(database, `rooms/${roomCode}/gameState`);
  const listener = onValue(gsRef, (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.val() as GameState);
    } else {
      callback(null);
    }
  });
  return typeof listener === 'function' ? listener : () => off(gsRef);
}

// Пометить игрока как онлайн
export async function setPlayerOnline(roomCode: string, playerId: string): Promise<void> {
  const playerOnlineRef = ref(database, `rooms/${roomCode}/players/${playerId}/online`);
  await set(playerOnlineRef, true);
  onDisconnect(playerOnlineRef).set(false);
}

export { database };
