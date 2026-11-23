const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

function buildIdDatabase() {
	const jsonPath = path.join(__dirname, "..", "data", "watchmode_title_id_map.json");
	const dbPath = path.join(__dirname, "..", "data", "id_map.db");

	if (!fs.existsSync(jsonPath)) {
		console.log("No watchmode_title_id_map.json found, skipping build.");
		return;
	}

	console.log("Building SQLite id_map.db from JSON...");
	console.time("id_map_build");

	if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

	const db = new Database(dbPath);
	db.pragma("journal_mode = OFF");
	db.pragma("synchronous = OFF");

	db.exec(`
		CREATE TABLE id_map (
			watchmode_id TEXT,
			imdb_id TEXT,
			tmdb_id TEXT,
			type TEXT
		);
	`);

	const insert = db.prepare("INSERT INTO id_map VALUES (?, ?, ?, ?)");
	const list = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));

	const insertMany = db.transaction((rows) => {
		for (const r of rows) {
			insert.run(String(r.watchmodeID), String(r.imdbID), String(r.tmdbID), String(r.type));
		}
	});

	insertMany(list);

	db.exec(`
		CREATE INDEX idx_imdb ON id_map(imdb_id);
		CREATE INDEX idx_tmdb_type ON id_map(tmdb_id, type);
		CREATE INDEX idx_watchmode ON id_map(watchmode_id);
	`);

	db.pragma("journal_mode = WAL");
	console.timeEnd("id_map_build");
	console.log("Successfully built data/id_map.db");
}

if (require.main === module) {
	buildIdDatabase();
}

module.exports = buildIdDatabase;
