import React, { useState, useEffect, useRef, useCallback, useLayoutEffect, useMemo } from 'react';
import type { Difficulty, DragInfo, GameState, Layout, Suit } from './types';
import { NUM_COLUMNS } from './consts';
import { bottomRunLength, columnTops, columnX, computeLayout, dealFromStock, dealsRemaining, findAutoMoveTarget, hitTest, isMovableRun, moveRun, nearestColumn, newGame } from './model'; // deal/move 返回 MoveOutcome
import { drawCardFace, drawGame, foundationLayout } from './render';
import GameToolbar from './GameToolbar';
import WinOverlay from './WinOverlay';

// ---------- React 组件 ----------
const SpiderSolitaire: React.FC = () => {
    const [state, setState] = useState<GameState | null>(() => newGame(1))
    const [history, setHistory] = useState<GameState[]>([])
    const [foundations, setFoundations] = useState<Suit[]>([])
    const foundationsRef = useRef<Suit[]>([])
    const [size, setSize] = useState({ w: 1000, h: 640 })
    const [drag, setDrag] = useState<DragInfo | null>(null)
    const [hoverCol, setHoverCol] = useState<number | null>(null)

    const containerRef = useRef<HTMLDivElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const dragRef = useRef<DragInfo | null>(null)
    const stateRef = useRef<GameState | null>(null)
    useEffect(() => {
        stateRef.current = state  // ✅ 在副作用中修改 ref
    }, [state])
    const animatingRef = useRef(false)
    const rafRef = useRef<number | null>(null) // 正在进行的动画
    const sizeRef = useRef(size)
    useEffect(() => {
        sizeRef.current = size  // ✅ 在副作用中修改 ref
    }, [size])

    // 响应式布局
    useLayoutEffect(() => {
        const el = containerRef.current
        if (!el) return
        const update = () => setSize({ w: el.clientWidth, h: el.clientHeight })
        update()
        const ro = new ResizeObserver(update)
        ro.observe(el)
        return () => ro.disconnect()
    }, [])

    const layout: Layout | null = useMemo(
        () => (state ? computeLayout(size.w, size.h, state) : null),
        [size.w, size.h, state],
    )

    // 右下角还能发几次牌
    const dealsLeft = state ? dealsRemaining(state) : 0

    const pushHistory = useCallback((prev: GameState) => {
        setHistory((h) => [...h.slice(-40), prev])
    }, [])

    /**
     * 收牌动画：把刚完成的整副序列（13 张同花 K..A）从完成列飞向左下角，
     * 动画结束后落定棋盘并在左下角新增一张对应花色的 K 牌。
     */
    const runCollect = useCallback(
        (
            collected: { col: number; suit: Suit; count: number }[],
            after: GameState,
            baseState: GameState,
            hide: { col: number; from: number }[],
        ) => {
            const commit = () => {
                foundationsRef.current = [...foundationsRef.current, ...collected.map((c) => c.suit)]
                setFoundations(foundationsRef.current)
                setState(after)
            }

            const canvas = canvasRef.current
            const ctx = canvas?.getContext("2d")
            const { w, h } = sizeRef.current
            if (!canvas || !ctx || collected.length === 0) {
                commit()
                return
            }

            const lay = computeLayout(w, h, after)
            const dpr = Math.min(window.devicePixelRatio || 1, 2)
            canvas.width = Math.round(lay.width * dpr)
            canvas.height = Math.round(lay.height * dpr)
            canvas.style.width = `${lay.width}px`
            canvas.style.height = `${lay.height}px`
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

            // 计算左下角目标槽位
            const totalSeq = collected.reduce((sum, c) => sum + c.count / 13, 0)
            const fl = foundationLayout(lay, foundationsRef.current.length + totalSeq)
            const startCount = foundationsRef.current.length
            const offUp = lay.offUp

            // 构造飞行幽灵牌：每副序列 13 张，从完成列底部向上堆叠起步
            const ghosts: { suit: Suit; rank: number; startX: number; startY: number; targetX: number; targetY: number }[] = []
            let fIdx = startCount
            for (const c of collected) {
                const seqs = c.count / 13
                const colArr = baseState.tableau[c.col]
                const tops = columnTops(colArr, lay)
                const bottomY = lay.topY + (tops.length ? tops[tops.length - 1] : 0)
                const x0 = columnX(c.col, lay)
                for (let seq = 0; seq < seqs; seq++) {
                    const slot = fIdx++
                    const targetX = fl.baseX + slot * fl.step
                    for (let i = 0; i < 13; i++) {
                        const startY = bottomY - (seq * 13 + i) * offUp
                        ghosts.push({ suit: c.suit, rank: 13 - i, startX: x0, startY, targetX, targetY: fl.baseY })
                    }
                }
            }

            const dur = 480
            const startTime = performance.now()
            const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)
            animatingRef.current = true

            const step = (now: number) => {
                const t = Math.min(1, (now - startTime) / dur)
                const e = easeInOut(t)
                drawGame(ctx, baseState, lay, {
                    drag: null,
                    hoverCol: null,
                    dealsLeft: dealsRemaining(baseState),
                    hide,
                    foundations: foundationsRef.current,
                })
                for (const g of ghosts) {
                    const x = g.startX + (g.targetX - g.startX) * e
                    const y = g.startY + (g.targetY - g.startY) * e
                    drawCardFace(ctx, { id: "ghost", suit: g.suit, rank: g.rank, faceUp: true }, x, y, lay)
                }
                if (t < 1) {
                    rafRef.current = requestAnimationFrame(step)
                } else {
                    animatingRef.current = false
                    rafRef.current = null
                    commit()
                }
            }

            rafRef.current = requestAnimationFrame(step)
        },
        [pushHistory],
    )

    // 数据变化时灰质画布
    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas || !state || !layout || animatingRef.current) return
        const ctx = canvas.getContext("2d")
        if (!ctx) return
        // window.devicePixelRatio 当前显示设备的物理像素分辨率与CSS 像素分辨率的比率
        // 告诉浏览器需要使用多少个屏幕上的实际像素来绘制一个 CSS 像素
        const dpr = Math.min(window.devicePixelRatio || 1, 2)
        canvas.width = Math.round(layout.width * dpr)
        canvas.height = Math.round(layout.height * dpr)
        canvas.style.width = `${layout.width}px`
        canvas.style.height = `${layout.height}px`
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        drawGame(ctx, state, layout, { drag, hoverCol, dealsLeft, foundations })
    }, [state, layout, drag, hoverCol, dealsLeft, foundations])

    const startNewGame = useCallback((difficulty: Difficulty) => {
        if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
        rafRef.current = null
        animatingRef.current = false
        setState(newGame(difficulty))
        setHistory([])
        foundationsRef.current = []
        setFoundations([])
        setDrag(null)
        dragRef.current = null
        setHoverCol(null)
    }, [])

    const handleUndo = useCallback(() => {
        setHistory((h) => {
            if (h.length === 0) return h
            const prev = h[h.length - 1]
            foundationsRef.current = foundationsRef.current.slice(0, prev.completed)
            setFoundations(foundationsRef.current)
            setState(prev)
            return h.slice(0, -1)
        })
    }, [])

    const handleDeal = useCallback(() => {
        if (animatingRef.current) return
        const s = stateRef.current
        if (!s) return
        const outcome = dealFromStock(s)
        if (!outcome) return
        const after = outcome.state
        pushHistory(s)

        const canvas = canvasRef.current
        const ctx = canvas?.getContext("2d")
        const { w, h } = sizeRef.current
        if (!canvas || !ctx) {
            setState(after)
            return
        }

        const lay = computeLayout(w, h, after)
        const dpr = Math.min(window.devicePixelRatio || 1, 2)
        canvas.width = Math.round(lay.width * dpr)
        canvas.height = Math.round(lay.height * dpr)
        canvas.style.width = `${lay.width}px`
        canvas.style.height = `${lay.height}px`
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

        // One flying card per column: from the stock pile to each column's new top.
        const flights: any = []
        for (let col = 0; col < NUM_COLUMNS; col++) {
            const column = after.tableau[col]
            const idx = column.length - 1
            const tops = columnTops(column, lay)
            flights.push({
                card: column[idx],
                fromX: lay.stock.x,
                fromY: lay.stock.y,
                toX: columnX(col, lay),
                toY: lay.topY + tops[idx],
            })
        }

        const dealsLeft = dealsRemaining(after)
        const stagger = 45 // ms between columns
        const flyDur = 260 // ms per card
        const total = stagger * (NUM_COLUMNS - 1) + flyDur
        const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)
        const start = performance.now()

        animatingRef.current = true

        const step = (now: number) => {
            const elapsed = now - start
            drawGame(ctx, after, lay, { drag: null, hoverCol: null, dealsLeft, hideTop: true, foundations: foundationsRef.current })
            for (let i = 0; i < flights.length; i++) {
                const f = flights[i]
                const p = Math.max(0, Math.min(1, (elapsed - i * stagger) / flyDur))
                const e = easeOut(p)
                const x = f.fromX + (f.toX - f.fromX) * e
                const y = f.fromY + (f.toY - f.fromY) * e
                drawCardFace(ctx, f.card, x, y, lay)
            }
            if (elapsed < total) {
                rafRef.current = requestAnimationFrame(step)
            } else {
                animatingRef.current = false
                rafRef.current = null
                // 发牌后若直接构成完整序列，播放收牌动画，否则直接落定
                if (outcome.collected.length > 0) {
                    runCollect(outcome.collected, after, after, [])
                } else {
                    setState(after)
                }
            }
        }

        rafRef.current = requestAnimationFrame(step)
    }, [ pushHistory ])

    // Cancel any running animation on unmount.
    useEffect(() => {
        return () => {
            if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
        }
    }, [])

    const attemptMove = useCallback(
        (fromCol: number, cardIndex: number, toCol: number) => {
            const s = stateRef.current
            if (!s) return
            const outcome = moveRun(s, fromCol, cardIndex, toCol)
            if (!outcome) return
            pushHistory(s)
            // 收牌动画期间把"被收走"的牌段隐藏：源列的拖动段 + 目标列底部已成型序列
            const bottomLen = bottomRunLength(s.tableau[toCol])
            runCollect(
                outcome.collected,
                outcome.state,
                s,
                [
                    { col: fromCol, from: cardIndex },
                    { col: toCol, from: bottomLen },
                ],
            )
        },
        [pushHistory],
    )

    const pointerToCanvas = useCallback((e: { clientX: number; clientY: number }) => {
        const canvas = canvasRef.current
        if (!canvas) return { x: 0, y: 0 }
        const rect = canvas.getBoundingClientRect()
        return { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }, [])

    const onPointerDown = useCallback(
        (e: React.PointerEvent<HTMLCanvasElement>) => {
            if (e.button !== 0) return
            const s = stateRef.current
            const lay = layout
            if (!s || !lay) return
            const { x, y } = pointerToCanvas(e)
            const hit = hitTest(x, y, s, lay)
            if (!hit) return

            if (hit.type === "stock") {
                handleDeal()
                return
            }

            const column = s.tableau[hit.col]
            if (!isMovableRun(column, hit.cardIndex)) return

            const cardX = columnX(hit.col, lay)
            const cardY = lay.topY + columnTops(column, lay)[hit.cardIndex]
            const ds: DragInfo = {
                fromCol: hit.col,
                cardIndex: hit.cardIndex,
                cards: column.slice(hit.cardIndex),
                offsetX: x - cardX,
                offsetY: y - cardY,
                x,
                y,
            }
            dragRef.current = ds
            setDrag(ds)
            setHoverCol(hit.col)
        },
        [layout, pointerToCanvas, handleDeal],
    )

    const onDoubleClick = useCallback(
        (e: React.MouseEvent<HTMLCanvasElement>) => {
            const s = stateRef.current
            const lay = layout
            if (!s || !lay) return
            const { x, y } = pointerToCanvas(e)
            const hit = hitTest(x, y, s, lay)
            if (!hit || hit.type !== "card") return
            if (!isMovableRun(s.tableau[hit.col], hit.cardIndex)) return
            const target = findAutoMoveTarget(s, hit.col, hit.cardIndex)
            if (target === null) return
            attemptMove(hit.col, hit.cardIndex, target)
        },
        [layout, pointerToCanvas, attemptMove],
    )

    // Global drag move / release.
    useEffect(() => {
        if (!drag) return

        const onMove = (e: PointerEvent) => {
            const cur = dragRef.current
            const lay = layout
            if (!cur || !lay) return
            const { x, y } = pointerToCanvas(e)
            const updated = { ...cur, x, y }
            dragRef.current = updated
            setDrag(updated)
            setHoverCol(nearestColumn(x, lay))
        }

        const onUp = (e: PointerEvent) => {
            const cur = dragRef.current
            const lay = layout
            if (!cur || !lay) {
                setDrag(null)
                dragRef.current = null
                setHoverCol(null)
                return
            }
            const { x } = pointerToCanvas(e)
            const toCol = nearestColumn(x, lay)
            if (toCol !== cur.fromCol) attemptMove(cur.fromCol, cur.cardIndex, toCol)
            dragRef.current = null
            setDrag(null)
            setHoverCol(null)
        }

        window.addEventListener("pointermove", onMove)
        window.addEventListener("pointerup", onUp)
        window.addEventListener("pointercancel", onUp)
        return () => {
            window.removeEventListener("pointermove", onMove)
            window.removeEventListener("pointerup", onUp)
            window.removeEventListener("pointercancel", onUp)
        }
    }, [drag, layout, pointerToCanvas, attemptMove])

    return (
        <main
            style={{
                background: 'radial-gradient(120% 100% at 50% 0%, #318454, #005732 70%)',
                // 供 GameToolbar / WinOverlay 使用的主题色变量
                '--gold': '#f5c542',
                '--card-red': '#d23b3b',
                '--card-face': '#fdfaf2',
                '--felt-dark': '#0a4d2c',
                '--card-black': '#233326',
            } as React.CSSProperties}
            className="relative flex h-full w-full flex-col overflow-hidden"
        >
            <GameToolbar
                difficulty={state?.difficulty ?? 1}
                score={state?.score ?? 500}
                moves={state?.moves ?? 0}
                completed={state?.completed ?? 0}
                dealsRemaining={dealsLeft}
                canUndo={history.length > 0}
                onNewGame={startNewGame}
                onUndo={handleUndo}
            />

            <div ref={containerRef} className="relative flex-1 overflow-hidden">
                <canvas
                    ref={canvasRef}
                    onPointerDown={onPointerDown}
                    onDoubleClick={onDoubleClick}
                    className="block touch-none select-none"
                    style={{ cursor: drag ? "grabbing" : "default" }}
                    aria-label="蜘蛛纸牌牌桌"
                    role="img"
                />
            </div>

            {state?.won && (
                <WinOverlay
                    score={state.score}
                    moves={state.moves}
                    onNewGame={() => startNewGame(state.difficulty)}
                />
            )}
        </main>
    );
};

export default SpiderSolitaire;