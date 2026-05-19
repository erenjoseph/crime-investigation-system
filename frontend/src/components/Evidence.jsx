import { useState, useEffect } from 'react';
import { getAllRecords, addRecord, updateRecord, deleteRecord, getAuditLogs, getCurrentRole } from '../db/database';

const EVIDENCE_TYPES = ['Physical', 'Digital', 'Documentary', 'Testimonial', 'Forensic'];
const EVIDENCE_STATUSES = ['Collected', 'In Lab', 'Under Analysis', 'Analyzed', 'Submitted to Court', 'Archived'];

export default function Evidence() {
    const [evidence, setEvidence] = useState([]);
    const [cases, setCases] = useState([]);
    const [auditLogs, setAuditLogs] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [showAudit, setShowAudit] = useState(false);
    const [editing, setEditing] = useState(null);
    const [filter, setFilter] = useState({ caseId: '', type: '' });
    const [loading, setLoading] = useState(true);
    const role = getCurrentRole();

    const emptyForm = {
        caseId: '', type: '', description: '', collectedBy: '',
        collectedDate: new Date().toISOString().split('T')[0],
        location: '', status: 'Collected', chainOfCustody: [''],
    };
    const [form, setForm] = useState(emptyForm);

    useEffect(() => { loadData(); }, []);

    async function loadData() {
        try {
            const [e, c, logs] = await Promise.all([
                getAllRecords('evidence'),
                getAllRecords('cases'),
                getAuditLogs(),
            ]);
            setEvidence(e);
            setCases(c);
            setAuditLogs(logs);
        } catch (err) { console.error(err); }
        setLoading(false);
    }

    async function handleSubmit(e) {
        e.preventDefault();
        try {
            const data = {
                ...form,
                caseId: parseInt(form.caseId) || 0,
                chainOfCustody: form.chainOfCustody.filter(c => c.trim()),
            };
            if (editing) {
                await updateRecord('evidence', { ...data, evidenceId: editing.evidenceId });
            } else {
                await addRecord('evidence', data);
            }
            setShowForm(false);
            setEditing(null);
            setForm(emptyForm);
            await loadData();
        } catch (err) { alert(err.message); }
    }

    async function handleDelete(id) {
        if (!confirm('Delete this evidence record?')) return;
        try {
            await deleteRecord('evidence', id);
            await loadData();
        } catch (err) { alert(err.message); }
    }

    function addCustodyStep() {
        setForm({ ...form, chainOfCustody: [...form.chainOfCustody, ''] });
    }

    function updateCustodyStep(index, value) {
        const chain = [...form.chainOfCustody];
        chain[index] = value;
        setForm({ ...form, chainOfCustody: chain });
    }

    const filtered = evidence.filter(e => {
        if (filter.caseId && e.caseId !== parseInt(filter.caseId)) return false;
        if (filter.type && e.type !== filter.type) return false;
        return true;
    });

    // Group evidence by case
    const grouped = {};
    filtered.forEach(e => {
        const key = e.caseId || 'unassigned';
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(e);
    });

    const evidenceLogs = auditLogs.filter(l => l.entity === 'evidence').sort((a, b) =>
        new Date(b.timestamp) - new Date(a.timestamp)
    );

    if (loading) return <div className="loading-screen"><div className="spinner" /><p>Loading Evidence Records...</p></div>;

    return (
        <div className="module-page">
            <div className="page-header">
                <div>
                    <h2>Evidence Tracking</h2>
                    <p className="page-subtitle">Track evidence with chain of custody and full audit trail</p>
                </div>
                <div className="header-actions">
                    <button className="btn btn-outline" onClick={() => { setShowAudit(true); }}>
                        View Audit Logs
                    </button>
                    {(role === 'Admin' || role === 'Investigator') && (
                        <button className="btn btn-primary" onClick={() => { setShowForm(true); setEditing(null); setForm(emptyForm); }}>
                            + Add Evidence
                        </button>
                    )}
                </div>
            </div>

            <div className="filters-bar">
                <select value={filter.caseId} onChange={e => setFilter({ ...filter, caseId: e.target.value })} className="filter-select">
                    <option value="">All Cases</option>
                    {cases.map(c => <option key={c.caseId} value={c.caseId}>Case #{c.caseId}</option>)}
                </select>
                <select value={filter.type} onChange={e => setFilter({ ...filter, type: e.target.value })} className="filter-select">
                    <option value="">All Types</option>
                    {EVIDENCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
            </div>

            {/* Evidence Cards */}
            <div className="evidence-groups">
                {Object.keys(grouped).length === 0 ? (
                    <div className="empty-state">
                        <span className="empty-icon">—</span>
                        <p>No evidence records found</p>
                    </div>
                ) : (
                    Object.entries(grouped).map(([caseId, items]) => (
                        <div key={caseId} className="evidence-group">
                            <h3 className="group-header">Case #{caseId}</h3>
                            <div className="evidence-cards">
                                {items.map(item => (
                                    <div key={item.evidenceId} className="evidence-card">
                                        <div className="evidence-card-header">
                                            <span className="evidence-type-badge">{item.type}</span>
                                            <span className={`status-badge ${item.status?.replace(/\s/g, '-').toLowerCase()}`}>{item.status}</span>
                                        </div>
                                        <p className="evidence-desc">{item.description}</p>
                                        <div className="evidence-meta">
                                            <span>{item.location || 'N/A'}</span>
                                            <span>{item.collectedBy}</span>
                                            <span>{item.collectedDate}</span>
                                        </div>

                                        {/* Chain of Custody */}
                                        <div className="chain-of-custody">
                                            <label>Chain of Custody:</label>
                                            <div className="chain-steps">
                                                {(item.chainOfCustody || []).map((step, idx) => (
                                                    <div key={idx} className="chain-step">
                                                        <span className="chain-dot" />
                                                        <span className="chain-text">{step}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {(role === 'Admin' || role === 'Investigator') && (
                                            <div className="evidence-actions">
                                                <button className="btn btn-sm btn-secondary" onClick={() => {
                                                    setForm({ ...item, caseId: item.caseId?.toString() || '', chainOfCustody: item.chainOfCustody || [''] });
                                                    setEditing(item);
                                                    setShowForm(true);
                                                }}>Edit</button>
                                                {role === 'Admin' && (
                                                    <button className="btn btn-sm btn-danger" onClick={() => handleDelete(item.evidenceId)}>DEL</button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Add/Edit Modal */}
            {showForm && (
                <div className="modal-overlay" onClick={() => setShowForm(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>{editing ? 'Edit Evidence' : 'Add Evidence'}</h3>
                            <button className="modal-close" onClick={() => setShowForm(false)}>×</button>
                        </div>
                        <form onSubmit={handleSubmit} className="form-grid">
                            <div className="form-group">
                                <label>Case *</label>
                                <select required value={form.caseId} onChange={e => setForm({ ...form, caseId: e.target.value })}>
                                    <option value="">Select Case</option>
                                    {cases.map(c => <option key={c.caseId} value={c.caseId}>Case #{c.caseId}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Type *</label>
                                <select required value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                                    <option value="">Select Type</option>
                                    {EVIDENCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div className="form-group full-width">
                                <label>Description *</label>
                                <textarea required rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label>Collected By</label>
                                <input type="text" value={form.collectedBy} onChange={e => setForm({ ...form, collectedBy: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label>Collection Date</label>
                                <input type="date" value={form.collectedDate} onChange={e => setForm({ ...form, collectedDate: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label>Location</label>
                                <input type="text" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label>Status</label>
                                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                                    {EVIDENCE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            <div className="form-group full-width">
                                <label>Chain of Custody</label>
                                {form.chainOfCustody.map((step, idx) => (
                                    <div key={idx} className="chain-input">
                                        <span className="chain-num">{idx + 1}.</span>
                                        <input type="text" placeholder="e.g. Officer A → Evidence Room"
                                            value={step} onChange={e => updateCustodyStep(idx, e.target.value)} />
                                    </div>
                                ))}
                                <button type="button" className="btn btn-sm btn-outline" onClick={addCustodyStep}>+ Add Step</button>
                            </div>
                            <div className="form-actions full-width">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">{editing ? 'Update' : 'Add Evidence'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Audit Log Modal */}
            {showAudit && (
                <div className="modal-overlay" onClick={() => setShowAudit(false)}>
                    <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Audit Trail — Evidence Records</h3>
                            <button className="modal-close" onClick={() => setShowAudit(false)}>×</button>
                        </div>
                        <div className="audit-table-container">
                            {evidenceLogs.length === 0 ? (
                                <p className="empty-state-text">No audit logs for evidence yet.</p>
                            ) : (
                                <table className="audit-table">
                                    <thead>
                                        <tr>
                                            <th>Timestamp</th>
                                            <th>Action</th>
                                            <th>Entity</th>
                                            <th>Record ID</th>
                                            <th>User</th>
                                            <th>Details</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {evidenceLogs.map(log => (
                                            <tr key={log.logId}>
                                                <td>{new Date(log.timestamp).toLocaleString()}</td>
                                                <td><span className={`action-badge ${log.action?.toLowerCase()}`}>{log.action}</span></td>
                                                <td>{log.entity}</td>
                                                <td>{log.entityId}</td>
                                                <td>{log.userId}</td>
                                                <td className="audit-details">{typeof log.details === 'string' ? log.details.substring(0, 80) + '...' : ''}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
