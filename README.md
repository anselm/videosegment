# Video Transcription App

A React + Express application for managing YouTube video transcriptions and segmentation.

## Architecture

- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Backend**: Express.js server
- **Development**: Concurrent frontend and backend servers with proxy configuration
- **Production**: Express serves the built React app as static files

## Getting Started

### Quick Start (Recommended)

The easiest way to run the application is using the combined build and serve command:

```bash
# Install dependencies
npm install

# Build the React app and start the server
npm run build:serve
```

This single command will:
1. Build the React frontend into optimized static files
2. Start the Express server which serves both the API and the built frontend
3. Open http://localhost:3001 in your browser

**Note:** The frontend and backend are integrated - the Express server serves the React app. You don't need to run them separately in production mode.

### Development Mode

For active development with hot reloading:

```bash
npm run dev
```

This starts:
- Frontend dev server with hot reload on http://localhost:5173
- Backend API server on http://localhost:3001
- Automatic proxying between them

### Production Deployment

For production environments:

```bash
# Build the frontend first
npm run build

# Then start the production server
npm run start
```

Or use the combined command:
```bash
npm run build:serve
```

## Project Structure

```
├── server/              # Express backend
│   └── index.js        # Server entry point
├── src/                # React frontend
│   ├── components/     # React components
│   ├── hooks/          # Custom React hooks
│   ├── services/       # API service layer
│   └── types/          # TypeScript types
├── dist/               # Built frontend (generated)
└── package.json        # Project dependencies
```

## API Endpoints

- `GET /api/health` - Health check
- `GET /api/videos` - Get all videos
- `POST /api/videos` - Add a new video from URL
- `POST /api/videos/upload` - Upload a video file directly
- `GET /api/videos/:id` - Get video details
- `PUT /api/videos/:id` - Update video
- `POST /api/videos/:id/transcribe` - Transcribe video only
- `POST /api/videos/:id/segment` - Segment video (requires transcript)
- `POST /api/videos/:id/process` - Process video (transcribe + segment)

## Features

- **Multiple Video Sources**:
  - YouTube videos (with automatic caption fetching)
  - Google Drive videos
  - Direct video file URLs
  - Upload local video files (MOV, MP4, AVI, WebM, MKV, OGG)
  
- **Transcription**:
  - Automatic YouTube caption extraction
  - WhisperX integration for audio transcription
  - Direct MOV file support without preprocessing
  
- **AI-Powered Segmentation**:
  - Smart segmentation using Claude AI
  - Signal phrase detection:
    - **Step markers**: "Next step", "New Step", "Moving on", etc.
    - **Key points**: "Key Point", "This is important", "Remember", etc.
    - **Warnings**: "Watch out", "Be careful", "Warning", "Dangerous"
  - Visual highlighting: warnings (red), key points (yellow)
  
- **User Interface**:
  - Video list with thumbnails (YouTube)
  - Embedded video player (YouTube)
  - Real-time processing status
  - File upload with drag-and-drop support
  
- **Technical Features**:
  - Server-side filesystem storage (JSON)
  - Concurrent request handling
  - Progress tracking for long operations

## Data Storage

Videos are stored as JSON files in the `data/videos/` directory on the server. Each video is saved as a separate file with its unique ID as the filename.

## Environment Variables

Create a `.env` file in the root directory with:

```
PORT=3001
NODE_ENV=development
ANTHROPIC_API_KEY=your_claude_api_key_here
FRONTEND_URL=http://localhost:5173
```

## System Requirements

For processing non-YouTube videos, you need:

- **Docker** and **Docker Compose** installed on your system
  - [Install Docker](https://docs.docker.com/get-docker/)
  - Docker Compose is included with Docker Desktop

- **FFmpeg** installed on your system for audio extraction
  - macOS: `brew install ffmpeg`
  - Ubuntu/Debian: `sudo apt-get install ffmpeg`
  - Windows: Download from [ffmpeg.org](https://ffmpeg.org/download.html)

- **WhisperX** Docker container for speech-to-text on non-YouTube videos
  - Automatically pulled when you run the setup

## WhisperX Setup

WhisperX is used for transcribing non-YouTube videos. It runs in a Docker container.

### Quick Start

1. Start WhisperX container:
   ```bash
   npm run docker:whisper:start
   ```

2. Check if it's running:
   ```bash
   docker ps | grep whisperx-service
   ```

3. View logs:
   ```bash
   npm run docker:whisper:logs
   ```

4. Stop when done:
   ```bash
   npm run docker:whisper:stop
   ```

### Manual Setup

If you prefer to set up manually:

```bash
cd docker
chmod +x setup.sh
./setup.sh
```

### WhisperX Configuration

The WhisperX container is configured to:
- Use the `base` model (can be changed in `docker/docker-compose.yml`)
- Run on CPU by default (change to `cuda` for GPU support)
- Process audio files from `data/videos/audio/`
- Save transcripts to `data/videos/transcripts/`

## Future Enhancements

### Immediate Improvements
- **Database Integration**: Replace filesystem storage with PostgreSQL/MongoDB for better scalability
- **Authentication & User Management**: Add user accounts with OAuth2 support
- **Background Job Queue**: Implement Redis/Bull for processing long-running transcription tasks
- **Real-time Updates**: Add WebSocket support for live transcription progress
- **Batch Processing**: Support multiple video uploads and processing

### Advanced Features
- **Multi-language Support**: Extend WhisperX to handle multiple languages with auto-detection
- **Custom Vocabulary**: Allow users to add domain-specific terms for better transcription accuracy
- **Export Options**: Generate SRT/VTT subtitles, PDF transcripts, and chapter markers
- **Video Editing Integration**: Add trim/cut functionality before transcription
- **Collaborative Features**: Share and collaborate on video segments with team members

### AI Enhancements
- **Smart Summarization**: Generate executive summaries of video content
- **Topic Extraction**: Automatically identify and tag main topics discussed
- **Speaker Diarization**: Identify and label different speakers in the video
- **Sentiment Analysis**: Analyze tone and sentiment throughout the video
- **Custom AI Prompts**: Allow users to define their own segmentation rules

### Platform Integrations
- **Cloud Storage**: Direct integration with Dropbox, OneDrive, and S3
- **Video Platforms**: Support for Vimeo, Dailymotion, and other platforms
- **LMS Integration**: Export to Moodle, Canvas, and other learning platforms
- **API & Webhooks**: Full REST API for third-party integrations
- **Mobile Apps**: Native iOS/Android apps for on-the-go access

### Performance & Scale
- **CDN Integration**: Serve videos through CloudFront or similar
- **Horizontal Scaling**: Kubernetes deployment with auto-scaling
- **Caching Layer**: Redis caching for frequently accessed transcripts
- **GPU Acceleration**: Support for CUDA-enabled WhisperX processing
- **Streaming Transcription**: Process videos while they're being uploaded
