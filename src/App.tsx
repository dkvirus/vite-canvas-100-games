import { Route, Routes } from 'react-router-dom'
import './App.css'
import Home from './home'
import Gomoku from './gomoku'
import ChineseChess from './chineseChess'
import SpiderSolitaire from './spiderSolitaire'

function App() {
  return (
    <div className="bg-white w-full h-full mx-auto">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/gomoku" element={<Gomoku />} />
        <Route path="/chinese-chess" element={<ChineseChess />} />
        <Route path="/spider-solitaire" element={<SpiderSolitaire />} />
      </Routes>
    </div>
  )
}

export default App
