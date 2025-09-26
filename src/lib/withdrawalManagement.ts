import { supabase } from './supabaseClient';

export interface WithdrawalRequest {
  id: number;
  user_id: number;
  telegram_id: string;
  username: string;
  amount: number;
  wallet_amount: number;
  wallet_address: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: string;
  fee_breakdown: {
    reinvest_percentage: number;
    stk_percentage: number;
    total_fee_percentage: number;
  };
}

export interface WithdrawalStats {
  total_pending: number;
  total_processing: number;
  total_completed: number;
  total_failed: number;
  total_amount_pending: number;
  total_amount_completed: number;
}

/**
 * Get all pending withdrawal requests for admin approval
 */
export const getPendingWithdrawals = async (): Promise<WithdrawalRequest[]> => {
  try {
    const { data, error } = await supabase
      .from('withdrawal_management_view')
      .select('*')
      .eq('status', 'pending')
      .order('requested_at', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching pending withdrawals:', error);
    return [];
  }
};

/**
 * Get withdrawal requests by status
 */
export const getWithdrawalsByStatus = async (status: string): Promise<WithdrawalRequest[]> => {
  try {
    const { data, error } = await supabase
      .from('withdrawal_management_view')
      .select('*')
      .eq('status', status)
      .order('requested_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error(`Error fetching ${status} withdrawals:`, error);
    return [];
  }
};

/**
 * Approve a withdrawal request (move to processing)
 */
export const approveWithdrawal = async (
  withdrawalId: number,
  adminUserId?: number,
  notes?: string
): Promise<boolean> => {
  try {
    const { data, error } = await supabase.rpc('update_withdrawal_status', {
      p_withdrawal_id: withdrawalId,
      p_status: 'processing',
      p_processing_notes: notes || 'Withdrawal approved and processing',
      p_processed_by: adminUserId || null
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error approving withdrawal:', error);
    return false;
  }
};

/**
 * Complete a withdrawal (after TON transaction is sent)
 */
export const completeWithdrawal = async (
  withdrawalId: number,
  transactionHash: string,
  adminUserId?: number,
  notes?: string
): Promise<boolean> => {
  try {
    const { data, error } = await supabase.rpc('update_withdrawal_status', {
      p_withdrawal_id: withdrawalId,
      p_status: 'completed',
      p_transaction_hash: transactionHash,
      p_processing_notes: notes || 'Withdrawal completed successfully',
      p_processed_by: adminUserId || null
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error completing withdrawal:', error);
    return false;
  }
};

/**
 * Reject a withdrawal (auto-refunds user)
 */
export const rejectWithdrawal = async (
  withdrawalId: number,
  reason: string,
  adminUserId?: number
): Promise<boolean> => {
  try {
    const { data, error } = await supabase.rpc('update_withdrawal_status', {
      p_withdrawal_id: withdrawalId,
      p_status: 'failed',
      p_processing_notes: reason,
      p_processed_by: adminUserId || null
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error rejecting withdrawal:', error);
    return false;
  }
};

/**
 * Get withdrawal statistics
 */
export const getWithdrawalStats = async (): Promise<WithdrawalStats> => {
  try {
    const { data, error } = await supabase.rpc('get_withdrawal_stats');

    if (error) throw error;
    return data || {
      total_pending: 0,
      total_processing: 0,
      total_completed: 0,
      total_failed: 0,
      total_amount_pending: 0,
      total_amount_completed: 0
    };
  } catch (error) {
    console.error('Error fetching withdrawal stats:', error);
    return {
      total_pending: 0,
      total_processing: 0,
      total_completed: 0,
      total_failed: 0,
      total_amount_pending: 0,
      total_amount_completed: 0
    };
  }
};

/**
 * Get withdrawal details by ID
 */
export const getWithdrawalById = async (withdrawalId: number): Promise<WithdrawalRequest | null> => {
  try {
    const { data, error } = await supabase
      .from('withdrawal_management_view')
      .select('*')
      .eq('id', withdrawalId)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching withdrawal details:', error);
    return null;
  }
};

/**
 * Batch approve multiple withdrawals
 */
export const batchApproveWithdrawals = async (
  withdrawalIds: number[],
  adminUserId?: number,
  notes?: string
): Promise<{ success: number[]; failed: number[] }> => {
  const success: number[] = [];
  const failed: number[] = [];

  for (const id of withdrawalIds) {
    const result = await approveWithdrawal(id, adminUserId, notes);
    if (result) {
      success.push(id);
    } else {
      failed.push(id);
    }
  }

  return { success, failed };
};

/**
 * Validate TON wallet address format
 */
export const validateTonWalletAddress = (address: string): boolean => {
  // Basic TON address validation
  const tonAddressRegex = /^[A-Za-z0-9_-]{48}$/;
  return tonAddressRegex.test(address);
};

/**
 * Get withdrawals for a specific user
 */
export const getUserWithdrawals = async (telegramId: string): Promise<WithdrawalRequest[]> => {
  try {
    const { data, error } = await supabase
      .from('withdrawal_management_view')
      .select('*')
      .eq('telegram_id', telegramId)
      .order('requested_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching user withdrawals:', error);
    return [];
  }
};




