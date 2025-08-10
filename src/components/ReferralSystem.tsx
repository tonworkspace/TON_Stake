import React, { useState, useCallback, useEffect } from 'react';
import { GiPerson } from 'react-icons/gi';
import { BiLink } from 'react-icons/bi';
import { useAuth } from '@/hooks/useAuth';
import { useReferralIntegration } from '@/hooks/useReferralIntegration';
import { supabase } from '@/lib/supabaseClient';
import { UplineInfo, DownlineInfo } from '../types/referral';
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

interface ReferrerData {
  id: string | number;
  username: string;
  rank: string;
  total_earned: number;
  created_at: string;
  is_active: boolean;
  referrer_id: string | null;
}

interface SupabaseResponse {
  data: {
    id: string;
    username: string;
    rank: string;
    total_earned: number;
    created_at: string;
    is_active: boolean;
    referrer_id: string | null;
    referrer: ReferrerData;
  } | null;
  error: any;
}

interface ReferralResponse {
  data: Array<{
    referred: {
      id: string | number;
      username: string;
      rank: string;
      total_earned: number;
      created_at: string;
      is_active: boolean;
      direct_referrals: number;
    };
  }> | null;
  error: any;
}

export const ReferralSystem: React.FC = () => {
  const { user } = useAuth();
  const { 
    referralData,
    loadReferralData
  } = useReferralIntegration();
  
  const [activeTab, setActiveTab] = useState('share');
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  
  const [uplineData, setUplineData] = useState<UplineInfo[]>([]);
  const [downlineData, setDownlineData] = useState<DownlineInfo[]>([]);
  const [networkStats, setNetworkStats] = useState({
    totalNetworkSize: 0,
    totalNetworkEarnings: 0,
    networkLevels: 0,
    yourPosition: 0
  });

  // Load data
  useEffect(() => {
    let mounted = true;
    
    const loadData = async () => {
      if (!user?.id || !mounted) return;
      
      try {
        await loadReferralData();
        if (mounted) setDataLoaded(true);
      } catch (error) {
        console.error('Error loading referral data:', error);
        if (mounted) setDataLoaded(true);
      }
    };

    loadData();
    return () => { mounted = false; };
  }, [user?.id, loadReferralData]);

  // Load network data
  useEffect(() => {
    if (dataLoaded && user?.id) {
      loadNetworkData();
    }
  }, [user?.id, dataLoaded]);

  const loadNetworkData = useCallback(async () => {
    if (!user?.id) return;

    try {
      // Load upline data
      const uplineResponse: SupabaseResponse = await supabase
        .from('users')
        .select(`
          id,
          username,
          rank,
          total_earned,
          created_at,
          is_active,
          referrer_id,
          referrer:users!referrer_id(
            id,
            username,
            rank,
            total_earned,
            created_at,
            is_active,
            referrer_id
          )
        `)
        .eq('id', user.id)
        .single();

      let uplineArray: UplineInfo[] = [];
      if (uplineResponse.data?.referrer_id) {
        const referrerData = uplineResponse.data.referrer;
        uplineArray.push({
          id: referrerData.id.toString(),
          username: referrerData.username,
          rank: referrerData.rank || 'Novice',
          totalEarned: referrerData.total_earned || 0,
          joinedAt: new Date(referrerData.created_at).getTime(),
          isActive: referrerData.is_active,
          level: 1
        });
      }

      // Load downline data
      const downlineResponse: ReferralResponse = await supabase
        .from('referrals')
        .select(`
          *,
          referred:users!referred_id(
            id,
            username,
            rank,
            total_earned,
            created_at,
            is_active,
            direct_referrals
          )
        `)
        .eq('referrer_id', user.id);

      // Process downline data
      const downlineArray: DownlineInfo[] = downlineResponse.data?.map(ref => ({
        id: ref.referred.id.toString(),
        username: ref.referred.username,
        rank: ref.referred.rank || 'Novice',
        totalEarned: ref.referred.total_earned || 0,
        joinedAt: new Date(ref.referred.created_at).getTime(),
        isActive: ref.referred.is_active,
        level: 1,
        directReferrals: ref.referred.direct_referrals || 0
      })) || [];

      // Update states
      setUplineData(uplineArray);
      setDownlineData(downlineArray);
      setNetworkStats({
        totalNetworkSize: downlineArray.length,
        totalNetworkEarnings: downlineArray.reduce((sum, m) => sum + m.totalEarned, 0),
        networkLevels: Math.max(...downlineArray.map(m => m.level), 0),
        yourPosition: uplineArray.length + 1
      });

    } catch (error) {
      console.error('Error loading network data:', error);
    }
  }, [user?.id]);

  const copyReferralCode = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(referralData.code);
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
    </div>
  );
};