-- HYIP (High-Yield Investment Program) Database Schema
-- This schema supports advanced investment features with multiple risk levels

-- HYIP Plans table
CREATE TABLE hyip_plans (
    id SERIAL PRIMARY KEY,
    plan_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    min_investment NUMERIC NOT NULL,
    max_investment NUMERIC NOT NULL,
    daily_return NUMERIC NOT NULL,
    total_return NUMERIC NOT NULL,
    duration INTEGER NOT NULL,
    risk_level VARCHAR(20) NOT NULL CHECK (risk_level IN ('Low', 'Medium', 'High', 'Extreme')),
    color VARCHAR(7),
    icon VARCHAR(10),
    features JSONB,
    bonus_percentage NUMERIC DEFAULT 0,
    early_withdrawal_fee NUMERIC DEFAULT 0.1,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- HYIP Investments table
CREATE TABLE hyip_investments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) NOT NULL,
    plan_id VARCHAR(50) REFERENCES hyip_plans(plan_id) NOT NULL,
    amount NUMERIC NOT NULL,
    bonus_amount NUMERIC DEFAULT 0,
    total_amount NUMERIC NOT NULL,
    daily_return NUMERIC NOT NULL,
    total_earned NUMERIC DEFAULT 0,
    start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_date TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    last_payout TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    progress_percentage NUMERIC DEFAULT 0,
    cycle_completed BOOLEAN DEFAULT false,
    cycle_completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT positive_amount CHECK (amount >= 1)
);

-- HYIP Withdrawals table
CREATE TABLE hyip_withdrawals (
    id SERIAL PRIMARY KEY,
    investment_id INTEGER REFERENCES hyip_investments(id) NOT NULL,
    user_id INTEGER REFERENCES users(id) NOT NULL,
    amount NUMERIC NOT NULL,
    fee_amount NUMERIC DEFAULT 0,
    net_amount NUMERIC NOT NULL,
    withdrawal_type VARCHAR(20) NOT NULL CHECK (withdrawal_type IN ('earnings', 'early', 'completion')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- HYIP Insurance Pool table
CREATE TABLE hyip_insurance_pool (
    id SERIAL PRIMARY KEY,
    total_amount NUMERIC DEFAULT 0,
    distributed_amount NUMERIC DEFAULT 0,
    last_distribution TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- HYIP Insurance Claims table
CREATE TABLE hyip_insurance_claims (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) NOT NULL,
    investment_id INTEGER REFERENCES hyip_investments(id) NOT NULL,
    claim_amount NUMERIC NOT NULL,
    reason TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'paid')),
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- HYIP Performance Metrics table
CREATE TABLE hyip_performance_metrics (
    id SERIAL PRIMARY KEY,
    plan_id VARCHAR(50) REFERENCES hyip_plans(plan_id) NOT NULL,
    total_invested NUMERIC DEFAULT 0,
    total_earned NUMERIC DEFAULT 0,
    active_investments INTEGER DEFAULT 0,
    completed_investments INTEGER DEFAULT 0,
    average_return NUMERIC DEFAULT 0,
    success_rate NUMERIC DEFAULT 0,
    date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default HYIP plans
INSERT INTO hyip_plans (plan_id, name, description, min_investment, max_investment, daily_return, total_return, duration, risk_level, color, icon, features, bonus_percentage, early_withdrawal_fee) VALUES
('conservative', 'Conservative Growth', 'Low-risk investment with steady returns', 10, 1000, 0.008, 240, 30, 'Low', '#10b981', '🌱', '["0.8% Daily Return", "30 Day Duration", "240% Total Return", "Low Risk", "Early Withdrawal Available", "Compound Interest"]', 0, 0.05),
('balanced', 'Balanced Portfolio', 'Moderate risk with higher potential returns', 50, 5000, 0.012, 360, 30, 'Medium', '#f59e0b', '⚖️', '["1.2% Daily Return", "30 Day Duration", "360% Total Return", "Medium Risk", "5% Welcome Bonus", "Insurance Protection", "Compound Interest"]', 0.05, 0.10),
('aggressive', 'Aggressive Growth', 'High-risk, high-reward investment strategy', 100, 10000, 0.018, 540, 30, 'High', '#ef4444', '🚀', '["1.8% Daily Return", "30 Day Duration", "540% Total Return", "High Risk", "10% Welcome Bonus", "Insurance Protection", "Priority Support", "Compound Interest"]', 0.10, 0.15),
('extreme', 'Extreme Yield', 'Maximum risk for maximum potential returns', 500, 50000, 0.025, 750, 30, 'Extreme', '#8b5cf6', '💎', '["2.5% Daily Return", "30 Day Duration", "750% Total Return", "Extreme Risk", "15% Welcome Bonus", "Full Insurance", "Personal Manager", "Exclusive Events", "Compound Interest"]', 0.15, 0.20);

-- Initialize insurance pool
INSERT INTO hyip_insurance_pool (total_amount) VALUES (0);

-- Create indexes for better performance
CREATE INDEX idx_hyip_investments_user_id ON hyip_investments(user_id);
CREATE INDEX idx_hyip_investments_plan_id ON hyip_investments(plan_id);
CREATE INDEX idx_hyip_investments_active ON hyip_investments(is_active);
CREATE INDEX idx_hyip_withdrawals_user_id ON hyip_withdrawals(user_id);
CREATE INDEX idx_hyip_withdrawals_status ON hyip_withdrawals(status);
CREATE INDEX idx_hyip_performance_metrics_date ON hyip_performance_metrics(date);

-- Function to create HYIP investment
CREATE OR REPLACE FUNCTION create_hyip_investment(
    p_user_id INTEGER,
    p_plan_id VARCHAR(50),
    p_amount NUMERIC,
    p_daily_return NUMERIC,
    p_bonus NUMERIC,
    p_duration INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
    v_plan hyip_plans%ROWTYPE;
    v_total_amount NUMERIC;
    v_end_date TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Get plan details
    SELECT * INTO v_plan FROM hyip_plans WHERE plan_id = p_plan_id AND is_active = true;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Plan not found or inactive';
    END IF;

    -- Validate amount
    IF p_amount < v_plan.min_investment OR p_amount > v_plan.max_investment THEN
        RAISE EXCEPTION 'Investment amount outside allowed range';
    END IF;

    -- Calculate total amount with bonus
    v_total_amount := p_amount + p_bonus;
    v_end_date := NOW() + INTERVAL '1 day' * p_duration;

    -- Create investment
    INSERT INTO hyip_investments (
        user_id, plan_id, amount, bonus_amount, total_amount,
        daily_return, end_date
    ) VALUES (
        p_user_id, p_plan_id, p_amount, p_bonus, v_total_amount,
        p_daily_return, v_end_date
    );

    -- Update user balance (deduct investment amount)
    UPDATE users 
    SET balance = balance - p_amount,
        total_deposit = total_deposit + p_amount
    WHERE id = p_user_id;

    -- Log activity
    INSERT INTO user_activity_logs (
        user_id, action_type, amount, description, status
    ) VALUES (
        p_user_id, 'investment_created', p_amount, 
        'Created HYIP investment in ' || v_plan.name, 'completed'
    );

    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        RAISE;
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Function to withdraw HYIP earnings
CREATE OR REPLACE FUNCTION withdraw_hyip_earnings(
    p_investment_id INTEGER,
    p_amount NUMERIC
) RETURNS BOOLEAN AS $$
DECLARE
    v_investment hyip_investments%ROWTYPE;
    v_plan hyip_plans%ROWTYPE;
    v_available NUMERIC;
    v_fee_amount NUMERIC;
    v_net_amount NUMERIC;
    v_insurance_amount NUMERIC;
BEGIN
    -- Get investment details
    SELECT * INTO v_investment FROM hyip_investments WHERE id = p_investment_id AND is_active = true;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Investment not found or inactive';
    END IF;

    -- Get plan details
    SELECT * INTO v_plan FROM hyip_plans WHERE plan_id = v_investment.plan_id;
    
    -- Calculate available amount
    v_available := v_investment.total_earned - (
        SELECT COALESCE(SUM(amount), 0) 
        FROM hyip_withdrawals 
        WHERE investment_id = p_investment_id AND status = 'completed'
    );

    IF p_amount > v_available THEN
        RAISE EXCEPTION 'Insufficient earnings available';
    END IF;

    -- Calculate fees and net amount
    v_fee_amount := p_amount * 0.10; -- 10% platform fee
    v_insurance_amount := p_amount * 0.05; -- 5% to insurance pool
    v_net_amount := p_amount - v_fee_amount - v_insurance_amount;

    -- Create withdrawal record
    INSERT INTO hyip_withdrawals (
        investment_id, user_id, amount, fee_amount, net_amount, withdrawal_type, status, processed_at
    ) VALUES (
        p_investment_id, v_investment.user_id, p_amount, v_fee_amount, v_net_amount, 'earnings', 'completed', NOW()
    );

    -- Update user balance
    UPDATE users 
    SET balance = balance + v_net_amount,
        total_withdrawn = total_withdrawn + v_net_amount
    WHERE id = v_investment.user_id;

    -- Update insurance pool
    UPDATE hyip_insurance_pool 
    SET total_amount = total_amount + v_insurance_amount,
        updated_at = NOW();

    -- Log activity
    INSERT INTO user_activity_logs (
        user_id, action_type, amount, description, status
    ) VALUES (
        v_investment.user_id, 'withdrawal', v_net_amount, 
        'Withdrew HYIP earnings', 'completed'
    );

    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        RAISE;
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Function for early withdrawal
CREATE OR REPLACE FUNCTION early_withdraw_hyip(
    p_investment_id INTEGER,
    p_fee NUMERIC
) RETURNS BOOLEAN AS $$
DECLARE
    v_investment hyip_investments%ROWTYPE;
    v_plan hyip_plans%ROWTYPE;
    v_withdrawal_amount NUMERIC;
    v_insurance_amount NUMERIC;
BEGIN
    -- Get investment details
    SELECT * INTO v_investment FROM hyip_investments WHERE id = p_investment_id AND is_active = true;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Investment not found or inactive';
    END IF;

    -- Get plan details
    SELECT * INTO v_plan FROM hyip_plans WHERE plan_id = v_investment.plan_id;
    
    -- Calculate withdrawal amount
    v_withdrawal_amount := v_investment.amount - p_fee;
    v_insurance_amount := p_fee * 0.5; -- 50% of fee goes to insurance

    -- Create withdrawal record
    INSERT INTO hyip_withdrawals (
        investment_id, user_id, amount, fee_amount, net_amount, withdrawal_type, status, processed_at
    ) VALUES (
        p_investment_id, v_investment.user_id, v_investment.amount, p_fee, v_withdrawal_amount, 'early', 'completed', NOW()
    );

    -- Update investment status
    UPDATE hyip_investments 
    SET is_active = false,
        cycle_completed = true,
        cycle_completed_at = NOW()
    WHERE id = p_investment_id;

    -- Update user balance
    UPDATE users 
    SET balance = balance + v_withdrawal_amount,
        total_withdrawn = total_withdrawn + v_withdrawal_amount
    WHERE id = v_investment.user_id;

    -- Update insurance pool
    UPDATE hyip_insurance_pool 
    SET total_amount = total_amount + v_insurance_amount,
        updated_at = NOW();

    -- Log activity
    INSERT INTO user_activity_logs (
        user_id, action_type, amount, description, status
    ) VALUES (
        v_investment.user_id, 'withdrawal', v_withdrawal_amount, 
        'Early withdrawal from HYIP investment', 'completed'
    );

    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        RAISE;
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate daily HYIP rewards
CREATE OR REPLACE FUNCTION calculate_hyip_daily_rewards(p_investment_id INTEGER) RETURNS NUMERIC AS $$
DECLARE
    v_investment hyip_investments%ROWTYPE;
    v_daily_earning NUMERIC;
    v_max_earning NUMERIC;
    v_capped_earning NUMERIC;
BEGIN
    -- Get investment details
    SELECT * INTO v_investment FROM hyip_investments WHERE id = p_investment_id AND is_active = true;
    IF NOT FOUND THEN
        RETURN 0;
    END IF;

    -- Check for duplicate payout within last 24 hours
    IF v_investment.last_payout > NOW() - INTERVAL '24 hours' THEN
        RETURN 0;
    END IF;

    -- Calculate daily earning
    v_daily_earning := v_investment.total_amount * v_investment.daily_return;
    
    -- Apply maximum daily earning cap (3% of investment)
    v_max_earning := v_investment.amount * 0.03;
    v_capped_earning := LEAST(v_daily_earning, v_max_earning);

    -- Update investment
    UPDATE hyip_investments 
    SET total_earned = total_earned + v_capped_earning,
        last_payout = NOW(),
        progress_percentage = ((total_earned + v_capped_earning) / amount) * 100
    WHERE id = p_investment_id;

    -- Check if cycle completion (max return) is reached
    IF ((v_investment.total_earned + v_capped_earning) / v_investment.amount) * 100 >= 750 THEN
        UPDATE hyip_investments 
        SET is_active = false,
            cycle_completed = true,
            cycle_completed_at = NOW()
        WHERE id = p_investment_id;
    END IF;

    RETURN v_capped_earning;
EXCEPTION
    WHEN OTHERS THEN
        RAISE;
        RETURN 0;
END;
$$ LANGUAGE plpgsql;

-- Function to process HYIP insurance claims
CREATE OR REPLACE FUNCTION process_hyip_insurance_claim(
    p_user_id INTEGER,
    p_investment_id INTEGER,
    p_claim_amount NUMERIC,
    p_reason TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    v_insurance_pool hyip_insurance_pool%ROWTYPE;
    v_claim_amount NUMERIC;
BEGIN
    -- Get insurance pool details
    SELECT * INTO v_insurance_pool FROM hyip_insurance_pool LIMIT 1;
    
    -- Calculate claim amount (up to 50% of investment amount)
    SELECT amount * 0.5 INTO v_claim_amount 
    FROM hyip_investments 
    WHERE id = p_investment_id AND user_id = p_user_id;
    
    IF v_claim_amount IS NULL THEN
        RAISE EXCEPTION 'Investment not found';
    END IF;

    -- Limit claim to available insurance pool
    v_claim_amount := LEAST(v_claim_amount, v_insurance_pool.total_amount);

    -- Create insurance claim
    INSERT INTO hyip_insurance_claims (
        user_id, investment_id, claim_amount, reason, status, processed_at
    ) VALUES (
        p_user_id, p_investment_id, v_claim_amount, p_reason, 'approved', NOW()
    );

    -- Update insurance pool
    UPDATE hyip_insurance_pool 
    SET total_amount = total_amount - v_claim_amount,
        distributed_amount = distributed_amount + v_claim_amount,
        last_distribution = NOW(),
        updated_at = NOW();

    -- Update user balance
    UPDATE users 
    SET balance = balance + v_claim_amount
    WHERE id = p_user_id;

    -- Log activity
    INSERT INTO user_activity_logs (
        user_id, action_type, amount, description, status
    ) VALUES (
        p_user_id, 'insurance_claim', v_claim_amount, 
        'Insurance claim processed: ' || p_reason, 'completed'
    );

    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        RAISE;
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Function to update HYIP performance metrics
CREATE OR REPLACE FUNCTION update_hyip_performance_metrics() RETURNS VOID AS $$
DECLARE
    v_plan RECORD;
    v_metrics RECORD;
BEGIN
    FOR v_plan IN SELECT plan_id FROM hyip_plans WHERE is_active = true LOOP
        SELECT 
            COUNT(*) as active_investments,
            COUNT(*) FILTER (WHERE cycle_completed = true) as completed_investments,
            COALESCE(SUM(amount), 0) as total_invested,
            COALESCE(SUM(total_earned), 0) as total_earned,
            COALESCE(AVG((total_earned / amount) * 100), 0) as average_return
        INTO v_metrics
        FROM hyip_investments 
        WHERE plan_id = v_plan.plan_id;

        -- Insert or update metrics
        INSERT INTO hyip_performance_metrics (
            plan_id, total_invested, total_earned, active_investments, 
            completed_investments, average_return, success_rate, date
        ) VALUES (
            v_plan.plan_id, v_metrics.total_invested, v_metrics.total_earned,
            v_metrics.active_investments, v_metrics.completed_investments,
            v_metrics.average_return,
            CASE 
                WHEN v_metrics.completed_investments > 0 
                THEN (v_metrics.completed_investments::NUMERIC / (v_metrics.active_investments + v_metrics.completed_investments)) * 100
                ELSE 0 
            END,
            CURRENT_DATE
        )
        ON CONFLICT (plan_id, date) DO UPDATE SET
            total_invested = EXCLUDED.total_invested,
            total_earned = EXCLUDED.total_earned,
            active_investments = EXCLUDED.active_investments,
            completed_investments = EXCLUDED.completed_investments,
            average_return = EXCLUDED.average_return,
            success_rate = EXCLUDED.success_rate;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update performance metrics on investment changes
CREATE OR REPLACE FUNCTION trigger_update_hyip_metrics() RETURNS TRIGGER AS $$
BEGIN
    PERFORM update_hyip_performance_metrics();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER hyip_metrics_trigger
    AFTER INSERT OR UPDATE OR DELETE ON hyip_investments
    FOR EACH ROW EXECUTE FUNCTION trigger_update_hyip_metrics();

-- Create view for HYIP dashboard data
CREATE VIEW hyip_dashboard_view AS
SELECT 
    u.id as user_id,
    u.username,
    u.balance,
    COUNT(hi.id) as active_investments,
    COALESCE(SUM(hi.amount), 0) as total_invested,
    COALESCE(SUM(hi.total_earned), 0) as total_earned,
    COALESCE(SUM(hi.amount * hi.daily_return), 0) as daily_earnings,
    COALESCE(SUM(hi.amount * hi.daily_return * 30), 0) as monthly_projection
FROM users u
LEFT JOIN hyip_investments hi ON u.id = hi.user_id AND hi.is_active = true
GROUP BY u.id, u.username, u.balance;

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON hyip_plans TO authenticated;
GRANT SELECT, INSERT, UPDATE ON hyip_investments TO authenticated;
GRANT SELECT, INSERT, UPDATE ON hyip_withdrawals TO authenticated;
GRANT SELECT ON hyip_insurance_pool TO authenticated;
GRANT SELECT, INSERT, UPDATE ON hyip_insurance_claims TO authenticated;
GRANT SELECT ON hyip_performance_metrics TO authenticated;
GRANT SELECT ON hyip_dashboard_view TO authenticated;

-- Enable RLS (Row Level Security)
ALTER TABLE hyip_investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE hyip_withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE hyip_insurance_claims ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own investments" ON hyip_investments
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own investments" ON hyip_investments
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own investments" ON hyip_investments
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own withdrawals" ON hyip_withdrawals
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own insurance claims" ON hyip_insurance_claims
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own insurance claims" ON hyip_insurance_claims
    FOR INSERT WITH CHECK (auth.uid() = user_id); 