import React, { useState, useCallback, useEffect } from 'react';
import { GiPerson } from 'react-icons/gi';
import { BiLink } from 'react-icons/bi';
import { useAuth } from '@/hooks/useAuth';
import { useReferralIntegration } from '@/hooks/useReferralIntegration';
import { DownlineInfo } from '../types/referral';
import { NetworkTab, ShareTab } from './tabs';
import './ReferralSystem.css';

// Enhanced Header with Stats
const ReferralHeader: React.FC<{
  networkStats: {
    totalNetworkSize: number;
    totalNetworkEarnings: number;
    networkLevels: number;
    yourPosition: number;
  };
}> = ({ networkStats }) => (
  <div className="bg-black/40 backdrop-blur-xl border border-cyan-500/30 rounded-xl p-3">
    <div className="text-center mb-3">
      <span className="text-cyan-400 font-bold tracking-wider text-sm">REFERRAL NETWORK</span>
    </div>
    <div className="grid grid-cols-4 gap-2 text-center text-xs">
      <div>
        <div className="text-cyan-300">Network</div>
        <div className="text-cyan-100 font-bold">{networkStats.totalNetworkSize}</div>
      </div>
      <div>
        <div className="text-cyan-300">Earnings</div>
        <div className="text-cyan-100 font-bold">{networkStats.totalNetworkEarnings.toLocaleString()}</div>
      </div>
      <div>
        <div className="text-cyan-300">Levels</div>
        <div className="text-cyan-100 font-bold">{networkStats.networkLevels}</div>
      </div>
      <div>
        <div className="text-cyan-300">Position</div>
        <div className="text-cyan-100 font-bold">{networkStats.yourPosition}</div>
      </div>
    </div>
  </div>
);

interface NavigationTabsProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  downlineCount: number;
}

const NavigationTabs: React.FC<NavigationTabsProps> = ({ activeTab, setActiveTab, downlineCount }) => {
  const tabs = [
    { id: 'share', name: 'Share', icon: BiLink, info: 'Invite' },
    { id: 'network', name: 'Network', icon: GiPerson, info: `${downlineCount} Members` },
  ];

  return (
    <div className="bg-black/40 backdrop-blur-xl rounded-xl p-2 border border-cyan-500/30">
      <div className="grid grid-cols-2 gap-2">
        {tabs.map(({ id, name, icon: Icon, info }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex flex-col items-center justify-center gap-1 py-2 px-3 rounded-xl font-medium text-sm transition-all duration-300 ${
              activeTab === id
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white'
                : 'bg-black/40 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20'
            }`}
          >
            <div className="flex items-center gap-2">
              <Icon size={16} />
              <span>{name}</span>
            </div>
            <div className="text-xs opacity-80">{info}</div>
          </button>
        ))}
      </div>
    </div>
  );
};

export const ReferralSystem: React.FC = () => {
  const { user } = useAuth();
  const { 
    referralData,
    loadReferralData,
    uplineData,
    debugInfo,
    forceRefreshReferralData
  } = useReferralIntegration();
  
  const [activeTab, setActiveTab] = useState('share');
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [debugMode, setDebugMode] = useState(false);

  // Debug logging
  useEffect(() => {
    console.log('🔍 ReferralSystem Debug Info:', {
      user: user?.id,
      referralData: {
        code: referralData.code,
        totalReferrals: referralData.totalReferrals,
        activeReferrals: referralData.activeReferrals,
        referralsLength: referralData.referrals?.length || 0,
        referrals: referralData.referrals
      },
      uplineData: uplineData,
      debugInfo: debugInfo
    });
  }, [user?.id, referralData, uplineData, debugInfo]);

  // Load data
  useEffect(() => {
    let mounted = true;
    
    const loadData = async () => {
      if (!user?.id || !mounted) return;
      
      try {
        console.log('🔄 Loading referral data for user:', user.id);
        await loadReferralData();
        if (mounted) {
          setDataLoaded(true);
          console.log('✅ Referral data loaded successfully');
        }
      } catch (error) {
        console.error('❌ Error loading referral data:', error);
        if (mounted) setDataLoaded(true);
      }
    };

    loadData();
    return () => { mounted = false; };
  }, [user?.id, loadReferralData]);

  // Computed properties from hook data
  const downlineData: DownlineInfo[] = (referralData.referrals || []).map(r => ({
    id: r.id,
    username: r.username,
    rank: r.rank || 'Novice',
    totalEarned: r.total_earned || 0,
    joinedAt: r.joinedAt,
    isActive: r.isActive,
    level: 1, // Note: Level is not deeply tracked in this implementation
    directReferrals: r.direct_referrals || 0,
  }));

  const networkStats = {
    totalNetworkSize: downlineData.length,
    totalNetworkEarnings: downlineData.reduce((sum, m) => sum + m.totalEarned, 0),
    networkLevels: downlineData.length > 0 ? 1 : 0,
    yourPosition: uplineData.length + 1,
  };

  const copyReferralCode = useCallback(async () => {
    const referralLink = `https://t.me/Tonstak3it_bot/start?startapp=${referralData.code}`;
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }, [referralData.code]);

  const shareReferral = useCallback(() => {
    const referralLink = `https://t.me/Tonstak3it_bot/start?startapp=${referralData.code}`;
    
    if (navigator.share) {
      navigator.share({
        title: 'Join Toner Mining!',
        text: 'Start mining divine points and earn rewards!',
        url: referralLink
      });
    } else {
      navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [referralData.code]);

  const handleRefreshData = useCallback(async () => {
    console.log('🔄 Manual refresh triggered');
    await forceRefreshReferralData();
  }, [forceRefreshReferralData]);

  // Render loading state
  if (!dataLoaded) {
    return (
      <div className="flex-1 p-2 space-y-2">
        <div className="bg-black/40 backdrop-blur-xl border border-cyan-500/30 rounded-xl p-3 text-center">
          <div className="text-cyan-300 text-sm animate-pulse">Loading network data...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-2 space-y-2 overflow-y-auto game-scrollbar">
      {/* Debug Panel */}
      {debugMode && (
        <div className="bg-red-900/40 backdrop-blur-xl border border-red-500/30 rounded-xl p-3 text-xs">
          <div className="text-red-300 font-bold mb-2">🔧 Debug Mode</div>
          <div className="space-y-1 text-red-200">
            <div>User ID: {user?.id}</div>
            <div>Referral Code: {referralData.code || 'None'}</div>
            <div>Total Referrals: {referralData.totalReferrals}</div>
            <div>Active Referrals: {referralData.activeReferrals}</div>
            <div>Downline Data Length: {downlineData.length}</div>
            <div>Upline Data Length: {uplineData.length}</div>
            <div>Debug Info: {JSON.stringify(debugInfo, null, 2)}</div>
          </div>
          <button
            onClick={handleRefreshData}
            className="mt-2 px-3 py-1 bg-red-600 text-white rounded text-xs"
          >
            🔄 Refresh Data
          </button>
        </div>
      )}

      <ReferralHeader networkStats={networkStats} />
      <NavigationTabs 
        activeTab={activeTab} 
        setActiveTab={setActiveTab}
        downlineCount={downlineData.length}
      />
      
      {activeTab === 'network' && (
        <NetworkTab
          uplineData={uplineData}
          downlineData={downlineData}
          networkStats={networkStats}
          user={user}
        />
      )}
      {activeTab === 'share' && (
        <ShareTab
          referralData={referralData}
          copyReferralCode={copyReferralCode}
          shareReferral={shareReferral}
          copied={copied}
          showQR={showQR}
          setShowQR={setShowQR}
        />
      )}

      {/* Debug Toggle */}
      <button
        onClick={() => setDebugMode(!debugMode)}
        className="fixed bottom-4 right-4 bg-gray-800 text-white p-2 rounded-full text-xs"
        title="Toggle Debug Mode"
      >
        🔧
      </button>
    </div>
  );
};