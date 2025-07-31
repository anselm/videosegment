export interface Video {
  id: string
  url: string
  title: string
  addedAt: string // ISO date string from server
  transcript?: string | null
  segments?: VideoSegment[]
  status?: 'pending' | 'processing' | 'transcribing' | 'transcribed' | 'segmenting' | 'completed' | 'error'
  error?: string
  processedAt?: string
  transcribedAt?: string
  segmentedAt?: string
  rawTranscript?: any[]
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
