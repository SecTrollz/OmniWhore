/* ================= CHUNK 2: Device Discovery Core Logic ================= */

// ---------- Device Watchers Tracking ----------
let deviceWatchers = {}; // {ip: {enrolledAt, lastSeen, activities: [...]}}
let watcherActivities = new Map(); // ip -> array of {type, ts, detail}

function trackDeviceActivity(ip, type, detail = '') {
    if (!deviceWatchers[ip]) {
        deviceWatchers[ip] = {
            ip,
            enrolledAt: Date.now(),
            lastSeen: Date.now(),
            status: 'active',
            activities: []
        };
    }
    const entry = {
        type, // 'enroll', 'access', 'update', 'retire'
        ts: Date.now(),
        detail
    };
    deviceWatchers[ip].activities.push(entry);
    if (!watcherActivities.has(ip)) {
        watcherActivities.set(ip, []);
    }
    watcherActivities.get(ip).push(entry);
    // Keep last 10 activities
    deviceWatchers[ip].activities = deviceWatchers[ip].activities.slice(-10);
}

async function renderWatchers() {
    const all = [...registry.values()];
    
    // Build watcher stats
    const totalEnrolled = Object.keys(deviceWatchers).length;
    const activeNow = Object.values(deviceWatchers).filter(w => {
        const age = Date.now() - w.lastSeen;
        return age < 60000; // active if seen in last 60s
    }).length;
    const recentChanges = all.filter(a => {
        const w = deviceWatchers[a.ip];
        return w && (Date.now() - w.enrolledAt) < 86400000; // enrolled in last 24h
    }).length;
    
    // Render stats
    let statsHtml = `
        <div class="stat-card">
            <div class="stat-value">${totalEnrolled}</div>
            <div class="stat-label">Devices Watched</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${activeNow}</div>
            <div class="stat-label">Active Now</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${recentChanges}</div>
            <div class="stat-label">24h Changes</div>
        </div>
    `;
    $('watchersStats').innerHTML = statsHtml;
    
    // Render watcher cards
    let html = '';
    const sorted = all.sort((a, b) => {
        const wA = deviceWatchers[a.ip];
        const wB = deviceWatchers[b.ip];
        return (wB?.lastSeen || 0) - (wA?.lastSeen || 0);
    });
    
    for (const asset of sorted) {
        if (!deviceWatchers[asset.ip]) continue;
        const w = deviceWatchers[asset.ip];
        const age = Date.now() - w.lastSeen;
        const isActive = age < 60000;
        const enrollDuration = Math.floor((Date.now() - w.enrolledAt) / 1000);
        const lastActivity = w.activities[w.activities.length - 1];
        
        html += `<div class="watcher-card">
            <div class="watcher-ip">${asset.ip}</div>
            <div class="watcher-meta">
                <span>${asset.hostnames?.[0] || '—'}</span>
                <span>${asset.org || 'unknown'}</span>
                <span class="watcher-status">
                    <span class="pulse-dot ${isActive ? 'green' : 'red'}"></span>
                    ${isActive ? 'ACTIVE' : 'IDLE'}
                </span>
            </div>
            <div class="watcher-activity">
                Enrolled: ${fmtTs(w.enrolledAt)}<br>
                Last: ${lastActivity ? `${lastActivity.type} — ${fmtTs(lastActivity.ts)}` : '—'}
            </div>
        </div>`;
    }
    
    if (!html) {
        html = '<div style="grid-column:1/-1;text-align:center;color:var(--text3);padding:40px 20px;">No devices being watched yet. Enroll assets to begin tracking.</div>';
    }
    $('watchersList').innerHTML = html;
}

// ---------- Organization Discovery Mapping ----------
let orgMapping = {}; // {orgName: {devices: [...], stats: {...}}}

async function buildOrgMapping() {
    orgMapping = {};
    const all = [...registry.values()];
    
    for (const asset of all) {
        const org = asset.org || 'unknown';
        if (!orgMapping[org]) {
            orgMapping[org] = {
                name: org,
                devices: [],
                stats: {
                    active: 0,
                    maintenance: 0,
                    decommissioned: 0,
                    rogue: 0,
                    discovered: 0
                }
            };
        }
        orgMapping[org].devices.push(asset);
        if (asset.status && orgMapping[org].stats[asset.status] !== undefined) {
            orgMapping[org].stats[asset.status]++;
        }
    }
    return orgMapping;
}

async function renderDiscovery() {
    await buildOrgMapping();
    
    // Build discovery stats
    const totalOrgs = Object.keys(orgMapping).length;
    const totalDevices = Object.values(orgMapping).reduce((sum, o) => sum + o.devices.length, 0);
    const avgPerOrg = totalOrgs > 0 ? Math.round(totalDevices / totalOrgs) : 0;
    
    let statsHtml = `
        <div class="stat-card">
            <div class="stat-value">${totalOrgs}</div>
            <div class="stat-label">Organizations</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${totalDevices}</div>
            <div class="stat-label">Total Devices</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${avgPerOrg}</div>
            <div class="stat-label">Avg per Org</div>
        </div>
    `;
    $('discoveryStats').innerHTML = statsHtml;
    
    // Render org cards
    let html = '';
    const sorted = Object.values(orgMapping).sort((a, b) => b.devices.length - a.devices.length);
    
    for (const org of sorted) {
        const statusSummary = Object.entries(org.stats)
            .filter(([_, count]) => count > 0)
            .map(([status, count]) => `<span class="org-tag">${status}: ${count}</span>`)
            .join('');
        
        html += `<div class="org-card">
            <div class="org-header">
                <div class="org-name">${org.name}</div>
                <div class="org-count">${org.devices.length}</div>
            </div>
            <div class="org-stats">
                <div class="org-stat">
                    <div class="org-stat-label">Active</div>
                    <div class="org-stat-val">${org.stats.active}</div>
                </div>
                <div class="org-stat">
                    <div class="org-stat-label">Rogue/Unknown</div>
                    <div class="org-stat-val">${org.stats.rogue + org.stats.discovered}</div>
                </div>
            </div>
            <div class="org-tags">${statusSummary}</div>
        </div>`;
    }
    
    if (!html) {
        html = '<div style="grid-column:1/-1;text-align:center;color:var(--text3);padding:40px 20px;">No organizations mapped. Add assets to build organization hierarchy.</div>';
    }
    $('orgList').innerHTML = html;
}

// ---------- Network Topology & Relationships ----------
let topologyGraph = {
    nodes: [],
    edges: []
};

async function buildTopology() {
    const all = [...registry.values()];
    topologyGraph = { nodes: [], edges: [] };
    
    // Create nodes for each org
    const orgs = new Set(all.map(a => a.org || 'unknown'));
    for (const org of orgs) {
        topologyGraph.nodes.push({
            id: `org_${org}`,
            label: org,
            type: 'org',
            size: all.filter(a => a.org === org).length
        });
    }
    
    // Create nodes for high-value devices
    for (const asset of all) {
        if (asset.status === 'active' && asset.ports?.some(p => p.service === 'SSH' || p.service === 'HTTPS')) {
            topologyGraph.nodes.push({
                id: `dev_${asset.ip}`,
                label: asset.hostnames?.[0] || asset.ip,
                type: 'device',
                org: asset.org || 'unknown',
                status: asset.status
            });
            // Connect device to org
            topologyGraph.edges.push({
                from: `org_${asset.org || 'unknown'}`,
                to: `dev_${asset.ip}`,
                type: 'belongs'
            });
        }
    }
    
    // Create peer/dependency edges
    for (const asset of all) {
        if (asset.peerOf) {
            topologyGraph.edges.push({
                from: `dev_${asset.ip}`,
                to: `dev_${asset.peerOf}`,
                type: 'peer'
            });
        }
    }
    
    return topologyGraph;
}

async function renderTopology() {
    await buildTopology();
    
    // Stats
    const nodeCount = topologyGraph.nodes.length;
    const edgeCount = topologyGraph.edges.length;
    const orgNodes = topologyGraph.nodes.filter(n => n.type === 'org').length;
    
    let statsHtml = `
        <div class="stat-card">
            <div class="stat-value">${orgNodes}</div>
            <div class="stat-label">Org Nodes</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${nodeCount - orgNodes}</div>
            <div class="stat-label">Device Nodes</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${edgeCount}</div>
            <div class="stat-label">Relationships</div>
        </div>
    `;
    $('topologyStats').innerHTML = statsHtml;
    
    // Legend
    let legendHtml = `
        <div class="legend-section">
            <div class="legend-title">Nodes</div>
            <div class="legend-item">
                <div class="legend-dot" style="background:var(--orange);"></div>
                <span>Organization</span>
            </div>
            <div class="legend-item">
                <div class="legend-dot" style="background:var(--green);"></div>
                <span>Active Device</span>
            </div>
        </div>
        <div class="legend-section">
            <div class="legend-title">Edges</div>
            <div class="legend-item">
                <span style="border-bottom:2px solid var(--blue);width:20px;"></span>
                <span>Belongs To</span>
            </div>
            <div class="legend-item">
                <span style="border-bottom:2px dashed var(--purple);width:20px;"></span>
                <span>Peer Link</span>
            </div>
        </div>
    `;
    $('topologyLegend').innerHTML = legendHtml;
    
    // Draw canvas
    const canvas = $('topologyCanvas');
    const ctx = canvas.getContext('2d');
    
    // Set canvas size
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
    
    // Simple force-directed layout (simplified version)
    const width = canvas.width;
    const height = canvas.height;
    
    // Position orgs in circle, devices around them
    const positions = {};
    const orgList = topologyGraph.nodes.filter(n => n.type === 'org');
    const radius = Math.min(width, height) / 3;
    const centerX = width / 2;
    const centerY = height / 2;
    
    // Position org nodes
    orgList.forEach((org, i) => {
        const angle = (i / Math.max(orgList.length, 1)) * Math.PI * 2;
        positions[org.id] = {
            x: centerX + Math.cos(angle) * radius,
            y: centerY + Math.sin(angle) * radius
        };
    });
    
    // Position device nodes around their org
    const deviceList = topologyGraph.nodes.filter(n => n.type === 'device');
    deviceList.forEach((dev, i) => {
        const orgNode = orgList.find(o => o.id === `org_${dev.org}`);
        if (orgNode) {
            const orgPos = positions[orgNode.id];
            const angle = (i / Math.max(deviceList.length, 1)) * Math.PI * 2;
            positions[dev.id] = {
                x: orgPos.x + Math.cos(angle) * 80,
                y: orgPos.y + Math.sin(angle) * 80
            };
        }
    });
    
    // Clear and draw
    ctx.fillStyle = 'var(--coal)';
    ctx.fillRect(0, 0, width, height);
    
    // Draw edges
    ctx.strokeStyle = 'var(--border2)';
    ctx.lineWidth = 1;
    for (const edge of topologyGraph.edges) {
        const from = positions[edge.from];
        const to = positions[edge.to];
        if (from && to) {
            ctx.beginPath();
            ctx.moveTo(from.x, from.y);
            ctx.lineTo(to.x, to.y);
            if (edge.type === 'peer') {
                ctx.setLineDash([5, 5]);
                ctx.strokeStyle = 'var(--purple)';
            } else {
                ctx.setLineDash([]);
                ctx.strokeStyle = 'var(--blue)';
            }
            ctx.stroke();
        }
    }
    
    // Draw nodes
    for (const node of topologyGraph.nodes) {
        const pos = positions[node.id];
        if (!pos) continue;
        
        const radius = node.type === 'org' ? 20 : 12;
        const color = node.type === 'org' ? 'var(--orange)' : 'var(--green)';
        
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
        ctx.fill();
        
        // Label
        ctx.fillStyle = 'var(--text)';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(node.label.substring(0, 10), pos.x, pos.y);
    }
}

// ---------- Navigation & View Switching ----------
function switchDiscoveryView(view) {
    const views = ['viewResults', 'viewMaps', 'viewWatchers', 'viewDiscovery', 'viewTopology', 'viewLedger', 'viewHelp'];
    for (const v of views) {
        $(v).classList.add('hidden');
    }
    
    const viewMap = {
        'results': 'viewResults',
        'maps': 'viewMaps',
        'watchers': 'viewWatchers',
        'discovery': 'viewDiscovery',
        'topology': 'viewTopology',
        'ledger': 'viewLedger',
        'help': 'viewHelp'
    };
    
    const target = viewMap[view];
    if (target) $(target).classList.remove('hidden');
    
    // Update nav active state
    const navs = ['navResults', 'navMaps', 'navWatchers', 'navDiscovery', 'navTopology', 'navLedger', 'navHelp'];
    for (const n of navs) {
        const el = $(n);
        if (el) el.classList.remove('active');
    }
    
    const navMap = {
        'results': 'navResults',
        'maps': 'navMaps',
        'watchers': 'navWatchers',
        'discovery': 'navDiscovery',
        'topology': 'navTopology',
        'ledger': 'navLedger',
        'help': 'navHelp'
    };
    const nav = navMap[view];
    if (nav && $(nav)) $(nav).classList.add('active');
    
    activeView = view;
}

// Hook watcher tracking into existing operations
const origAppend = append;
window.append = async function(op, payload) {
    const result = await origAppend(op, payload);
    if (payload?.ip) {
        trackDeviceActivity(payload.ip, op, payload.hostnames?.[0] || '');
    }
    return result;
};

// Export for use in main script
window.discoveryLogic = {
    trackDeviceActivity,
    renderWatchers,
    buildOrgMapping,
    renderDiscovery,
    buildTopology,
    renderTopology,
    switchDiscoveryView,
    deviceWatchers,
    orgMapping,
    topologyGraph
};
