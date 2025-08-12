CREATE OR REPLACE FUNCTION create_referral(p_referrer_id INTEGER, p_referred_id INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
    existing_referrer_id INTEGER;
    referral_exists BOOLEAN;
BEGIN
    -- Check if the referred user already has a referrer
    SELECT referrer_id INTO existing_referrer_id FROM users WHERE id = p_referred_id;
    IF existing_referrer_id IS NOT NULL THEN
        RETURN FALSE; -- User already has a referrer
    END IF;

    -- Check if the referral relationship already exists
    SELECT EXISTS(SELECT 1 FROM referrals WHERE referrer_id = p_referrer_id AND referred_id = p_referred_id) INTO referral_exists;
    IF referral_exists THEN
        RETURN FALSE; -- Referral relationship already exists
    END IF;

    -- Create the referral relationship
    INSERT INTO referrals (referrer_id, referred_id) VALUES (p_referrer_id, p_referred_id);

    -- Update the user's referrer_id
    UPDATE users SET referrer_id = p_referrer_id WHERE id = p_referred_id;

    -- Increment the referrer's direct_referrals count
    UPDATE users SET direct_referrals = COALESCE(direct_referrals, 0) + 1 WHERE id = p_referrer_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;
