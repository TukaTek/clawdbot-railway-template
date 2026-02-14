// Client-side JS for Fleet Manager dashboard.
// No fancy syntax: keep it maximally compatible (same pattern as setup-app.js).

(function () {
  var instancesListEl = document.getElementById('instancesList');
  var createPanelEl = document.getElementById('createPanel');
  var createNameEl = document.getElementById('createName');
  var createPasswordEl = document.getElementById('createPassword');
  var createNotesEl = document.getElementById('createNotes');
  var createRunEl = document.getElementById('createRun');
  var createCancelEl = document.getElementById('createCancel');
  var createLogEl = document.getElementById('createLog');
  var showCreateEl = document.getElementById('showCreate');
  var refreshAllEl = document.getElementById('refreshAll');

  function httpJson(url, opts) {
    opts = opts || {};
    opts.credentials = 'same-origin';
    return fetch(url, opts).then(function (res) {
      if (!res.ok) {
        return res.text().then(function (t) {
          throw new Error('HTTP ' + res.status + ': ' + (t || res.statusText));
        });
      }
      return res.json();
    });
  }

  function escapeHtml(s) {
    var d = document.createElement('div');
    d.appendChild(document.createTextNode(String(s || '')));
    return d.innerHTML;
  }

  function statusLabel(status) {
    var labels = {
      'running': 'Running',
      'needs-setup': 'Needs Setup',
      'building': 'Building',
      'deploying': 'Deploying',
      'failed': 'Failed',
      'unhealthy': 'Unhealthy',
      'stopped': 'Stopped',
      'no-deployment': 'No Deployment',
      'unknown': 'Unknown'
    };
    return labels[status] || status;
  }

  function statusDotClass(status) {
    var map = {
      'running': 'status-running',
      'needs-setup': 'status-needs-setup',
      'building': 'status-building',
      'deploying': 'status-deploying',
      'failed': 'status-failed',
      'unhealthy': 'status-unhealthy',
      'stopped': 'status-stopped',
      'no-deployment': 'status-no-deployment',
      'unknown': 'status-unknown'
    };
    return map[status] || 'status-unknown';
  }

  // --- Dashboard ---

  function loadInstances() {
    instancesListEl.innerHTML = '<p class="muted">Loading instances...</p>';

    httpJson('/api/instances').then(function (j) {
      var instances = j.instances || [];

      if (instances.length === 0) {
        instancesListEl.innerHTML = '<div class="card"><p class="muted">No instances yet. Click "New Instance" to create one.</p></div>';
        return;
      }

      var html = '<div class="instance-grid">';
      for (var i = 0; i < instances.length; i++) {
        var inst = instances[i];
        var dotClass = statusDotClass(inst.status);
        var label = statusLabel(inst.status);
        var domainLink = inst.domain
          ? '<a href="https://' + escapeHtml(inst.domain) + '/setup" target="_blank" style="color:#FF6B35; text-decoration:none;">' + escapeHtml(inst.domain) + '</a>'
          : '<span class="muted">Pending...</span>';

        html += '<div class="instance-card">';
        html += '<h3>' + escapeHtml(inst.name) + '</h3>';
        html += '<div><span class="status-dot ' + dotClass + '"></span> ' + escapeHtml(label) + '</div>';
        html += '<div class="muted" style="margin-top:0.25rem">Domain: ' + domainLink + '</div>';
        if (inst.setupPassword) {
          html += '<div class="muted" style="margin-top:0.25rem">Setup password: <code>' + escapeHtml(inst.setupPassword) + '</code></div>';
        }
        if (inst.tailscale && inst.tailscale.hostname) {
          html += '<div class="muted" style="margin-top:0.25rem">Tailscale: <a href="https://' + escapeHtml(inst.tailscale.hostname) + '/" target="_blank" style="color:#4ade80; text-decoration:none;">' + escapeHtml(inst.tailscale.hostname) + '</a></div>';
        }
        if (inst.notes) {
          html += '<div class="muted" style="margin-top:0.25rem">' + escapeHtml(inst.notes) + '</div>';
        }
        html += '<div class="muted" style="margin-top:0.25rem">Created: ' + escapeHtml(inst.createdAt ? new Date(inst.createdAt).toLocaleDateString() : '?') + '</div>';

        html += '<div class="instance-actions">';
        if (inst.domain) {
          html += '<a href="https://' + escapeHtml(inst.domain) + '/setup" target="_blank"><button class="btn-primary">Open Setup</button></a>';
          html += '<a href="https://' + escapeHtml(inst.domain) + '/openclaw" target="_blank"><button class="btn-secondary">Open CortexAI</button></a>';
        }
        html += '<button class="btn-muted" onclick="fleetActions.restart(\'' + escapeHtml(inst.id) + '\')">Restart</button>';
        html += '<button class="btn-muted" onclick="fleetActions.redeploy(\'' + escapeHtml(inst.id) + '\')">Redeploy</button>';
        html += '<button class="btn-danger" onclick="fleetActions.remove(\'' + escapeHtml(inst.id) + '\', \'' + escapeHtml(inst.name) + '\')">Delete</button>';
        html += '</div>'; // .instance-actions

        html += '</div>'; // .instance-card
      }
      html += '</div>'; // .instance-grid

      instancesListEl.innerHTML = html;
    }).catch(function (e) {
      instancesListEl.innerHTML = '<div class="card"><p style="color:#f87171">Error loading instances: ' + escapeHtml(String(e)) + '</p></div>';
    });
  }

  // --- Create instance ---

  showCreateEl.onclick = function () {
    createPanelEl.style.display = '';
    createLogEl.style.display = 'none';
    createLogEl.textContent = '';
    createNameEl.value = '';
    createPasswordEl.value = '';
    createNotesEl.value = '';
    createNameEl.focus();
  };

  createCancelEl.onclick = function () {
    createPanelEl.style.display = 'none';
  };

  createRunEl.onclick = function () {
    var name = createNameEl.value.trim();
    if (!name) {
      alert('Enter an instance name.');
      return;
    }

    createRunEl.disabled = true;
    createLogEl.style.display = '';
    createLogEl.textContent = 'Creating instance "' + name + '"...\n';

    httpJson('/api/instances', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: name,
        setupPassword: createPasswordEl.value.trim() || undefined,
        notes: createNotesEl.value.trim() || undefined
      })
    }).then(function (j) {
      if (j.log) {
        createLogEl.textContent = j.log.join('\n') + '\n';
      }
      if (j.ok) {
        createLogEl.textContent += '\nInstance created successfully!\n';
        createLogEl.textContent += 'Setup password: ' + (j.instance.setupPassword || '(check dashboard)') + '\n';
        createLogEl.textContent += '\nThe Docker build will take several minutes. Refresh the dashboard to check status.\n';
      } else {
        createLogEl.textContent += '\nError: ' + (j.error || 'Unknown error') + '\n';
      }
      loadInstances();
    }).catch(function (e) {
      createLogEl.textContent += '\nError: ' + String(e) + '\n';
    }).then(function () {
      createRunEl.disabled = false;
    });
  };

  // --- Instance actions (global so onclick attributes work) ---

  window.fleetActions = {
    restart: function (id) {
      if (!confirm('Restart this instance? This triggers a redeployment.')) return;
      httpJson('/api/instances/' + id + '/restart', { method: 'POST' })
        .then(function () { loadInstances(); })
        .catch(function (e) { alert('Restart error: ' + String(e)); });
    },

    redeploy: function (id) {
      if (!confirm('Redeploy this instance? This pulls the latest code and rebuilds.')) return;
      httpJson('/api/instances/' + id + '/redeploy', { method: 'POST' })
        .then(function () { loadInstances(); })
        .catch(function (e) { alert('Redeploy error: ' + String(e)); });
    },

    remove: function (id, name) {
      if (!confirm('DELETE instance "' + name + '"?\n\nThis permanently deletes the Railway project, all data, and cannot be undone.')) return;
      if (!confirm('Are you sure? Type the instance name to confirm.\n\n(Click OK to proceed with deletion)')) return;

      httpJson('/api/instances/' + id, { method: 'DELETE' })
        .then(function () { loadInstances(); })
        .catch(function (e) { alert('Delete error: ' + String(e)); });
    }
  };

  // --- Refresh ---

  refreshAllEl.onclick = function () {
    loadInstances();
  };

  // --- Init ---

  loadInstances();
})();
