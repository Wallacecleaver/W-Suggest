const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const logger = require("./logger");
const {
	CACHE_TTL,
	MAX_CACHE_SIZE,
	SQLITE_PATH,
	REDIS_HOST,
	REDIS_PORT,
	REDIS_DB,
	REDIS_URL,
} = require("../config");

let redisCache = null;
let useRedis = false;
let db = null;
let useSqlite = false;
const localCache = new Map();

const cacheStats = {
	hits: 0,
	misses: 0,
	sets: 0,
};

// 1. Initialize Redis if explicitly configured
if (REDIS_URL) {
	try {
		const Redis = require("ioredis");
		redisCache = new Redis(REDIS_URL);
		useRedis = true;
	} catch (e) {
		logger.error("Failed to connect to Redis URL", e);
	}
} else if (REDIS_HOST && REDIS_PORT && REDIS_DB) {
	try {
		const Redis = require("ioredis");
		redisCache = new Redis({
			host: REDIS_HOST,
			port: parseInt(REDIS_PORT, 10),
			db: parseInt(REDIS_DB, 10),
		});
		useRedis = true;
	} catch (e) {
		logger.error("Failed to connect to Redis Host", e);
	}
}

// 2. Initialize SQLite as primary SQL database cache
if (!useRedis) {
	try {
		const dbDir = path.dirname(SQLITE_PATH);
		if (!fs.existsSync(dbDir)) {
			fs.mkdirSync(dbDir, { recursive: true });
		}

		db = new Database(SQLITE_PATH);
		db.pragma("journal_mode = WAL");
		db.exec(`
			CREATE TABLE IF NOT EXISTS cache (
				key TEXT PRIMARY KEY,
				data TEXT NOT NULL,
				last_updated INTEGER NOT NULL
			);
			CREATE INDEX IF NOT EXISTS idx_cache_last_updated ON cache(last_updated);
		`);
		useSqlite = true;
	} catch (err) {
		logger.error("SQLite initialization failed, falling back to memory Map", err);
	}
}

/**
 * Retrieves data from the cache.
 * @param {string} key - The cache key (e.g., search query).
 * @returns {any|null} - Cached data or null if expired/not found.
 */
async function getCache(key) {
	if (!key) return null;

	try {
		// Redis cache (if explicitly enabled)
		if (useRedis && redisCache && !key.startsWith("meta")) {
			const cached = await redisCache.get(key);
			if (cached) {
				cacheStats.hits++;
				logger.cache("RETRIEVED CACHE (REDIS)", key);
				return JSON.parse(cached);
			}
			cacheStats.misses++;
			return null;
		}

		// SQLite cache (Default SQL backend)
		if (useSqlite && db) {
			const row = db.prepare("SELECT data, last_updated FROM cache WHERE key = ?").get(key);
			if (row) {
				const isExpired = Date.now() - row.last_updated > CACHE_TTL * 1000;
				if (!isExpired) {
					cacheStats.hits++;
					logger.cache("RETRIEVED CACHE (SQLITE)", key);
					return JSON.parse(row.data);
				} else {
					cacheStats.misses++;
					db.prepare("DELETE FROM cache WHERE key = ?").run(key);
					return null;
				}
			}
			cacheStats.misses++;
			return null;
		}

		// Fallback in-memory cache
		if (localCache.has(key)) {
			const cached = localCache.get(key);
			const expired = Date.now() - cached.lastUpdated > CACHE_TTL * 1000;
			if (cached && !expired) {
				cacheStats.hits++;
				logger.cache("RETRIEVED CACHE (MEMORY)", key);
				return cached.data;
			} else {
				cacheStats.misses++;
				localCache.delete(key);
				return null;
			}
		}

		cacheStats.misses++;
		return null;
	} catch (err) {
		logger.error("Error reading from cache:", err);
		return null;
	}
}

/**
 * Stores data in the cache.
 * @param {string} key - The cache key.
 * @param {any} data - Data to cache.
 */
async function setCache(key, data) {
	if (!key) return;

	try {
		cacheStats.sets++;

		// Redis cache
		if (useRedis && redisCache && !key.startsWith("meta")) {
			await redisCache.set(key, JSON.stringify(data), "EX", Math.floor(CACHE_TTL));
			logger.cache("SAVE CACHE (REDIS)", key);
			return;
		}

		// SQLite cache
		if (useSqlite && db) {
			const count = db.prepare("SELECT COUNT(*) AS total FROM cache").get().total;
			if (count >= MAX_CACHE_SIZE) {
				const excess = count - MAX_CACHE_SIZE + 1;
				db.prepare(
					"DELETE FROM cache WHERE key IN (SELECT key FROM cache ORDER BY last_updated ASC LIMIT ?)"
				).run(excess);
			}

			db.prepare(`
				INSERT INTO cache (key, data, last_updated)
				VALUES (?, ?, ?)
				ON CONFLICT(key) DO UPDATE SET data = excluded.data, last_updated = excluded.last_updated
			`).run(key, JSON.stringify(data), Date.now());

			logger.cache("SAVE CACHE (SQLITE)", key);
			return;
		}

		// Fallback in-memory cache
		if (localCache.size >= MAX_CACHE_SIZE) {
			const oldestKey = localCache.keys().next().value;
			localCache.delete(oldestKey);
		}
		localCache.set(key, { lastUpdated: Date.now(), data });
		logger.cache("SAVE CACHE (MEMORY)", key);
	} catch (err) {
		logger.error("Error writing to cache:", err);
	}
}

/**
 * Deletes a key from the cache.
 */
async function deleteCache(key) {
	try {
		if (useRedis && redisCache) {
			await redisCache.del(key);
		}
		if (useSqlite && db) {
			db.prepare("DELETE FROM cache WHERE key = ?").run(key);
		}
		localCache.delete(key);
	} catch (err) {
		logger.error("Error deleting from cache:", err);
	}
}

/**
 * Creates a cache key based on search parameters.
 */
async function createCatalogCacheKey(imdbId, year, type, source) {
	if (!imdbId || imdbId === "") return null;
	const cacheSearchKey = imdbId.trim().replace(/\s+/g, "_");
	const cacheYear = year || "any";
	const cacheType = type || "any";
	return `catalog:${cacheSearchKey.toLowerCase()}_${cacheYear}_${cacheType}_${source}`;
}

async function createMetaCacheKey(imdbId, metaSource, language) {
	return `meta:${imdbId}:${metaSource}:${language}`;
}

async function createRecCacheKey(imdbId, type, recSource) {
	return `recs:${imdbId}:${type}:${recSource}`;
}

/**
 * Returns cache statistics for the dashboard.
 */
async function getCacheStats() {
	let totalEntries = 0;
	let recentKeys = [];

	if (useSqlite && db) {
		try {
			totalEntries = db.prepare("SELECT COUNT(*) AS total FROM cache").get().total;
			recentKeys = db
				.prepare("SELECT key FROM cache ORDER BY last_updated DESC LIMIT 20")
				.all()
				.map((r) => r.key);
		} catch (e) {
			logger.error("Error fetching SQLite stats:", e);
		}
	} else if (localCache.size > 0) {
		totalEntries = localCache.size;
		recentKeys = Array.from(localCache.keys()).slice(-20);
	}

	let redisStats = null;
	if (useRedis && redisCache) {
		try {
			const info = await redisCache.info("stats");
			const dbsize = await redisCache.dbsize();
			redisStats = {
				status: redisCache.status,
				keys: dbsize,
				info: info ? info.slice(0, 300) : null,
			};
		} catch (e) {
			redisStats = { status: "error", error: e.message };
		}
	}

	const backendName = useRedis
		? "Redis"
		: useSqlite
		? "SQLite (Base SQL autonome)"
		: "Mémoire Locale (Map)";

	return {
		hits: cacheStats.hits,
		misses: cacheStats.misses,
		sets: cacheStats.sets,
		hitRatio:
			cacheStats.hits + cacheStats.misses > 0
				? ((cacheStats.hits / (cacheStats.hits + cacheStats.misses)) * 100).toFixed(1) + "%"
				: "0%",
		localSize: totalEntries,
		maxLocalSize: MAX_CACHE_SIZE,
		backend: backendName,
		useRedis: Boolean(useRedis),
		useSqlite: Boolean(useSqlite),
		sqlitePath: useSqlite ? SQLITE_PATH : null,
		redisStats,
		recentKeys,
	};
}

/**
 * Clears all cached items.
 */
async function clearAllCache() {
	localCache.clear();
	cacheStats.hits = 0;
	cacheStats.misses = 0;
	cacheStats.sets = 0;

	if (useSqlite && db) {
		try {
			db.prepare("DELETE FROM cache").run();
			db.prepare("VACUUM").run();
		} catch (e) {
			logger.error("Failed to clear SQLite cache", e);
		}
	}

	if (useRedis && redisCache) {
		try {
			await redisCache.flushdb();
		} catch (e) {
			logger.error("Failed to flush redis cache", e);
		}
	}
	return { success: true, message: "Cache vidé avec succès" };
}

module.exports = {
	getCache,
	setCache,
	deleteCache,
	createCatalogCacheKey,
	createMetaCacheKey,
	createRecCacheKey,
	getCacheStats,
	clearAllCache,
};
