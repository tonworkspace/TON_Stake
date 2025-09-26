// Test script to verify duplicate referral prevention
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client (you'll need to add your credentials)
const supabaseUrl = process.env.SUPABASE_URL || 'your-supabase-url';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'your-supabase-anon-key';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testDuplicatePrevention() {
  console.log('🧪 Testing Duplicate Referral Prevention...\n');

  try {
    // Test 1: Check if enhanced function exists
    console.log('1. Testing enhanced referral function...');
    try {
      const { data: result, error } = await supabase.rpc('create_referral_enhanced', {
        p_referrer_id: 999999,
        p_referred_id: 999998,
        p_referral_code: 'TONERS999999TEST',
        p_ip_address: null,
        p_user_agent: 'Test Script'
      });
      
      if (error) {
        console.log('❌ Enhanced function error:', error.message);
      } else {
        console.log('✅ Enhanced function works:', result);
      }
    } catch (err) {
      console.log('❌ Enhanced function failed:', err.message);
    }

    // Test 2: Test duplicate prevention
    console.log('\n2. Testing duplicate prevention...');
    
    // First attempt
    const { data: result1, error: error1 } = await supabase.rpc('create_referral_enhanced', {
      p_referrer_id: 999997,
      p_referred_id: 999996,
      p_referral_code: 'TONERS999997TEST1',
      p_ip_address: null,
      p_user_agent: 'Test Script'
    });
    
    console.log('First attempt:', result1?.success ? '✅ Success' : '❌ Failed:', result1?.error);
    
    // Second attempt (should fail)
    const { data: result2, error: error2 } = await supabase.rpc('create_referral_enhanced', {
      p_referrer_id: 999997,
      p_referred_id: 999996,
      p_referral_code: 'TONERS999997TEST2',
      p_ip_address: null,
      p_user_agent: 'Test Script'
    });
    
    console.log('Second attempt:', result2?.success ? '❌ Should have failed' : '✅ Correctly prevented:', result2?.error);

    // Test 3: Test self-referral prevention
    console.log('\n3. Testing self-referral prevention...');
    const { data: selfResult, error: selfError } = await supabase.rpc('create_referral_enhanced', {
      p_referrer_id: 999995,
      p_referred_id: 999995,
      p_referral_code: 'TONERS999995SELF',
      p_ip_address: null,
      p_user_agent: 'Test Script'
    });
    
    console.log('Self-referral attempt:', selfResult?.success ? '❌ Should have failed' : '✅ Correctly prevented:', selfResult?.error);

    // Test 4: Test referral status check
    console.log('\n4. Testing referral status check...');
    try {
      const { data: status, error: statusError } = await supabase.rpc('check_referral_status', {
        p_referrer_id: 999997,
        p_referred_id: 999996
      });
      
      if (statusError) {
        console.log('❌ Status check error:', statusError.message);
      } else {
        console.log('✅ Status check works:', status);
      }
    } catch (err) {
      console.log('❌ Status check failed:', err.message);
    }

    // Test 5: Check referral attempts table
    console.log('\n5. Checking referral attempts table...');
    const { data: attempts, error: attemptsError } = await supabase
      .from('referral_attempts')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(5);

    if (attemptsError) {
      console.log('❌ Referral attempts error:', attemptsError.message);
    } else {
      console.log(`✅ Referral attempts table has ${attempts?.length || 0} recent records`);
      if (attempts && attempts.length > 0) {
        console.log('Recent attempts:', attempts.map(a => ({
          id: a.id,
          status: a.status,
          reason: a.reason,
          timestamp: a.timestamp
        })));
      }
    }

    // Test 6: Test analytics function
    console.log('\n6. Testing analytics function...');
    try {
      const { data: analytics, error: analyticsError } = await supabase.rpc('get_referral_analytics');
      
      if (analyticsError) {
        console.log('❌ Analytics error:', analyticsError.message);
      } else {
        console.log('✅ Analytics works:', analytics);
      }
    } catch (err) {
      console.log('❌ Analytics failed:', err.message);
    }

    console.log('\n🎯 Duplicate Prevention Test Complete!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testDuplicatePrevention();










