// =============================================
// App.tsx — Точка входа приложения Double UNO (онлайн)
// =============================================

import { useState, useCallback } from 'react';
import { initializeGame, GameState } from './game/gameLogic';
import { GameBoard } from './components/GameBoard';
import { Lobby } from './components/Lobby';
import { startGame, RoomData } from './firebase';

type Screen = 'lobby' | 'game' | 'result';

export function App() {
  const [screen, setScreen] = useState<Screen>('lobby');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [winnerName, setWinnerName] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState<string>('');
  const [playerId, setPlayerId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  // === НАЧАЛО ИГРЫ (вызывается из Lobby) ===
  const handleGameStart = useCallback(
      async (code: string, roomData: RoomData, pid: string) => {
        console.log('🚀 handleGameStart вызван:', { code, pid, isHost: roomData.host === pid });

        // Предотвращаем повторный вызов
        if (isLoading) {
          console.log('⚠️ Уже загружается, пропускаем');
          return;
        }

        setRoomCode(code);
        setPlayerId(pid);

        // Если хост — инициализируем gameState и пишем в Firebase
        if (roomData.host === pid) {
          // Если игра уже создана (пришло обновление из Firebase или реконнект), не пересоздаем
          if (roomData.gameState) {
            console.log('🔄 Игра уже идет, подключаемся к существующей');
            setGameState(roomData.gameState);
            setScreen('game');
            return;
          }

          setIsLoading(true);

          try {
            const playerIds = Object.keys(roomData.players);
            const playerNames = Object.values(roomData.players).map(p => p.name);

            console.log('🎮 Хост инициализирует игру:', { playerIds, playerNames });

            // Проверка данных
            if (playerIds.length < 2) {
              console.error('❌ Недостаточно игроков!');
              setIsLoading(false);
              return;
            }

            console.log('📝 Вызываем initializeGame...');
            const state = initializeGame(playerIds, playerNames);
            console.log('📦 GameState создан:', state);

            if (!state) {
              console.error('❌ initializeGame вернул null/undefined!');
              setIsLoading(false);
              return;
            }

            console.log('☁️ Записываем в Firebase...');
            await startGame(code, state);
            console.log('✅ GameState записан в Firebase');

            setGameState(state);
            setScreen('game');
          } catch (error) {
            console.error('❌ Ошибка при старте игры:', error);
            alert('Ошибка при старте игры: ' + (error as Error).message);
          } finally {
            setIsLoading(false);
          }
        } else {
          // Не-хост просто переходит в игру и ждёт gameState из Firebase
          console.log('⏳ Не-хост ожидает GameState из Firebase');

          // GameState придёт через подписку в GameBoard
          if (roomData.gameState) {
            console.log('📡 Получен GameState из комнаты:', roomData.gameState);
            setGameState(roomData.gameState);
          }

          setScreen('game');
        }
      },
      [isLoading]
  );

  // === КОНЕЦ ИГРЫ ===
  const handleGameEnd = useCallback((winnerId: string | null) => {
    if (winnerId && gameState) {
      const winner = gameState.players.find(p => p.id === winnerId);
      setWinnerName(winner?.name || 'Неизвестный');
    } else {
      setWinnerName(null);
    }
    setScreen('result');
  }, [gameState]);

  // === ВОЗВРАТ В ЛОББИ ===
  const handleBackToLobby = useCallback(() => {
    setScreen('lobby');
    setGameState(null);
    setWinnerName(null);
    setRoomCode('');
    setPlayerId('');
  }, []);

  // === РЕВАНШ (только хост) ===
  const handleRematch = useCallback(async () => {
    if (!gameState || !roomCode) return;

    try {
      const playerIds = gameState.players.map(p => p.id);
      const playerNames = gameState.players.map(p => p.name);

      const newState = initializeGame(playerIds, playerNames);

      await startGame(roomCode, newState);

      setGameState(newState);
      setScreen('game');
    } catch (error) {
      console.error('❌ Ошибка реванша:', error);
    }
  }, [gameState, roomCode]);

  // === РЕНДЕР ===
  if (screen === 'lobby') {
    return <Lobby onGameStart={handleGameStart} />;
  }

  if (screen === 'game') {
    return (
        <GameBoard
            initialState={gameState}
            roomCode={roomCode}
            playerId={playerId}
            onGameEnd={handleGameEnd}
        />
    );
  }

  if (screen === 'result') {
    return (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
          <div className="text-center">
            <div className="text-6xl mb-4 animate-bounce">🏆</div>

            <h1 className="text-4xl font-black mb-2">
            <span className="bg-gradient-to-r from-yellow-300 via-amber-400 to-orange-400 bg-clip-text text-transparent">
              ПОБЕДА!
            </span>
            </h1>

            {winnerName ? (
                <p className="text-2xl text-white mb-6">
                  🎉 <strong>{winnerName}</strong> выиграл!
                </p>
            ) : (
                <p className="text-2xl text-gray-400 mb-6">
                  Игра окончена
                </p>
            )}

            <div className="flex justify-center gap-2 mb-8 text-3xl">
              {['🎊', '🎉', '✨', '🌟', '🎊'].map((e, i) => (
                  <span
                      key={i}
                      className="animate-bounce"
                      style={{ animationDelay: `${i * 150}ms` }}
                  >
                {e}
              </span>
              ))}
            </div>

            <div className="flex gap-3 justify-center">
              <button
                  onClick={handleRematch}
                  className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-500
                         text-white font-bold rounded-xl cursor-pointer
                         hover:from-cyan-400 hover:to-purple-400
                         transition-all duration-300 shadow-lg"
              >
                🔄 Реванш
              </button>
              <button
                  onClick={handleBackToLobby}
                  className="px-6 py-3 bg-gray-800 border border-gray-700
                         text-gray-300 font-bold rounded-xl cursor-pointer
                         hover:bg-gray-700 transition-colors"
              >
                🏠 В лобби
              </button>
            </div>
          </div>
        </div>
    );
  }

  return null;
}