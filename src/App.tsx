import { Link, Route, Routes } from 'react-router-dom'
import './App.css'
import ChessPage from './chess'

function HomePage() {
  return <div>欢迎来到首页</div>
}

function App() {
  return (
    <div>
      <nav style={{ marginBottom: 16 }}>
        <Link to="/" style={{ marginRight: 12 }}>
          Home
        </Link>
        <Link to="/chess">ChessPage</Link>
      </nav>

      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/chess" element={<ChessPage />} />
      </Routes>
    </div>
  )
}

export default App
