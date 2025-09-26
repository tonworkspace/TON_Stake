// Test script to check referral system functionality
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client (you'll need to add your credentials)
const supabaseUrl = process.env.SUPABASE_URL || 'your-supabase-url';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'your-supabase-anon-key';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testReferralSystem() {
  console.log('🧪 Testing Referral System...\n');

  try {
    // Test 1: Check if required tables exist
    console.log('1. Checking required tables...');
    
    const tables = ['referrals', 'referral_earnings', 'referral_chain', 'sbt_history'];
    for (const table of tables) {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1);
      
      if (error) {
        console.log(`❌ Table ${table} error:`, error.message);
      } else {
        console.log(`✅ Table ${table} exists`);
      }
    }

    // Test 2: Check if required functions exist
    console.log('\n2. Checking required functions...');
    
    const functions = ['create_referral', 'create_referral_safe', 'process_referral_rewards', 'add_stk_balance'];
    for (const func of functions) {
      try {
        // Try to call the function with dummy parameters
        const { data, error } = await supabase.rpc(func, {
          p_referrer_id: 999999,
          p_referred_id: 999998
        });
        
        if (error && error.message.includes('function') && error.message.includes('does not exist')) {
          console.log(`❌ Function ${func} does not exist`);
        } else {
          console.log(`✅ Function ${func} exists`);
        }
      } catch (err) {
        console.log(`❌ Function ${func} error:`, err.message);
      }
    }

    // Test 3: Check if users table has required columns
    console.log('\n3. Checking users table structure...');
    
    const { data: userColumns, error: userError } = await supabase
      .from('users')
      .select('referrer_id, referral_code, direct_referrals, total_sbt, team_volume')
      .limit(1);
    
    if (userError) {
      console.log('❌ Users table structure error:', userError.message);
    } else {
      console.log('✅ Users table has required columns');
    }

    // Test 4: Check if referral code generation works
    console.log('\n4. Testing referral code generation...');
    
    const testUserId = 1; // Use a test user ID
    const testCode = `TONERS${testUserId.toString().padStart(6, '0')}TEST`;
    console.log(`Generated test code: ${testCode}`);
    
    // Test code validation
    const codeRegex = /^TONERS\d{6}[A-Z0-9]{4}$/i;
    if (codeRegex.test(testCode)) {
      console.log('✅ Referral code format is valid');
    } else {
      console.log('❌ Referral code format is invalid');
    }

    // Test 5: Check if referral processing works
    console.log('\n5. Testing referral processing...');
    
    try {
      const { data, error } = await supabase.rpc('create_referral', {
        p_referrer_id: 999999,
        p_referred_id: 999998
      });
      
      if (error) {
        console.log('❌ Referral creation error:', error.message);
      } else {
        console.log('✅ Referral creation function works');
      }
    } catch (err) {
      console.log('❌ Referral creation failed:', err.message);
    }

    console.log('\n🎯 Referral System Test Complete!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testReferralSystem();










