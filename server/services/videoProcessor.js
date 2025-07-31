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
  try {
    console.log(`[VideoProcessor] Transcribing audio from ${audioPath} using WhisperX`);
    
    const audioFileName = path.basename(audioPath);
    const transcriptDir = path.join(process.cwd(), 'data', 'videos', 'transcripts');
    
    // Ensure transcript directory exists
    await fs.mkdir(transcriptDir, { recursive: true });
    
    // Check if WhisperX container is running
    try {
      const { stdout } = await execAsync('docker ps --format "{{.Names}}" | grep whisperx-service');
      if (!stdout.trim()) {
        throw new Error('WhisperX Docker container is not running. Please run: npm run docker:whisper:start');
      }
    } catch (error) {
      throw new Error('WhisperX Docker container is not running. Please run: npm run docker:whisper:start');
    }
    
    // Run WhisperX in the Docker container
    const command = `docker exec whisperx-service whisperx /app/audio/${audioFileName} --model base --language en --device cpu --output_format json --output_dir /app/output`;
    
    console.log(`[VideoProcessor] Running WhisperX command: ${command}`);
    const { stdout, stderr } = await execAsync(command);
    
    if (stderr && !stderr.includes('WARNING')) {
      console.error('[VideoProcessor] WhisperX stderr:', stderr);
    }
    
    // Read the generated transcript file
    const transcriptPath = path.join(transcriptDir, `${path.parse(audioFileName).name}.json`);
    
    // Wait a bit for the file to be written
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Check if transcript file exists
    try {
      await fs.access(transcriptPath);
    } catch (error) {
      throw new Error(`Transcript file not found at ${transcriptPath}. WhisperX may have failed.`);
    }
    
    const transcriptData = await fs.readFile(transcriptPath, 'utf-8');
    const transcript = JSON.parse(transcriptData);
    
    // Convert WhisperX format to our format
    const segments = transcript.segments || [];
    const fullText = segments.map(seg => seg.text).join(' ').trim();
    
    // Convert to our expected format
    const formattedTranscript = {
      rawSegments: segments.map(seg => ({
        text: seg.text,
        start: seg.start,
        duration: seg.end - seg.start,
        offset: seg.start * 1000 // Convert to milliseconds
      })),
      fullText: fullText
    };
    
    console.log(`[VideoProcessor] Transcription complete: ${fullText.length} characters`);
    
    // Clean up transcript file
    await fs.unlink(transcriptPath).catch(() => {});
    
    return formattedTranscript;
  } catch (error) {
    console.error('[VideoProcessor] Error transcribing audio:', error);
    throw new Error(`Failed to transcribe audio: ${error.message}`);
  }
}

function extractGoogleDriveId(url) {
  const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

function getGoogleDriveDirectUrl(fileId) {
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}
