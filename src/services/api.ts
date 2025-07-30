const API_BASE_URL = import.meta.env.PROD ? '' : 'http://localhost:3001';

export const api = {
  async getVideos() {
    const response = await fetch(`${API_BASE_URL}/api/videos`);
    if (!response.ok) throw new Error('Failed to fetch videos');
    return response.json();
  },

  async addVideo(url: string) {
    const response = await fetch(`${API_BASE_URL}/api/videos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url }),
    });
    if (!response.ok) throw new Error('Failed to add video');
    return response.json();
  },

  async getVideo(id: string) {
    const response = await fetch(`${API_BASE_URL}/api/videos/${id}`);
    if (!response.ok) throw new Error('Failed to fetch video');
    return response.json();
  },

  async updateVideo(id: string, updates: any) {
    const response = await fetch(`${API_BASE_URL}/api/videos/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });
    if (!response.ok) throw new Error('Failed to update video');
    return response.json();
  },
};
