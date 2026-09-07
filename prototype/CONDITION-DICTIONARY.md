# 条件词典 0.2.0

更新：2026-09-07。范围：转专业、转行业。构建脚本：server/build-condition-report.mjs。

## 当前规模

- 总条目 168，其中原子条件 134、旧版待拆分维度 34。
- 原子条件中，16 项绑定本轮知乎连续引文；其余为常识候选或旧版候选。
- 转专业可涉及 69 项原子条件；转行业可涉及 86 项。两者包含共用项，不能相加作为总数。
- 共 20 条来源记录，其中本轮新增 12 条带引文记录。

## 如何使用

先确定转换路径，再选择相关条件。转专业分校内转换、跨专业读研、第二学士学位、辅修；后三类为独立候选扩展，不能把它们的资格等同于校内转专业。转行业区分行业和岗位职能，并覆盖工业、设计、财会、销售、教育、软件、运营专项条件。

旧版大类保留 ID 便于迁移，nodeType 为 legacy_dimension，不和子条件一起计分或提问。新条件有数据类型、所属路径、岗位范围、主体与单位比较约束。数字、区间、未知、用户拒绝回答应作为条件值或状态保存，不能拆成新条件 ID。

词典已接入搜索前条件表单：DeepSeek 只返回条件 ID，本地按范围、路径和目标行业校验后，使用词典中的问题文案。已在初始描述中通过本地规则确认的学历、绩点、学期、投入时间、收入连续性和专业起止会优先预填，每个值保留连续用户原文。搜索后的动态补问由 `evidence-policy.mjs` 管理，只有原文暴露可比条件时才出现。

有学校、院系、招生项目或招聘条件的条目需回到具体官方材料核对。词典记录“需要核对什么”，不内置通用绩点门槛、证书要求、年龄界限、薪资或成功率。个人资源信息提供 voluntary_only 标记。每次只展示与当前案例相关的少量未知条件。

## 本轮研究范围与缺口

本轮新增 6 次知乎 CLI 检索，每次最多 5 条结果，共返回 30 条；另做 5 组网页检索。主题是工业自动化、设计、会计/销售/教育、学业路径、第二学士学位，以及单独补搜的销售与教学经历。选取 12 条知乎搜索片段作发现证据，未读取这些文章的完整正文。

会计结果以培训内容为主，销售与教育经过单独补搜仍只有少量引文支持；没有具体引文的专项条目仍标为常识候选。跨考资格、医学/法律等受准入约束的路径尚需官方材料；第二学位多为历史经历，不能推为现行规则。此次没有调用 DeepSeek，也未宣称穷尽所有条件。

v0.1 的来源仅为宽泛关联，缺少逐条引文。现存 legacyDiscoveryRefs 保留追溯，但不作为已验证证据。每个本轮来源的 supports 仅对应引文直接出现的条件，不扩散到同组全部条目。频率和来源数不能代表重要性或因果。

## 全部原子条件

| ID                             | 条件               | 范围           | 路径 / 专项                | 提问草案                                             | 发现依据               |
| ------------------------------ | ------------------ | -------------- | -------------------------- | ---------------------------------------------------- | ---------------------- |
| weekly_hours                   | 每周总投入         | 转专业、转行业 | any / any                  | 一周通常能投入多少小时？                             | 常识或旧版候选，待证据 |
| continuous_session             | 单次连续投入       | 转专业、转行业 | any / any                  | 一次通常能连续投入多长时间？                         | 常识或旧版候选，待证据 |
| schedule_variability           | 时间稳定性         | 转专业、转行业 | any / any                  | 每周可用时间会有多大变化？                           | 常识或旧版候选，待证据 |
| preparation_months             | 可持续准备周期     | 转专业、转行业 | any / any                  | 这样的投入能持续多少个月？                           | 常识或旧版候选，待证据 |
| start_date                     | 可开始时间         | 转专业、转行业 | any / any                  | 最早什么时候可以开始准备？                           | 常识或旧版候选，待证据 |
| milestone_target               | 当前目标阶段       | 转专业、转行业 | any / any                  | 本轮希望先完成哪个具体阶段？                         | 常识或旧版候选，待证据 |
| deadline_flexibility           | 截止时间弹性       | 转专业、转行业 | any / any                  | 这个截止时间可以调整吗？                             | 常识或旧版候选，待证据 |
| trial_completed                | 低成本体验         | 转专业、转行业 | any / any                  | 你已经做过哪些目标方向的小规模尝试？                 | 常识或旧版候选，待证据 |
| trial_feedback                 | 体验后的反馈       | 转专业、转行业 | any / any                  | 最近一次尝试让你发现了什么困难或收获？               | 常识或旧版候选，待证据 |
| learning_equipment             | 学习设备           | 转专业、转行业 | any / any                  | 目前能使用哪些学习或实践设备？                       | 常识或旧版候选，待证据 |
| study_space                    | 可用学习场所       | 转专业、转行业 | any / any                  | 是否有可稳定使用的学习场所？                         | 常识或旧版候选，待证据 |
| feedback_frequency             | 反馈频率           | 转专业、转行业 | any / any                  | 通常多久能获得一次具体反馈？                         | 常识或旧版候选，待证据 |
| feedback_relevance             | 反馈者相关经验     | 转专业、转行业 | any / any                  | 给你反馈的人有什么与目标方向相关的经验？             | 常识或旧版候选，待证据 |
| practice_recency               | 最近实践时间       | 转专业、转行业 | any / any                  | 你最近一次进行相关实践是什么时候？                   | 常识或旧版候选，待证据 |
| independent_task               | 独立完成能力       | 转专业、转行业 | any / any                  | 你能独立完成的相关任务有哪些？                       | 常识或旧版候选，待证据 |
| prerequisite_courses           | 已修先修课程       | 转专业、转行业 | any / any                  | 你已学过哪些目标方向的先修课程？                     | 常识或旧版候选，待证据 |
| language_reading               | 专业资料阅读       | 转专业、转行业 | any / any                  | 你阅读目标方向外语资料的实际情况怎样？               | 常识或旧版候选，待证据 |
| care_time_constraint           | 照护时间约束       | 转专业、转行业 | any / any                  | 是否有需要预留的固定照护时间？                       | 常识或旧版候选，待证据 |
| learning_budget                | 学习预算           | 转专业、转行业 | any / any                  | 你愿意为这次准备投入多少学习费用？                   | 常识或旧版候选，待证据 |
| pause_trigger                  | 暂停条件           | 转专业、转行业 | any / any                  | 出现什么情况时你会暂停或调整这条路径？               | 常识或旧版候选，待证据 |
| academic_route                 | 转换路径           | 转专业         | any / any                  | 你考虑校内转专业、跨专业读研、辅修还是第二学士学位？ | 常识或旧版候选，待证据 |
| institution_name               | 所在学校           | 转专业         | any / any                  | 你目前就读哪所学校？                                 | 常识或旧版候选，待证据 |
| current_major                  | 当前专业           | 转专业         | any / any                  | 你目前的专业是什么？                                 | 常识或旧版候选，待证据 |
| target_major                   | 目标专业           | 转专业         | any / any                  | 你想转入哪个具体专业？                               | 常识或旧版候选，待证据 |
| enrollment_year                | 入学届别           | 转专业         | campus_transfer / any      | 你是哪一年入学的？                                   | 常识或旧版候选，待证据 |
| current_term                   | 当前学期           | 转专业         | campus_transfer / any      | 你目前读到第几学期？                                 | 常识或旧版候选，待证据 |
| policy_year                    | 政策适用年份       | 转专业         | campus_transfer / any      | 你查到的通知适用于哪一年或哪一届？                   | 常识或旧版候选，待证据 |
| policy_link                    | 官方通知来源       | 转专业         | campus_transfer / any      | 能提供学校或学院的官方通知链接吗？                   | 常识或旧版候选，待证据 |
| application_deadline           | 申请截止日期       | 转专业         | campus_transfer / any      | 本轮申请的截止日期是什么？                           | 常识或旧版候选，待证据 |
| attempts_remaining             | 剩余申请次数       | 转专业         | campus_transfer / any      | 按本校规定，你还可申请几次？                         | 常识或旧版候选，待证据 |
| gpa_value                      | 当前绩点           | 转专业         | campus_transfer / any      | 你的当前绩点是多少？                                 | 常识或旧版候选，待证据 |
| gpa_scale                      | 绩点量表           | 转专业         | campus_transfer / any      | 该绩点采用什么满分标准？                             | 常识或旧版候选，待证据 |
| rank_percentile                | 排名百分位         | 转专业         | campus_transfer / any      | 你的成绩排名位于哪个百分位？                         | 常识或旧版候选，待证据 |
| rank_population                | 排名比较群体       | 转专业         | campus_transfer / any      | 这个排名是在班级、专业还是其他群体中计算的？         | 常识或旧版候选，待证据 |
| grade_period                   | 计分学期范围       | 转专业         | campus_transfer / any      | 申请资格计入哪些学期的成绩？                         | 常识或旧版候选，待证据 |
| failed_course_count            | 未通过课程数量     | 转专业         | campus_transfer / any      | 你目前有几门尚未通过的课程？                         | 常识或旧版候选，待证据 |
| retake_recognition             | 补考重修认定       | 转专业         | campus_transfer / any      | 学校如何认定补考或重修后的申请资格？                 | 常识或旧版候选，待证据 |
| math_course_level              | 数学课程层级       | 转专业         | campus_transfer / any      | 你实际修过哪种数学课程？                             | 常识或旧版候选，待证据 |
| subject_score_record           | 指定单科成绩       | 转专业         | campus_transfer / any      | 通知指定的单科成绩，你目前分别是多少？               | 常识或旧版候选，待证据 |
| special_admission_track        | 特殊培养类别       | 转专业         | campus_transfer / any      | 你是否属于有单独培养约定的招生类别？                 | 常识或旧版候选，待证据 |
| outgoing_permission            | 转出资格           | 转专业         | campus_transfer / any      | 原学院是否有独立的转出条件？                         | 常识或旧版候选，待证据 |
| incoming_permission            | 转入资格           | 转专业         | campus_transfer / any      | 目标学院明确要求哪些转入资格？                       | 常识或旧版候选，待证据 |
| incoming_quota                 | 本轮接收名额       | 转专业         | campus_transfer / any      | 本轮目标专业公布了多少接收名额？                     | 常识或旧版候选，待证据 |
| assessment_subjects            | 考核科目           | 转专业         | campus_transfer / any      | 本轮具体考哪些科目？                                 | 常识或旧版候选，待证据 |
| assessment_weights             | 考核计分权重       | 转专业         | campus_transfer / any      | 各项考核在总成绩中占多少？                           | 常识或旧版候选，待证据 |
| application_materials          | 申请材料准备       | 转专业         | campus_transfer / any      | 规定的申请材料中还有哪些未准备好？                   | 常识或旧版候选，待证据 |
| interview_language             | 面试语言           | 转专业         | campus_transfer / any      | 目标项目要求使用什么语言面试？                       | E04                    |
| recognized_credits             | 可认定学分数量     | 转专业         | campus_transfer / any      | 已修学分中可认定多少？                               | 常识或旧版候选，待证据 |
| makeup_credits                 | 待补学分数量       | 转专业         | campus_transfer / any      | 转入后还需补修多少学分？                             | 常识或旧版候选，待证据 |
| course_conflicts               | 补修课程冲突       | 转专业         | campus_transfer / any      | 补修课与新专业课程有哪些时间冲突？                   | 常识或旧版候选，待证据 |
| course_offering_cycle          | 课程开设周期       | 转专业         | campus_transfer / any      | 必须补修的课程什么时候再次开设？                     | 常识或旧版候选，待证据 |
| prerequisite_sequence          | 先修课程顺序       | 转专业         | campus_transfer / any      | 哪些后续课程必须在补完先修课后才能选？               | 常识或旧版候选，待证据 |
| graduation_delay               | 预计毕业延后       | 转专业         | campus_transfer / any      | 按培养方案预计会延后多久毕业？                       | 常识或旧版候选，待证据 |
| extra_tuition                  | 额外学费           | 转专业         | campus_transfer / any      | 延长学制或补修预计增加多少学费？                     | 常识或旧版候选，待证据 |
| scholarship_eligibility        | 评奖资格变化       | 转专业         | campus_transfer / any      | 转入会影响哪些评奖评优资格？                         | E06                    |
| recommendation_eligibility     | 推免资格变化       | 转专业         | campus_transfer / any      | 转入后推免资格如何认定？                             | E06                    |
| campus_location                | 教学所在校区       | 转专业         | any / any                  | 转入后课程安排在哪个校区？                           | E08                    |
| graduate_admission_eligibility | 跨考报考资格       | 转专业         | cross_major_graduate / any | 目标研究生项目是否接收你的本科背景？                 | 常识或旧版候选，待证据 |
| graduate_exam_subjects         | 跨考考试科目       | 转专业         | cross_major_graduate / any | 目标研究生项目的考试科目是什么？                     | 常识或旧版候选，待证据 |
| graduate_extra_assessment      | 加试要求           | 转专业         | cross_major_graduate / any | 你的报考身份是否涉及加试？                           | 常识或旧版候选，待证据 |
| research_exposure              | 科研接触经历       | 转专业         | cross_major_graduate / any | 你做过哪些与目标研究方向相关的探索？                 | 常识或旧版候选，待证据 |
| second_degree_eligibility      | 二学位申请资格     | 转专业         | second_bachelor / any      | 目标二学位对毕业年份和已有学位有哪些要求？           | 常识或旧版候选，待证据 |
| second_degree_teaching_mode    | 二学位教学组织     | 转专业         | second_bachelor / any      | 该二学位是独立开班还是插班上课？                     | E08                    |
| parallel_exam_conflict         | 二学位与考研冲突   | 转专业         | second_bachelor / any      | 二学位课程考核与你的其他备考安排有哪些冲突？         | E07                    |
| withdrawal_settlement          | 退出时课程费用结算 | 转专业         | second_bachelor / any      | 若退出二学位，已选课程费用如何结算？                 | E09                    |
| minor_award_type               | 辅修证书类型       | 转专业         | minor / any                | 拟读辅修最终授予哪种证书或学位？                     | 常识或旧版候选，待证据 |
| minor_application_eligibility  | 辅修申请资格       | 转专业         | minor / any                | 该辅修的申请条件是什么？                             | 常识或旧版候选，待证据 |
| minor_course_schedule          | 辅修课程安排       | 转专业         | minor / any                | 辅修课程与主修课程如何安排时间？                     | 常识或旧版候选，待证据 |
| current_industry               | 当前行业           | 转行业         | any / any                  | 你目前所在行业是什么？                               | 常识或旧版候选，待证据 |
| current_job_function           | 当前岗位职能       | 转行业         | any / any                  | 你现在主要负责什么工作？                             | 常识或旧版候选，待证据 |
| relevant_tenure                | 相关经验年限       | 转行业         | any / any                  | 与目标工作直接相关的经验有多久？                     | 常识或旧版候选，待证据 |
| target_industry                | 目标行业           | 转行业         | any / any                  | 你希望进入哪个具体行业？                             | 常识或旧版候选，待证据 |
| target_job_function            | 目标岗位职能       | 转行业         | any / any                  | 你希望在目标行业承担什么职能？                       | 常识或旧版候选，待证据 |
| target_seniority               | 目标岗位级别       | 转行业         | any / any                  | 你希望从什么级别的岗位开始？                         | 常识或旧版候选，待证据 |
| employment_type                | 用工形式偏好       | 转行业         | any / any                  | 你可接受哪些用工形式？                               | 常识或旧版候选，待证据 |
| domain_knowledge               | 可迁移行业知识     | 转行业         | any / any                  | 你掌握哪些目标岗位可使用的业务知识？                 | 常识或旧版候选，待证据 |
| transferable_tools             | 可迁移工具能力     | 转行业         | any / any                  | 有哪些工具你已在真实工作中使用过？                   | 常识或旧版候选，待证据 |
| demonstrated_results           | 可说明的工作成果   | 转行业         | any / any                  | 哪些过去的成果能证明你的相关能力？                   | 常识或旧版候选，待证据 |
| resume_evidence                | 简历中的能力证据   | 转行业         | any / any                  | 简历中用什么具体事例说明相关能力？                   | 常识或旧版候选，待证据 |
| application_count              | 有效投递数量       | 转行业         | any / any                  | 最近一轮向相关岗位投递了多少份申请？                 | 常识或旧版候选，待证据 |
| interview_count                | 面试邀约数量       | 转行业         | any / any                  | 这些投递获得了多少次面试邀约？                       | 常识或旧版候选，待证据 |
| rejection_feedback             | 拒绝反馈           | 转行业         | any / any                  | 对方明确反馈了哪些未满足的条件？                     | 常识或旧版候选，待证据 |
| offer_stage                    | 当前求职阶段       | 转行业         | any / any                  | 目前进展到面试、书面录用、入职还是试用期？           | 常识或旧版候选，待证据 |
| portfolio_contribution         | 作品个人贡献       | 转行业         | any / any                  | 作品中哪些部分由你独立完成？                         | E03                    |
| portfolio_problem              | 作品解决的问题     | 转行业         | any / any                  | 你的作品针对什么具体问题？                           | E03                    |
| portfolio_feedback             | 作品外部反馈       | 转行业         | any / any                  | 作品获得过什么实际使用或评审反馈？                   | 常识或旧版候选，待证据 |
| portfolio_disclosure           | 作品展示授权       | 转行业         | any / any                  | 哪些作品可获得授权用于求职展示？                     | 常识或旧版候选，待证据 |
| income_gap_months              | 可承受收入空窗     | 转行业         | any / any                  | 你可承受多少个月的收入空窗？                         | 常识或旧版候选，待证据 |
| monthly_essential_cost         | 必要月支出         | 转行业         | any / any                  | 你愿意提供的大致必要月支出范围是多少？               | 常识或旧版候选，待证据 |
| training_cost_ceiling          | 培训费用上限       | 转行业         | any / any                  | 你可接受的培训费用上限是多少？                       | 常识或旧版候选，待证据 |
| salary_floor_amount            | 固定薪资下限       | 转行业         | any / any                  | 你可接受的固定月薪范围是多少？                       | 常识或旧版候选，待证据 |
| variable_pay_acceptance        | 浮动收入接受度     | 转行业         | any / any                  | 你能接受多大比例的收入随业绩变化？                   | 常识或旧版候选，待证据 |
| relocation_acceptance          | 搬迁接受度         | 转行业         | any / any                  | 你是否愿意为合适岗位搬迁？                           | 常识或旧版候选，待证据 |
| commute_ceiling                | 通勤时间上限       | 转行业         | any / any                  | 你可接受的单程通勤时间是多少？                       | 常识或旧版候选，待证据 |
| travel_acceptance              | 出差接受度         | 转行业         | any / any                  | 你可接受多频繁、每次多久的出差？                     | E01                    |
| shift_acceptance               | 轮班接受度         | 转行业         | any / any                  | 你可接受哪些轮班安排？                               | 常识或旧版候选，待证据 |
| onsite_acceptance              | 长期驻场接受度     | 转行业         | any / any                  | 你是否能接受长期驻场工作？                           | 常识或旧版候选，待证据 |
| work_schedule_constraint       | 工作时段限制       | 转行业         | any / any                  | 哪些工作时段与你的固定安排冲突？                     | 常识或旧版候选，待证据 |
| notice_period                  | 可到岗周期         | 转行业         | any / any                  | 从现在到可正式到岗需要多久？                         | 常识或旧版候选，待证据 |
| internal_transfer_access       | 内部转岗渠道       | 转行业         | any / any                  | 当前单位是否有可申请的相关转岗机会？                 | 常识或旧版候选，待证据 |
| bridge_role_option             | 过渡岗位选项       | 转行业         | any / any                  | 你已找到哪些能复用现有经验的过渡岗位？               | 常识或旧版候选，待证据 |
| job_requirement_date           | 招聘信息时间       | 转行业         | any / any                  | 你参考的岗位要求是什么时候发布的？                   | 常识或旧版候选，待证据 |
| job_education_requirement      | 招聘学历要求       | 转行业         | any / any                  | 目标招聘信息明确要求什么学历？                       | 常识或旧版候选，待证据 |
| job_license_requirement        | 岗位证照要求       | 转行业         | any / any                  | 目标岗位明确要求哪些证照？                           | 常识或旧版候选，待证据 |
| certificate_held               | 已持相关证照       | 转行业         | any / any                  | 你已经取得哪些相关证照？                             | 常识或旧版候选，待证据 |
| equipment_maintenance          | 现场检修实践       | 转行业         | any / industrial           | 你实际做过哪些设备检修维护任务？                     | E02                    |
| engineering_drawings           | 工程图纸能力       | 转行业         | any / industrial           | 你能独立阅读或绘制哪些工程图纸？                     | 常识或旧版候选，待证据 |
| commissioning_access           | 调试实践机会       | 转行业         | any / industrial           | 你是否能获得有人指导的现场调试机会？                 | 常识或旧版候选，待证据 |
| safety_training                | 安全培训准备       | 转行业         | any / industrial           | 目标现场要求的安全培训，你已完成哪些？               | 常识或旧版候选，待证据 |
| industrial_software            | 工业软件实操       | 转行业         | any / industrial           | 你实际使用过哪些工业软件完成任务？                   | 常识或旧版候选，待证据 |
| design_specialism              | 设计细分方向       | 转行业         | any / design               | 你希望从事哪种设计工作？                             | 常识或旧版候选，待证据 |
| design_process                 | 设计过程说明       | 转行业         | any / design               | 你能用什么项目说明从需求到方案的过程？               | 常识或旧版候选，待证据 |
| design_critique                | 设计修改反馈       | 转行业         | any / design               | 你是否根据具体评审意见修改过作品？                   | 常识或旧版候选，待证据 |
| design_delivery                | 设计交付实践       | 转行业         | any / design               | 你完成过哪些面向真实使用场景的设计交付？             | 常识或旧版候选，待证据 |
| accounting_vouchers            | 凭证处理实践       | 转行业         | any / accounting           | 你是否独立练习过凭证审核和填制？                     | E05                    |
| accounting_statements          | 报表编制实践       | 转行业         | any / accounting           | 你是否能说明自己编制过的报表？                       | E05                    |
| accounting_software            | 财务软件实践       | 转行业         | any / accounting           | 你使用财务软件完成过哪些实际任务？                   | 常识或旧版候选，待证据 |
| accounting_role                | 财务岗位方向       | 转行业         | any / accounting           | 你希望从出纳、核算还是其他财务岗位开始？             | 常识或旧版候选，待证据 |
| sales_customer_type            | 客户类型           | 转行业         | any / sales                | 目标销售岗位面向企业客户还是个人客户？               | 常识或旧版候选，待证据 |
| sales_lead_source              | 客户线索来源       | 转行业         | any / sales                | 该岗位的客户线索主要由谁提供？                       | 常识或旧版候选，待证据 |
| sales_cycle                    | 销售周期           | 转行业         | any / sales                | 目标业务从接触客户到成交通常需要多久？               | 常识或旧版候选，待证据 |
| sales_target_terms             | 考核口径           | 转行业         | any / sales                | 目标岗位如何计算销售考核指标？                       | E11                    |
| sales_payment_terms            | 提成结算           | 转行业         | any / sales                | 目标岗位的提成按什么节点结算？                       | E10                    |
| teaching_subject               | 教学学科           | 转行业         | any / education            | 你计划教授什么学科？                                 | 常识或旧版候选，待证据 |
| teaching_audience              | 教学对象           | 转行业         | any / education            | 你希望面向哪个年龄或学习阶段授课？                   | 常识或旧版候选，待证据 |
| teaching_demo                  | 试讲实践           | 转行业         | any / education            | 你是否完成过面向目标学生的试讲？                     | E12                    |
| teaching_sales_duty            | 招生职责           | 转行业         | any / education            | 目标教学岗位是否同时要求承担招生任务？               | 常识或旧版候选，待证据 |
| coding_debugging               | 独立调试实践       | 转行业         | any / software             | 你独立排查过什么程序问题？                           | 常识或旧版候选，待证据 |
| software_collaboration         | 协作开发经验       | 转行业         | any / software             | 你参与过怎样的多人开发协作？                         | 常识或旧版候选，待证据 |
| software_deployment            | 部署运维实践       | 转行业         | any / software             | 你部署维护过什么可运行项目？                         | 常识或旧版候选，待证据 |
| operations_channel             | 运营渠道           | 转行业         | any / operations           | 你希望负责哪种渠道或平台的运营？                     | 常识或旧版候选，待证据 |
| operations_metrics             | 运营指标实践       | 转行业         | any / operations           | 你实际跟踪并改善过哪些运营指标？                     | 常识或旧版候选，待证据 |
| operations_budget              | 投放预算实践       | 转行业         | any / operations           | 你是否有管理实际投放预算的经历？                     | 常识或旧版候选，待证据 |
| daily_time                     | 稳定投入时间       | 转行业、转专业 | any / any                  | 你每天可以明确投入多少小时？                         | 常识或旧版候选，待证据 |

## 本轮引文账本

### E10 放弃四个副业后，我回到了销售的逻辑里找饭吃

[知乎来源](https://zhuanlan.zhihu.com/p/2042258981607969845)；个人经历；获取于 2026-09-07，仅搜索片段。

> 提成按回款额的3%-5%算

对应条件：sales_payment_terms。仅为该作者的薪酬约定，不推定行业通用提成。

### E11 15年技术老兵转岗电话销售

[知乎来源](https://zhuanlan.zhihu.com/p/2073052577634186620)；个人记录；获取于 2026-09-07，仅搜索片段。

> 每天的必须完成的电话任务，就有了KPI的要求

对应条件：sales_target_terms。为作者到岗初期的工作要求，不证明长期适配或转型成功。

### E12 火花思维面试及日常等入职感受

[知乎来源](https://zhuanlan.zhihu.com/p/349777077)；个人经验；获取于 2026-09-07，仅搜索片段。

> 我当时面试的题目选的必胜策略，用ipad面试

对应条件：teaching_demo。历史机构招聘经历；资格考试、学校教师招聘与机构试讲不能等同。

### E01 记录plc电气工程师的真实工作经历

[知乎来源](https://zhuanlan.zhihu.com/p/503564382)；个人记录；获取于 2026-09-07，仅搜索片段。

> 但是耐不住长期的出差，最近也有转行的打算

对应条件：travel_acceptance。个人工作条件，不代表所有自动化岗位。

### E02 做PLC天天出差，怎么还那么多人入行？

[知乎来源](https://www.zhihu.com/question/2017645513680369241/answer/2074670227615396064)；个人经验与观点混合；获取于 2026-09-07，仅搜索片段。

> 会搞什么仪表的检修维护？什么步骤？

对应条件：equipment_maintenance。未采用文中的收入泛化结论。

### E03 我用一本作品集，同时拿下宝马设计岗和圣马丁、格艺等8张offer！

[知乎来源](https://zhuanlan.zhihu.com/p/2076701335131517949)；机构相关案例；获取于 2026-09-07，仅搜索片段。

> 为什么要做、想解决什么问题、自己在里面做了什么？

对应条件：portfolio_problem、portfolio_contribution。有机构推广语境，仅提取作品说明维度，未验证录取或就业结果。

### E04 7天，我做完了转专业的同济保研作品集

[知乎来源](https://zhuanlan.zhihu.com/p/543579579)；机构相关案例；获取于 2026-09-07，仅搜索片段。

> 我们专业是全英文面试

对应条件：interview_language。旧年份、具体项目；不代表当前招生安排。

### E05 小白想转行会计？别急着考证，先搞清楚这3件事

[知乎来源](https://zhuanlan.zhihu.com/p/2069457352118497906)；明确培训推广；获取于 2026-09-07，仅搜索片段。

> 从原始凭证审核、记账凭证填制，到账簿登记、报表编制

对应条件：accounting_vouchers、accounting_statements。仅用作实操任务发现，未验证培训效果或岗位门槛。

### E06 详解大学转专业

[知乎来源](https://zhuanlan.zhihu.com/p/2073109672849044203)；咨询观点与转述；获取于 2026-09-07，仅搜索片段。

> 可能还有评奖评优限制、推免影响

对应条件：scholarship_eligibility、recommendation_eligibility。必须另查具体学校当年规定。

### E07 第二学士学位一学期经验分享（劝退版）

[知乎来源](https://zhuanlan.zhihu.com/p/451469494)；个人经历；获取于 2026-09-07，仅搜索片段。

> 我校期末考试时间与考研备考时间重合

对应条件：parallel_exam_conflict。单个学校旧经历，不能推定所有二学位都影响考研。

### E08 在西安电子科技大学就读第二学士学位是怎样的体验？

[知乎来源](https://www.zhihu.com/question/488112770/answer/2132058754)；代朋友转述；获取于 2026-09-07，仅搜索片段。

> 去年学长学姐们在南校区，很多课程是插班上课，今年计算机学院二学位都是在北校区独立开班的

对应条件：second_degree_teaching_mode、campus_location。教学组织随届别变化；不能当成现行承诺。

### E09 读第二学士学位有什么感受？

[知乎来源](https://www.zhihu.com/question/398680352/answer/2512678745)；个人经历；获取于 2026-09-07，仅搜索片段。

> 财务处会根据你的成绩单和课表确定你的选课学分

对应条件：withdrawal_settlement。具体校内结算经历，不是通用退费规定。

## 后续补齐顺序

1. 继续覆盖销售客户线索、教师岗位类型和不同学科的第一人称转型经历，补齐目前只有常识候选的条目。
2. 围绕具体学校与目标行业，补课程开设周期、招聘条件、证照等官方证据。
3. 每个准备启用的条件建立“已知、未知、拒答、阶段冲突、量表冲突”样例，再检验 AI 映射与提问。
4. 对没有合适词条的材料保留开放候选入口，记录原文、路径和建议命名，定期合并同义项。
