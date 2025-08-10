import React, { useState, useEffect, useCallback } from 'react';
import { GiCrown, GiTrophy, GiMedal, GiLightningArc, GiDiamonds } from 'react-icons/gi';
import { BiTime, BiTrendingUp, BiStar, BiRefresh, BiChevronUp } from 'react-icons/bi';
import { FaCrown } from 'react-icons/fa';
import { useAuth } from '@/hooks/useAuth';
import { 
  getDivinePointsLeaderboard, 
  getDivinePointsLeaderboardByPeriod, 
  getUserDivinePointsRank,
  getDivinePointsStats,
  // updateGenericUsernames
} from '@/lib/supabaseClient';
import './DivinePointsLeaderboard.css';

interface DivinePlayer {
  rank: number;
  userId: number;
  telegramId: number;
  username: string;
  firstName?: string;
  lastName?: string;
  divinePoints: number;
  totalPointsEarned: number;
  pointsPerSecond: number;
  highScore: number;
  allTimeHighScore: number;
  upgradesPurchased: number;
  lastActive: string;
  joinedAt: string;
  lastUpdated: string;
  period?: string;
}

interface LeaderboardData {
  topPlayers: DivinePlayer[];
  dailyWinners: DivinePlayer[];
  weeklyWinners: DivinePlayer[];
  monthlyWinners: DivinePlayer[];
  totalPlayers: number;
  lastUpdated: number;
}

interface DivineStats {
  totalPlayers: number;
  totalDivinePoints: number;
  averageDivinePoints: number;
  maxDivinePoints: number;
  totalPointsEarned: number;
}

const getRankIcon = (rank: number) => {
  if (rank === 1) return <GiCrown className="text-yellow-400 text-lg" />;
  if (rank === 2) return <GiTrophy className="text-gray-300 text-lg" />;
  if (rank === 3) return <GiMedal className="text-amber-600 text-lg" />;
  return <span className="text-cyan-400 font-bold text-sm">#{rank}</span>;
};

const formatNumber = (num: number): string => {
  if (num >= 1e12) return (num / 1e12).toFixed(1) + 'T';
  if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
  return num.toString();
};

const formatTimeAgo = (timestamp: string): string => {
  const now = new Date();
  const time = new Date(timestamp);
  const diffMs = now.getTime() - time.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return time.toLocaleDateString();
};

// Generate mock data for demonstration
const generateMockDivinePlayers = (): DivinePlayer[] => {
  const names = [
    'DivineMiner_2077', 'CosmicHarvester', 'QuantumDiviner', 'CrystalSeeker', 'MysticMiner',
    'EtherealDigger', 'AstralProspector', 'CelestialMiner', 'SpiritualHarvester', 'TranscendentDigger',
    'EnlightenedMiner', 'SacredProspector', 'DivineSeeker', 'CosmicDigger', 'QuantumHarvester',
    'MysticProspector', 'CrystalMiner', 'EtherealSeeker', 'AstralDigger', 'CelestialHarvester'
  ];

  return names.map((name, index) => ({
    rank: index + 1,
    userId: 1000 + index,
    telegramId: 123456789 + index,
    username: name,
    firstName: name.split('_')[0],
    lastName: name.split('_')[1] || '',
    divinePoints: Math.floor(Math.random() * 10000000) + 100000,
    totalPointsEarned: Math.floor(Math.random() * 50000000) + 500000,
    pointsPerSecond: Math.floor(Math.random() * 1000) + 10,
    highScore: Math.floor(Math.random() * 20000000) + 200000,
    allTimeHighScore: Math.floor(Math.random() * 50000000) + 500000,
    upgradesPurchased: Math.floor(Math.random() * 50) + 5,
    lastActive: new Date(Date.now() - Math.floor(Math.random() * 24 * 60 * 60 * 1000)).toISOString(),
    joinedAt: new Date(Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000)).toISOString(),
    lastUpdated: new Date().toISOString()
  })).sort((a, b) => b.divinePoints - a.divinePoints);
};

export const DivinePointsLeaderboard: React.FC = () => {
  const { user } = useAuth();
  const [isExpanded, setIsExpanded] = useState(true);
 

  // Helper function to get user-specific keys with complete isolation
  const getUserSpecificKey = useCallback((baseKey: string): string => {
    if (!user?.telegram_id) {
      console.warn('No user telegram_id available for key generation');
      return baseKey;
    }
    return `${baseKey}_${user.telegram_id}`;
  }, [user?.telegram_id]);

  const [currentTab, setCurrentTab] = useState<'all_time' | 'daily' | 'weekly' | 'monthly'>('all_time');
  const [searchTerm, setSearchTerm] = useState('');
  const [showOnlyTop10] = useState(false);
  const [showOnlyActive] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardData>({
    topPlayers: [],
    dailyWinners: [],
    weeklyWinners: [],
    monthlyWinners: [],
    totalPlayers: 0,
    lastUpdated: Date.now()
  });
  const [stats, setStats] = useState<DivineStats>({
    totalPlayers: 0,
    totalDivinePoints: 0,
    averageDivinePoints: 0,
    maxDivinePoints: 0,
    totalPointsEarned: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [userDivinePoints, setUserDivinePoints] = useState(0);
  const [userPointsPerSecond, setUserPointsPerSecond] = useState(0);
  const [previousUserRank, setPreviousUserRank] = useState<number | null>(null);

  // Load user's current game state from localStorage
  useEffect(() => {
    const loadUserGameState = async () => {
      try {
        const userSaveKey = getUserSpecificKey('tonersGame');
        const savedGameState = localStorage.getItem(userSaveKey);
        if (savedGameState) {
          const gameState = JSON.parse(savedGameState);
          const newDivinePoints = gameState.divinePoints || 0;
          const newPointsPerSecond = gameState.pointsPerSecond || 0;
          
          setUserDivinePoints(newDivinePoints);
          setUserPointsPerSecond(newPointsPerSecond);
          
          // Update user rank if divine points changed and user is logged in
          if (user?.id && newDivinePoints > 0) {
            const newRank = await getUserDivinePointsRank(user.id);
            if (newRank !== userRank) {
              setPreviousUserRank(userRank);
              setUserRank(newRank);
            }
          }
        }
      } catch (error) {
        console.error('Error loading user game state:', error);
      }
    };

    loadUserGameState();
    const interval = setInterval(loadUserGameState, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, [user?.id, getUserSpecificKey]);

  // Load leaderboard data
  useEffect(() => {
    const loadLeaderboardData = async () => {
      setIsLoading(true);
      
      try {
        // Load real data from database
        console.log('Loading real leaderboard data...');
        const allTimeData = await getDivinePointsLeaderboard(100);
        console.log('All time data:', allTimeData);
        console.log('All time data length:', allTimeData?.length);
        
        const dailyData = await getDivinePointsLeaderboardByPeriod('daily', 50);
        console.log('Daily data:', dailyData);
        console.log('Daily data length:', dailyData?.length);
        
        const weeklyData = await getDivinePointsLeaderboardByPeriod('weekly', 50);
        console.log('Weekly data:', weeklyData);
        console.log('Weekly data length:', weeklyData?.length);
        
        const monthlyData = await getDivinePointsLeaderboardByPeriod('monthly', 50);
        console.log('Monthly data:', monthlyData);
        console.log('Monthly data length:', monthlyData?.length);
        
        // Load global stats
        const globalStats = await getDivinePointsStats();
        console.log('Global stats:', globalStats);
        
        // Get user rank if logged in
        let userRankData = null;
        if (user?.id && userDivinePoints > 0) {
          userRankData = await getUserDivinePointsRank(user.id);
          console.log('User rank data:', userRankData);
        }

        setLeaderboardData({
          topPlayers: allTimeData || [],
          dailyWinners: dailyData || [],
          weeklyWinners: weeklyData || [],
          monthlyWinners: monthlyData || [],
          totalPlayers: globalStats.totalPlayers,
          lastUpdated: Date.now()
        });

        setStats(globalStats);
        setUserRank(userRankData);
        
      } catch (error) {
        console.error('Error loading leaderboard data:', error);
        // Fallback to mock data if database fails
        const allTimeData = generateMockDivinePlayers();
        const dailyData = allTimeData.slice(0, 20).map(p => ({ ...p, divinePoints: Math.floor(p.divinePoints * 0.1) }));
        const weeklyData = allTimeData.slice(0, 20).map(p => ({ ...p, divinePoints: Math.floor(p.divinePoints * 0.3) }));
        const monthlyData = allTimeData.slice(0, 20).map(p => ({ ...p, divinePoints: Math.floor(p.divinePoints * 0.6) }));
        
        const totalDivinePoints = allTimeData.reduce((sum, p) => sum + p.divinePoints, 0);
        const totalPointsEarned = allTimeData.reduce((sum, p) => sum + p.totalPointsEarned, 0);
        const maxDivinePoints = Math.max(...allTimeData.map(p => p.divinePoints));
        
        const globalStats = {
          totalPlayers: allTimeData.length,
          totalDivinePoints,
          averageDivinePoints: totalDivinePoints / allTimeData.length,
          maxDivinePoints,
          totalPointsEarned
        };
        
        let userRankData = null;
        if (userDivinePoints > 0) {
          userRankData = allTimeData.findIndex(p => p.divinePoints <= userDivinePoints) + 1;
          if (userRankData === 0) userRankData = allTimeData.length + 1;
        }

        setLeaderboardData({
          topPlayers: allTimeData,
          dailyWinners: dailyData,
          weeklyWinners: weeklyData,
          monthlyWinners: monthlyData,
          totalPlayers: globalStats.totalPlayers,
          lastUpdated: Date.now()
        });

        setStats(globalStats);
        setUserRank(userRankData);
      } finally {
        setIsLoading(false);
      }
    };

    loadLeaderboardData();
  }, [user?.id, userDivinePoints]);

 
  const getCurrentTabData = () => {
    let data: DivinePlayer[] = [];
    
    switch (currentTab) {
      case 'all_time': 
        data = leaderboardData.topPlayers;
        break;
      case 'daily': 
        data = leaderboardData.dailyWinners;
        break;
      case 'weekly': 
        data = leaderboardData.weeklyWinners;
        break;
      case 'monthly': 
        data = leaderboardData.monthlyWinners;
        break;
      default: 
        data = leaderboardData.topPlayers;
    }

    // Apply search filter
    if (searchTerm.trim()) {
      data = data.filter(player => 
        player.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        player.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        player.lastName?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply top 10 filter
    if (showOnlyTop10) {
      data = data.slice(0, 10);
    }

    // Apply active players filter (active in last 24 hours)
    if (showOnlyActive) {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      data = data.filter(player => new Date(player.lastActive) > oneDayAgo);
    }

    return data;
  };

  const refreshLeaderboard = async () => {
    setIsRefreshing(true);
    
    try {
      // Load fresh data from database
      const allTimeData = await getDivinePointsLeaderboard(100);
      const dailyData = await getDivinePointsLeaderboardByPeriod('daily', 50);
      const weeklyData = await getDivinePointsLeaderboardByPeriod('weekly', 50);
      const monthlyData = await getDivinePointsLeaderboardByPeriod('monthly', 50);
      const globalStats = await getDivinePointsStats();
      
      let userRankData = null;
      if (user?.id && userDivinePoints > 0) {
        userRankData = await getUserDivinePointsRank(user.id);
      }

      setLeaderboardData({
        topPlayers: allTimeData,
        dailyWinners: dailyData,
        weeklyWinners: weeklyData,
        monthlyWinners: monthlyData,
        totalPlayers: globalStats.totalPlayers,
        lastUpdated: Date.now()
      });

      setStats(globalStats);
      setUserRank(userRankData);
      
    } catch (error) {
      console.error('Error refreshing leaderboard:', error);
      // Show error notification instead of falling back to mock data
      console.error('Failed to refresh leaderboard data');
    } finally {
      setIsRefreshing(false);
    }
  };

  // const fixUsernames = async () => {
  //   try {
  //     console.log('Updating generic usernames...');
  //     await updateGenericUsernames();
  //     // Refresh the leaderboard after updating usernames
  //     await refreshLeaderboard();
  //   } catch (error) {
  //     console.error('Error fixing usernames:', error);
  //   }
  // };

  if (isLoading) {
    return (
      <div className="flex-1 p-3 space-y-2 overflow-y-auto game-scrollbar">
        <div className="flex flex-col items-center justify-center space-y-4 py-8">
          <div className="relative">
            <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
            <div className="absolute inset-0 w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" style={{ animationDelay: '0.2s' }}></div>
          </div>
          <div className="text-cyan-400 font-mono text-sm animate-pulse tracking-wider">
            LOADING LEADERBOARD...
          </div>
        </div>
      </div>
    );
  }

  // Minimized view
  if (!isExpanded) {
    return (
      <div 
        className="fixed bottom-4 right-4 bg-black/40 backdrop-blur-xl rounded-lg p-2 border border-cyan-500/20 shadow-lg cursor-pointer hover:bg-black/50 transition-all duration-300"
        onClick={() => setIsExpanded(true)}
      >
        <div className="flex items-center gap-2">
          <GiDiamonds className="text-cyan-400 text-sm" />
          <div className="flex flex-col">
            <div className="text-cyan-400 font-mono text-xs">
              {formatNumber(stats.totalPlayers)} Players
            </div>
            {user && userRank && (
              <div className="text-green-400 font-mono text-xs">
                Rank #{userRank}
              </div>
            )}
          </div>
          <BiChevronUp className="text-cyan-400 text-lg animate-bounce" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-3 space-y-2 overflow-y-auto game-scrollbar">
      {/* Compact Header */}
      <div className="bg-black/40 backdrop-blur-xl rounded-xl p-4 border border-cyan-500/20 shadow-lg relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-blue-500/5"></div>
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <GiDiamonds className="text-cyan-400 text-xl animate-pulse" />
              <h1 className="text-cyan-400 font-mono font-bold tracking-wider">LEADERBOARD</h1>
            </div>
            <div className="flex gap-2">
              <button
                onClick={refreshLeaderboard}
                disabled={isRefreshing}
                className={`p-1.5 rounded-lg transition-all duration-300 ${
                  isRefreshing 
                    ? 'bg-gray-600/50 text-gray-400 cursor-not-allowed' 
                    : 'bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400'
                }`}
              >
                <BiRefresh className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* User Stats - More Compact */}
          {user && (
            <div className="bg-black/30 rounded-lg p-2 border border-cyan-400/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-blue-500 rounded flex items-center justify-center">
                    <span className="text-white text-xs font-bold">YOU</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-cyan-400 font-mono text-sm">#{userRank || '-'}</span>
                    {previousUserRank && userRank && previousUserRank !== userRank && (
                      <span className={`text-xs ${userRank < previousUserRank ? 'text-green-400' : 'text-red-400'}`}>
                        {userRank < previousUserRank ? '↗' : '↘'}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <GiLightningArc className="text-green-400 text-sm" />
                  <div className="text-green-400 font-mono text-sm">+{userPointsPerSecond.toFixed(1)}/s</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Compact Filter Bar */}
      <div className="bg-black/30 rounded-lg p-2 border border-cyan-500/10">
        <div className="flex flex-wrap gap-2">
          {/* Period Tabs */}
          <div className="flex gap-1 flex-1">
            {[
              { key: 'all_time', label: 'All', icon: <FaCrown className="w-3 h-3" /> },
              { key: 'daily', label: '24H', icon: <BiTime className="w-3 h-3" /> },
              { key: 'weekly', label: '7D', icon: <BiTrendingUp className="w-3 h-3" /> },
              { key: 'monthly', label: '30D', icon: <BiStar className="w-3 h-3" /> }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setCurrentTab(tab.key as any)}
                className={`flex items-center justify-center gap-1 py-1 px-2 rounded text-xs font-mono transition-all duration-300 ${
                  currentTab === tab.key
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/30'
                    : 'text-gray-400 hover:text-cyan-300 hover:bg-black/20'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search players..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-black/20 border border-cyan-400/20 rounded px-2 py-1 text-white text-xs placeholder-gray-500 focus:outline-none focus:border-cyan-400/40 transition-colors"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white text-xs"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Player Cards */}
      <div className="space-y-1.5">
        {getCurrentTabData().length === 0 ? (
          <div className="text-center py-6 text-gray-400">
            <div className="text-sm mb-1">No players found</div>
            <div className="text-xs">Start mining to appear on the leaderboard!</div>
          </div>
        ) : (
          getCurrentTabData().map((player, index) => {
            const isCurrentUser = user?.id === player.userId;
            return (
              <div
                key={`${player.userId}-${currentTab}`}
                className={`group relative bg-black/30 backdrop-blur-sm rounded-lg p-2.5 transition-all duration-300 hover:bg-black/40 ${
                  isCurrentUser ? 'border border-green-400/30 shadow-[0_0_15px_rgba(34,197,94,0.15)]' :
                  index === 0 ? 'border border-yellow-400/30 shadow-[0_0_15px_rgba(251,191,36,0.15)]' :
                  index === 1 ? 'border border-gray-400/30' :
                  index === 2 ? 'border border-amber-600/30' :
                  'border border-cyan-400/10 hover:border-cyan-400/30'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      {getRankIcon(player.rank)}
                      <div className={`w-6 h-6 rounded flex items-center justify-center ${
                        index === 0 ? 'bg-gradient-to-br from-yellow-400 to-amber-500' :
                        index === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-400' :
                        index === 2 ? 'bg-gradient-to-br from-amber-600 to-amber-700' :
                        'bg-gradient-to-br from-cyan-400 to-blue-500'
                      }`}>
                        <span className="text-white text-xs font-bold">{player.username.charAt(0).toUpperCase()}</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-white text-sm font-medium flex items-center gap-1">
                        {player.username}
                        {isCurrentUser && <span className="text-xs text-green-400">(YOU)</span>}
                      </div>
                      <div className="text-gray-400 text-xs">{formatTimeAgo(player.lastActive)}</div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-cyan-400 font-mono font-bold tracking-wide">
                      {formatNumber(player.divinePoints)}
                    </div>
                    <div className="text-cyan-300/80 text-xs font-mono">
                      +{player.pointsPerSecond.toFixed(1)}/s
                    </div>
                  </div>
                </div>

                {/* Progress bar for top 3 */}
                {player.rank <= 3 && stats.maxDivinePoints > 0 && (
                  <div className="mt-1.5">
                    <div className="w-full bg-black/50 rounded-full h-0.5 overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-1000 ${
                          player.rank === 1 ? 'bg-yellow-400' :
                          player.rank === 2 ? 'bg-gray-300' :
                          'bg-amber-600'
                        }`}
                        style={{ width: `${(player.divinePoints / stats.maxDivinePoints) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Last Updated */}
      <div className="text-center text-gray-500 text-xs font-mono mt-2">
        Updated {formatTimeAgo(new Date(leaderboardData.lastUpdated).toISOString())}
      </div>
    </div>
  );
}; 