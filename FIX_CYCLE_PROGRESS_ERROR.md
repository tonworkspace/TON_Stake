# Fix for cycle_progress Column Error

## Issue Description

The error occurs because the `cycle_progress` column is missing from the `stakes` table in the database, but the code is trying to update it during stake operations.

**Error Message:**
```
DailyRewards.tsx:805 Error creating stake: 
{code: 'PGRST204', details: null, hint: null, message: "Could not find the 'cycle_progress' column of 'stakes' in the schema cache"}
```

## Root Cause

The `stakes` table in the current database schema doesn't include the `cycle_progress` column, but:
1. The stealth saving system expects this column to exist
2. The SQL functions in `CREATE_STAKING_FUNCTIONS.sql` reference this column
3. The `UserStake` interface includes this field
4. The code has been temporarily disabled to prevent errors

## Solution

### Step 1: Run the Database Migration

Execute the migration script to add the missing column. You can do this in your Supabase SQL editor:

```sql
-- Run this in your Supabase SQL editor
\i ADD_CYCLE_PROGRESS_COLUMN.sql
```

Or manually run the migration:

```sql
-- Add cycle_progress column to stakes table
DO $$ 
BEGIN
    -- Add cycle_progress column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'stakes' AND column_name = 'cycle_progress'
    ) THEN
        ALTER TABLE stakes ADD COLUMN cycle_progress NUMERIC DEFAULT 0;
        
        -- Update existing stakes to have a calculated cycle_progress
        UPDATE stakes 
        SET cycle_progress = CASE 
            WHEN total_earned >= (amount * 3) THEN 100
            ELSE (total_earned / (amount * 3)) * 100
        END
        WHERE cycle_progress IS NULL OR cycle_progress = 0;
        
        RAISE NOTICE 'Added cycle_progress column to stakes table and updated existing records';
    ELSE
        RAISE NOTICE 'cycle_progress column already exists in stakes table';
    END IF;
END $$;

-- Add comment to the column
COMMENT ON COLUMN stakes.cycle_progress IS 'Progress percentage of the stake cycle (0-100, where 100 = 300% return achieved)';
```

### Step 2: Verify the Column Was Added

Check that the column was successfully added:

```sql
-- Verify the column exists
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default,
    CASE 
        WHEN column_name = 'cycle_progress' THEN '✅ Column added successfully'
        ELSE 'Column already exists'
    END as status
FROM information_schema.columns 
WHERE table_name = 'stakes' AND column_name = 'cycle_progress';
```

### Step 3: Re-enable cycle_progress in the Code

After adding the column to the database, you need to re-enable the `cycle_progress` updates in the code. The code has been temporarily disabled with comments.

#### Update DailyRewards.tsx

Find and uncomment these lines in `src/components/DailyRewards.tsx`:

**Around line 1562-1563:**
```typescript
// Change from:
// cycle_progress: data.cycleProgress

// To:
cycle_progress: data.cycleProgress
```

**Around line 1744-1745:**
```typescript
// Change from:
// cycleProgress: stake.cycle_progress || 0

// To:
cycleProgress: stake.cycle_progress || 0
```

### Step 4: Test the Fix

After applying the database migration and code changes:

1. **Create a new stake** - Should work without errors
2. **Check browser console** - No more cycle_progress column errors
3. **Verify stealth saving** - Data should sync to Supabase properly
4. **Test offline functionality** - Offline queue should process successfully

## What the cycle_progress Column Does

The `cycle_progress` column tracks the progress of each stake through its earning cycle:

- **0-100**: Percentage of progress toward the 300% return goal
- **0**: Just started (0% earned)
- **100**: Completed cycle (300% earned)
- **Formula**: `(total_earned / (amount * 3)) * 100`

## Alternative Solutions (if you can't modify the database)

If you cannot modify the database schema, you can:

### Option 1: Remove cycle_progress from stealth saving
```typescript
// In processStakeUpdate function, keep cycle_progress commented out
const { error } = await supabase
  .from('stakes')
  .update({
    total_earned: data.totalEarned,
    last_payout: data.lastPayout,
    speed_boost_active: data.speedBoostActive
    // cycle_progress: data.cycleProgress // Keep this commented out
  })
  .eq('id', data.stakeId);
```

### Option 2: Store cycle_progress in user_game_data table
```typescript
// Store cycle_progress in the game_data JSON field
const { error } = await supabase
  .from('user_game_data')
  .upsert({
    user_id: data.userId,
    game_data: {
      stakes: {
        [data.stakeId]: {
          cycle_progress: data.cycleProgress
        }
      }
    },
    last_updated: new Date().toISOString()
  }, {
    onConflict: 'user_id'
  });
```

## Prevention

To prevent similar issues in the future:

1. **Schema Versioning**: Keep database schema files up to date
2. **Migration Scripts**: Always create migration scripts for schema changes
3. **Testing**: Test stealth saving with a fresh database
4. **Documentation**: Document all required database columns

## Verification Checklist

After applying the fix, verify:

- [ ] ✅ No more `cycle_progress` column errors in console
- [ ] ✅ New stakes can be created successfully
- [ ] ✅ Stealth saving works properly
- [ ] ✅ Data syncs to Supabase correctly
- [ ] ✅ Offline queue processes successfully
- [ ] ✅ Existing stakes show correct cycle progress

## Related Files

- `ADD_CYCLE_PROGRESS_COLUMN.sql` - Migration script
- `src/components/DailyRewards.tsx` - Stealth saving implementation
- `CREATE_STAKING_FUNCTIONS.sql` - Database functions
- `schema.sql` - Database schema
- `CYCLE_PROGRESS_FIX.md` - Original fix documentation 