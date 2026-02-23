import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faSync, faTachometerAlt, faExclamationTriangle, faBox, faUser, faFileAlt } from '@fortawesome/free-solid-svg-icons';
import { formatDate } from '../utils/formatDate';

const Dashboard = () => {
    const [nocQuery, setNocQuery] = useState('');
    const [nocResult, setNocResult] = useState(null);
    const [nocLoading, setNocLoading] = useState(false);
    const [nocSearched, setNocSearched] = useState(false);

    const [retirementSuggestions, setRetirementSuggestions] = useState({ withHardware: [], withoutHardware: [] });
    const [suggestionsLoading, setSuggestionsLoading] = useState(false);

    const [stockData, setStockData] = useState({ items: [], totalCount: 0 });
    const [stockLoading, setStockLoading] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    const [bifurcationData, setBifurcationData] = useState(null);

    const [alert, setAlert] = useState(null);

    const showAlert = (type, msg) => {
        setAlert({ type, message: msg });
        setTimeout(() => setAlert(null), 3000);
    };

    // Load retirement suggestions and stock data on mount
    useEffect(() => {
        fetchRetirementSuggestions();
        fetchStockData();
    }, []);

    // NOC Search
    const handleNocSearch = async () => {
        if (!nocQuery.trim()) {
            setNocResult(null);
            setNocSearched(false);
            return;
        }

        setNocLoading(true);
        setNocSearched(true);
        try {
            const res = await fetch(`http://localhost:3001/api/dashboard/noc-search?query=${encodeURIComponent(nocQuery)}`);
            const data = await res.json();
            setNocResult(data);
        } catch (error) {
            console.error('NOC search error:', error);
            showAlert('error', 'Failed to search NOC data');
        } finally {
            setNocLoading(false);
        }
    };

    // Trigger search on Enter key
    const handleNocKeyPress = (e) => {
        if (e.key === 'Enter') {
            handleNocSearch();
        }
    };

    // Fetch Retirement Suggestions
    const fetchRetirementSuggestions = async () => {
        setSuggestionsLoading(true);
        try {
            const res = await fetch('http://localhost:3001/api/dashboard/retirement-suggestions');
            const data = await res.json();
            setRetirementSuggestions(data);
        } catch (error) {
            console.error('Suggestions error:', error);
            showAlert('error', 'Failed to fetch retirement suggestions');
        } finally {
            setSuggestionsLoading(false);
        }
    };

    // Fetch Stock Data
    const fetchStockData = async () => {
        setStockLoading(true);
        try {
            const res = await fetch('http://localhost:3001/api/dashboard/stock-count');
            const data = await res.json();
            setStockData(data);
        } catch (error) {
            console.error('Stock data error:', error);
            showAlert('error', 'Failed to fetch stock data');
        } finally {
            setStockLoading(false);
        }
    };

    // Fetch Bifurcation for specific item
    const handleTileClick = async (itemName) => {
        setSelectedItem(itemName);
        try {
            const res = await fetch(`http://localhost:3001/api/dashboard/stock-count?item=${encodeURIComponent(itemName)}`);
            const data = await res.json();
            setBifurcationData(data);
        } catch (error) {
            console.error('Bifurcation error:', error);
            showAlert('error', 'Failed to fetch item details');
        }
    };

    // Move to Stock action
    const handleMoveToStock = async (hardwareId) => {
        try {
            const res = await fetch('http://localhost:3001/api/hardware/allocate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: hardwareId,
                    PIN: 'STOCK',
                    Issued_Date: new Date().toISOString().split('T')[0]
                })
            });

            if (res.ok) {
                showAlert('success', 'Hardware moved to stock successfully');
                fetchRetirementSuggestions();
            } else {
                showAlert('error', 'Failed to move hardware to stock');
            }
        } catch (error) {
            showAlert('error', 'Error updating hardware');
        }
    };

    // Delete Employee
    const handleDeleteEmployee = async (employeeId) => {
        console.log('handleDeleteEmployee called with ID:', employeeId);

        if (!confirm('Are you sure you want to delete this employee?')) {
            console.log('Delete cancelled by user');
            return;
        }

        console.log('Confirmation accepted, sending DELETE request...');

        try {
            const url = `http://localhost:3001/api/employees/${employeeId}`;
            console.log('DELETE URL:', url);

            const res = await fetch(url, {
                method: 'DELETE'
            });

            console.log('Response status:', res.status);
            console.log('Response ok:', res.ok);

            if (res.ok) {
                const data = await res.json();
                console.log('Success response:', data);
                showAlert('success', 'Employee deleted successfully');
                fetchRetirementSuggestions();
            } else {
                const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
                console.error('Error response:', errorData);
                console.error('Error response (stringified):', JSON.stringify(errorData, null, 2));
                showAlert('error', 'Failed to delete employee');
            }
        } catch (error) {
            console.error('Fetch error:', error);
            showAlert('error', 'Error deleting employee');
        }
    };

    return (
        <div className="page-container">
            {alert && <div className={`alert alert-${alert.type}`}>{alert.message}</div>}

            <div className="page-header">
                <h1><FontAwesomeIcon icon={faTachometerAlt} /> Dashboard</h1>
            </div>

            {/* Stock Info Tiles */}
            <div className="card" style={{ marginBottom: '30px' }}>
                <div className="card-header">
                    <h2><FontAwesomeIcon icon={faBox} /> Stock Information</h2>
                    <button className="btn btn-outline" onClick={fetchStockData} style={{ marginLeft: 'auto' }}>
                        <FontAwesomeIcon icon={faSync} /> Refresh
                    </button>
                </div>
                <div className="card-body">
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '20px', marginBottom: '20px' }}>
                        {/* Total Count Tile */}
                        <div className="stock-tile" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', padding: '20px', borderRadius: '8px', textAlign: 'center', cursor: 'default' }}>
                            <div style={{ fontSize: '2em', fontWeight: 'bold' }}>{stockData.totalCount || 0}</div>
                            <div style={{ fontSize: '0.9em', marginTop: '5px' }}>Total Items in Stock</div>
                        </div>

                        {/* Item Tiles */}
                        {stockData.items.map((item, idx) => (
                            <div
                                key={idx}
                                className="stock-tile"
                                onClick={() => handleTileClick(item.Item_Name)}
                                style={{
                                    background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                                    color: 'white',
                                    padding: '20px',
                                    borderRadius: '8px',
                                    textAlign: 'center',
                                    cursor: 'pointer',
                                    transition: 'transform 0.2s, box-shadow 0.2s',
                                    boxShadow: selectedItem === item.Item_Name ? '0 8px 16px rgba(0,0,0,0.3)' : '0 4px 8px rgba(0,0,0,0.1)'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-5px)'}
                                onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                            >
                                <div style={{ fontSize: '2em', fontWeight: 'bold' }}>{item.Count}</div>
                                <div style={{ fontSize: '0.9em', marginTop: '5px' }}>{item.Item_Name}</div>
                            </div>
                        ))}
                    </div>

                    {/* Bifurcation Modal/View */}
                    {bifurcationData && (
                        <div style={{ marginTop: '30px', padding: '20px', background: '#f8f9fa', borderRadius: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                                <h3 style={{ margin: 0, color: '#2c3e50' }}>{bifurcationData.item} - Detailed List ({bifurcationData.items.length} items)</h3>
                                <button className="btn btn-secondary" onClick={() => setBifurcationData(null)}>Close</button>
                            </div>
                            <div className="table-responsive">
                                <table className="supplier-table">
                                    <thead>
                                        <tr>
                                            <th>EDP Serial</th>
                                            <th>Make</th>
                                            <th>Capacity</th>
                                            <th>RAM</th>
                                            <th>Bill Number</th>
                                            <th>Purchase Date</th>
                                            <th>Cost</th>
                                            <th>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {bifurcationData.items.map((item, idx) => (
                                            <tr key={idx}>
                                                <td>{item.EDP_Serial}</td>
                                                <td>{item.Make || '-'}</td>
                                                <td>{item.Capacity || '-'}</td>
                                                <td>{item.RAM || '-'}</td>
                                                <td>{item.Bill_Number || '-'}</td>
                                                <td>{formatDate(item.Date_of_Purchase)}</td>
                                                <td>{item.Cost || '-'}</td>
                                                <td>{item.Status || '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* NOC Search Section */}
            <div className="card" style={{ marginBottom: '30px' }}>
                <div className="card-header">
                    <h2><FontAwesomeIcon icon={faFileAlt} /> NOC (No Objection Certificate)</h2>
                    <p style={{ fontSize: '0.9em', color: '#666', margin: '5px 0 0 0' }}>Search employee by PIN or Name to view details and issued hardware</p>
                </div>
                <div className="card-body">
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="Search by PIN or Name..."
                            value={nocQuery}
                            onChange={(e) => { setNocQuery(e.target.value); setNocSearched(false); setNocResult(null); }}
                            onKeyPress={handleNocKeyPress}
                            style={{ flex: 1 }}
                        />
                        <button className="btn btn-primary" onClick={handleNocSearch} disabled={nocLoading}>
                            <FontAwesomeIcon icon={faSearch} /> {nocLoading ? 'Searching...' : 'Search'}
                        </button>
                    </div>

                    {nocResult && nocResult.employees && nocResult.employees.length > 0 && (
                        <div>
                            <p style={{ marginBottom: '15px', color: '#27ae60', fontWeight: 'bold' }}>
                                Found {nocResult.employees.length} employee(s)
                            </p>
                            {nocResult.employees.map((result, empIdx) => (
                                <div key={empIdx} style={{
                                    marginBottom: '30px',
                                    paddingBottom: nocResult.employees.length > 1 && empIdx < nocResult.employees.length - 1 ? '25px' : '0',
                                    borderBottom: nocResult.employees.length > 1 && empIdx < nocResult.employees.length - 1 ? '2px solid #e0e0e0' : 'none'
                                }}>
                                    {/* Employee Details */}
                                    <h3 style={{ marginBottom: '15px', color: '#2c3e50' }}>
                                        Employee {nocResult.employees.length > 1 ? `#${empIdx + 1}` : ''} Details
                                    </h3>
                                    <table className="supplier-table" style={{ marginBottom: '30px' }}>
                                        <thead>
                                            <tr>
                                                <th>PIN</th>
                                                <th>Name</th>
                                                <th>Present Post</th>
                                                <th>Section</th>
                                                <th>Office</th>
                                                <th>Hqr/Field</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr>
                                                <td>{result.employee.PIN}</td>
                                                <td>{result.employee.Name}</td>
                                                <td>{result.employee.Present_Post || '-'}</td>
                                                <td>{result.employee.Section || '-'}</td>
                                                <td>{result.employee.Office || '-'}</td>
                                                <td>{result.employee.Hqr_Field || '-'}</td>
                                            </tr>
                                        </tbody>
                                    </table>

                                    {/* Hardware List */}
                                    <h3 style={{ marginBottom: '15px', color: '#2c3e50' }}>Issued Hardware</h3>
                                    {result.hardware.length > 0 ? (
                                        <div className="table-responsive">
                                            <table className="supplier-table">
                                                <thead>
                                                    <tr>
                                                        <th>Item Name</th>
                                                        <th>EDP Serial</th>
                                                        <th>Issued Date</th>
                                                        <th>Make</th>
                                                        <th>Company Serial</th>
                                                        <th>Bill No</th>
                                                        <th>Purchased</th>
                                                        <th>Cost</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {result.hardware.map((hw, idx) => (
                                                        <tr key={idx}>
                                                            <td>{hw.Item_Name}</td>
                                                            <td>{hw.EDP_Serial}</td>
                                                            <td>{formatDate(hw.Issued_Date)}</td>
                                                            <td>{hw.Make || '-'}</td>
                                                            <td>{hw.Company_Serial || '-'}</td>
                                                            <td>{hw.Bill_Number || '-'}</td>
                                                            <td>{formatDate(hw.Date_of_Purchase)}</td>
                                                            <td>{hw.Cost || '-'}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : (
                                        <p style={{ color: '#666', fontStyle: 'italic' }}>No hardware issued to this employee</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {nocSearched && nocResult && nocResult.employees && nocResult.employees.length === 0 && (
                        <p style={{ color: '#666', textAlign: 'center', padding: '20px' }}>No employee found</p>
                    )}
                </div>
            </div>

            {/* Retirement Suggestions Section */}
            <div className="card" style={{ marginBottom: '30px' }}>
                <div className="card-header">
                    <h2><FontAwesomeIcon icon={faExclamationTriangle} /> Retirement Suggestions</h2>
                    <button className="btn btn-outline" onClick={fetchRetirementSuggestions} style={{ marginLeft: 'auto' }}>
                        <FontAwesomeIcon icon={faSync} /> Refresh
                    </button>
                </div>
                <div className="card-body">
                    {/* Retired with Hardware */}
                    <div style={{ marginBottom: '30px' }}>
                        <h3 style={{ marginBottom: '15px', color: '#e74c3c' }}>
                            <FontAwesomeIcon icon={faExclamationTriangle} /> Retired Employees with Hardware ({retirementSuggestions.withHardware.length})
                        </h3>
                        {retirementSuggestions.withHardware.length > 0 ? (
                            <div className="table-responsive">
                                <table className="supplier-table">
                                    <thead>
                                        <tr>
                                            <th>Item Name</th>
                                            <th>EDP Serial</th>
                                            <th>PIN</th>
                                            <th>Name</th>
                                            <th>Retirement Date</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {retirementSuggestions.withHardware.map((item, idx) => (
                                            <tr key={idx}>
                                                <td>{item.Item_Name}</td>
                                                <td>{item.EDP_Serial}</td>
                                                <td>{item.PIN}</td>
                                                <td>{item.Name}</td>
                                                <td>{formatDate(item.Retirement_Date)}</td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: '5px' }}>
                                                        <button
                                                            className="btn btn-sm btn-primary"
                                                            onClick={() => handleMoveToStock(item.hardware_id)}
                                                            title="Move to Stock"
                                                        >
                                                            Move to Stock
                                                        </button>
                                                        <button
                                                            className="btn btn-sm btn-outline"
                                                            onClick={() => window.location.href = '/permanent-allocation'}
                                                            title="Transfer to Permanent Allocation"
                                                        >
                                                            Transfer
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <p style={{ color: '#27ae60', fontStyle: 'italic' }}>✓ No retired employees with hardware</p>
                        )}
                    </div>

                    {/* Retired without Hardware */}
                    <div>
                        <h3 style={{ marginBottom: '15px', color: '#f39c12' }}>
                            <FontAwesomeIcon icon={faUser} /> Retired Employees without Hardware ({retirementSuggestions.withoutHardware.length})
                        </h3>
                        {retirementSuggestions.withoutHardware.length > 0 ? (
                            <div className="table-responsive">
                                <table className="supplier-table">
                                    <thead>
                                        <tr>
                                            <th>PIN</th>
                                            <th>Name</th>
                                            <th>Present Post</th>
                                            <th>Retirement Date</th>
                                            <th>Suggestion</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {retirementSuggestions.withoutHardware.map((emp, idx) => (
                                            <tr key={idx}>
                                                <td>{emp.PIN}</td>
                                                <td>{emp.Name}</td>
                                                <td>{emp.Present_Post || '-'}</td>
                                                <td>{formatDate(emp.Retirement_Date)}</td>
                                                <td style={{ color: '#e67e22' }}>Consider deleting from Employee Directory</td>
                                                <td>
                                                    <button
                                                        className="btn btn-sm btn-danger"
                                                        onClick={() => handleDeleteEmployee(emp.employee_id)}
                                                    >
                                                        Delete Employee
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <p style={{ color: '#27ae60', fontStyle: 'italic' }}>✓ No retired employees without hardware</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
