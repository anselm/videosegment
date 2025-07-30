import { useState, useEffect } from 'react'
import { Video } from '../types/Video'
// import { api } from '../services/api'

const STORAGE_KEY = 'video-transcription-app-videos'

export const useVideoStore = () => {
  const [videos, setVideos] = useState<Video[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // For now, continue using localStorage
    // In the future, this will fetch from the API
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      setVideos(JSON.parse(stored))
    }
  }, [])

  const saveVideos = (newVideos: Video[]) => {
    setVideos(newVideos)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newVideos))
  }

  const addVideo = async (url: string) => {
    setLoading(true)
    setError(null)
    
    try {
      // For now, continue with local implementation
      // In the future, this will call: const result = await api.addVideo(url)
      const newVideo: Video = {
        id: Date.now().toString(),
        url,
        title: `Video ${videos.length + 1}`,
        addedAt: new Date(),
      }
      saveVideos([...videos, newVideo])
      
      // TODO: In the future, trigger server-side processing here
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add video')
    } finally {
      setLoading(false)
    }
  }

  const getVideo = (id: string) => {
    return videos.find(v => v.id === id)
  }

  const updateVideo = async (id: string, updates: Partial<Video>) => {
    // For now, continue with local implementation
    // In the future, this will call: await api.updateVideo(id, updates)
    const updatedVideos = videos.map(v => 
      v.id === id ? { ...v, ...updates } : v
    )
    saveVideos(updatedVideos)
  }

  return { videos, addVideo, getVideo, updateVideo, loading, error }
}
