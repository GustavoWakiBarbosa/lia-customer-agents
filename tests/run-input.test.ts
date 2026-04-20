import { describe, expect, it } from "vitest";
import { RunInputSchema } from "../src/types.js";

describe("RunInputSchema", () => {
  const validInput = {
    userMessage: "Olá, preciso de ajuda",
    conversationId: "conv-1",
    organizationId: "org-1",
    clientId: "cli-1",
  };

  it("accepts a minimal valid payload", () => {
    const parsed = RunInputSchema.parse(validInput);
    expect(parsed.userMessage).toBe("Olá, preciso de ajuda");
    expect(parsed.conversationId).toBe("conv-1");
    expect(parsed.calendarConnectionId).toBeUndefined();
    expect(parsed.previousResponseId).toBeUndefined();
  });

  it("accepts all optional fields when provided", () => {
    const parsed = RunInputSchema.parse({
      ...validInput,
      calendarConnectionId: "cal-1",
      previousResponseId: "resp_123",
      extra: { clientName: "Maria" },
    });
    expect(parsed.calendarConnectionId).toBe("cal-1");
    expect(parsed.previousResponseId).toBe("resp_123");
    expect(parsed.extra).toEqual({ clientName: "Maria" });
  });

  it("rejects an empty userMessage", () => {
    expect(() =>
      RunInputSchema.parse({ ...validInput, userMessage: "" }),
    ).toThrow();
  });

  it("rejects missing required ids", () => {
    expect(() =>
      RunInputSchema.parse({ ...validInput, organizationId: "" }),
    ).toThrow();
    expect(() =>
      RunInputSchema.parse({ ...validInput, clientId: undefined }),
    ).toThrow();
  });
});
