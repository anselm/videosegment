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

    const prompt = `You are a video content analyzer. I will provide you with a transcript from a YouTube video. Your task is to segment this transcript into logical sections or chapters.

For each segment, provide:
1. A title that summarizes the main topic
2. The start time (in seconds)
3. The end time (in seconds)
4. A brief summary of what's discussed

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
      "text": "Brief summary of this segment"
    }
  ]
}

Focus on creating meaningful segments that represent distinct topics or sections in the video.`;

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
