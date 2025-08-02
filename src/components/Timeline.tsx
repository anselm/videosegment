import { useRef, useEffect, useState } from 'react'
import { FilmstripFrame } from '../types/Video'

interface TimelineProps {
  duration: number
  currentTime: number
  filmstrip: FilmstripFrame[]
  onSeek: (time: number) => void
}

export default function Timeline({ duration, currentTime, filmstrip, onSeek }: TimelineProps) {
  const timelineRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [timelineWidth, setTimelineWidth] = useState(0)

  useEffect(() => {
    const updateWidth = () => {
      if (timelineRef.current) {
        setTimelineWidth(timelineRef.current.offsetWidth)
      }
    }
    
    updateWidth()
    window.addEventListener('resize', updateWidth)
    return () => window.removeEventListener('resize', updateWidth)
  }, [])

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    handleSeek(e)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      handleSeek(e)
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleSeek = (e: React.MouseEvent) => {
    if (!timelineRef.current) return
    
    const rect = timelineRef.current.getBoundingClientRect()
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width))
    const time = (x / rect.width) * duration
    onSeek(time)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const playheadPosition = (currentTime / duration) * 100

  return (
    <div className="bg-gray-900 rounded p-4">
      <div className="mb-2 flex justify-between text-sm text-gray-400">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>
      
      <div
        ref={timelineRef}
        className="relative h-24 bg-gray-800 rounded cursor-pointer overflow-hidden"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Filmstrip */}
        <div className="absolute inset-0 flex">
          {filmstrip.map((frame, index) => (
            <div
              key={index}
              className="flex-1 h-full"
              style={{
                backgroundImage: `url(${frame.url})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center'
              }}
            />
          ))}
        </div>
        
        {/* Overlay for better visibility */}
        <div className="absolute inset-0 bg-black bg-opacity-30" />
        
        {/* Time markers */}
        <div className="absolute inset-0 flex justify-between px-2 py-1">
          {Array.from({ length: 11 }, (_, i) => (
            <div key={i} className="text-xs text-gray-300">
              {formatTime((duration / 10) * i)}
            </div>
          ))}
        </div>
        
        {/* Playhead */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-red-500"
          style={{ left: `${playheadPosition}%` }}
        >
          <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-3 h-3 bg-red-500 rounded-full" />
        </div>
      </div>
    </div>
  )
}
