import { getLlmClient, LLM_MODEL } from "./lib/llmClient";

const INDIAN_EDUCATION_TAXONOMY = `
You are an AI that parses natural language job descriptions for Indian K-12 schools into structured criteria.

Indian education context:
- Boards: CBSE, ICSE, IB, IGCSE, State Board
- Teaching levels: PRT (Primary Teacher, Classes 1-5), TGT (Trained Graduate Teacher, Classes 6-10), PGT (Post Graduate Teacher, Classes 11-12)
- Common qualifications: B.Ed, D.El.Ed, M.Ed, CTET, State TET, NET, Ph.D
- Subjects include: English, Hindi, Mathematics, Physics, Chemistry, Biology, History, Geography, Economics, Computer Science, Sanskrit, Regional Languages

Return a JSON object with this exact structure:
{
  "subjects": string[],
  "board": string,
  "level": string,
  "requiredQualifications": string[],
  "preferredQualifications": string[],
  "minExperience": number | null,
  "skills": string[]
}
`;

export async function parseJobDescription(
  description: string
): Promise<{
  subjects: string[];
  board: string;
  level: string;
  requiredQualifications: string[];
  preferredQualifications: string[];
  minExperience: number | null;
  skills: string[];
}> {
  const client = getLlmClient();
  if (!client) {
    return {
      subjects: [],
      board: "",
      level: "",
      requiredQualifications: [],
      preferredQualifications: [],
      minExperience: null,
      skills: [],
    };
  }

  const response = await client.chat.completions.create({
    model: LLM_MODEL,
    max_tokens: 1024,
    temperature: 0,
    messages: [
      { role: "system", content: INDIAN_EDUCATION_TAXONOMY },
      { role: "user", content: `Parse this job description into structured criteria:\n\n${description}` },
    ],
  });

  const text = response.choices[0]?.message?.content ?? "";

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error("No JSON found in response");
  } catch (err) {
    throw new Error(`Failed to parse AI response: ${text.substring(0, 200)}`);
  }
}
