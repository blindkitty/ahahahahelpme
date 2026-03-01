// =============================================
// ColorPicker.tsx — Выбор цвета для Wild карт
// =============================================

import { UnoColor, UnoSide, COLOR_MAP } from '../game/cards';

interface ColorPickerProps {
  side: UnoSide;
  onSelect: (color: UnoColor) => void;
}

export function ColorPicker({ side, onSelect }: ColorPickerProps) {
  const colors: UnoColor[] = side === 'light' 
    ? ['red', 'blue', 'green', 'yellow'] 
    : ['pink', 'teal', 'orange', 'purple'];

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-gray-900 border border-cyan-500/50 rounded-2xl p-6 shadow-2xl shadow-cyan-500/20">
        <h3 className="text-white text-lg font-bold mb-4 text-center">
          🎨 Выберите цвет
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {colors.map(color => (
            <button
              key={color}
              onClick={() => onSelect(color)}
              className="w-20 h-20 rounded-xl border-2 border-white/20 
                         hover:border-white/60 hover:scale-110
                         transition-all duration-200 cursor-pointer
                         flex items-center justify-center
                         text-white font-bold text-sm capitalize"
              style={{ 
                background: COLOR_MAP[color],
                boxShadow: `0 0 20px ${COLOR_MAP[color]}60`,
              }}
            >
              {color}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
