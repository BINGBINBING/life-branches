import assert from 'node:assert/strict';
import test from 'node:test';
import { hasObservableAction } from './action-evidence.mjs';

test('observable actions exclude attitude, wishes and advice-only clauses', () => {
  for (const quote of ['我做了重要决定，从未后悔', '建议大家投递简历', '我计划学习编程', '我没有完成项目', '如果申请转专业就好了', '我想学习编程', '学习很重要', '我愿意投递简历', '我喜欢开发网页', '如何申请转专业'])
    assert.equal(hasObservableAction(quote), false, quote);
  for (const quote of ['我每天学习两小时', '我完成了网页项目', '我提交了转专业申请', '我完成了项目，从未后悔', '我想继续深造，但我已经提交了转专业申请'])
    assert.equal(hasObservableAction(quote), true, quote);
});
