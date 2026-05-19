import { useState } from 'react';
import { getCurrentRole, setCurrentRole, setCurrentUser } from '../db/database';

const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: 'DAS' },
    { id: 'fir', label: 'FIR Management', icon: 'FIR' },
    { id: 'criminals', label: 'Criminal Records', icon: 'CRM' },
    { id: 'evidence', label: 'Evidence Tracking', icon: 'EVD' },
    { id: 'ai', label: 'AI Analysis', icon: 'AIS' },
];

const roles = [
    { role: 'Admin', user: 'CI Arun Krishnan', icon: 'ADM' },
    { role: 'Investigator', user: 'SI Lakshmi Nair', icon: 'INV' },
    { role: 'Analyst', user: 'Dr. Sreelakshmi Menon', icon: 'ANL' },
    { role: 'Viewer', user: 'CPO Akhil Rajan', icon: 'VWR' },
];

export default function Sidebar({ activeModule, onNavigate, theme, toggleTheme, onLogout }) {
    const [currentRoleState, setCurrentRoleState] = useState(getCurrentRole());
    const [showRoleMenu, setShowRoleMenu] = useState(false);

    const handleRoleChange = (r) => {
        setCurrentRole(r.role);
        setCurrentUser(r.user);
        setCurrentRoleState(r.role);
        setShowRoleMenu(false);
    };

    const currentRoleObj = roles.find(r => r.role === currentRoleState) || roles[0];

    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <div className="logo">
                    <div className="logo-mark">CIRAS</div>
                    <div className="logo-text">
                        <span>Crime Investigation &amp;</span>
                        <span>Analysis System</span>
                    </div>
                </div>
                <div className="system-status">
                    <span className="status-indicator" />
                    <span>SYSTEM ONLINE</span>
                </div>
            </div>

            <div className="nav-section-label">MODULES</div>
            <nav className="sidebar-nav">
                {navItems.map(item => (
                    <button
                        key={item.id}
                        className={`nav-item ${activeModule === item.id ? 'active' : ''}`}
                        onClick={() => onNavigate(item.id)}
                    >
                        <span className="nav-code">{item.icon}</span>
                        <span className="nav-label">{item.label}</span>
                        {activeModule === item.id && <span className="nav-indicator" />}
                    </button>
                ))}
            </nav>

            <div className="sidebar-footer">
                <div className="footer-label">ACTIVE OFFICER</div>
                <div className="role-selector" onClick={() => setShowRoleMenu(!showRoleMenu)}>
                    <div className="role-code">{currentRoleObj.icon}</div>
                    <div className="role-info">
                        <span className="role-name">{currentRoleObj.user}</span>
                        <span className="role-badge">{currentRoleObj.role}</span>
                    </div>
                    <span className="role-chevron">{showRoleMenu ? '▲' : '▼'}</span>
                </div>

                {showRoleMenu && (
                    <div className="role-menu">
                        {roles.map(r => (
                            <button
                                key={r.role}
                                className={`role-menu-item ${r.role === currentRoleState ? 'active' : ''}`}
                                onClick={() => handleRoleChange(r)}
                            >
                                <span className="role-item-code">{r.icon}</span>
                                <div>
                                    <span className="role-menu-name">{r.user}</span>
                                    <span className="role-menu-role">{r.role}</span>
                                </div>
                            </button>
                        ))}
                    </div>
                )}

                <div className="sidebar-actions">
                    <button className="sidebar-action-btn" onClick={toggleTheme} title="Toggle Theme">
                        <span className="nav-code">{theme === 'dark' ? 'LGT' : 'DRK'}</span>
                        <span className="nav-label">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
                    </button>
                    <button className="sidebar-action-btn logout-btn" onClick={onLogout} title="Logout">
                        <span className="nav-code">OUT</span>
                        <span className="nav-label">Logout</span>
                    </button>
                </div>
            </div>
        </aside>
    );
}
