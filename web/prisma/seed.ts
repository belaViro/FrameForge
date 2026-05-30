import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const episodes = [
  // 第一季：AI 是怎么"想"的（1-15 集）
  { number: 1, title: 'AI 不是在思考，是在预测下一个字', hook: 'ChatGPT 其实是一个超级填空机器', analogy: '填空题考试', season: 1 },
  { number: 2, title: 'Token：AI 眼中的世界碎片', hook: '它不认字，只认数字编号', analogy: '把文章切成拼图碎片', season: 1 },
  { number: 3, title: '大模型大在哪', hook: '参数越多，涌现越多', analogy: '大脑神经元数量', season: 1 },
  { number: 4, title: '训练一个 AI 要多少钱', hook: '烧掉一栋别墅的电费', analogy: '电费账单', season: 1 },
  { number: 5, title: 'Prompt 的本质是什么', hook: '你在写咒语，不是在聊天', analogy: '魔法咒语 vs 日常对话', season: 1 },
  { number: 6, title: '温度：控制 AI 的疯癫程度', hook: '0.0 是考试，1.0 是喝醉', analogy: '温度计动画', season: 1 },
  { number: 7, title: '上下文窗口：AI 的短期记忆', hook: '超过这个长度它就失忆了', analogy: '书桌大小', season: 1 },
  { number: 8, title: 'AI 为什么会胡说八道', hook: '幻觉不是 bug，是原理决定的', analogy: '一本正经的胡说', season: 1 },
  { number: 9, title: 'Embedding：万物皆可向量', hook: '国王-男人+女人=女王', analogy: '坐标系上的词语', season: 1 },
  { number: 10, title: '注意力机制：AI 的眼睛看哪里', hook: '一句话里不是每个字都重要', analogy: '聚光灯扫描', season: 1 },
  { number: 11, title: 'Transformer 到底 transform 了什么', hook: '2017 年改变世界的一篇论文', analogy: '流水线工厂', season: 1 },
  { number: 12, title: '预训练 vs 微调 vs 对齐', hook: '通识教育、专业课、社会规训', analogy: '学校三阶段', season: 1 },
  { number: 13, title: 'RLHF：人类怎么教 AI 说人话', hook: '打分员比训练师更重要', analogy: '选秀评委打分', season: 1 },
  { number: 14, title: '多模态：AI 学会了看图听声', hook: '不只是文字，图片视频音频全能处理', analogy: '五感打通', season: 1 },
  { number: 15, title: '推理 vs 生成：两种不同的聪明', hook: '会写作文不代表会做数学题', analogy: '文科生 vs 理科生', season: 1 },
  // 第二季：智能体的诞生（16-35 集）
  { number: 16, title: '什么是 AI Agent', hook: '从回答问题到自己干活', analogy: '从客服到员工', season: 2 },
  { number: 17, title: 'Agent vs Chatbot：本质区别', hook: '一个等指令，一个自己想', analogy: '遥控车 vs 自动驾驶', season: 2 },
  { number: 18, title: 'ReAct：先想再做', hook: '思考-行动-观察，循环往复', analogy: '侦探破案', season: 2 },
  { number: 19, title: '工具调用：AI 终于会用计算器了', hook: '光靠脑子不够，还得动手', analogy: '瑞士军刀', season: 2 },
  { number: 20, title: 'Function Calling 怎么工作的', hook: 'AI 输出的不是文字，是函数调用', analogy: '点菜单 vs 自己做', season: 2 },
  { number: 21, title: '记忆系统：短期 vs 长期', hook: '对话记忆、笔记本、知识库', analogy: '便签纸 vs 档案柜', season: 2 },
  { number: 22, title: 'RAG：让 AI 开卷考试', hook: '先查资料再回答，不瞎编', analogy: '开卷 vs 闭卷', season: 2 },
  { number: 23, title: '规划能力：大任务怎么拆', hook: '把做个网站拆成 20 个小步骤', analogy: '项目经理拆任务', season: 2 },
  { number: 24, title: '自我反思：AI 检查自己的作业', hook: '做完回头看，发现错了重来', analogy: '考试检查', season: 2 },
  { number: 25, title: '代码执行：写完就跑', hook: '不只是生成代码，还能验证对不对', analogy: '边写边调试', season: 2 },
  { number: 26, title: '多 Agent 协作', hook: '一群 AI 开会比一个强', analogy: '公司各部门协作', season: 2 },
  { number: 27, title: 'Agent 的安全护栏', hook: '怎么防止 AI 删你的文件', analogy: '儿童安全锁', season: 2 },
  { number: 28, title: 'MCP 协议：AI 的万能插头', hook: '一个标准连接所有工具', analogy: 'USB-C 统一接口', season: 2 },
  { number: 29, title: 'Workflow vs Agent', hook: '流水线和自由人的区别', analogy: '工厂 vs 自由职业', season: 2 },
  { number: 30, title: 'Agent 的失败模式', hook: '它会卡死、绕圈、做无用功', analogy: '死胡同和死循环', season: 2 },
  { number: 31, title: '人机协作的正确姿势', hook: '你做决策，它做执行', analogy: '导演和演员', season: 2 },
  { number: 32, title: 'Agent 的评估怎么做', hook: '不能只看结果，还要看过程', analogy: '考试 vs 面试', season: 2 },
  { number: 33, title: '沙箱：给 AI 一个安全的游乐场', hook: '让它随便折腾，不影响真实环境', analogy: '游乐场围栏', season: 2 },
  { number: 34, title: 'Agent 的成本控制', hook: '一个任务烧掉 100 块 token 费', analogy: '出租车计价器', season: 2 },
  { number: 35, title: '2026 年 Agent 能做到什么程度', hook: '现状、边界、和吹过的牛', analogy: '能力边界图', season: 2 },
  // PLACEHOLDER_SEASON_3_4_5
];

// 第三季到第五季的数据继续追加
const season3to5 = [
  { number: 36, title: 'Vibe Coding：用氛围感写代码', hook: '说一句话，代码自己出来', analogy: '口述 vs 手写', season: 3 },
  { number: 37, title: 'AI 写代码的真实水平', hook: '能写 80%，剩下 20% 要你兜底', analogy: '实习生水平', season: 3 },
  { number: 38, title: 'Cursor/Claude Code 怎么工作的', hook: 'IDE 里住了一个程序员', analogy: '结对编程', season: 3 },
  { number: 39, title: 'AI 做数据分析', hook: '丢一个 Excel，出一份报告', analogy: '数据分析师', season: 3 },
  { number: 40, title: 'AI 客服：7x24 不下班', hook: '但它会把客户气跑', analogy: '永不疲倦的接线员', season: 3 },
];

async function main() {
  console.log("Seeding database...");

  const allEpisodes = [...episodes, ...season3to5];

  for (const ep of allEpisodes) {
    await prisma.episode.upsert({
      where: { number: ep.number },
      update: ep,
      create: { ...ep, status: "draft" },
    });
  }

  // 为已有的第 16 集（什么是 AI Agent）导入场景数据
  const ep16 = await prisma.episode.findUnique({ where: { number: 16 } });
  if (ep16) {
    await prisma.episode.update({
      where: { id: ep16.id },
      data: {
        status: "produced",
        imageDir: "AI智能体5分钟图片",
        outputName: "AI智能体科普_什么是AI智能体_5分钟.mp4",
      },
    });

    // 导入场景
    const scenes = [
      { order: 1, image: "01_封面_什么是AI智能体.png", subtitle: "AI 智能体：从会聊天到会干活", narration: "你以为 AI 智能体，就是一个更聪明的 ChatGPT？其实不是。" },
      { order: 2, image: "02_Chatbot_vs_Agent对比.png", subtitle: "区别：回答问题 vs 完成目标", narration: "先看一个最简单的区别。" },
      { order: 3, image: "03_Agent四个核心部件.png", subtitle: "四个部件：大脑、工具、记忆、循环", narration: "一个 AI Agent 通常有四个核心部件。" },
      { order: 4, image: "04_思考行动观察循环.png", subtitle: "核心机制：思考、行动、观察", narration: "很多 Agent 框架最核心的模式。" },
      { order: 5, image: "05_真实任务流程图.png", subtitle: "真实任务：从目标到报告", narration: "我们用一个具体例子。" },
      { order: 6, image: "06_工具调用工具箱.png", subtitle: "工具调用：AI 从想变成做", narration: "这整个过程，和普通 ChatGPT 最大的不同。" },
      { order: 7, image: "07_Agent为什么突然火了.png", subtitle: "为什么火：三个条件凑齐了", narration: "那为什么这两年 Agent 突然火了？" },
      { order: 8, image: "08_Agent能帮你做什么.png", subtitle: "落地场景：重复工作先交给它", narration: "Agent 正好卡在这个位置。" },
      { order: 9, image: "09_Agent边界和风险.png", subtitle: "别神化：它会犯错，也有成本", narration: "但是，Agent 也没有很多宣传里说得那么神。" },
      { order: 10, image: "10_一句话总结.png", subtitle: "一句话：Agent 是会推进任务的 AI", narration: "一句话总结。" },
    ];

    for (const scene of scenes) {
      await prisma.scene.upsert({
        where: { episodeId_order: { episodeId: ep16.id, order: scene.order } },
        update: scene,
        create: { ...scene, episodeId: ep16.id },
      });
    }

    // TTS 配置
    await prisma.ttsConfig.upsert({
      where: { episodeId: ep16.id },
      update: {},
      create: { episodeId: ep16.id, voice: "zh-CN-YunxiNeural", rate: "-8%", pitch: "-3Hz", volume: "+0%" },
    });

    // 视频配置
    await prisma.videoConfig.upsert({
      where: { episodeId: ep16.id },
      update: {},
      create: { episodeId: ep16.id, width: 1920, height: 1080, fps: 30 },
    });
  }

  console.log(`Seeded ${allEpisodes.length} episodes.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
