-- =============================================
-- FIX VIEW ERRORS SCRIPT
-- =============================================
-- This script fixes the view column name errors by properly dropping and recreating views

-- Drop existing views that might have column conflicts
DROP VIEW IF EXISTS faucet_leaderboard;
DROP VIEW IF EXISTS detailed_faucet_claims;

-- Recreate faucet_leaderboard view with new columns
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

-- Recreate detailed_faucet_claims view
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

-- Grant permissions
GRANT SELECT ON faucet_leaderboard TO authenticated;
GRANT SELECT ON detailed_faucet_claims TO authenticated;

-- Success message
SELECT 'Views fixed successfully' as status;


