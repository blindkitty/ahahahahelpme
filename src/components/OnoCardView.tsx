// =============================================
// OnoCardView.tsx — Компонент карты ONO 99
// =============================================

import { OnoCard } from '../game/cards';

interface OnoCardViewProps {
  card: OnoCard;
  onClick?: () => void;
  disabled?: boolean;
  small?: boolean;
  faceDown?: boolean;
}

export function OnoCardView({ card, onClick, disabled, small, faceDown }: OnoCardViewProps) {
  if (faceDown) {
    return (
      <div className={`
        ${small ? 'w-12 h-18' : 'w-16 h-24'} 
        rounded-lg border-2 border-cyan-500/50
        bg-gradient-to-br from-gray-800 to-gray-900
        flex items-center justify-center
        shadow-lg shadow-cyan-500/20
        select-none
      `}>
        <span className="text-cyan-400 text-xs font-bold">ONO</span>
      </div>
    );
  }

  // Цвет фона по типу карты
  const getBg = () => {
    switch (card.type) {
      case 'reverse': return 'from-purple-600 to-purple-800';
      case 'skip': return 'from-red-600 to-red-800';
      case 'double': return 'from-amber-500 to-amber-700';
      default:
        if (card.value === -10) return 'from-emerald-600 to-emerald-800';
        if (card.value === 0) return 'from-gray-500 to-gray-700';
        return 'from-cyan-600 to-cyan-800';
    }
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        ${small ? 'w-12 h-18' : 'w-16 h-24'} 
        rounded-lg border-2 
        ${disabled ? 'border-gray-600 opacity-50 cursor-not-allowed' : 'border-cyan-400 cursor-pointer hover:border-cyan-300 hover:-translate-y-2 hover:shadow-xl hover:shadow-cyan-400/30'}
        bg-gradient-to-br ${getBg()}
        flex items-center justify-center
        shadow-lg shadow-cyan-500/20
        transition-all duration-200
        select-none
        relative overflow-hidden
      `}
    >
      {/* Свечение */}
      <div className="absolute inset-0 bg-white/5 rounded-lg" />
      <span className={`
        ${small ? 'text-lg' : 'text-xl'} font-black text-white drop-shadow-lg z-10
      `}>
        {card.label}
      </span>
    </button>
  );
}
