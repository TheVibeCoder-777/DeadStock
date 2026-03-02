import React, { useState, useEffect, useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faSearch, faTimes, faEdit, faTrash, faSave, faBan, faSync, faFileExcel, faDownload } from '@fortawesome/free-solid-svg-icons';

const Suppliers = () => {
    // --- State ---
    const [suppliers, setSuppliers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false); // Global processing overlay
    const [alert, setAlert] = useState(null); // { type: 'success'|'error', message: '' }

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 25;

    // Search
    const [searchCriteria, setSearchCriteria] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');

    // Modal
    const [showModal, setShowModal] = useState(false);
    const [newSupplier, setNewSupplier] = useState({
        Supplier_ID: '',
        Category: '',
        Supplier_Name: '',
        Address_1: '',
        Address_2: '',
        City: '',
        State: '',
        PIN_Code: '',
        POC_Person: '',
        Phone_Number: '',
        Email: ''
    });

    // Inline Editing
    const [editRowId, setEditRowId] = useState(null);
    const [editFormData, setEditFormData] = useState({});

    // --- Effects ---
    useEffect(() => {
        fetchSuppliers();
    }, []);

    // --- API Functions ---
    const fetchSuppliers = async () => {
        setLoading(true);
        try {
            const response = await fetch('http://localhost:3001/api/suppliers');
            const data = await response.json();
            setSuppliers(data);
        } catch (error) {
            console.error('Error fetching suppliers:', error);
            showAlert('error', `Failed to load suppliers: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateSupplier = async () => {
        // Validation
        if (!newSupplier.Category || !newSupplier.Supplier_Name || !newSupplier.Address_1 || !newSupplier.City) {
            showAlert('error', 'Please fill in all required fields');
            return;
        }

        setProcessing(true);
        try {
            const response = await fetch('http://localhost:3001/api/suppliers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newSupplier)
            });
            if (response.ok) {
                showAlert('success', 'New Supplier Added');
                setShowModal(false);
                setNewSupplier({
                    Supplier_ID: '', Category: '', Supplier_Name: '', Address_1: '', Address_2: '',
                    City: '', State: '', PIN_Code: '', POC_Person: '', Phone_Number: '', Email: ''
                });
                fetchSuppliers();
            } else {
                showAlert('error', 'Failed to add supplier');
            }
        } catch (error) {
            showAlert('error', 'Error adding supplier');
        } finally {
            setProcessing(false);
        }
    };

    const handleUpdateSupplier = async (id) => {
        setProcessing(true);
        try {
            const response = await fetch(`http://localhost:3001/api/suppliers/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editFormData)
            });

            if (response.ok) {
                showAlert('success', 'Supplier Details Updated');
                setEditRowId(null);
                fetchSuppliers();
            } else {
                showAlert('error', 'Failed to update supplier');
            }
        } catch (error) {
            showAlert('error', 'Error updating supplier');
        } finally {
            setProcessing(false);
        }
    };

    const handleDeleteSupplier = async (id) => {
        if (window.confirm('Are you sure you want to delete this supplier?')) {
            setProcessing(true);
            try {
                const response = await fetch(`http://localhost:3001/api/suppliers/${id}`, {
                    method: 'DELETE'
                });
                if (response.ok) {
                    showAlert('success', 'Supplier Deleted');
                    fetchSuppliers();
                } else {
                    showAlert('error', 'Failed to delete supplier');
                }
            } catch (error) {
                showAlert('error', 'Error deleting supplier');
            } finally {
                setProcessing(false);
            }
        }
    };

    // Excel Variables
    const fileInputRef = React.useRef(null);

    // Safe check for Electron API
    const isElectron = () => window.electronAPI && typeof window.electronAPI.showOpenDialog === 'function';

    // Browser fallback upload handler
    const handleUpload = async (e) => {
        const file = e?.target?.files?.[0];
        if (!file) return;
        setProcessing(true);
        try {
            // Convert to base64 for server
            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const response = await fetch('http://localhost:3001/api/suppliers/upload', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ fileData: event.target.result })
                    });
                    const data = await response.json();
                    if (response.ok) {
                        showAlert('success', data.message || 'Suppliers uploaded');
                        fetchSuppliers();
                    } else {
                        showAlert('error', data.error || 'Upload failed');
                    }
                } catch (err) {
                    showAlert('error', 'Error uploading file');
                } finally {
                    setProcessing(false);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                }
            };
            reader.readAsDataURL(file);
        } catch (error) {
            console.error('Upload error:', error);
            showAlert('error', 'Error uploading file');
            setProcessing(false);
        }
    };

    // Native upload with proper error handling
    const handleNativeUpload = async () => {
        if (!isElectron()) {
            // Fallback to file input
            if (fileInputRef.current) fileInputRef.current.click();
            return;
        }

        try {
            const result = await window.electronAPI.showOpenDialog({
                title: 'Select Excel File for Bulk Upload',
                filters: [{ name: 'Excel Files', extensions: ['xlsx', 'xls'] }],
                properties: ['openFile']
            });

            if (result.canceled || !result.filePaths?.length) return;

            const filePath = result.filePaths[0];
            const fileName = filePath.split('\\').pop() || filePath.split('/').pop();

            if (!window.confirm(`Upload ${fileName}? This will add suppliers.`)) return;

            setProcessing(true);

            const fileResult = await window.electronAPI.readFile(filePath);
            if (!fileResult?.success) {
                showAlert('error', 'Failed to read file');
                setProcessing(false);
                return;
            }

            const saveResult = await window.electronAPI.saveFile({
                name: `suppliers_${Date.now()}_${fileName}`,
                buffer: fileResult.data
            });

            if (!saveResult?.success) {
                showAlert('error', 'Failed to save file');
                setProcessing(false);
                return;
            }

            const savedFileName = saveResult.path.split('\\').pop() || saveResult.path.split('/').pop();

            const res = await fetch('http://localhost:3001/api/suppliers/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ processOnly: true, fileName: savedFileName })
            });

            const data = await res.json();
            if (res.ok) {
                showAlert('success', data.message || 'Suppliers uploaded');
                fetchSuppliers();
            } else {
                showAlert('error', data.error || 'Upload failed');
            }
        } catch (error) {
            console.error('Upload error:', error);
            showAlert('error', 'Error uploading file');
        } finally {
            setProcessing(false);
        }
    };

    // Native download - NO blank window!
    const handleFileDownload = async () => {
        setProcessing(true);
        try {
            if (isElectron()) {
                // Fetch buffer FIRST before showing dialog
                const res = await fetch('http://localhost:3001/api/suppliers/download-buffer');
                const data = await res.json();

                if (!data.buffer) throw new Error('No data received');

                // NOW show save dialog
                const result = await window.electronAPI.showSaveDialog({
                    title: 'Save Suppliers Excel',
                    defaultPath: 'suppliers.xlsx',
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
                // Browser fallback - blob download
                const response = await fetch('http://localhost:3001/api/suppliers/download');
                if (!response.ok) throw new Error('Download failed');
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'suppliers.xlsx';
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

    // --- Logic Helpers ---
    const generateSupplierID = () => {
        // Find existing max ID
        let maxId = 0;
        suppliers.forEach(s => {
            if (s.Supplier_ID && s.Supplier_ID.startsWith('S')) {
                const numStr = s.Supplier_ID.substring(1);
                const num = parseInt(numStr, 10);
                if (!isNaN(num) && num > maxId) {
                    maxId = num;
                }
            }
        });

        const nextNum = maxId + 1;
        // Pad with leading zeros (e.g., 001)
        const id = `S${String(nextNum).padStart(3, '0')}`;

        // Double check existence (shouldn't happen with max+1 logic but good to be safe)
        if (!suppliers.some(s => s.Supplier_ID === id)) {
            setNewSupplier({ ...newSupplier, Supplier_ID: id });
        } else {
            showAlert('error', 'Error generating ID');
        }
    };

    // --- Computed Search (instant) ---
    const filteredSuppliers = useMemo(() => {
        if (!searchQuery) return suppliers;
        try {
            const query = searchQuery.toLowerCase();
            return suppliers.filter(s => {
                try {
                    if (searchCriteria === 'Supplier Name') {
                        return String(s.Supplier_Name || '').toLowerCase().includes(query);
                    } else if (searchCriteria === 'City') {
                        return String(s.City || '').toLowerCase().includes(query);
                    } else if (searchCriteria === 'State') {
                        return String(s.State || '').toLowerCase().includes(query);
                    }
                    return String(s.Supplier_Name || '').toLowerCase().includes(query) ||
                        String(s.City || '').toLowerCase().includes(query) ||
                        String(s.State || '').toLowerCase().includes(query);
                } catch { return false; }
            });
        } catch { return suppliers; }
    }, [searchQuery, searchCriteria, suppliers]);

    const handleClearSearch = () => {
        setSearchQuery('');
        setSearchCriteria('All');
    };

    const showAlert = (type, msg) => {
        setAlert({ type, message: msg });
        setTimeout(() => setAlert(null), 3000);
    };

    const startEdit = (supplier) => {
        setEditRowId(supplier.Supplier_ID);
        setEditFormData({ ...supplier });
    };

    const cancelEdit = () => {
        setEditRowId(null);
        setEditFormData({});
    };

    // --- Render Helpers ---
    // Pagination logic
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredSuppliers.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredSuppliers.length / itemsPerPage);

    const paginate = (pageNumber) => setCurrentPage(pageNumber);

    return (
        <div className="page-container">
            {/* Processing Overlay */}
            {processing && (
                <div className="processing-overlay">
                    <div className="spinner"></div>
                    <p>Processing...</p>
                </div>
            )}

            {/* Alert */}
            {alert && (
                <div className={`alert alert-${alert.type}`}>
                    {alert.message}
                </div>
            )}

            {/* Header */}
            <div className="page-header">
                <h1>Suppliers</h1>
                <p>Add and manage your suppliers</p>
            </div>

            {/* Toolbar */}
            <div className="toolbar">
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                        <FontAwesomeIcon icon={faPlus} /> New Supplier
                    </button>
                    {/* Excel Buttons */}
                    <input
                        type="file"
                        accept=".xlsx, .xls"
                        style={{ display: 'none' }}
                        ref={fileInputRef}
                        onChange={handleUpload}
                    />
                    <button className="btn btn-outline" onClick={handleNativeUpload}>
                        <FontAwesomeIcon icon={faFileExcel} style={{ color: 'green' }} /> Bulk Upload
                    </button>
                    <button className="btn btn-outline" onClick={handleFileDownload}>
                        <FontAwesomeIcon icon={faDownload} /> Download Excel
                    </button>
                </div>

                <div className="search-bar">
                    <select
                        value={searchCriteria}
                        onChange={(e) => setSearchCriteria(e.target.value)}
                        className="form-select"
                    >
                        <option value="All">All</option>
                        <option value="Supplier Name">Supplier Name</option>
                        <option value="City">City</option>
                        <option value="State">State</option>
                    </select>
                    <input
                        type="text"
                        placeholder="Search..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="form-input"
                    />
                    <button className="btn btn-outline" onClick={handleClearSearch}>
                        <FontAwesomeIcon icon={faTimes} /> Clear
                    </button>
                </div>
            </div>

            {/* Modal */}
            {
                showModal && (
                    <div className="modal-overlay">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h3>Add New Supplier</h3>
                            </div>
                            <div className="modal-body">
                                <div className="form-group-row">
                                    <label>Supplier ID (Auto):</label>
                                    <div className="input-with-button">
                                        <input type="text" value={newSupplier.Supplier_ID} readOnly className="form-input readonly" />
                                        <button className="btn btn-small" onClick={generateSupplierID}>Generate</button>
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label>Category <span className="required">*</span></label>
                                    <select
                                        value={newSupplier.Category}
                                        onChange={(e) => setNewSupplier({ ...newSupplier, Category: e.target.value })}
                                        className="form-select"
                                    >
                                        <option value="">Select Category</option>
                                        <option value="Hardware">Hardware</option>
                                        <option value="Software">Software</option>
                                        <option value="Consumables">Consumables</option>
                                        <option value="All (H/S/C)">All (H/S/C)</option>
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label>Supplier Name <span className="required">*</span></label>
                                    <input type="text" className="form-input" value={newSupplier.Supplier_Name} onChange={(e) => setNewSupplier({ ...newSupplier, Supplier_Name: e.target.value })} />
                                </div>

                                <div className="form-group">
                                    <label>Address 1 <span className="required">*</span></label>
                                    <input type="text" className="form-input" value={newSupplier.Address_1} onChange={(e) => setNewSupplier({ ...newSupplier, Address_1: e.target.value })} />
                                </div>

                                <div className="form-group">
                                    <label>Address 2</label>
                                    <input type="text" className="form-input" value={newSupplier.Address_2} onChange={(e) => setNewSupplier({ ...newSupplier, Address_2: e.target.value })} />
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label>City <span className="required">*</span></label>
                                        <input type="text" className="form-input" value={newSupplier.City} onChange={(e) => setNewSupplier({ ...newSupplier, City: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label>State</label>
                                        <input type="text" className="form-input" value={newSupplier.State} onChange={(e) => setNewSupplier({ ...newSupplier, State: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label>PIN Code</label>
                                        <input type="number" className="form-input" value={newSupplier.PIN_Code} onChange={(e) => setNewSupplier({ ...newSupplier, PIN_Code: e.target.value })} />
                                    </div>
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label>POC Person</label>
                                        <input type="text" className="form-input" value={newSupplier.POC_Person} onChange={(e) => setNewSupplier({ ...newSupplier, POC_Person: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label>Phone Number</label>
                                        <input type="text" className="form-input" value={newSupplier.Phone_Number} onChange={(e) => setNewSupplier({ ...newSupplier, Phone_Number: e.target.value })} />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label>Email</label>
                                    <input type="text" className="form-input" value={newSupplier.Email} onChange={(e) => setNewSupplier({ ...newSupplier, Email: e.target.value })} />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button className="btn btn-primary" onClick={handleCreateSupplier}>Save</button>
                                <button className="btn btn-outline" onClick={() => setShowModal(false)}>Close</button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Table */}
            <div className="table-responsive">
                <table className="supplier-table">
                    <thead>
                        <tr>
                            <th style={{ width: '5%' }}>ID</th>
                            <th style={{ width: '7%' }}>Category</th>
                            <th style={{ width: '23%' }}>Name</th>
                            <th style={{ width: '8%' }}>Address 1</th>
                            <th style={{ width: '10%' }}>Address 2</th>
                            <th style={{ width: '7%' }}>City</th>
                            <th style={{ width: '7%' }}>State</th>
                            <th style={{ width: '7%' }}>PIN</th>
                            <th style={{ width: '10%' }}>POC</th>
                            <th style={{ width: '9%' }}>Phone</th>
                            <th style={{ width: '8%' }}>Email</th>
                            <th style={{ width: '7%' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {currentItems.length > 0 ? (
                            currentItems.map((s) => (
                                <tr key={s.Supplier_ID}>
                                    {editRowId === s.Supplier_ID ? (
                                        // Editing Row
                                        <>
                                            <td>{s.Supplier_ID}</td>
                                            <td>
                                                <select value={editFormData.Category} onChange={(e) => setEditFormData({ ...editFormData, Category: e.target.value })}>
                                                    <option value="Hardware">Hardware</option>
                                                    <option value="Software">Software</option>
                                                    <option value="Consumables">Consumables</option>
                                                    <option value="All (H/S/C)">All (H/S/C)</option>
                                                </select>
                                            </td>
                                            <td><input value={editFormData.Supplier_Name} onChange={(e) => setEditFormData({ ...editFormData, Supplier_Name: e.target.value })} /></td>
                                            <td><input value={editFormData.Address_1} onChange={(e) => setEditFormData({ ...editFormData, Address_1: e.target.value })} /></td>
                                            <td><input value={editFormData.Address_2} onChange={(e) => setEditFormData({ ...editFormData, Address_2: e.target.value })} /></td>
                                            <td><input value={editFormData.City} onChange={(e) => setEditFormData({ ...editFormData, City: e.target.value })} /></td>
                                            <td><input value={editFormData.State} onChange={(e) => setEditFormData({ ...editFormData, State: e.target.value })} /></td>
                                            <td><input value={editFormData.PIN_Code} onChange={(e) => setEditFormData({ ...editFormData, PIN_Code: e.target.value })} /></td>
                                            <td><input value={editFormData.POC_Person} onChange={(e) => setEditFormData({ ...editFormData, POC_Person: e.target.value })} /></td>
                                            <td><input value={editFormData.Phone_Number} onChange={(e) => setEditFormData({ ...editFormData, Phone_Number: e.target.value })} /></td>
                                            <td><input value={editFormData.Email} onChange={(e) => setEditFormData({ ...editFormData, Email: e.target.value })} /></td>
                                            <td>
                                                <div className="action-buttons">
                                                    <button className="btn-icon update" title="Update" onClick={() => handleUpdateSupplier(s.Supplier_ID)}><FontAwesomeIcon icon={faSave} /></button>
                                                    <button className="btn-icon cancel" title="Cancel" onClick={cancelEdit}><FontAwesomeIcon icon={faBan} /></button>
                                                </div>
                                            </td>
                                        </>
                                    ) : (
                                        // Viewing Row
                                        <>
                                            <td>{s.Supplier_ID}</td>
                                            <td>{s.Category}</td>
                                            <td>{s.Supplier_Name}</td>
                                            <td>{s.Address_1}</td>
                                            <td>{s.Address_2}</td>
                                            <td>{s.City}</td>
                                            <td>{s.State}</td>
                                            <td>{s.PIN_Code}</td>
                                            <td>{s.POC_Person}</td>
                                            <td>{s.Phone_Number}</td>
                                            <td>{s.Email}</td>
                                            <td>
                                                <div className="action-buttons">
                                                    <button className="btn-icon edit" title="Edit" onClick={() => startEdit(s)}><FontAwesomeIcon icon={faEdit} /></button>
                                                    <button className="btn-icon delete" title="Delete" onClick={() => handleDeleteSupplier(s.Supplier_ID)}><FontAwesomeIcon icon={faTrash} /></button>
                                                </div>
                                            </td>
                                        </>
                                    )}
                                </tr>
                            ))
                        ) : (
                            <tr><td colSpan="12" className="no-data">No data found</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            <div className="pagination">
                {Array.from({ length: totalPages }, (_, i) => (
                    <button
                        key={i}
                        onClick={() => paginate(i + 1)}
                        className={currentPage === i + 1 ? 'active' : ''}
                    >
                        {i + 1}
                    </button>
                ))}
            </div>
        </div >
    );
};

export default Suppliers;
