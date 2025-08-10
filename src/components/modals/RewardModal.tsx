import React from 'react';

interface RewardModalProps {
  message: string;
  onClose: () => void;
}

export const RewardModal: React.FC<RewardModalProps> = ({ message, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-4 sm:p-6">
      <div className="relative bg-gradient-to-br from-black/95 to-gray-900/95 backdrop-blur-2xl rounded-2xl p-6 sm:p-8 text-center w-full max-w-md mx-4 border border-cyan-400/40 shadow-[0_0_40px_rgba(0,255,255,0.4)] animate-fadeIn">
        <div className="text-5xl sm:text-6xl mb-4 animate-bounce">
          {message.includes('🚫') ? '❌' : '🎉'}
        </div>
        
        <h3 className="text-white font-bold text-xl sm:text-2xl mb-4 tracking-wide">
          {message.includes('🚫') ? 'REWARD UNAVAILABLE' : 'REWARD UNLOCKED!'}
        </h3>
        
        <div className="bg-gradient-to-br from-cyan-500/20 to-blue-500/20 backdrop-blur-xl rounded-xl p-4 sm:p-5 border border-cyan-400/40 mb-6">
          <p className="text-cyan-200 text-sm sm:text-base leading-relaxed whitespace-pre-line">
            {message}
          </p>
        </div>
        
        <button
          onClick={onClose}
          className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-bold text-lg rounded-xl tracking-wide hover:from-cyan-500 hover:to-blue-500 active:scale-95 transition-all duration-300 shadow-[0_0_25px_rgba(0,255,255,0.4)] hover:shadow-[0_0_35px_rgba(0,255,255,0.6)] min-h-[48px]"
        >
          {message.includes('🚫') ? '✅ UNDERSTOOD' : '🚀 AWESOME! ✨'}
        </button>
      </div>
    </div>
  );
}; 