const DATA_URL = "data/sentricon-blueprint.json";
const STORAGE_KEY = "sentricon-alert-state-v1";

const state = {
  data: null,
  alertState: {},
  ui: {
    machineRange: {},
    machineSignals: {},
    machineMode: {},
    alertFilters: {
      machine: "all",
      severity: "all",
      status: "all",
      range: "7d",
      query: "",
    },
    selectedAlerts: new Set(),
  },
};

const appEl = document.getElementById("app");

const rangeToMs = {
  "6h": 6 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
  all: Infinity,
};

const signalColors = [
  "#0d9488",
  "#1d4ed8",
  "#d97706",
  "#be123c",
  "#0f766e",
  "#4d7c0f",
  "#7c3aed",
  "#475569",
];

const severityOrder = { high: 3, medium: 2, low: 1 };

boot();

async function boot() {
  state.alertState = loadStoredAlertState();
  state.data = await fetchData();
  initializeUiDefaults();
  bindGlobalListeners();
  window.addEventListener("hashchange", render);
  render();
}

async function fetchData() {
  const res = await fetch(DATA_URL);
  if (!res.ok) throw new Error("Could not load dashboard data.");
  return res.json();
}

function loadStoredAlertState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (_error) {
    return {};
  }
}

function persistAlertState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.alertState));
}

function initializeUiDefaults() {
  state.data.machineDefinitions.forEach((machine) => {
    if (!state.ui.machineRange[machine.id]) state.ui.machineRange[machine.id] = "24h";
    if (!state.ui.machineMode[machine.id]) state.ui.machineMode[machine.id] = "stacked";
    if (!state.ui.machineSignals[machine.id]) {
      state.ui.machineSignals[machine.id] = machine.signals.slice(0, 3).map((s) => s.key);
    }
  });
}

function mergedAlerts() {
  return state.data.alerts.map((alert) => {
    const persisted = state.alertState[alert.id] || {};
    return {
      ...alert,
      status: persisted.status || alert.status,
      usefulness: persisted.usefulness || null,
      comments: persisted.comments || [],
      updatedAt: persisted.updatedAt || null,
    };
  });
}

function getMachineDef(machineId) {
  return state.data.machineDefinitions.find((m) => m.id === machineId);
}

function getMachineCard(machineId) {
  return state.data.machines.find((m) => m.id === machineId);
}

function machineName(machineId) {
  const card = getMachineCard(machineId);
  return card ? card.name : machineId;
}

function parseRoute() {
  const hash = window.location.hash.replace(/^#\/?/, "");
  if (!hash || hash === "overview") return { view: "overview" };

  const [head, id] = hash.split("/");
  if (head === "machine" && id) return { view: "machine", machineId: id };
  if (head === "alerts" && !id) return { view: "alerts" };
  if (head === "alerts" && id) return { view: "alert-detail", alertId: id };
  if (head === "system-health") return { view: "system-health" };

  return { view: "overview" };
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatShort(value) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatNumber(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return Number(value).toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function toTitleCase(value) {
  return String(value).charAt(0).toUpperCase() + String(value).slice(1);
}

function statusBadge(status) {
  return `<span class="status-badge status-${status}">${toTitleCase(status)}</span>`;
}

function severityBadge(severity) {
  return `<span class="severity-badge severity-${severity}">${toTitleCase(severity)}</span>`;
}

function trendIcon(trend) {
  if (trend === "improving") return "↘";
  if (trend === "deteriorating") return "↗";
  return "→";
}

function render() {
  if (!state.data) {
    appEl.innerHTML = `<main class="loading">Loading SentriCON data...</main>`;
    return;
  }

  const route = parseRoute();
  appEl.innerHTML = `
    <div class="shell">
      ${renderHeader(route)}
      <main class="content">${renderView(route)}</main>
    </div>
  `;
}

function renderHeader(route) {
  const machineLinks = state.data.machineDefinitions
    .map(
      (m) =>
        `<a href="#/machine/${m.id}" class="sub-link ${route.view === "machine" && route.machineId === m.id ? "is-active" : ""}">${m.name}</a>`
    )
    .join("");

  return `
    <header class="topbar">
      <div class="brand-wrap">
        <p class="eyebrow">Predictive Operations</p>
        <h1>SentriCON Blueprint Console</h1>
      </div>
      <nav class="main-nav" aria-label="Primary">
        <a href="#/overview" class="nav-link ${route.view === "overview" ? "is-active" : ""}">Overview</a>
        <a href="#/alerts" class="nav-link ${route.view === "alerts" || route.view === "alert-detail" ? "is-active" : ""}">Alerts</a>
        <a href="#/system-health" class="nav-link ${route.view === "system-health" ? "is-active" : ""}">System Health</a>
      </nav>
      <div class="sub-nav" aria-label="Machines">${machineLinks}</div>
    </header>
  `;
}

function renderView(route) {
  if (route.view === "machine") {
    if (!getMachineDef(route.machineId)) return renderOverview();
    return renderMachine(route.machineId);
  }

  if (route.view === "alerts") return renderAlerts();
  if (route.view === "alert-detail") return renderAlertDetail(route.alertId);
  if (route.view === "system-health") return renderSystemHealth();
  return renderOverview();
}

function renderOverview() {
  const alerts = mergedAlerts().sort((a, b) => new Date(b.time) - new Date(a.time));
  const unresolved = alerts.filter((a) => a.status !== "resolved");

  const cards = state.data.machines
    .map(
      (machine) => `
      <button class="machine-card status-${machine.status}" data-action="go-machine" data-machine-id="${machine.id}">
        <div class="card-head">
          <h3>${machine.name}</h3>
          <span class="dot status-${machine.status}"></span>
        </div>
        <p class="card-health">Health Score <strong>${machine.healthScore}</strong></p>
        <div class="card-meta">
          <span>${machine.activeAlertCount} active alerts</span>
          <span class="trend ${machine.trend}">${trendIcon(machine.trend)} ${toTitleCase(machine.trend)}</span>
        </div>
      </button>
    `
    )
    .join("");

  const tableRows = unresolved
    .slice(0, 10)
    .map(
      (alert) => `
      <tr>
        <td><button class="ghost-link" data-action="open-alert" data-alert-id="${alert.id}">${alert.id}</button></td>
        <td>${formatShort(alert.time)}</td>
        <td>${machineName(alert.machineId)}</td>
        <td>${alert.signalLabel}</td>
        <td>${severityBadge(alert.severity)}</td>
        <td>${statusBadge(alert.status)}</td>
      </tr>
    `
    )
    .join("");

  return `
    <section class="hero panel animate-rise">
      <div>
        <p class="eyebrow">Live Monitoring Window</p>
        <h2>Plant at a Glance</h2>
        <p>Data source: <strong>${state.data.source.file}</strong> | Range: ${formatDateTime(state.data.source.windowStart)} to ${formatDateTime(state.data.source.windowEnd)}</p>
      </div>
      <a href="#/alerts" class="cta-link">Open alert workspace</a>
    </section>

    <section class="machine-grid">${cards}</section>

    <section class="panel animate-rise">
      <div class="panel-head">
        <h3>Priority Alerts</h3>
        <p>${unresolved.length} alerts need action</p>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Alert ID</th>
              <th>Timestamp</th>
              <th>Machine</th>
              <th>Signal</th>
              <th>Severity</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>${tableRows || `<tr><td colspan="6">No active alerts.</td></tr>`}</tbody>
        </table>
      </div>
    </section>
  `;
}

function renderMachine(machineId) {
  const machine = getMachineDef(machineId);
  const card = getMachineCard(machineId);
  const range = state.ui.machineRange[machineId] || "24h";
  const mode = state.ui.machineMode[machineId] || "stacked";
  const selectedSignals = state.ui.machineSignals[machineId] || machine.signals.slice(0, 3).map((s) => s.key);

  const points = filterPointsByRange(state.data.timeseries[machineId] || [], range);
  const alerts = mergedAlerts()
    .filter((a) => a.machineId === machineId)
    .sort((a, b) => severityOrder[b.severity] - severityOrder[a.severity] || new Date(b.time) - new Date(a.time));

  const rangeButtons = ["6h", "24h", "7d", "30d", "all"]
    .map(
      (value) =>
        `<button class="chip ${range === value ? "is-on" : ""}" data-action="set-machine-range" data-machine-id="${machineId}" data-range="${value}">${value}</button>`
    )
    .join("");

  const signalToggles = machine.signals
    .map(
      (signal, idx) =>
        `<button class="signal-toggle ${selectedSignals.includes(signal.key) ? "is-on" : ""}" data-action="toggle-signal" data-machine-id="${machineId}" data-signal="${signal.key}" style="--signal-color:${signalColors[idx % signalColors.length]}">
          <span class="color-dot"></span>${signal.label}
        </button>`
    )
    .join("");

  const modeButtons = ["stacked", "overlay"]
    .map(
      (m) =>
        `<button class="chip ${mode === m ? "is-on" : ""}" data-action="set-chart-mode" data-machine-id="${machineId}" data-mode="${m}">${toTitleCase(m)}</button>`
    )
    .join("");

  const timeline =
    mode === "overlay"
      ? renderOverlayChart(points, selectedSignals, machine.signals, alerts)
      : renderStackedCharts(points, selectedSignals, machine.signals, alerts);

  const anomalyItems = alerts
    .slice(0, 14)
    .map(
      (alert) => `
      <li>
        <button class="anomaly-item" data-action="open-alert" data-alert-id="${alert.id}">
          <span>${severityBadge(alert.severity)}</span>
          <strong>${alert.signalLabel}</strong>
          <small>${formatShort(alert.time)}</small>
          <small>${statusBadge(alert.status)}</small>
        </button>
      </li>
    `
    )
    .join("");

  return `
    <section class="panel animate-rise">
      <div class="panel-head split">
        <div>
          <p class="eyebrow">Machine Group</p>
          <h2>${machine.name}</h2>
          <p>${machine.description}</p>
        </div>
        <div class="stat-block">
          <p>Health <strong>${card.healthScore}</strong></p>
          <p>${card.activeAlertCount} active / ${card.totalAlertCount} total alerts</p>
          <p class="trend ${card.trend}">${trendIcon(card.trend)} ${toTitleCase(card.trend)}</p>
        </div>
      </div>
      <div class="control-row">
        <div>
          <label>Window</label>
          <div class="chip-row">${rangeButtons}</div>
        </div>
        <div>
          <label>Chart Mode</label>
          <div class="chip-row">${modeButtons}</div>
        </div>
      </div>
      <div class="signal-row">${signalToggles}</div>
    </section>

    <section class="machine-layout">
      <div class="panel chart-panel animate-rise">
        <div class="panel-head split compact">
          <h3>Signal Timeline</h3>
          <p>${points.length} points displayed</p>
        </div>
        ${timeline}
      </div>
      <aside class="panel sidebar animate-rise">
        <div class="panel-head compact">
          <h3>Recent Anomalies</h3>
          <p>Click to investigate</p>
        </div>
        <ul class="anomaly-list">${anomalyItems || "<li>No anomalies in this window.</li>"}</ul>
      </aside>
    </section>
  `;
}

function renderStackedCharts(points, selectedSignals, signalDefs, alerts) {
  if (selectedSignals.length === 0) return `<p>Select at least one signal.</p>`;
  if (points.length < 2) return `<p>Not enough data in the selected window.</p>`;

  return selectedSignals
    .map((signalKey) => {
      const def = signalDefs.find((s) => s.key === signalKey);
      const color = signalColors[selectedSignals.indexOf(signalKey) % signalColors.length];
      const signalValues = points.map((p) => p[signalKey]).filter((v) => v !== null && v !== undefined);
      if (signalValues.length < 2) return `<div class="chart-slot"><h4>${def.label}</h4><p>No usable data.</p></div>`;

      const min = Math.min(...signalValues);
      const max = Math.max(...signalValues);
      const bounds = padBounds(min, max);
      const width = 950;
      const height = 220;
      const pad = 36;
      const path = buildPath(points, signalKey, bounds.min, bounds.max, width, height, pad);

      const byTime = new Map(points.map((p, idx) => [p.time, idx]));
      const markers = alerts
        .filter((a) => a.signal === signalKey)
        .map((alert) => {
          const idx = byTime.get(alert.time);
          if (idx === undefined) return "";
          const x = scaleX(idx, points.length, width, pad);
          const y = scaleY(alert.value, bounds.min, bounds.max, height, pad);
          return `<circle class="marker marker-${alert.severity}" cx="${x}" cy="${y}" r="5" data-action="open-alert" data-alert-id="${alert.id}"><title>${alert.id} | ${alert.signalLabel} | ${toTitleCase(alert.severity)}</title></circle>`;
        })
        .join("");

      return `
        <article class="chart-slot">
          <div class="chart-head">
            <h4>${def.label}</h4>
            <p>min ${formatNumber(bounds.min)} ${def.unit} | max ${formatNumber(bounds.max)} ${def.unit}</p>
          </div>
          <svg viewBox="0 0 ${width} ${height}" class="chart-svg" role="img" aria-label="${def.label} trend">
            ${buildGrid(width, height, pad)}
            <path d="${path}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" />
            ${markers}
            <text x="${pad}" y="${height - 8}" class="axis-label">${formatShort(points[0].time)}</text>
            <text x="${width - 230}" y="${height - 8}" class="axis-label">${formatShort(points[points.length - 1].time)}</text>
          </svg>
        </article>
      `;
    })
    .join("");
}

function renderOverlayChart(points, selectedSignals, signalDefs, alerts) {
  if (selectedSignals.length === 0) return `<p>Select at least one signal.</p>`;
  if (points.length < 2) return `<p>Not enough data in the selected window.</p>`;

  const width = 980;
  const height = 280;
  const pad = 40;

  const defs = selectedSignals
    .map((signalKey) => signalDefs.find((s) => s.key === signalKey))
    .filter(Boolean);

  const paths = defs
    .map((def, index) => {
      const color = signalColors[index % signalColors.length];
      const values = points.map((p) => p[def.key]).filter((v) => v !== null && v !== undefined);
      const bounds = padBounds(Math.min(...values), Math.max(...values));
      const path = buildPath(points, def.key, bounds.min, bounds.max, width, height, pad);
      return `<path d="${path}" fill="none" stroke="${color}" stroke-width="2.2"/>`;
    })
    .join("");

  const markerSignals = new Set(selectedSignals);
  const byTime = new Map(points.map((p, idx) => [p.time, idx]));
  const markers = alerts
    .filter((a) => markerSignals.has(a.signal))
    .slice(0, 80)
    .map((alert) => {
      const idx = byTime.get(alert.time);
      if (idx === undefined) return "";
      const signalDef = signalDefs.find((s) => s.key === alert.signal);
      const values = points.map((p) => p[alert.signal]).filter((v) => v !== null && v !== undefined);
      const bounds = padBounds(Math.min(...values), Math.max(...values));
      const x = scaleX(idx, points.length, width, pad);
      const y = scaleY(alert.value, bounds.min, bounds.max, height, pad);
      return `<circle class="marker marker-${alert.severity}" cx="${x}" cy="${y}" r="4" data-action="open-alert" data-alert-id="${alert.id}"><title>${alert.id} | ${signalDef ? signalDef.label : alert.signalLabel}</title></circle>`;
    })
    .join("");

  const legend = defs
    .map(
      (def, idx) =>
        `<span class="legend-item"><i style="background:${signalColors[idx % signalColors.length]}"></i>${def.label}</span>`
    )
    .join("");

  return `
    <article class="chart-slot">
      <div class="chart-head split compact">
        <h4>Overlay View</h4>
        <p>Signals use independent scaling for trend comparison.</p>
      </div>
      <svg viewBox="0 0 ${width} ${height}" class="chart-svg" role="img" aria-label="Overlay signal chart">
        ${buildGrid(width, height, pad)}
        ${paths}
        ${markers}
      </svg>
      <div class="legend-row">${legend}</div>
    </article>
  `;
}

function padBounds(min, max) {
  if (min === max) {
    return { min: min - Math.abs(min * 0.05 || 1), max: max + Math.abs(max * 0.05 || 1) };
  }
  const pad = (max - min) * 0.1;
  return { min: min - pad, max: max + pad };
}

function buildPath(points, key, min, max, width, height, pad) {
  const coords = [];
  points.forEach((point, idx) => {
    const value = point[key];
    if (value === null || value === undefined || Number.isNaN(value)) return;
    const x = scaleX(idx, points.length, width, pad);
    const y = scaleY(value, min, max, height, pad);
    coords.push(`${x},${y}`);
  });
  if (!coords.length) return "";
  return `M ${coords.join(" L ")}`;
}

function buildGrid(width, height, pad) {
  const horizontal = [0, 1, 2, 3, 4]
    .map((i) => {
      const y = pad + ((height - 2 * pad) / 4) * i;
      return `<line x1="${pad}" x2="${width - pad}" y1="${y}" y2="${y}" class="grid-line"/>`;
    })
    .join("");

  return `${horizontal}<line x1="${pad}" y1="${pad}" x2="${pad}" y2="${height - pad}" class="grid-axis"/><line x1="${pad}" y1="${height - pad}" x2="${width - pad}" y2="${height - pad}" class="grid-axis"/>`;
}

function scaleX(idx, total, width, pad) {
  const span = width - 2 * pad;
  if (total <= 1) return pad;
  return pad + (idx / (total - 1)) * span;
}

function scaleY(value, min, max, height, pad) {
  const span = height - 2 * pad;
  return pad + ((max - value) / (max - min)) * span;
}

function renderAlerts() {
  const filters = state.ui.alertFilters;
  const alerts = applyAlertFilters(mergedAlerts())
    .sort((a, b) => severityOrder[b.severity] - severityOrder[a.severity] || new Date(b.time) - new Date(a.time));

  const machineOptions = state.data.machineDefinitions
    .map((machine) => `<option value="${machine.id}" ${filters.machine === machine.id ? "selected" : ""}>${machine.name}</option>`)
    .join("");

  const rows = alerts
    .slice(0, 200)
    .map((alert) => {
      const checked = state.ui.selectedAlerts.has(alert.id) ? "checked" : "";
      return `
        <tr>
          <td><input type="checkbox" data-action="toggle-alert-select" data-alert-id="${alert.id}" ${checked}/></td>
          <td><button class="ghost-link" data-action="open-alert" data-alert-id="${alert.id}">${alert.id}</button></td>
          <td>${formatDateTime(alert.time)}</td>
          <td>${machineName(alert.machineId)}</td>
          <td>${alert.signalLabel}</td>
          <td>${severityBadge(alert.severity)}</td>
          <td>${statusBadge(alert.status)}</td>
          <td>${formatNumber(alert.score)}</td>
          <td>
            <div class="table-actions">
              <button class="mini" data-action="set-alert-status" data-alert-id="${alert.id}" data-status="acknowledged">Ack</button>
              <button class="mini" data-action="set-alert-status" data-alert-id="${alert.id}" data-status="resolved">Resolve</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  return `
    <section class="panel animate-rise">
      <div class="panel-head split">
        <div>
          <h2>Alert Dashboard</h2>
          <p>Filter, prioritize, and action anomalies in one workflow.</p>
        </div>
        <div class="bulk-actions">
          <button class="mini" data-action="bulk-status" data-status="acknowledged">Acknowledge Selected</button>
          <button class="mini" data-action="bulk-status" data-status="resolved">Resolve Selected</button>
          <button class="mini ghost" data-action="clear-selected">Clear Selection</button>
        </div>
      </div>

      <div class="filters">
        <label>Machine
          <select data-action="set-alert-filter" data-field="machine">
            <option value="all">All Machines</option>
            ${machineOptions}
          </select>
        </label>
        <label>Severity
          <select data-action="set-alert-filter" data-field="severity">
            <option value="all" ${filters.severity === "all" ? "selected" : ""}>All</option>
            <option value="high" ${filters.severity === "high" ? "selected" : ""}>High</option>
            <option value="medium" ${filters.severity === "medium" ? "selected" : ""}>Medium</option>
            <option value="low" ${filters.severity === "low" ? "selected" : ""}>Low</option>
          </select>
        </label>
        <label>Status
          <select data-action="set-alert-filter" data-field="status">
            <option value="all" ${filters.status === "all" ? "selected" : ""}>All</option>
            <option value="new" ${filters.status === "new" ? "selected" : ""}>New</option>
            <option value="acknowledged" ${filters.status === "acknowledged" ? "selected" : ""}>Acknowledged</option>
            <option value="resolved" ${filters.status === "resolved" ? "selected" : ""}>Resolved</option>
          </select>
        </label>
        <label>Time Window
          <select data-action="set-alert-filter" data-field="range">
            <option value="24h" ${filters.range === "24h" ? "selected" : ""}>Last 24h</option>
            <option value="7d" ${filters.range === "7d" ? "selected" : ""}>Last 7d</option>
            <option value="30d" ${filters.range === "30d" ? "selected" : ""}>Last 30d</option>
            <option value="all" ${filters.range === "all" ? "selected" : ""}>All</option>
          </select>
        </label>
        <label class="search">Search
          <input type="search" placeholder="Alert ID, signal, machine" value="${escapeHtml(filters.query)}" data-action="set-alert-filter" data-field="query"/>
        </label>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th></th>
              <th>Alert ID</th>
              <th>Timestamp</th>
              <th>Machine</th>
              <th>Signal</th>
              <th>Severity</th>
              <th>Status</th>
              <th>Score</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>${rows || `<tr><td colspan="9">No alerts match current filters.</td></tr>`}</tbody>
        </table>
      </div>
    </section>
  `;
}

function applyAlertFilters(alerts) {
  const filters = state.ui.alertFilters;
  let output = alerts;

  if (filters.machine !== "all") {
    output = output.filter((alert) => alert.machineId === filters.machine);
  }

  if (filters.severity !== "all") {
    output = output.filter((alert) => alert.severity === filters.severity);
  }

  if (filters.status !== "all") {
    output = output.filter((alert) => alert.status === filters.status);
  }

  if (filters.range !== "all") {
    const maxTime = output.length
      ? Math.max(...output.map((a) => new Date(a.time).getTime()))
      : Math.max(...alerts.map((a) => new Date(a.time).getTime()));
    const cutoff = maxTime - rangeToMs[filters.range];
    output = output.filter((alert) => new Date(alert.time).getTime() >= cutoff);
  }

  if (filters.query.trim()) {
    const query = filters.query.toLowerCase();
    output = output.filter((alert) => {
      return (
        alert.id.toLowerCase().includes(query) ||
        alert.signalLabel.toLowerCase().includes(query) ||
        machineName(alert.machineId).toLowerCase().includes(query)
      );
    });
  }

  return output;
}

function renderAlertDetail(alertId) {
  const alert = mergedAlerts().find((item) => item.id === alertId);
  if (!alert) {
    return `
      <section class="panel animate-rise">
        <h2>Alert not found</h2>
        <p>The selected alert no longer exists in this data window.</p>
        <a class="cta-link" href="#/alerts">Back to Alerts</a>
      </section>
    `;
  }

  const machine = getMachineDef(alert.machineId);
  const allPoints = state.data.timeseries[alert.machineId] || [];
  const contextPoints = filterAroundTime(allPoints, alert.time, 12);

  const focusSignals = [alert.signal, ...(alert.relatedSignals || [])].filter(
    (signal, index, array) => array.indexOf(signal) === index
  );

  const charts = renderStackedCharts(contextPoints, focusSignals, machine.signals, [alert]);

  const comments = (alert.comments || [])
    .map(
      (comment) => `
      <li class="comment-item">
        <p>${escapeHtml(comment.text)}</p>
        <small>${escapeHtml(comment.author)} • ${formatDateTime(comment.time)}</small>
      </li>
    `
    )
    .join("");

  return `
    <section class="panel animate-rise">
      <div class="panel-head split">
        <div>
          <p class="eyebrow">Alert Investigation</p>
          <h2>${alert.id} • ${alert.signalLabel}</h2>
          <p>${machineName(alert.machineId)} | ${formatDateTime(alert.time)}</p>
        </div>
        <div class="status-row">
          ${severityBadge(alert.severity)}
          ${statusBadge(alert.status)}
          <span class="confidence">Confidence ${Math.round(alert.confidence * 100)}%</span>
        </div>
      </div>

      <div class="detail-grid">
        <article class="panel nested">
          <h3>Explanation</h3>
          <p>${alert.description}</p>
          <p><strong>Detection:</strong> ${alert.detectionMethod}</p>
          <p><strong>Baseline:</strong> ${formatNumber(alert.baseline)} | <strong>Observed:</strong> ${formatNumber(alert.value)} | <strong>Score:</strong> ${formatNumber(alert.score)}</p>
        </article>
        <article class="panel nested">
          <h3>Actions</h3>
          <div class="action-row">
            <button class="mini" data-action="set-alert-status" data-alert-id="${alert.id}" data-status="acknowledged">Acknowledge</button>
            <button class="mini" data-action="set-alert-status" data-alert-id="${alert.id}" data-status="resolved">Resolve</button>
            <button class="mini" data-action="set-alert-status" data-alert-id="${alert.id}" data-status="new">Re-open</button>
          </div>
          <div class="action-row">
            <button class="mini ${alert.usefulness === "useful" ? "is-active" : ""}" data-action="set-usefulness" data-alert-id="${alert.id}" data-usefulness="useful">Useful</button>
            <button class="mini ${alert.usefulness === "not-useful" ? "is-active" : ""}" data-action="set-usefulness" data-alert-id="${alert.id}" data-usefulness="not-useful">Not Useful</button>
          </div>
        </article>
      </div>
    </section>

    <section class="panel animate-rise">
      <div class="panel-head compact">
        <h3>Context Signals (12h before and after)</h3>
      </div>
      ${charts}
    </section>

    <section class="panel animate-rise">
      <div class="panel-head split compact">
        <h3>Comment Thread</h3>
        <p>${(alert.comments || []).length} comments</p>
      </div>
      <form class="comment-form" data-action="add-comment" data-alert-id="${alert.id}">
        <textarea name="comment" rows="3" placeholder="Add what was observed, root-cause hints, or next maintenance action."></textarea>
        <button type="submit" class="mini">Add Comment</button>
      </form>
      <ul class="comment-list">${comments || "<li>No comments yet.</li>"}</ul>
    </section>
  `;
}

function filterAroundTime(points, centerTime, hours) {
  const center = new Date(centerTime).getTime();
  const radius = hours * 60 * 60 * 1000;
  return points.filter((point) => {
    const t = new Date(point.time).getTime();
    return t >= center - radius && t <= center + radius;
  });
}

function renderSystemHealth() {
  const health = state.data.systemHealth;
  const queueSvg = renderQueueSparkline(health.queues.series);

  const machineSummary = state.data.machines
    .map(
      (machine) => `
      <tr>
        <td>${machine.name}</td>
        <td>${statusBadge(machine.status)}</td>
        <td>${machine.healthScore}</td>
        <td>${machine.activeAlertCount}</td>
      </tr>
    `
    )
    .join("");

  const notices = health.notifications.map((item) => `<li>${item}</li>`).join("");

  return `
    <section class="health-grid">
      <article class="panel animate-rise">
        <h3>Ingestion</h3>
        <p>${statusBadge(health.ingestion.status)}</p>
        <p>Latest point: ${formatDateTime(health.ingestion.latestTimestamp)}</p>
        <p>Delay: ${health.ingestion.delaySeconds}s</p>
        <p>On-time ratio: ${health.ingestion.onTimeRatio}%</p>
      </article>
      <article class="panel animate-rise">
        <h3>Analytics</h3>
        <p>${statusBadge(health.analytics.status)}</p>
        <p>Model: ${health.analytics.modelVersion}</p>
        <p>Last refresh: ${formatDateTime(health.analytics.lastRefresh)}</p>
        <p>Inference: ${health.analytics.avgInferenceMs} ms</p>
      </article>
      <article class="panel animate-rise">
        <h3>${health.queues.name}</h3>
        <p>Current length: ${health.queues.currentLength}</p>
        ${queueSvg}
      </article>
    </section>

    <section class="panel animate-rise">
      <div class="panel-head compact">
        <h3>Machine Health Matrix</h3>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Machine</th>
              <th>Status</th>
              <th>Health Score</th>
              <th>Active Alerts</th>
            </tr>
          </thead>
          <tbody>${machineSummary}</tbody>
        </table>
      </div>
    </section>

    <section class="panel animate-rise">
      <div class="panel-head compact"><h3>Platform Notifications</h3></div>
      <ul class="notice-list">${notices}</ul>
    </section>
  `;
}

function renderQueueSparkline(series) {
  const width = 420;
  const height = 140;
  const pad = 18;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const coords = series.map((value, index) => {
    const x = pad + (index / Math.max(series.length - 1, 1)) * (width - pad * 2);
    const y = pad + ((max - value) / Math.max(max - min, 1)) * (height - pad * 2);
    return `${x},${y}`;
  });

  return `
    <svg viewBox="0 0 ${width} ${height}" class="queue-svg" role="img" aria-label="Queue trend">
      <rect x="0" y="0" width="${width}" height="${height}" rx="10" class="queue-bg"></rect>
      <path d="M ${coords.join(" L ")}" fill="none" stroke="#0b5d67" stroke-width="3" />
    </svg>
  `;
}

function filterPointsByRange(points, range) {
  if (!points.length || range === "all") return points;
  const lastTime = new Date(points[points.length - 1].time).getTime();
  const cutoff = lastTime - rangeToMs[range];
  return points.filter((point) => new Date(point.time).getTime() >= cutoff);
}

function updateAlert(id, patch) {
  state.alertState[id] = {
    ...(state.alertState[id] || {}),
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  persistAlertState();
}

function bindGlobalListeners() {
  appEl.addEventListener("click", (event) => {
    const actionEl = event.target.closest("[data-action]");
    if (!actionEl) return;

    const action = actionEl.dataset.action;

    if (action === "go-machine") {
      location.hash = `#/machine/${actionEl.dataset.machineId}`;
      return;
    }

    if (action === "open-alert") {
      location.hash = `#/alerts/${actionEl.dataset.alertId}`;
      return;
    }

    if (action === "set-machine-range") {
      state.ui.machineRange[actionEl.dataset.machineId] = actionEl.dataset.range;
      render();
      return;
    }

    if (action === "set-chart-mode") {
      state.ui.machineMode[actionEl.dataset.machineId] = actionEl.dataset.mode;
      render();
      return;
    }

    if (action === "toggle-signal") {
      const machineId = actionEl.dataset.machineId;
      const signal = actionEl.dataset.signal;
      const current = state.ui.machineSignals[machineId] || [];
      const next = new Set(current);
      if (next.has(signal)) {
        if (next.size === 1) return;
        next.delete(signal);
      } else {
        next.add(signal);
      }
      state.ui.machineSignals[machineId] = [...next];
      render();
      return;
    }

    if (action === "set-alert-status") {
      updateAlert(actionEl.dataset.alertId, { status: actionEl.dataset.status });
      render();
      return;
    }

    if (action === "bulk-status") {
      state.ui.selectedAlerts.forEach((id) => {
        updateAlert(id, { status: actionEl.dataset.status });
      });
      render();
      return;
    }

    if (action === "clear-selected") {
      state.ui.selectedAlerts = new Set();
      render();
      return;
    }

    if (action === "set-usefulness") {
      updateAlert(actionEl.dataset.alertId, { usefulness: actionEl.dataset.usefulness });
      render();
    }
  });

  appEl.addEventListener("change", (event) => {
    const actionEl = event.target.closest("[data-action]");
    if (!actionEl) return;

    if (actionEl.dataset.action === "toggle-alert-select") {
      const alertId = actionEl.dataset.alertId;
      if (event.target.checked) state.ui.selectedAlerts.add(alertId);
      else state.ui.selectedAlerts.delete(alertId);
      return;
    }

    if (actionEl.dataset.action === "set-alert-filter") {
      const field = actionEl.dataset.field;
      state.ui.alertFilters[field] = event.target.value;
      render();
    }
  });

  appEl.addEventListener("input", (event) => {
    const actionEl = event.target.closest("[data-action]");
    if (!actionEl) return;

    if (actionEl.dataset.action === "set-alert-filter" && actionEl.dataset.field === "query") {
      state.ui.alertFilters.query = event.target.value;
      render();
    }
  });

  appEl.addEventListener("submit", (event) => {
    const form = event.target.closest("form[data-action='add-comment']");
    if (!form) return;

    event.preventDefault();
    const alertId = form.dataset.alertId;
    const field = form.querySelector("textarea[name='comment']");
    const text = field.value.trim();
    if (!text) return;

    const current = state.alertState[alertId] || {};
    const comments = current.comments || [];
    comments.push({
      text,
      author: "Operations User",
      time: new Date().toISOString(),
    });

    updateAlert(alertId, { comments });
    render();
  });
}
