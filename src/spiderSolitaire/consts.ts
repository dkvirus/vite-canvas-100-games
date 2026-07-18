import type { Suit } from "./types";

export const SUITS: Suit[] = ["spades", "hearts", "diamonds", "clubs"]

// 页面上会显示10列牌组
export const NUM_COLUMNS = 10
// 扑克牌最小宽度
export const MIN_CARD_W = 30
// 扑克牌最大宽度
export const MAX_CARD_W = 96
// 指定列顶部留白间距
export const BOTTOM_PAD = 12

// 颜色映射
export const COLORS = {
    faceTop: "#ffffff",
    faceBottom: "#f1eee3",
    faceShadow: "rgba(0,0,0,0.3)",
    red: "#c62828",
    redSoft: "#e57373",
    black: "#22262f",
    blackSoft: "#5b6270",
    border: "#c9c7bd",
    innerBorder: "rgba(0,0,0,0.08)",
    back: "#3552c4",
    backDark: "#26399a",
    backLine: "rgba(255,255,255,0.22)",
    backEdge: "#e9edff",
    backEmblem: "#e6b93f",
    gold: "#e6b93f",
    hint: "#ffd54a",
    emptyStroke: "rgba(255,255,255,0.3)",
    emptyFill: "rgba(0,0,0,0.14)",
}

// 纸牌映射，1显示为A,11显示为J
export const RANK_LABEL: Record<number, string> = {
    1: "A",
    2: "2",
    3: "3",
    4: "4",
    5: "5",
    6: "6",
    7: "7",
    8: "8",
    9: "9",
    10: "10",
    11: "J",
    12: "Q",
    13: "K",
}

// 花色图标
export const SUIT_SYMBOL: Record<Suit, string> = {
    spades: "\u2660",
    hearts: "\u2665",
    diamonds: "\u2666",
    clubs: "\u2663",
}
