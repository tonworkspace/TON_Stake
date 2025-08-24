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