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
			if (!confirm("Te déconnecter du tableau de bord ?")) return;
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
			if (!confirm("Vider tout le cache ? Les prochaines requêtes seront plus lentes le temps qu’il se reconstitue.")) return;
			clearCacheBtn.disabled = true;
			try {
				const res = await fetch("/dashboard/api/cache/clear", { method: "POST" });
				const data = await res.json();
				if (data.success) {
					showToast("Cache vidé");
					loadCacheDetails();
					loadSummary();
				}
			} catch (err) {
				showToast("Impossible de vider le cache", "error");
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
				showToast("Impossible d’effacer le fichier", "error");
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
			submitBtn.textContent = "Test en cours…";
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
					resultBox.className = "result ok";
					resultBox.innerHTML = `${icon("check")}<div><strong>Clé valide</strong><p>La clé ${escapeHtml(source.toUpperCase())} a été acceptée par le service distant.</p></div>`;
				} else {
					resultBox.className = "result err";
					resultBox.innerHTML = `${icon("x")}<div><strong>Clé refusée</strong><p>${escapeHtml(data.error || "La clé est incorrecte ou a été rejetée.")}</p></div>`;
				}
			} catch (err) {
				resultBox.style.display = "block";
				resultBox.className = "result err";
				resultBox.innerHTML = `${icon("x")}<div><strong>Test impossible</strong><p>${escapeHtml(err.message)}</p></div>`;
			} finally {
				submitBtn.disabled = false;
				submitBtn.innerHTML = `${icon("flask")}Tester la clé`;
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
		document.getElementById("valMemorySub").textContent = `RSS : ${data.system.memory.rssMB} Mo · total : ${data.system.memory.heapTotalMB} Mo`;

		// Traffic Total
		document.getElementById("valRequests").textContent = data.traffic.total.toLocaleString("fr-FR");
		document.getElementById("valAvgLatency").textContent = `${data.traffic.responseTimes.avgMs} ms en moyenne`;

		// Cache
		document.getElementById("valCacheHitRatio").textContent = data.cache.hitRatio;
		document.getElementById("valCacheSub").textContent = `${data.cache.hits} succès / ${data.cache.misses} échecs · ${data.cache.localSize} entrées`;

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
		document.getElementById("envEncryption").textContent = data.environment.encryptionEnabled ? "Chiffré" : "Non chiffré";
		document.getElementById("envCacheType").textContent = data.cache.backend || "SQLite";
		document.getElementById("envNodeVer").textContent = data.system.nodeVersion;
		document.getElementById("envGeminiModel").textContent = data.environment.geminiModel || "gemini-2.5-flash-lite";

		// Jauges des indicateurs
		const ratio = parseFloat(String(data.cache.hitRatio).replace(",", ".")) || 0;
		setWidth("gaugeCache", ratio);
		const heapTotal = Number(data.system.memory.heapTotalMB) || 0;
		setWidth("gaugeMemory", heapTotal ? (Number(data.system.memory.heapUsedMB) / heapTotal) * 100 : 0);

		// Réponses HTTP
		renderStatusBar(data.traffic.statusCodes || {});

		const lu = document.getElementById("lastUpdate");
		if (lu) lu.textContent = `Mis à jour à ${new Date().toLocaleTimeString("fr-FR")}`;
	} catch (err) {
		console.error("Error loading summary:", err);
	}
}

function setWidth(id, pct) {
	const el = document.getElementById(id);
	if (el) el.style.width = `${Math.max(0, Math.min(100, Math.round(pct)))}%`;
}

function renderStatusBar(codes) {
	const groups = ["2xx", "3xx", "4xx", "5xx"];
	const total = groups.reduce((n, g) => n + (Number(codes[g]) || 0), 0);
	groups.forEach((g) => {
		const el = document.getElementById(`st-${g}`);
		if (el) el.textContent = (Number(codes[g]) || 0).toLocaleString("fr-FR");
	});
	const bar = document.getElementById("statusBar");
	const meta = document.getElementById("statusTotal");
	if (meta) meta.textContent = total ? `${total.toLocaleString("fr-FR")} réponses` : "";
	if (!bar) return;
	bar.innerHTML = total
		? groups
				.filter((g) => Number(codes[g]) > 0)
				.map((g) => `<i class="s${g[0]}" style="flex:${Number(codes[g])}" title="${g} : ${Number(codes[g])}"></i>`)
				.join("")
		: `<i class="none" style="flex:1"></i>`;
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

		const wrap = document.getElementById("latencyWrap");
		const chart = document.getElementById("latencyChart");
		const reqs = data.traffic.recentRequests || [];

		if (reqs.length === 0) {
			tbody.innerHTML = `<tr><td colspan="5" class="empty">Aucune requête enregistrée pour l’instant.</td></tr>`;
			if (wrap) wrap.style.display = "none";
			return;
		}

		if (wrap && chart) {
			const ordered = reqs.slice(0, 60).reverse();
			const max = Math.max(1, ...ordered.map((r) => Number(r.durationMs) || 0));
			chart.innerHTML = ordered
				.map((r) => {
					const h = Math.max(6, Math.round(((Number(r.durationMs) || 0) / max) * 100));
					const cls = r.status >= 500 ? "w5" : r.status >= 400 ? "w4" : "";
					return `<i class="${cls}" style="height:${h}%" title="${escapeHtml(String(r.method))} ${escapeHtml(String(r.path))} · ${Number(r.durationMs) || 0} ms"></i>`;
				})
				.join("");
			document.getElementById("latencyMax").textContent = `max ${max} ms`;
			wrap.style.display = "block";
		}

		tbody.innerHTML = reqs
			.map((req) => {
				const date = new Date(req.timestamp).toLocaleTimeString("fr-FR");
				const statusClass = `badge-${Math.floor(req.status / 100)}xx`;
				const path = escapeHtml(String(req.path));

				return `
					<tr>
						<td class="time">${date}</td>
						<td><span class="badge badge-method">${escapeHtml(String(req.method))}</span></td>
						<td class="path" title="${path}">${path}</td>
						<td><span class="badge ${statusClass}">${Number(req.status) || 0}</span></td>
						<td class="dur">${Number(req.durationMs) || 0} ms</td>
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
		document.getElementById("cacheDetailBackend").textContent = data.backend || "SQLite";

		const pathEl = document.getElementById("cacheDetailPath");
		if (pathEl) pathEl.textContent = data.sqlitePath || "—";

		const totalLookups = (Number(data.hits) || 0) + (Number(data.misses) || 0);
		const hitPct = totalLookups ? (Number(data.hits) / totalLookups) * 100 : 0;
		const C = 2 * Math.PI * 48;
		const arc = document.getElementById("donutHit");
		if (arc) arc.setAttribute("stroke-dasharray", `${(hitPct / 100) * C} ${C}`);
		const dv = document.getElementById("donutValue");
		if (dv) dv.textContent = totalLookups ? `${Math.round(hitPct)}%` : "—";

		const keysContainer = document.getElementById("cacheRecentKeys");
		if (keysContainer) {
			if (!data.recentKeys || data.recentKeys.length === 0) {
				keysContainer.innerHTML = `<div class="empty">Aucune clé en cache pour le moment.</div>`;
			} else {
				keysContainer.innerHTML = data.recentKeys.map((k) => `<div class="key-chip">${escapeHtml(String(k))}</div>`).join("");
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
			terminal.innerHTML = `<div class="empty">Aucune entrée dans ce journal${data.message ? ` (${escapeHtml(String(data.message))})` : ""}.</div>`;
			return;
		}

		terminal.innerHTML = data.entries
			.map((entry) => {
				const time = entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString("fr-FR") : "";
				const lvl = entry.level || "INFO";
				const dataStr = entry.data ? `<span class="log-data"> ${escapeHtml(JSON.stringify(entry.data))}</span>` : "";

				return `
					<div class="log-entry">
						<span class="log-time">[${time}]</span>
						<span class="log-lvl-${escapeHtml(String(lvl))}">${escapeHtml(String(lvl))}</span>
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
						? `En ligne · ${provider.latencyMs} ms`
						: "Opérationnel"
					: isDegraded
					? "Dégradé"
					: "Inaccessible";

				return `
					<div class="provider-card">
						<div>
							<div class="provider-name">${escapeHtml(String(provider.name))}</div>
							<div class="provider-key">${escapeHtml(key.toUpperCase())}</div>
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
	if (type === "error") toast.classList.add("error");
	toast.textContent = message;

	container.appendChild(toast);
	setTimeout(() => {
		toast.remove();
	}, 3500);
}

function escapeHtml(str) {
	if (typeof str !== "string") return str;
	return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// Icône du sprite défini dans index.html
function icon(name) {
	return `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
}
