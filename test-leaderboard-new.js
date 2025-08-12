import { getDivinePointsLeaderboard, getDivinePointsLeaderboardByPeriod } from './src/lib/supabaseClient.js';

async function runTests() {
  console.log('--- Running All-Time Leaderboard Test ---');
  const allTime = await getDivinePointsLeaderboard(20);

  if (allTime && allTime.length > 1) {
    let isSorted = true;
    for (let i = 0; i < allTime.length - 1; i++) {
      if (allTime[i].divinePoints < allTime[i+1].divinePoints) {
        isSorted = false;
        break;
      }
    }
    if (isSorted) {
      console.log('✅ All-Time Leaderboard is sorted correctly.');
    } else {
      console.error('❌ All-Time Leaderboard is NOT sorted correctly.');
      console.log(allTime.map(p => ({ rank: p.rank, points: p.divinePoints })));
    }
  } else {
    console.log('⚠️ Not enough data to test all-time leaderboard sorting.');
  }

  console.log('\n--- Running Daily Leaderboard Test ---');
  const daily = await getDivinePointsLeaderboardByPeriod('daily', 20);
  if (daily && daily.length > 1) {
    let isSorted = true;
    for (let i = 0; i < daily.length - 1; i++) {
      if (daily[i].divinePoints < daily[i+1].divinePoints) {
        isSorted = false;
        break;
      }
    }
    if (isSorted) {
      console.log('✅ Daily Leaderboard is sorted correctly.');
    } else {
      console.error('❌ Daily Leaderboard is NOT sorted correctly.');
      console.log(daily.map(p => ({ rank: p.rank, points: p.divinePoints })));
    }
  } else {
    console.log('⚠️ Not enough data to test daily leaderboard sorting.');
  }
}

runTests();
