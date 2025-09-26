import { FC, useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/contexts/ThemeContext';
import { OnboardingScreen } from './OnboardingScreen';
import { DivineMiningGame } from '@/components/DivineMiningGame';
import { DivinePointsLeaderboard } from '@/components/DivinePointsLeaderboard';
import { TaskCenter } from '@/components/TaskCenter';
import { ReferralSystem } from '@/components/ReferralSystem';
import { useTonAddress, TonConnectButton, useTonConnectUI } from '@tonconnect/ui-react';
import { useReferralIntegration } from '@/hooks/useReferralIntegration';
import { GameProvider, useGameContext } from '@/contexts/GameContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { 
  GiCrystalBall, 
  GiShop,
  GiDiamonds
} from 'react-icons/gi';
import { BiHome } from 'react-icons/bi';
// Import gem sync test utilities for debugging
import '@/utils/gemSyncTest';
import DailyRewards from '@/components/DailyRewards';
import SmartStore from '@/components/SmartStore';
import { ShoutboxHeader } from '@/components/ShoutboxHeader/ShoutboxHeader';

// Compact Auto-hide Wallet Connection Banner
const WalletConnectionBanner: FC<{ NETWORK_NAME: string }> = ({ NETWORK_NAME }) => {
  const [isVisible, setIsVisible] = useState(true);
  const [lastInteraction, setLastInteraction] = useState(Date.now());

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, 4000); // Auto-hide after 4 seconds

    return () => clearTimeout(timer);
  }, [lastInteraction]);

  const handleInteraction = () => {
    setLastInteraction(Date.now());
    setIsVisible(true);
  };

  if (!isVisible) {
    return (
      <div 
        className="backdrop-blur-xl bg-gradient-to-r from-orange-900/15 to-red-900/15 border border-orange-500/20 rounded-xl p-1.5 mb-2 shadow-[0_2px_12px_0_rgba(0,0,0,0.2)] cursor-pointer transition-all duration-300 hover:from-orange-900/25 hover:to-red-900/25 hover:scale-[1.02]"
        onClick={handleInteraction}
      >
        <div className="flex items-center justify-center space-x-2">
          <div className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-pulse"></div>
          <span className="text-orange-300 font-mono text-[10px] font-medium">🔗 TAP TO CONNECT</span>
          <div className="text-[8px] text-blue-300 font-mono opacity-60">
            {NETWORK_NAME}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="backdrop-blur-xl bg-gradient-to-r from-orange-900/20 to-red-900/20 border border-orange-500/20 rounded-xl p-3 mb-2 shadow-[0_4px_20px_0_rgba(0,0,0,0.2)] transition-all duration-300">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse shadow-sm shadow-red-400/50"></div>
          <span className="text-orange-300 font-bold text-xs tracking-wide">🔗 CONNECT WALLET</span>
          <div className="text-[10px] text-blue-300 font-mono backdrop-blur-sm bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
            🌐 {NETWORK_NAME}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-300 leading-relaxed">
          Connect TON wallet for full features
        </p>
        <TonConnectButton />
      </div>
    </div>
  );
};

// Compact Auto-hide Wallet Status Banner
const WalletStatusBanner: FC<{ 
  userFriendlyAddress: string; 
  NETWORK_NAME: string; 
  onDisconnect: () => void;
}> = ({ userFriendlyAddress, NETWORK_NAME, onDisconnect }) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [lastInteraction, setLastInteraction] = useState(Date.now());

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsMinimized(true);
    }, 3000); // Auto-minimize after 3 seconds

    return () => clearTimeout(timer);
  }, [lastInteraction]);

  const handleInteraction = () => {
    setLastInteraction(Date.now());
    setIsMinimized(false);
  };

  if (isMinimized) {
    return (
      <div 
        className="backdrop-blur-xl bg-gradient-to-r from-green-900/15 to-emerald-900/15 border border-green-500/20 rounded-xl p-1.5 mb-2 shadow-[0_2px_12px_0_rgba(0,0,0,0.2)] cursor-pointer transition-all duration-300 hover:from-green-900/25 hover:to-emerald-900/25 hover:scale-[1.02]"
        onClick={handleInteraction}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>
            <span className="text-green-300 font-mono text-[10px] font-medium">
              ✅ {userFriendlyAddress.slice(0, 4)}...{userFriendlyAddress.slice(-3)}
            </span>
          </div>
          <div className="text-[8px] text-blue-300 font-mono opacity-60">
            {NETWORK_NAME}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="backdrop-blur-xl bg-gradient-to-r from-green-900/20 to-emerald-900/20 border border-green-500/20 rounded-xl p-3 mb-2 shadow-[0_4px_20px_0_rgba(0,0,0,0.2)] transition-all duration-300">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse shadow-sm shadow-green-400/50"></div>
          <div className="flex flex-col">
            <span className="text-green-300 font-bold text-xs tracking-wide">WALLET CONNECTED</span>
            <span className="text-gray-400 font-mono text-[10px]">
              {userFriendlyAddress.slice(0, 8)}...{userFriendlyAddress.slice(-6)}
            </span>
          </div>
        </div>
        <div className="flex items-center space-x-1">
          <div className="text-[10px] text-blue-300 font-mono backdrop-blur-sm bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
            🌐 {NETWORK_NAME}
          </div>
          <button
            onClick={onDisconnect}
            className="text-[10px] text-red-300 font-bold backdrop-blur-sm bg-red-500/10 px-2 py-0.5 rounded-full hover:bg-red-500/20 transition-all duration-200 border border-red-500/20 hover:border-red-500/40 hover:shadow-sm hover:shadow-red-500/20"
            title="Disconnect Wallet"
          >
            🔌
          </button>
        </div>
      </div>
    </div>
  );
};

// Header component that uses GameContext
const GameHeader: FC<{ 
  user: any; 
  currentTab: string; 
  userFriendlyAddress?: string;
  walletBalance: string;
  isLoadingBalance: boolean;
  NETWORK_NAME: string;
  fetchWalletBalance: () => void;
}> = ({ user, userFriendlyAddress, walletBalance, isLoadingBalance, NETWORK_NAME }) => {
  const { gems, } = useGameContext();
  const [isExpanded, setIsExpanded] = useState(false); // Start in compact mode
  const [lastInteraction, setLastInteraction] = useState(0); // Don't auto-expand on mount
  
  // Auto-compact logic - only run when there was an interaction
  useEffect(() => {
    if (lastInteraction === 0) return; // Don't run on initial mount
    
    const timer = setTimeout(() => {
      setIsExpanded(false);
    }, 3000); // Auto-compact after 3 seconds of no interaction

    return () => clearTimeout(timer);
  }, [lastInteraction]);

  const handleInteraction = () => {
    setLastInteraction(Date.now());
    setIsExpanded(true);
  };
  
  // Helper function to format numbers
  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };
  
  return (
    <div 
      className={`relative backdrop-blur-2xl bg-gradient-to-r from-slate-900/60 via-gray-900/40 to-slate-900/60 border border-white/10 rounded-xl mb-2 shadow-[0_4px_24px_0_rgba(0,0,0,0.3)] overflow-hidden transition-all duration-500 cursor-pointer group ${
        isExpanded ? 'p-3' : 'p-2 hover:border-white/20'
      }`}
      onClick={handleInteraction}
      onMouseEnter={handleInteraction}
      title={!isExpanded ? "Tap to expand details" : ""}
    >
      {/* Enhanced Glassmorphism Border */}
      <div className={`absolute inset-0 rounded-2xl bg-gradient-to-r from-cyan-500/10 via-purple-500/5 to-blue-500/10 p-[1px] transition-all duration-500 ${
        !isExpanded ? 'animate-pulse' : ''
      }`} style={{ animationDuration: !isExpanded ? '4s' : undefined }}>
        <div className="w-full h-full rounded-2xl bg-gradient-to-br from-gray-900/80 to-black/80"></div>
      </div>
      
      {/* Compact Mode Glow Effect */}
      {!isExpanded && (
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-cyan-500/5 via-purple-500/3 to-blue-500/5 animate-pulse" style={{ animationDuration: '6s', animationDelay: '1s' }}></div>
      )}
      
      {/* Animated Corner Accents - Only show when expanded */}
      {isExpanded && (
        <>
          <div className="absolute top-2 left-2 w-6 h-6 border-l-2 border-t-2 border-cyan-400/40 rounded-tl-lg animate-pulse"></div>
          <div className="absolute top-2 right-2 w-6 h-6 border-r-2 border-t-2 border-purple-400/40 rounded-tr-lg animate-pulse" style={{ animationDelay: '0.5s' }}></div>
          <div className="absolute bottom-2 left-2 w-6 h-6 border-l-2 border-b-2 border-blue-400/40 rounded-bl-lg animate-pulse" style={{ animationDelay: '1s' }}></div>
          <div className="absolute bottom-2 right-2 w-6 h-6 border-r-2 border-b-2 border-pink-400/40 rounded-br-lg animate-pulse" style={{ animationDelay: '1.5s' }}></div>
        </>
      )}
      
      {/* Floating Particles - Only show when expanded */}
      {isExpanded && [...Array(8)].map((_, i) => (
        <div
          key={`floating-${i}`}
          className="absolute w-1 h-1 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full animate-float opacity-60"
          style={{
            top: `${20 + Math.random() * 60}%`,
            left: `${10 + Math.random() * 80}%`,
            animationDelay: `${i * 0.5}s`,
            animationDuration: `${3 + Math.random() * 2}s`
          }}
        />
      ))}
      
      {/* Content */}
      <div className={`relative z-10 transition-all duration-500 ${
        isExpanded 
          ? 'flex items-center justify-between space-x-4' 
          : userFriendlyAddress 
            ? 'flex items-center justify-between space-x-2'
            : 'flex items-center justify-center space-x-2'
      }`}>
        
        {/* Compact User Badge - Always visible but different when collapsed */}
        {user?.username && (
          <div className={`flex items-center backdrop-blur-xl bg-gradient-to-r from-gray-800/60 to-gray-900/60 rounded-full border border-white/10 shadow-[0_4px_16px_0_rgba(0,0,0,0.3)] transition-all duration-500 ${
            isExpanded ? 'space-x-3 px-4 py-2' : 'space-x-2 px-2 py-1'
          }`}>
            <div className={`relative bg-gradient-to-br from-cyan-400 via-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg transition-all duration-500 ${
              isExpanded ? 'w-8 h-8' : 'w-6 h-6'
            }`}>
              <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent rounded-full"></div>
              <span className={`relative text-white font-bold transition-all duration-500 ${
                isExpanded ? 'text-sm' : 'text-xs'
              }`}>
                {user.username.charAt(0).toUpperCase()}
              </span>
              <div className={`absolute bg-green-400 rounded-full border-2 border-gray-900 animate-pulse transition-all duration-500 ${
                isExpanded ? '-top-1 -right-1 w-3 h-3' : '-top-0.5 -right-0.5 w-2 h-2'
              }`}></div>
            </div>
            
            {/* Username - Show based on expansion state */}
            {isExpanded ? (
              <div className="flex flex-col">
                <span className="text-cyan-300 font-mono text-xs opacity-80">
                  @{user.username.toLowerCase()}
                </span>
              </div>
            ) : (
              <div className="flex flex-col">
                <span className="text-cyan-300 font-mono text-xs opacity-80">
                  @{user.username.slice(0, 6)}{user.username.length > 6 ? '...' : ''}
                </span>
                <span className="text-gray-500 font-mono text-[8px] opacity-40">
                  tap to expand
                </span>
              </div>
            )}
          </div>
        )}

        {/* Stats Section - Show/hide based on expansion and wallet connection */}
        {userFriendlyAddress && (
          <div className={`flex items-center transition-all duration-500 ${
            isExpanded ? 'space-x-4' : 'space-x-2'
          }`}>
            
            {/* Gems Display - Only show when expanded */}
            {isExpanded && (
              <div className="flex items-center space-x-2 backdrop-blur-xl bg-gradient-to-r from-purple-900/40 to-pink-900/40 rounded-full px-4 py-2 border border-purple-500/20">
                <div className="relative">
                  <div className="w-6 h-6 bg-gradient-to-br from-purple-400 to-pink-500 rounded-full flex items-center justify-center shadow-lg">
                    <span className="text-white text-xs">💎</span>
                  </div>
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-purple-400 rounded-full animate-ping"></div>
                </div>
                <span className="text-purple-200 font-bold text-sm">
                  {formatNumber(gems)}
                </span>
              </div>
            )}
            
            {/* TON Balance - Always show but compact when collapsed */}
            <div className={`flex items-center backdrop-blur-xl bg-gradient-to-r from-green-900/40 to-emerald-900/40 rounded-full border border-green-500/20 transition-all duration-500 ${
              isExpanded ? 'space-x-2 px-4 py-2' : 'space-x-1 px-2 py-1'
            }`}>
              <div className="relative">
                <div className={`bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center shadow-lg transition-all duration-500 ${
                  isExpanded ? 'w-6 h-6' : 'w-4 h-4'
                }`}>
                  <span className={`text-white transition-all duration-500 ${
                    isExpanded ? 'text-xs' : 'text-[10px]'
                  }`}>⚡</span>
                </div>
                {isLoadingBalance && (
                  <div className="absolute inset-0 border-2 border-green-400 border-t-transparent rounded-full animate-spin"></div>
                )}
              </div>
              <span className={`text-green-200 font-bold transition-all duration-500 ${
                isExpanded ? 'text-sm' : 'text-xs'
              }`}>
                {isLoadingBalance ? '...' : (isExpanded ? formatNumber(Number(walletBalance)) + ' TON' : formatNumber(Number(walletBalance)))}
              </span>
            </div>
            
            {/* Network Badge - Only show when expanded */}
            {isExpanded && (
              <div className="text-xs text-blue-300 font-mono backdrop-blur-sm bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">
                🌐 {NETWORK_NAME}
              </div>
            )}
          </div>
        )}
        
        {/* Expansion Indicator */}
        <div className={`flex items-center transition-all duration-500 ${
          isExpanded ? 'opacity-30' : 'opacity-80'
        }`}>
          {!isExpanded ? (
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1">
                <div className="w-1 h-1 bg-cyan-400 rounded-full animate-pulse"></div>
                <div className="w-1 h-1 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-1 h-1 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
              </div>
              <div className="text-[8px] text-gray-400 font-mono opacity-60 group-hover:opacity-100 transition-opacity duration-300">
                TAP
              </div>
            </div>
          ) : (
            <div className="w-1 h-1 bg-cyan-400 rounded-full animate-pulse scale-75"></div>
          )}
        </div>
      </div>
    </div>
  );
};

export const IndexPage: FC = () => {
  const { user, isLoading, error } = useAuth();
  
  // Skip loading if user is already authenticated
  const shouldShowLoading = isLoading && !user;
  const { theme } = useTheme();
  const [currentTab, setCurrentTab] = useState('daily');
  const [showNetworkWarning, setShowNetworkWarning] = useState(false);
  
  // TON Wallet State
  const userFriendlyAddress = useTonAddress();
  const [tonConnectUI] = useTonConnectUI();
  const [walletBalance, setWalletBalance] = useState<string>('0');
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  
  // TON Network Configuration
  const isMainnet = true; // You can toggle this for testing
  const NETWORK_NAME = isMainnet ? 'Mainnet' : 'Testnet';
  const MAINNET_API_KEY = 'ba0e3b7f5080add7ba9bc310b2652ce4d33654575152d5ab90fde863309f6118';
  const TESTNET_API_KEY = 'bb31868e5cf6529efb16bcf547beb3c534a28d1e139bd63356fd936c168fe662';
  
  // Add referral integration
  useReferralIntegration();
  
  // Function to fetch wallet balance from TON Center API
  const fetchWalletBalance = async () => {
    if (!userFriendlyAddress) {
      setWalletBalance('0');
      return;
    }

    setIsLoadingBalance(true);
    try {
      const apiKey = isMainnet ? MAINNET_API_KEY : TESTNET_API_KEY;
      const baseUrl = isMainnet ? 'https://toncenter.com/api/v2' : 'https://testnet.toncenter.com/api/v2';
      
      // Fetch wallet balance from TON Center API
      const response = await fetch(`${baseUrl}/getAddressBalance?address=${userFriendlyAddress}`, {
        headers: {
          'X-API-Key': apiKey
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.ok) {
        // Convert nano TON to TON (1 TON = 1,000,000,000 nano TON)
        const balanceInNano = parseInt(data.result);
        const balanceInTon = balanceInNano / 1_000_000_000;
        setWalletBalance(balanceInTon.toFixed(4));
        console.log(`💰 Wallet balance updated: ${balanceInTon.toFixed(4)} TON (${NETWORK_NAME})`);
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

  // Function to disconnect wallet
  const handleDisconnectWallet = async () => {
    try {
      await tonConnectUI.disconnect();
      setWalletBalance('0');
      console.log('🔌 Wallet disconnected successfully');
    } catch (error) {
      console.error('Error disconnecting wallet:', error);
    }
  };

  // Fetch wallet balance when wallet is connected
  useEffect(() => {
    fetchWalletBalance();
  }, [userFriendlyAddress]);

  // Refresh wallet balance every 30 seconds when connected
  useEffect(() => {
    if (!userFriendlyAddress) return;

    const interval = setInterval(() => {
      fetchWalletBalance();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [userFriendlyAddress]);
  
  // Monitor network status
  useEffect(() => {
    const handleOnline = () => {
      setShowNetworkWarning(false);
    };
    
    const handleOffline = () => {
      setShowNetworkWarning(true);
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Get theme-specific colors
  const getThemeColors = () => {
    switch (theme) {
      case 'light':
        return {
          mainGradient: 'from-gray-100 via-gray-50 to-gray-200',
          energyFields: 'bg-cyan-200/20',
          energyFieldsDark: 'bg-cyan-400/15',
          energyFields2: 'bg-blue-300/15',
          energyFields2Dark: 'bg-blue-500/10',
          energyFields3: 'bg-purple-400/15',
          energyFields3Dark: 'bg-purple-600/10',
          energyFields4: 'bg-cyan-300/15',
          energyFields4Dark: 'bg-cyan-500/10',
          orbs: 'bg-cyan-400/50',
          orbsDark: 'bg-cyan-500/45',
          particles: 'bg-cyan-500/40',
          particlesDark: 'bg-cyan-600/35',
          gridOverlay: 'from-cyan-200/10 via-transparent to-cyan-200/10',
          gridOverlayDark: 'from-cyan-500/6 via-transparent to-cyan-500/6',
          lightRays: 'from-transparent via-cyan-200/8 to-transparent',
          lightRaysDark: 'from-transparent via-cyan-500/4 to-transparent',
          cornerGlows: 'bg-cyan-300/20',
          cornerGlowsDark: 'bg-cyan-500/15',
          cornerGlows2: 'bg-blue-400/20',
          cornerGlows2Dark: 'bg-blue-600/15',
          cornerGlows3: 'bg-purple-500/20',
          cornerGlows3Dark: 'bg-purple-700/15',
          cornerGlows4: 'bg-cyan-400/20',
          cornerGlows4Dark: 'bg-cyan-600/15',
          bottomNav: 'from-white/95 via-gray-50/90 to-white/95',
          bottomNavDark: 'from-gray-900/95 via-gray-800/90 to-gray-900/95',
          bottomBorder: 'border-cyan-300',
          bottomBorderDark: 'border-cyan-600',
          bottomShadow: 'shadow-[0_-4px_20px_0_rgba(0,255,255,0.15)]',
          bottomShadowDark: 'shadow-[0_-4px_16px_0_rgba(0,255,255,0.2)]'
        };
      case 'dark':
        return {
          mainGradient: 'from-black via-gray-900 to-black',
          energyFields: 'bg-cyan-500/20',
          energyFieldsDark: 'bg-cyan-600/15',
          energyFields2: 'bg-blue-600/15',
          energyFields2Dark: 'bg-blue-700/10',
          energyFields3: 'bg-purple-600/15',
          energyFields3Dark: 'bg-purple-700/10',
          energyFields4: 'bg-cyan-400/15',
          energyFields4Dark: 'bg-cyan-500/10',
          orbs: 'bg-cyan-400/60',
          orbsDark: 'bg-cyan-500/55',
          particles: 'bg-cyan-400/50',
          particlesDark: 'bg-cyan-500/45',
          gridOverlay: 'from-cyan-500/8 via-transparent to-cyan-500/8',
          gridOverlayDark: 'from-cyan-600/5 via-transparent to-cyan-600/5',
          lightRays: 'from-transparent via-cyan-500/6 to-transparent',
          lightRaysDark: 'from-transparent via-cyan-600/3 to-transparent',
          cornerGlows: 'bg-cyan-500/20',
          cornerGlowsDark: 'bg-cyan-600/15',
          cornerGlows2: 'bg-blue-600/20',
          cornerGlows2Dark: 'bg-blue-700/15',
          cornerGlows3: 'bg-purple-600/20',
          cornerGlows3Dark: 'bg-purple-700/15',
          cornerGlows4: 'bg-cyan-400/20',
          cornerGlows4Dark: 'bg-cyan-500/15',
          bottomNav: 'from-black/95 via-gray-900/90 to-black/95',
          bottomNavDark: 'from-black/95 via-gray-900/90 to-black/95',
          bottomBorder: 'border-cyan-500',
          bottomBorderDark: 'border-cyan-500',
          bottomShadow: 'shadow-[0_-4px_16px_0_rgba(0,255,255,0.2)]',
          bottomShadowDark: 'shadow-[0_-4px_16px_0_rgba(0,255,255,0.25)]'
        };
      case 'auto':
        return {
          mainGradient: 'from-gray-900 via-black to-gray-900',
          energyFields: 'bg-cyan-400/20',
          energyFieldsDark: 'bg-cyan-500/15',
          energyFields2: 'bg-blue-500/15',
          energyFields2Dark: 'bg-blue-600/10',
          energyFields3: 'bg-purple-500/15',
          energyFields3Dark: 'bg-purple-600/10',
          energyFields4: 'bg-cyan-300/15',
          energyFields4Dark: 'bg-cyan-400/10',
          orbs: 'bg-cyan-400/55',
          orbsDark: 'bg-cyan-500/50',
          particles: 'bg-cyan-400/45',
          particlesDark: 'bg-cyan-500/40',
          gridOverlay: 'from-cyan-400/9 via-transparent to-cyan-400/9',
          gridOverlayDark: 'from-cyan-500/5.5 via-transparent to-cyan-500/5.5',
          lightRays: 'from-transparent via-cyan-400/7 to-transparent',
          lightRaysDark: 'from-transparent via-cyan-500/3.5 to-transparent',
          cornerGlows: 'bg-cyan-400/20',
          cornerGlowsDark: 'bg-cyan-500/15',
          cornerGlows2: 'bg-blue-500/20',
          cornerGlows2Dark: 'bg-blue-600/15',
          cornerGlows3: 'bg-purple-500/20',
          cornerGlows3Dark: 'bg-purple-600/15',
          cornerGlows4: 'bg-cyan-300/20',
          cornerGlows4Dark: 'bg-cyan-400/15',
          bottomNav: 'from-gray-900/95 via-black/90 to-gray-900/95',
          bottomNavDark: 'from-gray-900/95 via-black/90 to-gray-900/95',
          bottomBorder: 'border-cyan-400',
          bottomBorderDark: 'border-cyan-500',
          bottomShadow: 'shadow-[0_-4px_16px_0_rgba(0,255,255,0.18)]',
          bottomShadowDark: 'shadow-[0_-4px_16px_0_rgba(0,255,255,0.22)]'
        };
      default:
        return {
          mainGradient: 'from-black via-gray-900 to-black',
          energyFields: 'bg-cyan-500/20',
          energyFieldsDark: 'bg-cyan-600/15',
          energyFields2: 'bg-blue-600/15',
          energyFields2Dark: 'bg-blue-700/10',
          energyFields3: 'bg-purple-600/15',
          energyFields3Dark: 'bg-purple-700/10',
          energyFields4: 'bg-cyan-400/15',
          energyFields4Dark: 'bg-cyan-500/10',
          orbs: 'bg-cyan-400/60',
          orbsDark: 'bg-cyan-500/55',
          particles: 'bg-cyan-400/50',
          particlesDark: 'bg-cyan-500/45',
          gridOverlay: 'from-cyan-500/8 via-transparent to-cyan-500/8',
          gridOverlayDark: 'from-cyan-600/5 via-transparent to-cyan-600/5',
          lightRays: 'from-transparent via-cyan-500/6 to-transparent',
          lightRaysDark: 'from-transparent via-cyan-600/3 to-transparent',
          cornerGlows: 'bg-cyan-500/20',
          cornerGlowsDark: 'bg-cyan-600/15',
          cornerGlows2: 'bg-blue-600/20',
          cornerGlows2Dark: 'bg-blue-700/15',
          cornerGlows3: 'bg-purple-600/20',
          cornerGlows3Dark: 'bg-purple-700/15',
          cornerGlows4: 'bg-cyan-400/20',
          cornerGlows4Dark: 'bg-cyan-500/15',
          bottomNav: 'from-black/95 via-gray-900/90 to-black/95',
          bottomNavDark: 'from-black/95 via-gray-900/90 to-black/95',
          bottomBorder: 'border-cyan-500',
          bottomBorderDark: 'border-cyan-500',
          bottomShadow: 'shadow-[0_-4px_16px_0_rgba(0,255,255,0.2)]',
          bottomShadowDark: 'shadow-[0_-4px_16px_0_rgba(0,255,255,0.25)]'
        };
    }
  };

  const colors = getThemeColors();
  
  // Only show loading on initial load, not when switching tabs
  if (shouldShowLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-gray-900 via-black to-gray-900 transition-all duration-1000 overflow-hidden">
        {/* Enhanced Background Effects */}
        <div className="absolute inset-0">
          {/* Animated Aurora Effect */}
          <div className="absolute inset-0">
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-cyan-500/10 via-purple-500/5 to-blue-500/8 animate-pulse" style={{ animationDuration: '4s' }}></div>
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-tl from-pink-500/8 via-transparent to-green-500/6 animate-pulse" style={{ animationDuration: '6s', animationDelay: '1s' }}></div>
          </div>
          
          {/* Enhanced Grid Pattern */}
          <div className="absolute inset-0 opacity-20">
            <div className="w-full h-full" style={{
              backgroundImage: `
                linear-gradient(rgba(6,182,212,0.3) 1px, transparent 1px),
                linear-gradient(90deg, rgba(6,182,212,0.3) 1px, transparent 1px),
                linear-gradient(rgba(147,51,234,0.2) 1px, transparent 1px),
                linear-gradient(90deg, rgba(147,51,234,0.2) 1px, transparent 1px)
              `,
              backgroundSize: '60px 60px, 60px 60px, 120px 120px, 120px 120px'
            }}></div>
          </div>
          
          {/* Floating Orbs */}
          {[...Array(20)].map((_, i) => (
            <div
              key={`orb-${i}`}
              className="absolute rounded-full opacity-60 animate-float"
              style={{
                width: `${Math.random() * 8 + 4}px`,
                height: `${Math.random() * 8 + 4}px`,
                top: `${Math.random() * 100}%`,
                left: `${Math.random() * 100}%`,
                background: `linear-gradient(45deg, 
                  hsl(${Math.random() * 60 + 180}, 70%, 60%), 
                  hsl(${Math.random() * 60 + 240}, 70%, 60%)
                )`,
                animationDelay: `${Math.random() * 5}s`,
                animationDuration: `${Math.random() * 3 + 4}s`
              }}
            />
          ))}
        </div>
        
        <div className="relative flex flex-col items-center space-y-8 z-10">
          {/* Enhanced Loading Animation */}
          <div className="relative">
            <div className="relative w-32 h-32">
              {/* Main Core with Glassmorphism */}
              <div className="absolute inset-0 backdrop-blur-xl bg-gradient-to-br from-cyan-400/20 via-purple-500/15 to-blue-600/20 rounded-full border border-white/20 shadow-[0_0_50px_rgba(6,182,212,0.5)] animate-pulse transition-all duration-1000">
                {/* Inner Rotating Ring */}
                <div className="absolute inset-4 bg-gradient-to-br from-cyan-300/30 to-purple-400/30 rounded-full animate-spin backdrop-blur-sm border border-white/10" style={{ animationDuration: '3s' }}>
                  <div className="absolute inset-3 bg-gradient-to-br from-cyan-200/40 to-blue-300/40 rounded-full animate-pulse backdrop-blur-sm"></div>
                </div>
                
                {/* Central Glow */}
                <div className="absolute inset-8 bg-gradient-to-br from-white/40 to-cyan-400/40 rounded-full animate-pulse backdrop-blur-lg shadow-inner"></div>
                
                {/* Data Nodes */}
                {[...Array(8)].map((_, i) => (
                  <div
                    key={`node-${i}`}
                    className="absolute w-4 h-4 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-full border-2 border-white/30 backdrop-blur-sm animate-pulse shadow-lg"
                    style={{
                      top: '50%',
                      left: '50%',
                      transform: `translate(-50%, -50%) rotate(${i * 45}deg) translateY(-50px)`,
                      animationDelay: `${i * 0.2}s`
                    }}
                  >
                    <div className="absolute inset-0.5 bg-white/50 rounded-full animate-ping"></div>
                  </div>
                ))}
                
                {/* Holographic Aura */}
                <div className="absolute -inset-4 bg-gradient-to-br from-cyan-400/20 to-purple-500/20 rounded-full blur-xl animate-pulse"></div>
              </div>
              
              {/* Orbiting Elements */}
              {[...Array(24)].map((_, i) => (
                <div
                  key={`orbit-${i}`}
                  className="absolute w-2 h-2 rounded-full shadow-lg"
                  style={{
                    top: '50%',
                    left: '50%',
                    background: `linear-gradient(45deg, 
                      hsl(${i * 15 + 180}, 70%, 60%), 
                      hsl(${i * 15 + 220}, 70%, 70%)
                    )`,
                    transform: `translate(-50%, -50%) rotate(${i * 15}deg) translateX(80px)`,
                    animation: `orbit ${6 + i * 0.1}s linear infinite`,
                    animationDelay: `${i * 0.1}s`
                  }}
                />
              ))}
            </div>
            
            {/* Enhanced Energy Waves */}
            <div className="absolute inset-0">
              <div className="absolute inset-0 bg-cyan-400/10 rounded-full blur-2xl animate-ping" style={{ animationDuration: '2s' }}></div>
              <div className="absolute inset-0 bg-purple-400/8 rounded-full blur-3xl animate-ping" style={{ animationDuration: '3s', animationDelay: '0.5s' }}></div>
              <div className="absolute inset-0 bg-blue-400/6 rounded-full blur-3xl animate-ping" style={{ animationDuration: '4s', animationDelay: '1s' }}></div>
            </div>
          </div>
          
          {/* Enhanced Loading Text */}
          <div className="text-center space-y-4">
            <div className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-blue-500 animate-pulse tracking-wider">
              ⚡ TONERS MINER ⚡
            </div>
            <div className="text-lg text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-purple-300 font-medium tracking-wide">
              Initializing mining systems...
            </div>
            <div className="flex items-center justify-center space-x-3">
              {[...Array(5)].map((_, i) => (
                <div
                  key={`dot-${i}`}
                  className="w-3 h-3 rounded-full bg-gradient-to-r from-cyan-400 to-purple-500 animate-bounce shadow-lg"
                  style={{ animationDelay: `${i * 0.1}s` }}
                />
              ))}
            </div>
          </div>
          
          {/* Enhanced Status Panel */}
          <div className="text-center max-w-sm">
            <div className="backdrop-blur-xl bg-gradient-to-r from-gray-900/60 to-black/60 rounded-2xl p-6 border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.4)]">
              <div className="flex items-center justify-center space-x-3 mb-4">
                <div className="w-3 h-3 bg-gradient-to-r from-green-400 to-cyan-400 rounded-full animate-pulse shadow-lg"></div>
                <span className="font-bold text-white tracking-wider">SYSTEM STATUS: INITIALIZING</span>
              </div>
              <p className="text-gray-300 text-sm leading-relaxed">
                🔧 <span className="font-medium text-cyan-300">Mining systems are coming online...</span>
              </p>
              <div className="mt-4 w-full bg-gray-700/50 rounded-full h-2 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-cyan-400 to-purple-500 rounded-full animate-pulse"></div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Enhanced CSS animations */}
        <style>{`
          @keyframes orbit {
            0% {
              transform: translate(-50%, -50%) rotate(0deg) translateX(80px);
              opacity: 0.6;
            }
            50% {
              opacity: 1;
            }
            100% {
              transform: translate(-50%, -50%) rotate(360deg) translateX(80px);
              opacity: 0.6;
            }
          }
          @keyframes float {
            0%, 100% {
              transform: translateY(0px) translateX(0px);
            }
            25% {
              transform: translateY(-15px) translateX(8px);
            }
            50% {
              transform: translateY(-8px) translateX(-8px);
            }
            75% {
              transform: translateY(-20px) translateX(5px);
            }
          }
        `}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center min-h-screen bg-gradient-to-br ${colors.mainGradient} dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 text-gray-800 dark:text-gray-200 transition-all duration-1000`}>
        <div className="text-center p-6 backdrop-blur-xl bg-white/10 rounded-xl border border-white/20 shadow-[0_4px_24px_0_rgba(0,0,0,0.3)] max-w-sm mx-4">
          <div className="text-4xl mb-3">⚠️</div>
          <p className="text-red-400 text-base font-medium mb-2">{error}</p>
          <p className="text-blue-400 text-xs">Please open this app in Telegram</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <GameProvider>
        <div className="w-full min-h-screen relative overflow-hidden">
        <ShoutboxHeader />
          {/* Compact Network Warning */}
          {showNetworkWarning && (
            <div className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-gradient-to-r from-red-600/85 to-red-500/85 border-b border-red-400/30 text-white p-2 text-center font-bold text-xs animate-pulse shadow-[0_2px_12px_0_rgba(239,68,68,0.3)]">
              ⚠️ NO CONNECTION - Limited features
            </div>
          )}

          {/* Enhanced Modern Background */}
          <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
            {/* Main Gradient Base */}
            <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-gray-900 to-black" />
            
            {/* Animated Mesh Background */}
            <div className="absolute inset-0">
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/8 via-purple-500/4 to-blue-500/6 animate-pulse" style={{ animationDuration: '8s' }} />
              <div className="absolute inset-0 bg-gradient-to-tl from-pink-500/4 via-transparent to-emerald-500/6 animate-pulse" style={{ animationDuration: '12s', animationDelay: '2s' }} />
            </div>
            
            {/* Enhanced Energy Fields */}
            <div className="absolute -top-40 -left-40 w-96 h-96 bg-gradient-to-br from-cyan-500/15 to-blue-600/10 rounded-full blur-3xl animate-pulse opacity-70" style={{ animationDuration: '10s' }} />
            <div className="absolute top-20 right-10 w-80 h-80 bg-gradient-to-br from-purple-500/12 to-pink-500/8 rounded-full blur-3xl animate-pulse opacity-60" style={{ animationDuration: '12s', animationDelay: '1s' }} />
            <div className="absolute bottom-20 left-20 w-72 h-72 bg-gradient-to-br from-emerald-500/10 to-cyan-500/8 rounded-full blur-3xl animate-pulse opacity-50" style={{ animationDuration: '14s', animationDelay: '2s' }} />
            <div className="absolute bottom-0 right-0 w-[600px] h-96 bg-gradient-to-tl from-blue-600/12 to-purple-600/8 rounded-tl-full blur-3xl animate-pulse opacity-80" style={{ animationDuration: '16s', animationDelay: '3s' }} />
            
            {/* Enhanced Floating Elements */}
            {[...Array(30)].map((_, i) => (
              <div
                key={`float-${i}`}
                className="absolute rounded-full animate-float opacity-40"
                style={{
                  width: `${Math.random() * 6 + 2}px`,
                  height: `${Math.random() * 6 + 2}px`,
                  top: `${Math.random() * 100}%`,
                  left: `${Math.random() * 100}%`,
                  background: `linear-gradient(45deg, 
                    hsl(${Math.random() * 60 + 180}, 70%, 60%), 
                    hsl(${Math.random() * 60 + 240}, 70%, 70%)
                  )`,
                  animationDelay: `${Math.random() * 5}s`,
                  animationDuration: `${Math.random() * 4 + 6}s`,
                  boxShadow: '0 0 20px currentColor'
                }}
              />
            ))}
            
            {/* Enhanced Grid Pattern */}
            <div className="absolute inset-0 opacity-10">
              <div className="w-full h-full" style={{
                backgroundImage: `
                  linear-gradient(rgba(6,182,212,0.5) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(6,182,212,0.5) 1px, transparent 1px),
                  linear-gradient(rgba(147,51,234,0.3) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(147,51,234,0.3) 1px, transparent 1px)
                `,
                backgroundSize: '80px 80px, 80px 80px, 160px 160px, 160px 160px'
              }}></div>
            </div>
            
            {/* Enhanced Scan Lines */}
            <div className="absolute inset-0">
              <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent animate-pulse" style={{ animationDuration: '6s' }} />
              <div className="absolute top-1/4 left-0 w-full h-px bg-gradient-to-r from-transparent via-purple-500/30 to-transparent animate-pulse" style={{ animationDuration: '8s', animationDelay: '1s' }} />
              <div className="absolute top-3/4 left-0 w-full h-px bg-gradient-to-r from-transparent via-blue-500/35 to-transparent animate-pulse" style={{ animationDuration: '10s', animationDelay: '2s' }} />
              <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-emerald-500/25 to-transparent animate-pulse" style={{ animationDuration: '12s', animationDelay: '3s' }} />
              
              <div className="absolute top-0 left-1/4 w-px h-full bg-gradient-to-b from-transparent via-cyan-500/30 to-transparent animate-pulse" style={{ animationDuration: '7s' }} />
              <div className="absolute top-0 right-1/4 w-px h-full bg-gradient-to-b from-transparent via-purple-500/25 to-transparent animate-pulse" style={{ animationDuration: '9s', animationDelay: '1.5s' }} />
            </div>
            
            {/* Enhanced Corner Effects */}
            <div className="absolute top-0 left-0 w-40 h-40 bg-gradient-to-br from-cyan-500/15 to-transparent rounded-br-3xl blur-2xl animate-pulse" style={{ animationDuration: '8s' }} />
            <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-purple-500/15 to-transparent rounded-bl-3xl blur-2xl animate-pulse" style={{ animationDuration: '10s', animationDelay: '1s' }} />
            <div className="absolute bottom-0 left-0 w-40 h-40 bg-gradient-to-tr from-emerald-500/15 to-transparent rounded-tr-3xl blur-2xl animate-pulse" style={{ animationDuration: '12s', animationDelay: '2s' }} />
            <div className="absolute bottom-0 right-0 w-40 h-40 bg-gradient-to-tl from-blue-500/15 to-transparent rounded-tl-3xl blur-2xl animate-pulse" style={{ animationDuration: '14s', animationDelay: '3s' }} />
            
            {/* Holographic Interference */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-500/1 to-transparent animate-pulse" style={{ animationDuration: '15s' }} />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-purple-500/1 to-transparent animate-pulse" style={{ animationDuration: '18s', animationDelay: '2s' }} />
          </div>
      
          <div className="relative z-10">
            {!isLoading && user && <OnboardingScreen />}

            {/* Compact Main Content Area */}
            <div className="flex-1 pb-20 px-3 pt-3 max-w-md mx-auto">
           
              {/* Enhanced Header */}
              {userFriendlyAddress && (
                <GameHeader 
                  user={user} 
                  currentTab={currentTab}
                  userFriendlyAddress={userFriendlyAddress}
                  walletBalance={walletBalance}
                  isLoadingBalance={isLoadingBalance}
                  NETWORK_NAME={NETWORK_NAME}
                  fetchWalletBalance={fetchWalletBalance}
                />
              )}

                            {/* Auto-hide Wallet Connection Banner */}
              {!userFriendlyAddress && (
                <WalletConnectionBanner NETWORK_NAME={NETWORK_NAME} />
              )}

              {/* Auto-hide Wallet Status Banner */}
              {userFriendlyAddress && (
                <WalletStatusBanner 
                  userFriendlyAddress={userFriendlyAddress}
                  NETWORK_NAME={NETWORK_NAME}
                  onDisconnect={handleDisconnectWallet}
                />
              )}

              {/* Content Sections */}
              {currentTab === 'zodiac' && <DivineMiningGame setCurrentTab={setCurrentTab} />}
              {currentTab === 'daily' && <DailyRewards />}
              {currentTab === 'divine' && <DivinePointsLeaderboard />}
              {currentTab === 'store' && <SmartStore />}
              {currentTab === 'crystals' && (
                <div className="flex-1 overflow-y-auto">
                  <TaskCenter/>
                </div>
              )}
              {currentTab === 'spells' && (
                <div className="flex-1 overflow-y-auto">
                  <ReferralSystem />
                </div>
              )}
            </div>

            {/* Compact Bottom Navigation */}
            <div className="fixed bottom-0 left-0 right-0 backdrop-blur-2xl bg-gradient-to-t from-black/95 via-gray-900/85 to-black/95 border-t border-white/10 safe-area-pb z-40 shadow-[0_-4px_20px_0_rgba(0,0,0,0.3)] overflow-hidden">
              {/* Compact Top Border */}
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent animate-pulse" style={{ animationDuration: '4s' }}></div>
              
              {/* Subtle Holographic Overlay */}
              <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/1 via-transparent to-transparent animate-pulse" style={{ animationDuration: '8s' }}></div>
              
              <div className="max-w-lg mx-auto px-3 py-3 relative">
                <div className="grid grid-cols-4 items-center gap-2">
                  {[
                    { id: 'daily', text: 'Stake', Icon: BiHome, colors: ['from-purple-500', 'to-pink-600', 'purple'] },
                    { id: 'zodiac', text: 'Mine', Icon: GiCrystalBall, colors: ['from-cyan-500', 'to-blue-600', 'cyan'] },
                    { id: 'divine', text: 'Ranks', Icon: GiDiamonds, colors: ['from-yellow-500', 'to-orange-600', 'yellow'] },
                    { id: 'store', text: 'Store', Icon: GiShop, colors: ['from-cyan-500', 'to-blue-600', 'cyan'] },
                    // { id: 'crystals', text: 'Tasks', Icon: GiCrystalCluster, colors: ['from-emerald-500', 'to-green-600', 'emerald'] },
                    // { id: 'spells', text: 'Referrals', Icon: GiSpellBook, colors: ['from-pink-500', 'to-rose-600', 'pink'] },
                  ].map(({ id, text, Icon, colors }) => {
                    const isActive = currentTab === id;
                    const [fromColor, toColor, baseColor] = colors;
                    
                    return (
                      <button 
                        key={id} 
                        aria-label={text}
                        onClick={() => setCurrentTab(id)}
                        className={`
                          group relative flex flex-col items-center py-2 px-1 w-full transition-all duration-300 rounded-xl
                          ${isActive ? 'scale-105' : 'hover:scale-102'}
                        `}
                      >
                        {/* Compact Icon Container */}
                        <div className={`
                          relative flex items-center justify-center rounded-xl transition-all duration-300 mb-1 border backdrop-blur-xl
                          ${isActive 
                            ? `bg-gradient-to-br ${fromColor}/20 ${toColor}/15 border-${baseColor}-400/40 shadow-[0_0_20px_rgba(6,182,212,0.3)]` 
                            : 'bg-gray-800/40 border-gray-600/30 hover:bg-gray-700/50 hover:border-gray-500/40'
                          }
                        `}
                          style={{
                            width: 40,
                            height: 40,
                          }}
                        >
                          {/* Compact Glow Effects */}
                          {isActive && (
                            <>
                              <div className="absolute inset-0 bg-gradient-to-br from-white/8 to-transparent rounded-xl animate-pulse" style={{ animationDuration: '2s' }}></div>
                              <div className={`absolute -inset-0.5 bg-gradient-to-br ${fromColor}/15 ${toColor}/10 rounded-xl blur-sm animate-pulse`} style={{ animationDuration: '3s' }}></div>
                            </>
                          )}
                          
                          {/* Minimal Particles for Active Tab */}
                          {isActive && (
                            <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-gradient-to-br from-white to-current rounded-full animate-ping opacity-60"></div>
                          )}
                          
                          <Icon 
                            size={18} 
                            className={`
                              relative z-10 transition-all duration-300
                              ${isActive 
                                ? `text-white filter drop-shadow-[0_0_8px_currentColor]` 
                                : 'text-gray-400 group-hover:text-gray-200 group-hover:drop-shadow-[0_0_4px_currentColor]'
                              }
                            `} 
                          />
                        </div>
                        
                        {/* Compact Text */}
                        <span className={`
                          text-[9px] font-bold tracking-wide truncate max-w-[50px] text-center transition-all duration-300 uppercase
                          ${isActive 
                            ? 'text-white filter drop-shadow-[0_0_4px_currentColor]' 
                            : 'text-gray-400 group-hover:text-gray-200'
                          }
                        `}>
                          {text}
                        </span>
                        
                        {/* Compact Active Indicator */}
                        {isActive && (
                          <div className={`absolute top-0 left-1/2 transform -translate-x-1/2 w-6 h-0.5 bg-gradient-to-r ${fromColor} ${toColor} rounded-full animate-pulse shadow-sm`}></div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
              
              {/* Compact Bottom Effects */}
              <div className="absolute bottom-0 left-0 right-0">
                <div className="h-px bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent animate-pulse" style={{ animationDuration: '6s' }}></div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Enhanced Global Styles */}
        <style>{`
          @keyframes float {
            0%, 100% {
              transform: translateY(0px) translateX(0px) rotate(0deg);
            }
            25% {
              transform: translateY(-15px) translateX(8px) rotate(90deg);
            }
            50% {
              transform: translateY(-8px) translateX(-8px) rotate(180deg);
            }
            75% {
              transform: translateY(-20px) translateX(5px) rotate(270deg);
            }
          }
          
          .safe-area-pb {
            padding-bottom: env(safe-area-inset-bottom);
          }
        `}</style>
      </GameProvider>
    </ErrorBoundary>
  );
};


