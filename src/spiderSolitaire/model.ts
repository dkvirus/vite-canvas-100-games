/**
 * 纯数据逻辑（牌组、洗牌、规则判断）
 */

import { BOTTOM_PAD, MAX_CARD_W, MIN_CARD_W, NUM_COLUMNS, SUITS } from "./consts"
import type { Card, Difficulty, GameState, HitResult, Layout, MoveOutcome, Suit } from "./types"

/**
 * 生成牌组,共104张牌
 * 
 * 难度为1只有黑桃，难度为2只有黑桃和红桃，难度为4四种花色都有
 */
export function buildDeck(difficulty: Difficulty): Card[] {
    // 104 cards total (two standard decks worth)
    const activeSuits: Suit[] =
        difficulty === 1 ? ["spades"] : difficulty === 2 ? ["spades", "hearts"] : SUITS
    // 根据花色决定复制几份扑克牌
    const copies = 104 / (13 * activeSuits.length)
    const cards: Card[] = []
    let n = 0 // 生成扑克牌主键 0-103 共 104 张牌
    for (let c = 0; c < copies; c++) {
        for (const suit of activeSuits) {
            for (let rank = 1; rank <= 13; rank++) {
                cards.push({ id: `c${n++}`, suit, rank, faceUp: false })
            }
        }
    }
    return cards
}

/**
 * 洗牌
 */
export function shuffle<T>(arr: T[]): T[] {
    const a = [...arr]
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
            ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
}

/**
 * 初始化游戏的数据结构，只是数据，还没有渲染页面，页面会根据这个数据进行渲染
 */
export function newGame(difficulty: Difficulty): GameState {
    const deck = shuffle(buildDeck(difficulty)) // Card[] 104张打乱顺序的扑克牌
    // 用二维数组表示页面上10列数组，每一列自身又是一个数组
    const tableau: Card[][] = Array.from({ length: NUM_COLUMNS }, () => [])

    // 初始化时页面会显示54张扑克牌，1-4列各6张牌(5张牌盖着,1张牌翻开)，5-10列各5张牌(4张牌盖着,1张牌翻开)
    let idx = 0
    for (let col = 0; col < NUM_COLUMNS; col++) { // 共10列，遍历每一列
        const count = col < 4 ? 6 : 5
        for (let k = 0; k < count; k++) {
            tableau[col].push({ ...deck[idx++], faceUp: false })
        }
    }
    // 默认每一列最后一张牌翻开
    for (let col = 0; col < NUM_COLUMNS; col++) {
        const column = tableau[col]
        if (column.length > 0) column[column.length - 1].faceUp = true
    }

    const stock = deck.slice(idx) // 共104张牌，除去页面默认显示54张牌，还剩50张牌

    return {
        tableau, // 页面显示的牌，是一个二维数组，每一项是一列的数据
        stock, // 剩余牌，每次点击发牌，会从剩余牌中取10张牌出来
        completed: 0, // 总共要完成8副扑克牌，默认完成0副牌
        score: 500, // 得分，默认500分
        moves: 0, // 移动步数，步数越少获得成功越厉害
        difficulty, // 游戏难度
        won: false, // 是否胜利
    }
}

/**
 * 获取指定列牌组中每张牌 x 坐标
 * 同一列 x 坐标都一样，因此返回值是一个数字
 */
export function columnX(col: number, layout: Layout): number {
    return layout.startX + col * (layout.cardW + layout.gap)
}

/**
 * 获取指定列牌组中每张牌 y 坐标
 * 同一列每张牌 y 坐标都不一样，因此返回值是一个数值列表
 */
export function columnTops(column: Card[], layout: Layout): number[] {
    const tops: number[] = []
    let y = 0
    for (let i = 0; i < column.length; i++) {
        tops.push(y)
        y += column[i].faceUp ? layout.offUp : layout.offDown
    }
    return tops
}

/**
 * 获取指定列总高度
 */
export function columnPixelHeight(column: Card[], layout: Layout): number {
    if (column.length === 0) return layout.cardH
    const tops = columnTops(column, layout)
    return tops[tops.length - 1] + layout.cardH
}

/**
 * 计算牌组在画布上绘制的一些坐标点
 */
export function computeLayout(width: number, height: number, state: GameState): Layout {
    const paddingX = width < 520 ? 8 : 20
    const available = width - paddingX // 实际可用宽度
    const gapRatio = 0.14 // 牌组列与牌组列之间的间距比例，间距/牌组宽度=0.14
    let cardW = available / (NUM_COLUMNS + (NUM_COLUMNS - 1) * gapRatio) // 计算每列宽度
    cardW = Math.max(MIN_CARD_W, Math.min(MAX_CARD_W, Math.floor(cardW))) // 获取卡片实际使用宽度
    const gap = Math.max(3, Math.round(cardW * gapRatio)) // 间距
    const cardH = Math.round(cardW * 1.4) // 高/宽=1.4
    const totalW = NUM_COLUMNS * cardW + (NUM_COLUMNS - 1) * gap // 十列牌组总宽度
    const startX = Math.round((width - totalW) / 2) // 牌组开始左上角横坐标
    const topY = 14 // 牌组开始左上角纵坐标

    // 所需偏移量被压缩以适应可用的垂直空间
    let offUp = Math.round(cardH * 0.32) // 翻开的牌偏移量
    let offDown = Math.round(cardH * 0.16) // 盖着的牌偏移量

    const stackTop = (column: Card[], up: number, down: number) => {
        let y = 0
        for (let i = 0; i < column.length - 1; i++) {
            y += column[i].faceUp ? up : down
        }
        return y
    }
    // 如果某一列有很多牌，高度超出画布高度，这一列偏移量就需要按需缩小一点
    let maxTops = 0
    for (const col of state.tableau) maxTops = Math.max(maxTops, stackTop(col, offUp, offDown))
    const availableStack = height - topY - cardH - BOTTOM_PAD
    if (maxTops > availableStack && maxTops > 0) {
        const scale = availableStack / maxTops
        offUp = Math.max(9, Math.floor(offUp * scale))
        offDown = Math.max(5, Math.floor(offDown * scale))
    }

    const stock = {
        x: width - cardW - 16,
        y: height - cardH - 10,
        w: cardW,
        h: cardH,
    }

    return {
        width, // 画布宽度
        height, // 画布高度
        cardW, // 卡牌宽度
        cardH, // 卡牌高度
        gap, // 牌组与牌组间距
        offUp, // 牌组上翻开的牌在垂直方向偏移量
        offDown, // 牌组上盖上的牌在垂直方向偏移量
        startX, // 绘制牌组左上角横坐标
        topY, // 绘制牌组左上角纵坐标
        radius: Math.max(4, Math.round(cardW * 0.1)), // 纸牌圆角
        stock, // ?
    }
}

/**
 * 判断指定列是否有完成的序列 K,Q...3,2,1
 * 返回完成的序列数量以及完成序列的花色（用于收牌动画绘制对应的 K）
 */
export function collectCompleted(column: Card[]): { removed: number; suit: Suit | null } {
    let removed = 0
    let suit: Suit | null = null
    // 完成的序列是指底牌为K（13）到A（1），同花色，正面朝上，共13张牌。
    while (column.length >= 13) {
        const start = column.length - 13
        let ok = true
        for (let i = 0; i < 13; i++) {
            const card = column[start + i]
            if (!card.faceUp) {
                ok = false
                break
            }
            if (card.rank !== 13 - i) {
                ok = false
                break
            }
            if (card.suit !== column[start].suit) {
                ok = false
                break
            }
        }
        if (!ok) break
        if (removed === 0) suit = column[start].suit
        // 指定列移除完成序列的13张牌
        column.splice(start, 13)
        removed++
        // 如果移除后，指定列还有牌，则将最后一张牌翻开
        if (column.length > 0 && !column[column.length - 1].faceUp) {
            column[column.length - 1].faceUp = true
        }
    }
    return { removed, suit }
}

/**
 * 计算指定列底部已经成型的递减同花序列长度（从 K 开始向上）
 * 用于收牌动画时把"即将被收走"的那一段牌隐藏，让飞行中的牌代表整副序列
 */
export function bottomRunLength(column: Card[]): number {
    let len = 0
    for (let i = 0; i < column.length; i++) {
        const card = column[i]
        if (!card.faceUp) break
        if (card.rank !== 13 - i) break
        if (i > 0 && card.suit !== column[0].suit) break
        len++
    }
    return len
}

/**
 * 根据鼠标点击位置判断点了画布上什么东西
 * 
 * - 点发牌堆就发牌
 * - 点到可移动的牌段就发起拖拽
 * - 点到空白就什么也不做
 */
export function hitTest(px: number, py: number, state: GameState, layout: Layout): HitResult {
    const s = layout.stock
    if (px >= s.x && px <= s.x + s.w && py >= s.y && py <= s.y + s.h) {
        return { type: "stock" }
    }
    for (let col = 0; col < NUM_COLUMNS; col++) {
        const x = columnX(col, layout)
        if (px < x || px > x + layout.cardW) continue
        const column = state.tableau[col]
        if (column.length === 0) continue
        const tops = columnTops(column, layout)
        // topmost card whose top is above the pointer
        for (let i = column.length - 1; i >= 0; i--) {
            const top = layout.topY + tops[i]
            const bottom = top + layout.cardH
            if (py >= top && py <= bottom) {
                return { type: "card", col, cardIndex: i }
            }
        }
    }
    return null
}

/**
 * 双击某张牌时，自动寻找一个最合适的目标列把它移过去
 * 返回目标列的索引；若没有任何合法落点则返回 null
 * 优先级：同花色可接龙 > 任意可落下的非空列 > 空列
 */
export function findAutoMoveTarget(
    state: GameState,
    fromCol: number,
    cardIndex: number,
): number | null {
    const source = state.tableau[fromCol]
    if (!isMovableRun(source, cardIndex)) return null
    const movingCard = source[cardIndex]

    let sameSuitTarget: number | null = null
    let anyTarget: number | null = null
    let emptyTarget: number | null = null

    for (let col = 0; col < NUM_COLUMNS; col++) {
        if (col === fromCol) continue
        const target = state.tableau[col]
        if (target.length === 0) {
            if (emptyTarget === null) emptyTarget = col
            continue
        }
        if (canDrop(target, movingCard.rank)) {
            const top = target[target.length - 1]
            if (top.suit === movingCard.suit && sameSuitTarget === null) {
                sameSuitTarget = col
            }
            if (anyTarget === null) anyTarget = col
        }
    }

    // Prefer same-suit build, then any non-empty valid drop, then an empty column
    if (sameSuitTarget !== null) return sameSuitTarget
    if (anyTarget !== null) return anyTarget
    if (emptyTarget !== null) return emptyTarget
    return null
}

/**
 * 根据指针的横向坐标 px，找到它对应的牌列索引
 * 若 px 落在某列卡牌宽度范围内则直接命中该列
 * 否则返回中心距离 px 最近的那一列（用于拖拽松手时吸附到最近的列）
 */
export function nearestColumn(px: number, layout: Layout): number {
    let best = 0
    let bestDist = Number.POSITIVE_INFINITY // Infinity
    for (let col = 0; col < NUM_COLUMNS; col++) {
        const x = columnX(col, layout)
        if (px >= x && px <= x + layout.cardW) return col
        const center = x + layout.cardW / 2
        const d = Math.abs(px - center)
        if (d < bestDist) {
            bestDist = d
            best = col
        }
    }
    return best
}

/**
 * 深复制，修改克隆后的任何 Card 不会影响原状态
 */
export function cloneState(state: GameState): GameState {
    return {
        ...state,
        tableau: state.tableau.map((col) => col.map((c) => ({ ...c }))),
        stock: state.stock.map((c) => ({ ...c })),
    }
}

// ========== 发牌逻辑 ==========
/**
 * 计算右下角还能发几次牌
 */
export function dealsRemaining(state: GameState): number {
    return Math.floor(state.stock.length / NUM_COLUMNS)
}

/**
 * 是否能发牌，剩余牌为0不能发牌，页面上显示的十列牌组有任意列为空时不能发牌
 */
export function canDeal(state: GameState): boolean {
    if (state.stock.length === 0) return false
    // 页面上显示的十列牌组有任意列为空时不能发牌
    return state.tableau.every((col) => col.length > 0)
}

/**
 * 发牌
 */
export function dealFromStock(state: GameState): MoveOutcome | null {
    // 判断是否满足发牌条件
    if (!canDeal(state)) return null
    // 深复制一份卡牌数据结构，修改Card不会影响原对象
    const next = cloneState(state)
    // 遍历十列，给一列加一张翻开的牌
    for (let col = 0; col < NUM_COLUMNS; col++) {
        const card = next.stock.shift()
        if (card) {
            card.faceUp = true
            next.tableau[col].push(card)
        }
    }
    // 发牌算一次操作，操作数+1
    next.moves += 1
    // 处理完毕后，检查每一列是否有完成的序列，有时候发完牌会直接构成完整序列
    const collected: { col: number; suit: Suit; count: number }[] = []
    for (let col = 0; col < NUM_COLUMNS; col++) {
        const res = collectCompleted(next.tableau[col])
        if (res.removed > 0 && res.suit) {
            next.completed += res.removed
            next.score += 100 * res.removed
            collected.push({ col, suit: res.suit, count: 13 * res.removed })
        }
    }
    if (next.completed >= 8) next.won = true
    return { state: next, collected }
}

// ========== 拖拽逻辑 ==========
/**
 * 是否可以拖动
 * 比如一列数组 8,7,6,9 从 9 开始拖可以拖动，从6开始拖是拖不动的，因为6和之后的牌不是递减的
 */
export function isMovableRun(column: Card[], start: number): boolean {
    if (start < 0 || start >= column.length) return false
    for (let i = start; i < column.length; i++) {
        if (!column[i].faceUp) return false
        if (i > start) {
            const prev = column[i - 1]
            const cur = column[i]
            if (cur.suit !== prev.suit) return false
            if (cur.rank !== prev.rank - 1) return false
        }
    }
    return true
}

/**
 * 是否能将拖动的卡牌放到目标列
 */
export function canDrop(targetColumn: Card[], movingTopRank: number): boolean {
    if (targetColumn.length === 0) return true
    const top = targetColumn[targetColumn.length - 1] // 最后一张牌
    if (!top.faceUp) return false // 最后一张牌是盖着的，不能放
    return top.rank === movingTopRank + 1
}

/**
 * 拖动卡牌放置卡牌
 */
export function moveRun(
    state: GameState,
    fromCol: number,
    cardIndex: number,
    toCol: number,
): MoveOutcome | null {
    if (fromCol === toCol) return null
    // 拖动卡牌列数据
    const source = state.tableau[fromCol]
    // 判断是否可拖动
    if (!isMovableRun(source, cardIndex)) return null
    // 获得卡牌的数字 1-13(A-K)
    const movingTopRank = source[cardIndex].rank
    // 判断能否放置
    if (!canDrop(state.tableau[toCol], movingTopRank)) return null

    // 到这里是能拖动，能放置
    // 深复制原对象，修改Card不会改变原对象
    const next = cloneState(state)
    // 拖动列移除卡牌
    const moving = next.tableau[fromCol].splice(cardIndex)
    // 放置列添加卡牌
    next.tableau[toCol].push(...moving)

    // 如果从拖动列移除卡牌后，拖动类全部都是盖着的牌，需要翻开一张
    const src = next.tableau[fromCol]
    if (src.length > 0 && !src[src.length - 1].faceUp) {
        src[src.length - 1].faceUp = true
    }

    // 操作数+1
    next.moves += 1
    // 分数-1，无意义的来回拖动会降低分数
    next.score -= 1

    // 放置卡牌后判断是否构成完成序列
    const collected: { col: number; suit: Suit; count: number }[] = []
    const res = collectCompleted(next.tableau[toCol])
    // 构成完成序列，完成次数+1（共需要完成8次完整序列），对应的增加分数
    if (res.removed > 0 && res.suit) {
        next.completed += res.removed
        next.score += 100 * res.removed
        collected.push({ col: toCol, suit: res.suit, count: 13 * res.removed })
    }

    if (next.completed >= 8) next.won = true

    return { state: next, collected }
}
