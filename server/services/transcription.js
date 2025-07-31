import { YoutubeTranscript } from 'youtube-transcript';
import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
import { downloadVideo, transcribeVideo } from './videoProcessor.js';

// Import the prompts directly as constants since this is a JS file importing from TS
const SEGMENTATION_PROMPT = `You are a video content analyzer. I will provide you with a transcript from a video with timestamps. Your task is to segment this transcript based on specific signal phrases and create structured content.

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

INSTRUCTIONS:
1. Analyze the transcript and identify natural segment boundaries based on the signal phrases above
2. Each segment should have a clear start and end time based on the timestamps provided
3. Extract any key points or warnings that appear within each segment
4. Create descriptive titles for each segment
5. Preserve the exact timestamps from the input - do not modify them

For each segment, you must provide:
- A unique ID (format: "segment-{index}")
- A descriptive title summarizing the content
- The exact start time in seconds (from the transcript timestamps)
- The exact end time in seconds (from the transcript timestamps)
- The full text content of the segment
- The type: "step" if triggered by step phrases, otherwise "general"
- Any key points found (with their exact timestamps)
- Any warnings found (with their exact timestamps)

CRITICAL: The timestamps you return MUST match the timestamps from the input transcript. Do not round or modify them.

Return ONLY a valid JSON object with this exact structure:
{
  "segments": [
    {
      "id": "segment-1",
      "title": "Introduction to the Process",
      "startTime": 0.5,
      "endTime": 45.3,
      "text": "The actual text content from this time range...",
      "type": "general",
      "keyPoints": [
        {
          "text": "This is the important point text",
          "timestamp": 23.7
        }
      ],
      "warnings": [
        {
          "text": "Be careful when doing this",
          "timestamp": 38.2
        }
      ]
    }
  ]
}

Remember:
- Return ONLY the JSON object, no additional text
- All timestamps must be in seconds (not milliseconds)
- Use the exact timestamps from the input, do not modify them
- Include all text between startTime and endTime in the "text" field`;

const SYSTEM_PROMPT = 'You are a helpful assistant that analyzes video transcripts and creates meaningful segments. Always respond with valid JSON only, no additional text or markdown.';

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
      throw new Error('ANTHROPIC_API_KEY not configured. Please add it to your .env file.');
    }

    console.log('[Segmentation] Starting transcript segmentation...');
    console.log(`[Segmentation] Transcript has ${transcript.rawSegments.length} raw segments`);

    // Prepare the transcript data with timestamps
    const transcriptData = transcript.rawSegments.map(seg => ({
      text: seg.text,
      startTime: seg.start || seg.offset / 1000 || 0,
      endTime: seg.end || ((seg.offset + seg.duration) / 1000) || 0
    }));

    // Build the prompt
    const userPrompt = `${SEGMENTATION_PROMPT}

Video URL: ${videoUrl}

Transcript with timestamps:
${JSON.stringify(transcriptData, null, 2)}`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      temperature: 0,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: userPrompt
        }
      ]
    });

    console.log('[Segmentation] Received response from Claude');

    // Parse the response - Claude should return only JSON
    const responseText = message.content[0].text.trim();
    
    let result;
    try {
      // Try to parse the response directly
      result = JSON.parse(responseText);
    } catch (parseError) {
      console.error('[Segmentation] Failed to parse response as JSON:', responseText);
      
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Claude did not return valid JSON. Response: ' + responseText.substring(0, 200));
      }
      
      result = JSON.parse(jsonMatch[0]);
    }

    // Validate the response structure
    if (!result.segments || !Array.isArray(result.segments)) {
      throw new Error('Invalid response structure: missing segments array');
    }

    console.log(`[Segmentation] Successfully parsed ${result.segments.length} segments`);

    // Validate and clean up segments
    const validatedSegments = result.segments.map((seg, index) => {
      // Ensure required fields
      if (typeof seg.startTime !== 'number' || typeof seg.endTime !== 'number') {
        console.warn(`[Segmentation] Segment ${index} missing valid timestamps:`, seg);
      }

      return {
        id: seg.id || `segment-${Date.now()}-${index}`,
        title: seg.title || `Segment ${index + 1}`,
        startTime: Number(seg.startTime) || 0,
        endTime: Number(seg.endTime) || 0,
        text: seg.text || '',
        type: seg.type || 'general',
        keyPoints: Array.isArray(seg.keyPoints) ? seg.keyPoints : [],
        warnings: Array.isArray(seg.warnings) ? seg.warnings : []
      };
    });

    console.log('[Segmentation] Segmentation complete');
    return validatedSegments;
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
