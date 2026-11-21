import crypto from 'node:crypto';
import https from 'node:https';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'backend/.env') });
dotenv.config();

let UserModel = null;

function getMongoUserModel() {
  if (UserModel) return UserModel;
  try {
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      if (!UserModel) {
        const userSchema = new mongoose.Schema({
          googleId: { type: String, required: true, unique: true, index: true },
          email: { type: String, required: true, index: true },
          name: { type: String, required: true },
          picture: { type: String, default: '' },
          createdAt: { type: Date, default: Date.now },
          lastLoginAt: { type: Date, default: Date.now },
          stats: {
            sessionsCompleted: { type: Number, default: 0 },
            questionsAttempted: { type: Number, default: 0 },
            correctAnswers: { type: Number, default: 0 },
          },
        });
        UserModel = mongoose.models.User || mongoose.model('User', userSchema);
      }
      return UserModel;
    }
  } catch (_) {}
  return null;
}

// In-Memory Fallback Store (for testing, offline MongoDB, and fast session validation)
const inMemoryUsers = new Map();
const sessionStore = new Map(); // token -> { userId, expiresAt }
const SESSION_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30-day session

class AuthService {
  getConfig() {
    const googleClientId = (process.env.GOOGLE_CLIENT_ID || '').trim();
    return {
      googleClientId,
      configured: Boolean(googleClientId && googleClientId.length > 5),
    };
  }

  /**
   * Verifies Google ID token via Google's official tokeninfo endpoint.
   */
  async verifyGoogleCredential(credential) {
    if (!credential || typeof credential !== 'string') {
      throw new Error('Missing or invalid Google credential token.');
    }

    return new Promise((resolve, reject) => {
      const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`;
      https.get(url, (res) => {
        let rawData = '';
        res.on('data', (chunk) => {
          rawData += chunk;
        });
        res.on('end', () => {
          try {
            const data = JSON.parse(rawData);
            if (data.error || data.error_description) {
              return reject(new Error(data.error_description || data.error || 'Invalid Google token'));
            }
            if (!data.sub || !data.email) {
              return reject(new Error('Google token payload missing essential claims (sub, email).'));
            }

            // Optional audience validation if GOOGLE_CLIENT_ID configured
            const expectedAud = (process.env.GOOGLE_CLIENT_ID || '').trim();
            if (expectedAud && data.aud !== expectedAud) {
              return reject(new Error('Google token audience does not match configured GOOGLE_CLIENT_ID.'));
            }

            resolve({
              googleId: data.sub,
              email: data.email,
              name: data.name || data.email.split('@')[0],
              picture: data.picture || '',
              emailVerified: data.email_verified === 'true' || data.email_verified === true,
            });
          } catch (parseErr) {
            reject(new Error(`Failed to parse Google token verification response: ${parseErr.message}`));
          }
        });
      }).on('error', (netErr) => {
        reject(new Error(`Network error during Google token verification: ${netErr.message}`));
      });
    });
  }

  /**
   * Upserts a user in MongoDB or in-memory store.
   */
  async upsertUser(profile) {
    const Model = getMongoUserModel();
    const now = new Date();

    if (Model) {
      try {
        let userDoc = await Model.findOne({ googleId: profile.googleId });
        if (userDoc) {
          userDoc.lastLoginAt = now;
          if (profile.name) userDoc.name = profile.name;
          if (profile.picture) userDoc.picture = profile.picture;
          await userDoc.save();
        } else {
          userDoc = await Model.create({
            googleId: profile.googleId,
            email: profile.email,
            name: profile.name,
            picture: profile.picture,
            lastLoginAt: now,
            createdAt: now,
            stats: {
              sessionsCompleted: 0,
              questionsAttempted: 0,
              correctAnswers: 0,
            },
          });
        }
        return this.formatUser(userDoc);
      } catch (dbErr) {
        console.warn('[Auth] MongoDB user upsert failed, falling back to in-memory store:', dbErr.message);
      }
    }

    // In-Memory Fallback
    let existing = inMemoryUsers.get(profile.googleId);
    if (existing) {
      existing.lastLoginAt = now.toISOString();
      if (profile.name) existing.name = profile.name;
      if (profile.picture) existing.picture = profile.picture;
    } else {
      existing = {
        id: 'usr_' + crypto.randomBytes(8).toString('hex'),
        googleId: profile.googleId,
        email: profile.email,
        name: profile.name,
        picture: profile.picture,
        createdAt: now.toISOString(),
        lastLoginAt: now.toISOString(),
        stats: {
          sessionsCompleted: 0,
          questionsAttempted: 0,
          correctAnswers: 0,
        },
      };
      inMemoryUsers.set(profile.googleId, existing);
    }
    return existing;
  }

  formatUser(doc) {
    return {
      id: doc._id ? doc._id.toString() : doc.id,
      googleId: doc.googleId,
      email: doc.email,
      name: doc.name,
      picture: doc.picture || '',
      createdAt: doc.createdAt ? doc.createdAt.toISOString() : new Date().toISOString(),
      lastLoginAt: doc.lastLoginAt ? doc.lastLoginAt.toISOString() : new Date().toISOString(),
      stats: doc.stats || {
        sessionsCompleted: 0,
        questionsAttempted: 0,
        correctAnswers: 0,
      },
    };
  }

  createSession(user) {
    const token = 'gf_auth_' + crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + SESSION_EXPIRY_MS;
    sessionStore.set(token, {
      userId: user.id || user.googleId,
      googleId: user.googleId,
      user,
      expiresAt,
    });
    return token;
  }

  async loginWithGoogle(credential, customUsername = '') {
    const profile = await this.verifyGoogleCredential(credential);
    if (customUsername && typeof customUsername === 'string' && customUsername.trim()) {
      profile.name = customUsername.trim().slice(0, 50);
    }
    const user = await this.upsertUser(profile);
    const token = this.createSession(user);
    return {
      success: true,
      user,
      token,
    };
  }

  async loginWithDemo(demoData = {}) {
    const now = new Date();
    const demoProfile = {
      googleId: 'google-demo-gate-student-001',
      email: demoData.email || 'student@gateforge.ai',
      name: demoData.name || 'GATE CS Aspirant',
      picture: demoData.picture || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces',
    };
    const user = await this.upsertUser(demoProfile);
    const token = this.createSession(user);
    return {
      success: true,
      user,
      token,
      isDemo: true,
    };
  }

  async updateUserProfile(userId, updates = {}) {
    if (!userId) throw new Error('User ID is required');
    const newName = (updates.name || '').trim().slice(0, 50);
    if (!newName) throw new Error('Username cannot be empty');

    const Model = getMongoUserModel();
    if (Model) {
      try {
        const query = mongoose.isValidObjectId(userId)
          ? { $or: [{ _id: userId }, { googleId: userId }] }
          : { googleId: userId };
        const doc = await Model.findOneAndUpdate(
          query,
          { $set: { name: newName } },
          { new: true }
        );
        if (doc) {
          const formatted = this.formatUser(doc);
          for (const [_, session] of sessionStore) {
            if (session.userId === userId || session.googleId === userId || (session.user && session.user.id === userId)) {
              session.user = formatted;
            }
          }
          return formatted;
        }
      } catch (err) {
        console.warn('[Auth] Mongo profile update failed, falling back to in-memory:', err.message);
      }
    }

    // In-memory update
    for (const [gid, u] of inMemoryUsers) {
      if (u.id === userId || u.googleId === userId || gid === userId) {
        u.name = newName;
        for (const [_, session] of sessionStore) {
          if (session.userId === userId || session.googleId === userId || session.userId === u.id) {
            session.user = u;
          }
        }
        return u;
      }
    }

    throw new Error('User not found');
  }

  async getUserByToken(token) {
    if (!token || typeof token !== 'string') return null;
    const cleanToken = token.replace(/^Bearer\s+/i, '').trim();
    const session = sessionStore.get(cleanToken);
    if (!session) return null;

    if (Date.now() > session.expiresAt) {
      sessionStore.delete(cleanToken);
      return null;
    }

    // Return fresh user state if Mongoose available
    const Model = getMongoUserModel();
    if (Model && session.googleId) {
      try {
        const doc = await Model.findOne({ googleId: session.googleId });
        if (doc) {
          const formatted = this.formatUser(doc);
          session.user = formatted;
          return formatted;
        }
      } catch (_) {}
    }

    return session.user;
  }

  logout(token) {
    if (!token || typeof token !== 'string') return false;
    const cleanToken = token.replace(/^Bearer\s+/i, '').trim();
    return sessionStore.delete(cleanToken);
  }

  async incrementUserStats(userId, statKey, incrementBy = 1) {
    const Model = getMongoUserModel();
    if (Model) {
      try {
        const update = {};
        update[`stats.${statKey}`] = incrementBy;
        await Model.findByIdAndUpdate(userId, { $inc: update });
        return;
      } catch (_) {}
    }

    for (const [_, u] of inMemoryUsers) {
      if (u.id === userId || u.googleId === userId) {
        if (!u.stats) u.stats = { sessionsCompleted: 0, questionsAttempted: 0, correctAnswers: 0 };
        u.stats[statKey] = (u.stats[statKey] || 0) + incrementBy;
        break;
      }
    }
  }
}

export const authService = new AuthService();
