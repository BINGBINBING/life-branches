export function classifyContent(quote) {
  const text = String(quote || '');
  if (/建议|应该|不妨|可以考虑|你可以|你需要/.test(text))
    return { kind: 'advice', status: 'textual-signal', reason: '引文有面向读者的建议语气，不能作为亲历行为或结果。' };
  if (/我(?:的)?(?:朋友|同学|同事|学生)|听说|据说|他曾|她曾/.test(text))
    return { kind: 'retold', status: 'textual-signal', reason: '引文有明确第三方或转述线索，未核实当事人和事件。' };
  if (/我(?:们)?|本人/.test(text))
    return { kind: 'self', status: 'textual-signal', reason: '引文有第一人称行为线索，仅为作者自述，不代表真实性已核实。' };
  return { kind: 'unknown', status: 'unverified', reason: '行动引文未明确主体；不根据认证或模型标签推断身份。' };
}
