import { useState } from "react"
import type { Suit } from "./types"
import { SUIT_SYMBOL } from "./consts"

type WinOverlayProps = {
    score: number
    moves: number
    onNewGame: () => void
}

const CONFETTI_SUITS: Suit[] = ["spades", "hearts", "diamonds", "clubs"]

export function WinOverlay({ score, moves, onNewGame }: WinOverlayProps) {
    const [confetti] = useState(() =>
        Array.from({ length: 40 }, (_, i) => ({
            id: i,
            left: Math.random() * 100,
            delay: Math.random() * 2.5,
            duration: 3 + Math.random() * 2.5,
            suit: CONFETTI_SUITS[i % 4],
            red: i % 4 === 1 || i % 4 === 2,
            size: 14 + Math.random() * 20,
        }))
    )

    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/50 backdrop-blur-sm">
            {confetti.map((c) => (
                <span
                    key={c.id}
                    aria-hidden="true"
                    className="absolute top-0"
                    style={{
                        left: `${c.left}%`,
                        fontSize: c.size,
                        color: c.red ? "var(--card-red)" : "var(--gold)",
                        animation: `spider-fall ${c.duration}s linear ${c.delay}s infinite`,
                    }}
                >
                    {SUIT_SYMBOL[c.suit]}
                </span>
            ))}

            <div
                className="spider-pop relative z-10 mx-4 flex w-full max-w-sm flex-col items-center gap-3 rounded-3xl p-8 text-center shadow-2xl ring-1 ring-[var(--gold)]/40"
                style={{
                    background:
                        'linear-gradient(160deg, #fffdf7 0%, #fdf3da 55%, #f6e7be 100%)',
                }}
            >
                <h2 className="text-3xl font-black text-[var(--felt-dark)] drop-shadow-sm">
                    恭喜通关！
                </h2>
                <p className="text-sm text-[var(--card-black)]/70">
                    你已成功整理全部 8 组牌。
                </p>
                <div className="my-2 flex gap-8">
                    <div className="flex flex-col items-center">
                        <span className="text-3xl font-bold tabular-nums text-[var(--felt-dark)]">
                            {score}
                        </span>
                        <span className="mt-0.5 text-xs uppercase tracking-wider text-[var(--card-black)]/55">
                            得分
                        </span>
                    </div>
                    <div className="flex flex-col items-center">
                        <span className="text-3xl font-bold tabular-nums text-[var(--felt-dark)]">
                            {moves}
                        </span>
                        <span className="mt-0.5 text-xs uppercase tracking-wider text-[var(--card-black)]/55">
                            步数
                        </span>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={onNewGame}
                    className="mt-2 rounded-xl bg-[var(--gold)] px-6 py-2.5 font-semibold text-[#3a2a00] shadow-lg shadow-[var(--gold)]/30 transition hover:brightness-105 active:scale-95"
                >
                    再玩一局
                </button>
            </div>
        </div>
    )
}

export default WinOverlay
