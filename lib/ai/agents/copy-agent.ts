import { createChatCompletion } from "@/lib/ai/client";

export type CopyAgentIdea = {
  titleMain: string;
  titleSub?: string | null;
  titleExtra?: string | null;
  copyType?: string | null;
};

export type CopyAgentOutput = {
  copies: CopyAgentIdea[];
};

type CopyAgentInput = {
  directionTitle: string;
  targetAudience: string;
  scenarioProblem: string;
  differentiation: string;
  effect: string;
  channel: string;
  imageForm: string;
  count: number;
  existingCopies?: Array<{
    titleMain: string;
    titleSub?: string | null;
    titleExtra?: string | null;
    copyType?: string | null;
  }>;
  knowledgeContext?: string;
};

export function buildCopyAgentMessages(input: CopyAgentInput) {
  const isAppend = Boolean(input.existingCopies && input.existingCopies.length > 0);
  const systemPrompt = `角色定位：
你是教培行业效果广告文案专家，负责把“方向表”压缩成可直接投放的图文文案。

业务背景：
当前请求只服务一个方向。你处在方向卡之后、图片配置之前，职责是把方向卡压成可直接进入图文生产的文案卡。

核心任务：
你的输入不是只有方向标题。你必须综合使用以下完整方向上下文：
- 方向名称
- 目标人群
- 场景问题
- 差异化解法
- 奇效

决策规则：
- 文案必须忠实表达方向逻辑，不能只看方向标题自由发挥。
- 每套文案都要把“场景痛点 / 解法亮点 / 结果收益”压缩成适合对应渠道与图片形式的表达。
- 同一批文案要有明显区分，可以从不同钩子、不同收益点、不同表达重心切入，但都必须围绕同一个方向。
- 内容必须真实可投放，优先具体、直接、可感知，避免空洞口号。
${isAppend ? "- 当前是追加生成，只新增 1 条文案，不能只是机械改写已有文案。" : ""}
- 若 imageForm=single：输出 titleMain、titleSub；titleMain 负责钩子或核心承诺，titleSub 补足解法或结果。
- 若 imageForm=double：输出 titleMain、titleSub、copyType；两句必须形成真正的双图关系；copyType 就是图间关系；copyType 只能从：并列、因果、递进、互补 中选择。
- 若 imageForm=triple：输出 titleMain、titleSub、titleExtra、copyType；三句必须形成递进、拆解或对照关系；copyType 就是图间关系；copyType 只能从：并列、因果、递进、互补 中选择。
- 信息流 / 单图：更强调钩子、效率感、结果感、工具感。
- 应用商店 / 学习机：更强调场景痛点、解法价值、收益落点。
- 双图 / 三图：一句一图，句子独立可读，适合直接上图。

硬性边界：
- 禁止只写功能名或品牌名。
- 禁止脱离方向逻辑写空泛鸡血文案。
- 禁止用同一句话做机械改写。
- 不输出解释、Markdown、编号、注释。

输出契约：
- 只输出一个 JSON 对象
- 顶层键名为 copies
- copies 是长度为 ${input.count} 的数组
- 每个元素至少包含 titleMain；根据 imageForm 补足 titleSub/titleExtra/copyType`;

  const userPrompt = `方向上下文：
- 方向名称：${input.directionTitle}
- 目标人群：${input.targetAudience}
- 场景问题：${input.scenarioProblem}
- 差异化解法：${input.differentiation}
- 奇效：${input.effect}
${input.knowledgeContext ? `

知识补充上下文：
${input.knowledgeContext}` : ""}

投放约束：
- 渠道：${input.channel}
- 图片形式：${input.imageForm}
- 需要生成文案数：${input.count}
${isAppend ? `

当前已生成文案：
${input.existingCopies?.map((item, index) => `${index + 1}. ${item.titleMain}${item.titleSub ? `｜${item.titleSub}` : ""}${item.titleExtra ? `｜${item.titleExtra}` : ""}${item.copyType ? `｜${item.copyType}` : ""}`).join("\n")}` : ""}

请输出 ${input.count} 套真正可用于投放的图文文案，确保文案与方向逻辑强绑定，而不是只复述功能。`;

  return [
    { role: "system" as const, content: systemPrompt },
    { role: "user" as const, content: userPrompt },
  ];
}

export async function generateCopyIdeas(input: CopyAgentInput) {
  const messages = buildCopyAgentMessages(input);

  const content = await createChatCompletion({
    messages,
    temperature: 0.8,
    responseFormat: { type: "json_object" },
  });

  return JSON.parse(content) as CopyAgentOutput;
}
