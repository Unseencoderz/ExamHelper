export const PROMPTS = [
  {
    id: "code-generation",
    title: "Code Generation",
    description: "Optimized implementation plus the reasoning needed to trust it.",
    prompt:
      "Generate optimized code for the given problem with clear explanations, edge-case handling, and concise time and space complexity notes.",
  },
  {
    id: "problem-solving",
    title: "Problem Solving",
    description: "Break the task apart before committing to the final answer.",
    prompt:
      "Solve the problem step-by-step with detailed reasoning, highlight key observations, and explain why the final approach is correct.",
  },
  {
    id: "direct-answer",
    title: "Direct Answer",
    description: "Short, precise, and still justified.",
    prompt:
      "Provide a concise and accurate answer with justification, keeping the response direct while still covering the essential evidence.",
  },
];
