import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';

// Move ConfigSection outside to prevent focus loss on parent re-render
const ConfigSection = ({ title, type, items, newItemValue, onInputChange, onAdd, onDelete }) => (
    <div className="card" style={{ marginBottom: '20px', padding: '20px' }}>
        <h3>{title}</h3>
        <div className="form-row" style={{ marginTop: '15px' }}>
            <input
                type="text"
                className="form-input"
                placeholder={`Add new ${title.toLowerCase()}...`}
                value={newItemValue}
                onChange={e => onInputChange(type, e.target.value)}
                onKeyPress={e => e.key === 'Enter' && onAdd(type)}
            />
            <button className="btn btn-primary" onClick={() => onAdd(type)}>
                <FontAwesomeIcon icon={faPlus} /> Add
            </button>
        </div>
        <div style={{ marginTop: '15px', display: 'flex', flexWrap: 'wrap', gap: '10px', minHeight: '34px' }}>
            {items && items.length > 0 ? (
                items.map(item => (
                    <div key={item} style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '5px 15px', backgroundColor: '#f0f0f0', borderRadius: '20px', fontSize: '0.9em'
                    }}>
                        {item}
                        <button style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#ff4d4d' }} onClick={() => onDelete(type, item)}>
                            <FontAwesomeIcon icon={faTrash} style={{ fontSize: '0.8em' }} />
                        </button>
                    </div>
                ))
            ) : (
                <span style={{ color: '#999', fontSize: '0.9em', fontStyle: 'italic' }}>No items added yet</span>
            )}
        </div>
    </div>
);

const EmployeeConfig = () => {
    const [config, setConfig] = useState({ posts: [], sections: [], wings: [], offices: [] });
    const [newItems, setNewItems] = useState({ posts: '', sections: '', wings: '', offices: '' });
    const [processing, setProcessing] = useState(false);
    const [alert, setAlert] = useState(null);

    useEffect(() => {
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        try {
            const res = await fetch('http://localhost:3001/api/employees/config');
            if (res.ok) {
                const data = await res.json();
                setConfig(data);
            }
        } catch (error) {
            console.error('Failed to fetch config');
        }
    };

    const showAlert = (type, msg) => {
        setAlert({ type, message: msg });
        setTimeout(() => setAlert(null), 3000);
    };

    const handleInputChange = (type, value) => {
        setNewItems(prev => ({ ...prev, [type]: value }));
    };

    const handleAdd = async (type) => {
        const val = newItems[type].trim();
        if (!val) return;

        // Ensure the array exists before checking includes
        const currentItems = config[type] || [];
        if (currentItems.includes(val)) return showAlert('error', 'Already exists');

        const updatedValues = [...currentItems, val];
        await saveConfig(type, updatedValues);
        // Reset the specific input after successful add
        setNewItems(prev => ({ ...prev, [type]: '' }));
    };

    const handleDelete = async (type, val) => {
        if (!window.confirm(`Delete "${val}"?`)) return;
        const currentItems = config[type] || [];
        const updatedValues = currentItems.filter(v => v !== val);
        await saveConfig(type, updatedValues);
    };

    const saveConfig = async (type, values) => {
        setProcessing(true);
        try {
            const res = await fetch('http://localhost:3001/api/employees/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, values })
            });
            if (res.ok) {
                showAlert('success', 'Updated Successfully');
                await fetchConfig();
            } else {
                showAlert('error', 'Failed to save');
            }
        } catch (error) {
            showAlert('error', 'Network error');
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div className="page-container">
            {processing && <div className="processing-overlay"><div className="spinner"></div></div>}
            {alert && <div className={`alert alert-${alert.type}`}>{alert.message}</div>}

            <div className="page-header">
                <h1>Employee Settings</h1>
                <p>Manage list items for Employee dropdowns</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <ConfigSection
                    title="Present Posts"
                    type="posts"
                    items={config.posts}
                    newItemValue={newItems.posts}
                    onInputChange={handleInputChange}
                    onAdd={handleAdd}
                    onDelete={handleDelete}
                />
                <ConfigSection
                    title="Sections"
                    type="sections"
                    items={config.sections}
                    newItemValue={newItems.sections}
                    onInputChange={handleInputChange}
                    onAdd={handleAdd}
                    onDelete={handleDelete}
                />
                <ConfigSection
                    title="Wings"
                    type="wings"
                    items={config.wings}
                    newItemValue={newItems.wings}
                    onInputChange={handleInputChange}
                    onAdd={handleAdd}
                    onDelete={handleDelete}
                />
                <ConfigSection
                    title="Offices"
                    type="offices"
                    items={config.offices}
                    newItemValue={newItems.offices}
                    onInputChange={handleInputChange}
                    onAdd={handleAdd}
                    onDelete={handleDelete}
                />
            </div>
        </div>
    );
};

export default EmployeeConfig;
