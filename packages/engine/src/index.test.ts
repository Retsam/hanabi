import { describe, expect, it } from "vitest";
import { ENGINE_VERSION } from "./index";

describe("engine package", () => {
  it("is wired into the workspace", () => {
    expect(ENGINE_VERSION).toBe("0.0.0");
  });
});
