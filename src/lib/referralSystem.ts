import { supabase } from "./supabaseClient";

interface ReferralConfig {
  MAX_LEVEL: number;
  REWARDS: { [key: number]: number };
  VOLUME_TRACKING_DEPTH: number;
  STK_REWARDS: {
    DAILY_PER_REFERRAL: number;
    LEVEL_10_BONUS: number;
    SUB_REFERRAL: number;
  };
}

export const REFERRAL_CONFIG: ReferralConfig = {
  MAX_LEVEL: 5,
  REWARDS: {
    1: 0.10, // 10% for level 1
    2: 0.05, // 5% for level 2
    3: 0.03, // 3% for level 3
    4: 0.02, // 2% for level 4
    5: 0.01  // 1% for level 5
  },
  VOLUME_TRACKING_DEPTH: Infinity,
  STK_REWARDS: {
    DAILY_PER_REFERRAL: 5,    // 5 STK per active referral daily
    LEVEL_10_BONUS: 10,       // 10 STK bonus at level 10
    SUB_REFERRAL: 2          // 2 STK from sub-referrals
  }
};

export const referralSystem = {
  async createReferralChain(userId: number, referrerId: number): Promise<boolean> {
    try {
      // Get upline chain
      const { data: upline } = await supabase
        .from('referral_chain')
        .select('*')
        .eq('user_id', referrerId)
        .order('level', { ascending: true });

      // Create referral relationships
      const relationships = [
        {
          user_id: userId,
          referrer_id: referrerId,
          level: 1
        }
      ];

      // Add upper levels up to max
      if (upline) {
        upline.forEach((ref, index) => {
          if (index + 2 <= REFERRAL_CONFIG.MAX_LEVEL) {
            relationships.push({
              user_id: userId,
              referrer_id: ref.referrer_id,
              level: index + 2
            });
          }
        });
      }

      // Insert all relationships
      await supabase
        .from('referral_chain')
        .insert(relationships);

      return true;
    } catch (error) {
      console.error('Referral chain creation failed:', error);
      return false;
    }
  },

  async processReferralRewards(userId: number, amount: number): Promise<void> {
    try {
      const { data: referrers } = await supabase
        .from('referral_chain')
        .select('referrer_id, level')
        .eq('user_id', userId)
        .lte('level', REFERRAL_CONFIG.MAX_LEVEL);

      if (!referrers?.length) return;

      // Process all rewards in a single transaction
      await supabase.rpc('process_referral_rewards', {
        p_referrers: referrers,
        p_amount: amount,
        p_config: REFERRAL_CONFIG.REWARDS
      });

    } catch (error) {
      console.error('Referral reward processing failed:', error);
    }
  },

  async updateTeamVolume(userId: number, amount: number): Promise<void> {
    try {
      // Get entire upline (no level limit for team volume)
      const { data: upline } = await supabase
        .from('referral_chain')
        .select('referrer_id')
        .eq('user_id', userId);

      if (!upline) return;

      // Update team volume for all upline members
      const updates = upline.map(ref => 
        supabase.rpc('increment_team_volume', { user_id: ref.referrer_id, increment_by: amount })
      );

      await Promise.all(updates);
    } catch (error) {
      console.error('Team volume update failed:', error);
    }
  },

  // New function to process daily STK rewards
  async processDailySTKRewards(userId: number): Promise<void> {
    try {
      // Get active direct referrals
      const { data: activeReferrals } = await supabase
        .from('users')
        .select('id')
        .eq('referrer_id', userId)
        .eq('is_active', true);

      if (!activeReferrals?.length) return;

      const totalSTK = activeReferrals.length * REFERRAL_CONFIG.STK_REWARDS.DAILY_PER_REFERRAL;

      // Update user's STK balance
      await supabase.rpc('add_stk_balance', {
        p_user_id: userId,
        p_amount: totalSTK,
        p_type: 'daily_referral_reward'
      });

      // Log the reward
      await supabase
        .from('referral_earnings')
        .insert({
          user_id: userId,
          amount: totalSTK,
          type: 'daily_stk',
          metadata: {
            active_referrals: activeReferrals.length,
            reward_per_referral: REFERRAL_CONFIG.STK_REWARDS.DAILY_PER_REFERRAL
          }
        });

    } catch (error) {
      console.error('Daily STK reward processing failed:', error);
    }
  },

  // Process level 10 bonus
  async processLevel10Bonus(userId: number, referralId: number): Promise<void> {
    try {
      const { data: referral } = await supabase
        .from('users')
        .select('level')
        .eq('id', referralId)
        .single();

      if (referral?.level === 10) {
        // Award bonus STK
        await supabase.rpc('add_stk_balance', {
          p_user_id: userId,
          p_amount: REFERRAL_CONFIG.STK_REWARDS.LEVEL_10_BONUS,
          p_type: 'level_10_bonus'
        });

        // Log the bonus
        await supabase
          .from('referral_earnings')
          .insert({
            user_id: userId,
            referral_id: referralId,
            amount: REFERRAL_CONFIG.STK_REWARDS.LEVEL_10_BONUS,
            type: 'level_10_bonus'
          });
      }
    } catch (error) {
      console.error('Level 10 bonus processing failed:', error);
    }
  },

  // Process sub-referral rewards
  async processSubReferralReward(userId: number, subReferralId: number): Promise<void> {
    try {
      await supabase.rpc('add_stk_balance', {
        p_user_id: userId,
        p_amount: REFERRAL_CONFIG.STK_REWARDS.SUB_REFERRAL,
        p_type: 'sub_referral_reward'
      });

      // Log the reward
      await supabase
        .from('referral_earnings')
        .insert({
          user_id: userId,
          referral_id: subReferralId,
          amount: REFERRAL_CONFIG.STK_REWARDS.SUB_REFERRAL,
          type: 'sub_referral'
        });
    } catch (error) {
      console.error('Sub-referral reward processing failed:', error);
    }
  }
}; 