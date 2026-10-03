import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { App } from 'supertest/types.js';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer()).get('/').expect(200).expect({
      status: 'ok',
      service: 'chat-backend',
    });
  });

  it('creates users and retrieves direct-message history', async () => {
    const testId = Date.now();
    const firstUser = await request(app.getHttpServer())
      .post('/users')
      .send({
        email: `alice-${testId}@example.com`,
        name: 'Alice',
        password: 'alice-password',
      })
      .expect(201);

    const secondUser = await request(app.getHttpServer())
      .post('/users')
      .send({
        email: `bob-${testId}@example.com`,
        name: 'Bob',
        password: 'bob-password',
      })
      .expect(201);

    expect(firstUser.body.id).toEqual(expect.any(String));
    expect(secondUser.body.id).toEqual(expect.any(String));

    const tokens = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: `alice-${testId}@example.com`,
        password: 'alice-password',
      })
      .expect(200);

    expect(tokens.body.token).toEqual(expect.any(String));
    expect(tokens.body.refreshToken).toBeUndefined();

    const users = await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `${tokens.body.token}`)
      .expect(200);
    expect(users.body.length).toBeGreaterThanOrEqual(2);

    await request(app.getHttpServer())
      .post('/users/login')
      .send({
        email: `alice-${testId}@example.com`,
        password: 'alice-password',
      })
      .expect(200)
      .expect((res) => {
        expect(res.body.id).toBe(firstUser.body.id);
        expect(res.body.passwordHash).toBeUndefined();
      });

    await request(app.getHttpServer())
      .post('/users/login')
      .send({
        email: `alice-${testId}@example.com`,
        password: 'wrong-password',
      })
      .expect(401);

    const history = await request(app.getHttpServer())
      .get(
        `/chat/messages?userA=${firstUser.body.id}&userB=${secondUser.body.id}`,
      )
      .set('Authorization', `Bearer ${tokens.body.token}`)
      .expect(200);

    expect(history.body).toEqual([]);
  });

  afterEach(async () => {
    await app.close();
  });
});
