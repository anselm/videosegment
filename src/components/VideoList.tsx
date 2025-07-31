import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useVideoStore } from '../hooks/useVideoStore'

const VideoList = () => {
  const [inputUrl, setInputUrl] = useState('')
  const { videos, addVideo, loading, error } = useVideoStore()

  const handleAddVideo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (inputUrl.trim()) {
      try {
        await addVideo(inputUrl.trim())
        setInputUrl('')
      } catch (error) {
        // Error is already displayed by the error state
        console.error('Failed to add video:', error)
      }
    }
  }

  const extractVideoId = (url: string) => {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)
    return match ? match[1] : null
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">Video Transcription Manager</h1>
      
      <form onSubmit={handleAddVideo} className="mb-8">
        <div className="flex gap-4">
          <input
            type="text"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            placeholder="Enter YouTube URL"
            className="flex-1 px-4 py-2 bg-black border border-white text-white placeholder-gray-500 focus:outline-none focus:border-gray-400"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-white text-black hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Adding...' : 'Add Video'}
          </button>
        </div>
      </form>

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
                    {video.videoType && video.videoType !== 'youtube' && (
                      <p className="text-xs text-gray-600">Type: {video.videoType}</p>
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
