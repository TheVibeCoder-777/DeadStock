import React, { useState, useEffect, useMemo } from 'react';
import { formatDate } from '../utils/formatDate';
import { useParams } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faSearch, faTimes, faEdit, faTrash, faSave, faBan, faDownload, faFileExcel } from '@fortawesome/free-solid-svg-icons';

const Hardware = () => {
    const { category } = useParams();
    const urlCategory = decodeURIComponent(category);

    // --- State ---
    const [hardwareList, setHardwareList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [alert, setAlert] = useState(null);

    // Search
    const [searchCriteria, setSearchCriteria] = useState('EDP Serial Number'); // Default per requirement
    const [searchQuery, setSearchQuery] = useState('');

    // Inline Edit
    const [editRowId, setEditRowId] = useState(null);
    const [editFormData, setEditFormData] = useState({});

    // Add Item Wizard State
    const [showModal, setShowModal] = useState(false);
    const [wizardStep, setWizardStep] = useState(1);
    const [invoices, setInvoices] = useState([]);
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [selectedInvoiceItem, setSelectedInvoiceItem] = useState(null);
    const [newItemCommonData, setNewItemCommonData] = useState({
        Make: '', Capacity: '', RAM: '', OS: '', Office: '', Speed: '',
        IP: '', MAC: '', Company_Serial: '', Additional_Item: '',
        Status: 'Working', Remarks: '', AMC: 'No', AMC_Upto: '', Cost: '0'
    });

    const [selectedIds, setSelectedIds] = useState([]);
    const [showBulkAMCModal, setShowBulkAMCModal] = useState(false);
    const [bulkAMCData, setBulkAMCData] = useState({ AMC: 'Yes', AMC_Upto: '' });

    // Make dropdown config
    const [makeOptions, setMakeOptions] = useState([]);

    // Capacity label mapping based on category
    const getCapacityLabel = (category) => {
        const mapping = {
            'LAPTOP': 'Processor',
            'AIO DESKTOP': 'Processor',
            'CPU': 'Processor',
            'MONITOR': 'Screen Size',
            'UPS': 'Capacity of Battery',
            'HDD': 'Storage',
            'LASER PRINTER': 'Model Number',
            'SERVER': 'Processor',
            'PROJECTOR': 'Model Number'
        };
        return mapping[category?.toUpperCase()] || 'Capacity';
    };

    const capacityLabel = getCapacityLabel(urlCategory);

    useEffect(() => {
        fetchHardware();
        fetchInvoices();
        fetchMakeOptions();
    }, [urlCategory]);

    // --- API Calls ---
    const fetchHardware = async () => {
        setLoading(true);
        try {
            const res = await fetch(`http://localhost:3001/api/hardware?category=${encodeURIComponent(urlCategory)}`);
            const data = await res.json();
            setHardwareList(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const fetchInvoices = async () => {
        try {
            const res = await fetch('http://localhost:3001/api/invoices');
            const data = await res.json();
            setInvoices(data);
        } catch (error) {
            console.error(error);
        }
    };

    const fetchMakeOptions = async () => {
        try {
            const res = await fetch('http://localhost:3001/api/make/config');
            const data = await res.json();
            setMakeOptions(data);
        } catch (error) {
            console.error('Failed to fetch make options:', error);
        }
    };

    // --- Reactive Search (computed) ---
    const filteredList = useMemo(() => {
        let results = hardwareList;
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            if (searchCriteria === 'Supplier Name') {
                results = hardwareList.filter(item => {
                    const bill = invoices.find(inv => String(inv.Bill_Number) === String(item.Bill_Number));
                    const supplierName = bill ? String(bill.Firm_Name || '').toLowerCase() : '';
                    return supplierName.includes(query);
                });
            } else if (searchCriteria === 'EDP Serial Number') {
                results = hardwareList.filter(item => String(item.EDP_Serial || '').toLowerCase().includes(query));
            } else if (searchCriteria === 'Company Serial') {
                results = hardwareList.filter(item => String(item.Company_Serial || '').toLowerCase().includes(query));
            }
        }
        return results;
    }, [searchQuery, searchCriteria, hardwareList, invoices]);

    const handleClearSearch = () => {
        setSearchQuery('');
    };

    // --- Add Item Wizard ---
    const handleSelectInvoice = (e) => {
        const billNo = e.target.value;
        const inv = invoices.find(i => i.Bill_Number === billNo);
        setSelectedInvoice(inv);
        setSelectedInvoiceItem(null); // Reset item selection
    };

    const handleStep1Next = () => {
        if (!selectedInvoice) return showAlert('error', 'Select a Bill first');
        setWizardStep(2);
    };

    const handleStep2Next = () => {
        if (!selectedInvoiceItem) return showAlert('error', 'Select an Item to add');
        setWizardStep(3);
    };

    const handleSaveNewItems = async () => {
        if (newItemCommonData.AMC === 'Yes' && !newItemCommonData.AMC_Upto) {
            return showAlert('error', 'Please enter AMC Upto date');
        }
        setProcessing(true);
        try {
            // Prepare items
            // Quantity comes from selectedInvoiceItem.Quantity (which is string or number)
            const qty = parseInt(selectedInvoiceItem.Quantity, 10);
            const itemsToCreate = [];

            for (let i = 0; i < qty; i++) {
                itemsToCreate.push({
                    Category: urlCategory,
                    Item_Name: selectedInvoiceItem.Hardware_Item, // E.g. "LAPTOP"
                    Bill_Number: selectedInvoice.Bill_Number,
                    // Prompt says "Cost (Rs.) - INR Cost of that Assets". 
                    // Use total invoice amount for now or leave user to edit. Let's use 0 or user edit?
                    // Better: Invoice Amount is Total. We probably don't know unit cost unless calculated.
                    // Let's pass 0 and let user edit, or pass Invoice Amount.
                    // Actually, if prompted, maybe unit cost? Let's leave Cost blank or "0".
                    Cost: newItemCommonData.Cost || '0',
                    AMC: newItemCommonData.AMC,
                    AMC_Upto: newItemCommonData.AMC_Upto,
                    Warranty_Upto: selectedInvoiceItem.Warranty_Upto || '',
                    Additional_Item: newItemCommonData.Additional_Item,
                    Status: newItemCommonData.Status,
                    Remarks: newItemCommonData.Remarks,
                    Make: newItemCommonData.Make,
                    Capacity: newItemCommonData.Capacity,
                    RAM: newItemCommonData.RAM,
                    OS: newItemCommonData.OS,
                    Office: newItemCommonData.Office,
                    Speed: newItemCommonData.Speed,
                    IP: newItemCommonData.IP,
                    MAC: newItemCommonData.MAC,
                    Company_Serial: newItemCommonData.Company_Serial, // Checking if this should be unique per row? usually yes.
                    // If bulk adding, Company Serial matches? No, usually distinct. 
                    // The wizard asks for "Repeating data at once". 
                    // So we construct identical objects, and user edits unique fields later via Inline Edit.
                });
            }

            const res = await fetch('http://localhost:3001/api/hardware', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(itemsToCreate)
            });

            if (res.ok) {
                const result = await res.json();
                showAlert('success', `${result.generatedItems.length} Items Added`);
                handleCloseModal();
                fetchHardware();
            } else {
                showAlert('error', 'Failed to save');
            }
        } catch (error) {
            showAlert('error', 'Error saving hardware');
        } finally {
            setProcessing(false);
        }
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setWizardStep(1);
        setSelectedInvoice(null);
        setSelectedInvoiceItem(null);
        setNewItemCommonData({
            Make: '', Capacity: '', RAM: '', OS: '', Office: '', Speed: '',
            IP: '', MAC: '', Company_Serial: '', Additional_Item: '',
            Status: 'Working', Remarks: '', AMC: 'No', AMC_Upto: '', Cost: '0'
        });
    };

    // --- Inline Edit ---
    const startEdit = (item) => {
        setEditRowId(item.id);
        setEditFormData({ ...item });
    };

    const handleUpdate = async (id) => {
        if (editFormData.AMC === 'Yes' && !editFormData.AMC_Upto) {
            return showAlert('error', 'Please enter AMC Upto date');
        }
        setProcessing(true);
        try {
            const res = await fetch(`http://localhost:3001/api/hardware/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editFormData)
            });
            if (res.ok) {
                showAlert('success', 'Updated Successfully');
                setEditRowId(null);
                setEditFormData({});
                fetchHardware();
            } else {
                showAlert('error', 'Update failed');
            }
        } catch (error) {
            showAlert('error', 'Error updating');
        } finally {
            setProcessing(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this item?')) return;
        setProcessing(true);
        try {
            const res = await fetch(`http://localhost:3001/api/hardware/${id}`, { method: 'DELETE' });
            if (res.ok) {
                showAlert('success', 'Deleted');
                fetchHardware();
            } else {
                showAlert('error', 'Delete failed');
            }
        } catch (error) {
            showAlert('error', 'Error deleting');
        } finally {
            setProcessing(false);
        }
    };

    // --- Selection & Bulk Actions ---
    const toggleSelect = (id) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === filteredList.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filteredList.map(h => h.id));
        }
    };

    const handleBulkDelete = async () => {
        if (!window.confirm(`Are you sure you want to delete ${selectedIds.length} items?`)) return;
        setProcessing(true);
        try {
            const res = await fetch('http://localhost:3001/api/hardware/bulk-delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: selectedIds })
            });
            if (res.ok) {
                showAlert('success', 'Items deleted');
                setSelectedIds([]);
                fetchHardware();
            }
        } catch (error) {
            showAlert('error', 'Bulk delete failed');
        } finally {
            setProcessing(false);
        }
    };

    const handleBulkAMCUpdate = async () => {
        if (bulkAMCData.AMC === 'Yes' && !bulkAMCData.AMC_Upto) {
            return showAlert('error', 'Please enter AMC Upto date');
        }
        setProcessing(true);
        try {
            const res = await fetch('http://localhost:3001/api/hardware/bulk-update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ids: selectedIds,
                    updates: bulkAMCData
                })
            });
            if (res.ok) {
                showAlert('success', 'Items updated');
                setSelectedIds([]);
                setShowBulkAMCModal(false);
                fetchHardware();
            }
        } catch (error) {
            showAlert('error', 'Bulk update failed');
        } finally {
            setProcessing(false);
        }
    };

    const handleDownloadExcel = async () => {
        setProcessing(true);
        try {
            // Check if running in Electron
            if (window.electronAPI && window.electronAPI.showSaveDialog) {
                // Fetch Excel buffer from server
                const res = await fetch(`http://localhost:3001/api/hardware/download-buffer?category=${encodeURIComponent(urlCategory)}`);
                const { buffer } = await res.json();

                // Show native Save As dialog
                const result = await window.electronAPI.showSaveDialog({
                    title: 'Save Excel File',
                    defaultPath: `${urlCategory}_hardware.xlsx`,
                    filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
                });

                if (!result.canceled && result.filePath) {
                    // Write file directly to disk
                    await window.electronAPI.writeFile({
                        filePath: result.filePath,
                        buffer: buffer
                    });
                    showAlert('success', 'File saved successfully!');
                }
            } else {
                // Fallback - blob download (no blank window!)
                const response = await fetch(`http://localhost:3001/api/hardware/download?category=${encodeURIComponent(urlCategory)}`);
                if (!response.ok) throw new Error('Download failed');
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${urlCategory}_hardware.xlsx`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
                showAlert('success', 'File downloaded');
            }
        } catch (error) {
            console.error('Download error:', error);
            showAlert('error', 'Failed to download file');
        } finally {
            setProcessing(false);
        }
    };

    // --- Bulk Upload ---
    const [uploading, setUploading] = useState(false);
    const fileInputRef = React.useRef(null);

    const handleUploadClick = async () => {
        // Check if running in Electron with native dialogs
        if (window.electronAPI && window.electronAPI.showOpenDialog) {
            try {
                // Show native Windows file picker
                const result = await window.electronAPI.showOpenDialog({
                    title: 'Select Excel File for Bulk Upload',
                    filters: [{ name: 'Excel Files', extensions: ['xlsx', 'xls'] }],
                    properties: ['openFile']
                });

                if (result.canceled || !result.filePaths.length) return;

                const filePath = result.filePaths[0];
                const fileName = filePath.split('\\').pop() || filePath.split('/').pop();

                if (!window.confirm(`Upload ${fileName}? This will add items to the database.`)) return;

                setUploading(true);

                // Read file directly from disk via IPC
                const fileResult = await window.electronAPI.readFile(filePath);
                if (!fileResult.success) {
                    showAlert('error', 'Failed to read file');
                    return;
                }

                // First save to uploads dir, then process
                const saveResult = await window.electronAPI.saveFile({
                    name: `hardware_${Date.now()}_${fileName}`,
                    buffer: fileResult.data
                });

                if (!saveResult.success) {
                    showAlert('error', 'Failed to save file');
                    return;
                }

                // Tell server to process the saved file
                const res = await fetch('http://localhost:3001/api/hardware/upload', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        processOnly: true,
                        fileName: saveResult.path.split('\\').pop() || saveResult.path.split('/').pop(),
                        defaultCategory: urlCategory // Pass current category as default
                    })
                });

                const data = await res.json();
                if (res.ok) {
                    showAlert('success', data.message || 'Items Uploaded');
                    fetchHardware();
                } else {
                    showAlert('error', data.error || 'Upload failed');
                }
            } catch (error) {
                console.error('Upload error:', error);
                showAlert('error', 'Error uploading file');
            } finally {
                setUploading(false);
            }
        } else {
            // Fallback for browser/dev mode
            if (fileInputRef.current) fileInputRef.current.click();
        }
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!window.confirm(`Upload ${file.name}? This will add items to the database.`)) {
            e.target.value = null; // Reset
            return;
        }

        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('defaultCategory', urlCategory); // Pass current category as default

        try {
            const res = await fetch('http://localhost:3001/api/hardware/upload', {
                method: 'POST',
                body: formData
            });
            const result = await res.json();
            if (res.ok) {
                showAlert('success', result.message || 'Items Uploaded');
                fetchHardware();
            } else {
                showAlert('error', result.error || 'Upload failed');
            }
        } catch (error) {
            showAlert('error', 'Error uploading file');
        } finally {
            setUploading(false);
            if (e.target) e.target.value = null; // Reset input
        }
    };


    const showAlert = (type, msg) => {
        setAlert({ type, message: msg });
        setTimeout(() => setAlert(null), 3000);
    };

    // --- Render Helpers ---
    const getRowClass = (status) => {
        if (status === 'Not Working') return 'row-red';
        if (status === 'Under Repair') return 'row-orange';
        return '';
    };

    return (
        <div className="page-container">
            {processing && <div className="processing-overlay"><div className="spinner"></div><p>Processing...</p></div>}
            {alert && <div className={`alert alert-${alert.type}`}>{alert.message}</div>}

            <div className="page-header">
                <h1>{urlCategory} Assets</h1>
                <p>Manage {urlCategory} Inventory</p>
            </div>

            <div className="toolbar">
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                        <FontAwesomeIcon icon={faPlus} /> Add Item
                    </button>
                    <button className="btn btn-outline" onClick={handleUploadClick}>
                        <FontAwesomeIcon icon={faFileExcel} /> Bulk Upload
                    </button>
                    <button className="btn btn-outline" onClick={handleDownloadExcel}>
                        <FontAwesomeIcon icon={faDownload} /> Download Excel
                    </button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        accept=".xlsx, .xls"
                        onChange={handleFileChange}
                    />
                </div>

                <div className="search-bar">
                    <select className="form-select" value={searchCriteria} onChange={(e) => setSearchCriteria(e.target.value)}>
                        <option value="EDP Serial Number">EDP Serial Number</option>
                        <option value="Company Serial">Company Serial</option>
                    </select>
                    <input type="text" className="form-input" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                    <button className="btn btn-outline" onClick={handleClearSearch}><FontAwesomeIcon icon={faTimes} /> Clear</button>
                </div>
            </div>

            <div className="table-responsive">
                <table className="supplier-table">
                    <thead>
                        <tr>
                            <th><input type="checkbox" onChange={toggleSelectAll} checked={selectedIds.length === filteredList.length && filteredList.length > 0} /></th>
                            <th>Item Name</th>
                            <th>EDP Serial</th>
                            <th>Make</th>
                            <th>{capacityLabel}</th>
                            <th>RAM</th>
                            <th>OS</th>
                            <th>Office</th>
                            <th>Speed</th>
                            <th>IP</th>
                            <th>MAC</th>
                            <th>Comp Serial</th>
                            <th>Bill No</th>
                            <th>Cost</th>
                            <th>AMC</th>
                            <th>AMC Upto</th>
                            <th>Warranty Upto</th>
                            <th>Add. Item</th>
                            <th>Status</th>
                            <th>Remarks</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredList.map(item => (
                            <tr key={item.id} className={editRowId === item.id ? '' : getRowClass(item.Status)} style={editRowId === item.id ? {} : (getRowClass(item.Status) === 'row-red' ? { backgroundColor: '#ffebeb' } : (getRowClass(item.Status) === 'row-orange' ? { backgroundColor: '#fff3e0' } : {}))}>
                                <td style={{ textAlign: 'center' }}>
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.includes(item.id)}
                                        onChange={() => toggleSelect(item.id)}
                                    />
                                </td>
                                {editRowId === item.id ? (
                                    <>
                                        <td>{item.Item_Name}</td>
                                        <td>{item.EDP_Serial}</td>
                                        <td>
                                            <select value={editFormData.Make} onChange={e => setEditFormData({ ...editFormData, Make: e.target.value })} style={{ width: '80px' }}>
                                                <option value="">Select</option>
                                                {makeOptions.map(make => <option key={make} value={make}>{make}</option>)}
                                            </select>
                                        </td>
                                        <td><input type="text" value={editFormData.Capacity} onChange={e => setEditFormData({ ...editFormData, Capacity: e.target.value })} style={{ width: '60px' }} placeholder={capacityLabel} /></td>
                                        <td><input type="text" value={editFormData.RAM} onChange={e => setEditFormData({ ...editFormData, RAM: e.target.value })} style={{ width: '50px' }} /></td>
                                        <td><input type="text" value={editFormData.OS} onChange={e => setEditFormData({ ...editFormData, OS: e.target.value })} style={{ width: '50px' }} /></td>
                                        <td><input type="text" value={editFormData.Office} onChange={e => setEditFormData({ ...editFormData, Office: e.target.value })} style={{ width: '50px' }} /></td>
                                        <td><input type="text" value={editFormData.Speed} onChange={e => setEditFormData({ ...editFormData, Speed: e.target.value })} style={{ width: '50px' }} /></td>
                                        <td><input type="text" value={editFormData.IP} onChange={e => setEditFormData({ ...editFormData, IP: e.target.value })} style={{ width: '90px' }} /></td>
                                        <td><input type="text" value={editFormData.MAC} onChange={e => setEditFormData({ ...editFormData, MAC: e.target.value })} style={{ width: '110px' }} /></td>
                                        <td><input type="text" value={editFormData.Company_Serial} onChange={e => setEditFormData({ ...editFormData, Company_Serial: e.target.value })} style={{ width: '100px' }} /></td>
                                        <td>
                                            <select value={editFormData.Bill_Number} onChange={e => setEditFormData({ ...editFormData, Bill_Number: e.target.value })} style={{ width: '80px' }}>
                                                <option value="">Select</option>
                                                {invoices.map(i => <option key={i.id} value={i.Bill_Number}>{i.Bill_Number}</option>)}
                                            </select>
                                        </td>
                                        <td><input type="number" value={editFormData.Cost} onChange={e => setEditFormData({ ...editFormData, Cost: e.target.value })} style={{ width: '60px' }} /></td>
                                        <td>
                                            <select value={editFormData.AMC} onChange={e => setEditFormData({ ...editFormData, AMC: e.target.value })} style={{ width: '60px' }}>
                                                <option value="No">No</option>
                                                <option value="Yes">Yes</option>
                                            </select>
                                        </td>
                                        <td>
                                            {editFormData.AMC === 'Yes' ? (
                                                <input type="date" value={editFormData.AMC_Upto} onChange={e => setEditFormData({ ...editFormData, AMC_Upto: e.target.value })} style={{ width: '100px' }} />
                                            ) : '-'}
                                        </td>
                                        <td><input type="date" value={editFormData.Warranty_Upto || ''} onChange={e => setEditFormData({ ...editFormData, Warranty_Upto: e.target.value })} style={{ width: '100px' }} /></td>
                                        <td><input type="text" value={editFormData.Additional_Item} onChange={e => setEditFormData({ ...editFormData, Additional_Item: e.target.value })} style={{ width: '80px' }} /></td>
                                        <td>
                                            <select value={editFormData.Status} onChange={e => setEditFormData({ ...editFormData, Status: e.target.value })} style={{ width: '80px' }}>
                                                <option value="Working">Working</option>
                                                <option value="Not Working">Not Working</option>
                                                <option value="Under Repair">Under Repair</option>
                                            </select>
                                        </td>
                                        <td><input type="text" value={editFormData.Remarks} onChange={e => setEditFormData({ ...editFormData, Remarks: e.target.value })} style={{ width: '80px' }} /></td>
                                        <td>
                                            <div className="action-buttons">
                                                <button className="btn-icon update" onClick={() => handleUpdate(item.id)}><FontAwesomeIcon icon={faSave} /></button>
                                                <button className="btn-icon cancel" onClick={() => setEditRowId(null)}><FontAwesomeIcon icon={faBan} /></button>
                                            </div>
                                        </td>
                                    </>
                                ) : (
                                    <>
                                        <td>{item.Item_Name}</td>
                                        <td>{item.EDP_Serial}</td>
                                        <td>{item.Make}</td>
                                        <td>{item.Capacity}</td>
                                        <td>{item.RAM}</td>
                                        <td>{item.OS}</td>
                                        <td>{item.Office}</td>
                                        <td>{item.Speed}</td>
                                        <td>{item.IP}</td>
                                        <td>{item.MAC}</td>
                                        <td>{item.Company_Serial}</td>
                                        <td>{item.Bill_Number}</td>
                                        <td>{item.Cost}</td>
                                        <td>{item.AMC}</td>
                                        <td>{item.AMC === 'Yes' ? formatDate(item.AMC_Upto) : '-'}</td>
                                        <td>{formatDate(item.Warranty_Upto)}</td>
                                        <td>{item.Additional_Item}</td>
                                        <td>{item.Status}</td>
                                        <td>{item.Remarks}</td>
                                        <td>
                                            <div className="action-buttons">
                                                <button className="btn-icon edit" onClick={() => startEdit(item)}><FontAwesomeIcon icon={faEdit} /></button>
                                                <button className="btn-icon delete" onClick={() => handleDelete(item.id)}><FontAwesomeIcon icon={faTrash} /></button>
                                            </div>
                                        </td>
                                    </>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Add Item Wizard Modal */}
            {showModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-header"><h3>Add {urlCategory} - Step {wizardStep}</h3></div>
                        <div className="modal-body">
                            {wizardStep === 1 && (
                                <div className="form-group">
                                    <label>Select Bill Number</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="Type to search bill number..."
                                        value={selectedInvoice?.Bill_Number || ''}
                                        onChange={e => {
                                            const value = e.target.value;
                                            const inv = invoices.find(i => i.Bill_Number === value);
                                            if (inv) {
                                                handleSelectInvoice({ target: { value } });
                                            } else {
                                                setSelectedInvoice({ Bill_Number: value });
                                            }
                                        }}
                                        list="invoice-bills"
                                    />
                                    <datalist id="invoice-bills">
                                        {invoices.map(inv => (
                                            <option key={inv.id} value={inv.Bill_Number}>{inv.Bill_Number} - {inv.Firm_Name}</option>
                                        ))}
                                    </datalist>
                                    <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                                        <button className="btn btn-primary" onClick={handleStep1Next}>Next</button>
                                        <button className="btn btn-secondary" onClick={handleCloseModal}>Cancel</button>
                                    </div>
                                </div>
                            )}

                            {wizardStep === 2 && selectedInvoice && (
                                <div>
                                    <p><strong>Bill:</strong> {selectedInvoice.Bill_Number}</p>
                                    <label>Select Item to Add Stock:</label>
                                    <div className="list-group" style={{ marginTop: '10px', border: '1px solid #ddd', maxHeight: '200px', overflowY: 'auto' }}>
                                        {selectedInvoice.Items && selectedInvoice.Items.map((item, idx) => (
                                            <div
                                                key={idx}
                                                className={`list-item ${selectedInvoiceItem === item ? 'selected' : ''}`}
                                                style={{ padding: '10px', borderBottom: '1px solid #eee', cursor: 'pointer', backgroundColor: selectedInvoiceItem === item ? '#e6f7ff' : '#fff' }}
                                                onClick={() => setSelectedInvoiceItem(item)}
                                            >
                                                <strong>{item.Hardware_Item}</strong> - Qty: {item.Quantity} ({item.Item_Details})
                                            </div>
                                        ))}
                                    </div>
                                    <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                                        <button className="btn btn-outline" onClick={() => setWizardStep(1)}>Back</button>
                                        <button className="btn btn-primary" onClick={handleStep2Next}>Next</button>
                                        <button className="btn btn-secondary" onClick={handleCloseModal}>Cancel</button>
                                    </div>
                                </div>
                            )}

                            {wizardStep === 3 && selectedInvoiceItem && (
                                <div>
                                    <p>Adding <strong>{selectedInvoiceItem.Quantity}</strong> units of <strong>{selectedInvoiceItem.Hardware_Item}</strong></p>
                                    <p style={{ fontSize: '0.9em', color: '#666' }}>Enter common details for all units. You can edit unique details (like Serial No) later in the list.</p>

                                    <div className="form-row">
                                        <div className="form-group">
                                            <label>Make</label>
                                            <select className="form-select" value={newItemCommonData.Make} onChange={e => setNewItemCommonData({ ...newItemCommonData, Make: e.target.value })}>
                                                <option value="">Select Company</option>
                                                {makeOptions.map(make => <option key={make} value={make}>{make}</option>)}
                                            </select>
                                        </div>
                                        <div className="form-group"><label>{capacityLabel}</label><input type="text" className="form-input" placeholder={capacityLabel} value={newItemCommonData.Capacity} onChange={e => setNewItemCommonData({ ...newItemCommonData, Capacity: e.target.value })} /></div>
                                        <div className="form-group"><label>RAM</label><input type="text" className="form-input" value={newItemCommonData.RAM} onChange={e => setNewItemCommonData({ ...newItemCommonData, RAM: e.target.value })} /></div>
                                    </div>
                                    <div className="form-row">
                                        <div className="form-group"><label>OS</label><input type="text" className="form-input" value={newItemCommonData.OS} onChange={e => setNewItemCommonData({ ...newItemCommonData, OS: e.target.value })} /></div>
                                        <div className="form-group"><label>Office</label><input type="text" className="form-input" value={newItemCommonData.Office} onChange={e => setNewItemCommonData({ ...newItemCommonData, Office: e.target.value })} /></div>
                                        <div className="form-group"><label>Speed</label><input type="text" className="form-input" value={newItemCommonData.Speed} onChange={e => setNewItemCommonData({ ...newItemCommonData, Speed: e.target.value })} /></div>
                                    </div>
                                    <div className="form-row">
                                        <div className="form-group"><label>Cost (Rs.)</label><input type="number" className="form-input" value={newItemCommonData.Cost} onChange={e => setNewItemCommonData({ ...newItemCommonData, Cost: e.target.value })} /></div>
                                        <div className="form-group"><label>Additional Item</label><input type="text" className="form-input" value={newItemCommonData.Additional_Item} onChange={e => setNewItemCommonData({ ...newItemCommonData, Additional_Item: e.target.value })} /></div>
                                    </div>
                                    <div className="form-row">
                                        <div className="form-group"><label>AMC</label>
                                            <select className="form-select" value={newItemCommonData.AMC} onChange={e => setNewItemCommonData({ ...newItemCommonData, AMC: e.target.value })}>
                                                <option value="No">No</option>
                                                <option value="Yes">Yes</option>
                                            </select>
                                        </div>
                                        {newItemCommonData.AMC === 'Yes' && (
                                            <div className="form-group"><label>AMC Upto</label><input type="date" className="form-input" value={newItemCommonData.AMC_Upto} onChange={e => setNewItemCommonData({ ...newItemCommonData, AMC_Upto: e.target.value })} /></div>
                                        )}
                                        <div className="form-group"><label>Status</label>
                                            <select className="form-select" value={newItemCommonData.Status} onChange={e => setNewItemCommonData({ ...newItemCommonData, Status: e.target.value })}>
                                                <option value="Working">Working</option>
                                                <option value="Not Working">Not Working</option>
                                                <option value="Under Repair">Under Repair</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                                        <button className="btn btn-outline" onClick={() => setWizardStep(2)}>Back</button>
                                        <button className="btn btn-primary" onClick={handleSaveNewItems}>Save All</button>
                                        <button className="btn btn-secondary" onClick={handleCloseModal}>Cancel</button>
                                    </div>
                                </div>
                            )}

                        </div>
                    </div>
                </div>
            )}
            {/* Bulk Actions Bar */}
            {selectedIds.length > 0 && (
                <div className="bulk-action-bar" style={{
                    position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
                    backgroundColor: '#333', color: 'white', padding: '15px 30px', borderRadius: '50px',
                    display: 'flex', alignItems: 'center', gap: '20px', boxShadow: '0 4px 15px rgba(0,0,0,0.3)', zindex: 1001
                }}>
                    <span><strong>{selectedIds.length}</strong> items selected</span>
                    <button className="btn btn-small" style={{ backgroundColor: '#ff4d4d' }} onClick={handleBulkDelete}>
                        <FontAwesomeIcon icon={faTrash} /> Bulk Delete
                    </button>
                    <button className="btn btn-small" style={{ backgroundColor: '#ffd700', color: '#000' }} onClick={() => setShowBulkAMCModal(true)}>
                        Bulk Update AMC
                    </button>
                    <button className="btn-icon" style={{ color: 'white' }} onClick={() => setSelectedIds([])}><FontAwesomeIcon icon={faTimes} /></button>
                </div>
            )}

            {/* Bulk AMC Update Modal */}
            {showBulkAMCModal && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ width: '400px' }}>
                        <div className="modal-header"><h3>Bulk Update AMC</h3></div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label>AMC Status</label>
                                <select className="form-select" value={bulkAMCData.AMC} onChange={e => setBulkAMCData({ ...bulkAMCData, AMC: e.target.value })}>
                                    <option value="No">No</option>
                                    <option value="Yes">Yes</option>
                                </select>
                            </div>
                            {bulkAMCData.AMC === 'Yes' && (
                                <div className="form-group">
                                    <label>AMC Upto</label>
                                    <input type="date" className="form-input" value={bulkAMCData.AMC_Upto} onChange={e => setBulkAMCData({ ...bulkAMCData, AMC_Upto: e.target.value })} />
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowBulkAMCModal(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleBulkAMCUpdate}>Update All</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Hardware;
