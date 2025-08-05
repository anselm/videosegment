// MongoDB initialization script for vector search setup
// Authenticate as admin first
db = db.getSiblingDB('admin');
db.auth('admin', 'admin123');

// Switch to videosegment database
db = db.getSiblingDB('videosegment');

// Create collections
db.createCollection('videos');
db.createCollection('segments');
db.createCollection('embeddings');

// Create indexes for vector search
db.embeddings.createIndex({
  "embedding": "cosmosSearch"
}, {
  "cosmosSearchOptions": {
    "kind": "vector-ivf",
    "numLists": 1,
    "similarity": "COS",
    "dimensions": 1536
  }
});

// Create regular indexes
db.videos.createIndex({ "videoId": 1 }, { unique: true });
db.segments.createIndex({ "videoId": 1 });
db.segments.createIndex({ "startTime": 1 });
db.embeddings.createIndex({ "videoId": 1 });
db.embeddings.createIndex({ "segmentId": 1 });

print("MongoDB initialized with vector search support");
