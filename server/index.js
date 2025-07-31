import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import multer from 'multer';
import { createReadStream } from 'fs';
import { getTranscript, segmentTranscript } from './services/transcription.js';
import { downloadVideo } from './services/videoProcessor.js';

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
const UPLOAD_DIR = join(__dirname, '../data/videos/uploads');

// Ensure data directories exist
async function ensureDataDirs() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
  } catch (error) {
    console.error('Error creating data directories:', error);
  }
}

ensureDataDirs();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueId = crypto.randomBytes(16).toString('hex');
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueId}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.mp4', '.mov', '.avi', '.webm', '.mkv', '.ogg'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed types: ' + allowedTypes.join(', ')));
    }
  }
});

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

function getVideoType(url) {
  if (isValidYouTubeUrl(url)) {
    return 'youtube';
  }
  // Check for Google Drive
  if (url.includes('drive.google.com')) {
    return 'googledrive';
  }
  // Check for direct video file extensions
  const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv'];
  if (videoExtensions.some(ext => url.toLowerCase().includes(ext))) {
    return 'direct';
  }
  return 'unknown';
}

function extractGoogleDriveId(url) {
  const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

function getGoogleDriveDirectUrl(fileId) {
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

// API Routes

// Get available Ollama models
app.get('/api/ollama/models', async (req, res) => {
  try {
    const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    const response = await fetch(`${ollamaUrl}/api/tags`);
    
    if (!response.ok) {
      throw new Error('Failed to connect to Ollama');
    }
    
    const data = await response.json();
    const models = data.models.map(model => model.name);
    
    res.json({ models });
  } catch (error) {
    console.error('Error fetching Ollama models:', error);
    res.status(500).json({ error: 'Failed to fetch Ollama models. Make sure Ollama is running.' });
  }
});

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

// Add a new video from URL
app.post('/api/videos', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    
    const videoType = getVideoType(url);
    if (videoType === 'unknown') {
      return res.status(400).json({ error: 'Invalid video URL format. Supported: YouTube, Google Drive, or direct video file URLs' });
    }
    
    // Generate unique ID
    const id = crypto.randomBytes(16).toString('hex');
    
    // Create video object
    const video = {
      id,
      url,
      videoType: getVideoType(url),
      title: extractVideoTitle(url),
      addedAt: new Date().toISOString(),
      transcript: null,
      segments: [],
      localVideoPath: null,
      audioPath: null
    };
    
    // Save to filesystem
    await writeVideoData(id, video);
    
    res.json(video);
  } catch (error) {
    console.error('Error adding video:', error);
    res.status(500).json({ error: 'Failed to add video' });
  }
});

// Upload a video file
app.post('/api/videos/upload', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video file provided' });
    }
    
    // Generate unique ID
    const id = crypto.randomBytes(16).toString('hex');
    
    // Create video object
    const video = {
      id,
      url: `file://${req.file.path}`,
      videoType: 'upload',
      title: req.body.title || req.file.originalname || 'Uploaded Video',
      originalFilename: req.file.originalname,
      addedAt: new Date().toISOString(),
      transcript: null,
      segments: [],
      localVideoPath: req.file.path,
      audioPath: null,
      fileSize: req.file.size,
      mimeType: req.file.mimetype
    };
    
    // Save to filesystem
    await writeVideoData(id, video);
    
    res.json(video);
  } catch (error) {
    console.error('Error uploading video:', error);
    res.status(500).json({ error: error.message || 'Failed to upload video' });
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

// Transcribe video
app.post('/api/videos/:id/transcribe', async (req, res) => {
  try {
    const { id } = req.params;
    const { llmProvider, ollamaModel } = req.body;
    const video = await readVideoData(id);
    
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }
    
    // Update status to processing
    video.status = 'transcribing';
    await writeVideoData(id, video);
    
    // Get transcript
    console.log(`[Server] Fetching transcript for video ${id} (${video.url})...`);
    try {
      const transcript = await getTranscript(video.url, video.videoType, id, { llmProvider, ollamaModel });
      console.log(`[Server] Transcript fetched successfully: ${transcript.fullText.length} characters`);
    
      // Update video with transcript
      video.transcript = transcript.fullText;
      video.rawTranscript = transcript.rawSegments;
      video.status = 'transcribed';
      video.transcribedAt = new Date().toISOString();
      await writeVideoData(id, video);
      
      res.json(video);
    } catch (transcriptError) {
      console.error(`[Server] Failed to fetch transcript for video ${id}:`, transcriptError.message);
      throw transcriptError;
    }
  } catch (error) {
    console.error('Error transcribing video:', error);
    
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

// Segment video transcript
app.post('/api/videos/:id/segment', async (req, res) => {
  try {
    const { id } = req.params;
    const { llmProvider, ollamaModel } = req.body;
    const video = await readVideoData(id);
    
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }
    
    if (!video.transcript || !video.rawTranscript) {
      return res.status(400).json({ error: 'Video must be transcribed before segmentation' });
    }
    
    // Update status to segmenting
    video.status = 'segmenting';
    await writeVideoData(id, video);
    
    // Segment the transcript
    console.log(`[Server] Segmenting transcript for video ${id}...`);
    const transcript = {
      fullText: video.transcript,
      rawSegments: video.rawTranscript
    };
    const segments = await segmentTranscript(transcript, video.url, { llmProvider, ollamaModel });
    
    // Update video with segments
    video.segments = segments;
    video.status = 'completed';
    video.segmentedAt = new Date().toISOString();
    await writeVideoData(id, video);
    
    res.json(video);
  } catch (error) {
    console.error('Error segmenting video:', error);
    
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

// Process video (transcription and segmentation) - kept for backward compatibility
app.post('/api/videos/:id/process', async (req, res) => {
  try {
    const { id } = req.params;
    const { llmProvider, ollamaModel } = req.body;
    const video = await readVideoData(id);
    
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }
    
    // Update status to processing
    video.status = 'processing';
    await writeVideoData(id, video);
    
    // Get transcript
    console.log(`[Server] Fetching transcript for video ${id} (${video.url})...`);
    const transcript = await getTranscript(video.url, video.videoType, id, { llmProvider, ollamaModel });
    console.log(`[Server] Transcript fetched successfully: ${transcript.fullText.length} characters`);
    
    // Update video with transcript
    video.transcript = transcript.fullText;
    video.rawTranscript = transcript.rawSegments;
    video.status = 'transcribed';
    video.transcribedAt = new Date().toISOString();
    await writeVideoData(id, video);
    
    // Segment the transcript
    console.log(`Segmenting transcript for video ${id}...`);
    const segments = await segmentTranscript(transcript, video.url, { llmProvider, ollamaModel });
    
    // Update video with segments
    video.segments = segments;
    video.status = 'completed';
    video.processedAt = new Date().toISOString();
    video.segmentedAt = new Date().toISOString();
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

// Serve video files
app.get('/api/videos/:id/file', async (req, res) => {
  try {
    const { id } = req.params;
    const video = await readVideoData(id);
    
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }
    
    if (!video.localVideoPath) {
      return res.status(404).json({ error: 'Video file not available' });
    }
    
    const videoPath = video.localVideoPath.replace('file://', '');
    
    // Check if file exists
    try {
      await fs.access(videoPath);
    } catch (error) {
      return res.status(404).json({ error: 'Video file not found on server' });
    }
    
    // Get file stats for content-length
    const stat = await fs.stat(videoPath);
    const fileSize = stat.size;
    const range = req.headers.range;
    
    // Determine content type from file extension
    const ext = path.extname(videoPath).toLowerCase();
    const contentType = {
      '.mp4': 'video/mp4',
      '.mov': 'video/quicktime',
      '.avi': 'video/x-msvideo',
      '.webm': 'video/webm',
      '.mkv': 'video/x-matroska',
      '.ogg': 'video/ogg'
    }[ext] || 'video/mp4';
    
    if (range) {
      // Support for video seeking
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      const file = createReadStream(videoPath, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': contentType,
      };
      res.writeHead(206, head);
      file.pipe(res);
    } else {
      const head = {
        'Content-Length': fileSize,
        'Content-Type': contentType,
      };
      res.writeHead(200, head);
      createReadStream(videoPath).pipe(res);
    }
  } catch (error) {
    console.error('Error serving video file:', error);
    res.status(500).json({ error: 'Failed to serve video file' });
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
