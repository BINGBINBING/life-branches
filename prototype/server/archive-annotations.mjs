import { sources, profile } from './archive-sources.mjs';
import { validateAnalysis } from './engine.mjs';

// Curated prototype annotations of previously retrieved sources, not a live
// model response. Every quote is validated before the archive is served.
const raw = {
  paths: [
    {
      name: '自学与同行交流',
      cases: [
        {
          sourceId: 'S2',
          kind: 'self',
          background: {
            text: '作者描述了大学时期的自学与校内交流经历。',
            quote: '我当年主要是活跃在校内的bbs上面的编程相关的讨论区',
          },
          action: {
            text: '自学 C/C++ 与计算机基础，并与其他学院的同学交流，判断学习进度。',
            quote:
              '从图书馆借的谭浩强C语言开始入门，后面学了一点C++，再去学数据结构、算法，之后linux、网络编程等。',
          },
          outcome: {
            text: '作者自述通过自学进入互联网大厂，后来带团队并参与招聘。',
            quote: '我是自学进互联网大厂的，在大厂后带团队并一直负责组内的招聘',
          },
          result: 'success',
          comparison: {
            text: '作者能利用校内同学和讨论区获得反馈；你目前在职，是否有同样的交流资源还需确认。其学习时长未披露，不能照搬完成周期。',
            status: 'different',
            quote: '我当年主要是活跃在校内的bbs上面的编程相关的讨论区',
            userQuote: '在职',
          },
          missing: [
            '每日学习时长',
            '从开始学习到就业的周期',
            '当时的求职市场条件',
          ],
        },
      ],
    },
    {
      name: '边工作边探索项目',
      cases: [
        {
          sourceId: 'S1',
          kind: 'self',
          background: {
            text: '文章标题说明作者非科班、低学历；片段描述了在职期间的学习和公司经营压力。',
            quote: '非科班,低学历转职IT行业的经历,持续进行中...',
          },
          action: {
            text: '尝试小程序游戏，随后学习深度学习和 NLP，准备做产品技术验证。',
            quote:
              '学了fastai课程前四五章，然后脑袋里突然蹦出了某个产品的想法，但需要一些nlp技术的支持，于是就去看了Transformers 的nlp course',
          },
          outcome: {
            text: '早期项目尝试在技术验证阶段受阻；新的产品想法尚待验证，不能判断最终结果。',
            quote: '折腾了半天的东西，在技术验证阶段就碰到瓶颈了。',
          },
          result: 'setback',
          comparison: {
            text: '你希望保留收入；这个案例显示，即使仍在工作，也可能面临公司拖薪压力。其岗位与学习阶段与你并不完全相同。',
            status: 'different',
            quote: '不过上个月工资拖了十天才发',
            userQuote: '不能中断收入',
          },
          missing: ['实际学历层次', '学习投入时间', '后续产品验证结果'],
        },
      ],
    },
    {
      name: '脱产参加培训（运维）',
      cases: [
        {
          sourceId: 'S3',
          kind: 'self',
          background: null,
          action: {
            text: '脱产数月参加线下运维培训，结业后继续求职两个月。',
            quote:
              '当初脑子一热选择了线下运维培训班，前前后后耗费数月时间脱产上课',
          },
          outcome: {
            text: '作者自述没有找到合适工作，仍需要偿还培训贷款。',
            quote:
              '一份合适的工作都没能敲定，当初为了缴纳学费办理的培训贷款却实实在在背在了身上',
          },
          result: 'setback',
          comparison: {
            text: '该案例需要脱产，而你希望保留收入；此外它属于运维培训，不能直接当成开发岗位培训的结果。',
            status: 'different',
            quote: '前前后后耗费数月时间脱产上课',
            userQuote: '不能中断收入',
          },
          missing: ['学历与原有基础', '培训费用', '地区与投递岗位范围'],
        },
      ],
    },
  ],
  insights: [
    {
      type: 'practice',
      title: '给自学增加外部反馈',
      text: '作者通过技术交流判断自己学到哪里、下一步学什么。可参考这种获得反馈的做法，但不能据此推定求职结果。',
      sourceId: 'S2',
      quote: '技术交流很容易知道自己下一步该学什么、以及自己学得怎么样了。',
    },
    {
      type: 'risk',
      title: '成功经历没有给出可复现的时间表',
      text: '作者描述了多阶段学习路线，但片段未给出每日投入或总周期，不能据此认定每天两小时能在半年内完成转行。',
      sourceId: 'S2',
      quote:
        '从图书馆借的谭浩强C语言开始入门，后面学了一点C++，再去学数据结构、算法，之后linux、网络编程等。',
    },
    {
      type: 'practice',
      title: '把产品想法拆成技术验证',
      text: '作者先学习相关课程，再准备验证产品想法。可以参考这种分阶段检查的做法，来源尚未报告最终成果。',
      sourceId: 'S1',
      quote: '到目前为止已经有实践思路了，下一步就是做产品的技术验证。',
    },
    {
      type: 'risk',
      title: '技术和配套资源都可能成为卡点',
      text: '作者的小程序游戏尝试遇到美术资源和技术验证瓶颈。需要结合你计划做的项目，确认是否有类似依赖。',
      sourceId: 'S1',
      quote: '于是开始研究想做点小程序游戏，最后发现太缺美术资源了',
    },
    {
      type: 'risk',
      title: '脱产成本与就业不确定性叠加',
      text: '该作者自述结业后未找到合适工作且仍有贷款。对不能中断收入的示例人物，这一投入方式存在明显条件差异。',
      sourceId: 'S3',
      quote:
        '一份合适的工作都没能敲定，当初为了缴纳学费办理的培训贷款却实实在在背在了身上',
    },
  ],
  questions: [
    {
      question: '你能找到帮你检查代码、交流学习进度的人吗？',
      reason:
        '这个成功案例利用校内交流获得反馈。你是否有类似资源，会影响这项做法能否照搬。',
      sourceId: 'S2',
      quote: '技术交流很容易知道自己下一步该学什么、以及自己学得怎么样了。',
      options: ['有熟悉开发的朋友', '有线上交流社区', '暂时没有'],
    },
  ],
};

export function curatedArchive() {
  const result = validateAnalysis(raw, sources, profile);
  if (result.paths.length !== 3 || result.rejected)
    throw new Error('Historical evidence validation failed');
  return {
    status: 'done',
    progress: '历史样本',
    profile,
    sources,
    result,
    error: null,
    reused: true,
    historical: true,
    curated: true,
    retrievedAt: '2026-09-05',
  };
}
