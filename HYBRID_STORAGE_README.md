# Hybrid Storage System for Divine Mining Staking

## Overview

The DailyRewards component now uses a hybrid storage approach that combines **Supabase** (for persistence and cross-device access) with **localStorage** (for offline functionality and performance). This provides the best of both worlds: reliable data persistence and seamless offline operation.

## How It Works

### 1. **Primary Storage: Supabase**
- All staking data is stored in the `stakes` table
- User balances and earnings are stored in the `users` table
- Transaction history is logged in `user_activity_logs` and `earning_logs`
- Provides cross-device synchronization and data persistence

### 2. **Secondary Storage: localStorage**
- Acts as a cache and offline backup
- Stores user-specific data with keys like `divine_mining_stakes_${userId}`
- Enables offline functionality when internet is unavailable
- Provides fast local access for better performance

### 3. **Synchronization Strategy**

#### **Loading Data:**
1. **First Priority:** Try to load from Supabase
2. **Fallback:** If Supabase fails, load from localStorage
3. **Sync:** Always update localStorage with Supabase data for offline access

#### **Saving Data:**
1. **First Priority:** Try to save to Supabase
2. **Fallback:** If Supabase fails, save to localStorage only
3. **Sync:** Update localStorage with any Supabase changes

#### **Online/Offline Detection:**
- Automatically detects when user goes online/offline
- Syncs local data to Supabase when coming back online
- Shows appropriate notifications for offline mode

## Database Functions

The system uses these Supabase RPC functions:

### `create_stake(p_user_id, p_amount, p_daily_rate, p_tier_name)`
- Creates a new stake in the database
- Updates user balance
- Logs the activity
- Returns the new stake ID

### `claim_stake_rewards(p_stake_id, p_user_id)`
- Claims rewards from a specific stake
- Calculates rewards based on time elapsed
- Applies platform fees (60% to user, 40% platform)
- Updates stake and user data
- Logs the transaction

### `calculate_stake_reward_amount(p_stake_id)`
- Calculates available rewards for a stake
- Considers time since last payout
- Applies speed boost multipliers
- Returns the reward amount

### `activate_speed_boost(p_stake_id, p_user_id)`
- Activates speed boost for a stake
- Enables 2x reward generation
- Logs the activation

### `get_user_stakes_with_rewards(p_user_id)`
- Returns all stakes for a user with calculated rewards
- Includes tier information and days active
- Used for displaying stake list

### `get_user_staking_stats(p_user_id)`
- Returns comprehensive staking statistics
- Total stakes, active stakes, total staked amount
- Total earned, available rewards, average daily rate

## User Experience Features

### **Offline Mode:**
- Users can continue staking and claiming rewards offline
- All data is saved locally
- Automatic sync when connection is restored
- Clear notifications about offline status

### **Sync Button:**
- Manual sync button in the UI
- Allows users to force synchronization
- Useful when automatic sync fails

### **Achievement System:**
- Milestone notifications for balance achievements
- First stake creation celebration
- Big deposit notifications

### **Error Handling:**
- Graceful fallback to localStorage when Supabase fails
- Clear error messages and notifications
- Data is never lost, only temporarily stored locally

## Data Flow

```
User Action → Try Supabase → Success? → Update localStorage
                ↓ No
            Fallback to localStorage → Show offline notification
                ↓
            When online → Sync to Supabase → Success notification
```

## Benefits

1. **Reliability:** Data is never lost, even with network issues
2. **Performance:** Fast local access for immediate feedback
3. **Offline Support:** Full functionality without internet
4. **Cross-Device:** Data syncs across all user devices
5. **Scalability:** Database handles complex queries and analytics
6. **Security:** Server-side validation and transaction safety

## Migration

The system automatically handles migration from localStorage-only to hybrid:
- Legacy data is preserved and migrated to user-specific keys
- New data is stored in both systems
- No data loss during transition

## Monitoring

The system provides comprehensive logging:
- Console logs for debugging
- User notifications for status changes
- Error tracking for failed operations
- Performance metrics for sync operations

This hybrid approach ensures that users always have access to their staking data and can continue earning rewards regardless of their internet connection status. 