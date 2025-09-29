import React, { useState, useEffect } from 'react';
import { useTonConnectUI } from '@tonconnect/ui-react';
import { useTonAddress } from '@tonconnect/ui-react';
import { Address, isValidAddress } from '@ton/core';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { showSnackbar } from '@/lib/supabaseClient';
import FaucetApi from '@/lib/faucetApi';
import { defaultTonFetcher, TonBalanceResult } from '@/lib/tonBalanceFetcher';

interface TokenReceiverProps {
  onClaimSuccess?: (amount: number) => void;
  className?: string;
}

interface FaucetConfig {
  COOLDOWN_HOURS: number;
  BASE_AMOUNT: number;
  BALANCE_MULTIPLIER: number;
  MAX_CLAIM: number;
  MIN_BALANCE: number;
}

interface WalletInfo {
  address: string;
  balance: string;
  isValid: boolean;
}

const TokenReceiver: React.FC<TokenReceiverProps> = ({ onClaimSuccess, className = '' }) => {
  const { user } = useAuth();
  const [tonConnectUI] = useTonConnectUI();
  const userFriendlyAddress = useTonAddress();
  
  const [walletInfo, setWalletInfo] = useState<WalletInfo>({
    address: '',
    balance: '0',
    isValid: false
  });
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimAmount, setClaimAmount] = useState(0);
  const [cooldownTime, setCooldownTime] = useState(0);
  const [eligibility, setEligibility] = useState<{
    canClaim: boolean;
    reason: string;
    timeRemaining?: number;
  }>({ canClaim: false, reason: 'Not checked' });
  
  // API Configuration
  const API_CONFIG = {
    MAINNET_API_KEY: process.env.REACT_APP_TONCENTER_API_KEY || '',
    TESTNET_API_KEY: process.env.REACT_APP_TONCENTER_TESTNET_API_KEY || '',
    isMainnet: process.env.REACT_APP_NETWORK === 'mainnet' || true,
    baseUrl: process.env.REACT_APP_NETWORK === 'mainnet' 
      ? 'https://toncenter.com/api/v2' 
      : 'https://testnet.toncenter.com/api/v2'
  };
  
  // Faucet configuration - can be loaded from database
  const [faucetConfig, setFaucetConfig] = useState<FaucetConfig>({
    COOLDOWN_HOURS: 24,
    BASE_AMOUNT: 10,
    BALANCE_MULTIPLIER: 0.1,
    MAX_CLAIM: 1000,
    MIN_BALANCE: 0.1
  });

  // Load faucet configuration from database
  useEffect(() => {
    const loadFaucetConfig = async () => {
      try {
        const { data: config } = await supabase
          .from('system_config')
          .select('config_key, config_value')
          .in('config_key', [
            'faucet_base_amount',
            'faucet_balance_multiplier', 
            'faucet_max_amount',
            'faucet_min_ton_balance',
            'faucet_cooldown_hours'
          ]);

        if (config) {
          const newConfig = { ...faucetConfig };
          config.forEach(item => {
            switch (item.config_key) {
              case 'faucet_base_amount':
                newConfig.BASE_AMOUNT = parseFloat(item.config_value);
                break;
              case 'faucet_balance_multiplier':
                newConfig.BALANCE_MULTIPLIER = parseFloat(item.config_value);
                break;
              case 'faucet_max_amount':
                newConfig.MAX_CLAIM = parseFloat(item.config_value);
                break;
              case 'faucet_min_ton_balance':
                newConfig.MIN_BALANCE = parseFloat(item.config_value);
                break;
              case 'faucet_cooldown_hours':
                newConfig.COOLDOWN_HOURS = parseFloat(item.config_value);
                break;
            }
          });
          setFaucetConfig(newConfig);
        }
      } catch (error) {
        console.error('Error loading faucet config:', error);
      }
    };

    loadFaucetConfig();
  }, []);

  // Fetch wallet balance using the new API service
  const fetchWalletBalance = async (address: string): Promise<TonBalanceResult> => {
    setIsLoadingBalance(true);
    try {
      const result = await defaultTonFetcher.fetchBalance(address);
      return result;
    } catch (error) {
      console.error('Error fetching wallet balance:', error);
      return {
        balance: '0',
        balanceNano: '0',
        isValid: false,
        error: 'Failed to fetch balance'
      };
    } finally {
      setIsLoadingBalance(false);
    }
  };

  // Calculate claim amount based on TON balance
  const calculateClaimAmount = (tonBalance: number): number => {
    const calculatedAmount = Math.min(
      faucetConfig.BASE_AMOUNT + (tonBalance * faucetConfig.BALANCE_MULTIPLIER),
      faucetConfig.MAX_CLAIM
    );
    return Math.max(calculatedAmount, faucetConfig.BASE_AMOUNT);
  };

  // Check claim eligibility using the new API service
  const checkEligibility = async (): Promise<{
    canClaim: boolean;
    reason: string;
    timeRemaining?: number;
  }> => {
    if (!user) {
      return { canClaim: false, reason: 'Please log in to claim tokens' };
    }

    if (!walletInfo.isValid || parseFloat(walletInfo.balance) < faucetConfig.MIN_BALANCE) {
      return { canClaim: false, reason: `Minimum ${faucetConfig.MIN_BALANCE} TON required` };
    }

    try {
      const eligibility = await FaucetApi.checkEligibility(user.id, faucetConfig.COOLDOWN_HOURS);
      
      if (eligibility.is_eligible) {
        return { canClaim: true, reason: 'Eligible to claim' };
      } else {
        const timeRemaining = eligibility.time_until_next_claim 
          ? new Date(eligibility.time_until_next_claim).getTime() - Date.now()
          : 0;
        return { 
          canClaim: false, 
          reason: eligibility.reason,
          timeRemaining: Math.max(0, timeRemaining)
        };
      }
    } catch (error) {
      console.error('Error checking eligibility:', error);
      return { canClaim: false, reason: 'Error checking eligibility' };
    }
  };

  // Handle wallet address input
  const handleAddressInput = async (address: string) => {
    const trimmedAddress = address.trim();
    const isValid = isValidAddress(trimmedAddress);
    
    setWalletInfo(prev => ({
      ...prev,
      address: trimmedAddress,
      isValid
    }));

    if (isValid) {
      const balanceResult = await fetchWalletBalance(trimmedAddress);
      const tonBalance = parseFloat(balanceResult.balance);
      const claimAmount = calculateClaimAmount(tonBalance);
      
      setWalletInfo(prev => ({
        ...prev,
        balance: balanceResult.balance
      }));
      setClaimAmount(claimAmount);
      
      // Check eligibility
      const eligibilityResult = await checkEligibility();
      setEligibility(eligibilityResult);
      
      if (eligibilityResult.timeRemaining) {
        setCooldownTime(eligibilityResult.timeRemaining);
      }
    } else {
      setWalletInfo(prev => ({
        ...prev,
        balance: '0'
      }));
      setClaimAmount(faucetConfig.BASE_AMOUNT);
      setEligibility({ canClaim: false, reason: 'Invalid wallet address' });
    }
  };

  // Handle faucet claim using the new API service
  const handleClaimTokens = async () => {
    if (!user || !eligibility.canClaim) {
      showSnackbar('Claim Failed', eligibility.reason);
      return;
    }

    setIsClaiming(true);
    try {
      const result = await FaucetApi.processClaim(
        user.id,
        walletInfo.address,
        parseFloat(walletInfo.balance),
        claimAmount,
        API_CONFIG.isMainnet ? 'mainnet' : 'testnet'
      );

      if (result.success) {
        showSnackbar(
          'Tokens Claimed Successfully!', 
          `You received ${claimAmount} STK tokens. New balance: ${result.new_balance} STK`
        );

        if (onClaimSuccess) {
          onClaimSuccess(claimAmount);
        }

        // Update eligibility
        setEligibility({ canClaim: false, reason: 'Claimed successfully' });
        setCooldownTime(faucetConfig.COOLDOWN_HOURS * 60 * 60 * 1000);
      } else {
        showSnackbar('Claim Failed', result.message);
      }
    } catch (error) {
      console.error('Error claiming tokens:', error);
      showSnackbar('Claim Failed', 'There was an error claiming tokens. Please try again.');
    } finally {
      setIsClaiming(false);
    }
  };

  // Use connected wallet if available
  useEffect(() => {
    if (userFriendlyAddress && !walletInfo.address) {
      handleAddressInput(userFriendlyAddress);
    }
  }, [userFriendlyAddress]);

  // Update cooldown timer
  useEffect(() => {
    if (cooldownTime > 0) {
      const timer = setInterval(() => {
        setCooldownTime(prev => {
          if (prev <= 1000) {
            // Cooldown finished, recheck eligibility
            if (walletInfo.isValid) {
              checkEligibility().then(setEligibility);
            }
            return 0;
          }
          return prev - 1000;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [cooldownTime, walletInfo.isValid]);

  // Format time remaining
  const formatTimeRemaining = (ms: number): string => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((ms % (1000 * 60)) / 1000);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

  return (
    <div className={`max-w-md mx-auto bg-gradient-to-br from-purple-900/20 to-blue-900/20 rounded-2xl p-6 border border-purple-500/20 ${className}`}>
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">🪙 Token Faucet</h2>
        <p className="text-gray-300 text-sm">
          Claim STK tokens based on your TON wallet balance
        </p>
      </div>

      {/* Wallet Address Input */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          TON Wallet Address
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={walletInfo.address}
            onChange={(e) => handleAddressInput(e.target.value)}
            placeholder="Enter TON wallet address"
            className={`flex-1 px-4 py-3 bg-gray-800/50 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 transition-colors ${
              walletInfo.address && !walletInfo.isValid 
                ? 'border-red-500 focus:ring-red-500' 
                : walletInfo.isValid 
                ? 'border-green-500 focus:ring-green-500'
                : 'border-gray-600 focus:ring-purple-500'
            }`}
          />
          {userFriendlyAddress && (
            <button
              onClick={() => handleAddressInput(userFriendlyAddress)}
              className="px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors text-sm"
            >
              Use Connected
            </button>
          )}
        </div>
        {walletInfo.address && !walletInfo.isValid && (
          <p className="text-red-400 text-xs mt-1">Invalid TON wallet address</p>
        )}
      </div>

      {/* Balance and Claim Info */}
      {walletInfo.address && walletInfo.isValid && (
        <div className="mb-6 space-y-4">
          <div className="p-4 bg-gray-800/30 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-300">TON Balance:</span>
              {isLoadingBalance ? (
                <div className="animate-pulse bg-gray-600 h-4 w-16 rounded"></div>
              ) : (
                <span className="text-green-400 font-mono">{walletInfo.balance} TON</span>
              )}
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-300">Claim Amount:</span>
              <span className="text-purple-400 font-mono">{claimAmount} STK</span>
            </div>
          </div>

          {/* Eligibility Status */}
          <div className={`p-3 rounded-lg border ${
            eligibility.canClaim 
              ? 'bg-green-900/20 border-green-500/30' 
              : 'bg-orange-900/20 border-orange-500/30'
          }`}>
            <div className="text-center">
              <p className={`text-sm ${
                eligibility.canClaim ? 'text-green-300' : 'text-orange-300'
              }`}>
                {eligibility.canClaim ? '✅ Ready to claim!' : `⚠️ ${eligibility.reason}`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Cooldown Display */}
      {cooldownTime > 0 && (
        <div className="mb-4 p-3 bg-orange-900/20 border border-orange-500/30 rounded-lg">
          <div className="text-center">
            <p className="text-orange-300 text-sm">
              ⏰ Next claim available in: {formatTimeRemaining(cooldownTime)}
            </p>
          </div>
        </div>
      )}

      {/* Claim Button */}
      <button
        onClick={handleClaimTokens}
        disabled={
          !walletInfo.address || 
          !walletInfo.isValid || 
          parseFloat(walletInfo.balance) < faucetConfig.MIN_BALANCE ||
          !eligibility.canClaim ||
          isClaiming
        }
        className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
      >
        {isClaiming ? (
          <div className="flex items-center justify-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
            Claiming...
          </div>
        ) : (
          `Claim ${claimAmount} STK Tokens`
        )}
      </button>

      {/* Info Section */}
      <div className="mt-6 text-xs text-gray-400 space-y-1">
        <p>• Minimum {faucetConfig.MIN_BALANCE} TON required</p>
        <p>• {faucetConfig.COOLDOWN_HOURS}h cooldown between claims</p>
        <p>• Amount: {faucetConfig.BASE_AMOUNT} + ({faucetConfig.BALANCE_MULTIPLIER * 100}% of TON balance)</p>
        <p>• Maximum {faucetConfig.MAX_CLAIM} STK per claim</p>
      </div>
    </div>
  );
};

export default TokenReceiver;