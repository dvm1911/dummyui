// Global state
let appState = {
  currentUser: null,
  currentView: 'overview',
  selectedGroup: null,
  theme: localStorage.getItem('theme') || 'dark',
  blueprint: null,
  alertStates: {},
  currentAlert: null
};

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  console.log('[v0] App initializing, theme:', appState.theme);
  initializeTheme();
  loadAlertStates();
  loadBlueprint();
  setupAuth();
  setupEventListeners();
  setupThemeToggle();
});

// Load alert states from localStorage
function loadAlertStates() {
  try {
    const stored = localStorage.getItem('alertStates');
    if (stored) {
      appState.alertStates = JSON.parse(stored);
      console.log('[v0] Alert states loaded:', Object.keys(appState.alertStates).length, 'alerts');
    }
  } catch (err) {
    console.error('[v0] Error loading alert states:', err);
    appState.alertStates = {};
  }
}

// Fetch blueprint data
function loadBlueprint() {
  fetch('data/sentricon-blueprint.json')
    .then(res => res.json())
    .then(data => {
      appState.blueprint = data;
      console.log('[v0] Blueprint loaded, machines:', appState.blueprint.machineGroups.length);
      renderAllContent();
    })
    .catch(err => console.error('[v0] Error loading blueprint:', err));
}

// Authentication
function setupAuth() {
  const authScreen = document.getElementById('auth-screen');
  const app = document.getElementById('app');
  const loginForm = document.getElementById('login-form');
  
  const storedUser = localStorage.getItem('currentUser');
  if (storedUser) {
    appState.currentUser = JSON.parse(storedUser);
    authScreen.style.display = 'none';
    app.style.display = 'flex';
    populateUserUI();
  }
  
  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    if (appState.blueprint) {
      const user = appState.blueprint.users.find(u => u.username === username && u.password === password);
      if (user) {
        appState.currentUser = user;
        localStorage.setItem('currentUser', JSON.stringify(user));
        authScreen.style.display = 'none';
        app.style.display = 'flex';
        populateUserUI();
      } else {
        alert('Invalid credentials');
      }
    }
  });
}

function populateUserUI() {
  const user = appState.currentUser;
  document.getElementById('profile-avatar').textContent = user.avatar;
  document.getElementById('profile-name').textContent = user.name.split(' ')[0];
  document.getElementById('dropdown-avatar').textContent = user.avatar;
  document.getElementById('dropdown-name').textContent = user.name;
  document.getElementById('dropdown-role').textContent = user.role;
}

// Theme toggle - Fixed implementation
function initializeTheme() {
  const body = document.querySelector('body');
  body.setAttribute('data-theme', appState.theme);
  const icon = document.getElementById('theme-icon');
  if (icon) {
    icon.textContent = appState.theme === 'dark' ? '☀️' : '🌙';
  }
  console.log('[v0] Theme set to:', appState.theme);
}

function setupThemeToggle() {
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      appState.theme = appState.theme === 'dark' ? 'light' : 'dark';
      localStorage.setItem('theme', appState.theme);
      initializeTheme();
      console.log('[v0] Theme toggled to:', appState.theme);
    });
  }
}

// Event listeners
function setupEventListeners() {
  // Sidebar navigation
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const view = item.dataset.view;
      switchView(view);
      document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('is-active'));
      item.classList.add('is-active');
    });
  });
  
  // Profile menu
  document.getElementById('profile-btn').addEventListener('click', () => {
    const dropdown = document.getElementById('profile-dropdown');
    dropdown.classList.toggle('active');
  });
  
  document.querySelectorAll('[data-action]').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const action = item.dataset.action;
      if (action === 'logout') {
        logout();
      } else if (action === 'profile') {
        showModal('profile-modal');
        populateProfileModal();
      } else if (action === 'preferences') {
        showModal('preferences-modal');
      }
    });
  });
  
  // Logout
  document.getElementById('logout-btn').addEventListener('click', logout);
  
  // Close modals
  document.querySelectorAll('.btn-close').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.target.closest('.modal').style.display = 'none';
    });
  });
  
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.style.display = 'none';
    });
  });
  
  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.profile-menu')) {
      document.getElementById('profile-dropdown').classList.remove('active');
    }
  });
  
  // Tab switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = btn.dataset.tab;
      const container = btn.closest('.modal-body') || btn.closest('.detail-tabs').parentElement;
      
      container.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('is-active'));
      container.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      
      btn.classList.add('is-active');
      const tabContent = container.querySelector(`#tab-${tabName}`);
      if (tabContent) tabContent.classList.add('active');
    });
  });
  
  // Alert resolution modal handlers
  const btnAck = document.getElementById('btn-acknowledge');
  const btnSnooze = document.getElementById('btn-snooze');
  const btnResolve = document.getElementById('btn-resolve');
  const btnCancel = document.getElementById('btn-cancel-resolution');
  const modalClose = document.querySelector('#alert-resolution-modal .modal-close');
  const modal = document.getElementById('alert-resolution-modal');
  
  if (btnAck) {
    btnAck.addEventListener('click', acknowledgeAlert);
    console.log('[v0] Acknowledge button listener attached');
  }
  if (btnSnooze) {
    btnSnooze.addEventListener('click', snoozeAlert);
    console.log('[v0] Snooze button listener attached');
  }
  if (btnResolve) {
    btnResolve.addEventListener('click', resolveAlert);
    console.log('[v0] Resolve button listener attached');
  }
  if (btnCancel) {
    btnCancel.addEventListener('click', () => {
      console.log('[v0] Cancel button clicked');
      modal.style.display = 'none';
    });
    console.log('[v0] Cancel button listener attached');
  }
  if (modalClose) {
    modalClose.addEventListener('click', () => {
      console.log('[v0] Modal close button clicked');
      modal.style.display = 'none';
    });
    console.log('[v0] Modal close button listener attached');
  }
  
  // Close modal when clicking outside
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        console.log('[v0] Clicked outside modal - closing');
        modal.style.display = 'none';
      }
    });
    console.log('[v0] Modal background click listener attached');
  }
  
  // Breadcrumb
  document.querySelectorAll('[data-view]').forEach(link => {
    link.addEventListener('click', (e) => {
      if (link.classList.contains('breadcrumb-link')) {
        e.preventDefault();
        switchView(link.dataset.view);
      }
    });
  });
  
  // Preferences save
  document.getElementById('save-preferences').addEventListener('click', () => {
    alert('Preferences saved!');
    document.getElementById('preferences-modal').style.display = 'none';
  });
  
  // Machine group selector
  document.getElementById('group-selector').addEventListener('change', (e) => {
    if (e.target.value) {
      appState.selectedGroup = e.target.value;
      showMachineGroupDetail(e.target.value);
      switchView('machine-group-detail');
    }
  });
}

function logout() {
  localStorage.removeItem('currentUser');
  appState.currentUser = null;
  document.getElementById('auth-screen').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
  document.getElementById('login-form').reset();
}

function switchView(viewName) {
  document.querySelectorAll('.view-content').forEach(v => v.style.display = 'none');
  const view = document.getElementById(`view-${viewName}`);
  if (view) {
    view.style.display = 'block';
    appState.currentView = viewName;
  }
}

function showModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = 'flex';
    console.log('[v0] Modal shown:', modalId);
  } else {
    console.error('[v0] Modal not found:', modalId);
  }
}

// Render all content
function renderAllContent() {
  renderMachineGroups();
  renderGroupShortcuts();
  renderRecentAlerts();
  renderAllAlerts();
  populateGroupSelector();
}

// Render machine groups
function renderMachineGroups() {
  const container = document.getElementById('machine-groups-grid');
  container.innerHTML = '';
  
  appState.blueprint.machineGroups.forEach(group => {
    const card = document.createElement('div');
    const statusClass = group.status === 'critical' ? 'critical' : group.status === 'warning' ? 'warning' : 'normal';
    card.className = `machine-card status-${statusClass}`;
    card.innerHTML = `
      <h3>${group.icon} ${group.name}</h3>
      <div class="card-meta">
        <span>Health: <strong>${group.health}%</strong></span>
        <span>${group.trend}</span>
      </div>
    `;
    card.addEventListener('click', () => showMachineGroupDetail(group.id));
    container.appendChild(card);
  });
}

// Show machine group detail
function showMachineGroupDetail(groupId) {
  const group = appState.blueprint.machineGroups.find(g => g.id === groupId);
  if (!group) return;
  
  appState.selectedGroup = groupId;
  
  // Update header
  document.getElementById('breadcrumb-group').textContent = group.name;
  document.getElementById('group-detail-category').textContent = group.category;
  document.getElementById('group-detail-name').textContent = group.name;
  document.getElementById('group-detail-description').textContent = group.description;
  document.getElementById('group-detail-health').textContent = `${group.health}%`;
  document.getElementById('group-detail-status').textContent = group.status.toUpperCase();
  document.getElementById('group-detail-risk').textContent = group.riskScore;
  
  // Count alerts
  const groupAlerts = appState.blueprint.alerts.filter(a => a.machineGroup === groupId);
  document.getElementById('group-detail-alerts').textContent = groupAlerts.length;
  
  // Render alerts
  const alertsList = document.getElementById('group-alerts-list');
  alertsList.innerHTML = '';
  groupAlerts.forEach(alert => {
    const item = document.createElement('li');
    item.className = `anomaly-item severity-${alert.severity}`;
    item.innerHTML = `
      <strong>${alert.title}</strong>
      <small>${alert.description}</small>
      <small style="display: block; margin-top: 4px;">${new Date(alert.timestamp).toLocaleString()}</small>
      <span class="severity-badge severity-${alert.severity}">${alert.severity}</span>
    `;
    alertsList.appendChild(item);
  });
  
  // Render machines
  renderGroupMachines(group);
  
  // Render signals
  renderGroupSignals(group);
  
  // Switch to detail view
  switchView('machine-group-detail');
}

function renderGroupMachines(group) {
  const container = document.getElementById('group-machines-detail');
  container.innerHTML = '';
  
  group.machines.forEach(machine => {
    const machineDiv = document.createElement('div');
    machineDiv.className = 'machine-detail-card';
    machineDiv.innerHTML = `
      <h4>${machine.name}</h4>
      <p><strong>Type:</strong> ${machine.type}</p>
      <p><strong>Status:</strong> ${machine.status}</p>
      <p><strong>Health:</strong> ${machine.health}%</p>
      <p><strong>Active Alerts:</strong> ${machine.activeAlerts}</p>
      <p><strong>Efficiency:</strong> ${machine.efficiency}% | <strong>Power:</strong> ${machine.powerConsumption}kW</p>
    `;
    machineDiv.addEventListener('click', () => showMachineDetail(machine, group.name));
    container.appendChild(machineDiv);
  });
}

function renderGroupSignals(group) {
  const container = document.getElementById('group-all-signals');
  container.innerHTML = '';
  
  group.machines.forEach(machine => {
    Object.entries(machine.signals).forEach(([signalKey, signal]) => {
      const card = document.createElement('div');
      card.className = `signal-card`;
      const timeseries = machine.timeseries[signalKey];
      const chart = timeseries ? generateMiniChart(timeseries) : '';
      
      card.innerHTML = `
        <div class="signal-header">
          <p class="signal-name">${signalKey}</p>
          <p class="signal-machine">${machine.name}</p>
        </div>
        <div class="signal-value">
          <span class="signal-current">${signal.value}</span>
          <span class="signal-unit">${signal.unit}</span>
        </div>
        <span class="signal-status ${signal.status}">${signal.status}</span>
        <div style="font-size: 0.75rem; margin-top: 8px; display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
          <div><strong>Min:</strong> ${signal.min}</div>
          <div><strong>Max:</strong> ${signal.max}</div>
          <div><strong>Trend:</strong> ${signal.trend}</div>
          <div><strong>Threshold:</strong> ${signal.threshold}</div>
        </div>
        ${chart}
      `;
      container.appendChild(card);
    });
  });
}

function generateMiniChart(data) {
  const width = 280;
  const height = 60;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  
  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((val - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');
  
  return `
    <svg class="signal-chart" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <polyline points="${points}" fill="none" stroke="#00d4ff" stroke-width="1.5" vector-effect="non-scaling-stroke"/>
    </svg>
  `;
}

// Show machine detail
function showMachineDetail(machine, groupName) {
  document.getElementById('machine-modal-title').textContent = machine.name;
  document.getElementById('machine-health').textContent = `${machine.health}%`;
  document.getElementById('machine-status').textContent = machine.status;
  document.getElementById('machine-trend').textContent = machine.trend;
  document.getElementById('machine-efficiency').textContent = `${machine.efficiency}%`;
  
  // Signals tab
  const signalsContainer = document.getElementById('machine-signals-container');
  signalsContainer.innerHTML = '';
  Object.entries(machine.signals).forEach(([key, signal]) => {
    const timeseries = machine.timeseries[key];
    const chart = timeseries ? generateMiniChart(timeseries) : '';
    
    const div = document.createElement('div');
    div.className = 'signal-card';
    div.innerHTML = `
      <div class="signal-header">
        <p class="signal-name">${key}</p>
      </div>
      <div class="signal-value">
        <span class="signal-current">${signal.value}</span>
        <span class="signal-unit">${signal.unit}</span>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 0.8rem; margin-top: 8px;">
        <div><strong>Status:</strong> ${signal.status}</div>
        <div><strong>Trend:</strong> ${signal.trend}</div>
        <div><strong>Min:</strong> ${signal.min}</div>
        <div><strong>Max:</strong> ${signal.max}</div>
        <div><strong>Threshold:</strong> ${signal.threshold}</div>
      </div>
      ${chart}
    `;
    signalsContainer.appendChild(div);
  });
  
  // Specifications tab
  const specsContainer = document.getElementById('machine-specifications');
  specsContainer.innerHTML = '<div class="detail-section">';
  Object.entries(machine.specifications).forEach(([key, value]) => {
    specsContainer.innerHTML += `
      <div style="display: grid; grid-template-columns: 140px 1fr; gap: 12px; margin-bottom: 10px;">
        <strong style="text-transform: capitalize;">${key}:</strong>
        <span>${value}</span>
      </div>
    `;
  });
  specsContainer.innerHTML += '</div>';
  
  // Maintenance tab
  const maintContainer = document.getElementById('machine-maintenance-history');
  maintContainer.innerHTML = '';
  if (machine.maintenanceHistory) {
    machine.maintenanceHistory.forEach(record => {
      const div = document.createElement('div');
      div.style.marginBottom = '16px';
      div.innerHTML = `
        <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 4px;">${record.type}</div>
        <div style="font-size: 0.85rem; color: var(--text-secondary);">
          Date: ${record.date} | Duration: ${record.duration} | Cost: ${record.cost}
        </div>
      `;
      maintContainer.appendChild(div);
    });
  } else {
    maintContainer.innerHTML = '<p>No maintenance history available</p>';
  }
  
  showModal('machine-detail-modal');
}

// Render group shortcuts
function renderGroupShortcuts() {
  const container = document.getElementById('group-shortcuts');
  container.innerHTML = '';
  
  appState.blueprint.machineGroups.forEach(group => {
    const btn = document.createElement('button');
    btn.className = 'group-shortcut';
    btn.textContent = `${group.icon} ${group.name}`;
    btn.addEventListener('click', () => showMachineGroupDetail(group.id));
    container.appendChild(btn);
  });
}

// Populate group selector
function populateGroupSelector() {
  const select = document.getElementById('group-selector');
  select.innerHTML = '<option value="">Select a machine group</option>';
  select.style.display = 'block';
  
  appState.blueprint.machineGroups.forEach(group => {
    const option = document.createElement('option');
    option.value = group.id;
    option.textContent = `${group.icon} ${group.name}`;
    select.appendChild(option);
  });
}

// Render recent alerts
function renderRecentAlerts() {
  const container = document.getElementById('recent-alerts');
  container.innerHTML = '';
  
  const recent = appState.blueprint.alerts.slice(0, 5);
  recent.forEach(alert => {
    const storedAlert = appState.alertStates[alert.id] || alert;
    const item = document.createElement('li');
    item.className = `anomaly-item severity-${alert.severity}`;
    item.style.cursor = 'pointer';
    item.innerHTML = `
      <strong>${alert.title}</strong>
      <small>${alert.description}</small>
      <small style="display: block; margin-top: 4px;">${new Date(alert.timestamp).toLocaleString()}</small>
      <span class="severity-badge severity-${alert.severity}">${alert.severity}</span>
      <span style="font-size: 0.7rem; color: var(--text-muted); margin-left: 8px;">Status: ${storedAlert.status}</span>
    `;
    item.addEventListener('click', () => showAlertResolution(alert.id));
    container.appendChild(item);
  });
}

// Render all alerts
function renderAllAlerts() {
  const container = document.getElementById('alerts-list');
  renderAlertList(container, appState.blueprint.alerts);
}

function renderAlertList(container, alerts) {
  if (!container) {
    console.error('[v0] Alert list container not found');
    return;
  }
  console.log('[v0] Rendering', alerts.length, 'alerts to container');
  container.innerHTML = '';
  alerts.forEach(alert => {
    const storedAlert = appState.alertStates[alert.id] || alert;
    const item = document.createElement('li');
    item.className = `anomaly-item severity-${alert.severity}`;
    item.style.cursor = 'pointer';
    
    // Enhanced alert card layout with status badge and metadata
    const timestamp = new Date(alert.timestamp);
    const statusDisplay = formatAlertStatus(storedAlert.status);
    const machineInstance = getMachineDisplayName(alert.machineGroup, alert.machine);
    
    item.innerHTML = `
      <div style="display: grid; grid-template-columns: auto 1fr auto; gap: 12px; align-items: start; width: 100%;">
        <div style="display: flex; gap: 8px; align-items: center;">
          <span class="severity-badge severity-${alert.severity}" style="white-space: nowrap;">${alert.severity}</span>
          <span style="font-size: 0.75rem; background: var(--surface-dark); padding: 3px 8px; border-radius: 4px; white-space: nowrap;">${alert.confidence}%</span>
        </div>
        <div>
          <strong style="display: block; margin-bottom: 4px;">${machineInstance} - ${alert.title}</strong>
          <small style="display: block; color: var(--text-secondary); margin-bottom: 6px;">${alert.description}</small>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 0.75rem; color: var(--text-muted);">
            <span>Triggered: ${timestamp.toLocaleString()}</span>
            <span>Signal: <strong>${alert.signal}</strong></span>
          </div>
        </div>
        <div style="text-align: right; display: flex; flex-direction: column; gap: 6px; align-items: flex-end;">
          <span style="padding: 4px 10px; border-radius: 4px; font-size: 0.75rem; font-weight: 600; background: ${getStatusColor(storedAlert.status)}; color: white; white-space: nowrap;">${statusDisplay}</span>
          <small style="color: var(--text-muted); font-size: 0.7rem;">Value: ${alert.value}</small>
        </div>
      </div>
    `;
    item.addEventListener('click', (e) => {
      console.log('[v0] Alert card clicked:', alert.id);
      showAlertResolution(alert.id);
    });
    container.appendChild(item);
  });
}

function getMachineDisplayName(groupId, machineId) {
  const group = appState.blueprint.machineGroups.find(g => g.id === groupId);
  if (!group) return machineId;
  const machine = group.machines.find(m => m.id === machineId);
  return machine ? machine.name : machineId;
}

function formatAlertStatus(status) {
  const statusMap = {
    'new': '🔴 New',
    'acknowledged': '🟡 Acknowledged',
    'in-investigation': '🔵 Investigating',
    'resolved': '✅ Resolved',
    'shelved': '⏸ Shelved',
    'snoozed': '⏱ Snoozed'
  };
  return statusMap[status] || status.toUpperCase();
}

function getStatusColor(status) {
  const colorMap = {
    'new': '#ef4444',
    'acknowledged': '#f59e0b',
    'in-investigation': '#3b82f6',
    'resolved': '#10b981',
    'shelved': '#8b5cf6',
    'snoozed': '#6366f1'
  };
  return colorMap[status] || '#6b7280';
}

// Filter alerts
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    const severityFilter = document.getElementById('filter-severity');
    const statusFilter = document.getElementById('filter-status');
    
    if (severityFilter) {
      severityFilter.addEventListener('change', filterAlerts);
    }
    if (statusFilter) {
      statusFilter.addEventListener('change', filterAlerts);
    }
  }, 500);
});

function filterAlerts() {
  const severity = document.getElementById('filter-severity')?.value;
  const status = document.getElementById('filter-status')?.value;
  
  let filtered = appState.blueprint.alerts;
  if (severity) filtered = filtered.filter(a => a.severity === severity);
  if (status) filtered = filtered.filter(a => a.status === status);
  
  renderAlertList(document.getElementById('alerts-list'), filtered);
}

// Populate profile modal
function populateProfileModal() {
  const user = appState.currentUser;
  document.getElementById('profile-fullname').value = user.name;
  document.getElementById('profile-email').value = user.email;
  document.getElementById('profile-department').value = user.department;
  document.getElementById('profile-phone').value = user.phone;
  document.getElementById('profile-role').value = user.role;
}

// Alert Resolution Functions
function showAlertResolution(alertId) {
  console.log('[v0] showAlertResolution called with alertId:', alertId);
  
  const alert = appState.blueprint.alerts.find(a => a.id === alertId);
  if (!alert) {
    console.error('[v0] Alert not found:', alertId);
    return;
  }
  
  console.log('[v0] Alert found:', alert);
  
  appState.currentAlert = alert;
  const storedAlert = appState.alertStates[alert.id] || alert;
  const machineInstance = getMachineDisplayName(alert.machineGroup, alert.machine);
  
  // Populate modal header and metadata
  const titleEl = document.getElementById('alert-res-title');
  const descEl = document.getElementById('alert-res-description');
  const machineEl = document.getElementById('alert-res-machine');
  const signalEl = document.getElementById('alert-res-signal');
  const valueEl = document.getElementById('alert-res-value');
  const severityEl = document.getElementById('alert-res-severity');
  const confEl = document.getElementById('alert-res-confidence');
  
  if (titleEl) titleEl.textContent = `${alert.title} [${alert.severity.toUpperCase()}]`;
  if (descEl) descEl.textContent = alert.description;
  if (machineEl) machineEl.textContent = machineInstance;
  if (signalEl) signalEl.textContent = `${alert.signal} (${alert.value} / Threshold: ${alert.threshold})`;
  if (valueEl) valueEl.textContent = `Current: ${alert.value} | Min: ${alert.value * 0.8} | Max: ${alert.value * 1.2}`;
  if (severityEl) severityEl.textContent = alert.severity.toUpperCase();
  if (confEl) confEl.textContent = alert.confidence;
  
  console.log('[v0] Modal elements populated');
  
  // Update modal title with status
  const statusDisplay = formatAlertStatus(storedAlert.status);
  const modalHeader = document.querySelector('#alert-resolution-modal .modal-header h2');
  if (modalHeader) {
    modalHeader.textContent = `${statusDisplay} - Alert Details`;
  }
  
  // Restore previous notes and selections if they exist
  const notesEl = document.getElementById('alert-notes');
  const actionEl = document.getElementById('resolution-action');
  
  if (notesEl) notesEl.value = storedAlert.investigationNotes || '';
  if (actionEl) actionEl.value = storedAlert.resolutionAction || '';
  
  // Restore root cause selections
  document.querySelectorAll('input[id^="root-cause-"]').forEach(cb => {
    cb.checked = storedAlert.rootCauses && storedAlert.rootCauses.includes(cb.id.replace('root-cause-', ''));
  });
  
  // Update button states based on current status
  updateAlertActionButtons(storedAlert);
  
  console.log('[v0] About to show modal');
  
  // Show modal
  const modal = document.getElementById('alert-resolution-modal');
  if (modal) {
    modal.style.display = 'flex';
    console.log('[v0] Modal displayed with display: flex');
  } else {
    console.error('[v0] Modal element not found!');
  }
}

function updateAlertActionButtons(alert) {
  const acknowledgeBtn = document.getElementById('btn-acknowledge');
  const snoozeBtn = document.getElementById('btn-snooze');
  const resolveBtn = document.getElementById('btn-resolve');
  
  // Disable acknowledge if already acknowledged or resolved
  acknowledgeBtn.disabled = alert.status === 'acknowledged' || alert.status === 'resolved' || alert.status === 'shelved';
  
  // Show appropriate button text based on status
  if (alert.status === 'acknowledged') {
    acknowledgeBtn.textContent = '✓ Already Acknowledged';
  } else {
    acknowledgeBtn.textContent = '✓ Acknowledge';
  }
  
  // Update resolve button
  if (alert.status === 'resolved') {
    resolveBtn.textContent = '✓ Resolved';
    resolveBtn.disabled = true;
  } else {
    resolveBtn.textContent = 'Resolve Alert';
    resolveBtn.disabled = false;
  }
}

function resolveAlert() {
  if (!appState.currentAlert) return;
  
  const alert = appState.currentAlert;
  const notes = document.getElementById('alert-notes').value;
  const action = document.getElementById('resolution-action').value;
  const rootCauses = Array.from(document.querySelectorAll('input[id^="root-cause-"]:checked'))
    .map(cb => cb.id.replace('root-cause-', ''));
  
  if (!action) {
    alert('Please select a resolution action');
    return;
  }
  
  // Get or merge the alert state
  const storedAlert = appState.alertStates[alert.id] || alert;
  
  // Update alert state based on action
  storedAlert.status = 'resolved';
  storedAlert.resolvedAt = new Date().toISOString();
  storedAlert.resolutionAction = action;
  storedAlert.investigationNotes = notes;
  storedAlert.rootCauses = rootCauses;
  storedAlert.resolvedBy = appState.currentUser.name;
  
  console.log('[v0] Alert resolved:', alert.id, {
    action,
    notes,
    rootCauses,
    timestamp: storedAlert.resolvedAt
  });
  
  // Save to localStorage
  appState.alertStates[alert.id] = storedAlert;
  localStorage.setItem('alertStates', JSON.stringify(appState.alertStates));
  
  // Update UI
  renderAllAlerts();
  renderRecentAlerts();
  
  // Close modal
  document.getElementById('alert-resolution-modal').style.display = 'none';
  alert('✓ Alert resolved successfully!');
}

function acknowledgeAlert() {
  if (!appState.currentAlert) return;
  
  const alert = appState.currentAlert;
  
  // Get or merge the alert state
  const storedAlert = appState.alertStates[alert.id] || alert;
  
  // Skip if already acknowledged
  if (storedAlert.status === 'acknowledged' || storedAlert.status === 'resolved') {
    alert('This alert has already been acknowledged');
    return;
  }
  
  storedAlert.status = 'acknowledged';
  storedAlert.acknowledgedAt = new Date().toISOString();
  storedAlert.acknowledgedBy = appState.currentUser.name;
  
  console.log('[v0] Alert acknowledged:', alert.id, {
    acknowledgedAt: storedAlert.acknowledgedAt,
    user: appState.currentUser.name
  });
  
  appState.alertStates[alert.id] = storedAlert;
  localStorage.setItem('alertStates', JSON.stringify(appState.alertStates));
  
  // Update button state
  updateAlertActionButtons(storedAlert);
  
  renderAllAlerts();
  renderRecentAlerts();
  alert('✓ Alert acknowledged by ' + appState.currentUser.name);
}

function snoozeAlert() {
  if (!appState.currentAlert) return;
  
  const alert = appState.currentAlert;
  
  // Get or merge the alert state
  const storedAlert = appState.alertStates[alert.id] || alert;
  
  const snoozeUntil = new Date(Date.now() + 3600000).toISOString();
  storedAlert.status = 'snoozed';
  storedAlert.snoozedUntil = snoozeUntil;
  storedAlert.snoozedBy = appState.currentUser.name;
  
  console.log('[v0] Alert snoozed for 1 hour:', alert.id, {
    snoozedUntil: snoozeUntil,
    user: appState.currentUser.name
  });
  
  appState.alertStates[alert.id] = storedAlert;
  localStorage.setItem('alertStates', JSON.stringify(appState.alertStates));
  
  renderAllAlerts();
  renderRecentAlerts();
  document.getElementById('alert-resolution-modal').style.display = 'none';
  alert('⏱ Alert snoozed until ' + new Date(snoozeUntil).toLocaleTimeString());
}
