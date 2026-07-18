/**
 * 类型定义（单文件，被其他文件引用）
 */

// 扑克牌花色 spades黑桃  hearts红桃  diamonds方块  clubs梅花♣
export type Suit = "spades" | "hearts" | "diamonds" | "clubs"

// 扑克牌
export type Card = {
    id: string
    suit: Suit // 花色
    rank: number // 1 (Ace) .. 13 (King)
    faceUp: boolean // 是否正面朝上(可以看见牌面)
}

// 三个难度，指扑克牌花色数目: 单色，双色，四色
export type Difficulty = 1 | 2 | 4

// 游戏状态
export type GameState = {
    tableau: Card[][] // 画布上方显示的十列牌组
    stock: Card[] // 剩余的牌
    completed: number // 总共要完成8副扑克牌，默认完成0副牌
    score: number // 得分
    moves: number // 步数
    difficulty: Difficulty // 难度
    won: boolean // 是否胜利
}

// 一次走子/发牌的结果：新的游戏状态 + 本次新完成的序列信息（用于收牌动画）
export type MoveOutcome = {
    state: GameState
    collected: { col: number; suit: Suit; count: number }[]
}

// 布局，绘制所需相关参数
export type Layout = {
    width: number // 画布宽度
    height: number // 画布高度
    cardW: number // 牌宽度
    cardH: number // 牌高度
    gap: number // 上面显示的十列牌组与牌组之间的间距
    offUp: number // 翻开的牌顶部偏移量
    offDown: number // 盖住的牌顶部偏移量
    startX: number // 绘制牌组左上角 x 坐标
    topY: number // 绘制牌组左上角 y 坐标
    radius: number // 牌圆角
    stock: { x: number; y: number; w: number; h: number }
}

// 拖拽信息
export type DragInfo = {
    fromCol: number
    cardIndex: number
    cards: Card[]
    offsetX: number
    offsetY: number
    x: number
    y: number
}

// 鼠标点到了什么
export type HitResult =
  | { type: "stock" }  // 点击了右下角的发牌
  | { type: "card"; col: number; cardIndex: number }  // 点击了牌组中的某张牌
  | null // 空白区域