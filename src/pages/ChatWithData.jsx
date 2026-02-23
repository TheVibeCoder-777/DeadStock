import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faFileExcel, faSpinner, faDatabase, faCheckCircle, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';

function ChatWithData() {
    const [query, setQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState(null);

    const handleSubmit = async () => {
        if (!query.trim() || isLoading) return;

        setIsLoading(true);
        setResult(null);

        try {
            const response = await fetch('http://localhost:3001/api/chat/query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: query.trim() })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || data.message || 'Failed to process request');
            }

            if (data.success && data.excelBuffer) {
                // Trigger download
                const uint8Array = new Uint8Array(data.excelBuffer);
                const blob = new Blob([uint8Array], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `query_results_${Date.now()}.xlsx`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);

                setResult({
                    type: 'success',
                    message: `Found ${data.matchedCount} records matching your query. An Excel file has been generated and downloaded.`,
                    interpretation: data.llmInterpretation
                });
            }
        } catch (error) {
            setResult({
                type: 'error',
                message: error.message
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            handleSubmit();
        }
    };

    return (
        <div className="page-container">
            <div className="page-header">
                <h1><FontAwesomeIcon icon={faDatabase} /> Chat with Data</h1>
            </div>

            <div className="card" style={{ marginBottom: '30px' }}>
                <div className="card-header">
                    <h2><FontAwesomeIcon icon={faSearch} /> AI Database Query</h2>
                    <p style={{ fontSize: '0.9em', color: '#666', margin: '5px 0 0 0' }}>
                        Ask natural language questions about your inventory or employees, and generate Excel reports automatically. (Runs offline via Mistral 7B)
                    </p>
                </div>
                <div className="card-body">
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="e.g. Find all laptops purchased in 2023..."
                            value={query}
                            onChange={(e) => { setQuery(e.target.value); setResult(null); }}
                            onKeyPress={handleKeyPress}
                            disabled={isLoading}
                            style={{ flex: 1 }}
                        />
                        <button
                            className="btn btn-primary"
                            onClick={handleSubmit}
                            disabled={isLoading || !query.trim()}
                        >
                            {isLoading ? (
                                <><FontAwesomeIcon icon={faSpinner} spin /> Processing...</>
                            ) : (
                                <><FontAwesomeIcon icon={faSearch} /> Search</>
                            )}
                        </button>
                    </div>

                    {/* Results / Feedback Area */}
                    {result && result.type === 'success' && (
                        <div style={{
                            padding: '20px',
                            backgroundColor: '#f8fff9',
                            borderLeft: '4px solid #2ecc71',
                            borderRadius: '4px',
                            marginTop: '20px'
                        }}>
                            <h3 style={{ color: '#27ae60', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <FontAwesomeIcon icon={faCheckCircle} /> Query Successful
                            </h3>
                            <p style={{ margin: '0 0 15px 0', color: '#2c3e50' }}>{result.message}</p>

                            {result.interpretation && (
                                <div style={{ fontSize: '0.9em', color: '#666', backgroundColor: '#fff', padding: '10px', borderRadius: '4px', border: '1px solid #eee' }}>
                                    <strong style={{ display: 'block', marginBottom: '5px' }}>AI Interpretation:</strong>
                                    Searching collection: <code>{result.interpretation.collection}</code><br />
                                    Filters applied: <code>{JSON.stringify(result.interpretation.filter)}</code>
                                </div>
                            )}
                        </div>
                    )}

                    {result && result.type === 'error' && (
                        <div style={{
                            padding: '20px',
                            backgroundColor: '#fffcfc',
                            borderLeft: '4px solid #e74c3c',
                            borderRadius: '4px',
                            marginTop: '20px'
                        }}>
                            <h3 style={{ color: '#c0392b', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <FontAwesomeIcon icon={faExclamationTriangle} /> Query Error
                            </h3>
                            <p style={{ margin: 0, color: '#2c3e50' }}>{result.message}</p>
                            <p style={{ fontSize: '0.85em', color: '#7f8c8d', marginTop: '10px' }}>
                                The AI might have had trouble understanding your phrasing. Try rephrasing your question to be more specific.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default ChatWithData;
