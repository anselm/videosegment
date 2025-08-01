#!/bin/bash

echo "Setting up Docker containers..."

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

# Create necessary directories
echo "Creating data directories..."
mkdir -p ../data/videos/audio
mkdir -p ../data/videos/transcripts
mkdir -p ../data/videos/files

# Build and start the containers
echo "Building and starting containers..."
docker compose up -d --build

# Wait for containers to be ready
echo "Waiting for services to be ready..."
sleep 10

# Check if containers are running
WHISPERX_RUNNING=$(docker ps | grep -q whisperx-api && echo "yes" || echo "no")
OLLAMA_RUNNING=$(docker ps | grep -q ollama-api && echo "yes" || echo "no")

if [ "$WHISPERX_RUNNING" = "yes" ] && [ "$OLLAMA_RUNNING" = "yes" ]; then
    echo "✅ All containers are running successfully!"
    echo ""
    echo "Services available:"
    echo "- WhisperX API: http://localhost:9010"
    echo "- Ollama API: http://localhost:11434"
    echo ""
    echo "Ollama is pulling the llama3.1:8b model in the background."
    echo "Check progress with: docker logs ollama-api"
    echo ""
    echo "To check all logs: docker compose logs"
    echo "To stop: docker compose down"
else
    echo "❌ Failed to start some containers"
    [ "$WHISPERX_RUNNING" = "no" ] && echo "- WhisperX is not running"
    [ "$OLLAMA_RUNNING" = "no" ] && echo "- Ollama is not running"
    echo "Check logs with: docker compose logs"
    exit 1
fi
