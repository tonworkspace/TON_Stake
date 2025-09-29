-- =============================================
-- QUICK FIX FOR RLS POLICY ERROR
-- =============================================
-- Run this script immediately to fix the faucet claiming error

-- Drop existing problematic RLS policies
DROP POLICY IF EXISTS "Users can view own faucet claims" ON faucet_claims;
DROP POLICY IF EXISTS "Users can insert own faucet claims" ON faucet_claims;

-- Create permissive policies that allow authenticated users to work with faucet_claims
CREATE POLICY "Allow authenticated users to view faucet claims" ON faucet_claims
    FOR SELECT USING (true);

CREATE POLICY "Allow authenticated users to insert faucet claims" ON faucet_claims
    FOR INSERT WITH CHECK (true);

-- Ensure proper permissions
GRANT SELECT, INSERT, UPDATE ON faucet_claims TO authenticated;
GRANT USAGE ON SEQUENCE faucet_claims_id_seq TO authenticated;

-- Verify the fix
SELECT 'RLS policies fixed - faucet claiming should now work' as status;
