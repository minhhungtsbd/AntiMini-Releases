import { ConfigService } from "@nestjs/config";
import { Test, type TestingModule } from "@nestjs/testing";
import { AppController } from "./app.controller.js";
import { AppService } from "./app.service.js";
import { DeviceRegistryService } from "./device-registry.service.js";
import { SyncService } from "./sync/sync.service.js";

describe("AppController", () => {
  let appController: AppController;
  let configGet: jest.Mock;

  beforeEach(async () => {
    configGet = jest.fn().mockReturnValue(undefined);
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: ConfigService,
          useValue: { get: configGet },
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

  afterEach(() => {
    jest.restoreAllMocks();
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

  describe("cloud sync subscription", () => {
    it("marks a non-expired CloudMini package as active", async () => {
      configGet.mockImplementation((key: string) =>
        key === "SYNC_JWT_PRIVATE_KEY" ? "configured" : undefined,
      );
      jest
        .spyOn(global, "fetch")
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            error: false,
            data: { email: "active@example.com", name: "Active user" },
          }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            error: false,
            data: {
              amount: 10,
              expired_at: "2026-08-02T09:10:29.548850Z",
              is_expired: false,
            },
          }),
        } as Response);

      const user = await appController.getMe({
        headers: {
          authorization: "Bearer cloudmini-api-key",
          "x-device-id": "device-1234567890",
        },
      } as never);

      expect(user.subscriptionStatus).toBe("active");
      expect(user.profileLimit).toBe(10);
    });
  });
});
