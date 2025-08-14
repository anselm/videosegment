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
  res.json({ status: 'ok', service: 'ffmpeg' });
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
    
    const result = {
      duration,
      width: videoStream?.width || 0,
      height: videoStream?.height || 0,
      fps: eval(videoStream?.r_frame_rate) || 30,
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
app.listen(PORT, () => {
  console.log(`FFmpeg service listening on port ${PORT}`);
});
