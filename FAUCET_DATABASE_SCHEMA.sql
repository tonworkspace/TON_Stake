-- =============================================
-- FAUCET SYSTEM DATABASE SCHEMA
-- =============================================
-- This schema supports the token faucet system where users can claim
-- STK tokens based on their TON wallet balance

-- Add faucet claim tracking column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_faucet_claim TIMESTAMP WITH TIME ZONE;

-- Create faucet_claims table to track all claims
CREATE TABLE IF NOT EXISTS faucet_claims (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) NOT NULL,
    wallet_address VARCHAR(255) NOT NULL,
    ton_balance DECIMAL(18, 6) NOT NULL,
    claim_amount DECIMAL(18, 6) NOT NULL,
    claimed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    network VARCHAR(20) DEFAULT 'mainnet', -- mainnet or testnet
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Additional player information
    telegram_id BIGINT,
    telegram_username VARCHAR(255),
    telegram_first_name VARCHAR(255),
    telegram_last_name VARCHAR(255),
    telegram_photo_url TEXT,
    stk_amount DECIMAL(18, 6),
    stkn_balance DECIMAL(18, 6),
    total_stk_mining DECIMAL(18, 6),
    nft_token_id VARCHAR(255),
    portfolio_value DECIMAL(18, 6),
    reward_breakdown JSONB DEFAULT '{}',
    user_agent TEXT,
    ip_address INET,
    session_id VARCHAR(255)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_faucet_claims_user_id ON faucet_claims(user_id);
CREATE INDEX IF NOT EXISTS idx_faucet_claims_claimed_at ON faucet_claims(claimed_at);
CREATE INDEX IF NOT EXISTS idx_faucet_claims_wallet_address ON faucet_claims(wallet_address);

-- Create function to check faucet eligibility
CREATE OR REPLACE FUNCTION check_faucet_eligibility(
    p_user_id INTEGER,
    p_cooldown_hours INTEGER DEFAULT 24
)
RETURNS TABLE(
    is_eligible BOOLEAN,
    last_claim TIMESTAMP WITH TIME ZONE,
    time_until_next_claim INTERVAL,
    reason TEXT
) AS $$
DECLARE
    v_user_record RECORD;
    v_last_claim TIMESTAMP WITH TIME ZONE;
    v_time_since_last_claim INTERVAL;
    v_cooldown_interval INTERVAL;
BEGIN
    -- Get user record
    SELECT * INTO v_user_record FROM users WHERE id = p_user_id;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, NULL::TIMESTAMP WITH TIME ZONE, NULL::INTERVAL, 'User not found';
        RETURN;
    END IF;
    
    -- Get last claim time
    v_last_claim := v_user_record.last_faucet_claim;
    
    IF v_last_claim IS NULL THEN
        -- User has never claimed, they are eligible
        RETURN QUERY SELECT true, NULL::TIMESTAMP WITH TIME ZONE, NULL::INTERVAL, 'First claim';
        RETURN;
    END IF;
    
    -- Calculate time since last claim
    v_time_since_last_claim := NOW() - v_last_claim;
    v_cooldown_interval := (p_cooldown_hours || ' hours')::INTERVAL;
    
    IF v_time_since_last_claim >= v_cooldown_interval THEN
        -- Cooldown period has passed
        RETURN QUERY SELECT true, v_last_claim, NULL::INTERVAL, 'Eligible';
    ELSE
        -- Still in cooldown
        RETURN QUERY SELECT false, v_last_claim, v_cooldown_interval - v_time_since_last_claim, 'Cooldown active';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create function to process faucet claim
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

-- Create function to get faucet statistics
CREATE OR REPLACE FUNCTION get_faucet_stats()
RETURNS TABLE(
    total_claims BIGINT,
    total_tokens_distributed DECIMAL(18, 6),
    unique_users BIGINT,
    average_claim_amount DECIMAL(18, 6),
    last_claim_time TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_claims,
        COALESCE(SUM(claim_amount), 0) as total_tokens_distributed,
        COUNT(DISTINCT user_id) as unique_users,
        COALESCE(AVG(claim_amount), 0) as average_claim_amount,
        MAX(claimed_at) as last_claim_time
    FROM faucet_claims;
END;
$$ LANGUAGE plpgsql;

-- Create function to get user faucet history
CREATE OR REPLACE FUNCTION get_user_faucet_history(
    p_user_id INTEGER,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE(
    claim_id INTEGER,
    wallet_address VARCHAR(255),
    ton_balance DECIMAL(18, 6),
    claim_amount DECIMAL(18, 6),
    claimed_at TIMESTAMP WITH TIME ZONE,
    network VARCHAR(20)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        fc.id,
        fc.wallet_address,
        fc.ton_balance,
        fc.claim_amount,
        fc.claimed_at,
        fc.network
    FROM faucet_claims fc
    WHERE fc.user_id = p_user_id
    ORDER BY fc.claimed_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Create function to calculate claim amount based on TON balance
CREATE OR REPLACE FUNCTION calculate_faucet_amount(
    p_ton_balance DECIMAL(18, 6),
    p_base_amount DECIMAL(18, 6) DEFAULT 10,
    p_balance_multiplier DECIMAL(18, 6) DEFAULT 0.1,
    p_max_amount DECIMAL(18, 6) DEFAULT 1000
)
RETURNS DECIMAL(18, 6) AS $$
DECLARE
    v_calculated_amount DECIMAL(18, 6);
BEGIN
    -- Calculate: base_amount + (ton_balance * multiplier)
    v_calculated_amount := p_base_amount + (p_ton_balance * p_balance_multiplier);
    
    -- Cap at maximum amount
    IF v_calculated_amount > p_max_amount THEN
        v_calculated_amount := p_max_amount;
    END IF;
    
    -- Ensure minimum is base amount
    IF v_calculated_amount < p_base_amount THEN
        v_calculated_amount := p_base_amount;
    END IF;
    
    RETURN v_calculated_amount;
END;
$$ LANGUAGE plpgsql;

-- Create view for faucet leaderboard
CREATE OR REPLACE VIEW faucet_leaderboard AS
SELECT 
    u.id,
    u.username,
    u.first_name,
    COUNT(fc.id) as total_claims,
    SUM(fc.claim_amount) as total_claimed,
    AVG(fc.claim_amount) as average_claim,
    MAX(fc.claimed_at) as last_claim_time,
    u.last_faucet_claim
FROM users u
LEFT JOIN faucet_claims fc ON u.id = fc.user_id
GROUP BY u.id, u.username, u.first_name, u.last_faucet_claim
HAVING COUNT(fc.id) > 0
ORDER BY total_claimed DESC;

-- Grant necessary permissions
GRANT SELECT, INSERT ON faucet_claims TO authenticated;
GRANT EXECUTE ON FUNCTION check_faucet_eligibility TO authenticated;
GRANT EXECUTE ON FUNCTION process_faucet_claim TO authenticated;
GRANT EXECUTE ON FUNCTION get_faucet_stats TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_faucet_history TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_faucet_amount TO authenticated;
GRANT SELECT ON faucet_leaderboard TO authenticated;

-- Add RLS policies for security
ALTER TABLE faucet_claims ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to view faucet claims
CREATE POLICY "Authenticated users can view faucet claims" ON faucet_claims
    FOR SELECT USING (true);

-- Policy: Allow authenticated users to insert faucet claims
CREATE POLICY "Authenticated users can insert faucet claims" ON faucet_claims
    FOR INSERT WITH CHECK (true);

-- Create trigger to update user activity
CREATE OR REPLACE FUNCTION update_faucet_activity()
RETURNS TRIGGER AS $$
BEGIN
    -- Update user's last activity
    UPDATE users 
    SET last_active = NOW()
    WHERE id = NEW.user_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_faucet_activity
    AFTER INSERT ON faucet_claims
    FOR EACH ROW
    EXECUTE FUNCTION update_faucet_activity();

-- Create system_config table if it doesn't exist
CREATE TABLE IF NOT EXISTS system_config (
    id SERIAL PRIMARY KEY,
    config_key VARCHAR(255) UNIQUE NOT NULL,
    config_value TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert sample configuration
INSERT INTO system_config (config_key, config_value, description) VALUES
('faucet_base_amount', '10', 'Base STK tokens given regardless of balance'),
('faucet_balance_multiplier', '0.1', 'Multiplier for TON balance (10% of TON balance)'),
('faucet_max_amount', '1000', 'Maximum STK tokens per claim'),
('faucet_min_ton_balance', '0.1', 'Minimum TON balance required'),
('faucet_cooldown_hours', '24', 'Hours between claims'),
('faucet_enabled', 'true', 'Whether faucet is currently enabled')
ON CONFLICT (config_key) DO NOTHING;

