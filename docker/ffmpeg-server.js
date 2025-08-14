const express = require('express');
const multer = require('multer');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const execAsync = promisify(exec);
const app = express();
const upload = multer({ dest: '/tmp/uploads/' });

app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  try {
    res.status(200).json({ 
      status: 'ok', 
      service: 'ffmpeg',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({ status: 'error', error: error.message });
  }
});

// Get video metadata
app.post('/metadata', upload.single('video'), async (req, res) => {
  const videoPath = req.file.path;
  
  try {
    const command = `ffprobe -v quiet -print_format json -show_format -show_streams "${videoPath}"`;
    const { stdout } = await execAsync(command);
    const metadata = JSON.parse(stdout);
    
    // Extract relevant information
    const videoStream = metadata.streams.find(s => s.codec_type === 'video');
    const duration = parseFloat(metadata.format.duration);
    
    // Parse frame rate safely
    let fps = 30;
    if (videoStream?.r_frame_rate) {
      const [num, den] = videoStream.r_frame_rate.split('/').map(Number);
      if (den && den !== 0) {
        fps = num / den;
      }
    }

    const result = {
      duration,
      width: videoStream?.width || 0,
      height: videoStream?.height || 0,
      fps: fps,
      codec: videoStream?.codec_name || 'unknown',
      bitrate: parseInt(metadata.format.bit_rate) || 0
    };
    
    res.json(result);
  } catch (error) {
    console.error('Error getting metadata:', error);
    res.status(500).json({ error: error.message });
  } finally {
    // Clean up
    try {
      await fs.unlink(videoPath);
    } catch (e) {}
  }
});

// Generate filmstrip frames
app.post('/filmstrip', upload.single('video'), async (req, res) => {
  const videoPath = req.file.path;
  const { frameCount = 100, videoId } = req.body;
  
  try {
    // First get video duration
    const metadataCommand = `ffprobe -v quiet -print_format json -show_format "${videoPath}"`;
    const { stdout: metadataStdout } = await execAsync(metadataCommand);
    const metadata = JSON.parse(metadataStdout);
    const duration = parseFloat(metadata.format.duration);
    
    // Calculate interval between frames
    const interval = duration / frameCount;
    const frames = [];
    
    // Create temp directory for frames
    const framesDir = `/tmp/frames_${videoId}`;
    await fs.mkdir(framesDir, { recursive: true });
    
    // Generate frames
    for (let i = 0; i < frameCount; i++) {
      const timestamp = i * interval;
      const outputPath = path.join(framesDir, `frame_${i}.jpg`);
      
      const command = `ffmpeg -ss ${timestamp} -i "${videoPath}" -vframes 1 -q:v 2 -y "${outputPath}"`;
      
      try {
        await execAsync(command);
        
        // Read the frame as base64
        const frameData = await fs.readFile(outputPath);
        const base64 = frameData.toString('base64');
        
        frames.push({
          index: i,
          timestamp,
          data: `data:image/jpeg;base64,${base64}`
        });
        
        // Clean up frame file
        await fs.unlink(outputPath);
      } catch (error) {
        console.error(`Error generating frame ${i}:`, error.message);
      }
    }
    
    // Clean up
    await fs.rmdir(framesDir);
    
    res.json({ frames, duration });
  } catch (error) {
    console.error('Error generating filmstrip:', error);
    res.status(500).json({ error: error.message });
  } finally {
    // Clean up
    try {
      await fs.unlink(videoPath);
    } catch (e) {}
  }
});

const PORT = process.env.PORT || 9020;

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

const server = app.listen(PORT, '0.0.0.0', (err) => {
  if (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
  console.log(`FFmpeg service listening on port ${PORT}`);
  console.log('Health check available at /health');
  console.log('Server started successfully');
});

// Handle server errors
server.on('error', (err) => {
  console.error('Server error:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});
