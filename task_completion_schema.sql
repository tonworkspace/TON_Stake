-- Task Completion System Schema
-- Secure task system with anti-cheat mechanisms and proper validation
-- Created for TON Stake Divine Mining Game

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create task completions table
CREATE TABLE IF NOT EXISTS task_completions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_id VARCHAR(50) NOT NULL,
  task_type VARCHAR(20) NOT NULL DEFAULT 'unknown', -- 'mining', 'social', 'airdrop'
  reward_amount INTEGER NOT NULL DEFAULT 0,
  reward_type VARCHAR(20) NOT NULL DEFAULT 'gems',
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  validation_data JSONB DEFAULT '{}', -- Store validation context
  ip_address INET,
  user_agent TEXT,
  session_id VARCHAR(255),
  is_valid BOOLEAN DEFAULT true,
  validation_hash VARCHAR(255), -- For data integrity
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, task_id) -- Prevent duplicate completions
);

-- Create indexes for task_completions
CREATE INDEX IF NOT EXISTS idx_task_completions_user_id ON task_completions(user_id);
CREATE INDEX IF NOT EXISTS idx_task_completions_task_id ON task_completions(task_id);
CREATE INDEX IF NOT EXISTS idx_task_completions_completed_at ON task_completions(completed_at);
CREATE INDEX IF NOT EXISTS idx_task_completions_task_type ON task_completions(task_type);
CREATE INDEX IF NOT EXISTS idx_task_completions_is_valid ON task_completions(is_valid);
CREATE INDEX IF NOT EXISTS idx_task_completions_session_id ON task_completions(session_id);

-- Create task validation logs table for suspicious activity tracking
CREATE TABLE IF NOT EXISTS task_validation_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_id VARCHAR(50) NOT NULL,
  action_type VARCHAR(20) NOT NULL, -- 'attempt', 'validation_failed', 'rate_limited', 'duplicate', 'completed'
  reason VARCHAR(255),
  validation_data JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  session_id VARCHAR(255),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for task_validation_logs
CREATE INDEX IF NOT EXISTS idx_task_validation_logs_user_id ON task_validation_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_task_validation_logs_timestamp ON task_validation_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_task_validation_logs_action_type ON task_validation_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_task_validation_logs_task_id ON task_validation_logs(task_id);

-- Create task rate limiting table
CREATE TABLE IF NOT EXISTS task_rate_limits (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_category VARCHAR(20) NOT NULL, -- 'social', 'mining', 'airdrop'
  attempts_count INTEGER DEFAULT 1,
  last_attempt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reset_after TIMESTAMP WITH TIME ZONE,
  is_blocked BOOLEAN DEFAULT false,
  UNIQUE(user_id, task_category)
);

-- Create indexes for task_rate_limits
CREATE INDEX IF NOT EXISTS idx_task_rate_limits_user_id ON task_rate_limits(user_id);
CREATE INDEX IF NOT EXISTS idx_task_rate_limits_reset_after ON task_rate_limits(reset_after);
CREATE INDEX IF NOT EXISTS idx_task_rate_limits_task_category ON task_rate_limits(task_category);

-- Create task statistics table for analytics
CREATE TABLE IF NOT EXISTS task_statistics (
  id SERIAL PRIMARY KEY,
  task_id VARCHAR(50) NOT NULL,
  task_type VARCHAR(20) NOT NULL,
  total_completions INTEGER DEFAULT 0,
  total_attempts INTEGER DEFAULT 0,
  success_rate DECIMAL(5,2) DEFAULT 0.00,
  avg_completion_time_seconds INTEGER DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(task_id)
);

-- Create indexes for task_statistics
CREATE INDEX IF NOT EXISTS idx_task_statistics_task_id ON task_statistics(task_id);
CREATE INDEX IF NOT EXISTS idx_task_statistics_task_type ON task_statistics(task_type);
CREATE INDEX IF NOT EXISTS idx_task_statistics_success_rate ON task_statistics(success_rate);

-- Add task-related columns to users table if they don't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS divine_points NUMERIC DEFAULT 100;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mining_level INTEGER DEFAULT 1;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mining_experience NUMERIC DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS energy NUMERIC DEFAULT 100;
ALTER TABLE users ADD COLUMN IF NOT EXISTS max_energy NUMERIC DEFAULT 100;
ALTER TABLE users ADD COLUMN IF NOT EXISTS energy_regen_rate NUMERIC DEFAULT 0.3;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_mining BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mining_started_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_save_time BIGINT DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS game_version TEXT DEFAULT '1.0.0';
ALTER TABLE users ADD COLUMN IF NOT EXISTS upgrade_levels JSONB DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS achievements TEXT[] DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS owned_skins TEXT[] DEFAULT '{default}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS active_skin TEXT DEFAULT 'default';
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS premium_expires_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referrals_count INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS team_volume NUMERIC DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS tasks_completed_count INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_task_rewards NUMERIC DEFAULT 0;

-- Create function to safely increment user SBT balance
CREATE OR REPLACE FUNCTION increment_user_sbt(user_id INTEGER, amount INTEGER)
RETURNS void AS $$
BEGIN
  UPDATE users 
  SET total_sbt = COALESCE(total_sbt, 0) + amount,
      last_active = NOW(),
      tasks_completed_count = COALESCE(tasks_completed_count, 0) + 1,
      total_task_rewards = COALESCE(total_task_rewards, 0) + amount
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql;

-- Create function to validate task completion
CREATE OR REPLACE FUNCTION validate_task_completion(
  p_user_id INTEGER,
  p_task_id VARCHAR(50),
  p_task_type VARCHAR(20),
  p_validation_data JSONB DEFAULT '{}'
)
RETURNS TABLE(
  is_valid BOOLEAN,
  reason TEXT,
  user_data JSONB
) AS $$
DECLARE
  user_record RECORD;
  task_exists BOOLEAN;
  account_age_hours INTEGER;
BEGIN
  -- Check if task already completed
  SELECT EXISTS(
    SELECT 1 FROM task_completions 
    WHERE user_id = p_user_id AND task_id = p_task_id AND is_valid = true
  ) INTO task_exists;
  
  IF task_exists THEN
    RETURN QUERY SELECT false, 'Task already completed', '{}'::JSONB;
    RETURN;
  END IF;
  
  -- Get user data
  SELECT * INTO user_record FROM users WHERE id = p_user_id;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'User not found', '{}'::JSONB;
    RETURN;
  END IF;
  
  -- Calculate account age in hours
  SELECT EXTRACT(EPOCH FROM (NOW() - user_record.created_at)) / 3600 INTO account_age_hours;
  
  -- Task-specific validation
  CASE p_task_id
    WHEN 'mine_1000' THEN
      IF COALESCE(user_record.divine_points, 0) < 1000 THEN
        RETURN QUERY SELECT false, 'Insufficient divine points', row_to_json(user_record)::JSONB;
        RETURN;
      END IF;
      
    WHEN 'mine_10000' THEN
      IF COALESCE(user_record.divine_points, 0) < 10000 THEN
        RETURN QUERY SELECT false, 'Insufficient divine points', row_to_json(user_record)::JSONB;
        RETURN;
      END IF;
      
    WHEN 'mine_1hour' THEN
      -- Check mining time from validation data
      IF COALESCE((p_validation_data->>'miningTime')::INTEGER, 0) < 3600 THEN
        RETURN QUERY SELECT false, 'Insufficient mining time', row_to_json(user_record)::JSONB;
        RETURN;
      END IF;
      
      -- Check account age
      IF account_age_hours < 1 THEN
        RETURN QUERY SELECT false, 'Account too new for time-based tasks', row_to_json(user_record)::JSONB;
        RETURN;
      END IF;
      
    WHEN 'buy_upgrade' THEN
      -- Check if user has any upgrades
      IF COALESCE(user_record.upgrade_levels, '{}') = '{}' THEN
        RETURN QUERY SELECT false, 'No upgrades purchased', row_to_json(user_record)::JSONB;
        RETURN;
      END IF;
      
    WHEN 'submit_wallet' THEN
      -- Validate wallet address
      IF COALESCE(p_validation_data->>'walletAddress', '') = '' OR 
         LENGTH(COALESCE(p_validation_data->>'walletAddress', '')) < 10 THEN
        RETURN QUERY SELECT false, 'Invalid wallet address', row_to_json(user_record)::JSONB;
        RETURN;
      END IF;
      
    ELSE
      -- For social tasks and other tasks, accept with logging
      NULL;
  END CASE;
  
  -- All validations passed
  RETURN QUERY SELECT true, 'Validation successful', row_to_json(user_record)::JSONB;
END;
$$ LANGUAGE plpgsql;

-- Create function to check rate limits
CREATE OR REPLACE FUNCTION check_task_rate_limit(
  p_user_id INTEGER,
  p_task_category VARCHAR(20)
)
RETURNS TABLE(
  is_allowed BOOLEAN,
  reason TEXT,
  attempts_remaining INTEGER
) AS $$
DECLARE
  rate_record RECORD;
  max_attempts INTEGER;
BEGIN
  -- Set max attempts based on category
  CASE p_task_category
    WHEN 'social' THEN max_attempts := 10;
    WHEN 'mining' THEN max_attempts := 50;
    WHEN 'airdrop' THEN max_attempts := 5;
    ELSE max_attempts := 20;
  END CASE;
  
  -- Get current rate limit record
  SELECT * INTO rate_record 
  FROM task_rate_limits 
  WHERE user_id = p_user_id AND task_category = p_task_category;
  
  -- If no record exists, allow
  IF NOT FOUND THEN
    RETURN QUERY SELECT true, 'No rate limit active', max_attempts;
    RETURN;
  END IF;
  
  -- Check if rate limit has expired
  IF NOW() > rate_record.reset_after THEN
    RETURN QUERY SELECT true, 'Rate limit expired', max_attempts;
    RETURN;
  END IF;
  
  -- Check if user is blocked
  IF rate_record.is_blocked THEN
    RETURN QUERY SELECT false, 'User temporarily blocked', 0;
    RETURN;
  END IF;
  
  -- Check attempt count
  IF rate_record.attempts_count >= max_attempts THEN
    RETURN QUERY SELECT false, 'Rate limit exceeded', 0;
    RETURN;
  END IF;
  
  -- Rate limit check passed
  RETURN QUERY SELECT true, 'Rate limit check passed', (max_attempts - rate_record.attempts_count);
END;
$$ LANGUAGE plpgsql;

-- Create function to update task statistics
CREATE OR REPLACE FUNCTION update_task_statistics(
  p_task_id VARCHAR(50),
  p_task_type VARCHAR(20),
  p_success BOOLEAN,
  p_completion_time_seconds INTEGER DEFAULT 0
)
RETURNS void AS $$
BEGIN
  INSERT INTO task_statistics (task_id, task_type, total_completions, total_attempts, last_updated)
  VALUES (p_task_id, p_task_type, 
          CASE WHEN p_success THEN 1 ELSE 0 END, 
          1, 
          NOW())
  ON CONFLICT (task_id) DO UPDATE SET
    total_completions = task_statistics.total_completions + CASE WHEN p_success THEN 1 ELSE 0 END,
    total_attempts = task_statistics.total_attempts + 1,
    success_rate = CASE 
      WHEN (task_statistics.total_attempts + 1) = 0 THEN 0 
      ELSE ROUND((task_statistics.total_completions + CASE WHEN p_success THEN 1 ELSE 0 END) * 100.0 / (task_statistics.total_attempts + 1), 2)
    END,
    avg_completion_time_seconds = CASE 
      WHEN p_success AND p_completion_time_seconds > 0 THEN 
        (task_statistics.avg_completion_time_seconds * task_statistics.total_completions + p_completion_time_seconds) / (task_statistics.total_completions + 1)
      ELSE task_statistics.avg_completion_time_seconds
    END,
    last_updated = NOW();
END;
$$ LANGUAGE plpgsql;

-- Create function for secure task completion
CREATE OR REPLACE FUNCTION complete_task_securely(
  p_user_id INTEGER,
  p_task_id VARCHAR(50),
  p_task_type VARCHAR(20),
  p_reward_amount INTEGER,
  p_reward_type VARCHAR(20) DEFAULT 'gems',
  p_validation_data JSONB DEFAULT '{}',
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_session_id VARCHAR(255) DEFAULT NULL
)
RETURNS TABLE(
  success BOOLEAN,
  reason TEXT,
  task_completion_id INTEGER
) AS $$
DECLARE
  validation_result RECORD;
  rate_limit_result RECORD;
  completion_id INTEGER;
  validation_hash TEXT;
BEGIN
  -- Validate task completion
  SELECT * INTO validation_result 
  FROM validate_task_completion(p_user_id, p_task_id, p_task_type, p_validation_data);
  
  IF NOT validation_result.is_valid THEN
    -- Log failed validation
    INSERT INTO task_validation_logs (user_id, task_id, action_type, reason, validation_data, ip_address, user_agent, session_id)
    VALUES (p_user_id, p_task_id, 'validation_failed', validation_result.reason, p_validation_data, p_ip_address::INET, p_user_agent, p_session_id);
    
    -- Update statistics
    PERFORM update_task_statistics(p_task_id, p_task_type, false);
    
    RETURN QUERY SELECT false, validation_result.reason, 0;
    RETURN;
  END IF;
  
  -- Check rate limiting
  SELECT * INTO rate_limit_result 
  FROM check_task_rate_limit(p_user_id, p_task_type);
  
  IF NOT rate_limit_result.is_allowed THEN
    -- Log rate limit hit
    INSERT INTO task_validation_logs (user_id, task_id, action_type, reason, validation_data, ip_address, user_agent, session_id)
    VALUES (p_user_id, p_task_id, 'rate_limited', rate_limit_result.reason, p_validation_data, p_ip_address::INET, p_user_agent, p_session_id);
    
    RETURN QUERY SELECT false, rate_limit_result.reason, 0;
    RETURN;
  END IF;
  
  -- Generate validation hash
  validation_hash := encode(digest(concat(p_user_id, p_task_id, p_validation_data::text, EXTRACT(EPOCH FROM NOW())), 'sha256'), 'hex');
  
  -- Create task completion record
  INSERT INTO task_completions (
    user_id, task_id, task_type, reward_amount, reward_type,
    validation_data, ip_address, user_agent, session_id, validation_hash
  ) VALUES (
    p_user_id, p_task_id, p_task_type, p_reward_amount, p_reward_type,
    p_validation_data, p_ip_address::INET, p_user_agent, p_session_id, validation_hash
  ) RETURNING id INTO completion_id;
  
  -- Update user's balance
  PERFORM increment_user_sbt(p_user_id, p_reward_amount);
  
  -- Update rate limiting
  INSERT INTO task_rate_limits (user_id, task_category, attempts_count, last_attempt, reset_after)
  VALUES (p_user_id, p_task_type, 1, NOW(), NOW() + INTERVAL '1 hour')
  ON CONFLICT (user_id, task_category) DO UPDATE SET
    attempts_count = task_rate_limits.attempts_count + 1,
    last_attempt = NOW(),
    reset_after = CASE 
      WHEN NOW() > task_rate_limits.reset_after THEN NOW() + INTERVAL '1 hour'
      ELSE task_rate_limits.reset_after
    END;
  
  -- Log successful completion
  INSERT INTO task_validation_logs (user_id, task_id, action_type, reason, validation_data, ip_address, user_agent, session_id)
  VALUES (p_user_id, p_task_id, 'completed', 'Task completed successfully', p_validation_data, p_ip_address::INET, p_user_agent, p_session_id);
  
  -- Update statistics
  PERFORM update_task_statistics(p_task_id, p_task_type, true);
  
  RETURN QUERY SELECT true, 'Task completed successfully', completion_id;
END;
$$ LANGUAGE plpgsql;

-- Create view for task completion analytics
CREATE OR REPLACE VIEW task_completion_analytics AS
SELECT 
  tc.task_id,
  tc.task_type,
  COUNT(*) as total_completions,
  COUNT(DISTINCT tc.user_id) as unique_users,
  AVG(tc.reward_amount) as avg_reward,
  MIN(tc.completed_at) as first_completion,
  MAX(tc.completed_at) as last_completion,
  COUNT(CASE WHEN tc.completed_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as completions_24h,
  COUNT(CASE WHEN tc.completed_at >= NOW() - INTERVAL '7 days' THEN 1 END) as completions_7d,
  COUNT(CASE WHEN tc.completed_at >= NOW() - INTERVAL '30 days' THEN 1 END) as completions_30d
FROM task_completions tc
WHERE tc.is_valid = true
GROUP BY tc.task_id, tc.task_type;

-- Create view for suspicious activity monitoring
CREATE OR REPLACE VIEW suspicious_activity_monitor AS
SELECT 
  tvl.user_id,
  u.username,
  u.telegram_id,
  COUNT(*) as total_suspicious_events,
  COUNT(CASE WHEN tvl.action_type = 'validation_failed' THEN 1 END) as validation_failures,
  COUNT(CASE WHEN tvl.action_type = 'rate_limited' THEN 1 END) as rate_limit_hits,
  COUNT(CASE WHEN tvl.action_type = 'duplicate' THEN 1 END) as duplicate_attempts,
  MAX(tvl.timestamp) as last_suspicious_activity,
  array_agg(DISTINCT tvl.task_id) as affected_tasks
FROM task_validation_logs tvl
JOIN users u ON tvl.user_id = u.id
WHERE tvl.action_type IN ('validation_failed', 'rate_limited', 'duplicate')
  AND tvl.timestamp >= NOW() - INTERVAL '24 hours'
GROUP BY tvl.user_id, u.username, u.telegram_id
HAVING COUNT(*) > 5
ORDER BY total_suspicious_events DESC;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_divine_points ON users(divine_points);
CREATE INDEX IF NOT EXISTS idx_users_upgrade_levels ON users USING GIN(upgrade_levels);
CREATE INDEX IF NOT EXISTS idx_users_is_mining ON users(is_mining);
CREATE INDEX IF NOT EXISTS idx_users_tasks_completed ON users(tasks_completed_count);

-- Insert default task configurations (optional)
INSERT INTO task_statistics (task_id, task_type, total_completions, total_attempts, success_rate, avg_completion_time_seconds)
VALUES 
  ('mine_1000', 'mining', 0, 0, 0.00, 0),
  ('mine_10000', 'mining', 0, 0, 0.00, 0),
  ('mine_1hour', 'mining', 0, 0, 0.00, 3600),
  ('buy_upgrade', 'mining', 0, 0, 0.00, 0),
  ('follow_twitter', 'social', 0, 0, 0.00, 30),
  ('join_telegram', 'social', 0, 0, 0.00, 30),
  ('retweet_post', 'social', 0, 0, 0.00, 30),
  ('submit_wallet', 'airdrop', 0, 0, 0.00, 60),
  ('invite_friend', 'social', 0, 0, 0.00, 45),
  ('like_post', 'social', 0, 0, 0.00, 15)
ON CONFLICT (task_id) DO NOTHING;

-- Create trigger to automatically update task statistics
CREATE OR REPLACE FUNCTION trigger_update_task_stats()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM update_task_statistics(NEW.task_id, NEW.task_type, true);
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER task_completion_stats_trigger
  AFTER INSERT ON task_completions
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_task_stats();

-- Grant necessary permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT, UPDATE ON task_completions TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE ON task_validation_logs TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE ON task_rate_limits TO your_app_user;
-- GRANT SELECT ON task_completion_analytics TO your_app_user;
-- GRANT SELECT ON suspicious_activity_monitor TO your_app_user;

-- Add comments for documentation
COMMENT ON TABLE task_completions IS 'Stores completed tasks with validation data and anti-cheat measures';
COMMENT ON TABLE task_validation_logs IS 'Logs all task attempts and validation failures for monitoring';
COMMENT ON TABLE task_rate_limits IS 'Implements rate limiting to prevent task spam and abuse';
COMMENT ON TABLE task_statistics IS 'Analytics data for task completion rates and performance';

COMMENT ON FUNCTION complete_task_securely IS 'Main function for secure task completion with full validation';
COMMENT ON FUNCTION validate_task_completion IS 'Validates task completion based on game state and requirements';
COMMENT ON FUNCTION check_task_rate_limit IS 'Checks if user has exceeded rate limits for task category';
COMMENT ON FUNCTION increment_user_sbt IS 'Safely increments user SBT balance with task tracking';

-- Create admin functions for monitoring
CREATE OR REPLACE FUNCTION get_user_task_summary(p_user_id INTEGER)
RETURNS TABLE(
  total_completed INTEGER,
  total_rewards NUMERIC,
  completion_rate DECIMAL,
  suspicious_events INTEGER,
  last_completion TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*)::INTEGER FROM task_completions WHERE user_id = p_user_id AND is_valid = true),
    (SELECT COALESCE(SUM(reward_amount), 0) FROM task_completions WHERE user_id = p_user_id AND is_valid = true),
    (SELECT CASE WHEN COUNT(*) = 0 THEN 0 ELSE ROUND(COUNT(CASE WHEN is_valid THEN 1 END) * 100.0 / COUNT(*), 2) END 
     FROM task_completions WHERE user_id = p_user_id),
    (SELECT COUNT(*)::INTEGER FROM task_validation_logs 
     WHERE user_id = p_user_id AND action_type IN ('validation_failed', 'rate_limited', 'duplicate')
     AND timestamp >= NOW() - INTERVAL '24 hours'),
    (SELECT MAX(completed_at) FROM task_completions WHERE user_id = p_user_id AND is_valid = true);
END;
$$ LANGUAGE plpgsql;

-- Final success message
DO $$ 
BEGIN 
  RAISE NOTICE '✅ Task completion schema created successfully!';
  RAISE NOTICE '📊 Tables created: task_completions, task_validation_logs, task_rate_limits, task_statistics';
  RAISE NOTICE '🔧 Functions created: complete_task_securely, validate_task_completion, check_task_rate_limit';
  RAISE NOTICE '📈 Views created: task_completion_analytics, suspicious_activity_monitor';
  RAISE NOTICE '🛡️ Anti-cheat measures: Rate limiting, validation hashing, suspicious activity tracking';
END $$; 