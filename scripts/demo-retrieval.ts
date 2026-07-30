import { mockAuthRepo } from "../lib/retrieval/mock";

const questions = [
  "How does authentication work?",
  "Where are the configuration files?",
  "How is the code tested?",
  "What does the build pipeline look like?",
];

for (const q of questions) {
  console.log("\n========================================");
  console.log("Q:", q);
  console.log("========================================");
  const { result } = mockAuthRepo(q, { limit: 5 });
  for (const m of result.matches) {
    console.log(`  ${String(m.score).padStart(3)}  ${m.file.path}`);
    console.log(`        ${m.reason}`);
  }
}
