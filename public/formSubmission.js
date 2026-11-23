// Set behavior of the installation buttons
document.addEventListener("DOMContentLoaded", () => {
	const forCopyInput = document.getElementById("forCopy");
	const installBtn = document.getElementById("installBtn");
	const copyManifestBtn = document.getElementById("copyManifestBtn");

	installBtn.addEventListener("click", function () {
		forCopyInput.value = "false";
	});

	copyManifestBtn.addEventListener("click", async function (e) {
		e.preventDefault(); // stop form submission

		if (!validateApiKeys()) {
			alert("Vérifie toutes les clés API saisies avant de continuer.");
			return;
		}

		forCopyInput.value = "true";

		const form = document.querySelector("form");
		const formData = new FormData(form);

		// Convert to plain object
		const plainData = {};
		formData.forEach((value, key) => {
			plainData[key] = value;
		});

		try {
			const response = await fetch("/saveConfig", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(plainData),
			});

			if (!response.ok) throw new Error("Échec de l’enregistrement de la configuration");

			const data = await response.json();
			if (data.manifestUrl) {
				// Show manifest URL box
				const manifestBox = document.getElementById("manifestUrlBox");
				const manifestInput = document.getElementById("manifestUrlDisplay");
				manifestInput.value = data.manifestUrl;
				manifestBox.classList.remove("hidden");

				// Copy to clipboard
				await navigator.clipboard.writeText(data.manifestUrl);

				// Open manifest page in new tab
				window.open(data.manifestUrl, "_blank");
			}
		} catch (err) {
			console.error(err);
			alert("Impossible de copier l’URL du manifest. Réessaie.");
		}
	});
});

document.querySelector("form").addEventListener("submit", function (e) {
	if (!validateApiKeys()) {
		e.preventDefault();
		alert("Vérifie toutes les clés API saisies avant de continuer.");
	}
});

// Function to make sure all inputed API Keys are validated first before submiting form
function validateApiKeys() {
	const sources = ["tmdb", "trakt", "gemini", "tastedive", "watchmode", "simkl", "rpdb"];
	let allValid = true;

	for (const source of sources) {
		const input = document.getElementById(`${source}ApiKey`);
		const apiKey = input?.value.trim();
		const isValid = input?.getAttribute("data-valid") === "true";

		if (apiKey && !isValid) {
			allValid = false;

			const status = document.getElementById(`${source}-verify-status`);
			if (status) {
				status.textContent = "Vérifie cette clé avant de continuer.";
				status.classList.add("error");
			}
		}
	}

	return allValid;
}
