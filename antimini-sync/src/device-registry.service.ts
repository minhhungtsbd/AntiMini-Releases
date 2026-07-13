import { createHash } from "node:crypto";
import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient, type RedisClientType } from "redis";

const ACTIVE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const DEVICE_KEY_TTL_SECONDS = Math.ceil(ACTIVE_WINDOW_MS / 1000);
const DEVICE_KEY_PREFIX = "antimini:devices:";
const DEVICE_ORDER_PREFIX = "antimini:device-order:";
const DEVICE_OWNER_PREFIX = "antimini:device-owner:";

export interface DeviceRegistration {
  deviceOrdinal: number;
  deviceCount: number;
}

@Injectable()
export class DeviceRegistryService implements OnModuleDestroy {
  private readonly logger = new Logger(DeviceRegistryService.name);
  private readonly memory = new Map<string, Map<string, number>>();
  private redis?: RedisClientType;
  private redisUnavailable = false;

  constructor(private readonly config: ConfigService) {}

  private userKey(email: string): string {
    return createHash("sha256")
      .update(email.trim().toLowerCase())
      .digest("hex");
  }

  private async getRedis(): Promise<RedisClientType | undefined> {
    if (this.redisUnavailable) return undefined;
    if (this.redis?.isReady) return this.redis;

    const url = this.config.get<string>("REDIS_URL");
    if (!url) return undefined;

    try {
      const client = createClient({ url });
      client.on("error", (error) => {
        this.logger.warn(`Redis device registry error: ${error.message}`);
      });
      await client.connect();
      this.redis = client as RedisClientType;
      return this.redis;
    } catch (error) {
      this.redisUnavailable = true;
      this.logger.warn(
        `Redis device registry unavailable; using memory fallback: ${String(error)}`,
      );
      return undefined;
    }
  }

  async register(email: string, deviceId: string): Promise<DeviceRegistration> {
    const userKey = this.userKey(email);
    const redis = await this.getRedis();
    if (redis) return this.registerRedis(redis, userKey, deviceId);
    return this.registerMemory(userKey, deviceId);
  }

  private async registerRedis(
    redis: RedisClientType,
    userKey: string,
    deviceId: string,
  ): Promise<DeviceRegistration> {
    const now = Date.now();
    const devicesKey = `${DEVICE_KEY_PREFIX}${userKey}`;
    const orderKey = `${DEVICE_ORDER_PREFIX}${userKey}`;
    const ownerKey = `${DEVICE_OWNER_PREFIX}${deviceId}`;
    const previousOwner = await redis.get(ownerKey);

    if (previousOwner && previousOwner !== userKey) {
      await redis.sendCommand([
        "ZREM",
        `${DEVICE_KEY_PREFIX}${previousOwner}`,
        deviceId,
      ]);
      await redis.sendCommand([
        "ZREM",
        `${DEVICE_ORDER_PREFIX}${previousOwner}`,
        deviceId,
      ]);
    }

    const expired = (await redis.sendCommand([
      "ZRANGEBYSCORE",
      devicesKey,
      "0",
      String(now - ACTIVE_WINDOW_MS),
    ])) as string[];
    await redis.sendCommand([
      "ZREMRANGEBYSCORE",
      devicesKey,
      "0",
      String(now - ACTIVE_WINDOW_MS),
    ]);
    if (expired.length > 0) {
      await redis.sendCommand(["ZREM", orderKey, ...expired]);
    }
    await redis.sendCommand(["ZADD", devicesKey, String(now), deviceId]);
    await redis.sendCommand(["ZADD", orderKey, "NX", String(now), deviceId]);
    await redis.expire(devicesKey, DEVICE_KEY_TTL_SECONDS);
    await redis.expire(orderKey, DEVICE_KEY_TTL_SECONDS);
    await redis.set(ownerKey, userKey, { EX: DEVICE_KEY_TTL_SECONDS });

    const devices = (await redis.sendCommand([
      "ZRANGE",
      orderKey,
      "0",
      "-1",
    ])) as string[];
    const ordinal = devices.indexOf(deviceId) + 1;
    return {
      deviceOrdinal: Math.max(ordinal, 1),
      deviceCount: Math.max(devices.length, 1),
    };
  }

  private registerMemory(
    userKey: string,
    deviceId: string,
  ): DeviceRegistration {
    const now = Date.now();
    const devices = this.memory.get(userKey) ?? new Map<string, number>();
    for (const [id, lastSeen] of devices) {
      if (lastSeen <= now - ACTIVE_WINDOW_MS) devices.delete(id);
    }
    devices.set(deviceId, now);
    this.memory.set(userKey, devices);

    const ordered = [...devices.keys()];
    return {
      deviceOrdinal: ordered.indexOf(deviceId) + 1,
      deviceCount: ordered.length,
    };
  }

  async unregister(deviceId: string): Promise<void> {
    const redis = await this.getRedis();
    if (redis) {
      const ownerKey = `${DEVICE_OWNER_PREFIX}${deviceId}`;
      const userKey = await redis.get(ownerKey);
      if (userKey) {
        await redis.sendCommand([
          "ZREM",
          `${DEVICE_KEY_PREFIX}${userKey}`,
          deviceId,
        ]);
        await redis.sendCommand([
          "ZREM",
          `${DEVICE_ORDER_PREFIX}${userKey}`,
          deviceId,
        ]);
      }
      await redis.del(ownerKey);
      return;
    }

    for (const devices of this.memory.values()) devices.delete(deviceId);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redis?.isOpen) await this.redis.quit();
  }
}
