import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const FILMSTRIP_DIR = join(__dirname, '../../data/videos/filmstrips');

export async function generateFilmstrip(videoPath, videoId, frameCount = 100) {
  try {
    // Check if ffmpeg is available
    try {
      await execAsync('ffmpeg -version');
    } catch (error) {
      throw new Error('FFmpeg is not installed. Please install FFmpeg on your system.');
    }
    
    // Clean up the video path if it has file:// prefix
    const cleanVideoPath = videoPath.replace('file://', '');
    
    // Create directory for this video's filmstrip
    const videoFilmstripDir = join(FILMSTRIP_DIR, videoId);
    await fs.mkdir(videoFilmstripDir, { recursive: true });
    
    // Get video duration first
    const metadata = await getVideoMetadata(cleanVideoPath);
    const duration = metadata.duration;
    
    // Calculate interval between frames
    const interval = duration / frameCount;
    
    const frames = [];
    
    // Generate frames using ffmpeg
    console.log(`[Filmstrip] Generating ${frameCount} frames for video ${videoId}`);
    
    for (let i = 0; i < frameCount; i++) {
      const timestamp = i * interval;
      const outputPath = join(videoFilmstripDir, `frame_${i}.jpg`);
      
      // Use ffmpeg to extract frame at specific timestamp
      const command = `ffmpeg -ss ${timestamp} -i "${cleanVideoPath}" -vframes 1 -q:v 2 -y "${outputPath}"`;
      
      try {
        await execAsync(command);
        
        // Get frame dimensions
        const dimensionsCommand = `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "${outputPath}"`;
        const { stdout } = await execAsync(dimensionsCommand);
        const [width, height] = stdout.trim().split('x').map(Number);
        
        frames.push({
          timestamp,
          url: `/api/videos/${videoId}/filmstrip/${i}`,
          width,
          height
        });
      } catch (error) {
        console.error(`[Filmstrip] Error generating frame ${i}:`, error.message);
      }
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
    // Check if ffprobe is available
    try {
      await execAsync('ffprobe -version');
    } catch (error) {
      throw new Error('FFprobe is not installed. Please install FFmpeg (which includes ffprobe) on your system.');
    }
    
    // Clean up the video path if it has file:// prefix
    const cleanVideoPath = videoPath.replace('file://', '');
    
    // Use ffprobe to get video metadata
    const command = `ffprobe -v quiet -print_format json -show_format -show_streams "${cleanVideoPath}"`;
    const { stdout } = await execAsync(command);
    const metadata = JSON.parse(stdout);
    
    // Extract relevant information
    const videoStream = metadata.streams.find(s => s.codec_type === 'video');
    const duration = parseFloat(metadata.format.duration);
    
    return {
      duration,
      width: videoStream?.width || 0,
      height: videoStream?.height || 0,
      fps: eval(videoStream?.r_frame_rate) || 30, // Evaluate frame rate fraction
      codec: videoStream?.codec_name || 'unknown',
      bitrate: parseInt(metadata.format.bit_rate) || 0
    };
  } catch (error) {
    console.error('[Filmstrip] Error getting video metadata:', error);
    throw new Error(`Failed to get video metadata: ${error.message}`);
  }
}
