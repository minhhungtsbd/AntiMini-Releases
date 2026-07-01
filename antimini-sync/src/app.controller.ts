import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Post,
} from "@nestjs/common";
import { AppService } from "./app.service.js";
import { SyncService } from "./sync/sync.service.js";

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly syncService: SyncService,
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
  getMe(): any {
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

  @Post("api/auth/sync-token")
  getSyncToken(): any {
    return {
      syncToken: "antimini-secret-sync-token-2026",
    };
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
