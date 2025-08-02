import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import VideoList from './components/VideoList'
import VideoDetail from './components/VideoDetail'
import VideoEditor from './components/VideoEditor'

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-black">
        <Routes>
          <Route path="/" element={<VideoList />} />
          <Route path="/video/:id" element={<VideoDetail />} />
          <Route path="/video/:id/edit" element={<VideoEditor />} />
        </Routes>
      </div>
    </Router>
  )
}

export default App
