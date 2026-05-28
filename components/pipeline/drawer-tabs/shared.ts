export interface FacetValue {
  value: string;
  evidence: { quote: string; offset: number; context: string };
}

export interface ParsedFacets {
  specializations: FacetValue[];
  gradeLevels: FacetValue[];
  pedagogicalApproach: FacetValue[];
  leadershipRoles: FacetValue[];
  extracurricular: FacetValue[];
  languages: FacetValue[];
  schoolTypes: FacetValue[];
  keyAchievements: FacetValue[];
  redFlags: FacetValue[];
  extras: Record<string, FacetValue[]>;
}

export interface Candidate {
  _id: string;
  name: string;
  phone?: string;
  email?: string;
  location?: string;
  qualifications: string[];
  certifications: string[];
  boardExperience: string[];
  subjects: string[];
  yearsExperience?: number;
  currentSchool?: string;
  resumeUrl?: string;
  resumeStorageId?: string;
  candidateSummary?: string;
  parsedFacets?: ParsedFacets;
  parseStatus?: "pending" | "done" | "failed";
  parseError?: string;
  parsedAt?: number;
}

export interface Application {
  _id: string;
  candidateId: string;
  stage: string;
  aiMatchScore?: number;
  candidate?: Candidate | null;
}
