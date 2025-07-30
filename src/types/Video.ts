export interface Video {
  id: string
  url: string
  title: string
  addedAt: string // ISO date string from server
  transcript?: string | null
  segments?: VideoSegment[]
}

export interface VideoSegment {
  id: string
  startTime: number
  endTime: number
  text: string
}
