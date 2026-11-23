const logger = require("./logger");
const { CACHE_TTL, REDIS_HOST, REDIS_PORT, REDIS_DB, MAX_CACHE_SIZE, REDIS_URL } = require("../config");
const Redis = require("ioredis");

let redisCache = null;
let useRedis = false;
const localCache = new Map();

const cacheStats = {
	hits: 0,
	misses: 0,
	sets: 0,
};

if (REDIS_URL) {
	redisCache = new Redis(REDIS_URL);
	useRedis = true;
} else if (REDIS_HOST && REDIS_PORT && REDIS_DB) {
	redisCache = new Redis({
		host: REDIS_HOST,
		port: parseInt(REDIS_PORT),
		db: parseInt(REDIS_DB),
	});

	useRedis = true;
}

/**
 * Retrieves data from the cache.
 * @param {string} key - The cache key (e.g., search query).
 * @returns {any|null} - Cached data or null if expired/not found.
 */
async function getCache(key) {
	if (!key) return null;

	try {
		// Use local cache for meta or if Redis is not set up
		if (key.startsWith("meta") || !useRedis || !redisCache) {
			if (localCache.has(key)) {
				const cached = localCache.get(key);

				const expired = Date.now() - cached.lastUpdated > CACHE_TTL;

				if (cached && !expired) {
					cacheStats.hits++;
					logger.cache("RETRIEVED CACHE", key);
					return cached.data;
				} else {
					cacheStats.misses++;
					localCache.delete(key);
					return null;
				}
			} else {
				cacheStats.misses++;
			}
		} else if (useRedis && redisCache) {
			const cached = await redisCache.get(key);
			if (cached) {
				cacheStats.hits++;
				logger.cache("RETRIEVED CACHE", key);
				return JSON.parse(cached);
			} else {
				cacheStats.misses++;
			}
		} else {
			cacheStats.misses++;
		}
		return null;
	} catch (err) {
		logger.error("Error reading from cache:", err);
		return null;
	}
}

/**
 * Stores data in the cache.
 * @param {string} key - The cache key.
 * @param {array} data - Data to cache.
 */
async function setCache(key, data) {
	if (!key) return;

	try {
		cacheStats.sets++;
		// Use local cache for meta or if Redis is not set up
		if (key.startsWith("meta") || !useRedis || !redisCache) {
			// If cache size exceeds max limit, remove the oldest entry
			if (localCache.size >= MAX_CACHE_SIZE) {
				const oldestKey = localCache.keys().next().value; // Get the first inserted key
				localCache.delete(oldestKey); // Remove oldest entry
			}

			localCache.set(key, { lastUpdated: Date.now(), data: data });
			logger.cache("SAVE CACHE", key);
		} else if (useRedis && redisCache) {
			await redisCache.set(key, JSON.stringify(data), "EX", Math.floor(CACHE_TTL));
			logger.cache("SAVE CACHE", key);
		}
	} catch (err) {
		logger.error("Error writing to cache:", err);
	}
}

async function deleteCache(key) {
	await redisCache.del(key);
}

/**
 * Creates a cache key based on search parameters.
 * @param {string} imdbId - The search title.
 * @param {string} year - The search year.
 * @param {string} type - The media type (movie/series).
 * @param {string} source - The recommendation source.
 * @returns {string|null} - The generated cache key.
 */
async function createCatalogCacheKey(imdbId, year, type, source) {
	if (!imdbId || imdbId === "") {
		return null;
	}

	const cacheSearchKey = imdbId.trim().replace(/\s+/g, "_");

	// If year/type is missing, set it to "any"
	const cacheYear = year || "any";
	const cacheType = type || "any";

	return `catalog:${cacheSearchKey.toLowerCase()}_${cacheYear}_${cacheType}_${source}`;
}

/**
 * Creates a cache key based on search parameters.
 * @param {string} imdbId - ImdbId
 * @returns {string} - The generated cache key.
 */
async function createMetaCacheKey(imdbId, metaSource, language) {
	return `meta:${imdbId}:${metaSource}:${language}`;
}

async function createRecCacheKey(imdbId, type, recSource) {
	return `recs:${imdbId}:${type}:${recSource}`;
}

async function getCacheStats() {
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

	return {
		hits: cacheStats.hits,
		misses: cacheStats.misses,
		sets: cacheStats.sets,
		hitRatio:
			cacheStats.hits + cacheStats.misses > 0
				? ((cacheStats.hits / (cacheStats.hits + cacheStats.misses)) * 100).toFixed(1) + "%"
				: "0%",
		localSize: localCache.size,
		maxLocalSize: MAX_CACHE_SIZE,
		useRedis: Boolean(useRedis),
		redisStats,
		recentKeys: Array.from(localCache.keys()).slice(-20),
	};
}

async function clearAllCache() {
	localCache.clear();
	cacheStats.hits = 0;
	cacheStats.misses = 0;
	cacheStats.sets = 0;

	if (useRedis && redisCache) {
		try {
			await redisCache.flushdb();
		} catch (e) {
			logger.error("Failed to flush redis cache", e);
		}
	}
	return { success: true, message: "Cache cleared" };
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
