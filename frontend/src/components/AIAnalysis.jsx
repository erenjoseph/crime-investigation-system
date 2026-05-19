import { useState, useEffect, useRef } from 'react';
import { getAllRecords } from '../db/database';

const AI_TABS = [
    { id: 'similar', label: 'Similar Crimes', icon: 'SIM' },
    { id: 'suspects', label: 'Suspect Recommendation', icon: 'SUS' },
    { id: 'hotspots', label: 'Crime Hotspots', icon: 'GEO' },
    { id: 'priority', label: 'Case Priority', icon: 'PRI' },
    { id: 'network', label: 'Criminal Network', icon: 'NET' },
];

export default function AIAnalysis() {
    const [activeTab, setActiveTab] = useState('similar');
    const [firs, setFirs] = useState([]);
    const [criminals, setCriminals] = useState([]);
    const [evidence, setEvidence] = useState([]);
    const [cases, setCases] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        try {
            const [f, cr, e, c] = await Promise.all([
                getAllRecords('firs'),
                getAllRecords('criminals'),
                getAllRecords('evidence'),
                getAllRecords('cases'),
            ]);
            setFirs(f);
            setCriminals(cr);
            setEvidence(e);
            setCases(c);
        } catch (err) { console.error(err); }
        setLoading(false);
    }

    if (loading) return <div className="loading-screen"><div className="spinner" /><p>Loading AI Analysis Engine...</p></div>;

    return (
        <div className="module-page ai-module">
            <div className="page-header">
                <div>
                    <h2>AI-Powered Analysis</h2>
                    <p className="page-subtitle">Intelligent crime analysis with explainable, advisory AI outputs</p>
                </div>
                <div className="ai-badge">
                    <span className="ai-pulse" />
                    AI Engine Active
                </div>
            </div>

            <div className="ai-disclaimer">
                <strong>ADVISORY ONLY</strong> — AI outputs are decision-support tools. All findings must be validated by human investigators before action.
            </div>

            <div className="ai-tabs">
                {AI_TABS.map(tab => (
                    <button
                        key={tab.id}
                        className={`ai-tab ${activeTab === tab.id ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        <span className="nav-code">{tab.icon}</span>
                        <span>{tab.label}</span>
                    </button>
                ))}
            </div>

            <div className="ai-content">
                {activeTab === 'similar' && <SimilarCrimes firs={firs} />}
                {activeTab === 'suspects' && <SuspectRecommendation firs={firs} criminals={criminals} />}
                {activeTab === 'hotspots' && <CrimeHotspots firs={firs} />}
                {activeTab === 'priority' && <CasePriority firs={firs} evidence={evidence} cases={cases} />}
                {activeTab === 'network' && <NetworkAnalysis criminals={criminals} />}
            </div>
        </div>
    );
}

// ---- SIMILAR CRIMES ----
function SimilarCrimes({ firs }) {
    const [selectedFir, setSelectedFir] = useState(null);
    const [results, setResults] = useState([]);

    async function analyze(fir) {
        setSelectedFir(fir);
        try {
            const res = await fetch('/api/ai/similar-crimes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetFirId: fir.firId }),
            });
            const similar = await res.json();
            setResults(similar);
        } catch (err) { console.error(err); }
    }

    return (
        <div className="ai-section">
            <h3>Similar Crime Detection</h3>
            <p className="ai-desc">Select a FIR to find historically similar crimes using cosine similarity on crime attributes (type, method, location, time, severity).</p>

            <div className="ai-two-col">
                <div className="ai-select-list">
                    <h4>Select a FIR:</h4>
                    {firs.map(fir => (
                        <button
                            key={fir.firId}
                            className={`ai-fir-btn ${selectedFir?.firId === fir.firId ? 'active' : ''}`}
                            onClick={() => analyze(fir)}
                        >
                            <span className="ai-fir-id">#{fir.firId}</span>
                            <span className="ai-fir-type">{fir.crimeType}</span>
                            <span className="ai-fir-loc">{fir.location}</span>
                        </button>
                    ))}
                </div>

                <div className="ai-results">
                    {!selectedFir ? (
                        <div className="empty-state"><span className="empty-icon">—</span><p>Select a FIR to analyze</p></div>
                    ) : results.length === 0 ? (
                        <div className="empty-state"><span className="empty-icon">—</span><p>No similar crimes found</p></div>
                    ) : (
                        <>
                            <h4>Similar Crimes to FIR #{selectedFir.firId} ({selectedFir.crimeType})</h4>
                            {results.map((r, idx) => (
                                <div key={r.fir.firId} className="similarity-card">
                                    <div className="sim-header">
                                        <span className="sim-rank">#{idx + 1}</span>
                                        <div className="sim-score">
                                            <div className="score-bar">
                                                <div className="score-fill" style={{ width: `${r.similarity}%` }} />
                                            </div>
                                            <span className="score-label">{r.similarity}% match</span>
                                        </div>
                                    </div>
                                    <div className="sim-body">
                                        <strong>FIR #{r.fir.firId} — {r.fir.crimeType}</strong>
                                        <p>{r.fir.location} | {r.fir.date}</p>
                                        <p className="sim-desc">{r.fir.description?.substring(0, 120)}...</p>
                                    </div>
                                    <div className="sim-factors">
                                        <label>Matching Factors:</label>
                                        {r.factors.map((f, i) => (
                                            <span key={i} className={`factor-tag ${f.weight?.toLowerCase()}`}>
                                                {f.factor} ({f.weight})
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

// ---- SUSPECT RECOMMENDATION ----
function SuspectRecommendation({ firs, criminals }) {
    const [selectedFir, setSelectedFir] = useState(null);
    const [results, setResults] = useState([]);

    async function analyze(fir) {
        setSelectedFir(fir);
        try {
            const res = await fetch('/api/ai/suspect-recommendation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetFirId: fir.firId }),
            });
            const suspects = await res.json();
            setResults(suspects);
        } catch (err) { console.error(err); }
    }

    return (
        <div className="ai-section">
            <h3>Suspect Recommendation</h3>
            <p className="ai-desc">AI scores criminal profiles against case attributes — crime type history, location proximity, risk level, prior convictions, and activity status.</p>

            <div className="ai-two-col">
                <div className="ai-select-list">
                    <h4>Select a FIR:</h4>
                    {firs.map(fir => (
                        <button key={fir.firId} className={`ai-fir-btn ${selectedFir?.firId === fir.firId ? 'active' : ''}`}
                            onClick={() => analyze(fir)}>
                            <span className="ai-fir-id">#{fir.firId}</span>
                            <span className="ai-fir-type">{fir.crimeType}</span>
                            <span className="ai-fir-loc">{fir.location}</span>
                        </button>
                    ))}
                </div>

                <div className="ai-results">
                    {!selectedFir ? (
                        <div className="empty-state"><span className="empty-icon">—</span><p>Select a FIR to get suspect recommendations</p></div>
                    ) : (
                        <>
                            <h4>Suspect Analysis for FIR #{selectedFir.firId} ({selectedFir.crimeType})</h4>
                            {results.map((r, idx) => (
                                <div key={r.criminal.criminalId} className={`suspect-card confidence-${r.confidence?.toLowerCase()}`}>
                                    <div className="suspect-header">
                                        <div className="suspect-rank">#{idx + 1}</div>
                                        <div className="suspect-info">
                                            <strong>{r.criminal.name}</strong>
                                            <span className="suspect-alias">{r.criminal.aliases ? `aka "${r.criminal.aliases}"` : ''}</span>
                                        </div>
                                        <div className="suspect-score">
                                            <span className="score-value">{r.score}</span>
                                            <span className="score-max">/100</span>
                                            <span className={`confidence-badge ${r.confidence?.toLowerCase()}`}>{r.confidence}</span>
                                        </div>
                                    </div>
                                    <div className="suspect-reasons">
                                        <label>Reasoning:</label>
                                        <ul>
                                            {r.reasons.map((reason, i) => <li key={i}>{reason}</li>)}
                                        </ul>
                                    </div>
                                    <div className="suspect-meta">
                                        <span className={`severity-badge ${r.criminal.riskLevel?.toLowerCase()}`}>{r.criminal.riskLevel} Risk</span>
                                        <span className={`status-badge ${r.criminal.status?.replace(/\s/g, '-').toLowerCase()}`}>{r.criminal.status}</span>
                                    </div>
                                </div>
                            ))}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

// ---- CRIME HOTSPOTS ----
function CrimeHotspots({ firs }) {
    const [hotspots, setHotspots] = useState([]);
    const mapRef = useRef(null);
    const mapInstance = useRef(null);

    useEffect(() => {
        async function loadHotspots() {
            try {
                const res = await fetch('/api/ai/hotspots');
                const spots = await res.json();
                setHotspots(spots);
            } catch (err) { console.error(err); }
        }
        loadHotspots();
    }, [firs]);

    useEffect(() => {
        if (!mapRef.current || mapInstance.current) return;

        // Dynamically load Leaflet CSS
        if (!document.getElementById('leaflet-css')) {
            const link = document.createElement('link');
            link.id = 'leaflet-css';
            link.rel = 'stylesheet';
            link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
            document.head.appendChild(link);
        }

        // Wait for Leaflet to be available
        const initMap = () => {
            if (typeof window.L === 'undefined') {
                const script = document.createElement('script');
                script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
                script.onload = () => createMap();
                document.body.appendChild(script);
            } else {
                createMap();
            }
        };

        const createMap = () => {
            const L = window.L;
            const map = L.map(mapRef.current).setView([20.5937, 78.9629], 5);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
            }).addTo(map);

            // Add markers for FIRs
            firs.forEach(fir => {
                if (fir.lat && fir.lng) {
                    const color = fir.severity === 'Critical' ? '#ef4444' :
                        fir.severity === 'High' ? '#f59e0b' :
                            fir.severity === 'Medium' ? '#00d4ff' : '#10b981';

                    const marker = L.circleMarker([fir.lat, fir.lng], {
                        radius: fir.severity === 'Critical' ? 12 : fir.severity === 'High' ? 10 : 8,
                        fillColor: color,
                        color: '#fff',
                        weight: 2,
                        fillOpacity: 0.7,
                    }).addTo(map);

                    marker.bindPopup(`
            <div style="font-family:Inter,sans-serif">
              <strong>FIR #${fir.firId} — ${fir.crimeType}</strong><br>
              ${fir.location}<br>
              ${fir.severity} severity<br>
              ${fir.date}
            </div>
          `);
                }
            });

            mapInstance.current = map;
        };

        initMap();

        return () => {
            if (mapInstance.current) {
                mapInstance.current.remove();
                mapInstance.current = null;
            }
        };
    }, [firs]);

    return (
        <div className="ai-section">
            <h3>Crime Hotspot Identification</h3>
            <p className="ai-desc">Geographic analysis of crime concentration areas with risk scoring based on frequency and severity.</p>

            <div className="hotspot-layout">
                <div className="hotspot-map" ref={mapRef} />

                <div className="hotspot-list">
                    <h4>Hotspot Rankings</h4>
                    {hotspots.map((h, idx) => (
                        <div key={idx} className={`hotspot-card intensity-${h.intensity?.toLowerCase()}`}>
                            <div className="hotspot-rank">#{idx + 1}</div>
                            <div className="hotspot-info">
                                <strong>{h.location}</strong>
                                <div className="hotspot-stats">
                                    <span>{h.count} crime(s)</span>
                                    <span>Risk: {h.riskScore}</span>
                                    <span>{h.dominantCrime}</span>
                                </div>
                            </div>
                            <div className={`intensity-badge ${h.intensity?.toLowerCase()}`}>
                                {h.intensity}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ---- CASE PRIORITY ----
function CasePriority({ firs, evidence, cases }) {
    const [priorities, setPriorities] = useState([]);

    useEffect(() => {
        async function loadPriorities() {
            try {
                const results = [];
                for (const fir of firs) {
                    const res = await fetch('/api/ai/priority', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ targetFirId: fir.firId }),
                    });
                    const priority = await res.json();
                    results.push({ fir, priority });
                }
                results.sort((a, b) => b.priority.totalScore - a.priority.totalScore);
                setPriorities(results);
            } catch (err) { console.error(err); }
        }
        if (firs.length > 0) loadPriorities();
    }, [firs, evidence, cases]);

    return (
        <div className="ai-section">
            <h3>Case Priority & Risk Scoring</h3>
            <p className="ai-desc">Multi-factor priority scoring combining severity, evidence strength, recency, public impact, and pattern matching. Each score is fully explainable.</p>

            <div className="priority-list">
                {priorities.map(({ fir, priority }, idx) => (
                    <div key={fir.firId} className={`priority-card priority-${priority.priority?.toLowerCase()}`}>
                        <div className="priority-header">
                            <div className="priority-rank-circle">#{idx + 1}</div>
                            <div className="priority-case-info">
                                <strong>FIR #{fir.firId} — {fir.crimeType}</strong>
                                <span>{fir.location}</span>
                            </div>
                            <div className="priority-score-ring">
                                <svg viewBox="0 0 36 36" className="score-ring">
                                    <path className="ring-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                    <path className="ring-fill" strokeDasharray={`${priority.totalScore * 10}, 100`}
                                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                    <text x="18" y="20.5" className="ring-text">{priority.totalScore}</text>
                                </svg>
                                <span className={`priority-label ${priority.priority?.toLowerCase()}`}>{priority.priority}</span>
                            </div>
                        </div>

                        <div className="priority-breakdown">
                            {priority.breakdown.map((b, i) => (
                                <div key={i} className="breakdown-item">
                                    <div className="breakdown-header">
                                        <span className="breakdown-name">{b.factor}</span>
                                        <span className="breakdown-weight">{b.weight}</span>
                                        <span className="breakdown-score">{b.score}/10</span>
                                    </div>
                                    <div className="breakdown-bar">
                                        <div className="breakdown-fill" style={{ width: `${b.score * 10}%` }} />
                                    </div>
                                    <span className="breakdown-explain">{b.explanation}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ---- CRIMINAL NETWORK ----
function NetworkAnalysis({ criminals }) {
    const canvasRef = useRef(null);
    const [network, setNetwork] = useState({ nodes: [], edges: [], keyPlayers: [] });

    useEffect(() => {
        async function loadNetwork() {
            try {
                const res = await fetch('/api/ai/network');
                const result = await res.json();
                setNetwork(result);
            } catch (err) { console.error(err); }
        }
        loadNetwork();
    }, [criminals]);

    useEffect(() => {
        if (!canvasRef.current || network.nodes.length === 0) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const w = canvas.width = canvas.parentElement.offsetWidth;
        const h = canvas.height = 400;

        // Position nodes in a circle
        const cx = w / 2, cy = h / 2, radius = Math.min(w, h) * 0.35;
        const positions = {};

        network.nodes.forEach((node, i) => {
            const angle = (2 * Math.PI * i) / network.nodes.length - Math.PI / 2;
            positions[node.id] = {
                x: cx + radius * Math.cos(angle),
                y: cy + radius * Math.sin(angle),
            };
        });

        function draw() {
            ctx.clearRect(0, 0, w, h);

            // Draw edges
            network.edges.forEach(edge => {
                const from = positions[edge.source];
                const to = positions[edge.target];
                if (!from || !to) return;

                ctx.beginPath();
                ctx.moveTo(from.x, from.y);
                ctx.lineTo(to.x, to.y);
                ctx.strokeStyle = edge.strength > 1 ? 'rgba(0, 212, 255, 0.6)' : 'rgba(148, 163, 184, 0.3)';
                ctx.lineWidth = edge.strength > 1 ? 3 : 1.5;
                ctx.stroke();

                // Edge label
                const mx = (from.x + to.x) / 2;
                const my = (from.y + to.y) / 2;
                ctx.font = '10px Inter';
                ctx.fillStyle = '#64748b';
                ctx.textAlign = 'center';
                ctx.fillText(edge.relationship.substring(0, 30), mx, my - 6);
            });

            // Draw nodes
            network.nodes.forEach(node => {
                const pos = positions[node.id];
                if (!pos) return;

                const r = 24 + node.connections * 4;
                const color = node.riskLevel === 'High' ? '#ef4444' :
                    node.riskLevel === 'Medium' ? '#f59e0b' : '#10b981';

                // Glow
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, r + 6, 0, Math.PI * 2);
                ctx.fillStyle = color.replace(')', ', 0.15)').replace('rgb', 'rgba');
                ctx.fill();

                // Node
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
                ctx.fillStyle = color.replace(')', ', 0.3)').replace('rgb', 'rgba');
                ctx.strokeStyle = color;
                ctx.lineWidth = 2;
                ctx.fill();
                ctx.stroke();

                // Label
                ctx.font = 'bold 11px Inter';
                ctx.fillStyle = '#e2e8f0';
                ctx.textAlign = 'center';
                ctx.fillText(node.name.split(' ')[0], pos.x, pos.y + 4);

                // Status
                ctx.font = '9px Inter';
                ctx.fillStyle = '#94a3b8';
                ctx.fillText(node.status, pos.x, pos.y + 18);
            });
        }

        draw();
    }, [network]);

    return (
        <div className="ai-section">
            <h3>Criminal Network Analysis</h3>
            <p className="ai-desc">Graph-based visualization of connections between criminals through shared cases, crime types, and known associations.</p>

            <div className="network-layout">
                <div className="network-canvas-container">
                    <canvas ref={canvasRef} />
                </div>

                <div className="network-details">
                    <div className="key-players">
                        <h4>Key Players (Most Connected)</h4>
                        {network.keyPlayers.map((kp, idx) => (
                            <div key={kp.id} className="key-player-card">
                                <span className="kp-rank">#{idx + 1}</span>
                                <div className="kp-info">
                                    <strong>{kp.name}</strong>
                                    <span>{kp.connections} connection(s) • {kp.riskLevel} risk</span>
                                    <div className="kp-crimes">
                                        {(kp.crimes || []).map(c => <span key={c} className="crime-tag">{c}</span>)}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="network-edges">
                        <h4>Connections</h4>
                        {network.edges.map((edge, idx) => {
                            const from = network.nodes.find(n => n.id === edge.source);
                            const to = network.nodes.find(n => n.id === edge.target);
                            return (
                                <div key={idx} className="edge-card">
                                    <span className="edge-names">{from?.name} ↔ {to?.name}</span>
                                    <span className="edge-rel">{edge.relationship}</span>
                                    {edge.sharedCases > 0 && <span className="edge-cases">{edge.sharedCases} shared case(s)</span>}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
