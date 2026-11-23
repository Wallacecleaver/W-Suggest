// Set behavior of the installation buttons
document.addEventListener("DOMContentLoaded", () => {
	const forCopyInput = document.getElementById("forCopy");
	const form = document.getElementById("configForm");
	const nicknameInput = document.getElementById("nickname");
	const copyManifestBtn = document.getElementById("copyManifestBtn");

	nicknameInput.addEventListener("input", () => nicknameInput.setCustomValidity(""));

	function validateForm() {
		const nickname = nicknameInput.value.trim();
		const validNickname = nickname.length >= 2 && nickname.length <= 32 && !/[\u0000-\u001f\u007f-\u009f]/.test(nickname);
		nicknameInput.value = nickname;
		nicknameInput.setCustomValidity(validNickname ? "" : "Saisis un pseudo de 2 à 32 caractères.");
		if (!form.reportValidity()) return false;

		if (validateApiKeys()) return true;
		alert("Vérifie toutes les clés API saisies avant de continuer.");
		return false;
	}

	form.addEventListener("submit", (event) => {
		forCopyInput.value = "false";
		if (!validateForm()) event.preventDefault();
	});

	copyManifestBtn.addEventListener("click", async function (e) {
		e.preventDefault(); // stop form submission

		if (!validateForm()) return;

		forCopyInput.value = "true";
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

			const data = await response.json();
			if (!response.ok) {
				alert(data.error || "Impossible de copier le lien d’installation. Réessaie.");
				return;
			}
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
