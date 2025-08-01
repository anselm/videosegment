// When served from Express, use relative URLs
// This works for both development (with Vite proxy) and production

// Store LLM configuration in memory
let llmConfig = {
  provider: 'ollama' as 'claude' | 'ollama',
  ollamaModel: ''
}

export const api = {
  // LLM configuration methods
  setLLMConfig(provider: 'claude' | 'ollama', ollamaModel?: string) {
    llmConfig.provider = provider
    if (ollamaModel) {
      llmConfig.ollamaModel = ollamaModel
    }
  },

  getLLMConfig() {
    return llmConfig
  },

  async getOllamaModels() {
    const response = await fetch('/api/ollama/models')
    if (!response.ok) throw new Error('Failed to fetch Ollama models')
    const data = await response.json()
    return data.models
  },
  async uploadVideo(file: File, title?: string) {
    const formData = new FormData();
    formData.append('video', file);
    if (title) {
      formData.append('title', title);
    }

    const response = await fetch('/api/videos/upload', {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      try {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload video');
      } catch {
        throw new Error('Failed to upload video');
      }
    }
    return response.json();
  },
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

  async transcribeVideo(id: string) {
    const response = await fetch(`/api/videos/${id}/transcribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        llmProvider: llmConfig.provider,
        ollamaModel: llmConfig.ollamaModel
      }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to transcribe video');
    }
    return response.json();
  },

  async segmentVideo(id: string) {
    const response = await fetch(`/api/videos/${id}/segment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        llmProvider: llmConfig.provider,
        ollamaModel: llmConfig.ollamaModel
      }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to segment video');
    }
    return response.json();
  },

  async processVideo(id: string) {
    const response = await fetch(`/api/videos/${id}/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        llmProvider: llmConfig.provider,
        ollamaModel: llmConfig.ollamaModel
      }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to process video');
    }
    return response.json();
  },
};
