# Token Receiver / Faucet System

A comprehensive token faucet system that allows users to claim STK tokens based on their TON wallet balance.

## Features

- **Wallet Integration**: Supports TON Connect and manual wallet address input
- **Balance-Based Claims**: Claim amount calculated based on TON balance (base amount + percentage of balance)
- **Cooldown System**: 24-hour cooldown between claims to prevent abuse
- **Real-time Balance**: Fetches live TON balance from TON Center API
- **Database Tracking**: All claims are recorded in the database
- **Statistics**: Track total claims, tokens distributed, and user activity
- **Security**: Address validation, cooldown checks, and rate limiting

## Components

### 1. TokenReceiver Component (`src/components/TokenReceiver.tsx`)

Main component for the faucet interface:

```tsx
import TokenReceiver from '@/components/TokenReceiver';

<TokenReceiver 
  onClaimSuccess={(amount) => console.log(`Claimed ${amount} STK`)}
  className="custom-styles"
/>
```

**Props:**
- `onClaimSuccess?: (amount: number) => void` - Callback when tokens are successfully claimed
- `className?: string` - Additional CSS classes

### 2. FaucetPage Component (`src/components/FaucetPage.tsx`)

Complete page with statistics and user history:

```tsx
import FaucetPage from '@/components/FaucetPage';

<FaucetPage />
```

### 3. API Services

#### FaucetApi (`src/lib/faucetApi.ts`)

```typescript
import FaucetApi from '@/lib/faucetApi';

// Check eligibility
const eligibility = await FaucetApi.checkEligibility(userId, cooldownHours);

// Process claim
const result = await FaucetApi.processClaim(
  userId, 
  walletAddress, 
  tonBalance, 
  claimAmount, 
  'mainnet'
);

// Get statistics
const stats = await FaucetApi.getStats();

// Get user history
const history = await FaucetApi.getUserHistory(userId, limit);
```

#### TonBalanceFetcher (`src/lib/tonBalanceFetcher.ts`)

```typescript
import { defaultTonFetcher } from '@/lib/tonBalanceFetcher';

// Fetch balance
const result = await defaultTonFetcher.fetchBalance(address);

// Multiple balances
const results = await defaultTonFetcher.fetchMultipleBalances([address1, address2]);
```

## Database Schema

The system requires the following database tables and functions (see `FAUCET_DATABASE_SCHEMA.sql`):

### Tables
- `faucet_claims` - Records all faucet claims
- `users` - Extended with `last_faucet_claim` column
- `system_config` - Configuration settings

### Functions
- `check_faucet_eligibility()` - Check if user can claim
- `process_faucet_claim()` - Process a claim
- `get_faucet_stats()` - Get statistics
- `get_user_faucet_history()` - Get user's claim history
- `calculate_faucet_amount()` - Calculate claim amount

## Configuration

Set these environment variables:

```env
REACT_APP_TONCENTER_API_KEY=your_mainnet_api_key
REACT_APP_TONCENTER_TESTNET_API_KEY=your_testnet_api_key
REACT_APP_NETWORK=mainnet  # or testnet
```

## Usage Example

```tsx
import React from 'react';
import TokenReceiver from '@/components/TokenReceiver';

const MyFaucetPage = () => {
  const handleClaimSuccess = (amount: number) => {
    console.log(`User claimed ${amount} STK tokens!`);
    // Refresh user balance, show success message, etc.
  };

  return (
    <div className="faucet-container">
      <h1>Claim Your STK Tokens</h1>
      <TokenReceiver onClaimSuccess={handleClaimSuccess} />
    </div>
  );
};
```

## Claim Calculation

The claim amount is calculated as:
```
claimAmount = min(
  baseAmount + (tonBalance * balanceMultiplier),
  maxAmount
)
```

**Default Configuration:**
- Base Amount: 10 STK
- Balance Multiplier: 0.1 (10% of TON balance)
- Max Amount: 1000 STK
- Min TON Balance: 0.1 TON
- Cooldown: 24 hours

## Security Features

1. **Address Validation**: Only valid TON addresses accepted
2. **Cooldown System**: Prevents spam claims
3. **Balance Verification**: Real-time TON balance checking
4. **Rate Limiting**: Database-level rate limiting
5. **Input Sanitization**: All inputs are validated and sanitized

## Customization

### Styling
The component uses Tailwind CSS classes. You can customize the appearance by:

1. Passing custom `className` prop
2. Modifying the component's CSS classes
3. Using CSS-in-JS or styled-components

### Configuration
Update the faucet configuration in the database:

```sql
UPDATE system_config SET config_value = '20' WHERE config_key = 'faucet_base_amount';
UPDATE system_config SET config_value = '0.15' WHERE config_key = 'faucet_balance_multiplier';
UPDATE system_config SET config_value = '2000' WHERE config_key = 'faucet_max_amount';
```

## API Endpoints

The system uses Supabase RPC functions:

- `check_faucet_eligibility(user_id, cooldown_hours)`
- `process_faucet_claim(user_id, wallet_address, ton_balance, claim_amount, network)`
- `get_faucet_stats()`
- `get_user_faucet_history(user_id, limit)`
- `calculate_faucet_amount(ton_balance, base_amount, balance_multiplier, max_amount)`

## Error Handling

The system includes comprehensive error handling:

- Network errors (API timeouts, connection issues)
- Invalid addresses
- Insufficient balance
- Cooldown violations
- Database errors
- Rate limiting

All errors are logged and user-friendly messages are displayed.

## Testing

To test the system:

1. Set up testnet configuration
2. Use testnet TON addresses
3. Verify balance fetching works
4. Test claim process
5. Verify cooldown system
6. Check database records

## Deployment

1. Run the database migration (`FAUCET_DATABASE_SCHEMA.sql`)
2. Set environment variables
3. Deploy the application
4. Configure TON Center API keys
5. Test with real addresses

## Support

For issues or questions:
1. Check the console for error messages
2. Verify database connection
3. Ensure API keys are correct
4. Check network connectivity
5. Review the database logs
