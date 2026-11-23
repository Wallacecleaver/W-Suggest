const express = require("express");
const path = require("path");
const fs = require("fs");
const {
	DASHBOARD_PASSWORD,
	PORT,
	CACHE_TTL,
	MAX_CACHE_SIZE,
	ENABLE_LOGGING,
	REDIS_URL,
	REDIS_HOST,
	ENCRYPTION_KEY_INPUT,
	GEMINI_MODEL,
} = require("../../config");
const {
	requireDashboardAuth,
	verifyPassword,
	generateToken,
	checkRateLimit,
	recordLoginAttempt,
	parseCookies,
	verifyToken,
} = require("./auth");
const { getMetricsSummary } = require("./metrics");
const { getCacheStats, clearAllCache } = require("../../utils/cache");
const { validateApiKeys } = require("../../services/api");
const packageJson = require("../../package.json");

const router = express.Router();
const logsDir = path.join(__dirname, "..", "..", "logs");

// Serve static assets for the dashboard
router.use("/assets", express.static(path.join(__dirname, "..", "..", "public", "dashboard")));

// Setup page if password is not configured
router.get("/setup", (req, res) => {
	if (DASHBOARD_PASSWORD) {
		return res.redirect("/dashboard");
	}
	res.sendFile(path.join(__dirname, "..", "..", "public", "dashboard", "setup.html"));
});

// Login page
router.get("/login", (req, res) => {
	if (!DASHBOARD_PASSWORD) {
		return res.redirect("/dashboard/setup");
	}

	const cookies = parseCookies(req.headers.cookie);
	const token = cookies["w_suggest_token"];
	if (token && verifyToken(token)) {
		return res.redirect("/dashboard");
	}

	res.sendFile(path.join(__dirname, "..", "..", "public", "dashboard", "login.html"));
});

// Auth status API
router.get("/api/auth-status", (req, res) => {
	const cookies = parseCookies(req.headers.cookie);
	const token = cookies["w_suggest_token"];
	const authenticated = Boolean(token && verifyToken(token));

	res.json({
		configured: Boolean(DASHBOARD_PASSWORD),
		authenticated: authenticated,
		version: packageJson.version,
	});
});

// Login API
router.post("/api/login", (req, res) => {
	if (!DASHBOARD_PASSWORD) {
		return res.status(503).json({
			success: false,
			error: "DASHBOARD_PASSWORD n'est pas configuré dans le fichier .env.",
		});
	}

	const clientIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";
	const rateCheck = checkRateLimit(clientIp);

	if (!rateCheck.allowed) {
		return res.status(429).json({ success: false, error: rateCheck.message });
	}

	const { password } = req.body || {};

	if (!password) {
		return res.status(400).json({ success: false, error: "Mot de passe requis" });
	}

	if (!verifyPassword(password)) {
		recordLoginAttempt(clientIp, false);
		return res.status(401).json({ success: false, error: "Mot de passe incorrect" });
	}

	recordLoginAttempt(clientIp, true);
	const token = generateToken(168); // 7 days

	// Set HTTP-Only Cookie
	const isHttps = req.secure || req.headers["x-forwarded-proto"] === "https";
	res.cookie("w_suggest_token", token, {
		httpOnly: true,
		secure: isHttps,
		sameSite: "lax",
		maxAge: 7 * 24 * 60 * 60 * 1000,
		path: "/",
	});

	res.json({
		success: true,
		token,
		message: "Connexion réussie",
	});
});

// Logout API
router.post("/api/logout", (req, res) => {
	res.clearCookie("w_suggest_token", { path: "/" });
	res.json({ success: true, message: "Déconnexion réussie" });
});

// --- PROTECTED ROUTES BELOW ---
router.use(requireDashboardAuth);

// Main dashboard HTML
router.get("/", (req, res) => {
	res.sendFile(path.join(__dirname, "..", "..", "public", "dashboard", "index.html"));
});

// Dashboard summary data
router.get("/api/summary", async (req, res) => {
	try {
		const metrics = getMetricsSummary();
		const cache = await getCacheStats();

		res.json({
			version: packageJson.version,
			name: packageJson.name,
			environment: {
				port: PORT,
				loggingEnabled: ENABLE_LOGGING,
				encryptionEnabled: Boolean(ENCRYPTION_KEY_INPUT),
				cacheTTL: CACHE_TTL,
				maxCacheSize: MAX_CACHE_SIZE,
				redisConfigured: Boolean(REDIS_URL || REDIS_HOST),
				geminiModel: GEMINI_MODEL,
			},
			system: metrics.system,
			uptime: metrics.uptime,
			traffic: {
				total: metrics.traffic.total,
				routes: metrics.traffic.routes,
				statusCodes: metrics.traffic.statusCodes,
				responseTimes: metrics.traffic.responseTimes,
			},
			cache: {
				hits: cache.hits,
				misses: cache.misses,
				hitRatio: cache.hitRatio,
				localSize: cache.localSize,
				maxLocalSize: cache.maxLocalSize,
				useRedis: cache.useRedis,
				redisStats: cache.redisStats,
			},
		});
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
});

// Traffic and system metrics
router.get("/api/metrics", (req, res) => {
	res.json(getMetricsSummary());
});

// Cache details & inspect
router.get("/api/cache", async (req, res) => {
	try {
		const stats = await getCacheStats();
		res.json(stats);
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

// Clear cache
router.post("/api/cache/clear", async (req, res) => {
	try {
		const result = await clearAllCache();
		res.json(result);
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

// Log reader endpoint
router.get("/api/logs", (req, res) => {
	try {
		const allowedFiles = ["app.log", "error.log", "cache.log", "emptyCatalog.log"];
		const fileName = req.query.file || "app.log";
		const levelFilter = req.query.level || "ALL";
		const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);

		if (!allowedFiles.includes(fileName)) {
			return res.status(400).json({ error: "Fichier de log non autorisé" });
		}

		const filePath = path.join(logsDir, fileName);
		if (!fs.existsSync(filePath)) {
			return res.json({
				fileName,
				exists: false,
				total: 0,
				entries: [],
				message: "Le fichier de log n'existe pas encore ou est vide.",
			});
		}

		const content = fs.readFileSync(filePath, "utf-8");
		const lines = content.trim().split("\n").filter(Boolean);

		const parsedEntries = [];
		for (let i = lines.length - 1; i >= 0 && parsedEntries.length < limit; i--) {
			try {
				const entry = JSON.parse(lines[i]);
				if (levelFilter === "ALL" || entry.level === levelFilter) {
					parsedEntries.push(entry);
				}
			} catch {
				parsedEntries.push({
					timestamp: new Date().toISOString(),
					level: "RAW",
					message: lines[i],
				});
			}
		}

		res.json({
			fileName,
			exists: true,
			total: lines.length,
			filteredCount: parsedEntries.length,
			entries: parsedEntries,
		});
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

// Clear log file
router.post("/api/logs/clear", (req, res) => {
	try {
		const allowedFiles = ["app.log", "error.log", "cache.log", "emptyCatalog.log"];
		const fileName = req.body.file;

		if (!allowedFiles.includes(fileName)) {
			return res.status(400).json({ error: "Fichier de log non autorisé" });
		}

		const filePath = path.join(logsDir, fileName);
		if (fs.existsSync(filePath)) {
			fs.writeFileSync(filePath, "");
		}

		res.json({ success: true, message: `Log ${fileName} vidé avec succès` });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

// External providers health check
router.get("/api/health", async (req, res) => {
	const results = {
		cinemeta: { name: "Cinemeta (Stremio)", status: "checking" },
		tmdb: { name: "TheMovieDatabase (TMDB)", status: "online" },
		trakt: { name: "Trakt.tv", status: "online" },
		simkl: { name: "Simkl", status: "online" },
		gemini: { name: "Google Gemini AI", status: "online" },
		tastedive: { name: "TasteDive", status: "online" },
		watchmode: { name: "WatchMode", status: "online" },
		rpdb: { name: "RPDB (Posters)", status: "online" },
	};

	try {
		// Test Cinemeta
		const startTime = Date.now();
		const response = await fetch("https://v3-cinemeta.strem.io/manifest.json", {
			signal: AbortSignal.timeout(4000),
		});
		results.cinemeta = {
			name: "Cinemeta (Stremio)",
			status: response.ok ? "online" : "degraded",
			latencyMs: Date.now() - startTime,
		};
	} catch (e) {
		results.cinemeta = {
			name: "Cinemeta (Stremio)",
			status: "offline",
			error: e.message,
		};
	}

	res.json(results);
});

// Test API Key endpoint
router.post("/api/test-key", async (req, res) => {
	try {
		const { source, key } = req.body;
		if (!source || !key) {
			return res.status(400).json({ valid: false, error: "Source et clé requises" });
		}
		const result = await validateApiKeys({ [source]: key });
		res.json(result[source] || { valid: false, error: "Validation échouée" });
	} catch (err) {
		res.status(500).json({ valid: false, error: err.message });
	}
});

module.exports = router;
