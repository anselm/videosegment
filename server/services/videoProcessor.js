import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import fetch from 'node-fetch';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const VIDEOS_DIR = path.join(process.cwd(), 'data', 'videos', 'files');
const AUDIO_DIR = path.join(process.cwd(), 'data', 'videos', 'audio');

// Ensure directories exist
async function ensureDirectories() {
  await fs.mkdir(VIDEOS_DIR, { recursive: true });
  await fs.mkdir(AUDIO_DIR, { recursive: true });
}

ensureDirectories();

export async function downloadVideo(url, videoId, videoType) {
  try {
    console.log(`[VideoProcessor] Downloading video ${videoId} from ${url}`);
    
    let downloadUrl = url;
    
    // Handle Google Drive URLs
    if (videoType === 'googledrive') {
      const driveId = extractGoogleDriveId(url);
      if (!driveId) {
        throw new Error('Invalid Google Drive URL');
      }
      downloadUrl = getGoogleDriveDirectUrl(driveId);
    }
    
    const response = await fetch(downloadUrl);
    if (!response.ok) {
      throw new Error(`Failed to download video: ${response.statusText}`);
    }
    
    // Determine file extension
    const contentType = response.headers.get('content-type');
    let extension = '.mp4'; // default
    if (contentType) {
      if (contentType.includes('webm')) extension = '.webm';
      else if (contentType.includes('ogg')) extension = '.ogg';
      else if (contentType.includes('quicktime')) extension = '.mov';
    }
    
    const videoPath = path.join(VIDEOS_DIR, `${videoId}${extension}`);
    const fileStream = createWriteStream(videoPath);
    
    await pipeline(response.body, fileStream);
    
    console.log(`[VideoProcessor] Video downloaded to ${videoPath}`);
    return videoPath;
  } catch (error) {
    console.error('[VideoProcessor] Error downloading video:', error);
    throw error;
  }
}

export async function extractAudio(videoPath, videoId) {
  try {
    console.log(`[VideoProcessor] Extracting audio from ${videoPath}`);
    
    const audioPath = path.join(AUDIO_DIR, `${videoId}.wav`);
    
    // Use ffmpeg to extract audio
    // -i input file
    // -vn no video
    // -acodec pcm_s16le audio codec
    // -ar 16000 sample rate (16kHz is good for speech)
    // -ac 1 mono audio
    const command = `ffmpeg -i "${videoPath}" -vn -acodec pcm_s16le -ar 16000 -ac 1 "${audioPath}" -y`;
    
    await execAsync(command);
    
    console.log(`[VideoProcessor] Audio extracted to ${audioPath}`);
    return audioPath;
  } catch (error) {
    console.error('[VideoProcessor] Error extracting audio:', error);
    throw error;
  }
}

export async function transcribeAudio(audioPath, videoId) {
  // Placeholder for Whisper integration
  // In production, this would call a Whisper API or run a dockerized Whisper instance
  console.log(`[VideoProcessor] Transcribing audio from ${audioPath}`);
  
  // For now, return a placeholder
  throw new Error('Audio transcription not yet implemented. Whisper integration required.');
  
  // Future implementation:
  // const whisperCommand = `docker run --rm -v ${AUDIO_DIR}:/audio whisper:latest /audio/${videoId}.wav`;
  // const result = await execAsync(whisperCommand);
  // return parseWhisperOutput(result.stdout);
}

function extractGoogleDriveId(url) {
  const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

function getGoogleDriveDirectUrl(fileId) {
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}
