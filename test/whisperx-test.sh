#!/bin/bash

# Test script for WhisperX integration
# This tests the direct WhisperX API and the full video processing pipeline

API_BASE="http://localhost:3001"
WHISPERX_BASE="http://localhost:9010"

echo "Testing WhisperX Integration"
echo "============================"

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if WhisperX is running
echo -e "\n${YELLOW}1. Checking WhisperX Service${NC}"
if curl -s -f "$WHISPERX_BASE/health" > /dev/null 2>&1 || curl -s -f "$WHISPERX_BASE/" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ WhisperX is running on port 9010${NC}"
else
    echo -e "${RED}✗ WhisperX is not accessible on port 9010${NC}"
    echo "  Please start it with: npm run docker:whisper:start"
    exit 1
fi

# Check if Node.js server is running
echo -e "\n${YELLOW}2. Checking Node.js Server${NC}"
if curl -s -f "$API_BASE/api/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Node.js server is running on port 3001${NC}"
else
    echo -e "${RED}✗ Node.js server is not running${NC}"
    echo "  Please start it with: npm run dev:server"
    exit 1
fi

# Test direct WhisperX API with a small audio file
echo -e "\n${YELLOW}3. Testing Direct WhisperX API${NC}"
# Create a small test audio file using ffmpeg (if available)
if command -v ffmpeg &> /dev/null; then
    ffmpeg -f lavfi -i "sine=frequency=1000:duration=2" -ac 1 -ar 16000 test-audio.wav -y > /dev/null 2>&1
    
    response=$(curl -s -w "\n%{http_code}" -X POST "$WHISPERX_BASE/asr" \
        -F "file=@test-audio.wav")
    http_code=$(echo "$response" | tail -n1)
    
    if [ "$http_code" = "200" ]; then
        echo -e "${GREEN}✓ WhisperX API test passed${NC}"
        echo "   Response: $(echo "$response" | head -n-1 | jq -c '.segments[0]' 2>/dev/null || echo "Valid response received")"
    else
        echo -e "${RED}✗ WhisperX API test failed (HTTP $http_code)${NC}"
    fi
    
    rm -f test-audio.wav
else
    echo "  Skipping (ffmpeg not available)"
fi

# Test video upload and transcription
echo -e "\n${YELLOW}4. Testing Video Upload and Transcription${NC}"

# Create a test video file
echo "Test video content" > test-video.mov

# Upload the video
echo "  Uploading test video..."
upload_response=$(curl -s -X POST "$API_BASE/api/videos/upload" \
    -F "video=@test-video.mov" \
    -F "title=WhisperX Test Video")

video_id=$(echo "$upload_response" | jq -r '.id' 2>/dev/null)

if [ -z "$video_id" ] || [ "$video_id" = "null" ]; then
    echo -e "${RED}✗ Failed to upload video${NC}"
    echo "   Response: $upload_response"
    rm -f test-video.mov
    exit 1
fi

echo -e "${GREEN}✓ Video uploaded successfully${NC}"
echo "   Video ID: $video_id"

# Transcribe the video
echo "  Transcribing video..."
transcribe_response=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE/api/videos/$video_id/transcribe")
http_code=$(echo "$transcribe_response" | tail -n1)

if [ "$http_code" = "200" ]; then
    echo -e "${GREEN}✓ Transcription completed${NC}"
    transcript_length=$(echo "$transcribe_response" | head -n-1 | jq -r '.transcript | length' 2>/dev/null || echo "0")
    echo "   Transcript length: $transcript_length characters"
else
    echo -e "${RED}✗ Transcription failed (HTTP $http_code)${NC}"
    error_msg=$(echo "$transcribe_response" | head -n-1 | jq -r '.error' 2>/dev/null || echo "Unknown error")
    echo "   Error: $error_msg"
fi

# Clean up
rm -f test-video.mov

echo -e "\n${YELLOW}5. Testing with Real Video File${NC}"
echo "To test with a real .mov file:"
echo "  curl -X POST $API_BASE/api/videos/upload \\"
echo "    -F \"video=@your-video.mov\" \\"
echo "    -F \"title=Your Video Title\""
echo ""
echo "Then transcribe it:"
echo "  curl -X POST $API_BASE/api/videos/{video-id}/transcribe"

echo -e "\n${GREEN}Test Complete!${NC}"
