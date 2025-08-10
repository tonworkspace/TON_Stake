import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';

interface MiningTaskDebugProps {
  onClose: () => void;
}

export const MiningTaskDebug: React.FC<MiningTaskDebugProps> = ({ onClose }) => {
  const { user } = useAuth();
  const [debugData, setDebugData] = useState<any>({});
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const refreshDebugData = () => {
    if (!user?.telegram_id) return;

    const telegramId = String(user.telegram_id);
    
    // Read all relevant localStorage keys
    const keys = {
      // Main game state
      gameState: `tonersGame_${telegramId}`,
      // Separate storage keys
      divinePoints: `spiritualEssencePoints_${telegramId}`,
      upgrades: `tonersUpgrades_${telegramId}`,
      achievements: `tonersAchievements_${telegramId}`,
      highScore: `tonersHighScore_${telegramId}`,
      // Mining time tracking
      miningTime: `miningTime_${user.id}`,
      lastMiningUpdate: `lastMiningUpdate_${user.id}`,
      // Task system
      completedTasks: `secure_task_${user.id}_completed_tasks`,
      taskChecksum: `task_checksum_${user.id}_completed_tasks`
    };

    const data: any = {
      userId: user.id,
      telegramId: telegramId,
      timestamp: new Date().toISOString(),
      keys: {},
      calculated: {},
      validation: {}
    };

    // Read all localStorage data
    Object.entries(keys).forEach(([name, key]) => {
      try {
        const rawValue = localStorage.getItem(key);
        data.keys[name] = {
          key: key,
          exists: rawValue !== null,
          rawValue: rawValue,
          parsedValue: rawValue ? JSON.parse(rawValue) : null
        };
      } catch (error) {
        data.keys[name] = {
          key: key,
          exists: false,
          error: error.message
        };
      }
    });

    // Calculate derived values
    const gameStateData = data.keys.gameState?.parsedValue || {};
    const divinePointsRaw = data.keys.divinePoints?.rawValue;
    const upgradesData = data.keys.upgrades?.parsedValue || [];
    const miningTimeRaw = data.keys.miningTime?.rawValue;

    data.calculated = {
      divinePoints: {
        fromGameState: gameStateData.divinePoints || 0,
        fromSeparateKey: divinePointsRaw ? parseInt(divinePointsRaw, 10) : 0,
        finalValue: divinePointsRaw ? parseInt(divinePointsRaw, 10) : (gameStateData.divinePoints || 0)
      },
      upgrades: {
        count: upgradesData.length,
        totalLevels: upgradesData.reduce((sum: number, upgrade: any) => sum + (upgrade.level || 0), 0),
        hasAnyUpgrades: upgradesData.some((upgrade: any) => (upgrade.level || 0) > 0),
        upgradesList: upgradesData.map((upgrade: any) => ({
          id: upgrade.id,
          name: upgrade.name,
          level: upgrade.level || 0
        }))
      },
      mining: {
        isMining: Boolean(gameStateData.isMining),
        sessionStartTime: gameStateData.sessionStartTime || 0,
        currentMiningTime: miningTimeRaw ? parseFloat(miningTimeRaw) : 0,
        miningTimeInMinutes: miningTimeRaw ? Math.floor(parseFloat(miningTimeRaw) / 60) : 0,
        qualifiesFor1Hour: miningTimeRaw ? parseFloat(miningTimeRaw) >= 3600 : false
      }
    };

    // Task validation
    data.validation = {
      mine_1000: {
        requirement: 1000,
        current: data.calculated.divinePoints.finalValue,
        qualified: data.calculated.divinePoints.finalValue >= 1000,
        progress: Math.min(data.calculated.divinePoints.finalValue / 1000 * 100, 100)
      },
      mine_10000: {
        requirement: 10000,
        current: data.calculated.divinePoints.finalValue,
        qualified: data.calculated.divinePoints.finalValue >= 10000,
        progress: Math.min(data.calculated.divinePoints.finalValue / 10000 * 100, 100)
      },
      mine_1hour: {
        requirement: 3600,
        current: data.calculated.mining.currentMiningTime,
        qualified: data.calculated.mining.qualifiesFor1Hour,
        progress: Math.min(data.calculated.mining.currentMiningTime / 3600 * 100, 100)
      },
      buy_upgrade: {
        requirement: 1,
        current: data.calculated.upgrades.totalLevels,
        qualified: data.calculated.upgrades.hasAnyUpgrades,
        progress: data.calculated.upgrades.hasAnyUpgrades ? 100 : 0
      }
    };

    setDebugData(data);
  };

  useEffect(() => {
    refreshDebugData();
  }, [user?.telegram_id, user?.id, refreshTrigger]);

  const testMiningTimeReset = () => {
    if (!user?.id) return;
    
    const miningTimeKey = `miningTime_${user.id}`;
    const lastUpdateKey = `lastMiningUpdate_${user.id}`;
    
    localStorage.removeItem(miningTimeKey);
    localStorage.removeItem(lastUpdateKey);
    
    console.log('🔄 Mining time reset for testing');
    setRefreshTrigger(prev => prev + 1);
  };

  const testStartMining = () => {
    if (!user?.telegram_id) return;
    
    const telegramId = String(user.telegram_id);
    const gameStateKey = `tonersGame_${telegramId}`;
    
    try {
      const gameState = JSON.parse(localStorage.getItem(gameStateKey) || '{}');
      gameState.isMining = true;
      gameState.sessionStartTime = Date.now();
      
      localStorage.setItem(gameStateKey, JSON.stringify(gameState));
      console.log('🎮 Started mining for testing');
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error('Error starting mining:', error);
    }
  };

  const testAddPoints = (amount: number) => {
    if (!user?.telegram_id) return;
    
    const telegramId = String(user.telegram_id);
    const pointsKey = `spiritualEssencePoints_${telegramId}`;
    
    try {
      const currentPoints = parseInt(localStorage.getItem(pointsKey) || '0', 10);
      const newPoints = currentPoints + amount;
      
      localStorage.setItem(pointsKey, newPoints.toString());
      console.log(`💎 Added ${amount} points for testing. New total: ${newPoints}`);
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error('Error adding points:', error);
    }
  };

  const testAddUpgrade = () => {
    if (!user?.telegram_id) return;
    
    const telegramId = String(user.telegram_id);
    const upgradesKey = `tonersUpgrades_${telegramId}`;
    
    try {
      const upgrades = JSON.parse(localStorage.getItem(upgradesKey) || '[]');
      
      // Add a test upgrade if none exist
      if (upgrades.length === 0) {
        upgrades.push({
          id: 'test_upgrade',
          name: 'Test Upgrade',
          level: 1,
          effect: 'Test Effect'
        });
      } else {
        // Increase level of first upgrade
        upgrades[0].level = (upgrades[0].level || 0) + 1;
      }
      
      localStorage.setItem(upgradesKey, JSON.stringify(upgrades));
      console.log('⚡ Added/upgraded for testing');
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error('Error adding upgrade:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-cyan-400/30 rounded-xl p-6 max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-cyan-400 font-mono font-bold text-lg">🔍 Mining Task Debug Panel</h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl"
          >
            ×
          </button>
        </div>

        <div className="space-y-4 text-sm font-mono">
          {/* User Info */}
          <div className="bg-gray-800 p-3 rounded border border-gray-600">
            <h3 className="text-green-400 font-bold mb-2">👤 User Info</h3>
            <div className="text-gray-300">
              <div>User ID: {debugData.userId}</div>
              <div>Telegram ID: {debugData.telegramId}</div>
              <div>Timestamp: {debugData.timestamp}</div>
            </div>
          </div>

          {/* Task Validation */}
          <div className="bg-gray-800 p-3 rounded border border-gray-600">
            <h3 className="text-yellow-400 font-bold mb-2">✅ Task Validation</h3>
            <div className="space-y-2">
              {Object.entries(debugData.validation || {}).map(([taskId, validation]: [string, any]) => (
                <div key={taskId} className={`p-2 rounded ${validation.qualified ? 'bg-green-900/30' : 'bg-red-900/30'}`}>
                  <div className="flex justify-between">
                    <span className="text-white font-bold">{taskId}</span>
                    <span className={validation.qualified ? 'text-green-400' : 'text-red-400'}>
                      {validation.qualified ? '✅ QUALIFIED' : '❌ NOT QUALIFIED'}
                    </span>
                  </div>
                  <div className="text-gray-400 text-xs">
                    Current: {validation.current} / Required: {validation.requirement}
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2 mt-1">
                    <div 
                      className={`h-2 rounded-full ${validation.qualified ? 'bg-green-500' : 'bg-yellow-500'}`}
                      style={{ width: `${Math.min(validation.progress, 100)}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Calculated Values */}
          <div className="bg-gray-800 p-3 rounded border border-gray-600">
            <h3 className="text-blue-400 font-bold mb-2">📊 Calculated Values</h3>
            <div className="space-y-2 text-gray-300">
              <div>
                <strong>Divine Points:</strong> {debugData.calculated?.divinePoints?.finalValue || 0}
                <span className="text-gray-500 ml-2">
                  (Game State: {debugData.calculated?.divinePoints?.fromGameState || 0}, 
                   Separate Key: {debugData.calculated?.divinePoints?.fromSeparateKey || 0})
                </span>
              </div>
              <div>
                <strong>Mining:</strong> 
                {debugData.calculated?.mining?.isMining ? ' 🟢 ACTIVE' : ' 🔴 INACTIVE'} | 
                Time: {debugData.calculated?.mining?.miningTimeInMinutes || 0}m |
                Qualifies for 1h: {debugData.calculated?.mining?.qualifiesFor1Hour ? '✅' : '❌'}
              </div>
              <div>
                <strong>Upgrades:</strong> 
                {debugData.calculated?.upgrades?.count || 0} upgrades, 
                {debugData.calculated?.upgrades?.totalLevels || 0} total levels,
                Has any: {debugData.calculated?.upgrades?.hasAnyUpgrades ? '✅' : '❌'}
              </div>
            </div>
          </div>

          {/* Test Controls */}
          <div className="bg-gray-800 p-3 rounded border border-gray-600">
            <h3 className="text-purple-400 font-bold mb-2">🧪 Test Controls</h3>
            <div className="flex flex-wrap gap-2">
              <button 
                onClick={() => setRefreshTrigger(prev => prev + 1)}
                className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
              >
                🔄 Refresh
              </button>
              <button 
                onClick={testMiningTimeReset}
                className="bg-orange-600 text-white px-3 py-1 rounded hover:bg-orange-700"
              >
                ⏰ Reset Mining Time
              </button>
              <button 
                onClick={testStartMining}
                className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
              >
                ⛏️ Start Mining
              </button>
              <button 
                onClick={() => testAddPoints(500)}
                className="bg-yellow-600 text-white px-3 py-1 rounded hover:bg-yellow-700"
              >
                💎 +500 Points
              </button>
              <button 
                onClick={() => testAddPoints(5000)}
                className="bg-yellow-700 text-white px-3 py-1 rounded hover:bg-yellow-800"
              >
                💎 +5000 Points
              </button>
              <button 
                onClick={testAddUpgrade}
                className="bg-purple-600 text-white px-3 py-1 rounded hover:bg-purple-700"
              >
                ⚡ Add Upgrade
              </button>
            </div>
          </div>

          {/* Raw Data */}
          <div className="bg-gray-800 p-3 rounded border border-gray-600">
            <h3 className="text-red-400 font-bold mb-2">🗂️ Raw Data (Collapsed)</h3>
            <details>
              <summary className="cursor-pointer text-gray-400 hover:text-white">
                Click to expand raw localStorage data
              </summary>
              <pre className="bg-gray-900 p-2 rounded mt-2 text-xs overflow-auto max-h-60">
                {JSON.stringify(debugData, null, 2)}
              </pre>
            </details>
          </div>
        </div>
      </div>
    </div>
  );
}; 