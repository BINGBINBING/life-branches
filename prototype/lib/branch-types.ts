export type Profile = {
  question: string;
  background: string;
  time: string;
  goal: string;
  answers: Record<string, string>;
  skipped: string[];
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
export type Fact = { text: string; quote: string };
export type Experience = {
  id: string;
  sourceId: string;
  kind: 'self' | 'retold' | 'advice' | 'promotion';
  background: Fact | null;
  action: Fact;
  outcome: Fact | null;
  result: 'success' | 'setback' | 'mixed' | 'unknown';
  comparison: {
    text: string;
    quote: string;
    userQuote: string;
    status: string;
  };
  missing: string[];
};
export type Path = { id: string; name: string; cases: Experience[] };
export type Insight = {
  type: 'practice' | 'risk';
  title: string;
  text: string;
  sourceId: string;
  quote: string;
};
export type Question = {
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
};
export type Job = {
  id: string;
  status: 'running' | 'done' | 'error';
  progress: string;
  createdAt: number;
  profile: Profile;
  sources: Source[];
  result: Analysis | null;
  error: string | null;
  reused: boolean;
  historical?: boolean;
  curated?: boolean;
  retrievedAt?: string;
};
