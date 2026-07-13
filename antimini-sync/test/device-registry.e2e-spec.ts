import { ConfigService } from "@nestjs/config";
import { DeviceRegistryService } from "../src/device-registry.service.js";

describe("DeviceRegistryService", () => {
  const config = { get: () => undefined } as unknown as ConfigService;

  it("counts distinct devices for the same account", async () => {
    const registry = new DeviceRegistryService(config);

    await expect(
      registry.register("user@example.com", "device-000000000001"),
    ).resolves.toEqual({ deviceOrdinal: 1, deviceCount: 1 });
    await expect(
      registry.register("USER@example.com", "device-000000000002"),
    ).resolves.toEqual({ deviceOrdinal: 2, deviceCount: 2 });
    await expect(
      registry.register("user@example.com", "device-000000000001"),
    ).resolves.toEqual({ deviceOrdinal: 1, deviceCount: 2 });
  });

  it("removes a signed-out device", async () => {
    const registry = new DeviceRegistryService(config);
    await registry.register("user@example.com", "device-000000000001");
    await registry.register("user@example.com", "device-000000000002");

    await registry.unregister("device-000000000001");

    await expect(
      registry.register("user@example.com", "device-000000000002"),
    ).resolves.toEqual({ deviceOrdinal: 1, deviceCount: 1 });
  });
});
