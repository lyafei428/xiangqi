// 对弈题的公开类型。schema 与 session 都从这里取，避免互相 import。

export type MissionType = 'find-mate' | 'attack' | 'defense';

export interface Mission {
  readonly id: string;
  readonly type: MissionType;
  /** 关联的课 id，课程页据此直链。 */
  readonly lesson: string;
  readonly title: string;
  readonly fen: string;
  /** 找杀与防守固定为 1；攻杀是允许的玩家着数（1 或 2）。 */
  readonly plies: number;
  readonly source: string;
  readonly hint: string;
}
