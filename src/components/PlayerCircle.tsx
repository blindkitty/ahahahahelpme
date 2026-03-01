// =============================================
// PlayerCircle.tsx — Отображение игроков по кругу (онлайн)
// =============================================

import { Player, GameState } from '../game/gameLogic';

interface PlayerCircleProps {
  state: GameState;
  viewingPlayerId: string; // ID текущего локального игрока
}

const AVATARS = ['🦊', '🐼', '🦁', '🐸', '🦋', '🐙'];

export function PlayerCircle({ state, viewingPlayerId }: PlayerCircleProps) {
  const onoCurrentId = state.players[state.onoState.currentPlayerIndex]?.id;
  const unoCurrentId = state.players[state.unoState.currentPlayerIndex]?.id;

  return (
    <div className="flex items-center justify-center gap-2 flex-wrap">
      {state.players.map((player: Player, idx: number) => {
        const isOnoActive = player.id === onoCurrentId && (state.phase === 'ono' || state.phase === 'ono_double');
        const isUnoActive = player.id === unoCurrentId && state.phase === 'uno';
        const isMe = player.id === viewingPlayerId;
        const isOnoNext = player.id === onoCurrentId;
        const isUnoNext = player.id === unoCurrentId;

        return (
          <div
            key={player.id}
            className={`
              relative flex flex-col items-center p-2 rounded-xl
              transition-all duration-300
              ${isMe ? 'bg-yellow-500/10 ring-1 ring-yellow-500/30' : ''}
              ${(isOnoActive || isUnoActive) && !isMe ? 'bg-white/5' : ''}
              ${isOnoActive || isUnoActive ? 'scale-110' : 'scale-100'}
            `}
          >
            {/* Индикаторы текущего хода */}
            <div className="flex gap-1 absolute -top-2">
              {isOnoNext && (
                <span className="px-1.5 py-0.5 bg-cyan-500 text-[8px] text-white rounded-full font-bold animate-pulse">
                  ONO
                </span>
              )}
              {isUnoNext && (
                <span className="px-1.5 py-0.5 bg-rose-500 text-[8px] text-white rounded-full font-bold animate-pulse">
                  UNO
                </span>
              )}
            </div>

            {/* Аватар */}
            <div className={`
              w-10 h-10 rounded-full flex items-center justify-center text-xl
              border-2 transition-colors duration-300
              ${isOnoActive ? 'border-cyan-400 shadow-lg shadow-cyan-400/50' : ''}
              ${isUnoActive ? 'border-rose-400 shadow-lg shadow-rose-400/50' : ''}
              ${!isOnoActive && !isUnoActive ? (isMe ? 'border-yellow-500/50' : 'border-gray-600') : ''}
              ${!player.isAlive ? 'opacity-40 grayscale' : ''}
            `}
            style={{
              background: isOnoActive
                ? 'linear-gradient(135deg, rgba(6,182,212,0.3), rgba(6,182,212,0.1))'
                : isUnoActive
                  ? 'linear-gradient(135deg, rgba(244,63,94,0.3), rgba(244,63,94,0.1))'
                  : isMe
                    ? 'linear-gradient(135deg, rgba(234,179,8,0.2), rgba(234,179,8,0.05))'
                    : 'rgba(255,255,255,0.05)',
            }}
            >
              {AVATARS[idx] || '👤'}
            </div>

            {/* Имя */}
            <span className={`text-[10px] mt-0.5 font-medium
              ${isMe ? 'text-yellow-300' : 'text-gray-400'}
            `}>
              {player.name}{isMe ? ' (вы)' : ''}
            </span>

            {/* Жизни */}
            <div className="flex gap-0.5 mt-0.5">
              {Array.from({ length: 3 }).map((_, i) => (
                <span key={i} className={`text-[8px] ${i < player.lives ? 'text-red-400' : 'text-gray-700'}`}>
                  ❤️
                </span>
              ))}
            </div>

            {/* Количество карт (для всех видно) */}
            <div className="flex gap-1 mt-0.5 text-[8px] text-gray-500">
              <span title="Карты ONO">🃏{player.onoHand.length}</span>
              <span title="Карты UNO">🎴{player.unoHand.length}</span>
            </div>

            {/* UNO! */}
            {player.unoHand.length === 1 && player.saidUno && (
              <span className="absolute -bottom-1 text-[10px] text-yellow-400 font-bold animate-bounce">
                UNO!
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
