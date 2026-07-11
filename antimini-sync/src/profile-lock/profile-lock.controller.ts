import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { AuthGuard } from "../auth/auth.guard.js";
import type { UserContext } from "../auth/user-context.interface.js";
import { ProfileLockService } from "./profile-lock.service.js";

interface DeviceRequest {
  deviceId?: string;
}

@Controller("v1/profile-locks")
@UseGuards(AuthGuard)
export class ProfileLockController {
  constructor(private readonly locks: ProfileLockService) {}

  private context(req: Request): UserContext {
    return (req as unknown as Record<string, unknown>).user as UserContext;
  }

  private deviceId(body: DeviceRequest): string {
    if (!body.deviceId || !/^[a-zA-Z0-9-]{16,128}$/.test(body.deviceId)) {
      throw new BadRequestException("Invalid device ID");
    }
    return body.deviceId;
  }

  @Get()
  async list(@Req() req: Request) {
    return this.locks.list(this.context(req));
  }

  @Post(":profileId")
  @HttpCode(200)
  async acquire(
    @Param("profileId") profileId: string,
    @Body() body: DeviceRequest,
    @Req() req: Request,
  ) {
    const result = await this.locks.acquire(
      this.context(req),
      profileId,
      this.deviceId(body),
    );
    return { success: result.success, ...result.lock };
  }

  @Post(":profileId/heartbeat")
  @HttpCode(200)
  async heartbeat(
    @Param("profileId") profileId: string,
    @Body() body: DeviceRequest,
    @Req() req: Request,
  ) {
    const result = await this.locks.heartbeat(
      this.context(req),
      profileId,
      this.deviceId(body),
    );
    return { success: result.success, ...result.lock };
  }

  @Delete(":profileId")
  @HttpCode(204)
  async release(
    @Param("profileId") profileId: string,
    @Body() body: DeviceRequest,
    @Req() req: Request,
  ) {
    await this.locks.release(this.context(req), profileId, this.deviceId(body));
  }
}
