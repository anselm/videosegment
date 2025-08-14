import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fetch from 'node-fetch';
import FormData from 'form-data';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const FILMSTRIP_DIR = join(__dirname, '../../data/videos/filmstrips');
const FFMPEG_API_URL = process.env.FFMPEG_API_URL || 'http://localhost:9020';

export async function generateFilmstrip(videoPath, videoId, frameCount = 100) {
  try {
    // Clean up the video path if it has file:// prefix
    const cleanVideoPath = videoPath.replace('file://', '');
    
    // Create directory for this video's filmstrip
    const videoFilmstripDir = join(FILMSTRIP_DIR, videoId);
    await fs.mkdir(videoFilmstripDir, { recursive: true });
    
    // Read video file
    const videoBuffer = await fs.readFile(cleanVideoPath);
    
    // Create form data
    const formData = new FormData();
    formData.append('video', videoBuffer, {
      filename: 'video.mp4',
      contentType: 'video/mp4'
    });
    formData.append('frameCount', frameCount.toString());
    formData.append('videoId', videoId);
    
    // Call FFmpeg service
    console.log(`[Filmstrip] Generating ${frameCount} frames for video ${videoId} using FFmpeg service`);
    
    const response = await fetch(`${FFMPEG_API_URL}/filmstrip`, {
      method: 'POST',
      body: formData,
      headers: formData.getHeaders()
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to generate filmstrip');
    }
    
    const result = await response.json();
    const frames = [];
    
    // Save frames to disk
    for (const frame of result.frames) {
      const outputPath = join(videoFilmstripDir, `frame_${frame.index}.jpg`);
      
      // Extract base64 data and save to file
      const base64Data = frame.data.replace(/^data:image\/jpeg;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      await fs.writeFile(outputPath, buffer);
      
      frames.push({
        timestamp: frame.timestamp,
        url: `/api/videos/${videoId}/filmstrip/${frame.index}`,
        width: 1920, // Default dimensions, could be extracted from metadata
        height: 1080
      });
    }
    
    console.log(`[Filmstrip] Generated ${frames.length} frames successfully`);
    return frames;
  } catch (error) {
    console.error('[Filmstrip] Error generating filmstrip:', error);
    throw new Error(`Failed to generate filmstrip: ${error.message}`);
  }
}

export async function getVideoMetadata(videoPath) {
  try {
    // Clean up the video path if it has file:// prefix
    const cleanVideoPath = videoPath.replace('file://', '');
    
    // Read video file
    const videoBuffer = await fs.readFile(cleanVideoPath);
    
    // Create form data
    const formData = new FormData();
    formData.append('video', videoBuffer, {
      filename: 'video.mp4',
      contentType: 'video/mp4'
    });
    
    // Call FFmpeg service
    const response = await fetch(`${FFMPEG_API_URL}/metadata`, {
      method: 'POST',
      body: formData,
      headers: formData.getHeaders()
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get video metadata');
    }
    
    const metadata = await response.json();
    return metadata;
  } catch (error) {
    console.error('[Filmstrip] Error getting video metadata:', error);
    throw new Error(`Failed to get video metadata: ${error.message}`);
  }
}
