const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const dbPath = path.join(__dirname, "..", "data", "id_map.db");
const jsonPath = path.join(__dirname, "..", "data", "watchmode_title_id_map.json");

// Build SQLite DB if not present
if (!fs.existsSync(dbPath) && fs.existsSync(jsonPath)) {
	try {
		const buildScript = require("../scripts/build-id-db");
		if (typeof buildScript === "function") {
			buildScript();
		}
	} catch (err) {
		console.error("Failed to auto-build id_map.db:", err);
	}
}

let db = null;
let stmtByImdb = null;
let stmtByTmdbMovie = null;
let stmtByTmdbSeries = null;
let stmtByWatchmode = null;

if (fs.existsSync(dbPath)) {
	try {
		db = new Database(dbPath, { readonly: true });
		stmtByImdb = db.prepare(
			"SELECT tmdb_id AS tmdbId, type, watchmode_id AS watchmodeId FROM id_map WHERE imdb_id = ?"
		);
		stmtByTmdbMovie = db.prepare(
			"SELECT imdb_id AS imdbId, type, watchmode_id AS watchmodeId FROM id_map WHERE tmdb_id = ? AND type = 'movie'"
		);
		stmtByTmdbSeries = db.prepare(
			"SELECT imdb_id AS imdbId, type, watchmode_id AS watchmodeId FROM id_map WHERE tmdb_id = ? AND type = 'tv'"
		);
		stmtByWatchmode = db.prepare(
			"SELECT imdb_id AS imdbId, tmdb_id AS tmdbId, type FROM id_map WHERE watchmode_id = ?"
		);
	} catch (err) {
		console.error("Failed to initialize SQLite ID map:", err);
	}
}

const idMapByImdb = new Proxy(
	{},
	{
		get(target, prop) {
			if (!stmtByImdb || typeof prop !== "string") return undefined;
			return stmtByImdb.get(prop) || undefined;
		},
	}
);

const idMapByTmdbMovie = new Proxy(
	{},
	{
		get(target, prop) {
			if (!stmtByTmdbMovie || typeof prop !== "string") return undefined;
			return stmtByTmdbMovie.get(prop) || undefined;
		},
	}
);

const idMapByTmdbSeries = new Proxy(
	{},
	{
		get(target, prop) {
			if (!stmtByTmdbSeries || typeof prop !== "string") return undefined;
			return stmtByTmdbSeries.get(prop) || undefined;
		},
	}
);

const idMapByWatchmode = new Proxy(
	{},
	{
		get(target, prop) {
			if (!stmtByWatchmode || typeof prop !== "string") return undefined;
			return stmtByWatchmode.get(prop) || undefined;
		},
	}
);

module.exports = {
	idMapByWatchmode,
	idMapByImdb,
	idMapByTmdbMovie,
	idMapByTmdbSeries,
};
