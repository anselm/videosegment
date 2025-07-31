# WhisperX Docker Setup

This directory contains the Docker configuration for running WhisperX, which is used for transcribing non-YouTube videos.

## Prerequisites

- Docker Desktop installed on your system (includes Docker Compose plugin)
- Or Docker Engine with Docker Compose plugin installed

## Starting WhisperX

From the project root directory, run:

```bash
npm run docker:whisper:start
```

Or manually from the docker directory:

```bash
docker compose up -d
```

## Stopping WhisperX

```bash
npm run docker:whisper:stop
```

Or manually:

```bash
docker compose down
```

## Configuration

The WhisperX service is configured to:
- Use the `base` model by default (you can change this to `small`, `medium`, `large`, etc.)
- Run on CPU by default (change `DEVICE=cuda` if you have GPU support)
- Mount the audio directory for input files at `/app/audio`
- Mount the transcripts directory for output files at `/app/output`
- Uses the ghcr.io/jim60105/whisperx Docker image from GitHub Container Registry

## Checking Status

To check if WhisperX is running:

```bash
docker ps | grep whisperx-service
```

To view logs:

```bash
docker logs whisperx-service
```
