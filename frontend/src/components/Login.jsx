import { useState } from 'react';
import { setCurrentRole, setCurrentUser } from '../db/database';

export default function Login({ onLogin, theme, toggleTheme }) {
    const [badgeId, setBadgeId] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        // Mock authentication process
        setTimeout(() => {
            if (badgeId.trim() && password === '1234') {
                // Mock setting default admin user based on login
                setCurrentRole('Admin');
                setCurrentUser('CI Arun Krishnan');
                onLogin();
            } else {
                setError('Invalid Badge ID or Authorization Code. Try code: 1234');
                setLoading(false);
            }
        }, 800);
    };

    return (
        <div className="login-container">
            <div className="login-theme-toggle">
                <button onClick={toggleTheme} className="theme-toggle-btn" title="Toggle Theme">
                    {theme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode'}
                </button>
            </div>

            <div className="login-box">
                <div className="login-header">
                    <div className="login-logo-mark">CIRAS</div>
                    <h2>SYSTEM AUTHORIZATION</h2>
                    <p>Secure Access Gateway</p>
                </div>

                {error && <div className="login-error">{error}</div>}

                <form onSubmit={handleLogin} className="login-form">
                    <div className="form-group">
                        <label>OFFICER BADGE ID</label>
                        <input
                            type="text"
                            placeholder="KL-POL-XXXX"
                            value={badgeId}
                            onChange={(e) => setBadgeId(e.target.value)}
                            required
                            autoFocus
                        />
                    </div>

                    <div className="form-group">
                        <label>AUTHORIZATION CODE</label>
                        <input
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    <button type="submit" className="login-submit" disabled={loading}>
                        {loading ? 'AUTHENTICATING...' : 'ACCESS SYSTEM'}
                    </button>
                </form>

                <div className="login-footer">
                    <span>Restricted Access</span>
                    <span>Unauthorized entry is prohibited</span>
                </div>
            </div>
        </div>
    );
}
