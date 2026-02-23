import React, { useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faFolderOpen,
    faClock,
    faDownload,
    faCheckCircle,
    faTimesCircle,
    faSpinner,
    faToggleOn,
    faToggleOff,
    faShieldAlt
} from '@fortawesome/free-solid-svg-icons';

const Backup = () => {
    const [backupFolder, setBackupFolder] = useState('');
    const [backupTime, setBackupTime] = useState('14:00');
    const [autoBackupEnabled, setAutoBackupEnabled] = useState(false);
    const [lastBackup, setLastBackup] = useState(null);
    const [processing, setProcessing] = useState(false);
    const [alert, setAlert] = useState(null);
    const [backupHistory, setBackupHistory] = useState([]);
    const intervalRef = useRef(null);

    // Load saved settings from localStorage
    useEffect(() => {
        const saved = JSON.parse(localStorage.getItem('backupSettings') || '{}');
        if (saved.folder) setBackupFolder(saved.folder);
        if (saved.time) setBackupTime(saved.time);
        if (saved.autoEnabled) setAutoBackupEnabled(saved.autoEnabled);
        if (saved.lastBackup) setLastBackup(saved.lastBackup);
        if (saved.history) setBackupHistory(saved.history);
    }, []);

    // Save settings to localStorage whenever they change
    useEffect(() => {
        localStorage.setItem('backupSettings', JSON.stringify({
            folder: backupFolder,
            time: backupTime,
            autoEnabled: autoBackupEnabled,
            lastBackup,
            history: backupHistory.slice(0, 10) // Keep last 10
        }));
    }, [backupFolder, backupTime, autoBackupEnabled, lastBackup, backupHistory]);

    // Auto-backup scheduler
    useEffect(() => {
        if (intervalRef.current) clearInterval(intervalRef.current);

        if (autoBackupEnabled && backupFolder) {
            intervalRef.current = setInterval(() => {
                const now = new Date();
                const [hours, minutes] = backupTime.split(':').map(Number);
                if (now.getHours() === hours && now.getMinutes() === minutes) {
                    runBackup(true);
                }
            }, 60000); // Check every minute
        }

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [autoBackupEnabled, backupFolder, backupTime]);

    const showAlert = (type, msg) => {
        setAlert({ type, message: msg });
        setTimeout(() => setAlert(null), 5000);
    };

    const handleSelectFolder = async () => {
        try {
            if (window.electronAPI && window.electronAPI.showOpenDialog) {
                const result = await window.electronAPI.showOpenDialog({
                    title: 'Select Backup Folder',
                    properties: ['openDirectory']
                });
                if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
                    setBackupFolder(result.filePaths[0]);
                    showAlert('success', `Folder selected: ${result.filePaths[0]}`);
                }
            } else {
                showAlert('error', 'Folder picker is only available in the desktop app.');
            }
        } catch (error) {
            showAlert('error', 'Failed to open folder picker');
        }
    };

    const runBackup = async (isAuto = false) => {
        if (!backupFolder) {
            showAlert('error', 'Please select a backup folder first');
            return;
        }
        setProcessing(true);
        try {
            const res = await fetch('http://localhost:3001/api/backup/full');
            const data = await res.json();

            if (!data.buffer) throw new Error('No backup data received');

            const now = new Date();
            const timestamp = now.toISOString().slice(0, 16).replace(/[T:]/g, '-');
            const fileName = `DeadStock_Backup_${timestamp}.xlsx`;
            const filePath = `${backupFolder}\\${fileName}`;

            if (window.electronAPI && window.electronAPI.writeFile) {
                // Decode base64 to byte array for Electron's writeFile handler
                const byteChars = atob(data.buffer);
                const byteArray = new Array(byteChars.length);
                for (let i = 0; i < byteChars.length; i++) {
                    byteArray[i] = byteChars.charCodeAt(i);
                }

                await window.electronAPI.writeFile({
                    filePath: filePath,
                    buffer: byteArray
                });

                const backupRecord = {
                    date: now.toLocaleString(),
                    path: filePath,
                    sheets: data.sheets,
                    auto: isAuto
                };

                setLastBackup(backupRecord);
                setBackupHistory(prev => [backupRecord, ...prev].slice(0, 10));
                showAlert('success', `${isAuto ? 'Auto-backup' : 'Backup'} saved: ${fileName}`);
            } else {
                // Browser fallback - download directly
                const byteChars = atob(data.buffer);
                const byteNumbers = new Array(byteChars.length);
                for (let i = 0; i < byteChars.length; i++) {
                    byteNumbers[i] = byteChars.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                URL.revokeObjectURL(url);
                document.body.removeChild(a);

                const backupRecord = {
                    date: now.toLocaleString(),
                    path: 'Downloaded via browser',
                    sheets: data.sheets,
                    auto: false
                };
                setLastBackup(backupRecord);
                setBackupHistory(prev => [backupRecord, ...prev].slice(0, 10));
                showAlert('success', `Backup downloaded: ${fileName}`);
            }
        } catch (error) {
            console.error('Backup error:', error);
            showAlert('error', 'Backup failed: ' + error.message);
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div className="page-container">
            {processing && <div className="processing-overlay"><div className="spinner"></div><p>Generating backup...</p></div>}
            {alert && <div className={`alert alert-${alert.type}`}>{alert.message}</div>}

            <div className="page-header">
                <h1><FontAwesomeIcon icon={faShieldAlt} style={{ marginRight: '10px' }} />Backup & Restore</h1>
                <p>Schedule and manage automated data backups</p>
            </div>

            {/* Backup Settings Card */}
            <div className="card" style={{ padding: '25px', marginBottom: '20px' }}>
                <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <FontAwesomeIcon icon={faFolderOpen} style={{ color: 'teal' }} />
                    Backup Location
                </h3>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                        type="text"
                        className="form-input"
                        value={backupFolder}
                        readOnly
                        placeholder="No folder selected..."
                        style={{ flex: 1, minWidth: '300px', backgroundColor: '#f5f5f5', cursor: 'pointer' }}
                        onClick={handleSelectFolder}
                    />
                    <button className="btn btn-primary" onClick={handleSelectFolder}>
                        <FontAwesomeIcon icon={faFolderOpen} /> Browse...
                    </button>
                </div>
            </div>

            {/* Schedule Card */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                <div className="card" style={{ padding: '25px' }}>
                    <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <FontAwesomeIcon icon={faClock} style={{ color: 'teal' }} />
                        Schedule
                    </h3>
                    <div className="form-group" style={{ marginBottom: '20px' }}>
                        <label style={{ fontWeight: 600, marginBottom: '8px', display: 'block' }}>Daily Backup Time</label>
                        <input
                            type="time"
                            className="form-input"
                            value={backupTime}
                            onChange={e => setBackupTime(e.target.value)}
                            style={{ width: '200px' }}
                        />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <span style={{ fontWeight: 600 }}>Auto-Backup:</span>
                        <button
                            className={`btn ${autoBackupEnabled ? 'btn-primary' : 'btn-outline'}`}
                            onClick={() => setAutoBackupEnabled(!autoBackupEnabled)}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '120px' }}
                        >
                            <FontAwesomeIcon icon={autoBackupEnabled ? faToggleOn : faToggleOff} style={{ fontSize: '1.2em' }} />
                            {autoBackupEnabled ? 'Enabled' : 'Disabled'}
                        </button>
                    </div>
                    {autoBackupEnabled && !backupFolder && (
                        <p style={{ color: '#e65100', marginTop: '10px', fontSize: '0.85em' }}>
                            ⚠ Please select a backup folder to enable auto-backup
                        </p>
                    )}
                    {autoBackupEnabled && backupFolder && (
                        <p style={{ color: 'teal', marginTop: '10px', fontSize: '0.85em' }}>
                            ✓ Auto-backup will run daily at {backupTime}
                        </p>
                    )}
                </div>

                {/* Manual Backup Card */}
                <div className="card" style={{ padding: '25px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
                    <h3 style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <FontAwesomeIcon icon={faDownload} style={{ color: 'teal' }} />
                        Manual Backup
                    </h3>
                    <p style={{ marginBottom: '20px', color: '#666', fontSize: '0.9em' }}>
                        Generate an Excel file with all your data right now
                    </p>
                    <button
                        className="btn btn-primary"
                        onClick={() => runBackup(false)}
                        disabled={processing}
                        style={{ padding: '12px 30px', fontSize: '1em' }}
                    >
                        {processing ? (
                            <><FontAwesomeIcon icon={faSpinner} spin /> Generating...</>
                        ) : (
                            <><FontAwesomeIcon icon={faDownload} /> Backup Now</>
                        )}
                    </button>
                    <p style={{ marginTop: '12px', fontSize: '0.8em', color: '#999' }}>
                        Includes: Suppliers, Invoices, Hardware, Employees, Software, E-Waste, Allocations
                    </p>
                </div>
            </div>

            {/* Last Backup Status */}
            {lastBackup && (
                <div className="card" style={{ padding: '20px', marginBottom: '20px', borderLeft: '4px solid teal' }}>
                    <h3 style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <FontAwesomeIcon icon={faCheckCircle} style={{ color: 'teal' }} />
                        Last Backup
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.9em' }}>
                        <div><strong>Date:</strong> {lastBackup.date}</div>
                        <div><strong>Type:</strong> {lastBackup.auto ? 'Automatic' : 'Manual'}</div>
                        <div style={{ gridColumn: '1 / -1' }}><strong>Location:</strong> {lastBackup.path}</div>
                        <div style={{ gridColumn: '1 / -1' }}>
                            <strong>Data Sheets:</strong> {lastBackup.sheets?.join(', ') || 'N/A'}
                        </div>
                    </div>
                </div>
            )}

            {/* Backup History */}
            {backupHistory.length > 0 && (
                <div className="card" style={{ padding: '20px' }}>
                    <h3 style={{ marginBottom: '15px' }}>Backup History</h3>
                    <div className="table-responsive">
                        <table className="supplier-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Type</th>
                                    <th>Location</th>
                                    <th>Sheets</th>
                                </tr>
                            </thead>
                            <tbody>
                                {backupHistory.map((record, i) => (
                                    <tr key={i}>
                                        <td>{record.date}</td>
                                        <td>
                                            <span style={{
                                                padding: '2px 8px',
                                                borderRadius: '4px',
                                                fontSize: '0.85em',
                                                backgroundColor: record.auto ? '#e3f2fd' : '#e8f5e9',
                                                color: record.auto ? '#1565c0' : '#2e7d32'
                                            }}>
                                                {record.auto ? 'Auto' : 'Manual'}
                                            </span>
                                        </td>
                                        <td style={{ fontSize: '0.85em', maxWidth: '400px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {record.path}
                                        </td>
                                        <td style={{ fontSize: '0.85em' }}>{record.sheets?.length || 0} sheets</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Backup;
