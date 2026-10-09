/**
 * Unit Tests: Dead-Man Switch (`scheduleCancel`) Module
 */

import assert from 'node:assert';
import { DeadManSwitchManager } from '../src/engine/deadman.js';

console.log('🧪 Running Dead-Man Switch Tests...\n');

// 1. Arming and status check
{
  let heartbeatCount = 0;
  const deadman = new DeadManSwitchManager({
    timeoutMs: 5000,
    onHeartbeat: () => {
      heartbeatCount++;
    },
  });

  const initialStatus = deadman.getStatus();
  assert.strictEqual(initialStatus.armed, false);
  assert.strictEqual(initialStatus.scheduledCancelTimeMs, null);

  // Arm
  const armedStatus = deadman.arm(10000); // 10s
  assert.strictEqual(armedStatus.armed, true);
  assert(armedStatus.remainingSeconds >= 9);
  assert(armedStatus.scheduledCancelTimeMs! > Date.now());
  assert.strictEqual(heartbeatCount, 1);

  console.log(`  ✅ Arming: Successfully armed with ${armedStatus.remainingSeconds}s countdown`);

  // Disarm
  deadman.disarm();
  const disarmedStatus = deadman.getStatus();
  assert.strictEqual(disarmedStatus.armed, false);
  assert.strictEqual(disarmedStatus.scheduledCancelTimeMs, null);

  console.log(`  ✅ Disarm: Gracefully disarmed without firing cancellation`);
}

// 2. Heartbeat extension
{
  const deadman = new DeadManSwitchManager({ timeoutMs: 5000 });
  deadman.arm(5000);
  const firstDeadline = deadman.getStatus().scheduledCancelTimeMs!;

  // Wait 10ms and send heartbeat
  const statusAfterHeartbeat = deadman.heartbeat();
  assert(statusAfterHeartbeat.scheduledCancelTimeMs! >= firstDeadline);

  console.log(`  ✅ Heartbeat: Successfully renewed dead-man deadline`);
  deadman.disarm();
}

// 3. Hyperliquid L1 Action payload generation
{
  const payload = DeadManSwitchManager.buildActionPayload(1728500000000);
  assert.strictEqual(payload.type, 'scheduleCancel');
  assert.strictEqual(payload.time, 1728500000000);

  const disarmPayload = DeadManSwitchManager.buildActionPayload(null);
  assert.strictEqual(disarmPayload.type, 'scheduleCancel');
  assert.strictEqual(disarmPayload.time, null);

  console.log(`  ✅ L1 Action: Correct scheduleCancel payload formatting`);
}

// 4. Emergency Kill-Switch after arm cancels / disarms
{
  let emergencyTriggered = false;
  const deadman = new DeadManSwitchManager({
    timeoutMs: 30000,
    onExpired: () => {
      emergencyTriggered = true;
    },
  });

  deadman.arm();
  assert.strictEqual(deadman.getStatus().armed, true);

  // Trigger emergency kill-switch
  const res = await deadman.triggerEmergencyKillSwitch();
  assert.strictEqual(res.success, true);
  assert.strictEqual(deadman.getStatus().armed, false);
  assert.strictEqual(deadman.getStatus().scheduledCancelTimeMs, null);
  assert.strictEqual(emergencyTriggered, true);

  console.log(`  ✅ Emergency Kill-Switch: Disarmed deadman and triggered emergency cancellation`);
}

// 5. Expired deadline fires once
{
  let expireCount = 0;
  const shortDeadman = new DeadManSwitchManager({
    timeoutMs: 35,
    checkIntervalMs: 10,
    onExpired: () => {
      expireCount++;
    },
  });

  shortDeadman.arm();
  assert.strictEqual(shortDeadman.getStatus().armed, true);

  // Wait for expiry to trigger
  await new Promise((resolve) => setTimeout(resolve, 80));

  assert.strictEqual(expireCount, 1, 'Expired deadline must fire onExpired exactly once');
  assert.strictEqual(shortDeadman.getStatus().armed, false);
  assert(shortDeadman.getStatus().remainingSeconds === 0);

  // Wait extra time to ensure it does not fire again
  await new Promise((resolve) => setTimeout(resolve, 40));
  assert.strictEqual(expireCount, 1, 'Expired deadline must not fire a second time');

  console.log(`  ✅ Expired Deadline: Fires onExpired callback exactly once and disarms`);
}

console.log('\n🎉 All Dead-Man Switch tests passed successfully!\n');
