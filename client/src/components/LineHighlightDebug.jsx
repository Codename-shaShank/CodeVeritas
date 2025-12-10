// components/LineHighlightDebug.jsx
import useFileSystem from "@/hooks/useFileSystem"

function LineHighlightDebug() {
    const { 
        highlightedLines, 
        highlightLines, 
        clearHighlights 
    } = useFileSystem()

    const testLines = [1, 2, 3, 5, 8, 13, 21]

    return (
        <div style={{ 
            position: 'fixed', 
            bottom: '10px', 
            right: '10px', 
            background: 'rgba(0,0,0,0.8)', 
            color: 'white', 
            padding: '10px', 
            borderRadius: '5px',
            zIndex: 1000,
            fontSize: '12px'
        }}>
            <div>🎯 Debug: {highlightedLines.length} lines highlighted</div>
            <div style={{ marginTop: '5px' }}>
                <button 
                    onClick={() => highlightLines(testLines)}
                    style={{ marginRight: '5px', padding: '2px 5px' }}
                >
                    Test Highlight
                </button>
                <button 
                    onClick={clearHighlights}
                    style={{ padding: '2px 5px' }}
                >
                    Clear
                </button>
            </div>
            {highlightedLines.length > 0 && (
                <div style={{ marginTop: '5px', fontSize: '10px' }}>
                    Lines: {highlightedLines.join(', ')}
                </div>
            )}
        </div>
    )
}

export default LineHighlightDebug