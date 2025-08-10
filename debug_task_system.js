// Debug script for testing task system initialization
// Run this in the browser console to test the secure task system

console.log('🔍 Task System Debug Script');

// Test 1: Check if crypto is available
console.log('1. Crypto API availability:');
console.log('  - window.crypto:', !!window.crypto);
console.log('  - window.crypto.subtle:', !!(window.crypto && window.crypto.subtle));

// Test 2: Check imports
console.log('2. Import availability:');
try {
  const { getSecureTaskSystem } = window;
  console.log('  - getSecureTaskSystem:', typeof getSecureTaskSystem);
} catch (error) {
  console.log('  - getSecureTaskSystem: Not available', error.message);
}

// Test 3: Test with a sample user ID
console.log('3. Testing with sample user ID (123):');
try {
  if (window.getSecureTaskSystem) {
    const taskSystem = window.getSecureTaskSystem(123);
    console.log('  - Task system created:', !!taskSystem);
    console.log('  - User ID matches:', taskSystem.getUserId() === 123);
    
    // Test basic methods
    taskSystem.isTaskCompleted('test_task').then(result => {
      console.log('  - isTaskCompleted test:', result);
    }).catch(error => {
      console.log('  - isTaskCompleted error:', error.message);
    });
    
    taskSystem.getCompletedTasks().then(tasks => {
      console.log('  - getCompletedTasks:', tasks.length, 'tasks');
    }).catch(error => {
      console.log('  - getCompletedTasks error:', error.message);
    });
    
  } else {
    console.log('  - getSecureTaskSystem not available on window');
  }
} catch (error) {
  console.log('  - Task system creation failed:', error.message);
}

// Test 4: Check localStorage
console.log('4. LocalStorage test:');
try {
  localStorage.setItem('test_secure_task', 'test_value');
  const value = localStorage.getItem('test_secure_task');
  localStorage.removeItem('test_secure_task');
  console.log('  - LocalStorage working:', value === 'test_value');
} catch (error) {
  console.log('  - LocalStorage error:', error.message);
}

// Test 5: Check Supabase connection
console.log('5. Supabase connection:');
try {
  if (window.supabase) {
    console.log('  - Supabase client available:', !!window.supabase);
  } else {
    console.log('  - Supabase client not available on window');
  }
} catch (error) {
  console.log('  - Supabase check error:', error.message);
}

console.log('🔍 Debug script completed. Check the results above.');

// Helper function to reset task system
window.debugResetTaskSystem = () => {
  console.log('🔄 Resetting task system...');
  window.taskSystemInstance = null;
  console.log('✅ Task system reset completed');
};

// Helper function to test task completion
window.debugTestTaskCompletion = async (userId = 123, taskId = 'test_task') => {
  console.log(`🧪 Testing task completion for user ${userId}, task ${taskId}`);
  try {
    const taskSystem = window.getSecureTaskSystem(userId);
    const isCompleted = await taskSystem.isTaskCompleted(taskId);
    console.log(`  - Task ${taskId} completed:`, isCompleted);
    
    if (!isCompleted) {
      console.log('  - Attempting to complete task...');
      const result = await taskSystem.completeTask(taskId, { test: true });
      console.log('  - Completion result:', result);
    }
  } catch (error) {
    console.log('  - Test failed:', error.message);
  }
};

console.log('💡 Available debug functions:');
console.log('  - debugResetTaskSystem()');
console.log('  - debugTestTaskCompletion(userId, taskId)'); 