import { describe, it, expect } from "vitest";
import { detectAndParse } from "../importers";

const openapi = JSON.stringify({
  openapi: "3.0.0",
  paths: {
    "/users": {
      get: { summary: "List users", operationId: "listUsers", parameters: [{ name: "page", in: "query" }] },
      post: {
        operationId: "createUser",
        tags: ["User"],
        requestBody: {
          content: {
            "application/json": {
              schema: { type: "object", properties: { name: { type: "string" }, age: { type: "integer" } } },
            },
          },
        },
      },
    },
  },
});

const postman = JSON.stringify({
  info: { name: "c", _postman_id: "x", schema: "v2.1" },
  item: [
    {
      name: "Get U",
      request: {
        method: "GET",
        url: { raw: "https://x.com/users", query: [{ key: "q", value: "1" }] },
        header: [{ key: "H", value: "V" }],
      },
    },
  ],
});

describe("detectAndParse", () => {
  it("OpenAPI：路徑與方法轉請求", () => {
    const r = detectAndParse(openapi);
    expect(r.kind).toBe("OpenAPI");
    expect(r.items.length).toBe(2);
    const get = r.items.find((i) => i.spec.method === "GET")!;
    expect(get.spec.url).toBe("{{baseUrl}}/users");
    expect(get.spec.query).toHaveProperty("page");
    const post = r.items.find((i) => i.spec.method === "POST")!;
    expect(post.spec.body?.type).toBe("json");
    expect(post.spec.body?.content).toContain("name");
  });

  it("Postman：item 轉請求", () => {
    const r = detectAndParse(postman);
    expect(r.kind).toBe("Postman");
    expect(r.items.length).toBe(1);
    expect(r.items[0].spec.method).toBe("GET");
    expect(r.items[0].spec.url).toBe("https://x.com/users");
    expect(r.items[0].spec.query).toHaveProperty("q");
    expect(r.items[0].spec.headers).toHaveProperty("H");
  });

  it("非 JSON / 無法辨識 → 拋錯", () => {
    expect(() => detectAndParse("not json")).toThrow();
    expect(() => detectAndParse('{"foo":1}')).toThrow();
  });
});
