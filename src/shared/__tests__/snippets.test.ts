import { describe, it, expect } from "vitest";
import { buildSnippets, type SnippetInput } from "../snippets";

const input: SnippetInput = {
  method: "POST",
  url: "https://api.example.com/users",
  query: [{ key: "dry", value: "true" }],
  headers: [
    { key: "Authorization", value: "Bearer t" },
    { key: "Content-Type", value: "application/json" },
  ],
  body: '{"name":"A"}',
  bodyType: "json",
};

const s = buildSnippets(input);

describe("buildSnippets", () => {
  it("curl：方法/URL/header/body/query", () => {
    expect(s.curl).toContain("curl -X POST");
    expect(s.curl).toContain("dry=true"); // query 併入 URL
    expect(s.curl).toContain("-H 'Authorization: Bearer t'");
    expect(s.curl).toContain("-d '{\"name\":\"A\"}'");
  });

  it("JavaScript fetch", () => {
    expect(s.javascript).toContain('fetch("https://api.example.com/users?dry=true"');
    expect(s.javascript).toContain('method: "POST"');
    expect(s.javascript).toContain("Authorization");
    expect(s.javascript).toContain("body:");
  });

  it("Python requests", () => {
    expect(s.python).toContain("import requests");
    expect(s.python).toContain("requests.post(");
  });

  it("Java HttpClient", () => {
    expect(s.java).toContain("HttpClient");
    expect(s.java).toContain("URI.create");
    expect(s.java).toContain('.header("Authorization"');
    expect(s.java).toContain("BodyPublishers.ofString");
  });

  it("無 body 時不應出現 body 區段", () => {
    const g = buildSnippets({ ...input, method: "GET", body: "", bodyType: "none" });
    expect(g.curl).not.toContain("-d ");
    expect(g.java).toContain("BodyPublishers.noBody()");
  });
});
