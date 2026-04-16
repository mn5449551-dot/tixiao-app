import { getDb } from "@/lib/db";
import { agentErrorLogs } from "@/lib/schema";
import { createId } from "@/lib/id";

export type AgentName = "direction" | "copy" | "image-description" | "requirement" | "series-image";

export function logAgentError(input: {
  agent: AgentName;
  requestSummary: string;
  rawResponse: string;
  errorMessage: string;
  attemptCount: number;
}): void {
  try {
    const db = getDb();
    db.insert(agentErrorLogs)
      .values({
        id: createId("aelog"),
        agent: input.agent,
        requestSummary: input.requestSummary.slice(0, 2000),
        rawResponse: input.rawResponse.slice(0, 10000),
        errorMessage: input.errorMessage,
        attemptCount: input.attemptCount,
        createdAt: Date.now(),
      })
      .run();
  } catch {
    // Logging should never break the main flow
  }
}
