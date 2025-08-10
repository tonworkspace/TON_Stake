import { supabase } from './supabaseClient';

// Database migration and setup utilities for Divine Mining Auth

export interface DatabaseMigration {
  name: string;
  version: string;
  description: string;
  execute: () => Promise<void>;
}

// Migration to add Divine Mining specific columns to users table
export const divineMiningUserMigration: DatabaseMigration = {
  name: 'divine_mining_user_columns',
  version: '1.0.0',
  description: 'Add Divine Mining specific columns to users table',
  execute: async () => {
    try {
      // Add Divine Mining specific columns to users table
      const migrations = [
        // Game data columns
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS divine_points NUMERIC DEFAULT 100`,
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS mining_level INTEGER DEFAULT 1`,
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS mining_experience NUMERIC DEFAULT 0`,
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS energy NUMERIC DEFAULT 100`,
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS max_energy NUMERIC DEFAULT 100`,
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS energy_regen_rate NUMERIC DEFAULT 0.3`,
        
        // Game state columns
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_mining BOOLEAN DEFAULT false`,
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS mining_started_at TIMESTAMP WITH TIME ZONE`,
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS last_save_time BIGINT DEFAULT 0`,
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS game_version TEXT DEFAULT '1.0.0'`,
        
        // Upgrade and progression columns
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS upgrade_levels JSONB DEFAULT '{}'`,
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS achievements TEXT[] DEFAULT '{}'`,
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS owned_skins TEXT[] DEFAULT '{default}'`,
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS active_skin TEXT DEFAULT 'default'`,
        
        // Premium features
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT false`,
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS premium_expires_at TIMESTAMP WITH TIME ZONE`,
        
        // Social features (if not already present)
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS referrals_count INTEGER DEFAULT 0`,
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS team_volume NUMERIC DEFAULT 0`
      ];

      for (const migration of migrations) {
        const { error } = await supabase.rpc('exec_sql', { sql: migration });
        if (error) {
          console.warn(`Migration warning (may already exist): ${error.message}`);
        }
      }

      console.log('Divine Mining user columns migration completed');
    } catch (error) {
      console.error('Error in divine mining user migration:', error);
      throw error;
    }
  }
};

// Migration to create game data table
export const gameDataTableMigration: DatabaseMigration = {
  name: 'game_data_table',
  version: '1.0.0',
  description: 'Create game_data table for storing detailed game state',
  execute: async () => {
    try {
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS game_data (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          game_state JSONB NOT NULL DEFAULT '{}',
          last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(user_id)
        );
        
        CREATE INDEX IF NOT EXISTS idx_game_data_user_id ON game_data(user_id);
        CREATE INDEX IF NOT EXISTS idx_game_data_last_updated ON game_data(last_updated);
      `;

      const { error } = await supabase.rpc('exec_sql', { sql: createTableSQL });
      if (error) {
        console.warn('Game data table migration warning:', error.message);
      }

      console.log('Game data table migration completed');
    } catch (error) {
      console.error('Error in game data table migration:', error);
      throw error;
    }
  }
};

// Migration to create achievements table
export const achievementsTableMigration: DatabaseMigration = {
  name: 'achievements_table',
  version: '1.0.0',
  description: 'Create achievements table for tracking user achievements',
  execute: async () => {
    try {
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS user_achievements (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          achievement_id TEXT NOT NULL,
          unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          progress NUMERIC DEFAULT 0,
          UNIQUE(user_id, achievement_id)
        );
        
        CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON user_achievements(user_id);
        CREATE INDEX IF NOT EXISTS idx_user_achievements_achievement_id ON user_achievements(achievement_id);
      `;

      const { error } = await supabase.rpc('exec_sql', { sql: createTableSQL });
      if (error) {
        console.warn('Achievements table migration warning:', error.message);
      }

      console.log('Achievements table migration completed');
    } catch (error) {
      console.error('Error in achievements table migration:', error);
      throw error;
    }
  }
};

// Migration to create daily rewards table
export const dailyRewardsTableMigration: DatabaseMigration = {
  name: 'daily_rewards_table',
  version: '1.0.0',
  description: 'Create daily rewards table for tracking daily reward claims',
  execute: async () => {
    try {
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS daily_rewards (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          day_number INTEGER NOT NULL,
          claimed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          reward_amount NUMERIC NOT NULL,
          reward_type TEXT NOT NULL DEFAULT 'points',
          UNIQUE(user_id, day_number)
        );
        
        CREATE INDEX IF NOT EXISTS idx_daily_rewards_user_id ON daily_rewards(user_id);
        CREATE INDEX IF NOT EXISTS idx_daily_rewards_claimed_at ON daily_rewards(claimed_at);
      `;

      const { error } = await supabase.rpc('exec_sql', { sql: createTableSQL });
      if (error) {
        console.warn('Daily rewards table migration warning:', error.message);
      }

      console.log('Daily rewards table migration completed');
    } catch (error) {
      console.error('Error in daily rewards table migration:', error);
      throw error;
    }
  }
};

// Migration to create referral tracking table
export const referralTrackingMigration: DatabaseMigration = {
  name: 'referral_tracking',
  version: '1.0.0',
  description: 'Create referral tracking table for detailed referral analytics',
  execute: async () => {
    try {
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS referral_tracking (
          id SERIAL PRIMARY KEY,
          referrer_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          referred_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          referred_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          is_active BOOLEAN DEFAULT true,
          total_earned NUMERIC DEFAULT 0,
          last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(referred_id)
        );
        
        CREATE INDEX IF NOT EXISTS idx_referral_tracking_referrer_id ON referral_tracking(referrer_id);
        CREATE INDEX IF NOT EXISTS idx_referral_tracking_referred_id ON referral_tracking(referred_id);
        CREATE INDEX IF NOT EXISTS idx_referral_tracking_referred_at ON referral_tracking(referred_at);
      `;

      const { error } = await supabase.rpc('exec_sql', { sql: createTableSQL });
      if (error) {
        console.warn('Referral tracking migration warning:', error.message);
      }

      console.log('Referral tracking migration completed');
    } catch (error) {
      console.error('Error in referral tracking migration:', error);
      throw error;
    }
  }
};

// Migration to create task completions table
export const taskCompletionsMigration: DatabaseMigration = {
  name: 'task_completions_table',
  version: '1.0.0',
  description: 'Create task completions table with anti-cheat validation',
  execute: async () => {
    try {
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS task_completions (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          task_id VARCHAR(50) NOT NULL,
          task_type VARCHAR(20) NOT NULL DEFAULT 'unknown', -- 'mining', 'social', 'airdrop'
          reward_amount INTEGER NOT NULL DEFAULT 0,
          reward_type VARCHAR(20) NOT NULL DEFAULT 'gems',
          completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          validation_data JSONB DEFAULT '{}', -- Store validation context
          ip_address INET,
          user_agent TEXT,
          session_id VARCHAR(255),
          is_valid BOOLEAN DEFAULT true,
          validation_hash VARCHAR(255), -- For data integrity
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(user_id, task_id) -- Prevent duplicate completions
        );
        
        CREATE INDEX IF NOT EXISTS idx_task_completions_user_id ON task_completions(user_id);
        CREATE INDEX IF NOT EXISTS idx_task_completions_task_id ON task_completions(task_id);
        CREATE INDEX IF NOT EXISTS idx_task_completions_completed_at ON task_completions(completed_at);
        CREATE INDEX IF NOT EXISTS idx_task_completions_task_type ON task_completions(task_type);
        CREATE INDEX IF NOT EXISTS idx_task_completions_is_valid ON task_completions(is_valid);
        CREATE INDEX IF NOT EXISTS idx_task_completions_session_id ON task_completions(session_id);
        
        -- Create task validation logs table for suspicious activity tracking
        CREATE TABLE IF NOT EXISTS task_validation_logs (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          task_id VARCHAR(50) NOT NULL,
          action_type VARCHAR(20) NOT NULL, -- 'attempt', 'validation_failed', 'rate_limited', 'duplicate'
          reason VARCHAR(255),
          validation_data JSONB DEFAULT '{}',
          ip_address INET,
          user_agent TEXT,
          session_id VARCHAR(255),
          timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_task_validation_logs_user_id ON task_validation_logs(user_id);
        CREATE INDEX IF NOT EXISTS idx_task_validation_logs_timestamp ON task_validation_logs(timestamp);
        CREATE INDEX IF NOT EXISTS idx_task_validation_logs_action_type ON task_validation_logs(action_type);
        
        -- Create task rate limiting table
        CREATE TABLE IF NOT EXISTS task_rate_limits (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          task_category VARCHAR(20) NOT NULL, -- 'social', 'mining', 'airdrop'
          attempts_count INTEGER DEFAULT 1,
          last_attempt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          reset_after TIMESTAMP WITH TIME ZONE,
          is_blocked BOOLEAN DEFAULT false,
          UNIQUE(user_id, task_category)
        );
        
        CREATE INDEX IF NOT EXISTS idx_task_rate_limits_user_id ON task_rate_limits(user_id);
        CREATE INDEX IF NOT EXISTS idx_task_rate_limits_reset_after ON task_rate_limits(reset_after);
        
        -- Create function to safely increment user SBT balance
        CREATE OR REPLACE FUNCTION increment_user_sbt(user_id INTEGER, amount INTEGER)
        RETURNS void AS $$
        BEGIN
          UPDATE users 
          SET total_sbt = COALESCE(total_sbt, 0) + amount,
              last_active = NOW()
          WHERE id = user_id;
        END;
        $$ LANGUAGE plpgsql;
      `;

      const { error } = await supabase.rpc('exec_sql', { sql: createTableSQL });
      if (error) {
        console.warn('Task completions table migration warning:', error.message);
      }

      console.log('Task completions table migration completed');
    } catch (error) {
      console.error('Error in task completions table migration:', error);
      throw error;
    }
  }
};

// All migrations
export const allMigrations: DatabaseMigration[] = [
  divineMiningUserMigration,
  gameDataTableMigration,
  achievementsTableMigration,
  dailyRewardsTableMigration,
  referralTrackingMigration,
  taskCompletionsMigration
];

// Run all migrations
export const runMigrations = async (): Promise<void> => {
  console.log('Starting database migrations...');
  
  for (const migration of allMigrations) {
    try {
      console.log(`Running migration: ${migration.name} - ${migration.description}`);
      await migration.execute();
    } catch (error) {
      console.error(`Migration ${migration.name} failed:`, error);
      // Continue with other migrations even if one fails
    }
  }
  
  console.log('Database migrations completed');
};

// Database utility functions

// Save game data for a user
export const saveGameData = async (userId: number, gameState: any): Promise<void> => {
  try {
    const { error } = await supabase
      .from('game_data')
      .upsert({
        user_id: userId,
        game_state: gameState,
        last_updated: new Date().toISOString()
      }, { onConflict: 'user_id' });

    if (error) throw error;
  } catch (error) {
    console.error('Error saving game data:', error);
    throw error;
  }
};

// Load game data for a user
export const loadGameData = async (userId: number): Promise<any | null> => {
  try {
    const { data, error } = await supabase
      .from('game_data')
      .select('game_state')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // No game data found
      }
      throw error;
    }

    return data?.game_state || null;
  } catch (error) {
    console.error('Error loading game data:', error);
    throw error;
  }
};

// Track achievement unlock
export const unlockAchievement = async (userId: number, achievementId: string, progress: number = 100): Promise<void> => {
  try {
    const { error } = await supabase
      .from('user_achievements')
      .upsert({
        user_id: userId,
        achievement_id: achievementId,
        progress: progress,
        unlocked_at: new Date().toISOString()
      }, { onConflict: 'user_id,achievement_id' });

    if (error) throw error;
  } catch (error) {
    console.error('Error unlocking achievement:', error);
    throw error;
  }
};

// Get user achievements
export const getUserAchievements = async (userId: number): Promise<string[]> => {
  try {
    const { data, error } = await supabase
      .from('user_achievements')
      .select('achievement_id')
      .eq('user_id', userId);

    if (error) throw error;

    return data?.map(item => item.achievement_id) || [];
  } catch (error) {
    console.error('Error getting user achievements:', error);
    return [];
  }
};

// Track daily reward claim
export const claimDailyReward = async (
  userId: number, 
  dayNumber: number, 
  rewardAmount: number, 
  rewardType: string = 'points'
): Promise<void> => {
  try {
    const { error } = await supabase
      .from('daily_rewards')
      .insert({
        user_id: userId,
        day_number: dayNumber,
        reward_amount: rewardAmount,
        reward_type: rewardType,
        claimed_at: new Date().toISOString()
      });

    if (error) throw error;
  } catch (error) {
    console.error('Error claiming daily reward:', error);
    throw error;
  }
};

// Get user's daily reward history
export const getDailyRewardHistory = async (userId: number): Promise<any[]> => {
  try {
    const { data, error } = await supabase
      .from('daily_rewards')
      .select('*')
      .eq('user_id', userId)
      .order('claimed_at', { ascending: false });

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('Error getting daily reward history:', error);
    return [];
  }
};

// Track referral
export const trackReferral = async (referrerId: number, referredId: number): Promise<void> => {
  try {
    const { error } = await supabase
      .from('referral_tracking')
      .insert({
        referrer_id: referrerId,
        referred_id: referredId,
        referred_at: new Date().toISOString()
      });

    if (error) throw error;
  } catch (error) {
    console.error('Error tracking referral:', error);
    throw error;
  }
};

// Get user's referral statistics
export const getReferralStats = async (userId: number): Promise<any> => {
  try {
    const { data, error } = await supabase
      .from('referral_tracking')
      .select('*')
      .eq('referrer_id', userId);

    if (error) throw error;

    const activeReferrals = data?.filter(ref => ref.is_active) || [];
    const totalEarned = activeReferrals.reduce((sum, ref) => sum + (ref.total_earned || 0), 0);

    return {
      totalReferrals: data?.length || 0,
      activeReferrals: activeReferrals.length,
      totalEarned: totalEarned,
      referrals: data || []
    };
  } catch (error) {
    console.error('Error getting referral stats:', error);
    return {
      totalReferrals: 0,
      activeReferrals: 0,
      totalEarned: 0,
      referrals: []
    };
  }
};

// Task completion validation functions
export const validateTaskCompletion = async (
  userId: number, 
  taskId: string, 
  _taskType: string,
  validationData: any = {}
): Promise<{ valid: boolean; reason?: string; data?: any }> => {
  try {
    // Check if task already completed
    const { data: existingCompletion, error: checkError } = await supabase
      .from('task_completions')
      .select('id, completed_at')
      .eq('user_id', userId)
      .eq('task_id', taskId)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      throw checkError;
    }

    if (existingCompletion) {
      return { valid: false, reason: 'Task already completed' };
    }

    // Get user data for validation
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('divine_points, mining_level, upgrade_levels, created_at, last_active')
      .eq('id', userId)
      .single();

    if (userError) {
      return { valid: false, reason: 'User not found' };
    }

    // Validate based on task type and ID
    switch (taskId) {
      case 'mine_1000':
        if ((userData.divine_points || 0) < 1000) {
          return { valid: false, reason: 'Insufficient divine points' };
        }
        break;
        
      case 'mine_10000':
        if ((userData.divine_points || 0) < 10000) {
          return { valid: false, reason: 'Insufficient divine points' };
        }
        break;
        
      case 'mine_1hour':
        // Validate mining time from validation data
        const miningTime = validationData.miningTime || 0;
        if (miningTime < 3600) {
          return { valid: false, reason: 'Insufficient mining time' };
        }
        
        // Additional time validation: check if user has been active for at least 1 hour
        const accountAge = new Date().getTime() - new Date(userData.created_at).getTime();
        if (accountAge < 3600000) { // 1 hour in milliseconds
          return { valid: false, reason: 'Account too new for time-based tasks' };
        }
        break;
        
      case 'buy_upgrade':
        const upgradeLevels = userData.upgrade_levels || {};
        const hasAnyUpgrade = Object.values(upgradeLevels).some((level: any) => level > 0);
        if (!hasAnyUpgrade) {
          return { valid: false, reason: 'No upgrades purchased' };
        }
        break;
        
      case 'submit_wallet':
        // Validate wallet address format
        const walletAddress = validationData.walletAddress;
        if (!walletAddress || walletAddress.length < 10) {
          return { valid: false, reason: 'Invalid wallet address' };
        }
        break;
        
      // Social tasks - these require external validation or user confirmation
      case 'follow_twitter':
      case 'join_telegram':
      case 'retweet_post':
      case 'invite_friend':
      case 'like_post':
        // For now, accept user confirmation, but log for manual review
        break;
        
      default:
        return { valid: false, reason: 'Unknown task' };
    }

    return { valid: true, data: userData };
  } catch (error) {
    console.error('Task validation error:', error);
    return { valid: false, reason: 'Validation failed' };
  }
};

// Complete task with server-side validation
export const completeTaskSecurely = async (
  userId: number,
  taskId: string,
  taskType: string,
  rewardAmount: number,
  rewardType: string = 'gems',
  validationData: any = {},
  sessionInfo: {
    ipAddress?: string;
    userAgent?: string;
    sessionId?: string;
  } = {}
): Promise<{ success: boolean; reason?: string; taskCompletion?: any }> => {
  try {
    // Validate task completion
    const validation = await validateTaskCompletion(userId, taskId, taskType, validationData);
    
    if (!validation.valid) {
      // Log failed validation
      await logTaskValidation(userId, taskId, 'validation_failed', validation.reason, validationData, sessionInfo);
      return { success: false, reason: validation.reason };
    }

    // Check rate limiting
    const rateLimitCheck = await checkTaskRateLimit(userId, taskType);
    if (!rateLimitCheck.allowed) {
      await logTaskValidation(userId, taskId, 'rate_limited', rateLimitCheck.reason, validationData, sessionInfo);
      return { success: false, reason: rateLimitCheck.reason };
    }

    // Generate validation hash for integrity
    const validationHash = await generateValidationHash(userId, taskId, validationData);

    // Create task completion record
    const { data: taskCompletion, error: completionError } = await supabase
      .from('task_completions')
      .insert([{
        user_id: userId,
        task_id: taskId,
        task_type: taskType,
        reward_amount: rewardAmount,
        reward_type: rewardType,
        validation_data: validationData,
        ip_address: sessionInfo.ipAddress,
        user_agent: sessionInfo.userAgent,
        session_id: sessionInfo.sessionId,
        validation_hash: validationHash,
        is_valid: true
      }])
      .select()
      .single();

    if (completionError) {
      if (completionError.code === '23505') { // Unique constraint violation
        await logTaskValidation(userId, taskId, 'duplicate', 'Duplicate completion attempt', validationData, sessionInfo);
        return { success: false, reason: 'Task already completed' };
      }
      throw completionError;
    }

    // Update user's gem balance
    const { error: updateError } = await supabase.rpc('increment_user_sbt', {
      user_id: userId,
      amount: rewardAmount
    });

    if (!updateError) {
      // Also update last_active
      await supabase
        .from('users')
        .update({ last_active: new Date().toISOString() })
        .eq('id', userId);
    }

    if (updateError) {
      console.error('Error updating user balance:', updateError);
      // Mark task completion as invalid
      await supabase
        .from('task_completions')
        .update({ is_valid: false })
        .eq('id', taskCompletion.id);
      
      return { success: false, reason: 'Failed to update balance' };
    }

    // Update rate limiting
    await updateTaskRateLimit(userId, taskType);

    // Log successful completion
    await logTaskValidation(userId, taskId, 'completed', 'Task completed successfully', validationData, sessionInfo);

    return { success: true, taskCompletion };
  } catch (error) {
    console.error('Error completing task securely:', error);
    return { success: false, reason: 'Internal server error' };
  }
};

// Helper functions
const logTaskValidation = async (
  userId: number,
  taskId: string,
  actionType: string,
  reason?: string,
  validationData: any = {},
  sessionInfo: any = {}
) => {
  try {
    await supabase
      .from('task_validation_logs')
      .insert([{
        user_id: userId,
        task_id: taskId,
        action_type: actionType,
        reason: reason,
        validation_data: validationData,
        ip_address: sessionInfo.ipAddress,
        user_agent: sessionInfo.userAgent,
        session_id: sessionInfo.sessionId
      }]);
  } catch (error) {
    console.error('Error logging task validation:', error);
  }
};

const checkTaskRateLimit = async (userId: number, taskCategory: string): Promise<{ allowed: boolean; reason?: string }> => {
  try {
    const { data: rateLimit, error } = await supabase
      .from('task_rate_limits')
      .select('*')
      .eq('user_id', userId)
      .eq('task_category', taskCategory)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    if (!rateLimit) {
      return { allowed: true };
    }

    const now = new Date();
    const resetTime = new Date(rateLimit.reset_after);

    // Check if rate limit has expired
    if (now > resetTime) {
      return { allowed: true };
    }

    // Check if user is blocked
    if (rateLimit.is_blocked) {
      return { allowed: false, reason: 'User temporarily blocked from task completion' };
    }

    // Check attempt count (max 10 attempts per hour for social tasks)
    const maxAttempts = taskCategory === 'social' ? 10 : 50;
    if (rateLimit.attempts_count >= maxAttempts) {
      return { allowed: false, reason: 'Rate limit exceeded' };
    }

    return { allowed: true };
  } catch (error) {
    console.error('Rate limit check error:', error);
    return { allowed: false, reason: 'Rate limit check failed' };
  }
};

const updateTaskRateLimit = async (userId: number, taskCategory: string) => {
  try {
    const now = new Date();
    const resetAfter = new Date(now.getTime() + 3600000); // 1 hour from now

    // First get current count
    const { data: currentLimit } = await supabase
      .from('task_rate_limits')
      .select('attempts_count')
      .eq('user_id', userId)
      .eq('task_category', taskCategory)
      .single();

    const newAttemptsCount = (currentLimit?.attempts_count || 0) + 1;

    await supabase
      .from('task_rate_limits')
      .upsert({
        user_id: userId,
        task_category: taskCategory,
        attempts_count: newAttemptsCount,
        last_attempt: now.toISOString(),
        reset_after: resetAfter.toISOString(),
        is_blocked: false
      }, { onConflict: 'user_id,task_category' });
  } catch (error) {
    console.error('Error updating rate limit:', error);
  }
};

const generateValidationHash = async (userId: number, taskId: string, validationData: any): Promise<string> => {
  const data = JSON.stringify({ userId, taskId, validationData, timestamp: Date.now() });
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

// Get user's completed tasks
export const getUserCompletedTasks = async (userId: number): Promise<string[]> => {
  try {
    const { data, error } = await supabase
      .from('task_completions')
      .select('task_id')
      .eq('user_id', userId)
      .eq('is_valid', true);

    if (error) throw error;

    return data.map(row => row.task_id);
  } catch (error) {
    console.error('Error fetching completed tasks:', error);
    return [];
  }
};

// Check if user has suspicious task completion patterns
export const checkSuspiciousActivity = async (userId: number): Promise<{ suspicious: boolean; reasons: string[] }> => {
  try {
    const reasons: string[] = [];
    
    // Check for rapid task completions
    const { data: recentCompletions, error: recentError } = await supabase
      .from('task_completions')
      .select('completed_at')
      .eq('user_id', userId)
      .gte('completed_at', new Date(Date.now() - 300000).toISOString()) // Last 5 minutes
      .eq('is_valid', true);

    if (recentError) throw recentError;

    if (recentCompletions && recentCompletions.length > 5) {
      reasons.push('Too many tasks completed in short time');
    }

    // Check validation failures
    const { data: failedValidations, error: failedError } = await supabase
      .from('task_validation_logs')
      .select('id')
      .eq('user_id', userId)
      .eq('action_type', 'validation_failed')
      .gte('timestamp', new Date(Date.now() - 3600000).toISOString()) // Last hour
      .limit(20);

    if (failedError) throw failedError;

    if (failedValidations && failedValidations.length > 10) {
      reasons.push('High number of validation failures');
    }

    return { suspicious: reasons.length > 0, reasons };
  } catch (error) {
    console.error('Error checking suspicious activity:', error);
    return { suspicious: false, reasons: [] };
  }
};

export default {
  runMigrations,
  saveGameData,
  loadGameData,
  unlockAchievement,
  getUserAchievements,
  claimDailyReward,
  getDailyRewardHistory,
  trackReferral,
  getReferralStats,
  completeTaskSecurely,
  getUserCompletedTasks,
  checkSuspiciousActivity
}; 