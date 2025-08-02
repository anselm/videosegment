import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../services/api'
import { Video, VideoSegment } from '../types/Video'
import Timeline from './Timeline'
import SegmentBar from './SegmentBar'

export default function VideoEditor() {
  const { id } = useParams<{ id: string }>()
  const [video, setVideo] = useState<Video | null>(null)
  const [segments, setSegments] = useState<VideoSegment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedSegment, setSelectedSegment] = useState<string | null>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [saving, setSaving] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (id) {
      loadVideo()
    }
  }, [id])

  const loadVideo = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const videoData = await api.getVideo(id!)
      setVideo(videoData)
      setSegments(videoData.segments || [])
      
      // Get video metadata if not already available
      if (!videoData.duration) {
        const metadata = await api.getVideoMetadata(id!)
        setDuration(metadata.duration)
      } else {
        setDuration(videoData.duration)
      }
      
      // Generate filmstrip if not already available
      if (!videoData.filmstrip || videoData.filmstrip.length === 0) {
        await api.generateFilmstrip(id!, 100)
        const updatedVideo = await api.getVideo(id!)
        setVideo(updatedVideo)
      }
    } catch (err) {
      console.error('Error loading video:', err)
      setError(err instanceof Error ? err.message : 'Failed to load video')
    } finally {
      setLoading(false)
    }
  }

  const handleSegmentUpdate = (segmentId: string, updates: Partial<VideoSegment>) => {
    setSegments(prev => prev.map(seg => 
      seg.id === segmentId ? { ...seg, ...updates } : seg
    ))
  }

  const handleSegmentDelete = (segmentId: string) => {
    setSegments(prev => prev.filter(seg => seg.id !== segmentId))
    if (selectedSegment === segmentId) {
      setSelectedSegment(null)
    }
  }

  const handleSegmentAdd = () => {
    const newSegment: VideoSegment = {
      id: `seg_${Date.now()}`,
      startTime: currentTime,
      endTime: Math.min(currentTime + 10, duration),
      text: 'New segment',
      title: 'New Segment'
    }
    setSegments(prev => [...prev, newSegment])
    setSelectedSegment(newSegment.id)
  }

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime)
    }
  }

  const handleSeek = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time
      setCurrentTime(time)
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      await api.updateSegments(id!, segments)
      // Show success feedback
    } catch (err) {
      console.error('Error saving segments:', err)
      setError(err instanceof Error ? err.message : 'Failed to save segments')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading video editor...</p>
        </div>
      </div>
    )
  }

  if (error || !video) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error || 'Video not found'}</p>
          <Link to="/" className="text-blue-500 hover:underline">
            Back to videos
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-gray-800 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to={`/video/${id}`} className="text-gray-400 hover:text-white">
              ← Back to video
            </Link>
            <h1 className="text-xl font-semibold">{video.title} - Timeline Editor</h1>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>

      {/* Video Preview */}
      <div className="p-4">
        <div className="max-w-4xl mx-auto">
          {video.localVideoPath ? (
            <video
              ref={videoRef}
              src={`/api/videos/${id}/file`}
              className="w-full rounded"
              controls
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={(e) => {
                const video = e.target as HTMLVideoElement
                setDuration(video.duration)
              }}
            />
          ) : (
            <div className="aspect-video bg-gray-900 rounded flex items-center justify-center">
              <p className="text-gray-500">Video preview not available</p>
            </div>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div className="p-4">
        <Timeline
          duration={duration}
          currentTime={currentTime}
          filmstrip={video.filmstrip || []}
          onSeek={handleSeek}
        />
      </div>

      {/* Segments */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Segments</h2>
          <button
            onClick={handleSegmentAdd}
            className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm"
          >
            + Add Segment
          </button>
        </div>
        
        <div className="space-y-2">
          {segments.map((segment) => (
            <SegmentBar
              key={segment.id}
              segment={segment}
              duration={duration}
              isSelected={selectedSegment === segment.id}
              onSelect={() => setSelectedSegment(segment.id)}
              onUpdate={(updates) => handleSegmentUpdate(segment.id, updates)}
              onDelete={() => handleSegmentDelete(segment.id)}
              onSeek={handleSeek}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
