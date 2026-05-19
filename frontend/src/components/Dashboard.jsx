import { useState, useEffect } from 'react';
import { getAllRecords } from '../db/database';
import {
    Chart as ChartJS,
    CategoryScale, LinearScale, BarElement, LineElement,
    PointElement, ArcElement, Title, Tooltip, Legend, Filler,
    RadialLinearScale
} from 'chart.js';
import { Bar, Line, Doughnut, PolarArea, Radar } from 'react-chartjs-2';

ChartJS.register(
    CategoryScale, LinearScale, BarElement, LineElement,
    PointElement, ArcElement, Title, Tooltip, Legend, Filler,
    RadialLinearScale
);

export default function Dashboard() {
    const [stats, setStats] = useState({ firs: [], cases: [], criminals: [], evidence: [] });
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadData(); }, []);

    async function loadData() {
        try {
            const [firs, cases, criminals, evidence] = await Promise.all([
                getAllRecords('firs'),
                getAllRecords('cases'),
                getAllRecords('criminals'),
                getAllRecords('evidence'),
            ]);
            setStats({ firs, cases, criminals, evidence });
        } catch (err) { console.error('Dashboard load error:', err); }
        setLoading(false);
    }

    if (loading) return <div className="loading-screen"><div className="spinner" /><p>Loading Dashboard...</p></div>;

    const openCases = stats.cases.filter(c => c.status === 'Active').length;
    const resolvedCases = stats.cases.filter(c => c.status === 'Closed').length;
    const criticalFirs = stats.firs.filter(f => f.severity === 'Critical').length;
    const highFirs = stats.firs.filter(f => f.severity === 'High').length;
    const highRisk = stats.criminals.filter(c => c.riskLevel === 'High').length;
    const pendingEvidence = stats.evidence.filter(e => e.status === 'Under Analysis' || e.status === 'In Lab').length;

    // --- CHART THEME ---
    const gridColor = 'rgba(100,116,139,0.1)';
    const tickColor = '#475569';
    const labelColor = '#64748b';
    const fontFamily = 'Inter';

    // 1. Crime Type — Horizontal Bar (serious muted palette)
    const crimeTypeCounts = {};
    stats.firs.forEach(f => crimeTypeCounts[f.crimeType] = (crimeTypeCounts[f.crimeType] || 0) + 1);
    const sortedCrimeTypes = Object.entries(crimeTypeCounts).sort((a, b) => b[1] - a[1]);

    const crimeTypeData = {
        labels: sortedCrimeTypes.map(e => e[0]),
        datasets: [{
            label: 'Reported Incidents',
            data: sortedCrimeTypes.map(e => e[1]),
            backgroundColor: [
                'rgba(220, 38, 38, 0.75)',
                'rgba(217, 119, 6, 0.75)',
                'rgba(37, 99, 235, 0.75)',
                'rgba(101, 163, 13, 0.75)',
                'rgba(124, 58, 237, 0.75)',
                'rgba(14, 116, 144, 0.75)',
            ],
            borderColor: [
                '#dc2626', '#d97706', '#2563eb', '#65a30d', '#7c3aed', '#0e7490',
            ],
            borderWidth: 1,
            borderRadius: 4,
            barThickness: 22,
        }],
    };

    const barOptions = {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: '#1e293b',
                titleFont: { family: fontFamily, weight: '600' },
                bodyFont: { family: fontFamily },
                borderColor: '#334155',
                borderWidth: 1,
                padding: 10,
                cornerRadius: 6,
            },
        },
        scales: {
            x: { ticks: { color: tickColor, font: { family: fontFamily, size: 11 } }, grid: { color: gridColor }, border: { color: 'rgba(100,116,139,0.15)' } },
            y: { ticks: { color: '#cbd5e1', font: { family: fontFamily, size: 12, weight: '500' } }, grid: { display: false }, border: { display: false } },
        },
    };

    // 2. Status Distribution — Doughnut
    const statusCounts = {};
    stats.firs.forEach(f => statusCounts[f.status] = (statusCounts[f.status] || 0) + 1);
    const statusData = {
        labels: Object.keys(statusCounts),
        datasets: [{
            data: Object.values(statusCounts),
            backgroundColor: ['#2563eb', '#d97706', '#16a34a', '#dc2626'],
            borderColor: '#0f172a',
            borderWidth: 3,
            hoverOffset: 6,
        }],
    };
    const doughnutOptions = {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
            legend: { position: 'bottom', labels: { color: labelColor, font: { family: fontFamily, size: 11 }, padding: 14, usePointStyle: true, pointStyleWidth: 8 } },
            tooltip: { backgroundColor: '#1e293b', titleFont: { family: fontFamily, weight: '600' }, bodyFont: { family: fontFamily }, borderColor: '#334155', borderWidth: 1, padding: 10, cornerRadius: 6 },
        },
    };

    // 3. Severity Distribution — Polar Area
    const severityCounts = { Critical: 0, High: 0, Medium: 0, Low: 0 };
    stats.firs.forEach(f => { if (severityCounts[f.severity] !== undefined) severityCounts[f.severity]++; });
    const polarData = {
        labels: Object.keys(severityCounts),
        datasets: [{
            data: Object.values(severityCounts),
            backgroundColor: ['rgba(220,38,38,0.6)', 'rgba(217,119,6,0.6)', 'rgba(37,99,235,0.5)', 'rgba(22,163,74,0.5)'],
            borderColor: ['#dc2626', '#d97706', '#2563eb', '#16a34a'],
            borderWidth: 1,
        }],
    };
    const polarOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'bottom', labels: { color: labelColor, font: { family: fontFamily, size: 11 }, padding: 14, usePointStyle: true } },
            tooltip: { backgroundColor: '#1e293b', bodyFont: { family: fontFamily }, borderColor: '#334155', borderWidth: 1, padding: 10, cornerRadius: 6 },
        },
        scales: {
            r: { grid: { color: gridColor }, ticks: { display: false }, pointLabels: { color: tickColor } },
        },
    };

    // 4. Monthly Trend — Area Line
    const monthlyData = {};
    stats.firs.forEach(f => {
        const month = f.date?.substring(0, 7);
        if (month) monthlyData[month] = (monthlyData[month] || 0) + 1;
    });
    const sortedMonths = Object.keys(monthlyData).sort();
    const trendData = {
        labels: sortedMonths.map(m => {
            const [y, mo] = m.split('-');
            return new Date(y, parseInt(mo) - 1).toLocaleString('default', { month: 'short', year: '2-digit' });
        }),
        datasets: [{
            label: 'FIRs Filed',
            data: sortedMonths.map(m => monthlyData[m]),
            borderColor: '#2563eb',
            backgroundColor: 'rgba(37, 99, 235, 0.08)',
            fill: true,
            tension: 0.3,
            pointBackgroundColor: '#2563eb',
            pointBorderColor: '#0f172a',
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6,
            borderWidth: 2,
        }],
    };
    const lineOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: { backgroundColor: '#1e293b', titleFont: { family: fontFamily, weight: '600' }, bodyFont: { family: fontFamily }, borderColor: '#334155', borderWidth: 1, padding: 10, cornerRadius: 6 },
        },
        scales: {
            x: { ticks: { color: tickColor, font: { family: fontFamily, size: 11 } }, grid: { color: gridColor }, border: { color: 'rgba(100,116,139,0.15)' } },
            y: { ticks: { color: tickColor, font: { family: fontFamily, size: 11 } }, grid: { color: gridColor }, border: { display: false }, beginAtZero: true },
        },
    };

    // 5. Crime Radar — Method Analysis
    const methodCounts = {};
    stats.firs.forEach(f => { if (f.method) methodCounts[f.method] = (methodCounts[f.method] || 0) + 1; });
    const radarData = {
        labels: Object.keys(methodCounts),
        datasets: [{
            label: 'By Method',
            data: Object.values(methodCounts),
            backgroundColor: 'rgba(37,99,235,0.15)',
            borderColor: '#2563eb',
            borderWidth: 2,
            pointBackgroundColor: '#2563eb',
            pointRadius: 3,
        }],
    };
    const radarOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: { backgroundColor: '#1e293b', bodyFont: { family: fontFamily }, borderColor: '#334155', borderWidth: 1, padding: 10, cornerRadius: 6 },
        },
        scales: {
            r: {
                grid: { color: gridColor },
                angleLines: { color: gridColor },
                ticks: { display: false, stepSize: 1 },
                pointLabels: { color: '#94a3b8', font: { family: fontFamily, size: 11 } },
            },
        },
    };

    // 6. Resolution Rate calculation
    const totalCases = stats.cases.length;
    const resolutionRate = totalCases > 0 ? Math.round((resolvedCases / totalCases) * 100) : 0;

    // Recent activity — sorted by date
    const recentFirs = [...stats.firs].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 6);

    return (
        <div className="dashboard">
            <div className="page-header">
                <div>
                    <h2>Operations Dashboard</h2>
                    <p className="page-subtitle">Kerala Police — Crime Investigation Command Center</p>
                </div>
                <div className="header-actions">
                    <div className="ai-badge"><span className="ai-pulse" />System Active</div>
                </div>
            </div>

            {/* Stats Row */}
            <div className="stats-grid">
                <div className="stat-card stat-blue">
                    <div className="stat-code">FIR</div>
                    <div className="stat-content">
                        <span className="stat-value">{stats.firs.length}</span>
                        <span className="stat-label">Total FIRs</span>
                    </div>
                    <div className="stat-trend">+{stats.firs.filter(f => {
                        const d = new Date(f.date); const now = new Date();
                        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                    }).length} this month</div>
                </div>
                <div className="stat-card stat-amber">
                    <div className="stat-code">CSE</div>
                    <div className="stat-content">
                        <span className="stat-value">{openCases}</span>
                        <span className="stat-label">Active Cases</span>
                    </div>
                    <div className="stat-trend">{resolvedCases} closed</div>
                </div>
                <div className="stat-card stat-red">
                    <div className="stat-code">ALT</div>
                    <div className="stat-content">
                        <span className="stat-value">{criticalFirs + highFirs}</span>
                        <span className="stat-label">Critical / High</span>
                    </div>
                    <div className="stat-trend alert">{criticalFirs} critical</div>
                </div>
                <div className="stat-card stat-emerald">
                    <div className="stat-code">RSK</div>
                    <div className="stat-content">
                        <span className="stat-value">{highRisk}</span>
                        <span className="stat-label">High-Risk Suspects</span>
                    </div>
                    <div className="stat-trend">{stats.criminals.length} profiled</div>
                </div>
            </div>

            {/* Secondary stats */}
            <div className="stats-grid stats-secondary">
                <div className="stat-mini">
                    <span className="stat-mini-label">Evidence Pending</span>
                    <span className="stat-mini-value">{pendingEvidence}</span>
                </div>
                <div className="stat-mini">
                    <span className="stat-mini-label">Resolution Rate</span>
                    <span className="stat-mini-value">{resolutionRate}%</span>
                </div>
                <div className="stat-mini">
                    <span className="stat-mini-label">Total Evidence</span>
                    <span className="stat-mini-value">{stats.evidence.length}</span>
                </div>
                <div className="stat-mini">
                    <span className="stat-mini-label">Officers Assigned</span>
                    <span className="stat-mini-value">{new Set(stats.cases.map(c => c.assignedOfficer)).size}</span>
                </div>
            </div>

            {/* Charts — Row 1 */}
            <div className="charts-grid charts-2-1">
                <div className="chart-card">
                    <h3>Incidents by Crime Type</h3>
                    <div className="chart-container">
                        <Bar data={crimeTypeData} options={barOptions} />
                    </div>
                </div>
                <div className="chart-card">
                    <h3>Case Status</h3>
                    <div className="chart-container">
                        <Doughnut data={statusData} options={doughnutOptions} />
                    </div>
                </div>
            </div>

            {/* Charts — Row 2: Trend + Severity */}
            <div className="charts-grid charts-2-1">
                <div className="chart-card">
                    <h3>Monthly FIR Trend</h3>
                    <div className="chart-container">
                        <Line data={trendData} options={lineOptions} />
                    </div>
                </div>
                <div className="chart-card">
                    <h3>Severity Breakdown</h3>
                    <div className="chart-container">
                        <PolarArea data={polarData} options={polarOptions} />
                    </div>
                </div>
            </div>

            {/* Row 3: Radar + Recent Activity */}
            <div className="charts-grid charts-1-2">
                <div className="chart-card">
                    <h3>Crime Method Analysis</h3>
                    <div className="chart-container">
                        <Radar data={radarData} options={radarOptions} />
                    </div>
                </div>
                <div className="chart-card">
                    <h3>Recent Incident Log</h3>
                    <div className="recent-list">
                        {recentFirs.map((fir, i) => (
                            <div key={fir.firId} className="recent-item">
                                <div className="recent-index">{String(i + 1).padStart(2, '0')}</div>
                                <div className={`severity-dot ${fir.severity?.toLowerCase()}`} />
                                <div className="recent-info">
                                    <span className="recent-type">{fir.crimeType}</span>
                                    <span className="recent-location">{fir.location}</span>
                                </div>
                                <div className="recent-meta">
                                    <span className={`severity-badge ${fir.severity?.toLowerCase()}`}>{fir.severity}</span>
                                    <span className="recent-date">{fir.date}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
