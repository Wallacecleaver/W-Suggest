const apiKeySources = ["tmdb", "trakt", "gemini", "tastedive", "watchmode", "simkl", "rpdb"];
const activeVerifications = new WeakMap();
const verifiedKeys = new WeakMap();

function updateInstallationState() {
	let hasVerifiedSource = false;
	let hasUnverifiedKey = false;

	for (const source of apiKeySources) {
		const input = document.getElementById(`${source}ApiKey`);
		const key = input.value.trim();
		if (!key) continue;

		const verified = verifiedKeys.get(input) === key;
		if (verified && source !== "rpdb") hasVerifiedSource = true;
		if (!verified) hasUnverifiedKey = true;
	}

	const ready = hasVerifiedSource && !hasUnverifiedKey;
	document.getElementById("installBtn").disabled = !ready;
	document.getElementById("copyManifestBtn").disabled = !ready;

	const status = document.getElementById("installationStatus");
	const message = ready
		? "Clés vérifiées. Tu peux installer W Suggest."
		: hasVerifiedSource
			? "Vérifie les autres clés saisies ou efface-les pour continuer."
			: "Vérifie une clé de recommandation pour déverrouiller l’installation.";
	status.classList.toggle("is-ready", ready);
	if (status.textContent !== message) status.textContent = message;

	return ready;
}

function resetKeyState(input, button, status) {
	verifiedKeys.delete(input);
	input.removeAttribute("data-valid");
	status.textContent = "";
	status.classList.remove("success", "error");
	button.classList.remove("success", "verifying");
	button.disabled = false;
	button.textContent = "Vérifier";
}

async function verifyApiKey(source) {
	const input = document.getElementById(`${source}ApiKey`);
	const button = document.querySelector(`#${source}ApiKey ~ .verify-btn`);
	const status = document.getElementById(`${source}-verify-status`);
	if (activeVerifications.has(input)) return;

	const key = input.value.trim();
	resetKeyState(input, button, status);
	updateInstallationState();
	if (!key) {
		status.textContent = "Saisis une clé avant de vérifier.";
		status.classList.add("error");
		return;
	}

	const verification = new AbortController();
	activeVerifications.set(input, verification);
	button.classList.add("verifying");
	button.disabled = true;
	button.textContent = "Vérification…";

	try {
		const res = await fetch("/verifyKey", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ source, key }),
			signal: verification.signal,
		});
		const data = await res.json();
		if (activeVerifications.get(input) !== verification || input.value.trim() !== key) return;

		if (res.ok && data.valid === true) {
			verifiedKeys.set(input, key);
			input.setAttribute("data-valid", "true");
			button.classList.add("success");
			status.classList.add("success");
			status.textContent = "Clé vérifiée.";
		} else {
			status.classList.add("error");
			status.textContent = data.error || "Clé invalide.";
		}
	} catch {
		if (activeVerifications.get(input) !== verification) return;
		status.classList.add("error");
		status.textContent = "Impossible de vérifier la clé pour le moment.";
	} finally {
		if (activeVerifications.get(input) === verification) {
			activeVerifications.delete(input);
			button.disabled = false;
			button.classList.remove("verifying");
			button.textContent = "Vérifier";
			updateInstallationState();
		}
	}
}

document.addEventListener("DOMContentLoaded", () => {
	for (const source of apiKeySources) {
		const input = document.getElementById(`${source}ApiKey`);
		const button = document.querySelector(`#${source}ApiKey ~ .verify-btn`);
		const status = document.getElementById(`${source}-verify-status`);

		input.addEventListener("input", () => {
			const verification = activeVerifications.get(input);
			activeVerifications.delete(input);
			verification?.abort();
			resetKeyState(input, button, status);
			updateInstallationState();
		});
	}
	updateInstallationState();
});
