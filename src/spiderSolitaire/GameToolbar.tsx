import type { Difficulty } from "./types"

type GameToolbarProps = {
    difficulty: Difficulty
    score: number
    moves: number
    completed: number
    dealsRemaining: number
    canUndo: boolean
    onNewGame: (d: Difficulty) => void
    onUndo: () => void
}

export function GameToolbar({
    difficulty,
    score,
    moves,
    completed,
    dealsRemaining,
    canUndo,
    onNewGame,
    onUndo,
}: GameToolbarProps) {
    const DIFFICULTY_LABEL: Record<Difficulty, string> = {
        1: "1 花色",
        2: "2 花色",
        4: "4 花色",
    }
    return (
        <header className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 sm:px-5">
            <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 text-[var(--gold)]">
                    <h1 className="text-lg font-bold tracking-tight text-white sm:text-xl">
                        蜘蛛纸牌
                    </h1>
                </div>
                <div className="ml-1 flex rounded-full bg-black/20 p-0.5 ring-1 ring-white/10">
                    {([1, 2, 4] as Difficulty[]).map((d) => (
                        <button
                            key={d}
                            type="button"
                            onClick={() => onNewGame(d)}
                            className={
                                `rounded-full px-2.5 py-1 text-xs font-medium transition-colors sm:text-sm ${
                                    d === difficulty
                                        ? 'bg-[var(--gold)] text-black shadow'
                                        : 'text-white hover:bg-white/15'
                                }`
                            }
                            aria-pressed={d === difficulty}
                        >
                            {DIFFICULTY_LABEL[d]}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex items-center gap-2">
                <Stat label="得分" value={score} />
                <Stat label="步数" value={moves} />
                <Stat
                    label="完成"
                    value={
                        <span className="flex items-center gap-1">
                            {completed}/8
                        </span>
                    }
                />
                <Stat label="剩余发牌" value={dealsRemaining} />
            </div>

            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={onUndo}
                    disabled={!canUndo}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-sm font-medium text-white ring-1 ring-white/25 transition hover:bg-white/25 disabled:cursor-not-allowed disabled:opacity-40"
                >
                    撤销
                </button>
                <button
                    type="button"
                    onClick={() => onNewGame(difficulty)}
                    className="rounded-lg bg-[var(--gold)] px-3 py-1.5 text-sm font-semibold text-black shadow transition hover:brightness-105"
                >
                    新游戏
                </button>
            </div>
        </header>
    )
}

export default GameToolbar

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="flex min-w-[52px] flex-col items-center rounded-lg bg-black/20 px-2.5 py-1 ring-1 ring-white/10">
            <span className="text-[10px] uppercase tracking-wide text-white/60">{label}</span>
            <span className="text-sm font-bold tabular-nums text-white">{value}</span>
        </div>
    )
}