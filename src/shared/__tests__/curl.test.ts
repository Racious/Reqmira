import { describe, it, expect } from "vitest";
import { parseCurl } from "../curl";

describe("parseCurl", () => {
  it("解析簡單 GET", () => {
    const r = parseCurl("curl https://api.example.com/users");
    expect(r.method).toBe("GET");
    expect(r.url).toBe("https://api.example.com/users");
  });

  it("解析 -X、-H、-d（含續行與引號）", () => {
    const r = parseCurl(`curl -X POST 'https://api.example.com/users' \\
      -H 'Authorization: Bearer xyz' \\
      -H "Content-Type: application/json" \\
      -d '{"name":"Alice"}'`);
    expect(r.method).toBe("POST");
    expect(r.url).toBe("https://api.example.com/users");
    expect(r.headers).toContainEqual({ key: "Authorization", value: "Bearer xyz", enabled: true });
    expect(r.headers).toContainEqual({ key: "Content-Type", value: "application/json", enabled: true });
    expect(r.body).toBe('{"name":"Alice"}');
    expect(r.bodyType).toBe("json");
  });

  it("有 data 但無 -X → 預設 POST", () => {
    const r = parseCurl("curl https://x.com -d 'a=1'");
    expect(r.method).toBe("POST");
    expect(r.bodyType).toBe("text");
  });

  it("-u 轉成 Basic Authorization", () => {
    const r = parseCurl("curl https://x.com -u user:pass");
    const auth = r.headers.find((h) => h.key === "Authorization");
    expect(auth?.value.startsWith("Basic ")).toBe(true);
  });

  it("忽略未知/無參數旗標", () => {
    const r = parseCurl("curl --compressed -L https://x.com/y");
    expect(r.url).toBe("https://x.com/y");
    expect(r.method).toBe("GET");
  });
});
