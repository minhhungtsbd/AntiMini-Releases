import {
  Controller,
  ForbiddenException,
  Get,
  HttpException,
  HttpStatus,
  Post,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request } from "express";
import * as jwt from "jsonwebtoken";
import { AppService } from "./app.service.js";
import { SyncService } from "./sync/sync.service.js";

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly syncService: SyncService,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get("health")
  getHealth(): { status: string } {
    return { status: "ok" };
  }

  @Get("readyz")
  async getReadiness(): Promise<{ status: string; s3: boolean }> {
    const s3Ready = await this.syncService.checkS3Connectivity();
    if (!s3Ready) {
      throw new HttpException(
        { status: "not ready", s3: false },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return { status: "ready", s3: true };
  }

  @Get("wayfern.json")
  getWayfernJson(): any {
    return {
      version: "149.0.7827.114",
      downloads: {
        "linux-x64":
          "https://download.wayfern.com/wayfern-149.0.7827.114-linux-x64.tar.xz",
        "linux-arm64": null,
        "macos-x64": null,
        "macos-arm64":
          "https://download.wayfern.com/wayfern_149.0.7827.114-1.1_macos.dmg",
        "windows-x64":
          "https://download.wayfern.com/wayfern-149.0.7827.114_windows_x64.zip",
        "windows-arm64": null,
      },
    };
  }

  @Post("api/auth/device-code/challenge")
  getChallenge(): any {
    return {
      prefix: "abc",
      difficulty: 1,
      challengeId: "mock-challenge-id",
    };
  }

  @Post("api/auth/device-code/exchange")
  exchangeCode(): any {
    return {
      accessToken: "mock-access-token",
      refreshToken: "mock-refresh-token",
      user: {
        id: "mock-user-id",
        email: "test@cloudmini.net",
        plan: "pro",
        subscriptionStatus: "active",
        planPeriod: "lifetime",
        profileLimit: 9999,
        cloudProfilesUsed: 0,
        proxyBandwidthLimitMb: 1000000,
        proxyBandwidthUsedMb: 0,
        proxyBandwidthExtraMb: 0,
      },
    };
  }

  @Post("api/auth/token/refresh")
  refreshToken(): any {
    return {
      accessToken: "mock-access-token",
      refreshToken: "mock-refresh-token",
    };
  }

  @Get("api/auth/me")
  async getMe(@Req() req: Request): Promise<any> {
    const privateKeyEnv = this.configService.get<string>("SYNC_JWT_PRIVATE_KEY");
    if (!privateKeyEnv) {
      // Self-hosted/static mode: return the static mock user data
      return {
        id: "mock-user-id",
        email: "test@cloudmini.net",
        plan: "pro",
        subscriptionStatus: "active",
        planPeriod: "lifetime",
        profileLimit: 9999,
        cloudProfilesUsed: 0,
        proxyBandwidthLimitMb: 1000000,
        proxyBandwidthUsedMb: 0,
        proxyBandwidthExtraMb: 0,
      };
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing or invalid authorization header");
    }
    const apiKey = authHeader.substring(7);

    try {
      // 1. Fetch account info
      const accountUrl = "https://client.cloudmini.net/api/v2/account";
      const accountRes = await fetch(accountUrl, {
        headers: {
          "Accept": "application/json",
          "Authorization": `Token ${apiKey}`,
        },
      });

      if (!accountRes.ok) {
        throw new UnauthorizedException(`Cloudmini API returned status ${accountRes.status}`);
      }

      const accountBody = await accountRes.json() as any;
      if (accountBody.error || !accountBody.data) {
        throw new UnauthorizedException(accountBody.msg || "Invalid API key");
      }

      const accountData = accountBody.data;

      // 2. Fetch antidetect sync package status
      const antidetectUrl = "https://client.cloudmini.net/api/v2/antidetect";
      const antidetectRes = await fetch(antidetectUrl, {
        headers: {
          "Accept": "application/json",
          "Authorization": `Token ${apiKey}`,
        },
      });

      let profileLimit = 5; // Default trial limit if not active/purchased
      let planName = "Free Trial";
      let status = "active";

      if (antidetectRes.ok) {
        const antidetectBody = await antidetectRes.json() as any;
        if (!antidetectBody.error && antidetectBody.data) {
          const antidetectData = antidetectBody.data;
          if (antidetectData.is_expired) {
            status = "expired";
            planName = `Cloud Sync (Expired: ${antidetectData.expired_at})`;
          } else {
            profileLimit = antidetectData.amount || 5;
            planName = `Cloud Sync (Expires: ${antidetectData.expired_at})`;
          }
        }
      }

      return {
        id: accountData.email,
        email: accountData.email,
        plan: planName,
        subscriptionStatus: status,
        planPeriod: "monthly",
        profileLimit: profileLimit,
        cloudProfilesUsed: 0,
        proxyBandwidthLimitMb: 1000000,
        proxyBandwidthUsedMb: 0,
        proxyBandwidthExtraMb: 0,
        teamId: null,
        teamName: accountData.name,
        teamRole: null,
        deviceOrdinal: 1,
        deviceCount: 1,
        isPrimaryDevice: true,
      };
    } catch (e) {
      if (e instanceof HttpException) {
        throw e;
      }
      throw new UnauthorizedException(`Authentication failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  @Post("api/auth/sync-token")
  async getSyncToken(@Req() req: Request): Promise<any> {
    const appSecret = this.configService.get<string>("APP_SECRET") || "antimini-app-secret-key-2026-secure";
    const clientSecret = req.headers["x-app-secret"];
    if (!clientSecret || clientSecret !== appSecret) {
      throw new UnauthorizedException("Invalid application secret");
    }

    const privateKeyEnv = this.configService.get<string>("SYNC_JWT_PRIVATE_KEY");
    if (!privateKeyEnv) {
      // Self-hosted/static mode: return the static SYNC_TOKEN
      return {
        syncToken: this.configService.get<string>("SYNC_TOKEN") || "antimini-secret-sync-token-2026",
      };
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing or invalid authorization header");
    }
    const apiKey = authHeader.substring(7);

    try {
      // 1. Fetch account info
      const accountUrl = "https://client.cloudmini.net/api/v2/account";
      const accountRes = await fetch(accountUrl, {
        headers: {
          "Accept": "application/json",
          "Authorization": `Token ${apiKey}`,
        },
      });

      if (!accountRes.ok) {
        throw new UnauthorizedException(`Cloudmini API returned status ${accountRes.status}`);
      }

      const accountBody = await accountRes.json() as any;
      if (accountBody.error || !accountBody.data) {
        throw new UnauthorizedException(accountBody.msg || "Invalid API key");
      }

      const accountData = accountBody.data;

      // 2. Fetch antidetect sync package status
      const antidetectUrl = "https://client.cloudmini.net/api/v2/antidetect";
      const antidetectRes = await fetch(antidetectUrl, {
        headers: {
          "Accept": "application/json",
          "Authorization": `Token ${apiKey}`,
        },
      });

      if (!antidetectRes.ok) {
        throw new ForbiddenException(`Failed to check Cloud Sync subscription`);
      }

      const antidetectBody = await antidetectRes.json() as any;
      if (antidetectBody.error || !antidetectBody.data) {
        throw new ForbiddenException("Account does not have a Cloud Sync subscription");
      }

      const antidetectData = antidetectBody.data;
      if (antidetectData.is_expired) {
        throw new ForbiddenException("Your Cloud Sync subscription has expired");
      }

      const profileLimit = antidetectData.amount || 5;

      // Set expiration epoch for JWT (based on expired_at or 30 days maximum, whichever is earlier)
      const expirationDate = new Date(antidetectData.expired_at);
      const expirationEpoch = Math.floor(expirationDate.getTime() / 1000);
      const maxExpiry = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60; // 30 days max
      const exp = Math.min(expirationEpoch, maxExpiry);

      const privateKey = privateKeyEnv.replace(/\\n/g, "\n");
      const sub = accountData.email.toLowerCase().replace(/[^a-zA-Z0-9.@_-]/g, "");
      const payload = {
        sub,
        prefix: `users/${sub}/`,
        profileLimit: profileLimit,
        exp: exp,
      };

      const token = jwt.sign(payload, privateKey, { algorithm: "RS256" });
      return { syncToken: token };
    } catch (e) {
      if (e instanceof HttpException) {
        throw e;
      }
      throw new UnauthorizedException(`Authentication failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  @Post("api/auth/logout")
  logout(): any {
    return { success: true };
  }

  @Get("api/proxy/config")
  getProxyConfig(): any {
    return {
      host: "127.0.0.1",
      port: 1080,
      username: null,
      password: null,
      protocol: "socks5",
      bandwidthLimitMb: 1000000,
      bandwidthUsedMb: 0,
    };
  }

  @Post("api/auth/sync-profile-usage")
  syncProfileUsage(): any {
    return { success: true };
  }

  @Get("api/proxy/locations/countries")
  getCountries(): any {
    return [
      { code: "US", name: "United States" },
      { code: "VN", name: "Vietnam" },
    ];
  }

  @Get("api/proxy/locations/regions")
  getRegions(): any {
    return [{ code: "CA", name: "California" }];
  }

  @Get("api/proxy/locations/cities")
  getCities(): any {
    return [{ code: "LA", name: "Los Angeles" }];
  }

  @Get("api/proxy/locations/isps")
  getIsps(): any {
    return [{ code: "comcast", name: "Comcast" }];
  }

  @Post("api/auth/wayfern-start")
  wayfernStart(): any {
    return {
      token: "mock-wayfern-token",
      expiresIn: 3600,
    };
  }

  @Get("api/proxy/usage")
  getProxyUsage(): any {
    return {
      usedMb: 0,
      limitMb: 1000000,
      remainingMb: 1000000,
      recurringLimitMb: 1000000,
      extraLimitMb: 0,
    };
  }
}
