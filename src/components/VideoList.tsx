import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useVideoStore } from '../hooks/useVideoStore'
import { api } from '../services/api'

const VideoList = () => {
  const [inputUrl, setInputUrl] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadMode, setUploadMode] = useState<'url' | 'file'>('url')
  const [llmProvider, setLlmProvider] = useState<'claude' | 'ollama'>('ollama')
  const [ollamaModel, setOllamaModel] = useState('')
  const [availableModels, setAvailableModels] = useState<string[]>([])
  const [loadingModels, setLoadingModels] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { videos, addVideo, uploadVideo, loading, error } = useVideoStore()

  // Fetch available Ollama models on component mount
  useEffect(() => {
    if (llmProvider === 'ollama') {
      fetchOllamaModels()
    }
  }, [llmProvider])

  const fetchOllamaModels = async () => {
    setLoadingModels(true)
    try {
      const models = await api.getOllamaModels()
      setAvailableModels(models)
      // If no model is selected yet, select the first one
      if (models.length > 0 && !ollamaModel) {
        setOllamaModel(models[0])
        api.setLLMConfig(llmProvider, models[0])
      }
    } catch (error) {
      console.error('Failed to fetch Ollama models:', error)
      setAvailableModels([])
    } finally {
      setLoadingModels(false)
    }
  }

  const handleAddVideo = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Set the LLM configuration before processing
    api.setLLMConfig(llmProvider, ollamaModel)
    
    if (uploadMode === 'url' && inputUrl.trim()) {
      try {
        await addVideo(inputUrl.trim())
        setInputUrl('')
      } catch (error) {
        // Error is already displayed by the error state
        console.error('Failed to add video:', error)
      }
    } else if (uploadMode === 'file' && selectedFile) {
      try {
        await uploadVideo(selectedFile)
        setSelectedFile(null)
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      } catch (error) {
        console.error('Failed to upload video:', error)
      }
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
    }
  }

  const extractVideoId = (url: string) => {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)
    return match ? match[1] : null
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">Video Transcription Manager</h1>
      
      {/* LLM Provider Selection */}
      <div className="mb-6 p-4 border border-gray-600 bg-gray-900">
        <h2 className="text-lg font-semibold mb-4">AI Model Configuration</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">LLM Provider</label>
            <div className="flex gap-4">
              <button
                onClick={() => {
                  setLlmProvider('claude')
                  api.setLLMConfig('claude')
                }}
                className={`px-4 py-2 border ${llmProvider === 'claude' ? 'bg-white text-black' : 'border-white text-white'} transition-colors`}
              >
                Claude (Anthropic)
              </button>
              <button
                onClick={() => {
                  setLlmProvider('ollama')
                  api.setLLMConfig('ollama', ollamaModel)
                }}
                className={`px-4 py-2 border ${llmProvider === 'ollama' ? 'bg-white text-black' : 'border-white text-white'} transition-colors`}
              >
                Ollama (Local)
              </button>
            </div>
          </div>
          
          {llmProvider === 'ollama' && (
            <div>
              <label className="block text-sm font-medium mb-2">Ollama Model</label>
              {loadingModels ? (
                <p className="text-gray-400">Loading available models...</p>
              ) : availableModels.length > 0 ? (
                <select
                  value={ollamaModel}
                  onChange={(e) => {
                    setOllamaModel(e.target.value)
                    api.setLLMConfig(llmProvider, e.target.value)
                  }}
                  className="w-full px-4 py-2 bg-black border border-white text-white focus:outline-none focus:border-gray-400"
                >
                  {availableModels.map(model => (
                    <option key={model} value={model}>{model}</option>
                  ))}
                </select>
              ) : (
                <p className="text-red-400">No Ollama models found. Make sure Ollama is running.</p>
              )}
            </div>
          )}
          
          {llmProvider === 'claude' && (
            <div className="text-sm text-gray-400">
              <p>Using Claude Sonnet 4 model</p>
              <p>Make sure ANTHROPIC_API_KEY is set in your .env file</p>
            </div>
          )}
        </div>
      </div>
      
      <div className="mb-4">
        <div className="flex gap-4 mb-4">
          <button
            onClick={() => setUploadMode('url')}
            className={`px-4 py-2 border ${uploadMode === 'url' ? 'bg-white text-black' : 'border-white text-white'} transition-colors`}
          >
            Add from URL
          </button>
          <button
            onClick={() => setUploadMode('file')}
            className={`px-4 py-2 border ${uploadMode === 'file' ? 'bg-white text-black' : 'border-white text-white'} transition-colors`}
          >
            Upload File
          </button>
        </div>
        
        <form onSubmit={handleAddVideo} className="mb-8">
          {uploadMode === 'url' ? (
            <div className="flex gap-4">
              <input
                type="text"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder="Enter YouTube, Google Drive, or direct video URL"
                className="flex-1 px-4 py-2 bg-black border border-white text-white placeholder-gray-500 focus:outline-none focus:border-gray-400"
              />
              <button
                type="submit"
                disabled={loading || !inputUrl.trim()}
                className="px-6 py-2 bg-white text-black hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Adding...' : 'Add Video'}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex gap-4 items-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".mp4,.mov,.avi,.webm,.mkv,.ogg"
                  onChange={handleFileChange}
                  className="flex-1 px-4 py-2 bg-black border border-white text-white file:mr-4 file:py-2 file:px-4 file:border-0 file:text-sm file:font-semibold file:bg-white file:text-black hover:file:bg-gray-200"
                />
                <button
                  type="submit"
                  disabled={loading || !selectedFile}
                  className="px-6 py-2 bg-white text-black hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Uploading...' : 'Upload Video'}
                </button>
              </div>
              {selectedFile && (
                <p className="text-sm text-gray-400">
                  Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              )}
            </div>
          )}
        </form>
      </div>

      {error && (
        <div className="mb-4 p-4 border border-red-500 text-red-500">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {loading && videos.length === 0 ? (
          <p className="text-gray-500">Loading videos...</p>
        ) : videos.length === 0 ? (
          <p className="text-gray-500">No videos added yet. Add a YouTube URL to get started.</p>
        ) : (
          videos.map((video) => {
            const videoId = extractVideoId(video.url)
            return (
              <Link
                key={video.id}
                to={`/video/${video.id}`}
                className="block p-4 border border-white hover:bg-gray-900 transition-colors"
              >
                <div className="flex items-center gap-4">
                  {videoId && (
                    <img
                      src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`}
                      alt={video.title}
                      className="w-32 h-20 object-cover"
                    />
                  )}
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold">{video.title}</h3>
                    <p className="text-sm text-gray-400">
                      Added: {new Date(video.addedAt).toLocaleDateString()}
                    </p>
                    <p className="text-sm text-gray-500 truncate">{video.url}</p>
                    {video.videoType && (
                      <p className="text-xs text-gray-600">
                        Type: {video.videoType}
                        {video.videoType === 'upload' && video.originalFilename && (
                          <span> • {video.originalFilename}</span>
                        )}
                      </p>
                    )}
                    {video.status && (
                      <p className="text-sm text-gray-400 mt-1">
                        Status: <span className={
                          video.status === 'completed' ? 'text-green-500' :
                          video.status === 'transcribed' ? 'text-blue-500' :
                          video.status === 'error' ? 'text-red-500' :
                          video.status === 'processing' || video.status === 'transcribing' || video.status === 'segmenting' ? 'text-yellow-500' :
                          'text-gray-500'
                        }>{video.status}</span>
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            )
          })
        )}
      </div>
    </div>
  )
}

export default VideoList
