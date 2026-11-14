// 规则页：只负责渲染，文案全在 rules/content.ts。

import { MOVE_POINTS, OUT_OF_SCOPE, PENALTY_TABLE } from '../rules/content.ts';
import '../rules/rules.css';

export function RulesPage() {
  return (
    <div className="page page-rules">
      <div className="rules-inner">
        <h1 className="page-title">规则</h1>
        <p className="page-subtitle">v1 采用的判罚口径。八条之外的情形不在本版范围内。</p>

        <section className="rules-section">
          <h2 className="rules-section-title">{MOVE_POINTS.title}</h2>
          <ul className="rules-list">
            {MOVE_POINTS.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="rules-section">
          <h2 className="rules-section-title">{PENALTY_TABLE.title}</h2>
          <table className="rules-table">
            <thead>
              <tr>
                <th scope="col">情形</th>
                <th scope="col">判罚</th>
              </tr>
            </thead>
            <tbody>
              {PENALTY_TABLE.rows.map((row) => (
                <tr key={row.title}>
                  <th scope="row">{row.title}</th>
                  <td>{row.penalty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="rules-section">
          <h2 className="rules-section-title">{OUT_OF_SCOPE.title}</h2>
          <ul className="rules-list">
            {OUT_OF_SCOPE.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
