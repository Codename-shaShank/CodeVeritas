import useAppContext from '@/hooks/useAppContext'
import { useState, useEffect } from 'react'
import useSocket from '@/hooks/useSocket'
import ACTIONS from '@/utils/actions'
import useAnalysis from '@/hooks/useAnalysis'
import useTab from '@/hooks/useTabs'
import toast from 'react-hot-toast'

function AdminSubmissions() {
  const { roomSubmissions, currentUser, roomGeneratedCodes, setRoomGeneratedCodes, mlAgentAvailable, roomQuestions, checkMlStatus } = useAppContext()
  const { socket } = useSocket()
  const { setAnalysisResult, setIsAnalyzing } = useAnalysis()
  const { setActiveTab } = useTab()
  const [selected, setSelected] = useState(null)
  const [generating, setGenerating] = useState({})
  const [analysisView, setAnalysisView] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [activeAITab, setActiveAITab] = useState('gemini')

  // helper to get question text by id
  const getQuestionText = (questionId) => {
    const q = (roomQuestions || []).find(q => q._id === questionId)
    return q?.text || 'Unknown question'
  }

  useEffect(() => {
    const handler = (payload) => {
      // payload may be analysis result or generation completion/failure
      if (payload?.type === 'generation_complete') {
        const { language, generated_codes, questionId } = payload
        // clear generating flag for this language
        setGenerating((prev) => ({ ...prev, [language]: false }))
        // add to context-generated codes
        if (typeof setRoomGeneratedCodes === 'function') {
          setRoomGeneratedCodes((prev = []) => {
            // avoid duplicates by checking both language AND questionId
            const exists = (prev || []).some((g) => g.language === language && g.questionId === questionId)
            if (exists) return prev
            return [{ language, questionId, generated_codes, generatedAt: new Date() }, ...(prev || [])]
          })
        }
        toast.success(`Generated reference for ${language}`)
        return
      }

      if (payload?.type === 'generation_queued') {
        const { language } = payload
        // queued ack from server for this requester; keep generating flag
        toast(`Generation queued for ${language}`)
        return
      }

      if (payload?.type === 'generation_failed') {
        const { language, error } = payload
        setGenerating((prev) => ({ ...prev, [language]: false }))
        toast.error(`Generation failed for ${language}: ${error || 'unknown error'}`)
        return
      }

      const { submissionId, analysis } = payload || {}
      if (analysis) {
        // show analysis in full-screen modal
        setAnalyzing(false)
        setAnalysisView(analysis)
        toast.success('Analysis complete')
      }
    }

    const errorHandler = (payload) => {
      // General error handler to reset states if something goes wrong
      setAnalyzing(false)
      // If we knew the language here we could reset generating too, but for general errors just creating safety
      toast.error(payload?.message || 'Action failed')
    }

    socket.on(ACTIONS.ANALYSIS_COMPLETE, handler)
    socket.on(ACTIONS.GENERATION_FAILED, handler)
    socket.on('error', errorHandler) // Listen for general errors

    return () => {
      socket.off(ACTIONS.ANALYSIS_COMPLETE, handler)
      socket.off(ACTIONS.GENERATION_FAILED, handler)
      socket.off('error', errorHandler)
    }
  }, [socket, setAnalysisResult, setActiveTab, setIsAnalyzing, setRoomGeneratedCodes])

  return (
    <div className="mt-4">
      {/* ML Agent Status Warning */}
      {!mlAgentAvailable && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded-md">
          <p className="text-red-400 text-sm font-semibold">⚠️ ML Agent Unavailable</p>
          <p className="text-red-300 text-xs mt-1">The AI code generation and analysis features are currently unavailable. Please check that the ML agent server is running.</p>
        </div>
      )}
      <h3 className="font-semibold mb-2">Submissions</h3>
      {roomSubmissions.length === 0 ? (
        <p className="text-sm text-gray-400">No submissions yet.</p>
      ) : (
        <div className="space-y-2">
          {roomSubmissions.map((s) => (
            <div key={s.id || s._id} className="p-2 bg-darkHover rounded flex items-center justify-between">
              <div>
                <div className="font-medium">{s.username}</div>
                <div className="text-xs text-gray-400">{s.language} • {new Date(s.createdAt).toLocaleString()}</div>
                {s.questionId && <div className="text-xs text-gray-500">Q: {getQuestionText(s.questionId)}</div>}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setSelected(s)} className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded">View</button>
                {s.status === 'analyzed' ? (
                  <button onClick={() => {
                    if (s.analysis) {
                      setAnalysisView(s.analysis);
                    } else {
                      toast.error('Analysis data not found');
                    }
                  }} className="text-sm px-2 py-1 rounded bg-green-900 text-green-200 hover:bg-green-800 border border-green-700 transition-colors">View Analysis</button>
                ) : (
                  // Only show Analyze button if codes have been GENERATED for this question & language
                  (roomGeneratedCodes || []).some(g => g.language === s.language && g.questionId === s.questionId) && (
                    <button onClick={async () => {
                      // Check health before proceeding
                      const isHealthy = await checkMlStatus()
                      if (!isHealthy) {
                        toast.error('ML Agent is unavailable');
                        return;
                      }

                      if (!currentUser?.token) return toast.error('Not authenticated')
                      setAnalyzing(true)
                      socket.emit(ACTIONS.REQUEST_ANALYSIS, { token: currentUser.token, roomId: currentUser.roomId, submissionId: s.id || s._id })
                      toast('Analysis started')
                    }} className={`text-sm px-2 py-1 rounded ${mlAgentAvailable ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-gray-600 text-gray-400 cursor-not-allowed'}`} disabled={analyzing || !mlAgentAvailable}>{analyzing ? 'Analyzing...' : 'Analyze'}</button>
                  )
                )}

                {/* Show Generate button ONLY when generated codes are missing AND not currently generating */}
                {!(roomGeneratedCodes || []).some(g => g.language === s.language && g.questionId === s.questionId) && !generating[s.language] && (
                  <button onClick={async () => {
                    // Check health before proceeding
                    const isHealthy = await checkMlStatus()
                    if (!isHealthy) {
                      toast.error('ML Agent is unavailable');
                      return;
                    }

                    if (!currentUser?.token) return toast.error('Not authenticated')
                    // set generating indicator immediately to hide button
                    setGenerating((prev) => ({ ...prev, [s.language]: true }))
                    socket.emit(ACTIONS.REQUEST_GENERATE, { token: currentUser.token, roomId: currentUser.roomId, language: s.language })
                    toast('Generation queued')
                  }} className={`text-sm px-2 py-1 rounded ${mlAgentAvailable ? 'bg-yellow-600 hover:bg-yellow-700 text-white' : 'bg-gray-600 text-gray-400 cursor-not-allowed'}`} disabled={!mlAgentAvailable}>Generate</button>
                )}
                {/* Show spinner/text if generating */}
                {generating[s.language] && (
                  <span className="text-xs text-yellow-500 animate-pulse ml-2">Generating...</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal / Drawer for viewing selected submission */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-dark w-[90%] max-w-3xl p-4 rounded">
            <div className="flex justify-between items-center mb-2">
              <div>
                <h4 className="text-lg font-semibold">Submission by {selected.username}</h4>
                <div className="text-xs text-gray-400">{selected.language} • {new Date(selected.createdAt).toLocaleString()}</div>
              </div>

              <div>
                <button onClick={() => setSelected(null)} className="text-sm bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded">Close</button>
              </div>
            </div>

            <div className="mt-2">
              <pre className="whitespace-pre-wrap text-sm bg-black/20 p-3 rounded max-h-[60vh] overflow-auto">
                {selected.code}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Full-screen Analysis Modal */}
      {analysisView && (
        <div className="fixed inset-0 z-50 flex flex-col bg-dark overflow-hidden">
          {/* Header with Go Back button */}
          <div className="bg-darkHover p-4 border-b border-gray-700 flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-white">Code Analysis</h2>
            <button
              onClick={() => {
                setAnalysisView(null)
                setActiveAITab('gemini')
              }}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded font-semibold"
            >
              Go Back
            </button>
          </div>

          {/* Analysis Content */}
          <div className="flex-1 overflow-auto p-4">
            {analyzing ? (
              <div className="flex flex-col items-center justify-center h-full">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
                <p className="text-white">Analyzing your code...</p>
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* User Code */}
                  <div className="bg-darkHover rounded-lg p-4 flex flex-col">
                    <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
                      <span className="w-3 h-3 bg-primary rounded-full mr-2"></span>
                      Your Code
                    </h3>
                    <div className="bg-dark rounded p-4 flex-grow overflow-auto h-[400px]">
                      <div className="text-sm text-gray-200 font-mono whitespace-pre-wrap">
                        {analysisView?.user_code?.split('\n').map((line, idx) => {
                          const lineNumber = idx + 1;
                          const isMatched = (analysisView?.similar_lines?.[`${activeAITab}_vs_user`] || []).some(m => m.user_line_number === lineNumber);
                          return (
                            <div key={idx} className={`flex ${isMatched ? 'bg-yellow-900/50' : ''}`}>
                              <span className="w-8 text-gray-600 select-none text-right pr-2">{lineNumber}</span>
                              <span className="flex-1">{line || ' '}</span>
                            </div>
                          );
                        })}
                        {!analysisView?.user_code && <span className="text-gray-500">No code</span>}
                      </div>
                    </div>
                  </div>

                  {/* AI Generated Code */}
                  <div className="bg-darkHover rounded-lg p-4 flex flex-col">
                    <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
                      <span className="w-3 h-3 bg-secondary rounded-full mr-2"></span>
                      {activeAITab.charAt(0).toUpperCase() + activeAITab.slice(1)} Code
                    </h3>

                    {/* AI Model Tabs */}
                    <div className="flex space-x-1 mb-4 bg-dark rounded p-1">
                      {['gemini', 'chatgpt', 'claude'].map((model) => (
                        <button
                          key={model}
                          onClick={() => setActiveAITab(model)}
                          className={`flex-1 py-2 px-3 rounded text-sm font-medium transition-all ${activeAITab === model
                            ? 'bg-primary text-black'
                            : 'text-gray-300 hover:text-white hover:bg-darkHover'
                            }`}
                        >
                          {model.charAt(0).toUpperCase() + model.slice(1)}
                        </button>
                      ))}
                    </div>

                    {/* AI Code Display */}
                    <div className="bg-dark rounded p-4 flex-grow overflow-auto h-[400px]">
                      <div className="text-sm text-gray-200 font-mono whitespace-pre-wrap">
                        {(analysisView?.generated_codes?.[activeAITab] || '').split('\n').map((line, idx) => {
                          const lineNumber = idx + 1;
                          const isMatched = (analysisView?.similar_lines?.[`${activeAITab}_vs_user`] || []).some(m => m.ai_line_number === lineNumber);
                          return (
                            <div key={idx} className={`flex ${isMatched ? 'bg-indigo-900/50' : ''}`}>
                              <span className="w-8 text-gray-600 select-none text-right pr-2">{lineNumber}</span>
                              <span className="flex-1">{line || ' '}</span>
                            </div>
                          );
                        })}
                        {!analysisView?.generated_codes?.[activeAITab] && <span className="text-gray-500">No code generated</span>}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Analysis Summary */}
                {analysisView?.comparison && (
                  <div className="bg-darkHover rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-white mb-3">Analysis Summary</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div className="bg-dark p-3 rounded">
                        <p className="text-gray-400 text-sm">Similarity Score ({activeAITab})</p>
                        <p className="text-2xl font-bold text-primary">{analysisView.comparison?.similarity_score || 'N/A'}%</p>
                      </div>
                      <div className="bg-dark p-3 rounded">
                        <p className="text-gray-400 text-sm">Matched Lines</p>
                        <p className="text-2xl font-bold text-secondary">{analysisView.comparison?.matched_lines || 0}</p>
                      </div>
                      <div className="bg-dark p-3 rounded">
                        <p className="text-gray-400 text-sm">Total Lines</p>
                        <p className="text-2xl font-bold text-gray-300">{analysisView.comparison?.total_lines || 0}</p>
                      </div>
                    </div>

                    {/* Detailed Matched Lines */}
                    {analysisView?.similar_lines && (
                      <div>
                        <h4 className="text-md font-semibold text-white mb-2">Matched Line Details ({activeAITab})</h4>
                        <div className="bg-dark p-3 rounded max-h-48 overflow-y-auto">
                          {(analysisView.similar_lines[`${activeAITab}_vs_user`] || []).length > 0 ? (
                            <div className="space-y-1">
                              {(analysisView.similar_lines[`${activeAITab}_vs_user`] || []).map((match, idx) => (
                                <div key={idx} className="text-xs text-gray-300 flex justify-between border-b border-gray-700 pb-1 last:border-0">
                                  <span>User Line {match.user_line_number}: <span className="text-gray-500 italic">"{match.line_content?.substring(0, 60)}{match.line_content?.length > 60 ? '...' : ''}"</span></span>
                                  <span className="text-secondary ml-2">matches AI Line {match.ai_line_number}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-gray-500 text-sm">No specific lines matched for this model.</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminSubmissions
