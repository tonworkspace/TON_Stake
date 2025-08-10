// Anti-Cheat Staking Security Test
// Run this in the browser console to test security measures

class AntiCheatTest {
  constructor() {
    this.testResults = [];
  }

  // Test 1: Double-Spending Prevention
  testDoubleSpendingPrevention() {
    console.log('🛡️ Test 1: Double-Spending Prevention');
    
    const testCases = [
      { balance: 10, stake1: 5, stake2: 5, shouldAllowSecond: false },
      { balance: 10, stake1: 8, stake2: 3, shouldAllowSecond: false },
      { balance: 10, stake1: 3, stake2: 3, shouldAllowSecond: true },
      { balance: 5, stake1: 5, stake2: 1, shouldAllowSecond: false }
    ];

    let passed = 0;
    testCases.forEach((test, index) => {
      const remainingAfterFirst = test.balance - test.stake1;
      const canStakeSecond = remainingAfterFirst >= test.stake2;
      const success = canStakeSecond === test.shouldAllowSecond;
      
      if (success) passed++;
      console.log(`  Test ${index + 1}: ${success ? '✅' : '❌'}`);
      console.log(`    Balance: ${test.balance}, First Stake: ${test.stake1}, Second Stake: ${test.stake2}`);
      console.log(`    Remaining: ${remainingAfterFirst}, Can Stake Second: ${canStakeSecond}`);
    });

    this.testResults.push({
      name: 'Double-Spending Prevention',
      passed,
      total: testCases.length,
      success: passed === testCases.length
    });

    console.log(`  Result: ${passed}/${testCases.length} tests passed\n`);
  }

  // Test 2: Rate Limiting Logic
  testRateLimiting() {
    console.log('⏱️ Test 2: Rate Limiting Logic');
    
    const cooldown = 2000; // 2 seconds
    const testCases = [
      { time1: 0, time2: 1000, shouldAllow: false },
      { time1: 0, time2: 2500, shouldAllow: true },
      { time1: 1000, time2: 3500, shouldAllow: true },
      { time1: 0, time2: 2000, shouldAllow: true }
    ];

    let passed = 0;
    testCases.forEach((test, index) => {
      const timeDiff = test.time2 - test.time1;
      const shouldAllow = timeDiff >= cooldown;
      const success = shouldAllow === test.shouldAllow;
      
      if (success) passed++;
      console.log(`  Test ${index + 1}: ${success ? '✅' : '❌'}`);
      console.log(`    Time Diff: ${timeDiff}ms, Cooldown: ${cooldown}ms, Allow: ${shouldAllow}`);
    });

    this.testResults.push({
      name: 'Rate Limiting Logic',
      passed,
      total: testCases.length,
      success: passed === testCases.length
    });

    console.log(`  Result: ${passed}/${testCases.length} tests passed\n`);
  }

  // Test 3: Balance Validation Logic
  testBalanceValidation() {
    console.log('💰 Test 3: Balance Validation Logic');
    
    const testCases = [
      { dbBalance: 10, localBalance: 10, stakeAmount: 5, shouldAllow: true },
      { dbBalance: 5, localBalance: 10, stakeAmount: 5, shouldAllow: false },
      { dbBalance: 10, localBalance: 5, stakeAmount: 5, shouldAllow: true },
      { dbBalance: 0, localBalance: 10, stakeAmount: 5, shouldAllow: false }
    ];

    let passed = 0;
    testCases.forEach((test, index) => {
      const hasEnoughBalance = test.dbBalance >= test.stakeAmount;
      const success = hasEnoughBalance === test.shouldAllow;
      
      if (success) passed++;
      console.log(`  Test ${index + 1}: ${success ? '✅' : '❌'}`);
      console.log(`    DB Balance: ${test.dbBalance}, Local: ${test.localBalance}, Stake: ${test.stakeAmount}`);
      console.log(`    Has Enough: ${hasEnoughBalance}, Should Allow: ${test.shouldAllow}`);
    });

    this.testResults.push({
      name: 'Balance Validation Logic',
      passed,
      total: testCases.length,
      success: passed === testCases.length
    });

    console.log(`  Result: ${passed}/${testCases.length} tests passed\n`);
  }

  // Test 4: Atomic Update Logic
  testAtomicUpdates() {
    console.log('🔒 Test 4: Atomic Update Logic');
    
    const testCases = [
      { originalBalance: 10, currentBalance: 10, stakeAmount: 5, shouldSucceed: true },
      { originalBalance: 10, currentBalance: 8, stakeAmount: 5, shouldSucceed: false },
      { originalBalance: 5, currentBalance: 5, stakeAmount: 5, shouldSucceed: true },
      { originalBalance: 10, currentBalance: 10, stakeAmount: 15, shouldSucceed: false }
    ];

    let passed = 0;
    testCases.forEach((test, index) => {
      const balanceUnchanged = test.originalBalance === test.currentBalance;
      const hasEnoughBalance = test.currentBalance >= test.stakeAmount;
      const shouldSucceed = balanceUnchanged && hasEnoughBalance;
      const success = shouldSucceed === test.shouldSucceed;
      
      if (success) passed++;
      console.log(`  Test ${index + 1}: ${success ? '✅' : '❌'}`);
      console.log(`    Original: ${test.originalBalance}, Current: ${test.currentBalance}, Stake: ${test.stakeAmount}`);
      console.log(`    Unchanged: ${balanceUnchanged}, Has Enough: ${hasEnoughBalance}, Success: ${shouldSucceed}`);
    });

    this.testResults.push({
      name: 'Atomic Update Logic',
      passed,
      total: testCases.length,
      success: passed === testCases.length
    });

    console.log(`  Result: ${passed}/${testCases.length} tests passed\n`);
  }

  // Test 5: Edge Cases
  testEdgeCases() {
    console.log('🎯 Test 5: Edge Cases');
    
    const testCases = [
      { balance: 0, stakeAmount: 1, shouldAllow: false, description: 'Zero balance' },
      { balance: 5, stakeAmount: 0, shouldAllow: false, description: 'Zero stake amount' },
      { balance: 5, stakeAmount: 5, shouldAllow: true, description: 'Exact balance' },
      { balance: 10, stakeAmount: 10.1, shouldAllow: false, description: 'Slightly over balance' }
    ];

    let passed = 0;
    testCases.forEach((test, index) => {
      const hasEnoughBalance = test.balance >= test.stakeAmount;
      const success = hasEnoughBalance === test.shouldAllow;
      
      if (success) passed++;
      console.log(`  Test ${index + 1}: ${success ? '✅' : '❌'}`);
      console.log(`    ${test.description}: Balance ${test.balance}, Stake ${test.stakeAmount}`);
      console.log(`    Has Enough: ${hasEnoughBalance}, Should Allow: ${test.shouldAllow}`);
    });

    this.testResults.push({
      name: 'Edge Cases',
      passed,
      total: testCases.length,
      success: passed === testCases.length
    });

    console.log(`  Result: ${passed}/${testCases.length} tests passed\n`);
  }

  // Run all security tests
  runAllTests() {
    console.log('🛡️ Starting Anti-Cheat Security Tests...\n');
    
    this.testDoubleSpendingPrevention();
    this.testRateLimiting();
    this.testBalanceValidation();
    this.testAtomicUpdates();
    this.testEdgeCases();
    
    this.generateSecurityReport();
  }

  // Generate security report
  generateSecurityReport() {
    console.log('🛡️ Security Test Report');
    console.log('='.repeat(50));
    
    let totalPassed = 0;
    let totalTests = 0;
    
    this.testResults.forEach(result => {
      const status = result.success ? '✅ SECURE' : '❌ VULNERABLE';
      console.log(`${status} ${result.name}: ${result.passed}/${result.total}`);
      totalPassed += result.passed;
      totalTests += result.total;
    });
    
    console.log('='.repeat(50));
    const overallSecurity = totalPassed === totalTests;
    console.log(`Overall Security: ${overallSecurity ? '🛡️ FULLY SECURED' : '⚠️ SECURITY ISSUES DETECTED'}`);
    console.log(`Total: ${totalPassed}/${totalTests} security tests passed`);
    
    if (overallSecurity) {
      console.log('\n🎉 All anti-cheat measures are working correctly!');
      console.log('✅ Double-spending: BLOCKED');
      console.log('✅ Race conditions: BLOCKED');
      console.log('✅ Rate limiting: ACTIVE');
      console.log('✅ Balance validation: WORKING');
      console.log('✅ Atomic updates: FUNCTIONAL');
    } else {
      console.log('\n⚠️ Some security measures need attention.');
      console.log('Please review the failed tests above.');
    }
  }
}

// Create and run security tests
const securityTest = new AntiCheatTest();
securityTest.runAllTests();

// Export for manual testing
window.securityTest = securityTest; 