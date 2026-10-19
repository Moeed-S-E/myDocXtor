import { describe, it, expect } from "vitest";
import { adviseBudget, renderCostBytes, COST_MULTIPLIER } from "@/lib/memory-budget";
import { AppError, toUserMessage } from "@/lib/errors";

describe("adviseBudget", () => {
  const budget = 1_000_000_000; // 1 GB device budget for deterministic tests

  it("returns ok for small inputs", () => {
    const advice = adviseBudget(10_000_000, COST_MULTIPLIER.pdfEdit, budget);
    expect(advice.level).toBe("ok");
    expect(advice.estimateBytes).toBe(40_000_000);
  });

  it("warns past 50% of budget", () => {
    const advice = adviseBudget(150_000_000, COST_MULTIPLIER.pdfEdit, budget);
    expect(advice.level).toBe("warn");
  });

  it("recommends streaming past 80% of budget", () => {
    const advice = adviseBudget(250_000_000, COST_MULTIPLIER.pdfEdit, budget);
    expect(advice.level).toBe("stream");
    expect(advice.message).toBeTruthy();
  });
});

describe("renderCostBytes", () => {
  it("scales with DPI squared (RGBA)", () => {
    const low = renderCostBytes(72);
    const high = renderCostBytes(144);
    // Doubling DPI ~quadruples pixels.
    expect(high / low).toBeGreaterThan(3.8);
    expect(high / low).toBeLessThan(4.2);
  });
});

describe("toUserMessage", () => {
  it("maps typed errors to actionable messages", () => {
    expect(toUserMessage(new AppError("WrongPassword")).title).toMatch(/password/i);
    expect(toUserMessage(new AppError("OutOfMemory")).nextStep).toMatch(/split/i);
    expect(toUserMessage(new Error("boom")).title).toMatch(/went wrong/i);
  });
});
