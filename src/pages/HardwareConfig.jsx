import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash, faPlus } from '@fortawesome/free-solid-svg-icons';

const HardwareConfig = () => {
    const [configs, setConfigs] = useState([]);
    const [category, setCategory] = useState('');
    const [prefix, setPrefix] = useState('');
    const [alert, setAlert] = useState(null);

    // Make/Company Config
    const [makes, setMakes] = useState([]);
    const [newMake, setNewMake] = useState('');

    useEffect(() => {
        fetchConfig();
        fetchMakes();
    }, []);

    const fetchConfig = async () => {
        const res = await fetch('http://localhost:3001/api/hardware/config');
        const data = await res.json();
        setConfigs(data);
    };

    const fetchMakes = async () => {
        try {
            const res = await fetch('http://localhost:3001/api/make/config');
            const data = await res.json();
            setMakes(data);
        } catch (error) {
            console.error('Failed to fetch makes:', error);
        }
    };

    const handleAdd = async () => {
        if (!category || !prefix) return showAlert('error', 'Fill all fields');

        const res = await fetch('http://localhost:3001/api/hardware/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ category: category.toUpperCase(), prefix: prefix.toUpperCase() })
        });

        if (res.ok) {
            showAlert('success', 'Category Added - Sidebar Updated');
            setCategory('');
            setPrefix('');
            fetchConfig();
            // Dispatch custom event to notify Layout to refresh sidebar
            window.dispatchEvent(new CustomEvent('hardwareConfigUpdated'));
        } else {
            showAlert('error', 'Failed to add');
        }
    };

    const handleAddMake = async () => {
        if (!newMake.trim()) return showAlert('error', 'Enter company name');

        const res = await fetch('http://localhost:3001/api/make/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newMake.trim() })
        });

        if (res.ok) {
            showAlert('success', 'Company Added');
            setNewMake('');
            fetchMakes();
        } else {
            const result = await res.json();
            showAlert('error', result.error || 'Failed to add');
        }
    };

    const handleDeleteMake = async (name) => {
        if (!confirm(`Delete "${name}" from the list?`)) return;

        const res = await fetch(`http://localhost:3001/api/make/config/${encodeURIComponent(name)}`, {
            method: 'DELETE'
        });

        if (res.ok) {
            showAlert('success', 'Company Deleted');
            fetchMakes();
        } else {
            showAlert('error', 'Failed to delete');
        }
    };

    const showAlert = (type, msg) => {
        setAlert({ type, message: msg });
        setTimeout(() => setAlert(null), 3000);
    };

    return (
        <div className="page-container">
            {alert && <div className={`alert alert-${alert.type}`}>{alert.message}</div>}

            <h1>Hardware Configuration</h1>
            <p>Define Hardware Categories, Prefixes, and Manufacturer/Company Names.</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginTop: '20px' }}>
                {/* Hardware Categories Section */}
                <div className="card" style={{ padding: '20px', backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>
                    <h3>Hardware Categories</h3>
                    <div className="form-group">
                        <label>Category Name (e.g., PROJECTOR)</label>
                        <input type="text" className="form-input" value={category} onChange={e => setCategory(e.target.value)} />
                    </div>
                    <div className="form-group">
                        <label>Prefix (e.g., PROJ)</label>
                        <input type="text" className="form-input" value={prefix} onChange={e => setPrefix(e.target.value)} />
                        <small>Serial Numbers will look like: PROJ0001</small>
                    </div>
                    <button className="btn btn-primary" onClick={handleAdd} style={{ marginTop: '10px' }}>
                        <FontAwesomeIcon icon={faPlus} /> Add Category
                    </button>

                    <div style={{ marginTop: '20px' }}>
                        <h4>Existing Categories</h4>
                        <table className="supplier-table">
                            <thead><tr><th>Category</th><th>Prefix</th></tr></thead>
                            <tbody>
                                {configs.map((c, i) => (
                                    <tr key={i}>
                                        <td>{c.category}</td>
                                        <td>{c.prefix}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Make/Company Section */}
                <div className="card" style={{ padding: '20px', backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>
                    <h3>Company/Brand Names (Make)</h3>
                    <p style={{ fontSize: '0.9em', color: '#666', marginBottom: '15px' }}>
                        Manage the list of companies that appear in the "Make" dropdown when adding or editing hardware.
                    </p>
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="Enter company name (e.g., Acer)"
                            value={newMake}
                            onChange={e => setNewMake(e.target.value)}
                            onKeyPress={e => e.key === 'Enter' && handleAddMake()}
                            style={{ flex: 1 }}
                        />
                        <button className="btn btn-primary" onClick={handleAddMake}>
                            <FontAwesomeIcon icon={faPlus} /> Add
                        </button>
                    </div>

                    <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                        <table className="supplier-table">
                            <thead><tr><th>Company Name</th><th style={{ width: '60px' }}>Action</th></tr></thead>
                            <tbody>
                                {makes.map((make, i) => (
                                    <tr key={i}>
                                        <td>{make}</td>
                                        <td>
                                            <button className="btn-icon delete" onClick={() => handleDeleteMake(make)} title="Delete">
                                                <FontAwesomeIcon icon={faTrash} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HardwareConfig;

