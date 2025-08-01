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
  const [showJson, setShowJson] = useState(false)

  useEffect(() => {
    const loadVideo = async () => {
      if (!id) return
      
      console.log('[VideoDetail] Starting to load video:', id)
      setLoading(true)
      try {
        // Try to get from local state first
        const localVideo = getVideo(id)
        if (localVideo) {
          console.log('[VideoDetail] Found video in local state:', localVideo.title)
          setVideo(localVideo)
        }
        
        // Fetch fresh data from server
        console.log('[VideoDetail] Fetching fresh data from server...')
        const freshVideo = await fetchVideo(id)
        console.log('[VideoDetail] Received fresh video data:', freshVideo.title)
        setVideo(freshVideo)
      } catch (error) {
        console.error('[VideoDetail] Error loading video:', error)
      } finally {
        console.log('[VideoDetail] Loading complete')
        setLoading(false)
      }
    }
    
    loadVideo()
  }, [id]) // Remove getVideo and fetchVideo from dependencies to prevent loops

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

  const handleTranscribe = async () => {
    if (!id) return
    
    setProcessing(true)
    try {
      const transcribedVideo = await api.transcribeVideo(id)
      setVideo(transcribedVideo)
    } catch (error) {
      console.error('Error transcribing video:', error)
      alert(error instanceof Error ? error.message : 'Failed to transcribe video')
    } finally {
      setProcessing(false)
    }
  }

  const handleSegment = async () => {
    if (!id) return
    
    setProcessing(true)
    try {
      const segmentedVideo = await api.segmentVideo(id)
      setVideo(segmentedVideo)
    } catch (error) {
      console.error('Error segmenting video:', error)
      alert(error instanceof Error ? error.message : 'Failed to segment video')
    } finally {
      setProcessing(false)
    }
  }

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
        <div className="flex gap-2">
          <button
            onClick={handleTranscribe}
            disabled={processing || video.status === 'transcribing'}
            className="px-4 py-2 bg-white text-black hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {processing || video.status === 'transcribing' ? 'Transcribing...' : video.transcript ? 'Re-transcribe' : 'Transcribe'}
          </button>
          {video.transcript && (
            <button
              onClick={handleSegment}
              disabled={processing || video.status === 'segmenting'}
              className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processing || video.status === 'segmenting' ? 'Segmenting...' : video.segments && video.segments.length > 0 ? 'Re-segment' : 'Segment'}
            </button>
          )}
          {!video.transcript && (
            <button
              onClick={handleProcess}
              disabled={processing || video.status === 'processing'}
              className="px-4 py-2 bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processing || video.status === 'processing' ? 'Processing...' : 'Process All'}
            </button>
          )}
        </div>
      </div>

      {video.status === 'error' && video.error && (
        <div className="mb-4 p-4 border border-red-500 text-red-500">
          <p className="font-semibold">Error: {video.error}</p>
          {video.error.includes('captions') && (
            <p className="text-sm mt-2">
              Tip: Try a different video that has captions/subtitles enabled. You can check if a video has captions by looking for the "CC" button in the YouTube player.
            </p>
          )}
          {video.error.includes('ANTHROPIC_API_KEY') && (
            <p className="text-sm mt-2">
              Please ensure your ANTHROPIC_API_KEY is set in the .env file for segmentation to work.
            </p>
          )}
        </div>
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <h2 className="text-xl font-semibold mb-4">Video</h2>
          {video.videoType === 'youtube' && videoId ? (
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
          ) : video.localVideoPath ? (
            <div className="aspect-video">
              <video
                controls
                className="w-full h-full border border-white bg-black"
                preload="metadata"
              >
                <source src={`/api/videos/${video.id}/file`} />
                Your browser does not support the video tag.
              </video>
            </div>
          ) : video.videoType !== 'youtube' ? (
            <div className="aspect-video border border-white flex items-center justify-center">
              <div className="text-center">
                <p className="text-gray-400 mb-2">Video not yet downloaded</p>
                <p className="text-sm text-gray-500">Type: {video.videoType}</p>
                <p className="text-xs text-gray-600 mt-2">Video will be available after transcription</p>
              </div>
            </div>
          ) : (
            <div className="aspect-video border border-white flex items-center justify-center">
              <p className="text-gray-500">Invalid video URL</p>
            </div>
          )}
          
          <div className="mt-4 p-4 border border-white">
            <p className="text-sm text-gray-400">URL:</p>
            <p className="text-sm break-all">{video.url}</p>
            {video.localVideoPath && (
              <>
                <p className="text-sm text-gray-400 mt-2">Local file:</p>
                <p className="text-sm break-all">{video.localVideoPath.replace('file://', '')}</p>
                <a 
                  href={`/api/videos/${video.id}/file`} 
                  download={video.originalFilename || `video-${video.id}.mp4`}
                  className="inline-block mt-2 text-sm text-blue-400 hover:text-blue-300 underline"
                >
                  Download video file
                </a>
              </>
            )}
          </div>
        </div>
        
        <div>
          <h2 className="text-xl font-semibold mb-4">
            Transcript
            {video.rawTranscript && video.rawTranscript.length > 0 && (
              <span className="text-sm text-gray-400 ml-2">
                ({video.rawTranscript.length} segments with timestamps)
              </span>
            )}
          </h2>
          <div className="border border-white p-4 min-h-[400px] max-h-[600px] overflow-y-auto">
            {video.transcript ? (
              <div>
                {video.transcript.length > 50000 ? (
                  <div>
                    <p className="text-yellow-500 mb-2">Large transcript ({video.transcript.length} characters)</p>
                    <p className="whitespace-pre-wrap">{video.transcript.substring(0, 10000)}...</p>
                    <p className="text-gray-500 mt-4">Transcript truncated for performance. Full transcript available in segments below.</p>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">{video.transcript}</p>
                )}
                {video.segments && video.segments.length > 0 ? (
                  <div className="mt-4 pt-4 border-t border-gray-700">
                    <p className="text-sm text-gray-400 mb-2">
                      ✓ Segmented into {video.segments.length} sections, {' '}
                      {video.segments.filter(s => s.type === 'step').length} steps
                    </p>
                  </div>
                ) : video.transcript && (!video.segments || video.segments.length === 0) ? (
                  <div className="mt-4 pt-4 border-t border-gray-700">
                    <p className="text-sm text-yellow-500">
                      ⚠️ Transcript ready but not segmented. Click "Segment" button above to organize into sections.
                    </p>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-gray-500">Transcript will appear here after processing</p>
            )}
          </div>
        </div>
      </div>
      
      <div className="mt-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Segments</h2>
          {video.segments && video.segments.length > 0 && (
            <button
              onClick={() => setShowJson(!showJson)}
              className="px-4 py-2 bg-gray-800 text-white border border-gray-600 hover:bg-gray-700 transition-colors text-sm"
            >
              {showJson ? 'Show Visual' : 'Show JSON'}
            </button>
          )}
        </div>
        <div className="border border-white p-4">
          {video.segments && video.segments.length > 0 ? (
            showJson ? (
              <div>
                <div className="mb-2 text-sm text-gray-400">
                  Click to select all, then copy:
                </div>
                <pre 
                  className="bg-gray-900 p-4 overflow-x-auto text-sm cursor-text select-all"
                  onClick={(e) => {
                    const selection = window.getSelection();
                    const range = document.createRange();
                    range.selectNodeContents(e.currentTarget);
                    selection?.removeAllRanges();
                    selection?.addRange(range);
                  }}
                >
{JSON.stringify({
  videoId: video.id,
  title: video.title,
  url: video.url,
  videoType: video.videoType,
  transcribedAt: video.transcribedAt,
  segmentedAt: video.segmentedAt,
  segments: video.segments.map(segment => ({
    id: segment.id,
    title: segment.title,
    type: segment.type,
    startTime: segment.startTime,
    endTime: segment.endTime,
    duration: segment.endTime - segment.startTime,
    text: segment.text,
    keyPoints: segment.keyPoints || [],
    warnings: segment.warnings || []
  }))
}, null, 2)}
                </pre>
                <div className="mt-2 text-xs text-gray-500">
                  Tip: Triple-click to select all, or click once and press Ctrl/Cmd+A then Ctrl/Cmd+C to copy
                </div>
              </div>
            ) : (
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
            )
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
