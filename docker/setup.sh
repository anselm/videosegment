#!/bin/bash

echo "Setting up WhisperX Docker container..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "Error: Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is available
if ! docker compose version &> /dev/null; then
    echo "Error: Docker Compose is not available. Please ensure Docker Desktop is installed with Compose plugin."
    exit 1
fi

# Pull the WhisperX image
echo "Pulling WhisperX Docker image..."
docker pull thomasvvugt/whisperx:latest

# Create necessary directories
echo "Creating data directories..."
mkdir -p ../data/videos/audio
mkdir -p ../data/videos/transcripts
mkdir -p ../data/videos/files

# Start the container
echo "Starting WhisperX container..."
docker compose up -d

# Check if container is running
if docker ps | grep -q whisperx-service; then
    echo "✅ WhisperX container is running successfully!"
    echo ""
    echo "You can now transcribe non-YouTube videos."
    echo "To check logs: npm run docker:whisper:logs"
    echo "To stop: npm run docker:whisper:stop"
else
    echo "❌ Failed to start WhisperX container"
    echo "Check logs with: docker compose logs"
    exit 1
fi
