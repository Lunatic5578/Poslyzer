import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import RecordPage from './pages/RecordPage'; // Combined page


function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/record" element={<RecordPage />} />
      </Routes>
    </Router>
  );
}

export default App