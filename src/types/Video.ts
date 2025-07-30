export interface Video {
  id: string
  url: string
  title: string
  addedAt: Date
  transcript?: string
  segments?: VideoSegment[]
}

export interface VideoSegment {
  id: string
  startTime: number
  endTime: number
  text: string
}
