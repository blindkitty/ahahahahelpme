// =============================================
// Lobby.tsx — Онлайн-лобби: создание/присоединение к комнате
// =============================================

import { useState, useEffect, useCallback } from 'react';
import {
  getPlayerId, generateRoomCode,
  createRoom, joinRoom, leaveRoom,
  subscribeToRoom, RoomData, RoomPlayer,
} from '../firebase';

interface LobbyProps {
  onGameStart: (roomCode: string, roomData: RoomData, playerId: string) => void;
}

type LobbyScreen = 'main' | 'create' | 'join' | 'waiting';

const AVATARS = ['🦊', '🐼', '🦁', '🐸', '🦋', '🐙'];

export function Lobby({ onGameStart }: LobbyProps) {
  const [screen, setScreen] = useState<LobbyScreen>('main');
  const [playerName, setPlayerName] = useState(() => {
    return localStorage.getItem('doubleUno_playerName') || '';
  });
  const [roomCode, setRoomCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [roomData, setRoomData] = useState<RoomData | null>(null);
  const [showRules, setShowRules] = useState(false);

  const playerId = getPlayerId();

  // Сохранять имя в localStorage
  useEffect(() => {
    if (playerName) {
      localStorage.setItem('doubleUno_playerName', playerName);
    }
  }, [playerName]);

  // Подписка на комнату когда в waiting room
  useEffect(() => {
    if (screen !== 'waiting' || !roomCode) return;

    const unsub = subscribeToRoom(roomCode, (data) => {
      if (!data) {
        // Комната удалена
        setError('Комната была удалена!');
        setScreen('main');
        setRoomData(null);
        return;
      }
      setRoomData(data);

      // Если статус изменился на "playing" — переход в игру
      if (data.status === 'playing' && data.gameState) {
        onGameStart(roomCode, data, playerId);
      }
    });

    return unsub;
  }, [screen, roomCode, playerId, onGameStart]);

  // === СОЗДАТЬ КОМНАТУ ===
  const handleCreate = useCallback(async () => {
    const name = playerName.trim();
    if (!name) {
      setError('Введите ваше имя!');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const code = generateRoomCode();
      await createRoom(code, playerId, name);
      setRoomCode(code);
      setScreen('waiting');
    } catch (e: any) {
      setError('Ошибка создания комнаты: ' + (e.message || 'Неизвестная ошибка'));
    }
    setLoading(false);
  }, [playerName, playerId]);

  // === ПРИСОЕДИНИТЬСЯ К КОМНАТЕ ===
  const handleJoin = useCallback(async () => {
    const name = playerName.trim();
    if (!name) {
      setError('Введите ваше имя!');
      return;
    }
    const code = joinCode.trim().toUpperCase();
    if (!code || code.length < 4) {
      setError('Введите код комнаты!');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await joinRoom(code, playerId, name);
      if (result.success) {
        setRoomCode(code);
        setScreen('waiting');
      } else {
        setError(result.error || 'Ошибка присоединения');
      }
    } catch (e: any) {
      setError('Ошибка: ' + (e.message || 'Не удалось подключиться'));
    }
    setLoading(false);
  }, [playerName, joinCode, playerId]);

  // === ПОКИНУТЬ КОМНАТУ ===
  const handleLeave = useCallback(async () => {
    if (roomCode) {
      await leaveRoom(roomCode, playerId);
    }
    setRoomCode('');
    setRoomData(null);
    setScreen('main');
  }, [roomCode, playerId]);

  // === КОПИРОВАТЬ КОД ===
  const handleCopyCode = useCallback(() => {
    navigator.clipboard.writeText(roomCode).catch(() => {});
  }, [roomCode]);

  // Данные хоста
  const isHost = roomData?.host === playerId;
  const playerList = roomData?.players ? Object.entries(roomData.players) : [];
  const canStart = isHost && playerList.length >= 2;

  // === ЭКРАН: ГЛАВНЫЙ ===
  if (screen === 'main') {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Логотип */}
          <div className="text-center mb-8">
            <h1 className="text-5xl font-black mb-2">
              <span className="bg-gradient-to-r from-cyan-400 via-purple-400 to-rose-400 bg-clip-text text-transparent">
                DOUBLE UNO
              </span>
            </h1>
            <p className="text-gray-500 text-sm">
              ONO 99 + UNO Flip — онлайн-мультиплеер!
            </p>
            <div className="flex justify-center gap-3 mt-3 text-2xl">
              <span className="animate-bounce" style={{ animationDelay: '0ms' }}>🎯</span>
              <span className="animate-bounce" style={{ animationDelay: '100ms' }}>🃏</span>
              <span className="animate-bounce" style={{ animationDelay: '200ms' }}>🎴</span>
              <span className="animate-bounce" style={{ animationDelay: '300ms' }}>🌐</span>
            </div>
          </div>

          {/* Ввод имени */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-2xl mb-4">
            <label className="text-gray-400 text-sm mb-2 block">
              👤 Ваше имя:
            </label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3
                         text-white font-medium focus:outline-none focus:border-cyan-500
                         transition-colors mb-4"
              placeholder="Введите имя..."
              maxLength={20}
            />

            {/* Кнопки */}
            <div className="space-y-3">
              <button
                onClick={() => {
                  if (!playerName.trim()) { setError('Введите имя!'); return; }
                  setError('');
                  setScreen('create');
                }}
                className="w-full py-3.5 bg-gradient-to-r from-cyan-500 to-blue-600
                           text-white font-bold text-lg rounded-xl
                           hover:from-cyan-400 hover:to-blue-500
                           cursor-pointer transition-all duration-300
                           shadow-lg hover:shadow-cyan-500/30
                           flex items-center justify-center gap-2"
              >
                🏠 Создать комнату
              </button>

              <button
                onClick={() => {
                  if (!playerName.trim()) { setError('Введите имя!'); return; }
                  setError('');
                  setScreen('join');
                }}
                className="w-full py-3.5 bg-gradient-to-r from-purple-500 to-rose-500
                           text-white font-bold text-lg rounded-xl
                           hover:from-purple-400 hover:to-rose-400
                           cursor-pointer transition-all duration-300
                           shadow-lg hover:shadow-purple-500/30
                           flex items-center justify-center gap-2"
              >
                🔗 Присоединиться
              </button>
            </div>

            {error && (
              <div className="mt-3 text-red-400 text-sm text-center bg-red-950/30 rounded-lg p-2 border border-red-900/30">
                ⚠️ {error}
              </div>
            )}
          </div>

          {/* Правила */}
          <div className="text-center">
            <button
              onClick={() => setShowRules(!showRules)}
              className="text-gray-500 hover:text-gray-300 text-sm cursor-pointer
                         transition-colors flex items-center gap-1 mx-auto"
            >
              📖 {showRules ? 'Скрыть правила' : 'Показать правила'}
            </button>

            {showRules && (
              <div className="mt-3 bg-gray-900/80 border border-gray-800 rounded-xl p-4 text-gray-400 text-xs space-y-3 text-left">
                <div>
                  <h3 className="text-cyan-400 font-bold text-sm mb-1">🎯 ONO 99</h3>
                  <p>Общий счётчик начинается с 0. Каждый ход кладёте карту — её номинал прибавляется к счётчику. 
                     Если превышает 99 — теряете жизнь! У каждого 3 жизни.</p>
                  <p className="mt-1">Спецкарты: 0 (не меняет), -10 (вычитает), Reverse (↺), Skip (⊘), Double (×2)</p>
                </div>
                <div>
                  <h3 className="text-rose-400 font-bold text-sm mb-1">🎴 UNO Flip</h3>
                  <p>Стандартный UNO с двумя сторонами карт (Light/Dark). Карта Flip переворачивает все карты!</p>
                  <p className="mt-1">Победа: первый избавившийся от всех карт UNO Flip.</p>
                </div>
                <div>
                  <h3 className="text-purple-400 font-bold text-sm mb-1">⚡ Ключевая особенность</h3>
                  <p>Направления ONO и UNO — НЕЗАВИСИМЫЕ! Reverse в одной игре не влияет на другую.</p>
                </div>
                <div>
                  <h3 className="text-yellow-400 font-bold text-sm mb-1">🔄 Порядок хода</h3>
                  <p>1. ONO-игрок играет карту → 2. UNO-игрок играет карту → 3. Указатели сдвигаются → повтор</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // === ЭКРАН: СОЗДАНИЕ КОМНАТЫ ===
  if (screen === 'create') {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-2xl">
            <button
              onClick={() => setScreen('main')}
              className="text-gray-500 hover:text-white transition-colors cursor-pointer mb-4 text-sm"
            >
              ← Назад
            </button>

            <h2 className="text-white font-bold text-xl mb-2 text-center">🏠 Создание комнаты</h2>
            <p className="text-gray-400 text-sm text-center mb-6">
              Нажмите кнопку для создания. Код комнаты будет сгенерирован автоматически.
            </p>

            <p className="text-gray-500 text-xs text-center mb-4">
              Играете как: <strong className="text-cyan-400">{playerName}</strong>
            </p>

            <button
              onClick={handleCreate}
              disabled={loading}
              className="w-full py-3.5 bg-gradient-to-r from-cyan-500 to-blue-600
                         text-white font-bold text-lg rounded-xl
                         hover:from-cyan-400 hover:to-blue-500
                         disabled:opacity-50 disabled:cursor-not-allowed
                         cursor-pointer transition-all duration-300
                         shadow-lg hover:shadow-cyan-500/30"
            >
              {loading ? '⏳ Создание...' : '🚀 Создать комнату'}
            </button>

            {error && (
              <div className="mt-3 text-red-400 text-sm text-center bg-red-950/30 rounded-lg p-2 border border-red-900/30">
                ⚠️ {error}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // === ЭКРАН: ПРИСОЕДИНЕНИЕ ===
  if (screen === 'join') {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-2xl">
            <button
              onClick={() => setScreen('main')}
              className="text-gray-500 hover:text-white transition-colors cursor-pointer mb-4 text-sm"
            >
              ← Назад
            </button>

            <h2 className="text-white font-bold text-xl mb-2 text-center">🔗 Присоединиться</h2>
            <p className="text-gray-400 text-sm text-center mb-6">
              Введите 6-значный код комнаты
            </p>

            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-4
                         text-white font-mono text-2xl text-center tracking-[0.5em]
                         focus:outline-none focus:border-purple-500
                         transition-colors mb-4 uppercase"
              placeholder="A3B7F2"
              maxLength={6}
              autoFocus
            />

            <p className="text-gray-500 text-xs text-center mb-4">
              Играете как: <strong className="text-purple-400">{playerName}</strong>
            </p>

            <button
              onClick={handleJoin}
              disabled={loading || joinCode.length < 4}
              className="w-full py-3.5 bg-gradient-to-r from-purple-500 to-rose-500
                         text-white font-bold text-lg rounded-xl
                         hover:from-purple-400 hover:to-rose-400
                         disabled:opacity-50 disabled:cursor-not-allowed
                         cursor-pointer transition-all duration-300
                         shadow-lg hover:shadow-purple-500/30"
            >
              {loading ? '⏳ Подключение...' : '🎮 Войти в комнату'}
            </button>

            {error && (
              <div className="mt-3 text-red-400 text-sm text-center bg-red-950/30 rounded-lg p-2 border border-red-900/30">
                ⚠️ {error}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // === ЭКРАН: КОМНАТА ОЖИДАНИЯ ===
  if (screen === 'waiting') {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-2xl">
            {/* Заголовок */}
            <div className="text-center mb-6">
              <h2 className="text-white font-bold text-xl mb-2">⏳ Комната ожидания</h2>
              
              {/* Код комнаты */}
              <div className="inline-flex items-center gap-2 bg-gray-800 rounded-xl px-4 py-3 border border-gray-700">
                <span className="text-gray-400 text-sm">Код:</span>
                <span className="text-2xl font-mono font-black text-cyan-400 tracking-[0.3em]">
                  {roomCode}
                </span>
                <button
                  onClick={handleCopyCode}
                  className="text-gray-500 hover:text-white transition-colors cursor-pointer
                             bg-gray-700 hover:bg-gray-600 rounded-lg px-2 py-1 text-xs"
                  title="Копировать код"
                >
                  📋
                </button>
              </div>
              <p className="text-gray-500 text-xs mt-2">
                Отправьте этот код друзьям для подключения
              </p>
            </div>

            {/* Список игроков */}
            <div className="mb-6">
              <h3 className="text-gray-400 text-sm font-bold mb-3 flex items-center gap-2">
                👥 Игроки ({playerList.length}/6)
                <span className="flex-1 h-px bg-gray-800" />
              </h3>
              <div className="space-y-2">
                {playerList.map(([pid, pdata]: [string, RoomPlayer], idx: number) => (
                  <div
                    key={pid}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all
                      ${pid === playerId
                        ? 'bg-cyan-950/20 border-cyan-500/30'
                        : 'bg-gray-800/50 border-gray-700/50'
                      }`}
                  >
                    <span className="text-2xl">{AVATARS[idx] || '👤'}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`font-bold text-sm ${pid === playerId ? 'text-cyan-300' : 'text-white'}`}>
                          {pdata.name}
                        </span>
                        {pid === playerId && (
                          <span className="text-[9px] bg-cyan-500/20 text-cyan-400 px-1.5 py-0.5 rounded-full border border-cyan-500/30">
                            ВЫ
                          </span>
                        )}
                        {pdata.isHost && (
                          <span className="text-[9px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded-full border border-yellow-500/30">
                            👑 ХОСТ
                          </span>
                        )}
                      </div>
                    </div>
                    <div className={`w-2.5 h-2.5 rounded-full ${pdata.online ? 'bg-green-400 shadow-lg shadow-green-400/50' : 'bg-gray-600'}`} />
                  </div>
                ))}

                {/* Пустые слоты */}
                {Array.from({ length: Math.max(0, 2 - playerList.length) }).map((_, i) => (
                  <div
                    key={`empty_${i}`}
                    className="flex items-center gap-3 p-3 rounded-xl border-2 border-dashed border-gray-800 text-gray-700"
                  >
                    <span className="text-2xl opacity-30">👤</span>
                    <span className="text-sm">Ожидание игрока...</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Кнопки */}
            <div className="space-y-2">
              {isHost ? (
                <button
                  onClick={() => {
                    // Хост нажимает "Начать" — вызовется через App
                    if (roomData) {
                      onGameStart(roomCode, roomData, playerId);
                    }
                  }}
                  disabled={!canStart}
                  className="w-full py-3.5 bg-gradient-to-r from-green-500 to-emerald-600
                             text-white font-bold text-lg rounded-xl
                             hover:from-green-400 hover:to-emerald-500
                             disabled:opacity-50 disabled:cursor-not-allowed
                             cursor-pointer transition-all duration-300
                             shadow-lg hover:shadow-green-500/30"
                >
                  {canStart ? '🚀 Начать игру' : `⏳ Ждём игроков (мин. 2)`}
                </button>
              ) : (
                <div className="w-full py-3.5 bg-gray-800 text-gray-400 font-bold text-lg rounded-xl text-center border border-gray-700">
                  ⏳ Ожидание хоста...
                </div>
              )}

              <button
                onClick={handleLeave}
                className="w-full py-2.5 bg-gray-800 border border-gray-700
                           text-gray-400 font-medium rounded-xl
                           hover:bg-gray-700 hover:text-red-400
                           cursor-pointer transition-colors text-sm"
              >
                🚪 Покинуть комнату
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
