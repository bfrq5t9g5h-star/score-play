import { runSelfTest } from "./self-test";

try {
  const logs = runSelfTest();
  for (const line of logs) console.log(line);
  console.log("omr self-test passed");
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
