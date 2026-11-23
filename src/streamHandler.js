async function streamHandler(origin, type, metaId, userConfig, metadataSource, pageUrl, config) {
	// Parse for proper ids to search
	let searchId = metaId.startsWith("mlt") ? metaId.split("-").slice(2).join("-") : metaId;

	// Remove season/episode info if exists
	if (searchId.startsWith("tt")) {
		searchId = searchId.split(":")[0];
	} else if (searchId.startsWith("kitsu") || searchId.startsWith("tmdb") || searchId.startsWith("trakt")) {
		searchId = searchId.split(":").slice(0, 2).join(":");
	}

	const streamOrder = userConfig.streamOrder || [];
	const enabledStreamButtons = userConfig.enabledStreamButtons || {};

	if (pageUrl && config && enabledStreamButtons.recs && streamOrder.includes("recs") &&
		["movie", "series"].includes(type) && /^(tt\d+|(?:tmdb|trakt|kitsu):\d+)$/.test(searchId)) {
		return {
			streams: [{
				name: "Voir les recommandations",
				description: "Films et séries similaires sur W Suggest",
				externalUrl: `${pageUrl}#${new URLSearchParams({ config, type, id: searchId })}`,
			}],
			cacheMaxAge: 0,
		};
	}

	const stream = [];

	for (let button of streamOrder) {
		if (button === "detail" && enabledStreamButtons.detail) {
			let detailURL;
			if (searchId.startsWith("tt")) {
				if (metadataSource.source === "cinemeta") {
					detailURL = `/detail/${type}/${searchId}`;
				} else {
					detailURL = `/detail/${type}/mlt-meta-${searchId}`;
				}
			} else {
				detailURL = `/detail/${type}/${metaId.split(":").slice(0, 2).join(":")}`;
			}

			const detailButton = {
				name: "W Suggest",
				description: `See details`,
				externalUrl: (origin?.includes("web.stremio.com") ? "https://web.stremio.com/#" : "stremio://") + detailURL,
			};

			stream.push(detailButton);
		} else if (button === "app" && enabledStreamButtons.app) {
			const appSearchButton = {
				name: "W Suggest",
				description: `Search on App`,
				externalUrl: `stremio:///search?search=${searchId}`,
			};

			stream.push(appSearchButton);
		} else if (button === "web" && enabledStreamButtons.web) {
			const webSearchButton = {
				name: "W Suggest",
				description: `Search on Web`,
				externalUrl: `https://web.stremio.com/#/search?search=${searchId}`,
			};

			stream.push(webSearchButton);
		} else if (button === "recs" && enabledStreamButtons.recs) {
			const recsButton = {
				name: "W Suggest",
				description: "Voir les recommandations",
				externalUrl: (origin?.includes("web.stremio.com") ? "https://web.stremio.com/#" : "stremio://") + `/detail/${type}/mlt-rec-${searchId}`,
			};

			stream.push(recsButton);
		}
	}

	return Promise.resolve({
		streams: stream,
		cacheMaxAge: 0,
	});
}

module.exports = {
	streamHandler,
};
