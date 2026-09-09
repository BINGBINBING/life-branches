import assert from 'node:assert/strict';
import test from 'node:test';
import { hasObservableAction } from './action-evidence.mjs';

test('observable actions exclude attitude, wishes and advice-only clauses', () => {
  for (const quote of ['我做了重要决定，从未后悔', '建议大家投递简历', '我计划学习编程', '我没有完成项目', '如果申请转专业就好了'])
    assert.equal(hasObservableAction(quote), false, quote);
  for (const quote of ['我每天学习两小时', '我完成了网页项目', '我提交了转专业申请', '我完成了项目，从未后悔'])
    assert.equal(hasObservableAction(quote), true, quote);
});
