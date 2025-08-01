#!/bin/bash

# Start Ollama service
ollama serve &

# Wait for Ollama to be ready
echo "Waiting for Ollama to start..."
sleep 5

# Pull the llama3.1:8b model
echo "Pulling llama3.1:8b model..."
ollama pull llama3.1:8b

# Keep the container running
wait
