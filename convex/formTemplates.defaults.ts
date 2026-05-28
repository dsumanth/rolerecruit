import type { EvaluatorRole } from "./types";

type FieldType = "score_1_5" | "score_1_10" | "text" | "choice";

export type DefaultField = {
  key: string;
  label: string;
  type: FieldType;
  weight?: number;
  allowDictation?: boolean;
  required?: boolean;
};

export type DefaultTemplate = {
  role: EvaluatorRole;
  name: string;
  fields: DefaultField[];
};

export const BUILT_IN_TEMPLATES: DefaultTemplate[] = [
  {
    role: "principal",
    name: "Principal default",
    fields: [
      { key: "subjectKnowledge", label: "Subject knowledge", type: "score_1_5", required: true },
      { key: "classroomManagement", label: "Classroom management", type: "score_1_5", required: true },
      { key: "communication", label: "Communication", type: "score_1_5", required: true },
      { key: "overallFit", label: "Overall fit", type: "score_1_5", required: true },
      { key: "comments", label: "Comments", type: "text", allowDictation: true },
    ],
  },
  {
    role: "hod",
    name: "HOD default",
    fields: [
      { key: "subjectKnowledge", label: "Subject knowledge", type: "score_1_5", weight: 2, required: true },
      { key: "pedagogy", label: "Pedagogy", type: "score_1_5", weight: 2, required: true },
      { key: "curriculumAlignment", label: "Curriculum alignment", type: "score_1_5", required: true },
      { key: "communication", label: "Communication", type: "score_1_5", required: true },
      { key: "comments", label: "Comments", type: "text", allowDictation: true },
    ],
  },
  {
    role: "hr_admin",
    name: "HR default",
    fields: [
      { key: "communication", label: "Communication", type: "score_1_5", required: true },
      { key: "professionalism", label: "Professionalism", type: "score_1_5", required: true },
      { key: "culturalFit", label: "Cultural fit", type: "score_1_5", weight: 2, required: true },
      { key: "comments", label: "Comments", type: "text", allowDictation: true },
    ],
  },
  {
    role: "teacher",
    name: "Teacher default",
    fields: [
      { key: "peerCompatibility", label: "Peer compatibility", type: "score_1_5", required: true },
      { key: "subjectKnowledge", label: "Subject knowledge", type: "score_1_5", required: true },
      { key: "teachingStyleAlignment", label: "Teaching style alignment", type: "score_1_5", required: true },
      { key: "comments", label: "Comments", type: "text", allowDictation: true },
    ],
  },
];
