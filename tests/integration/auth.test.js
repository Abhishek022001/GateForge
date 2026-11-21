import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, stopTestServer, getBaseUrl } from '../setup/testServer.js';
import { authService } from '../../backend/src/services/auth.service.js';

describe('Authentication & Google OAuth System', () => {
  let baseUrl;
  let demoToken = '';
  let demoUser = null;

  before(async () => {
    baseUrl = await startTestServer();
  });

  after(async () => {
    await stopTestServer();
  });

  describe('GET /api/auth/config', () => {
    it('should return Google Client ID configuration metadata', async () => {
      const res = await fetch(`${baseUrl}/api/auth/config`);
      assert.equal(res.status, 200, 'HTTP status should be 200');

      const data = await res.json();
      assert.equal(data.success, true);
      assert.ok(data.data, 'data payload should be present');
      assert.equal(typeof data.data.configured, 'boolean');
      assert.equal(typeof data.data.googleClientId, 'string');
    });
  });

  describe('POST /api/auth/google', () => {
    it('should return 400 when credential token is missing in non-demo mode', async () => {
      const res = await fetch(`${baseUrl}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      assert.equal(res.status, 400, 'Missing credential should return 400');
      const data = await res.json();
      assert.equal(data.success, false);
      assert.equal(data.code, 'MISSING_CREDENTIAL');
      assert.ok(data.error.includes('Google credential token is required'));
    });

    it('should return 401 when invalid google credential is provided', async () => {
      const res = await fetch(`${baseUrl}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: 'invalid.bogus.jwt.token' }),
      });

      assert.equal(res.status, 401, 'Invalid Google token should return 401');
      const data = await res.json();
      assert.equal(data.success, false);
      assert.equal(data.code, 'AUTH_FAILED');
    });

    it('should support 1-click Demo Aspirant login with valid session token and profile', async () => {
      const res = await fetch(`${baseUrl}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isDemo: true,
          demoUser: {
            name: 'Test GATE CS Aspirant',
            email: 'aspirant.test@gateforge.ai',
          },
        }),
      });

      assert.equal(res.status, 200, 'Demo login should return 200');
      const data = await res.json();
      assert.equal(data.success, true);
      assert.ok(data.token, 'Session token should be returned');
      assert.ok(data.token.startsWith('gf_auth_'), 'Token should use gf_auth_ prefix');
      assert.ok(data.user, 'User profile should be present');
      assert.equal(data.user.email, 'aspirant.test@gateforge.ai');
      assert.equal(data.user.name, 'Test GATE CS Aspirant');
      assert.equal(data.isDemo, true);

      // Save for subsequent tests
      demoToken = data.token;
      demoUser = data.user;
    });

    it('should support choosing a custom username during login', async () => {
      const res = await fetch(`${baseUrl}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isDemo: true,
          customUsername: 'Air1Aspirant',
          demoUser: {
            name: 'Default Google Name',
            email: 'air1@gateforge.ai',
          },
        }),
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.user.name, 'Air1Aspirant', 'Custom username should override default name');

      // Update demo session reference
      demoToken = data.token;
      demoUser = data.user;
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return 401 when Authorization header is omitted', async () => {
      const res = await fetch(`${baseUrl}/api/auth/me`);
      assert.equal(res.status, 401, 'Missing Authorization header should return 401');

      const data = await res.json();
      assert.equal(data.success, false);
      assert.equal(data.code, 'UNAUTHORIZED');
    });

    it('should return 401 when invalid session token is supplied', async () => {
      const res = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { Authorization: 'Bearer gf_auth_fake_invalid_token_123456' },
      });

      assert.equal(res.status, 401, 'Bogus session token should return 401');
      const data = await res.json();
      assert.equal(data.success, false);
      assert.equal(data.code, 'INVALID_SESSION');
    });

    it('should return 200 with authenticated user profile when valid token supplied', async () => {
      assert.ok(demoToken, 'Demo token should be established');
      const res = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${demoToken}` },
      });

      assert.equal(res.status, 200, 'Valid token should return 200');
      const data = await res.json();
      assert.equal(data.success, true);
      assert.ok(data.user, 'User object should exist');
      assert.equal(data.user.email, demoUser.email);
      assert.equal(data.user.name, demoUser.name);
      assert.ok(data.user.stats, 'User stats object should exist');
    });
  });

  describe('PATCH /api/auth/profile', () => {
    it('should update user display name and return updated profile', async () => {
      assert.ok(demoToken, 'Demo token should be established');
      const res = await fetch(`${baseUrl}/api/auth/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${demoToken}`,
        },
        body: JSON.stringify({ name: 'Custom GATE Topper' }),
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.user.name, 'Custom GATE Topper');

      // Verify me endpoint also returns updated name
      const meRes = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${demoToken}` },
      });
      const meData = await meRes.json();
      assert.equal(meData.user.name, 'Custom GATE Topper');
    });

    it('should reject invalid or empty username with 400', async () => {
      assert.ok(demoToken);
      const res = await fetch(`${baseUrl}/api/auth/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${demoToken}`,
        },
        body: JSON.stringify({ name: '   ' }),
      });

      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.success, false);
      assert.equal(data.code, 'INVALID_USERNAME');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should terminate active session and invalidate session token', async () => {
      assert.ok(demoToken, 'Demo token should be established');

      const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${demoToken}` },
      });

      assert.equal(logoutRes.status, 200, 'Logout should return 200');
      const logoutData = await logoutRes.json();
      assert.equal(logoutData.success, true);

      // Verify token is now invalidated
      const meRes = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${demoToken}` },
      });
      assert.equal(meRes.status, 401, 'Invalidated token should return 401');
      const meData = await meRes.json();
      assert.equal(meData.code, 'INVALID_SESSION');
    });
  });

  describe('AuthService Unit Capabilities', () => {
    it('verifyGoogleCredential should reject missing or invalid tokens', async () => {
      await assert.rejects(
        async () => {
          await authService.verifyGoogleCredential('');
        },
        {
          message: /Missing or invalid Google credential token/,
        }
      );
    });

    it('incrementUserStats should update user question and session counters', async () => {
      const demoResult = await authService.loginWithDemo({
        email: 'stats.test@gateforge.ai',
        name: 'Stats Student',
      });

      const user = demoResult.user;
      await authService.incrementUserStats(user.id, 'questionsAttempted', 3);
      await authService.incrementUserStats(user.id, 'correctAnswers', 2);

      const refreshedUser = await authService.getUserByToken(demoResult.token);
      assert.ok(refreshedUser, 'User should be found');
      assert.equal(refreshedUser.stats.questionsAttempted, 3);
      assert.equal(refreshedUser.stats.correctAnswers, 2);
    });
  });
});
