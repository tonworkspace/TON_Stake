import React from 'react';
import { ReferralData, ReferralReward, REFERRAL_REWARDS } from '@/types/referral';

interface RewardsTabProps {
  referralData: ReferralData;
  claimedRewards: string[];
  claimReward: (reward: ReferralReward) => void;
  isClaimingReward: boolean;
}

export const RewardsTab: React.FC<RewardsTabProps> = ({
  referralData,
  claimedRewards,
  claimReward,
  isClaimingReward
}) => {
  return (
    <div className="space-y-1">
      {/* Header */}
      <div className="bg-black/40 backdrop-blur-xl border border-cyan-500/30 rounded-xl p-2">
        <div className="text-center">
          <div className="text-cyan-400 font-mono font-bold text-xs tracking-wider mb-1">REWARD STATUS</div>
          <div className="text-cyan-300 font-mono text-xs tracking-wider">
            Total Referrals: {referralData.totalReferrals} | Claimed: {claimedRewards.length}
          </div>
        </div>
      </div>

      {/* Rewards List */}
      {REFERRAL_REWARDS.map((reward) => {
        const isUnlocked = referralData.totalReferrals >= reward.requirements;
        const isClaimed = claimedRewards.includes(`${reward.level}_${reward.requirements}`);
        const canClaim = isUnlocked && !isClaimed && !isClaimingReward;
        
        return (
          <div 
            key={reward.level} 
            className={`bg-black/40 backdrop-blur-xl border rounded-xl p-2 transition-all duration-300 ${
              isUnlocked 
                ? 'border-green-400/30 shadow-[0_0_20px_rgba(34,197,94,0.1)]' 
                : 'border-gray-600/30'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="text-lg">{reward.icon}</div>
                <div>
                  <div className={`font-mono font-bold text-xs tracking-wider ${
                    isUnlocked ? 'text-green-400' : 'text-gray-400'
                  }`}>
                    {reward.name}
                  </div>
                  <div className="text-gray-400 font-mono text-xs tracking-wider">
                    {reward.requirements} referrals required
                  </div>
                  <div className="text-gray-500 font-mono text-xs tracking-wider">
                    Progress: {Math.min(referralData.totalReferrals, reward.requirements)}/{reward.requirements}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-yellow-400 font-mono font-bold text-xs tracking-wider">
                  +{reward.rewards.points} pts, +{reward.rewards.gems} gems
                </div>
                {reward.rewards.special && (
                  <div className="text-purple-400 font-mono text-xs tracking-wider">
                    {reward.rewards.special}
                  </div>
                )}
                {canClaim && (
                  <button
                    onClick={() => claimReward(reward)}
                    disabled={isClaimingReward}
                    className="mt-1 px-2 py-1 bg-green-600 hover:bg-green-500 text-white font-mono text-xs font-bold tracking-wider rounded-lg transition-all duration-300 border border-green-400 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isClaimingReward ? 'CLAIMING...' : 'CLAIM'}
                  </button>
                )}
                {isClaimed && (
                  <div className="text-green-400 text-xs font-mono tracking-wider mt-1">✓ CLAIMED</div>
                )}
                {!isUnlocked && (
                  <div className="text-gray-500 text-xs font-mono tracking-wider mt-1">
                    Need {reward.requirements - referralData.totalReferrals} more
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}; 