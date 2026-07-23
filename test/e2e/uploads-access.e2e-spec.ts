import request from 'supertest';
import { App } from 'supertest/types';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { Role } from '@/generated/prisma/enums';
import { createTestApp, TestApp } from './test-app';
import {
  resetDb,
  createBarangay,
  createWorker,
  createCustomer,
  createAdmin,
} from './db';

const uploadRoot = join(process.cwd(), process.env.UPLOAD_DIR ?? 'uploads');
const AVATAR_FILE = 'e2e-avatar.jpg';

describe('Uploads access control (e2e)', () => {
  let testApp: TestApp;
  let barangayId: string;
  let ownerProfileId: string;
  let ownerToken: string;
  let otherWorkerToken: string;
  let customerToken: string;
  let adminToken: string;
  let verificationPath: string;
  let credentialPath: string;

  const createdDirs: string[] = [];

  beforeAll(async () => {
    testApp = await createTestApp();

    mkdirSync(join(uploadRoot, 'avatars'), { recursive: true });
    writeFileSync(join(uploadRoot, 'avatars', AVATAR_FILE), 'fake-image');
  });

  beforeEach(async () => {
    await resetDb(testApp.prisma);
    const barangay = await createBarangay(testApp.prisma);
    barangayId = barangay.id;

    const owner = await createWorker(testApp.prisma, barangayId);
    const other = await createWorker(testApp.prisma, barangayId);
    const customer = await createCustomer(testApp.prisma);
    const admin = await createAdmin(testApp.prisma);

    ownerProfileId = owner.profile.id;
    ownerToken = testApp.mintToken({ sub: owner.user.id, role: Role.WORKER });
    otherWorkerToken = testApp.mintToken({
      sub: other.user.id,
      role: Role.WORKER,
    });
    customerToken = testApp.mintToken({
      sub: customer.user.id,
      role: Role.CUSTOMER,
    });
    adminToken = testApp.mintToken({ sub: admin.id, role: Role.ADMIN });

    const verificationDir = join(uploadRoot, 'verification', ownerProfileId);
    const credentialDir = join(uploadRoot, 'credentials', ownerProfileId);
    mkdirSync(verificationDir, { recursive: true });
    mkdirSync(credentialDir, { recursive: true });
    writeFileSync(join(verificationDir, 'idPhoto-e2e.jpg'), 'fake-id');
    writeFileSync(join(credentialDir, 'license-e2e.pdf'), 'fake-license');
    createdDirs.push(verificationDir, credentialDir);

    verificationPath = `/uploads/verification/${ownerProfileId}/idPhoto-e2e.jpg`;
    credentialPath = `/uploads/credentials/${ownerProfileId}/license-e2e.pdf`;
  });

  afterAll(async () => {
    rmSync(join(uploadRoot, 'avatars', AVATAR_FILE), { force: true });
    for (const dir of createdDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
    await testApp.close();
  });

  const server = () => testApp.app.getHttpServer() as App;

  describe('avatars', () => {
    it('serves an avatar without authentication', async () => {
      await request(server())
        .get(`/uploads/avatars/${AVATAR_FILE}`)
        .expect(200);
    });

    it('returns 404 for a traversal attempt out of the avatars directory', async () => {
      await request(server())
        .get(
          `/uploads/avatars/..%2Fverification%2F${ownerProfileId}%2FidPhoto-e2e.jpg`,
        )
        .expect(404);
    });
  });

  describe('verification files', () => {
    it('returns 401 without a token', async () => {
      await request(server()).get(verificationPath).expect(401);
    });

    it('returns 403 for a customer', async () => {
      await request(server())
        .get(verificationPath)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(403);
    });

    it('returns 403 for a non-owning worker', async () => {
      await request(server())
        .get(verificationPath)
        .set('Authorization', `Bearer ${otherWorkerToken}`)
        .expect(403);
    });

    it('serves the file to the owning worker', async () => {
      await request(server())
        .get(verificationPath)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);
    });

    it('serves the file to an admin', async () => {
      await request(server())
        .get(verificationPath)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });
  });

  describe('credential files', () => {
    it('returns 401 without a token', async () => {
      await request(server()).get(credentialPath).expect(401);
    });

    it('returns 403 for a non-owning worker', async () => {
      await request(server())
        .get(credentialPath)
        .set('Authorization', `Bearer ${otherWorkerToken}`)
        .expect(403);
    });

    it('serves the file to the owning worker', async () => {
      await request(server())
        .get(credentialPath)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);
    });

    it('serves the file to an admin', async () => {
      await request(server())
        .get(credentialPath)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });
  });
});
