document.addEventListener("DOMContentLoaded", () => {
	const form = document.getElementById("configForm");
	const nicknameInput = document.getElementById("nickname");
	const installationStatus = document.getElementById("installationStatus");
	const installBtn = document.getElementById("installBtn");
	const copyManifestBtn = document.getElementById("copyManifestBtn");
	const stremioLaunchLink = document.getElementById("stremioLaunchLink");
	let saving = false;

	form.noValidate = true;
	form.addEventListener("input", () => { stremioLaunchLink.hidden = true; });
	nicknameInput.addEventListener("input", () => nicknameInput.setCustomValidity(""));

	function showInstallationError(message) {
		if (message) installationStatus.textContent = message;
		installationStatus.classList.remove("is-ready");
		installationStatus.classList.add("has-error");
		installationStatus.focus();
	}

	form.addEventListener("submit", async (event) => {
		event.preventDefault();
		if (saving) return;
		stremioLaunchLink.hidden = true;
		if (!updateInstallationState()) {
			showInstallationError();
			return;
		}

		const nickname = nicknameInput.value.trim();
		const validNickname = nickname.length >= 2 && nickname.length <= 32 && !/[\u0000-\u001f\u007f-\u009f]/.test(nickname);
		nicknameInput.value = nickname;
		nicknameInput.setCustomValidity(validNickname ? "" : "Saisis un pseudo de 2 à 32 caractères.");
		if (!form.reportValidity()) return;

		const forCopy = event.submitter === copyManifestBtn;
		const payload = Object.fromEntries(new FormData(form));
		payload.forCopy = forCopy ? "true" : "false";
		saving = true;
		installBtn.disabled = true;
		copyManifestBtn.disabled = true;

		try {
			const response = await fetch("/saveConfig", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});
			const data = await response.json();
			if (!response.ok) {
				showInstallationError(data.error || "Impossible d’enregistrer la configuration. Réessaie.");
				return;
			}

			if (!forCopy && typeof data.installUrl === "string" && data.installUrl.startsWith("stremio://")) {
				stremioLaunchLink.href = data.installUrl;
				stremioLaunchLink.hidden = false;
				window.location.href = data.installUrl;
				return;
			}
			if (!forCopy || !data.manifestUrl) throw new Error("Missing installation URL");

			const manifestBox = document.getElementById("manifestUrlBox");
			const manifestInput = document.getElementById("manifestUrlDisplay");
			const manifestHint = document.getElementById("manifestHint");
			manifestInput.value = data.manifestUrl;
			manifestBox.classList.remove("hidden");

			try {
				await navigator.clipboard.writeText(data.manifestUrl);
				manifestHint.textContent = "Lien copié. Colle-le dans la barre de recherche des extensions de Stremio.";
				window.open(data.manifestUrl, "_blank", "noopener");
			} catch {
				manifestHint.textContent = "Copie ce lien et colle-le dans la barre de recherche des extensions de Stremio.";
				manifestInput.select();
			}
		} catch {
			showInstallationError("Impossible d’enregistrer la configuration. Réessaie.");
		} finally {
			saving = false;
			installBtn.disabled = false;
			copyManifestBtn.disabled = false;
		}
	});
});
