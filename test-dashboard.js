// Set environment variables before any module loads
process.env.PORT = "8899";
process.env.DASHBOARD_PASSWORD = "MonSuperMotDePasse123";

const http = require("http");
const assert = require("assert");

async function runTests() {
	console.log("=== DÉBUT DES TESTS DU DASHBOARD W-SUGGEST ===");

	// Test 1: Validation modules
	console.log("\n[Test 1] Test des modules auth et metrics unitaires...");
	const auth = require("./src/dashboard/auth");
	const metrics = require("./src/dashboard/metrics");
	assert(typeof auth.generateToken === "function");
	assert(typeof auth.verifyToken === "function");
	assert(typeof auth.verifyPassword === "function");
	assert(typeof metrics.getMetricsSummary === "function");
	console.log("-> Modules unitaires chargés avec succès.");

	// Test 2: Intégration HTTP sur le serveur complet
	console.log("\n[Test 2] Lancement du serveur W-Suggest en mode test...");

	// Let's create an express instance mimicking server.js
	const express = require("express");
	const cors = require("cors");
	const path = require("path");
	const { metricsMiddleware } = require("./src/dashboard/metrics");
	const dashboardRouter = require("./src/dashboard/routes");

	const app = express();
	app.use(cors());
	app.use(express.json());
	app.use(express.urlencoded({ extended: true }));
	app.use(metricsMiddleware);
	app.use("/dashboard", dashboardRouter);
	app.use(express.static(path.join(__dirname, "public")));

	app.get("/", (req, res) => res.redirect("/configure"));
	app.get("/configure", (req, res) => res.sendFile(path.join(__dirname, "public", "configure.html")));
	app.get("/manifest.json", (req, res) => res.json({ id: "community.wsuggest" }));

	const server = app.listen(8899);

	function request(path, options = {}) {
		return new Promise((resolve, reject) => {
			const req = http.request(
				{
					hostname: "localhost",
					port: 8899,
					path,
					method: options.method || "GET",
					headers: options.headers || {},
				},
				(res) => {
					let data = "";
					res.on("data", (chunk) => (data += chunk));
					res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
				}
			);
			req.on("error", reject);
			if (options.body) {
				req.write(options.body);
			}
			req.end();
		});
	}

	try {
		// Test /configure
		console.log("\n[Test 3] Vérification de la route standard /configure...");
		let res = await request("/configure");
		assert.strictEqual(res.status, 200);
		assert(res.body.includes("W Suggest"));
		console.log("-> /configure fonctionne parfaitement.");

		// Test /dashboard sans authentification
		console.log("\n[Test 4] Vérification de la redirection /dashboard vers /dashboard/login...");
		res = await request("/dashboard");
		assert.strictEqual(res.status, 302);
		assert.strictEqual(res.headers.location, "/dashboard/login");
		console.log("-> Redirection 302 vers /dashboard/login confirmée.");

		// Test /dashboard/api/summary sans authentification -> 401
		console.log("\n[Test 5] Vérification de la protection de l'API /dashboard/api/summary...");
		res = await request("/dashboard/api/summary");
		assert.strictEqual(res.status, 401);
		console.log("-> Accès refusé 401 pour requête non authentifiée.");

		// Test mauvais mot de passe
		console.log("\n[Test 6] Tentative de connexion avec mauvais mot de passe...");
		res = await request("/dashboard/api/login", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ password: "wrongpassword" }),
		});
		assert.strictEqual(res.status, 401);
		console.log("-> Connexion refusée 401 avec mauvais mot de passe.");

		// Test bon mot de passe
		console.log("\n[Test 7] Tentative de connexion avec BON mot de passe...");
		res = await request("/dashboard/api/login", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ password: "MonSuperMotDePasse123" }),
		});
		assert.strictEqual(res.status, 200);
		const loginData = JSON.parse(res.body);
		assert(loginData.success === true);
		assert(loginData.token);
		const cookieHeader = res.headers["set-cookie"];
		assert(cookieHeader && cookieHeader[0].includes("w_suggest_token"));
		const tokenCookie = cookieHeader[0].split(";")[0];
		console.log("-> Connexion réussie 200 OK avec token reçu et cookie HTTP-Only !");

		// Test /dashboard/api/summary AVEC cookie
		console.log("\n[Test 8] Appel de /dashboard/api/summary AVEC cookie d'authentification...");
		res = await request("/dashboard/api/summary", {
			headers: { Cookie: tokenCookie },
		});
		assert.strictEqual(res.status, 200);
		const summary = JSON.parse(res.body);
		assert(summary.system);
		assert(summary.uptime);
		assert(summary.traffic);
		assert(summary.cache);
		console.log("-> Résumé complet reçu :", {
			node: summary.system.nodeVersion,
			heapUsedMB: summary.system.memory.heapUsedMB,
			totalRequests: summary.traffic.total,
			cacheHitRatio: summary.cache.hitRatio,
		});

		// Test /dashboard/api/cache/clear AVEC cookie
		console.log("\n[Test 9] Test de l'action Vider le cache (/dashboard/api/cache/clear)...");
		res = await request("/dashboard/api/cache/clear", {
			method: "POST",
			headers: { Cookie: tokenCookie },
		});
		assert.strictEqual(res.status, 200);
		const clearRes = JSON.parse(res.body);
		assert(clearRes.success === true);
		console.log("-> Cache vidé avec succès.");

		// Test /dashboard/api/logout
		console.log("\n[Test 10] Test de la déconnexion (/dashboard/api/logout)...");
		res = await request("/dashboard/api/logout", {
			method: "POST",
		});
		assert.strictEqual(res.status, 200);
		console.log("-> Déconnexion réussie.");

		console.log("\n============================================");
		console.log("✅ TOUS LES TESTS DU DASHBOARD SONT VALIDÉS !");
		console.log("============================================");
	} finally {
		server.close();
	}
}

runTests().catch((err) => {
	console.error("❌ Échec des tests :", err);
	process.exit(1);
});
