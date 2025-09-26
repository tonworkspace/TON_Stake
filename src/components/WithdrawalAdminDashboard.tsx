import React, { useState, useEffect } from 'react';
import {
  getPendingWithdrawals,
  getWithdrawalsByStatus,
  approveWithdrawal,
  completeWithdrawal,
  rejectWithdrawal,
  getWithdrawalStats,
  getWithdrawalById,
  batchApproveWithdrawals,
  WithdrawalRequest,
  WithdrawalStats
} from '../lib/withdrawalManagement';

interface WithdrawalAdminDashboardProps {
  adminUserId?: number;
}

export const WithdrawalAdminDashboard: React.FC<WithdrawalAdminDashboardProps> = ({ adminUserId }) => {
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [stats, setStats] = useState<WithdrawalStats | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>('pending');
  const [loading, setLoading] = useState(false);
  const [selectedWithdrawals, setSelectedWithdrawals] = useState<number[]>([]);
  const [showBatchActions, setShowBatchActions] = useState(false);
  const [transactionHash, setTransactionHash] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [notes, setNotes] = useState('');

  // Load withdrawals and stats on component mount
  useEffect(() => {
    loadWithdrawals();
    loadStats();
  }, [selectedStatus]);

  const loadWithdrawals = async () => {
    setLoading(true);
    try {
      const data = await getWithdrawalsByStatus(selectedStatus);
      setWithdrawals(data);
    } catch (error) {
      console.error('Error loading withdrawals:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const data = await getWithdrawalStats();
      setStats(data);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleApprove = async (withdrawalId: number) => {
    try {
      const success = await approveWithdrawal(withdrawalId, adminUserId, notes);
      if (success) {
        alert('Withdrawal approved successfully');
        loadWithdrawals();
        loadStats();
      } else {
        alert('Failed to approve withdrawal');
      }
    } catch (error) {
      console.error('Error approving withdrawal:', error);
      alert('Error approving withdrawal');
    }
  };

  const handleComplete = async (withdrawalId: number) => {
    if (!transactionHash.trim()) {
      alert('Please enter transaction hash');
      return;
    }

    try {
      const success = await completeWithdrawal(withdrawalId, transactionHash, adminUserId, notes);
      if (success) {
        alert('Withdrawal completed successfully');
        setTransactionHash('');
        loadWithdrawals();
        loadStats();
      } else {
        alert('Failed to complete withdrawal');
      }
    } catch (error) {
      console.error('Error completing withdrawal:', error);
      alert('Error completing withdrawal');
    }
  };

  const handleReject = async (withdrawalId: number) => {
    if (!rejectionReason.trim()) {
      alert('Please enter rejection reason');
      return;
    }

    try {
      const success = await rejectWithdrawal(withdrawalId, rejectionReason, adminUserId);
      if (success) {
        alert('Withdrawal rejected and user refunded');
        setRejectionReason('');
        loadWithdrawals();
        loadStats();
      } else {
        alert('Failed to reject withdrawal');
      }
    } catch (error) {
      console.error('Error rejecting withdrawal:', error);
      alert('Error rejecting withdrawal');
    }
  };

  const handleBatchApprove = async () => {
    if (selectedWithdrawals.length === 0) {
      alert('Please select withdrawals to approve');
      return;
    }

    try {
      const result = await batchApproveWithdrawals(selectedWithdrawals, adminUserId, notes);
      alert(`Approved ${result.success.length} withdrawals, ${result.failed.length} failed`);
      setSelectedWithdrawals([]);
      setShowBatchActions(false);
      loadWithdrawals();
      loadStats();
    } catch (error) {
      console.error('Error batch approving:', error);
      alert('Error batch approving withdrawals');
    }
  };

  const toggleWithdrawalSelection = (withdrawalId: number) => {
    setSelectedWithdrawals(prev => 
      prev.includes(withdrawalId) 
        ? prev.filter(id => id !== withdrawalId)
        : [...prev, withdrawalId]
    );
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      case 'processing': return 'text-blue-600 bg-blue-100';
      case 'completed': return 'text-green-600 bg-green-100';
      case 'failed': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Withdrawal Management Dashboard</h1>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500">Pending</h3>
            <p className="text-2xl font-bold text-yellow-600">{stats.total_pending}</p>
            <p className="text-sm text-gray-500">{formatAmount(stats.total_amount_pending)}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500">Processing</h3>
            <p className="text-2xl font-bold text-blue-600">{stats.total_processing}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500">Completed</h3>
            <p className="text-2xl font-bold text-green-600">{stats.total_completed}</p>
            <p className="text-sm text-gray-500">{formatAmount(stats.total_amount_completed)}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500">Failed</h3>
            <p className="text-2xl font-bold text-red-600">{stats.total_failed}</p>
          </div>
        </div>
      )}

      {/* Status Filter */}
      <div className="mb-4">
        <div className="flex space-x-2">
          {['pending', 'processing', 'completed', 'failed'].map(status => (
            <button
              key={status}
              onClick={() => setSelectedStatus(status)}
              className={`px-4 py-2 rounded-lg font-medium ${
                selectedStatus === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Batch Actions */}
      {selectedStatus === 'pending' && (
        <div className="mb-4">
          <button
            onClick={() => setShowBatchActions(!showBatchActions)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Batch Actions ({selectedWithdrawals.length} selected)
          </button>
          
          {showBatchActions && (
            <div className="mt-2 p-4 bg-gray-50 rounded-lg">
              <div className="flex space-x-2">
                <button
                  onClick={handleBatchApprove}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Approve Selected
                </button>
                <input
                  type="text"
                  placeholder="Notes (optional)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="px-3 py-2 border rounded-lg flex-1"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Withdrawals Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {selectedStatus === 'pending' && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Select
                  </th>
                )}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Wallet Address
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Requested
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center">
                    Loading...
                  </td>
                </tr>
              ) : withdrawals.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                    No {selectedStatus} withdrawals found
                  </td>
                </tr>
              ) : (
                withdrawals.map((withdrawal) => (
                  <tr key={withdrawal.id} className="hover:bg-gray-50">
                    {selectedStatus === 'pending' && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedWithdrawals.includes(withdrawal.id)}
                          onChange={() => toggleWithdrawalSelection(withdrawal.id)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {withdrawal.username || 'Unknown'}
                        </div>
                        <div className="text-sm text-gray-500">
                          ID: {withdrawal.telegram_id}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {formatAmount(withdrawal.wallet_amount)}
                        </div>
                        <div className="text-sm text-gray-500">
                          Total: {formatAmount(withdrawal.amount)}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 font-mono">
                        {withdrawal.wallet_address}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(withdrawal.status)}`}>
                        {withdrawal.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(withdrawal.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {withdrawal.status === 'pending' && (
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleApprove(withdrawal.id)}
                            className="text-green-600 hover:text-green-900"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleReject(withdrawal.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                      {withdrawal.status === 'processing' && (
                        <div className="flex space-x-2">
                          <input
                            type="text"
                            placeholder="Transaction Hash"
                            value={transactionHash}
                            onChange={(e) => setTransactionHash(e.target.value)}
                            className="px-2 py-1 border rounded text-sm"
                          />
                          <button
                            onClick={() => handleComplete(withdrawal.id)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            Complete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rejection Modal */}
      {rejectionReason && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-medium mb-4">Reject Withdrawal</h3>
            <textarea
              placeholder="Enter rejection reason..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full p-3 border rounded-lg mb-4"
              rows={3}
            />
            <div className="flex space-x-2">
              <button
                onClick={() => setRejectionReason('')}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  // This would be handled by the individual withdrawal row
                  setRejectionReason('');
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};




