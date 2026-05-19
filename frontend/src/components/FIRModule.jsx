import { useState, useEffect } from 'react';
import { getAllRecords, addRecord, updateRecord, deleteRecord, getCurrentRole } from '../db/database';

const CRIME_TYPES = ['Robbery', 'Burglary', 'Fraud', 'Assault', 'Cybercrime', 'Homicide', 'Theft', 'Drug Trafficking'];
const SEVERITIES = ['Low', 'Medium', 'High', 'Critical'];
const METHODS = ['Armed', 'Break-in', 'Phishing', 'Physical', 'Ransomware', 'Snatching', 'Investment Scam', 'Hacking', 'Other'];
const STATUSES = ['Open', 'Under Investigation', 'Resolved', 'Closed'];

export default function FIRModule() {
    const [firs, setFirs] = useState([]);
    const [officers, setOfficers] = useState([]);
    const [cases, setCases] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [editingFir, setEditingFir] = useState(null);
    const [selectedFir, setSelectedFir] = useState(null);
    const [filter, setFilter] = useState({ status: '', crimeType: '', search: '' });
    const [loading, setLoading] = useState(true);
    const role = getCurrentRole();

    const emptyForm = {
        date: new Date().toISOString().split('T')[0],
        time: '',
        location: '',
        crimeType: '',
        method: '',
        severity: 'Medium',
        description: '',
        complainant: '',
        status: 'Open',
        officerId: '',
        lat: '',
        lng: '',
    };

    const [form, setForm] = useState(emptyForm);

    useEffect(() => { loadData(); }, []);

    async function loadData() {
        try {
            const [f, o, c] = await Promise.all([
                getAllRecords('firs'),
                getAllRecords('officers'),
                getAllRecords('cases'),
            ]);
            setFirs(f);
            setOfficers(o);
            setCases(c);
        } catch (err) {
            console.error(err);
        }
        setLoading(false);
    }

    async function handleSubmit(e) {
        e.preventDefault();
        try {
            const data = {
                ...form,
                officerId: parseInt(form.officerId) || 1,
                lat: parseFloat(form.lat) || 0,
                lng: parseFloat(form.lng) || 0,
            };

            if (editingFir) {
                await updateRecord('firs', { ...data, firId: editingFir.firId });
            } else {
                const firId = await addRecord('firs', data);
                // Auto-create a case for this FIR
                await addRecord('cases', {
                    firId,
                    status: 'Active',
                    priority: data.severity === 'Critical' ? 'Critical' : data.severity === 'High' ? 'High' : 'Medium',
                    assignedOfficer: officers.find(o => o.officerId === data.officerId)?.name || 'Unassigned',
                    createdDate: new Date().toISOString().split('T')[0],
                    notes: '',
                });
            }
            setShowForm(false);
            setEditingFir(null);
            setForm(emptyForm);
            await loadData();
        } catch (err) {
            alert(err.message);
        }
    }

    async function handleDelete(firId) {
        if (!confirm('Are you sure you want to delete this FIR?')) return;
        try {
            await deleteRecord('firs', firId);
            await loadData();
            if (selectedFir?.firId === firId) setSelectedFir(null);
        } catch (err) {
            alert(err.message);
        }
    }

    function handleEdit(fir) {
        setForm({ ...fir, officerId: fir.officerId?.toString() || '' });
        setEditingFir(fir);
        setShowForm(true);
    }

    const filtered = firs.filter(f => {
        if (filter.status && f.status !== filter.status) return false;
        if (filter.crimeType && f.crimeType !== filter.crimeType) return false;
        if (filter.search) {
            const s = filter.search.toLowerCase();
            return f.description?.toLowerCase().includes(s) ||
                f.location?.toLowerCase().includes(s) ||
                f.complainant?.toLowerCase().includes(s);
        }
        return true;
    });

    if (loading) return <div className="loading-screen"><div className="spinner" /><p>Loading FIR Records...</p></div>;

    return (
        <div className="module-page">
            <div className="page-header">
                <div>
                    <h2>FIR Management</h2>
                    <p className="page-subtitle">Register, track, and manage First Information Reports</p>
                </div>
                {(role === 'Admin' || role === 'Investigator') && (
                    <button className="btn btn-primary" onClick={() => { setShowForm(true); setEditingFir(null); setForm(emptyForm); }}>
                        + Register New FIR
                    </button>
                )}
            </div>

            {/* Filters */}
            <div className="filters-bar">
                <input
                    type="text"
                    placeholder="Search FIRs..."
                    className="search-input"
                    value={filter.search}
                    onChange={e => setFilter({ ...filter, search: e.target.value })}
                />
                <select value={filter.status} onChange={e => setFilter({ ...filter, status: e.target.value })} className="filter-select">
                    <option value="">All Statuses</option>
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select value={filter.crimeType} onChange={e => setFilter({ ...filter, crimeType: e.target.value })} className="filter-select">
                    <option value="">All Crime Types</option>
                    {CRIME_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
            </div>

            <div className="fir-layout">
                {/* FIR List */}
                <div className="fir-list">
                    {filtered.length === 0 ? (
                        <div className="empty-state">
                            <span className="empty-icon">📋</span>
                            <p>No FIRs found</p>
                        </div>
                    ) : (
                        filtered.map(fir => (
                            <div
                                key={fir.firId}
                                className={`fir-card ${selectedFir?.firId === fir.firId ? 'selected' : ''}`}
                                onClick={() => setSelectedFir(fir)}
                            >
                                <div className="fir-card-header">
                                    <span className="fir-id">FIR #{fir.firId}</span>
                                    <span className={`severity-badge ${fir.severity?.toLowerCase()}`}>{fir.severity}</span>
                                </div>
                                <h4 className="fir-crime-type">{fir.crimeType}</h4>
                                <p className="fir-location">{fir.location}</p>
                                <div className="fir-card-footer">
                                    <span className={`status-badge ${fir.status?.replace(/\s/g, '-').toLowerCase()}`}>{fir.status}</span>
                                    <span className="fir-date">{fir.date}</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Detail Panel */}
                <div className="detail-panel">
                    {selectedFir ? (
                        <div className="fir-detail">
                            <div className="detail-header">
                                <h3>FIR #{selectedFir.firId} — {selectedFir.crimeType}</h3>
                                <div className="detail-actions">
                                    {(role === 'Admin' || role === 'Investigator') && (
                                        <>
                                            <button className="btn btn-sm btn-secondary" onClick={() => handleEdit(selectedFir)}>✏️ Edit</button>
                                            {role === 'Admin' && (
                                                <button className="btn btn-sm btn-danger" onClick={() => handleDelete(selectedFir.firId)}>🗑️ Delete</button>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="detail-grid">
                                <div className="detail-item">
                                    <label>Date & Time</label>
                                    <span>{selectedFir.date} at {selectedFir.time || 'N/A'}</span>
                                </div>
                                <div className="detail-item">
                                    <label>Location</label>
                                    <span>{selectedFir.location}</span>
                                </div>
                                <div className="detail-item">
                                    <label>Severity</label>
                                    <span className={`severity-badge ${selectedFir.severity?.toLowerCase()}`}>{selectedFir.severity}</span>
                                </div>
                                <div className="detail-item">
                                    <label>Method</label>
                                    <span>{selectedFir.method || 'N/A'}</span>
                                </div>
                                <div className="detail-item">
                                    <label>Complainant</label>
                                    <span>{selectedFir.complainant}</span>
                                </div>
                                <div className="detail-item">
                                    <label>Status</label>
                                    <span className={`status-badge ${selectedFir.status?.replace(/\s/g, '-').toLowerCase()}`}>{selectedFir.status}</span>
                                </div>
                                <div className="detail-item">
                                    <label>Assigned Officer</label>
                                    <span>{officers.find(o => o.officerId === selectedFir.officerId)?.name || 'N/A'}</span>
                                </div>
                            </div>

                            <div className="detail-description">
                                <label>Description</label>
                                <p>{selectedFir.description}</p>
                            </div>

                            {/* Case Info */}
                            {(() => {
                                const relatedCase = cases.find(c => c.firId === selectedFir.firId);
                                if (!relatedCase) return null;
                                return (
                                    <div className="case-info-panel">
                                        <h4>Case #{relatedCase.caseId}</h4>
                                        <div className="detail-grid">
                                            <div className="detail-item">
                                                <label>Case Status</label>
                                                <span className={`status-badge ${relatedCase.status?.toLowerCase()}`}>{relatedCase.status}</span>
                                            </div>
                                            <div className="detail-item">
                                                <label>Priority</label>
                                                <span className={`severity-badge ${relatedCase.priority?.toLowerCase()}`}>{relatedCase.priority}</span>
                                            </div>
                                            <div className="detail-item">
                                                <label>Assigned To</label>
                                                <span>{relatedCase.assignedOfficer}</span>
                                            </div>
                                            <div className="detail-item">
                                                <label>Notes</label>
                                                <span>{relatedCase.notes || 'No notes'}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    ) : (
                        <div className="empty-state">
                            <span className="empty-icon">—</span>
                            <p>Select a FIR to view details</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Registration Form Modal */}
            {showForm && (
                <div className="modal-overlay" onClick={() => setShowForm(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>{editingFir ? 'Edit FIR' : 'Register New FIR'}</h3>
                            <button className="modal-close" onClick={() => setShowForm(false)}>×</button>
                        </div>
                        <form onSubmit={handleSubmit} className="form-grid">
                            <div className="form-group">
                                <label>Date *</label>
                                <input type="date" required value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label>Time</label>
                                <input type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label>Location *</label>
                                <input type="text" required placeholder="e.g. Andheri West, Mumbai" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label>Crime Type *</label>
                                <select required value={form.crimeType} onChange={e => setForm({ ...form, crimeType: e.target.value })}>
                                    <option value="">Select type</option>
                                    {CRIME_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Method</label>
                                <select value={form.method} onChange={e => setForm({ ...form, method: e.target.value })}>
                                    <option value="">Select method</option>
                                    {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Severity *</label>
                                <select required value={form.severity} onChange={e => setForm({ ...form, severity: e.target.value })}>
                                    {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            <div className="form-group full-width">
                                <label>Description *</label>
                                <textarea required rows={3} placeholder="Describe the incident..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label>Complainant *</label>
                                <input type="text" required placeholder="Name of complainant" value={form.complainant} onChange={e => setForm({ ...form, complainant: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label>Assign Officer</label>
                                <select value={form.officerId} onChange={e => setForm({ ...form, officerId: e.target.value })}>
                                    <option value="">Select officer</option>
                                    {officers.map(o => <option key={o.officerId} value={o.officerId}>{o.name} ({o.rank})</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Latitude</label>
                                <input type="number" step="any" placeholder="e.g. 19.0760" value={form.lat} onChange={e => setForm({ ...form, lat: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label>Longitude</label>
                                <input type="number" step="any" placeholder="e.g. 72.8777" value={form.lng} onChange={e => setForm({ ...form, lng: e.target.value })} />
                            </div>
                            {editingFir && (
                                <div className="form-group">
                                    <label>Status</label>
                                    <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                                        {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                            )}
                            <div className="form-actions full-width">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">{editingFir ? 'Update FIR' : 'Register FIR'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
