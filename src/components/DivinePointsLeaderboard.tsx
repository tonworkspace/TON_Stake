import React, { useState, useEffect } from 'react';
import { GiCrown, GiTrophy, GiMedal, GiLightningArc, GiDiamonds } from 'react-icons/gi';
import { BiTime, BiTrendingUp, BiStar, BiRefresh } from 'react-icons/bi';
import { FaCrown } from 'react-icons/fa';
import { useAuth } from '@/hooks/useAuth';
import { 
  getDivinePointsLeaderboard, 
  getDivinePointsLeaderboardByPeriod, 
  getUserDivinePointsRank,
  getDivinePointsStats,
  // updateGenericUsernames
} from '@/lib/supabaseClient';
import { supabase } from '@/lib/supabaseClient';
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
  const [currentTab, setCurrentTab] = useState<'all_time' | 'daily' | 'weekly' | 'monthly'>('all_time');
  const [searchTerm, setSearchTerm] = useState('');
  const [showOnlyTop10, setShowOnlyTop10] = useState(false);
  const [showOnlyActive, setShowOnlyActive] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showStats, setShowStats] = useState(false);
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
        const savedGameState = localStorage.getItem('divineMiningGame');
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
  }, [user?.id]);

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
      <div className="flex-1 p-custom space-y-2 overflow-y-auto game-scrollbar">
        <div className="flex flex-col items-center justify-center space-y-4 py-8">
          <div className="relative">
            <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
            <div className="absolute inset-0 w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" style={{ animationDelay: '0.2s' }}></div>
          </div>
          <div className="text-cyan-400 font-mono text-sm animate-pulse tracking-wider">
            LOADING DIVINE LEADERBOARD...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-custom space-y-2 overflow-y-auto game-scrollbar">
      {/* Header */}
      <div className="relative bg-black/40 backdrop-blur-xl border border-cyan-500/30 rounded-xl p-4 shadow-[0_0_30px_rgba(0,255,255,0.1)]">
        <div className="absolute top-0 left-0 w-3 h-3 border-l-2 border-t-2 border-cyan-400"></div>
        <div className="absolute top-0 right-0 w-3 h-3 border-r-2 border-t-2 border-cyan-400"></div>
        <div className="absolute bottom-0 left-0 w-3 h-3 border-l-2 border-b-2 border-cyan-400"></div>
        <div className="absolute bottom-0 right-0 w-3 h-3 border-r-2 border-b-2 border-cyan-400"></div>
        
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <GiDiamonds className="text-cyan-400 text-xl" />
                          <span className="text-cyan-400 font-mono font-bold tracking-wider text-lg">LEADERBOARD</span>
            <GiDiamonds className="text-cyan-400 text-xl" />
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={refreshLeaderboard}
              disabled={isRefreshing}
              className={`p-2 rounded-lg transition-all duration-300 ${
                isRefreshing 
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
                  : 'bg-cyan-500/20 border border-cyan-400 text-cyan-300 hover:bg-cyan-500/30'
              }`}
            >
              <BiRefresh className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
            
            {/* Debug button to force save current game state */}
            <button
              onClick={async () => {
                try {
                  const savedGameState = localStorage.getItem('divineMiningGame');
                  if (savedGameState) {
                    const gameState = JSON.parse(savedGameState);
                    console.log('Current game state:', gameState);
                    
                    // Force save to Supabase
                    const { user } = useAuth();
                    if (user?.telegram_id) {
                      const { data: userData, error: userError } = await supabase
                        .from('users')
                        .select('id')
                        .eq('telegram_id', user.telegram_id)
                        .single();

                      if (userError || !userData) {
                        console.error('Error fetching user for debug save:', userError);
                        return;
                      }

                      const stateToSave = {
                        user_id: userData.id,
                        game_data: gameState,
                        last_updated: new Date().toISOString()
                      };

                      const { error } = await supabase
                        .from('user_game_data')
                        .upsert(stateToSave, {
                          onConflict: 'user_id'
                        });

                      if (error) throw error;
                      
                      console.log('Debug: Game state saved to Supabase');
                      alert('Game state saved to database!');
                      
                      // Refresh leaderboard
                      await refreshLeaderboard();
                    }
                  }
                } catch (error) {
                  console.error('Debug save error:', error);
                  alert('Error saving game state: ' + (error instanceof Error ? error.message : String(error)));
                }
              }}
              className="p-2 rounded-lg bg-green-500/20 border border-green-400 text-green-300 hover:bg-green-500/30 transition-all duration-300"
              title="Force save current game state to database"
            >
              💾
            </button>
          </div>
        </div>

        {/* Global Stats Toggle */}
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => setShowStats(!showStats)}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all duration-300 ${
              showStats
                ? 'bg-yellow-500/30 text-yellow-300 border border-yellow-400/50'
                : 'bg-black/40 text-gray-400 border border-gray-600 hover:text-yellow-300 hover:border-yellow-400/30'
            }`}
          >
            {showStats ? 'Hide Stats' : 'Show Stats'}
          </button>
          
          {/* Quick Stats Preview (always visible) */}
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <span className="font-mono">
              <span className="text-cyan-400">{formatNumber(stats.totalPlayers)}</span> players
            </span>
            <span className="font-mono">
              <span className="text-yellow-400">{formatNumber(stats.totalDivinePoints)}</span> total
            </span>
          </div>
        </div>

        {/* Collapsible Global Stats */}
        {showStats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
            <div className="bg-black/30 rounded-lg p-3 text-center border border-cyan-400/20">
              <div className="text-cyan-400 font-mono text-xs tracking-wider mb-1">DIVINE PLAYERS</div>
              <div className="text-white font-bold text-lg">{formatNumber(stats.totalPlayers)}</div>
            </div>
            <div className="bg-black/30 rounded-lg p-3 text-center border border-yellow-400/20">
              <div className="text-yellow-400 font-mono text-xs tracking-wider mb-1">TOTAL POINTS</div>
              <div className="text-white font-bold text-lg">{formatNumber(stats.totalDivinePoints)}</div>
            </div>
            <div className="bg-black/30 rounded-lg p-3 text-center border border-green-400/20">
              <div className="text-green-400 font-mono text-xs tracking-wider mb-1">AVG POINTS</div>
              <div className="text-white font-bold text-lg">{formatNumber(Math.floor(stats.averageDivinePoints))}</div>
            </div>
            <div className="bg-black/30 rounded-lg p-3 text-center border border-purple-400/20">
              <div className="text-purple-400 font-mono text-xs tracking-wider mb-1">MAX POINTS</div>
              <div className="text-white font-bold text-lg">{formatNumber(stats.maxDivinePoints)}</div>
            </div>
          </div>
        )}

        {/* User Stats */}
        {user && (
          <div className="bg-black/40 backdrop-blur-xl border border-cyan-400/20 rounded-xl p-3 mb-3 shadow-[0_0_20px_rgba(0,255,255,0.05)]">
            <div className="flex flex sm:flex-row sm:items-center justify-between gap-3">
              {/* User Rank */}
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-lg flex items-center justify-center">
                  <span className="text-white text-xs font-bold">YOU</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-cyan-400 font-mono font-bold text-sm">#{userRank || 'N/A'}</span>
                  {previousUserRank && userRank && previousUserRank !== userRank && (
                    <span className={`text-xs ${
                      userRank < previousUserRank ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {userRank < previousUserRank ? '↗' : '↘'}
                    </span>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-4">
                {/* Mining Rate */}
                <div className="flex items-center gap-2">
                  <GiLightningArc className="text-green-400 text-base" />
                  <div className="text-right">
                    <div className="text-green-400 font-mono font-bold text-sm">
                      +{userPointsPerSecond.toFixed(1)}/s
                    </div>
                    <div className="text-green-300 text-xs font-mono">Hash Rate</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Compact Filter & Search */}
      <div className="bg-black/20 rounded-lg p-2">
        {/* Filter Toggle & Tab Navigation */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all duration-300 ${
              showFilters
                ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-400/50'
                : 'bg-black/40 text-gray-400 border border-gray-600 hover:text-cyan-300 hover:border-cyan-400/30'
            }`}
          >
            {showFilters ? 'Hide Filters' : 'Show Filters'}
          </button>

          {/* Compact Tab Navigation */}
          <div className="flex gap-1 flex-1 sm:flex-none">
            {[
              { key: 'all_time', label: 'All Time', icon: <FaCrown /> },
              { key: 'daily', label: 'Daily', icon: <BiTime /> },
              { key: 'weekly', label: 'Weekly', icon: <BiTrendingUp /> },
              { key: 'monthly', label: 'Monthly', icon: <BiStar /> }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setCurrentTab(tab.key as any)}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-1 py-1.5 px-2 rounded text-xs font-mono transition-all duration-300 ${
                  currentTab === tab.key
                    ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-400/50'
                    : 'text-gray-400 hover:text-cyan-300 hover:bg-black/30'
                }`}
              >
                <span className="hidden sm:inline">{tab.icon}</span>
                <span className="text-xs">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Collapsible Filter Content */}
        {showFilters && (
          <div className="space-y-2 border-t border-gray-600/30 pt-2">
            {/* Search Bar */}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex-1 relative">
                <input
                  type="text"
                  placeholder="Search players..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-black/40 border border-cyan-400/30 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-400 focus:outline-none focus:border-cyan-400/60 transition-colors"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    ✕
                  </button>
                )}
              </div>
              
              <button
                onClick={() => setShowOnlyTop10(!showOnlyTop10)}
                className={`px-3 py-2 rounded-lg text-xs font-mono transition-all duration-300 ${
                  showOnlyTop10
                    ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-400/50'
                    : 'bg-black/40 text-gray-400 border border-gray-600 hover:text-cyan-300 hover:border-cyan-400/30'
                }`}
              >
                Top 10
              </button>
            </div>

            {/* Filter Buttons */}
            <div className="flex flex-wrap gap-2 justify-center">
              <button
                onClick={() => setShowOnlyActive(!showOnlyActive)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all duration-300 ${
                  showOnlyActive
                    ? 'bg-green-500/30 text-green-300 border border-green-400/50'
                    : 'bg-black/40 text-gray-400 border border-gray-600 hover:text-green-300 hover:border-green-400/30'
                }`}
              >
                Active (24h)
              </button>
              
              {(searchTerm || showOnlyTop10 || showOnlyActive) && (
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setShowOnlyTop10(false);
                    setShowOnlyActive(false);
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-mono bg-red-500/20 text-red-300 border border-red-400/30 hover:bg-red-500/30 transition-all duration-300"
                >
                  Clear All
                </button>
              )}
            </div>

            {/* Results Count */}
            <div className="text-center text-gray-400 text-xs font-mono">
              Showing {getCurrentTabData().length} players
              {searchTerm && ` matching "${searchTerm}"`}
              {showOnlyTop10 && ' (Top 10 only)'}
              {showOnlyActive && ' (Active only)'}
            </div>
          </div>
        )}

        {/* Always show active filters indicator */}
        {(searchTerm || showOnlyTop10 || showOnlyActive) && !showFilters && (
          <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-cyan-300 font-mono">
            <span>Filters active:</span>
            {searchTerm && <span className="bg-cyan-500/20 px-2 py-1 rounded">Search: "{searchTerm}"</span>}
            {showOnlyTop10 && <span className="bg-cyan-500/20 px-2 py-1 rounded">Top 10</span>}
            {showOnlyActive && <span className="bg-green-500/20 px-2 py-1 rounded">Active</span>}
            <button
              onClick={() => setShowFilters(true)}
              className="text-cyan-400 hover:text-cyan-300 underline"
            >
              Edit
            </button>
          </div>
        )}
      </div>

      {/* Leaderboard */}
      <div className="space-y-2">
        {getCurrentTabData().length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <div className="text-lg mb-2">No players found</div>
            <div className="text-sm">Start mining to appear on the leaderboard!</div>
          </div>
        ) : (
          getCurrentTabData().map((player, index) => {
          const isCurrentUser = user?.id === player.userId;
          return (
            <div
              key={`${player.userId}-${currentTab}`}
              className={`relative bg-black/40 backdrop-blur-xl border rounded-xl p-3 transition-all duration-300 hover:bg-black/60 ${
                isCurrentUser ? 'border-green-400/50 shadow-[0_0_20px_rgba(34,197,94,0.3)] bg-green-500/10' :
                index === 0 ? 'border-yellow-400/50 shadow-[0_0_20px_rgba(251,191,36,0.2)]' :
                index === 1 ? 'border-gray-400/50 shadow-[0_0_20px_rgba(156,163,175,0.2)]' :
                index === 2 ? 'border-amber-600/50 shadow-[0_0_20px_rgba(217,119,6,0.2)]' :
                'border-cyan-400/30 shadow-[0_0_20px_rgba(0,255,255,0.1)]'
              }`}
            >
            {/* Corner decorations */}
            <div className="absolute top-0 left-0 w-2 h-2 border-l border-t border-current opacity-50"></div>
            <div className="absolute top-0 right-0 w-2 h-2 border-r border-t border-current opacity-50"></div>
            <div className="absolute bottom-0 left-0 w-2 h-2 border-l border-b border-current opacity-50"></div>
            <div className="absolute bottom-0 right-0 w-2 h-2 border-r border-b border-current opacity-50"></div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  {getRankIcon(player.rank)}
                  <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-lg flex items-center justify-center">
                    <span className="text-white text-xs font-bold">
                      {player.username.charAt(0).toUpperCase()}
                    </span>
                  </div>
                </div>
                
                <div>
                  <div className="text-white font-bold text-sm">
                    {player.username}
                    {isCurrentUser && (
                      <span className="ml-2 text-xs text-green-400 font-bold">(YOU)</span>
                    )}
                    {player.rank <= 3 && (
                      <span className="ml-2 text-xs">
                        {player.rank === 1 && '👑'}
                        {player.rank === 2 && '🥈'}
                        {player.rank === 3 && '🥉'}
                      </span>
                    )}
                  </div>
                  <div className="text-gray-400 text-xs">
                    {player.upgradesPurchased} upgrades • {formatTimeAgo(player.lastActive)}
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="text-cyan-400 font-mono font-bold text-lg tracking-wider">
                  {formatNumber(player.divinePoints)}
                </div>
                <div className="text-cyan-300 text-xs font-mono">
                  +{player.pointsPerSecond.toFixed(1)}/s
                </div>
                <div className="text-gray-400 text-xs">
                  Total: {formatNumber(player.totalPointsEarned)}
                </div>
              </div>
            </div>

            {/* Progress bar for top 3 */}
            {player.rank <= 3 && stats.maxDivinePoints > 0 && (
              <div className="mt-2">
                <div className="w-full bg-gray-700 rounded-full h-1">
                  <div 
                    className={`h-1 rounded-full transition-all duration-1000 ${
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
      <div className="text-center text-gray-500 text-xs font-mono mt-4">
        Last updated: {new Date(leaderboardData.lastUpdated).toLocaleTimeString()}
      </div>
    </div>
  );
}; 