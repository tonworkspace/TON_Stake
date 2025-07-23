# 🚀 Advanced Staking & HYIP Platform

A comprehensive DeFi platform built on TON blockchain offering advanced staking and High-Yield Investment Program (HYIP) features with daily TON rewards.

## 🌟 Features

### 🏆 Multi-Tier Staking System
- **5 Staking Tiers**: Bronze, Silver, Gold, Platinum, Diamond
- **Daily ROI**: 1% to 3% depending on tier
- **Speed Boosts**: Accelerate earnings with boost features
- **Cycle Management**: Automatic cycle completion at 300-450% returns
- **Referral Integration**: Earn from team performance

### 💎 HYIP Investment Platform
- **4 Risk Levels**: Conservative, Balanced, Aggressive, Extreme
- **Daily Returns**: 0.8% to 2.5% based on risk level
- **Welcome Bonuses**: Up to 15% bonus on investments
- **Insurance Protection**: Risk mitigation for higher tiers
- **Early Withdrawal**: Available with fee structure

### 📊 Portfolio Dashboard
- **Real-time Analytics**: Live portfolio tracking
- **Performance Metrics**: ROI, earnings, projections
- **Activity Logs**: Complete transaction history
- **Risk Management**: Portfolio allocation visualization

## 🎯 Staking Tiers

| Tier | Min Stake | Max Stake | Daily ROI | Max Return | Features |
|------|-----------|-----------|-----------|------------|----------|
| 🥉 Bronze | 1 TON | 50 TON | 1% | 300% | Basic Support |
| 🥈 Silver | 50 TON | 200 TON | 1.5% | 375% | Priority Support, Speed Boost |
| 🥇 Gold | 200 TON | 1,000 TON | 2% | 400% | VIP Support, Referral Bonus |
| 💎 Platinum | 1,000 TON | 5,000 TON | 2.5% | 450% | 24/7 Support, GLP Rewards |
| 💎 Diamond | 5,000 TON | 50,000 TON | 3% | 450% | Personal Manager, Exclusive Events |

## 🎲 HYIP Investment Plans

| Plan | Risk Level | Min Investment | Daily Return | Total Return | Bonus |
|------|------------|----------------|--------------|--------------|-------|
| 🌱 Conservative | Low | 10 TON | 0.8% | 240% | 0% |
| ⚖️ Balanced | Medium | 50 TON | 1.2% | 360% | 5% |
| 🚀 Aggressive | High | 100 TON | 1.8% | 540% | 10% |
| 💎 Extreme | Extreme | 500 TON | 2.5% | 750% | 15% |

## 🛠️ Installation & Setup

### 1. Database Setup
```sql
-- Run the HYIP database schema
\i HYIP_DATABASE_SCHEMA.sql

-- Run the main schema (if not already done)
\i schema.sql
```

### 2. Environment Configuration
```bash
# Add to your .env file
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_TON_NETWORK=mainnet
```

### 3. Component Integration
```tsx
// Import the components
import DailyRewards from './components/DailyRewards';
import HYIPPlatform from './components/HYIPPlatform';
import StakingDashboard from './components/StakingDashboard';

// Use in your app
<StakingDashboard />
```

## 📱 Usage Guide

### Creating a Stake
1. Navigate to the Staking section
2. Choose your preferred tier
3. Enter stake amount (within tier limits)
4. Confirm transaction
5. Start earning daily rewards

### Making HYIP Investment
1. Select investment plan based on risk tolerance
2. Enter investment amount
3. Review welcome bonus and terms
4. Confirm investment
5. Monitor daily returns

### Claiming Rewards
1. Check available rewards in dashboard
2. Review fee breakdown (60% direct, 10% GLP, 10% STK, 20% reinvestment)
3. Confirm withdrawal
4. Receive rewards in your wallet

### Speed Boosts
1. Available for Silver tier and above
2. Activate boost to increase daily earnings by 50%
3. Boosts are included in higher tiers
4. Can be purchased separately for lower tiers

## 🔧 Technical Architecture

### Database Schema
- **stakes**: User staking positions
- **hyip_investments**: HYIP investment records
- **hyip_plans**: Investment plan definitions
- **hyip_withdrawals**: Withdrawal transactions
- **hyip_insurance_pool**: Insurance fund management
- **user_activity_logs**: Activity tracking

### Key Functions
- `create_hyip_investment()`: Create new investment
- `withdraw_hyip_earnings()`: Process withdrawals
- `calculate_hyip_daily_rewards()`: Calculate daily returns
- `early_withdraw_hyip()`: Handle early withdrawals
- `process_hyip_insurance_claim()`: Insurance claims

### Security Features
- Row Level Security (RLS) enabled
- Input validation and sanitization
- Rate limiting on transactions
- Audit logging for all activities

## 💰 Fee Structure

### Staking Fees
- **Deposit**: 5% to STK tokens
- **Withdrawal**: 10% to STK, 10% to GLP, 20% to reinvestment
- **Speed Boost**: Varies by tier

### HYIP Fees
- **Platform Fee**: 10% on withdrawals
- **Insurance Pool**: 5% on withdrawals
- **Early Withdrawal**: 5-20% based on plan
- **Welcome Bonus**: 0-15% based on plan

## 🎨 UI/UX Features

### Modern Design
- **Futuristic Theme**: Dark mode with neon accents
- **Responsive Layout**: Mobile-first design
- **Smooth Animations**: CSS transitions and hover effects
- **Real-time Updates**: Live data refresh

### User Experience
- **Intuitive Navigation**: Tab-based interface
- **Progress Tracking**: Visual progress bars
- **Activity Feed**: Real-time transaction history
- **Portfolio Overview**: Comprehensive dashboard

## 📈 Analytics & Monitoring

### Performance Metrics
- **Total Portfolio Value**: Combined staking + HYIP
- **Daily Earnings**: Real-time calculation
- **Monthly Projections**: 30-day forecasts
- **ROI Tracking**: Historical performance

### Risk Management
- **Portfolio Allocation**: Visual breakdown
- **Risk Level Indicators**: Color-coded risk assessment
- **Insurance Coverage**: Protection levels
- **Early Warning System**: Risk alerts

## 🔄 Integration Points

### TON Blockchain
- **Wallet Integration**: TON Connect support
- **Transaction Processing**: Secure on-chain operations
- **Balance Management**: Real-time wallet sync

### External Services
- **Price Feeds**: TON/USD conversion
- **Analytics**: Performance tracking
- **Notifications**: Email/SMS alerts

## 🚀 Deployment

### Production Setup
```bash
# Build the application
npm run build

# Deploy to your hosting platform
# Configure environment variables
# Set up database connections
# Enable monitoring and logging
```

### Monitoring
- **Performance Metrics**: Track system health
- **Error Logging**: Monitor for issues
- **User Analytics**: Usage patterns
- **Security Alerts**: Unusual activity

## 🔒 Security Considerations

### Smart Contract Security
- **Audited Contracts**: Professional security audits
- **Multi-sig Wallets**: Secure fund management
- **Emergency Pauses**: Circuit breakers for protection

### Platform Security
- **Rate Limiting**: Prevent abuse
- **Input Validation**: Sanitize all inputs
- **Access Control**: Role-based permissions
- **Audit Trails**: Complete transaction logs

## 📞 Support & Documentation

### Getting Help
- **Documentation**: Comprehensive guides
- **Community**: Discord/Telegram groups
- **Support Tickets**: Technical assistance
- **FAQ**: Common questions and answers

### Development Resources
- **API Documentation**: Integration guides
- **SDK Examples**: Code samples
- **Testing Tools**: Development utilities
- **Deployment Guides**: Production setup

## 🎯 Roadmap

### Phase 1 (Current)
- ✅ Multi-tier staking system
- ✅ HYIP investment platform
- ✅ Portfolio dashboard
- ✅ Basic analytics

### Phase 2 (Next)
- 🔄 Advanced analytics
- 🔄 Mobile app development
- 🔄 Social features
- 🔄 Advanced risk management

### Phase 3 (Future)
- 📋 Cross-chain integration
- 📋 DeFi protocol integration
- 📋 AI-powered recommendations
- 📋 Institutional features

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🤝 Contributing

We welcome contributions! Please see our contributing guidelines for more information.

---

**Built with ❤️ for the TON ecosystem** 