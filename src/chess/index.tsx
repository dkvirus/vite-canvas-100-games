import React, { useState, useCallback, useRef, useEffect } from 'react';

// ==================== 常量定义 ====================
const BOARD_ROWS = 10;
const BOARD_COLS = 9;
const CELL_SIZE = 60;
const MARGIN = 40;

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
}

const DIFFICULTIES: Record<string, Difficulty> = {
  easy: { depth: 2, name: '简单', randomChance: 0.3 },
  medium: { depth: 3, name: '中等', randomChance: 0.15 },
  hard: { depth: 4, name: '困难', randomChance: 0.05 }
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
class ChessEngine {
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
    moves = moves.filter(m => {
      const newBoard = this.cloneBoard(board);
      newBoard[m.row][m.col] = newBoard[row][col];
      newBoard[row][col] = null;
      return !this.isKingsFacing(newBoard, piece.color);
    });

    return moves;
  }

  isKingsFacing(board: (Piece | null)[][], color: PieceColor): boolean {
    let kingPos: Position | null = null;
    let enemyKingPos: Position | null = null;

    for (let row = 0; row < BOARD_ROWS; row++) {
      for (let col = 0; col < BOARD_COLS; col++) {
        if (board[row][col]?.type === PieceType.KING) {
          if (board[row][col]!.color === color) kingPos = { row, col };
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

  isInCheck(board: (Piece | null)[][], color: PieceColor): boolean {
    const enemyColor = color === PieceColor.RED ? PieceColor.BLACK : PieceColor.RED;
    let kingPos: Position | null = null;
    for (let row = 0; row < BOARD_ROWS; row++) {
      for (let col = 0; col < BOARD_COLS; col++) {
        if (board[row][col]?.type === PieceType.KING && board[row][col]?.color === color) {
          kingPos = { row, col };
        }
      }
    }
    if (!kingPos) return false;

    const enemyPieces = this.getPieces(board, enemyColor);
    for (const ep of enemyPieces) {
      const moves = this.getMoves(board, ep.row, ep.col);
      if (moves.some(m => m.row === kingPos!.row && m.col === kingPos!.col)) return true;
    }
    return false;
  }

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

    const alphaBeta = (
      board: (Piece | null)[][],
      depth: number,
      alpha: number,
      beta: number,
      isMaximizing: boolean,
      aiColor: PieceColor
    ): number => {
      if (depth === 0) return this.evaluate(board, aiColor);

      const currentColor = isMaximizing ? aiColor : (aiColor === PieceColor.RED ? PieceColor.BLACK : PieceColor.RED);
      const pieces = this.getPieces(board, currentColor);
      
      if (pieces.length === 0) return isMaximizing ? -99999 : 99999;

      let bestScore = isMaximizing ? -Infinity : Infinity;

      for (const p of pieces) {
        const moves = this.getMoves(board, p.row, p.col);
        for (const m of moves) {
          const { newBoard } = this.makeMove(board, { row: p.row, col: p.col }, m);
          // 跳过导致己方被将军的走法
          if (this.isInCheck(newBoard, currentColor)) continue;

          const score = alphaBeta(newBoard, depth - 1, alpha, beta, !isMaximizing, aiColor);
          if (isMaximizing) {
            bestScore = Math.max(bestScore, score);
            alpha = Math.max(alpha, score);
          } else {
            bestScore = Math.min(bestScore, score);
            beta = Math.min(beta, score);
          }
          if (beta <= alpha) break; // Alpha-Beta剪枝
        }
        if (beta <= alpha) break;
      }
      return bestScore;
    };

    const pieces = this.getPieces(board, color);
    let bestMove: Move | null = null;
    let bestScore = -Infinity;

    // 着法排序：优先搜索吃子走法
    const allMovesWithScore: { move: Move; score: number }[] = [];
    for (const p of pieces) {
      const moves = this.getMoves(board, p.row, p.col);
      for (const m of moves) {
        const target = board[m.row][m.col];
        const captureValue = target ? PIECE_VALUES[target.type] : 0;
        allMovesWithScore.push({
          move: { from: { row: p.row, col: p.col }, to: m },
          score: captureValue
        });
      }
    }
    // 按吃子价值降序排列，提高剪枝效率
    allMovesWithScore.sort((a, b) => b.score - a.score);

    for (const { move } of allMovesWithScore) {
      const { newBoard } = this.makeMove(board, move.from, move.to);
      if (this.isInCheck(newBoard, color)) continue;

      const score = alphaBeta(newBoard, difficulty.depth - 1, -Infinity, Infinity, false, color);
      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }

    return bestMove;
  }
}

// ==================== React组件 ====================
const ChineseChess: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef(new ChessEngine());
  const [board, setBoard] = useState<(Piece | null)[][]>(() => new ChessEngine().createInitialBoard());
  const [currentTurn, setCurrentTurn] = useState<PieceColor>(PieceColor.RED);
  const [selected, setSelected] = useState<Position | null>(null);
  const [validMoves, setValidMoves] = useState<Position[]>([]);
  const [difficulty, setDifficulty] = useState<string>('medium');
  const [isAIThinking, setIsAIThinking] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [, setWinner] = useState<PieceColor | null>(null);
  const [message, setMessage] = useState('红方先行，点击棋子开始游戏');
  const moveHistoryRef = useRef<Move[]>([]);

  // 绘制棋盘
  const drawBoard = useCallback((ctx: CanvasRenderingContext2D) => {
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;

    // 背景
    ctx.fillStyle = '#DEB887';
    ctx.fillRect(0, 0, width, height);

    // 外边框
    ctx.strokeStyle = '#000';
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
    ctx.fillStyle = '#000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const centerY = MARGIN + 4.5 * CELL_SIZE;
    ctx.fillText('楚 河', MARGIN + 1.5 * CELL_SIZE, centerY);
    ctx.fillText('汉 界', MARGIN + 6.5 * CELL_SIZE, centerY);

    // 炮/兵位置标记
    const drawCross = (x: number, y: number) => {
      const size = 8;
      ctx.strokeStyle = '#000';
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

  // 绘制棋子
  const drawPiece = useCallback((ctx: CanvasRenderingContext2D, row: number, col: number, piece: Piece) => {
    const x = MARGIN + col * CELL_SIZE;
    const y = MARGIN + row * CELL_SIZE;
    const radius = CELL_SIZE * 0.4;
    const name = PIECE_NAMES[piece.color][piece.type];

    // 棋子阴影
    ctx.beginPath();
    ctx.arc(x + 2, y + 2, radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fill();

    // 棋子背景（带渐变）
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    const gradient = ctx.createRadialGradient(x - 5, y - 5, 2, x, y, radius);
    gradient.addColorStop(0, '#FFF8DC');
    gradient.addColorStop(0.7, '#F5DEB3');
    gradient.addColorStop(1, '#D2B48C');
    ctx.fillStyle = gradient;
    ctx.fill();

    // 棋子边框
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 文字
    ctx.font = `bold ${radius}px 'KaiTi', 'STKaiti', serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = piece.color === PieceColor.RED ? '#CC0000' : '#000';
    ctx.fillText(name, x, y + 1);
  }, []);

  // 渲染整个界面
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = BOARD_COLS * CELL_SIZE + MARGIN * 2;
    canvas.height = BOARD_ROWS * CELL_SIZE + MARGIN * 2;

    drawBoard(ctx);

    // 绘制所有棋子
    for (let row = 0; row < BOARD_ROWS; row++) {
      for (let col = 0; col < BOARD_COLS; col++) {
        const piece = board[row][col];
        if (piece) drawPiece(ctx, row, col, piece);
      }
    }

    // 绘制选中效果
    if (selected) {
      const x = MARGIN + selected.col * CELL_SIZE;
      const y = MARGIN + selected.row * CELL_SIZE;
      ctx.strokeStyle = '#00FF00';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, CELL_SIZE * 0.45, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 绘制合法走法
    for (const move of validMoves) {
      const x = MARGIN + move.col * CELL_SIZE;
      const y = MARGIN + move.row * CELL_SIZE;
      const target = board[move.row][move.col];
      if (target) {
        ctx.strokeStyle = '#FF0000';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, CELL_SIZE * 0.45, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = 'rgba(0, 255, 0, 0.5)';
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, [board, selected, validMoves, drawBoard, drawPiece]);

  // AI走棋
  const doAIMove = useCallback(async () => {
    if (isAIThinking || gameOver || currentTurn !== PieceColor.BLACK) return;
    
    setIsAIThinking(true);
    setMessage('AI思考中...');
    
    // 让UI有时间更新
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const engine = engineRef.current;
    const difficultyConfig = DIFFICULTIES[difficulty];
    const move = engine.getBestMove(board, PieceColor.BLACK, difficultyConfig);
    
    if (move) {
      const { newBoard, captured } = engine.makeMove(board, move.from, move.to);
      // 验证AI走法不导致自己被将军
      if (!engine.isInCheck(newBoard, PieceColor.BLACK)) {
        moveHistoryRef.current.push({ ...move, captured });
        setBoard(newBoard);
        
        if (engine.isCheckmate(newBoard, PieceColor.RED)) {
          setGameOver(true);
          setWinner(PieceColor.BLACK);
          setMessage('黑方胜利！');
        } else if (engine.isInCheck(newBoard, PieceColor.RED)) {
          setMessage('将军！请应将');
        } else {
          setMessage('轮到你走棋了（红方）');
        }
        setCurrentTurn(PieceColor.RED);
      }
    }
    
    setIsAIThinking(false);
  }, [board, currentTurn, difficulty, gameOver, isAIThinking]);

  // 处理点击
  const handleClick = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (gameOver || isAIThinking || currentTurn !== PieceColor.RED) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;

    const col = Math.round((x - MARGIN) / CELL_SIZE);
    const row = Math.round((y - MARGIN) / CELL_SIZE);

    if (row < 0 || row >= BOARD_ROWS || col < 0 || col >= BOARD_COLS) return;

    const engine = engineRef.current;

    if (selected) {
      // 已选中棋子，尝试移动
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
        setBoard(newBoard);
        setSelected(null);
        setValidMoves([]);

        if (engine.isCheckmate(newBoard, PieceColor.BLACK)) {
          setGameOver(true);
          setWinner(PieceColor.RED);
          setMessage('红方胜利！恭喜！');
        } else if (engine.isInCheck(newBoard, PieceColor.BLACK)) {
          setMessage('将军！');
        } else {
          setMessage('AI思考中...');
        }
        
        setCurrentTurn(PieceColor.BLACK);
      } else {
        // 点击其他位置，尝试选择新棋子
        const piece = board[row][col];
        if (piece && piece.color === PieceColor.RED) {
          setSelected({ row, col });
          setValidMoves(engine.getMoves(board, row, col));
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
      }
    }
  }, [board, selected, validMoves, currentTurn, gameOver, isAIThinking]);

  // AI走棋触发
  useEffect(() => {
    if (currentTurn !== PieceColor.BLACK || gameOver) return;

    const timer = window.setTimeout(() => {
      void doAIMove();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [currentTurn, gameOver, doAIMove]);

  // 悔棋
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
    setMessage('已悔棋，请重新走棋');
  }, [board, gameOver]);

  // 重新开始
  const resetGame = useCallback(() => {
    const engine = engineRef.current;
    setBoard(engine.createInitialBoard());
    setCurrentTurn(PieceColor.RED);
    setSelected(null);
    setValidMoves([]);
    setGameOver(false);
    setWinner(null);
    setMessage('红方先行，点击棋子开始游戏');
    moveHistoryRef.current = [];
  }, []);

  // 切换难度
  const changeDifficulty = useCallback((level: string) => {
    setDifficulty(level);
    resetGame();
  }, [resetGame]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '20px',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      minHeight: '100vh'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: '24px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        maxWidth: '700px'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px'
        }}>
          <h1 style={{ fontSize: '24px', margin: 0, color: '#333' }}>♟ 中国象棋</h1>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            {Object.entries(DIFFICULTIES).map(([key, config]) => (
              <button
                key={key}
                onClick={() => changeDifficulty(key)}
                style={{
                  padding: '6px 14px',
                  border: '2px solid #667eea',
                  borderRadius: '20px',
                  background: difficulty === key ? '#667eea' : 'white',
                  color: difficulty === key ? 'white' : '#667eea',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  transition: 'all 0.3s'
                }}
              >
                {config.name}
              </button>
            ))}
            <button
              onClick={undoMove}
              style={{
                padding: '6px 14px',
                border: '2px solid #667eea',
                borderRadius: '20px',
                background: '#667eea',
                color: 'white',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              悔棋
            </button>
            <button
              onClick={resetGame}
              style={{
                padding: '6px 14px',
                border: '2px solid #ff6b6b',
                borderRadius: '20px',
                background: '#ff6b6b',
                color: 'white',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              重新开始
            </button>
          </div>
        </div>

        <canvas
          ref={canvasRef}
          onClick={handleClick}
          style={{
            display: 'block',
            margin: '0 auto',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            cursor: isAIThinking ? 'wait' : 'pointer'
          }}
        />

        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          marginTop: '16px',
          padding: '12px 16px',
          background: '#f7f7f7',
          borderRadius: '8px'
        }}>
          <span style={{
            fontSize: gameOver ? '18px' : '14px',
            fontWeight: gameOver ? 'bold' : 'normal',
            color: gameOver ? '#e74c3c' : '#666'
          }}>
            {message}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ChineseChess;