# Staking Experience - Complete Testing Guide

## 🎯 Testing Objectives

Verify that the staking experience works 100% perfectly by testing:
1. **Balance Management** - Balance updates correctly
2. **Stake Creation** - Stakes are created properly
3. **Validation** - Proper error handling and validation
4. **UI/UX** - Smooth user experience
5. **Data Persistence** - Data survives page refreshes
6. **Edge Cases** - Handle unusual scenarios

## 🧪 Test Scenarios

### Test 1: Basic Staking Flow
**Objective:** Verify the complete staking process works end-to-end

**Steps:**
1. **Deposit TON** to your account (e.g., 10 TON)
2. **Verify balance** shows correctly (10 TON)
3. **Select a staking tier** (e.g., Bronze - 1 TON minimum)
4. **Enter stake amount** (e.g., 5 TON)
5. **Click "Create Stake"**
6. **Verify results:**
   - ✅ Balance reduces to 5 TON
   - ✅ Stake appears in active stakes list
   - ✅ Success notification appears
   - ✅ Modal closes automatically

**Expected Console Logs:**
```
💰 Balance Update: 10 → 5 (staked: 5)
📊 Stakes Loaded: { totalStakes: 1, userStakes: 1, activeStakes: 1, totalStaked: 5 }
```

### Test 2: Balance Validation
**Objective:** Verify balance validation prevents overstaking

**Steps:**
1. **Try to stake more than balance** (e.g., 6 TON when you have 5 TON)
2. **Verify error handling:**
   - ✅ Error message appears
   - ✅ Stake creation is blocked
   - ✅ Balance remains unchanged
   - ✅ Modal stays open

**Expected Behavior:**
- Alert: "Insufficient balance!"
- No stake created
- Balance stays at 5 TON

### Test 3: Multiple Stakes
**Objective:** Verify multiple stakes work correctly

**Steps:**
1. **Create first stake** (e.g., 2 TON from 5 TON balance)
2. **Verify balance** (should be 3 TON)
3. **Create second stake** (e.g., 1 TON)
4. **Verify results:**
   - ✅ Balance reduces to 2 TON
   - ✅ Both stakes appear in list
   - ✅ Total staked amount is correct

### Test 4: Data Persistence
**Objective:** Verify data survives page refresh

**Steps:**
1. **Create a stake** (e.g., 2 TON)
2. **Refresh the page**
3. **Verify data persistence:**
   - ✅ Balance remains correct
   - ✅ Stake still appears in list
   - ✅ Stake details are preserved

### Test 5: Edge Cases
**Objective:** Test unusual scenarios

**Test Cases:**
1. **Zero balance staking:**
   - Try to stake with 0 TON balance
   - Should show "Insufficient balance!"

2. **Minimum stake amount:**
   - Try to stake less than 1 TON
   - Should show validation error

3. **Maximum stake amount:**
   - Try to stake more than tier maximum
   - Should show validation error

4. **Network issues:**
   - Disconnect internet during staking
   - Should handle gracefully with offline queue

### Test 6: UI/UX Flow
**Objective:** Verify smooth user experience

**Check Points:**
1. **Loading states:**
   - ✅ Loading spinner appears during staking
   - ✅ Button is disabled during processing
   - ✅ Loading state clears after completion

2. **Notifications:**
   - ✅ Success notification appears
   - ✅ Error notifications are clear
   - ✅ Notifications auto-dismiss

3. **Modal behavior:**
   - ✅ Modal opens smoothly
   - ✅ Modal closes after successful stake
   - ✅ Modal resets form fields

4. **Form validation:**
   - ✅ Real-time validation feedback
   - ✅ Clear error messages
   - ✅ Input restrictions work

## 🔍 Detailed Verification Checklist

### Balance Management
- [ ] Balance updates immediately after staking
- [ ] Balance persists after page refresh
- [ ] Balance cannot go negative
- [ ] Balance validation prevents overstaking
- [ ] Balance syncs between UI and database

### Stake Creation
- [ ] Stakes are created with correct data
- [ ] Stake IDs are unique and valid
- [ ] Stake amounts are accurate
- [ ] Stake dates are set correctly
- [ ] Stake status is active by default

### Database Operations
- [ ] Database function `create_stake` works
- [ ] Balance updates in database
- [ ] Stake records are created
- [ ] Activity logs are recorded
- [ ] No duplicate stakes created

### Local Storage
- [ ] Stakes saved to local storage
- [ ] User data updated in local storage
- [ ] Data integrity checks pass
- [ ] Local storage syncs with database

### Error Handling
- [ ] Insufficient balance errors handled
- [ ] Network errors handled gracefully
- [ ] Invalid input validation works
- [ ] Error messages are user-friendly
- [ ] System recovers from errors

### Performance
- [ ] Staking completes within 3 seconds
- [ ] UI remains responsive during staking
- [ ] No memory leaks
- [ ] Efficient database operations

## 🛠️ Debug Tools

### Console Logs to Monitor
```javascript
// Balance updates
💰 Balance Update: 10 → 5 (staked: 5)

// Stake loading
📊 Stakes Loaded: { totalStakes: 1, userStakes: 1, activeStakes: 1, totalStaked: 5 }

// Database operations
🔗 Database function called: create_stake
✅ Stake created successfully

// Error handling
❌ Staking failed: Insufficient balance
```

### Browser DevTools
1. **Network Tab:** Monitor API calls
2. **Console Tab:** Check for errors
3. **Application Tab:** Verify local storage
4. **Performance Tab:** Check for bottlenecks

### Database Verification
```sql
-- Check user balance
SELECT balance FROM users WHERE id = [user_id];

-- Check stakes
SELECT * FROM stakes WHERE user_id = [user_id] ORDER BY created_at DESC;

-- Check activity logs
SELECT * FROM user_activity_logs WHERE user_id = [user_id] AND action_type = 'stake_created';
```

## 🚨 Common Issues & Solutions

### Issue: Balance not updating
**Solution:** Check if `create_stake` function exists in database

### Issue: Stakes not appearing
**Solution:** Verify local storage and database sync

### Issue: Validation errors
**Solution:** Check input validation logic

### Issue: Slow performance
**Solution:** Monitor database function performance

### Issue: Data inconsistency
**Solution:** Clear local storage and reload

## 📊 Success Metrics

### Performance Targets
- ✅ Staking completes in < 3 seconds
- ✅ UI remains responsive
- ✅ No JavaScript errors
- ✅ Database operations succeed

### User Experience Targets
- ✅ Clear feedback for all actions
- ✅ Intuitive error messages
- ✅ Smooth animations
- ✅ Consistent behavior

### Data Integrity Targets
- ✅ Balance always accurate
- ✅ Stakes properly recorded
- ✅ No data loss on refresh
- ✅ Sync between UI and database

## 🎉 Completion Checklist

After running all tests, verify:

- [ ] ✅ All test scenarios pass
- [ ] ✅ No console errors
- [ ] ✅ Database operations successful
- [ ] ✅ UI/UX is smooth
- [ ] ✅ Error handling works
- [ ] ✅ Data persistence verified
- [ ] ✅ Performance is acceptable

## 🔄 Continuous Testing

For ongoing verification:
1. **Daily smoke tests** - Basic staking flow
2. **Weekly full tests** - All scenarios
3. **After deployments** - Complete verification
4. **User feedback** - Monitor for issues

---

**Ready to test?** Follow the scenarios above and check off each item as you verify it works correctly! 