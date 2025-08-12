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

const DownlineNode: React.FC<{ member: DownlineInfo }> = ({ member }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const hasChildren = member.children && member.children.length > 0;

  return (
    <div style={{ paddingLeft: `${(member.level - 1) * 16}px` }}>
      <div className="bg-black/30 rounded-lg p-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {hasChildren && (
            <button onClick={() => setIsOpen(!isOpen)} className="text-cyan-400">
              {isOpen ? '▼' : '▶'}
            </button>
          )}
          <div className={`w-2 h-2 rounded-full ${member.isActive ? 'bg-green-400' : 'bg-gray-500'}`} />
          <div>
            <div className="text-cyan-300 font-mono text-xs">{member.username}</div>
            <div className="text-gray-500 font-mono text-xs">
              Lvl {member.level} • {member.directReferrals} refs
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-cyan-300 font-mono text-xs">{member.totalEarned.toLocaleString()}</div>
          <div className="text-gray-500 font-mono text-xs">{member.rank}</div>
        </div>
      </div>
      {isOpen && hasChildren && (
        <div className="mt-1 space-y-1">
          {member.children.map(child => (
            <DownlineNode key={child.id} member={child} />
          ))}
        </div>
      )}
    </div>
  );
};

export const NetworkTab: React.FC<NetworkTabProps> = ({
  uplineData,
  downlineData,
  networkStats,
}) => {
  const flattenDownline = (nodes: DownlineInfo[]): DownlineInfo[] => {
    return nodes.reduce((acc, node) => {
      acc.push(node);
      if (node.children) {
        acc.push(...flattenDownline(node.children));
      }
      return acc;
    }, [] as DownlineInfo[]);
  };

  const allDownlineMembers = flattenDownline(downlineData);
  const activeMembers = allDownlineMembers.filter(m => m.isActive).length;
  const totalNetworkEarnings = allDownlineMembers.reduce((sum, m) => sum + m.totalEarned, 0);
  const averageEarnings = allDownlineMembers.length ? Math.floor(totalNetworkEarnings / allDownlineMembers.length) : 0;
  const topEarner = allDownlineMembers.reduce((max, m) => m.totalEarned > max.totalEarned ? m : max, { totalEarned: 0 });

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
                <div className="text-cyan-300 font-bold">{totalNetworkEarnings.toLocaleString()}</div>
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
                <DownlineNode key={member.id} member={member} />
              ))}
              
              {/* Quick Stats */}
              <div className="mt-2 pt-2 border-t border-cyan-500/20">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="text-gray-400">
                    Top Earner: <span className="text-cyan-300">{topEarner.username} ({topEarner.totalEarned.toLocaleString()})</span>
                  </div>
                  <div className="text-right text-gray-400">
                    Active Rate: <span className="text-cyan-300">{allDownlineMembers.length > 0 ? Math.round((activeMembers / allDownlineMembers.length) * 100) : 0}%</span>
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