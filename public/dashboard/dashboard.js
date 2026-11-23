// State
let refreshInterval = null;
let isRefreshing = false;
let currentTab = "overview";

// DOM Elements
document.addEventListener("DOMContentLoaded", () => {
	setupTabs();
	setupAutoRefresh();
	setupEventListeners();
	loadAllDashboardData();
});

// Setup navigation tabs
function setupTabs() {
	const tabs = document.querySelectorAll(".tab-btn");
	tabs.forEach((tab) => {
		tab.addEventListener("click", () => {
			const target = tab.dataset.tab;
			currentTab = target;

			tabs.forEach((t) => t.classList.remove("active"));
			tab.classList.add("active");

			document.querySelectorAll(".tab-content").forEach((section) => {
				section.style.display = "none";
			});

			const activeSection = document.getElementById(`tab-${target}`);
			if (activeSection) {
				activeSection.style.display = "block";
			}

			if (target === "logs") {
				loadLogs();
			} else if (target === "traffic") {
				loadMetrics();
			} else if (target === "health") {
				loadHealth();
			} else if (target === "cache") {
				loadCacheDetails();
			}
		});
	});
}

function setupAutoRefresh() {
	const toggle = document.getElementById("autoRefreshToggle");
	if (!toggle) return;

	function updateTimer() {
		if (toggle.checked) {
			if (!refreshInterval) {
				refreshInterval = setInterval(() => {
					loadAllDashboardData();
				}, 5000);
			}
		} else {
			if (refreshInterval) {
				clearInterval(refreshInterval);
				refreshInterval = null;
			}
		}
	}

	toggle.addEventListener("change", updateTimer);
	updateTimer();
}

function setupEventListeners() {
	// Manual Refresh Button
	const refreshBtn = document.getElementById("refreshBtn");
	if (refreshBtn) {
		refreshBtn.addEventListener("click", () => {
			loadAllDashboardData();
			showToast("Données actualisées");
		});
	}

	// Logout Button
	const logoutBtn = document.getElementById("logoutBtn");
	if (logoutBtn) {
		logoutBtn.addEventListener("click", async () => {
			if (!confirm("Voulez-vous vous déconnecter du dashboard ?")) return;
			try {
				await fetch("/dashboard/api/logout", { method: "POST" });
				window.location.href = "/dashboard/login";
			} catch (e) {
				window.location.href = "/dashboard/login";
			}
		});
	}

	// Clear Cache Button
	const clearCacheBtn = document.getElementById("clearCacheBtn");
	if (clearCacheBtn) {
		clearCacheBtn.addEventListener("click", async () => {
			if (!confirm("Êtes-vous sûr de vouloir vider le cache ?")) return;
			clearCacheBtn.disabled = true;
			try {
				const res = await fetch("/dashboard/api/cache/clear", { method: "POST" });
				const data = await res.json();
				if (data.success) {
					showToast("Cache vidé avec succès !");
					loadCacheDetails();
					loadSummary();
				}
			} catch (err) {
				showToast("Erreur lors de la purge du cache", "error");
			} finally {
				clearCacheBtn.disabled = false;
			}
		});
	}

	// Log viewer controls
	const logFileSelect = document.getElementById("logFileSelect");
	const logLevelSelect = document.getElementById("logLevelSelect");
	const reloadLogsBtn = document.getElementById("reloadLogsBtn");
	const clearLogsBtn = document.getElementById("clearLogsBtn");

	if (logFileSelect) logFileSelect.addEventListener("change", () => loadLogs());
	if (logLevelSelect) logLevelSelect.addEventListener("change", () => loadLogs());
	if (reloadLogsBtn) reloadLogsBtn.addEventListener("click", () => loadLogs());

	if (clearLogsBtn) {
		clearLogsBtn.addEventListener("click", async () => {
			const file = logFileSelect.value;
			if (!confirm(`Effacer le contenu de ${file} ?`)) return;
			try {
				const res = await fetch("/dashboard/api/logs/clear", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ file }),
				});
				const data = await res.json();
				if (data.success) {
					showToast(`Fichier ${file} effacé`);
					loadLogs();
				}
			} catch (err) {
				showToast("Erreur lors de l'effacement", "error");
			}
		});
	}

	// Key Tester Form
	const testKeyForm = document.getElementById("testKeyForm");
	if (testKeyForm) {
		testKeyForm.addEventListener("submit", async (e) => {
			e.preventDefault();
			const source = document.getElementById("testKeySource").value;
			const key = document.getElementById("testKeyValue").value.trim();
			const resultBox = document.getElementById("testKeyResult");
			const submitBtn = document.getElementById("testKeySubmit");

			if (!key) return;

			submitBtn.disabled = true;
			submitBtn.textContent = "Test en cours...";
			resultBox.style.display = "none";

			try {
				const res = await fetch("/dashboard/api/test-key", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ source, key }),
				});
				const data = await res.json();

				resultBox.style.display = "block";
				if (data.valid) {
					resultBox.className = "card-panel";
					resultBox.style.borderColor = "#10b981";
					resultBox.innerHTML = `
						<div style="color: #34d399; font-weight: 600; margin-bottom: 6px;">✅ Clé API Valide !</div>
						<div style="font-size: 13px; color: #94a3b8;">La clé pour <strong>${source.toUpperCase()}</strong> a été vérifiée avec succès par les serveurs distants.</div>
					`;
				} else {
					resultBox.className = "card-panel";
					resultBox.style.borderColor = "#ef4444";
					resultBox.innerHTML = `
						<div style="color: #f87171; font-weight: 600; margin-bottom: 6px;">❌ Clé API Invalide</div>
						<div style="font-size: 13px; color: #94a3b8;">La vérification a échoué : ${data.error || "Clé incorrecte ou rejetée"}</div>
					`;
				}
			} catch (err) {
				resultBox.style.display = "block";
				resultBox.style.borderColor = "#ef4444";
				resultBox.innerHTML = `<div style="color: #f87171;">Erreur lors du test : ${err.message}</div>`;
			} finally {
				submitBtn.disabled = false;
				submitBtn.textContent = "Tester la clé";
			}
		});
	}
}

// Load all main data
async function loadAllDashboardData() {
	if (isRefreshing) return;
	isRefreshing = true;

	try {
		await loadSummary();
		if (currentTab === "traffic") await loadMetrics();
		if (currentTab === "logs") await loadLogs();
		if (currentTab === "health") await loadHealth();
		if (currentTab === "cache") await loadCacheDetails();
	} finally {
		isRefreshing = false;
	}
}

// Load summary overview
async function loadSummary() {
	try {
		const res = await fetch("/dashboard/api/summary");
		if (res.status === 401) {
			window.location.href = "/dashboard/login";
			return;
		}
		const data = await res.json();

		// Uptime
		document.getElementById("valUptime").textContent = data.uptime.formatted;

		// Memory
		document.getElementById("valMemory").textContent = `${data.system.memory.heapUsedMB} Mo`;
		document.getElementById("valMemorySub").textContent = `RSS: ${data.system.memory.rssMB} Mo / Total: ${data.system.memory.heapTotalMB} Mo`;

		// Traffic Total
		document.getElementById("valRequests").textContent = data.traffic.total.toLocaleString();
		document.getElementById("valAvgLatency").textContent = `${data.traffic.responseTimes.avgMs} ms (moyenne)`;

		// Cache
		document.getElementById("valCacheHitRatio").textContent = data.cache.hitRatio;
		document.getElementById("valCacheSub").textContent = `${data.cache.hits} hits / ${data.cache.misses} misses (${data.cache.localSize} entrées)`;

		// Breakdown bars in Overview
		const total = data.traffic.total || 1;
		const routes = data.traffic.routes || {};

		updateBar("catalog", routes.catalog || 0, total);
		updateBar("stream", routes.stream || 0, total);
		updateBar("meta", routes.meta || 0, total);
		updateBar("manifest", routes.manifest || 0, total);
		updateBar("configure", routes.configure || 0, total);
		updateBar("dashboard", routes.dashboard || 0, total);

		// Environment Overview
		document.getElementById("envPort").textContent = data.environment.port;
		document.getElementById("envLogging").textContent = data.environment.loggingEnabled ? "Activé" : "Désactivé";
		document.getElementById("envEncryption").textContent = data.environment.encryptionEnabled ? "Chiffré (Clé active)" : "Non chiffré";
		document.getElementById("envCacheType").textContent = data.cache.useRedis ? "Redis" : "Mémoire locale (Map)";
		document.getElementById("envNodeVer").textContent = data.system.nodeVersion;
		document.getElementById("envGeminiModel").textContent = data.environment.geminiModel || "gemini-2.5-flash-lite";

	} catch (err) {
		console.error("Error loading summary:", err);
	}
}

function updateBar(key, count, total) {
	const countEl = document.getElementById(`count-${key}`);
	const fillEl = document.getElementById(`fill-${key}`);
	if (countEl) countEl.textContent = count;
	if (fillEl) {
		const pct = Math.min(100, Math.round((count / Math.max(1, total)) * 100));
		fillEl.style.width = `${pct}%`;
	}
}

// Load detailed metrics
async function loadMetrics() {
	try {
		const res = await fetch("/dashboard/api/metrics");
		const data = await res.json();

		const tbody = document.getElementById("recentRequestsTableBody");
		if (!tbody) return;

		if (!data.traffic.recentRequests || data.traffic.recentRequests.length === 0) {
			tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 24px;">Aucune requête enregistrée pour l'instant</td></tr>`;
			return;
		}

		tbody.innerHTML = data.traffic.recentRequests
			.map((req) => {
				const date = new Date(req.timestamp).toLocaleTimeString();
				const statusClass = `badge-${Math.floor(req.status / 100)}xx`;

				return `
					<tr>
						<td style="color: var(--text-muted); font-size: 12px;">${date}</td>
						<td><span class="badge badge-method">${req.method}</span></td>
						<td style="font-family: monospace; max-width: 380px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${req.path}">${req.path}</td>
						<td><span class="badge ${statusClass}">${req.status}</span></td>
						<td style="font-weight: 600;">${req.durationMs} ms</td>
					</tr>
				`;
			})
			.join("");
	} catch (err) {
		console.error("Error loading metrics:", err);
	}
}

// Load cache details
async function loadCacheDetails() {
	try {
		const res = await fetch("/dashboard/api/cache");
		const data = await res.json();

		document.getElementById("cacheDetailHits").textContent = data.hits;
		document.getElementById("cacheDetailMisses").textContent = data.misses;
		document.getElementById("cacheDetailSets").textContent = data.sets;
		document.getElementById("cacheDetailRatio").textContent = data.hitRatio;
		document.getElementById("cacheDetailSize").textContent = `${data.localSize} / ${data.maxLocalSize}`;
		document.getElementById("cacheDetailBackend").textContent = data.useRedis ? "Redis" : "In-Memory (Local Map)";

		const keysContainer = document.getElementById("cacheRecentKeys");
		if (keysContainer) {
			if (!data.recentKeys || data.recentKeys.length === 0) {
				keysContainer.innerHTML = `<div style="color: var(--text-muted); font-size: 13px;">Aucune clé en cache actuellement.</div>`;
			} else {
				keysContainer.innerHTML = data.recentKeys
					.map(
						(k) =>
							`<div style="background: var(--bg-card); padding: 6px 12px; border-radius: 6px; font-family: monospace; font-size: 12px; margin-bottom: 6px; word-break: break-all;">${k}</div>`
					)
					.join("");
			}
		}
	} catch (err) {
		console.error("Error loading cache details:", err);
	}
}

// Load logs
async function loadLogs() {
	try {
		const file = document.getElementById("logFileSelect")?.value || "app.log";
		const level = document.getElementById("logLevelSelect")?.value || "ALL";

		const res = await fetch(`/dashboard/api/logs?file=${encodeURIComponent(file)}&level=${encodeURIComponent(level)}&limit=150`);
		const data = await res.json();

		const terminal = document.getElementById("logTerminal");
		if (!terminal) return;

		if (!data.entries || data.entries.length === 0) {
			terminal.innerHTML = `<div style="color: #64748b; padding: 20px; text-align: center;">Aucune entrée de journal trouvée (${data.message || "vide"}).</div>`;
			return;
		}

		terminal.innerHTML = data.entries
			.map((entry) => {
				const time = entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : "";
				const lvl = entry.level || "INFO";
				const dataStr = entry.data ? `<span style="color: #94a3b8;"> ${JSON.stringify(entry.data)}</span>` : "";

				return `
					<div class="log-entry">
						<span class="log-time">[${time}]</span>
						<span class="log-lvl-${lvl}">${lvl}</span>
						<span>${escapeHtml(entry.message || "")}</span>
						${dataStr}
					</div>
				`;
			})
			.join("");
	} catch (err) {
		console.error("Error loading logs:", err);
	}
}

// Load health status
async function loadHealth() {
	try {
		const res = await fetch("/dashboard/api/health");
		const data = await res.json();

		const container = document.getElementById("providersHealthList");
		if (!container) return;

		container.innerHTML = Object.entries(data)
			.map(([key, provider]) => {
				const isOnline = provider.status === "online";
				const isDegraded = provider.status === "degraded";
				const dotClass = isOnline ? "dot-green" : isDegraded ? "dot-yellow" : "dot-red";
				const statusText = isOnline
					? provider.latencyMs
						? `En ligne (${provider.latencyMs} ms)`
						: "Opérationnel"
					: isDegraded
					? "Dégradé"
					: "Inaccessible";

				return `
					<div class="provider-card">
						<div>
							<div class="provider-name">${provider.name}</div>
							<div style="font-size: 11px; color: var(--text-muted);">${key.toUpperCase()}</div>
						</div>
						<div class="provider-status">
							<span class="dot-status ${dotClass}"></span>
							<span class="${isOnline ? "status-online" : "status-offline"}">${statusText}</span>
						</div>
					</div>
				`;
			})
			.join("");
	} catch (err) {
		console.error("Error loading health:", err);
	}
}

function showToast(message, type = "success") {
	let container = document.getElementById("toastContainer");
	if (!container) {
		container = document.createElement("div");
		container.id = "toastContainer";
		container.className = "toast-container";
		document.body.appendChild(container);
	}

	const toast = document.createElement("div");
	toast.className = "toast";
	if (type === "error") {
		toast.style.borderLeftColor = "#ef4444";
	}
	toast.textContent = message;

	container.appendChild(toast);
	setTimeout(() => {
		toast.remove();
	}, 3500);
}

function escapeHtml(str) {
	if (typeof str !== "string") return str;
	return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
