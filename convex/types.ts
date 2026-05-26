// Evidence span — quote must literally appear in rawChunks at offset
export interface Evidence {
  quote: string;
  offset: number;       // absolute char offset into the resume text
  context: string;      // ~50 chars before+after for human verification
}

export interface FacetValue {
  value: string;
  evidence: Evidence;
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
  extras: Record<string, FacetValue[]>; // open-vocabulary novelty channel
}

export interface RawChunk {
  text: string;
  section: "header" | "experience" | "pedagogy" | "achievements" | "leadership" | "other";
  offset: number;
}

export interface ParsedProfile {
  name: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  qualifications: string[];
  certifications: string[];
  boardExperience: string[];
  subjects: string[];
  yearsExperience: number | null;
  currentSchool: string | null;
  parsedFacets: ParsedFacets;
  candidateSummary: string;
  rawChunks: RawChunk[];
}

export interface FacetEmbeddings {
  overall: number[];
  experience: number[];
  pedagogy: number[];
  achievements: number[];
  leadership: number[];
}

export type FacetSection = keyof FacetEmbeddings; // "overall" | "experience" | ...

export interface RoleEmbeddings extends FacetEmbeddings {}

export interface HybridWeights {
  w_struct: number;
  w_sem: number;
  w_rules: number;
  w_graph?: number; // Phase 3
  facetWeights: {
    overall: number;
    experience: number;
    pedagogy: number;
    achievements: number;
    leadership: number;
  };
}

export const DEFAULT_HYBRID_WEIGHTS: HybridWeights = {
  w_struct: 0.5,
  w_sem: 0.3,
  w_rules: 0.2,
  facetWeights: {
    overall: 0.2,
    experience: 0.2,
    pedagogy: 0.2,
    achievements: 0.2,
    leadership: 0.2,
  },
};
