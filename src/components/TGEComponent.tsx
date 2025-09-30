import React, { useState, useEffect } from 'react';
import { useTonAddress, useTonConnectUI } from '@tonconnect/ui-react';
import { Address, toNano } from '@ton/core';
import { supabase } from '@/lib/supabaseClient';
import useAuth from '@/hooks/useAuth';
import { useNotificationSystem } from '@/components/NotificationSystem';
import FormattedNumericInput from './FormattedNumericInput';

interface TokenReceiverProps {
  onClaimSuccess?: (amount: number) => void;
}

const TGEComponent: React.FC<TokenReceiverProps> = ({ onClaimSuccess }) => {
  const { user, telegramUser } = useAuth();
  const { showSystemNotification } = useNotificationSystem();
  const userFriendlyAddress = useTonAddress();
  
  const [walletAddress, setWalletAddress] = useState('');
  const [walletBalance, setWalletBalance] = useState<string>('0');
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [userStkAmount, setUserStkAmount] = useState<string>('');
  const [userStknBalance, setUserStknBalance] = useState<string>('');
  const [userTotalStkMining, setUserTotalStkMining] = useState<string>('');
  const [nftTokenId, setNftTokenId] = useState<string>('');
  const [calculatedReceiveAmount, setCalculatedReceiveAmount] = useState<number>(0);
  const [isAutoFilling, setIsAutoFilling] = useState(false);
  const [portfolioValue, setPortfolioValue] = useState<number>(0);
  const [rewardBreakdown, setRewardBreakdown] = useState({
    stkReward: 0,
    stknReward: 0,
    miningReward: 0,
    tonReward: 0,
    totalBaseReward: 0
  });
  const [activeTab, setActiveTab] = useState<'claim' | 'orders'>('claim');
  const [userOrders, setUserOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [hasAlreadyClaimed, setHasAlreadyClaimed] = useState(false);
  const [userClaimStatus, setUserClaimStatus] = useState<{
    hasRejectedClaims: boolean;
    hasActiveClaims: boolean;
    rejectionReason?: string;
  }>({
    hasRejectedClaims: false,
    hasActiveClaims: false
  });
  const [finalClaimedAmount, setFinalClaimedAmount] = useState<number | null>(null);
  const [isPaying, setIsPaying] = useState(false);
  const [hasPaid, setHasPaid] = useState(false);
  const [paymentTxHash, setPaymentTxHash] = useState<string | null>(null);
  const [tonConnectUI] = useTonConnectUI();
  
  // Wizard state
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  // Wizard steps configuration
  const wizardSteps = [
    {
      id: 0,
      title: "🎯 Welcome!",
      subtitle: "Let's claim your STK tokens!",
      description: "This is a one-time claim based on your portfolio. Let's get started!",
      icon: "🚀"
    },
    {
      id: 1,
      title: "💼 Connect Wallet",
      subtitle: "Link your TON wallet",
      description: "We need your TON wallet address to verify your balance",
      icon: "🔗"
    },
    {
      id: 2,
      title: "📊 Portfolio Info",
      subtitle: "Tell us about your holdings",
      description: "Enter your STK, STKN, and mining balances for calculation",
      icon: "💰"
    },
    {
      id: 3,
      title: "🎨 NFT Details",
      subtitle: "Your NFT Token ID",
      description: "Required for the claiming process",
      icon: "🖼️"
    },
    {
      id: 4,
      title: "✨ Review & Claim",
      subtitle: "Final review and claim!",
      description: "Check everything and claim your tokens",
      icon: "🎉"
    }
  ];
  
  // Wizard navigation functions
  const nextStep = () => {
    if (currentStep < wizardSteps.length - 1) {
      setCompletedSteps(prev => [...prev, currentStep]);
      setCurrentStep(prev => prev + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const goToStep = (step: number) => {
    if (step <= currentStep || completedSteps.includes(step)) {
      setCurrentStep(step);
    }
  };

  const isStepCompleted = (step: number) => completedSteps.includes(step);
  const isStepAccessible = (step: number) => step <= currentStep || completedSteps.includes(step);

  // Step validation functions
  const isStepValid = (step: number): boolean => {
    switch (step) {
      case 0: return true; // Welcome step is always valid
      case 1: return !!(walletAddress && isValidAddress(walletAddress) && parseFloat(walletBalance) >= FAUCET_CONFIG.MIN_BALANCE);
      case 2: return !!(userStkAmount && userStknBalance && userTotalStkMining && 
               parseFloat(userStkAmount) >= 0 && parseFloat(userStknBalance) >= 0 && parseFloat(userTotalStkMining) >= 0);
      case 3: return !!(nftTokenId && nftTokenId.trim() !== '');
      case 4: return calculatedReceiveAmount > 0 && !hasAlreadyClaimed;
      default: return false;
    }
  };

  const getStepValidationMessage = (step: number): string => {
    switch (step) {
      case 1:
        if (!walletAddress) return "Please enter your wallet address";
        if (!isValidAddress(walletAddress)) return "Please enter a valid TON wallet address";
        if (parseFloat(walletBalance) < FAUCET_CONFIG.MIN_BALANCE) return `Your wallet needs at least ${FAUCET_CONFIG.MIN_BALANCE} TON`;
        return "✅ Wallet connected successfully!";
      case 2:
        if (!userStkAmount || !userStknBalance || !userTotalStkMining) return "Please fill in all portfolio fields";
        return "✅ Portfolio information complete!";
      case 3:
        if (!nftTokenId || nftTokenId.trim() === '') return "Please enter your NFT Token ID";
        return "✅ NFT details added!";
      case 4:
        if (hasAlreadyClaimed) return "You have already claimed your tokens";
        if (calculatedReceiveAmount <= 0) return "Unable to calculate claim amount";
        if (!hasPaid) return "Please complete the TON payment to claim your STK";
        return "✅ Payment confirmed. Ready to submit claim!";
      default: return "";
    }
  };
  
  // Snackbar helper function
  const showSnackbar = (title: string, message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    showSystemNotification(title, message, type);
  };

  // Simple address validation
  const isValidAddress = (address: string): boolean => {
    try {
      Address.parse(address);
      return true;
    } catch {
      return false;
    }
  };

  // Professional calculator with specific conversion rates
  const calculateReceiveAmount = (stkAmount: number, stknBalance: number, totalStkMining: number, tonBalance: number): number => {
    if (stkAmount <= 0 || stknBalance <= 0 || totalStkMining <= 0) return 0;
    
    // Professional conversion rates
    const STK_RATE = 0.0055; // 1 STK = 0.0025 STK reward
    const STKN_RATE = 0.008; // 1 STKN = 1000 STK reward
    const MINING_RATE = 0.00001; // 1 Mining Balance = 5000 STK reward
    const TON_RATE = 0.00001; // 1 TON = 100 STK reward
    
    // Calculate base rewards using professional rates
    const stkReward = stkAmount * STK_RATE;
    const stknReward = stknBalance * STKN_RATE;
    const miningReward = totalStkMining * MINING_RATE;
    const tonReward = tonBalance * TON_RATE;
    
    // Total base reward
    const totalBaseReward = stkReward + stknReward + miningReward + tonReward;
    
    // Calculate portfolio value for tier determination
    const portfolioValue = stkAmount + stknBalance + totalStkMining + (tonBalance * 100);
    
    // Apply randomization based on portfolio tier
    let randomFactor;
    if (portfolioValue > 1000000000) {
      // Billion+ users get premium randomization (95% to 105%) - more stable
      randomFactor = 0.95 + (Math.random() * 0.1);
    } else if (portfolioValue > 100000000) {
      // 100M+ users get high randomization (90% to 110%)
      randomFactor = 0.9 + (Math.random() * 0.2);
    } else if (portfolioValue > 10000000) {
      // 10M+ users get good randomization (85% to 115%)
      randomFactor = 0.85 + (Math.random() * 0.3);
    } else if (portfolioValue > 1000000) {
      // 1M+ users get standard randomization (80% to 120%)
      randomFactor = 0.8 + (Math.random() * 0.4);
    } else {
      // Standard users get wide randomization (75% to 125%)
      randomFactor = 0.75 + (Math.random() * 0.5);
    }
    
    // Calculate final randomized amount
    const randomizedAmount = totalBaseReward * randomFactor;
    
    // Get dynamic range with 350M cap
    const range = getDynamicRange(portfolioValue);
    
    // Apply both minimum and maximum (350M cap)
    return Math.max(range.min, Math.min(randomizedAmount, range.max));
  };
  
  // API Keys for TON Center
  const MAINNET_API_KEY = 'ba0e3b7f5080add7ba9bc310b2652ce4d33654575152d5ab90fde863309f6118';
  const TESTNET_API_KEY = 'bb31868e5cf6529efb16bcf547beb3c534a28d1e139bd63356fd936c168fe662';
  
  // Add referral
  const isMainnet = true; // Set to false for testnet
  
  // Faucet configuration - ONE TIME CLAIM ONLY
  const FAUCET_CONFIG = {
    ONE_TIME_ONLY: true, // One-time claim only, no cooldown
    BASE_AMOUNT: 0.001, // Base STK tokens
    BALANCE_MULTIPLIER: 0.0002, // 10% of TON balance as STK
    MAX_CLAIM: 1000, // Maximum STK tokens per claim
    MIN_BALANCE: 0.1, // Minimum TON balance required
    MIN_RECEIVE: 1000, // Minimum STK tokens to receive
    MAX_RECEIVE: 25000, // Maximum STK tokens to receive
    TOTAL_SUPPLY: 1000000000, // 1B total supply
    DISTRIBUTION_PERCENTAGE: 0.20, // 35% of total supply
    MAX_DISTRIBUTION: 350000000 // 350M STK maximum distribution
  };

  // TON payment settings (replace recipient with your treasury address)
  const PAYMENT_CONFIG = {
    recipient: 'UQCgomX3IWH-wU7AhBhy5MTMQuDcBLm43itK51tuTIPYdFN3',
    amountTon: 0.87
  };

  // Dynamic range calculation with 350M cap
  const getDynamicRange = (portfolioValue: number) => {
    // Cap at 350M STK (35% of total supply)
    const maxCap = FAUCET_CONFIG.MAX_DISTRIBUTION;
    
    if (portfolioValue > 1000000000) {
      // Billion+ users: 1M+ STK minimum, capped at 350M
      return { min: 1000000, max: maxCap };
    } else if (portfolioValue > 100000000) {
      // 100M+ users: 100K+ STK minimum, capped at 350M
      return { min: 100000, max: maxCap };
    } else if (portfolioValue > 10000000) {
      // 10M+ users: 10K+ STK minimum, capped at 350M
      return { min: 10000, max: maxCap };
    } else if (portfolioValue > 1000000) {
      // 1M+ users: 1K+ STK minimum, capped at 350M
      return { min: 1000, max: maxCap };
    } else {
      // Standard users: 100+ STK minimum, capped at 350M
      return { min: 100, max: maxCap };
    }
  };

  // Fetch wallet balance from TON Center API
  const fetchWalletBalance = async (address: string) => {
    if (!address || !isValidAddress(address)) {
      setWalletBalance('0');
      return;
    }

    setIsLoadingBalance(true);
    try {
      const apiKey = isMainnet ? MAINNET_API_KEY : TESTNET_API_KEY;
      const baseUrl = isMainnet ? 'https://toncenter.com/api/v2' : 'https://testnet.toncenter.com/api/v2';
      
      const response = await fetch(`${baseUrl}/getAddressBalance?address=${address}`, {
        headers: {
          'X-API-Key': apiKey
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.ok) {
        const balanceInNano = parseInt(data.result);
        const balanceInTon = balanceInNano / 1_000_000_000;
        setWalletBalance(balanceInTon.toFixed(4));
        
        // Balance fetched successfully
      } else {
        console.error('API error:', data.error);
        setWalletBalance('0');
      }
    } catch (error) {
      console.error('Error fetching wallet balance:', error);
      setWalletBalance('0');
    } finally {
      setIsLoadingBalance(false);
    }
  };

  // Validate all required fields before claiming (more user-friendly)
  const validateClaimInputs = () => {
    const errors = [];

    if (!user) {
      errors.push('Please connect your wallet first');
    }

    if (!walletAddress || !isValidAddress(walletAddress)) {
      errors.push('Please enter a valid TON wallet address');
    }

    if (parseFloat(walletBalance) < FAUCET_CONFIG.MIN_BALANCE) {
      errors.push(`Your wallet needs at least ${FAUCET_CONFIG.MIN_BALANCE} TON to claim`);
    }

    if (!userStkAmount || parseFloat(userStkAmount) <= 0) {
      errors.push('Please enter your STK token amount (use 0 if you have none)');
    }

    if (!userStknBalance || parseFloat(userStknBalance) <= 0) {
      errors.push('Please enter your STKN balance (use 0 if you have none)');
    }

    if (!userTotalStkMining || parseFloat(userTotalStkMining) <= 0) {
      errors.push('Please enter your Total STK Mining balance (use 0 if you have none)');
    }

    // NFT Token ID must be integer in [1, 257]
    const nftIdNum = parseInt((nftTokenId || '').trim(), 10);
    if (!nftTokenId || nftTokenId.trim() === '' || isNaN(nftIdNum) || nftIdNum < 1 || nftIdNum > 257) {
      errors.push('NFT Token ID must be an integer between 1 and 257');
    }

    if (calculatedReceiveAmount <= 0) {
      errors.push('Unable to calculate claim amount - please check your inputs');
    }

    return errors;
  };

  // Fetch user's order history with status information (directly from faucet_claims)
  const fetchUserOrders = async () => {
    if (!user) return;
    
    setLoadingOrders(true);
    try {
      const { data, error } = await supabase
        .from('faucet_claims')
        .select(`
          id,
          user_id,
          wallet_address,
          ton_balance,
          claim_amount,
          stk_amount,
          stkn_balance,
          total_stk_mining,
          nft_token_id,
          portfolio_value,
          approval_status,
          payment_status,
          payment_tx_hash,
          payment_processed_at,
          rejection_reason,
          admin_notes,
          claimed_at,
          approved_at,
          session_id,
          telegram_id,
          telegram_username,
          telegram_first_name,
          telegram_last_name,
          reward_breakdown,
          network
        `)
        .eq('user_id', user.id)
        .order('claimed_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setUserOrders(data || []);
    } catch (error) {
      console.error('Error fetching user orders:', error);
      showSnackbar('Error', 'Failed to fetch your order history', 'error');
    } finally {
      setLoadingOrders(false);
    }
  };

  // Auto-detect user claim status on load
  const fetchUserClaimStatus = async () => {
    if (!user) return;

    try {
      const { data: existingClaims, error } = await supabase
        .from('faucet_claims')
        .select('id, approval_status, rejection_reason, claim_amount')
        .eq('user_id', user.id);

      if (error) throw error;

      if (existingClaims && existingClaims.length > 0) {
        const activeClaim = existingClaims.find(claim =>
          claim.approval_status === 'approved' || claim.approval_status === 'pending'
        );
        const hasRejectedClaim = existingClaims.some(claim => 
          claim.approval_status === 'rejected'
        );
        const latestRejection = existingClaims.find(claim => 
          claim.approval_status === 'rejected'
        );

        setUserClaimStatus({
          hasRejectedClaims: hasRejectedClaim,
          hasActiveClaims: !!activeClaim,
          rejectionReason: latestRejection?.rejection_reason,
        });

        if (activeClaim) {
          setHasAlreadyClaimed(true);
          setFinalClaimedAmount(activeClaim.claim_amount);
        } else {
          setHasAlreadyClaimed(false);
        }
      } else {
        // No claims at all
        setHasAlreadyClaimed(false);
        setUserClaimStatus({ hasRejectedClaims: false, hasActiveClaims: false });
      }
    } catch (error) {
      console.error('Error fetching user claim status:', error);
      showSnackbar('Error', 'Could not verify your claim status.', 'error');
    }
  };

  // Pre-submission validation for NFT uniqueness
  const validateNftBeforeClaim = async () => {
    const nftIdNum = parseInt((nftTokenId || '').trim(), 10);
    if (isNaN(nftIdNum) || nftIdNum < 1 || nftIdNum > 257) {
      // This is handled by validateClaimInputs, but good to have a check here too
      return false;
    }

    try {
      const { data: existingWithSameNft, error } = await supabase
        .from('faucet_claims')
        .select('id')
        .eq('nft_token_id', nftIdNum.toString())
        .limit(1);
      
      if (error) throw error;

      if (existingWithSameNft && existingWithSameNft.length > 0) {
        showSnackbar('NFT Token In Use', `NFT Token ID #${nftIdNum} has already been used.`, 'warning');
        return false;
      }
      return true; // NFT is unique
    } catch (error) {
      console.error('Error validating NFT token ID:', error);
      showSnackbar('Error', 'Could not validate your NFT Token ID.', 'error');
      return false;
    }
  };

  // Handle faucet claim
  const handleClaimTokens = async () => {
    // Validate all inputs first
    const validationErrors = validateClaimInputs();
    if (validationErrors.length > 0) {
      showSnackbar('Validation Failed', validationErrors.join('\n'), 'error');
      return;
    }

    // Check one-time claim eligibility
    if (hasAlreadyClaimed) {
      showSnackbar('Already Claimed', 'You have already submitted a claim. Please check "My Orders".', 'warning');
      return;
    }

    const isNftUnique = await validateNftBeforeClaim();
    if (!isNftUnique) {
      return; // Snackbar is shown inside the validation function
    }

    // Require successful TON payment before submission
    if (!hasPaid || !paymentTxHash) {
      showSnackbar('Payment Required', 'Please complete the TON payment first.', 'warning');
      return;
    }

    setIsClaiming(true);
    try {
      // Prepare all player information for submission
      const playerInfo = {
        user_id: user!.id,
          wallet_address: walletAddress,
          ton_balance: parseFloat(walletBalance),
          claim_amount: calculatedReceiveAmount,
        nft_token_id: parseInt(nftTokenId.trim(), 10).toString(),
          stk_amount: parseFloat(userStkAmount),
          stkn_balance: parseFloat(userStknBalance),
          total_stk_mining: parseFloat(userTotalStkMining),
          portfolio_value: portfolioValue,
        reward_breakdown: rewardBreakdown,
        claimed_at: new Date().toISOString(),
        // Telegram user information
        telegram_id: telegramUser?.id || null,
        telegram_username: telegramUser?.username || null,
        telegram_first_name: telegramUser?.firstName || null,
        telegram_last_name: telegramUser?.lastName || null,
        telegram_photo_url: telegramUser?.photoUrl || null,
        // Session information
        user_agent: navigator.userAgent,
        session_id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        network: isMainnet ? 'mainnet' : 'testnet'
      };

      console.log('Submitting claim with player info:', playerInfo);

      // Record the claim in database with all player information
      const { data: claimData, error: claimError } = await supabase
        .from('faucet_claims')
        .insert([{ ...playerInfo, payment_tx_hash: paymentTxHash, payment_status: 'pending' }])
        .select()
        .single();

      if (claimError) {
        console.error('Claim database error:', claimError);
        throw new Error(`Database error: ${claimError.message}`);
      }

      console.log('Claim recorded successfully:', claimData);

      // Update user's balance (no need for last_faucet_claim since it's one-time)
      const { error: updateError } = await supabase
        .from('users')
        .update({ 
          total_sbt: (user!.total_sbt || 0) + calculatedReceiveAmount,
          updated_at: new Date().toISOString()
        })
        .eq('id', user!.id);

      if (updateError) {
        console.error('User update error:', updateError);
        throw new Error(`User update error: ${updateError.message}`);
      }

      // Mark as claimed (one-time only)
      setHasAlreadyClaimed(true);
      setCompletedSteps(prev => [...prev, currentStep]);
      setFinalClaimedAmount(calculatedReceiveAmount);

      // Log successful claim with detailed order information
      const orderDetails = {
        claimId: claimData.id,
        amount: calculatedReceiveAmount,
        playerInfo: {
          telegramId: telegramUser?.id,
          telegramUsername: telegramUser?.username,
          telegramName: `${telegramUser?.firstName} ${telegramUser?.lastName || ''}`.trim(),
          walletAddress: walletAddress,
          portfolioValue: portfolioValue,
          stkAmount: parseFloat(userStkAmount),
          stknBalance: parseFloat(userStknBalance),
          totalStkMining: parseFloat(userTotalStkMining),
          nftTokenId: nftTokenId,
          tonBalance: parseFloat(walletBalance)
        },
        rewardBreakdown: rewardBreakdown,
        timestamp: new Date().toISOString(),
        sessionId: playerInfo.session_id
      };

      console.log('✅ CLAIM ORDER SUBMITTED SUCCESSFULLY:', orderDetails);
      console.log('📊 Full Order Record:', claimData);

      // Show detailed success message
      const successMessage = `🎉 CLAIM SUCCESSFUL!
      
📋 Order ID: ${claimData.id}
💰 Amount: ${calculatedReceiveAmount.toLocaleString()} STK tokens
👤 Player: ${orderDetails.playerInfo.telegramName} (@${orderDetails.playerInfo.telegramUsername || 'N/A'})
💼 Portfolio: $${portfolioValue.toLocaleString()}
🔗 Wallet: ${walletAddress.substring(0, 8)}...${walletAddress.substring(-6)}
⏰ Time: ${new Date().toLocaleString()}`;

      showSnackbar('🎯 Tokens Claimed Successfully!', successMessage, 'success');

      // Switch to orders tab and refresh to show the new order
      setActiveTab('orders');
      fetchUserOrders();

      if (onClaimSuccess) {
        onClaimSuccess(calculatedReceiveAmount);
      }

    } catch (error) {
      console.error('Error claiming tokens:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showSnackbar('Claim Failed', `There was an error claiming tokens: ${errorMessage}`, 'error');
    } finally {
      setIsClaiming(false);
    }
  };

  // Handle wallet address input
  const handleAddressInput = (address: string) => {
    setWalletAddress(address);
    if (address && isValidAddress(address)) {
      fetchWalletBalance(address);
    } else {
      setWalletBalance('0');
    }
  };

  // Use connected wallet if available
  useEffect(() => {
    if (userFriendlyAddress && !walletAddress) {
      setWalletAddress(userFriendlyAddress);
      fetchWalletBalance(userFriendlyAddress);
    }
  }, [userFriendlyAddress]);

  // Check claim eligibility when user is available
  useEffect(() => {
    if (user) {
      fetchUserClaimStatus();
    }
  }, [user]);

  // Fetch user orders when switching to orders tab or when user changes
  useEffect(() => {
    if (activeTab === 'orders' && user) {
      fetchUserOrders();
    }
  }, [activeTab, user]);

  // TON payment handler
  const handlePayTon = async () => {
    if (!walletAddress || !isValidAddress(walletAddress)) {
      showSnackbar('Invalid Wallet', 'Please enter a valid TON wallet address first', 'warning');
      return;
    }
    try {
      setIsPaying(true);
      const tx = {
        validUntil: Math.floor(Date.now() / 1000) + 600,
        messages: [
          {
            address: PAYMENT_CONFIG.recipient,
            amount: toNano(PAYMENT_CONFIG.amountTon.toString()).toString()
          }
        ]
      } as any;

      const result = await tonConnectUI.sendTransaction(tx);
      if (!result) {
        // Similar to DailyRewards, treat missing result as cancellation
        showSnackbar('Payment Cancelled', 'Transaction was cancelled. Please try again.', 'info');
        setHasPaid(false);
        setPaymentTxHash(null);
        return;
      }

      const hash = (result as any)?.boc || `tx_${Date.now()}`;
      setPaymentTxHash(hash);
      setHasPaid(true);
      showSnackbar('Payment Success', 'TON payment confirmed. You can submit your claim now.', 'success');
    } catch (e) {
      console.error('TON payment failed:', e);
      setHasPaid(false);
      setPaymentTxHash(null);
      showSnackbar('Payment Failed', 'Could not complete TON payment. Please try again.', 'error');
    } finally {
      setIsPaying(false);
    }
  };

  // Smart auto-fill function
  const autoFillBalances = async () => {
    if (!user) return;
    
    setIsAutoFilling(true);
    try {
      // Fetch user's historical data for smart suggestions
      const { data: userData } = await supabase
        .from('users')
        .select('total_sbt, total_earned, balance')
        .eq('id', user.id)
        .single();

      if (userData) {
        // Smart suggestions based on user's history
        const suggestedStk = Math.max(userData.total_sbt || 0, 1000);
        const suggestedStkn = Math.max((userData.total_earned || 0) * 0.1, 500);
        const suggestedMining = Math.max((userData.balance || 0) * 0.05, 2000);

        setUserStkAmount(suggestedStk.toString());
        setUserStknBalance(suggestedStkn.toString());
        setUserTotalStkMining(suggestedMining.toString());

        showSnackbar('Auto-Fill Complete', 'Balances filled based on your account history', 'success');
      }
    } catch (error) {
      console.error('Auto-fill failed:', error);
      showSnackbar('Auto-Fill Failed', 'Could not fetch your account data', 'error');
    } finally {
      setIsAutoFilling(false);
    }
  };

  // Calculate receive amount when any balance changes
  useEffect(() => {
    const stkAmount = parseFloat(userStkAmount) || 0;
    const stknBalance = parseFloat(userStknBalance) || 0;
    const totalStkMining = parseFloat(userTotalStkMining) || 0;
    const tonBalance = parseFloat(walletBalance) || 0;
    
    // Calculate portfolio value
    const portfolio = stkAmount + stknBalance + totalStkMining + (tonBalance * 100);
    setPortfolioValue(portfolio);
    
    // Calculate reward breakdown
    const STK_RATE = 0.0055; // 1 STK = 0.0055 STK reward
    const STKN_RATE = 0.008; // 1 STKN = 0.008 STK reward
    const MINING_RATE = 0.00001; // 1 Mining Balance = 0.00001 STK reward
    const TON_RATE = 0.00001; // 1 TON = 0.00001 STK reward
    
    const stkReward = stkAmount * STK_RATE;
    const stknReward = stknBalance * STKN_RATE;
    const miningReward = totalStkMining * MINING_RATE;
    const tonReward = tonBalance * TON_RATE;
    const totalBaseReward = stkReward + stknReward + miningReward + tonReward;
    
    setRewardBreakdown({
      stkReward,
      stknReward,
      miningReward,
      tonReward,
      totalBaseReward
    });
    
    const calculatedAmount = calculateReceiveAmount(stkAmount, stknBalance, totalStkMining, tonBalance);
    setCalculatedReceiveAmount(calculatedAmount);
  }, [userStkAmount, userStknBalance, userTotalStkMining, walletBalance]);


  // Get status badge styling
  const getStatusBadge = (approvalStatus: string, paymentStatus: string) => {
    if (approvalStatus === 'pending') {
      return {
        text: '⏳ Pending Approval',
        className: 'bg-yellow-900/30 text-yellow-300 border-yellow-500/50'
      };
    } else if (approvalStatus === 'approved') {
      if (paymentStatus === 'pending') {
        return {
          text: '✅ Approved - Processing',
          className: 'bg-blue-900/30 text-blue-300 border-blue-500/50'
        };
      } else if (paymentStatus === 'processing') {
        return {
          text: '🔄 Payment in Progress',
          className: 'bg-purple-900/30 text-purple-300 border-purple-500/50'
        };
      } else if (paymentStatus === 'completed') {
        return {
          text: '🎉 Payment Completed',
          className: 'bg-green-900/30 text-green-300 border-green-500/50'
        };
      } else if (paymentStatus === 'failed') {
        return {
          text: '❌ Payment Failed',
          className: 'bg-red-900/30 text-red-300 border-red-500/50'
        };
      }
    } else if (approvalStatus === 'rejected') {
      return {
        text: '❌ Rejected',
        className: 'bg-red-900/30 text-red-300 border-red-500/50'
      };
    }
    
    return {
      text: '❓ Unknown Status',
      className: 'bg-gray-900/30 text-gray-300 border-gray-500/50'
    };
  };

  // Wizard Progress Component
  const WizardProgress = () => {
    // Progress is based on the current step, reaching 100% only after claiming.
    const progressPercentage = hasAlreadyClaimed
      ? 100
      : (currentStep / wizardSteps.length) * 100;

    return (
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          {wizardSteps.map((step, index) => {
            // A step is considered "completed" if we have already claimed, or if its index is in the completedSteps array.
            const isCompleted = hasAlreadyClaimed || isStepCompleted(index);
            const isActive = !hasAlreadyClaimed && index === currentStep;

            // A step is accessible if we haven't claimed yet and it's the current step or a completed one.
            const isAccessible = !hasAlreadyClaimed && isStepAccessible(index);

            return (
              <div key={step.id} className="flex flex-col items-center">
                <button
                  onClick={() => goToStep(index)}
                  // Disable button if already claimed or if the step is not accessible.
                  disabled={hasAlreadyClaimed || !isAccessible}
                  className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold transition-all duration-300 transform hover:scale-110 ${
                    isActive
                      ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-lg scale-110'
                      : isCompleted
                      ? 'bg-green-500 text-white shadow-md' // All steps are green after claim
                      : isAccessible
                      ? 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                      : 'bg-gray-800 text-gray-600 cursor-not-allowed'
                  }`}
                >
                  {isCompleted ? '✅' : step.icon}
                </button>
                <span className={`text-xs mt-2 text-center max-w-16 ${
                  isActive ? 'text-purple-300 font-semibold' : 'text-gray-400'
                }`}>
                  {step.title.split(' ')[0]}
                </span>
              </div>
            );
          })}
        </div>

        {/* Progress bar */}
        <div className="w-full bg-gray-800 rounded-full h-2 mb-4">
          <div
            className="bg-gradient-to-r from-purple-500 to-blue-500 h-2 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>

        {/* Current step info: Shows completion message if claimed, otherwise shows current step details. */}
        <div className="text-center">
          {hasAlreadyClaimed ? (
            <>
              <h3 className="text-2xl font-bold text-green-400 mb-1 animate-pulse">
                🎉 Claim Submitted!
              </h3>
              <p className="text-gray-300 text-sm">
                Your submission is complete. Check "My Orders" for status updates.
              </p>
              <p className="text-green-300 text-xs mt-1">
                Process Complete
              </p>
            </>
          ) : (
            <>
              <h3 className="text-xl font-bold text-white mb-1">
                {wizardSteps[currentStep].title}
              </h3>
              <p className="text-gray-300 text-sm">
                {wizardSteps[currentStep].description}
              </p>
              <p className="text-purple-300 text-xs mt-1">
                Step {currentStep + 1} of {wizardSteps.length}
              </p>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-lg mx-auto bg-gradient-to-br from-purple-900/20 to-blue-900/20 rounded-2xl p-6 border border-purple-500/20 shadow-2xl">
      {/* Wizard Progress */}
      <WizardProgress />

      {/* Tab Navigation - Only show for orders */}
      {hasAlreadyClaimed && (
      <div className="mb-6">
        <div className="flex bg-gray-800/50 rounded-lg p-1 border border-gray-600">
          <button
            onClick={() => setActiveTab('claim')}
            className={`flex-1 py-3 px-4 rounded-md text-sm font-medium transition-all ${
              activeTab === 'claim'
                ? 'bg-purple-600 text-white shadow-lg'
                : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
            }`}
          >
            🎯 Claim Tokens
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            className={`flex-1 py-3 px-4 rounded-md text-sm font-medium transition-all ${
              activeTab === 'orders'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
            }`}
          >
            📋 My Orders ({userOrders.length})
          </button>
        </div>
      </div>
      )}

      {/* Wizard Steps Content */}
      {!hasAlreadyClaimed && (
        <div className="space-y-6">
          {/* Step 0: Welcome */}
          {currentStep === 0 && (
            <div className="text-center py-8">
              <div className="text-6xl mb-4 animate-bounce">🚀</div>
              <h2 className="text-2xl font-bold text-white mb-4">
                Welcome to STK Token Claim!
              </h2>
              <p className="text-gray-300 mb-6">
                Get ready to claim your STK tokens based on your portfolio. 
                This is a one-time opportunity, so let's make it count! 💎
              </p>
              <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 rounded-lg p-4 border border-purple-500/30">
                <h3 className="text-purple-300 font-semibold mb-2">What you'll need:</h3>
                <ul className="text-gray-300 text-sm space-y-1 text-left">
                  <li>🔗 Your TON wallet address</li>
                  <li>💰 Your STK, STKN, and mining balances</li>
                  <li>🖼️ Your NFT Token ID</li>
                  <li>⏱️ About 2 minutes of your time</li>
                </ul>
              </div>
            </div>
          )}

          {/* Step 1: Wallet Connection */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="text-center mb-6">
                <div className="text-4xl mb-3">🔗</div>
                <h3 className="text-xl font-bold text-white mb-2">Connect Your Wallet</h3>
                <p className="text-gray-300 text-sm">
                  Enter your TON wallet address to get started
                </p>
              </div>

          {/* Telegram Profile Display */}
          {telegramUser && (
        <div className="mb-6 p-4 bg-gradient-to-r from-blue-900/20 to-purple-900/20 rounded-lg border border-blue-500/20">
          <div className="flex items-center gap-3">
            {telegramUser.photoUrl && (
              <img 
                src={telegramUser.photoUrl} 
                alt="Profile" 
                className="w-12 h-12 rounded-full border-2 border-blue-400"
              />
            )}
            <div className="flex-1">
              <h3 className="text-white font-semibold">
                {telegramUser.firstName} {telegramUser.lastName || ''}
              </h3>
              {telegramUser.username && (
                <p className="text-blue-300 text-sm">@{telegramUser.username}</p>
              )}
              <p className="text-gray-400 text-xs">Telegram ID: {telegramUser.id}</p>
            </div>
          </div>
        </div>
      )}

      {/* Wallet Address Input */}
              <div className="space-y-4">
                <label className="block text-sm font-medium text-gray-300">
                  💼 TON Wallet Address
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={walletAddress}
            onChange={(e) => handleAddressInput(e.target.value)}
                    placeholder="Enter your TON wallet address..."
                    className="flex-1 px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
          />
          {userFriendlyAddress && (
            <button
              onClick={() => handleAddressInput(userFriendlyAddress)}
                      className="px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-lg transition-all transform hover:scale-105"
            >
                      🔗 Connect
            </button>
          )}
        </div>
                
                {/* Balance Display */}
                {walletAddress && (
                  <div className="p-3 bg-gray-800/30 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-300">TON Balance:</span>
                      {isLoadingBalance ? (
                        <div className="flex items-center gap-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-purple-400 border-t-transparent"></div>
                          <span className="text-gray-400">Loading...</span>
                        </div>
                      ) : (
                        <span className="text-green-400 font-mono font-semibold">
                          {walletBalance} TON
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Validation Message */}
                <div className={`p-3 rounded-lg text-sm ${
                  isStepValid(1) 
                    ? 'bg-green-900/20 border border-green-500/30 text-green-300'
                    : 'bg-red-900/20 border border-red-500/30 text-red-300'
                }`}>
                  {getStepValidationMessage(1)}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Portfolio Information */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="text-center mb-6">
                <div className="text-4xl mb-3">💰</div>
                <h3 className="text-xl font-bold text-white mb-2">Portfolio Information</h3>
                <p className="text-gray-300 text-sm">
                  Tell us about your current holdings
                </p>
      </div>

      {/* Smart Controls */}
              <div className="flex gap-2">
        {/* <button
          onClick={autoFillBalances}
          disabled={isAutoFilling}
          className="flex-1 py-3 px-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-semibold rounded-lg transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
        >
          {isAutoFilling ? (
            <div className="flex items-center justify-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
              Auto-Filling...
            </div>
          ) : (
            '🎯 Auto-Fill'
          )}
        </button>
        <button
          onClick={() => {
            const stkAmount = parseFloat(userStkAmount) || 0;
            const stknBalance = parseFloat(userStknBalance) || 0;
            const totalStkMining = parseFloat(userTotalStkMining) || 0;
            const tonBalance = parseFloat(walletBalance) || 0;
            const newAmount = calculateReceiveAmount(stkAmount, stknBalance, totalStkMining, tonBalance);
            setCalculatedReceiveAmount(newAmount);
            showSnackbar('Recalculated', 'Amount refreshed with new randomization');
          }}
          className="px-4 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-semibold rounded-lg transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
        >
          🔄 Refresh
        </button> */}
      </div>

              {/* Portfolio Inputs */}
              <div className="space-y-4">
      {/* STK Amount Input */}
                <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
                    💎 STK Voucher Balance
        </label>
        <FormattedNumericInput
          value={userStkAmount}
          onChange={setUserStkAmount}
                    placeholder="Enter amount of STK tokens you hold..."
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
        />
      </div>

      {/* STKN Balance Input */}
                <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
                    🔥 Phase 1 STKN Balance
        </label>
        <FormattedNumericInput
          value={userStknBalance}
          onChange={setUserStknBalance}
                    placeholder="Enter your STKN balance..."
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
        />
      </div>

      {/* Total STK Mining Input */}
                <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
                    ⛏️ Total STK Mining Balance
        </label>
        <FormattedNumericInput
          value={userTotalStkMining}
          onChange={setUserTotalStkMining}
                    placeholder="Enter your current Total STK Mining balance..."
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                  />
                </div>

                {/* Validation Message */}
                <div className={`p-3 rounded-lg text-sm ${
                  isStepValid(2) 
                    ? 'bg-green-900/20 border border-green-500/30 text-green-300'
                    : 'bg-red-900/20 border border-red-500/30 text-red-300'
                }`}>
                  {getStepValidationMessage(2)}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: NFT Details */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div className="text-center mb-6">
                <div className="text-4xl mb-3">🖼️</div>
                <h3 className="text-xl font-bold text-white mb-2">NFT Token ID</h3>
                <p className="text-gray-300 text-sm">
                  Required for the claiming process
                </p>
      </div>

      {/* NFT Token ID Input */}
              <div className="space-y-4">
                <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
                    🎨 Your NFT Token ID
        </label>
        <input
          type="text"
          value={nftTokenId}
          onChange={(e) => setNftTokenId(e.target.value)}
                    placeholder="Enter your NFT Token ID..."
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
        />
      </div>

                {/* Validation Message */}
                <div className={`p-3 rounded-lg text-sm ${
                  isStepValid(3) 
                    ? 'bg-green-900/20 border border-green-500/30 text-green-300'
                    : 'bg-red-900/20 border border-red-500/30 text-red-300'
                }`}>
                  {getStepValidationMessage(3)}
          </div>
            </div>
            </div>
          )}

          {/* Step 4: Review & Claim */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <div className="text-center mb-6">
                <div className="text-4xl mb-3">🎉</div>
                <h3 className="text-xl font-bold text-white mb-2">Review & Claim</h3>
                <p className="text-gray-300 text-sm">
                  Final review before claiming your tokens
                </p>
            </div>

              {/* Review Summary */}
              <div className="bg-gradient-to-r from-purple-900/20 to-blue-900/20 rounded-lg p-4 border border-purple-500/30">
                <h4 className="text-purple-300 font-semibold mb-3 flex items-center gap-2">
                  📋 Your Claim Summary
                </h4>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">Wallet Address:</span>
                    <span className="text-purple-400 font-mono text-sm">
                      {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-6)}` : 'Not set'}
                    </span>
            </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">TON Balance:</span>
                    <span className="text-green-400 font-semibold">{walletBalance} TON</span>
            </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">STK Amount:</span>
                    <span className="text-blue-400 font-semibold">{userStkAmount || '0'} STK</span>
              </div>
              
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">STKN Balance:</span>
                    <span className="text-purple-400 font-semibold">{userStknBalance || '0'} STKN</span>
                  </div>
             
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">Mining Balance:</span>
                    <span className="text-green-400 font-semibold">{userTotalStkMining || '0'} STK</span>
            </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">NFT Token ID:</span>
                    <span className="text-orange-400 font-semibold">{nftTokenId || 'Not set'}</span>
          </div>
                  
                  <div className="border-t border-gray-600 pt-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-300 font-semibold">Amount to Receive:</span>
                      <span className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-amber-500 animate-pulse">
                        {calculatedReceiveAmount.toLocaleString()} STK
                      </span>
        </div>
                  </div>
                </div>
              </div>

              {/* Payment Section */}
              <div className="bg-gradient-to-r from-blue-900/20 to-cyan-900/20 rounded-lg p-4 border border-blue-500/30">
                <div className="flex items-center justify-center">
                  {/* <div>
                    <div className="text-blue-300 font-semibold">Pay Claiming Fees to Finalize</div>
                    <div className="text-sm text-gray-300">Pay {PAYMENT_CONFIG.amountTon} TON to proceed</div>
                    <div className="text-xs text-gray-400 mt-1">address: <span className="font-mono">{PAYMENT_CONFIG.recipient.substring(0, 8)}...{PAYMENT_CONFIG.recipient.substring(PAYMENT_CONFIG.recipient.length - 6)}</span></div>
                    {paymentTxHash && (
                      <div className="text-xs text-green-400 mt-1">Tx: <span className="font-mono">{paymentTxHash.length > 18 ? `${paymentTxHash.substring(0, 10)}...${paymentTxHash.substring(paymentTxHash.length - 6)}` : paymentTxHash}</span></div>
                    )}
                  </div> */}
                  <button
                    onClick={handlePayTon}
                    disabled={isPaying || hasPaid}
                    className={`px-4 py-2 rounded-lg text-white text-lg font-semibold transition-all ${hasPaid ? 'bg-green-600 cursor-default' : 'bg-blue-600 hover:bg-blue-700'} disabled:opacity-50`}
                  >
                    {hasPaid ? '✅ Paid' : isPaying ? 'Processing...' : '💎 Confirm and Claim STK'}
                  </button>
                </div>
              </div>

              {/* Validation Message */}
              <div className={`p-3 rounded-lg text-sm ${
                isStepValid(4) 
                  ? 'bg-green-900/20 border border-green-500/30 text-green-300'
                  : 'bg-red-900/20 border border-red-500/30 text-red-300'
              }`}>
                {getStepValidationMessage(4)}
          </div>
        </div>
      )}

          {/* Wizard Navigation */}
          <div className="flex justify-between items-center pt-6 border-t border-gray-600">
            <button
              onClick={prevStep}
              disabled={currentStep === 0}
              className="px-6 py-3 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              ← Previous
            </button>

            {currentStep === wizardSteps.length - 1 ? (
      <button
        onClick={handleClaimTokens}
                disabled={!isStepValid(4) || isClaiming || !hasPaid}
                className="px-8 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-bold rounded-lg transition-all duration-200 transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center gap-2"
      >
        {isClaiming ? (
                  <>
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Claiming...
                  </>
        ) : (
                  <>
                    🎉 Finalize {calculatedReceiveAmount.toLocaleString()} STK
                  </>
        )}
      </button>
            ) : (
              <button
                onClick={nextStep}
                disabled={!isStepValid(currentStep)}
                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-semibold rounded-lg transition-all duration-200 transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center gap-2"
              >
                Next →
              </button>
            )}
              </div>
              </div>
      )}

      {/* Success Celebration */}
      {hasAlreadyClaimed && (
        <div className="text-center py-8">
          <div className="text-6xl mb-4 animate-bounce">🎉</div>
          <h2 className="text-2xl font-bold text-white mb-4">
            Congratulations! 🎊
          </h2>
          <p className="text-gray-300 mb-6">
            You have successfully claimed your STK tokens! This was a one-time claim opportunity.
          </p>

          {finalClaimedAmount !== null && (
            <div className="my-8 p-6 bg-gradient-to-br from-purple-900/50 to-green-900/50 rounded-2xl border-2 border-green-400/50 shadow-2xl shadow-green-500/20">
              <p className="text-xl text-center text-gray-300 mb-2">You have claimed:</p>
              <p className="text-6xl font-black text-center text-transparent bg-clip-text bg-gradient-to-r from-green-300 via-cyan-300 to-purple-400 animate-pulse tracking-tight">
                {finalClaimedAmount.toLocaleString()} STK
              </p>
            </div>
          )}

          <div className="bg-gradient-to-r from-green-900/20 to-emerald-900/20 rounded-lg p-4 border border-green-500/30">
            <p className="text-green-300 font-semibold">
              ✅ Claim completed successfully!
            </p>
            <p className="text-gray-300 text-sm mt-2">
              Check your order history for transaction details.
            </p>
              </div>
              </div>
      )}

      {/* Previous Rejection Info */}
      {userClaimStatus.hasRejectedClaims && !userClaimStatus.hasActiveClaims && (
        <div className="mb-6 p-4 bg-orange-900/20 border border-orange-500/30 rounded-lg">
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <span className="text-2xl">⚠️</span>
              <span className="text-orange-300 font-semibold">Previous Claim Rejected</span>
            </div>
            <p className="text-orange-300 text-sm mb-2">
              Your previous claim was rejected, but you can try again!
            </p>
            {userClaimStatus.rejectionReason && (
              <div className="bg-orange-800/20 rounded p-2 mt-2">
                <p className="text-orange-200 text-xs">
                  <strong>Reason:</strong> {userClaimStatus.rejectionReason}
                </p>
            </div>
            )}
            <p className="text-orange-200 text-xs mt-2">
              ✅ You can now submit a new claim
            </p>
          </div>
        </div>
      )}

      {/* Orders Tab Content */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          {/* Orders Header */}
          <div className="text-center">
            <h3 className="text-xl font-bold text-white mb-2">📋 My Order History</h3>
            <p className="text-gray-300 text-sm">
              View all your submitted faucet claims
            </p>
          </div>

          {/* Refresh Button */}
          <div className="flex justify-center">
            <button
              onClick={fetchUserOrders}
              disabled={loadingOrders}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {loadingOrders ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  Loading...
                </>
              ) : (
                <>
                  🔄 Refresh Orders
                </>
              )}
            </button>
          </div>

          {/* Orders List */}
          {userOrders.length > 0 ? (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {userOrders.map((order) => (
                <div
                  key={order.id}
                  className="p-4 bg-gray-800/30 rounded-lg border border-gray-600 hover:border-blue-500/50 transition-colors"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-green-400 font-bold">#{order.id}</span>
                      <span className="text-yellow-400 font-bold">
                        {order.claim_amount.toLocaleString()} STK
                      </span>
                    </div>
                    <span className="text-gray-400 text-xs">
                      {new Date(order.claimed_at).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Orderer identity and wallet */}
                  <div className="mb-2">
                    {(order.telegram_first_name || order.telegram_last_name || order.telegram_username) && (
                      <div className="text-sm text-gray-300">
                        <span className="text-white font-medium">
                          {(order.telegram_first_name || '') + (order.telegram_last_name ? ` ${order.telegram_last_name}` : '')}
                        </span>
                        {order.telegram_username && (
                          <span className="text-blue-400 ml-2">@{order.telegram_username}</span>
                        )}
                      </div>
                    )}
                    {order.wallet_address && (
                      <div className="text-xs text-purple-300 font-mono">
                        {order.wallet_address.substring(0, 8)}...{order.wallet_address.substring(-6)}
                      </div>
                    )}
                  </div>

                  {/* Status Badge */}
                  <div className="mb-3">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStatusBadge(order.approval_status, order.payment_status).className}`}>
                      {getStatusBadge(order.approval_status, order.payment_status).text}
                    </span>
                  </div>
                  
                  {/* <div className="grid grid-cols-1 gap-3 text-sm">
                    <div className="grid grid-cols-2 gap-2">
                    <div>
                        <span className="text-gray-400">Portfolio Value:</span>
                        <span className="text-cyan-400 ml-1 font-semibold">
                          ${order.portfolio_value?.toLocaleString() || '0'}
                      </span>
                    </div>
                    <div>
                        <span className="text-gray-400">TON Balance:</span>
                        <span className="text-yellow-400 ml-1 font-semibold">
                          {order.ton_balance?.toFixed(4) || '0.0000'} TON
                      </span>
                    </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-gray-400">STK Amount:</span>
                        <span className="text-blue-400 ml-1 font-semibold">
                          {order.stk_amount?.toLocaleString() || '0'} STK
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400">STKN Balance:</span>
                        <span className="text-green-400 ml-1 font-semibold">
                          {order.stkn_balance?.toLocaleString() || '0'} STKN
                      </span>
                    </div>
                  </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-gray-400">Mining Balance:</span>
                        <span className="text-orange-400 ml-1 font-semibold">
                          {order.total_stk_mining?.toLocaleString() || '0'} STK
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400">NFT Token ID:</span>
                        <span className="text-purple-400 ml-1 font-semibold font-mono">
                          {order.nft_token_id || 'Not provided'}
                        </span>
                      </div>
                    </div>
                    
                    <div>
                      <span className="text-gray-400">Wallet Address:</span>
                      <span className="text-purple-400 ml-1 font-mono text-xs break-all">
                        {order.wallet_address || 'Not provided'}
                      </span>
                    </div>
                  </div> */}

                  {/* Reward Breakdown */}
                  {order.reward_breakdown && typeof order.reward_breakdown === 'object' && (
                    <div className="mt-3 pt-3 border-t border-gray-600">
                      <div className="text-xs mb-2 text-gray-400 font-semibold">💰 Reward Breakdown:</div>
                      <div className="grid grid-cols-2 gap-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-blue-300">STK Reward:</span>
                          <span className="text-white">{order.reward_breakdown.stkReward?.toFixed(2) || '0.00'} STK</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-green-300">STKN Reward:</span>
                          <span className="text-white">{order.reward_breakdown.stknReward?.toFixed(2) || '0.00'} STK</span>
                        </div>
                        {/* <div className="flex justify-between">
                          <span className="text-orange-300">Mining Reward:</span>
                          <span className="text-white">{order.reward_breakdown.miningReward?.toFixed(2) || '0.00'} STK</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-yellow-300">TON Reward:</span>
                          <span className="text-white">{order.reward_breakdown.tonReward?.toFixed(2) || '0.00'} STK</span>
                        </div> */}
                      </div>
                      <div className="mt-1 pt-1 border-t border-gray-500">
                        <div className="flex justify-between text-xs">
                          <span className="text-purple-300 font-semibold">Total Base:</span>
                          <span className="text-white font-semibold">{order.reward_breakdown.totalBaseReward?.toFixed(2) || '0.00'} STK</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Payment Information */}
                  {(order.payment_tx_hash || order.payment_processed_at || order.rejection_reason || order.admin_notes) && (
                    <div className="mt-3 pt-3 border-t border-gray-600">
                      {order.payment_tx_hash && (
                        <div className="text-xs mb-1">
                          <span className="text-gray-400">Transaction:</span>
                          <span className="text-green-400 ml-1 font-mono break-all">
                            {order.payment_tx_hash.length > 20 ? 
                              `${order.payment_tx_hash.substring(0, 10)}...${order.payment_tx_hash.substring(-6)}` :
                              order.payment_tx_hash
                            }
                          </span>
                        </div>
                      )}
                      {order.payment_processed_at && (
                        <div className="text-xs mb-1">
                          <span className="text-gray-400">Paid:</span>
                          <span className="text-green-400 ml-1">
                            {new Date(order.payment_processed_at).toLocaleString()}
                          </span>
                        </div>
                      )}
                      {order.rejection_reason && (
                        <div className="text-xs mb-1">
                          <span className="text-gray-400">Rejection Reason:</span>
                          <span className="text-red-400 ml-1">
                            {order.rejection_reason}
                          </span>
                        </div>
                      )}
                      {order.admin_notes && (
                        <div className="text-xs mb-1">
                          <span className="text-gray-400">Admin Notes:</span>
                          <span className="text-blue-400 ml-1">
                            {order.admin_notes}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* <div className="mt-2 pt-2 border-t border-gray-600 flex justify-between items-center">
                    <span className="text-gray-500 text-xs">
                      Session: {order.session_id?.substring(0, 8) || 'N/A'}
                    </span>
                    <div className="flex gap-2">
                    <button
                      onClick={() => {
                        console.log('📋 ORDER DETAILS:', order);
                        showSnackbar('Order Details', `Order #${order.id} details logged to console`);
                      }}
                        className="px-2 py-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 text-xs rounded border border-blue-500/30 transition-colors"
                      >
                        📋 Console
                      </button>
                      <button
                        onClick={() => {
                          // Show detailed modal with all order information
                          const details = `
🎯 ORDER #${order.id} - DETAILED VIEW

👤 PLAYER INFORMATION:
• Name: ${order.telegram_first_name || 'N/A'} ${order.telegram_last_name || ''}
• Username: @${order.telegram_username || 'N/A'}
• Telegram ID: ${order.telegram_id || 'N/A'}

💰 PORTFOLIO DETAILS:
• Portfolio Value: $${order.portfolio_value?.toLocaleString() || '0'}
• TON Balance: ${order.ton_balance?.toFixed(4) || '0.0000'} TON
• STK Amount: ${order.stk_amount?.toLocaleString() || '0'} STK
• STKN Balance: ${order.stkn_balance?.toLocaleString() || '0'} STKN
• Mining Balance: ${order.total_stk_mining?.toLocaleString() || '0'} STK
• NFT Token ID: ${order.nft_token_id || 'Not provided'}

🎯 CLAIM INFORMATION:
• Claim Amount: ${order.claim_amount?.toLocaleString() || '0'} STK
• Approval Status: ${order.approval_status || 'Unknown'}
• Payment Status: ${order.payment_status || 'Unknown'}
• Network: ${order.network || 'Unknown'}

🔗 WALLET & SESSION:
• Wallet: ${order.wallet_address || 'Not provided'}
• Session ID: ${order.session_id || 'N/A'}

📅 TIMESTAMPS:
• Submitted: ${order.claimed_at ? new Date(order.claimed_at).toLocaleString() : 'N/A'}
• Approved: ${order.approved_at ? new Date(order.approved_at).toLocaleString() : 'Not approved'}

${order.rejection_reason ? `❌ REJECTION REASON:\n${order.rejection_reason}` : ''}
${order.admin_notes ? `📝 ADMIN NOTES:\n${order.admin_notes}` : ''}
${order.payment_tx_hash ? `🔗 TRANSACTION:\n${order.payment_tx_hash}` : ''}
${order.payment_processed_at ? `✅ PAYMENT DATE:\n${new Date(order.payment_processed_at).toLocaleString()}` : ''}
                          `;
                          showSnackbar('📋 Complete Order Details', details);
                        }}
                      className="px-2 py-1 bg-green-600/20 hover:bg-green-600/30 text-green-300 text-xs rounded border border-green-500/30 transition-colors"
                    >
                        📊 Full Details
                    </button>
                    </div>
                  </div> */}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-gray-400 mb-2">📭 No orders found</div>
              <p className="text-gray-500 text-sm">
                {loadingOrders ? 'Loading your orders...' : 'You haven\'t submitted any claims yet'}
              </p>
            </div>
          )}

          {/* Order Summary */}
          {userOrders.length > 0 && (
            <div className="mt-4 p-3 bg-blue-900/20 rounded-lg border border-blue-500/30">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="text-center">
                  <div className="text-blue-300">Total Orders</div>
                  <div className="text-white font-bold">{userOrders.length}</div>
                </div>
                <div className="text-center">
                  <div className="text-blue-300">Total Claimed</div>
                  <div className="text-white font-bold">
                    {userOrders.reduce((sum, order) => sum + (order.claim_amount || 0), 0).toLocaleString()} STK
                  </div>
                </div>
              </div>
              
              {/* Status Summary */}
              {/* <div className="mt-3 pt-3 border-t border-blue-500/30">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-yellow-300">Pending:</span>
                    <span className="text-white">
                      {userOrders.filter(o => o.approval_status === 'pending').length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-300">Approved:</span>
                    <span className="text-white">
                      {userOrders.filter(o => o.approval_status === 'approved').length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-300">Completed:</span>
                    <span className="text-white">
                      {userOrders.filter(o => o.payment_status === 'completed').length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-red-300">Rejected:</span>
                    <span className="text-white">
                      {userOrders.filter(o => o.approval_status === 'rejected').length}
                    </span>
                  </div>
                </div>
              </div> */}
              
              {/* Debug Information */}
              {/* <div className="mt-3 pt-3 border-t border-blue-500/30">
                <div className="text-center">
                  <button
                    onClick={() => {
                      console.log('🔍 ALL USER ORDERS DEBUG:', userOrders);
                      console.log('📊 ORDER DATA STRUCTURE:', userOrders.map(order => ({
                        id: order.id,
                        hasPortfolioValue: !!order.portfolio_value,
                        hasTonBalance: !!order.ton_balance,
                        hasStkAmount: !!order.stk_amount,
                        hasStknBalance: !!order.stkn_balance,
                        hasTotalStkMining: !!order.total_stk_mining,
                        hasNftTokenId: !!order.nft_token_id,
                        hasRewardBreakdown: !!order.reward_breakdown,
                        approvalStatus: order.approval_status,
                        paymentStatus: order.payment_status
                      })));
                      showSnackbar('Debug Info', 'Order data structure logged to console');
                    }}
                    className="px-3 py-1 bg-gray-600/20 hover:bg-gray-600/30 text-gray-300 text-xs rounded border border-gray-500/30 transition-colors"
                  >
                    🔍 Debug Data Structure
                  </button>
                </div>
              </div> */}
            </div>
          )}
      </div>
      )}
    </div>
  );
};

export default TGEComponent;