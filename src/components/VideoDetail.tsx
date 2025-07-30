import { useParams, Link } from 'react-router-dom'
import { useVideoStore } from '../hooks/useVideoStore'
import { useEffect, useState } from 'react'
import { Video } from '../types/Video'
import { api } from '../services/api'

const VideoDetail = () => {
  const { id } = useParams<{ id: string }>()
  const { getVideo, fetchVideo } = useVideoStore()
  const [video, setVideo] = useState<Video | null>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    const loadVideo = async () => {
      if (!id) return
      
      setLoading(true)
      try {
        // Try to get from local state first
        const localVideo = getVideo(id)
        if (localVideo) {
          setVideo(localVideo)
        }
        
        // Fetch fresh data from server
        const freshVideo = await fetchVideo(id)
        setVideo(freshVideo)
      } catch (error) {
        console.error('Error loading video:', error)
      } finally {
        setLoading(false)
      }
    }
    
    loadVideo()
  }, [id, getVideo, fetchVideo])

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Link to="/" className="text-gray-400 hover:text-white mb-4 inline-block">
          ← Back to list
        </Link>
        <p>Loading...</p>
      </div>
    )
  }

  if (!video) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Link to="/" className="text-gray-400 hover:text-white mb-4 inline-block">
          ← Back to list
        </Link>
        <p>Video not found</p>
      </div>
    )
  }

  const extractVideoId = (url: string) => {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)
    return match ? match[1] : null
  }

  const videoId = extractVideoId(video.url)

  const handleProcess = async () => {
    if (!id) return
    
    setProcessing(true)
    try {
      const processedVideo = await api.processVideo(id)
      setVideo(processedVideo)
    } catch (error) {
      console.error('Error processing video:', error)
      alert(error instanceof Error ? error.message : 'Failed to process video')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <Link to="/" className="text-gray-400 hover:text-white mb-4 inline-block">
        ← Back to list
      </Link>
      
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">{video.title}</h1>
        {!video.transcript && (
          <button
            onClick={handleProcess}
            disabled={processing || video.status === 'processing'}
            className="px-6 py-2 bg-white text-black hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {processing || video.status === 'processing' ? 'Processing...' : 'Process Video'}
          </button>
        )}
      </div>

      {video.status === 'error' && video.error && (
        <div className="mb-4 p-4 border border-red-500 text-red-500">
          Error: {video.error}
        </div>
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <h2 className="text-xl font-semibold mb-4">Video</h2>
          {videoId ? (
            <div className="aspect-video">
              <iframe
                width="100%"
                height="100%"
                src={`https://www.youtube.com/embed/${videoId}`}
                title={video.title}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="border border-white"
              />
            </div>
          ) : (
            <div className="aspect-video border border-white flex items-center justify-center">
              <p className="text-gray-500">Invalid YouTube URL</p>
            </div>
          )}
          
          <div className="mt-4 p-4 border border-white">
            <p className="text-sm text-gray-400">URL:</p>
            <p className="text-sm break-all">{video.url}</p>
          </div>
        </div>
        
        <div>
          <h2 className="text-xl font-semibold mb-4">Transcript</h2>
          <div className="border border-white p-4 min-h-[400px] max-h-[600px] overflow-y-auto">
            {video.transcript ? (
              <div>
                <p className="whitespace-pre-wrap">{video.transcript}</p>
                {video.segments && video.segments.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-700">
                    <p className="text-sm text-gray-400 mb-2">
                      Detected {video.segments.length} segments, {' '}
                      {video.segments.filter(s => s.type === 'step').length} steps
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-500">Transcript will appear here after processing</p>
            )}
          </div>
        </div>
      </div>
      
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Segments</h2>
        <div className="border border-white p-4">
          {video.segments && video.segments.length > 0 ? (
            <div className="space-y-4">
              {video.segments.map((segment, index) => {
                const stepNumber = segment.type === 'step' 
                  ? (video.segments?.filter((s, i) => i < index && s.type === 'step').length ?? 0) + 1
                  : null;
                return (
                <div key={segment.id} className="p-4 border border-gray-700">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-semibold text-lg">
                        {stepNumber && `Step ${stepNumber}: `}
                        {segment.title || `Segment ${index + 1}`}
                      </h3>
                      <span className="text-sm text-gray-400">
                        {formatTime(segment.startTime)} - {formatTime(segment.endTime)}
                      </span>
                    </div>
                    {segment.type === 'step' && (
                      <span className="px-2 py-1 bg-blue-900 text-blue-200 text-xs rounded">
                        STEP
                      </span>
                    )}
                  </div>
                  
                  <div className="mt-3 space-y-2">
                    {segment.warnings && segment.warnings.length > 0 && (
                      <div className="space-y-1">
                        {segment.warnings.map((warning, idx) => (
                          <div key={idx} className="p-2 bg-red-900 border border-red-700 rounded">
                            <span className="font-bold text-red-200">⚠️ WARNING: </span>
                            <span className="text-red-100">{warning.text}</span>
                            <span className="text-xs text-red-300 ml-2">
                              ({formatTime(warning.timestamp)})
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {segment.keyPoints && segment.keyPoints.length > 0 && (
                      <div className="space-y-1">
                        {segment.keyPoints.map((point, idx) => (
                          <div key={idx} className="p-2 bg-yellow-900 border border-yellow-700 rounded">
                            <span className="font-bold text-yellow-200">💡 KEY POINT: </span>
                            <span className="text-yellow-100">{point.text}</span>
                            <span className="text-xs text-yellow-300 ml-2">
                              ({formatTime(point.timestamp)})
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    <p className="whitespace-pre-wrap">{segment.text}</p>
                  </div>
                </div>
              )})}
            </div>
          ) : (
            <p className="text-gray-500">Segments will appear here after processing</p>
          )}
        </div>
      </div>
    </div>
  )
}

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export default VideoDetail
