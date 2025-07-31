import { YoutubeTranscript } from 'youtube-transcript';
import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
import { downloadVideo, transcribeVideo } from './videoProcessor.js';

dotenv.config();

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function getTranscript(videoUrl, videoType, videoId) {
  try {
    console.log(`[Transcription] Processing URL: ${videoUrl}, Type: ${videoType}`);
    
    if (videoType === 'youtube') {
      // Extract video ID from URL
      const youtubeId = extractVideoId(videoUrl);
      if (!youtubeId) {
        throw new Error(`Invalid YouTube URL: ${videoUrl}`);
      }
      
      console.log(`[Transcription] Extracted YouTube video ID: ${youtubeId}`);
      return await getYouTubeTranscript(youtubeId);
    } else {
      // Handle non-YouTube videos (including uploads)
      console.log(`[Transcription] Processing non-YouTube video: ${videoType}`);
      return await getVideoFileTranscript(videoUrl, videoType, videoId);
    }
  } catch (error) {
    console.error('Error fetching YouTube transcript:', error);
    throw error;
  }
}

async function getVideoFileTranscript(videoUrl, videoType, videoId) {
  try {
    let videoPath;
    
    if (videoType === 'upload' && videoUrl.startsWith('file://')) {
      // For uploaded files, use the path directly
      videoPath = videoUrl.replace('file://', '');
      console.log(`[Transcription] Using uploaded video file: ${videoPath}`);
    } else {
      // Download the video
      videoPath = await downloadVideo(videoUrl, videoId, videoType);
    }
    
    // Transcribe video directly using WhisperX
    const transcript = await transcribeVideo(videoPath, videoId);
    
    console.log(`[Transcription] Video file transcript obtained: ${transcript.fullText.length} characters`);
    
    return transcript;
  } catch (error) {
    console.error('Error processing video file:', error);
    if (error.message.includes('WhisperX service is not running')) {
      throw new Error('WhisperX service is not running. Please ensure it is running on port 9010.');
    }
    throw new Error(`Failed to process video file: ${error.message}`);
  }
}

async function getYouTubeTranscript(youtubeId) {
  try {

    // Fetch transcript
    let transcript;
    try {
      console.log(`[Transcription] Attempting to fetch transcript for YouTube video ID: ${youtubeId}`);
      transcript = await YoutubeTranscript.fetchTranscript(youtubeId);
      console.log(`[Transcription] Raw transcript response:`, transcript ? `${transcript.length} segments` : 'null/undefined');
      
      // Log first few segments for debugging
      if (transcript && transcript.length > 0) {
        console.log(`[Transcription] First segment:`, transcript[0]);
      }
    } catch (error) {
      console.error(`[Transcription] Error fetching transcript:`, error.message);
      if (error.message.includes('Transcript is disabled')) {
        throw new Error('Captions are disabled for this video. Please try a video with captions enabled.');
      } else if (error.message.includes('Could not find')) {
        throw new Error('No captions found for this video. The video must have captions/subtitles for transcription.');
      } else if (error.message.includes('not available')) {
        throw new Error('Captions not available for this video. This may be due to age restrictions or regional limitations.');
      } else if (error.message.includes('video is private')) {
        throw new Error('This video is private and cannot be accessed.');
      }
      throw error;
    }
    
    // Validate transcript data
    if (!transcript || transcript.length === 0) {
      console.warn(`[Transcription] Empty transcript received for YouTube video ID: ${youtubeId}`);
      throw new Error('No captions available for this video. The video must have captions/subtitles enabled for transcription to work.');
    }

    // Combine all text segments
    const fullText = transcript
      .map(item => item.text || '')
      .filter(text => text.length > 0)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!fullText || fullText.length === 0) {
      throw new Error('Transcript segments contain no text content');
    }

    console.log(`[Transcription] Successfully extracted transcript: ${fullText.length} characters`);

    // Return both raw segments and combined text
    return {
      rawSegments: transcript,
      fullText: fullText
    };
  } catch (error) {
    console.error('Error fetching transcript:', error);
    throw new Error(`Failed to fetch transcript: ${error.message}`);
  }
}

export async function segmentTranscript(transcript, videoUrl) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    const prompt = `You are a video content analyzer. I will provide you with a transcript from a YouTube video. Your task is to segment this transcript based on specific signal phrases and create structured content.

IMPORTANT SIGNAL PHRASES TO DETECT:

1. STEP/SEGMENT TRIGGERS (these phrases indicate a new segment/step):
   - "Next step"
   - "New Step"
   - "Step complete"
   - "Now we will"
   - "Break here"
   - "Let's move on"
   - "Moving on"
   - "End Step"

2. KEY POINT/REASON TRIGGERS (mark these as important highlights):
   - "Key Point"
   - "Key Reason"
   - "This is important"
   - "An important point"
   - "Remember"
   - "Something to remember"
   - "You want to do this because"
   - "The reason we do this is"

3. WARNING TRIGGERS (these need special emphasis):
   - "Watch out"
   - "Be careful"
   - "Warning"
   - "Dangerous"

For each segment, provide:
1. A title that summarizes the main topic or step
2. The start time (in seconds)
3. The end time (in seconds)
4. The full text content of the segment
5. Any key points found within the segment
6. Any warnings found within the segment
7. The type of segment (step, general, or auto-detected)

The video URL is: ${videoUrl}

Here's the transcript with timestamps:
${JSON.stringify(transcript.rawSegments, null, 2)}

Please return the segments in the following JSON format:
{
  "segments": [
    {
      "id": "unique-id",
      "title": "Segment Title",
      "startTime": 0,
      "endTime": 120,
      "text": "Full text content of this segment",
      "type": "step" | "general",
      "keyPoints": [
        {
          "text": "Important point text",
          "timestamp": 45
        }
      ],
      "warnings": [
        {
          "text": "Warning text",
          "timestamp": 60
        }
      ]
    }
  ]
}

IMPORTANT: 
- Look for the signal phrases (case-insensitive) to determine segment boundaries
- When you find a step trigger phrase, create a new segment starting from that point
- Extract key points and warnings based on the trigger phrases
- If no explicit signal phrases are found, create logical segments based on topic changes
- Include the actual spoken text in the segments, not just summaries`;

    const message = await anthropic.messages.create({
      model: 'claude-3-sonnet-20240229',
      max_tokens: 4000,
      temperature: 0,
      system: 'You are a helpful assistant that analyzes video transcripts and creates meaningful segments. Always respond with valid JSON.',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    // Parse the response
    const responseText = message.content[0].text;
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse segmentation response');
    }

    const result = JSON.parse(jsonMatch[0]);
    
    // Add unique IDs if not present
    if (result.segments) {
      result.segments = result.segments.map((seg, index) => ({
        ...seg,
        id: seg.id || `segment-${Date.now()}-${index}`
      }));
    }

    return result.segments || [];
  } catch (error) {
    console.error('Error segmenting transcript:', error);
    throw new Error(`Failed to segment transcript: ${error.message}`);
  }
}

function extractVideoId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
    /youtube\.com\/embed\/([^&\n?#]+)/,
    /youtube\.com\/v\/([^&\n?#]+)/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}
