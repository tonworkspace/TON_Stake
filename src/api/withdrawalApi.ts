import { Request, Response } from 'express';
import {
  getPendingWithdrawals,
  getWithdrawalsByStatus,
  approveWithdrawal,
  completeWithdrawal,
  rejectWithdrawal,
  getWithdrawalStats,
  getWithdrawalById,
  batchApproveWithdrawals,
  getUserWithdrawals,
  validateTonWalletAddress
} from '../lib/withdrawalManagement';

/**
 * GET /api/withdrawals/pending
 * Get all pending withdrawal requests
 */
export const getPendingWithdrawalsHandler = async (req: Request, res: Response) => {
  try {
    const withdrawals = await getPendingWithdrawals();
    res.json({
      success: true,
      data: withdrawals,
      count: withdrawals.length
    });
  } catch (error) {
    console.error('Error fetching pending withdrawals:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pending withdrawals'
    });
  }
};

/**
 * GET /api/withdrawals/status/:status
 * Get withdrawals by status (pending, processing, completed, failed)
 */
export const getWithdrawalsByStatusHandler = async (req: Request, res: Response) => {
  try {
    const { status } = req.params;
    const validStatuses = ['pending', 'processing', 'completed', 'failed'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status. Must be one of: pending, processing, completed, failed'
      });
    }

    const withdrawals = await getWithdrawalsByStatus(status);
    res.json({
      success: true,
      data: withdrawals,
      count: withdrawals.length
    });
  } catch (error) {
    console.error('Error fetching withdrawals by status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch withdrawals'
    });
  }
};

/**
 * POST /api/withdrawals/:id/approve
 * Approve a withdrawal request
 */
export const approveWithdrawalHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { adminUserId, notes } = req.body;

    const withdrawalId = parseInt(id);
    if (isNaN(withdrawalId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid withdrawal ID'
      });
    }

    // Get withdrawal details first to validate
    const withdrawal = await getWithdrawalById(withdrawalId);
    if (!withdrawal) {
      return res.status(404).json({
        success: false,
        error: 'Withdrawal not found'
      });
    }

    if (withdrawal.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: `Withdrawal is already ${withdrawal.status}`
      });
    }

    // Validate wallet address
    if (!validateTonWalletAddress(withdrawal.wallet_address)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid TON wallet address format'
      });
    }

    const success = await approveWithdrawal(withdrawalId, adminUserId, notes);
    
    if (success) {
      res.json({
        success: true,
        message: 'Withdrawal approved successfully',
        data: { withdrawalId, status: 'processing' }
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to approve withdrawal'
      });
    }
  } catch (error) {
    console.error('Error approving withdrawal:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to approve withdrawal'
    });
  }
};

/**
 * POST /api/withdrawals/:id/complete
 * Complete a withdrawal (after TON transaction)
 */
export const completeWithdrawalHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { transactionHash, adminUserId, notes } = req.body;

    const withdrawalId = parseInt(id);
    if (isNaN(withdrawalId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid withdrawal ID'
      });
    }

    if (!transactionHash || transactionHash.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Transaction hash is required'
      });
    }

    // Get withdrawal details first to validate
    const withdrawal = await getWithdrawalById(withdrawalId);
    if (!withdrawal) {
      return res.status(404).json({
        success: false,
        error: 'Withdrawal not found'
      });
    }

    if (withdrawal.status !== 'processing') {
      return res.status(400).json({
        success: false,
        error: `Withdrawal must be in processing status, currently ${withdrawal.status}`
      });
    }

    const success = await completeWithdrawal(withdrawalId, transactionHash, adminUserId, notes);
    
    if (success) {
      res.json({
        success: true,
        message: 'Withdrawal completed successfully',
        data: { withdrawalId, status: 'completed', transactionHash }
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to complete withdrawal'
      });
    }
  } catch (error) {
    console.error('Error completing withdrawal:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to complete withdrawal'
    });
  }
};

/**
 * POST /api/withdrawals/:id/reject
 * Reject a withdrawal (auto-refunds user)
 */
export const rejectWithdrawalHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason, adminUserId } = req.body;

    const withdrawalId = parseInt(id);
    if (isNaN(withdrawalId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid withdrawal ID'
      });
    }

    if (!reason || reason.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Rejection reason is required'
      });
    }

    // Get withdrawal details first to validate
    const withdrawal = await getWithdrawalById(withdrawalId);
    if (!withdrawal) {
      return res.status(404).json({
        success: false,
        error: 'Withdrawal not found'
      });
    }

    if (withdrawal.status === 'completed') {
      return res.status(400).json({
        success: false,
        error: 'Cannot reject a completed withdrawal'
      });
    }

    const success = await rejectWithdrawal(withdrawalId, reason, adminUserId);
    
    if (success) {
      res.json({
        success: true,
        message: 'Withdrawal rejected and user refunded',
        data: { withdrawalId, status: 'failed', reason }
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to reject withdrawal'
      });
    }
  } catch (error) {
    console.error('Error rejecting withdrawal:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reject withdrawal'
    });
  }
};

/**
 * GET /api/withdrawals/stats
 * Get withdrawal statistics
 */
export const getWithdrawalStatsHandler = async (req: Request, res: Response) => {
  try {
    const stats = await getWithdrawalStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching withdrawal stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch withdrawal statistics'
    });
  }
};

/**
 * GET /api/withdrawals/:id
 * Get withdrawal details by ID
 */
export const getWithdrawalByIdHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const withdrawalId = parseInt(id);
    
    if (isNaN(withdrawalId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid withdrawal ID'
      });
    }

    const withdrawal = await getWithdrawalById(withdrawalId);
    
    if (!withdrawal) {
      return res.status(404).json({
        success: false,
        error: 'Withdrawal not found'
      });
    }

    res.json({
      success: true,
      data: withdrawal
    });
  } catch (error) {
    console.error('Error fetching withdrawal details:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch withdrawal details'
    });
  }
};

/**
 * POST /api/withdrawals/batch-approve
 * Batch approve multiple withdrawals
 */
export const batchApproveWithdrawalsHandler = async (req: Request, res: Response) => {
  try {
    const { withdrawalIds, adminUserId, notes } = req.body;

    if (!Array.isArray(withdrawalIds) || withdrawalIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'withdrawalIds must be a non-empty array'
      });
    }

    if (withdrawalIds.length > 50) {
      return res.status(400).json({
        success: false,
        error: 'Cannot approve more than 50 withdrawals at once'
      });
    }

    const result = await batchApproveWithdrawals(withdrawalIds, adminUserId, notes);
    
    res.json({
      success: true,
      message: `Processed ${withdrawalIds.length} withdrawals`,
      data: {
        successful: result.success,
        failed: result.failed,
        successCount: result.success.length,
        failureCount: result.failed.length
      }
    });
  } catch (error) {
    console.error('Error batch approving withdrawals:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to batch approve withdrawals'
    });
  }
};

/**
 * GET /api/withdrawals/user/:telegramId
 * Get withdrawals for a specific user
 */
export const getUserWithdrawalsHandler = async (req: Request, res: Response) => {
  try {
    const { telegramId } = req.params;
    
    if (!telegramId || telegramId.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Telegram ID is required'
      });
    }

    const withdrawals = await getUserWithdrawals(telegramId);
    
    res.json({
      success: true,
      data: withdrawals,
      count: withdrawals.length
    });
  } catch (error) {
    console.error('Error fetching user withdrawals:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user withdrawals'
    });
  }
};




