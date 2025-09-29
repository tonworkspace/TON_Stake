import React, { useState, useEffect } from 'react';
import TokenReceiver from './TokenReceiver';
import FaucetApi from '@/lib/faucetApi';
import useAuth from '@/hooks/useAuth';

interface FaucetStats {
  total_claims: number;
  total_tokens_distributed: number;
  unique_users: number;
  average_claim_amount: number;
  last_claim_time: string;
}

const FaucetPage: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<FaucetStats | null>(null);
  const [userHistory, setUserHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load faucet statistics
  useEffect(() => {
    const loadStats = async () => {
      try {
        const [statsData, historyData] = await Promise.all([
          FaucetApi.getStats(),
          user ? FaucetApi.getUserHistory(user.id, 5) : Promise.resolve([])
        ]);
        
        setStats(statsData);
        setUserHistory(historyData);
      } catch (error) {
        console.error('Error loading faucet data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadStats();
  }, [user]);

  const handleClaimSuccess = (amount: number) => {
    console.log(`Successfully claimed ${amount} STK tokens`);
    // Refresh stats and history
    if (user) {
      FaucetApi.getUserHistory(user.id, 5).then(setUserHistory);
      FaucetApi.getStats().then(setStats);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-white border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 py-8">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">
            🪙 Token Faucet
          </h1>
          <p className="text-gray-300 text-lg max-w-2xl mx-auto">
            Claim STK tokens based on your TON wallet balance. The more TON you hold, 
            the more STK tokens you can claim!
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Faucet Component */}
          <div className="lg:col-span-2">
            <TokenReceiver 
              onClaimSuccess={handleClaimSuccess}
              className="w-full"
            />
          </div>

          {/* Sidebar with Stats and History */}
          <div className="space-y-6">
            {/* Faucet Statistics */}
            {stats && (
              <div className="bg-gray-800/30 rounded-xl p-6 border border-gray-700">
                <h3 className="text-xl font-bold text-white mb-4">📊 Faucet Statistics</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-300">Total Claims:</span>
                    <span className="text-green-400 font-mono">{stats.total_claims.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Tokens Distributed:</span>
                    <span className="text-purple-400 font-mono">{stats.total_tokens_distributed.toLocaleString()} STK</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Unique Users:</span>
                    <span className="text-blue-400 font-mono">{stats.unique_users.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Average Claim:</span>
                    <span className="text-yellow-400 font-mono">{stats.average_claim_amount.toFixed(2)} STK</span>
                  </div>
                  {stats.last_claim_time && (
                    <div className="flex justify-between">
                      <span className="text-gray-300">Last Claim:</span>
                      <span className="text-gray-400 text-sm">
                        {new Date(stats.last_claim_time).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* User History */}
            {user && userHistory.length > 0 && (
              <div className="bg-gray-800/30 rounded-xl p-6 border border-gray-700">
                <h3 className="text-xl font-bold text-white mb-4">📝 Your Claim History</h3>
                <div className="space-y-3">
                  {userHistory.map((claim, index) => (
                    <div key={claim.claim_id} className="flex justify-between items-center p-3 bg-gray-700/30 rounded-lg">
                      <div>
                        <div className="text-sm text-gray-300">
                          {new Date(claim.claimed_at).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-gray-400">
                          {claim.ton_balance} TON → {claim.claim_amount} STK
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-green-400 font-mono text-sm">
                          +{claim.claim_amount} STK
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* How It Works */}
            <div className="bg-gray-800/30 rounded-xl p-6 border border-gray-700">
              <h3 className="text-xl font-bold text-white mb-4">❓ How It Works</h3>
              <div className="space-y-3 text-sm text-gray-300">
                <div className="flex items-start gap-2">
                  <span className="text-purple-400">1.</span>
                  <span>Enter your TON wallet address</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-purple-400">2.</span>
                  <span>We check your TON balance</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-purple-400">3.</span>
                  <span>Calculate STK tokens based on your balance</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-purple-400">4.</span>
                  <span>Claim your tokens (24h cooldown)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FaucetPage;
