-- Add updated_at column to users table
-- This migration adds the updated_at timestamp column that's being used in the application

-- Add the updated_at column with default value
ALTER TABLE users 
ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create an index on updated_at for better performance
CREATE INDEX idx_users_updated_at ON users(updated_at);

-- Update existing records to have a current timestamp
UPDATE users 
SET updated_at = NOW() 
WHERE updated_at IS NULL;

-- Add a trigger to automatically update the updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at on row updates
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Verify the column was added
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'updated_at'; 