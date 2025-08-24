import React from 'react';
import { ReferralData } from '@/types/referral';

interface ShareTabProps {
  referralData: ReferralData;
  copyReferralCode: () => void;
  shareReferral: () => void;
  copied: boolean;
  showQR: boolean;
  setShowQR: (show: boolean) => void;
}

export const ShareTab: React.FC<ShareTabProps> = ({
  referralData,
  copyReferralCode,
  copied,
  showQR,
  setShowQR
}) => {
  return (
    <div className="space-y-4">
      {/* Reward Info */}
      <div className="bg-black/40 backdrop-blur-xl border border-cyan-500/30 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-cyan-300 text-sm font-bold">Referral Rewards</div>
            <div className="text-gray-400 text-xs mt-1">Per active referral</div>
          </div>
          <div className="text-right">
            <div className="text-cyan-300 text-lg font-bold">5 STK</div>
            <div className="text-gray-400 text-xs mt-1">Daily reward</div>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-cyan-500/20">
          <div className="text-gray-400 text-xs">
            • Earn 5 STK daily for each active referral
            <br />
            • Bonus 10 STK when referral reaches level 10
            <br />
            • Extra 2 STK from sub-referrals
          </div>
        </div>
      </div>

      {/* Referral Link */}
      <div className="bg-black/40 backdrop-blur-xl border border-cyan-500/30 rounded-xl p-4">
        <div className="bg-black/40 rounded-xl p-3 mb-3 text-cyan-100 text-sm break-all font-mono">
          {`https://t.me/Tonstak3it_bot/start?startapp=${referralData.code}`}
        </div>
        <div className="flex gap-2">
          <button
            onClick={copyReferralCode}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-black/40 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20 rounded-xl"
          >
            {copied ? '✅ Copied' : '🔗 Copy'}
          </button>
          <button
            onClick={() => setShowQR(!showQR)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-black/40 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20 rounded-xl"
          >
            📱 {showQR ? 'Hide QR' : 'Show QR'}
          </button>
        </div>
      </div>

      {/* QR Code */}
      {showQR && (
        <div className="bg-black/40 backdrop-blur-xl border border-cyan-500/30 rounded-xl p-4 text-center">
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`https://t.me/Tonstak3it_bot/start?startapp=${referralData.code}`)}`}
            alt="Referral QR Code"
            className="w-40 h-40 mx-auto rounded-xl bg-white p-2 mb-2"
          />
          <div className="text-cyan-300 text-sm">Code: {referralData.code}</div>
        </div>
      )}

      {/* Share Buttons */}
      <div className="bg-black/40 backdrop-blur-xl border border-cyan-500/30 rounded-xl p-4">
        <div className="grid grid-cols-3 gap-2">
          <button 
            onClick={() => {
              const text = `🚀 Join me on TON Stake It! Earn daily rewards in $TON & $STK tokens. Start staking and build your crypto empire! 💎`;
              const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(`https://t.me/Tonstak3it_bot/start?startapp=${referralData.code}`)}`;
              window.open(url, '_blank');
            }}
            className="flex items-center justify-center gap-2 py-2 px-3 bg-black/40 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20 rounded-xl"
          >
            <div className="text-xl">🐦</div>
            <div className="text-sm">Twitter</div>
          </button>
          
          <button 
            onClick={() => {
              const text = `🌟 Hey! Join me on TON Stake It!\n\n💎 Earn daily rewards in $TON & $STK\n🔥 Stake & earn passive income\n🎮 Play & earn while staking\n\nJoin now and get started! 🚀`;
              const url = `https://t.me/share/url?url=${encodeURIComponent(`https://t.me/Tonstak3it_bot/start?startapp=${referralData.code}`)}&text=${encodeURIComponent(text)}`;
              window.open(url, '_blank');
            }}
            className="flex items-center justify-center gap-2 py-2 px-3 bg-black/40 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20 rounded-xl"
          >
            <div className="text-xl">✈️</div>
            <div className="text-sm">Telegram</div>
          </button>
          
          <button 
            onClick={() => {
              const text = `🌟 Join me on TON Stake It!\n\n💎 Earn daily rewards in $TON & $STK\n🔥 Stake & earn passive income\n🎮 Play & earn while staking\n\nJoin now and start earning! 🚀\n\nhttps://t.me/Tonstak3it_bot/start?startapp=${referralData.code}`;
              const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
              window.open(url, '_blank');
            }}
            className="flex items-center justify-center gap-2 py-2 px-3 bg-black/40 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20 rounded-xl"
          >
            <div className="text-xl">💬</div>
            <div className="text-sm">WhatsApp</div>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="bg-black/40 backdrop-blur-xl border border-cyan-500/30 rounded-xl p-4">
        <div className="grid grid-cols-2 gap-2 text-center">
          <div>
            <div className="text-cyan-300 text-sm">Friends</div>
            <div className="text-cyan-100 font-bold">{referralData.totalReferrals}</div>
          </div>
          <div>
            <div className="text-cyan-300 text-sm">STKN</div>
            <div className="text-cyan-100 font-bold">{referralData.rewards.points}</div>
          </div>
        </div>
      </div>
    </div>
  );
}; 