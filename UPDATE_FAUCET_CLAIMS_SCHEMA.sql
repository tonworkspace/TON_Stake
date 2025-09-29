-- =============================================
-- UPDATE FAUCET CLAIMS TABLE SCHEMA
-- =============================================
-- This script adds additional player information columns to the faucet_claims table

-- Add new columns to existing faucet_claims table
ALTER TABLE faucet_claims 
ADD COLUMN IF NOT EXISTS telegram_id BIGINT,
ADD COLUMN IF NOT EXISTS telegram_username VARCHAR(255),
ADD COLUMN IF NOT EXISTS telegram_first_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS telegram_last_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS telegram_photo_url TEXT,
ADD COLUMN IF NOT EXISTS stk_amount DECIMAL(18, 6),
ADD COLUMN IF NOT EXISTS stkn_balance DECIMAL(18, 6),
ADD COLUMN IF NOT EXISTS total_stk_mining DECIMAL(18, 6),
ADD COLUMN IF NOT EXISTS nft_token_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS portfolio_value DECIMAL(18, 6),
ADD COLUMN IF NOT EXISTS reward_breakdown JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS user_agent TEXT,
ADD COLUMN IF NOT EXISTS ip_address INET,
ADD COLUMN IF NOT EXISTS session_id VARCHAR(255);

-- Create additional indexes for better performance
CREATE INDEX IF NOT EXISTS idx_faucet_claims_telegram_id ON faucet_claims(telegram_id);
CREATE INDEX IF NOT EXISTS idx_faucet_claims_portfolio_value ON faucet_claims(portfolio_value);
CREATE INDEX IF NOT EXISTS idx_faucet_claims_session_id ON faucet_claims(session_id);
CREATE INDEX IF NOT EXISTS idx_faucet_claims_claimed_at_desc ON faucet_claims(claimed_at DESC);

-- Update the process_faucet_claim function to handle new parameters
CREATE OR REPLACE FUNCTION process_faucet_claim(
    p_user_id INTEGER,
    p_wallet_address VARCHAR(255),
    p_ton_balance DECIMAL(18, 6),
    p_claim_amount DECIMAL(18, 6),
    p_network VARCHAR(20) DEFAULT 'mainnet',
    -- Additional player information parameters
    p_telegram_id BIGINT DEFAULT NULL,
    p_telegram_username VARCHAR(255) DEFAULT NULL,
    p_telegram_first_name VARCHAR(255) DEFAULT NULL,
    p_telegram_last_name VARCHAR(255) DEFAULT NULL,
    p_telegram_photo_url TEXT DEFAULT NULL,
    p_stk_amount DECIMAL(18, 6) DEFAULT NULL,
    p_stkn_balance DECIMAL(18, 6) DEFAULT NULL,
    p_total_stk_mining DECIMAL(18, 6) DEFAULT NULL,
    p_nft_token_id VARCHAR(255) DEFAULT NULL,
    p_portfolio_value DECIMAL(18, 6) DEFAULT NULL,
    p_reward_breakdown JSONB DEFAULT '{}',
    p_user_agent TEXT DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_session_id VARCHAR(255) DEFAULT NULL
)
RETURNS TABLE(
    success BOOLEAN,
    new_balance DECIMAL(18, 6),
    message TEXT
) AS $$
DECLARE
    v_user_record RECORD;
    v_eligibility RECORD;
    v_new_balance DECIMAL(18, 6);
BEGIN
    -- Check if user exists
    SELECT * INTO v_user_record FROM users WHERE id = p_user_id;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 0::DECIMAL(18, 6), 'User not found';
        RETURN;
    END IF;
    
    -- Check eligibility
    SELECT * INTO v_eligibility FROM check_faucet_eligibility(p_user_id);
    
    IF NOT v_eligibility.is_eligible THEN
        RETURN QUERY SELECT false, v_user_record.total_sbt, v_eligibility.reason;
        RETURN;
    END IF;
    
    -- Process the claim
    BEGIN
        -- Record the claim with all player information
        INSERT INTO faucet_claims (
            user_id,
            wallet_address,
            ton_balance,
            claim_amount,
            network,
            telegram_id,
            telegram_username,
            telegram_first_name,
            telegram_last_name,
            telegram_photo_url,
            stk_amount,
            stkn_balance,
            total_stk_mining,
            nft_token_id,
            portfolio_value,
            reward_breakdown,
            user_agent,
            ip_address,
            session_id
        ) VALUES (
            p_user_id,
            p_wallet_address,
            p_ton_balance,
            p_claim_amount,
            p_network,
            p_telegram_id,
            p_telegram_username,
            p_telegram_first_name,
            p_telegram_last_name,
            p_telegram_photo_url,
            p_stk_amount,
            p_stkn_balance,
            p_total_stk_mining,
            p_nft_token_id,
            p_portfolio_value,
            p_reward_breakdown,
            p_user_agent,
            p_ip_address,
            p_session_id
        );
        
        -- Update user's STK balance and last claim time
        UPDATE users 
        SET 
            total_sbt = COALESCE(total_sbt, 0) + p_claim_amount,
            last_faucet_claim = NOW(),
            updated_at = NOW()
        WHERE id = p_user_id;
        
        -- Get updated balance
        SELECT total_sbt INTO v_new_balance FROM users WHERE id = p_user_id;
        
        -- Log the activity
        INSERT INTO user_activity_logs (
            user_id,
            action_type,
            amount,
            description,
            status,
            created_at
        ) VALUES (
            p_user_id,
            'faucet_claim',
            p_claim_amount,
            'Claimed ' || p_claim_amount || ' STK from faucet (TON balance: ' || p_ton_balance || ')',
            'completed',
            NOW()
        );
        
        RETURN QUERY SELECT true, v_new_balance, 'Claim processed successfully';
        
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT false, v_user_record.total_sbt, 'Database error: ' || SQLERRM;
    END;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate the faucet leaderboard view to include new information
DROP VIEW IF EXISTS faucet_leaderboard;
CREATE VIEW faucet_leaderboard AS
SELECT 
    u.id,
    u.username,
    u.first_name,
    u.telegram_id,
    COUNT(fc.id) as total_claims,
    SUM(fc.claim_amount) as total_claimed,
    AVG(fc.claim_amount) as average_claim,
    MAX(fc.claimed_at) as last_claim_time,
    u.last_faucet_claim,
    AVG(fc.portfolio_value) as avg_portfolio_value,
    MAX(fc.portfolio_value) as max_portfolio_value
FROM users u
LEFT JOIN faucet_claims fc ON u.id = fc.user_id
GROUP BY u.id, u.username, u.first_name, u.telegram_id, u.last_faucet_claim
HAVING COUNT(fc.id) > 0
ORDER BY total_claimed DESC;

-- Create a view for detailed claim information
DROP VIEW IF EXISTS detailed_faucet_claims;
CREATE VIEW detailed_faucet_claims AS
SELECT 
    fc.*,
    u.username,
    u.first_name,
    u.last_name,
    u.telegram_id as user_telegram_id
FROM faucet_claims fc
LEFT JOIN users u ON fc.user_id = u.id
ORDER BY fc.claimed_at DESC;

-- Grant permissions for new views
GRANT SELECT ON detailed_faucet_claims TO authenticated;

-- Fix RLS policies for faucet_claims table
DROP POLICY IF EXISTS "Users can view own faucet claims" ON faucet_claims;
DROP POLICY IF EXISTS "Users can insert own faucet claims" ON faucet_claims;

-- Create new RLS policies that work with our authentication system
CREATE POLICY "Authenticated users can view faucet claims" ON faucet_claims
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert faucet claims" ON faucet_claims
    FOR INSERT WITH CHECK (true);

-- Grant additional permissions
GRANT SELECT, INSERT, UPDATE ON faucet_claims TO authenticated;
GRANT USAGE ON SEQUENCE faucet_claims_id_seq TO authenticated;

-- Add comments to new columns
COMMENT ON COLUMN faucet_claims.telegram_id IS 'Telegram user ID for additional verification';
COMMENT ON COLUMN faucet_claims.telegram_username IS 'Telegram username';
COMMENT ON COLUMN faucet_claims.telegram_first_name IS 'Telegram first name';
COMMENT ON COLUMN faucet_claims.telegram_last_name IS 'Telegram last name';
COMMENT ON COLUMN faucet_claims.telegram_photo_url IS 'Telegram profile photo URL';
COMMENT ON COLUMN faucet_claims.stk_amount IS 'User reported STK token amount';
COMMENT ON COLUMN faucet_claims.stkn_balance IS 'User reported STKN balance';
COMMENT ON COLUMN faucet_claims.total_stk_mining IS 'User reported total STK mining balance';
COMMENT ON COLUMN faucet_claims.nft_token_id IS 'User reported NFT token ID';
COMMENT ON COLUMN faucet_claims.portfolio_value IS 'Calculated portfolio value';
COMMENT ON COLUMN faucet_claims.reward_breakdown IS 'JSON breakdown of reward calculation';
COMMENT ON COLUMN faucet_claims.user_agent IS 'Browser user agent string';
COMMENT ON COLUMN faucet_claims.ip_address IS 'User IP address';
COMMENT ON COLUMN faucet_claims.session_id IS 'Unique session identifier';

-- Create system_config table if it doesn't exist (for configuration values)
CREATE TABLE IF NOT EXISTS system_config (
    id SERIAL PRIMARY KEY,
    config_key VARCHAR(255) UNIQUE NOT NULL,
    config_value TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert sample configuration values
INSERT INTO system_config (config_key, config_value, description) VALUES
('faucet_base_amount', '10', 'Base STK tokens given regardless of balance'),
('faucet_balance_multiplier', '0.1', 'Multiplier for TON balance (10% of TON balance)'),
('faucet_max_amount', '1000', 'Maximum STK tokens per claim'),
('faucet_min_ton_balance', '0.1', 'Minimum TON balance required'),
('faucet_cooldown_hours', '24', 'Hours between claims'),
('faucet_enabled', 'true', 'Whether faucet is currently enabled')
ON CONFLICT (config_key) DO NOTHING;

-- Grant permissions for system_config
GRANT SELECT ON system_config TO authenticated;

-- Success message
SELECT 'faucet_claims table schema updated successfully' as status;
