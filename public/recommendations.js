const get = (id) => document.getElementById(id);
const params = new URLSearchParams(location.hash.slice(1));
const config = params.get("config");
const type = params.get("type");
const id = params.get("id");

function stremioLink(item) {
	return `https://web.stremio.com/#/detail/${encodeURIComponent(item.type)}/${encodeURIComponent(item.id)}`;
}

function setImage(image, value) {
	if (typeof value !== "string" || !/^https?:\/\//i.test(value)) return;
	image.src = value;
	image.hidden = false;
	image.addEventListener("error", () => { image.hidden = true; }, { once: true });
}

function createCard(item) {
	const card = document.createElement("li");
	const link = document.createElement("a");
	link.href = stremioLink(item);
	const poster = document.createElement("img");
	poster.className = "poster";
	poster.alt = "";
	poster.loading = "lazy";
	poster.hidden = true;
	setImage(poster, item.poster);

	const name = document.createElement("span");
	name.textContent = item.name;
	link.append(poster, name);
	if (item.year) {
		const year = document.createElement("small");
		year.textContent = item.year;
		link.append(year);
	}
	card.append(link);
	return card;
}

function render({ title, recommendations }) {
	document.title = `${title.name} · W Suggest`;
	get("title").textContent = title.name;
	get("summary").textContent = title.description || "";
	get("facts").textContent = [
		title.type === "movie" ? "Film" : "Série",
		title.year,
		title.rating ? `IMDb ${title.rating}` : "",
		...(Array.isArray(title.genres) ? title.genres.slice(0, 3) : []),
	].filter(Boolean).join(" · ");
	get("original").href = stremioLink(title);
	setImage(get("backdrop"), title.background || title.poster);
	get("cards").replaceChildren(...recommendations.map(createCard));
	get("empty").hidden = recommendations.length > 0;
	get("hero").hidden = false;
	get("results").hidden = false;
	get("status").hidden = true;
}

async function load() {
	const status = get("status");
	const retry = get("retry");
	retry.hidden = true;
	status.textContent = "Chargement des recommandations…";
	if (!config || !type || !id) {
		status.textContent = "Pour afficher des suggestions, ouvre cette page depuis le bouton W Suggest dans Stremio.";
		return;
	}
	try {
		const response = await fetch("/api/recommendations", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ config, type, id }),
		});
		const data = await response.json();
		if (!response.ok) {
			status.textContent = data.error || "Impossible de charger les recommandations.";
			retry.hidden = response.status < 500;
			return;
		}
		render(data);
	} catch {
		status.textContent = "Impossible de joindre W Suggest. Réessaie dans un instant.";
		retry.hidden = false;
	}
}

get("retry").addEventListener("click", load);
load();
