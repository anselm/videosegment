export interface Video {
  id: string
  url: string
  videoType?: 'youtube' | 'googledrive' | 'direct' | 'upload' | 'unknown'
  title: string
  addedAt: string // ISO date string from server
  transcript?: string | null
  segments?: VideoSegment[]
  status?: 'pending' | 'processing' | 'transcribing' | 'transcribed' | 'segmenting' | 'completed' | 'error' | 'downloading'
  error?: string
  processedAt?: string
  transcribedAt?: string
  segmentedAt?: string
  rawTranscript?: any[]
  localVideoPath?: string | null
  audioPath?: string | null
  originalFilename?: string
  fileSize?: number
  mimeType?: string
}

export interface VideoSegment {
  id: string
  startTime: number
  endTime: number
  text: string
  title?: string
  type?: 'step' | 'general'
  keyPoints?: Array<{
    text: string
    timestamp: number
  }>
  warnings?: Array<{
    text: string
    timestamp: number
  }>
}
