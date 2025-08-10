import React from 'react';
import { UplineInfo, DownlineInfo } from '@/types/referral';

interface NetworkTabProps {
  uplineData: UplineInfo[];
  downlineData: DownlineInfo[];
  networkStats: {
    totalNetworkSize: number;
    totalNetworkEarnings: number;
    networkLevels: number;
    yourPosition: number;
  };
  user: any;
}

export const NetworkTab: React.FC<NetworkTabProps> = ({
  uplineData,
  downlineData,
  networkStats,
}) => {
  // Calculate additional stats
  const activeMembers = downlineData.filter(m => m.isActive).length;
  const totalDirectEarnings = downlineData.reduce((sum, m) => sum + (m.isActive ? m.totalEarned : 0), 0);
  const averageEarnings = downlineData.length ? Math.floor(totalDirectEarnings / downlineData.length) : 0;
  const topEarner = downlineData.reduce((max, m) => m.totalEarned > max.totalEarned ? m : max, { totalEarned: 0 });
  
  return (
    <div className="space-y-2">
      {/* Enhanced Network Overview */}
      <div className="bg-black/40 backdrop-blur-xl border border-cyan-500/30 rounded-xl p-3">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-black/30 rounded-lg p-2">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-gray-400">Total</div>
                <div className="text-cyan-300 font-bold">{networkStats.totalNetworkSize}</div>
              </div>
              <div>
                <div className="text-gray-400">Active</div>
                <div className="text-green-400 font-bold">{activeMembers}</div>
              </div>
            </div>
          </div>
          <div className="bg-black/30 rounded-lg p-2">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-gray-400">Earnings</div>
                <div className="text-cyan-300 font-bold">{totalDirectEarnings.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-gray-400">Avg</div>
                <div className="text-cyan-300 font-bold">{averageEarnings.toLocaleString()}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Downline List */}
      <div className="bg-black/40 backdrop-blur-xl border border-cyan-500/30 rounded-xl p-3">
        <div className="space-y-2">
          {downlineData.length > 0 ? (
            <>
              {downlineData.map((member) => (
                <div key={member.id} className="bg-black/30 rounded-lg p-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${member.isActive ? 'bg-green-400' : 'bg-gray-500'}`} />
                    <div>
                      <div className="text-cyan-300 font-mono text-xs">{member.username}</div>
                      <div className="text-gray-500 font-mono text-xs">
                        {Math.floor((Date.now() - member.joinedAt) / (1000 * 60 * 60 * 24))}d • {member.directReferrals} refs
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-cyan-300 font-mono text-xs">{member.totalEarned.toLocaleString()}</div>
                    <div className="text-gray-500 font-mono text-xs">{member.rank}</div>
                  </div>
                </div>
              ))}
              
              {/* Quick Stats */}
              <div className="mt-2 pt-2 border-t border-cyan-500/20">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="text-gray-400">
                    Top Earner: <span className="text-cyan-300">{topEarner.totalEarned.toLocaleString()}</span>
                  </div>
                  <div className="text-right text-gray-400">
                    Active Rate: <span className="text-cyan-300">{Math.round((activeMembers / downlineData.length) * 100)}%</span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-4">
              <div className="text-gray-400 text-xs">No referrals yet</div>
              <div className="text-cyan-300 text-xs mt-1">Share your code to start earning!</div>
            </div>
          )}
        </div>
      </div>

      {/* Upline Info */}
      {uplineData.length > 0 && (
        <div className="bg-black/40 backdrop-blur-xl border border-cyan-500/30 rounded-xl p-3">
          <div className="text-xs text-gray-400 mb-2">Referred by</div>
          {uplineData.map((member) => (
            <div key={member.id} className="bg-black/30 rounded-lg p-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${member.isActive ? 'bg-green-400' : 'bg-gray-500'}`} />
                <div className="text-cyan-300 font-mono text-xs">{member.username}</div>
              </div>
              <div className="text-gray-400 font-mono text-xs">{member.rank}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}; 