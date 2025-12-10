// components/LineHighlightTest.jsx
import { useFileContext } from '@/contexts/FileContext';
import "../../index.css";

function LineHighlightTest() {
    const { 
        highlightedLines, 
        highlightLines, 
        addLineHighlight, 
        removeLineHighlight, 
        clearHighlights 
    } = useFileContext();

    return (
        <div style={{ 
            padding: '15px', 
            background: '#f8f9fa', 
            border: '2px solid #dee2e6',
            margin: '10px',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#495057' }}>🧪 Line Highlight Test</h3>
            
            <div style={{ 
                marginBottom: '15px', 
                padding: '10px',
                background: 'white',
                borderRadius: '5px',
                border: '1px solid #ced4da'
            }}>
                <strong>Currently Highlighted Lines:</strong> 
                <span style={{ 
                    marginLeft: '10px', 
                    color: highlightedLines.length > 0 ? '#28a745' : '#6c757d',
                    fontWeight: 'bold',
                    fontFamily: 'monospace'
                }}>
                    {highlightedLines.length > 0 ? highlightedLines.join(', ') : 'None'}
                </span>
            </div>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '15px' }}>
                <button 
                    onClick={() => highlightLines([1, 2, 3])}
                    style={{ 
                        padding: '8px 16px',
                        background: '#007bff',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}
                >
                    🔥 Lines 1, 2, 3
                </button>
                
                <button 
                    onClick={() => highlightLines([4, 5, 6])}
                    style={{ 
                        padding: '8px 16px',
                        background: '#28a745',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}
                >
                    🌿 Lines 4, 5, 6
                </button>
                
                <button 
                    onClick={() => highlightLines([2, 3])}
                    style={{ 
                        padding: '8px 16px',
                        background: '#6f42c1',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}
                >
                    💜 Lines 2, 3
                </button>
                
                <button 
                    onClick={clearHighlights}
                    style={{ 
                        padding: '8px 16px',
                        background: '#dc3545',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}
                >
                    🗑️ Clear All
                </button>
            </div>

            <div style={{ 
                padding: '10px',
                background: '#e9ecef',
                borderRadius: '5px',
                fontSize: '12px',
                color: '#495057'
            }}>
                <strong>📋 Test Instructions:</strong>
                <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
                    <li>Click buttons to highlight specific lines</li>
                    <li>Lines should turn <strong style={{color: '#fbc02d'}}>yellow</strong> with left border</li>
                    <li>Check browser console for debug info</li>
                    <li>Look for the debug panel in top-right corner</li>
                </ul>
            </div>
        </div>
    );
}

export default LineHighlightTest;