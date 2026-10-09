/**
 * Dead-Man Switch (`scheduleCancel`) Module for HIP-4 Desk
 * 
 * Hyperliquid provides an exchange-level dead-man switch action (`scheduleCancel`).
 * If the quoting bot crashes, loses internet, or hangs, the validators automatically
 * cancel all active orders once the deadline timestamp is reached.
 * 
 * Architecture:
 * - Arm: Sets target cancel time (e.g. now + 30s) on Hyperliquid L1 validators.
 * - Heartbeat: Periodic ping from the active quoting loop (every 10s) pushing the deadline out.
 * - Disarm: Cancels the scheduled timer.
 * - Emergency Kill-Switch (`cancel-all`): Immediately cancels all orders.
 */

import { DeadManStatus } from '../types.js';

export interface DeadManConfig {
  timeoutMs?: number;         // e.g. 30,000 ms (30s safety window)
  heartbeatIntervalMs?: number; // e.g. 10,000 ms
  checkIntervalMs?: number;   // check loop interval, default 1000ms
  onExpired?: () => Promise<void> | void;
  onHeartbeat?: (scheduledTimeMs: number) => Promise<void> | void;
}

export interface HyperliquidScheduleCancelAction {
  type: 'scheduleCancel';
  time: number | null; // epoch ms or null to cancel
}

export class DeadManSwitchManager {
  private timeoutMs: number;
  private heartbeatIntervalMs: number;
  private checkIntervalMs: number;
  private isArmed: boolean = false;
  private scheduledCancelTimeMs: number | null = null;
  private lastHeartbeatMs: number | null = null;
  private checkTimer: NodeJS.Timeout | null = null;
  private onExpired?: () => Promise<void> | void;
  private onHeartbeat?: (scheduledTimeMs: number) => Promise<void> | void;

  constructor(config?: DeadManConfig) {
    this.timeoutMs = config?.timeoutMs ?? 30000;
    this.heartbeatIntervalMs = config?.heartbeatIntervalMs ?? 10000;
    this.checkIntervalMs = config?.checkIntervalMs ?? 1000;
    this.onExpired = config?.onExpired;
    this.onHeartbeat = config?.onHeartbeat;
  }

  /**
   * Builds the official Hyperliquid L1 exchange action payload
   */
  static buildActionPayload(timeMs: number | null): HyperliquidScheduleCancelAction {
    return {
      type: 'scheduleCancel',
      time: timeMs,
    };
  }

  /**
   * Arms the dead-man switch with specified timeout
   */
  arm(timeoutMs?: number): DeadManStatus {
    if (timeoutMs) {
      this.timeoutMs = timeoutMs;
    }

    this.isArmed = true;
    this.lastHeartbeatMs = Date.now();
    this.scheduledCancelTimeMs = this.lastHeartbeatMs + this.timeoutMs;

    this.startWatcher();

    if (this.onHeartbeat && this.scheduledCancelTimeMs) {
      void this.onHeartbeat(this.scheduledCancelTimeMs);
    }

    return this.getStatus();
  }

  /**
   * Sends heartbeat from the quoting loop, advancing the deadline
   */
  heartbeat(): DeadManStatus {
    if (!this.isArmed) {
      return this.arm();
    }

    this.lastHeartbeatMs = Date.now();
    this.scheduledCancelTimeMs = this.lastHeartbeatMs + this.timeoutMs;

    if (this.onHeartbeat && this.scheduledCancelTimeMs) {
      void this.onHeartbeat(this.scheduledCancelTimeMs);
    }

    return this.getStatus();
  }

  /**
   * Disarms the dead-man switch (e.g. during graceful shutdown)
   */
  disarm(): DeadManStatus {
    this.isArmed = false;
    this.scheduledCancelTimeMs = null;
    this.stopWatcher();

    if (this.onHeartbeat) {
      void this.onHeartbeat(0);
    }

    return this.getStatus();
  }

  /**
   * Internal watcher to detect expiry locally
   */
  private startWatcher(): void {
    this.stopWatcher();
    this.checkTimer = setInterval(() => {
      if (!this.isArmed || !this.scheduledCancelTimeMs) return;

      const now = Date.now();
      if (now >= this.scheduledCancelTimeMs) {
        this.triggerExpiry();
      }
    }, this.checkIntervalMs);
  }

  private stopWatcher(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
  }

  /**
   * Triggered when heartbeat was missed and scheduled cancel time arrived
   */
  private triggerExpiry(): void {
    console.warn(`🚨 [Dead-Man Switch] Heartbeat expired! Triggering automated failsafe cancel.`);
    this.isArmed = false;
    this.stopWatcher();

    if (this.onExpired) {
      try {
        void this.onExpired();
      } catch (err) {
        console.error(`[Dead-Man Switch] Error in expiry handler:`, err);
      }
    }
  }

  /**
   * Returns current status summary
   */
  getStatus(): DeadManStatus {
    const now = Date.now();
    let remainingSeconds = 0;
    let statusText = 'DISARMED (INACTIVE)';

    if (this.isArmed && this.scheduledCancelTimeMs) {
      const remainingMs = Math.max(0, this.scheduledCancelTimeMs - now);
      remainingSeconds = Math.round(remainingMs / 1000);
      statusText = remainingSeconds > 0
        ? `ARMED (Cancels in ${remainingSeconds}s unless heartbeat renewed)`
        : 'EXPIRED (CANCELLATION EXECUTED)';
    }

    return {
      armed: this.isArmed,
      timeoutMs: this.timeoutMs,
      scheduledCancelTimeMs: this.scheduledCancelTimeMs,
      remainingSeconds,
      lastHeartbeatMs: this.lastHeartbeatMs,
      statusText,
    };
  }

  /**
   * Forces immediate emergency kill-switch
   */
  async triggerEmergencyKillSwitch(): Promise<{ success: boolean; message: string }> {
    this.disarm();
    if (this.onExpired) {
      await this.onExpired();
    }
    return {
      success: true,
      message: 'Emergency Kill-Switch triggered. All quoting halted and cancellation order dispatched.',
    };
  }
}
