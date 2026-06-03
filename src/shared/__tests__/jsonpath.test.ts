import { describe, it, expect } from "vitest";
import { getByPath } from "../jsonpath";

describe("getByPath", () => {
  const data = {
    data: { token: "abc", items: [{ id: 1 }, { id: 2 }] },
    method: "GET",
    list: [10, 20, 30],
  };

  it("解析 $.a.b 點路徑", () => {
    expect(getByPath(data, "$.data.token")).toBe("abc");
  });

  it("可省略開頭 $", () => {
    expect(getByPath(data, "method")).toBe("GET");
  });

  it("解析陣列索引", () => {
    expect(getByPath(data, "$.data.items[0].id")).toBe(1);
    expect(getByPath(data, "$.data.items[1].id")).toBe(2);
    expect(getByPath(data, "$.list[2]")).toBe(30);
  });

  it("頂層陣列 $[n]", () => {
    expect(getByPath([5, 6, 7], "$[1]")).toBe(6);
  });

  it("路徑不存在回 undefined", () => {
    expect(getByPath(data, "$.data.missing")).toBeUndefined();
    expect(getByPath(data, "$.data.items[9].id")).toBeUndefined();
    expect(getByPath(data, "$.a.b.c.d")).toBeUndefined();
  });

  it("null 根安全", () => {
    expect(getByPath(null, "$.x")).toBeUndefined();
  });
});
