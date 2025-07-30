import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { getTranscript, segmentTranscript } from './services/transcription.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Data directory for storing video files
const DATA_DIR = join(__dirname, '../data/videos');

// Ensure data directory exists
async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (error) {
    console.error('Error creating data directory:', error);
  }
}

ensureDataDir();

// Middleware
app.use(cors());
app.use(express.json());

// Helper functions
async function readVideoData(id) {
  const filePath = join(DATA_DIR, `${id}.json`);
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return null;
  }
}

async function writeVideoData(id, data) {
  const filePath = join(DATA_DIR, `${id}.json`);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

async function getAllVideos() {
  try {
    const files = await fs.readdir(DATA_DIR);
    const videos = [];
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        const id = file.replace('.json', '');
        const video = await readVideoData(id);
        if (video) {
          videos.push(video);
        }
      }
    }
    
    // Sort by addedAt date, newest first
    return videos.sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());
  } catch (error) {
    console.error('Error reading videos:', error);
    return [];
  }
}

function extractVideoTitle(url) {
  // For now, just extract video ID and use it as title
  // In the future, this could fetch actual title from YouTube API
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
  const videoId = match ? match[1] : null;
  return videoId ? `YouTube Video ${videoId}` : 'Untitled Video';
}

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get all videos
app.get('/api/videos', async (req, res) => {
  try {
    const videos = await getAllVideos();
    res.json({ videos });
  } catch (error) {
    console.error('Error fetching videos:', error);
    res.status(500).json({ error: 'Failed to fetch videos' });
  }
});

// Add a new video
app.post('/api/videos', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    
    // Generate unique ID
    const id = crypto.randomBytes(16).toString('hex');
    
    // Create video object
    const video = {
      id,
      url,
      title: extractVideoTitle(url),
      addedAt: new Date().toISOString(),
      transcript: null,
      segments: []
    };
    
    // Save to filesystem
    await writeVideoData(id, video);
    
    res.json(video);
  } catch (error) {
    console.error('Error adding video:', error);
    res.status(500).json({ error: 'Failed to add video' });
  }
});

// Get video by ID
app.get('/api/videos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const video = await readVideoData(id);
    
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }
    
    res.json(video);
  } catch (error) {
    console.error('Error fetching video:', error);
    res.status(500).json({ error: 'Failed to fetch video' });
  }
});

// Update video
app.put('/api/videos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const video = await readVideoData(id);
    
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }
    
    // Merge updates
    const updatedVideo = { ...video, ...updates };
    
    // Save back to filesystem
    await writeVideoData(id, updatedVideo);
    
    res.json(updatedVideo);
  } catch (error) {
    console.error('Error updating video:', error);
    res.status(500).json({ error: 'Failed to update video' });
  }
});

// Process video (transcription and segmentation)
app.post('/api/videos/:id/process', async (req, res) => {
  try {
    const { id } = req.params;
    const video = await readVideoData(id);
    
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }
    
    // Update status to processing
    video.status = 'processing';
    await writeVideoData(id, video);
    
    // Get transcript
    console.log(`Fetching transcript for video ${id}...`);
    const transcript = await getTranscript(video.url);
    
    // Update video with transcript
    video.transcript = transcript.fullText;
    video.rawTranscript = transcript.rawSegments;
    video.status = 'transcribed';
    await writeVideoData(id, video);
    
    // Segment the transcript
    console.log(`Segmenting transcript for video ${id}...`);
    const segments = await segmentTranscript(transcript, video.url);
    
    // Update video with segments
    video.segments = segments;
    video.status = 'completed';
    video.processedAt = new Date().toISOString();
    await writeVideoData(id, video);
    
    res.json(video);
  } catch (error) {
    console.error('Error processing video:', error);
    
    // Update video status to error
    try {
      const video = await readVideoData(id);
      if (video) {
        video.status = 'error';
        video.error = error.message;
        await writeVideoData(id, video);
      }
    } catch (updateError) {
      console.error('Error updating video status:', updateError);
    }
    
    res.status(500).json({ error: error.message });
  }
});

// Serve static files from the React app in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(join(__dirname, '../dist')));
  
  app.get('*', (req, res) => {
    res.sendFile(join(__dirname, '../dist', 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
