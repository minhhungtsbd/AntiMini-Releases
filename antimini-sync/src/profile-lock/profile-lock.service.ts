import { Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient, type RedisClientType } from "redis";
import type { UserContext } from "../auth/user-context.interface.js";

const LOCK_TTL_MS = 90_000;
const REDIS_KEY_PREFIX = "antimini:profile-lock:";

const ACQUIRE_LOCK_SCRIPT = `
local existing = redis.call('GET', KEYS[1])
if not existing then
  redis.call('SET', KEYS[1], ARGV[1], 'PX', ARGV[3])
  return { 1, ARGV[1] }
end

local parsed = cjson.decode(existing)
if parsed.deviceId == ARGV[2] then
  local replacement = cjson.decode(ARGV[1])
  replacement.lockedAt = parsed.lockedAt
  local encoded = cjson.encode(replacement)
  redis.call('SET', KEYS[1], encoded, 'XX', 'PX', ARGV[3])
  return { 1, encoded }
end

return { 0, existing }
`;

const HEARTBEAT_LOCK_SCRIPT = `
local existing = redis.call('GET', KEYS[1])
if not existing then
  return { 0, '' }
end

local parsed = cjson.decode(existing)
if parsed.deviceId ~= ARGV[1] then
  return { 0, existing }
end

parsed.expiresAt = ARGV[2]
local encoded = cjson.encode(parsed)
redis.call('SET', KEYS[1], encoded, 'XX', 'PX', ARGV[3])
return { 1, encoded }
`;

const RELEASE_LOCK_SCRIPT = `
local existing = redis.call('GET', KEYS[1])
if not existing then
  return 0
end

local parsed = cjson.decode(existing)
if parsed.deviceId ~= ARGV[1] then
  return 0
end

return redis.call('DEL', KEYS[1])
`;

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
export class ProfileLockService implements OnModuleDestroy {
  private readonly logger = new Logger(ProfileLockService.name);
  private readonly locks = new Map<string, StoredLock>();
  private readonly redisUrl?: string;
  private redis?: RedisClientType;
  private redisConnect?: Promise<RedisClientType | undefined>;

  constructor(config: ConfigService) {
    const configured = config.get<string>("REDIS_URL")?.trim();
    this.redisUrl = configured || undefined;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redis?.isOpen) await this.redis.quit();
  }

  private scope(ctx: UserContext): string {
    return ctx.teamPrefix || ctx.prefix || "self-hosted";
  }

  private key(ctx: UserContext, profileId: string): string {
    return `${this.scope(ctx)}:${profileId}`;
  }

  private redisKey(ctx: UserContext, profileId: string): string {
    return `${REDIS_KEY_PREFIX}${this.key(ctx, profileId)}`;
  }

  private prune(now = Date.now()): void {
    for (const [key, lock] of this.locks) {
      if (Date.parse(lock.expiresAt) <= now) this.locks.delete(key);
    }
  }

  private async redisClient(): Promise<RedisClientType | undefined> {
    if (!this.redisUrl) return undefined;
    if (this.redis?.isReady) return this.redis;
    if (this.redisConnect) return this.redisConnect;

    const client = createClient({ url: this.redisUrl });
    client.on("error", (error) => {
      this.logger.error(`Redis profile-lock error: ${error.message}`);
    });
    this.redisConnect = client
      .connect()
      .then(() => {
        this.redis = client;
        this.logger.log("Profile locks are stored in Redis");
        return client;
      })
      .catch((error: unknown) => {
        this.redisConnect = undefined;
        this.logger.error(
          `Unable to connect Redis for profile locks; using in-memory fallback: ${error instanceof Error ? error.message : String(error)}`,
        );
        return undefined;
      });
    return this.redisConnect;
  }

  private parseStoredLock(raw: string): StoredLock | undefined {
    try {
      const lock = JSON.parse(raw) as Partial<StoredLock>;
      if (
        typeof lock.profileId !== "string" ||
        typeof lock.deviceId !== "string" ||
        typeof lock.scope !== "string" ||
        typeof lock.expiresAt !== "string"
      ) {
        return undefined;
      }
      return lock as StoredLock;
    } catch {
      return undefined;
    }
  }

  async acquire(ctx: UserContext, profileId: string, deviceId: string) {
    const redis = await this.redisClient();
    if (redis) return this.acquireRedis(redis, ctx, profileId, deviceId);
    return this.acquireMemory(ctx, profileId, deviceId);
  }

  private async acquireRedis(
    redis: RedisClientType,
    ctx: UserContext,
    profileId: string,
    deviceId: string,
  ) {
    const now = new Date();
    const lock: StoredLock = {
      profileId,
      lockedBy: deviceId,
      lockedByEmail: "another device",
      lockedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + LOCK_TTL_MS).toISOString(),
      scope: this.scope(ctx),
      deviceId,
    };
    const reply = (await redis.eval(ACQUIRE_LOCK_SCRIPT, {
      keys: [this.redisKey(ctx, profileId)],
      arguments: [JSON.stringify(lock), deviceId, String(LOCK_TTL_MS)],
    })) as unknown as [number, string];
    const stored = this.parseStoredLock(reply[1]) || lock;
    return { success: Number(reply[0]) === 1, lock: this.publicLock(stored) };
  }

  private acquireMemory(ctx: UserContext, profileId: string, deviceId: string) {
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

  async heartbeat(ctx: UserContext, profileId: string, deviceId: string) {
    const redis = await this.redisClient();
    if (redis) return this.heartbeatRedis(redis, ctx, profileId, deviceId);
    return this.heartbeatMemory(ctx, profileId, deviceId);
  }

  private async heartbeatRedis(
    redis: RedisClientType,
    ctx: UserContext,
    profileId: string,
    deviceId: string,
  ) {
    const expiresAt = new Date(Date.now() + LOCK_TTL_MS).toISOString();
    const reply = (await redis.eval(HEARTBEAT_LOCK_SCRIPT, {
      keys: [this.redisKey(ctx, profileId)],
      arguments: [deviceId, expiresAt, String(LOCK_TTL_MS)],
    })) as unknown as [number, string];
    const lock = this.parseStoredLock(reply[1]);
    return lock
      ? { success: Number(reply[0]) === 1, lock: this.publicLock(lock) }
      : { success: false };
  }

  private heartbeatMemory(
    ctx: UserContext,
    profileId: string,
    deviceId: string,
  ) {
    this.prune();
    const lock = this.locks.get(this.key(ctx, profileId));
    if (!lock || lock.deviceId !== deviceId) return { success: false };
    lock.expiresAt = new Date(Date.now() + LOCK_TTL_MS).toISOString();
    return { success: true, lock: this.publicLock(lock) };
  }

  async release(
    ctx: UserContext,
    profileId: string,
    deviceId: string,
  ): Promise<void> {
    const redis = await this.redisClient();
    if (redis) {
      await redis.eval(RELEASE_LOCK_SCRIPT, {
        keys: [this.redisKey(ctx, profileId)],
        arguments: [deviceId],
      });
      return;
    }

    this.prune();
    const key = this.key(ctx, profileId);
    const lock = this.locks.get(key);
    if (lock?.deviceId === deviceId) this.locks.delete(key);
  }

  async list(ctx: UserContext): Promise<ProfileLock[]> {
    const redis = await this.redisClient();
    if (redis) {
      const keys: string[] = [];
      for await (const batch of redis.scanIterator({
        MATCH: `${REDIS_KEY_PREFIX}${this.scope(ctx)}:*`,
        COUNT: 100,
      })) {
        keys.push(...batch);
      }
      if (keys.length === 0) return [];
      return (await redis.mGet(keys))
        .flatMap((raw) => (raw ? [this.parseStoredLock(raw)] : []))
        .filter((lock): lock is StoredLock => lock !== undefined)
        .map((lock) => this.publicLock(lock));
    }

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
