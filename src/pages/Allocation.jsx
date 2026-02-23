import React, { useState, useEffect, useRef, useMemo } from 'react';
import { formatDate } from '../utils/formatDate';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faSearch,
    faUserCheck,
    faBoxes,
    faHistory,
    faEdit,
    faTimes,
    faFileExcel,
    faDownload
} from '@fortawesome/free-solid-svg-icons';

const Allocation = () => {
    const [hardware, setHardware] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [invoices, setInvoices] = useState([]);
    const [ewasteItems, setEwasteItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [alert, setAlert] = useState(null);

    // Search & Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [filterItemName, setFilterItemName] = useState('');
    const [filterStock, setFilterStock] = useState('');

    // Modal
    const [showModal, setShowModal] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    const [allocationForm, setAllocationForm] = useState({ PIN: '', Issued_Date: new Date().toISOString().split('T')[0] });
    const [selectedEmployee, setSelectedEmployee] = useState(null);

    // History Modal
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [historyData, setHistoryData] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    const fileInputRef = useRef(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [hwRes, empRes, invRes, ewRes] = await Promise.all([
                fetch('http://localhost:3001/api/hardware'),
                fetch('http://localhost:3001/api/employees'),
                fetch('http://localhost:3001/api/invoices'),
                fetch('http://localhost:3001/api/ewaste/dashboard')
            ]);

            const [hwData, empData, invData, ewData] = await Promise.all([
                hwRes.json(),
                empRes.json(),
                invRes.json(),
                ewRes.json()
            ]);

            // Get all E-Waste item IDs
            const ewItemsRes = await Promise.all(
                ewData.map(year => fetch(`http://localhost:3001/api/ewaste/${year.year}/items`).then(r => r.json()))
            );
            const allEWasteItems = ewItemsRes.flat();

            setHardware(hwData);
            setEmployees(empData);
            setInvoices(invData);
            setEwasteItems(allEWasteItems);
        } catch (error) {
            showAlert('error', 'Failed to fetch data');
        } finally {
            setLoading(false);
        }
    };

    const showAlert = (type, msg) => {
        setAlert({ type, message: msg });
        setTimeout(() => setAlert(null), 3000);
    };

    const normalize = (s) => String(s || '').trim().replace(/^0+/, '');

    // Computed filtered list — reacts instantly to any change
    const filteredList = useMemo(() => {
        const query = searchQuery.toLowerCase().trim();
        let results = hardware;

        // Apply Item Name filter
        if (filterItemName) {
            results = results.filter(h => h.Item_Name === filterItemName);
        }

        // Apply STOCK filter
        if (filterStock === 'STOCK') {
            results = results.filter(h => String(h.Allocated_To) === 'STOCK');
        } else if (filterStock === 'ALLOCATED') {
            results = results.filter(h => h.Allocated_To && String(h.Allocated_To) !== 'STOCK');
        }

        // Apply text search
        if (query) {
            results = results.filter(h => {
                const allocatedStr = String(h.Allocated_To || '');
                const emp = employees.find(e => normalize(e.PIN) === normalize(h.Allocated_To));
                const edpMatch = String(h.EDP_Serial || '').toLowerCase().includes(query);
                const pinMatch = allocatedStr.toLowerCase().includes(query);
                const nameMatch = emp?.Name?.toLowerCase().includes(query);
                const itemMatch = String(h.Item_Name || '').toLowerCase().includes(query);
                return edpMatch || pinMatch || nameMatch || itemMatch;
            });
        }

        return results;
    }, [searchQuery, filterItemName, filterStock, hardware, employees]);

    const handleOpenModal = (item) => {
        setSelectedItem(item);
        setAllocationForm({
            PIN: item.Allocated_To === 'STOCK' ? '' : item.Allocated_To,
            Issued_Date: item.Issued_Date || new Date().toISOString().split('T')[0]
        });
        if (item.Allocated_To !== 'STOCK') {
            setSelectedEmployee(employees.find(e => normalize(e.PIN) === normalize(item.Allocated_To)));
        } else {
            setSelectedEmployee(null);
        }
        setShowModal(true);
    };

    const handlePINChange = (pin) => {
        setAllocationForm({ ...allocationForm, PIN: pin });
        const normalizedPin = normalize(pin);
        const emp = employees.find(e => {
            return normalize(e.PIN) === normalizedPin ||
                (e.Name && e.Name.toLowerCase() === pin.toLowerCase());
        });
        setSelectedEmployee(emp || null);
    };

    const handleSaveAllocation = async () => {
        setProcessing(true);
        try {
            // Get current user from localStorage
            const userProfile = JSON.parse(localStorage.getItem('userProfile') || '{}');
            const changedBy = userProfile.name || 'System';

            const res = await fetch('http://localhost:3001/api/hardware/allocate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: selectedItem.id,
                    PIN: allocationForm.PIN || 'STOCK',
                    Issued_Date: allocationForm.Issued_Date,
                    changedBy: changedBy // Add username
                })
            });

            if (res.ok) {
                showAlert('success', 'Allocation Updated');
                setShowModal(false);
                fetchData();
            } else {
                showAlert('error', 'Failed to update');
            }
        } catch (error) {
            showAlert('error', 'Update error');
        } finally {
            setProcessing(false);
        }
    };

    const handleDoubleClick = async (item) => {
        setSelectedItem(item);
        setShowHistoryModal(true);
        setHistoryLoading(true);
        try {
            console.log('Fetching history for hardware ID:', item.id);
            const res = await fetch(`http://localhost:3001/api/hardware/${item.id}/history`);
            console.log('History response status:', res.status);
            if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
            }
            const data = await res.json();
            console.log('History data received:', data);
            setHistoryData(data);
        } catch (error) {
            console.error('History fetch error:', error);
            showAlert('error', 'Failed to load history');
        } finally {
            setHistoryLoading(false);
        }
    };

    const getPurchasedDate = (billNo) => {
        const inv = invoices.find(i => i.Bill_Number === billNo);
        return inv ? formatDate(inv.Date) : '-';
    };

    // Safe check for Electron API
    const isElectron = () => window.electronAPI && typeof window.electronAPI.showOpenDialog === 'function';

    const handleDownloadExcel = async () => {
        setProcessing(true);
        try {
            if (isElectron()) {
                // Fetch buffer first (no blank window!)
                const res = await fetch('http://localhost:3001/api/allocation/download-buffer');
                const data = await res.json();
                if (!data.buffer) throw new Error('No data');

                const result = await window.electronAPI.showSaveDialog({
                    title: 'Save Allocation Excel',
                    defaultPath: 'allocation_items.xlsx',
                    filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
                });

                if (!result.canceled && result.filePath) {
                    await window.electronAPI.writeFile({
                        filePath: result.filePath,
                        buffer: data.buffer
                    });
                    showAlert('success', 'File saved!');
                }
            } else {
                // Browser fallback - blob download (no window.open!)
                const response = await fetch('http://localhost:3001/api/allocation/download');
                if (!response.ok) throw new Error('Download failed');
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'allocation_items.xlsx';
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
                showAlert('success', 'File downloaded');
            }
        } catch (error) {
            console.error('Download error:', error);
            showAlert('error', 'Error downloading file');
        } finally {
            setProcessing(false);
        }
    };

    const handleBulkUpload = async (e) => {
        const file = e?.target?.files?.[0];
        if (!file) return;

        setProcessing(true);
        try {
            // Use base64 for server upload (works in both Electron and browser)
            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const res = await fetch('http://localhost:3001/api/allocation/upload', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ fileData: event.target.result })
                    });
                    const result = await res.json();
                    if (res.ok) {
                        showAlert('success', result.message || 'Upload complete');
                        fetchData();
                    } else {
                        showAlert('error', result.error || 'Upload failed');
                    }
                } catch (err) {
                    showAlert('error', 'Upload error');
                } finally {
                    setProcessing(false);
                    if (e.target) e.target.value = null;
                }
            };
            reader.readAsDataURL(file);
        } catch (error) {
            console.error('Upload error:', error);
            showAlert('error', 'Upload failed');
            setProcessing(false);
        }
    };

    return (
        <div className="page-container">
            {processing && <div className="processing-overlay"><div className="spinner"></div><p>Updating...</p></div>}
            {alert && <div className={`alert alert-${alert.type}`}>{alert.message}</div>}

            <div className="page-header">
                <h1>Hardware Allocation</h1>
                <p>Manage and track hardware assignments</p>
            </div>

            <div className="toolbar" style={{ flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="btn btn-outline" onClick={() => fileInputRef.current.click()}>
                        <FontAwesomeIcon icon={faFileExcel} /> Bulk Upload
                    </button>
                    <button className="btn btn-outline" onClick={handleDownloadExcel}>
                        <FontAwesomeIcon icon={faDownload} /> Download Excel
                    </button>
                    <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept=".xlsx, .xls" onChange={handleBulkUpload} />
                </div>

                <div className="search-bar" style={{ width: '100%', maxWidth: '850px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <select
                        className="form-select"
                        value={filterItemName}
                        onChange={e => setFilterItemName(e.target.value)}
                        style={{ width: '160px' }}
                    >
                        <option value="">All Items</option>
                        {[...new Set(hardware.map(h => h.Item_Name))].sort().map(name => (
                            <option key={name} value={name}>{name}</option>
                        ))}
                    </select>
                    <select
                        className="form-select"
                        value={filterStock}
                        onChange={e => setFilterStock(e.target.value)}
                        style={{ width: '140px' }}
                    >
                        <option value="">All Status</option>
                        <option value="STOCK">In STOCK</option>
                        <option value="ALLOCATED">Allocated</option>
                    </select>
                    <input
                        type="text"
                        className="form-input"
                        placeholder="Search EDP, Name, PIN..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        style={{ flex: 1, minWidth: '180px' }}
                    />
                    <button className="btn btn-outline" onClick={() => { setSearchQuery(''); setFilterItemName(''); setFilterStock(''); }}>Clear</button>
                </div>
            </div>

            <div className="table-responsive">
                {loading ? <p>Loading data...</p> : (
                    <table className="supplier-table">
                        <thead>
                            <tr>
                                <th>Item Name</th>
                                <th>EDP Serial</th>
                                <th>PIN</th>
                                <th>Name</th>
                                <th>Post</th>
                                <th>Section</th>
                                <th>Wing</th>
                                <th>Issued Date</th>
                                <th>Make</th>
                                <th>Co. Serial</th>
                                <th>Bill No</th>
                                <th>Purchased</th>
                                <th>Cost</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredList.map(h => {
                                const emp = employees.find(e => normalize(e.PIN) === normalize(h.Allocated_To));
                                const isStock = h.Allocated_To === 'STOCK';
                                const isInEWaste = ewasteItems.some(ew => ew.hardware_id === h.id);
                                const isAllocatedInEWaste = isInEWaste && !isStock;

                                return (
                                    <tr
                                        key={h.id}
                                        onDoubleClick={() => handleDoubleClick(h)}
                                        style={{
                                            cursor: 'pointer',
                                            backgroundColor: isAllocatedInEWaste ? '#fff3cd' : 'transparent'
                                        }}
                                        title={isAllocatedInEWaste ? "This item is in E-Waste but still allocated" : "Double-click to view allocation history"}
                                    >
                                        <td>{h.Item_Name}</td>
                                        <td><strong>{h.EDP_Serial}</strong></td>
                                        <td>{isStock ? <span className="badge-stock">STOCK</span> : h.Allocated_To}</td>
                                        <td>{emp?.Name || '-'}</td>
                                        <td>{emp?.Present_Post || '-'}</td>
                                        <td>{emp?.Section || '-'}</td>
                                        <td>{emp?.Wing || '-'}</td>
                                        <td>{formatDate(h.Issued_Date)}</td>
                                        <td>{h.Make}</td>
                                        <td>{h.Company_Serial}</td>
                                        <td>{h.Bill_Number}</td>
                                        <td>{getPurchasedDate(h.Bill_Number)}</td>
                                        <td>{h.Cost}</td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '5px' }}>
                                                <button className="btn-icon edit" onClick={(e) => { e.stopPropagation(); handleOpenModal(h); }} title="Re-allocate">
                                                    <FontAwesomeIcon icon={faUserCheck} />
                                                </button>
                                                <button className="btn-icon edit" onClick={(e) => { e.stopPropagation(); handleDoubleClick(h); }} title="View History">
                                                    <FontAwesomeIcon icon={faHistory} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {showModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h3>Hardware Allocation</h3>
                            <button className="close-btn" onClick={() => setShowModal(false)}><FontAwesomeIcon icon={faTimes} /></button>
                        </div>
                        <div className="modal-body">
                            <div className="card" style={{ padding: '15px', marginBottom: '20px', backgroundColor: '#f9f9f9' }}>
                                <p><strong>Item:</strong> {selectedItem.Item_Name} ({selectedItem.EDP_Serial})</p>
                                <p><strong>Currently:</strong> {selectedItem.Allocated_To === 'STOCK' ? 'In STOCK' : `Allocated to ${selectedItem.Allocated_To}`}</p>
                            </div>

                            <div className="form-group">
                                <label>Enter Employee PIN or Name</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Leave empty for STOCK"
                                    value={allocationForm.PIN}
                                    onChange={e => handlePINChange(e.target.value)}
                                    list="employee-list"
                                />
                                <datalist id="employee-list">
                                    {employees.map(e => <option key={e.PIN} value={e.PIN}>{e.Name}</option>)}
                                </datalist>
                                <p style={{ fontSize: '0.8em', color: '#666', marginTop: '5px' }}>Tip: Clear the field to move item back to STOCK.</p>
                            </div>

                            {selectedEmployee && (
                                <div className="card" style={{ padding: '15px', marginTop: '10px', borderLeft: '4px solid teal' }}>
                                    <h4 style={{ margin: '0 0 10px 0' }}>Employee Details Found:</h4>
                                    <p><strong>Name:</strong> {selectedEmployee.Name}</p>
                                    <p><strong>Post:</strong> {selectedEmployee.Present_Post}</p>
                                    <p><strong>Section:</strong> {selectedEmployee.Section}</p>
                                    <p><strong>Wing:</strong> {selectedEmployee.Wing}</p>
                                </div>
                            )}

                            <div className="form-group" style={{ marginTop: '20px' }}>
                                <label>Issued Date *</label>
                                <input
                                    type="date"
                                    className="form-input"
                                    value={allocationForm.Issued_Date}
                                    onChange={e => setAllocationForm({ ...allocationForm, Issued_Date: e.target.value })}
                                />
                                <p style={{ fontSize: '0.8em', color: '#666', marginTop: '5px' }}>
                                    {allocationForm.PIN ? 'Date when device was issued to employee' : 'Date when device was moved to STOCK'}
                                </p>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleSaveAllocation}>
                                {allocationForm.PIN ? 'Allocate Device' : 'Move to STOCK'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* History Modal */}
            {showHistoryModal && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: '800px' }}>
                        <div className="modal-header">
                            <h3>Allocation History - {selectedItem?.EDP_Serial}</h3>
                            <button className="close-btn" onClick={() => setShowHistoryModal(false)}><FontAwesomeIcon icon={faTimes} /></button>
                        </div>
                        <div className="modal-body">
                            <p style={{ marginBottom: '15px', color: '#666' }}>
                                <strong>Item:</strong> {selectedItem?.Item_Name} ({selectedItem?.EDP_Serial})
                            </p>
                            {historyLoading ? (
                                <p>Loading history...</p>
                            ) : historyData.length === 0 ? (
                                <p style={{ textAlign: 'center', color: '#999', padding: '20px' }}>No allocation history found for this item.</p>
                            ) : (
                                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                                    <table className="supplier-table">
                                        <thead>
                                            <tr>
                                                <th>From</th>
                                                <th>To</th>
                                                <th>Employee Name</th>
                                                <th>Issued Date</th>
                                                <th>Changed At</th>
                                                <th>Changed By</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {historyData.map(h => {
                                                const toEmp = employees.find(e => e.PIN === h.to_PIN);
                                                const fromEmp = employees.find(e => e.PIN === h.from_PIN);
                                                return (
                                                    <tr key={h.id}>
                                                        <td>{h.from_PIN === 'STOCK' ? <span className="badge-stock">STOCK</span> : h.from_PIN}</td>
                                                        <td>{h.to_PIN === 'STOCK' ? <span className="badge-stock">STOCK</span> : h.to_PIN}</td>
                                                        <td>{toEmp?.Name || (h.to_PIN === 'STOCK' ? '-' : 'Unknown')}</td>
                                                        <td>{h.issued_date || '-'}</td>
                                                        <td>{new Date(h.changed_at).toLocaleString()}</td>
                                                        <td><strong>{h.changed_by || 'System'}</strong></td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowHistoryModal(false)}>Close</button>
                        </div>
                    </div>
                </div>
            )}

            <style dangerouslySetInnerHTML={{
                __html: `
                .badge-stock {
                    background-color: #eee;
                    color: #666;
                    padding: 2px 8px;
                    border-radius: 4px;
                    font-size: 0.85em;
                    font-weight: 600;
                }
            `}} />
        </div>
    );
};

export default Allocation;
