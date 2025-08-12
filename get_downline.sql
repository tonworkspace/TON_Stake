CREATE OR REPLACE FUNCTION get_downline(p_user_id INTEGER)
RETURNS TABLE(
    id INTEGER,
    username TEXT,
    rank TEXT,
    total_earned NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN,
    direct_referrals INTEGER,
    level INTEGER,
    referrer_id INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE downline_cte AS (
        -- Anchor member: direct referrals
        SELECT
            u.id,
            u.username,
            u.rank,
            u.total_earned,
            u.created_at,
            u.is_active,
            u.direct_referrals,
            1 AS level,
            r.referrer_id
        FROM users u
        JOIN referrals r ON u.id = r.referred_id
        WHERE r.referrer_id = p_user_id

        UNION ALL

        -- Recursive member: referrals of referrals
        SELECT
            u.id,
            u.username,
            u.rank,
            u.total_earned,
            u.created_at,
            u.is_active,
            u.direct_referrals,
            d.level + 1,
            r.referrer_id
        FROM users u
        JOIN referrals r ON u.id = r.referred_id
        JOIN downline_cte d ON r.referrer_id = d.id
    )
    SELECT * FROM downline_cte;
END;
$$ LANGUAGE plpgsql;
