import { useState, useEffect } from 'react'
import { Video } from '../types/Video'

const STORAGE_KEY = 'video-transcription-app-videos'

export const useVideoStore = () => {
  const [videos, setVideos] = useState<Video[]>([])

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      setVideos(JSON.parse(stored))
    }
  }, [])

  const saveVideos = (newVideos: Video[]) => {
    setVideos(newVideos)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newVideos))
  }

  const addVideo = (url: string) => {
    const newVideo: Video = {
      id: Date.now().toString(),
      url,
      title: `Video ${videos.length + 1}`,
      addedAt: new Date(),
    }
    saveVideos([...videos, newVideo])
  }

  const getVideo = (id: string) => {
    return videos.find(v => v.id === id)
  }

  const updateVideo = (id: string, updates: Partial<Video>) => {
    const updatedVideos = videos.map(v => 
      v.id === id ? { ...v, ...updates } : v
    )
    saveVideos(updatedVideos)
  }

  return { videos, addVideo, getVideo, updateVideo }
}
