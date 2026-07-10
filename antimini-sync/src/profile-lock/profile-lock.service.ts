import { Injectable } from "@nestjs/common";
import type { UserContext } from "../auth/user-context.interface.js";

const LOCK_TTL_MS = 90_000;

export interface ProfileLock {
  profileId: string;
  lockedBy: string;
  lockedByEmail: string;
  lockedAt: string;
  expiresAt: string;
}

interface StoredLock extends ProfileLock {
  scope: string;
  deviceId: string;
}

@Injectable()
export class ProfileLockService {
  private readonly locks = new Map<string, StoredLock>();

  private scope(ctx: UserContext): string {
    return ctx.teamPrefix || ctx.prefix || "self-hosted";
  }

  private key(ctx: UserContext, profileId: string): string {
    return `${this.scope(ctx)}:${profileId}`;
  }

  private prune(now = Date.now()): void {
    for (const [key, lock] of this.locks) {
      if (Date.parse(lock.expiresAt) <= now) this.locks.delete(key);
    }
  }

  acquire(ctx: UserContext, profileId: string, deviceId: string) {
    this.prune();
    const key = this.key(ctx, profileId);
    const existing = this.locks.get(key);
    if (existing && existing.deviceId !== deviceId) {
      return { success: false, lock: this.publicLock(existing) };
    }

    const now = new Date();
    const lock: StoredLock = {
      profileId,
      lockedBy: deviceId,
      lockedByEmail: "another device",
      lockedAt: existing?.lockedAt || now.toISOString(),
      expiresAt: new Date(now.getTime() + LOCK_TTL_MS).toISOString(),
      scope: this.scope(ctx),
      deviceId,
    };
    this.locks.set(key, lock);
    return { success: true, lock: this.publicLock(lock) };
  }

  heartbeat(ctx: UserContext, profileId: string, deviceId: string) {
    this.prune();
    const lock = this.locks.get(this.key(ctx, profileId));
    if (!lock || lock.deviceId !== deviceId) return { success: false };
    lock.expiresAt = new Date(Date.now() + LOCK_TTL_MS).toISOString();
    return { success: true, lock: this.publicLock(lock) };
  }

  release(ctx: UserContext, profileId: string, deviceId: string): void {
    this.prune();
    const key = this.key(ctx, profileId);
    const lock = this.locks.get(key);
    if (lock?.deviceId === deviceId) this.locks.delete(key);
  }

  list(ctx: UserContext): ProfileLock[] {
    this.prune();
    const scope = this.scope(ctx);
    return [...this.locks.values()]
      .filter((lock) => lock.scope === scope)
      .map((lock) => this.publicLock(lock));
  }

  private publicLock(lock: StoredLock): ProfileLock {
    const { scope: _scope, deviceId: _deviceId, ...publicLock } = lock;
    return publicLock;
  }
}
