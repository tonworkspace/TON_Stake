import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import useAuth from '@/hooks/useAuth';

interface OrderRecord {
  id: number;
  user_id: number;
  wallet_address: string;
  claim_amount: number;
  claimed_at: string;
  telegram_id?: number;
  telegram_username?: string;
  telegram_first_name?: string;
  telegram_last_name?: string;
  portfolio_value?: number;
  approval_status: string;
  payment_status: string;
  approved_by?: number;
  approved_at?: string;
  rejection_reason?: string;
  payment_tx_hash?: string;
  payment_amount?: number;
  payment_processed_at?: string;
  admin_notes?: string;
  user_username?: string;
  ton_balance?: number;
  stk_amount?: number;
  stkn_balance?: number;
  total_stk_mining?: number;
  nft_token_id?: string;
}

const OrderAdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const [pendingOrders, setPendingOrders] = useState<OrderRecord[]>([]);
  const [approvedOrders, setApprovedOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'pending' | 'approved'>('pending');
  const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [txHash, setTxHash] = useState('');

  const fetchPendingOrders = async () => {
    setLoading(true);
    try {
      // First try the view, if it doesn't exist, query the table directly
      let query = supabase
        .from('faucet_claims')
        .select('*')
        .eq('approval_status', 'pending')
        .order('claimed_at', { ascending: true });

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching pending orders:', error);
        // Fallback: try without the view
        const fallbackQuery = supabase
          .from('faucet_claims')
          .select('*')
          .eq('approval_status', 'pending')
          .order('claimed_at', { ascending: true });
        
        const { data: fallbackData, error: fallbackError } = await fallbackQuery;
        if (fallbackError) {
          throw fallbackError;
        }
        setPendingOrders(fallbackData || []);
      } else {
        setPendingOrders(data || []);
      }
    } catch (error) {
      console.error('Error fetching pending orders:', error);
      setPendingOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchApprovedOrders = async () => {
    setLoading(true);
    try {
      // Query approved orders from the main table
      const { data, error } = await supabase
        .from('faucet_claims')
        .select('*')
        .eq('approval_status', 'approved')
        .order('approved_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching approved orders:', error);
        throw error;
      }
      
      setApprovedOrders(data || []);
    } catch (error) {
      console.error('Error fetching approved orders:', error);
      setApprovedOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const approveOrder = async (orderId: number) => {
    if (!user) return;
    
    try {
      // Try RPC function first, fallback to direct update
      try {
        const { data, error } = await supabase.rpc('approve_faucet_order', {
          p_order_id: orderId,
          p_approved_by: user.id,
          p_admin_notes: adminNotes || null
        });

        if (error) throw error;
        console.log('Order approved via RPC:', data);
      } catch (rpcError) {
        console.log('RPC function not available, using direct update');
        
        // Direct update fallback
        const { data, error } = await supabase
          .from('faucet_claims')
          .update({
            approval_status: 'approved',
            approved_by: user.id,
            approved_at: new Date().toISOString(),
            admin_notes: adminNotes || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', orderId)
          .select();

        if (error) throw error;
        console.log('Order approved via direct update:', data);
      }
      
      await fetchPendingOrders();
      setSelectedOrder(null);
      setAdminNotes('');
      alert('✅ Order approved successfully!');
    } catch (error) {
      console.error('Error approving order:', error);
      alert('❌ Error approving order: ' + (error as Error).message);
    }
  };

  const rejectOrder = async (orderId: number) => {
    if (!user || !rejectionReason) return;
    
    try {
      // Get the order details first to get user_id
      const { data: orderData, error: orderError } = await supabase
        .from('faucet_claims')
        .select('user_id')
        .eq('id', orderId)
        .single();

      if (orderError) throw orderError;

      // Try using the new database function first
      try {
        const { data, error } = await supabase.rpc('reject_faucet_order_with_reset', {
          p_order_id: orderId,
          p_rejection_reason: rejectionReason
        });

        if (error) throw error;
        console.log('Order rejected via function:', data);
      } catch (rpcError) {
        console.log('Function not available, using manual rejection');
        
        // Manual rejection fallback
        const { data, error } = await supabase
          .from('faucet_claims')
          .update({
            approval_status: 'rejected',
            approved_by: user.id,
            approved_at: new Date().toISOString(),
            rejection_reason: rejectionReason,
            admin_notes: adminNotes || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', orderId)
          .select();

        if (error) throw error;
        console.log('Order rejected via direct update:', data);

        // Reset user's claim eligibility so they can try again
        const { error: resetError } = await supabase
          .from('users')
          .update({
            last_faucet_claim: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', orderData.user_id);

        if (resetError) {
          console.warn('Failed to reset user claim eligibility:', resetError);
        }
      }
      
      await fetchPendingOrders();
      setSelectedOrder(null);
      setRejectionReason('');
      setAdminNotes('');
      alert('❌ Order rejected successfully!\n\n✅ User can now submit a new claim.');
    } catch (error) {
      console.error('Error rejecting order:', error);
      alert('❌ Error rejecting order: ' + (error as Error).message);
    }
  };

  const updatePaymentStatus = async (orderId: number, status: string, txHash?: string) => {
    try {
      // Try RPC function first, fallback to direct update
      try {
        const { data, error } = await supabase.rpc('update_payment_status', {
          p_order_id: orderId,
          p_payment_status: status,
          p_payment_tx_hash: txHash || null,
          p_admin_notes: adminNotes || null
        });

        if (error) throw error;
        console.log('Payment status updated via RPC:', data);
      } catch (rpcError) {
        console.log('RPC function not available, using direct update');
        
        // Direct update fallback
        const updateData: any = {
          payment_status: status,
          admin_notes: adminNotes || null,
          updated_at: new Date().toISOString()
        };

        if (txHash) {
          updateData.payment_tx_hash = txHash;
        }

        if (status === 'completed') {
          updateData.payment_processed_at = new Date().toISOString();
        }

        const { data, error } = await supabase
          .from('faucet_claims')
          .update(updateData)
          .eq('id', orderId)
          .select();

        if (error) throw error;
        console.log('Payment status updated via direct update:', data);
      }
      
      await fetchApprovedOrders();
      setSelectedOrder(null);
      setAdminNotes('');
      alert('✅ Payment status updated successfully!');
    } catch (error) {
      console.error('Error updating payment status:', error);
      alert('❌ Error updating payment status: ' + (error as Error).message);
    }
  };

  const deleteOrder = async (orderId: number, userId: number) => {
    if (!user) return;
    
    const confirmed = window.confirm(
      '⚠️ Are you sure you want to DELETE this order?\n\n' +
      'This will:\n' +
      '• Remove the order from the database\n' +
      '• Allow the user to submit a new claim\n' +
      '• Reset their claim eligibility\n\n' +
      'This action cannot be undone!'
    );

    if (!confirmed) return;

    try {
      // Try using the database function first
      try {
        const { data, error } = await supabase.rpc('delete_faucet_order', {
          p_order_id: orderId
        });

        if (error) throw error;
        console.log('Order deleted via function:', data);
      } catch (rpcError) {
        console.log('Function not available, using manual deletion');
        
        // Manual deletion fallback
        const { error: deleteError } = await supabase
          .from('faucet_claims')
          .delete()
          .eq('id', orderId);

        if (deleteError) throw deleteError;

        // Reset user's claim eligibility
        const { error: resetError } = await supabase
          .from('users')
          .update({
            last_faucet_claim: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', userId);

        if (resetError) {
          console.warn('Failed to reset user claim eligibility:', resetError);
        }
      }

      console.log('Order deleted successfully:', orderId);
      
      // Refresh the appropriate tab
      if (activeTab === 'pending') {
        await fetchPendingOrders();
      } else {
        await fetchApprovedOrders();
      }
      
      setSelectedOrder(null);
      setAdminNotes('');
      alert('🗑️ Order deleted successfully!\n\n✅ User can now submit a new claim.');
    } catch (error) {
      console.error('Error deleting order:', error);
      alert('❌ Error deleting order: ' + (error as Error).message);
    }
  };

  useEffect(() => {
    if (activeTab === 'pending') {
      fetchPendingOrders();
    } else {
      fetchApprovedOrders();
    }
  }, [activeTab]);

  const formatWalletAddress = (address: string) => {
    return `${address.substring(0, 8)}...${address.substring(-6)}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-3xl font-bold text-white mb-2">🔧 Order Admin Dashboard</h2>
            <p className="text-gray-300">
              Manage faucet claim approvals and payment processing
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => activeTab === 'pending' ? fetchPendingOrders() : fetchApprovedOrders()}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  Loading...
                </>
              ) : (
                <>
                  🔄 Refresh
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="mb-6">
        <div className="flex bg-gray-800/50 rounded-lg p-1 border border-gray-600">
          <button
            onClick={() => setActiveTab('pending')}
            className={`flex-1 py-3 px-4 rounded-md text-sm font-medium transition-all ${
              activeTab === 'pending'
                ? 'bg-yellow-600 text-white shadow-lg'
                : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
            }`}
          >
            ⏳ Pending Approval ({pendingOrders.length})
          </button>
          <button
            onClick={() => setActiveTab('approved')}
            className={`flex-1 py-3 px-4 rounded-md text-sm font-medium transition-all ${
              activeTab === 'approved'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
            }`}
          >
            ✅ Approved Orders ({approvedOrders.length})
          </button>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-gray-900/50 rounded-lg overflow-hidden border border-gray-700">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-800/50">
              <tr>
                <th className="px-4 py-3 text-left text-gray-300 text-sm font-medium">Order</th>
                <th className="px-4 py-3 text-left text-gray-300 text-sm font-medium">Player</th>
                <th className="px-4 py-3 text-left text-gray-300 text-sm font-medium">Amount</th>
                <th className="px-4 py-3 text-left text-gray-300 text-sm font-medium">Portfolio</th>
                <th className="px-4 py-3 text-left text-gray-300 text-sm font-medium">
                  {activeTab === 'pending' ? 'Status' : 'Payment'}
                </th>
                <th className="px-4 py-3 text-left text-gray-300 text-sm font-medium">Date</th>
                <th className="px-4 py-3 text-left text-gray-300 text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {(activeTab === 'pending' ? pendingOrders : approvedOrders).map((order) => (
                <tr key={order.id} className="hover:bg-gray-800/30">
                  <td className="px-4 py-3">
                    <span className="text-green-400 font-mono text-sm">#{order.id}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm">
                      <div className="text-white font-medium">
                        {order.telegram_first_name} {order.telegram_last_name}
                      </div>
                      <div className="text-blue-400 text-xs">
                        @{order.telegram_username || 'N/A'}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-yellow-400 font-bold">
                      {order.claim_amount.toLocaleString()} STK
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-cyan-400">
                      ${order.portfolio_value?.toLocaleString() || 'N/A'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {activeTab === 'pending' ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-900/30 text-yellow-300 border border-yellow-500/50">
                        ⏳ Pending
                      </span>
                    ) : (
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${
                        order.payment_status === 'pending' ? 'bg-blue-900/30 text-blue-300 border-blue-500/50' :
                        order.payment_status === 'processing' ? 'bg-purple-900/30 text-purple-300 border-purple-500/50' :
                        order.payment_status === 'completed' ? 'bg-green-900/30 text-green-300 border-green-500/50' :
                        'bg-red-900/30 text-red-300 border-red-500/50'
                      }`}>
                        {order.payment_status === 'pending' ? '⏳ Pending' :
                         order.payment_status === 'processing' ? '🔄 Processing' :
                         order.payment_status === 'completed' ? '✅ Completed' :
                         '❌ Failed'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-300">
                      {formatDate(order.claimed_at)}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setSelectedOrder(order)}
                      className="px-3 py-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 text-xs rounded border border-blue-500/30 transition-colors"
                    >
                      Manage
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {((activeTab === 'pending' ? pendingOrders : approvedOrders).length === 0) && !loading && (
          <div className="p-8 text-center text-gray-400">
            <p>📭 No {activeTab} orders found</p>
          </div>
        )}
      </div>

      {/* Order Management Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-white mb-4">
              Manage Order #{selectedOrder.id}
            </h3>
            
            <div className="space-y-4">
              {/* Order Details */}
              <div className="p-4 bg-gray-800/30 rounded-lg">
                <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                  📋 Order Details
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Order ID:</span>
                      <span className="text-green-400 font-mono">#{selectedOrder.id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Player:</span>
                      <span className="text-white">{selectedOrder.telegram_first_name} {selectedOrder.telegram_last_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Telegram:</span>
                      <span className="text-blue-400">@{selectedOrder.telegram_username || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Amount:</span>
                      <span className="text-yellow-400 font-bold">{selectedOrder.claim_amount.toLocaleString()} STK</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Portfolio:</span>
                      <span className="text-cyan-400">${selectedOrder.portfolio_value?.toLocaleString() || 'N/A'}</span>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Wallet:</span>
                      <span className="text-purple-400 font-mono text-xs">{formatWalletAddress(selectedOrder.wallet_address)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">TON Balance:</span>
                      <span className="text-green-400">{(selectedOrder as any).ton_balance?.toFixed(4) || 'N/A'} TON</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">STK Amount:</span>
                      <span className="text-blue-400">{(selectedOrder as any).stk_amount?.toLocaleString() || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">STKN Balance:</span>
                      <span className="text-purple-400">{(selectedOrder as any).stkn_balance?.toLocaleString() || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Mining Balance:</span>
                      <span className="text-orange-400">{(selectedOrder as any).total_stk_mining?.toLocaleString() || 'N/A'}</span>
                    </div>
                  </div>
                </div>
                
                {(selectedOrder as any).nft_token_id && (
                  <div className="mt-3 pt-3 border-t border-gray-600">
                    <div className="flex justify-between">
                      <span className="text-gray-400">NFT Token ID:</span>
                      <span className="text-orange-400 font-mono">{(selectedOrder as any).nft_token_id}</span>
                    </div>
                  </div>
                )}
                
                <div className="mt-3 pt-3 border-t border-gray-600">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Submitted:</span>
                    <span className="text-gray-300">{formatDate(selectedOrder.claimed_at)}</span>
                  </div>
                  {selectedOrder.approved_at && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Approved:</span>
                      <span className="text-green-300">{formatDate(selectedOrder.approved_at)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Admin Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Admin Notes
                </label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Add notes about this order..."
                />
              </div>

              {/* Actions */}
              {activeTab === 'pending' ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Rejection Reason (if rejecting)
                    </label>
                    <input
                      type="text"
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Reason for rejection..."
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => approveOrder(selectedOrder.id)}
                        className="flex-1 py-2 px-4 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                      >
                        ✅ Approve Order
                      </button>
                      <button
                        onClick={() => rejectOrder(selectedOrder.id)}
                        disabled={!rejectionReason}
                        className="flex-1 py-2 px-4 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
                      >
                        ❌ Reject Order
                      </button>
                    </div>
                    <button
                      onClick={() => deleteOrder(selectedOrder.id, selectedOrder.user_id)}
                      className="w-full py-2 px-4 bg-red-800 hover:bg-red-900 text-white rounded-lg transition-colors border border-red-600"
                    >
                      🗑️ Delete Order (Allow User Retry)
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Transaction Hash (if payment completed)
                    </label>
                    <input
                      type="text"
                      value={txHash}
                      onChange={(e) => setTxHash(e.target.value)}
                      placeholder="Enter blockchain transaction hash..."
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => updatePaymentStatus(selectedOrder.id, 'processing')}
                      className="flex-1 py-2 px-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors text-sm"
                    >
                      🔄 Processing
                    </button>
                    <button
                      onClick={() => updatePaymentStatus(selectedOrder.id, 'completed', txHash)}
                      className="flex-1 py-2 px-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm"
                    >
                      ✅ Completed
                    </button>
                    <button
                      onClick={() => updatePaymentStatus(selectedOrder.id, 'failed')}
                      className="flex-1 py-2 px-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm"
                    >
                      ❌ Failed
                    </button>
                  </div>
                  <button
                    onClick={() => deleteOrder(selectedOrder.id, selectedOrder.user_id)}
                    className="w-full py-2 px-4 bg-red-800 hover:bg-red-900 text-white rounded-lg transition-colors border border-red-600"
                  >
                    🗑️ Delete Order (Allow User Retry)
                  </button>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  onClick={() => {
                    setSelectedOrder(null);
                    setAdminNotes('');
                    setRejectionReason('');
                    setTxHash('');
                  }}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderAdminDashboard;
