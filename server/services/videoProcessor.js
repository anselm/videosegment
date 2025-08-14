import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import fetch from 'node-fetch';
import FormData from 'form-data';

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
    
    // Check if WhisperX service URL is configured
    const whisperxUrl = process.env.WHISPERX_API_URL || 'http://localhost:9010';
    console.log(`[VideoProcessor] Using WhisperX service at: ${whisperxUrl}`);
    
    // First check if the service is healthy
    try {
      const healthResponse = await fetch(`${whisperxUrl}/health`, { timeout: 5000 });
      if (!healthResponse.ok) {
        console.warn(`[VideoProcessor] WhisperX health check failed: ${healthResponse.status}`);
      } else {
        const healthData = await healthResponse.json();
        console.log(`[VideoProcessor] WhisperX service is healthy:`, healthData);
      }
    } catch (healthError) {
      console.warn(`[VideoProcessor] WhisperX health check error:`, healthError.message);
    }
    
    // Read the video file
    const videoBuffer = await fs.readFile(videoPath);
    console.log(`[VideoProcessor] Read video file: ${videoBuffer.length} bytes`);
    
    // Create form data using Node.js FormData
    const formData = new FormData();
    formData.append('file', videoBuffer, {
      filename: path.basename(videoPath),
      contentType: getContentType(videoPath)
    });
    
    // Send to WhisperX API with timeout
    console.log(`[VideoProcessor] Sending ${videoBuffer.length} bytes to WhisperX service`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minute timeout
    
    try {
      const response = await fetch(`${whisperxUrl}/asr`, {
        method: 'POST',
        body: formData,
        headers: formData.getHeaders(),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        let errorText;
        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const errorData = await response.json();
            errorText = errorData.detail || errorData.error || JSON.stringify(errorData);
          } else {
            errorText = await response.text();
          }
          console.error(`[VideoProcessor] WhisperX error response:`, errorText);
        } catch (e) {
          errorText = `Unable to read error response: ${e.message}`;
        }
        throw new Error(`WhisperX API error: ${response.status} - ${errorText}`);
      }
      
      const transcript = await response.json();
      
      // Log the response structure for debugging
      console.log(`[VideoProcessor] WhisperX response structure:`, {
        hasText: !!transcript.text,
        textLength: transcript.text?.length || 0,
        hasSegments: !!transcript.segments,
        segmentCount: transcript.segments?.length || 0,
        firstSegment: transcript.segments?.[0] || null
      });
      
      // Convert WhisperX format to our format
      const segments = transcript.segments || [];
      const fullText = transcript.text || segments.map(seg => seg.text).join(' ').trim();
      
      if (!fullText || fullText.length === 0) {
        throw new Error('WhisperX returned empty transcript');
      }
      
      // Convert to our expected format with proper timestamps
      const formattedTranscript = {
        rawSegments: segments.map(seg => ({
          text: seg.text || '',
          start: seg.start || 0,
          end: seg.end || 0,
          duration: (seg.end || 0) - (seg.start || 0),
          offset: (seg.start || 0) * 1000 // Convert to milliseconds
        })),
        fullText: fullText
      };
      
      console.log(`[VideoProcessor] Transcription complete: ${fullText.length} characters, ${segments.length} segments with timestamps`);
      
      return formattedTranscript;
    } catch (fetchError) {
      clearTimeout(timeoutId);
      throw fetchError;
    }
  } catch (error) {
    console.error('[VideoProcessor] Error transcribing video:', error);
    if (error.name === 'AbortError') {
      throw new Error('WhisperX transcription timed out after 5 minutes. The video may be too large or the service is overloaded.');
    }
    if (error.message.includes('ECONNREFUSED')) {
      const whisperxUrl = process.env.WHISPERX_API_URL || 'http://localhost:9010';
      throw new Error(`WhisperX service is not running. Please ensure it is running at ${whisperxUrl}.`);
    }
    if (error.message.includes('ENOTFOUND')) {
      throw new Error('Cannot connect to WhisperX service. Please check the service URL and network connectivity.');
    }
    if (error.message.includes('libctranslate2') || error.message.includes('executable stack')) {
      throw new Error('WhisperX service has library compatibility issues. Try rebuilding the container with: docker-compose build --no-cache whisperx');
    }
    if (error.message.includes('500') && error.message.includes('Transcription failed')) {
      throw new Error(`WhisperX transcription failed. This may be due to library compatibility issues. Try: 1) Rebuild container: docker-compose build --no-cache whisperx, 2) Check container logs: docker logs whisperx-api`);
    }
    throw new Error(`Failed to transcribe video: ${error.message}`);
  }
}

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentTypes = {
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime',
    '.avi': 'video/x-msvideo',
    '.webm': 'video/webm',
    '.mkv': 'video/x-matroska',
    '.ogg': 'video/ogg'
  };
  return contentTypes[ext] || 'video/mp4';
}

function extractGoogleDriveId(url) {
  const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

function getGoogleDriveDirectUrl(fileId) {
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}
