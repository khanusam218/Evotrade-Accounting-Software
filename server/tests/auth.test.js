const request = require('supertest');
const app = require('../src/app');

describe('Authentication Endpoints', () => {
  const testUser = {
    id: 'testuser_' + Date.now(),
    password: 'password123',
    confirmPassword: 'password123'
  };

  describe('POST /api/auth/register', () => {
    it('should register a new user with valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send(testUser);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('token');
      expect(res.body).toHaveProperty('userId', testUser.id);
      expect(res.body.token).toBeTruthy();
    });

    it('should reject registration with short ID (< 3 chars)', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          id: 'ab',
          password: 'password123',
          confirmPassword: 'password123'
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('should reject registration with short password (< 6 chars)', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          id: 'validuser',
          password: 'pass',
          confirmPassword: 'pass'
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('should reject registration with mismatched passwords', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          id: 'validuser',
          password: 'password123',
          confirmPassword: 'password456'
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('should reject duplicate user ID', async () => {
      // First registration
      await request(app)
        .post('/api/auth/register')
        .send(testUser);

      // Try duplicate
      const res = await request(app)
        .post('/api/auth/register')
        .send(testUser);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('already exists');
    });

    it('should reject registration with missing ID', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          password: 'password123',
          confirmPassword: 'password123'
        });

      expect(res.status).toBe(400);
    });

    it('should reject registration with missing password', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          id: 'validuser',
          confirmPassword: 'password123'
        });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      // Use the same testUser registered at the top of this describe block
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          id: testUser.id,
          password: testUser.password
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body).toHaveProperty('userId', testUser.id);
    });

    it('should reject login with wrong password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          id: 'admin',
          password: 'wrongpassword'
        });

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error');
    });

    it('should reject login with non-existent user', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          id: 'nonexistentuser',
          password: 'password123'
        });

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error');
    });

    it('should reject login with missing ID', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          password: 'password123'
        });

      expect(res.status).toBe(400);
    });

    it('should reject login with missing password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          id: 'admin'
        });

      expect(res.status).toBe(400);
    });

    it('should return valid JWT token format', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          id: testUser.id,
          password: testUser.password
        });

      expect(res.status).toBe(200);
      const token = res.body.token;
      // JWT format: xxx.xxx.xxx
      expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    });
  });
});

describe('Protected Endpoints', () => {
  let validToken;
  const protectedTestUser = { id: 'prot_' + Date.now(), password: 'password123', confirmPassword: 'password123' };

  beforeAll(async () => {
    // Register a fresh user so the test is self-contained
    await request(app).post('/api/auth/register').send(protectedTestUser);
    const res = await request(app)
      .post('/api/auth/login')
      .send({ id: protectedTestUser.id, password: protectedTestUser.password });
    validToken = res.body.token;
  });

  describe('GET /api/chart-of-accounts', () => {
    it('should return 401 without token', async () => {
      const res = await request(app)
        .get('/api/chart-of-accounts');

      expect(res.status).toBe(401);
    });

    it('should return 401 with invalid token', async () => {
      const res = await request(app)
        .get('/api/chart-of-accounts')
        .set('Authorization', 'Bearer invalid_token');

      expect(res.status).toBe(401);
    });

    it('should return 200 with valid token', async () => {
      const res = await request(app)
        .get('/api/chart-of-accounts')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should return array of accounts', async () => {
      const res = await request(app)
        .get('/api/chart-of-accounts')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThan(0);

      // Check account structure
      if (res.body.length > 0) {
        const account = res.body[0];
        expect(account).toHaveProperty('id');
        expect(account).toHaveProperty('code');
        expect(account).toHaveProperty('name');
      }
    });
  });

  describe('GET /api/expenses', () => {
    it('should return 401 without token', async () => {
      const res = await request(app)
        .get('/api/expenses');

      expect(res.status).toBe(401);
    });

    it('should return 200 with valid token', async () => {
      const res = await request(app)
        .get('/api/expenses')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /api/health', () => {
    it('should be accessible without token', async () => {
      const res = await request(app)
        .get('/api/health');

      expect(res.status).toBe(200);
    });
  });
});

describe('Rate Limiting', () => {
  it('should allow requests under rate limit', async () => {
    const promises = [];

    // Make 5 requests (well under any limit) — use invalid creds, we just want to confirm no 429
    for (let i = 0; i < 5; i++) {
      promises.push(
        request(app)
          .post('/api/auth/login')
          .send({
            id: 'nonexistent_rl_test',
            password: 'wrongpassword'
          })
      );
    }

    const results = await Promise.all(promises);

    // None should be rate-limited (429) — 401 is fine for wrong credentials
    results.forEach(res => {
      expect(res.status).not.toBe(429);
    });
  });
});

describe('Error Handling', () => {
  it('should not leak internal error messages', async () => {
    // Unknown routes return 401 because auth middleware runs before routing
    const res = await request(app)
      .get('/api/nonexistent-endpoint');

    expect([401, 404]).toContain(res.status);
    expect(res.body.toString()).not.toMatch(/\/var\/|\/home\/|\.js|stack/i);
  });

  it('should sanitize error responses', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        id: 'admin',
        password: 'wrong'
      });

    expect(res.status).toBe(401);
    // Error message should be generic
    expect(res.body.error).toMatch(/Invalid|Unauthorized/);
  });
});
