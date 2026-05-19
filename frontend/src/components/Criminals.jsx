import { useState, useEffect } from 'react';
import { getAllRecords, addRecord, updateRecord, deleteRecord, getCurrentRole } from '../db/database';

const RISK_LEVELS = ['Low', 'Medium', 'High'];
const CRIME_TYPES = ['Robbery', 'Burglary', 'Fraud', 'Assault', 'Cybercrime', 'Homicide', 'Theft', 'Drug Trafficking'];
const STATUSES = ['Active', 'Wanted', 'Under Surveillance', 'Arrested', 'Released'];

export default function Criminals() {
    const [criminals, setCriminals] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState(null);
    const [selected, setSelected] = useState(null);
    const [filter, setFilter] = useState({ risk: '', status: '', search: '' });
    const [loading, setLoading] = useState(true);
    const role = getCurrentRole();

    const emptyForm = {
        name: '', age: '', gender: 'Male', aliases: '', knownAddress: '',
        crimeHistory: [], priorConvictions: 0, riskLevel: 'Medium',
        status: 'Active', notes: '', relatedCases: [], associates: [],
    };
    const [form, setForm] = useState(emptyForm);

    useEffect(() => { loadData(); }, []);

    async function loadData() {
        try {
            const data = await getAllRecords('criminals');
            setCriminals(data);
        } catch (err) { console.error(err); }
        setLoading(false);
    }

    async function handleSubmit(e) {
        e.preventDefault();
        try {
            const data = {
                ...form,
                age: parseInt(form.age) || 0,
                priorConvictions: parseInt(form.priorConvictions) || 0,
                aliases: typeof form.aliases === 'string' ? form.aliases : form.aliases,
            };
            if (editing) {
                await updateRecord('criminals', { ...data, criminalId: editing.criminalId });
            } else {
                await addRecord('criminals', data);
            }
            setShowForm(false);
            setEditing(null);
            setForm(emptyForm);
            await loadData();
        } catch (err) { alert(err.message); }
    }

    async function handleDelete(id) {
        if (!confirm('Delete this criminal record?')) return;
        try {
            await deleteRecord('criminals', id);
            await loadData();
            if (selected?.criminalId === id) setSelected(null);
        } catch (err) { alert(err.message); }
    }

    function handleEdit(criminal) {
        setForm({
            ...criminal,
            age: criminal.age?.toString() || '',
            priorConvictions: criminal.priorConvictions?.toString() || '0',
        });
        setEditing(criminal);
        setShowForm(true);
    }

    function toggleCrimeType(type) {
        const list = form.crimeHistory || [];
        setForm({
            ...form,
            crimeHistory: list.includes(type) ? list.filter(t => t !== type) : [...list, type],
        });
    }

    const filtered = criminals.filter(c => {
        if (filter.risk && c.riskLevel !== filter.risk) return false;
        if (filter.status && c.status !== filter.status) return false;
        if (filter.search) {
            const s = filter.search.toLowerCase();
            return c.name?.toLowerCase().includes(s) || c.aliases?.toLowerCase().includes(s);
        }
        return true;
    });

    if (loading) return <div className="loading-screen"><div className="spinner" /><p>Loading Criminal Records...</p></div>;

    return (
        <div className="module-page">
            <div className="page-header">
                <div>
                    <h2>Criminal Records</h2>
                    <p className="page-subtitle">Manage criminal profiles, history, and risk assessments</p>
                </div>
                {(role === 'Admin' || role === 'Investigator') && (
                    <button className="btn btn-primary" onClick={() => { setShowForm(true); setEditing(null); setForm(emptyForm); }}>
                        + Add Criminal Record
                    </button>
                )}
            </div>

            <div className="filters-bar">
                <input type="text" placeholder="Search by name or alias..." className="search-input"
                    value={filter.search} onChange={e => setFilter({ ...filter, search: e.target.value })} />
                <select value={filter.risk} onChange={e => setFilter({ ...filter, risk: e.target.value })} className="filter-select">
                    <option value="">All Risk Levels</option>
                    {RISK_LEVELS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <select value={filter.status} onChange={e => setFilter({ ...filter, status: e.target.value })} className="filter-select">
                    <option value="">All Statuses</option>
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
            </div>

            <div className="criminals-grid">
                {filtered.length === 0 ? (
                    <div className="empty-state full-width">
                        <span className="empty-icon">—</span>
                        <p>No criminal records found</p>
                    </div>
                ) : (
                    filtered.map(c => (
                        <div key={c.criminalId} className={`criminal-card ${selected?.criminalId === c.criminalId ? 'selected' : ''}`}
                            onClick={() => setSelected(c)}>
                            <div className="criminal-card-top">
                                <div className="criminal-avatar">
                                    <span>{c.name?.charAt(0)?.toUpperCase()}</span>
                                </div>
                                <div className={`risk-indicator ${c.riskLevel?.toLowerCase()}`}>
                                    {c.riskLevel} Risk
                                </div>
                            </div>
                            <h4>{c.name}</h4>
                            <p className="criminal-aliases">{c.aliases ? `aka "${c.aliases}"` : ''}</p>
                            <div className="criminal-meta">
                                <span>{c.age} yrs • {c.gender}</span>
                                <span className={`status-badge ${c.status?.replace(/\s/g, '-').toLowerCase()}`}>{c.status}</span>
                            </div>
                            <div className="criminal-crimes">
                                {(c.crimeHistory || []).map(ct => (
                                    <span key={ct} className="crime-tag">{ct}</span>
                                ))}
                            </div>
                            <div className="criminal-stats">
                                <span>{c.priorConvictions} conviction(s)</span>
                                <span>{(c.relatedCases || []).length} case(s)</span>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Detail Modal */}
            {selected && (
                <div className="modal-overlay" onClick={() => setSelected(null)}>
                    <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Criminal Profile: {selected.name}</h3>
                            <button className="modal-close" onClick={() => setSelected(null)}>×</button>
                        </div>
                        <div className="criminal-detail">
                            <div className="detail-grid">
                                <div className="detail-item"><label>Full Name</label><span>{selected.name}</span></div>
                                <div className="detail-item"><label>Age</label><span>{selected.age}</span></div>
                                <div className="detail-item"><label>Gender</label><span>{selected.gender}</span></div>
                                <div className="detail-item"><label>Aliases</label><span>{selected.aliases || 'None'}</span></div>
                                <div className="detail-item"><label>Known Address</label><span>{selected.knownAddress || 'Unknown'}</span></div>
                                <div className="detail-item"><label>Status</label><span className={`status-badge ${selected.status?.replace(/\s/g, '-').toLowerCase()}`}>{selected.status}</span></div>
                                <div className="detail-item"><label>Risk Level</label><span className={`severity-badge ${selected.riskLevel?.toLowerCase()}`}>{selected.riskLevel}</span></div>
                                <div className="detail-item"><label>Prior Convictions</label><span>{selected.priorConvictions}</span></div>
                            </div>
                            <div className="detail-section">
                                <label>Crime History</label>
                                <div className="crime-tags">
                                    {(selected.crimeHistory || []).map(ct => <span key={ct} className="crime-tag">{ct}</span>)}
                                </div>
                            </div>
                            <div className="detail-section">
                                <label>Notes</label>
                                <p>{selected.notes || 'No additional notes.'}</p>
                            </div>
                            <div className="detail-actions">
                                {(role === 'Admin' || role === 'Investigator') && (
                                    <>
                                        <button className="btn btn-secondary" onClick={() => { handleEdit(selected); setSelected(null); }}>✏️ Edit</button>
                                        {role === 'Admin' && (
                                            <button className="btn btn-danger" onClick={() => { handleDelete(selected.criminalId); }}>🗑️ Delete</button>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Add/Edit Form */}
            {showForm && (
                <div className="modal-overlay" onClick={() => setShowForm(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>{editing ? 'Edit Criminal Record' : 'Add Criminal Record'}</h3>
                            <button className="modal-close" onClick={() => setShowForm(false)}>×</button>
                        </div>
                        <form onSubmit={handleSubmit} className="form-grid">
                            <div className="form-group"><label>Name *</label>
                                <input type="text" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                            </div>
                            <div className="form-group"><label>Age</label>
                                <input type="number" value={form.age} onChange={e => setForm({ ...form, age: e.target.value })} />
                            </div>
                            <div className="form-group"><label>Gender</label>
                                <select value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })}>
                                    <option>Male</option><option>Female</option><option>Other</option>
                                </select>
                            </div>
                            <div className="form-group"><label>Aliases</label>
                                <input type="text" placeholder="e.g. Suri, Blade" value={form.aliases} onChange={e => setForm({ ...form, aliases: e.target.value })} />
                            </div>
                            <div className="form-group full-width"><label>Known Address</label>
                                <input type="text" value={form.knownAddress} onChange={e => setForm({ ...form, knownAddress: e.target.value })} />
                            </div>
                            <div className="form-group"><label>Risk Level</label>
                                <select value={form.riskLevel} onChange={e => setForm({ ...form, riskLevel: e.target.value })}>
                                    {RISK_LEVELS.map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                            </div>
                            <div className="form-group"><label>Status</label>
                                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            <div className="form-group"><label>Prior Convictions</label>
                                <input type="number" min="0" value={form.priorConvictions} onChange={e => setForm({ ...form, priorConvictions: e.target.value })} />
                            </div>
                            <div className="form-group full-width">
                                <label>Crime Types</label>
                                <div className="checkbox-group">
                                    {CRIME_TYPES.map(t => (
                                        <label key={t} className="checkbox-label">
                                            <input type="checkbox" checked={(form.crimeHistory || []).includes(t)} onChange={() => toggleCrimeType(t)} />
                                            {t}
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div className="form-group full-width"><label>Notes</label>
                                <textarea rows={3} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
                            </div>
                            <div className="form-actions full-width">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">{editing ? 'Update' : 'Add Record'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
