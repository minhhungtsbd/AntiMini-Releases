import { ConfigService } from "@nestjs/config";
import { Test, type TestingModule } from "@nestjs/testing";
import { AppController } from "./app.controller.js";
import { AppService } from "./app.service.js";
import { DeviceRegistryService } from "./device-registry.service.js";
import { SyncService } from "./sync/sync.service.js";

describe("AppController", () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(undefined) },
        },
        {
          provide: DeviceRegistryService,
          useValue: {
            register: jest
              .fn()
              .mockResolvedValue({ deviceOrdinal: 1, deviceCount: 1 }),
            unregister: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: SyncService,
          useValue: {
            checkS3Connectivity: jest.fn().mockResolvedValue(true),
          },
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe("root", () => {
    it("should return service name", () => {
      expect(appController.getHello()).toBe("AntiMini Sync Service");
    });
  });

  describe("health", () => {
    it("should return ok status", () => {
      expect(appController.getHealth()).toEqual({ status: "ok" });
    });
  });
});
