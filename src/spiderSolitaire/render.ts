/**
 * Canvas 绘制（Card 绘制、背景绘制、动画）
 */

import { COLORS, NUM_COLUMNS, RANK_LABEL, SUIT_SYMBOL } from "./consts"
import { columnPixelHeight, columnTops, columnX } from "./model"
import type { Card, DragInfo, GameState, Layout, Suit } from "./types"

/**
 * 画圆角矩形
 */
export function roundRectPath(
    ctx: CanvasRenderingContext2D,
    x: number, // 矩形左上角 x 坐标
    y: number, // 矩形左上角 y 坐标
    w: number, // 矩形宽度
    h: number, // 矩形高度
    r: number, // 矩形圆角
) {
    const rr = Math.min(r, w / 2, h / 2)
    ctx.beginPath()
    ctx.moveTo(x + rr, y)
    ctx.arcTo(x + w, y, x + w, y + h, rr)
    ctx.arcTo(x + w, y + h, x, y + h, rr)
    ctx.arcTo(x, y + h, x, y, rr)
    ctx.arcTo(x, y, x + w, y, rr)
    ctx.closePath()
}

/**
 * 指定列没有扑克牌时，画一张扑克牌的轮廓
 */
export function drawEmptySlot(ctx: CanvasRenderingContext2D, x: number, y: number, layout: Layout) {
    const { cardW: w, cardH: h, radius: r } = layout
    roundRectPath(ctx, x, y, w, h, r)
    ctx.fillStyle = COLORS.emptyFill
    ctx.fill()
    ctx.setLineDash([6, 5])
    ctx.strokeStyle = COLORS.emptyStroke
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.setLineDash([])
}

/**
 * 画扑克牌背面
 */
export function drawCardBack(ctx: CanvasRenderingContext2D, x: number, y: number, layout: Layout) {
    const { cardW: w, cardH: h, radius: r } = layout
    ctx.save()
    ctx.shadowColor = COLORS.faceShadow
    ctx.shadowBlur = 5
    ctx.shadowOffsetY = 2
    roundRectPath(ctx, x, y, w, h, r)
    const g = ctx.createLinearGradient(x, y, x, y + h)
    g.addColorStop(0, COLORS.back)
    g.addColorStop(1, COLORS.backDark)
    ctx.fillStyle = g
    ctx.fill()
    ctx.restore()

    // 白色外缘
    roundRectPath(ctx, x + 1.5, y + 1.5, w - 3, h - 3, Math.max(3, r - 1))
    ctx.strokeStyle = COLORS.backEdge
    ctx.lineWidth = 1.5
    ctx.stroke()

    // 嵌入面板内的钻石格子
    const inset = Math.max(4, w * 0.11)
    ctx.save()
    roundRectPath(ctx, x + inset, y + inset, w - inset * 2, h - inset * 2, Math.max(2, r - 3))
    ctx.clip()
    ctx.strokeStyle = COLORS.backLine
    ctx.lineWidth = 1
    const step = Math.max(6, w * 0.16)
    for (let i = -h; i < w + h; i += step) {
        ctx.beginPath()
        ctx.moveTo(x + i, y)
        ctx.lineTo(x + i + h, y + h)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(x + i, y + h)
        ctx.lineTo(x + i + h, y)
        ctx.stroke()
    }
    ctx.restore()

    // 面板边框 + 中央徽章
    roundRectPath(ctx, x + inset, y + inset, w - inset * 2, h - inset * 2, Math.max(2, r - 3))
    ctx.strokeStyle = COLORS.backEmblem
    ctx.lineWidth = 1.5
    ctx.stroke()
    const cx = x + w / 2
    const cy = y + h / 2
    const d = w * 0.14
    ctx.beginPath()
    ctx.moveTo(cx, cy - d)
    ctx.lineTo(cx + d, cy)
    ctx.lineTo(cx, cy + d)
    ctx.lineTo(cx - d, cy)
    ctx.closePath()
    ctx.fillStyle = COLORS.backEmblem
    ctx.fill()
}

/**
 * 画扑克牌正面
 */
export function drawCardFace(
    ctx: CanvasRenderingContext2D,
    card: Card,
    x: number,
    y: number,
    layout: Layout,
) {
    const { cardW: w, cardH: h, radius: r } = layout
    ctx.save()
    // 设置阴影
    ctx.shadowColor = COLORS.faceShadow
    ctx.shadowBlur = 5
    ctx.shadowOffsetY = 2
    roundRectPath(ctx, x, y, w, h, r)
    // 设置线性渐变
    const g = ctx.createLinearGradient(x, y, x, y + h)
    g.addColorStop(0, COLORS.faceTop)
    g.addColorStop(1, COLORS.faceBottom)
    ctx.fillStyle = g
    ctx.fill()
    ctx.restore()

    // 外侧 + 精致的内边框
    roundRectPath(ctx, x + 0.5, y + 0.5, w - 1, h - 1, r)
    ctx.strokeStyle = COLORS.border
    ctx.lineWidth = 1
    ctx.stroke()

    const color = card.suit === "hearts" || card.suit === "diamonds" ? COLORS.red : COLORS.black
    const label = RANK_LABEL[card.rank]
    const symbol = SUIT_SYMBOL[card.suit]

    // ---- Corner indices (top-left + bottom-right rotated) ----
    const rankSize = Math.round(w * 0.15)
    const cornerSuit = Math.round(w * 0.1)
    const padX = Math.max(3, Math.round(w * 0.1))
    const padY = Math.max(3, Math.round(h * 0.05))

    const drawCorner = () => {
        ctx.fillStyle = color
        ctx.textAlign = "center"
        ctx.textBaseline = "top"
        ctx.font = `700 ${rankSize}px ui-sans-serif, system-ui, sans-serif`
        const cxText = x + padX + rankSize * 0.35
        ctx.fillText(label, cxText, y + padY)
        ctx.font = `${cornerSuit}px "Segoe UI Symbol", ui-sans-serif, sans-serif`
        ctx.fillText(symbol, cxText, y + padY + rankSize + 1)
    }
    drawCorner()
    ctx.save()
    ctx.translate(x + w, y + h)
    ctx.rotate(Math.PI)
    ctx.fillStyle = color
    ctx.textAlign = "center"
    ctx.textBaseline = "top"
    ctx.font = `700 ${rankSize}px ui-sans-serif, system-ui, sans-serif`
    const cxText = padX + rankSize * 0.35
    ctx.fillText(label, cxText, padY)
    ctx.font = `${cornerSuit}px "Segoe UI Symbol", ui-sans-serif, sans-serif`
    ctx.fillText(symbol, cxText, padY + rankSize + 1)
    ctx.restore()

    ctx.fillStyle = color
}

/**
 * 计算左下角已收集序列（K 牌）的布局信息，供绘制与收牌动画共用
 */
export function foundationLayout(layout: Layout, count: number) {
    const fw = Math.min(layout.cardW * 0.62, 46)
    const fh = fw * 1.4
    const gap = 4
    const maxW = layout.width * 0.45
    let step = fw + gap
    const total = count * (fw + gap) - gap
    if (total > maxW) step = (maxW + gap) / Math.max(1, count)
    const baseX = 14
    const baseY = layout.height - fh - 12
    return { fw: Math.min(fw, step - 2), fh, gap, step, baseX, baseY }
}

/**
 * 画一张已收集序列的 K 牌（正面，显示花色）
 */
export function drawFoundationCard(
    ctx: CanvasRenderingContext2D,
    suit: Suit,
    x: number,
    y: number,
    w: number,
    h: number,
) {
    roundRectPath(ctx, x, y, w, h, Math.max(4, w * 0.1))
    const g = ctx.createLinearGradient(x, y, x, y + h)
    g.addColorStop(0, COLORS.faceTop)
    g.addColorStop(1, COLORS.faceBottom)
    ctx.fillStyle = g
    ctx.fill()
    ctx.strokeStyle = COLORS.border
    ctx.lineWidth = 1
    ctx.stroke()

    const color = suit === "hearts" || suit === "diamonds" ? COLORS.red : COLORS.black
    ctx.fillStyle = color
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    const rankSize = Math.round(w * 0.36)
    const symSize = Math.round(w * 0.28)
    ctx.font = `700 ${rankSize}px ui-sans-serif, system-ui, sans-serif`
    ctx.fillText("K", x + w / 2, y + h * 0.34)
    ctx.font = `${symSize}px "Segoe UI Symbol", ui-sans-serif, sans-serif`
    ctx.fillText(SUIT_SYMBOL[suit], x + w / 2, y + h * 0.68)
}

/**
 * 在左下角绘制已收集的 K 牌（每完成一副序列显示一张）
 */
export function drawFoundations(ctx: CanvasRenderingContext2D, foundations: Suit[], layout: Layout) {
    if (foundations.length === 0) return
    const fl = foundationLayout(layout, foundations.length)
    for (let i = 0; i < foundations.length; i++) {
        const x = fl.baseX + i * fl.step
        drawFoundationCard(ctx, foundations[i], x, fl.baseY, fl.fw, fl.fh)
    }
}

/**
 * 在画布上绘制各种元素
 */
export function drawGame(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    layout: Layout,
    opts: {
        drag: DragInfo | null
        hoverCol: number | null
        dealsLeft: number
        hideTop?: boolean
        foundations?: Suit[]
        hide?: { col: number; from: number }[]
    },
) {
    const { drag, hoverCol, dealsLeft, hideTop, foundations, hide } = opts
    ctx.clearRect(0, 0, layout.width, layout.height) // 清空画布

    for (let col = 0; col < NUM_COLUMNS; col++) {
        const column = state.tableau[col]
        const x = columnX(col, layout)

        // 当前正在拖拽中并且拖到当前列，当前列有一个金色边框
        if (hoverCol === col && drag) {
            const hh = columnPixelHeight(column, layout) // 指定列总高度
            roundRectPath(ctx, x - 3, layout.topY - 3, layout.cardW + 6, hh + 6, layout.radius + 2)
            ctx.strokeStyle = COLORS.gold
            ctx.lineWidth = 3
            ctx.stroke()
        }

        // 当前列没有扑克牌，画一张扑克牌的轮廓
        if (column.length === 0) {
            drawEmptySlot(ctx, x, layout.topY, layout)
            continue
        }

        // 获取当前列所有扑克牌顶部坐标数组
        const tops = columnTops(column, layout)
        let hideFrom = drag && drag.fromCol === col ? drag.cardIndex : column.length
        if (hideTop) hideFrom = Math.min(hideFrom, column.length - 1)
        // 收牌动画期间隐藏"即将被收走"的牌段，让飞行中的牌代表整副序列
        if (hide) {
            for (const h of hide) {
                if (h.col === col) hideFrom = Math.min(hideFrom, h.from)
            }
        }

        for (let i = 0; i < column.length; i++) {
            if (i >= hideFrom) break
            const y = layout.topY + tops[i]
            if (column[i].faceUp) drawCardFace(ctx, column[i], x, y, layout)
            else drawCardBack(ctx, x, y, layout)
        }
    }

    // Stock pile
    const s = layout.stock
    if (dealsLeft > 0) {
        const stacks = Math.min(dealsLeft, 5)
        for (let i = 0; i < stacks; i++) {
            drawCardBack(ctx, s.x - i * 3, s.y - i * 3, layout)
        }
    } else {
        roundRectPath(ctx, s.x, s.y, s.w, s.h, layout.radius)
        ctx.setLineDash([6, 5])
        ctx.strokeStyle = COLORS.emptyStroke
        ctx.lineWidth = 2
        ctx.stroke()
        ctx.setLineDash([])
    }

    // Dragged cards, on top
    if (drag) {
        const dx = drag.x - drag.offsetX
        const dy = drag.y - drag.offsetY
        for (let i = 0; i < drag.cards.length; i++) {
            drawCardFace(ctx, drag.cards[i], dx, dy + i * layout.offUp, layout)
        }
    }

    // 左下角已收集的 K 牌
    if (foundations && foundations.length > 0) {
        drawFoundations(ctx, foundations, layout)
    }
}
