const session = require('express-session');
const prisma = require('./prisma');

const DEFAULT_TTL_MS = 12 * 60 * 60 * 1000; // 12 giờ

class PrismaSessionStore extends session.Store {
  constructor(options = {}) {
    super();
    this.ttlMs = options.ttlMs || DEFAULT_TTL_MS;
    this.cleanupIntervalMs = options.cleanupIntervalMs || 15 * 60 * 1000;

    if (options.enableCleanup !== false) {
      this.cleanupTimer = setInterval(() => {
        this.clearExpiredSessions().catch(() => {});
      }, this.cleanupIntervalMs);
      if (this.cleanupTimer.unref) {
        this.cleanupTimer.unref();
      }
    }
  }

  _computeExpiresAt(sessionData) {
    if (sessionData && sessionData.cookie && sessionData.cookie.expires) {
      return new Date(sessionData.cookie.expires);
    }
    if (sessionData && sessionData.cookie && typeof sessionData.cookie.maxAge === 'number') {
      return new Date(Date.now() + sessionData.cookie.maxAge);
    }
    return new Date(Date.now() + this.ttlMs);
  }

  async clearExpiredSessions() {
    try {
      await prisma.session.deleteMany({
        where: {
          expiresAt: { lte: new Date() }
        }
      });
    } catch (err) {
      // Bỏ qua lỗi dọn dẹp ngầm
    }
  }

  get(sid, callback) {
    prisma.session
      .findUnique({ where: { sid } })
      .then(async (record) => {
        if (!record) {
          return callback(null, null);
        }
        if (new Date() >= new Date(record.expiresAt)) {
          await prisma.session.deleteMany({ where: { sid } });
          return callback(null, null);
        }
        const parsed = JSON.parse(record.data);
        return callback(null, parsed);
      })
      .catch((err) => callback(err));
  }

  set(sid, sessionData, callback) {
    const expiresAt = this._computeExpiresAt(sessionData);
    const userId = sessionData && sessionData.user && sessionData.user.id
      ? Number(sessionData.user.id)
      : null;
    const data = JSON.stringify(sessionData);

    prisma.session
      .upsert({
        where: { sid },
        update: { userId, data, expiresAt },
        create: { sid, userId, data, expiresAt }
      })
      .then(() => callback && callback(null))
      .catch((err) => callback && callback(err));
  }

  destroy(sid, callback) {
    prisma.session
      .deleteMany({ where: { sid } })
      .then(() => callback && callback(null))
      .catch((err) => callback && callback(err));
  }

  touch(sid, sessionData, callback) {
    const expiresAt = this._computeExpiresAt(sessionData);
    prisma.session
      .updateMany({
        where: { sid },
        data: { expiresAt }
      })
      .then(() => callback && callback(null))
      .catch((err) => callback && callback(err));
  }
}

module.exports = PrismaSessionStore;
