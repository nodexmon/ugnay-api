import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp, TestApp } from './e2e/test-app';

describe('AppController (e2e)', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('GET / returns Hello World!', () => {
    return request(testApp.app.getHttpServer() as App)
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });
});
