import { useParams, Link } from 'react-router-dom'
import { useVideoStore } from '../hooks/useVideoStore'

const VideoDetail = () => {
  const { id } = useParams<{ id: string }>()
  const { getVideo } = useVideoStore()
  const video = id ? getVideo(id) : null

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

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <Link to="/" className="text-gray-400 hover:text-white mb-4 inline-block">
        ← Back to list
      </Link>
      
      <h1 className="text-3xl font-bold mb-6">{video.title}</h1>
      
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
          <div className="border border-white p-4 min-h-[400px]">
            {video.transcript ? (
              <p className="whitespace-pre-wrap">{video.transcript}</p>
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
            <div className="space-y-2">
              {video.segments.map((segment) => (
                <div key={segment.id} className="p-2 border border-gray-700">
                  <div className="flex justify-between text-sm text-gray-400 mb-1">
                    <span>{formatTime(segment.startTime)} - {formatTime(segment.endTime)}</span>
                  </div>
                  <p>{segment.text}</p>
                </div>
              ))}
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
