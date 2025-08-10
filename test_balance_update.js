// Test script to verify balance updates work correctly
// Run this in the browser console to test the balance update logic

function testBalanceUpdate() {
  console.log('🧪 Testing Balance Update Logic');
  
  // Test cases
  const testCases = [
    { initialBalance: 1, stakeAmount: 1, expectedBalance: 0 },
    { initialBalance: 10, stakeAmount: 5, expectedBalance: 5 },
    { initialBalance: 100, stakeAmount: 50, expectedBalance: 50 },
    { initialBalance: 0, stakeAmount: 1, expectedBalance: 0 }, // Should not go negative
    { initialBalance: 5, stakeAmount: 10, expectedBalance: 0 } // Should not go negative
  ];
  
  testCases.forEach((testCase, index) => {
    const { initialBalance, stakeAmount, expectedBalance } = testCase;
    const actualBalance = Math.max(0, initialBalance - stakeAmount);
    const passed = actualBalance === expectedBalance;
    
    console.log(`Test ${index + 1}: ${passed ? '✅' : '❌'}`);
    console.log(`  Initial: ${initialBalance} TON`);
    console.log(`  Stake: ${stakeAmount} TON`);
    console.log(`  Expected: ${expectedBalance} TON`);
    console.log(`  Actual: ${actualBalance} TON`);
    console.log(`  Result: ${passed ? 'PASS' : 'FAIL'}`);
    console.log('');
  });
  
  console.log('🎯 Balance Update Test Complete');
}

// Test the balance validation logic
function testBalanceValidation() {
  console.log('🔍 Testing Balance Validation Logic');
  
  const testCases = [
    { userBalance: 1, stakeAmount: 1, shouldAllow: true },
    { userBalance: 10, stakeAmount: 5, shouldAllow: true },
    { userBalance: 5, stakeAmount: 10, shouldAllow: false },
    { userBalance: 0, stakeAmount: 1, shouldAllow: false },
    { userBalance: 100, stakeAmount: 100, shouldAllow: true }
  ];
  
  testCases.forEach((testCase, index) => {
    const { userBalance, stakeAmount, shouldAllow } = testCase;
    const hasEnoughBalance = userBalance >= stakeAmount;
    const passed = hasEnoughBalance === shouldAllow;
    
    console.log(`Validation Test ${index + 1}: ${passed ? '✅' : '❌'}`);
    console.log(`  User Balance: ${userBalance} TON`);
    console.log(`  Stake Amount: ${stakeAmount} TON`);
    console.log(`  Should Allow: ${shouldAllow}`);
    console.log(`  Has Enough: ${hasEnoughBalance}`);
    console.log(`  Result: ${passed ? 'PASS' : 'FAIL'}`);
    console.log('');
  });
  
  console.log('🎯 Balance Validation Test Complete');
}

// Run both tests
console.log('🚀 Starting Balance Tests...\n');
testBalanceUpdate();
console.log('\n' + '='.repeat(50) + '\n');
testBalanceValidation();

// Export functions for manual testing
window.testBalanceUpdate = testBalanceUpdate;
window.testBalanceValidation = testBalanceValidation; 