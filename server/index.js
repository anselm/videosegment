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

// Check for required environment variables
if (!process.env.ANTHROPIC_API_KEY) {
  console.warn('WARNING: ANTHROPIC_API_KEY not set in environment variables');
  console.warn('Video processing will fail without this key');
}

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
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.FRONTEND_URL || 'http://localhost:3000'
    : ['http://localhost:5173', 'http://localhost:3000']
}));
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

function isValidYouTubeUrl(url) {
  const patterns = [
    /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
    /^(https?:\/\/)?(www\.)?youtube\.com\/embed\/([^&\n?#]+)/,
    /^(https?:\/\/)?(www\.)?youtube\.com\/v\/([^&\n?#]+)/
  ];
  
  return patterns.some(pattern => pattern.test(url));
}

// API Routes
app.get('/api/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    checks: {
      dataDir: false,
      anthropicKey: !!process.env.ANTHROPIC_API_KEY
    }
  };
  
  // Check if data directory is accessible
  try {
    await fs.access(DATA_DIR);
    health.checks.dataDir = true;
  } catch (error) {
    health.status = 'degraded';
  }
  
  if (!health.checks.anthropicKey) {
    health.status = 'degraded';
    health.message = 'ANTHROPIC_API_KEY not configured - video processing will fail';
  }
  
  res.json(health);
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
    
    if (!isValidYouTubeUrl(url)) {
      return res.status(400).json({ error: 'Invalid YouTube URL format' });
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
    console.log(`[Server] GET /api/videos/${id} - Fetching video data`);
    
    const video = await readVideoData(id);
    
    if (!video) {
      console.log(`[Server] Video not found: ${id}`);
      return res.status(404).json({ error: 'Video not found' });
    }
    
    console.log(`[Server] Sending video data for ${id}, transcript size: ${video.transcript?.length || 0} chars`);
    res.json(video);
  } catch (error) {
    console.error('[Server] Error fetching video:', error);
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
    console.log(`[Server] Fetching transcript for video ${id} (${video.url})...`);
    const transcript = await getTranscript(video.url);
    console.log(`[Server] Transcript fetched successfully: ${transcript.fullText.length} characters`);
    
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

// Check if dist directory exists
const distPath = join(__dirname, '../dist');
const distExists = await fs.access(distPath).then(() => true).catch(() => false);

if (distExists) {
  // Serve the built React app
  app.use(express.static(distPath));
  
  app.get('*', (req, res) => {
    res.sendFile(join(distPath, 'index.html'));
  });
  console.log('Serving built React app from /dist');
} else {
  // In development or when dist doesn't exist, provide a helpful message
  app.get('/', (req, res) => {
    res.send(`
      <html>
        <body style="font-family: sans-serif; padding: 2rem;">
          <h1>Video Transcription App - API Server</h1>
          <p>This is the API server running on port ${PORT}.</p>
          <p>The React app hasn't been built yet.</p>
          <p>To build and serve the app:</p>
          <ul>
            <li>Run <code>npm run build</code> to build the React app</li>
            <li>Then restart the server with <code>npm run server</code></li>
          </ul>
          <p>Or use the combined command:</p>
          <ul>
            <li>Run <code>npm run build:serve</code></li>
          </ul>
          <h2>API Endpoints:</h2>
          <ul>
            <li><a href="/api/health">/api/health</a> - Health check</li>
            <li>/api/videos - Get all videos</li>
            <li>/api/videos/:id - Get video details</li>
          </ul>
        </body>
      </html>
    `);
  });
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  if (process.env.NODE_ENV !== 'production') {
    console.log(`Frontend dev server should be running on http://localhost:5173`);
    console.log(`Run 'npm run dev' to start both servers`);
  }
});
