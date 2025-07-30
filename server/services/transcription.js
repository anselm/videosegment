import { YoutubeTranscript } from 'youtube-transcript';
import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';

dotenv.config();

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function getTranscript(videoUrl) {
  try {
    // Extract video ID from URL
    const videoId = extractVideoId(videoUrl);
    if (!videoId) {
      throw new Error('Invalid YouTube URL');
    }

    // Fetch transcript
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);
    
    // Combine all text segments
    const fullText = transcript
      .map(item => item.text)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

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
