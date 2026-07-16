import React, { useCallback, useEffect, useRef, useState } from 'react';

// ==================== 常量 ====================
const SIZE = 19;            // 棋盘线数（可改，例如 13 / 15 / 19）
const CELL = 40;            // 逻辑格距（绘制坐标系，实际尺寸由缩放比自适应）
const MARGIN_RATIO = 0.8;   // 边距占格距的比例
const STONE_RATIO = 0.42;   // 棋子半径占格距的比例
const MARGIN = CELL * MARGIN_RATIO;
const STONE_R = CELL * STONE_RATIO;
const BOARD_LOGICAL = MARGIN * 2 + CELL * (SIZE - 1); // 逻辑边长
const EMPTY = 0;
const BLACK = 1;
const WHITE = 2;

// 根据 SIZE 动态生成星位坐标
const buildStarPoints = (size: number): [number, number][] => {
    const off = size >= 13 ? 3 : 2;
    const center = (size - 1) / 2;
    const pts: [number, number][] = [
        [off, off], [off, size - 1 - off],
        [size - 1 - off, off], [size - 1 - off, size - 1 - off],
    ];
    if (size % 2 === 1) pts.push([center, center]);
    return pts;
};
const STAR_POINTS: [number, number][] = buildStarPoints(SIZE);

type Cell = 0 | 1 | 2;
type Board = Cell[][];
interface Move { r: number; c: number; player: Cell; }

// ==================== 纯逻辑函数 ====================
const createBoard = (): Board => Array.from({ length: SIZE }, () => Array<Cell>(SIZE).fill(EMPTY));
const inBounds = (r: number, c: number): boolean => r >= 0 && r < SIZE && c >= 0 && c < SIZE;

// 判断在 (r,c) 落 player 子后是否形成五连
const checkWin = (board: Board, r: number, c: number, player: Cell): boolean => {
    const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
    for (const [dr, dc] of dirs) {
        let count = 1;
        let rr = r + dr, cc = c + dc;
        while (inBounds(rr, cc) && board[rr][cc] === player) { count++; rr += dr; cc += dc; }
        rr = r - dr; cc = c - dc;
        while (inBounds(rr, cc) && board[rr][cc] === player) { count++; rr -= dr; cc -= dc; }
        if (count >= 5) return true;
    }
    return false;
};

// 评估在 (r,c) 放 player 子后，某方向上形成的连子价值
const dirScore = (board: Board, r: number, c: number, player: Cell, dr: number, dc: number): number => {
    let count = 0, rr = r + dr, cc = c + dc;
    while (inBounds(rr, cc) && board[rr][cc] === player) { count++; rr += dr; cc += dc; }
    const posOpen = inBounds(rr, cc) && board[rr][cc] === EMPTY;
    let count2 = 0; rr = r - dr; cc = c - dc;
    while (inBounds(rr, cc) && board[rr][cc] === player) { count2++; rr -= dr; cc -= dc; }
    const negOpen = inBounds(rr, cc) && board[rr][cc] === EMPTY;
    const total = count + count2 + 1;
    if (total >= 5) return 100000;
    const open = (posOpen ? 1 : 0) + (negOpen ? 1 : 0);
    if (total === 4) return open === 2 ? 10000 : (open === 1 ? 1000 : 0);
    if (total === 3) return open === 2 ? 1000 : (open === 1 ? 100 : 0);
    if (total === 2) return open === 2 ? 100 : (open === 1 ? 10 : 0);
    if (total === 1) return open === 2 ? 10 : 1;
    return 0;
};

// 综合评估在 (r,c) 放置 player 子的得分（四方向求和）
const evaluatePoint = (board: Board, r: number, c: number, player: Cell): number => {
    if (board[r][c] !== EMPTY) return -1;
    board[r][c] = player;
    const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
    let sum = 0;
    for (const [dr, dc] of dirs) sum += dirScore(board, r, c, player, dr, dc);
    board[r][c] = EMPTY;
    return sum;
};

const hasNeighbor = (board: Board, r: number, c: number, dist: number): boolean => {
    for (let dr = -dist; dr <= dist; dr++) {
        for (let dc = -dist; dc <= dist; dc++) {
            const rr = r + dr, cc = c + dc;
            if (inBounds(rr, cc) && board[rr][cc] !== EMPTY) return true;
        }
    }
    return false;
};

// AI：返回最佳落子点（进攻 + 防守加权）
const getAIMove = (board: Board, aiPlayer: Cell): { r: number; c: number } | null => {
    const opp: Cell = aiPlayer === BLACK ? WHITE : BLACK;
    let best: { r: number; c: number } | null = null;
    let bestScore = -1;
    for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
            if (board[r][c] !== EMPTY) continue;
            if (!hasNeighbor(board, r, c, 2)) continue; // 只考虑已有棋子附近的落点
            const atk = evaluatePoint(board, r, c, aiPlayer);
            const def = evaluatePoint(board, r, c, opp);
            const s = atk + def * 0.9; // 略微偏向进攻
            if (s > bestScore) { bestScore = s; best = { r, c }; }
        }
    }
    if (!best) best = { r: 7, c: 7 };
    return best;
};

// 落子音效：用 Web Audio API 即时合成短促“咔嗒”声，无需音频文件
let audioCtx: AudioContext | null = null;
const playStoneSound = (): void => {
    try {
        if (!audioCtx) {
            const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
            audioCtx = new Ctx();
        }
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const ctx = audioCtx;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(420, now);
        osc.frequency.exponentialRampToValueAtTime(180, now + 0.08);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.35, now + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.13);
    } catch {
        /* 音频不可用时静默忽略 */
    }
};

// ==================== React 组件 ====================
const Gomoku: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const canvasContainerRef = useRef<HTMLDivElement>(null);
    const [board, setBoard] = useState<Board>(() => createBoard());
    const [history, setHistory] = useState<Move[]>([]);
    const [currentPlayer, setCurrentPlayer] = useState<Cell>(BLACK);
    const [lastMove, setLastMove] = useState<{ r: number; c: number } | null>(null);
    const [gameOver, setGameOver] = useState(false);
    const [winner, setWinner] = useState<Cell | null>(null);
    const [aiThinking, setAiThinking] = useState(false);
    const boardScaleRef = useRef(1); // 逻辑坐标 -> 实际像素的缩放比
    const [redraw, setRedraw] = useState(0); // 尺寸变化触发重绘

    // 画布尺寸自适应移动端（参考中国象棋实现）
    useEffect(() => {
        const resizeCanvas = () => {
            const canvas = canvasRef.current;
            const container = canvasContainerRef.current;
            if (!canvas || !container) return;

            const maxViewportHeight = Math.max(0, window.innerHeight - 260);
            const widthByContainer = container.clientWidth;
            const widthByHeight = maxViewportHeight; // 棋盘为正方形，宽高比 1:1
            const displaySize = Math.min(widthByContainer, widthByHeight);
            const ratio = window.devicePixelRatio || 1;
            const boardScale = displaySize / BOARD_LOGICAL;
            boardScaleRef.current = boardScale;

            canvas.style.width = `${displaySize}px`;
            canvas.style.height = `${displaySize}px`;
            canvas.width = Math.round(displaySize * ratio);
            canvas.height = Math.round(displaySize * ratio);

            const ctx = canvas.getContext('2d');
            if (ctx) ctx.setTransform(ratio * boardScale, 0, 0, ratio * boardScale, 0, 0);
            setRedraw(t => t + 1);
        };

        resizeCanvas();
        const observer = new ResizeObserver(() => resizeCanvas());
        if (canvasContainerRef.current) observer.observe(canvasContainerRef.current);
        window.addEventListener('resize', resizeCanvas);
        return () => {
            observer.disconnect();
            window.removeEventListener('resize', resizeCanvas);
        };
    }, []);

    const drawStone = (ctx: CanvasRenderingContext2D, x: number, y: number, player: Cell) => {
        const grad = ctx.createRadialGradient(x - STONE_R * 0.3, y - STONE_R * 0.3, STONE_R * 0.1, x, y, STONE_R);
        if (player === BLACK) { grad.addColorStop(0, '#666'); grad.addColorStop(1, '#000'); }
        else { grad.addColorStop(0, '#fff'); grad.addColorStop(1, '#bbb'); }
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, STONE_R, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();
    };

    // 绘制棋盘（使用逻辑坐标系，缩放由 canvas transform 处理）
    const draw = useCallback((ctx: CanvasRenderingContext2D) => {
        // 木质背景
        ctx.fillStyle = '#e3b66b';
        ctx.fillRect(0, 0, BOARD_LOGICAL, BOARD_LOGICAL);

        // 网格线
        ctx.strokeStyle = '#5a3a1a';
        ctx.lineWidth = 1;
        for (let i = 0; i < SIZE; i++) {
            const p = MARGIN + i * CELL;
            ctx.beginPath(); ctx.moveTo(MARGIN, p); ctx.lineTo(MARGIN + CELL * (SIZE - 1), p); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(p, MARGIN); ctx.lineTo(p, MARGIN + CELL * (SIZE - 1)); ctx.stroke();
        }

        // 星位
        ctx.fillStyle = '#5a3a1a';
        const starR = Math.max(2, CELL * 0.11);
        for (const [r, c] of STAR_POINTS) {
            ctx.beginPath();
            ctx.arc(MARGIN + c * CELL, MARGIN + r * CELL, starR, 0, Math.PI * 2);
            ctx.fill();
        }

        // 棋子
        for (let r = 0; r < SIZE; r++) {
            for (let c = 0; c < SIZE; c++) {
                if (board[r][c] !== EMPTY) {
                    drawStone(ctx, MARGIN + c * CELL, MARGIN + r * CELL, board[r][c]);
                }
            }
        }

        // 最后一手标记
        if (lastMove) {
            const x = MARGIN + lastMove.c * CELL;
            const y = MARGIN + lastMove.r * CELL;
            ctx.strokeStyle = '#e74c3c';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(x, y, STONE_R * 0.5, 0, Math.PI * 2);
            ctx.stroke();
        }
    }, [board, lastMove]);

    // 渲染（canvas 变换已在 resizeCanvas 中设置，此处仅重绘）
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        draw(ctx);
    }, [draw, redraw]);

    // AI 落子
    const scheduleAI = useCallback((boardForAI: Board, aiPlayer: Cell) => {
        setAiThinking(true);
        setCurrentPlayer(WHITE);
        window.setTimeout(() => {
            const move = getAIMove(boardForAI, aiPlayer);
            if (move) {
                const nb = boardForAI.map(row => [...row]) as Board;
                nb[move.r][move.c] = aiPlayer;
                setBoard(nb);
                setHistory(prev => [...prev, { r: move.r, c: move.c, player: aiPlayer }]);
                setLastMove({ r: move.r, c: move.c });
                playStoneSound();
                if (checkWin(nb, move.r, move.c, aiPlayer)) {
                    setGameOver(true);
                    setWinner(aiPlayer);
                } else {
                    setCurrentPlayer(BLACK);
                }
            }
            setAiThinking(false);
        }, 300);
    }, []);

    // 玩家落子
    const handleClick = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
        if (gameOver || aiThinking) return;
        if (currentPlayer === WHITE) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        if (boardScaleRef.current <= 0) return;
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * BOARD_LOGICAL / rect.width;
        const y = (e.clientY - rect.top) * BOARD_LOGICAL / rect.height;
        const c = Math.round((x - MARGIN) / CELL);
        const r = Math.round((y - MARGIN) / CELL);
        if (!inBounds(r, c)) return;
        if (board[r][c] !== EMPTY) return;

        const nb = board.map(row => [...row]) as Board;
        nb[r][c] = currentPlayer;
        setBoard(nb);
        setHistory(prev => [...prev, { r, c, player: currentPlayer }]);
        setLastMove({ r, c });
        playStoneSound();

        if (checkWin(nb, r, c, currentPlayer)) {
            setGameOver(true);
            setWinner(currentPlayer);
            return;
        }

        const next: Cell = currentPlayer === BLACK ? WHITE : BLACK;
        if (next === WHITE) {
            scheduleAI(nb, WHITE);
        }
    }, [board, currentPlayer, gameOver, aiThinking, scheduleAI]);

    // 悔棋
    const undo = useCallback(() => {
        if (aiThinking) return;
        const hist = [...history];
        if (hist.length === 0) return;
        const pops = Math.min(2, hist.length);
        for (let i = 0; i < pops; i++) hist.pop();
        const nb = createBoard();
        let last: { r: number; c: number } | null = null;
        for (const m of hist) { nb[m.r][m.c] = m.player; last = { r: m.r, c: m.c }; }
        setBoard(nb);
        setHistory(hist);
        setLastMove(last);
        setGameOver(false);
        setWinner(null);
        setCurrentPlayer(hist.length === 0 ? BLACK : (hist[hist.length - 1].player === BLACK ? WHITE : BLACK));
    }, [history, aiThinking]);

    // 重新开始
    const restart = useCallback(() => {
        setBoard(createBoard());
        setHistory([]);
        setLastMove(null);
        setGameOver(false);
        setWinner(null);
        setCurrentPlayer(BLACK);
        setAiThinking(false);
    }, []);

    // 状态文案
    const message = gameOver
        ? (winner === BLACK ? '黑方胜利！' : '白方胜利！')
        : aiThinking
            ? '电脑思考中…'
            : currentPlayer === WHITE
                ? '电脑回合'
                : '轮到你落子（黑方）'

    return (
        <div className="rounded-2xl max-w-[960px] w-full">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h1 className="text-2xl m-0 text-[#333]">⚫⚪ 五子棋</h1>
                <div className="flex flex-wrap items-center justify-center gap-2">
                    <button onClick={undo} className="px-3.5 py-1.5 border-2 border-[#667eea] rounded-[20px] bg-[#667eea] text-white cursor-pointer font-bold">悔棋</button>
                    <button onClick={restart} className="px-3.5 py-1.5 border-2 border-[#ff6b6b] rounded-[20px] bg-[#ff6b6b] text-white cursor-pointer font-bold">重新开始</button>
                </div>
            </div>

            <div className="relative flex justify-center w-full">
                <div ref={canvasContainerRef} className="w-full max-w-[840px] max-h-[calc(100vh-260px)] mx-auto px-3 box-border">
                    <canvas
                        ref={canvasRef}
                        onPointerDown={handleClick}
                        className={`block mx-auto rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.15)] touch-none ${gameOver || aiThinking ? 'cursor-default' : 'cursor-pointer'}`}
                    />
                </div>
            </div>

            <div className="flex items-center justify-center mt-4 px-4 py-3 bg-[#f7f7f7] rounded-lg">
                <span className={gameOver ? 'text-[18px] font-bold text-[#e74c3c]' : 'text-sm text-[#666]'}>
                    {message}
                </span>
            </div>

            {gameOver && winner && (
                <div className="fixed inset-0 flex flex-col items-center justify-center bg-black/45 z-[1000]">
                    <div className="px-14 py-8 bg-white rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.3)] text-center">
                        <div className={`text-[36px] font-bold mb-4 ${winner === BLACK ? 'text-[#c0392b]' : 'text-[#2c3e50]'}`}>
                            {winner === BLACK ? '黑方胜利' : '白方胜利'}
                        </div>
                        <button onClick={restart} className="px-7 py-2.5 border-0 rounded-[24px] bg-[#667eea] text-white cursor-pointer text-base font-bold">再来一局</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Gomoku;
