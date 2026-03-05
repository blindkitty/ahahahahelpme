import { useState } from 'react';
import { GameState, Player } from '../game/gameLogic';

interface AdminPanelProps {
  state: GameState;
  onAction: (action: string, payload?: any) => void;
  onClose: () => void;
}

export function AdminPanel({ state, onAction, onClose }: AdminPanelProps) {
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');

  const handleNameSave = (playerId: string) => {
    if (newName.trim()) {
      onAction('changeName', { playerId, newName: newName.trim() });
    }
    setEditingPlayerId(null);
    setNewName('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-lg shadow-2xl relative">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-white"
        >
          ✕
        </button>

        <h2 className="text-xl font-bold text-red-400 mb-6 flex items-center gap-2">
          👮 Панель администратора
        </h2>

        {/* Управление игрой */}
        <div className="mb-6">
          <h3 className="text-gray-400 text-xs uppercase font-bold mb-2">Управление игрой</h3>
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (confirm('Перезапустить игру? Все текущие очки сбросятся.')) {
                  onAction('restartGame');
                }
              }}
              className="bg-yellow-600/20 text-yellow-500 border border-yellow-600/50 px-3 py-2 rounded text-xs font-bold hover:bg-yellow-600/30 transition"
            >
              🔄 Рестарт игры
            </button>
            <button
              onClick={() => onAction('skipTurn')}
              className="bg-cyan-600/20 text-cyan-500 border border-cyan-600/50 px-3 py-2 rounded text-xs font-bold hover:bg-cyan-600/30 transition"
            >
              ⏭️ Скипнуть ход
            </button>
          </div>
        </div>

        {/* Список игроков */}
        <div>
          <h3 className="text-gray-400 text-xs uppercase font-bold mb-2">Игроки ({state.players.length})</h3>
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
            {state.players.map(p => (
              <div key={p.id} className="bg-gray-800/50 rounded-lg p-2 flex items-center justify-between border border-gray-700">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${p.isAlive ? 'bg-green-500' : 'bg-red-500'}`} />
                  
                  {editingPlayerId === p.id ? (
                    <div className="flex gap-1">
                      <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        className="bg-gray-950 border border-gray-600 rounded px-2 py-0.5 text-xs text-white w-32 focus:outline-none focus:border-cyan-500"
                        placeholder="Новое имя"
                        autoFocus
                      />
                      <button 
                        onClick={() => handleNameSave(p.id)}
                        className="text-green-400 text-xs hover:text-green-300"
                      >
                        ✓
                      </button>
                      <button 
                        onClick={() => setEditingPlayerId(null)}
                        className="text-gray-500 text-xs hover:text-gray-300"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <span className={`text-sm ${p.isAlive ? 'text-white' : 'text-gray-500 line-through'}`}>
                      {p.name}
                    </span>
                  )}
                  
                  {p.id === state.hostId && (
                    <span className="text-[9px] bg-yellow-500/20 text-yellow-500 px-1 rounded border border-yellow-500/30">
                      HOST
                    </span>
                  )}
                </div>

                <div className="flex gap-1">
                  {editingPlayerId !== p.id && (
                    <button
                      onClick={() => {
                        setEditingPlayerId(p.id);
                        setNewName(p.name);
                      }}
                      className="p-1 text-cyan-400 hover:bg-cyan-900/30 rounded"
                      title="Изменить имя"
                    >
                      ✏️
                    </button>
                  )}
                  
                  {p.isAlive && (
                    <button
                      onClick={() => {
                        if (confirm(`Исключить игрока ${p.name} из раунда?`)) {
                          onAction('killPlayer', { playerId: p.id });
                        }
                      }}
                      className="p-1 text-red-400 hover:bg-red-900/30 rounded"
                      title="Убить/Кикнуть"
                    >
                      💀
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
