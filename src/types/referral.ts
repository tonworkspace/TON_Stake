export interface ReferralReward {
  level: number;
  name: string;
  requirements: number;
  rewards: {
    points: number;
    gems: number;
    special?: string;
  };
  icon: string;
  color: string;
}

export interface UplineInfo {
  id: string;
  username: string;
  rank: string;
  totalEarned: number;
  joinedAt: number;
  isActive: boolean;
  level: number; // How many levels up (1 = direct referrer)
}

export interface DownlineInfo {
  id: string;
  username: string;
  rank: string;
  totalEarned: number;
  joinedAt: number;
  isActive: boolean;
  level: number; // How many levels down (1 = direct referral)
  directReferrals: number;
}

export interface ReferralData {
  code: string;
  totalReferrals: number;
  activeReferrals: number;
  level: number;
  rewards: {
    points: number;
    gems: number;
  };
  referrals: Array<{
    id: string;
    username: string;
    joinedAt: number;
    isActive: boolean;
    pointsEarned: number;
    pointSource?: string;
    tonersCoins?: number;
    totalTonersEarned?: number;
    gameData?: {
      miningLevel?: number;
      pointsPerSecond?: number;
    };
    balance?: number;
  }>;
}

// Referral reward tiers
export const REFERRAL_REWARDS: ReferralReward[] = [
  {
    level: 1,
    name: 'First Friend',
    requirements: 1,
    rewards: { points: 100, gems: 10 },
    icon: '👥',
    color: 'green'
  },
  {
    level: 2,
    name: 'Social Butterfly',
    requirements: 3,
    rewards: { points: 300, gems: 30 },
    icon: '🦋',
    color: 'blue'
  },
  {
    level: 3,
    name: 'Network Builder',
    requirements: 5,
    rewards: { points: 500, gems: 50, special: 'VIP Access' },
    icon: '🌐',
    color: 'purple'
  },
  {
    level: 4,
    name: 'Community Leader',
    requirements: 10,
    rewards: { points: 1000, gems: 100, special: 'Exclusive NFT' },
    icon: '👑',
    color: 'yellow'
  },
  {
    level: 5,
    name: 'Referral Master',
    requirements: 20,
    rewards: { points: 2500, gems: 250, special: 'Legendary Status' },
    icon: '🏆',
    color: 'red'
  }
]; 