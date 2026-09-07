import { writeFile } from 'node:fs/promises';
import {
  conditions,
  discoverySources,
  CONDITION_DICTIONARY_VERSION,
} from './condition-dictionary.mjs';

const atoms = conditions.filter((c) => c.nodeType === 'atomic');
const discovered = atoms.filter((c) => c.origin === 'zhihu_discovered');
const text = `# 条件词典 ${CONDITION_DICTIONARY_VERSION}

更新：2026-09-07。范围：转专业、转行业。构建脚本：server/build-condition-report.mjs。

## 当前规模

- 总条目 ${conditions.length}，其中原子条件 ${atoms.length}、旧版待拆分维度 ${conditions.length - atoms.length}。
- 原子条件中，${discovered.length} 项绑定本轮知乎连续引文；其余为常识候选或旧版候选。
- 转专业可涉及 ${atoms.filter((c) => c.scope.includes('major_transition')).length} 项原子条件；转行业可涉及 ${atoms.filter((c) => c.scope.includes('career_transition')).length} 项。两者包含共用项，不能相加作为总数。
- 共 ${discoverySources.length} 条来源记录，其中本轮新增 ${discoverySources.filter((s) => s.id.startsWith('E')).length} 条带引文记录。

## 如何使用

先确定转换路径，再选择相关条件。转专业分校内转换、跨专业读研、第二学士学位、辅修；后三类为独立候选扩展，不能把它们的资格等同于校内转专业。转行业区分行业和岗位职能，并覆盖工业、设计、财会、销售、教育、软件、运营专项条件。

旧版大类保留 ID 便于迁移，nodeType 为 legacy_dimension，不和子条件一起计分或提问。新条件有数据类型、所属路径、岗位范围、主体与单位比较约束。数字、区间、未知、用户拒绝回答应作为条件值或状态保存，不能拆成新条件 ID。

词典已接入搜索前条件表单：DeepSeek 只返回条件 ID，本地按范围、路径和目标行业校验后，使用词典中的问题文案。搜索后的动态补问仍由 evidence-policy.mjs 管理，只有原文暴露可比条件时才出现。

有学校、院系、招生项目或招聘条件的条目需回到具体官方材料核对。词典记录“需要核对什么”，不内置通用绩点门槛、证书要求、年龄界限、薪资或成功率。个人资源信息提供 voluntary_only 标记。每次只展示与当前案例相关的少量未知条件。

## 本轮研究范围与缺口

本轮新增 6 次知乎 CLI 检索，每次最多 5 条结果，共返回 30 条；另做 5 组网页检索。主题是工业自动化、设计、会计/销售/教育、学业路径、第二学士学位，以及单独补搜的销售与教学经历。选取 12 条知乎搜索片段作发现证据，未读取这些文章的完整正文。

会计结果以培训内容为主，销售与教育经过单独补搜仍只有少量引文支持；没有具体引文的专项条目仍标为常识候选。跨考资格、医学/法律等受准入约束的路径尚需官方材料；第二学位多为历史经历，不能推为现行规则。此次没有调用 DeepSeek，也未宣称穷尽所有条件。

v0.1 的来源仅为宽泛关联，缺少逐条引文。现存 legacyDiscoveryRefs 保留追溯，但不作为已验证证据。每个本轮来源的 supports 仅对应引文直接出现的条件，不扩散到同组全部条目。频率和来源数不能代表重要性或因果。

## 全部原子条件

| ID | 条件 | 范围 | 路径 / 专项 | 提问草案 | 发现依据 |
| --- | --- | --- | --- | --- | --- |
${atoms.map((c) => `| ${c.id} | ${c.label} | ${c.scope.map((s) => (s === 'major_transition' ? '转专业' : '转行业')).join('、')} | ${c.paths.join(',')} / ${c.sectors.join(',')} | ${c.question} | ${c.evidence.length ? c.evidence.join(',') : '常识或旧版候选，待证据'} |`).join('\n')}

## 本轮引文账本

${discoverySources
  .filter((s) => s.id.startsWith('E'))
  .map(
    (s) =>
      `### ${s.id} ${s.title}\n\n[知乎来源](${s.url})；${s.kind}；获取于 ${s.retrievedAt}，仅搜索片段。\n\n> ${s.quote}\n\n对应条件：${s.supports.join('、')}。${s.caution}`,
  )
  .join('\n\n')}

## 后续补齐顺序

1. 继续覆盖销售客户线索、教师岗位类型和不同学科的第一人称转型经历，补齐目前只有常识候选的条目。
2. 围绕具体学校与目标行业，补课程开设周期、招聘条件、证照等官方证据。
3. 每个准备启用的条件建立“已知、未知、拒答、阶段冲突、量表冲突”样例，再检验 AI 映射与提问。
4. 对没有合适词条的材料保留开放候选入口，记录原文、路径和建议命名，定期合并同义项。
`;

await writeFile(new URL('../CONDITION-DICTIONARY.md', import.meta.url), text);
console.log(
  JSON.stringify({
    version: CONDITION_DICTIONARY_VERSION,
    entries: conditions.length,
    atomic: atoms.length,
    quoteBacked: discovered.length,
  }),
);
