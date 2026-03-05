
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
      newState.gameOver = true;
      newState.winner = alivePlayers[0]?.id || null;
      newState.phase = 'waiting';
      return newState;
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
