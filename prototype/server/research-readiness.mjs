const requiredConditions = {
  campus_transfer: ['institution_name', 'current_major', 'target_major'],
  cross_major_graduate: ['current_major', 'target_major'],
  minor: ['institution_name', 'current_major', 'target_major'],
  second_bachelor: ['institution_name', 'current_major', 'target_major'],
  career_change: ['current_job_function', 'target_job_function'],
};

export function requiredConditionIds(path) {
  return [...(requiredConditions[path] || [])];
}

export function researchReadiness(profile) {
  const required = requiredConditionIds(profile.decisionPath);
  const missingRequired = required.filter((id) => !profile.conditionAnswers?.[id]?.trim() ||
    /^(?:未知|尚未核实|不清楚|不知道|待确认)$/.test(profile.conditionAnswers[id].trim()));
  return {
    researchMode: !required.length || missingRequired.length ? 'general' : 'personalized',
    missingRequired,
  };
}
