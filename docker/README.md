# Docker Services Setup

This directory contains the Docker configuration for running WhisperX and Ollama services.

## Services

### WhisperX
Used for transcribing non-YouTube videos with OpenAI's Whisper model.

### Ollama
Local LLM service with llama3.1:8b model for video segmentation and analysis.

## Prerequisites

- Docker Desktop installed on your system (includes Docker Compose plugin)
- Or Docker Engine with Docker Compose plugin installed

## Starting Services

From the project root directory, run:

```bash
npm run docker:start
```

Or manually from the docker directory:

```bash
docker compose up -d --build
```

## Stopping Services

```bash
npm run docker:stop
```

Or manually:

```bash
docker compose down
```

## Configuration

### WhisperX
- Uses the `base` model by default (you can change this to `small`, `medium`, `large`, etc.)
- Runs on CPU by default (change `DEVICE=cuda` if you have GPU support)
- Available at http://localhost:9010

### Ollama
- Automatically pulls and runs llama3.1:8b model
- Available at http://localhost:11434
- Data persisted in ollama-data volume

## Checking Status

To check if services are running:

```bash
docker ps
```

To view logs:

```bash
# All services
docker compose logs

# Specific service
docker logs whisperx-api
docker logs ollama-api
```

## Troubleshooting

If Ollama is not responding, check if the model is still being downloaded:

```bash
docker logs ollama-api
```

The llama3.1:8b model is about 4.7GB and may take time to download on first run.
