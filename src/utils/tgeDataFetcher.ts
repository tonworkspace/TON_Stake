import { supabase } from '@/lib/supabaseClient';

export interface TGEUserData {
  // User basic info
  id: number;
  telegram_id: string;
  username: string;
  rank: string;
  balance: number;
  total_sbt: number;
  total_earned: number;
  total_deposit: number;
  total_withdrawn: number;
  team_volume: number;
  direct_referrals: number;
  login_streak: number;
  mining_power: number;
  last_active: string;
  created_at: string;
  
  // Game data - using the actual GameState structure from DivineMiningGame
  gameData?: {
    divinePoints: number;
    pointsPerSecond: number;
    totalEarned24h: number;
    totalEarned7d: number;
    upgradesPurchased: number;
    minersActive: number;
    isMining: boolean;
    lastSaveTime: number;
    sessionStartTime: number;
    totalPointsEarned: number;
    lastDailyReset: string;
    lastWeeklyReset: string;
    version: string;
    highScore: number;
    allTimeHighScore: number;
    currentEnergy: number;
    maxEnergy: number;
    lastEnergyRegen: number;
    offlineEfficiencyBonus: number;
    lastOfflineTime: number;
    unclaimedOfflineRewards: number;
    lastOfflineRewardTime: number;
    miningLevel: number;
    miningCombo: number;
    miningStreak: number;
    miningExperience: number;
    miningExperienceToNext: number;
  };
  
  // Store purchases
  storePurchases: Array<{
    id: string;
    offering_id: number;
    usdt_amount: number;
    ton_amount: number;
    tokens_purchased: number;
    status: string;
    created_at: string;
    tx_hash?: string;
  }>;
  
  // Stakes data
  activeStakes: Array<{
    id: number;
    amount: number;
    daily_rate: number;
    total_earned: number;
    start_date: string;
    last_payout: string;
    cycle_progress: number;
  }>;
  
  // Referral data
  referrer?: {
    username: string;
    rank: string;
  };
}

export const fetchTGEUserData = async (userId: number): Promise<TGEUserData | null> => {
  try {
    console.log('🔍 Fetching TGE data for user ID:', userId);
    
    // Fetch user basic data
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError) {
      console.error('❌ Error fetching user data:', userError);
      return null;
    }

    console.log('✅ User data fetched successfully:', userData?.username || 'Unknown');

    // Fetch game data
    let gameData = null;
    try {
      const { data } = await supabase
        .from('user_game_data')
        .select('game_data')
        .eq('user_id', userId)
        .single();
      gameData = data;
    } catch (error) {
      console.log('Game data not found or table does not exist:', error);
    }

    // Fetch store purchases
    let purchases = [];
    try {
      const { data } = await supabase
        .from('token_purchases')
        .select('*')
        .eq('user_id', userId.toString())
        .order('created_at', { ascending: false });
      purchases = data || [];
    } catch (error) {
      console.log('Token purchases not found or table does not exist:', error);
    }

    // Fetch active stakes
    let stakes = [];
    try {
      const { data } = await supabase
        .from('stakes')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true);
      stakes = data || [];
    } catch (error) {
      console.log('Stakes not found or table does not exist:', error);
    }

    // Fetch referrer data if referrer_id exists
    let referrerData = null;
    if (userData.referrer_id) {
      const { data: referrer } = await supabase
        .from('users')
        .select('username, rank')
        .eq('id', userData.referrer_id)
        .single();
      referrerData = referrer;
    }

    const result = {
      ...userData,
      gameData: gameData?.game_data || undefined,
      storePurchases: purchases,
      activeStakes: stakes,
      referrer: referrerData
    };

    console.log('📊 TGE data summary:', {
      hasGameData: !!result.gameData,
      purchaseCount: result.storePurchases.length,
      stakeCount: result.activeStakes.length,
      hasReferrer: !!result.referrer
    });

    return result;

  } catch (error) {
    console.error('Error fetching TGE user data:', error);
    return null;
  }
};

export const calculateTGEStats = (userData: TGEUserData) => {
  const totalStoreInvestment = userData.storePurchases
    .filter(p => p.status === 'confirmed')
    .reduce((sum, p) => sum + p.usdt_amount, 0);

  const totalTokensPurchased = userData.storePurchases
    .filter(p => p.status === 'confirmed')
    .reduce((sum, p) => sum + p.tokens_purchased, 0);

  const totalStakeValue = userData.activeStakes
    .reduce((sum, stake) => sum + stake.amount, 0);

  const totalStakeEarnings = userData.activeStakes
    .reduce((sum, stake) => sum + stake.total_earned, 0);

  const miningEfficiency = userData.gameData ? 
    (userData.gameData.points_per_second / Math.max(userData.gameData.mining_level, 1)) : 0;

  return {
    totalStoreInvestment,
    totalTokensPurchased,
    totalStakeValue,
    totalStakeEarnings,
    miningEfficiency,
    portfolioValue: userData.balance + userData.total_sbt + totalStakeValue,
    totalEarnings: userData.total_earned + totalStakeEarnings + (userData.gameData?.total_points_earned || 0)
  };
};

export const formatTGEStats = (stats: ReturnType<typeof calculateTGEStats>) => {
  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(2) + 'K';
    return num.toFixed(2);
  };

  return {
    totalStoreInvestment: `$${formatNumber(stats.totalStoreInvestment)}`,
    totalTokensPurchased: `${formatNumber(stats.totalTokensPurchased)} STK`,
    totalStakeValue: `${formatNumber(stats.totalStakeValue)} TON`,
    totalStakeEarnings: `${formatNumber(stats.totalStakeEarnings)} TON`,
    miningEfficiency: `${formatNumber(stats.miningEfficiency)} pts/sec/level`,
    portfolioValue: `${formatNumber(stats.portfolioValue)} TON`,
    totalEarnings: `${formatNumber(stats.totalEarnings)} TON`
  };
};
