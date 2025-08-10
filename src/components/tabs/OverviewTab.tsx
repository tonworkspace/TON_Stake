import React from 'react';
import { REFERRAL_REWARDS, ReferralData, ReferralReward } from '@/types/referral';

interface OverviewTabProps {
  referralData: ReferralData;
  copyReferralCode: () => void;
  shareReferral: () => void;
  copied: boolean;
  showQR: boolean;
  setShowQR: (show: boolean) => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  referralData,
  copyReferralCode,
  shareReferral,
  copied,
  showQR,
  setShowQR
}) => {
  const currentLevel = REFERRAL_REWARDS.find((r: ReferralReward) => r.level === referralData.level) || REFERRAL_REWARDS[0];
  const nextLevel = REFERRAL_REWARDS.find((r: ReferralReward) => r.level === referralData.level + 1);

  return (
    <div className="space-y-4">
      {/* Referral Code */}
      <div className="bg-gradient-to-br from-purple-900/50 to-purple-800/50 backdrop-blur-xl border border-purple-400/40 rounded-2xl p-6">
        <div className="text-center">
          <div className="text-purple-400 font-bold text-base mb-3">🎯 YOUR REFERRAL CODE</div>
          <div className="bg-black/30 rounded-xl p-4 mb-4">
            <div className="text-2xl font-bold text-purple-300 tracking-wider mb-2 font-mono">{referralData.code}</div>
            <div className="text-purple-200 text-sm">Share this code to invite friends!</div>
          </div>
          <div className="flex gap-3 justify-center">
            <button
              onClick={copyReferralCode}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-xl transition-all duration-300"
            >
              {copied ? '✅ COPIED!' : '📋 COPY CODE'}
            </button>
            <button
              onClick={shareReferral}
              className="px-6 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-medium rounded-xl transition-all duration-300"
            >
              🚀 SHARE NOW
            </button>
          </div>
        </div>
      </div>

      {/* Current Level */}
      <div className="bg-gradient-to-br from-yellow-900/50 to-yellow-800/50 backdrop-blur-xl border border-yellow-400/40 rounded-2xl p-6">
        <div className="text-center">
          <div className="text-4xl mb-3">{currentLevel.icon}</div>
          <div className="text-yellow-400 font-bold text-xl mb-2">{currentLevel.name}</div>
          <div className="text-yellow-300 text-base mb-4">
            Level {currentLevel.level} • {referralData.totalReferrals}/{currentLevel.requirements} friends invited
          </div>
          
          {/* Progress Bar */}
          <div className="relative w-full bg-gray-700 rounded-full h-3 mb-4">
            <div 
              className="h-full bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.min((referralData.totalReferrals / currentLevel.requirements) * 100, 100)}%` }}
            />
          </div>
          
          {nextLevel ? (
            <div className="bg-black/30 rounded-lg p-3">
              <div className="text-yellow-400 font-bold">{nextLevel.name}</div>
              <div className="text-gray-400 text-sm">
                Just {nextLevel.requirements - referralData.totalReferrals} more friends needed! 🎯
              </div>
            </div>
          ) : (
            <div className="bg-gradient-to-r from-gold-500/20 to-yellow-500/20 rounded-lg p-3">
              <div className="text-gold-400 font-bold text-lg">🏆 MAX LEVEL ACHIEVED!</div>
              <div className="text-gold-300 text-sm">You're a Referral Master!</div>
            </div>
          )}
        </div>
      </div>

      {/* QR Code */}
      {showQR && (
        <div className="bg-gradient-to-br from-purple-900/60 to-purple-800/60 backdrop-blur-xl border border-purple-400/40 rounded-2xl p-6">
          <div className="text-center">
            <div className="text-purple-400 font-bold text-lg mb-4">📱 QR CODE</div>
            <div className="bg-white rounded-2xl p-6 mb-4 inline-block">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(`https://t.me/Tonstak3it_bot/start?startapp=${referralData.code}`)}`}
                alt="Referral QR Code"
                className="w-60 h-60 mx-auto rounded-xl"
              />
            </div>
            <button
              onClick={() => setShowQR(false)}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-xl transition-all duration-300"
            >
              HIDE QR CODE
            </button>
          </div>
        </div>
      )}
    </div>
  );
}; 