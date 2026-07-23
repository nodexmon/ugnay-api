import request from 'supertest';
import { App } from 'supertest/types';
import {
  Role,
  VerificationStatus,
  WorkerStatus,
} from '@/generated/prisma/enums';
import { createTestApp, TestApp } from './test-app';
import {
  resetDb,
  createBarangay,
  createWorker,
  createCustomer,
  createAdmin,
  createVerificationDoc,
} from './db';

describe('Worker verification (e2e)', () => {
  let testApp: TestApp;
  let barangayId: string;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  beforeEach(async () => {
    await resetDb(testApp.prisma);
    const barangay = await createBarangay(testApp.prisma);
    barangayId = barangay.id;
  });

  afterAll(async () => {
    await testApp.close();
  });

  const server = () => testApp.app.getHttpServer() as App;

  it('lists pending verifications', async () => {
    const { profile: workerProfile } = await createWorker(
      testApp.prisma,
      barangayId,
      { status: WorkerStatus.PENDING },
    );
    await createVerificationDoc(testApp.prisma, workerProfile.id);

    const admin = await createAdmin(testApp.prisma);
    const token = testApp.mintToken({ sub: admin.id, role: Role.ADMIN });

    const res = await request(server())
      .get('/admin/verifications')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toHaveLength(1);
  });

  it('approves a verification: doc APPROVED and worker VERIFIED', async () => {
    const { profile: workerProfile } = await createWorker(
      testApp.prisma,
      barangayId,
      { status: WorkerStatus.PENDING },
    );
    const doc = await createVerificationDoc(testApp.prisma, workerProfile.id);

    const admin = await createAdmin(testApp.prisma);
    const token = testApp.mintToken({ sub: admin.id, role: Role.ADMIN });

    await request(server())
      .patch(`/admin/verifications/${doc.id}/approve`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const updatedDoc = await testApp.prisma.verificationDoc.findUnique({
      where: { id: doc.id },
    });
    expect(updatedDoc?.status).toBe(VerificationStatus.APPROVED);

    const updatedWorker = await testApp.prisma.workerProfile.findUnique({
      where: { id: workerProfile.id },
    });
    expect(updatedWorker?.status).toBe(WorkerStatus.VERIFIED);
  });

  it('first rejection sets worker to REJECTED and doc REJECTED', async () => {
    const { profile: workerProfile } = await createWorker(
      testApp.prisma,
      barangayId,
      { status: WorkerStatus.PENDING },
    );
    const doc = await createVerificationDoc(testApp.prisma, workerProfile.id);

    const admin = await createAdmin(testApp.prisma);
    const token = testApp.mintToken({ sub: admin.id, role: Role.ADMIN });

    await request(server())
      .patch(`/admin/verifications/${doc.id}/reject`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'ID not clear' })
      .expect(200);

    const updatedWorker = await testApp.prisma.workerProfile.findUnique({
      where: { id: workerProfile.id },
    });
    expect(updatedWorker?.status).toBe(WorkerStatus.REJECTED);
    expect(updatedWorker?.isOnline).toBe(false);
  });

  it('second rejection suspends the worker', async () => {
    const { profile: workerProfile } = await createWorker(
      testApp.prisma,
      barangayId,
      { status: WorkerStatus.PENDING },
    );
    const doc1 = await createVerificationDoc(testApp.prisma, workerProfile.id, {
      status: VerificationStatus.REJECTED,
    });
    const doc2 = await createVerificationDoc(testApp.prisma, workerProfile.id);

    const admin = await createAdmin(testApp.prisma);
    const token = testApp.mintToken({ sub: admin.id, role: Role.ADMIN });

    await request(server())
      .patch(`/admin/verifications/${doc2.id}/reject`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Repeated invalid ID' })
      .expect(200);

    const updatedWorker = await testApp.prisma.workerProfile.findUnique({
      where: { id: workerProfile.id },
    });
    expect(updatedWorker?.status).toBe(WorkerStatus.SUSPENDED);
  });

  it('returns 409 when trying to approve an already-reviewed doc', async () => {
    const { profile: workerProfile } = await createWorker(
      testApp.prisma,
      barangayId,
      { status: WorkerStatus.PENDING },
    );
    const doc = await createVerificationDoc(testApp.prisma, workerProfile.id, {
      status: VerificationStatus.APPROVED,
    });

    const admin = await createAdmin(testApp.prisma);
    const token = testApp.mintToken({ sub: admin.id, role: Role.ADMIN });

    await request(server())
      .patch(`/admin/verifications/${doc.id}/approve`)
      .set('Authorization', `Bearer ${token}`)
      .expect(409);
  });

  it('GET /workers/verification returns the latest doc to the worker (route not shadowed by :id)', async () => {
    const { user, profile } = await createWorker(testApp.prisma, barangayId, {
      status: WorkerStatus.PENDING,
    });
    await createVerificationDoc(testApp.prisma, profile.id);
    const token = testApp.mintToken({ sub: user.id, role: Role.WORKER });

    const res = await request(server())
      .get('/workers/verification')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.workerId).toBe(profile.id);
  });

  it('GET /workers/credentials returns the worker own credentials with status and rejection reason', async () => {
    const { user, profile } = await createWorker(testApp.prisma, barangayId);
    await testApp.prisma.workerCredential.create({
      data: {
        workerId: profile.id,
        type: 'LICENSE',
        fileUrl: `uploads/credentials/${profile.id}/license-e2e.pdf`,
        status: VerificationStatus.REJECTED,
        rejectionReason: 'Blurry scan.',
      },
    });
    const token = testApp.mintToken({ sub: user.id, role: Role.WORKER });

    const res = await request(server())
      .get('/workers/credentials')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toHaveLength(1);
    expect(res.body[0].status).toBe(VerificationStatus.REJECTED);
    expect(res.body[0].rejectionReason).toBe('Blurry scan.');
  });

  it('GET /workers/credentials returns 403 for a customer', async () => {
    const { user } = await createCustomer(testApp.prisma);
    const token = testApp.mintToken({ sub: user.id, role: Role.CUSTOMER });

    await request(server())
      .get('/workers/credentials')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('returns 409 when trying to approve a doc for an already-verified worker', async () => {
    const { profile: workerProfile } = await createWorker(
      testApp.prisma,
      barangayId,
      { status: WorkerStatus.VERIFIED },
    );
    const doc = await createVerificationDoc(testApp.prisma, workerProfile.id);

    const admin = await createAdmin(testApp.prisma);
    const token = testApp.mintToken({ sub: admin.id, role: Role.ADMIN });

    await request(server())
      .patch(`/admin/verifications/${doc.id}/approve`)
      .set('Authorization', `Bearer ${token}`)
      .expect(409);
  });
});
