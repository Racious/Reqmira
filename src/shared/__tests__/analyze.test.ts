import { describe, it, expect } from "vitest";
import { detectStringFormat, inferValue, inferFromText, buildSchemaFromText } from "../analyze";
import type { SchemaNode } from "../analyze";

describe("detectStringFormat", () => {
  it("辨識各種格式", () => {
    expect(detectStringFormat("a@b.com")).toBe("email");
    expect(detectStringFormat("https://x.com/y")).toBe("url");
    expect(detectStringFormat("550e8400-e29b-41d4-a716-446655440000")).toBe("uuid");
    expect(detectStringFormat("2020-01-02")).toBe("date");
    expect(detectStringFormat("2020-01-02T03:04:05Z")).toBe("datetime");
    expect(detectStringFormat("192.168.0.1")).toBe("ipv4");
    expect(detectStringFormat("{{token}}")).toBe("variable");
  });
  it("無命中回 undefined", () => {
    expect(detectStringFormat("hello")).toBeUndefined();
  });
  it("datetime 優先於 date", () => {
    expect(detectStringFormat("2020-01-02T03:04:05Z")).toBe("datetime");
  });
});

describe("inferFromText（query/header 字串還原）", () => {
  it("布林/整數/浮點/變數/字串", () => {
    expect(inferFromText("true").type).toBe("boolean");
    expect(inferFromText("42").type).toBe("integer");
    expect(inferFromText("-3.14").type).toBe("number");
    expect(inferFromText("{{x}}").type).toBe("variable");
    const s = inferFromText("a@b.com");
    expect(s.type).toBe("string");
    expect(s.format).toBe("email");
  });
});

describe("inferValue（JSON 值推測）", () => {
  it("整數 vs 浮點", () => {
    expect(inferValue(30).type).toBe("integer");
    expect(inferValue(3.5).type).toBe("number");
  });
  it("物件欄位預設必填", () => {
    const n = inferValue({ name: "a", age: 1 });
    expect(n.type).toBe("object");
    expect(n.fields?.every((f) => f.required)).toBe(true);
  });
  it("字串格式偵測", () => {
    const n = inferValue("a@b.com");
    expect(n.type).toBe("string");
    expect(n.format).toBe("email");
  });
  it("空陣列 → items mixed", () => {
    const n = inferValue([]);
    expect(n.type).toBe("array");
    expect(n.length).toBe(0);
    expect(n.items?.type).toBe("mixed");
  });
  it("物件陣列合併：缺席的 key 變 optional", () => {
    const n = inferValue([{ a: 1, b: 2 }, { a: 1 }]);
    expect(n.type).toBe("array");
    const items = n.items as SchemaNode;
    const a = items.fields?.find((f) => f.key === "a");
    const b = items.fields?.find((f) => f.key === "b");
    expect(a?.required).toBe(true);
    expect(b?.required).toBe(false);
  });
  it("純量型別不一致 → mixed", () => {
    const n = inferValue([1, "x"]);
    expect(n.items?.type).toBe("mixed");
  });
});

describe("buildSchemaFromText", () => {
  it("合法 JSON → schema", () => {
    expect(buildSchemaFromText('{"a":1}')?.type).toBe("object");
  });
  it("空字串/壞 JSON → null", () => {
    expect(buildSchemaFromText("")).toBeNull();
    expect(buildSchemaFromText("{bad")).toBeNull();
  });
});
