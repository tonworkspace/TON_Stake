import { useState, useEffect } from 'react';
import { useTonConnectUI } from '@tonconnect/ui-react';
import { toNano } from '@ton/core';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../hooks/useAuth';
import { useNotificationSystem } from './NotificationSystem';
import { 
  GiCrystalCluster, 
  GiDiamonds, 
  GiTrophy, 
  GiWallet, 
  GiCoins,
  GiCrystalBall,
  GiCrystalGrowth
} from 'react-icons/gi';

interface TokenOffering {
  id: number;
  tierName: string;
  description: string;
  totalTokens: number;
  pricePerToken: number;
  minPurchaseAmount: number; // Minimum purchase amount in USD
  maxPurchaseAmount: number; // Maximum purchase amount in USD
  image: string; // Image for the tier/offering
  status: 'active' | 'upcoming' | 'soldOut';
  soldAmount: number; // Amount sold for progress calculation
}

// Add these constants at the top of the file after imports
const MAINNET_DEPOSIT_ADDRESS = 'UQCgomX3IWH-wU7AhBhy5MTMQuDcBLm43itK51tuTIPYdFN3';
const TESTNET_DEPOSIT_ADDRESS = 'UQCgomX3IWH-wU7AhBhy5MTMQuDcBLm43itK51tuTIPYdFN3';
const isMainnet = true; // Toggle this for testing
const DEPOSIT_ADDRESS = isMainnet ? MAINNET_DEPOSIT_ADDRESS : TESTNET_DEPOSIT_ADDRESS;

// Add STK price constant
const STK_PRICE_USDT = 0.0025; // 1 STK = $0.0025 USDT

// Update the sendTonTransaction function to use tonConnectUI directly
const sendTonTransaction = async (amount: number, tonConnectUI: any) => {
  try {
    // More detailed validation
    console.log('sendTonTransaction called with amount:', amount, 'type:', typeof amount);
    
    if (typeof amount !== 'number') {
      throw new Error(`Amount must be a number, got: ${typeof amount}`);
    }
    
    if (isNaN(amount)) {
      throw new Error('Amount is NaN');
    }
    
    if (!isFinite(amount)) {
      throw new Error('Amount is not finite');
    }
    
    if (amount <= 0) {
      throw new Error(`Amount must be positive, got: ${amount}`);
    }
    
    // Convert to string with fixed precision to avoid floating point issues
    const amountString = amount.toFixed(9);
    console.log('Amount as string:', amountString);
    
    const amountInNano = toNano(amountString);
    console.log('Amount in nano:', amountInNano.toString());
    
    const transaction = {
      validUntil: Math.floor(Date.now() / 1000) + 60 * 20, // 20 minutes
      messages: [
        {
          address: DEPOSIT_ADDRESS,
          amount: amountInNano.toString(),
        },
      ],
    };

    // Use tonConnectUI directly like in the working example
    const result = await tonConnectUI.sendTransaction(transaction);
    return result;
  } catch (error) {
    console.error('TON transaction failed:', error);
    throw error;
  }
};

// Add this interface for the price data
interface PriceData {
  tonPrice: number;
  usdtPrice: number;
}

// Add this function to fetch TON price
const fetchTonPrice = async (): Promise<PriceData> => {
  try {
    // Using CoinGecko API to get TON price
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=usd');
    const data = await response.json();
    const tonPrice = data['the-open-network'].usd;
    
    // Get USDT price (usually 1, but we'll fetch it anyway)
    const usdtResponse = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=usd');
    const usdtData = await usdtResponse.json();
    const usdtPrice = usdtData.tether.usd;

    return { tonPrice, usdtPrice };
  } catch (error) {
    console.error('Error fetching prices:', error);
    // Fallback values in case of API failure
    return { tonPrice: 2.5, usdtPrice: 1 };
  }
};

// Add interface for purchase record
interface PurchaseRecord {
  id: string;
  user_id: string;
  offering_id: number;
  usdt_amount: number;
  ton_amount: number;
  tokens_purchased: number;
  tx_hash?: string;
  status: 'pending' | 'confirmed' | 'failed';
  created_at: string;
}

const SmartStore = () => {
  const [tonConnectUI] = useTonConnectUI();
  const { user, refreshSTKBalance } = useAuth();
  const { 
    showSystemNotification, 
    showRewardNotification, 
    showUpgradeNotification,
  } = useNotificationSystem();
  
  const [tokenOfferings] = useState<TokenOffering[]>([
    {
      id: 1,
      tierName: "Seed Voucher",
      description: "Exclusive entry point for the earliest believers. The lowest token price, limited supply, and maximum upside.",
      totalTokens: 10000000,
      pricePerToken: 0.0025,
      minPurchaseAmount: 5,
      maxPurchaseAmount: 5000,
      image: "/images/seed-voucher.jpg",
      status: "active",
      soldAmount: 0
    },    
    {
      id: 2,
      tierName: "Genesis Voucher",
      description: "The second wave for visionaries who missed the Seed. Still early, still powerful, before the world catches on.",
      totalTokens: 25000000,
      pricePerToken: 0.0055,
      minPurchaseAmount: 100,
      maxPurchaseAmount: 1000,
      image: "/images/genesis-voucher.jpg",
      status: "upcoming",
      soldAmount: 0
    },
    {
      id: 3,
      tierName: "Pioneer Voucher",
      description: "A chance for bold pioneers to join the mission. Price rises, but rewards and access remain strong.",
      totalTokens: 40000000,
      pricePerToken: 0.008,
      minPurchaseAmount: 250,
      maxPurchaseAmount: 2000,
      image: "/images/pioneer-voucher.jpg",
      status: "upcoming",
      soldAmount: 0
    },
    // {
    //   id: 4,
    //   tierName: "Visionary Voucher",
    //   description: "Reserved for those who see the future clearly. A higher commitment, a stronger position, and exclusive perks.",
    //   totalTokens: 50000000,
    //   pricePerToken: 0.012,
    //   minPurchaseAmount: 500,
    //   maxPurchaseAmount: 5000,
    //   image: "/images/visionary-voucher.jpg",
    //   status: "upcoming",
    //   soldAmount: 0
    // },
    // {
    //   id: 5,
    //   tierName: "Frontier Voucher",
    //   description: "The last stop before public launch. Higher price, limited availability, but still massive potential upside.",
    //   totalTokens: 30000000,
    //   pricePerToken: 0.018,
    //   minPurchaseAmount: 1000,
    //   maxPurchaseAmount: 10000,
    //   image: "/images/frontier-voucher.jpg",
    //   status: "upcoming",
    //   soldAmount: 0
    // }
    
  ]);

  // Add new state for purchase modal
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [selectedOffering, setSelectedOffering] = useState<TokenOffering | null>(null);
  const [purchaseAmount, setPurchaseAmount] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Notification system integrated - no need for manual snackbar state

  // Add new state for price data
  const [priceData, setPriceData] = useState<PriceData>({ tonPrice: 2.5, usdtPrice: 1 });
  const [isLoadingPrice, setIsLoadingPrice] = useState(true);

  // Add new state for wallet connection modal
  const [showWalletModal, setShowWalletModal] = useState(false);

  // Add state for purchase history
  const [purchaseHistory, setPurchaseHistory] = useState<PurchaseRecord[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [isHistoryVisible, setIsHistoryVisible] = useState(false);

  // Function to refresh purchase history
  const refreshPurchaseHistory = async () => {
    if (!tonConnectUI.connected || !tonConnectUI.account?.address) {
      setPurchaseHistory([]);
      return;
    }

    setIsHistoryLoading(true);
    try {
      const { data, error } = await supabase
        .from('token_purchases')
        .select('*')
        .eq('user_id', tonConnectUI.account.address)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to fetch purchase history:', error);
        setPurchaseHistory([]);
      } else {
        setPurchaseHistory(data || []);
      }
    } catch (error) {
      console.error('Error fetching purchase history:', error);
      setPurchaseHistory([]);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  // Add useEffect to fetch purchase history
  useEffect(() => {
    refreshPurchaseHistory();
  }, [tonConnectUI.connected, tonConnectUI.account?.address]);

  // Add useEffect to fetch price data
  useEffect(() => {
    const loadPrices = async () => {
      setIsLoadingPrice(true);
      try {
        const prices = await fetchTonPrice();
        const oldTonPrice = priceData.tonPrice;
        setPriceData(prices);
        
        // Show notification for significant price changes (only after initial load)
        if (oldTonPrice > 0 && Math.abs(prices.tonPrice - oldTonPrice) / oldTonPrice > 0.05) {
          const change = ((prices.tonPrice - oldTonPrice) / oldTonPrice * 100).toFixed(1);
          const isIncrease = prices.tonPrice > oldTonPrice;
          showNotification(
            `📈 TON Price ${isIncrease ? 'Increased' : 'Decreased'}`,
            `${isIncrease ? '+' : ''}${change}% - Now $${prices.tonPrice.toFixed(2)}`,
            isIncrease ? 'success' : 'info'
          );
        }
      } catch (error) {
        console.error('Failed to load prices:', error);
        showNotification('Price Error', 'Failed to load current prices', 'warning');
      } finally {
        setIsLoadingPrice(false);
      }
    };

    loadPrices();
    // Refresh prices every 5 minutes
    const interval = setInterval(loadPrices, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Helper function using notification system
  const showNotification = (message: string, description: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    showSystemNotification(message, description, type);
  };

  // Update the refreshUserBalance function to use the auth hook
  const refreshUserBalance = async () => {
    if (!tonConnectUI.connected || !tonConnectUI.account?.address) return;

    try {
      // Update the user's wallet address if it's not set
      if (user && user.wallet_address !== tonConnectUI.account.address) {
        await supabase
          .from('users')
          .update({ wallet_address: tonConnectUI.account.address })
          .eq('telegram_id', user.telegram_id);
      }

      // Refresh STK balance using the auth hook
      await refreshSTKBalance();
      
      // Show success notification for manual balance refresh
      showNotification('💎 Balance Refreshed', 'Your voucher balance has been updated', 'success');
    } catch (error) {
      console.error('Error refreshing balance:', error);
      showNotification('Refresh Error', 'Failed to refresh balance', 'error');
    }
  };

  // Modify handlePurchase to check wallet connection first
  const handlePurchase = (offeringId: number) => {
    if (!tonConnectUI.connected) {
      setShowWalletModal(true);
      return;
    }

    const offering = tokenOfferings.find(o => o.id === offeringId);
    if (offering) {
      setSelectedOffering(offering);
      setIsPurchaseModalOpen(true);
    }
  };

  const handlePurchaseSubmit = async () => {
    if (!selectedOffering || !purchaseAmount) return;
    
    const amount = parseFloat(purchaseAmount);
    console.log('=== Starting Purchase Process ===');
    console.log('Parsed amount:', amount, 'type:', typeof amount);
    console.log('Selected offering:', selectedOffering);
    console.log('Current user:', user);
    
    if (isNaN(amount)) {
      showNotification('Invalid Amount', 'Please enter a valid number', 'error');
      return;
    }

    // Validate purchase amount
    if (amount < selectedOffering.minPurchaseAmount || amount > selectedOffering.maxPurchaseAmount) {
      showNotification(
        'Invalid Amount',
        `Purchase amount must be between ${selectedOffering.minPurchaseAmount} and ${selectedOffering.maxPurchaseAmount} USDT`,
        'error'
      );
      return;
    }

    setIsProcessing(true);
    let purchaseId: string | null = null;
    
    try {
      // Check if wallet is connected
      if (!tonConnectUI.connected) {
        showNotification(
          'Wallet Not Connected',
          'Please connect your wallet first',
          'error'
        );
        return;
      }

      // Get user info
      const userWalletAddress = tonConnectUI.account?.address;
      if (!userWalletAddress) {
        showNotification('User Error', 'Unable to get user information', 'error');
        return;
      }

      console.log('User wallet address:', userWalletAddress);

      // Validate price data
      console.log('Price data:', priceData);
      
      if (!priceData.tonPrice || !priceData.usdtPrice || priceData.tonPrice <= 0 || priceData.usdtPrice <= 0) {
        showNotification(
          'Price Data Error',
          'Unable to fetch current prices. Please try again.',
          'error'
        );
        return;
      }

      // Calculate TON amount using real rates
      const tonAmount = (amount * priceData.usdtPrice) / priceData.tonPrice;
      const tokensPurchased = amount / selectedOffering.pricePerToken;
      
      console.log('Purchase calculation:', {
        usdtAmount: amount,
        usdtPrice: priceData.usdtPrice,
        tonPrice: priceData.tonPrice,
        calculatedTonAmount: tonAmount,
        tokensPurchased: tokensPurchased
      });
      
      // Validate TON amount
      if (isNaN(tonAmount) || !isFinite(tonAmount) || tonAmount <= 0) {
        showNotification(
          'Calculation Error',
          `Unable to calculate TON amount. Result: ${tonAmount}`,
          'error'
        );
        return;
      }
      
      if (tonAmount < 0.1) {
        showNotification(
          'Invalid Amount',
          'Minimum purchase amount is too low',
          'error'
        );
        return;
      }

      // Generate unique purchase ID
      purchaseId = `purchase_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Create pending purchase record
      const purchaseRecord: PurchaseRecord = {
        id: purchaseId,
        user_id: userWalletAddress,
        offering_id: selectedOffering.id,
        usdt_amount: amount,
        ton_amount: tonAmount,
        tokens_purchased: tokensPurchased,
        status: 'pending',
        created_at: new Date().toISOString()
      };

      console.log('Creating purchase record:', purchaseRecord);

      // Insert pending purchase into database
      const { error: insertError } = await supabase
        .from('token_purchases')
        .insert([purchaseRecord]);

      if (insertError) {
        console.error('Failed to create purchase record:', insertError);
        showNotification('Database Error', 'Failed to create purchase record', 'error');
        return;
      }
      
      console.log('Purchase record created successfully');
      
      // Send TON transaction
      console.log('Sending TON transaction...');
      const result = await sendTonTransaction(tonAmount, tonConnectUI);

      if (result) {
        console.log('TON transaction successful:', result);
        
        // Update purchase record with transaction hash and status
        const { error: updateError } = await supabase
          .from('token_purchases')
          .update({ 
            status: 'confirmed',
            tx_hash: result.boc || result.hash
          })
          .eq('id', purchaseId);

        if (updateError) {
          console.error('Failed to update purchase record:', updateError);
        }

        console.log('Processing token allocation...');
        // Process the token allocation
        await processTokenAllocation(userWalletAddress, tokensPurchased, selectedOffering.id);

        console.log('Refreshing user balance...');
        // Refresh the balance from the DB to get the confirmed new value
        await refreshUserBalance();

        console.log('Refreshing purchase history...');
        // Refresh purchase history
        await refreshPurchaseHistory();

        // Show success notification with reward animation
        showRewardNotification(
          '💎 Voucher Purchase Successful!',
          tokensPurchased,
          'STK Vouchers'
        );
        
        // Also show upgrade-style notification for the transaction
        showUpgradeNotification(
          `${tokensPurchased.toFixed(2)} STK Vouchers Acquired`,
          tonAmount
        );
        
        setIsPurchaseModalOpen(false);
        setPurchaseAmount('');
        console.log('=== Purchase Process Completed Successfully ===');
      }
    } catch (error) {
      console.error('Purchase failed:', error);
      
      // Update purchase record as failed if we have a purchase ID
      if (purchaseId) {
        await supabase
          .from('token_purchases')
          .update({ status: 'failed' })
          .eq('id', purchaseId);
      }
      
      showNotification(
        'Purchase Failed',
        error instanceof Error ? error.message : 'Please try again later',
        'error'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  // Update the processTokenAllocation function to use the authenticated user
  const processTokenAllocation = async (userId: string, tokenAmount: number, offeringId: number) => {
    try {
      console.log('Starting token allocation process...');
      console.log('User ID (wallet address):', userId);
      console.log('Token amount to allocate:', tokenAmount);
      console.log('Offering ID:', offeringId);
      console.log('Current auth user:', user);

      // Use the authenticated user from the auth hook
      if (!user || !user.id) {
        console.error('No authenticated user found');
        return;
      }

      console.log('Current user data:', user);
      console.log('Current STK balance:', user.total_sbt);

      // Update user's STK token balance
      const currentSTK = user.total_sbt || 0;
      const newSTKBalance = currentSTK + tokenAmount;

      console.log('New STK balance will be:', newSTKBalance);

      // Update the user's wallet address if it's different
      if (user.wallet_address !== userId) {
        const { error: walletUpdateError } = await supabase
          .from('users')
          .update({ wallet_address: userId })
          .eq('id', user.id);

        if (walletUpdateError) {
          console.error('Failed to update wallet address:', walletUpdateError);
        }
      }

      // Update the STK balance
      const { error: balanceError } = await supabase
        .from('users')
        .update({ 
          total_sbt: newSTKBalance,
          last_sbt_claim: new Date().toISOString()
        })
        .eq('id', user.id);

      if (balanceError) {
        console.error('Failed to update user STK balance:', balanceError);
        return;
      }

      console.log('Successfully updated STK balance in database');

      // Log the STK earning in earning_history
      const { error: logError } = await supabase
        .from('earning_history')
        .insert({
          user_id: user.id,
          amount: tokenAmount,
          type: 'token_purchase',
          created_at: new Date().toISOString()
        });

      if (logError) {
        console.error('Failed to log STK earning:', logError);
      }

      // Log in SBT history (since we're using total_sbt for STK)
      const { error: sbtError } = await supabase
        .from('sbt_history')
        .insert({
          user_id: user.id,
          amount: tokenAmount,
          type: 'token_purchase',
          timestamp: new Date().toISOString()
        });

      if (sbtError) {
        console.error('Failed to log SBT history:', sbtError);
      }

      // Update offering sold amount (if token_offerings table exists)
      try {
        const { error: offeringError } = await supabase
          .from('token_offerings')
          .update({ 
            sold_amount: tokenAmount 
          })
          .eq('id', offeringId);

        if (offeringError) {
          console.error('Failed to update offering:', offeringError);
        }
      } catch (error) {
        console.log('token_offerings table might not exist, skipping update');
      }

      console.log(`Successfully allocated ${tokenAmount} STK tokens to user ${user.id}`);

      // Refresh the auth user data to reflect the new balance
      console.log('Refreshing auth user data...');
      await refreshSTKBalance();
      
      // Verify the update by fetching the user data again
      const { data: verifyUser, error: verifyError } = await supabase
        .from('users')
        .select('total_sbt')
        .eq('id', user.id)
        .single();

      if (verifyError) {
        console.error('Failed to verify STK balance update:', verifyError);
      } else {
        console.log('Verified STK balance after update:', verifyUser.total_sbt);
      }

    } catch (error) {
      console.error('Token allocation failed:', error);
    }
  };

  // Add useEffect to update wallet address when connected
  useEffect(() => {
    const updateWalletAddress = async () => {
      if (tonConnectUI.connected && tonConnectUI.account?.address && user) {
        try {
          // Only update if the wallet address is different
          if (user.wallet_address !== tonConnectUI.account.address) {
            console.log('Updating wallet address in database...');
            const { error } = await supabase
              .from('users')
              .update({ wallet_address: tonConnectUI.account.address })
              .eq('telegram_id', user.telegram_id);

            if (error) {
              console.error('Failed to update wallet address:', error);
              showNotification('Connection Error', 'Failed to update wallet address', 'error');
            } else {
              console.log('Wallet address updated successfully');
              showNotification(
                '🔗 Wallet Connected', 
                `Connected to ${tonConnectUI.account.address.slice(0, 8)}...${tonConnectUI.account.address.slice(-6)}`, 
                'success'
              );
              // Refresh user data to get the updated wallet address
              await refreshSTKBalance();
            }
          }
        } catch (error) {
          console.error('Error updating wallet address:', error);
          showNotification('Connection Error', 'Failed to connect wallet', 'error');
        }
      }
    };

    updateWalletAddress();
  }, [tonConnectUI.connected, tonConnectUI.account?.address, user?.telegram_id, user?.wallet_address]);

  // Enhanced Modal Backdrop Component
  const ModalBackdrop = ({ children, onClose }: { children: React.ReactNode; onClose: () => void }) => (
    <div 
      className="fixed inset-0 flex items-center justify-center p-4 z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" aria-hidden="true" />
      <div className="relative max-w-md w-full transform transition-all duration-300 ease-out scale-100 opacity-100">
        {children}
      </div>
    </div>
  );

  // Enhanced Modal Card Component
  const ModalCard = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
    <div 
      className={`
        relative overflow-hidden rounded-2xl
        shadow-[0_0_40px_rgba(6,182,212,0.15)]
        border border-cyan-500/30
        bg-gradient-to-br from-gray-800/95 via-gray-900/95 to-black/95
        backdrop-blur-2xl
        ${className}
      `}
    >
      {/* Animated gradient border */}
      <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 via-purple-500/20 to-cyan-500/20 opacity-30 animate-gradient-x" />
      
      {/* Content container */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );

  // Enhanced wallet modal
  const renderWalletModal = () => {
    if (!showWalletModal) return null;

    return (
      <ModalBackdrop onClose={() => setShowWalletModal(false)}>
        <ModalCard>
          <div className="p-6">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center border border-cyan-400/30">
                    <GiWallet size={20} className="text-cyan-400" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-cyan-400 rounded-full animate-ping opacity-75" />
                </div>
                <div>
                  <h2 className="text-lg font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                    Connect Wallet
                  </h2>
                  <p className="text-sm text-gray-400">Secure TON wallet connection</p>
                </div>
              </div>
              <button 
                onClick={() => setShowWalletModal(false)}
                className="rounded-lg p-2 text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-gradient-to-br from-white/5 to-white/0 border border-white/10">
                <p className="text-gray-300 text-sm leading-relaxed">
                  Connect your TON wallet to access exclusive features:
                </p>
                <ul className="mt-3 space-y-2">
                  {[
                    "Purchase Stakers Token Voucher",
                    "Track your investments",
                    "Access special offerings",
                    "Manage your portfolio"
                  ].map((feature, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-gray-400">
                      <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => {
                    tonConnectUI.connectWallet();
                    setShowWalletModal(false);
                  }}
                  className="w-full py-3 px-4 rounded-xl
                    bg-gradient-to-r from-cyan-500 to-purple-600
                    hover:from-cyan-400 hover:to-purple-500
                    text-white font-bold
                    transform transition-all duration-200
                    hover:scale-[1.02] active:scale-[0.98]
                    shadow-[0_8px_16px_rgba(6,182,212,0.3)]
                    disabled:opacity-50 disabled:cursor-not-allowed
                    flex items-center justify-center gap-2"
                >
                  <span>💎</span>
                  Connect TON Wallet
                  <span>⚡</span>
                </button>

                <button
                  onClick={() => setShowWalletModal(false)}
                  className="w-full py-3 px-4 rounded-xl
                    border border-gray-600/50
                    text-gray-400 font-medium
                    hover:bg-white/5 hover:text-gray-300
                    transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </ModalCard>
      </ModalBackdrop>
    );
  };

  // Enhanced purchase modal
  const renderPurchaseModal = () => {
    if (!isPurchaseModalOpen || !selectedOffering) return null;

    const calculatedTokens = purchaseAmount ? parseFloat(purchaseAmount) / selectedOffering.pricePerToken : 0;
    const calculatedValue = calculatedTokens * STK_PRICE_USDT;

    return (
      <ModalBackdrop onClose={() => setIsPurchaseModalOpen(false)}>
        <ModalCard>
          <div className="p-6">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-cyan-500/20 flex items-center justify-center border border-purple-400/30">
                    <GiCrystalGrowth size={20} className="text-purple-400" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-purple-400 rounded-full animate-ping opacity-75" />
                </div>
                <div>
                  <h2 className="text-lg font-bold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
                    Purchase Vouchers
                  </h2>
                  <p className="text-sm text-gray-400">{selectedOffering.tierName}</p>
                </div>
              </div>
              <button 
                onClick={() => setIsPurchaseModalOpen(false)}
                className="rounded-lg p-2 text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                disabled={isProcessing}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="space-y-6">
              {/* Tier Info */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-white/5 to-white/0 border border-white/10">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm text-gray-400">Price per Voucher</span>
                  <span className="text-sm font-bold text-white">
                    ${selectedOffering.pricePerToken.toFixed(4)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Available Supply</span>
                  <span className="text-sm font-bold text-white">
                    {selectedOffering.totalTokens.toLocaleString()} STK
                  </span>
                </div>
              </div>

              {/* Purchase Amount Input */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-300">
                  Purchase Amount
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={purchaseAmount}
                    onChange={(e) => setPurchaseAmount(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl
                      bg-white/5 border border-white/10
                      text-white placeholder-gray-500
                      focus:outline-none focus:ring-2 focus:ring-cyan-400/50
                      transition-all"
                    placeholder="Enter amount in USDT"
                    min={selectedOffering.minPurchaseAmount}
                    max={selectedOffering.maxPurchaseAmount}
                    disabled={isProcessing}
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                    USDT
                  </div>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Min: {selectedOffering.minPurchaseAmount} USDT</span>
                  <span>Max: {selectedOffering.maxPurchaseAmount} USDT</span>
                </div>
              </div>

              {/* Purchase Summary */}
              {purchaseAmount && !isNaN(calculatedTokens) && (
                <div className="p-4 rounded-xl bg-gradient-to-br from-cyan-500/10 to-purple-500/10 border border-cyan-400/20">
                  <h3 className="text-sm font-medium text-gray-300 mb-3">Purchase Summary</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-400">You'll Receive</span>
                      <span className="text-sm font-bold text-white">
                        {calculatedTokens.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })} STK
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-400">Estimated Value</span>
                      <span className="text-sm font-bold text-cyan-400">
                        ${calculatedValue.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}
                      </span>
                    </div>
                    <div className="pt-2 mt-2 border-t border-white/10">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500">Current TON Price</span>
                        <span className="text-xs text-gray-400">${priceData.tonPrice.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-xs text-gray-500">Required TON</span>
                        <span className="text-xs text-cyan-400">
                          {((parseFloat(purchaseAmount) * priceData.usdtPrice) / priceData.tonPrice).toFixed(4)} TON
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-3">
                <button
                  onClick={handlePurchaseSubmit}
                  disabled={isProcessing || !purchaseAmount}
                  className="w-full py-3 px-4 rounded-xl
                    bg-gradient-to-r from-cyan-500 to-purple-600
                    hover:from-cyan-400 hover:to-purple-500
                    text-white font-bold
                    transform transition-all duration-200
                    hover:scale-[1.02] active:scale-[0.98]
                    shadow-[0_8px_16px_rgba(6,182,212,0.3)]
                    disabled:opacity-50 disabled:cursor-not-allowed
                    flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Processing...
                    </>
                  ) : (
                    <>
                      <span>💎</span>
                      Confirm Purchase
                      <span>⚡</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => setIsPurchaseModalOpen(false)}
                  disabled={isProcessing}
                  className="w-full py-3 px-4 rounded-xl
                    border border-gray-600/50
                    text-gray-400 font-medium
                    hover:bg-white/5 hover:text-gray-300
                    transition-colors
                    disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </ModalCard>
      </ModalBackdrop>
    );
  };

  // Compact Futuristic Loading state
  if (isLoadingPrice) {
    return (
      <div className="w-full flex items-center justify-center p-3 min-h-[200px]">
        <div className="flex flex-col items-center space-y-3 max-w-xs w-full">
          {/* Compact Loading Animation */}
          <div className="relative">
            <div className="relative w-12 h-12">
              {/* Main Core */}
              <div className="absolute inset-0 backdrop-blur-xl bg-gradient-to-br from-cyan-500/20 via-purple-500/15 to-blue-600/20 rounded-full border border-cyan-400/30 shadow-[0_0_20px_rgba(6,182,212,0.4)] animate-pulse"></div>
              
              {/* Inner Voucher */}
              <div className="relative w-full h-full flex items-center justify-center">
                <GiCrystalCluster size={20} className="text-cyan-400 animate-bounce drop-shadow-[0_0_8px_currentColor]" />
              </div>
              
              {/* Orbiting Energy Particles */}
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="absolute w-1.5 h-1.5 rounded-full shadow-lg"
                  style={{
                    top: '50%',
                    left: '50%',
                    background: `linear-gradient(45deg, 
                      hsl(${180 + i * 45}, 70%, 60%), 
                      hsl(${220 + i * 45}, 70%, 70%)
                    )`,
                    transform: `rotate(${i * 90}deg) translateX(25px)`,
                    animation: `orbit ${2 + i * 0.1}s linear infinite`,
                    animationDelay: `${i * 0.15}s`,
                    boxShadow: '0 0 10px currentColor'
                  }}
                />
              ))}
              
              {/* Pulsing Aura */}
              <div className="absolute -inset-2 rounded-full blur-xl animate-ping" style={{ animationDuration: '2s' }}></div>
            </div>
          </div>

          {/* Compact Loading Message */}
          <div className="text-center space-y-2 backdrop-blur-xl rounded-lg p-3 border border-cyan-500/20">
            <div className="text-xs text-cyan-400 font-bold tracking-wide animate-pulse">
              ⚡ VOUCHER MARKET ⚡
            </div>
            <div className="text-[10px] text-purple-300 font-medium">
              💎 Syncing prices...
            </div>
            
            {/* Compact Loading Bar */}
            <div className="w-full bg-gray-700/50 rounded-full h-0.5 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-cyan-400 to-purple-500 rounded-full animate-pulse"></div>
            </div>
          </div>
        </div>
        
        {/* Animated CSS for orbit */}
        <style>{`
          @keyframes orbit {
            0% {
              transform: rotate(0deg) translateX(25px);
              opacity: 0.6;
            }
            50% {
              opacity: 1;
            }
            100% {
              transform: rotate(360deg) translateX(25px);
              opacity: 0.6;
            }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="w-full relative overflow-hidden p-custom">
      {/* Background Effects */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Animated Mesh Background */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/8 via-purple-500/4 to-blue-500/6 animate-pulse" style={{ animationDuration: '8s' }} />
          <div className="absolute inset-0 bg-gradient-to-tl from-pink-500/4 via-transparent to-emerald-500/6 animate-pulse" style={{ animationDuration: '12s', animationDelay: '2s' }} />
        </div>
        
        {/* Compact Floating Energy Particles */}
        {[...Array(8)].map((_, i) => (
          <div
            key={`float-${i}`}
            className="absolute rounded-full animate-float opacity-30"
            style={{
              width: `${Math.random() * 3 + 1}px`,
              height: `${Math.random() * 3 + 1}px`,
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              background: `linear-gradient(45deg, 
                hsl(${Math.random() * 60 + 180}, 70%, 60%), 
                hsl(${Math.random() * 60 + 240}, 70%, 70%)
              )`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${Math.random() * 4 + 6}s`,
              boxShadow: '0 0 10px currentColor'
            }}
          />
        ))}
      </div>

      <div className="w-full max-w-4xl space-y-3 relative z-10">
        {/* Compact wallet connection banner */}
        {!tonConnectUI.connected && (
          <div className="backdrop-blur-xl bg-gradient-to-br from-gray-800/60 via-gray-900/40 to-black/60 rounded-xl p-4 border border-cyan-500/30 shadow-[0_4px_16px_0_rgba(0,0,0,0.4)] hover:shadow-[0_8px_24px_0_rgba(6,182,212,0.3)] transition-all duration-300 transform hover:scale-[1.01]">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="relative">
                <div className="w-10 h-10 backdrop-blur-sm bg-gradient-to-br from-cyan-500/20 to-purple-600/20 rounded-full flex items-center justify-center border border-cyan-400/30">
                  <GiWallet size={18} className="text-cyan-400 drop-shadow-[0_0_8px_currentColor]" />
                </div>
                <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-gradient-to-br from-red-400 to-orange-500 rounded-full animate-ping"></div>
              </div>
              <div className="text-center">
                <h3 className="text-sm font-bold text-cyan-300 mb-1 tracking-wide">⚡ WALLET CONNECTION ⚡</h3>
                <p className="text-purple-300 text-xs">Connect TON wallet for STK Voucher offerings</p>
              </div>
            </div>
            <div className="flex justify-center">
              <button
                onClick={() => setShowWalletModal(true)}
                className="px-4 py-2 bg-gradient-to-r from-cyan-500 via-purple-500 to-blue-600 hover:from-cyan-400 hover:via-purple-400 hover:to-blue-500 text-white rounded-lg text-sm font-bold transition-all duration-300 transform hover:scale-105 shadow-[0_4px_16px_0_rgba(6,182,212,0.3)] border border-cyan-400/50 backdrop-blur-sm"
              >
                <div className="flex items-center gap-2">
                  <span>💎</span>
                  <span>CONNECT</span>
                  <span>⚡</span>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Compact Price Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="backdrop-blur-xl bg-gradient-to-br from-cyan-500/10 via-blue-500/5 to-purple-500/10 rounded-xl p-3 border border-cyan-400/30 shadow-[0_4px_16px_0_rgba(0,0,0,0.4)] hover:shadow-[0_8px_24px_0_rgba(6,182,212,0.2)] transition-all duration-300 transform hover:scale-105 relative overflow-hidden">
            {/* Glowing border effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-transparent to-cyan-500/10 animate-pulse" style={{ animationDuration: '3s' }}></div>
            
            <div className="flex items-center justify-between relative z-10">
              <div>
                <h3 className="text-xs text-cyan-300 font-bold mb-1 tracking-wide">TON PRICE</h3>
                <p className="text-lg font-bold text-white drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]">
                  ${priceData.tonPrice.toFixed(2)}
                </p>
                <div className="text-[10px] text-cyan-400 mt-0.5">⚡ LIVE</div>
              </div>
              <div className="relative">
                <div className="w-8 h-8 backdrop-blur-sm bg-gradient-to-br from-cyan-500/20 to-blue-600/20 rounded-full flex items-center justify-center border border-cyan-400/40">
                  <GiCoins size={16} className="text-cyan-400 drop-shadow-[0_0_6px_currentColor]" />
                </div>
                <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-cyan-400 rounded-full animate-ping opacity-75"></div>
              </div>
            </div>
          </div>

          <div className="backdrop-blur-xl bg-gradient-to-br from-purple-500/10 via-pink-500/5 to-blue-500/10 rounded-xl p-3 border border-purple-400/30 shadow-[0_4px_16px_0_rgba(0,0,0,0.4)] hover:shadow-[0_8px_24px_0_rgba(147,51,234,0.2)] transition-all duration-300 transform hover:scale-105 relative overflow-hidden">
            {/* Glowing border effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 via-transparent to-purple-500/10 animate-pulse" style={{ animationDuration: '4s', animationDelay: '1s' }}></div>
            
            <div className="flex items-center justify-between relative z-10">
              <div>
                <h3 className="text-xs text-purple-300 font-bold mb-1 tracking-wide">STK PRICE</h3>
                <p className="text-lg font-bold text-white drop-shadow-[0_0_8px_rgba(147,51,234,0.5)]">
                  ${STK_PRICE_USDT.toFixed(4)}
                </p>
                <div className="text-[10px] text-purple-400 mt-0.5">💎 VOUCHER</div>
              </div>
              <div className="relative">
                <div className="w-8 h-8 backdrop-blur-sm bg-gradient-to-br from-purple-500/20 to-pink-600/20 rounded-full flex items-center justify-center border border-purple-400/40">
                  <GiDiamonds size={16} className="text-purple-400 drop-shadow-[0_0_6px_currentColor]" />
                </div>
                <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-purple-400 rounded-full animate-ping opacity-75"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Compact User Balance Card */}
        {tonConnectUI.connected && user && (
          <div className="backdrop-blur-xl bg-gradient-to-br from-gray-800/60 via-gray-900/40 to-black/60 rounded-xl p-4 border border-cyan-500/30 shadow-[0_4px_16px_0_rgba(0,0,0,0.4)] hover:shadow-[0_8px_24px_0_rgba(6,182,212,0.2)] transition-all duration-300 transform hover:scale-[1.01] relative overflow-hidden">
            {/* Animated background effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 via-purple-500/3 to-blue-500/5 animate-pulse" style={{ animationDuration: '6s' }}></div>
            
            <div className="flex items-center justify-between mb-4 relative z-10">
              <h3 className="text-sm font-bold text-cyan-300 flex items-center gap-2 tracking-wide">
                <div className="relative">
                  <GiCrystalBall size={16} className="text-cyan-400 drop-shadow-[0_0_8px_currentColor]" />
                  <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-cyan-400 rounded-full animate-ping"></div>
                </div>
                ⚡ TON VOUCHER ⚡
              </h3>
              <button
                onClick={refreshUserBalance}
                className="w-8 h-8 backdrop-blur-sm bg-gradient-to-br from-cyan-500/20 to-purple-600/20 rounded-full flex items-center justify-center hover:from-cyan-400/30 hover:to-purple-500/30 transition-all duration-300 border border-cyan-400/40 group"
              >
                <svg className="w-4 h-4 text-cyan-400 group-hover:text-cyan-300 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
            
            <div className="backdrop-blur-sm bg-gradient-to-br from-white/5 to-white/2 rounded-lg p-4 border border-cyan-400/20 relative z-10">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-cyan-300 font-bold mb-1 tracking-wide text-xs">💎 AVAILABLE STK</p>
                  <p className="text-xl font-bold text-white drop-shadow-[0_0_10px_rgba(6,182,212,0.5)]">
                    {(user.total_sbt || 0).toLocaleString(undefined, { 
                      minimumFractionDigits: 2, 
                      maximumFractionDigits: 2 
                    })}
                  </p>
                  <div className="text-[10px] text-cyan-400 mt-0.5 opacity-80">VOUCHERS</div>
                </div>
                <div className="text-right">
                  <p className="text-purple-300 font-bold mb-1 tracking-wide text-xs">⚡ VALUE USDT</p>
                  <p className="text-lg font-bold text-white drop-shadow-[0_0_10px_rgba(147,51,234,0.5)]">
                    ${((user.total_sbt || 0) * STK_PRICE_USDT).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}
                  </p>
                  <div className="text-[10px] text-purple-400 mt-0.5 opacity-80">MARKET</div>
                </div>
              </div>
              
              {/* Compact divider */}
              <div className="my-3 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent animate-pulse"></div>
              
              {/* Compact stats */}
              <div className="flex justify-center">
                <div className="text-center">
                  <div className="text-[10px] text-gray-400 mb-0.5">POWER LVL</div>
                  <div className="text-sm font-bold text-cyan-300">
                    {Math.floor((user.total_sbt || 0) / 1000) + 1}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Compact Crystal Offerings */}
        <div className="backdrop-blur-xl bg-gradient-to-br from-gray-800/60 via-gray-900/40 to-black/60 rounded-xl p-4 border border-cyan-500/30 shadow-[0_4px_16px_0_rgba(0,0,0,0.4)] relative overflow-hidden">
          {/* Animated background effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/3 via-purple-500/2 to-blue-500/3 animate-pulse" style={{ animationDuration: '8s' }}></div>
          
          <div className="flex items-center justify-between mb-4 relative z-10">
            <h3 className="text-sm font-bold text-cyan-300 flex items-center gap-2 tracking-wide">
              <div className="relative">
                <GiCrystalGrowth size={16} className="text-cyan-400 drop-shadow-[0_0_8px_currentColor]" />
                <div className="absolute -inset-0.5 bg-cyan-400/20 rounded-full blur-sm animate-ping" style={{ animationDuration: '2s' }}></div>
              </div>
              ⚡ STK VOUCHER OFFERINGS ⚡
            </h3>
            <div className="backdrop-blur-sm bg-gradient-to-r from-cyan-500/20 to-purple-500/20 rounded-full px-3 py-1 border border-cyan-400/30">
              <div className="text-xs text-cyan-300 font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
                {tokenOfferings.filter(o => o.status === 'active').length} ACTIVE
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 relative z-10">
            {tokenOfferings.map((offering) => (
              <div 
                key={offering.id} 
                className="backdrop-blur-xl bg-gradient-to-br from-gray-800/40 via-gray-900/30 to-black/40 rounded-xl p-4 border border-cyan-400/20 shadow-[0_4px_16px_0_rgba(0,0,0,0.3)] hover:shadow-[0_8px_24px_0_rgba(6,182,212,0.2)] transition-all duration-300 transform hover:scale-105 relative overflow-hidden group"
              >
                {/* Holographic glow effect on hover */}
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 via-purple-500/3 to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 animate-pulse"></div>
                
                <div className="flex items-center justify-between mb-3 relative z-10">
                  <h3 className="text-sm font-bold text-cyan-300 tracking-wide drop-shadow-[0_0_6px_rgba(6,182,212,0.3)]">
                    {offering.tierName}
                  </h3>
                  <span className={`px-3 py-1 rounded-full text-[10px] font-bold backdrop-blur-sm border transition-all duration-300 ${
                    offering.status === 'active' 
                      ? 'bg-gradient-to-r from-green-500/80 to-emerald-600/80 text-white border-green-400/50 shadow-[0_0_8px_rgba(34,197,94,0.4)]' 
                      : offering.status === 'upcoming' 
                      ? 'bg-gradient-to-r from-yellow-500/80 to-orange-500/80 text-white border-yellow-400/50 shadow-[0_0_8px_rgba(245,158,11,0.4)]'
                      : 'bg-gradient-to-r from-red-500/80 to-orange-500/80 text-white border-red-400/50 shadow-[0_0_8px_rgba(239,68,68,0.4)]'
                  }`}>
                    {offering.status === 'active' ? '💎 ACTIVE' : 
                     offering.status === 'upcoming' ? '⏳ SOON' : '❌ OUT'}
                  </span>
                </div>
                
                <p className="text-gray-300 text-xs mb-4 relative z-10 leading-relaxed">
                  {offering.description}
                </p>
                
                <div className="backdrop-blur-sm bg-gradient-to-br from-white/5 to-white/2 rounded-lg p-3 mb-4 border border-cyan-400/20 relative z-10">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-cyan-300 text-xs font-medium">💎 PRICE</span>
                      <span className="font-bold text-white text-xs drop-shadow-[0_0_6px_rgba(6,182,212,0.3)]">
                        ${offering.pricePerToken.toFixed(4)}
                      </span>
                    </div>
                    <div className="h-px bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent"></div>
                    <div className="flex justify-between items-center">
                      <span className="text-purple-300 text-xs font-medium">⚡ SUPPLY</span>
                      <span className="font-bold text-white text-xs drop-shadow-[0_0_6px_rgba(147,51,234,0.3)]">
                        {offering.totalTokens.toLocaleString()}
                      </span>
                    </div>
                    <div className="h-px bg-gradient-to-r from-transparent via-purple-500/30 to-transparent"></div>
                    <div className="flex justify-between items-center">
                      <span className="text-cyan-300 text-xs font-medium">🔻 MIN</span>
                      <span className="font-bold text-cyan-400 text-xs">{offering.minPurchaseAmount} USDT</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-purple-300 text-xs font-medium">🔺 MAX</span>
                      <span className="font-bold text-purple-400 text-xs">{offering.maxPurchaseAmount} USDT</span>
                    </div>
                  </div>
                </div>
                
                <button
                  onClick={() => handlePurchase(offering.id)}
                  className={`w-full px-4 py-3 rounded-lg text-sm font-bold transition-all duration-300 transform hover:scale-105 backdrop-blur-sm border relative z-10 ${
                    offering.status === 'active'
                      ? 'bg-gradient-to-r from-cyan-500/80 via-purple-500/80 to-blue-600/80 hover:from-cyan-400/90 hover:via-purple-400/90 hover:to-blue-500/90 text-white border-cyan-400/50 shadow-[0_4px_16px_0_rgba(6,182,212,0.3)] hover:shadow-[0_8px_24px_0_rgba(6,182,212,0.4)]'
                      : 'bg-gradient-to-r from-gray-600/40 to-gray-700/40 text-gray-400 cursor-not-allowed border-gray-500/30 shadow-[0_2px_8px_0_rgba(0,0,0,0.2)]'
                  }`}
                  disabled={offering.status !== 'active'}
                >
                  {offering.status === 'active' && (
                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-purple-500/5 to-blue-500/10 rounded-lg animate-pulse"></div>
                  )}
                  
                  {offering.status === 'active' ? (
                    <div className="flex items-center justify-center gap-2 relative z-10">
                      <span className="text-sm">💎</span>
                      <span className="tracking-wide">ACQUIRE</span>
                      <span className="text-sm">⚡</span>
                    </div>
                  ) : offering.status === 'upcoming' ? (
                    <div className="flex items-center justify-center gap-2 relative z-10">
                      <span className="text-sm">⏳</span>
                      <span className="tracking-wide">SOON</span>
                      <span className="text-sm">🔮</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2 relative z-10">
                      <span className="text-sm">❌</span>
                      <span className="tracking-wide">DEPLETED</span>
                      <span className="text-sm">💔</span>
                    </div>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Compact Purchase History Section */}
        {tonConnectUI.connected && (
          <div className="backdrop-blur-xl bg-gradient-to-br from-gray-800/60 via-gray-900/40 to-black/60 rounded-xl p-4 border border-cyan-500/30 shadow-[0_4px_16px_0_rgba(0,0,0,0.4)]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-cyan-300 flex items-center gap-2">
                <GiTrophy size={16} className="text-cyan-400" />
                ⚡ PURCHASE HISTORY ⚡
              </h3>
              <button
                onClick={() => setIsHistoryVisible(v => !v)}
                className="px-3 py-1 bg-gradient-to-r from-cyan-500/80 to-purple-500/80 text-white rounded-lg text-xs font-bold transition-all duration-300 transform hover:scale-105 shadow-[0_2px_8px_0_rgba(6,182,212,0.3)] border border-cyan-400/50 backdrop-blur-sm"
              >
                {isHistoryVisible ? 'HIDE' : 'SHOW'}
              </button>
            </div>

            {isHistoryVisible && (
              <div className="space-y-2">
                {isHistoryLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-cyan-500"></div>
                  </div>
                ) : purchaseHistory.length > 0 ? (
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {purchaseHistory.map(purchase => (
                      <div key={purchase.id} className="backdrop-blur-sm bg-gradient-to-br from-cyan-500/10 to-purple-500/10 rounded-lg p-3 border border-cyan-400/20 shadow-[0_2px_8px_0_rgba(0,0,0,0.3)] hover:shadow-[0_4px_12px_0_rgba(6,182,212,0.2)] transition-all duration-300 transform hover:scale-[1.02]">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-bold text-cyan-300 text-sm">
                              {purchase.tokens_purchased.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2
                              })} STK
                            </p>
                            <p className="text-xs text-purple-300">
                              ≈ ${(purchase.tokens_purchased * STK_PRICE_USDT).toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2
                              })} USDT
                            </p>
                            <p className="text-[10px] text-gray-400">
                              {new Date(purchase.created_at).toLocaleString()}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-medium text-cyan-300">
                              {purchase.ton_amount.toLocaleString(undefined, {
                                minimumFractionDigits: 4,
                                maximumFractionDigits: 4
                              })} TON
                            </p>
                            <p className="text-[10px] text-purple-300">
                              ${purchase.usdt_amount.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2
                              })} USDT
                            </p>
                            <span className={`mt-1 inline-block px-2 py-0.5 text-[10px] font-bold rounded-full ${
                              purchase.status === 'confirmed' ? 'bg-gradient-to-r from-green-500/80 to-emerald-600/80 text-white' :
                              purchase.status === 'failed' ? 'bg-gradient-to-r from-red-500/80 to-orange-500/80 text-white' :
                              'bg-gradient-to-r from-yellow-500/80 to-orange-500/80 text-white'
                            }`}>
                              {purchase.status.charAt(0).toUpperCase() + purchase.status.slice(1)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="backdrop-blur-sm bg-gradient-to-br from-gray-800/40 to-gray-900/40 rounded-lg p-4 border border-gray-500/20 text-center">
                    <GiTrophy size={24} className="text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">No purchase history yet</p>
                    <p className="text-xs text-gray-500 mt-1">Start your Voucher collection!</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Compact Disconnect Button */}
        {tonConnectUI.connected && (
          <div className="flex justify-center">
            <button
              onClick={() => tonConnectUI.disconnect()}
              className="px-4 py-2 bg-gradient-to-r from-red-500/80 via-red-600/80 to-red-700/80 hover:from-red-400/90 hover:via-red-500/90 hover:to-red-600/90 text-white rounded-lg text-sm font-bold transition-all duration-300 transform hover:scale-105 shadow-[0_4px_16px_0_rgba(239,68,68,0.3)] border border-red-400/50 backdrop-blur-sm"
            >
              <div className="flex items-center gap-2">
                <span>🔌</span>
                <span>DISCONNECT</span>
              </div>
            </button>
          </div>
        )}

        {/* Compact wallet modal */}
        {renderWalletModal()}

        {/* Compact purchase modal */}
        {renderPurchaseModal()}

        {/* Compact snackbar */}
        {/* Removed snackbar JSX as per edit hint */}
      </div>
      
      {/* Global CSS for animations */}
      <style>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0px) translateX(0px) rotate(0deg);
          }
          25% {
            transform: translateY(-10px) translateX(5px) rotate(90deg);
          }
          50% {
            transform: translateY(-5px) translateX(-5px) rotate(180deg);
          }
          75% {
            transform: translateY(-12px) translateX(3px) rotate(270deg);
          }
        }
      `}</style>
    </div>
  );
};

export default SmartStore;