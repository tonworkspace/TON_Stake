-- =============================================
-- VIEW SUBMITTED ORDERS QUERIES
-- =============================================
-- These queries help you view and analyze submitted faucet claims

-- 1. View all submitted orders with complete player information
SELECT 
    fc.id as order_id,
    fc.user_id,
    fc.wallet_address,
    fc.ton_balance,
    fc.claim_amount,
    fc.claimed_at,
    fc.telegram_id,
    fc.telegram_username,
    fc.telegram_first_name,
    fc.telegram_last_name,
    fc.stk_amount,
    fc.stkn_balance,
    fc.total_stk_mining,
    fc.nft_token_id,
    fc.portfolio_value,
    fc.reward_breakdown,
    fc.session_id,
    fc.user_agent,
    fc.ip_address
FROM faucet_claims fc
ORDER BY fc.claimed_at DESC
LIMIT 50;

-- 2. View recent orders with player details
SELECT 
    fc.id as order_id,
    CONCAT(fc.telegram_first_name, ' ', fc.telegram_last_name) as player_name,
    fc.telegram_username,
    SUBSTRING(fc.wallet_address, 1, 8) || '...' || SUBSTRING(fc.wallet_address, -6) as wallet_short,
    fc.claim_amount,
    fc.portfolio_value,
    fc.claimed_at
FROM faucet_claims fc
WHERE fc.claimed_at >= NOW() - INTERVAL '7 days'
ORDER BY fc.claimed_at DESC;

-- 3. Summary statistics
SELECT 
    COUNT(*) as total_orders,
    COUNT(DISTINCT fc.user_id) as unique_users,
    COUNT(DISTINCT fc.telegram_id) as unique_telegram_users,
    SUM(fc.claim_amount) as total_claimed,
    AVG(fc.claim_amount) as avg_claim_amount,
    MIN(fc.claim_amount) as min_claim,
    MAX(fc.claim_amount) as max_claim,
    AVG(fc.portfolio_value) as avg_portfolio_value
FROM faucet_claims fc;

-- 4. Top players by total claimed
SELECT 
    fc.telegram_id,
    fc.telegram_username,
    CONCAT(fc.telegram_first_name, ' ', fc.telegram_last_name) as player_name,
    COUNT(*) as total_claims,
    SUM(fc.claim_amount) as total_claimed,
    AVG(fc.claim_amount) as avg_claim,
    MAX(fc.claimed_at) as last_claim
FROM faucet_claims fc
WHERE fc.telegram_id IS NOT NULL
GROUP BY fc.telegram_id, fc.telegram_username, fc.telegram_first_name, fc.telegram_last_name
ORDER BY total_claimed DESC
LIMIT 10;

-- 5. Orders by portfolio value ranges
SELECT 
    portfolio_tier,
    order_count,
    total_claimed,
    avg_claim
FROM (
    SELECT 
        CASE 
            WHEN fc.portfolio_value > 1000000000 THEN 'Billion+ ($1B+)'
            WHEN fc.portfolio_value > 100000000 THEN '100M+ ($100M+)'
            WHEN fc.portfolio_value > 10000000 THEN '10M+ ($10M+)'
            WHEN fc.portfolio_value > 1000000 THEN '1M+ ($1M+)'
            ELSE 'Standard (<$1M)'
        END as portfolio_tier,
        COUNT(*) as order_count,
        SUM(fc.claim_amount) as total_claimed,
        AVG(fc.claim_amount) as avg_claim,
        CASE 
            WHEN fc.portfolio_value > 1000000000 THEN 1
            WHEN fc.portfolio_value > 100000000 THEN 2
            WHEN fc.portfolio_value > 10000000 THEN 3
            WHEN fc.portfolio_value > 1000000 THEN 4
            ELSE 5
        END as sort_order
    FROM faucet_claims fc
    GROUP BY 
        CASE 
            WHEN fc.portfolio_value > 1000000000 THEN 'Billion+ ($1B+)'
            WHEN fc.portfolio_value > 100000000 THEN '100M+ ($100M+)'
            WHEN fc.portfolio_value > 10000000 THEN '10M+ ($10M+)'
            WHEN fc.portfolio_value > 1000000 THEN '1M+ ($1M+)'
            ELSE 'Standard (<$1M)'
        END,
        CASE 
            WHEN fc.portfolio_value > 1000000000 THEN 1
            WHEN fc.portfolio_value > 100000000 THEN 2
            WHEN fc.portfolio_value > 10000000 THEN 3
            WHEN fc.portfolio_value > 1000000 THEN 4
            ELSE 5
        END
) as tier_stats
ORDER BY sort_order;

-- 5b. Alternative simpler portfolio tier query
SELECT 
    portfolio_tier,
    COUNT(*) as order_count,
    SUM(claim_amount) as total_claimed,
    AVG(claim_amount) as avg_claim
FROM (
    SELECT 
        claim_amount,
        CASE 
            WHEN portfolio_value > 1000000000 THEN 'Billion+ ($1B+)'
            WHEN portfolio_value > 100000000 THEN '100M+ ($100M+)'
            WHEN portfolio_value > 10000000 THEN '10M+ ($10M+)'
            WHEN portfolio_value > 1000000 THEN '1M+ ($1M+)'
            ELSE 'Standard (<$1M)'
        END as portfolio_tier
    FROM faucet_claims
    WHERE portfolio_value IS NOT NULL
) as tiered_claims
GROUP BY portfolio_tier
ORDER BY 
    CASE portfolio_tier
        WHEN 'Billion+ ($1B+)' THEN 1
        WHEN '100M+ ($100M+)' THEN 2
        WHEN '10M+ ($10M+)' THEN 3
        WHEN '1M+ ($1M+)' THEN 4
        ELSE 5
    END;

-- 6. Daily claim statistics
SELECT 
    DATE(fc.claimed_at) as claim_date,
    COUNT(*) as daily_orders,
    COUNT(DISTINCT fc.user_id) as daily_users,
    SUM(fc.claim_amount) as daily_claimed,
    AVG(fc.claim_amount) as daily_avg_claim
FROM faucet_claims fc
GROUP BY DATE(fc.claimed_at)
ORDER BY claim_date DESC
LIMIT 30;

-- 7. View specific order details (replace 1 with actual order ID)
-- SELECT * FROM faucet_claims WHERE id = 1;

-- 8. View orders by specific user (replace 1 with actual user_id)
-- SELECT * FROM faucet_claims WHERE user_id = 1 ORDER BY claimed_at DESC;

-- 9. View orders by telegram user (replace 123456789 with actual telegram_id)
-- SELECT * FROM faucet_claims WHERE telegram_id = 123456789 ORDER BY claimed_at DESC;
