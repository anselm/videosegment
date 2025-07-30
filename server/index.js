import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Video-related API endpoints will go here
app.get('/api/videos', (req, res) => {
  // Placeholder for future implementation
  res.json({ videos: [] });
});

app.post('/api/videos', (req, res) => {
  // Placeholder for future implementation
  const { url } = req.body;
  res.json({ 
    id: Date.now().toString(),
    url,
    message: 'Video processing will be implemented here' 
  });
});

app.get('/api/videos/:id', (req, res) => {
  // Placeholder for future implementation
  const { id } = req.params;
  res.json({ 
    id,
    message: 'Video details will be implemented here' 
  });
});

// Serve static files from the React app in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(join(__dirname, '../dist')));
  
  app.get('*', (req, res) => {
    res.sendFile(join(__dirname, '../dist', 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
