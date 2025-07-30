import { useState, useEffect } from 'react'
import { Video } from '../types/Video'
import { api } from '../services/api'

export const useVideoStore = () => {
  const [videos, setVideos] = useState<Video[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch videos on mount
  useEffect(() => {
    fetchVideos()
  }, [])

  const fetchVideos = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await api.getVideos()
      setVideos(response.videos)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch videos')
    } finally {
      setLoading(false)
    }
  }

  const addVideo = async (url: string) => {
    setLoading(true)
    setError(null)
    
    try {
      const newVideo = await api.addVideo(url)
      setVideos([newVideo, ...videos])
      return newVideo
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add video')
      throw err
    } finally {
      setLoading(false)
    }
  }

  const getVideo = (id: string) => {
    return videos.find(v => v.id === id)
  }

  const fetchVideo = async (id: string) => {
    try {
      const video = await api.getVideo(id)
      // Update local state with fetched video
      setVideos(prevVideos => {
        const index = prevVideos.findIndex(v => v.id === id)
        if (index >= 0) {
          const newVideos = [...prevVideos]
          newVideos[index] = video
          return newVideos
        }
        return [...prevVideos, video]
      })
      return video
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch video')
      throw err
    }
  }

  const updateVideo = async (id: string, updates: Partial<Video>) => {
    try {
      const updatedVideo = await api.updateVideo(id, updates)
      setVideos(prevVideos => 
        prevVideos.map(v => v.id === id ? updatedVideo : v)
      )
      return updatedVideo
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update video')
      throw err
    }
  }

  const processVideo = async (id: string) => {
    try {
      const processedVideo = await api.processVideo(id)
      setVideos(prevVideos => 
        prevVideos.map(v => v.id === id ? processedVideo : v)
      )
      return processedVideo
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process video')
      throw err
    }
  }

  return { 
    videos, 
    addVideo, 
    getVideo, 
    fetchVideo,
    updateVideo,
    processVideo, 
    loading, 
    error,
    refetch: fetchVideos
  }
}
