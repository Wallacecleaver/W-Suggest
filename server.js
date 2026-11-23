#!/usr/bin/env node

const { streamHandler } = require("./src/streamHandler");
const { recommendationPageData } = require("./src/recommendationPage");
const { metaHandler } = require("./src/metaHandler");
const { catalogHandler } = require("./src/catalogHandler");
const express = require("express");
const cors = require("cors");
const path = require("path");
const logger = require("./utils/logger");
const { PORT, ENCRYPTION_KEY_INPUT } = require("./config");
const { validateApiKeys } = require("./services/api");
const { encryptData, decryptData } = require("./utils/encryption");
const { metricsMiddleware } = require("./src/dashboard/metrics");
const dashboardRouter = require("./src/dashboard/routes");
const packageJson = require("./package.json");

const RECOMMENDATION_SOURCES = ["tmdb", "trakt", "tastedive", "gemini", "watchmode", "simkl"];
const API_KEY_SOURCES = [...RECOMMENDATION_SOURCES, "rpdb"];

async function loadUserConfig(config) {
	const defaultConfig = {
		apiKeys: {
			tmdb: { key: "", valid: false },
			trakt: { key: "", valid: false },
			gemini: { key: "", valid: false },
			watchmode: { key: "", valid: false },
			simkl: { key: "", valid: false },
			tastedive: { key: "", valid: false },
			rpdb: { key: "", valid: false },
		},
		combineCatalogs: false,
		catalogOrder: ["tmdb", "trakt", "simkl", "gemini", "tasteDive", "watchmode"],
		metadataSource: "cinemeta",
		language: "en",
		streamOrder: ["detail", "app", "web", "recs"],
		enabledStreamButtons: {
			detail: false,
			app: false,
			web: false,
			recs: false,
		},
		includeTmdbCollection: false,
		enableTitleSearching: false,
	};

	if (ENCRYPTION_KEY_INPUT) {
		try {
			let userConfig;

			if (typeof config === "string" && config.trim().startsWith("{")) {
				userConfig = JSON.parse(decodeURIComponent(config));
				userConfig = await decryptData(userConfig);
				return userConfig;
			}
		} catch (err) {
			logger.error("Decryption Failed", err);
			return defaultConfig;
		}
	}

	return defaultConfig;
}

async function generateManifest(apiKeys, combine, catalog_order) {
	let catalogs = [];
	const types = ["movie", "series"];

	if (combine === true) {
		types.forEach((type) => {
			catalogs.push({
				type: type,
				id: `mlt-combined-${type}-rec`,
				name: `Similar Recommendations`,
				extra: [{ name: "search", isRequired: true }],
			});
		});
	} else {
		catalog_order.forEach((rawSource) => {
			const source = rawSource.toLowerCase().split(" ")[0];
			if (apiKeys?.[source]?.valid) {
				catalogs.push({
					type: "movie",
					id: `mlt-${source}-movie-rec`,
					name: `${source} Recommendations`,
					extra: [{ name: "search", isRequired: true }],
				});
			}
		});
		catalog_order.forEach((rawSource) => {
			const source = rawSource.toLowerCase().split(" ")[0];
			if (apiKeys?.[source]?.valid) {
				catalogs.push({
					type: "series",
					id: `mlt-${source}-series-rec`,
					name: `${source} Recommendations`,
					extra: [{ name: "search", isRequired: true }],
				});
			}
		});
	}

	const manifest = {
		id: "community.wsuggest",
		version: packageJson.version,
		resources: [
			"catalog",
			"stream",
			{
				name: "meta",
				types: ["movie", "series"],
				idPrefixes: ["mlt-"],
			},
		],
		types: ["movie", "series"],
		name: "W Suggest",
		description: "Shows recommendations from various sources",
		logo: "https://raw.githubusercontent.com/Wallacecleaver/W-Suggest/main/assets/images/logo.png",
		idPrefixes: [""],
		behaviorHints: {
			configurable: true,
		},
		catalogs: catalogs,
	};

	return manifest;
}

async function startServer() {
	const app = express();

	// Middle Ware
	app.use(
		cors({
			origin: "*",
			methods: "*",
			allowedHeaders: "*",
		}),
	); // Apply CORS middleware to all routes

	app.use(express.json()); // Middleware to parse JSON bodies

	app.use(express.urlencoded({ extended: true })); // Middleware to parse URL-encoded bodies

	app.use(metricsMiddleware); // Dashboard & traffic metrics tracker

	// Dashboard routes
	app.use("/dashboard", dashboardRouter);

	app.use(express.static(path.join(__dirname, "public"))); // Serve static files

	// Main route - redirect to configure
	app.get("/", async function (_, res) {
		res.redirect("/configure");
	});

	app.get("/configure", (req, res) => {
		res.sendFile(path.join(__dirname, "public", "configure.html"));
	});

	app.get("/:userConfig/configure", async (req, res) => {
		try {
			let userConfig = await loadUserConfig(req.params.userConfig);
			userConfig = encodeURIComponent(JSON.stringify(userConfig));
			res.redirect(`/configure?data=${userConfig}`);
		} catch (error) {
			// If parsing fails, serve the default configure page
			res.redirect("/configure");
		}
	});

	app.get("/manifest.json", async (req, res) => {
		let manifest = await generateManifest({}, false, []); // Default Manifest

		res.json(manifest);
	});

	app.get("/:userConfig/manifest.json", async (req, res) => {
		let manifest = "";
		try {
			const userConfig = await loadUserConfig(req.params.userConfig);
			manifest = await generateManifest(userConfig.apiKeys, userConfig.combineCatalogs, userConfig.catalogOrder);
		} catch (err) {
			manifest = await generateManifest({}, false, []); // Default Manifest
		}
		res.json(manifest);
	});

	app.get("/:userConfig/catalog/:type/:id/:extra?.json", async (req, res) => {
		const userConfig = await loadUserConfig(req.params.userConfig);

		// Retreieve and format meta data source
		const metadataSource = {
			source: userConfig.metadataSource === "tmdb" && userConfig.apiKeys.tmdb.valid ? "tmdb" : "cinemeta",
			tmdbApiKey: userConfig.apiKeys.tmdb,
			traktApiKey: userConfig.apiKeys.trakt,
			language: userConfig.language,
			keepEnglishPosters: userConfig.keepEnglishPosters,
		};

		const catalog = (await catalogHandler(req.params.type, req.params.id, req.params.extra, userConfig, metadataSource)) || [];
		res.json(catalog);
	});

	app.get("/:userConfig/stream/:type/:id.json", async (req, res) => {
		const userConfig = await loadUserConfig(req.params.userConfig);

		// Retreieve and format meta data source
		const metadataSource = {
			source: userConfig.metadataSource === "tmdb" && userConfig.apiKeys.tmdb.valid ? "tmdb" : "cinemeta",
			tmdbApiKey: userConfig.apiKeys.tmdb,
			traktApiKey: userConfig.apiKeys.trakt,
			language: userConfig.language,
			keepEnglishPosters: userConfig.keepEnglishPosters,
		};

		const host = req.get("host");
		const protocol = /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host) ? "http" : "https";
		const pageUrl = ENCRYPTION_KEY_INPUT && host
			? `${protocol}://${host}/recommendations.html`
			: null;
		const streams = await streamHandler(
			req.headers.origin, req.params.type, req.params.id, userConfig, metadataSource,
			pageUrl, req.params.userConfig,
		);
		res.json(streams);
	});

	app.get("/:userConfig/meta/:type/:id.json", async (req, res) => {
		const userConfig = await loadUserConfig(req.params.userConfig);

		// Retreieve and format meta data source
		const metadataSource = {
			source: userConfig.metadataSource === "tmdb" && userConfig.apiKeys.tmdb.valid ? "tmdb" : "cinemeta",
			tmdbApiKey: userConfig.apiKeys.tmdb,
			traktApiKey: userConfig.apiKeys.trakt,
			language: userConfig.language,
			keepEnglishPosters: userConfig.keepEnglishPosters,
		};

		const meta = await metaHandler(req.params.type, req.params.id, userConfig, metadataSource);
		res.json(meta);
	});

	app.post("/api/recommendations", async (req, res) => {
		res.set("Cache-Control", "no-store");
		const { config, type, id } = req.body || {};
		if (typeof config !== "string" || !["movie", "series"].includes(type) ||
			typeof id !== "string" || !/^(tt\d+|(?:tmdb|trakt|kitsu):\d+)$/.test(id)) {
			return res.status(400).json({ error: "Lien de recommandations invalide." });
		}

		try {
			const userConfig = await loadUserConfig(config);
			if (!userConfig.enabledStreamButtons?.recs) {
				return res.status(403).json({ error: "Ouvre la page depuis le bouton W Suggest dans Stremio." });
			}
			const metadataSource = {
				source: userConfig.metadataSource === "tmdb" && userConfig.apiKeys.tmdb.valid ? "tmdb" : "cinemeta",
				tmdbApiKey: userConfig.apiKeys.tmdb,
				traktApiKey: userConfig.apiKeys.trakt,
				language: userConfig.language,
				keepEnglishPosters: userConfig.keepEnglishPosters,
			};
			const data = await recommendationPageData(type, id, userConfig, metadataSource);
			if (!data) return res.status(404).json({ error: "Ce titre est introuvable." });
			return res.json(data);
		} catch (error) {
			logger.error("Recommendation page failed", error);
			return res.status(502).json({ error: "Impossible de charger les recommandations pour le moment." });
		}
	});

	app.post("/saveConfig", async (req, res) => {
		const forCopy = req.body?.forCopy === "true";
		const rejectConfig = (error) => {
			if (forCopy) return res.status(400).json({ error });
			return res.status(400).send(error);
		};
		const nickname = typeof req.body?.nickname === "string" ? req.body.nickname.trim() : "";
		if (nickname.length < 2 || nickname.length > 32 || /[\u0000-\u001f\u007f-\u009f]/.test(nickname)) {
			return rejectConfig("Saisis un pseudo de 2 à 32 caractères.");
		}

		try {
			const submittedKeys = {};
			for (const source of API_KEY_SOURCES) {
				const key = req.body[`${source}ApiKey`];
				if (key != null && typeof key !== "string") return rejectConfig("Format de clé API invalide.");
				submittedKeys[source] = key?.trim() || "";
			}

			if (!RECOMMENDATION_SOURCES.some((source) => submittedKeys[source])) {
				return rejectConfig("Ajoute et vérifie au moins une clé de recommandation.");
			}

			const results = await validateApiKeys(submittedKeys);
			const apiKeys = {};
			for (const [source, key] of Object.entries(submittedKeys)) {
				if (key && results[source]?.valid !== true) {
					return rejectConfig("Impossible de valider toutes les clés saisies. Vérifie-les dans la configuration, puis réessaie.");
				}
				apiKeys[source] = { key, valid: Boolean(key) };
			}

			const metadataSource = req.body.metadataSource || null;

			// Get user config
			const config = {
				nickname,
				apiKeys: apiKeys,
				combineCatalogs: req.body.combineCatalogs === "on" || false,
				catalogOrder: req.body.catalogOrder.split(",") || ["tmdb", "trakt", "simkl", "gemini", "tasteDive", "watchmode"],
				metadataSource: metadataSource,
				language: metadataSource === "tmdb" ? req.body.language || "en" : "en",
				keepEnglishPosters: req.body.keepEnglishPoster === "on" || false,
				streamOrder: req.body.streamOrder.split(",") || ["detail", "app", "web", "recs"],
				enabledStreamButtons: {
					detail: req.body.streamDetailEnabled === "on" || false,
					app: req.body.streamAppEnabled === "on" || false,
					web: req.body.streamWebEnabled === "on" || false,
					recs: req.body.streamRecEnabled === "on" || false,
				},
				includeTmdbCollection: req.body.includeTmdbCollection === "on" || false,
				enableTitleSearching: req.body.enableTitleSearching === "on" || false,
			};

			let userConfig;
			if (ENCRYPTION_KEY_INPUT) {
				const encryptedObject = await encryptData(config);
				userConfig = encodeURIComponent(JSON.stringify(encryptedObject));
			} else {
				userConfig = encodeURIComponent(JSON.stringify(config));
			}

			// Build manifest URL and redirect
			let host = req.headers.host;
			if (host === "w-suggest") {
				host = host + ".baby-beamup.club";
			}

			const isLocalhost = host.startsWith("localhost") || host.startsWith("127.0.0.1");
			const protocol = isLocalhost ? "http" : "https";

			const manifestUrl = `${protocol}://${host}/${userConfig}/manifest.json`;

			if (forCopy) {
				return res.json({ manifestUrl });
			}

			return res.redirect(`stremio://${host}/${userConfig}/manifest.json`);
		} catch (error) {
			return rejectConfig("Impossible d’enregistrer la configuration. Réessaie.");
		}
	});

	app.post("/verifyKey", async (req, res) => {
		try {
			const { source, key } = req.body || {};
			if (!API_KEY_SOURCES.includes(source) || typeof key !== "string" || !key.trim()) {
				return res.status(400).json({ valid: false, error: "Source ou clé API invalide." });
			}

			const result = await validateApiKeys({ [source]: key.trim() });
			res.json({ valid: result[source]?.valid === true, error: result[source]?.error });
		} catch (err) {
			res.status(500).json({ valid: false, error: "Server error during validation" });
		}
	});

	app.listen(PORT, () => {
		console.log(`W-Suggest running on port ${PORT}`);
		console.log(`Configure: http://localhost:${PORT}/configure`);
		console.log(`Dashboard: http://localhost:${PORT}/dashboard`);
	});
}

startServer();
