const crypto = require("crypto");
const { DASHBOARD_PASSWORD, DASHBOARD_SESSION_SECRET } = require("../../config");

// In-memory rate limiting for login attempts
const loginAttempts = new Map();
const MAX_ATTEMPTS = 5;
const LOCKOUT_TIME_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Parse cookies from header string
 */
function parseCookies(cookieHeader) {
	const list = {};
	if (!cookieHeader) return list;

	cookieHeader.split(";").forEach((cookie) => {
		let [name, ...rest] = cookie.split("=");
		name = name?.trim();
		if (!name) return;
		const value = rest.join("=").trim();
		list[name] = decodeURIComponent(value);
	});

	return list;
}

/**
 * Generate HMAC token for authenticated session
 */
function generateToken(expiresInHours = 168) {
	// default 7 days
	const expiresAt = Date.now() + expiresInHours * 60 * 60 * 1000;
	const payload = `admin:${expiresAt}`;
	const signature = crypto
		.createHmac("sha256", DASHBOARD_SESSION_SECRET)
		.update(payload)
		.digest("hex");
	return Buffer.from(`${payload}:${signature}`).toString("base64url");
}

/**
 * Verify HMAC token
 */
function verifyToken(token) {
	if (!token) return false;
	try {
		const decoded = Buffer.from(token, "base64url").toString("utf-8");
		const parts = decoded.split(":");
		if (parts.length !== 3) return false;

		const [user, expiresAtStr, signature] = parts;
		if (user !== "admin") return false;

		const expiresAt = parseInt(expiresAtStr, 10);
		if (isNaN(expiresAt) || Date.now() > expiresAt) {
			return false; // expired
		}

		const expectedPayload = `admin:${expiresAt}`;
		const expectedSignature = crypto
			.createHmac("sha256", DASHBOARD_SESSION_SECRET)
			.update(expectedPayload)
			.digest("hex");

		const sigBuf = Buffer.from(signature);
		const expectedBuf = Buffer.from(expectedSignature);

		if (sigBuf.length !== expectedBuf.length) return false;
		return crypto.timingSafeEqual(sigBuf, expectedBuf);
	} catch {
		return false;
	}
}

/**
 * Constant time password verification
 */
function verifyPassword(inputPassword) {
	if (!DASHBOARD_PASSWORD || typeof inputPassword !== "string") return false;

	const inputBuf = Buffer.from(inputPassword);
	const expectedBuf = Buffer.from(DASHBOARD_PASSWORD);

	if (inputBuf.length !== expectedBuf.length) return false;
	return crypto.timingSafeEqual(inputBuf, expectedBuf);
}

/**
 * Check rate limit for client IP
 */
function checkRateLimit(ip) {
	const now = Date.now();
	const record = loginAttempts.get(ip);
	if (!record) return { allowed: true };

	if (record.lockedUntil && now < record.lockedUntil) {
		const remainingMins = Math.ceil((record.lockedUntil - now) / 60000);
		return {
			allowed: false,
			message: `Trop de tentatives échouées. Réessayez dans ${remainingMins} minute(s).`,
		};
	}

	if (now - record.firstAttempt > LOCKOUT_TIME_MS) {
		loginAttempts.delete(ip);
		return { allowed: true };
	}

	return { allowed: true };
}

function recordLoginAttempt(ip, success) {
	const now = Date.now();
	if (success) {
		loginAttempts.delete(ip);
		return;
	}

	const record = loginAttempts.get(ip) || { count: 0, firstAttempt: now };
	record.count += 1;

	if (record.count >= MAX_ATTEMPTS) {
		record.lockedUntil = now + LOCKOUT_TIME_MS;
	}

	loginAttempts.set(ip, record);
}

/**
 * Middleware: Enforces dashboard authentication
 */
function requireDashboardAuth(req, res, next) {
	// If DASHBOARD_PASSWORD is not set in .env
	if (!DASHBOARD_PASSWORD) {
		if (req.path.startsWith("/api/")) {
			return res.status(503).json({
				error: "DASHBOARD_PASSWORD non configuré",
				message: "Veuillez définir DASHBOARD_PASSWORD dans votre fichier .env pour accéder au dashboard.",
			});
		}
		// If requesting HTML page, redirect or show setup notice
		return res.redirect("/dashboard/setup");
	}

	// Read token from cookie or Authorization header
	const cookies = parseCookies(req.headers.cookie);
	const authHeader = req.headers["authorization"];
	let token = cookies["w_suggest_token"];

	if (!token && authHeader && authHeader.startsWith("Bearer ")) {
		token = authHeader.substring(7).trim();
	}

	if (token && verifyToken(token)) {
		req.isAuthenticated = true;
		return next();
	}

	// Unauthorized
	if (req.path.startsWith("/api/")) {
		return res.status(401).json({ error: "Non authentifié", redirect: "/dashboard/login" });
	}

	return res.redirect("/dashboard/login");
}

module.exports = {
	parseCookies,
	generateToken,
	verifyToken,
	verifyPassword,
	checkRateLimit,
	recordLoginAttempt,
	requireDashboardAuth,
};
