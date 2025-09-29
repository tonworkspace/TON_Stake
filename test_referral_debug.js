// Simple test script to debug referral system
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client (you'll need to add your credentials)
const supabaseUrl = process.env.SUPABASE_URL || 'your-supabase-url';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'your-supabase-anon-key';
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugReferralSystem() {
  console.log('🔍 Debugging Referral System...\n');

  try {
    // Test 1: Check if referrals table has data
    console.log('1. Checking referrals table...');
    const { data: referrals, error: referralsError } = await supabase
      .from('referrals')
      .select('*')
      .limit(5);

    if (referralsError) {
      console.log('❌ Referrals table error:', referralsError.message);
    } else {
      console.log(`✅ Referrals table has ${referrals?.length || 0} records`);
      if (referrals && referrals.length > 0) {
        console.log('Sample referral:', referrals[0]);
      }
    }

    // Test 2: Check if users table has referral data
    console.log('\n2. Checking users table for referral data...');
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, username, referrer_id, referral_code, direct_referrals')
      .limit(5);

    if (usersError) {
      console.log('❌ Users table error:', usersError.message);
    } else {
      console.log(`✅ Users table has ${users?.length || 0} records`);
      if (users && users.length > 0) {
        console.log('Sample user with referral data:', users[0]);
      }
    }

    // Test 3: Test the referral query that the frontend uses
    console.log('\n3. Testing referral query...');
    const testUserId = 1; // Use a test user ID
    const { data: userReferrals, error: queryError } = await supabase
      .from('referrals')
      .select(`
        *,
        referred:users!referred_id(
          id,
          username,
          telegram_id,
          total_earned,
          total_sbt,
          balance,
          rank,
          is_active,
          created_at,
          login_streak,
          last_active,
          mining_level,
          direct_referrals
        )
      `)
      .eq('referrer_id', testUserId)
      .order('created_at', { ascending: false });

    if (queryError) {
      console.log('❌ Referral query error:', queryError.message);
    } else {
      console.log(`✅ Referral query returned ${userReferrals?.length || 0} referrals for user ${testUserId}`);
      if (userReferrals && userReferrals.length > 0) {
        console.log('Sample referral with user data:', userReferrals[0]);
      }
    }

    // Test 4: Check if referral_earnings table exists
    console.log('\n4. Checking referral_earnings table...');
    const { data: earnings, error: earningsError } = await supabase
      .from('referral_earnings')
      .select('*')
      .limit(5);

    if (earningsError) {
      console.log('❌ Referral earnings table error:', earningsError.message);
    } else {
      console.log(`✅ Referral earnings table has ${earnings?.length || 0} records`);
    }

    // Test 5: Check if sbt_history table exists and has correct structure
    console.log('\n5. Checking sbt_history table...');
    const { data: sbtHistory, error: sbtError } = await supabase
      .from('sbt_history')
      .select('*')
      .limit(5);

    if (sbtError) {
      console.log('❌ SBT history table error:', sbtError.message);
    } else {
      console.log(`✅ SBT history table has ${sbtHistory?.length || 0} records`);
      if (sbtHistory && sbtHistory.length > 0) {
        console.log('Sample SBT history record:', sbtHistory[0]);
      }
    }

    // Test 6: Test the create_referral function
    console.log('\n6. Testing create_referral function...');
    try {
      const { data: createResult, error: createError } = await supabase.rpc('create_referral', {
        p_referrer_id: 999999,
        p_referred_id: 999998
      });
      
      if (createError) {
        console.log('❌ Create referral function error:', createError.message);
      } else {
        console.log('✅ Create referral function works:', createResult);
      }
    } catch (err) {
      console.log('❌ Create referral function failed:', err.message);
    }

    console.log('\n🎯 Referral System Debug Complete!');
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

// Run the debug
debugReferralSystem();











