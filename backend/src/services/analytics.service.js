import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SNAPSHOT_DIR = path.resolve(__dirname, '../../data');
const SNAPSHOT_FILE = path.join(SNAPSHOT_DIR, 'analytics_snapshot.json');

const SESSION_WINDOW_MS = 30 * 60 * 1000; // 30-minute standard session deduplication
const LIVE_WINDOW_MS = 75 * 1000; // 75-second sliding window for active live users (3 missed 25s heartbeats)
const SERVER_SALT = process.env.ANALYTICS_SALT || 'gateforge_prod_analytics_v1';

// Mongoose Models Cache
let MetricModel = null;
let VisitorModel = null;

function getMongoModels() {
  if (MetricModel && VisitorModel) return { MetricModel, VisitorModel };
  try {
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      if (!MetricModel) {
        const metricSchema = new mongoose.Schema({
          _id: { type: String, default: 'global_metrics' },
          totalVisits: { type: Number, default: 0 },
          uniqueVisitors: { type: Number, default: 0 },
          updatedAt: { type: Date, default: Date.now },
        });
        MetricModel = mongoose.models.GlobalMetric || mongoose.model('GlobalMetric', metricSchema);
      }
      if (!VisitorModel) {
        const visitorSchema = new mongoose.Schema({
          hash: { type: String, required: true, unique: true, index: true },
          firstSeen: { type: Date, default: Date.now },
          lastSeen: { type: Date, default: Date.now, index: true },
        });
        VisitorModel = mongoose.models.VisitorHash || mongoose.model('VisitorHash', visitorSchema);
      }
      return { MetricModel, VisitorModel };
    }
  } catch (err) {
    // Model initialization deferred until connection ready
  }
  return { MetricModel: null, VisitorModel: null };
}

class AnalyticsService {
  constructor() {
    this.totalVisits = 0;
    this.uniqueVisitorsCount = 0;
    this.inMemoryVisitorCache = new Map(); // Map<hash, lastSeenTimestamp>
    this.liveSessions = new Map(); // Map<sessionKey, lastSeenTimestamp>
    this.saveTimeout = null;

    this.loadSnapshot();
    this.setupMongoSync();
    this.setupLivePruning();
  }

  setupLivePruning() {
    try {
      const pruningInterval = setInterval(() => {
        this.getLiveCount();
      }, 30000);
      if (pruningInterval && typeof pruningInterval.unref === 'function') {
        pruningInterval.unref();
      }
    } catch (_) {}
  }

  loadSnapshot() {
    try {
      if (fs.existsSync(SNAPSHOT_FILE)) {
        const raw = fs.readFileSync(SNAPSHOT_FILE, 'utf8');
        const data = JSON.parse(raw);
        this.totalVisits = Number(data.totalVisits) || 0;
        this.uniqueVisitorsCount = Number(data.uniqueVisitors) || 0;
        if (Array.isArray(data.recentHashes)) {
          for (const item of data.recentHashes) {
            if (item && item.h && item.t) {
              this.inMemoryVisitorCache.set(item.h, item.t);
            }
          }
        }
      }
    } catch (_) {}
  }

  saveSnapshot() {
    try {
      if (!fs.existsSync(SNAPSHOT_DIR)) {
        fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
      }
      const recentHashes = Array.from(this.inMemoryVisitorCache.entries())
        .slice(-2000)
        .map(([h, t]) => ({ h, t }));
      const payload = {
        totalVisits: this.totalVisits,
        uniqueVisitors: this.uniqueVisitorsCount,
        recentHashes,
        updatedAt: new Date().toISOString(),
      };
      fs.writeFileSync(SNAPSHOT_FILE, JSON.stringify(payload, null, 2), 'utf8');
    } catch (_) {}
  }

  scheduleSnapshot() {
    if (this.saveTimeout) return;
    this.saveTimeout = setTimeout(() => {
      this.saveTimeout = null;
      this.saveSnapshot();
    }, 5000);
  }

  setupMongoSync() {
    try {
      if (mongoose.connection) {
        if (mongoose.connection.readyState === 1) {
          this.syncFromDb();
        } else {
          mongoose.connection.on('connected', () => this.syncFromDb());
        }
      }
    } catch (_) {}
  }

  async syncFromDb() {
    const { MetricModel, VisitorModel } = getMongoModels();
    if (!MetricModel || !VisitorModel) return;

    try {
      const doc = await MetricModel.findById('global_metrics').lean();
      if (doc) {
        this.totalVisits = Math.max(this.totalVisits, doc.totalVisits || 0);
        this.uniqueVisitorsCount = Math.max(this.uniqueVisitorsCount, doc.uniqueVisitors || 0);
      } else {
        const count = await VisitorModel.countDocuments();
        this.uniqueVisitorsCount = Math.max(this.uniqueVisitorsCount, count);
        await MetricModel.create({
          _id: 'global_metrics',
          totalVisits: this.totalVisits,
          uniqueVisitors: this.uniqueVisitorsCount,
        });
      }
      console.log(`[Analytics] Synchronized with MongoDB: ${this.uniqueVisitorsCount} unique visitors, ${this.totalVisits} total visits.`);
    } catch (err) {
      console.warn('[Analytics] DB sync error:', err.message);
    }
  }

  extractClientInfo(req) {
    if (!req) return { clientIp: '127.0.0.1', userAgent: 'unknown', isBot: false };

    // Real client IP behind Vercel / Cloudflare / Render reverse proxies
    const xForwardedFor = req.headers['x-forwarded-for'];
    let clientIp = '';
    if (xForwardedFor) {
      const parts = String(xForwardedFor).split(',');
      if (parts.length > 0 && parts[0].trim()) {
        clientIp = parts[0].trim();
      }
    }
    if (!clientIp) {
      clientIp = req.headers['x-real-ip'] || req.socket?.remoteAddress || '127.0.0.1';
    }

    const userAgent = req.headers['user-agent'] || 'unknown';
    const lowerAgent = userAgent.toLowerCase();

    // Filter automated internal uptime checks, health-check probes, and crawlers
    const isBot = (
      lowerAgent.includes('bot') ||
      lowerAgent.includes('crawler') ||
      lowerAgent.includes('spider') ||
      lowerAgent.includes('render/') ||
      lowerAgent.includes('healthcheck') ||
      lowerAgent.includes('uptime') ||
      lowerAgent.includes('pingdom')
    );

    return { clientIp, userAgent, isBot };
  }

  generateHash(clientIp, userAgent) {
    return crypto
      .createHash('sha256')
      .update(`${clientIp}::${userAgent}::${SERVER_SALT}`)
      .digest('hex');
  }

  registerLive(req, sessionId = null) {
    const { clientIp, userAgent, isBot } = this.extractClientInfo(req);
    if (isBot) return;

    let key = '';
    if (sessionId && typeof sessionId === 'string' && sessionId.trim().length > 0) {
      const cleanId = sessionId.trim().slice(0, 64);
      key = cleanId.startsWith('sess_') ? cleanId : `sess_${cleanId}`;
    } else {
      key = `ip_${this.generateHash(clientIp, userAgent)}`;
    }

    this.liveSessions.set(key, Date.now());
  }

  recordHeartbeat(req, sessionId = null) {
    this.registerLive(req, sessionId);
    return this.getStats();
  }

  recordLeave(req, sessionId = null) {
    if (sessionId && typeof sessionId === 'string' && sessionId.trim().length > 0) {
      const cleanId = sessionId.trim().slice(0, 64);
      const key = cleanId.startsWith('sess_') ? cleanId : `sess_${cleanId}`;
      this.liveSessions.delete(key);
    }
    const { clientIp, userAgent } = this.extractClientInfo(req);
    this.liveSessions.delete(`ip_${this.generateHash(clientIp, userAgent)}`);
    return this.getLiveCount();
  }

  getLiveCount() {
    const now = Date.now();
    for (const [key, timestamp] of this.liveSessions.entries()) {
      if (now - timestamp > LIVE_WINDOW_MS) {
        this.liveSessions.delete(key);
      }
    }
    return this.liveSessions.size;
  }

  async recordVisit(req, sessionId = null) {
    this.registerLive(req, sessionId);

    const { clientIp, userAgent, isBot } = this.extractClientInfo(req);
    if (isBot) {
      return this.getStats();
    }

    const hash = this.generateHash(clientIp, userAgent);
    const now = Date.now();
    const lastSeen = this.inMemoryVisitorCache.get(hash);

    let isNewVisitor = false;
    let isNewSession = false;

    if (!lastSeen) {
      isNewVisitor = true;
      isNewSession = true;
    } else if (now - lastSeen > SESSION_WINDOW_MS) {
      isNewSession = true;
    }

    // Update in-memory session timestamp
    this.inMemoryVisitorCache.set(hash, now);

    // Evict old entries if memory map exceeds 50,000 entries
    if (this.inMemoryVisitorCache.size > 50000) {
      const oldestEntries = Array.from(this.inMemoryVisitorCache.entries()).slice(0, 5000);
      for (const [k] of oldestEntries) {
        this.inMemoryVisitorCache.delete(k);
      }
    }

    if (isNewVisitor) {
      this.uniqueVisitorsCount++;
    }
    if (isNewSession) {
      this.totalVisits++;
    }

    // Persist to MongoDB if connected
    const { MetricModel, VisitorModel } = getMongoModels();
    if (MetricModel && VisitorModel) {
      try {
        if (isNewVisitor) {
          const existingInDb = await VisitorModel.findOne({ hash }).lean();
          if (!existingInDb) {
            await VisitorModel.create({ hash, firstSeen: new Date(now), lastSeen: new Date(now) });
            await MetricModel.findByIdAndUpdate(
              'global_metrics',
              {
                $inc: { uniqueVisitors: 1, totalVisits: isNewSession ? 1 : 0 },
                $set: { updatedAt: new Date() },
              },
              { upsert: true, new: true }
            );
          } else {
            // Already seen in DB previously; adjust in-memory unique visitor count
            this.uniqueVisitorsCount = Math.max(1, this.uniqueVisitorsCount - 1);
            if (now - new Date(existingInDb.lastSeen).getTime() > SESSION_WINDOW_MS) {
              await VisitorModel.updateOne({ hash }, { $set: { lastSeen: new Date(now) } });
              await MetricModel.findByIdAndUpdate(
                'global_metrics',
                { $inc: { totalVisits: 1 }, $set: { updatedAt: new Date() } },
                { upsert: true, new: true }
              );
            }
          }
        } else if (isNewSession) {
          await VisitorModel.updateOne({ hash }, { $set: { lastSeen: new Date(now) } });
          await MetricModel.findByIdAndUpdate(
            'global_metrics',
            { $inc: { totalVisits: 1 }, $set: { updatedAt: new Date() } },
            { upsert: true, new: true }
          );
        }
      } catch (err) {
        // Non-blocking fallback
      }
    } else {
      this.scheduleSnapshot();
    }

    return this.getStats();
  }

  getStats() {
    const live = this.getLiveCount();
    return {
      uniqueVisitors: this.uniqueVisitorsCount,
      peopleVisitedSoFar: this.uniqueVisitorsCount,
      totalVisits: this.totalVisits,
      liveUsers: Math.max(1, live),
    };
  }
}

export const analyticsService = new AnalyticsService();
