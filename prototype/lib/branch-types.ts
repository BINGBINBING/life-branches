export type Profile = {
  question: string;
  background: string;
  time: string;
  goal: string;
  conditionAnswers: Record<string, string>;
  decisionScope: string;
  decisionPath: string;
  decisionSector: string;
  answers: Record<string, string>;
  skipped: string[];
};
export type IntakeField = {
  id: string;
  label: string;
  question: string;
  answerType:
    | 'text'
    | 'boolean'
    | 'single_choice'
    | 'multi_select'
    | 'date'
    | 'integer'
    | 'number'
    | 'duration'
    | 'amount'
    | 'range'
    | 'url';
  options?: { value: string; label: string }[];
  group: string;
  initialValue?: string;
  initialQuote?: string;
};
export type IntakePlan = {
  supported: boolean;
  scope: string;
  path: string;
  sector: string;
  fields: IntakeField[];
  message: string;
  generatedBy?: string;
};
export type Source = {
  id: string;
  title: string;
  url: string;
  author: string;
  badge: string;
  editTime: number | null;
  snippets: string[];
  queries: string[];
};
export type OfficialSource = {
  id: string;
  kind: 'official';
  title: string;
  url: string;
  host: string;
  retrievedAt: string;
  years: string[];
  documentTypes?: string[];
  excerpt: string;
};
export type OfficialCheck = {
  id: string;
  label: string;
  group: 'eligibility' | 'cost';
  status: 'satisfied' | 'not_satisfied' | 'conflict' | 'confirmed' | 'unknown';
  officialValue: string;
  userValue: string;
  quote: string;
  sourceId: string;
};
export type Fact = { text: string; quote: string };
export type ConditionComparison = {
  conditionId: string;
  label: string;
  status: 'similar' | 'different' | 'unknown';
  userValue: string;
  userQuote: string;
  caseValue: string;
  quote: string;
  text: string;
  needsUserInput: boolean;
};
export type Experience = {
  id: string;
  sourceId: string;
  kind: 'self' | 'retold' | 'advice' | 'promotion' | 'unknown';
  background: Fact | null;
  action: Fact;
  outcome: Fact | null;
  result: 'success' | 'setback' | 'mixed' | 'unknown';
  stage: {
    id: string;
    label: string;
    result: 'success' | 'setback';
    quote: string;
  } | null;
  comparison: {
    text: string;
    quote: string;
    userQuote: string;
    status: string;
  };
  conditionComparisons: ConditionComparison[];
  missing: string[];
};
export type Path = {
  id: string;
  name: string;
  cases: Experience[];
  costAssessment?: {
    known: string[];
    conflicts: string[];
    missing: string[];
  };
};
export type Insight = {
  type: 'practice' | 'risk';
  title: string;
  text: string;
  sourceId: string;
  quote: string;
  applicability: string;
};
export type Question = {
  conditionId?: string;
  question: string;
  reason: string;
  sourceId: string;
  quote: string;
  options: string[];
};
export type Analysis = {
  paths: Path[];
  insights: Insight[];
  questions: Question[];
  rejected: number;
  analyzedAt: number;
  rejectionReasons?: Record<string, number>;
  citationPassRate?: number | null;
  decisionClassification?: { id: string; label: string } | null;
  jobRequirementAssessment?: {
    sampleCount: number;
    role?: string;
    region?: string;
    publishedAt?: string;
    requirements: {
      id: string;
      label: string;
      value: string;
      quote: string;
      userValue: string;
      status: 'met' | 'gap' | 'mixed' | 'compare' | 'unknown';
    }[];
    missing: string[];
  } | null;
};
export type Job = {
  id: string;
  status: 'running' | 'done' | 'error';
  progress: string;
  createdAt: number;
  profile: Profile;
  sources: Source[];
  officialSources?: OfficialSource[];
  officialAssessment?: {
    checks: OfficialCheck[];
    estimates?: { id: string; label: string; value: string; basis: string }[];
    missing: { id: string; label: string; group: 'eligibility' | 'cost' }[];
  } | null;
  result: Analysis | null;
  error: string | null;
  reused: boolean;
  historical?: boolean;
  curated?: boolean;
  retrievedAt?: string;
  restoredFrom?: string;
  metrics?: {
    searchCalls: number;
    cacheHits: number;
    stages: Record<string, unknown>[];
  };
};
export type ResearchSummary = {
  id: string;
  savedAt: number;
  question: string;
  scope: string;
  pathCount: number;
  caseCount: number;
  conditionCount: number;
  conditions: { id: string; label: string; value: string }[];
};
