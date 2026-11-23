const os = require("os");

const serverStartedAt = Date.now();

const metricsData = {
	totalRequests: 0,
	routes: {
		catalog: 0,
		stream: 0,
		meta: 0,
		manifest: 0,
		configure: 0,
		dashboard: 0,
		other: 0,
	},
	statusCodes: {
		"2xx": 0,
		"3xx": 0,
		"4xx": 0,
		"5xx": 0,
	},
	durations: {
		total: 0,
		count: 0,
		min: Infinity,
		max: 0,
	},
	recentRequests: [],
	maxRecentRequests: 60,
};

/**
 * Determine route category for metrics
 */
function categorizePath(path) {
	if (!path) return "other";
	if (path.includes("/catalog/")) return "catalog";
	if (path.includes("/stream/")) return "stream";
	if (path.includes("/meta/")) return "meta";
	if (path.includes("manifest.json")) return "manifest";
	if (path.startsWith("/configure") || path.startsWith("/saveConfig")) return "configure";
	if (path.startsWith("/dashboard")) return "dashboard";
	return "other";
}

/**
 * Express middleware to record request metrics
 */
function metricsMiddleware(req, res, next) {
	const startTime = process.hrtime();
	const path = req.originalUrl || req.url;
	const category = categorizePath(path);

	metricsData.totalRequests++;
	metricsData.routes[category] = (metricsData.routes[category] || 0) + 1;

	// Hook response finish
	res.on("finish", () => {
		const diff = process.hrtime(startTime);
		const durationMs = Math.round((diff[0] * 1e3 + diff[1] * 1e-6) * 100) / 100;

		const statusGroup = `${Math.floor(res.statusCode / 100)}xx`;
		if (metricsData.statusCodes[statusGroup] !== undefined) {
			metricsData.statusCodes[statusGroup]++;
		}

		// Update response time statistics
		metricsData.durations.total += durationMs;
		metricsData.durations.count++;
		if (durationMs < metricsData.durations.min) metricsData.durations.min = durationMs;
		if (durationMs > metricsData.durations.max) metricsData.durations.max = durationMs;

		// Skip cluttering recent list with static dashboard assets
		if (
			!path.endsWith(".css") &&
			!path.endsWith(".js") &&
			!path.endsWith(".png") &&
			!path.endsWith(".ico") &&
			!path.includes("/dashboard/api/metrics")
		) {
			metricsData.recentRequests.unshift({
				timestamp: new Date().toISOString(),
				method: req.method,
				path: path.length > 80 ? path.substring(0, 77) + "..." : path,
				status: res.statusCode,
				durationMs,
				category,
			});

			if (metricsData.recentRequests.length > metricsData.maxRecentRequests) {
				metricsData.recentRequests.pop();
			}
		}
	});

	next();
}

/**
 * Get comprehensive metrics summary
 */
function getMetricsSummary() {
	const uptimeSeconds = Math.floor((Date.now() - serverStartedAt) / 1000);
	const mem = process.memoryUsage();
	const avgDuration =
		metricsData.durations.count > 0
			? Math.round((metricsData.durations.total / metricsData.durations.count) * 100) / 100
			: 0;

	return {
		uptime: {
			seconds: uptimeSeconds,
			formatted: formatUptime(uptimeSeconds),
			startedAt: new Date(serverStartedAt).toISOString(),
		},
		system: {
			nodeVersion: process.version,
			platform: os.platform(),
			arch: os.arch(),
			cpus: os.cpus()?.length || 1,
			memory: {
				heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
				heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
				rssMB: Math.round(mem.rss / 1024 / 1024),
				systemTotalMB: Math.round(os.totalmem() / 1024 / 1024),
				systemFreeMB: Math.round(os.freemem() / 1024 / 1024),
			},
			loadAvg: os.loadavg(),
		},
		traffic: {
			total: metricsData.totalRequests,
			routes: metricsData.routes,
			statusCodes: metricsData.statusCodes,
			responseTimes: {
				avgMs: avgDuration,
				minMs: metricsData.durations.min === Infinity ? 0 : metricsData.durations.min,
				maxMs: metricsData.durations.max,
			},
			recentRequests: metricsData.recentRequests,
		},
	};
}

function formatUptime(seconds) {
	const days = Math.floor(seconds / (24 * 3600));
	seconds %= 24 * 3600;
	const hours = Math.floor(seconds / 3600);
	seconds %= 3600;
	const minutes = Math.floor(seconds / 60);
	const secs = seconds % 60;

	const parts = [];
	if (days > 0) parts.push(`${days}j`);
	if (hours > 0) parts.push(`${hours}h`);
	if (minutes > 0) parts.push(`${minutes}m`);
	parts.push(`${secs}s`);

	return parts.join(" ");
}

module.exports = {
	metricsMiddleware,
	getMetricsSummary,
};
