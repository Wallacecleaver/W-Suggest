const { catalogHandler } = require("./catalogHandler");
const { generateFullMeta } = require("./metadata");
const idConverter = require("../utils/idConverter");

async function resolveImdbId(id, type, metadataSource) {
	if (id.startsWith("tt")) return id;
	const [provider, numericId] = id.split(":");
	if (provider === "tmdb") {
		return idConverter.tmdbToImdb(numericId, type, metadataSource.tmdbApiKey.key);
	}
	if (provider === "trakt") {
		return (await idConverter.traktToImdbTitleYearType(numericId, type, metadataSource.traktApiKey.key, metadataSource))?.imdbId;
	}
	return (await idConverter.kitsuToImdbTitleYearType(id, metadataSource))?.imdbId;
}

function displayMeta(meta, id, type) {
	return {
		id,
		type,
		name: meta.name || meta.title,
		poster: meta.poster,
		background: meta.background,
		description: meta.description,
		year: meta.year || meta.releaseInfo,
		rating: meta.imdbRating,
		genres: meta.genres,
	};
}

async function recommendationPageData(type, id, userConfig, metadataSource) {
	const imdbId = await resolveImdbId(id, type, metadataSource);
	if (!/^tt\d+$/.test(imdbId || "")) return null;

	const title = await generateFullMeta(imdbId, type, metadataSource);
	if (!title?.name && !title?.title) return null;

	const catalog = await catalogHandler(type, `mlt-combined-${type}-rec`, `search=${imdbId}`, userConfig, metadataSource);
	const ids = [...new Set((catalog?.metas || []).map(({ id }) => id?.replace(/^mlt-meta-/, "")))]
		.filter((id) => /^tt\d+$/.test(id || "") && id !== imdbId)
		.slice(0, 20);

	const results = await Promise.allSettled(ids.map(async (id) => {
		const meta = await generateFullMeta(id, type, metadataSource);
		return meta?.name || meta?.title ? displayMeta(meta, id, type) : null;
	}));
	return {
		title: displayMeta(title, imdbId, type),
		recommendations: results.flatMap((result) => result.status === "fulfilled" && result.value ? [result.value] : []),
	};
}

module.exports = { recommendationPageData };
