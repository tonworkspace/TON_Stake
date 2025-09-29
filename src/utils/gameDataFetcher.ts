import { useAuth } from '@/hooks/useAuth';
import { useState, useEffect } from 'react';

// GameState interface from DivineMiningGame
export interface GameState {
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
}

// Constants from DivineMiningGame
const SAVE_KEY = 'tonersGame';
const DIVINE_POINTS_KEY = 'tonersPoints';
const TOTAL_EARNED_KEY = 'tonersTotalEarned';
const SESSION_KEY = 'tonersSession';
const ACHIEVEMENTS_KEY = 'tonersAchievements';
const HIGH_SCORE_KEY = 'tonersHighScore';

// Function to get user-specific localStorage key
const getUserSpecificKey = (baseKey: string, telegramId?: string): string => {
  if (!telegramId) return baseKey;
  return `${baseKey}_${telegramId}`;
};

// Function to fetch active game data from localStorage
export const fetchActiveGameData = (telegramId?: string): GameState | null => {
  try {
    if (!telegramId) {
      console.log('No telegram ID provided for game data fetch');
      return null;
    }

    // Get user-specific keys
    const userSaveKey = getUserSpecificKey(SAVE_KEY, telegramId);
    const userDivinePointsKey = getUserSpecificKey(DIVINE_POINTS_KEY, telegramId);
    const userTotalEarnedKey = getUserSpecificKey(TOTAL_EARNED_KEY, telegramId);
    const userSessionKey = getUserSpecificKey(SESSION_KEY, telegramId);
    const userHighScoreKey = getUserSpecificKey(HIGH_SCORE_KEY, telegramId);

    console.log('🔍 Fetching active game data for user:', telegramId);
    console.log('📋 Checking localStorage keys:', {
      userSaveKey,
      userDivinePointsKey,
      userTotalEarnedKey,
      userSessionKey,
      userHighScoreKey
    });

    // Try to get the main game state
    const mainGameData = localStorage.getItem(userSaveKey);
    if (mainGameData) {
      console.log('✅ Found main game data in localStorage');
      const parsedData = JSON.parse(mainGameData);
      
      // Validate the data structure
      if (parsedData && typeof parsedData === 'object') {
        console.log('📊 Main game data:', {
          divinePoints: parsedData.divinePoints,
          pointsPerSecond: parsedData.pointsPerSecond,
          miningLevel: parsedData.miningLevel,
          isMining: parsedData.isMining,
          totalPointsEarned: parsedData.totalPointsEarned,
          highScore: parsedData.highScore,
          allTimeHighScore: parsedData.allTimeHighScore
        });
        
        return parsedData as GameState;
      }
    }

    // Fallback: Try to reconstruct from individual keys
    console.log('⚠️ Main game data not found, trying individual keys...');
    
    const divinePoints = localStorage.getItem(userDivinePointsKey);
    const totalEarned = localStorage.getItem(userTotalEarnedKey);
    const sessionData = localStorage.getItem(userSessionKey);
    const highScore = localStorage.getItem(userHighScoreKey);

    if (divinePoints || totalEarned || sessionData || highScore) {
      console.log('✅ Found individual game data keys');
      
      // Create a basic game state from available data
      const gameState: GameState = {
        divinePoints: divinePoints ? parseFloat(divinePoints) : 0,
        pointsPerSecond: 0,
        totalEarned24h: 0,
        totalEarned7d: 0,
        upgradesPurchased: 0,
        minersActive: 1,
        isMining: false,
        lastSaveTime: Date.now(),
        sessionStartTime: Date.now(),
        totalPointsEarned: totalEarned ? parseFloat(totalEarned) : 0,
        lastDailyReset: new Date().toDateString(),
        lastWeeklyReset: new Date().toDateString(),
        version: '1.1.0',
        highScore: highScore ? parseFloat(highScore) : 0,
        allTimeHighScore: highScore ? parseFloat(highScore) : 0,
        currentEnergy: 1000,
        maxEnergy: 1000,
        lastEnergyRegen: Date.now(),
        offlineEfficiencyBonus: 0,
        lastOfflineTime: Date.now(),
        unclaimedOfflineRewards: 0,
        lastOfflineRewardTime: Date.now(),
        miningLevel: 1,
        miningCombo: 1.0,
        miningStreak: 0,
        miningExperience: 0,
        miningExperienceToNext: 100
      };

      // Try to parse session data if available
      if (sessionData) {
        try {
          const session = JSON.parse(sessionData);
          if (session.sessionStartTime) gameState.sessionStartTime = session.sessionStartTime;
          if (session.lastDailyReset) gameState.lastDailyReset = session.lastDailyReset;
          if (session.lastWeeklyReset) gameState.lastWeeklyReset = session.lastWeeklyReset;
          if (session.lastSaveTime) gameState.lastSaveTime = session.lastSaveTime;
          if (session.version) gameState.version = session.version;
        } catch (error) {
          console.warn('Failed to parse session data:', error);
        }
      }

      console.log('📊 Reconstructed game data:', {
        divinePoints: gameState.divinePoints,
        totalPointsEarned: gameState.totalPointsEarned,
        highScore: gameState.highScore,
        allTimeHighScore: gameState.allTimeHighScore
      });

      return gameState;
    }

    console.log('❌ No game data found in localStorage');
    return null;

  } catch (error) {
    console.error('Error fetching active game data:', error);
    return null;
  }
};

// Hook to get active game data
export const useActiveGameData = () => {
  const { user } = useAuth();
  const [gameData, setGameData] = useState<GameState | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadGameData = () => {
      if (!user?.telegram_id) {
        setGameData(null);
        setIsLoading(false);
        return;
      }

      const activeData = fetchActiveGameData(user.telegram_id);
      setGameData(activeData);
      setIsLoading(false);
    };

    loadGameData();

    // Set up interval to refresh data every 5 seconds
    const interval = setInterval(loadGameData, 5000);

    return () => clearInterval(interval);
  }, [user?.telegram_id]);

  return { gameData, isLoading };
};

// Function to get real-time game data (for immediate updates)
export const getRealTimeGameData = (telegramId?: string): GameState | null => {
  return fetchActiveGameData(telegramId);
};
