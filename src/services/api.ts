// When served from Express, use relative URLs
// This works for both development (with Vite proxy) and production
export const api = {
  async getVideos() {
    const response = await fetch('/api/videos');
    if (!response.ok) throw new Error('Failed to fetch videos');
    return response.json();
  },

  async addVideo(url: string) {
    const response = await fetch('/api/videos', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url }),
    });
    if (!response.ok) {
      try {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add video');
      } catch {
        throw new Error('Failed to add video');
      }
    }
    return response.json();
  },

  async getVideo(id: string) {
    console.log('[API] Fetching video:', id);
    const response = await fetch(`/api/videos/${id}`);
    if (!response.ok) throw new Error('Failed to fetch video');
    const data = await response.json();
    console.log('[API] Video data received, transcript length:', data.transcript?.length || 0);
    return data;
  },

  async updateVideo(id: string, updates: any) {
    const response = await fetch(`/api/videos/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });
    if (!response.ok) throw new Error('Failed to update video');
    return response.json();
  },

  async processVideo(id: string) {
    const response = await fetch(`/api/videos/${id}/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to process video');
    }
    return response.json();
  },
};
