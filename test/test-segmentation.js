#!/usr/bin/env node

// Test script for segmentation functionality
import { segmentTranscript } from '../server/services/transcription.js';
import dotenv from 'dotenv';

dotenv.config();

// Test transcript with clear signal phrases
const testTranscript = {
  rawSegments: [
    { text: "Welcome to this tutorial.", start: 0, end: 3 },
    { text: "Today we'll learn about video editing.", start: 3, end: 6 },
    { text: "Key point: Always backup your files.", start: 6, end: 9 },
    { text: "Let's move on to the first technique.", start: 9, end: 12 },
    { text: "Next step is to import your footage.", start: 12, end: 15 },
    { text: "Be careful not to delete original files.", start: 15, end: 18 },
    { text: "This is important: organize your timeline.", start: 18, end: 21 },
    { text: "Now we will add transitions.", start: 21, end: 24 },
    { text: "Warning: This can crash older computers.", start: 24, end: 27 },
    { text: "Step complete. Moving on to color grading.", start: 27, end: 30 }
  ],
  fullText: "Welcome to this tutorial. Today we'll learn about video editing. Key point: Always backup your files. Let's move on to the first technique. Next step is to import your footage. Be careful not to delete original files. This is important: organize your timeline. Now we will add transitions. Warning: This can crash older computers. Step complete. Moving on to color grading."
};

async function testSegmentation() {
  console.log('Testing Segmentation with Claude...\n');

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ ANTHROPIC_API_KEY not set in .env file');
    process.exit(1);
  }

  try {
    console.log('Sending transcript to Claude for segmentation...');
    const segments = await segmentTranscript(testTranscript, 'https://example.com/test-video');
    
    console.log('\n✅ Segmentation successful!\n');
    console.log('Segments received:', segments.length);
    console.log('\nSegment details:');
    
    segments.forEach((segment, index) => {
      console.log(`\n--- Segment ${index + 1} ---`);
      console.log(`ID: ${segment.id}`);
      console.log(`Title: ${segment.title}`);
      console.log(`Type: ${segment.type}`);
      console.log(`Time: ${segment.startTime}s - ${segment.endTime}s`);
      console.log(`Text: ${segment.text.substring(0, 100)}...`);
      
      if (segment.keyPoints && segment.keyPoints.length > 0) {
        console.log(`Key Points: ${segment.keyPoints.length}`);
        segment.keyPoints.forEach(kp => {
          console.log(`  - "${kp.text}" at ${kp.timestamp}s`);
        });
      }
      
      if (segment.warnings && segment.warnings.length > 0) {
        console.log(`Warnings: ${segment.warnings.length}`);
        segment.warnings.forEach(w => {
          console.log(`  - "${w.text}" at ${w.timestamp}s`);
        });
      }
    });

    // Verify signal phrases were detected
    const hasStepSegments = segments.some(s => s.type === 'step');
    const hasKeyPoints = segments.some(s => s.keyPoints && s.keyPoints.length > 0);
    const hasWarnings = segments.some(s => s.warnings && s.warnings.length > 0);

    console.log('\n--- Detection Summary ---');
    console.log(`Step segments detected: ${hasStepSegments ? '✅' : '❌'}`);
    console.log(`Key points detected: ${hasKeyPoints ? '✅' : '❌'}`);
    console.log(`Warnings detected: ${hasWarnings ? '✅' : '❌'}`);

  } catch (error) {
    console.error('\n❌ Segmentation failed:', error.message);
    process.exit(1);
  }
}

testSegmentation();
