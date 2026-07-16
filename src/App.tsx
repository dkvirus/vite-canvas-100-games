import { Route, Routes } from 'react-router-dom'
import './App.css'
import Home from './home'
import Gomoku from './gomoku'
import ChineseChess from './chineseChess'

function App() {
  return (
    <div className="bg-white rounded-2xl w-fit h-full mx-auto p-4">
      {/* <nav style={{ marginBottom: 16 }}>
        <Link to="/" style={{ marginRight: 12 }}>
          首页
        </Link>
      </nav> */}

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/gomoku" element={<Gomoku />} />
        <Route path="/chinese-chess" element={<ChineseChess />} />
      </Routes>
    </div>
  )
}

export default App
