import { INestApplication } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { App } from "supertest/types";
import { ProfileLockModule } from "../src/profile-lock/profile-lock.module.js";
import { configureTestEnv, TEST_SYNC_TOKEN } from "./test-env.js";

describe("Profile locks (e2e)", () => {
  let app: INestApplication<App>;
  const auth = { Authorization: `Bearer ${TEST_SYNC_TOKEN}` };
  const firstDevice = "device-11111111-1111-1111-1111-111111111111";
  const secondDevice = "device-22222222-2222-2222-2222-222222222222";

  beforeAll(async () => {
    configureTestEnv();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), ProfileLockModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.listen(0);
  });

  afterAll(async () => {
    await app.close();
  });

  it("allows one device, rejects another, then permits it after release", async () => {
    const profileId = "profile-lock-e2e";
    await request(app.getHttpServer())
      .post(`/v1/profile-locks/${profileId}`)
      .set(auth)
      .send({ deviceId: firstDevice })
      .expect(200)
      .expect((response) => expect(response.body.success).toBe(true));

    await request(app.getHttpServer())
      .post(`/v1/profile-locks/${profileId}`)
      .set(auth)
      .send({ deviceId: secondDevice })
      .expect(200)
      .expect((response) => {
        expect(response.body.success).toBe(false);
        expect(response.body.lockedBy).toBe(firstDevice);
      });

    await request(app.getHttpServer())
      .delete(`/v1/profile-locks/${profileId}`)
      .set(auth)
      .send({ deviceId: firstDevice })
      .expect(204);

    await request(app.getHttpServer())
      .post(`/v1/profile-locks/${profileId}/heartbeat`)
      .set(auth)
      .send({ deviceId: firstDevice })
      .expect(200)
      .expect((response) => expect(response.body.success).toBe(false));

    await request(app.getHttpServer())
      .post(`/v1/profile-locks/${profileId}`)
      .set(auth)
      .send({ deviceId: secondDevice })
      .expect(200)
      .expect((response) => expect(response.body.success).toBe(true));
  });
});
