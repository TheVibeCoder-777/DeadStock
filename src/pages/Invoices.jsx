import React, { useState, useEffect, useRef, useMemo } from 'react';
import { formatDate } from '../utils/formatDate';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faSearch, faTimes, faEdit, faTrash, faSave, faBan, faFileExcel, faDownload, faFilePdf, faChevronDown, faChevronUp, faCheck } from '@fortawesome/free-solid-svg-icons';

const Invoices = () => {
    // --- State ---
    const [invoices, setInvoices] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [alert, setAlert] = useState(null);

    // Search
    const [searchCriteria, setSearchCriteria] = useState('Supplier Name');
    const [searchQuery, setSearchQuery] = useState('');

    // Pagination (Basic)
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 25;

    // Expanded Rows (Set of IDs)
    const [expandedRowIds, setExpandedRowIds] = useState(new Set());

    // Inline Edit (Master)
    const [editRowId, setEditRowId] = useState(null);
    const [editFormData, setEditFormData] = useState({});
    const [editFile, setEditFile] = useState(null);

    // Item Management State
    const [addingItemToInvoiceId, setAddingItemToInvoiceId] = useState(null); // ID of invoice where we are adding an item
    const [newItemForList, setNewItemForList] = useState({ // Form data for adding item to list
        Hardware_Item: '', Quantity: 1, Warranty: '', Warranty_Upto: '', Item_Details: '', OEM_Software: ''
    });

    // Inline Edit (Item)
    const [editingItemKey, setEditingItemKey] = useState(null); // Composite key: `${invoiceId}-${itemIndex}`
    const [editItemFormData, setEditItemFormData] = useState({});

    // Modal State (New Invoice)
    const [showModal, setShowModal] = useState(false);
    const [newInvoice, setNewInvoice] = useState({
        Bill_Number: '', Firm_Name: '', Date: '', Amount: '', Category: 'Hardware', Items: []
    });

    // New Item State (within Modal)
    const [newItem, setNewItem] = useState({ // Form data for Modal
        Hardware_Item: '', Quantity: 1, Warranty: '', Warranty_Upto: '', Item_Details: '', OEM_Software: ''
    });

    const fileInputRef = useRef(null); // For Master Excel Upload (if needed later)
    const bulkUploadRef = useRef(null); // For Bulk Invoice Upload
    const [selectedFile, setSelectedFile] = useState(null); // For New Invoice PDF

    // Options
    const [hardwareOptions, setHardwareOptions] = useState([]);

    useEffect(() => {
        fetchInvoices();
        fetchSuppliers();
        fetchHardwareCategories();
    }, []);

    // --- API Calls ---
    const fetchInvoices = async () => {
        try {
            const res = await fetch('http://localhost:3001/api/invoices');
            const data = await res.json();
            setInvoices(data);
        } catch (error) {
            console.error(error);
        }
    };

    const fetchSuppliers = async () => {
        try {
            const res = await fetch('http://localhost:3001/api/suppliers');
            const data = await res.json();
            setSuppliers(data);
        } catch (error) {
            console.error(error);
        }
    };

    const fetchHardwareCategories = async () => {
        try {
            const res = await fetch('http://localhost:3001/api/hardware/config');
            const data = await res.json();
            const categories = data.map(item => item.category);
            setHardwareOptions(categories);
        } catch (error) {
            console.error('Error fetching hardware categories:', error);
        }
    };

    // --- Helper for Base64 ---
    const toBase64 = file => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });

    // --- Master Invoice Actions ---
    const handleCreateInvoice = async () => {
        if (!newInvoice.Bill_Number || !newInvoice.Firm_Name || !newInvoice.Date || !newInvoice.Amount) {
            showAlert('error', 'Please fill all required Balance fields');
            return;
        }

        setProcessing(true);
        try {
            let fileData = null;
            let fileName = null;
            if (selectedFile) {
                fileData = await toBase64(selectedFile);
                fileName = selectedFile.name;
            }

            const payload = {
                data: newInvoice,
                fileData: fileData,
                fileName: fileName
            };

            const res = await fetch('http://localhost:3001/api/invoices', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                showAlert('success', 'Invoice Added');
                setShowModal(false);
                setNewInvoice({ Bill_Number: '', Firm_Name: '', Date: '', Amount: '', Category: 'Hardware', Items: [] });
                setSelectedFile(null);
                fetchInvoices();
            } else {
                const err = await res.json();
                showAlert('error', err.error || 'Failed to add invoice');
            }
        } catch (error) {
            showAlert('error', 'Error adding invoice');
        } finally {
            setProcessing(false);
        }
    };

    const handleUpdateInvoiceMaster = async (id) => {
        setProcessing(true);
        try {
            // Find current invoice to preserve items
            const currentInv = invoices.find(i => i.id === id);
            const updatedData = { ...editFormData, Items: currentInv.Items };

            let fileData = null;
            let fileName = null;
            if (editFile) {
                fileData = await toBase64(editFile);
                fileName = editFile.name;
            }

            const payload = {
                data: updatedData,
                fileData: fileData,
                fileName: fileName
            };

            const res = await fetch(`http://localhost:3001/api/invoices/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                showAlert('success', 'Invoice Updated');
                setEditRowId(null);
                setEditFormData({});
                setEditFile(null);
                fetchInvoices();
            } else {
                showAlert('error', 'Failed to update invoice');
            }
        } catch (error) {
            showAlert('error', 'Error updating invoice');
        } finally {
            setProcessing(false);
        }
    };

    const handleDeleteInvoice = async (id) => {
        if (!window.confirm('Are you sure you want to delete this invoice?')) return;
        setProcessing(true);
        try {
            const res = await fetch(`http://localhost:3001/api/invoices/${id}`, { method: 'DELETE' });
            if (res.ok) {
                showAlert('success', 'Invoice Deleted');
                fetchInvoices();
            } else {
                showAlert('error', 'Failed to delete');
            }
        } catch (error) {
            showAlert('error', 'Error deleting invoice');
        } finally {
            setProcessing(false);
        }
    };

    // --- Item Level Actions (Directly on List) ---
    const updateInvoiceItems = async (invoiceId, newItems) => {
        setProcessing(true);
        try {
            const currentInv = invoices.find(i => i.id === invoiceId);
            const updatedData = { ...currentInv, Items: newItems };

            // FIX: Use JSON payload instead of FormData to prevent server errors
            const payload = {
                data: updatedData,
                // fileData: null, // No file change
                // fileName: null
            };

            const res = await fetch(`http://localhost:3001/api/invoices/${invoiceId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                fetchInvoices();
                return true;
            } else {
                const err = await res.json();
                console.error("Update failed:", err);
                showAlert('error', 'Failed to update items: ' + (err.error || 'Server Error'));
                return false;
            }
        } catch (error) {
            console.error("Network error:", error);
            showAlert('error', 'Error updating items');
            return false;
        } finally {
            setProcessing(false);
        }
    };

    const handleAddItemToList = async (invoiceId) => {
        if (!newItemForList.Hardware_Item || !newItemForList.Quantity) {
            showAlert('error', 'Item Name and Quantity required');
            return;
        }
        const currentInv = invoices.find(i => i.id === invoiceId);
        const newItems = [...(currentInv.Items || []), newItemForList];
        const success = await updateInvoiceItems(invoiceId, newItems);
        if (success) {
            showAlert('success', 'Item Added');
            setNewItemForList({ Hardware_Item: '', Quantity: 1, Warranty: '', Warranty_Upto: '', Item_Details: '', OEM_Software: '' });
            setAddingItemToInvoiceId(null); // Close dialog after save
        }
    };

    const handleUpdateItemInList = async (invoiceId, itemIndex) => {
        const currentInv = invoices.find(i => i.id === invoiceId);
        const newItems = [...currentInv.Items];
        newItems[itemIndex] = editItemFormData;
        const success = await updateInvoiceItems(invoiceId, newItems);
        if (success) {
            showAlert('success', 'Item Updated');
            setEditingItemKey(null);
            setEditItemFormData({});
        }
    };

    const handleDeleteItemFromList = async (invoiceId, itemIndex) => {
        if (!window.confirm('Delete this item?')) return;
        const currentInv = invoices.find(i => i.id === invoiceId);
        const newItems = [...currentInv.Items];
        newItems.splice(itemIndex, 1);
        const success = await updateInvoiceItems(invoiceId, newItems);
        if (success) showAlert('success', 'Item Deleted');
    };

    const handleExcelDownload = async () => {
        setProcessing(true);
        try {
            const response = await fetch('http://localhost:3001/api/invoices/download');
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'invoices.xlsx';
                document.body.appendChild(a);
                a.click();
                a.remove();
                showAlert('success', 'File downloaded');
            } else {
                showAlert('error', 'Download failed');
            }
        } catch (error) {
            showAlert('error', 'Error downloading file');
        } finally {
            setProcessing(false);
        }
    };

    const handleBulkUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setProcessing(true);
        try {
            // Check if Electron API is available
            if (window.electronAPI && window.electronAPI.saveFile) {
                // Electron mode: Use IPC to save file first
                const arrayBuffer = await file.arrayBuffer();
                const saveResult = await window.electronAPI.saveFile({
                    name: `invoices_${Date.now()}_${file.name}`,
                    buffer: Array.from(new Uint8Array(arrayBuffer))
                });

                if (!saveResult.success) {
                    throw new Error(saveResult.error || 'Failed to save file locally');
                }

                // Tell server to process the saved file
                const savedFileName = saveResult.path.split('\\').pop() || saveResult.path.split('/').pop();
                const res = await fetch('http://localhost:3001/api/invoices/upload', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        fileName: savedFileName,
                        processOnly: true
                    })
                });

                const result = await res.json();
                if (res.ok) {
                    showAlert('success', result.message || 'Upload complete');
                    fetchInvoices();
                } else {
                    showAlert('error', result.error || 'Upload failed');
                }
            } else {
                // Browser fallback: Use base64 encoding
                const reader = new FileReader();
                reader.onload = async (event) => {
                    try {
                        const res = await fetch('http://localhost:3001/api/invoices/upload', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ fileData: event.target.result })
                        });
                        const result = await res.json();
                        if (res.ok) {
                            showAlert('success', result.message || 'Upload complete');
                            fetchInvoices();
                        } else {
                            showAlert('error', result.error || 'Upload failed');
                        }
                    } catch (err) {
                        showAlert('error', 'Upload error');
                    } finally {
                        setProcessing(false);
                    }
                };
                reader.readAsDataURL(file);
                return; // Exit early, processing state handled in reader callback
            }
        } catch (error) {
            console.error('Upload error:', error);
            showAlert('error', `Upload failed: ${error.message}`);
        } finally {
            setProcessing(false);
            e.target.value = null;
        }
    };

    // --- Computed Search (instant) ---
    const filteredInvoices = useMemo(() => {
        if (!searchQuery) return invoices;
        const query = searchQuery.toLowerCase();
        return invoices.filter(inv => {
            if (searchCriteria === 'Supplier Name') {
                return String(inv.Firm_Name || '').toLowerCase().includes(query);
            } else {
                return String(inv.Bill_Number || '').toLowerCase().includes(query);
            }
        });
    }, [searchQuery, searchCriteria, invoices]);

    const handleClearSearch = () => {
        setSearchQuery('');
        setSearchCriteria('Supplier Name');
    };

    // --- Helpers ---
    const addItemToInvoiceModal = () => {
        if (!newItem.Hardware_Item || !newItem.Quantity) {
            showAlert('error', 'Item Name and Quantity required');
            return;
        }
        setNewInvoice({ ...newInvoice, Items: [...newInvoice.Items, newItem] });
        setNewItem({ Hardware_Item: '', Quantity: 1, Warranty: '', Warranty_Upto: '', Item_Details: '', OEM_Software: '' });
    };

    const removeItemFromInvoiceModal = (index) => {
        const updatedItems = [...newInvoice.Items];
        updatedItems.splice(index, 1);
        setNewInvoice({ ...newInvoice, Items: updatedItems });
    };

    const showAlert = (type, msg) => {
        setAlert({ type, message: msg });
        setTimeout(() => setAlert(null), 3000);
    };

    const startEditMaster = (inv) => {
        setEditRowId(inv.id);
        const { Items, ...masterData } = inv; // Clone to avoid direct mutation issues?
        setEditFormData({ ...inv }); // Edit everything
        setEditFile(null);
    };

    const toggleRow = (id) => {
        const newSet = new Set(expandedRowIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setExpandedRowIds(newSet);
    };

    const startEditItem = (invoiceId, item, index) => {
        setEditingItemKey(`${invoiceId}-${index}`);
        setEditItemFormData({ ...item });
    };

    // --- Render ---
    const currentItems = filteredInvoices; // Add pagination later if needed

    return (
        <div className="page-container">
            {processing && <div className="processing-overlay"><div className="spinner"></div><p>Processing...</p></div>}
            {alert && <div className={`alert alert-${alert.type}`}>{alert.message}</div>}

            <div className="page-header">
                <h1>Invoices</h1>
                <p>Manage Purchase Invoices</p>
            </div>

            <div className="toolbar">
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                        <FontAwesomeIcon icon={faPlus} /> New Invoice
                    </button>
                    <button className="btn btn-outline" onClick={() => bulkUploadRef.current.click()}>
                        <FontAwesomeIcon icon={faFileExcel} /> Bulk Upload
                    </button>
                    <button className="btn btn-outline" onClick={handleExcelDownload}>
                        <FontAwesomeIcon icon={faDownload} /> Download Excel
                    </button>
                    <input
                        type="file"
                        ref={bulkUploadRef}
                        style={{ display: 'none' }}
                        accept=".xlsx, .xls"
                        onChange={handleBulkUpload}
                    />
                </div>

                <div className="search-bar">
                    <select className="form-select" value={searchCriteria} onChange={(e) => setSearchCriteria(e.target.value)}>
                        <option value="Supplier Name">Supplier Name</option>
                        <option value="Bill Number">Bill Number</option>
                    </select>
                    <input type="text" className="form-input" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                    <button className="btn btn-outline" onClick={handleClearSearch}><FontAwesomeIcon icon={faTimes} /> Clear</button>
                </div>
            </div>

            <div className="table-responsive">
                <table className="supplier-table">
                    <thead>
                        <tr>
                            <th style={{ width: '3%' }}></th>
                            <th>Serial No</th>
                            <th>Bill No</th>
                            <th>Firm Name</th>
                            <th>Date</th>
                            <th>Amount</th>
                            <th>Category</th>
                            <th>PDF</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredInvoices.length > 0 ? filteredInvoices.map(inv => (
                            <React.Fragment key={inv.id}>
                                <tr className={expandedRowIds.has(inv.id) ? 'expanded-row-parent' : ''}>
                                    {editRowId === inv.id ? (
                                        <>
                                            <td></td>
                                            <td>{inv.Serial_Number}</td>
                                            <td><input type="text" value={editFormData.Bill_Number} onChange={(e) => setEditFormData({ ...editFormData, Bill_Number: e.target.value })} style={{ width: '100%' }} /></td>
                                            <td>
                                                <input
                                                    type="text"
                                                    list="suppliers-edit-datalist"
                                                    value={editFormData.Firm_Name}
                                                    onChange={(e) => setEditFormData({ ...editFormData, Firm_Name: e.target.value })}
                                                    style={{ width: '100%' }}
                                                />
                                                <datalist id="suppliers-edit-datalist">
                                                    {suppliers.map(s => <option key={s.Supplier_ID} value={s.Supplier_Name} />)}
                                                </datalist>
                                            </td>
                                            <td><input type="date" value={editFormData.Date} onChange={(e) => setEditFormData({ ...editFormData, Date: e.target.value })} style={{ width: '100%' }} /></td>
                                            <td><input type="number" value={editFormData.Amount} onChange={(e) => setEditFormData({ ...editFormData, Amount: e.target.value })} style={{ width: '100%' }} /></td>
                                            <td>
                                                <select value={editFormData.Category} onChange={(e) => setEditFormData({ ...editFormData, Category: e.target.value })}>
                                                    <option value="Hardware">Hardware</option>
                                                    <option value="Software">Software</option>
                                                </select>
                                            </td>
                                            <td><input type="file" onChange={(e) => setEditFile(e.target.files[0])} style={{ width: '120px' }} /></td>
                                            <td>
                                                <div className="action-buttons">
                                                    <button className="btn-icon update" title="Update" onClick={() => handleUpdateInvoiceMaster(inv.id)}><FontAwesomeIcon icon={faSave} /></button>
                                                    <button className="btn-icon cancel" title="Cancel" onClick={() => setEditRowId(null)}><FontAwesomeIcon icon={faBan} /></button>
                                                </div>
                                            </td>
                                        </>
                                    ) : (
                                        <>
                                            <td onClick={() => toggleRow(inv.id)} style={{ cursor: 'pointer', textAlign: 'center' }}>
                                                <FontAwesomeIcon icon={expandedRowIds.has(inv.id) ? faChevronUp : faChevronDown} />
                                            </td>
                                            <td>{inv.Serial_Number}</td>
                                            <td>{inv.Bill_Number}</td>
                                            <td>{inv.Firm_Name}</td>
                                            <td>{formatDate(inv.Date)}</td>
                                            <td>{inv.Amount}</td>
                                            <td>{inv.Category}</td>
                                            <td>
                                                {inv.Bill_PDF ?
                                                    <a href={`http://localhost:3001/uploads/${inv.Bill_PDF}`} target="_blank" rel="noreferrer">
                                                        <FontAwesomeIcon icon={faFilePdf} style={{ color: 'red' }} />
                                                    </a>
                                                    : '-'}
                                            </td>
                                            <td>
                                                <div className="action-buttons">
                                                    <button className="btn-icon edit" title="Edit" onClick={() => startEditMaster(inv)}><FontAwesomeIcon icon={faEdit} /></button>
                                                    <button className="btn-icon delete" title="Delete" onClick={() => handleDeleteInvoice(inv.id)}><FontAwesomeIcon icon={faTrash} /></button>
                                                </div>
                                            </td>
                                        </>
                                    )}
                                </tr>
                                {/* Expanded Details */}
                                {expandedRowIds.has(inv.id) && (
                                    <tr className="expanded-row-details">
                                        <td colSpan="9" style={{ backgroundColor: '#f9f9f9', padding: '15px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                                <strong>Items for Invoice {inv.Bill_Number}</strong>
                                                {addingItemToInvoiceId !== inv.id && (
                                                    <button className="btn btn-small" onClick={() => setAddingItemToInvoiceId(inv.id)}><FontAwesomeIcon icon={faPlus} /> Add New Item</button>
                                                )}
                                            </div>

                                            {/* Add Item Form (Inline) */}
                                            {addingItemToInvoiceId === inv.id && (
                                                <div className="inline-add-item-form">
                                                    <div className="inline-form-row">
                                                        <div className="form-group-inline" style={{ flex: 1.5 }}>
                                                            <label>Product</label>
                                                            <select className="form-select" value={newItemForList.Hardware_Item} onChange={(e) => setNewItemForList({ ...newItemForList, Hardware_Item: e.target.value })}>
                                                                <option value="">Select</option>
                                                                {hardwareOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                                            </select>
                                                        </div>
                                                        <div className="form-group-inline" style={{ width: '80px' }}>
                                                            <label>Qty</label>
                                                            <input type="number" className="form-input" value={newItemForList.Quantity} onChange={(e) => setNewItemForList({ ...newItemForList, Quantity: e.target.value })} />
                                                        </div>
                                                        <div className="form-group-inline" style={{ width: '120px' }}>
                                                            <label>Warranty</label>
                                                            <select className="form-select" value={newItemForList.Warranty} onChange={(e) => setNewItemForList({ ...newItemForList, Warranty: e.target.value })}>
                                                                <option value="">Select</option>
                                                                <option value="1 Year">1 Year</option>
                                                                <option value="2 Years">2 Years</option>
                                                                <option value="3 Years">3 Years</option>
                                                                <option value="4 Years">4 Years</option>
                                                                <option value="5 Years">5 Years</option>
                                                                <option value="6 Years">6 Years</option>
                                                            </select>
                                                        </div>
                                                        <div className="form-group-inline" style={{ width: '140px' }}>
                                                            <label>Warranty Upto</label>
                                                            <input type="date" className="form-input" value={newItemForList.Warranty_Upto} onChange={(e) => setNewItemForList({ ...newItemForList, Warranty_Upto: e.target.value })} />
                                                        </div>
                                                        <div className="form-group-inline" style={{ flex: 2 }}>
                                                            <label>Details</label>
                                                            <input type="text" className="form-input" value={newItemForList.Item_Details} onChange={(e) => setNewItemForList({ ...newItemForList, Item_Details: e.target.value })} />
                                                        </div>
                                                        <div className="form-group-inline" style={{ flex: 1 }}>
                                                            <label>OEM</label>
                                                            <input type="text" className="form-input" value={newItemForList.OEM_Software} onChange={(e) => setNewItemForList({ ...newItemForList, OEM_Software: e.target.value })} />
                                                        </div>
                                                        <div className="action-buttons" style={{ paddingBottom: '2px' }}>
                                                            <button className="btn-icon update" title="Save Item" onClick={() => handleAddItemToList(inv.id)}><FontAwesomeIcon icon={faCheck} /></button>
                                                            <button className="btn-icon cancel" title="Cancel" onClick={() => setAddingItemToInvoiceId(null)}><FontAwesomeIcon icon={faTimes} /></button>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {inv.Items && inv.Items.length > 0 ? (
                                                <table className="items-table" style={{ width: '100%', marginTop: '5px', borderCollapse: 'collapse' }}>
                                                    <thead>
                                                        <tr style={{ backgroundColor: '#e0e0e0' }}>
                                                            <th style={{ padding: '8px', border: '1px solid #ddd' }}>Product</th>
                                                            <th style={{ padding: '8px', border: '1px solid #ddd' }}>Qty</th>
                                                            <th style={{ padding: '8px', border: '1px solid #ddd' }}>Warranty</th>
                                                            <th style={{ padding: '8px', border: '1px solid #ddd' }}>Warranty Upto</th>
                                                            <th style={{ padding: '8px', border: '1px solid #ddd' }}>Details</th>
                                                            <th style={{ padding: '8px', border: '1px solid #ddd' }}>OEM Software</th>
                                                            <th style={{ padding: '8px', border: '1px solid #ddd' }}>Actions</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {inv.Items.map((item, idx) => {
                                                            const itemKey = `${inv.id}-${idx}`;
                                                            return (
                                                                <tr key={idx} style={{ backgroundColor: '#fff' }}>
                                                                    {editingItemKey === itemKey ? (
                                                                        <>
                                                                            <td>
                                                                                <select value={editItemFormData.Hardware_Item} onChange={(e) => setEditItemFormData({ ...editItemFormData, Hardware_Item: e.target.value })}>
                                                                                    {hardwareOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                                                                </select>
                                                                            </td>
                                                                            <td><input type="number" style={{ width: '50px' }} value={editItemFormData.Quantity} onChange={(e) => setEditItemFormData({ ...editItemFormData, Quantity: e.target.value })} /></td>
                                                                            <td>
                                                                                <select value={editItemFormData.Warranty} onChange={(e) => setEditItemFormData({ ...editItemFormData, Warranty: e.target.value })} style={{ width: '100px', padding: '4px' }}>
                                                                                    <option value="">Select</option>
                                                                                    <option value="1 Year">1 Year</option>
                                                                                    <option value="2 Years">2 Years</option>
                                                                                    <option value="3 Years">3 Years</option>
                                                                                    <option value="4 Years">4 Years</option>
                                                                                    <option value="5 Years">5 Years</option>
                                                                                    <option value="6 Years">6 Years</option>
                                                                                </select>
                                                                            </td>
                                                                            <td><input type="date" value={editItemFormData.Warranty_Upto} onChange={(e) => setEditItemFormData({ ...editItemFormData, Warranty_Upto: e.target.value })} /></td>
                                                                            <td><input type="text" value={editItemFormData.Item_Details} onChange={(e) => setEditItemFormData({ ...editItemFormData, Item_Details: e.target.value })} /></td>
                                                                            <td><input type="text" value={editItemFormData.OEM_Software} onChange={(e) => setEditItemFormData({ ...editItemFormData, OEM_Software: e.target.value })} /></td>
                                                                            <td>
                                                                                <div className="action-buttons">
                                                                                    <button className="btn-icon update" onClick={() => handleUpdateItemInList(inv.id, idx)}><FontAwesomeIcon icon={faSave} /></button>
                                                                                    <button className="btn-icon cancel" onClick={() => setEditingItemKey(null)}><FontAwesomeIcon icon={faBan} /></button>
                                                                                </div>
                                                                            </td>
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <td style={{ padding: '8px', border: '1px solid #ddd' }}>{item.Hardware_Item}</td>
                                                                            <td style={{ padding: '8px', border: '1px solid #ddd' }}>{item.Quantity}</td>
                                                                            <td style={{ padding: '8px', border: '1px solid #ddd' }}>{item.Warranty}</td>
                                                                            <td style={{ padding: '8px', border: '1px solid #ddd' }}>{formatDate(item.Warranty_Upto)}</td>
                                                                            <td style={{ padding: '8px', border: '1px solid #ddd' }}>{item.Item_Details}</td>
                                                                            <td style={{ padding: '8px', border: '1px solid #ddd' }}>{item.OEM_Software}</td>
                                                                            <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                                                                                <div className="action-buttons">
                                                                                    <button className="btn-icon edit" onClick={() => startEditItem(inv.id, item, idx)}><FontAwesomeIcon icon={faEdit} /></button>
                                                                                    <button className="btn-icon delete" onClick={() => handleDeleteItemFromList(inv.id, idx)}><FontAwesomeIcon icon={faTrash} /></button>
                                                                                </div>
                                                                            </td>
                                                                        </>
                                                                    )}
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            ) : <p style={{ fontStyle: 'italic', color: '#666' }}>No items saved for this invoice.</p>}
                                        </td>
                                    </tr>
                                )}
                            </React.Fragment>
                        )) : (
                            <tr><td colSpan="9" className="no-data">No Data Found</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal - New Invoice */}
            {showModal && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: '960px' }}>
                        <div className="modal-header"><h3>New Invoice</h3></div>
                        <div className="modal-body">
                            {/* Master Form */}
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Bill Number <span className="required">*</span></label>
                                    <input type="text" className="form-input" value={newInvoice.Bill_Number} onChange={(e) => setNewInvoice({ ...newInvoice, Bill_Number: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label>Firm Name <span className="required">*</span></label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        list="suppliers-datalist"
                                        value={newInvoice.Firm_Name}
                                        onChange={(e) => setNewInvoice({ ...newInvoice, Firm_Name: e.target.value })}
                                        placeholder="Search or select supplier"
                                    />
                                    <datalist id="suppliers-datalist">
                                        {suppliers.map(s => <option key={s.Supplier_ID} value={s.Supplier_Name} />)}
                                    </datalist>
                                </div>
                                <div className="form-group">
                                    <label>Date <span className="required">*</span></label>
                                    <input type="date" className="form-input" value={newInvoice.Date} onChange={(e) => setNewInvoice({ ...newInvoice, Date: e.target.value })} />
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Amount (INR) <span className="required">*</span></label>
                                    <input type="number" className="form-input" value={newInvoice.Amount} onChange={(e) => setNewInvoice({ ...newInvoice, Amount: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label>Category <span className="required">*</span></label>
                                    <select className="form-select" value={newInvoice.Category} onChange={(e) => setNewInvoice({ ...newInvoice, Category: e.target.value })}>
                                        <option value="Hardware">Hardware</option>
                                        <option value="Software">Software</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Bill PDF</label>
                                    <input type="file" className="form-input" onChange={(e) => setSelectedFile(e.target.files[0])} accept="application/pdf" />
                                </div>
                            </div>

                            <hr style={{ margin: '15px 0', border: '0', borderTop: '1px solid #ddd' }} />

                            {/* Items Sub-Form (Modal) */}
                            <h4>Invoice Items</h4>
                            <div className="form-row" style={{ alignItems: 'end' }}>
                                <div className="form-group">
                                    <label>Item</label>
                                    <select className="form-select" value={newItem.Hardware_Item} onChange={(e) => setNewItem({ ...newItem, Hardware_Item: e.target.value })}>
                                        <option value="">Select Item</option>
                                        {hardwareOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                    </select>
                                </div>
                                <div className="form-group" style={{ width: '80px' }}>
                                    <label>Qty</label>
                                    <input type="number" className="form-input" value={newItem.Quantity} onChange={(e) => setNewItem({ ...newItem, Quantity: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label>Warranty</label>
                                    <select className="form-select" value={newItem.Warranty} onChange={(e) => setNewItem({ ...newItem, Warranty: e.target.value })}>
                                        <option value="">Select</option>
                                        <option value="1 Year">1 Year</option>
                                        <option value="2 Years">2 Years</option>
                                        <option value="3 Years">3 Years</option>
                                        <option value="4 Years">4 Years</option>
                                        <option value="5 Years">5 Years</option>
                                        <option value="6 Years">6 Years</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Warranty Upto</label>
                                    <input type="date" className="form-input" value={newItem.Warranty_Upto} onChange={(e) => setNewItem({ ...newItem, Warranty_Upto: e.target.value })} />
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group" style={{ flex: 2 }}>
                                    <label>Details / Specs</label>
                                    <input type="text" className="form-input" placeholder="Short text & specs" value={newItem.Item_Details} onChange={(e) => setNewItem({ ...newItem, Item_Details: e.target.value })} />
                                </div>
                                <div className="form-group" style={{ flex: 1 }}>
                                    <label>OEM Software</label>
                                    <input type="text" className="form-input" placeholder="Win 11 / Office 365" value={newItem.OEM_Software} onChange={(e) => setNewItem({ ...newItem, OEM_Software: e.target.value })} />
                                </div>
                                <div className="form-group" style={{ marginTop: '24px' }}>
                                    <button className="btn btn-secondary" onClick={addItemToInvoiceModal} type="button">
                                        <FontAwesomeIcon icon={faPlus} /> Add Item
                                    </button>
                                </div>
                            </div>

                            {/* Added Items List (Modal) */}
                            {newInvoice.Items.length > 0 && (
                                <table className="supplier-table" style={{ marginTop: '10px' }}>
                                    <thead><tr><th>Item</th><th>Qty</th><th>Warranty</th><th>Details</th><th>OEM</th><th>Action</th></tr></thead>
                                    <tbody>
                                        {newInvoice.Items.map((item, idx) => (
                                            <tr key={idx}>
                                                <td>{item.Hardware_Item}</td>
                                                <td>{item.Quantity}</td>
                                                <td>{item.Warranty}</td>
                                                <td>{item.Item_Details}</td>
                                                <td>{item.OEM_Software}</td>
                                                <td><button className="btn-icon delete" onClick={() => removeItemFromInvoiceModal(idx)}><FontAwesomeIcon icon={faTrash} /></button></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}

                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-primary" onClick={handleCreateInvoice}>Save Invoice</button>
                            <button className="btn btn-outline" onClick={() => setShowModal(false)}>Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Invoices;
