// components/AIAnalysisPanel.jsx
import React from 'react';
import { useFileContext } from '@/contexts/FileContext';

const AIAnalysisPanel = () => {
    const { highlightedLines, highlightLines, clearHighlights } = useFileContext();

    // AI analysis suggestions with different line sets
    const aiSuggestions = [
        { 
            lines: [1, 2, 3, 4, 7, 10, 11, 12, 13, 14, 15, 16, 17, 21, 22, 23, 24, 25, 26], 
            description: "🔍 All AI Suggestions",
            color: "#f59e0b"
        },
        { 
            lines: [1, 2, 3, 4], 
            description: "📝 Includes & Namespace",
            color: "#3b82f6"
        },
        { 
            lines: [10, 11, 12, 13, 14, 15, 16, 17], 
            description: "⚙️ Main Function",
            color: "#10b981"
        },
        { 
            lines: [21, 22, 23, 24, 25, 26], 
            description: "🛠️ Helper Functions",
            color: "#8b5cf6"
        }
    ];

    return (
        <div style={{
            background: 'linear-gradient(135deg, #1f2937 0%, #374151 100%)',
            color: 'white',
            padding: '20px',
            borderRadius: '12px',
            margin: '10px',
            border: '2px solid #4b5563',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
        }}>
            <h3 style={{ 
                margin: '0 0 16px 0', 
                color: '#fbbf24',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
            }}>
                <span>🤖</span>
                <span>AI Code Analysis Panel</span>
            </h3>
            
            <div style={{ 
                display: 'flex', 
                gap: '12px', 
                flexWrap: 'wrap',
                marginBottom: '16px'
            }}>
                {aiSuggestions.map((suggestion, index) => (
                    <button
                        key={index}
                        onClick={() => highlightLines(suggestion.lines)}
                        style={{
                            background: suggestion.color,
                            color: 'white',
                            border: 'none',
                            padding: '10px 16px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: 'bold',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                            transition: 'all 0.2s ease',
                            minWidth: '140px'
                        }}
                        onMouseEnter={(e) => {
                            e.target.style.transform = 'translateY(-2px)';
                            e.target.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
                        }}
                        onMouseLeave={(e) => {
                            e.target.style.transform = 'translateY(0)';
                            e.target.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
                        }}
                    >
                        {suggestion.description}
                    </button>
                ))}
                
                <button
                    onClick={clearHighlights}
                    style={{
                        background: '#ef4444',
                        color: 'white',
                        border: 'none',
                        padding: '10px 16px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: 'bold',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                    }}
                >
                    🗑️ Clear Highlights
                </button>
            </div>

            {highlightedLines.length > 0 && (
                <div style={{
                    background: 'rgba(255,255,255,0.1)',
                    padding: '12px',
                    borderRadius: '8px',
                    fontSize: '13px'
                }}>
                    <div style={{ marginBottom: '8px' }}>
                        <strong>Currently Highlighting:</strong> 
                        <span style={{ color: '#fef3c7', marginLeft: '8px' }}>
                            {highlightedLines.length} lines
                        </span>
                    </div>
                    <div style={{ 
                        fontSize: '12px', 
                        opacity: 0.9,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}>
                        <span>📍</span>
                        <span>Use navigation buttons in editor to scroll through highlights</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AIAnalysisPanel;