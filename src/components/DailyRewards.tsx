import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
// import { useGameContext } from '../contexts/GameContext';
import { toNano } from '@ton/core';
import { useTonConnectUI, useTonAddress } from '@tonconnect/ui-react';
import { supabase, createWithdrawal, getUserByTelegramId } from '../lib/supabaseClient';
import { useNotificationSystem } from './NotificationSystem';
import {
  SECURITY_CONFIG,
  rateLimiter,
  generateDataHash,
  validateDataIntegrity,
  generateOperationSignature,
  validateOperationSignature,
  logSecurityEvent,
  validateBalanceChange,
  validateStakeData,
  reconcileUserData,
  detectSuspiciousActivity
} from '../lib/security';
// import * as TonWeb from 'tonweb';
// import { calculateDailyRewards, STAKING_CONFIG } from '../lib/supabaseClient';

interface StakingTier {
  id: string;
  name: string;
  minAmount: number;
  maxAmount: number;
  dailyRate: number;
  cycleDuration: number;
  maxReturn: number;
  color: string;
  icon: string;
  features: string[];
}

interface UserStake {
  id: number;
  amount: number;
  daily_rate: number;
  total_earned: number;
  start_date: string;
  last_payout: string;
  is_active: boolean;
  speed_boost_active: boolean;
  cycle_progress: number;
  user_id?: string;
  // New mining integration fields
  mining_bonus_active?: boolean;
  mining_level_bonus?: number;
  divine_points_earned?: number;
  last_mining_sync?: string;
}

// New interface for mining-staking synergy
interface MiningStakingSynergy {
  totalMiningPoints: number;
  stakingBonusMultiplier: number;
  miningLevelBonus: number;
  activeStakesCount: number;
  totalStakedAmount: number;
  synergyLevel: number;
  nextSynergyMilestone: number;
  synergyRewards: {
    miningBoost: number;
    stakingBoost: number;
    divinePointsBonus: number;
  };
}

// Stealth Saving System Configuration
const STEALTH_SAVE_CONFIG = {
  AUTO_SAVE_INTERVAL: 30000,
  OFFLINE_QUEUE_KEY: 'divine_mining_offline_queue',
  LAST_SYNC_KEY: 'divine_mining_last_sync',
  SYNC_RETRY_DELAY: 5000,
  MAX_RETRY_ATTEMPTS: SECURITY_CONFIG.MAX_RETRY_ATTEMPTS,
  BATCH_SIZE: 10,
  MIN_SYNC_INTERVAL: 10000,
  // Security settings
  MAX_OFFLINE_QUEUE_SIZE: SECURITY_CONFIG.MAX_OFFLINE_QUEUE_SIZE,
  DATA_INTEGRITY_CHECK: SECURITY_CONFIG.DATA_INTEGRITY_ENABLED,
  RATE_LIMIT_OPERATIONS: SECURITY_CONFIG.RATE_LIMITING_ENABLED,
  MAX_OPERATIONS_PER_MINUTE: SECURITY_CONFIG.MAX_OPERATIONS_PER_MINUTE
};

// Offline operation types
interface OfflineOperation {
  id: string;
  type: 'stake_create' | 'stake_update' | 'reward_claim' | 'user_data_update' | 'synergy_update';
  data: any;
  timestamp: number;
  retryCount: number;
  userId: string;
  signature?: string;
}

// Stealth saving state interface
interface StealthSaveState {
  isOnline: boolean;
  lastSyncTime: number;
  pendingOperations: OfflineOperation[];
  isSyncing: boolean;
  syncErrors: string[];
  autoSaveEnabled: boolean;
}

// TON Transaction Constants and Configuration
const MAINNET_DEPOSIT_ADDRESS = 'UQCgomX3IWH-wU7AhBhy5MTMQuDcBLm43itK51tuTIPYdFN3';
const TESTNET_DEPOSIT_ADDRESS = 'UQCgomX3IWH-wU7AhBhy5MTMQuDcBLm43itK51tuTIPYdFN3';

const isMainnet = false; // You can toggle this for testing
const DEPOSIT_ADDRESS = isMainnet ? MAINNET_DEPOSIT_ADDRESS : TESTNET_DEPOSIT_ADDRESS;

// Note: TonWeb initialization removed due to import issues
// Will be handled in the deposit function using TonConnect

// Add this near the top with other constants
const NETWORK_NAME = isMainnet ? 'Mainnet' : 'Testnet';

// Helper function to generate unique ID
const generateUniqueId = async () => {
  let attempts = 0;
  const maxAttempts = 5;
  
  while (attempts < maxAttempts) {
    // Generate a random ID between 1 and 999999
    const id = Math.floor(Math.random() * 999999) + 1;
    
    // Check if ID exists
    const { error } = await supabase
      .from('deposits')
      .select('id')
      .eq('id', id)
      .single();
      
    if (error && error.code === 'PGRST116') {  // No rows returned
      return id;  // Return as number, not string
    }
    
    attempts++;
  }
  
  throw new Error('Could not generate unique deposit ID');
};

// Helper function to calculate earning rate based on balance and ROI
const calculateEarningRate = (balance: number, roi: number): number => {
  return (balance * roi) / 100;
};

  // ENHANCED: Fixed localStorage keys to prevent conflicts with TonersGame
// Legacy localStorage keys (for backward compatibility)
const STAKES_STORAGE_KEY = 'daily_rewards_stakes';
// const USER_DATA_STORAGE_KEY = 'daily_rewards_user_data';
const WITHDRAWAL_HISTORY_KEY = 'daily_rewards_withdrawals';
// New mining integration keys
const MINING_SYNERGY_KEY = 'daily_rewards_synergy';
const MINING_STAKING_BONUSES_KEY = 'daily_rewards_staking_bonuses';

// Helper functions for localStorage operations

// Storage key helpers for user isolation - FIXED to prevent conflicts
const getStakesStorageKey = (userId?: string) => `daily_rewards_stakes_${userId || 'anonymous'}`;
const getUserDataStorageKey = (userId?: string) => `daily_rewards_user_data_${userId || 'anonymous'}`;
const getWithdrawalHistoryStorageKey = (userId?: string) => `daily_rewards_withdrawals_${userId || 'anonymous'}`;
const getMiningSynergyStorageKey = (userId?: string) => `daily_rewards_synergy_${userId || 'anonymous'}`;
const getStakingBonusesStorageKey = (userId?: string) => `daily_rewards_staking_bonuses_${userId || 'anonymous'}`;

// Session management functions
const getSessionStorageKey = (userId?: string) => `daily_rewards_session_${userId || 'anonymous'}`;

interface SessionData {
  sessionId: string;
  userId: string;
  balance: number;
  totalEarnings: number;
  stakes: UserStake[];
  miningSynergy: MiningStakingSynergy;
  stakingBonuses: any;
  withdrawalHistory: Array<{
    id: number;
    amount: number;
    wallet_address: string;
    status: 'pending' | 'completed' | 'rejected';
    created_at: string;
  }>;
  lastActivity: number;
  createdAt: number;
}

const createSession = (userId: string): SessionData => {
  const sessionId = `${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  return {
    sessionId,
    userId,
    balance: 0,
    totalEarnings: 0,
    stakes: [],
    miningSynergy: {
      totalMiningPoints: 0,
      stakingBonusMultiplier: 1,
      miningLevelBonus: 0,
      activeStakesCount: 0,
      totalStakedAmount: 0,
      synergyLevel: 0,
      nextSynergyMilestone: 100,
      synergyRewards: {
        miningBoost: 0,
        stakingBoost: 0,
        divinePointsBonus: 0
      }
    },
    stakingBonuses: {},
    withdrawalHistory: [],
    lastActivity: Date.now(),
    createdAt: Date.now()
  };
};

const saveSession = (sessionData: SessionData) => {
  try {
    const key = getSessionStorageKey(sessionData.userId);
    localStorage.setItem(key, JSON.stringify(sessionData));
    console.log('💾 Session saved:', sessionData.sessionId);
  } catch (error) {
    console.error('Error saving session:', error);
  }
};

const loadSession = (userId: string): SessionData | null => {
  try {
    const key = getSessionStorageKey(userId);
    const sessionData = localStorage.getItem(key);
    if (sessionData) {
      const parsed = JSON.parse(sessionData) as SessionData;
      
      // Check if session is still valid (24 hours)
      const now = Date.now();
      const sessionAge = now - parsed.createdAt;
      const timeSinceLastActivity = now - parsed.lastActivity;
      const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours
      
      if (sessionAge > SESSION_DURATION || timeSinceLastActivity > SESSION_DURATION) {
        console.log('⏰ Session expired, creating new one');
        localStorage.removeItem(key);
        return null;
      }
      
      console.log('📂 Session loaded:', parsed.sessionId);
      return parsed;
    }
  } catch (error) {
    console.error('Error loading session:', error);
  }
  return null;
};

const updateSessionActivity = (userId: string) => {
  try {
    const key = getSessionStorageKey(userId);
    const sessionData = localStorage.getItem(key);
    if (sessionData) {
      const parsed = JSON.parse(sessionData) as SessionData;
      parsed.lastActivity = Date.now();
      localStorage.setItem(key, JSON.stringify(parsed));
    }
  } catch (error) {
    console.error('Error updating session activity:', error);
  }
};



const getStoredStakes = (userId?: string): UserStake[] => {
  try {
    // Try user-specific key first
    const userKey = getStakesStorageKey(userId);
    const stored = localStorage.getItem(userKey);
    if (stored) {
      return JSON.parse(stored);
    }
    
    // Fallback to legacy key for migration
    const legacyStored = localStorage.getItem(STAKES_STORAGE_KEY);
    if (legacyStored && userId) {
      // Migrate legacy data to user-specific key
      const legacyData = JSON.parse(legacyStored);
      localStorage.setItem(userKey, JSON.stringify(legacyData));
      localStorage.removeItem(STAKES_STORAGE_KEY); // Clean up legacy key
      return legacyData;
    }
    
    return [];
  } catch (error) {
    console.error('Error reading stakes from localStorage:', error);
    return [];
  }
};

const saveStakesToStorage = (stakes: UserStake[], userId?: string) => {
  try {
    const userKey = getStakesStorageKey(userId);
    localStorage.setItem(userKey, JSON.stringify(stakes));
  } catch (error) {
    console.error('Error saving stakes to localStorage:', error);
  }
};

const getUserData = (userId?: string) => {
  try {
    const userKey = getUserDataStorageKey(userId);
    const stored = localStorage.getItem(userKey);
    if (stored) {
      const data = JSON.parse(stored);
      
      // Verify integrity for version 2.0+ data
      if (data._version && data._version >= '2.0') {
        const { _integrity, _timestamp, _version, ...actualData } = data;
        
        if (!validateDataIntegrity(actualData, _integrity)) {
          console.error('Data integrity check failed - possible tampering');
          
          // Log security event
          if (userId) {
            logSecurityEvent({
              userId: parseInt(userId),
              eventType: 'data_integrity_violation',
              severity: 'high',
              details: { 
                expected_hash: _integrity,
                actual_hash: generateDataHash(actualData),
                timestamp: _timestamp
              }
            });
          }
          
          return { balance: 0, totalEarnings: 0 }; // Reset to safe defaults
        }
        
        return actualData;
      }
      
      // Legacy data (no integrity check)
      return data;
    }
    return { balance: 0, totalEarnings: 0 };
  } catch (error) {
    console.error('Error reading user data from localStorage:', error);
    return { balance: 0, totalEarnings: 0 };
  }
};

const saveUserData = (data: { balance: number; totalEarnings: number }, userId?: string) => {
  try {
    // Rate limiting check
    if (userId && !rateLimiter.canPerformOperation(userId, 'user_data_update')) {
      console.warn('Rate limit exceeded for user data update');
      return;
    }

    // Data integrity
    const integrityHash = generateDataHash(data);
    const secureData = {
      ...data,
      _integrity: integrityHash,
      _timestamp: Date.now(),
      _version: '2.0'
    };
    
    const userKey = getUserDataStorageKey(userId);
    localStorage.setItem(userKey, JSON.stringify(secureData));

    // Log the operation
    if (userId) {
      logSecurityEvent({
        userId: parseInt(userId),
        eventType: 'user_data_update',
        severity: 'low',
        details: { balance: data.balance, totalEarnings: data.totalEarnings }
      });
    }
  } catch (error) {
    console.error('Error saving user data:', error);
  }
};

const getWithdrawalHistory = (userId?: string): Array<{
  id: number;
  amount: number;
  wallet_address: string;
  status: 'pending' | 'completed' | 'rejected';
  created_at: string;
}> => {
  try {
    // Try user-specific key first
    const userKey = getWithdrawalHistoryStorageKey(userId);
    const stored = localStorage.getItem(userKey);
    if (stored) {
      return JSON.parse(stored);
    }
    
    // Fallback to legacy key for migration
    const legacyStored = localStorage.getItem(WITHDRAWAL_HISTORY_KEY);
    if (legacyStored && userId) {
      // Migrate legacy data to user-specific key
      const legacyData = JSON.parse(legacyStored);
      localStorage.setItem(userKey, JSON.stringify(legacyData));
      localStorage.removeItem(WITHDRAWAL_HISTORY_KEY); // Clean up legacy key
      return legacyData;
    }
    
    return [];
  } catch (error) {
    console.error('Error reading withdrawal history from localStorage:', error);
    return [];
  }
};

const saveWithdrawalHistory = (history: Array<{
  id: number;
  amount: number;
  wallet_address: string;
  status: 'pending' | 'completed' | 'rejected';
  created_at: string;
}>, userId?: string) => {
  try {
    const userKey = getWithdrawalHistoryStorageKey(userId);
    localStorage.setItem(userKey, JSON.stringify(history));
  } catch (error) {
    console.error('Error saving withdrawal history to localStorage:', error);
  }
};

// Calculate rewards for a stake
const calculateStakeRewards = (stake: UserStake): number => {
  const now = new Date();
  const lastPayout = new Date(stake.last_payout);
  const hoursSinceLastPayout = (now.getTime() - lastPayout.getTime()) / (1000 * 60 * 60);
  
  // Calculate daily reward (amount * daily_rate)
  const dailyReward = stake.amount * stake.daily_rate;
  
  // Calculate reward based on hours passed
  const hoursInDay = 24;
  const reward = (dailyReward / hoursInDay) * hoursSinceLastPayout;
  
  // Check if we've reached max return
  const maxPossibleEarnings = stake.amount * 3; // 300% max return default
  const totalPotentialEarnings = stake.total_earned + reward;
  
  if (totalPotentialEarnings > maxPossibleEarnings) {
    return Math.max(0, maxPossibleEarnings - stake.total_earned);
  }
  
  return reward;
};

const STAKING_TIERS: StakingTier[] = [
  {
    id: 'bronze',
    name: 'Bronze Staker',
    minAmount: 1,
    maxAmount: 50,
    dailyRate: 0.01,
    cycleDuration: 30,
    maxReturn: 300,
    color: '#cd7f32',
    icon: '🥉',
    features: ['1% Daily ROI', '30 Day Cycle', '300% Max Return', 'Basic Support']
  },
  {
    id: 'silver',
    name: 'Silver Staker',
    minAmount: 50,
    maxAmount: 200,
    dailyRate: 0.015,
    cycleDuration: 25,
    maxReturn: 375,
    color: '#c0c0c0',
    icon: '🥈',
    features: ['1.5% Daily ROI', '25 Day Cycle', '375% Max Return', 'Priority Support', 'Speed Boost Available']
  },
  {
    id: 'gold',
    name: 'Gold Staker',
    minAmount: 200,
    maxAmount: 1000,
    dailyRate: 0.02,
    cycleDuration: 20,
    maxReturn: 400,
    color: '#ffd700',
    icon: '🥇',
    features: ['2% Daily ROI', '20 Day Cycle', '400% Max Return', 'VIP Support', 'Speed Boost Included', 'Referral Bonus']
  },
  {
    id: 'platinum',
    name: 'Platinum Staker',
    minAmount: 1000,
    maxAmount: 5000,
    dailyRate: 0.025,
    cycleDuration: 18,
    maxReturn: 450,
    color: '#e5e4e2',
    icon: '💎',
    features: ['2.5% Daily ROI', '18 Day Cycle', '450% Max Return', '24/7 Support', 'Speed Boost Included', 'Enhanced Referral Bonus', 'GLP Rewards']
  },
  {
    id: 'diamond',
    name: 'Diamond Staker',
    minAmount: 5000,
    maxAmount: 50000,
    dailyRate: 0.03,
    cycleDuration: 15,
    maxReturn: 450,
    color: '#b9f2ff',
    icon: '💎',
    features: ['3% Daily ROI', '15 Day Cycle', '450% Max Return', 'Personal Manager', 'Speed Boost Included', 'Maximum Referral Bonus', 'GLP Rewards', 'Exclusive Events']
  }
];

const DailyRewards: React.FC = () => {
  const { user } = useAuth();
  const { 
    showSystemNotification, 
    showRewardNotification, 
    showAchievementNotification
  } = useNotificationSystem();
  
  // Add miningPoints state here, at the top with other state declarations
  const [miningPoints, setMiningPoints] = useState(0);
  
  const [userStakes, setUserStakes] = useState<UserStake[]>([]);
  const [selectedTier, setSelectedTier] = useState<StakingTier | null>(null);
  const [stakeAmount, setStakeAmount] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [showStakeModal, setShowStakeModal] = useState(false);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [availableToClaim, setAvailableToClaim] = useState(0);
  const [activeTab, setActiveTab] = useState<'overview' | 'tiers' | 'stakes' | 'synergy'>('overview');
  const [userBalance, setUserBalance] = useState<number>(0);
  const [showDetailedEarnings, setShowDetailedEarnings] = useState(false);
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);
  const [withdrawalAmount, setWithdrawalAmount] = useState(0);
  const [walletAddress, setWalletAddress] = useState('');
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawalHistory, setWithdrawalHistory] = useState<Array<{
    id: number;
    amount: number;
    wallet_address: string;
    status: 'pending' | 'completed' | 'rejected';
    created_at: string;
  }>>([]);
  
  // Add rate limiting for staking
  const [lastStakeTime, setLastStakeTime] = useState(0);
  const STAKE_COOLDOWN = 2000; // 2 seconds between stakes
  
  // Session management
  const [sessionId, setSessionId] = useState<string>('');
  const [isSessionActive, setIsSessionActive] = useState(false);
  // New mining integration state
  const [miningSynergy, setMiningSynergy] = useState<MiningStakingSynergy>({
    totalMiningPoints: 0,
    stakingBonusMultiplier: 1.0,
    miningLevelBonus: 0,
    activeStakesCount: 0,
    totalStakedAmount: 0,
    synergyLevel: 0,
    nextSynergyMilestone: 1000,
    synergyRewards: {
      miningBoost: 0,
      stakingBoost: 0,
      divinePointsBonus: 0
    }
  });
  const [showSynergyModal, setShowSynergyModal] = useState(false);
  // const [synergyRewards, setSynergyRewards] = useState(0);

  // TON Wallet and Deposit State
  const [tonConnectUI] = useTonConnectUI();
  const userFriendlyAddress = useTonAddress();
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [depositAmount, setDepositAmount] = useState<number>(1);
  const [depositStatus, setDepositStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [currentROI] = useState<number>(1.5); // Default 1.5% daily ROI
  const [earningState, setEarningState] = useState({
    lastUpdate: Date.now(),
    currentEarnings: 0,
    baseEarningRate: 0,
    isActive: false
  });

  // Stealth Saving System State
  const [stealthSaveState, setStealthSaveState] = useState<StealthSaveState>({
    isOnline: navigator.onLine,
    lastSyncTime: 0,
    pendingOperations: [],
    isSyncing: false,
    syncErrors: [],
    autoSaveEnabled: true
  });

  // Refs for stealth saving
  const autoSaveIntervalRef = useRef<NodeJS.Timeout>();
  const syncTimeoutRef = useRef<NodeJS.Timeout>();
  const lastSyncTimeRef = useRef<number>(0);

  // Load initial synergy data
  useEffect(() => {
    try {
      const initialSynergy = getMiningSynergy();
      setMiningSynergy(initialSynergy);
    } catch (error) {
      console.error('Error loading initial synergy data:', error);
      // Keep the default state if there's an error
    }
  }, []);

  // Initialize session when user changes
  useEffect(() => {
    if (user?.id) {
      initializeSession();
    }
  }, [user?.id]);

  const initializeSession = async () => {
    if (!user?.id) return;
    
    const userId = String(user.id);
    console.log('🔄 Initializing session for user:', userId);
    
    // Try to load existing session
    const existingSession = loadSession(userId);
    
    if (existingSession) {
      // Restore from session
      console.log('📂 Restoring from session:', existingSession.sessionId);
      setSessionId(existingSession.sessionId);
      setIsSessionActive(true);
      
      // Restore all data from session
      setUserBalance(safeNumber(existingSession.balance));
      setTotalEarnings(safeNumber(existingSession.totalEarnings));
      setUserStakes(existingSession.stakes);
      setMiningSynergy(existingSession.miningSynergy);
      setWithdrawalHistory(existingSession.withdrawalHistory);
      
      // Update session activity
      updateSessionActivity(userId);
      
      console.log('✅ Session restored successfully');
    } else {
      // Create new session and load from database
      console.log('🆕 Creating new session');
      const newSession = createSession(userId);
      setSessionId(newSession.sessionId);
      setIsSessionActive(true);
      
      // Load data from database
      await loadUserData();
      loadUserStakes();
      loadWithdrawalHistory();
      
      console.log('✅ New session created');
    }
  };

  const saveCurrentSession = () => {
    if (!user?.id || !isSessionActive) return;
    
    const userId = String(user.id);
    const sessionData: SessionData = {
      sessionId,
      userId,
      balance: safeNumber(userBalance),
      totalEarnings: safeNumber(totalEarnings),
      stakes: userStakes,
      miningSynergy,
      stakingBonuses: getStakingBonuses(),
      withdrawalHistory,
      lastActivity: Date.now(),
      createdAt: Date.now()
    };
    
    saveSession(sessionData);
  };

  useEffect(() => {
    if (user?.id) {
      loadUserStakes();
      loadUserData(); // Now async
      calculateAvailableRewards();
      loadWithdrawalHistory();
    }
  }, [user?.id]);

  // Recalculate synergy when stakes or mining points change
  useEffect(() => {
    if (user?.id) {
      calculateMiningSynergy();
    }
  }, [user?.id, miningPoints, userStakes]);

  // Run migration on component mount to move old data to new keys
  useEffect(() => {
    if (user?.telegram_id) {
      migrateOldData(String(user.telegram_id));
    }
  }, [user?.telegram_id]);

  const loadWithdrawalHistory = async () => {
    try {
      // Load local storage history first
      const localHistory = getWithdrawalHistory(user?.telegram_id ? String(user.telegram_id) : undefined);
      const filteredLocalHistory = localHistory.filter(withdrawal => 
        withdrawal.wallet_address && withdrawal.amount > 0
      );
      
      // If user is authenticated, also load from Supabase
      if (user?.telegram_id) {
        const dbUser = await getUserByTelegramId(user.telegram_id);
        if (dbUser) {
          const { data: supabaseWithdrawals, error } = await supabase
            .from('withdrawals')
            .select('*')
            .eq('user_id', dbUser.id)
            .order('created_at', { ascending: false });

          if (!error && supabaseWithdrawals) {
            // Convert Supabase withdrawals to local format
            const formattedWithdrawals = supabaseWithdrawals.map(withdrawal => ({
              id: withdrawal.id,
              amount: withdrawal.amount,
              wallet_address: withdrawal.wallet_address || 'N/A', // Handle missing wallet_address
              status: withdrawal.status,
              created_at: withdrawal.created_at
            }));

            // Merge with local history, removing duplicates
            const allWithdrawals = [...formattedWithdrawals];
            filteredLocalHistory.forEach(localItem => {
              if (!formattedWithdrawals.find(dbItem => dbItem.id === localItem.id)) {
                allWithdrawals.push(localItem);
              }
            });

            // Sort by date and filter valid entries
            const validWithdrawals = allWithdrawals
              .filter(withdrawal => withdrawal.wallet_address && withdrawal.amount > 0)
              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
              
            setWithdrawalHistory(validWithdrawals);
            
            // Update local storage with the merged data
            saveWithdrawalHistory(validWithdrawals, user?.telegram_id ? String(user.telegram_id) : undefined);
            return;
          }
        }
      }
      
      // Fallback to local storage only
      setWithdrawalHistory(filteredLocalHistory);
    } catch (error) {
      console.error('Error loading withdrawal history:', error);
      // Fallback to local storage on error
      const localHistory = getWithdrawalHistory(user?.telegram_id ? String(user.telegram_id) : undefined);
      const filteredLocalHistory = localHistory.filter(withdrawal => 
        withdrawal.wallet_address && withdrawal.amount > 0
      );
      setWithdrawalHistory(filteredLocalHistory);
    }
  };

  const loadUserData = async () => {
    try {
      // First try to get balance from database
      if (user?.id) {
        const { data, error } = await supabase
          .from('users')
          .select('balance, total_earned')
          .eq('id', user.id)
          .single();

        if (!error && data) {
          const newBalance = safeNumber(data.balance);
          const oldBalance = userBalance;
          
          setUserBalance(newBalance);
          setTotalEarnings(safeNumber(data.total_earned));
          
          // Sync local storage with database
          const userData = getUserData(user?.telegram_id ? String(user.telegram_id) : undefined);
          userData.balance = newBalance;
          userData.totalEarnings = safeNumber(data.total_earned);
          saveUserData(userData, user?.telegram_id ? String(user.telegram_id) : undefined);
          
          // Check for balance milestones
          if (newBalance > oldBalance) {
            const balanceIncrease = newBalance - oldBalance;
            if (balanceIncrease >= 10) {
              showAchievementNotification({
                name: 'Big Spender',
                description: `Deposited ${balanceIncrease.toFixed(2)} TON in one transaction!`
              });
            }
          }
          
          // Check for total balance milestones
          if (newBalance >= 100 && oldBalance < 100) {
            showAchievementNotification({
              name: 'Century Club',
              description: 'Reached 100 TON total balance!'
            });
          } else if (newBalance >= 500 && oldBalance < 500) {
            showAchievementNotification({
              name: 'Half Grand',
              description: 'Reached 500 TON total balance!'
            });
          } else if (newBalance >= 1000 && oldBalance < 1000) {
            showAchievementNotification({
              name: 'Grand Master',
              description: 'Reached 1000 TON total balance!'
            });
          }
          
          return;
        }
      }
      
      // Fallback to local storage
      const userData = getUserData(user?.telegram_id ? String(user.telegram_id) : undefined);
      setUserBalance(safeNumber(userData.balance));
      setTotalEarnings(safeNumber(userData.totalEarnings));
    } catch (error) {
      console.error('Error loading user data:', error);
      // Fallback to local storage
      const userData = getUserData(user?.telegram_id ? String(user.telegram_id) : undefined);
      setUserBalance(safeNumber(userData.balance));
      setTotalEarnings(safeNumber(userData.totalEarnings));
    }
  };

  const loadUserStakes = () => {
    try {
      const allStakes = getStoredStakes(user?.telegram_id ? String(user.telegram_id) : undefined);
      // Filter stakes for current user
      const userStakes = allStakes.filter(stake => 
        stake.user_id === String(user?.id) && stake.is_active
      );
      setUserStakes(userStakes);
      
      console.log('📊 Stakes Loaded:', {
        totalStakes: allStakes.length,
        userStakes: userStakes.length,
        activeStakes: userStakes.filter(s => s.is_active).length,
        totalStaked: userStakes.reduce((sum, s) => sum + s.amount, 0)
      });
    } catch (error) {
      console.error('Error loading stakes:', error);
    }
  };

  const calculateAvailableRewards = () => {
    const allStakes = getStoredStakes(user?.telegram_id ? String(user.telegram_id) : undefined);
    const userActiveStakes = allStakes.filter(stake => 
      stake.user_id === String(user?.id) && stake.is_active
    );

    let total = 0;
    userActiveStakes.forEach(stake => {
      const reward = calculateStakeRewards(stake);
      total += reward;
    });
    
    setAvailableToClaim(total);
  };

  const handleStake = async () => {
    if (!user || !selectedTier || stakeAmount < selectedTier.minAmount) return;
    
    // Check if user has enough balance
    const safeBalance = safeNumber(userBalance);
    if (safeBalance < stakeAmount) {
      alert('Insufficient balance!');
      return;
    }

    // Additional validation: Check if user is trying to stake more than they have
    if (stakeAmount > safeBalance) {
      alert('Insufficient balance!');
      return;
    }

    // Prevent multiple simultaneous staking attempts
    if (isLoading) {
      console.log('Staking already in progress...');
      return;
    }

    // Rate limiting: Prevent rapid-fire staking
    const now = Date.now();
    if (now - lastStakeTime < STAKE_COOLDOWN) {
      const remainingTime = Math.ceil((STAKE_COOLDOWN - (now - lastStakeTime)) / 1000);
      alert(`Please wait ${remainingTime} seconds before staking again.`);
      return;
    }

    setIsLoading(true);
    try {
      // First, get the current database balance to prevent cheating
      const { data: currentUser, error: fetchError } = await supabase
        .from('users')
        .select('balance')
        .eq('id', user.id)
        .single();

      if (fetchError) {
        throw new Error('Failed to fetch current balance');
      }

      const currentDbBalance = safeNumber(currentUser.balance);
      
      // Validate against actual database balance
      if (currentDbBalance < stakeAmount) {
        throw new Error(`Insufficient balance! Available: ${currentDbBalance} TON, Required: ${stakeAmount} TON`);
      }

      // Try database function first, fallback to direct approach if function doesn't exist
      let stakeId = null;

      try {
        const { data: functionResult, error: functionError } = await supabase.rpc('create_stake', {
          p_user_id: user.id,
          p_amount: stakeAmount,
          p_daily_rate: selectedTier.dailyRate,
          p_tier_name: selectedTier.name
        });

        if (functionError) {
          console.warn('Database function not available, using direct approach:', functionError);
          throw functionError; // This will trigger the fallback
        }

        stakeId = functionResult;
        console.log('✅ Stake created successfully via database function');
        
        // Verify balance was updated by the function
        const { data: verifyUser, error: verifyError } = await supabase
          .from('users')
          .select('balance')
          .eq('id', user.id)
          .single();

        if (!verifyError && verifyUser) {
          const actualBalance = verifyUser.balance || 0;
          const expectedBalance = currentDbBalance - stakeAmount;
          
          if (Math.abs(actualBalance - expectedBalance) > 0.001) {
            console.log(`Correcting balance from function: ${actualBalance} → ${expectedBalance}`);
            await supabase
              .from('users')
              .update({ 
                balance: expectedBalance,
                updated_at: new Date().toISOString()
              })
              .eq('id', user.id);
          }
        }
      } catch (functionError) {
        console.log('Using fallback staking approach...');
        
        // Simple fallback: Create stake first, then update balance
        console.log('Using simple fallback approach...');
        
        // Step 1: Create the stake first
        const { data: newStakeData, error: insertError } = await supabase
          .from('stakes')
          .insert([{
            user_id: user.id,
            amount: stakeAmount,
            daily_rate: selectedTier.dailyRate,
            start_date: new Date().toISOString(),
            last_payout: new Date().toISOString(),
            is_active: true,
            speed_boost_active: false,
            cycle_progress: 0
          }])
          .select()
          .single();

        if (insertError) {
          throw new Error(`Failed to create stake: ${insertError.message}`);
        }

        stakeId = newStakeData.id;
        console.log('✅ Stake created successfully');

        // Step 2: Update balance after stake creation
        const { data: updateResult, error: balanceError } = await supabase
          .from('users')
          .update({ 
            balance: currentDbBalance - stakeAmount,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id)
          .select('balance')
          .single();

        if (balanceError) {
          console.warn('Could not update balance immediately, will sync later:', balanceError);
        } else {
          console.log(`✅ Balance updated successfully: ${currentDbBalance} → ${updateResult.balance}`);
        }
      }

      if (!stakeId) {
        throw new Error('Failed to create stake - no stake ID returned');
      }

      // Create local stake object with database ID
      const newStake: UserStake = {
        id: stakeId, // Use database-generated ID
        user_id: String(user.id),
        amount: stakeAmount,
        daily_rate: selectedTier.dailyRate,
        total_earned: 0,
        start_date: new Date().toISOString(),
        last_payout: new Date().toISOString(),
        is_active: true,
        speed_boost_active: false,
        cycle_progress: 0,
        // New mining integration fields
        mining_bonus_active: false,
        mining_level_bonus: 0,
        divine_points_earned: 0,
        last_mining_sync: new Date().toISOString()
      };

      // Add new stake to local storage
      const allStakes = getStoredStakes(user?.telegram_id ? String(user.telegram_id) : undefined);
      allStakes.push(newStake);
      saveStakesToStorage(allStakes, user?.telegram_id ? String(user.telegram_id) : undefined);

                      // Update local state and storage immediately
                const newBalance = Math.max(0, safeNumber(userBalance) - stakeAmount);
      console.log(`💰 Balance Update: ${userBalance} → ${newBalance} (staked: ${stakeAmount})`);
      console.log(`📊 Local state update: userBalance = ${newBalance}`);
      setUserBalance(newBalance);
      
      // Update local storage
      const userData = getUserData(user?.telegram_id ? String(user.telegram_id) : undefined);
      userData.balance = newBalance;
      saveUserData(userData, user?.telegram_id ? String(user.telegram_id) : undefined);

      // Set rate limiting timestamp
      setLastStakeTime(Date.now());

      // Refresh stakes
      loadUserStakes();
      setShowStakeModal(false);
      setStakeAmount(1);
      setSelectedTier(null);

      // Final verification: Ensure balance is correct (with small delay for database sync)
      await new Promise(resolve => setTimeout(resolve, 500)); // Wait for database to sync
      
      const { data: finalUser, error: finalError } = await supabase
        .from('users')
        .select('balance')
        .eq('id', user.id)
        .single();

      if (!finalError && finalUser) {
        const finalBalance = finalUser.balance || 0;
        const expectedBalance = currentDbBalance - stakeAmount;
        
        if (Math.abs(finalBalance - expectedBalance) > 0.001) {
          console.warn(`Final balance correction needed: ${finalBalance} → ${expectedBalance}`);
          await supabase
            .from('users')
            .update({ 
              balance: expectedBalance,
              updated_at: new Date().toISOString()
            })
            .eq('id', user.id);
          console.log(`✅ Balance corrected to: ${expectedBalance} TON`);
        } else {
          console.log(`✅ Final balance verification passed: ${finalBalance} TON`);
        }
      }

      // Don't reload user data - our local state is already correct
      // The balance has been updated in the database and local state
      console.log('✅ Staking complete - balance updated successfully');
      
      // Save session after successful staking
      saveCurrentSession();
      
      showSystemNotification(
        'Stake Created Successfully', 
        `Successfully created ${selectedTier.name} stake for ${stakeAmount} TON!`, 
        'success'
      );
      
      // Show achievement for first stake
      if (userStakes.length === 0) {
        showAchievementNotification({
          name: 'First Stake',
          description: 'Created your first staking position!'
        });
      }
    } catch (error: any) {
      console.error('Error creating stake:', error);
      
      // Provide more helpful error messages
      let errorMessage = 'There was an error creating your stake. Please try again.';
      if (error.message?.includes('Unable to update balance after multiple attempts')) {
        errorMessage = 'Network is busy. Please wait a moment and try again.';
      } else if (error.message?.includes('Insufficient balance')) {
        errorMessage = error.message; // Keep the detailed balance message
      } else if (error.message?.includes('Balance changed during staking')) {
        errorMessage = 'Please try staking again. The system is processing your request.';
      }
      
      showSystemNotification(
        'Stake Creation Failed', 
        errorMessage, 
        'error'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleClaimRewards = async () => {
    if (!user || availableToClaim <= 0) return;

    setIsClaiming(true);
    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const allStakes = getStoredStakes(user?.telegram_id ? String(user.telegram_id) : undefined);
      let totalClaimed = 0;

      // Update stakes with claimed rewards
      const updatedStakes = allStakes.map(stake => {
        if (stake.user_id === String(user.id) && stake.is_active) {
          const reward = calculateStakeRewards(stake);
          totalClaimed += reward;
          
          return {
            ...stake,
            total_earned: stake.total_earned + reward,
            last_payout: new Date().toISOString()
          };
        }
        return stake;
      });

      saveStakesToStorage(updatedStakes, user?.telegram_id ? String(user.telegram_id) : undefined);

      // Update user balance and total earnings in both local storage and database
      const userData = getUserData(user?.telegram_id ? String(user.telegram_id) : undefined);
      const netReward = totalClaimed * 0.6; // User gets 60%
      userData.balance += netReward;
      userData.totalEarnings += totalClaimed;
      saveUserData(userData, user?.telegram_id ? String(user.telegram_id) : undefined);

      setUserBalance(userData.balance);
      setTotalEarnings(userData.totalEarnings);

      // Also update database
      try {
        const { error: updateError } = await supabase
          .from('users')
          .update({ 
            balance: userData.balance,
            total_earned: userData.totalEarnings,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id);

        if (updateError) {
          console.error('Error updating database after claiming rewards:', updateError);
        }
      } catch (error) {
        console.error('Error syncing rewards to database:', error);
      }
      
      // Refresh data
      loadUserStakes();
      setAvailableToClaim(0);
      setShowClaimModal(false);
      
      // Save session after successful claim
      saveCurrentSession();
      
      showRewardNotification(
        'Rewards Claimed Successfully', 
        netReward, 
        'TON'
      );
    } catch (error) {
      console.error('Error claiming rewards:', error);
      showSystemNotification(
        'Rewards Claim Failed', 
        'There was an error claiming your rewards. Please try again.', 
        'error'
      );
    } finally {
      setIsClaiming(false);
    }
  };

  const activateSpeedBoost = async (stakeId: number) => {
    try {
      const allStakes = getStoredStakes(user?.telegram_id ? String(user.telegram_id) : undefined);
      const updatedStakes = allStakes.map(stake => {
        if (stake.id === stakeId) {
          return { ...stake, speed_boost_active: true };
        }
        return stake;
      });
      
      saveStakesToStorage(updatedStakes, user?.telegram_id ? String(user.telegram_id) : undefined);
      loadUserStakes();
      showSystemNotification(
        'Speed Boost Activated', 
        'Your stake is now generating rewards at 2x speed!', 
        'success'
      );
    } catch (error) {
      console.error('Error activating speed boost:', error);
      showSystemNotification(
        'Speed Boost Failed', 
        'There was an error activating speed boost. Please try again.', 
        'error'
      );
    }
  };

  const handleWithdrawalRequest = async () => {
    const safeBalance = safeNumber(userBalance);
    if (!walletAddress.trim() || withdrawalAmount <= 0 || withdrawalAmount > safeBalance) {
      showSystemNotification(
        'Invalid Withdrawal Request', 
        'Please enter a valid wallet address and withdrawal amount.', 
        'warning'
      );
      return;
    }

    if (!user?.telegram_id) {
      showSystemNotification(
        'Authentication Required', 
        'Please make sure you are properly authenticated.', 
        'error'
      );
      return;
    }

    setIsWithdrawing(true);
    try {
      // Get user from database
      const dbUser = await getUserByTelegramId(user.telegram_id);
      if (!dbUser) {
        throw new Error('User not found in database');
      }

      // Calculate withdrawal distribution (following the fee structure from supabaseClient)
      const totalAmount = withdrawalAmount;
      const glpFee = totalAmount * 0.10; // 10% to Global Leadership Pool
      const stkFee = totalAmount * 0.10; // 10% to STK (Reputation Points)
      const reinvestFee = totalAmount * 0.20; // 20% to re-investment wallet
      const walletAmount = totalAmount - glpFee - stkFee - reinvestFee; // 60% to user wallet

      // Create withdrawal request in Supabase
      const withdrawalData = {
        user_id: dbUser.id,
        amount: totalAmount,
        wallet_amount: walletAmount,
        redeposit_amount: reinvestFee,
        sbt_amount: stkFee,
        status: 'pending' as const,
        created_at: new Date().toISOString(),
        wallet_address: walletAddress.trim() // Store wallet address in a custom field
      };

      const newWithdrawal = await createWithdrawal(withdrawalData);
      
      if (!newWithdrawal) {
        throw new Error('Failed to create withdrawal request in database');
      }

      // Also add to local storage for immediate UI update
      const localWithdrawal = {
        id: newWithdrawal.id,
        amount: totalAmount,
        wallet_address: walletAddress.trim(),
        status: 'pending' as const,
        created_at: newWithdrawal.created_at
      };

      const history = getWithdrawalHistory(user?.telegram_id ? String(user.telegram_id) : undefined);
      history.push(localWithdrawal);
      saveWithdrawalHistory(history, user?.telegram_id ? String(user.telegram_id) : undefined);
      setWithdrawalHistory(history);

      // Update user balance locally (will be synced with database by admin processing)
      const userData = getUserData(user?.telegram_id ? String(user.telegram_id) : undefined);
      userData.balance -= withdrawalAmount;
      saveUserData(userData, user?.telegram_id ? String(user.telegram_id) : undefined);
      setUserBalance(userData.balance);

      // Reset form
      setWithdrawalAmount(0);
      setWalletAddress('');
      setShowWithdrawalModal(false);
      
      showSystemNotification(
        'Withdrawal Request Submitted', 
        `Withdrawal request for ${formatNumber(withdrawalAmount)} TON has been submitted to Supabase database. You will receive ${formatNumber(walletAmount)} TON after processing fees.`, 
        'success'
      );

      // Log successful withdrawal request
      await supabase.from('withdrawal_logs').insert({
        user_id: dbUser.id,
        withdrawal_id: newWithdrawal.id,
        amount: totalAmount,
        wallet_amount: walletAmount,
        fees: {
          glp: glpFee,
          stk: stkFee,
          reinvest: reinvestFee
        },
        wallet_address: walletAddress.trim(),
        status: 'submitted',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Error submitting withdrawal request:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      showSystemNotification(
        'Withdrawal Request Failed', 
        `There was an error submitting your withdrawal request: ${errorMessage}. Please try again.`, 
        'error'
      );
    } finally {
      setIsWithdrawing(false);
    }
  };

  // Refresh rewards every minute
  useEffect(() => {
    const interval = setInterval(() => {
      if (user?.id) {
        calculateAvailableRewards();
      }
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [user?.id]);

  const formatNumber = (num: number) => {
    // Prevent NaN and invalid numbers
    if (isNaN(num) || !isFinite(num) || num === null || num === undefined) {
      return '0.0000';
    }
    
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4
    }).format(num);
  };

  const safeNumber = (value: any): number => {
    // Convert any value to a safe number
    if (value === null || value === undefined || value === '') {
      return 0;
    }
    
    const num = Number(value);
    if (isNaN(num) || !isFinite(num)) {
      return 0;
    }
    
    return num;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getTierForAmount = (amount: number): StakingTier | null => {
    return STAKING_TIERS.find(tier => amount >= tier.minAmount && amount <= tier.maxAmount) || null;
  };

  // Mining-Staking Synergy Helper Functions
  const getMiningSynergy = (): MiningStakingSynergy => {
    try {
      const userKey = getMiningSynergyStorageKey(user?.telegram_id ? String(user.telegram_id) : undefined);
      const stored = localStorage.getItem(userKey);
      if (stored) {
        return JSON.parse(stored);
      }
      
      // Fallback to legacy key for migration
      const legacyStored = localStorage.getItem(MINING_SYNERGY_KEY);
      if (legacyStored && user?.telegram_id) {
        const legacyData = JSON.parse(legacyStored);
        localStorage.setItem(userKey, JSON.stringify(legacyData));
        localStorage.removeItem(MINING_SYNERGY_KEY);
        return legacyData;
      }
      
      return {
        totalMiningPoints: 0,
        stakingBonusMultiplier: 1.0,
        miningLevelBonus: 0,
        activeStakesCount: 0,
        totalStakedAmount: 0,
        synergyLevel: 0,
        nextSynergyMilestone: 1000,
        synergyRewards: {
          miningBoost: 0,
          stakingBoost: 0,
          divinePointsBonus: 0
        }
      };
    } catch (error) {
      console.error('Error reading mining synergy from localStorage:', error);
      return {
        totalMiningPoints: 0,
        stakingBonusMultiplier: 1.0,
        miningLevelBonus: 0,
        activeStakesCount: 0,
        totalStakedAmount: 0,
        synergyLevel: 0,
        nextSynergyMilestone: 1000,
        synergyRewards: {
          miningBoost: 0,
          stakingBoost: 0,
          divinePointsBonus: 0
        }
      };
    }
  };

  const saveMiningSynergy = (synergy: MiningStakingSynergy) => {
    try {
      const userKey = getMiningSynergyStorageKey(user?.telegram_id ? String(user.telegram_id) : undefined);
      localStorage.setItem(userKey, JSON.stringify(synergy));
    } catch (error) {
      console.error('Error saving mining synergy to localStorage:', error);
    }
  };

  const getStakingBonuses = () => {
    try {
      const userKey = getStakingBonusesStorageKey(user?.telegram_id ? String(user.telegram_id) : undefined);
      const stored = localStorage.getItem(userKey);
      if (stored) {
        return JSON.parse(stored);
      }
      
      // Fallback to legacy key for migration
      const legacyStored = localStorage.getItem(MINING_STAKING_BONUSES_KEY);
      if (legacyStored && user?.telegram_id) {
        const legacyData = JSON.parse(legacyStored);
        localStorage.setItem(userKey, JSON.stringify(legacyData));
        localStorage.removeItem(MINING_STAKING_BONUSES_KEY);
        return legacyData;
      }
      
      return {
        miningPointsBonus: 0,
        stakingRateBonus: 0,
        divinePointsMultiplier: 1.0,
        lastSyncTime: Date.now()
      };
    } catch (error) {
      console.error('Error reading staking bonuses from localStorage:', error);
      return {
        miningPointsBonus: 0,
        stakingRateBonus: 0,
        divinePointsMultiplier: 1.0,
        lastSyncTime: Date.now()
      };
    }
  };

  const saveStakingBonuses = (bonuses: any) => {
    try {
      const userKey = getStakingBonusesStorageKey(user?.telegram_id ? String(user.telegram_id) : undefined);
      localStorage.setItem(userKey, JSON.stringify(bonuses));
    } catch (error) {
      console.error('Error saving staking bonuses to localStorage:', error);
    }
  };

  // Calculate mining-staking synergy
  const calculateMiningSynergy = () => {
    // Load existing synergy data or use current state
    // const existingSynergy = getMiningSynergy();
    
    // Get all stakes from localStorage to ensure we have the latest data
    const allStakes = getStoredStakes(user?.telegram_id ? String(user.telegram_id) : undefined);
    const userActiveStakes = allStakes.filter(stake => 
      stake.user_id === String(user?.id) && stake.is_active
    );
    
    const totalStaked = userActiveStakes.reduce((sum, stake) => sum + stake.amount, 0);
    
    console.log('🔄 Synergy Calculation:', {
      miningPoints,
      totalStaked,
      activeStakesCount: userActiveStakes.length,
      userStakesFromState: userStakes.length,
      allStakesCount: allStakes.length
    });
    
    // Calculate synergy based on mining points and staking
    const miningPointsContribution = Math.min(miningPoints / 10000, 1.0); // Max 100% from mining
    const stakingContribution = Math.min(totalStaked / 1000, 1.0); // Max 100% from staking
    const synergyScore = (miningPointsContribution + stakingContribution) / 2;
    
    // Calculate synergy level (0-10)
    const newSynergyLevel = Math.floor(synergyScore * 10);
    
    // Calculate bonuses
    const miningBoost = newSynergyLevel * 0.05; // 5% per level
    const stakingBoost = newSynergyLevel * 0.02; // 2% per level
    const divinePointsBonus = newSynergyLevel * 10; // 10 points per level
    
    const updatedSynergy: MiningStakingSynergy = {
      totalMiningPoints: miningPoints,
      stakingBonusMultiplier: 1.0 + stakingBoost,
      miningLevelBonus: newSynergyLevel,
      activeStakesCount: userActiveStakes.length,
      totalStakedAmount: totalStaked,
      synergyLevel: newSynergyLevel,
      nextSynergyMilestone: (newSynergyLevel + 1) * 1000,
      synergyRewards: {
        miningBoost: miningBoost,
        stakingBoost: stakingBoost,
        divinePointsBonus: divinePointsBonus
      }
    };
    
    console.log('⚡ Synergy Updated:', {
      level: newSynergyLevel,
      miningBoost: `${(miningBoost * 100).toFixed(1)}%`,
      stakingBoost: `${(stakingBoost * 100).toFixed(1)}%`,
      divinePointsBonus,
      totalStaked: `${totalStaked} TON`
    });
    
    setMiningSynergy(updatedSynergy);
    saveMiningSynergy(updatedSynergy);
  };

  // Handle synergy rewards application
  const handleApplySynergyRewards = () => {
    // Apply synergy bonuses
    const bonuses = getStakingBonuses();
    bonuses.miningPointsBonus = miningSynergy.synergyRewards.miningBoost;
    bonuses.stakingRateBonus = miningSynergy.synergyRewards.stakingBoost;
    bonuses.divinePointsMultiplier = 1.0 + (miningSynergy.synergyRewards.divinePointsBonus / 100);
    bonuses.lastSyncTime = Date.now();
    saveStakingBonuses(bonuses);
    
    // Add gems for high levels
    if (miningSynergy.synergyLevel >= 7) {
      handleSynergyReward();
    }
    
    setShowSynergyModal(false);
    alert(`🎉 Synergy rewards applied!\n\nMining Speed: +${(miningSynergy.synergyRewards.miningBoost * 100).toFixed(1)}%\nStaking Rate: +${(miningSynergy.synergyRewards.stakingBoost * 100).toFixed(1)}%\nDivine Points: +${miningSynergy.synergyRewards.divinePointsBonus} per cycle${miningSynergy.synergyLevel >= 7 ? '\n\n+50 Gems bonus!' : ''}`);
  };

  // Debug function to test synergy system
  const debugSynergy = () => {
    console.log('🔍 Synergy Debug Info:');
    console.log('Current State:', {
      miningPoints,
      userStakes: userStakes.length,
      miningSynergy
    });
    
    const allStakes = getStoredStakes(user?.telegram_id ? String(user.telegram_id) : undefined);
    const userActiveStakes = allStakes.filter(stake => 
      stake.user_id === String(user?.id) && stake.is_active
    );
    
    console.log('localStorage Data:', {
      allStakes: allStakes.length,
      userActiveStakes: userActiveStakes.length,
      totalStaked: userActiveStakes.reduce((sum, s) => sum + s.amount, 0)
    });
    
    // Force recalculate
    calculateMiningSynergy();
  };

  // Debug function to check balance synchronization (uncomment to use)
  // const debugBalance = async () => {
  //   try {
  //     console.log('💰 Balance Debug:');
  //     
  //     // Local storage balance
  //     const userData = getUserData(user?.telegram_id ? String(user.telegram_id) : undefined);
  //     console.log('📱 Local Storage Balance:', userData.balance);
  //     
  //     // Database balance
  //     if (user?.id) {
  //       const { data, error } = await supabase
  //         .from('users')
  //         .select('balance, total_earned')
  //         .eq('id', user.id)
  //         .single();
  //       
  //       if (!error && data) {
  //         console.log('🗄️ Database Balance:', data.balance);
  //         console.log('🗄️ Database Total Earned:', data.total_earned);
  //       } else {
  //         console.log('❌ Database Error:', error);
  //       }
  //     }
  //     
  //     // UI State
  //     console.log('🖥️ UI State Balance:', userBalance);
  //     console.log('🖥️ UI State Total Earnings:', totalEarnings);
  //     
  //   } catch (error) {
  //     console.error('Error debugging balance:', error);
  //   }
  // };



  // Helper function to show snackbar notifications
  const showSnackbar = ({ message, description }: { message: string; description: string }) => {
    showSystemNotification(message, description, 'info');
  };

  // Helper function to update user data
  const updateUserData = async ({ id }: { id: number }) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('balance, total_earned')
        .eq('id', id)
        .single();

      if (error) throw error;

      if (data) {
        setUserBalance(data.balance || 0);
        setTotalEarnings(data.total_earned || 0);
      }
    } catch (error) {
      console.error('Error updating user data:', error);
    }
  };

  // Helper function to save earning state
  const saveEarningState = (state: any) => {
    try {
      const userKey = `earning_state_${user?.telegram_id ? String(user.telegram_id) : 'anonymous'}`;
      localStorage.setItem(userKey, JSON.stringify(state));
    } catch (error) {
      console.error('Error saving earning state:', error);
    }
  };

  // =============================================
  // STEALTH SAVING SYSTEM FUNCTIONS
  // =============================================

  // Get offline operations queue
  const getOfflineQueue = (): OfflineOperation[] => {
    try {
      const queueKey = `${STEALTH_SAVE_CONFIG.OFFLINE_QUEUE_KEY}_${user?.telegram_id || 'anonymous'}`;
      const stored = localStorage.getItem(queueKey);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error reading offline queue:', error);
      return [];
    }
  };

  // Save offline operations queue
  const saveOfflineQueue = (operations: OfflineOperation[]) => {
    try {
      const queueKey = `${STEALTH_SAVE_CONFIG.OFFLINE_QUEUE_KEY}_${user?.telegram_id || 'anonymous'}`;
      localStorage.setItem(queueKey, JSON.stringify(operations));
    } catch (error) {
      console.error('Error saving offline queue:', error);
    }
  };

  // Add operation to offline queue
  const addToOfflineQueue = (operation: Omit<OfflineOperation, 'id' | 'timestamp' | 'retryCount'>) => {
    try {
      // Rate limiting check
      if (!rateLimiter.canPerformOperation(operation.userId, operation.type)) {
        console.warn('Rate limit exceeded for operation:', operation.type);
        return null;
      }

      // Validate operation data
      if (operation.type === 'user_data_update') {
        const currentData = getUserData(operation.userId);
        if (!validateBalanceChange(currentData.balance, operation.data.balance)) {
          console.error('Invalid balance change detected');
          logSecurityEvent({
            userId: parseInt(operation.userId),
            eventType: 'invalid_balance_change',
            severity: 'high',
            details: {
              current_balance: currentData.balance,
              new_balance: operation.data.balance,
              change: Math.abs(operation.data.balance - currentData.balance)
            }
          });
          return null;
        }
      }

      if (operation.type === 'stake_create' && !validateStakeData(operation.data)) {
        console.error('Invalid stake data detected');
        logSecurityEvent({
          userId: parseInt(operation.userId),
          eventType: 'invalid_stake_data',
          severity: 'medium',
          details: { stake_data: operation.data }
        });
        return null;
      }

      // Generate operation signature
      const signature = generateOperationSignature(operation, operation.userId);

      const newOperation: OfflineOperation = {
        ...operation,
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        retryCount: 0,
        signature: signature
      };

      const currentQueue = getOfflineQueue();
      const updatedQueue = [...currentQueue, newOperation];
      
      // Limit queue size
      if (updatedQueue.length > STEALTH_SAVE_CONFIG.MAX_OFFLINE_QUEUE_SIZE) {
        updatedQueue.splice(0, updatedQueue.length - STEALTH_SAVE_CONFIG.MAX_OFFLINE_QUEUE_SIZE);
      }
      
      saveOfflineQueue(updatedQueue);
      return newOperation.id;
    } catch (error) {
      console.error('Error adding to offline queue:', error);
      return null;
    }
  };

  // Process offline operations
  const processOfflineOperations = async () => {
    if (stealthSaveState.isSyncing || !stealthSaveState.isOnline) return;

    const queue = getOfflineQueue();
    if (queue.length === 0) return;

    setStealthSaveState(prev => ({ ...prev, isSyncing: true }));

    try {
      const batch = queue.slice(0, STEALTH_SAVE_CONFIG.BATCH_SIZE);
      const processedIds: string[] = [];
      const failedOperations: OfflineOperation[] = [];

      for (const operation of batch) {
        try {
          await processOperation(operation);
          processedIds.push(operation.id);
        } catch (error) {
          console.error(`Failed to process operation ${operation.id}:`, error);
          
          if (operation.retryCount < STEALTH_SAVE_CONFIG.MAX_RETRY_ATTEMPTS) {
            failedOperations.push({
              ...operation,
              retryCount: operation.retryCount + 1
            });
          } else {
            console.error(`Operation ${operation.id} exceeded max retry attempts`);
            setStealthSaveState(prev => ({
              ...prev,
              syncErrors: [...prev.syncErrors, `Failed to sync ${operation.type} after ${STEALTH_SAVE_CONFIG.MAX_RETRY_ATTEMPTS} attempts`]
            }));
          }
        }
      }

      // Update queue
      const remainingQueue = queue.filter(op => !processedIds.includes(op.id));
      const updatedQueue = [...remainingQueue, ...failedOperations];
      saveOfflineQueue(updatedQueue);

      setStealthSaveState(prev => ({
        ...prev,
        pendingOperations: updatedQueue,
        lastSyncTime: Date.now(),
        isSyncing: false
      }));

      if (processedIds.length > 0) {
        console.log(`✅ Successfully processed ${processedIds.length} offline operations`);
      }

      if (failedOperations.length > 0) {
        console.log(`⚠️ ${failedOperations.length} operations failed and will be retried`);
      }

    } catch (error) {
      console.error('Error processing offline operations:', error);
      setStealthSaveState(prev => ({
        ...prev,
        isSyncing: false,
        syncErrors: [...prev.syncErrors, 'Failed to process offline operations']
      }));
    }
  };

  // Process individual operation
  const processOperation = async (operation: OfflineOperation) => {
    try {
      // Validate operation signature
      if (!operation.signature || !validateOperationSignature(operation, operation.userId, operation.signature)) {
        console.error('Invalid operation signature');
        logSecurityEvent({
          userId: parseInt(operation.userId),
          eventType: 'invalid_operation_signature',
          severity: 'high',
          details: { operation_type: operation.type }
        });
        return false;
      }

      // Check for suspicious activity
      const isSuspicious = await detectSuspiciousActivity(parseInt(operation.userId), operation);
      if (isSuspicious) {
        console.error('Suspicious activity detected, blocking operation');
        return false;
      }

      // Process based on operation type
      switch (operation.type) {
        case 'stake_create':
          return await processStakeCreate(operation.data);
        case 'stake_update':
          return await processStakeUpdate(operation.data);
        case 'reward_claim':
          return await processRewardClaim(operation.data);
        case 'user_data_update':
          return await processUserDataUpdate(operation.data);
        case 'synergy_update':
          return await processSynergyUpdate(operation.data);
        default:
          console.error('Unknown operation type:', operation.type);
          return false;
      }
    } catch (error) {
      console.error('Error processing operation:', error);
      return false;
    }
  };

  // Process stake creation
  const processStakeCreate = async (data: any) => {
    const { error } = await supabase
      .from('stakes')
      .insert([{
        user_id: data.userId,
        amount: data.amount,
        daily_rate: data.dailyRate,
        start_date: data.startDate,
        is_active: true,
        last_payout: new Date().toISOString()
      }]);

    if (error) throw error;
  };

  // Process stake update
  const processStakeUpdate = async (data: any) => {
    const { error } = await supabase
      .from('stakes')
      .update({
        total_earned: data.totalEarned,
        last_payout: data.lastPayout,
        speed_boost_active: data.speedBoostActive
        // Temporarily disabled until cycle_progress column is added to database
        // cycle_progress: data.cycleProgress
      })
      .eq('id', data.stakeId);

    if (error) throw error;
  };

  // Process reward claim
  const processRewardClaim = async (data: any) => {
    const { error } = await supabase.rpc('claim_stake_rewards', {
      p_stake_id: data.stakeId,
      p_user_id: data.userId
    });

    if (error) throw error;
  };

  // Process user data update
  const processUserDataUpdate = async (data: any) => {
    try {
      // Get current server data for validation
      const { data: currentUser, error: fetchError } = await supabase
        .from('users')
        .select('balance, total_earned')
        .eq('id', data.userId)
        .single();

      if (fetchError) {
        console.error('Failed to fetch current user data:', fetchError);
        return false;
      }

      // Validate balance change
      console.log('🔍 Balance validation:', {
        serverBalance: currentUser.balance,
        clientBalance: data.balance,
        change: Math.abs(data.balance - currentUser.balance),
        isValid: validateBalanceChange(currentUser.balance, data.balance)
      });
      
      if (!validateBalanceChange(currentUser.balance, data.balance)) {
        console.error('Suspicious balance change detected');
        logSecurityEvent({
          userId: data.userId,
          eventType: 'suspicious_balance_change',
          severity: 'high',
          details: {
            server_balance: currentUser.balance,
            client_balance: data.balance,
            change: Math.abs(data.balance - currentUser.balance)
          }
        });
        return false;
      }

      // Update user data
      const { error: updateError } = await supabase
        .from('users')
        .update({
          balance: data.balance,
          total_earned: data.totalEarnings,
          last_active: new Date().toISOString()
        })
        .eq('id', data.userId);

      if (updateError) {
        console.error('Failed to update user data:', updateError);
        return false;
      }

      // Log successful update
      logSecurityEvent({
        userId: data.userId,
        eventType: 'user_data_updated',
        severity: 'low',
        details: {
          new_balance: data.balance,
          new_earnings: data.totalEarnings
        }
      });

      return true;
    } catch (error) {
      console.error('Error in processUserDataUpdate:', error);
      return false;
    }
  };

  // Process synergy update
  const processSynergyUpdate = async (data: any) => {
    const { error } = await supabase
      .from('user_game_data')
      .upsert({
        user_id: data.userId,
        game_data: {
          ...data.synergyData,
          last_synergy_update: new Date().toISOString()
        },
        last_updated: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });

    if (error) throw error;
  };

  // Stealth save user data
  const stealthSaveUserData = useCallback(async () => {
    if (!user?.id || !stealthSaveState.isOnline) {
      // Queue for later if offline
      if (!stealthSaveState.isOnline) {
        addToOfflineQueue({
          type: 'user_data_update',
          data: {
            userId: user?.id,
            balance: userBalance,
            totalEarned: totalEarnings
          },
          userId: String(user?.telegram_id || 'anonymous')
        });
      }
      return;
    }

    try {
      await processUserDataUpdate({
        userId: user.id,
        balance: userBalance,
        totalEarned: totalEarnings
      });

      lastSyncTimeRef.current = Date.now();
      console.log('🔄 User data stealth saved to Supabase');
    } catch (error) {
      console.error('Stealth save failed, queuing for retry:', error);
      addToOfflineQueue({
        type: 'user_data_update',
        data: {
          userId: user.id,
          balance: userBalance,
          totalEarned: totalEarnings
        },
        userId: String(user?.telegram_id || 'anonymous')
      });
    }
  }, [user?.id, userBalance, totalEarnings, stealthSaveState.isOnline]);

  // Stealth save stakes
  const stealthSaveStakes = useCallback(async () => {
    if (!user?.id || !stealthSaveState.isOnline) {
      if (!stealthSaveState.isOnline) {
        addToOfflineQueue({
          type: 'stake_update',
          data: {
            stakes: userStakes,
            userId: user?.id
          },
          userId: String(user?.telegram_id || 'anonymous')
        });
      }
      return;
    }

    try {
      // Debug: Log stake IDs to understand the issue
      console.log('🔍 Debugging stake IDs:', userStakes.map(s => ({ id: s.id, type: typeof s.id })));
      
      // Save each stake individually
      for (const stake of userStakes) {
        // Skip stakes with timestamp-based IDs (local-only stakes)
        // These stakes haven't been created in the database yet
        if (stake.id > 2147483647) { // PostgreSQL integer max value
          console.log(`Skipping local-only stake with timestamp ID: ${stake.id}`);
          continue;
        }

        // Validate stake ID is a valid integer
        const stakeId = parseInt(stake.id.toString());
        if (isNaN(stakeId)) {
          console.warn(`Skipping stake with invalid ID: ${stake.id}`);
          continue;
        }

        await processStakeUpdate({
          stakeId: stakeId,
          totalEarned: stake.total_earned,
          lastPayout: stake.last_payout,
          speedBoostActive: stake.speed_boost_active
          // Temporarily disabled until cycle_progress column is added to database
          // cycleProgress: stake.cycle_progress || 0
        });
      }

      console.log('🔄 Stakes stealth saved to Supabase');
    } catch (error) {
      console.error('Stakes stealth save failed, queuing for retry:', error);
      addToOfflineQueue({
        type: 'stake_update',
        data: {
          stakes: userStakes,
          userId: user.id
        },
        userId: String(user?.telegram_id || 'anonymous')
      });
    }
  }, [user?.id, userStakes, stealthSaveState.isOnline]);

  // Stealth save synergy data
  const stealthSaveSynergy = useCallback(async () => {
    if (!user?.id || !stealthSaveState.isOnline) {
      if (!stealthSaveState.isOnline) {
        addToOfflineQueue({
          type: 'synergy_update',
          data: {
            userId: user?.id,
            synergyData: miningSynergy
          },
          userId: String(user?.telegram_id || 'anonymous')
        });
      }
      return;
    }

    try {
      await processSynergyUpdate({
        userId: user.id,
        synergyData: miningSynergy
      });

      console.log('🔄 Synergy data stealth saved to Supabase');
    } catch (error) {
      console.error('Synergy stealth save failed, queuing for retry:', error);
      addToOfflineQueue({
        type: 'synergy_update',
        data: {
          userId: user.id,
          synergyData: miningSynergy
        },
        userId: String(user?.telegram_id || 'anonymous')
      });
    }
  }, [user?.id, miningSynergy, stealthSaveState.isOnline]);

  // Main stealth save function
  const performStealthSave = useCallback(async () => {
    if (!stealthSaveState.autoSaveEnabled || stealthSaveState.isSyncing) return;

    const now = Date.now();
    if (now - lastSyncTimeRef.current < STEALTH_SAVE_CONFIG.MIN_SYNC_INTERVAL) return;

    console.log('🔄 Performing stealth save...');
    
    await Promise.all([
      stealthSaveUserData(),
      stealthSaveStakes(),
      stealthSaveSynergy()
    ]);

    // Process any pending offline operations
    await processOfflineOperations();
  }, [stealthSaveState.autoSaveEnabled, stealthSaveState.isSyncing, stealthSaveUserData, stealthSaveStakes, stealthSaveSynergy]);

  // Initialize stealth saving system
  const initializeStealthSaving = useCallback(() => {
    // Load pending operations
    const pendingOps = getOfflineQueue();
    setStealthSaveState(prev => ({
      ...prev,
      pendingOperations: pendingOps
    }));

    // Start auto-save interval
    if (autoSaveIntervalRef.current) {
      clearInterval(autoSaveIntervalRef.current);
    }

    autoSaveIntervalRef.current = setInterval(() => {
      performStealthSave();
    }, STEALTH_SAVE_CONFIG.AUTO_SAVE_INTERVAL);

    console.log('🚀 Stealth saving system initialized');
  }, [performStealthSave]);

  // Cleanup stealth saving system
  const cleanupStealthSaving = useCallback(() => {
    if (autoSaveIntervalRef.current) {
      clearInterval(autoSaveIntervalRef.current);
    }
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }
  }, []);

  // Update handleDeposit to initialize earning state
  const handleDeposit = async (amount: number) => {
    try {
      // Validate amount
      if (amount < 1) {
        showSnackbar({ 
          message: 'Invalid Amount', 
          description: 'Minimum deposit amount is 1 TON' 
        });
        return;
      }

      // Validate user and wallet connection
      if (!user?.id || !userFriendlyAddress) {
        showSnackbar({ 
          message: 'Wallet Not Connected', 
          description: 'Please connect your wallet first' 
        });
        return;
      }

      setDepositStatus('pending');

      try {
        // Generate unique ID
        const depositId = await generateUniqueId();
        
        // Record pending deposit
        const { error: pendingError } = await supabase
          .from('deposits')
          .insert([{
            id: depositId,
            user_id: user.id,
            amount: amount,
            status: 'pending',
            created_at: new Date().toISOString()
          }]);

        if (pendingError) throw pendingError;

        // Create transaction
        const amountInNano = toNano(amount.toString());
        const transaction = {
          validUntil: Math.floor(Date.now() / 1000) + 60 * 20, // 20 minutes
          messages: [
            {
              address: DEPOSIT_ADDRESS,
              amount: amountInNano.toString(),
            },
          ],
        };

        // Send transaction and wait for user interaction
        const result = await tonConnectUI.sendTransaction(transaction);

        // Only proceed if we have a transaction result
        if (result) {
          // Update deposit status
          const { error: updateError } = await supabase
            .from('deposits')
            .update({ 
              status: 'completed',
              transaction_hash: result.boc
            })
            .eq('id', depositId);

          if (updateError) throw updateError;

          // Process deposit - try database function first, fallback to direct update
          try {
            const { error: balanceError } = await supabase.rpc('process_deposit_v2', {
              p_user_id: user.id,
              p_amount: amount,
              p_deposit_id: depositId
            });

            if (balanceError) throw balanceError;
          } catch (functionError) {
            console.warn('Database function not available, using direct update:', functionError);
            
            // Fallback: Simple balance update
            const { data: currentUser, error: fetchError } = await supabase
              .from('users')
              .select('balance, total_deposit')
              .eq('id', user.id)
              .single();

            if (fetchError) throw fetchError;

            const { error: updateUserError } = await supabase
              .from('users')
              .update({ 
                balance: (currentUser.balance || 0) + amount,
                total_deposit: (currentUser.total_deposit || 0) + amount,
                last_deposit_time: new Date().toISOString(),
                last_deposit_date: new Date().toISOString().split('T')[0]
              })
              .eq('id', user.id);

            if (updateUserError) throw updateUserError;
          }

          // Update UI state
          setDepositStatus('success');
          
          // Save session after successful deposit
          saveCurrentSession();
          
          showSystemNotification(
            'Deposit Successful', 
            `Successfully deposited ${amount} TON to your account`, 
            'success'
          );
          
          // Refresh user data
          await updateUserData({ id: user.id });
          setShowDepositModal(false);

          // After successful deposit, initialize or update earnings state
          const totalBalance = (user?.balance || 0) + amount;
          const newRate = calculateEarningRate(totalBalance, currentROI);
          const newState = {
            lastUpdate: Date.now(),
            currentEarnings: earningState.currentEarnings,
            baseEarningRate: newRate,
            isActive: true
          };
          
          setEarningState(newState);
          saveEarningState(newState);
        } else {
          // User might have cancelled or transaction failed
          // Clean up the pending deposit
          await supabase
            .from('deposits')
            .delete()
            .eq('id', depositId);
            
          setDepositStatus('idle');
        }
      } catch (txError: any) {
        console.error('Transaction error:', txError);
        setDepositStatus('idle');
        
        // Only show error if it's not a user cancellation
        if (txError?.message !== 'User rejected the transaction') {
          showSystemNotification(
            'Transaction Failed', 
            'There was an error processing your transaction. Please try again.', 
            'error'
          );
        }
      }
    } catch (error) {
      console.error('Deposit failed:', error);
      setDepositStatus('error');
      showSystemNotification(
        'Deposit Failed', 
        'There was an error processing your deposit. Please try again later.', 
        'error'
      );
    }
  };


  // =============================================
  // STEALTH SAVING SYSTEM EFFECTS
  // =============================================

  // Initialize stealth saving system when user is available
  useEffect(() => {
    if (user?.id) {
      initializeStealthSaving();
    }

    return () => {
      cleanupStealthSaving();
    };
  }, [user?.id, initializeStealthSaving, cleanupStealthSaving]);

  // Auto-save session every 30 seconds when session is active
  useEffect(() => {
    if (!isSessionActive || !user?.id) return;

    const autoSaveInterval = setInterval(() => {
      saveCurrentSession();
      console.log('💾 Auto-saved session');
    }, 30000); // 30 seconds

    return () => {
      clearInterval(autoSaveInterval);
    };
  }, [isSessionActive, user?.id]);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setStealthSaveState(prev => ({ ...prev, isOnline: true }));
      console.log('🌐 Connection restored - processing offline queue...');
      
      // Process offline operations when coming back online
      setTimeout(() => {
        processOfflineOperations();
      }, 2000); // Small delay to ensure connection is stable
    };

    const handleOffline = () => {
      setStealthSaveState(prev => ({ ...prev, isOnline: false }));
      console.log('📴 Connection lost - operations will be queued');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Auto-save when user data changes
  useEffect(() => {
    if (user?.id && stealthSaveState.autoSaveEnabled) {
      const timeoutId = setTimeout(() => {
        stealthSaveUserData();
      }, 2000); // Debounce for 2 seconds

      return () => clearTimeout(timeoutId);
    }
  }, [userBalance, totalEarnings, user?.id, stealthSaveState.autoSaveEnabled, stealthSaveUserData]);

  // Auto-save when stakes change
  useEffect(() => {
    if (user?.id && stealthSaveState.autoSaveEnabled && userStakes.length > 0) {
      const timeoutId = setTimeout(() => {
        stealthSaveStakes();
      }, 3000); // Debounce for 3 seconds

      return () => clearTimeout(timeoutId);
    }
  }, [userStakes, user?.id, stealthSaveState.autoSaveEnabled, stealthSaveStakes]);

  // Auto-save when synergy changes
  useEffect(() => {
    if (user?.id && stealthSaveState.autoSaveEnabled) {
      const timeoutId = setTimeout(() => {
        stealthSaveSynergy();
      }, 5000); // Debounce for 5 seconds

      return () => clearTimeout(timeoutId);
    }
  }, [miningSynergy, user?.id, stealthSaveState.autoSaveEnabled, stealthSaveSynergy]);

  // Add periodic reconciliation
  useEffect(() => {
    if (!user?.id) return;

    const reconciliationInterval = setInterval(async () => {
      try {
        const reconciledData = await reconcileUserData(user.id);
        if (reconciledData) {
          setUserBalance(reconciledData.balance);
          setTotalEarnings(reconciledData.total_earned);
        }
      } catch (error) {
        console.error('Reconciliation failed:', error);
      }
    }, SECURITY_CONFIG.RECONCILIATION_INTERVAL);

    return () => clearInterval(reconciliationInterval);
  }, [user?.id]);

  // Migration function to move old data to new keys
  const migrateOldData = (userId?: string) => {
    try {
      const oldKeys = [
        `divine_mining_stakes_${userId || 'anonymous'}`,
        `divine_mining_user_data_${userId || 'anonymous'}`,
        `divine_mining_withdrawals_${userId || 'anonymous'}`,
        `divine_mining_synergy_${userId || 'anonymous'}`,
        `divine_mining_staking_bonuses_${userId || 'anonymous'}`
      ];
      
      const newKeys = [
        getStakesStorageKey(userId),
        getUserDataStorageKey(userId),
        getWithdrawalHistoryStorageKey(userId),
        getMiningSynergyStorageKey(userId),
        getStakingBonusesStorageKey(userId)
      ];
      
      oldKeys.forEach((oldKey, index) => {
        const oldData = localStorage.getItem(oldKey);
        if (oldData) {
          localStorage.setItem(newKeys[index], oldData);
          // localStorage.removeItem(oldKey); // Do NOT delete the old key!
          console.log(`✅ Migrated data from ${oldKey} to ${newKeys[index]}`);
        }
      });
    } catch (error) {
      console.error('Error during data migration:', error);
    }
  };

  // REPLACE with local state:

  // Add useEffect to sync mining points from DivineMiningGame localStorage:
  useEffect(() => {
    const syncMiningPoints = () => {
      if (user?.telegram_id) {
        const userPointsKey = `spiritualEssencePoints_${user.telegram_id}`;
        const savedPoints = localStorage.getItem(userPointsKey);
        if (savedPoints) {
          setMiningPoints(parseInt(savedPoints, 10));
        }
      }
    };
    
    syncMiningPoints();
    
    // Listen for changes from TonersGame
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === `spiritualEssencePoints_${user?.telegram_id}`) {
        syncMiningPoints();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [user?.telegram_id]);

  // REPLACE with direct localStorage update:
  const handleSynergyReward = () => {
    if (user?.telegram_id) {
      const userGemsKey = `tonersGems_${user.telegram_id}`;
      const currentGems = parseInt(localStorage.getItem(userGemsKey) || '0', 10);
      const newGems = currentGems + 50;
      localStorage.setItem(userGemsKey, newGems.toString());
      
      // Dispatch event for GameContext to pick up
      window.dispatchEvent(new CustomEvent('gemsUpdated', { 
        detail: { gems: newGems, amount: 50, source: 'synergy_reward' } 
      }));
    }
  };

  return (
    <div className="min-h-screen text-white p-2 relative overflow-hidden">
      {/* Enhanced Background */}
      <div className="absolute"></div>
      <div className="absolute inset-0">
        <div className="absolute top-0 left-1/4 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-1/4 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>

      <div className="relative z-10 max-w-6xl mx-auto">
        {/* Modern Header */}
        <div className="text-center mb-6">
          <div className="relative">
            <h1 className="absolute text-2xl md:text-4xl font-mono font-black bg-gradient-to-r from-cyber-blue via-cyan-400 to-purple-400 bg-clip-text text-transparent mb-2 tracking-wider">
              ⚡ DIVINE STAKING HUB
            </h1>
            <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-full h-full bg-gradient-to-r from-cyan-400/20 to-purple-400/20 blur-2xl -z-10"></div>
          </div>
          <p className="text-sm text-gray-400 font-mono mb-4 tracking-wide">
            Premium TON staking with up to <span className="text-cyan-400 font-bold">3% daily returns</span>
          </p>
          
          {/* Status Bar */}
          <div className="flex items-center justify-center space-x-4 mb-6">
            <div className="flex items-center space-x-2 bg-green-500/10 px-3 py-1 rounded-full border border-green-500/30">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-xs font-mono text-green-400">LIVE</span>
            </div>
            <div className="flex items-center space-x-2 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/30">
              <span className="text-xs font-mono text-blue-400">{userStakes.length} ACTIVE</span>
            </div>
            <div className="flex items-center space-x-2 bg-purple-500/10 px-3 py-1 rounded-full border border-purple-500/30">
              <span className="text-xs font-mono text-purple-400">{formatNumber(totalEarnings)} TON EARNED</span>
            </div>
          </div>
        </div>

        {/* Enhanced Navigation */}
        <div className="flex justify-center mb-6">
          <div className="bg-gradient-to-r from-slate-900/80 to-gray-900/80 backdrop-blur-xl rounded-2xl p-1 border border-cyan-500/20 shadow-[0_0_30px_rgba(6,182,212,0.1)]">
            <div className="flex space-x-1">
              {[
                { id: 'overview', label: 'DASHBOARD', icon: '📊', color: 'from-green-500 to-emerald-500' },
                { id: 'tiers', label: 'TIERS', icon: '🏆', color: 'from-yellow-500 to-orange-500' },
                { id: 'stakes', label: 'PORTFOLIO', icon: '🔥', color: 'from-red-500 to-pink-500' },
                // { id: 'synergy', label: 'SYNERGY', icon: '⚡', color: 'from-purple-500 to-indigo-500' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`relative px-4 py-3 rounded-xl text-xs font-mono font-bold transition-all duration-300 transform ${
                    activeTab === tab.id
                      ? `bg-gradient-to-r ${tab.color} text-white shadow-lg scale-105`
                      : 'text-gray-400 hover:text-white hover:bg-white/5 hover:scale-102'
                  }`}
                >
                  <div className="relative z-10 flex items-center space-x-2">
                    <span className="text-base">{tab.icon}</span>
                    <span className="hidden sm:inline">{tab.label}</span>
                  </div>
                  {activeTab === tab.id && (
                    <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent rounded-xl"></div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 mb-3 auto-rows-fr">
              {/* Balance Card */}
              <div className="relative group w-full h-full">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-xl blur-lg group-hover:blur-xl transition-all duration-500"></div>
                <div className="relative bg-gradient-to-br from-slate-900/90 to-slate-800/90 backdrop-blur-xl border border-blue-500/30 rounded-xl p-2 hover:border-blue-400/50 transition-all duration-300 hover:scale-[1.02] h-full min-h-[140px] flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
                      <span className="text-white text-sm">💰</span>
                    </div>
                    <div className="text-blue-400 text-xs font-medium bg-blue-500/10 px-1.5 py-0.5 rounded">
                      BALANCE
                    </div>
                  </div>
                  <div className="text-lg font-bold text-white mb-0.5 font-mono">
                    {formatNumber(Math.max(0, userBalance))}
                  </div>
                  <div className="text-blue-300 text-xs font-medium">TON</div>
                  
                  {/* Wallet Status */}
                  {userFriendlyAddress && (
                    <div className="mt-1 text-xs text-blue-400 font-mono">
                      {userFriendlyAddress.slice(0, 6)}...{userFriendlyAddress.slice(-4)}
                    </div>
                  )}
                  
                  <div className="mt-2 pt-2 border-t border-blue-500/20 mt-auto">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center text-xs text-blue-400">
                        <div className={`w-1.5 h-1.5 rounded-full mr-1 ${userFriendlyAddress ? 'bg-green-400' : 'bg-red-400'}`}></div>
                        {userFriendlyAddress ? 'Connected' : 'Not Connected'}
                      </div>
                      <button
                        onClick={() => setShowDepositModal(true)}
                        disabled={!userFriendlyAddress}
                        className={`text-xs px-2 py-1 rounded transition-colors ${
                          userFriendlyAddress 
                            ? 'bg-blue-500 hover:bg-blue-600 text-white' 
                            : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        💰 Deposit
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Earnings Card */}
              <div className="relative group w-full h-full">
                <div className="absolute inset-0 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-xl blur-lg group-hover:blur-xl transition-all duration-500"></div>
                <div className="relative bg-gradient-to-br from-slate-900/90 to-slate-800/90 backdrop-blur-xl border border-green-500/30 rounded-xl p-2 hover:border-green-400/50 transition-all duration-300 hover:scale-[1.02] h-full min-h-[140px] flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg flex items-center justify-center">
                      <span className="text-white text-sm">📈</span>
                    </div>
                    <div className="text-green-400 text-xs font-medium bg-green-500/10 px-1.5 py-0.5 rounded">
                      EARNED
                    </div>
                  </div>
                  <div className="text-lg font-bold text-white mb-0.5 font-mono">
                    {formatNumber(totalEarnings)}
                  </div>
                  <div className="text-green-300 text-xs font-medium">TON</div>
                  <div className="mt-2 pt-2 border-t border-green-500/20 mt-auto">
                    <div className="flex items-center text-xs text-green-400">
                      <div className="w-1.5 h-1.5 bg-green-400 rounded-full mr-1"></div>
                      Total rewards
                    </div>
                  </div>
                </div>
              </div>

              {/* Claimable Card */}
              <div className="relative group w-full h-full">
                <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/20 to-orange-500/20 rounded-xl blur-lg group-hover:blur-xl transition-all duration-500"></div>
                <div className="relative bg-gradient-to-br from-slate-900/90 to-slate-800/90 backdrop-blur-xl border border-yellow-500/30 rounded-xl p-2 hover:border-yellow-400/50 transition-all duration-300 hover:scale-[1.02] h-full min-h-[140px] flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-lg flex items-center justify-center">
                      <span className="text-white text-sm">⚡</span>
                    </div>
                    <div className="text-yellow-400 text-xs font-medium bg-yellow-500/10 px-1.5 py-0.5 rounded">
                      CLAIMABLE
                    </div>
                  </div>
                  <div className="text-lg font-bold text-white mb-0.5 font-mono">
                    {formatNumber(availableToClaim)}
                  </div>
                  <div className="text-yellow-300 text-xs font-medium">TON</div>
                  <div className="mt-2 pt-2 border-t border-yellow-500/20 mt-auto">
                    <div className="flex items-center text-xs text-yellow-400">
                      <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full mr-1 animate-pulse"></div>
                      Ready to claim
                    </div>
                  </div>
                </div>
              </div>

              {/* Active Stakes Card */}
              <div className="relative group w-full h-full">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-xl blur-lg group-hover:blur-xl transition-all duration-500"></div>
                <div className="relative bg-gradient-to-br from-slate-900/90 to-slate-800/90 backdrop-blur-xl border border-purple-500/30 rounded-xl p-2 hover:border-purple-400/50 transition-all duration-300 hover:scale-[1.02] h-full min-h-[140px] flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                      <span className="text-white text-sm">🔥</span>
                    </div>
                    <div className="text-purple-400 text-xs font-medium bg-purple-500/10 px-1.5 py-0.5 rounded">
                      ACTIVE
                    </div>
                  </div>
                  <div className="text-lg font-bold text-white mb-0.5 font-mono">
                    {userStakes.length}
                  </div>
                  <div className="text-purple-300 text-xs font-medium">Stakes</div>
                  <div className="mt-2 pt-2 border-t border-purple-500/20 mt-auto">
                    <div className="flex items-center text-xs text-purple-400">
                      <div className="w-1.5 h-1.5 bg-purple-400 rounded-full mr-1"></div>
                      Generating rewards
                    </div>
                  </div>
                </div>
              </div>

              {/* Mining Synergy Card */}
              {/* <div className="relative group w-full h-full">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-xl blur-lg group-hover:blur-xl transition-all duration-500"></div>
                <div className="relative bg-gradient-to-br from-slate-900/90 to-slate-800/90 backdrop-blur-xl border border-indigo-500/30 rounded-xl p-2 hover:border-indigo-400/50 transition-all duration-300 hover:scale-[1.02] h-full min-h-[140px] flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center">
                      <span className="text-white text-sm">⚡</span>
                    </div>
                    <div className="text-indigo-400 text-xs font-medium bg-indigo-500/10 px-1.5 py-0.5 rounded">
                      SYNERGY
                    </div>
                  </div>
                  <div className="text-lg font-bold text-white mb-0.5 font-mono">
                    {miningSynergy.synergyLevel}/10
                  </div>
                  <div className="text-indigo-300 text-xs font-medium">Level</div>
                  <div className="mt-2 pt-2 border-t border-indigo-500/20 mt-auto">
                    <div className="flex items-center text-xs text-indigo-400">
                      <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full mr-1 animate-pulse"></div>
                      {miningSynergy.activeStakesCount} stakes • {formatNumber(miningSynergy.totalStakedAmount)} TON
                    </div>
                  </div>
                </div>
              </div> */}
            </div>

            {/* Smart Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-2 mb-3">
              <button
                onClick={() => setShowStakeModal(true)}
                className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-mono font-bold py-2 px-3 rounded-lg transition-all duration-300 hover:scale-105 active:scale-95 border border-cyan-400/30 shadow-lg shadow-cyan-500/25"
              >
                <div className="flex items-center justify-center space-x-2">
                  <span className="text-base">{userStakes.length > 0 ? '⚡' : '🚀'}</span>
                  <div>
                    <div className="text-xs">
                      {userStakes.length > 0 ? 'STAKE MORE' : 'START STAKING'}
                    </div>
                    <div className="text-xs opacity-80">
                      {userStakes.length > 0 ? 'Upgrade your earnings' : 'Begin earning rewards'}
                    </div>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setShowClaimModal(true)}
                disabled={availableToClaim <= 0}
                className={`flex-1 font-mono font-bold py-2 px-3 rounded-lg transition-all duration-300 hover:scale-105 active:scale-95 border shadow-lg ${
                  availableToClaim > 0
                    ? 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white border-green-400/30 shadow-green-500/25'
                    : 'bg-gray-600 text-gray-400 border-gray-500/30 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center justify-center space-x-2">
                  <span className="text-base">💰</span>
                  <div>
                    <div className="text-xs">CLAIM REWARDS</div>
                    <div className="text-xs opacity-80">
                      {availableToClaim > 0 ? `${formatNumber(availableToClaim)} TON available` : 'No rewards to claim'}
                    </div>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setShowWithdrawalModal(true)}
                disabled={userBalance <= 0}
                className={`flex-1 font-mono font-bold py-2 px-3 rounded-lg transition-all duration-300 hover:scale-105 active:scale-95 border shadow-lg ${
                  userBalance > 0
                    ? 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white border-orange-400/30 shadow-orange-500/25'
                    : 'bg-gray-600 text-gray-400 border-gray-500/30 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center justify-center space-x-2">
                  <span className="text-base">💳</span>
                  <div>
                    <div className="text-xs">WITHDRAW</div>
                    <div className="text-xs opacity-80">
                      {userBalance > 0 ? `${formatNumber(userBalance)} TON available` : 'No balance to withdraw'}
                    </div>
                  </div>
                </div>
              </button>
            </div>

            {/* Stealth Saving Status Indicator */}
            <div className="bg-gradient-to-r from-slate-900/80 to-gray-900/80 backdrop-blur-xl border border-cyan-500/30 rounded-lg p-2 mb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${stealthSaveState.isOnline ? 'bg-green-400' : 'bg-red-400'}`}></div>
                  <span className="text-xs text-cyan-400 font-mono">
                    {stealthSaveState.isOnline ? '🔄 Auto-saving enabled' : '📴 Offline mode - queuing changes'}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  {stealthSaveState.isSyncing && (
                    <div className="flex items-center space-x-1">
                      <div className="w-3 h-3 border border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-xs text-cyan-400">Syncing...</span>
                    </div>
                  )}
                  {stealthSaveState.pendingOperations.length > 0 && (
                    <div className="flex items-center space-x-1">
                      <span className="text-xs text-yellow-400">📝 {stealthSaveState.pendingOperations.length} pending</span>
                    </div>
                  )}
                  {stealthSaveState.syncErrors.length > 0 && (
                    <div className="flex items-center space-x-1">
                      <span className="text-xs text-red-400">⚠️ {stealthSaveState.syncErrors.length} errors</span>
                    </div>
                  )}
                </div>
              </div>
              {stealthSaveState.pendingOperations.length > 0 && (
                <div className="mt-1 text-xs text-gray-400">
                  {stealthSaveState.isOnline 
                    ? 'Processing offline changes...' 
                    : 'Changes will sync when connection is restored'
                  }
                </div>
              )}
            </div>

            {/* Collapsible Earnings Dashboard */}
            <div className="bg-gradient-to-r from-slate-900/80 to-gray-900/80 backdrop-blur-xl border border-yellow-500/30 rounded-lg p-3 mb-3">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center space-x-2">
                  <span className="text-sm">📈</span>
                  <span className="text-xs font-mono font-bold text-yellow-400">EARNINGS OVERVIEW</span>
                </div>
                <button
                  onClick={() => setShowDetailedEarnings(!showDetailedEarnings)}
                  className="flex items-center space-x-1 text-xs font-mono text-gray-400 hover:text-white transition-colors"
                >
                  <span>{showDetailedEarnings ? 'Hide Details' : 'Show Details'}</span>
                  <span className={`transform transition-transform duration-200 ${showDetailedEarnings ? 'rotate-180' : ''}`}>
                    ▼
                  </span>
                </button>
              </div>
              
              {/* Primary Stats - Always Visible */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                <div className="bg-gradient-to-br from-cyan-800/30 to-cyan-900/30 border border-cyan-500/20 rounded-lg p-2 text-center">
                  <div className="text-cyan-400 font-bold text-xs mb-1">TOTAL STAKED</div>
                  <div className="text-white font-mono text-sm font-bold">
                    {formatNumber(userStakes.reduce((sum, stake) => sum + stake.amount, 0))} TON
                  </div>
                  <div className="text-cyan-300 text-xs">Principal Investment</div>
                </div>
                
                <div className="bg-gradient-to-br from-green-800/30 to-green-900/30 border border-green-500/20 rounded-lg p-2 text-center">
                  <div className="text-green-400 font-bold text-xs mb-1">GROSS EARNINGS</div>
                  <div className="text-white font-mono text-sm font-bold">{formatNumber(totalEarnings)} TON</div>
                  <div className="text-green-300 text-xs">Total Generated</div>
                </div>
                
                <div className="bg-gradient-to-br from-blue-800/30 to-blue-900/30 border border-blue-500/20 rounded-lg p-2 text-center">
                  <div className="text-blue-400 font-bold text-xs mb-1">NET RECEIVED</div>
                  <div className="text-white font-mono text-sm font-bold">
                    {formatNumber(totalEarnings * 0.6)} TON
                  </div>
                  <div className="text-blue-300 text-xs">After Fees (60%)</div>
                </div>
                
                <div className="bg-gradient-to-br from-purple-800/30 to-purple-900/30 border border-purple-500/20 rounded-lg p-2 text-center">
                  <div className="text-purple-400 font-bold text-xs mb-1">CLAIMABLE NOW</div>
                  <div className="text-white font-mono text-sm font-bold">{formatNumber(availableToClaim)} TON</div>
                  <div className="text-purple-300 text-xs">Ready to Claim</div>
                </div>
              </div>

              {/* Detailed Breakdown - Collapsible */}
              {showDetailedEarnings && (
                <div className="space-y-3">

              {/* Daily Performance */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
                <div className="bg-gray-800/40 border border-gray-600/30 rounded-lg p-2">
                  <div className="text-yellow-400 font-bold text-xs mb-1">DAILY GROSS</div>
                  <div className="text-white font-mono font-bold text-sm">
                    {formatNumber(userStakes.reduce((sum, stake) => sum + (stake.amount * stake.daily_rate), 0))} TON
                  </div>
                  <div className="text-gray-400 text-xs">Total Daily Generation</div>
                </div>
                
                <div className="bg-gray-800/40 border border-gray-600/30 rounded-lg p-2">
                  <div className="text-yellow-400 font-bold text-xs mb-1">DAILY NET</div>
                  <div className="text-white font-mono font-bold text-sm">
                    {formatNumber(userStakes.reduce((sum, stake) => sum + (stake.amount * stake.daily_rate), 0) * 0.6)} TON
                  </div>
                  <div className="text-gray-400 text-xs">Your Daily Income</div>
                </div>
                
                <div className="bg-gray-800/40 border border-gray-600/30 rounded-lg p-2">
                  <div className="text-yellow-400 font-bold text-xs mb-1">AVG ROI</div>
                  <div className="text-white font-mono font-bold text-sm">
                    {userStakes.length > 0 
                      ? ((userStakes.reduce((sum, stake) => sum + stake.daily_rate, 0) / userStakes.length) * 100).toFixed(2)
                      : '0.00'
                    }%
                  </div>
                  <div className="text-gray-400 text-xs">Daily Rate</div>
                </div>
              </div>

              {/* Earnings Projections */}
              {userStakes.length > 0 && (
                <div className="bg-gradient-to-r from-indigo-900/30 to-purple-900/30 border border-indigo-500/30 rounded-lg p-3">
                  <div className="text-indigo-400 font-bold text-xs mb-2 text-center">📊 EARNINGS PROJECTIONS</div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center text-xs">
                    <div>
                      <div className="text-indigo-300 font-mono font-bold">
                        {formatNumber(userStakes.reduce((sum, stake) => sum + (stake.amount * stake.daily_rate), 0) * 7)} TON
                      </div>
                      <div className="text-indigo-400 text-xs">Weekly (Gross)</div>
                      <div className="text-indigo-200 text-xs">
                        {formatNumber(userStakes.reduce((sum, stake) => sum + (stake.amount * stake.daily_rate), 0) * 7 * 0.6)} TON net
                      </div>
                    </div>
                    <div>
                      <div className="text-purple-300 font-mono font-bold">
                        {formatNumber(userStakes.reduce((sum, stake) => sum + (stake.amount * stake.daily_rate), 0) * 30)} TON
                      </div>
                      <div className="text-purple-400 text-xs">Monthly (Gross)</div>
                      <div className="text-purple-200 text-xs">
                        {formatNumber(userStakes.reduce((sum, stake) => sum + (stake.amount * stake.daily_rate), 0) * 30 * 0.6)} TON net
                      </div>
                    </div>
                    <div>
                      <div className="text-pink-300 font-mono font-bold">
                        {formatNumber(userStakes.reduce((sum, stake) => sum + (stake.amount * stake.daily_rate), 0) * 90)} TON
                      </div>
                      <div className="text-pink-400 text-xs">Quarterly (Gross)</div>
                      <div className="text-pink-200 text-xs">
                        {formatNumber(userStakes.reduce((sum, stake) => sum + (stake.amount * stake.daily_rate), 0) * 90 * 0.6)} TON net
                      </div>
                    </div>
                    <div>
                      <div className="text-cyan-300 font-mono font-bold">
                        {formatNumber(userStakes.reduce((sum, stake) => {
                          const tier = getTierForAmount(stake.amount);
                          const maxEarnings = stake.amount * ((tier?.maxReturn || 300) / 100);
                          return sum + maxEarnings;
                        }, 0))} TON
                      </div>
                      <div className="text-cyan-400 text-xs">Max Possible</div>
                      <div className="text-cyan-200 text-xs">
                        {formatNumber(userStakes.reduce((sum, stake) => {
                          const tier = getTierForAmount(stake.amount);
                          const maxEarnings = stake.amount * ((tier?.maxReturn || 300) / 100);
                          return sum + maxEarnings;
                        }, 0) * 0.6)} TON net
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Fee Structure Info */}
              <div className="mt-2 bg-gray-800/30 border border-gray-600/20 rounded-lg p-2">
                <div className="text-gray-400 font-bold text-xs mb-1 text-center">💡 EARNINGS DISTRIBUTION</div>
                <div className="flex justify-center space-x-3 text-xs">
                  <span className="text-green-400">60% → Your Wallet</span>
                  <span className="text-blue-400">10% → GLP Pool</span>
                  <span className="text-purple-400">10% → STK Tokens</span>
                  <span className="text-yellow-400">20% → Reinvestment</span>
                </div>
              </div>
                </div>
              )}

              {/* Withdrawal History */}
              {withdrawalHistory.length > 0 && (
                <div className="bg-gradient-to-r from-slate-900/80 to-gray-900/80 backdrop-blur-xl border border-orange-500/30 rounded-lg p-3 mt-3">
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm">💳</span>
                      <span className="text-xs font-mono font-bold text-orange-400">WITHDRAWAL HISTORY</span>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    {withdrawalHistory.slice(0, 5).map((withdrawal) => (
                      <div key={withdrawal.id} className="bg-gray-800/30 border border-gray-600/30 rounded-lg p-2">
                        <div className="flex justify-between items-start mb-1">
                          <div>
                            <div className="text-white font-mono font-bold text-xs">
                              {formatNumber(withdrawal.amount)} TON
                            </div>
                            <div className="text-xs text-gray-400 font-mono">
                              {withdrawal.wallet_address.slice(0, 8)}...{withdrawal.wallet_address.slice(-6)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded ${
                              withdrawal.status === 'completed' 
                                ? 'bg-green-500/20 text-green-400' 
                                : withdrawal.status === 'pending'
                                ? 'bg-orange-500/20 text-orange-400'
                                : 'bg-red-500/20 text-red-400'
                            }`}>
                              {withdrawal.status.toUpperCase()}
                            </div>
                            <div className="text-xs text-gray-400 mt-0.5">
                              {formatDate(withdrawal.created_at)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {withdrawalHistory.length > 5 && (
                    <div className="text-center mt-2">
                      <div className="text-xs text-gray-400 font-mono">
                        Showing 5 of {withdrawalHistory.length} withdrawals
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* Tiers Tab */}
        {activeTab === 'tiers' && (
          <div className="space-y-2">
            {STAKING_TIERS.map((tier) => {
              // Check if user has active stakes in this tier
              const hasActiveStakes = userStakes.some(stake => {
                const stakeTier = getTierForAmount(stake.amount);
                return stakeTier?.id === tier.id && stake.is_active;
              });
              
              // Calculate total staked in this tier
              const tierStakes = userStakes.filter(stake => {
                const stakeTier = getTierForAmount(stake.amount);
                return stakeTier?.id === tier.id && stake.is_active;
              });
              const totalStakedInTier = tierStakes.reduce((sum, stake) => sum + stake.amount, 0);
              const totalEarnedInTier = tierStakes.reduce((sum, stake) => sum + stake.total_earned, 0);
              
              return (
                <div
                  key={tier.id}
                  className={`bg-gradient-to-r from-slate-900/80 to-gray-900/80 backdrop-blur-xl border transition-all duration-300 rounded-lg p-3 relative ${
                    hasActiveStakes 
                      ? 'border-green-500/50 shadow-lg shadow-green-500/20' 
                      : 'border-gray-700 hover:border-cyan-500/50'
                  }`}
                  style={!hasActiveStakes ? { borderColor: tier.color + '40' } : {}}
                >
                  {/* Active Tier Badge */}
                  {hasActiveStakes && (
                    <div className="absolute -top-1 -right-1 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-xs font-mono font-bold px-2 py-0.5 rounded-full shadow-lg">
                      ✅ ACTIVE
                    </div>
                  )}
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center mb-2 md:mb-0">
                      <div className="text-2xl mr-2">{tier.icon}</div>
                      <div>
                        <h3 className="text-base font-mono font-bold text-white mb-1">{tier.name}</h3>
                        <div className="text-lg font-mono font-bold text-green-400 mb-1">
                          {(tier.dailyRate * 100).toFixed(1)}% Daily
                        </div>
                        <div className="text-xs text-gray-400">
                          {tier.maxReturn}% Max Return • {tier.cycleDuration} Days
                        </div>
                        
                        {/* Active Tier Status */}
                        {hasActiveStakes && (
                          <div className="mt-2 p-2 bg-green-500/10 border border-green-500/30 rounded-lg">
                            <div className="text-xs font-mono text-green-400 font-bold mb-1">
                              🎯 YOUR ACTIVE STAKES
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <div className="text-green-300">Staked:</div>
                                <div className="text-white font-mono font-bold">{formatNumber(totalStakedInTier)} TON</div>
                              </div>
                              <div>
                                <div className="text-green-300">Earned:</div>
                                <div className="text-white font-mono font-bold">{formatNumber(totalEarnedInTier)} TON</div>
                              </div>
                            </div>
                            <div className="text-xs text-green-300 mt-1">
                              {tierStakes.length} active stake{tierStakes.length > 1 ? 's' : ''}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col md:items-end space-y-1">
                      <div className="text-xs font-mono text-gray-300">
                        <span className="text-gray-400">Min:</span> {tier.minAmount} TON
                        <span className="text-gray-400 ml-2">Max:</span> {tier.maxAmount} TON
                      </div>
                      
                      <div className="flex flex-wrap gap-1 mb-1">
                        {tier.features.slice(0, 3).map((feature, index) => (
                          <span key={index} className="text-xs bg-gray-700/50 text-gray-300 px-1.5 py-0.5 rounded">
                            {feature}
                          </span>
                        ))}
                      </div>

                      <button
                        onClick={() => {
                          setSelectedTier(tier);
                          setStakeAmount(tier.minAmount);
                          setShowStakeModal(true);
                        }}
                        className={`w-full md:w-auto font-mono font-bold py-2 px-4 rounded-lg transition-all duration-200 border ${
                          hasActiveStakes
                            ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white border-green-500/50'
                            : 'bg-gradient-to-r from-gray-700 to-gray-600 hover:from-gray-600 hover:to-gray-500 text-white'
                        }`}
                        style={!hasActiveStakes ? { borderColor: tier.color } : {}}
                      >
                        {hasActiveStakes ? '⚡ ADD MORE' : 'SELECT TIER'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Stakes Tab */}
        {activeTab === 'stakes' && (
          <div className="space-y-2">
            {userStakes.length > 0 ? (
              userStakes.map((stake) => {
                const tier = getTierForAmount(stake.amount);
                return (
                  <div
                    key={stake.id}
                    className="bg-gradient-to-r from-slate-900/80 to-gray-900/80 backdrop-blur-xl border border-gray-700 rounded-lg p-3"
                  >
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-3">
                      <div className="flex items-center mb-2 md:mb-0">
                        <div className="text-xl mr-2">{tier?.icon || '💎'}</div>
                        <div>
                          <div className="font-mono font-bold text-white text-sm">
                            {tier?.name || 'Custom Stake'}
                          </div>
                          <div className="text-xs text-gray-400">
                            {formatNumber(stake.amount)} TON • {(stake.daily_rate * 100).toFixed(2)}% Daily
                          </div>
                          <div className="text-xs text-blue-400">
                            Created: {formatDate(stake.start_date)}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-base font-mono font-bold text-yellow-400">
                          {formatNumber(stake.total_earned)} TON
                        </div>
                        <div className="text-xs text-green-400">
                          Net: {formatNumber(stake.total_earned * 0.6)} TON
                        </div>
                        <div className="text-xs text-gray-400">
                          {((stake.total_earned / stake.amount) * 100).toFixed(1)}% of {tier?.maxReturn || 300}%
                        </div>
                      </div>
                    </div>

                    {/* Detailed Earnings Breakdown */}
                    <div className="bg-gray-800/30 rounded-lg p-2 mb-3">
                      <div className="text-xs font-mono text-gray-400 mb-2 text-center">📊 FULL EARNINGS BREAKDOWN</div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center text-xs">
                        <div>
                          <div className="text-green-400 font-bold">GROSS TOTAL</div>
                          <div className="text-white font-mono">{formatNumber(stake.total_earned)} TON</div>
                          <div className="text-gray-400">100%</div>
                        </div>
                        <div>
                          <div className="text-blue-400 font-bold">YOUR SHARE</div>
                          <div className="text-white font-mono">{formatNumber(stake.total_earned * 0.6)} TON</div>
                          <div className="text-gray-400">60%</div>
                        </div>
                        <div>
                          <div className="text-purple-400 font-bold">DAILY GROSS</div>
                          <div className="text-white font-mono">{formatNumber(stake.amount * stake.daily_rate)} TON</div>
                          <div className="text-gray-400">Per 24h</div>
                        </div>
                        <div>
                          <div className="text-yellow-400 font-bold">DAILY NET</div>
                          <div className="text-white font-mono">{formatNumber(stake.amount * stake.daily_rate * 0.6)} TON</div>
                          <div className="text-gray-400">To Wallet</div>
                        </div>
                      </div>

                      {/* Current Rewards Available */}
                      <div className="mt-2 pt-2 border-t border-gray-700">
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="text-xs text-gray-400">AVAILABLE TO CLAIM</div>
                            <div className="text-xs font-mono font-bold text-cyan-400">
                              {formatNumber(calculateStakeRewards(stake))} TON
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-400">YOU RECEIVE</div>
                            <div className="text-xs font-mono font-bold text-green-400">
                              {formatNumber(calculateStakeRewards(stake) * 0.6)} TON
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Projections for this stake */}
                      <div className="mt-2 pt-2 border-t border-gray-700">
                        <div className="text-xs text-gray-400 mb-1 text-center">PROJECTIONS (Net to You)</div>
                        <div className="grid grid-cols-3 gap-1 text-xs text-center">
                          <div>
                            <div className="text-indigo-400 font-mono font-bold">
                              {formatNumber(stake.amount * stake.daily_rate * 7 * 0.6)} TON
                            </div>
                            <div className="text-gray-400">Weekly</div>
                          </div>
                          <div>
                            <div className="text-purple-400 font-mono font-bold">
                              {formatNumber(stake.amount * stake.daily_rate * 30 * 0.6)} TON
                            </div>
                            <div className="text-gray-400">Monthly</div>
                          </div>
                          <div>
                            <div className="text-cyan-400 font-mono font-bold">
                              {formatNumber(stake.amount * ((tier?.maxReturn || 300) / 100) * 0.6)} TON
                            </div>
                            <div className="text-gray-400">Max Net</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mb-2">
                      <div className="flex justify-between text-xs font-mono text-gray-400 mb-1">
                        <span>Cycle Progress</span>
                        <span>{((stake.total_earned / stake.amount) * 100).toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-1.5">
                        <div
                          className="bg-gradient-to-r from-cyan-500 to-blue-500 h-1.5 rounded-full transition-all duration-300"
                          style={{
                            width: `${Math.min((stake.total_earned / stake.amount) * 100, 100)}%`
                          }}
                        ></div>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-2 sm:space-y-0">
                      <div className="text-xs font-mono text-gray-400">
                        Started: {formatDate(stake.start_date)}
                      </div>
                      
                      <div className="flex space-x-2">
                        {stake.speed_boost_active ? (
                          <div className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded">
                            ⚡ Speed Boost Active
                          </div>
                        ) : (
                          <button
                            onClick={() => activateSpeedBoost(stake.id)}
                            className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded hover:bg-yellow-500/30 transition-colors"
                          >
                            ⚡ Activate Boost
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-6">
                <div className="text-2xl mb-2">🚀</div>
                <div className="text-lg font-mono font-bold text-cyan-400 mb-1">No Active Stakes</div>
                <div className="text-gray-400 mb-3 text-sm">Start staking to earn daily TON rewards</div>
                <button
                  onClick={() => setShowStakeModal(true)}
                  className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-mono font-bold py-2 px-4 rounded-lg transition-all duration-300 hover:scale-105 active:scale-95"
                >
                  CREATE FIRST STAKE
                </button>
              </div>
            )}
          </div>
        )}

        {/* Synergy Tab */}
        {activeTab === 'synergy' && (
          <div className="space-y-3">
            {/* Synergy Overview Card */}
            <div className="bg-gradient-to-r from-purple-900/80 to-indigo-900/80 backdrop-blur-xl border border-purple-500/30 rounded-lg p-3">
              <div className="text-center mb-3">
                <div className="text-2xl mb-1">⚡</div>
                <h2 className="text-lg font-mono font-bold text-purple-400 mb-1">Mining-Staking Synergy</h2>
                <p className="text-gray-300 text-xs">
                  Combine your mining achievements with staking to unlock powerful bonuses
                </p>
              </div>

              {/* Current Synergy Level */}
              <div className="bg-gradient-to-r from-purple-800/50 to-indigo-800/50 border border-purple-500/20 rounded-lg p-2 mb-3">
                <div className="text-center">
                  <div className="text-xl font-mono font-bold text-purple-300 mb-1">
                    Level {miningSynergy.synergyLevel}/10
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2 mb-2">
                    <div
                      className="bg-gradient-to-r from-purple-500 to-indigo-500 h-2 rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min((miningSynergy.totalMiningPoints / miningSynergy.nextSynergyMilestone) * 100, 100)}%`
                      }}
                    ></div>
                  </div>
                  <div className="text-xs text-gray-400">
                    {formatNumber(miningSynergy.totalMiningPoints)} / {formatNumber(miningSynergy.nextSynergyMilestone)} points to next level
                  </div>
                </div>
              </div>

              {/* Synergy Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                <div className="bg-gray-800/30 border border-gray-600/30 rounded-lg p-2 text-center">
                  <div className="text-purple-400 font-bold text-xs mb-1">MINING POINTS</div>
                  <div className="text-white font-mono font-bold text-sm">
                    {formatNumber(miningSynergy.totalMiningPoints)}
                  </div>
                  <div className="text-purple-300 text-xs">Total Earned</div>
                </div>
                
                <div className="bg-gray-800/30 border border-gray-600/30 rounded-lg p-2 text-center">
                  <div className="text-indigo-400 font-bold text-xs mb-1">ACTIVE STAKES</div>
                  <div className="text-white font-mono font-bold text-sm">
                    {miningSynergy.activeStakesCount}
                  </div>
                  <div className="text-indigo-300 text-xs">Currently Staking</div>
                </div>
                
                <div className="bg-gray-800/30 border border-gray-600/30 rounded-lg p-2 text-center">
                  <div className="text-pink-400 font-bold text-xs mb-1">TOTAL STAKED</div>
                  <div className="text-white font-mono font-bold text-sm">
                    {formatNumber(miningSynergy.totalStakedAmount)} TON
                  </div>
                  <div className="text-pink-300 text-xs">Principal Amount</div>
                </div>
                
                <div className="bg-gray-800/30 border border-gray-600/30 rounded-lg p-2 text-center">
                  <div className="text-cyan-400 font-bold text-xs mb-1">SYNERGY SCORE</div>
                  <div className="text-white font-mono font-bold text-sm">
                    {((miningSynergy.totalMiningPoints / 10000 + miningSynergy.totalStakedAmount / 1000) / 2 * 100).toFixed(1)}%
                  </div>
                  <div className="text-cyan-300 text-xs">Combined Power</div>
                </div>
              </div>

              {/* Current Bonuses */}
              <div className="bg-gradient-to-r from-green-900/30 to-emerald-900/30 border border-green-500/20 rounded-lg p-2">
                <div className="text-green-400 font-mono font-bold text-xs mb-2 text-center">🎯 CURRENT BONUSES</div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-green-300 font-mono font-bold text-sm">
                      +{(miningSynergy.synergyRewards.miningBoost * 100).toFixed(1)}%
                    </div>
                    <div className="text-green-400 text-xs">Mining Speed</div>
                    <div className="text-gray-400 text-xs">Points per second</div>
                  </div>
                  <div>
                    <div className="text-blue-300 font-mono font-bold text-sm">
                      +{(miningSynergy.synergyRewards.stakingBoost * 100).toFixed(1)}%
                    </div>
                    <div className="text-blue-400 text-xs">Staking Rate</div>
                    <div className="text-gray-400 text-xs">Daily ROI bonus</div>
                  </div>
                  <div>
                    <div className="text-purple-300 font-mono font-bold text-sm">
                      +{miningSynergy.synergyRewards.divinePointsBonus}
                    </div>
                    <div className="text-purple-400 text-xs">Divine Points</div>
                    <div className="text-gray-400 text-xs">Per mining cycle</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Synergy Milestones */}
            <div className="bg-gradient-to-r from-yellow-900/80 to-orange-900/80 backdrop-blur-xl border border-yellow-500/30 rounded-lg p-3">
              <div className="text-center mb-3">
                <div className="text-xl mb-1">🏆</div>
                <h3 className="text-base font-mono font-bold text-yellow-400 mb-1">Synergy Milestones</h3>
                <p className="text-gray-300 text-xs">
                  Unlock powerful rewards by reaching synergy milestones
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {[1, 3, 5, 7, 10].map((level) => (
                  <div
                    key={level}
                    className={`border rounded-lg p-2 ${
                      miningSynergy.synergyLevel >= level
                        ? 'bg-green-500/20 border-green-500/50'
                        : 'bg-gray-800/30 border-gray-600/30'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center space-x-1">
                        <span className="text-sm">{miningSynergy.synergyLevel >= level ? '✅' : '🔒'}</span>
                        <span className="font-mono font-bold text-white text-xs">Level {level}</span>
                      </div>
                      <span className="text-xs text-gray-400">
                        {level * 1000} points
                      </span>
                    </div>
                    <div className="text-xs text-gray-300 space-y-0.5">
                      <div>• +{(level * 5).toFixed(1)}% Mining Speed</div>
                      <div>• +{(level * 2).toFixed(1)}% Staking Rate</div>
                      <div>• +{level * 10} Divine Points</div>
                      {level >= 5 && <div>• ⚡ Speed Boost Unlocked</div>}
                      {level >= 7 && <div>• 💎 Gem Rewards</div>}
                      {level >= 10 && <div>• 🌟 Ultimate Synergy</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Synergy Actions */}
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={() => setShowSynergyModal(true)}
                className="flex-1 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white font-mono font-bold py-2 px-3 rounded-lg transition-all duration-300 hover:scale-105 active:scale-95"
              >
                <div className="flex items-center justify-center space-x-2">
                  <span>⚡</span>
                  <span>Claim Synergy Rewards</span>
                </div>
              </button>
              
              <button
                onClick={() => setShowStakeModal(true)}
                className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-mono font-bold py-2 px-3 rounded-lg transition-all duration-300 hover:scale-105 active:scale-95"
              >
                <div className="flex items-center justify-center space-x-2">
                  <span>🚀</span>
                  <span>Boost Synergy</span>
                </div>
              </button>
              
              <button
                onClick={debugSynergy}
                className="flex-1 bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white font-mono font-bold py-3 px-6 rounded-xl transition-all duration-300 hover:scale-105 active:scale-95"
              >
                <div className="flex items-center justify-center space-x-2">
                  <span>🔍</span>
                  <span>Debug Synergy</span>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* User-Friendly Staking Modal */}
        {showStakeModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
            <div className="bg-gradient-to-r from-slate-900/95 to-gray-900/95 backdrop-blur-xl rounded-2xl p-4 sm:p-6 max-w-lg w-full border border-cyan-500/30 shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-mono font-bold text-cyan-400">
                  {userStakes.length > 0 ? '⚡ Add More Stakes' : '🚀 Create New Stake'}
                </h3>
                <button
                  onClick={() => setShowStakeModal(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>

              {selectedTier && (
                <div className="mb-6 p-4 bg-gradient-to-r from-gray-800/50 to-gray-700/50 rounded-xl border border-gray-600/30">
                  <div className="text-center">
                    <div className="text-3xl mb-3">{selectedTier.icon}</div>
                    <div className="font-mono font-bold text-white text-lg mb-1">{selectedTier.name}</div>
                    <div className="text-green-400 font-mono font-bold text-xl mb-2">
                      {(selectedTier.dailyRate * 100).toFixed(1)}% Daily ROI
                    </div>
                    <div className="text-xs text-gray-400">
                      {selectedTier.maxReturn}% Max Return • {selectedTier.cycleDuration} Days
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-6">
                {/* Tier Selection */}
                {!selectedTier && (
                  <div>
                    <label className="block text-sm font-mono font-medium text-gray-300 mb-3">
                      {userStakes.length > 0 ? '⚡ Choose Additional Tier' : '🏆 Choose Your Tier'}
                    </label>
                    <div className="grid grid-cols-1 gap-3">
                      {STAKING_TIERS.slice(0, 3).map((tier) => (
                        <button
                          key={tier.id}
                          onClick={() => {
                            setSelectedTier(tier);
                            setStakeAmount(tier.minAmount);
                          }}
                          className="flex items-center justify-between p-3 bg-gray-800/50 border border-gray-600/30 rounded-lg hover:border-cyan-500/50 transition-all duration-200"
                        >
                          <div className="flex items-center space-x-2 sm:space-x-3">
                            <span className="text-xl sm:text-2xl">{tier.icon}</span>
                            <div className="text-left">
                              <div className="font-mono font-bold text-white text-sm sm:text-base">{tier.name}</div>
                              <div className="text-xs sm:text-sm text-green-400">{(tier.dailyRate * 100).toFixed(1)}% Daily</div>
                            </div>
                          </div>
                          <div className="text-right text-xs text-gray-400 hidden sm:block">
                            <div>Min: {tier.minAmount} TON</div>
                            <div>Max: {tier.maxAmount} TON</div>
                          </div>
                          <div className="text-right text-xs text-gray-400 sm:hidden">
                            <div>{tier.minAmount}-{tier.maxAmount} TON</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Amount Input */}
                {selectedTier && (
                  <div>
                    <label className="block text-sm font-mono font-medium text-gray-300 mb-3">
                      💰 Stake Amount
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min={selectedTier?.minAmount || 1}
                        max={selectedTier?.maxAmount || 50000}
                        value={stakeAmount}
                        onChange={(e) => setStakeAmount(Number(e.target.value))}
                        className="w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-3 text-white font-mono text-lg focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                        placeholder="Enter amount..."
                      />
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 font-mono">
                        TON
                      </div>
                    </div>
                    <div className="flex justify-between text-xs text-gray-400 mt-2 font-mono">
                      <span>Min: {selectedTier?.minAmount || 1} TON</span>
                      <span>Max: {selectedTier?.maxAmount || 50000} TON</span>
                      <span>Balance: {formatNumber(userBalance)} TON</span>
                    </div>
                  </div>
                )}

                {/* Earnings Preview */}
                {selectedTier && (
                  <div className="bg-gradient-to-r from-green-900/30 to-emerald-900/30 border border-green-500/20 rounded-xl p-4">
                    <div className="text-green-400 font-mono font-bold text-sm mb-3 text-center">
                      📊 EARNINGS PREVIEW
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-center">
                      <div>
                        <div className="text-white font-mono font-bold text-lg">
                          {formatNumber(stakeAmount * (selectedTier?.dailyRate || 0.01))} TON
                        </div>
                        <div className="text-green-300 text-xs">Daily (Gross)</div>
                        <div className="text-green-200 text-xs">
                          {formatNumber(stakeAmount * (selectedTier?.dailyRate || 0.01) * 0.6)} TON net
                        </div>
                      </div>
                      <div>
                        <div className="text-white font-mono font-bold text-lg">
                          {formatNumber(stakeAmount * (selectedTier?.dailyRate || 0.01) * 30)} TON
                        </div>
                        <div className="text-green-300 text-xs">Monthly (Gross)</div>
                        <div className="text-green-200 text-xs">
                          {formatNumber(stakeAmount * (selectedTier?.dailyRate || 0.01) * 30 * 0.6)} TON net
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setShowStakeModal(false)}
                    className="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-mono font-bold py-2 sm:py-3 px-3 sm:px-4 rounded-xl transition-all duration-200 text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleStake}
                    disabled={isLoading || !selectedTier || stakeAmount < (selectedTier?.minAmount || 1) || stakeAmount > userBalance}
                    className={`flex-1 font-mono font-bold py-2 sm:py-3 px-3 sm:px-4 rounded-xl transition-all duration-300 text-sm ${
                      isLoading || !selectedTier || stakeAmount < (selectedTier?.minAmount || 1) || stakeAmount > userBalance
                        ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                        : 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white hover:scale-105 active:scale-95'
                    }`}
                  >
                    {isLoading ? (
                      <div className="flex items-center justify-center space-x-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>{userStakes.length > 0 ? 'Adding...' : 'Creating...'}</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center space-x-2">
                        <span>{userStakes.length > 0 ? '⚡' : '🚀'}</span>
                        <span>{userStakes.length > 0 ? 'Add Stake' : 'Create Stake'}</span>
                      </div>
                    )}
                  </button>
                </div>

                {/* Validation Messages */}
                {selectedTier && (
                  <div className="text-xs text-center">
                    {stakeAmount > userBalance && (
                      <div className="text-red-400 mb-1">⚠️ Insufficient balance</div>
                    )}
                    {stakeAmount < (selectedTier?.minAmount || 1) && (
                      <div className="text-yellow-400 mb-1">⚠️ Amount below minimum</div>
                    )}
                    {stakeAmount > (selectedTier?.maxAmount || 50000) && (
                      <div className="text-yellow-400 mb-1">⚠️ Amount above maximum</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* User-Friendly Claim Modal */}
        {showClaimModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gradient-to-r from-slate-900/95 to-gray-900/95 backdrop-blur-xl rounded-2xl p-6 max-w-lg w-full border border-green-500/30 shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-mono font-bold text-green-400">
                  💰 Claim Rewards
                </h3>
                <button
                  onClick={() => setShowClaimModal(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>

              <div className="text-center mb-6">
                <div className="text-4xl font-mono font-bold text-green-400 mb-2">
                  {formatNumber(availableToClaim)} TON
                </div>
                <div className="text-sm text-gray-400 font-mono mb-4">
                  Available to claim from your active stakes
                </div>
                
                {/* Success Animation */}
                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">💰</span>
                </div>
              </div>

              <div className="space-y-6">
                {/* Enhanced Fee Breakdown */}
                <div className="bg-gradient-to-r from-gray-800/50 to-gray-700/50 rounded-xl p-4 border border-gray-600/30">
                  <div className="text-sm font-mono text-gray-300 mb-3 text-center">📊 Reward Distribution</div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-2 bg-green-500/10 rounded-lg border border-green-500/20">
                      <div className="flex items-center space-x-2">
                        <span className="text-green-400">💚</span>
                        <span className="text-sm font-mono text-white">You Receive</span>
                      </div>
                      <div className="text-right">
                        <div className="text-green-400 font-mono font-bold">{formatNumber(availableToClaim * 0.6)} TON</div>
                        <div className="text-xs text-green-300">60% of rewards</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
                      <div className="flex items-center space-x-2">
                        <span className="text-blue-400">🌊</span>
                        <span className="text-sm font-mono text-white">GLP Pool</span>
                      </div>
                      <div className="text-right">
                        <div className="text-blue-400 font-mono font-bold">{formatNumber(availableToClaim * 0.1)} TON</div>
                        <div className="text-xs text-blue-300">10% for liquidity</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between p-2 bg-purple-500/10 rounded-lg border border-purple-500/20">
                      <div className="flex items-center space-x-2">
                        <span className="text-purple-400">🪙</span>
                        <span className="text-sm font-mono text-white">STK Tokens</span>
                      </div>
                      <div className="text-right">
                        <div className="text-purple-400 font-mono font-bold">{formatNumber(availableToClaim * 0.1)} TON</div>
                        <div className="text-xs text-purple-300">10% for governance</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between p-2 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                      <div className="flex items-center space-x-2">
                        <span className="text-yellow-400">🔄</span>
                        <span className="text-sm font-mono text-white">Reinvestment</span>
                      </div>
                      <div className="text-right">
                        <div className="text-yellow-400 font-mono font-bold">{formatNumber(availableToClaim * 0.2)} TON</div>
                        <div className="text-xs text-yellow-300">20% for growth</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setShowClaimModal(false)}
                    className="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-mono font-bold py-3 px-4 rounded-xl transition-all duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleClaimRewards}
                    disabled={isClaiming || availableToClaim <= 0}
                    className={`flex-1 font-mono font-bold py-3 px-4 rounded-xl transition-all duration-300 ${
                      isClaiming || availableToClaim <= 0
                        ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                        : 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white hover:scale-105 active:scale-95'
                    }`}
                  >
                    {isClaiming ? (
                      <div className="flex items-center justify-center space-x-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Claiming...</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center space-x-2">
                        <span>💰</span>
                        <span>Claim Rewards</span>
                      </div>
                    )}
                  </button>
                </div>

                {/* Success Message */}
                {availableToClaim > 0 && (
                  <div className="text-center text-xs text-green-300 mt-3">
                    🎉 You'll receive {formatNumber(availableToClaim * 0.6)} TON to your wallet!
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* User-Friendly Withdrawal Modal */}
        {showWithdrawalModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
            <div className="bg-gradient-to-r from-slate-900/95 to-gray-900/95 backdrop-blur-xl rounded-2xl p-4 sm:p-6 max-w-lg w-full border border-orange-500/30 shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-mono font-bold text-orange-400">
                  💳 Request Withdrawal
                </h3>
                <button
                  onClick={() => setShowWithdrawalModal(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-6">
                {/* Balance Display */}
                <div className="bg-gradient-to-r from-orange-900/30 to-red-900/30 border border-orange-500/20 rounded-xl p-4 text-center">
                  <div className="text-orange-400 font-mono font-bold text-sm mb-2">AVAILABLE BALANCE</div>
                  <div className="text-3xl font-mono font-bold text-white mb-2">
                    {formatNumber(userBalance)} TON
                  </div>
                  <div className="text-orange-300 text-xs">Ready for withdrawal</div>
                </div>

                {/* Withdrawal Amount */}
                <div>
                  <label className="block text-sm font-mono font-medium text-gray-300 mb-3">
                    💰 Withdrawal Amount
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0.1"
                      max={userBalance}
                      value={withdrawalAmount}
                      onChange={(e) => setWithdrawalAmount(Number(e.target.value))}
                      className="w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-3 text-white font-mono text-lg focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                      placeholder="Enter amount..."
                    />
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 font-mono">
                      TON
                    </div>
                  </div>
                  <div className="flex justify-between text-xs text-gray-400 mt-2 font-mono">
                    <span>Min: 0.1 TON</span>
                    <span>Max: {formatNumber(userBalance)} TON</span>
                  </div>
                </div>

                {/* Wallet Address */}
                <div>
                  <label className="block text-sm font-mono font-medium text-gray-300 mb-3">
                    🏦 TON Wallet Address
                  </label>
                  <input
                    type="text"
                    value={walletAddress}
                    onChange={(e) => setWalletAddress(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-3 text-white font-mono text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                    placeholder="Enter your TON wallet address..."
                  />
                  <div className="text-xs text-gray-400 mt-2 font-mono">
                    Funds will be sent to this address
                  </div>
                </div>

                {/* Withdrawal Info */}
                <div className="bg-gray-800/30 border border-gray-600/30 rounded-xl p-4">
                  <div className="text-sm font-mono text-gray-300 mb-3 text-center">📋 WITHDRAWAL INFORMATION</div>
                  <div className="space-y-2 text-xs font-mono">
                    <div className="flex justify-between">
                      <span>Processing Time:</span>
                      <span className="text-orange-400">24-48 hours</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Network Fee:</span>
                      <span className="text-orange-400">0.05 TON</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Minimum Withdrawal:</span>
                      <span className="text-orange-400">0.1 TON</span>
                    </div>
                    <div className="flex justify-between">
                      <span>You'll Receive:</span>
                      <span className="text-green-400">
                        {withdrawalAmount > 0 ? formatNumber(Math.max(0, withdrawalAmount - 0.05)) : '0.0000'} TON
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setShowWithdrawalModal(false)}
                    className="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-mono font-bold py-2 sm:py-3 px-3 sm:px-4 rounded-xl transition-all duration-200 text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleWithdrawalRequest}
                    disabled={isWithdrawing || !walletAddress.trim() || withdrawalAmount <= 0 || withdrawalAmount > userBalance}
                    className={`flex-1 font-mono font-bold py-2 sm:py-3 px-3 sm:px-4 rounded-xl transition-all duration-300 text-sm ${
                      isWithdrawing || !walletAddress.trim() || withdrawalAmount <= 0 || withdrawalAmount > userBalance
                        ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                        : 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white hover:scale-105 active:scale-95'
                    }`}
                  >
                    {isWithdrawing ? (
                      <div className="flex items-center justify-center space-x-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Processing...</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center space-x-2">
                        <span>💳</span>
                        <span>Request Withdrawal</span>
                      </div>
                    )}
                  </button>
                </div>

                {/* Validation Messages */}
                <div className="text-xs text-center">
                  {withdrawalAmount > userBalance && (
                    <div className="text-red-400 mb-1">⚠️ Amount exceeds available balance</div>
                  )}
                  {withdrawalAmount < 0.1 && withdrawalAmount > 0 && (
                    <div className="text-yellow-400 mb-1">⚠️ Amount below minimum</div>
                  )}
                  {!walletAddress.trim() && (
                    <div className="text-yellow-400 mb-1">⚠️ Please enter wallet address</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Synergy Rewards Modal */}
        {showSynergyModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gradient-to-r from-purple-900/95 to-indigo-900/95 backdrop-blur-xl rounded-2xl p-6 max-w-lg w-full border border-purple-500/30 shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-mono font-bold text-purple-400">
                  ⚡ Synergy Rewards
                </h3>
                <button
                  onClick={() => setShowSynergyModal(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>

              <div className="text-center mb-6">
                <div className="text-4xl mb-3">🎁</div>
                <div className="text-2xl font-mono font-bold text-purple-300 mb-2">
                  Level {miningSynergy.synergyLevel} Synergy Achieved!
                </div>
                <div className="text-sm text-gray-400">
                  Claim your rewards for combining mining and staking
                </div>
              </div>

              <div className="space-y-4 mb-6">
                {/* Available Rewards */}
                <div className="bg-gradient-to-r from-purple-800/50 to-indigo-800/50 border border-purple-500/20 rounded-xl p-4">
                  <div className="text-purple-400 font-mono font-bold text-sm mb-3 text-center">🎯 AVAILABLE REWARDS</div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-2 bg-green-500/10 rounded-lg border border-green-500/20">
                      <div className="flex items-center space-x-2">
                        <span className="text-green-400">⚡</span>
                        <span className="text-sm font-mono text-white">Mining Speed Boost</span>
                      </div>
                      <div className="text-right">
                        <div className="text-green-400 font-mono font-bold">+{(miningSynergy.synergyRewards.miningBoost * 100).toFixed(1)}%</div>
                        <div className="text-xs text-green-300">Permanent bonus</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
                      <div className="flex items-center space-x-2">
                        <span className="text-blue-400">💰</span>
                        <span className="text-sm font-mono text-white">Staking Rate Bonus</span>
                      </div>
                      <div className="text-right">
                        <div className="text-blue-400 font-mono font-bold">+{(miningSynergy.synergyRewards.stakingBoost * 100).toFixed(1)}%</div>
                        <div className="text-xs text-blue-300">Daily ROI increase</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between p-2 bg-purple-500/10 rounded-lg border border-purple-500/20">
                      <div className="flex items-center space-x-2">
                        <span className="text-purple-400">💎</span>
                        <span className="text-sm font-mono text-white">Divine Points Bonus</span>
                      </div>
                      <div className="text-right">
                        <div className="text-purple-400 font-mono font-bold">+{miningSynergy.synergyRewards.divinePointsBonus}</div>
                        <div className="text-xs text-purple-300">Per mining cycle</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Special Rewards for High Levels */}
                {miningSynergy.synergyLevel >= 5 && (
                  <div className="bg-gradient-to-r from-yellow-900/30 to-orange-900/30 border border-yellow-500/20 rounded-xl p-4">
                    <div className="text-yellow-400 font-mono font-bold text-sm mb-3 text-center">🌟 SPECIAL REWARDS</div>
                    <div className="space-y-2 text-sm">
                      {miningSynergy.synergyLevel >= 5 && (
                        <div className="flex items-center space-x-2 text-yellow-300">
                          <span>⚡</span>
                          <span>Speed Boost Unlocked for all stakes</span>
                        </div>
                      )}
                      {miningSynergy.synergyLevel >= 7 && (
                        <div className="flex items-center space-x-2 text-purple-300">
                          <span>💎</span>
                          <span>+50 Gems bonus</span>
                        </div>
                      )}
                      {miningSynergy.synergyLevel >= 10 && (
                        <div className="flex items-center space-x-2 text-cyan-300">
                          <span>🌟</span>
                          <span>Ultimate Synergy: +100% to all bonuses</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowSynergyModal(false)}
                  className="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-mono font-bold py-3 px-4 rounded-xl transition-all duration-200"
                >
                  Close
                </button>
                <button
                  onClick={handleApplySynergyRewards}
                  className="flex-1 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white font-mono font-bold py-3 px-4 rounded-xl transition-all duration-300 hover:scale-105 active:scale-95"
                >
                  <div className="flex items-center justify-center space-x-2">
                    <span>⚡</span>
                    <span>Apply Rewards</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Deposit Modal */}
        {showDepositModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gradient-to-r from-blue-900/95 to-cyan-900/95 backdrop-blur-xl rounded-2xl p-6 max-w-lg w-full border border-blue-500/30 shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-mono font-bold text-blue-400">
                  💰 Deposit TON
                </h3>
                <button
                  onClick={() => setShowDepositModal(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-6">
                {/* Wallet Connection Status */}
                {/* <div className="bg-gray-800/30 border border-gray-600/30 rounded-xl p-4">
                  <div className="text-sm font-mono text-gray-300 mb-3 text-center">🔗 WALLET CONNECTION</div>
                  <div className="space-y-2 text-xs font-mono">
                    <div className="flex justify-between">
                      <span>Status:</span>
                      <span className={userFriendlyAddress ? 'text-green-400' : 'text-red-400'}>
                        {userFriendlyAddress ? 'Connected' : 'Not Connected'}
                      </span>
                    </div>
                    {userFriendlyAddress && (
                      <div className="flex justify-between">
                        <span>Address:</span>
                        <span className="text-blue-400 font-mono">
                          {userFriendlyAddress.slice(0, 6)}...{userFriendlyAddress.slice(-4)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>Balance:</span>
                      <span className="text-green-400">
                        Wallet Balance
                      </span>
                    </div>
                  </div>
                </div> */}

                {/* Deposit Amount */}
                <div className="bg-gray-800/30 border border-gray-600/30 rounded-xl p-4">
                  <div className="text-sm font-mono text-gray-300 mb-3 text-center">💰 DEPOSIT AMOUNT</div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-gray-400 mb-2">Amount (TON)</label>
                      <input
                        type="number"
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(Number(e.target.value))}
                        min="1"
                        step="0.1"
                        className="w-full bg-gray-700/50 border border-gray-600/30 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-blue-500"
                        placeholder="Enter amount"
                      />
                    </div>
                    
                    {/* Quick Amount Buttons */}
                    <div className="grid grid-cols-3 gap-2">
                      {[1, 5, 10, 25, 50, 100].map((amount) => (
                        <button
                          key={amount}
                          onClick={() => setDepositAmount(amount)}
                          className="bg-gray-700/50 hover:bg-gray-600/50 border border-gray-600/30 rounded-lg px-2 py-1 text-xs font-mono text-white transition-colors"
                        >
                          {amount} TON
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Deposit Information */}
                <div className="bg-gray-800/30 border border-gray-600/30 rounded-xl p-4">
                  <div className="text-sm font-mono text-gray-300 mb-3 text-center">📋 DEPOSIT INFORMATION</div>
                  <div className="space-y-2 text-xs font-mono">
                    <div className="flex justify-between">
                      <span>Network:</span>
                      <span className="text-blue-400">{NETWORK_NAME}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Deposit Address:</span>
                      <span className="text-blue-400 font-mono">
                        {DEPOSIT_ADDRESS.slice(0, 8)}...{DEPOSIT_ADDRESS.slice(-8)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Minimum Deposit:</span>
                      <span className="text-orange-400">1 TON</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Processing Time:</span>
                      <span className="text-green-400">Instant</span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setShowDepositModal(false)}
                    className="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-mono font-bold py-2 sm:py-3 px-3 sm:px-4 rounded-xl transition-all duration-200 text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleDeposit(depositAmount)}
                    disabled={depositStatus === 'pending' || !userFriendlyAddress || depositAmount < 1}
                    className={`flex-1 font-mono font-bold py-2 sm:py-3 px-3 sm:px-4 rounded-xl transition-all duration-300 text-sm ${
                                              depositStatus === 'pending' || !userFriendlyAddress || depositAmount < 1
                        ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                        : 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white hover:scale-105 active:scale-95'
                    }`}
                  >
                    {depositStatus === 'pending' ? (
                      <div className="flex items-center justify-center space-x-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Processing...</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center space-x-2">
                        <span>💰</span>
                        <span>Deposit {depositAmount} TON</span>
                      </div>
                    )}
                  </button>
                </div>

                {/* Validation Messages */}
                <div className="text-xs text-center">
                  {!userFriendlyAddress && (
                    <div className="text-red-400 mb-1">⚠️ Please connect your wallet first</div>
                  )}
                  {depositAmount < 1 && depositAmount > 0 && (
                    <div className="text-yellow-400 mb-1">⚠️ Minimum deposit is 1 TON</div>
                  )}
                                      {false && (
                    <div className="text-red-400 mb-1">⚠️ Insufficient wallet balance</div>
                  )}
                  {depositStatus === 'success' && (
                    <div className="text-green-400 mb-1">✅ Deposit successful!</div>
                  )}
                  {depositStatus === 'error' && (
                    <div className="text-red-400 mb-1">❌ Deposit failed. Please try again.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DailyRewards;