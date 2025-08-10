import React from 'react';
import { ReferralData } from '@/types/referral';

interface ReferralsTabProps {
  referralData: ReferralData;
}

export const ReferralsTab: React.FC<ReferralsTabProps> = ({ referralData }) => {
  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="bg-black/40 backdrop-blur-xl border border-cyan-500/30 rounded-xl p-2">
        <div className="text-center">
          <div className="text-cyan-400 font-mono font-bold text-xs tracking-wider mb-1">YOUR REFERRALS</div>
          <div className="text-gray-400 font-mono text-xs tracking-wider">
            {referralData.totalReferrals} total • {referralData.activeReferrals} active
          </div>
        </div>
      </div>

      {/* Referral List */}
      <div className="space-y-1">
        {referralData.referrals.length > 0 ? (
          referralData.referrals.map((referral, index) => (
            <div key={referral.id} className="bg-black/40 backdrop-blur-xl border border-cyan-500/30 rounded-xl p-2">
              {/* Rank Badge */}
              <div className="absolute top-1 right-1">
                <div className="w-5 h-5 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs font-bold">#{index + 1}</span>
                </div>
              </div>
              
              <div className="flex items-center justify-between pr-6">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center">
                    <span className="text-white text-xs font-bold">{referral.username.charAt(0)}</span>
                  </div>
                  <div>
                    <div className="text-cyan-300 font-mono font-bold text-xs tracking-wider">{referral.username}</div>
                    <div className="text-gray-400 font-mono text-xs tracking-wider">
                      {new Date(referral.joinedAt).toLocaleDateString()}
                    </div>
                    <div className="text-gray-500 font-mono text-xs tracking-wider">
                      {Math.floor((Date.now() - referral.joinedAt) / (1000 * 60 * 60 * 24))} days ago
                    </div>
                    {/* Points source indicator */}
                    <div className="text-gray-500 font-mono text-xs tracking-wider">
                      {(() => {
                        switch (referral.pointSource) {
                          case 'tbc_current':
                          case 'tbc_total':
                            return '🪙 TONERS Mining';
                          case 'staking':
                            return '💎 Staking';
                          case 'stake_potential':
                            return '💰 Stake Potential';
                          case 'sbt':
                            return '🎯 SBT Tokens';
                          case 'activity':
                            return '🎯 Activity';
                          case 'new':
                          default:
                            return '🆕 New User';
                        }
                      })()}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-yellow-400 font-mono font-bold text-xs tracking-wider">
                    {(() => {
                      const pointSource = referral.pointSource;
                      const tonersCoins = referral.tonersCoins || 0;
                      const totalTonersEarned = referral.totalTonersEarned || 0;
                      
                      if (pointSource === 'tbc_current' || pointSource === 'tbc_total') {
                        return (
                          <>
                            {referral.pointsEarned.toLocaleString()}
                            <span className="text-yellow-300 text-xs ml-1">TONERS</span>
                            {tonersCoins !== totalTonersEarned && totalTonersEarned > 0 && (
                              <div className="text-xs text-gray-400">
                                Total: {totalTonersEarned.toLocaleString()} TONERS
                              </div>
                            )}
                          </>
                        );
                      } else {
                        return (
                          <>
                            {referral.pointsEarned.toLocaleString()}
                            {referral.pointsEarned === 0 && (
                              <span className="text-gray-500 text-xs ml-1">(New)</span>
                            )}
                          </>
                        );
                      }
                    })()}
                  </div>
                  <div className="text-gray-400 font-mono text-xs tracking-wider">
                    {(() => {
                      switch (referral.pointSource) {
                        case 'tbc_current':
                        case 'tbc_total':
                          return 'TONERS';
                        case 'staking':
                          return 'Staking Points';
                        case 'new':
                          return 'Getting Started';
                        default:
                          return 'Total Points';
                      }
                    })()}
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <div className={`w-1.5 h-1.5 rounded-full ${referral.isActive ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></div>
                    <span className={`text-xs font-mono tracking-wider ${referral.isActive ? 'text-green-400' : 'text-red-400'}`}>
                      {referral.isActive ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Progress Bar */}
              <div className="mt-2">
                {(() => {
                  const pointSource = referral.pointSource;
                  const gameData = referral.gameData;
                  
                  if (pointSource === 'tbc_current' || pointSource === 'tbc_total') {
                    let target = 1000;
                    if (referral.pointsEarned >= 100000) target = 1000000;
                    else if (referral.pointsEarned >= 10000) target = 100000;
                    else if (referral.pointsEarned >= 1000) target = 10000;
                    
                    const progressPercent = Math.min((referral.pointsEarned / target) * 100, 100);
                    
                    return (
                      <>
                        <div className="flex justify-between text-xs text-gray-400 font-mono mb-1">
                          <span>TONERS Progress</span>
                          <span>{Math.floor(progressPercent)}%</span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-1.5">
                          <div 
                            className="h-1.5 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full transition-all duration-300"
                            style={{ width: `${progressPercent}%` }}
                          ></div>
                        </div>
                        {gameData?.miningLevel && (
                          <div className="text-xs text-gray-500 mt-1">
                            Mining Level: {gameData.miningLevel}
                            {gameData.pointsPerSecond && gameData.pointsPerSecond > 0 && (
                              <span className="ml-2">
                                +{gameData.pointsPerSecond.toFixed(1)}/sec
                              </span>
                            )}
                          </div>
                        )}
                        {typeof referral.balance === 'number' && referral.balance > 0 && (
                          <div className="text-xs text-blue-400 mt-1">
                            TON Balance: {referral.balance.toFixed(2)} TON
                          </div>
                        )}
                      </>
                    );
                  } else {
                    const progressPercent = Math.min((referral.pointsEarned / 10000) * 100, 100);
                    return (
                      <>
                        <div className="flex justify-between text-xs text-gray-400 font-mono mb-1">
                          <span>Progress</span>
                          <span>{Math.floor(progressPercent)}%</span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-1.5">
                          <div 
                            className="h-1.5 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full transition-all duration-300"
                            style={{ width: `${progressPercent}%` }}
                          ></div>
                        </div>
                      </>
                    );
                  }
                })()}
              </div>
            </div>
          ))
        ) : (
          <div className="bg-black/40 backdrop-blur-xl border border-gray-600/30 rounded-xl p-4">
            <div className="text-center">
              <div className="text-2xl mb-2">👥</div>
              <div className="text-gray-400 font-mono font-bold text-xs tracking-wider mb-1">NO REFERRALS YET</div>
              <div className="text-gray-500 font-mono text-xs tracking-wider mb-2">
                Share your referral code to start earning rewards!
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}; 