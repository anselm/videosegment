import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import fetch from 'node-fetch';

const VIDEOS_DIR = path.join(process.cwd(), 'data', 'videos', 'files');

// Ensure directories exist
async function ensureDirectories() {
  await fs.mkdir(VIDEOS_DIR, { recursive: true });
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


export async function transcribeVideo(videoPath, videoId) {
  try {
    console.log(`[VideoProcessor] Transcribing video from ${videoPath} using WhisperX`);
    
    // Read the video file
    const videoBuffer = await fs.readFile(videoPath);
    
    // Create form data
    const formData = new FormData();
    const blob = new Blob([videoBuffer], { type: 'video/mp4' });
    formData.append('file', blob, path.basename(videoPath));
    
    // Send to WhisperX API
    const response = await fetch('http://localhost:9010/asr', {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`WhisperX API error: ${response.status} - ${errorText}`);
    }
    
    const transcript = await response.json();
    
    // Log the response structure for debugging
    console.log(`[VideoProcessor] WhisperX response structure:`, {
      hasSegments: !!transcript.segments,
      segmentCount: transcript.segments?.length || 0,
      firstSegment: transcript.segments?.[0] || null
    });
    
    // Convert WhisperX format to our format
    const segments = transcript.segments || [];
    const fullText = segments.map(seg => seg.text).join(' ').trim();
    
    // Convert to our expected format with proper timestamps
    const formattedTranscript = {
      rawSegments: segments.map(seg => ({
        text: seg.text,
        start: seg.start,
        end: seg.end,
        duration: seg.end - seg.start,
        offset: seg.start * 1000 // Convert to milliseconds
      })),
      fullText: fullText
    };
    
    console.log(`[VideoProcessor] Transcription complete: ${fullText.length} characters, ${segments.length} segments with timestamps`);
    
    return formattedTranscript;
  } catch (error) {
    console.error('[VideoProcessor] Error transcribing video:', error);
    if (error.message.includes('ECONNREFUSED')) {
      throw new Error('WhisperX service is not running. Please ensure it is running on port 9010.');
    }
    throw new Error(`Failed to transcribe video: ${error.message}`);
  }
}

function extractGoogleDriveId(url) {
  const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

function getGoogleDriveDirectUrl(fileId) {
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}
