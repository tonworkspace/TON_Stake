import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import useAuth from '@/hooks/useAuth';

interface OrderRecord {
  id: number;
  user_id: number;
  wallet_address: string;
  ton_balance: number;
  claim_amount: number;
  claimed_at: string;
  telegram_id?: number;
  telegram_username?: string;
  telegram_first_name?: string;
  telegram_last_name?: string;
  stk_amount?: number;
  stkn_balance?: number;
  total_stk_mining?: number;
  nft_token_id?: string;
  portfolio_value?: number;
  reward_breakdown?: any;
  session_id?: string;
}

const OrderHistory: React.FC = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase
        .from('faucet_claims')
        .select('*')
        .order('claimed_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      
      setOrders(data || []);
    } catch (err) {
      console.error('Error fetching orders:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const formatWalletAddress = (address: string) => {
    return `${address.substring(0, 8)}...${address.substring(-6)}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">📋 Submitted Orders History</h2>
        <p className="text-gray-300 text-sm">
          View all submitted faucet claims with complete player information
        </p>
      </div>

      {/* Controls */}
      <div className="mb-6 flex gap-3">
        <button
          onClick={fetchOrders}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? '🔄 Loading...' : '🔄 Refresh'}
        </button>
        
        <div className="flex-1 text-right text-gray-400 text-sm">
          Total Orders: {orders.length}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
          <p className="text-red-300 text-sm">❌ Error: {error}</p>
        </div>
      )}

      {/* Orders Table */}
      <div className="bg-gray-900/50 rounded-lg overflow-hidden border border-gray-700">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-800/50">
              <tr>
                <th className="px-4 py-3 text-left text-gray-300 text-sm font-medium">Order ID</th>
                <th className="px-4 py-3 text-left text-gray-300 text-sm font-medium">Player Info</th>
                <th className="px-4 py-3 text-left text-gray-300 text-sm font-medium">Wallet</th>
                <th className="px-4 py-3 text-left text-gray-300 text-sm font-medium">Amount</th>
                <th className="px-4 py-3 text-left text-gray-300 text-sm font-medium">Portfolio</th>
                <th className="px-4 py-3 text-left text-gray-300 text-sm font-medium">Submitted</th>
                <th className="px-4 py-3 text-left text-gray-300 text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {orders.map((order) => (
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
                      <div className="text-gray-500 text-xs">
                        ID: {order.telegram_id || 'N/A'}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm">
                      <div className="text-purple-400 font-mono">
                        {formatWalletAddress(order.wallet_address)}
                      </div>
                      <div className="text-gray-500 text-xs">
                        {order.ton_balance.toFixed(4)} TON
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm">
                      <div className="text-yellow-400 font-bold">
                        {order.claim_amount.toLocaleString()} STK
                      </div>
                      <div className="text-gray-500 text-xs">
                        STK: {order.stk_amount?.toLocaleString() || 'N/A'}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm">
                      <div className="text-cyan-400">
                        ${order.portfolio_value?.toLocaleString() || 'N/A'}
                      </div>
                      <div className="text-gray-500 text-xs">
                        STKN: {order.stkn_balance?.toLocaleString() || 'N/A'}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-300">
                      {formatDate(order.claimed_at)}
                    </div>
                    <div className="text-gray-500 text-xs">
                      Session: {order.session_id?.substring(0, 8) || 'N/A'}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => {
                        console.log('📋 FULL ORDER DETAILS:', order);
                        alert(`Order #${order.id} details logged to console`);
                      }}
                      className="px-3 py-1 bg-green-600/20 hover:bg-green-600/30 text-green-300 text-xs rounded border border-green-500/30 transition-colors"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {orders.length === 0 && !loading && (
          <div className="p-8 text-center text-gray-400">
            <p>📭 No orders found</p>
            <p className="text-sm mt-1">Submit a claim to see order history</p>
          </div>
        )}
      </div>

      {/* Summary Stats */}
      {orders.length > 0 && (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 bg-blue-900/20 rounded-lg border border-blue-500/30">
            <div className="text-blue-300 text-sm">Total Orders</div>
            <div className="text-white text-xl font-bold">{orders.length}</div>
          </div>
          <div className="p-4 bg-yellow-900/20 rounded-lg border border-yellow-500/30">
            <div className="text-yellow-300 text-sm">Total Claimed</div>
            <div className="text-white text-xl font-bold">
              {orders.reduce((sum, order) => sum + order.claim_amount, 0).toLocaleString()} STK
            </div>
          </div>
          <div className="p-4 bg-green-900/20 rounded-lg border border-green-500/30">
            <div className="text-green-300 text-sm">Unique Players</div>
            <div className="text-white text-xl font-bold">
              {new Set(orders.map(o => o.telegram_id)).size}
            </div>
          </div>
          <div className="p-4 bg-purple-900/20 rounded-lg border border-purple-500/30">
            <div className="text-purple-300 text-sm">Avg Claim</div>
            <div className="text-white text-xl font-bold">
              {Math.round(orders.reduce((sum, order) => sum + order.claim_amount, 0) / orders.length).toLocaleString()} STK
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderHistory;


