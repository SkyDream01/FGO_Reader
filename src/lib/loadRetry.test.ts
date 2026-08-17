import { describe, expect, it, vi } from "vitest";
import { LOAD_RETRY_COUNT, retryAsync } from "./loadRetry";

describe("load retry", () => {
  it("makes the initial attempt plus three retries by default", async () => {
    const operation = vi.fn()
      .mockRejectedValueOnce(new Error("network-1"))
      .mockRejectedValueOnce(new Error("network-2"))
      .mockRejectedValueOnce(new Error("network-3"))
      .mockResolvedValue("ready");

    await expect(retryAsync(operation, { delayMs: 0 })).resolves.toBe("ready");
    expect(operation).toHaveBeenCalledTimes(LOAD_RETRY_COUNT + 1);
  });

  it("stops immediately when the caller aborts", async () => {
    const controller = new AbortController();
    controller.abort();
    const operation = vi.fn().mockResolvedValue("ready");

    await expect(retryAsync(operation, { signal: controller.signal, delayMs: 0 }))
      .rejects.toMatchObject({ name: "AbortError" });
    expect(operation).not.toHaveBeenCalled();
  });
});
