import { Link } from 'react-router-dom'

export default function Home() {
  return (
    <div className="grid grid-cols-8 min-w-[960px] p-6">
      <Link to="/gomoku">五子棋</Link>
      <Link to="/chinese-chess">中国象棋</Link>
      <Link to="/spider-solitaire">蜘蛛纸牌</Link>
    </div>
  )
}