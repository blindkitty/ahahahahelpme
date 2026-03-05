// =============================================
// GameBoard.tsx — Основной игровой экран с Firebase синхронизацией
// =============================================

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  GameState, playOnoCard, playUnoCard, drawUnoCardAction,
  sayUno, canPlayOnoCard, canPlayUnoCard, hasPlayableUnoCard,
  handleTimeout,
  adminChangeName, adminKillPlayer, adminRestartGame, adminSkipTurn
} from '../game/gameLogic';
import { UnoColor, getActiveSide } from '../game/cards';
import { OnoCardView } from './OnoCardView';
import { UnoCardView } from './UnoCardView';
import { ColorPicker } from './ColorPicker';
import { PlayerCircle } from './PlayerCircle';
import { AdminPanel } from './AdminPanel';
import { Chat } from './Chat';
import { updateGameState, subscribeToGameState } from '../firebase';

interface GameBoardProps {
  roomCode: string;
  playerId: string;
  initialState: GameState | null;  // ⬅️ ИЗМЕНЕНО: может быть null
  onGameEnd: (winner: string | null) => void;
}

export function GameBoard({ roomCode, playerId, initialState, onGameEnd }: GameBoardProps) {
  const [state, setState] = useState<GameState | null>(initialState);  // ⬅️ ИЗМЕНЕНО: | null
  const [colorPickerCard, setColorPickerCard] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<string>('');
  const [timeLeft, setTimeLeft] = useState<number>(15);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const stateRef = useRef(state);

  // Держим актуальную ссылку на state
  stateRef.current = state;

  // === ПОДПИСКА НА FIREBASE GAMESTATE ===
  // === ПОДПИСКА НА FIREBASE GAMESTATE ===
  useEffect(() => {
    console.log('🔔 Подписка на GameState комнаты:', roomCode);

    const unsub = subscribeToGameState(roomCode, (newState) => {
      console.log('📡 Получен GameState из Firebase:', newState);

      if (newState) {
        // ⬇️ ВАЖНО: Восстанавливаем массивы, которые могут быть undefined
        const fixedState: GameState = {
          ...newState,
          players: newState.players.map(p => ({
            ...p,
            onoHand: p.onoHand || [],
            unoHand: p.unoHand || [],
          })),
          onoState: {
            ...newState.onoState,
            deck: newState.onoState?.deck || [],
            discardPile: newState.onoState?.discardPile || [],
          },
          unoState: {
            ...newState.unoState,
            deck: newState.unoState?.deck || [],
            discardPile: newState.unoState?.discardPile || [],
          },
          turnOrder: newState.turnOrder || [],
        };

        setState(fixedState);

        // Проверка окончания игры
        if (fixedState.gameOver) {
          setTimeout(() => onGameEnd(fixedState.winner), 2500);
        }
      }
    });

    return () => {
      console.log('❌ Отписка от комнаты:', roomCode);
      unsub();
    };
  }, [roomCode, onGameEnd]);

  // === ОБНОВИТЬ СТЕЙТ В FIREBASE ===
  // === ОБНОВИТЬ СТЕЙТ В FIREBASE ===
  const pushState = useCallback(async (newState: GameState) => {
    // ⬇️ Гарантируем что все массивы существуют
    const safeState: GameState = {
      ...newState,
      players: newState.players.map(p => ({
        ...p,
        onoHand: p.onoHand || [],
        unoHand: p.unoHand || [],
      })),
      onoState: {
        ...newState.onoState,
        deck: newState.onoState?.deck || [],
        discardPile: newState.onoState?.discardPile || [],
      },
      unoState: {
        ...newState.unoState,
        deck: newState.unoState?.deck || [],
        discardPile: newState.unoState?.discardPile || [],
      },
      turnOrder: newState.turnOrder || [],
    };

    console.log('📤 Отправка хода в Firebase:', safeState);
    setState(safeState);

    try {
      await updateGameState(roomCode, safeState);
      console.log('✅ Ход записан в Firebase');
    } catch (e) {
      console.error('❌ Ошибка записи в Firebase:', e);
    }
  }, [roomCode]);

  // === ЭКРАН ЗАГРУЗКИ (если state === null) ===
  if (!state) {
    return (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center">
          <div className="text-center">
            <div className="text-4xl mb-4 animate-spin">⏳</div>
            <p className="text-white text-xl">Загрузка игры...</p>
            <p className="text-gray-500 text-sm mt-2">Ожидание данных от хоста</p>
          </div>
        </div>
    );
  }

  // === С ЭТОГО МОМЕНТА state ГАРАНТИРОВАННО НЕ null ===

  // Найти индекс текущего игрока
  const myPlayerIndex = state.players.findIndex(p => p.id === playerId);
  const myPlayer = state.players[myPlayerIndex];

  const onoCurrentPlayer = state.players[state.onoState.currentPlayerIndex];
  const unoCurrentPlayer = state.players[state.unoState.currentPlayerIndex];

  const isMyOnoTurn = myPlayer && myPlayer.id === onoCurrentPlayer?.id
      && (state.phase === 'ono' || state.phase === 'ono_double');
  const isMyUnoTurn = myPlayer && myPlayer.id === unoCurrentPlayer?.id
      && state.phase === 'uno';
  const isMyTurn = isMyOnoTurn || isMyUnoTurn;

  // === ТАЙМЕР ХОДА ===
  const handleTimeoutAction = useCallback(() => {
    if (!state || !isMyTurn) return;
    console.log('⏰ Timeout triggered by client');
    const newState = handleTimeout(state);
    pushState(newState);
  }, [state, isMyTurn, pushState]);

  useEffect(() => {
    if (!state || state.gameOver || state.phase === 'waiting') {
      setTimeLeft(15);
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const start = state.turnStartTime || now;
      const elapsed = Math.floor((now - start) / 1000);
      const remaining = Math.max(0, 15 - elapsed);

      setTimeLeft(remaining);

      if (remaining === 0 && isMyTurn) {
        handleTimeoutAction();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [state, isMyTurn, handleTimeoutAction]);

  // === ОБРАБОТЧИКИ ХОДОВ ===

  const handlePlayOno = useCallback((cardId: string) => {
    if (!state || !isMyOnoTurn || !myPlayer) {
      console.log('⚠️ Нельзя сыграть ONO карту:', { isMyOnoTurn, hasPlayer: !!myPlayer });
      return;
    }

    const card = myPlayer.onoHand.find(c => c.id === cardId);
    if (!card || !canPlayOnoCard(card, state.onoState.counter)) {
      console.log('⚠️ Карта не подходит:', card);
      return;
    }

    console.log('✅ Играем ONO карту:', card.label);
    const newState = playOnoCard(state, playerId, cardId);
    setLastAction(`ONO: ${card.label}`);
    pushState(newState);
  }, [isMyOnoTurn, myPlayer, state, playerId, pushState]);

  const handlePlayUno = useCallback((cardId: string) => {
    if (!state || !isMyUnoTurn || !myPlayer) {
      console.log('⚠️ Нельзя сыграть UNO карту:', { isMyUnoTurn, hasPlayer: !!myPlayer });
      return;
    }

    const card = myPlayer.unoHand.find(c => c.id === cardId);
    if (!card) {
      console.log('⚠️ Карта не найдена:', cardId);
      return;
    }

    if (!canPlayUnoCard(card, state.unoState.topCard, state.unoState.side, state.unoState.mustDraw)) {
      console.log('⚠️ Карта не подходит:', card);
      return;
    }

    const cardSide = getActiveSide(card, state.unoState.side);

    // Если Wild — показываем ColorPicker
    if (cardSide.color === 'wild') {
      console.log('🎨 Выбор цвета для Wild карты');
      setColorPickerCard(cardId);
      return;
    }

    console.log('✅ Играем UNO карту:', cardSide.label);
    const newState = playUnoCard(state, playerId, cardId);
    setLastAction(`UNO: ${cardSide.label}`);
    pushState(newState);
  }, [isMyUnoTurn, myPlayer, state, playerId, pushState]);

  const handleColorSelect = useCallback((color: UnoColor) => {
    if (!state || !colorPickerCard) return;

    console.log('✅ Выбран цвет:', color);
    const newState = playUnoCard(state, playerId, colorPickerCard, color);
    setLastAction(`UNO: Wild ${color}`);
    setColorPickerCard(null);
    pushState(newState);
  }, [colorPickerCard, state, playerId, pushState]);

  const handleDrawUno = useCallback(() => {
    if (!state || !isMyUnoTurn) {
      console.log('⚠️ Нельзя взять карту');
      return;
    }

    console.log('📥 Берём UNO карту');
    const newState = drawUnoCardAction(state, playerId);
    setLastAction('UNO: Взял карту');
    pushState(newState);
  }, [isMyUnoTurn, state, playerId, pushState]);

  const handleSayUno = useCallback(() => {
    if (!state) return;

    console.log('🔔 UNO!');
    const newState = sayUno(state, playerId);
    setLastAction('UNO! 🔔');
    pushState(newState);
  }, [state, playerId, pushState]);

  // === АДМИНСКИЕ ДЕЙСТВИЯ ===
  const handleAdminAction = useCallback((action: string, payload: any) => {
    if (!state) return;
    
    let newState = state;
    switch (action) {
      case 'changeName':
        newState = adminChangeName(state, payload.playerId, payload.newName);
        break;
      case 'killPlayer':
        newState = adminKillPlayer(state, payload.playerId);
        break;
      case 'restartGame':
        newState = adminRestartGame(state);
        break;
      case 'skipTurn':
        newState = adminSkipTurn(state);
        break;
    }
    
    pushState(newState);
  }, [state, pushState]);

  // Кнопка UNO показывается когда у игрока 2 карты UNO (перед ходом) или 1 (после хода)
  const showUnoButton = myPlayer && (
      (myPlayer.unoHand.length === 2 && isMyUnoTurn) ||
      (myPlayer.unoHand.length === 1 && !myPlayer.saidUno)
  );

  if (!myPlayer) {
    return (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">
          <div className="text-center">
            <p className="text-xl mb-4">⚠️ Вы не в этой игре</p>
            <p className="text-gray-400 text-sm">Возможно, вы были отключены</p>
          </div>
        </div>
    );
  }

  // === ОСНОВНОЙ РЕНДЕР ===
  return (
      <div className="min-h-screen bg-gray-950 text-white flex flex-col">
        {/* Админ-панель */}
        {showAdminPanel && state && (
          <AdminPanel 
            state={state} 
            onAction={handleAdminAction} 
            onClose={() => setShowAdminPanel(false)} 
          />
        )}

        {/* Модалка выбора цвета */}
        {colorPickerCard && (
            <ColorPicker side={state.unoState.side} onSelect={handleColorSelect} />
        )}

        {/* Индикатор хода (наверху) */}
        <div className={`
        text-center py-1.5 px-4 text-xs font-bold transition-all duration-500
        ${isMyTurn
            ? 'bg-gradient-to-r from-green-600/40 via-green-500/20 to-green-600/40 text-green-300 border-b border-green-500/30'
            : 'bg-gray-900/80 text-gray-500 border-b border-gray-800'
        }
      `}>
          {isMyTurn ? (
              <span className="flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            ВАШ ХОД — {isMyOnoTurn ? 'ONO 99' : 'UNO Flip'}
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className={`text-xs ml-1 ${timeLeft <= 5 ? 'text-red-400 animate-pulse' : 'text-green-200'}`}>
                  ({timeLeft}с)
                </span>
          </span>
          ) : (
              <span>
            Ожидание хода: {state.phase === 'ono' || state.phase === 'ono_double'
                  ? `${onoCurrentPlayer?.name} (ONO)`
                  : `${unoCurrentPlayer?.name} (UNO)`
              }
                <span className={`text-xs ml-1 ${timeLeft <= 5 ? 'text-red-400' : 'text-gray-400'}`}>
                  ({timeLeft}с)
                </span>
          </span>
          )}
        </div>

        {/* Шапка с игроками */}
        <div className="bg-gray-900/80 border-b border-gray-800 px-3 py-2">
          <PlayerCircle state={state} viewingPlayerId={playerId} />
        </div>

        {/* Направления */}
        <div className="flex justify-center gap-4 py-1 text-[11px]">
        <span className="text-cyan-400 flex items-center gap-1">
          <span className="font-bold">ONO</span>
          <span className="text-cyan-600">{state.onoState.direction === 1 ? '→ CW' : '← CCW'}</span>
        </span>
          <span className="text-gray-800">•</span>
          <span className="text-rose-400 flex items-center gap-1">
          <span className="font-bold">UNO</span>
          <span className="text-rose-600">{state.unoState.direction === 1 ? '→ CW' : '← CCW'}</span>
        </span>
        </div>

        {/* Сообщение */}
        <div className={`
        text-center py-1.5 px-4 mx-3 rounded-lg text-xs font-medium
        ${state.message.includes('💀') ? 'bg-red-950/60 text-red-300 border border-red-900/50' :
            state.message.includes('🏆') ? 'bg-yellow-950/60 text-yellow-300 border border-yellow-900/50' :
                'bg-gray-900/60 text-gray-400'}
      `}>
          {state.message}
        </div>

        {/* Последнее действие */}
        {lastAction && (
            <div className="text-center text-[10px] text-gray-600 mt-0.5">
              Ваш последний ход: {lastAction}
            </div>
        )}

        {/* Игровое поле — две зоны */}
        <div className="flex-1 flex flex-col md:flex-row gap-2 p-2 min-h-0">
          {/* ONO 99 */}
          <div className={`
          flex-1 rounded-2xl p-3 flex flex-col items-center justify-center
          border-2 transition-all duration-500 relative overflow-hidden
          ${(state.phase === 'ono' || state.phase === 'ono_double')
              ? 'border-cyan-500/50 bg-gradient-to-b from-cyan-950/30 to-transparent'
              : 'border-gray-800/30 bg-gray-900/10'}
          ${isMyOnoTurn ? 'ring-2 ring-green-400/30' : ''}
        `}>
            {(state.phase === 'ono' || state.phase === 'ono_double') && (
                <div className="absolute inset-0 bg-gradient-radial from-cyan-500/5 to-transparent pointer-events-none" />
            )}

            <h2 className="text-cyan-400 font-bold text-sm mb-1 flex items-center gap-2 z-10">
              🎯 ONO 99
              {(state.phase === 'ono' || state.phase === 'ono_double') && (
                  <span className="text-[9px] bg-cyan-500/80 text-white px-1.5 py-0.5 rounded-full animate-pulse font-medium">
                ● LIVE
              </span>
              )}
            </h2>

            {/* Большой счётчик */}
            <div
                className={`
              text-6xl md:text-8xl font-black mb-1 transition-all duration-500 z-10
              ${state.onoState.counter > 85 ? 'text-red-400' :
                    state.onoState.counter > 70 ? 'text-orange-400' :
                        state.onoState.counter > 50 ? 'text-yellow-300' :
                            'text-cyan-300'}
            `}
                style={{
                  textShadow: state.onoState.counter > 85
                      ? '0 0 60px rgba(239,68,68,0.6), 0 0 120px rgba(239,68,68,0.2)'
                      : '0 0 30px rgba(6,182,212,0.3)',
                  animation: state.onoState.counter > 90 ? 'pulse 0.5s infinite' : undefined,
                }}
            >
              {state.onoState.counter}
            </div>

            {/* Прогресс-бар */}
            <div className="w-3/4 max-w-[200px] h-1.5 bg-gray-800/80 rounded-full overflow-hidden mb-2 z-10">
              <div
                  className={`h-full rounded-full transition-all duration-700 ${
                      state.onoState.counter > 85 ? 'bg-gradient-to-r from-red-600 to-red-400' :
                          state.onoState.counter > 70 ? 'bg-gradient-to-r from-orange-600 to-orange-400' :
                              state.onoState.counter > 50 ? 'bg-gradient-to-r from-yellow-600 to-yellow-400' :
                                  'bg-gradient-to-r from-cyan-600 to-cyan-400'
                  }`}
                  style={{ width: `${Math.min(100, (state.onoState.counter / 99) * 100)}%` }}
              />
            </div>

            <p className="text-gray-600 text-[9px] z-10">
              Колода: {state.onoState.deck.length}
            </p>

            {state.phase === 'ono_double' && state.onoState.doublesRemaining > 0 && (
                <div className="bg-amber-600/20 border border-amber-500/30 rounded-lg px-2.5 py-1 text-amber-300 text-[11px] mt-1 z-10 animate-pulse">
                  ⚡ ×2: ещё {state.onoState.doublesRemaining}
                </div>
            )}

            <p className="text-cyan-400/60 text-xs mt-1 z-10">
              ▸ <strong className={`${onoCurrentPlayer?.id === playerId ? 'text-green-300' : 'text-cyan-300'}`}>
              {onoCurrentPlayer?.name}{onoCurrentPlayer?.id === playerId ? ' (вы)' : ''}
            </strong>
            </p>
          </div>

          {/* UNO Flip */}
          <div className={`
          flex-1 rounded-2xl p-3 flex flex-col items-center justify-center
          border-2 transition-all duration-500 relative overflow-hidden
          ${state.phase === 'uno'
              ? 'border-rose-500/50 bg-gradient-to-b from-rose-950/30 to-transparent'
              : 'border-gray-800/30 bg-gray-900/10'}
          ${isMyUnoTurn ? 'ring-2 ring-green-400/30' : ''}
        `}>
            {state.phase === 'uno' && (
                <div className="absolute inset-0 bg-gradient-radial from-rose-500/5 to-transparent pointer-events-none" />
            )}

            <h2 className="text-rose-400 font-bold text-sm mb-1 flex items-center gap-2 z-10">
              🎴 UNO Flip
              {state.phase === 'uno' && (
                  <span className="text-[9px] bg-rose-500/80 text-white px-1.5 py-0.5 rounded-full animate-pulse font-medium">
                ● LIVE
              </span>
              )}
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${
                  state.unoState.side === 'light'
                      ? 'bg-yellow-500/10 text-yellow-300 border-yellow-500/20'
                      : 'bg-purple-500/10 text-purple-300 border-purple-500/20'
              }`}>
              {state.unoState.side === 'light' ? '☀ Light' : '🌙 Dark'}
            </span>
            </h2>

            {/* Верхняя карта */}
            <div className="mb-2 z-10 scale-125 transform">
              {state.unoState.topCard ? (
                  <UnoCardView
                      card={state.unoState.topCard}
                      side={state.unoState.side}
                      isTopCard
                  />
              ) : (
                  <div className="w-16 h-24 rounded-lg border-2 border-dashed border-gray-700 flex items-center justify-center text-gray-700 text-[10px]">
                    Пусто
                  </div>
              )}
            </div>

            <p className="text-gray-600 text-[9px] z-10 mt-1">
              Колода: {state.unoState.deck.length}
            </p>

            {/* Взять карту — только если мой ход */}
            {isMyUnoTurn && (
                <button
                    onClick={handleDrawUno}
                    className={`mt-1 px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer
                         transition-all duration-200 z-10 ${
                        !hasPlayableUnoCard(myPlayer, state.unoState.topCard, state.unoState.side, state.unoState.mustDraw)
                            ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30 animate-pulse'
                            : 'bg-gray-800 hover:bg-gray-700 text-gray-400'
                    }`}
                >
                  📥 Взять карту
                </button>
            )}

            <p className="text-rose-400/60 text-xs mt-1 z-10">
              ▸ <strong className={`${unoCurrentPlayer?.id === playerId ? 'text-green-300' : 'text-rose-300'}`}>
              {unoCurrentPlayer?.name}{unoCurrentPlayer?.id === playerId ? ' (вы)' : ''}
            </strong>
            </p>
          </div>
        </div>

        {/* === РУКА ИГРОКА === */}
        <div className="bg-gray-900/95 border-t border-gray-700/30 px-3 py-2">
          {/* Панель управления */}
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2 flex-wrap">
            <span className="text-yellow-300 font-bold text-sm">
              {myPlayer.name}
            </span>
              <span className="text-[10px]">
              {Array.from({ length: 3 }).map((_, i) => (
                  <span key={i} className={i < myPlayer.lives ? 'text-red-400' : 'text-gray-800'}>♥</span>
              ))}
            </span>
              {isMyOnoTurn && (
                  <span className="text-[8px] bg-cyan-500/20 text-cyan-400 px-1.5 py-0.5 rounded-sm border border-cyan-500/20 font-semibold animate-pulse">
                ▸ ONO — ваш ход!
              </span>
              )}
              {isMyUnoTurn && (
                  <span className="text-[8px] bg-rose-500/20 text-rose-400 px-1.5 py-0.5 rounded-sm border border-rose-500/20 font-semibold animate-pulse">
                ▸ UNO — ваш ход!
              </span>
              )}
              {!isMyTurn && (
                  <span className="text-[8px] bg-gray-700/30 text-gray-500 px-1.5 py-0.5 rounded-sm border border-gray-700/30">
                ожидание...
              </span>
              )}
              
              {/* Кнопка админа */}
              {state.hostId === playerId && (
                <button
                  onClick={() => setShowAdminPanel(true)}
                  className="bg-red-900/50 text-red-400 border border-red-800/50 px-2 py-0.5 rounded text-[10px] hover:bg-red-800/50 transition flex items-center gap-1"
                >
                  👮 ADMIN
                </button>
              )}
            </div>

            <div className="flex gap-1 items-center">
              {showUnoButton && (
                  <button
                      onClick={handleSayUno}
                      className="bg-gradient-to-r from-yellow-500 to-red-500 text-white px-3 py-1 rounded-lg
                           text-[10px] font-black animate-bounce cursor-pointer shadow-md shadow-yellow-600/30"
                  >
                    UNO! 🔔
                  </button>
              )}
            </div>
          </div>

          {/* ONO карты */}
          <div className="mb-1.5">
            <div className="text-cyan-500 text-[9px] font-bold mb-0.5 flex items-center gap-1">
              🎯 ONO 99 <span className="text-cyan-700">({myPlayer.onoHand.length})</span>
              {isMyOnoTurn && <span className="text-green-400 animate-pulse">← играйте!</span>}
            </div>
            <div className="flex gap-1.5 flex-wrap justify-center min-h-[80px] items-center">
              {myPlayer.onoHand.map(card => {
                const canPlay = isMyOnoTurn && canPlayOnoCard(card, state.onoState.counter);
                return (
                    <OnoCardView
                        key={card.id}
                        card={card}
                        onClick={() => handlePlayOno(card.id)}
                        disabled={!canPlay}
                    />
                );
              })}
              {myPlayer.onoHand.length === 0 && (
                  <span className="text-gray-800 text-[10px] italic">Нет карт</span>
              )}
            </div>
          </div>

          {/* UNO карты */}
          <div>
            <div className="text-rose-500 text-[9px] font-bold mb-0.5 flex items-center gap-1">
              🎴 UNO Flip <span className="text-rose-700">({myPlayer.unoHand.length})</span>
              <span className={state.unoState.side === 'light' ? 'text-yellow-600' : 'text-purple-600'}>
              {state.unoState.side === 'light' ? '☀' : '🌙'}
            </span>
              {isMyUnoTurn && <span className="text-green-400 animate-pulse">← играйте!</span>}
            </div>
            <div className="flex gap-1.5 flex-wrap justify-center min-h-[80px] items-center">
              {myPlayer.unoHand.map(card => {
                const canPlay = isMyUnoTurn && canPlayUnoCard(card, state.unoState.topCard, state.unoState.side, state.unoState.mustDraw);
                return (
                    <UnoCardView
                        key={card.id}
                        card={card}
                        side={state.unoState.side}
                        onClick={() => handlePlayUno(card.id)}
                        disabled={!canPlay}
                    />
                );
              })}
              {myPlayer.unoHand.length === 0 && (
                  <span className="text-gray-800 text-[10px] italic">Нет карт</span>
              )}
            </div>
          </div>

          {/* Подсказка для других игроков */}
          <div className="mt-2 flex flex-wrap gap-1 justify-center">
            {state.players.filter(p => p.id !== playerId).map(p => (
                <div key={p.id} className="text-[8px] text-gray-600 flex items-center gap-1 bg-gray-800/50 rounded px-1.5 py-0.5">
                  <span>{p.name}:</span>
                  <span className="text-cyan-600">🃏{p.onoHand.length}</span>
                  <span className="text-rose-600">🎴{p.unoHand.length}</span>
                  <span>{Array.from({length: p.lives}).map((_, i) => <span key={i} className="text-red-500">♥</span>)}</span>
                </div>
            ))}
          </div>
        </div>

        {/* Chat */}
        <Chat roomCode={roomCode} senderName={myPlayer.name} />

        {/* Admin Panel */}
        {showAdminPanel && (
          <AdminPanel 
            state={state} 
            onClose={() => setShowAdminPanel(false)}
            onAction={handleAdminAction}
          />
        )}
      </div>
  );
}