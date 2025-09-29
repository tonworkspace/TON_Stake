import { supabase } from './supabaseClient';

export interface FaucetClaim {
  id: number;
  user_id: number;
  wallet_address: string;
  ton_balance: number;
  claim_amount: number;
  claimed_at: string;
  network: string;
}

export interface FaucetStats {
  total_claims: number;
  total_tokens_distributed: number;
  unique_users: number;
  average_claim_amount: number;
  last_claim_time: string;
}

export interface FaucetEligibility {
  is_eligible: boolean;
  last_claim: string | null;
  time_until_next_claim: string | null;
  reason: string;
}

export interface ClaimResult {
  success: boolean;
  new_balance: number;
  message: string;
}

export class FaucetApi {
  /**
   * Check if a user is eligible to claim from the faucet
   */
  static async checkEligibility(userId: number, cooldownHours: number = 24): Promise<FaucetEligibility> {
    try {
      const { data, error } = await supabase.rpc('check_faucet_eligibility', {
        p_user_id: userId,
        p_cooldown_hours: cooldownHours
      });

      if (error) throw error;

      if (data && data.length > 0) {
        return data[0];
      }

      return {
        is_eligible: false,
        last_claim: null,
        time_until_next_claim: null,
        reason: 'Unable to check eligibility'
      };
    } catch (error) {
      console.error('Error checking faucet eligibility:', error);
      return {
        is_eligible: false,
        last_claim: null,
        time_until_next_claim: null,
        reason: 'Error checking eligibility'
      };
    }
  }

  /**
   * Process a faucet claim
   */
  static async processClaim(
    userId: number,
    walletAddress: string,
    tonBalance: number,
    claimAmount: number,
    network: 'mainnet' | 'testnet' = 'mainnet'
  ): Promise<ClaimResult> {
    try {
      const { data, error } = await supabase.rpc('process_faucet_claim', {
        p_user_id: userId,
        p_wallet_address: walletAddress,
        p_ton_balance: tonBalance,
        p_claim_amount: claimAmount,
        p_network: network
      });

      if (error) throw error;

      if (data && data.length > 0) {
        return data[0];
      }

      return {
        success: false,
        new_balance: 0,
        message: 'No result returned'
      };
    } catch (error) {
      console.error('Error processing faucet claim:', error);
      return {
        success: false,
        new_balance: 0,
        message: 'Error processing claim'
      };
    }
  }

  /**
   * Get faucet statistics
   */
  static async getStats(): Promise<FaucetStats | null> {
    try {
      const { data, error } = await supabase.rpc('get_faucet_stats');

      if (error) throw error;

      if (data && data.length > 0) {
        return data[0];
      }

      return null;
    } catch (error) {
      console.error('Error fetching faucet stats:', error);
      return null;
    }
  }

  /**
   * Get user's faucet claim history
   */
  static async getUserHistory(userId: number, limit: number = 10): Promise<FaucetClaim[]> {
    try {
      const { data, error } = await supabase.rpc('get_user_faucet_history', {
        p_user_id: userId,
        p_limit: limit
      });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error fetching user faucet history:', error);
      return [];
    }
  }

  /**
   * Calculate claim amount based on TON balance
   */
  static async calculateClaimAmount(
    tonBalance: number,
    baseAmount: number = 10,
    balanceMultiplier: number = 0.1,
    maxAmount: number = 1000
  ): Promise<number> {
    try {
      const { data, error } = await supabase.rpc('calculate_faucet_amount', {
        p_ton_balance: tonBalance,
        p_base_amount: baseAmount,
        p_balance_multiplier: balanceMultiplier,
        p_max_amount: maxAmount
      });

      if (error) throw error;

      return data || baseAmount;
    } catch (error) {
      console.error('Error calculating claim amount:', error);
      return baseAmount;
    }
  }

  /**
   * Get faucet configuration from database
   */
  static async getConfig(): Promise<{
    baseAmount: number;
    balanceMultiplier: number;
    maxAmount: number;
    minBalance: number;
    cooldownHours: number;
    enabled: boolean;
  }> {
    try {
      const { data, error } = await supabase
        .from('system_config')
        .select('config_key, config_value')
        .in('config_key', [
          'faucet_base_amount',
          'faucet_balance_multiplier',
          'faucet_max_amount',
          'faucet_min_ton_balance',
          'faucet_cooldown_hours',
          'faucet_enabled'
        ]);

      if (error) throw error;

      const config = {
        baseAmount: 10,
        balanceMultiplier: 0.1,
        maxAmount: 1000,
        minBalance: 0.1,
        cooldownHours: 24,
        enabled: true
      };

      if (data) {
        data.forEach(item => {
          switch (item.config_key) {
            case 'faucet_base_amount':
              config.baseAmount = parseFloat(item.config_value);
              break;
            case 'faucet_balance_multiplier':
              config.balanceMultiplier = parseFloat(item.config_value);
              break;
            case 'faucet_max_amount':
              config.maxAmount = parseFloat(item.config_value);
              break;
            case 'faucet_min_ton_balance':
              config.minBalance = parseFloat(item.config_value);
              break;
            case 'faucet_cooldown_hours':
              config.cooldownHours = parseFloat(item.config_value);
              break;
            case 'faucet_enabled':
              config.enabled = item.config_value === 'true';
              break;
          }
        });
      }

      return config;
    } catch (error) {
      console.error('Error fetching faucet config:', error);
      return {
        baseAmount: 10,
        balanceMultiplier: 0.1,
        maxAmount: 1000,
        minBalance: 0.1,
        cooldownHours: 24,
        enabled: true
      };
    }
  }

  /**
   * Update faucet configuration (admin only)
   */
  static async updateConfig(config: {
    baseAmount?: number;
    balanceMultiplier?: number;
    maxAmount?: number;
    minBalance?: number;
    cooldownHours?: number;
    enabled?: boolean;
  }): Promise<boolean> {
    try {
      const updates = [];
      
      if (config.baseAmount !== undefined) {
        updates.push(
          supabase
            .from('system_config')
            .upsert({
              config_key: 'faucet_base_amount',
              config_value: config.baseAmount.toString(),
              description: 'Base STK tokens given regardless of balance'
            })
        );
      }

      if (config.balanceMultiplier !== undefined) {
        updates.push(
          supabase
            .from('system_config')
            .upsert({
              config_key: 'faucet_balance_multiplier',
              config_value: config.balanceMultiplier.toString(),
              description: 'Multiplier for TON balance'
            })
        );
      }

      if (config.maxAmount !== undefined) {
        updates.push(
          supabase
            .from('system_config')
            .upsert({
              config_key: 'faucet_max_amount',
              config_value: config.maxAmount.toString(),
              description: 'Maximum STK tokens per claim'
            })
        );
      }

      if (config.minBalance !== undefined) {
        updates.push(
          supabase
            .from('system_config')
            .upsert({
              config_key: 'faucet_min_ton_balance',
              config_value: config.minBalance.toString(),
              description: 'Minimum TON balance required'
            })
        );
      }

      if (config.cooldownHours !== undefined) {
        updates.push(
          supabase
            .from('system_config')
            .upsert({
              config_key: 'faucet_cooldown_hours',
              config_value: config.cooldownHours.toString(),
              description: 'Hours between claims'
            })
        );
      }

      if (config.enabled !== undefined) {
        updates.push(
          supabase
            .from('system_config')
            .upsert({
              config_key: 'faucet_enabled',
              config_value: config.enabled.toString(),
              description: 'Whether faucet is currently enabled'
            })
        );
      }

      const results = await Promise.all(updates);
      
      return results.every(result => !result.error);
    } catch (error) {
      console.error('Error updating faucet config:', error);
      return false;
    }
  }

  /**
   * Get faucet leaderboard
   */
  static async getLeaderboard(limit: number = 10): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('faucet_leaderboard')
        .select('*')
        .limit(limit);

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error fetching faucet leaderboard:', error);
      return [];
    }
  }
}

export default FaucetApi;
