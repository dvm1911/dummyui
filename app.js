// SENTRICON Platform - Complete Application Logic

const DATA_URL = "data/sentricon-blueprint.json";
const AUTH_KEY = "sentricon-auth";
const ALERT_STATE_KEY = "sentricon-alert-state";

// Global State
const state = {
  currentUser: null,
  data: null,
  alertState: {},
  currentView: "dashboard",
  sidebarCollapsed: false,
  selectedMachine: null,
  selectedAlert: null,
};

// ===== INITIALIZATION =====
async function init() {
  await loadData();
  setupEventListeners();
  checkAuthStatus();
  startRealtimeUpdates();
}

async function loadData() {
  try {
    const res = await fetch(DATA_URL);
    if (!res.ok) throw new Error("Failed to load data");
    state.data = await res.json();
    loadAlertState();
  } catch (error) {
    console.error("[v0] Data load error:", error);
  }
}

function loadAlertState() {
  try {
    const stored = localStorage.getItem(ALERT_STATE_KEY);
    state.alertState = stored ? JSON.parse(stored) : {};
  } catch (e) {
    state.alertState = {};
  }
}

function saveAlertState() {
  localStorage.setItem(ALERT_STATE_KEY, JSON.stringify(state.alertState));
}

// ===== AUTHENTICATION =====
function checkAuthStatus() {
  const auth = localStorage.getItem(AUTH_KEY);
  if (auth) {
    state.currentUser = JSON.parse(auth);
    showMainApp();
    setupRoleBasedUI();
  } else {
    showAuthScreen();
  }
}

function showAuthScreen() {
  document.getElementById("auth-screen").classList.remove("hidden");
  document.getElementById("main-app").classList.add("hidden");
}

function showMainApp() {
  document.getElementById("auth-screen").classList.add("hidden");
  document.getElementById("main-app").classList.remove("hidden");
  renderCurrentView();
}

function setupAuthListeners() {
  // Auth tab switching
  document.querySelectorAll(".auth-tab").forEach((tab) => {
    tab.addEventListener("click", (e) => {
      document
        .querySelectorAll(".auth-tab")
        .forEach((t) => t.classList.remove("active"));
      document
        .querySelectorAll(".auth-tab-content")
        .forEach((c) => c.classList.remove("active"));
      e.target.classList.add("active");
      document.getElementById(e.target.dataset.tab + "-tab").classList.add("active");
    });
  });

  // Login form
  document.getElementById("login-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const email = document.getElementById("login-email").value;
    const role = email.includes("engineer") ? "safety_engineer" : email.includes("diagnoser") ? "diagnoser" : "operator";
    const name = email.split("@")[0].split(".").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

    handleLogin(email, name, role);
  });

  // Signup form
  document.getElementById("signup-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = document.getElementById("signup-name").value;
    const email = document.getElementById("signup-email").value;
    const role = document.getElementById("signup-role").value;

    handleLogin(email, name, role);
  });
}

function handleLogin(email, name, role) {
  state.currentUser = {
    email,
    name,
    role,
    loginTime: new Date().toISOString(),
  };
  localStorage.setItem(AUTH_KEY, JSON.stringify(state.currentUser));
  showMainApp();
  setupRoleBasedUI();
}

function setupRoleBasedUI() {
  const userInitial = state.currentUser.name.charAt(0).toUpperCase();
  const roleNames = {
    operator: "Plant Operator",
    safety_engineer: "Safety Engineer",
    diagnoser: "Maintenance Diagnoser",
  };

  document.getElementById("user-initial").textContent = userInitial;
  document.getElementById("user-name-display").textContent = state.currentUser.name;
  document.getElementById("user-role-display").textContent = roleNames[state.currentUser.role];

  // Show analyst section for diagnoser role
  const analystSection = document.getElementById("analyst-section");
  if (state.currentUser.role === "diagnoser") {
    analystSection.style.display = "block";
  } else {
    analystSection.style.display = "none";
  }
}

// ===== EVENT LISTENERS =====
function setupEventListeners() {
  setupAuthListeners();

  // Sidebar toggle
  document.getElementById("sidebar-toggle").addEventListener("click", () => {
    const sidebar = document.getElementById("sidebar");
    sidebar.classList.toggle("collapsed");
    state.sidebarCollapsed = !state.sidebarCollapsed;
  });

  // Navigation
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      const view = e.currentTarget.dataset.view;
      switchView(view);
    });
  });

  // Logout
  document.getElementById("logout-btn").addEventListener("click", () => {
    localStorage.removeItem(AUTH_KEY);
    state.currentUser = null;
    showAuthScreen();
  });

  // View navigation
  document.getElementById("back-to-machines").addEventListener("click", () => {
    switchView("machines");
  });

  // Close modal
  document.getElementById("close-modal").addEventListener("click", () => {
    document.getElementById("alert-modal").classList.add("hidden");
  });

  document.getElementById("alert-modal").addEventListener("click", (e) => {
    if (e.target.id === "alert-modal") {
      document.getElementById("alert-modal").classList.add("hidden");
    }
  });

  // Filters
  document.getElementById("status-filter")?.addEventListener("change", renderCurrentView);
  document.getElementById("severity-filter")?.addEventListener("change", renderCurrentView);
  document.getElementById("status-filter-alerts")?.addEventListener("change", renderCurrentView);

  // Search
  document.getElementById("search-input")?.addEventListener("input", (e) => {
    // Real search functionality can be added here
    console.log("[v0] Search query:", e.target.value);
  });
}

// ===== VIEW SWITCHING =====
function switchView(viewName) {
  state.currentView = viewName;
  document.getElementById("page-title").textContent = getTitleForView(viewName);

  // Update active nav item
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.view === viewName);
  });

  // Hide all views, show selected
  document.querySelectorAll(".view").forEach((view) => {
    view.classList.remove("active");
  });
  document.getElementById(viewName + "-view").classList.add("active");

  renderCurrentView();
}

function getTitleForView(viewName) {
  const titles = {
    dashboard: "Dashboard",
    machines: "Machine Groups",
    alerts: "Alerts Inbox",
    trends: "Trend Analysis",
    models: "Model Operations",
    feedback: "Feedback Queue",
    status: "System Status",
    help: "Help & Documentation",
  };
  return titles[viewName] || "Dashboard";
}

function renderCurrentView() {
  switch (state.currentView) {
    case "dashboard":
      renderDashboard();
      break;
    case "machines":
      renderMachinesView();
      break;
    case "alerts":
      renderAlertsView();
      break;
    case "status":
      renderStatusView();
      break;
  }
}

// ===== DASHBOARD VIEW =====
function renderDashboard() {
  renderMachineGroupsOverview();
  renderRecentAlerts();
}

function renderMachineGroupsOverview() {
  const container = document.getElementById("machine-groups-list");
  if (!container || !state.data) return;

  const html = state.data.machineGroups.map((mg) => {
    const statusClass = `mg-status ${mg.status}`;
    const healthPercent = mg.health;
    return `
      <div class="machine-group-card" onclick="viewMachineDetail('${mg.id}')">
        <div class="mg-header">
          <h3 class="mg-name">${mg.name}</h3>
          <span class="${statusClass}">${mg.status}</span>
        </div>
        <p class="mg-area">${mg.area}</p>
        <div class="mg-health-bar">
          <div class="mg-health-fill" style="width: ${healthPercent}%"></div>
        </div>
        <div class="mg-stats">
          <div class="mg-stat">
            <p class="mg-stat-value">${healthPercent}%</p>
            <p class="mg-stat-label">Health</p>
          </div>
          <div class="mg-stat">
            <p class="mg-stat-value">${mg.activeAlerts}</p>
            <p class="mg-stat-label">Alerts</p>
          </div>
          <div class="mg-stat">
            <p class="mg-stat-value">${mg.machineInstances.length}</p>
            <p class="mg-stat-label">Machines</p>
          </div>
        </div>
      </div>
    `;
  });

  container.innerHTML = html.join("");
}

function renderRecentAlerts() {
  const container = document.getElementById("recent-alerts");
  if (!container || !state.data) return;

  const alerts = state.data.alerts.slice(0, 5);
  const html = alerts.map((alert) => {
    const alertState = state.alertState[alert.id] || {};
    const status = alertState.status || alert.status;
    return `
      <div class="alert-item ${alert.severity} ${status}" onclick="openAlertModal('${alert.id}')">
        <div class="alert-content">
          <p class="alert-title">${alert.message}</p>
          <p class="alert-message">${alert.machineGroup} - ${alert.sensor}</p>
          <div class="alert-meta">
            <span>${alert.severity.toUpperCase()}</span>
            <span>${new Date(alert.timestamp).toLocaleDateString()}</span>
            <span>${status.toUpperCase()}</span>
          </div>
        </div>
        <div class="alert-actions">
          <button onclick="acknowledgeAlert('${alert.id}', event)">Acknowledge</button>
        </div>
      </div>
    `;
  });

  container.innerHTML = html.join("");
}

// ===== MACHINES VIEW =====
function renderMachinesView() {
  const container = document.getElementById("machines-list");
  if (!container || !state.data) return;

  const statusFilter = document.getElementById("status-filter")?.value || "";
  let machines = state.data.machineGroups;

  if (statusFilter) {
    machines = machines.filter((m) => m.status === statusFilter);
  }

  const html = machines.map((mg) => {
    const sensors = mg.machineInstances[0]?.sensors || [];
    return `
      <div class="machine-detail-card" onclick="viewMachineDetail('${mg.id}')">
        <div class="machine-header">
          <h3 class="machine-name">${mg.name}</h3>
          <span class="mg-status ${mg.status}">${mg.status}</span>
        </div>
        <div class="machine-sensors">
          ${sensors
            .slice(0, 4)
            .map(
              (sensor) =>
                `<div class="sensor-row">
              <p class="sensor-name">${sensor.name}</p>
              <p class="sensor-value ${sensor.anomaly ? "anomaly" : ""}">${sensor.current} ${sensor.unit}</p>
            </div>`
            )
            .join("")}
        </div>
      </div>
    `;
  });

  container.innerHTML = html.join("");
}

function viewMachineDetail(machineId) {
  state.selectedMachine = machineId;
  switchView("machines");
  renderMachineDetailView();
}

function renderMachineDetailView() {
  const machine = state.data.machineGroups.find((m) => m.id === state.selectedMachine);
  if (!machine) return;

  const container = document.getElementById("machine-detail-content");
  const instance = machine.machineInstances[0];

  const sensorsHtml = instance.sensors
    .map(
      (sensor) =>
        `<div class="sensor-row">
      <div>
        <p class="sensor-name">${sensor.name}</p>
        <p style="margin: 4px 0 0 0; font-size: 11px; color: var(--neutral-500);">Range: ${sensor.range[0]} - ${sensor.range[1]} ${sensor.unit}</p>
      </div>
      <p class="sensor-value ${sensor.anomaly ? "anomaly" : ""}">${sensor.current}</p>
    </div>`
    )
    .join("");

  container.innerHTML = `
    <div>
      <h2>${machine.name}</h2>
      <p style="color: var(--neutral-500); margin: 8px 0 24px 0;">Area: ${machine.area} | Health: ${machine.health}% | Status: ${machine.status}</p>
      <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600;">Sensors & Current Values</h3>
      <div class="machine-sensors">
        ${sensorsHtml}
      </div>
    </div>
  `;
}

// ===== ALERTS VIEW =====
function renderAlertsView() {
  const container = document.getElementById("all-alerts-list");
  if (!container || !state.data) return;

  const severityFilter = document.getElementById("severity-filter")?.value || "";
  const statusFilter = document.getElementById("status-filter-alerts")?.value || "";

  let alerts = state.data.alerts;

  if (severityFilter) alerts = alerts.filter((a) => a.severity === severityFilter);
  if (statusFilter) alerts = alerts.filter((a) => a.status === statusFilter);

  const html = alerts.map((alert) => {
    const alertState = state.alertState[alert.id] || {};
    const status = alertState.status || alert.status;

    return `
      <div class="alert-row" onclick="openAlertModal('${alert.id}')">
        <div class="alert-severity-indicator ${alert.severity}">!</div>
        <div class="alert-row-content">
          <p class="alert-row-title">${alert.message}</p>
          <p class="alert-row-machine">${alert.machineGroup} - ${alert.machine}</p>
        </div>
        <div class="alert-row-actions">
          <button onclick="acknowledgeAlert('${alert.id}', event)">${status === "acknowledged" ? "Acknowledged" : "Acknowledge"}</button>
        </div>
      </div>
    `;
  });

  container.innerHTML = html.length > 0 ? html.join("") : '<p class="placeholder-text">No alerts matching filters</p>';
}

// ===== STATUS VIEW =====
function renderStatusView() {
  const container = document.getElementById("system-status-content");
  if (!container || !state.data) return;

  const status = state.data.systemStatus;
  container.innerHTML = `
    <div class="status-card">
      <h4>Data Ingestion Lag</h4>
      <p>${status.dataIngestionLag.toFixed(2)}s</p>
      <small>Streaming at ${status.dataIngestionLag < 5 ? "real-time" : "delayed"}</small>
    </div>
    <div class="status-card">
      <h4>Analytics Last Run</h4>
      <p>${new Date(status.analyticsLastRun).toLocaleTimeString()}</p>
      <small>${getTimeSince(new Date(status.analyticsLastRun))} ago</small>
    </div>
    <div class="status-card">
      <h4>Total Data Points</h4>
      <p>${(status.dataPoints / 1000000).toFixed(1)}M</p>
      <small>Compressed and indexed</small>
    </div>
    <div class="status-card">
      <h4>Model Version</h4>
      <p>${status.modelVersion}</p>
      <small>Predictive maintenance engine</small>
    </div>
    <div class="status-card">
      <h4>System Uptime</h4>
      <p>${status.uptime.toFixed(2)}%</p>
      <small>Last 30 days</small>
    </div>
  `;
}

// ===== ALERT MODAL =====
function openAlertModal(alertId) {
  const alert = state.data.alerts.find((a) => a.id === alertId);
  if (!alert) return;

  const alertState = state.alertState[alertId] || {};
  const status = alertState.status || alert.status;

  const severityColors = {
    high: "background: var(--status-danger); color: white;",
    medium: "background: var(--status-warning); color: white;",
    low: "background: var(--status-warning); color: white;",
  };

  const modal = document.getElementById("alert-detail");
  modal.innerHTML = `
    <div class="alert-detail-header">
      <div>
        <h2 class="alert-detail-title">${alert.message}</h2>
        <p style="margin: 8px 0 0 0; color: var(--neutral-500);">${alert.machineGroup} / ${alert.machine}</p>
      </div>
      <span class="alert-detail-badge" style="${severityColors[alert.severity]}">${alert.severity}</span>
    </div>

    <div class="alert-detail-section">
      <h4>Alert Details</h4>
      <p><strong>Sensor:</strong> ${alert.sensor}</p>
      <p><strong>Current Value:</strong> ${alert.value}</p>
      <p><strong>Threshold:</strong> ${alert.threshold}</p>
      <p><strong>Status:</strong> ${status.toUpperCase()}</p>
    </div>

    <div class="alert-detail-section">
      <h4>Timestamp</h4>
      <p>${new Date(alert.timestamp).toLocaleString()}</p>
    </div>

    ${
      status === "acknowledged"
        ? `<div class="alert-detail-section">
      <h4>Acknowledged By</h4>
      <p>${alert.acknowledgedBy} on ${new Date(alert.acknowledgedAt).toLocaleString()}</p>
    </div>`
        : ""
    }

    <div style="display: flex; gap: 12px; margin-top: 20px;">
      <button class="btn btn-primary" onclick="acknowledgeAlert('${alertId}', event)">
        ${status === "acknowledged" ? "Already Acknowledged" : "Acknowledge Alert"}
      </button>
      ${status !== "acknowledged" ? '<button class="btn" style="flex: 1; background: var(--neutral-300); color: var(--neutral-800);" onclick="closeModal()">Dismiss</button>' : ""}
    </div>
  `;

  document.getElementById("alert-modal").classList.remove("hidden");
}

function acknowledgeAlert(alertId, event) {
  event.stopPropagation();
  if (!state.alertState[alertId]) state.alertState[alertId] = {};
  state.alertState[alertId].status = "acknowledged";
  state.alertState[alertId].acknowledgedBy = state.currentUser.name;
  state.alertState[alertId].acknowledgedAt = new Date().toISOString();
  saveAlertState();
  renderCurrentView();
  console.log("[v0] Alert acknowledged:", alertId);
}

function closeModal() {
  document.getElementById("alert-modal").classList.add("hidden");
}

// ===== REALTIME UPDATES =====
function startRealtimeUpdates() {
  setInterval(() => {
    // Simulate real-time data updates
    if (state.data && state.data.systemStatus) {
      state.data.systemStatus.analyticsLastRun = new Date().toISOString();
    }
  }, 5000);
}

// ===== UTILITIES =====
function getTimeSince(date) {
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

// ===== BOOT =====
document.addEventListener("DOMContentLoaded", init);
