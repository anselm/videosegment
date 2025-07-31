# Video Transcription App

A React + Express application for managing YouTube video transcriptions and segmentation.

## Architecture

- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Backend**: Express.js server
- **Development**: Concurrent frontend and backend servers with proxy configuration
- **Production**: Express serves the built React app as static files

## Getting Started

### Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run both frontend and backend in development mode:
   ```bash
   npm run dev
   ```

   This will start:
   - Frontend dev server on http://localhost:5173
   - Backend API server on http://localhost:3001

### Production Build

1. Build the frontend:
   ```bash
   npm run build
   ```

2. Start the production server:
   ```bash
   npm run server
   ```

   Or use the combined command to build and serve:
   ```bash
   npm run build:serve
   ```

   For production deployment:
   ```bash
   npm run start
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
- `POST /api/videos` - Add a new video
- `GET /api/videos/:id` - Get video details
- `PUT /api/videos/:id` - Update video
- `POST /api/videos/:id/transcribe` - Transcribe video only
- `POST /api/videos/:id/segment` - Segment video (requires transcript)
- `POST /api/videos/:id/process` - Process video (transcribe + segment)

## Features

- Add videos from multiple sources:
  - YouTube videos (with automatic caption fetching)
  - Google Drive videos
  - Direct video file URLs
- View video list with thumbnails (YouTube only)
- Video detail page with embedded player (YouTube only)
- Automatic YouTube transcript fetching
- Video download and audio extraction for non-YouTube sources
- AI-powered transcript segmentation using Claude
- Server-side filesystem storage (JSON files)
- Processing status tracking
- Smart segmentation based on signal phrases:
  - **Step detection**: "Next step", "New Step", "Moving on", etc.
  - **Key points**: "Key Point", "This is important", "Remember", etc.
  - **Warnings**: "Watch out", "Be careful", "Warning", "Dangerous"
- Visual highlighting of warnings (red) and key points (yellow)

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

- **FFmpeg** installed on your system for audio extraction
  - macOS: `brew install ffmpeg`
  - Ubuntu/Debian: `sudo apt-get install ffmpeg`
  - Windows: Download from [ffmpeg.org](https://ffmpeg.org/download.html)

- **Whisper** (future requirement) for speech-to-text on non-YouTube videos
  - Will be implemented as a Docker container or API service

## Future Enhancements

- Server-side video processing
- YouTube API integration
- Transcription service integration
- Video segmentation algorithm
- Database persistence (replace filesystem)
- Authentication
