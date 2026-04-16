import { describe, expect, it } from "vitest";

const { resolveLoopbackRedirectUrl } = await import("../../server/loopback-redirect");

describe("resolveLoopbackRedirectUrl", () => {
  it("redirects loopback ipv4 GET requests to localhost", () => {
    const result = resolveLoopbackRedirectUrl(
      {
        method: "GET",
        url: "/office?tab=chat",
        headers: { host: "127.0.0.1:3000" },
      },
      { port: 3000, useHttps: false }
    );

    expect(result).toBe("http://localhost:3000/office?tab=chat");
  });

  it("redirects ipv6 loopback HEAD requests to localhost", () => {
    const result = resolveLoopbackRedirectUrl(
      {
        method: "HEAD",
        url: "/",
        headers: { host: "[::1]:3000" },
      },
      { port: 3000, useHttps: true }
    );

    expect(result).toBe("https://localhost:3000/");
  });

  it("does not redirect localhost requests", () => {
    const result = resolveLoopbackRedirectUrl(
      {
        method: "GET",
        url: "/office",
        headers: { host: "localhost:3000" },
      },
      { port: 3000, useHttps: false }
    );

    expect(result).toBeNull();
  });

  it("does not redirect non-GET requests", () => {
    const result = resolveLoopbackRedirectUrl(
      {
        method: "POST",
        url: "/api/studio",
        headers: { host: "127.0.0.1:3000" },
      },
      { port: 3000, useHttps: false }
    );

    expect(result).toBeNull();
  });
});