import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDecisionInsights } from './decision-summary.mjs';

const baseCase = {
  sourceId: 'S1',
  action: { quote: '我先在职完成了两个项目' },
  stage: null,
  conditionComparisons: [
    {
      label: '每日可投入时间',
      status: 'different',
      caseValue: '8小时/天',
      userValue: '2小时/天',
    },
  ],
};

test('practice conclusion explains why a source action cannot be copied', () => {
  const result = buildDecisionInsights([{ cases: [baseCase] }], []);
  assert.equal(result[0].text, '我先在职完成了两个项目');
  assert.match(result[0].applicability, /8小时\/天/);
  assert.match(result[0].applicability, /2小时\/天/);
  assert.match(result[0].applicability, /不能直接照搬/);
});

test('risk is only synthesized from a locally validated setback stage', () => {
  const paths = [
    {
      cases: [
        {
          ...baseCase,
          stage: { result: 'setback', quote: '我面试三次都被拒' },
        },
      ],
    },
  ];
  const result = buildDecisionInsights(paths, []);
  const risk = result.find((item) => item.type === 'risk');
  assert.equal(risk.quote, '我面试三次都被拒');
  assert.match(risk.applicability, /风险是否与你相关还需核查/);
});

test('missing user condition stays explicitly unknown', () => {
  const item = {
    ...baseCase,
    conditionComparisons: [
      { label: '相关经验', status: 'unknown', caseValue: '2年', userValue: '' },
    ],
  };
  const result = buildDecisionInsights([{ cases: [item] }], []);
  assert.match(result[0].applicability, /尚未提供/);
  assert.match(result[0].applicability, /仍待确认/);
});
