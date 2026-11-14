// 每步胜率条：左「红 x%」、中间概率条、右「黑 y%」。
// 数字是文本而不是画进条里：读屏直接读得到，字号也不受条高限制。
// 黑方取红方的补数，不各自四舍五入——两列数字必须合计 100%。

export interface EvalBarProps {
  /** 红方期望分 0..1：终局时正好 0 / 0.5 / 1。 */
  readonly red: number;
}

/** 期望分 → 百分比文本，四舍五入到整数。记谱格与条共用这一处取整口径。 */
export function percentText(value: number): string {
  return `${String(Math.round(value * 100))}%`;
}

export function EvalBar({ red }: EvalBarProps) {
  const redPct = Math.round(red * 100);
  const blackPct = 100 - redPct;
  return (
    <div className="eval-bar">
      {/* 两边数字、中间条：读者先看红再扫条，视觉重心落在条上。 */}
      <span className="eval-num eval-num-red">红 {redPct}%</span>
      {/* 条只是视觉：语义由 aria-label 给，里面的两个色块不读。 */}
      <div className="eval-track" role="img" aria-label={`红方胜率 ${String(redPct)}%`}>
        <span className="eval-fill eval-fill-red" style={{ width: `${String(redPct)}%` }} />
        <span className="eval-fill eval-fill-black" style={{ width: `${String(blackPct)}%` }} />
      </div>
      <span className="eval-num eval-num-black">黑 {blackPct}%</span>
    </div>
  );
}
