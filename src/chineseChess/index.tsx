import React, { useState, useCallback, useRef, useEffect } from 'react';

// React 组件所需钩子和类型定义
// ==================== 常量定义 ====================
const BOARD_ROWS = 10;
const BOARD_COLS = 9;
const CELL_SIZE = 60;
const MARGIN = 40;
const CANVAS_LOGICAL_WIDTH = (BOARD_COLS - 1) * CELL_SIZE + MARGIN * 2;
const CANVAS_LOGICAL_HEIGHT = (BOARD_ROWS - 1) * CELL_SIZE + MARGIN * 2;

// 棋子颜色，红色和黑色
const PieceColor = {
    RED: 'red',
    BLACK: 'black'
} as const;

type PieceColor = typeof PieceColor[keyof typeof PieceColor];

// 棋子类型
const PieceType = {
    KING: 'king',
    ADVISOR: 'advisor',
    ELEPHANT: 'elephant',
    HORSE: 'horse',
    CHARIOT: 'chariot',
    CANNON: 'cannon',
    SOLDIER: 'soldier',
} as const;

type PieceType = typeof PieceType[keyof typeof PieceType];

interface Piece {
    type: PieceType;
    color: PieceColor;
}

interface Position { row: number; col: number }

interface Move { from: Position; to: Position; captured?: Piece }

interface Difficulty {
    depth: number;
    name: string;
    randomChance: number;
    timeLimit: number;
}

const DIFFICULTIES: Record<string, Difficulty> = {
    easy: { depth: 2, name: '简单', randomChance: 0.3, timeLimit: 600 },
    medium: { depth: 3, name: '中等', randomChance: 0.15, timeLimit: 1200 },
    hard: { depth: 4, name: '困难', randomChance: 0.05, timeLimit: 2500 }
};

const PIECE_NAMES: Record<PieceColor, Record<PieceType, string>> = {
    [PieceColor.RED]: {
        [PieceType.KING]: '帥', [PieceType.ADVISOR]: '仕', [PieceType.ELEPHANT]: '相',
        [PieceType.HORSE]: '馬', [PieceType.CHARIOT]: '車', [PieceType.CANNON]: '炮', [PieceType.SOLDIER]: '兵'
    },
    [PieceColor.BLACK]: {
        [PieceType.KING]: '將', [PieceType.ADVISOR]: '士', [PieceType.ELEPHANT]: '象',
        [PieceType.HORSE]: '馬', [PieceType.CHARIOT]: '車', [PieceType.CANNON]: '砲', [PieceType.SOLDIER]: '卒'
    }
};

const PIECE_VALUES: Record<PieceType, number> = {
    [PieceType.KING]: 10000, [PieceType.CHARIOT]: 900, [PieceType.CANNON]: 450,
    [PieceType.HORSE]: 400, [PieceType.ELEPHANT]: 200, [PieceType.ADVISOR]: 200, [PieceType.SOLDIER]: 100
};

// 根据走子结果生成语音文案：吃子只喊一个"吃"，将军喊"将军"
const buildSpeechText = (_mover: Piece, captured?: Piece, isCheck = false): string => {
    const parts: string[] = [];
    if (captured) {
        parts.push('吃');
    }
    if (isCheck) {
        parts.push('將軍');
    }
    return parts.join('，');
};

// 位置价值表（简化版）
const PST: Record<string, number[]> = {
    king: Array(90).fill(0).map((_, i) => {
        const row = Math.floor(i / 9), col = i % 9;
        if (col < 3 || col > 5) return -10;
        if (row < 7) return -5;
        return (row === 8 && col === 4) ? 10 : 5;
    }),
    advisor: Array(90).fill(0).map((_, i) => {
        const row = Math.floor(i / 9), col = i % 9;
        if (col < 3 || col > 5) return -10;
        if (row < 7) return -5;
        return (row === 8 || row === 7) ? 5 : 3;
    }),
    elephant: Array(90).fill(0).map((_, i) => {
        const row = Math.floor(i / 9), col = i % 9;
        if (row < 5) return -3;
        return Math.abs(col - 4) < 3 ? 5 : 3;
    }),
    horse: Array(90).fill(0).map((_, i) => {
        const row = Math.floor(i / 9), col = i % 9;
        return (Math.abs(row - 4.5) + Math.abs(col - 4)) * 2;
    }),
    chariot: Array(90).fill(0).map((_, i) => {
        const row = Math.floor(i / 9), col = i % 9;
        return Math.min(row, 9 - row, col, 8 - col) * 3;
    }),
    cannon: Array(90).fill(0).map((_, i) => {
        const row = Math.floor(i / 9), col = i % 9;
        return Math.min(row, 9 - row, col, 8 - col) * 2 + 5;
    }),
    soldier: Array(90).fill(0).map((_, i) => {
        const row = Math.floor(i / 9), col = i % 9;
        if (row < 5) return (row < 4) ? -5 : 0;
        return 15 - Math.abs(col - 4) * 2 + (9 - row) * 2;
    })
};

// ==================== 棋盘逻辑引擎 ====================
// ChessEngine 封装了棋盘数据、合法走法、吃子判定、将军判定和 AI 搜索逻辑。
class ChessEngine {
    // 创建初始棋盘并摆放红黑双方棋子
    createInitialBoard(): (Piece | null)[][] {
        const board: (Piece | null)[][] = Array(BOARD_ROWS).fill(null).map(() => Array(BOARD_COLS).fill(null));

        // 黑方（上方）
        const blackBackRow: PieceType[] = [
            PieceType.CHARIOT, PieceType.HORSE, PieceType.ELEPHANT, PieceType.ADVISOR,
            PieceType.KING, PieceType.ADVISOR, PieceType.ELEPHANT, PieceType.HORSE, PieceType.CHARIOT
        ];
        blackBackRow.forEach((type, col) => { board[0][col] = { type, color: PieceColor.BLACK }; });
        board[2][1] = { type: PieceType.CANNON, color: PieceColor.BLACK };
        board[2][7] = { type: PieceType.CANNON, color: PieceColor.BLACK };
        board[3][0] = { type: PieceType.SOLDIER, color: PieceColor.BLACK };
        board[3][2] = { type: PieceType.SOLDIER, color: PieceColor.BLACK };
        board[3][4] = { type: PieceType.SOLDIER, color: PieceColor.BLACK };
        board[3][6] = { type: PieceType.SOLDIER, color: PieceColor.BLACK };
        board[3][8] = { type: PieceType.SOLDIER, color: PieceColor.BLACK };

        // 红方（下方）
        const redBackRow: PieceType[] = [
            PieceType.CHARIOT, PieceType.HORSE, PieceType.ELEPHANT, PieceType.ADVISOR,
            PieceType.KING, PieceType.ADVISOR, PieceType.ELEPHANT, PieceType.HORSE, PieceType.CHARIOT
        ];
        redBackRow.forEach((type, col) => { board[9][col] = { type, color: PieceColor.RED }; });
        board[7][1] = { type: PieceType.CANNON, color: PieceColor.RED };
        board[7][7] = { type: PieceType.CANNON, color: PieceColor.RED };
        board[6][0] = { type: PieceType.SOLDIER, color: PieceColor.RED };
        board[6][2] = { type: PieceType.SOLDIER, color: PieceColor.RED };
        board[6][4] = { type: PieceType.SOLDIER, color: PieceColor.RED };
        board[6][6] = { type: PieceType.SOLDIER, color: PieceColor.RED };
        board[6][8] = { type: PieceType.SOLDIER, color: PieceColor.RED };

        return board;
    }

    cloneBoard(board: (Piece | null)[][]): (Piece | null)[][] {
        return board.map(row => row.map(cell => cell ? { ...cell } : null));
    }

    isInBoard(row: number, col: number): boolean {
        return row >= 0 && row < BOARD_ROWS && col >= 0 && col < BOARD_COLS;
    }

    isInPalace(row: number, col: number, color: PieceColor): boolean {
        const colOk = col >= 3 && col <= 5;
        return color === PieceColor.RED ? (row >= 7 && row <= 9 && colOk) : (row >= 0 && row <= 2 && colOk);
    }

    getPieces(board: (Piece | null)[][], color: PieceColor): { row: number; col: number; piece: Piece }[] {
        const pieces: { row: number; col: number; piece: Piece }[] = [];
        for (let row = 0; row < BOARD_ROWS; row++) {
            for (let col = 0; col < BOARD_COLS; col++) {
                if (board[row][col] && board[row][col]!.color === color) {
                    pieces.push({ row, col, piece: board[row][col]! });
                }
            }
        }
        return pieces;
    }

    // ==================== 走法生成 ====================
    // 生成指定棋子在当前棋盘上的所有合法目标位置
    getMoves(board: (Piece | null)[][], row: number, col: number): Position[] {
        const piece = board[row][col];
        if (!piece) return [];

        let moves: Position[] = [];
        const color = piece.color;

        switch (piece.type) {
            case PieceType.KING: {
                const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
                for (const [dr, dc] of dirs) {
                    const nr = row + dr, nc = col + dc;
                    if (this.isInPalace(nr, nc, color)) moves.push({ row: nr, col: nc });
                }
                break;
            }
            case PieceType.ADVISOR: {
                const dirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
                for (const [dr, dc] of dirs) {
                    const nr = row + dr, nc = col + dc;
                    if (this.isInPalace(nr, nc, color)) moves.push({ row: nr, col: nc });
                }
                break;
            }
            case PieceType.ELEPHANT: {
                const jumps = [[-2, -2], [-2, 2], [2, -2], [2, 2]];
                const blocks = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
                for (let i = 0; i < jumps.length; i++) {
                    const nr = row + jumps[i][0], nc = col + jumps[i][1];
                    const br = row + blocks[i][0], bc = col + blocks[i][1];
                    if (this.isInBoard(nr, nc) && !board[br][bc]) {
                        if ((color === PieceColor.RED && nr >= 5) || (color === PieceColor.BLACK && nr <= 4)) {
                            moves.push({ row: nr, col: nc });
                        }
                    }
                }
                break;
            }
            case PieceType.HORSE: {
                const jumps = [
                    { dr: -2, dc: -1, br: -1, bc: 0 }, { dr: -2, dc: 1, br: -1, bc: 0 },
                    { dr: 2, dc: -1, br: 1, bc: 0 }, { dr: 2, dc: 1, br: 1, bc: 0 },
                    { dr: -1, dc: -2, br: 0, bc: -1 }, { dr: -1, dc: 2, br: 0, bc: 1 },
                    { dr: 1, dc: -2, br: 0, bc: -1 }, { dr: 1, dc: 2, br: 0, bc: 1 }
                ];
                for (const j of jumps) {
                    const nr = row + j.dr, nc = col + j.dc;
                    const br = row + j.br, bc = col + j.bc;
                    if (this.isInBoard(nr, nc) && !board[br][bc]) {
                        moves.push({ row: nr, col: nc });
                    }
                }
                break;
            }
            case PieceType.CHARIOT: {
                const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
                for (const [dr, dc] of dirs) {
                    let r = row + dr, c = col + dc;
                    while (this.isInBoard(r, c)) {
                        if (!board[r][c]) {
                            moves.push({ row: r, col: c });
                        } else {
                            if (board[r][c]!.color !== color) moves.push({ row: r, col: c });
                            break;
                        }
                        r += dr; c += dc;
                    }
                }
                break;
            }
            case PieceType.CANNON: {
                const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
                for (const [dr, dc] of dirs) {
                    let r = row + dr, c = col + dc;
                    let jumped = false;
                    while (this.isInBoard(r, c)) {
                        if (!jumped) {
                            if (!board[r][c]) {
                                moves.push({ row: r, col: c });
                            } else {
                                jumped = true;
                            }
                        } else {
                            if (board[r][c]) {
                                if (board[r][c]!.color !== color) moves.push({ row: r, col: c });
                                break;
                            }
                        }
                        r += dr; c += dc;
                    }
                }
                break;
            }
            case PieceType.SOLDIER: {
                const forward = color === PieceColor.RED ? -1 : 1;
                const crossed = color === PieceColor.RED ? row <= 4 : row >= 5;
                if (this.isInBoard(row + forward, col)) moves.push({ row: row + forward, col });
                if (crossed) {
                    if (this.isInBoard(row, col - 1)) moves.push({ row, col: col - 1 });
                    if (this.isInBoard(row, col + 1)) moves.push({ row, col: col + 1 });
                }
                break;
            }
        }

        // 过滤掉吃己方棋子的移动
        moves = moves.filter(m => {
            const target = board[m.row][m.col];
            return !target || target.color !== piece.color;
        });

        // 过滤掉导致将帅照面的移动
        // 当前走法若造成双方将帅在同一列且之间无棋子，则视为不合法
        // 采用原地交换而非克隆整盘，降低开销
        moves = moves.filter(m => {
            const moving = board[row][col];
            const target = board[m.row][m.col];
            board[m.row][m.col] = moving;
            board[row][col] = null;
            const facing = this.isKingsFacing(board);
            board[row][col] = moving;
            board[m.row][m.col] = target;
            return !facing;
        });

        return moves;
    }

    // 检查当前棋局是否出现将帅相对而立的情况（与颜色无关）
    // 即两王/帅在同一列且中间没有挡子
    isKingsFacing(board: (Piece | null)[][]): boolean {
        let kingPos: Position | null = null;
        let enemyKingPos: Position | null = null;

        for (let row = 0; row < BOARD_ROWS; row++) {
            for (let col = 0; col < BOARD_COLS; col++) {
                if (board[row][col]?.type === PieceType.KING) {
                    if (!kingPos) kingPos = { row, col };
                    else enemyKingPos = { row, col };
                }
            }
        }
        if (!kingPos || !enemyKingPos || kingPos.col !== enemyKingPos.col) return false;

        const minRow = Math.min(kingPos.row, enemyKingPos.row);
        const maxRow = Math.max(kingPos.row, enemyKingPos.row);
        for (let r = minRow + 1; r < maxRow; r++) {
            if (board[r][kingPos.col]) return false;
        }
        return true;
    }

    // 判断指定位置是否被 byColor 方攻击（直接判定，不依赖 getMoves，速度更快）
    isSquareAttacked(board: (Piece | null)[][], row: number, col: number, byColor: PieceColor): boolean {
        // 1. 兵/卒
        if (byColor === PieceColor.RED) {
            if (this.isInBoard(row + 1, col) && board[row + 1][col]?.type === PieceType.SOLDIER && board[row + 1][col]?.color === PieceColor.RED) return true;
            if (row <= 4) {
                if (this.isInBoard(row, col - 1) && board[row][col - 1]?.type === PieceType.SOLDIER && board[row][col - 1]?.color === PieceColor.RED) return true;
                if (this.isInBoard(row, col + 1) && board[row][col + 1]?.type === PieceType.SOLDIER && board[row][col + 1]?.color === PieceColor.RED) return true;
            }
        } else {
            if (this.isInBoard(row - 1, col) && board[row - 1][col]?.type === PieceType.SOLDIER && board[row - 1][col]?.color === PieceColor.BLACK) return true;
            if (row >= 5) {
                if (this.isInBoard(row, col - 1) && board[row][col - 1]?.type === PieceType.SOLDIER && board[row][col - 1]?.color === PieceColor.BLACK) return true;
                if (this.isInBoard(row, col + 1) && board[row][col + 1]?.type === PieceType.SOLDIER && board[row][col + 1]?.color === PieceColor.BLACK) return true;
            }
        }

        // 2. 马（含蹩马腿判定）
        const horseJumps = [
            { dr: -2, dc: -1, br: -1, bc: 0 }, { dr: -2, dc: 1, br: -1, bc: 0 },
            { dr: 2, dc: -1, br: 1, bc: 0 }, { dr: 2, dc: 1, br: 1, bc: 0 },
            { dr: -1, dc: -2, br: 0, bc: -1 }, { dr: -1, dc: 2, br: 0, bc: 1 },
            { dr: 1, dc: -2, br: 0, bc: -1 }, { dr: 1, dc: 2, br: 0, bc: 1 }
        ];
        for (const j of horseJumps) {
            const hr = row - j.dr, hc = col - j.dc;            // 马所在位置
            const lr = row - j.dr + j.br, lc = col - j.dc + j.bc; // 蹩马腿位置
            if (this.isInBoard(hr, hc) && board[hr][hc]?.type === PieceType.HORSE && board[hr][hc]?.color === byColor) {
                if (this.isInBoard(lr, lc) && !board[lr][lc]) return true;
            }
        }

        // 3. 车
        const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        for (const [dr, dc] of dirs) {
            let r = row + dr, c = col + dc;
            while (this.isInBoard(r, c)) {
                const p = board[r][c];
                if (p) {
                    if (p.color === byColor && p.type === PieceType.CHARIOT) return true;
                    break;
                }
                r += dr; c += dc;
            }
        }

        // 4. 炮（隔子打）
        for (const [dr, dc] of dirs) {
            let r = row + dr, c = col + dc;
            let jumped = false;
            while (this.isInBoard(r, c)) {
                const p = board[r][c];
                if (!jumped) {
                    if (p) jumped = true;
                } else {
                    if (p) {
                        if (p.color === byColor && p.type === PieceType.CANNON) return true;
                        break;
                    }
                }
                r += dr; c += dc;
            }
        }

        return false;
    }

    // 判断指定颜色是否处于被将军状态
    isInCheck(board: (Piece | null)[][], color: PieceColor): boolean {
        const enemyColor = color === PieceColor.RED ? PieceColor.BLACK : PieceColor.RED;
        for (let row = 0; row < BOARD_ROWS; row++) {
            for (let col = 0; col < BOARD_COLS; col++) {
                if (board[row][col]?.type === PieceType.KING && board[row][col]?.color === color) {
                    return this.isSquareAttacked(board, row, col, enemyColor);
                }
            }
        }
        return false;
    }

    // 判断是否处于绝杀状态，即一方所有合法走法均无法摆脱将军
    isCheckmate(board: (Piece | null)[][], color: PieceColor): boolean {
        const pieces = this.getPieces(board, color);
        for (const p of pieces) {
            const moves = this.getMoves(board, p.row, p.col);
            for (const m of moves) {
                const newBoard = this.cloneBoard(board);
                newBoard[m.row][m.col] = newBoard[p.row][p.col];
                newBoard[p.row][p.col] = null;
                if (!this.isInCheck(newBoard, color)) return false;
            }
        }
        return true;
    }

    // 执行一步走法，返回新的棋盘状态和被吃掉的棋子（如果存在）
    makeMove(board: (Piece | null)[][], from: Position, to: Position): { newBoard: (Piece | null)[][]; captured?: Piece } {
        const newBoard = this.cloneBoard(board);
        const captured = newBoard[to.row][to.col] || undefined;
        newBoard[to.row][to.col] = newBoard[from.row][from.col];
        newBoard[from.row][from.col] = null;
        return { newBoard, captured };
    }

    // ==================== 评估函数 ====================
    evaluate(board: (Piece | null)[][], color: PieceColor): number {
        let score = 0;
        for (let row = 0; row < BOARD_ROWS; row++) {
            for (let col = 0; col < BOARD_COLS; col++) {
                const piece = board[row][col];
                if (piece) {
                    const idx = row * 9 + col;
                    const value = PIECE_VALUES[piece.type];
                    const pst = PST[piece.type] ? PST[piece.type][idx] : 0;
                    const finalValue = value + pst;
                    score += piece.color === color ? finalValue : -finalValue;
                }
            }
        }
        return score;
    }

    // ==================== AI引擎（Alpha-Beta剪枝） ====================
    getBestMove(board: (Piece | null)[][], color: PieceColor, difficulty: Difficulty): Move | null {
        // 随机元素：降低AI棋力
        if (Math.random() < difficulty.randomChance) {
            const pieces = this.getPieces(board, color);
            const allMoves: Move[] = [];
            for (const p of pieces) {
                const moves = this.getMoves(board, p.row, p.col);
                moves.forEach(m => allMoves.push({ from: { row: p.row, col: p.col }, to: m }));
            }
            if (allMoves.length > 0) return allMoves[Math.floor(Math.random() * allMoves.length)];
        }

        // 收集某一方所有走法，并按吃子价值降序排列（吃子优先可大幅提升剪枝效率）
        const collectMoves = (bd: (Piece | null)[][], color2: PieceColor): { move: Move; score: number }[] => {
            const list: { move: Move; score: number }[] = [];
            const ps = this.getPieces(bd, color2);
            for (const p of ps) {
                const moves = this.getMoves(bd, p.row, p.col);
                for (const m of moves) {
                    const target = bd[m.row][m.col];
                    list.push({ move: { from: { row: p.row, col: p.col }, to: m }, score: target ? PIECE_VALUES[target.type] : 0 });
                }
            }
            list.sort((a, b) => b.score - a.score);
            return list;
        };

        // 超时控制：超过时间上限立即停止更深搜索，沿用上一层已完成的结果
        const state = { deadline: Date.now() + difficulty.timeLimit, timedOut: false };

        const alphaBeta = (
            bd: (Piece | null)[][],
            depth: number,
            alpha: number,
            beta: number,
            maximizing: boolean,
            aiColor: PieceColor
        ): number => {
            if (state.timedOut || Date.now() > state.deadline) { state.timedOut = true; return 0; }
            if (depth === 0) return this.evaluate(bd, aiColor);

            const currentColor = maximizing ? aiColor : (aiColor === PieceColor.RED ? PieceColor.BLACK : PieceColor.RED);
            const moves = collectMoves(bd, currentColor);
            if (moves.length === 0) return maximizing ? -99999 : 99999; // 无合法走法，判负

            let bestScore = maximizing ? -Infinity : Infinity;
            for (const { move } of moves) {
                const { newBoard } = this.makeMove(bd, move.from, move.to);
                if (this.isInCheck(newBoard, currentColor)) continue; // 跳过送将的走法
                const score = alphaBeta(newBoard, depth - 1, alpha, beta, !maximizing, aiColor);
                if (maximizing) {
                    if (score > bestScore) bestScore = score;
                    if (score > alpha) alpha = score;
                } else {
                    if (score < bestScore) bestScore = score;
                    if (score < beta) beta = score;
                }
                if (beta <= alpha || state.timedOut) break; // Alpha-Beta 剪枝
            }
            return bestScore;
        };

        const rootMoves = collectMoves(board, color);
        if (rootMoves.length === 0) return null;

        let bestMove: Move = rootMoves[0].move;
        // 迭代加深：深度 1 → depth，逐层搜索；一旦超时采用上一层结果，保证有解且及时响应
        for (let d = 1; d <= difficulty.depth; d++) {
            let currentBest: Move = rootMoves[0].move;
            let currentBestScore = -Infinity;
            let alpha = -Infinity;
            for (const { move } of rootMoves) {
                const { newBoard } = this.makeMove(board, move.from, move.to);
                if (this.isInCheck(newBoard, color)) continue;
                const score = alphaBeta(newBoard, d - 1, alpha, Infinity, false, color);
                if (score > currentBestScore) {
                    currentBestScore = score;
                    currentBest = move;
                }
                if (score > alpha) alpha = score;
                if (state.timedOut) break;
            }
            if (!state.timedOut) bestMove = currentBest;
            if (state.timedOut || Date.now() > state.deadline) break;
        }

        return bestMove;
    }
}

// ==================== React组件 ====================
// ChineseChess 组件负责绘制棋盘、处理玩家输入、触发 AI、以及管理游戏状态
const ChineseChess: React.FC = () => {
    const canvasContainerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef(new ChessEngine());
    const [board, setBoard] = useState<(Piece | null)[][]>(() => new ChessEngine().createInitialBoard());
    const [currentTurn, setCurrentTurn] = useState<PieceColor>(PieceColor.RED);
    const [selected, setSelected] = useState<Position | null>(null);
    const [validMoves, setValidMoves] = useState<Position[]>([]);
    const [lastOpponentMove, setLastOpponentMove] = useState<Position | null>(null);
    const [lastFromPosition, setLastFromPosition] = useState<Position | null>(null);
    const [highlightPhase, setHighlightPhase] = useState(0);
    const highlightRequestRef = useRef<number | null>(null);
    const boardScaleRef = useRef(1);
    const [canvasResizeTrigger, setCanvasResizeTrigger] = useState(0);
    const [difficulty, setDifficulty] = useState<string>('medium');
    const [isAIThinking, setIsAIThinking] = useState(false);
    const [gameOver, setGameOver] = useState(false);
    const [winner, setWinner] = useState<PieceColor | null>(null);
    const [message, setMessage] = useState('红方先行，点击棋子开始游戏');
    const [animationTick, setAnimationTick] = useState(0);
    const [movingPiece, setMovingPiece] = useState<null | {
        piece: Piece;
        from: Position;
        to: Position;
        progress: number;
        captured?: Piece;
        finalBoard: (Piece | null)[][];
    }>(null);
    const moveHistoryRef = useRef<Move[]>([]);
    const animationFrameRef = useRef<number | null>(null);
    const animationProgressRef = useRef(0);
    const audioContextRef = useRef<AudioContext | null>(null);

    // 绘制棋盘
    const drawBoard = useCallback((ctx: CanvasRenderingContext2D) => {
        const width = CANVAS_LOGICAL_WIDTH;
        const height = CANVAS_LOGICAL_HEIGHT;

        // 背景（浅木纹，经典配色）
        ctx.fillStyle = '#F5DEB3';
        ctx.fillRect(0, 0, width, height);

        // 外边框与网格线（深木色，与浅背景形成经典对比）
        ctx.strokeStyle = '#8B5A2B';
        ctx.lineWidth = 2;
        ctx.strokeRect(MARGIN, MARGIN, (BOARD_COLS - 1) * CELL_SIZE, (BOARD_ROWS - 1) * CELL_SIZE);

        // 横线
        for (let row = 0; row < BOARD_ROWS; row++) {
            ctx.beginPath();
            ctx.moveTo(MARGIN, MARGIN + row * CELL_SIZE);
            ctx.lineTo(MARGIN + (BOARD_COLS - 1) * CELL_SIZE, MARGIN + row * CELL_SIZE);
            ctx.stroke();
        }

        // 竖线（上半部分）
        for (let col = 0; col < BOARD_COLS; col++) {
            ctx.beginPath();
            ctx.moveTo(MARGIN + col * CELL_SIZE, MARGIN);
            ctx.lineTo(MARGIN + col * CELL_SIZE, MARGIN + 4 * CELL_SIZE);
            ctx.stroke();
        }

        // 竖线（下半部分）
        for (let col = 0; col < BOARD_COLS; col++) {
            ctx.beginPath();
            ctx.moveTo(MARGIN + col * CELL_SIZE, MARGIN + 5 * CELL_SIZE);
            ctx.lineTo(MARGIN + col * CELL_SIZE, MARGIN + 9 * CELL_SIZE);
            ctx.stroke();
        }

        // 九宫格斜线（上方）
        ctx.beginPath();
        ctx.moveTo(MARGIN + 3 * CELL_SIZE, MARGIN);
        ctx.lineTo(MARGIN + 5 * CELL_SIZE, MARGIN + 2 * CELL_SIZE);
        ctx.moveTo(MARGIN + 5 * CELL_SIZE, MARGIN);
        ctx.lineTo(MARGIN + 3 * CELL_SIZE, MARGIN + 2 * CELL_SIZE);
        ctx.stroke();

        // 九宫格斜线（下方）
        ctx.beginPath();
        ctx.moveTo(MARGIN + 3 * CELL_SIZE, MARGIN + 7 * CELL_SIZE);
        ctx.lineTo(MARGIN + 5 * CELL_SIZE, MARGIN + 9 * CELL_SIZE);
        ctx.moveTo(MARGIN + 5 * CELL_SIZE, MARGIN + 7 * CELL_SIZE);
        ctx.lineTo(MARGIN + 3 * CELL_SIZE, MARGIN + 9 * CELL_SIZE);
        ctx.stroke();

        // 楚河汉界
        ctx.font = '24px serif';
        ctx.fillStyle = '#8B4513';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const centerY = MARGIN + 4.5 * CELL_SIZE;
        ctx.fillText('楚 河', MARGIN + 1.5 * CELL_SIZE, centerY);
        ctx.fillText('汉 界', MARGIN + 6.5 * CELL_SIZE, centerY);

        // 炮/兵位置标记
        const drawCross = (x: number, y: number) => {
            const size = 8;
            ctx.strokeStyle = '#8B5A2B';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x - size, y - size);
            ctx.lineTo(x + size, y + size);
            ctx.moveTo(x - size, y + size);
            ctx.lineTo(x + size, y - size);
            ctx.stroke();
        };

        drawCross(MARGIN + 1 * CELL_SIZE, MARGIN + 2 * CELL_SIZE);
        drawCross(MARGIN + 7 * CELL_SIZE, MARGIN + 2 * CELL_SIZE);
        drawCross(MARGIN + 1 * CELL_SIZE, MARGIN + 7 * CELL_SIZE);
        drawCross(MARGIN + 7 * CELL_SIZE, MARGIN + 7 * CELL_SIZE);

        const soldierCols = [0, 2, 4, 6, 8];
        soldierCols.forEach(col => {
            drawCross(MARGIN + col * CELL_SIZE, MARGIN + 3 * CELL_SIZE);
            drawCross(MARGIN + col * CELL_SIZE, MARGIN + 6 * CELL_SIZE);
        });
    }, []);

    // 根据指定坐标绘制单个棋子，包括阴影、渐变和棋子名称
    const drawPieceAtPosition = useCallback((ctx: CanvasRenderingContext2D, x: number, y: number, piece: Piece) => {
        const radius = CELL_SIZE * 0.4;
        const name = PIECE_NAMES[piece.color][piece.type];

        ctx.beginPath();
        ctx.arc(x + 2, y + 2, radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        const gradient = ctx.createRadialGradient(x - 5, y - 5, 2, x, y, radius);
        // 经典象牙/浅棕渐变：象牙色至浅木色
        gradient.addColorStop(0, '#FFFDF5');
        gradient.addColorStop(0.6, '#F5E6C2');
        gradient.addColorStop(1, '#CDA66E');
        ctx.fillStyle = gradient;
        ctx.fill();

        // 棋子描边使用深木色，契合浅木纹背景
        ctx.strokeStyle = '#8B4513';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.font = `bold ${radius}px 'KaiTi', 'STKaiti', serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        // 棋字：红方用深红，黑方用接近黑的墨色
        ctx.fillStyle = piece.color === PieceColor.RED ? '#B71C1C' : '#111111';
        ctx.fillText(name, x, y + 1);
    }, []);

    // 绘制指定棋盘格位置的棋子
    const drawPiece = useCallback((ctx: CanvasRenderingContext2D, row: number, col: number, piece: Piece) => {
        const x = MARGIN + col * CELL_SIZE;
        const y = MARGIN + row * CELL_SIZE;
        drawPieceAtPosition(ctx, x, y, piece);
    }, [drawPieceAtPosition]);

    // 延迟创建 AudioContext，避免页面加载时直接初始化音频设备
    const getAudioContext = useCallback(() => {
        if (!audioContextRef.current) {
            const AudioContextConstructor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
            if (AudioContextConstructor) {
                audioContextRef.current = new AudioContextConstructor();
            } else {
                throw new Error('AudioContext is not supported in this browser.');
            }
        }
        return audioContextRef.current;
    }, []);

    // 播放落子音效，增加走棋反馈
    const playMoveSound = useCallback(() => {
        const ctx = getAudioContext();
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        oscillator.type = 'triangle';
        oscillator.frequency.value = 220;
        gain.gain.setValueAtTime(0.0001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.16);
        oscillator.connect(gain);
        gain.connect(ctx.destination);
        oscillator.start();
        oscillator.stop(ctx.currentTime + 0.18);
    }, [getAudioContext]);

    // 语音播报：根据走子结果播报自然语言
    const speak = useCallback((text: string) => {
        if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'zh-CN';
        utterance.rate = 0.95;
        utterance.pitch = 1;
        // 优先选用中文语音引擎，避免英文 voice 朗读中文导致怪异发音
        const voices = window.speechSynthesis.getVoices();
        const zhVoice = voices.find(v => v.lang.toLowerCase().startsWith('zh'));
        if (zhVoice) utterance.voice = zhVoice;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
    }, []);

    // 走棋动画：绘制移动过程中的棋子位置，并在结束时提交最终棋盘状态
    const animateMove = useCallback((moveData: {
        piece: Piece;
        from: Position;
        to: Position;
        captured?: Piece;
        finalBoard: (Piece | null)[][];
        onComplete: () => void;
    }) => {
        setMovingPiece({ ...moveData, progress: 0 });
        animationProgressRef.current = 0;

        const duration = 420;
        const startTime = performance.now();

        const step = (timestamp: number) => {
            const elapsed = timestamp - startTime;
            const progress = Math.min(1, elapsed / duration);
            animationProgressRef.current = progress;
            setAnimationTick(t => t + 1);

            if (progress < 1) {
                animationFrameRef.current = window.requestAnimationFrame(step);
            } else {
                setMovingPiece(null);
                setBoard(moveData.finalBoard);
                playMoveSound();
                moveData.onComplete();
            }
        };

        if (animationFrameRef.current !== null) {
            window.cancelAnimationFrame(animationFrameRef.current);
        }
        animationFrameRef.current = window.requestAnimationFrame(step);
    }, [playMoveSound]);

    // 卸载时取消动画帧，避免内存泄漏
    useEffect(() => {
        return () => {
            if (animationFrameRef.current !== null) {
                window.cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, []);

    // 画布尺寸自适应移动端
    useEffect(() => {
        const resizeCanvas = () => {
            const canvas = canvasRef.current;
            const container = canvasContainerRef.current;
            if (!canvas || !container) return;

            const maxViewportHeight = Math.max(0, window.innerHeight - 260);
            const widthByContainer = container.clientWidth;
            const widthByHeight = Math.round(maxViewportHeight * CANVAS_LOGICAL_WIDTH / CANVAS_LOGICAL_HEIGHT);
            const displayWidth = Math.min(widthByContainer, widthByHeight);
            const displayHeight = Math.round(displayWidth * CANVAS_LOGICAL_HEIGHT / CANVAS_LOGICAL_WIDTH);
            const ratio = window.devicePixelRatio || 1;
            const boardScale = displayWidth / CANVAS_LOGICAL_WIDTH;
            boardScaleRef.current = boardScale;

            canvas.style.width = `${displayWidth}px`;
            canvas.style.height = `${displayHeight}px`;
            canvas.width = Math.round(displayWidth * ratio);
            canvas.height = Math.round(displayHeight * ratio);

            const ctx = canvas.getContext('2d');
            if (ctx) ctx.setTransform(ratio * boardScale, 0, 0, ratio * boardScale, 0, 0);
            setCanvasResizeTrigger(t => t + 1);
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

    // 对手上一步棋高亮放大缩小 + 黄色光晕
    useEffect(() => {
        if (!lastOpponentMove) {
            if (highlightRequestRef.current !== null) {
                window.cancelAnimationFrame(highlightRequestRef.current);
                highlightRequestRef.current = null;
            }
            return;
        }

        const startTime = performance.now();
        const animate = (timestamp: number) => {
            const progress = (timestamp - startTime) / 1000;
            const phase = (Math.sin(progress * Math.PI * 2) + 1) / 2;
            setHighlightPhase(phase);
            highlightRequestRef.current = window.requestAnimationFrame(animate);
        };

        highlightRequestRef.current = window.requestAnimationFrame(animate);
        return () => {
            if (highlightRequestRef.current !== null) {
                window.cancelAnimationFrame(highlightRequestRef.current);
                highlightRequestRef.current = null;
            }
        };
    }, [lastOpponentMove]);

    // 绘制整个 Canvas 棋盘和当前棋子状态
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const ratio = window.devicePixelRatio || 1;
        const boardScale = boardScaleRef.current;
        ctx.setTransform(ratio * boardScale, 0, 0, ratio * boardScale, 0, 0);

        drawBoard(ctx);

        const skipFrom = movingPiece?.from;
        const skipTo = movingPiece?.to;

        for (let row = 0; row < BOARD_ROWS; row++) {
            for (let col = 0; col < BOARD_COLS; col++) {
                const piece = board[row][col];
                if (!piece) continue;
                if (movingPiece && row === skipFrom?.row && col === skipFrom?.col) continue;
                if (movingPiece && movingPiece.captured && row === skipTo?.row && col === skipTo?.col) continue;
                drawPiece(ctx, row, col, piece);
            }
        }

        if (movingPiece) {
            const progress = animationProgressRef.current;
            const x = MARGIN + (movingPiece.from.col + (movingPiece.to.col - movingPiece.from.col) * progress) * CELL_SIZE;
            const y = MARGIN + (movingPiece.from.row + (movingPiece.to.row - movingPiece.from.row) * progress) * CELL_SIZE;
            drawPieceAtPosition(ctx, x, y, movingPiece.piece);
        }

        // 上一手起点标记（持续显示，直到对方选子才消失）
        if (lastFromPosition && !movingPiece) {
            const fx = MARGIN + lastFromPosition.col * CELL_SIZE;
            const fy = MARGIN + lastFromPosition.row * CELL_SIZE;
            ctx.save();
            ctx.strokeStyle = 'rgba(102, 126, 234, 0.5)';
            ctx.lineWidth = 2;
            ctx.setLineDash([6, 4]);
            ctx.beginPath();
            ctx.arc(fx, fy, CELL_SIZE * 0.42, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }

        // 对手上一手高亮放大缩小 + 黄色光晕
        if (lastOpponentMove && !movingPiece) {
            const phase = highlightPhase;
            const x = MARGIN + lastOpponentMove.col * CELL_SIZE;
            const y = MARGIN + lastOpponentMove.row * CELL_SIZE;
            const radius = CELL_SIZE * (0.45 + phase * 0.09);
            const alpha = 0.35 + phase * 0.35;
            const blur = 6 + phase * 8;

            ctx.save();
            // 经典风格：柔和的金橙色高亮，低调但可识别
            ctx.strokeStyle = `rgba(255, 181, 77, ${alpha})`;
            ctx.lineWidth = 2 + phase * 2;
            ctx.shadowColor = `rgba(255, 181, 77, ${alpha * 0.7})`;
            ctx.shadowBlur = blur;
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }

        // 绘制选中效果
        if (selected) {
            const x = MARGIN + selected.col * CELL_SIZE;
            const y = MARGIN + selected.row * CELL_SIZE;
            // 经典样式选中：温暖的金色边框，便于识别且不突兀
            ctx.save();
            ctx.strokeStyle = '#FFD54F';
            ctx.lineWidth = 3;
            ctx.shadowColor = 'rgba(255,213,79,0.45)';
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.arc(x, y, CELL_SIZE * 0.45, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }

        // 绘制合法走法
        for (const move of validMoves) {
            const x = MARGIN + move.col * CELL_SIZE;
            const y = MARGIN + move.row * CELL_SIZE;
            const target = board[move.row][move.col];
            if (target) {
                // 吃子目标：深红色边框（与棋字保持一致）
                ctx.strokeStyle = '#B71C1C';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(x, y, CELL_SIZE * 0.45, 0, Math.PI * 2);
                ctx.stroke();
            } else {
                // 普通落子提示：深木色小点，低调但可见
                ctx.fillStyle = 'rgba(93,58,26,0.95)';
                ctx.beginPath();
                ctx.arc(x, y, 8, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }, [board, selected, validMoves, lastOpponentMove, lastFromPosition, highlightPhase, movingPiece, canvasResizeTrigger, drawBoard, drawPiece, drawPieceAtPosition, animationTick]);

    // AI走棋
    // AI 执行走棋，使用当前难度配置计算最佳落子
    const doAIMove = useCallback(async () => {
        if (isAIThinking || gameOver || currentTurn !== PieceColor.BLACK) return;

        setIsAIThinking(true);
        setMessage('AI思考中...');

        await new Promise(resolve => setTimeout(resolve, 100));

        const engine = engineRef.current;
        const difficultyConfig = DIFFICULTIES[difficulty];
        const move = engine.getBestMove(board, PieceColor.BLACK, difficultyConfig);

        if (move) {
            const { newBoard, captured } = engine.makeMove(board, move.from, move.to);
            if (!engine.isInCheck(newBoard, PieceColor.BLACK)) {
                const piece = board[move.from.row][move.from.col];
                if (piece) {
                    moveHistoryRef.current.push({ ...move, captured });
                    animateMove({
                        piece,
                        from: move.from,
                        to: move.to,
                        captured,
                        finalBoard: newBoard,
                        onComplete: () => {
                            if (engine.isCheckmate(newBoard, PieceColor.RED)) {
                                setGameOver(true);
                                setWinner(PieceColor.BLACK);
                                setMessage('黑方胜利！');
                            } else if (engine.isInCheck(newBoard, PieceColor.RED)) {
                                setMessage('将军！请应将');
                                setCurrentTurn(PieceColor.RED);
                            } else {
                                setMessage('轮到你走棋了（红方）');
                                setCurrentTurn(PieceColor.RED);
                            }
                            const speech = buildSpeechText(piece, captured, engine.isInCheck(newBoard, PieceColor.RED));
                            if (speech) speak(speech);
                            setLastOpponentMove(move.to);
                            setLastFromPosition(move.from);
                            setIsAIThinking(false);
                        }
                    });
                } else {
                    setIsAIThinking(false);
                }
            } else {
                setIsAIThinking(false);
            }
        } else {
            setIsAIThinking(false);
        }
    }, [animateMove, board, currentTurn, difficulty, gameOver, isAIThinking, speak]);

    // 处理点击
    // 处理玩家点击事件，选择棋子或发起走子
    const handleCanvasPointer = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
        if (gameOver || isAIThinking || currentTurn !== PieceColor.RED) return;
        event.preventDefault();

        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const x = (event.clientX - rect.left) * CANVAS_LOGICAL_WIDTH / rect.width;
        const y = (event.clientY - rect.top) * CANVAS_LOGICAL_HEIGHT / rect.height;

        const col = Math.round((x - MARGIN) / CELL_SIZE);
        const row = Math.round((y - MARGIN) / CELL_SIZE);

        if (row < 0 || row >= BOARD_ROWS || col < 0 || col >= BOARD_COLS) return;

        const engine = engineRef.current;

        if (selected) {
            // 已选中棋子，尝试移动到目标位置
            if (validMoves.some(m => m.row === row && m.col === col)) {
                const from = { ...selected };
                const to = { row, col };
                const captured = board[to.row][to.col] || undefined;
                const { newBoard } = engine.makeMove(board, from, to);

                // 不能走导致自己被将军的棋
                if (engine.isInCheck(newBoard, PieceColor.RED)) {
                    setMessage('不能走这步棋，会导致被将军！');
                    setSelected(null);
                    setValidMoves([]);
                    return;
                }

                moveHistoryRef.current.push({ from, to, captured });
                setSelected(null);
                setValidMoves([]);
                setMessage('棋子移动中...');

                const piece = board[from.row][from.col];
                if (piece) {
                    animateMove({
                        piece,
                        from,
                        to,
                        captured,
                        finalBoard: newBoard,
                        onComplete: () => {
                            if (engine.isCheckmate(newBoard, PieceColor.BLACK)) {
                                setGameOver(true);
                                setWinner(PieceColor.RED);
                                setMessage('红方胜利！恭喜！');
                            } else if (engine.isInCheck(newBoard, PieceColor.BLACK)) {
                                setMessage('将军！');
                                setCurrentTurn(PieceColor.BLACK);
                            } else {
                                setMessage('AI思考中...');
                                setCurrentTurn(PieceColor.BLACK);
                            }
                            const speech = buildSpeechText(piece, captured, engine.isInCheck(newBoard, PieceColor.BLACK));
                            if (speech) speak(speech);
                            setLastFromPosition(from);
                        }
                    });
                }
            } else {
                // 点击其他位置，尝试选择新棋子
                const piece = board[row][col];
                    if (piece && piece.color === PieceColor.RED) {
                    setSelected({ row, col });
                    setValidMoves(engine.getMoves(board, row, col));
                    setLastOpponentMove(null);
                    setLastFromPosition(null);
                } else {
                    setSelected(null);
                    setValidMoves([]);
                }
            }
        } else {
            // 选择棋子
            const piece = board[row][col];
            if (piece && piece.color === PieceColor.RED) {
                setSelected({ row, col });
                setValidMoves(engine.getMoves(board, row, col));
                setLastOpponentMove(null);
                setLastFromPosition(null);
            }
        }
    }, [animateMove, board, selected, validMoves, currentTurn, gameOver, isAIThinking, speak]);

    // AI走棋触发
    useEffect(() => {
        if (currentTurn !== PieceColor.BLACK || gameOver) return;

        const timer = window.setTimeout(() => {
            void doAIMove();
        }, 0);

        return () => window.clearTimeout(timer);
    }, [currentTurn, gameOver, doAIMove]);

    // 悔棋：撤销玩家和 AI 的两步走法
    const undoMove = useCallback(() => {
        if (moveHistoryRef.current.length < 2 || gameOver) return;

        const currentBoard = [...board.map(row => [...row])];

        // 撤销AI和玩家的两步棋
        for (let i = 0; i < 2; i++) {
            const lastMove = moveHistoryRef.current.pop();
            if (!lastMove) break;
            const { from, to, captured } = lastMove;
            currentBoard[from.row][from.col] = currentBoard[to.row][to.col];
            currentBoard[to.row][to.col] = captured ?? null;
        }

        setBoard(currentBoard);
        setCurrentTurn(PieceColor.RED);
        setSelected(null);
        setValidMoves([]);
        setLastOpponentMove(null);
        setLastFromPosition(null);
        setMessage('已悔棋，请重新走棋');
    }, [board, gameOver]);

    // 重新开始：重置棋盘、状态和历史记录
    const resetGame = useCallback(() => {
        const engine = engineRef.current;
        setBoard(engine.createInitialBoard());
        setCurrentTurn(PieceColor.RED);
        setSelected(null);
        setValidMoves([]);
        setLastOpponentMove(null);
        setLastFromPosition(null);
        setGameOver(false);
        setWinner(null);
        setMessage('红方先行，点击棋子开始游戏');
        moveHistoryRef.current = [];
    }, []);

    // 切换难度并重新开始游戏
    const changeDifficulty = useCallback((level: string) => {
        setDifficulty(level);
        resetGame();
    }, [resetGame]);

    return (
        <div className="rounded-2xl max-w-[960px] w-full mx-auto p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h1 className="text-2xl m-0 text-[#333]">♟ 中国象棋</h1>
                <div className="flex flex-wrap items-center justify-center gap-2 max-[640px]:grid max-[640px]:grid-cols-2 max-[640px]:w-full">
                    {Object.entries(DIFFICULTIES).map(([key, config]) => (
                        <button
                            key={key}
                            onClick={() => changeDifficulty(key)}
                            className={`min-w-[72px] flex-1 px-3 py-1.5 border-2 rounded-[20px] cursor-pointer font-bold text-xs whitespace-nowrap transition-all duration-300 max-[640px]:min-w-0 max-[640px]:px-2.5 max-[640px]:py-2 max-[640px]:text-xs ${difficulty === key ? 'bg-[#667eea] text-white border-[#667eea]' : 'bg-white text-[#667eea] border-[#667eea]'}`}
                        >
                            {config.name}
                        </button>
                    ))}
                    <button
                        onClick={undoMove}
                        className="min-w-[72px] flex-1 px-3 py-1.5 border-2 border-[#667eea] rounded-[20px] bg-[#667eea] text-white cursor-pointer font-bold text-xs whitespace-nowrap transition-all duration-300 max-[640px]:min-w-0 max-[640px]:px-2.5 max-[640px]:py-2 max-[640px]:text-xs"
                    >
                        悔棋
                    </button>
                    <button
                        onClick={resetGame}
                        className="min-w-[72px] flex-1 px-3 py-1.5 border-2 border-[#ff6b6b] rounded-[20px] bg-[#ff6b6b] text-white cursor-pointer font-bold text-xs whitespace-nowrap transition-all duration-300 max-[640px]:min-w-0 max-[640px]:px-2.5 max-[640px]:py-2 max-[640px]:text-xs"
                    >
                        重新开始
                    </button>
                </div>
            </div>

            <div className="relative flex justify-center w-full">
                <div ref={canvasContainerRef} className="w-full max-w-[840px] max-h-[calc(100vh-260px)] mx-auto px-3 box-border">
                    <canvas
                        ref={canvasRef}
                        onPointerDown={handleCanvasPointer}
                        className={`block mx-auto rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.1)] touch-none ${isAIThinking ? 'cursor-wait' : 'cursor-pointer'}`}
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
                        <div className={`text-[36px] font-bold mb-4 ${winner === PieceColor.RED ? 'text-[#c0392b]' : 'text-[#2c3e50]'}`}>
                            {winner === PieceColor.RED ? '红方胜利' : '黑方胜利'}
                        </div>
                        <button
                            onClick={resetGame}
                            className="px-7 py-2.5 border-0 rounded-[24px] bg-[#667eea] text-white cursor-pointer text-base font-bold"
                        >
                            再来一局
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChineseChess;