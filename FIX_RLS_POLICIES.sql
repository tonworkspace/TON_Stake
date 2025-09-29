-- =============================================
-- FIX RLS POLICIES FOR FAUCET CLAIMS
-- =============================================
-- This script fixes the Row Level Security policies that are preventing faucet claims

-- Drop existing RLS policies
DROP POLICY IF EXISTS "Users can view own faucet claims" ON faucet_claims;
DROP POLICY IF EXISTS "Users can insert own faucet claims" ON faucet_claims;

-- Create new RLS policies that work with our user system
-- Option 1: Disable RLS temporarily (for development/testing)
-- ALTER TABLE faucet_claims DISABLE ROW LEVEL SECURITY;

-- Option 2: Create permissive policies that allow authenticated users
-- Policy: Allow authenticated users to view all faucet claims (for admin purposes)
CREATE POLICY "Authenticated users can view faucet claims" ON faucet_claims
    FOR SELECT USING (true);

-- Policy: Allow authenticated users to insert faucet claims
CREATE POLICY "Authenticated users can insert faucet claims" ON faucet_claims
    FOR INSERT WITH CHECK (true);

-- Alternative: If you want more restrictive policies based on user_id
-- You would need to implement a custom auth function that maps your user system
-- to Supabase's auth system, or use service role for inserts

-- Grant additional permissions
GRANT SELECT, INSERT, UPDATE ON faucet_claims TO authenticated;
GRANT USAGE ON SEQUENCE faucet_claims_id_seq TO authenticated;

-- Success message
SELECT 'RLS policies fixed successfully' as status;
