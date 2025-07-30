import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import VideoList from './components/VideoList'
import VideoDetail from './components/VideoDetail'

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-black">
        <Routes>
          <Route path="/" element={<VideoList />} />
          <Route path="/video/:id" element={<VideoDetail />} />
        </Routes>
      </div>
    </Router>
  )
}

export default App
