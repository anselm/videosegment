import { useState, useRef, useEffect } from 'react'
import { VideoSegment } from '../types/Video'

interface SegmentBarProps {
  segment: VideoSegment
  duration: number
  isSelected: boolean
  onSelect: () => void
  onUpdate: (updates: Partial<VideoSegment>) => void
  onDelete: () => void
  onSeek: (time: number) => void
}

export default function SegmentBar({
  segment,
  duration,
  isSelected,
  onSelect,
  onUpdate,
  onDelete,
  onSeek
}: SegmentBarProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(segment.title || '')
  const [isDragging, setIsDragging] = useState<'start' | 'end' | 'move' | null>(null)
  const [dragStartX, setDragStartX] = useState(0)
  const [dragStartTime, setDragStartTime] = useState({ start: 0, end: 0 })
  const barRef = useRef<HTMLDivElement>(null)

  const startPercent = (segment.startTime / duration) * 100
  const widthPercent = ((segment.endTime - segment.startTime) / duration) * 100

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleMouseDown = (e: React.MouseEvent, type: 'start' | 'end' | 'move') => {
    e.stopPropagation()
    setIsDragging(type)
    setDragStartX(e.clientX)
    setDragStartTime({ start: segment.startTime, end: segment.endTime })
    onSelect()
  }

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!barRef.current?.parentElement) return
      
      const timeline = barRef.current.parentElement
      const rect = timeline.getBoundingClientRect()
      const deltaX = e.clientX - dragStartX
      const deltaTime = (deltaX / rect.width) * duration

      if (isDragging === 'start') {
        const newStart = Math.max(0, Math.min(dragStartTime.start + deltaTime, segment.endTime - 1))
        onUpdate({ startTime: newStart })
      } else if (isDragging === 'end') {
        const newEnd = Math.max(segment.startTime + 1, Math.min(dragStartTime.end + deltaTime, duration))
        onUpdate({ endTime: newEnd })
      } else if (isDragging === 'move') {
        const segmentDuration = segment.endTime - segment.startTime
        const newStart = Math.max(0, Math.min(dragStartTime.start + deltaTime, duration - segmentDuration))
        const newEnd = newStart + segmentDuration
        onUpdate({ startTime: newStart, endTime: newEnd })
      }
    }

    const handleMouseUp = () => {
      setIsDragging(null)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, dragStartX, dragStartTime, segment, duration, onUpdate])

  const handleTitleSave = () => {
    onUpdate({ title: editTitle })
    setIsEditing(false)
  }

  return (
    <div
      ref={barRef}
      className={`relative h-16 bg-gray-800 rounded mb-2 ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
      style={{
        marginLeft: `${startPercent}%`,
        width: `${widthPercent}%`
      }}
      onClick={onSelect}
    >
      {/* Drag handles */}
      <div
        className="absolute left-0 top-0 bottom-0 w-2 bg-blue-600 cursor-ew-resize hover:bg-blue-500"
        onMouseDown={(e) => handleMouseDown(e, 'start')}
      />
      <div
        className="absolute right-0 top-0 bottom-0 w-2 bg-blue-600 cursor-ew-resize hover:bg-blue-500"
        onMouseDown={(e) => handleMouseDown(e, 'end')}
      />
      
      {/* Content */}
      <div
        className="h-full px-4 py-2 cursor-move overflow-hidden"
        onMouseDown={(e) => handleMouseDown(e, 'move')}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {isEditing ? (
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onBlur={handleTitleSave}
                onKeyDown={(e) => e.key === 'Enter' && handleTitleSave()}
                className="bg-gray-700 px-2 py-1 rounded text-sm w-full"
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <h3
                className="text-sm font-medium truncate cursor-text"
                onDoubleClick={() => setIsEditing(true)}
              >
                {segment.title || 'Untitled Segment'}
              </h3>
            )}
            <p className="text-xs text-gray-400">
              {formatTime(segment.startTime)} - {formatTime(segment.endTime)}
            </p>
          </div>
          
          {isSelected && (
            <div className="flex items-center gap-1 ml-2">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onSeek(segment.startTime)
                }}
                className="p-1 hover:bg-gray-700 rounded"
                title="Jump to start"
              >
                ⏮
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete()
                }}
                className="p-1 hover:bg-gray-700 rounded text-red-500"
                title="Delete segment"
              >
                ×
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
