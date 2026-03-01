// =============================================
// UnoCardView.tsx — Компонент карты UNO Flip
// =============================================

import { UnoCard, UnoSide, getActiveSide, COLOR_MAP } from '../game/cards';

interface UnoCardViewProps {
  card: UnoCard;
  side: UnoSide;
  onClick?: () => void;
  disabled?: boolean;
  small?: boolean;
  faceDown?: boolean;
  isTopCard?: boolean;
}

export function UnoCardView({ card, side, onClick, disabled, small, faceDown, isTopCard }: UnoCardViewProps) {
  if (faceDown) {
    return (
      <div className={`
        ${small ? 'w-12 h-18' : 'w-16 h-24'} 
        rounded-lg border-2 border-rose-500/50
        bg-gradient-to-br from-gray-800 to-gray-900
        flex items-center justify-center
        shadow-lg shadow-rose-500/20
        select-none
      `}>
        <span className="text-rose-400 text-xs font-bold">UNO</span>
      </div>
    );
  }

  const cardSide = getActiveSide(card, side);
  const color = cardSide.color === 'wild' 
    ? (card.chosenColor ? COLOR_MAP[card.chosenColor] : COLOR_MAP.wild)
    : COLOR_MAP[cardSide.color] || '#666';

  const isWild = cardSide.color === 'wild';

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        ${small ? 'w-12 h-18' : 'w-16 h-24'} 
        rounded-lg border-2
        ${disabled ? 'border-gray-600 opacity-50 cursor-not-allowed' : 'border-white/30 cursor-pointer hover:border-white/60 hover:-translate-y-2 hover:shadow-xl'}
        flex flex-col items-center justify-center
        shadow-lg
        transition-all duration-200
        select-none
        relative overflow-hidden
        ${isTopCard ? 'ring-2 ring-white/50' : ''}
      `}
      style={{ 
        background: isWild 
          ? `linear-gradient(135deg, #EF4444 25%, #3B82F6 25%, #3B82F6 50%, #22C55E 50%, #22C55E 75%, #EAB308 75%)`
          : `linear-gradient(135deg, ${color}, ${color}dd)`,
        boxShadow: `0 4px 15px ${color}40`,
      }}
    >
      <div className="absolute inset-0 bg-white/10 rounded-lg" />
      
      {/* Метка стороны */}
      <span className="absolute top-0.5 left-1 text-[8px] text-white/50 z-10">
        {side === 'light' ? '☀' : '🌙'}
      </span>

      {/* Выбранный цвет для wild */}
      {isWild && card.chosenColor && (
        <div 
          className="absolute top-0.5 right-1 w-3 h-3 rounded-full border border-white/50 z-10"
          style={{ background: COLOR_MAP[card.chosenColor] }}
        />
      )}

      <span className={`
        ${small ? 'text-lg' : 'text-xl'} font-black text-white drop-shadow-lg z-10
      `}>
        {cardSide.label}
      </span>
      
      {cardSide.type !== 'number' && (
        <span className="text-[8px] text-white/70 z-10 mt-0.5">
          {getTypeLabel(cardSide.type)}
        </span>
      )}
    </button>
  );
}

function getTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    'draw_one': '+1',
    'draw_five': '+5',
    'reverse': 'REV',
    'skip': 'SKIP',
    'skip_everyone': 'SKIP ALL',
    'flip': 'FLIP',
    'wild': 'WILD',
    'wild_draw_two': 'W+2',
    'wild_draw_color': 'W+CLR',
  };
  return labels[type] || type;
}
