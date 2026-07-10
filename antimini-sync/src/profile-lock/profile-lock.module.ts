import { Module } from "@nestjs/common";
import { ProfileLockController } from "./profile-lock.controller.js";
import { ProfileLockService } from "./profile-lock.service.js";

@Module({
  controllers: [ProfileLockController],
  providers: [ProfileLockService],
})
export class ProfileLockModule {}
