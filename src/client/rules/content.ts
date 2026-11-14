// 规则页内容：走法要点、判罚口径、v1 不覆盖的判罚。
// 判罚两列逐字取自 docs/requirements/xiangqi.md §4——需求档是唯一真相，
// 用例把这里和需求档逐行对齐，只改一处会红。

export interface RuleSection {
  readonly title: string;
  readonly items: readonly string[];
}

export interface PenaltyRow {
  /** 需求 §4「情形」列原文。 */
  readonly title: string;
  /** 需求 §4「判罚」列原文。 */
  readonly penalty: string;
}

export interface PenaltyTable {
  readonly title: string;
  readonly rows: readonly PenaltyRow[];
}

/** 每条一句，不展开教学——课程页已有 22 课。 */
export const MOVE_POINTS: RuleSection = {
  title: '走法要点',
  items: [
    '马走日：先直一格再斜一格，直行那格有子就被蹩住（蹩马腿）。',
    '象走田：斜走两格，中间那格有子走不了（塞象眼），且象不过河。',
    '炮隔子吃：不吃子时走法与车相同，吃子必须隔一个棋子跳过去。',
    '兵过河可横走：未过河只能向前一步，过河后可左右横走，始终不能后退。',
    '将帅不出九宫：一步一格，两将不可在同一直线上照面。',
  ],
};

export const PENALTY_TABLE: PenaltyTable = {
  title: '判罚口径',
  rows: [
    { title: '将死（被将且无合法着法）', penalty: '被将方负' },
    { title: '困毙（未被将但无合法着法）', penalty: '无着法方负' },
    { title: '长将（同一方在重复循环中每着都将军）', penalty: '长将方负' },
    { title: '三次重复局面', penalty: '和' },
    { title: '连续 60 回合（120 着）无吃子', penalty: '和' },
    { title: '超时（一方时钟归零）', penalty: '归零方负' },
    { title: '认输', penalty: '认输方负' },
    { title: '一方提议和棋、对方接受', penalty: '和' },
  ],
};

export const OUT_OF_SCOPE: RuleSection = {
  title: '不在 v1 范围内',
  items: [
    '长捉、一将一闲等复杂判罚不在 v1 范围内，按上表简化处理。',
    '也就是说：遇到这些情形只套用上表八条，不为长捉、一将一闲单独设判罚。',
  ],
};
