import { supabase } from '@/lib/supabaseClient';

export const checkDatabaseSchema = async () => {
  console.log('🔍 Checking database schema...');
  
  const tablesToCheck = [
    'users',
    'user_game_data', 
    'token_purchases',
    'stakes',
    'referral_earnings',
    'earning_history',
    'sbt_history'
  ];

  const results: Record<string, { exists: boolean; columns?: string[]; error?: string }> = {};

  for (const tableName of tablesToCheck) {
    try {
      console.log(`📋 Checking table: ${tableName}`);
      
      // Try to get table info by querying with limit 0
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(0);

      if (error) {
        results[tableName] = { 
          exists: false, 
          error: error.message 
        };
        console.log(`❌ Table ${tableName} does not exist or is not accessible:`, error.message);
      } else {
        results[tableName] = { 
          exists: true,
          columns: data ? Object.keys(data[0] || {}) : []
        };
        console.log(`✅ Table ${tableName} exists`);
      }
    } catch (err) {
      results[tableName] = { 
        exists: false, 
        error: err instanceof Error ? err.message : 'Unknown error' 
      };
      console.log(`❌ Error checking table ${tableName}:`, err);
    }
  }

  console.log('📊 Database schema check complete:', results);
  return results;
};

export const testUserDataFetch = async (userId: number) => {
  console.log(`🧪 Testing user data fetch for user ID: ${userId}`);
  
  try {
    // Test basic user fetch
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError) {
      console.error('❌ User fetch failed:', userError);
      return { success: false, error: userError };
    }

    console.log('✅ User data fetched:', {
      id: userData.id,
      username: userData.username,
      telegram_id: userData.telegram_id,
      balance: userData.balance,
      total_sbt: userData.total_sbt
    });

    return { success: true, userData };
  } catch (error) {
    console.error('❌ Test failed:', error);
    return { success: false, error };
  }
};
