import { describe, it, expect } from "vitest";
import { toTypeScript, toJavaDto, toMarkdownDoc } from "../generators";
import { inferValue } from "../analyze";

const sampleBody = {
  name: "Alice",
  age: 30,
  active: true,
  roles: ["admin", "user"],
  profile: { city: "Taipei", zip: 100 },
};

describe("toTypeScript", () => {
  const ts = toTypeScript(inferValue(sampleBody), "User");

  it("產生根 interface 與欄位型別", () => {
    expect(ts).toContain("export interface User {");
    expect(ts).toContain("name: string;");
    expect(ts).toContain("age: number;");
    expect(ts).toContain("active: boolean;");
    expect(ts).toContain("roles: string[];");
    expect(ts).toContain("profile: Profile;");
  });

  it("巢狀物件產生獨立 interface", () => {
    expect(ts).toContain("export interface Profile {");
    expect(ts).toContain("city: string;");
  });

  it("選填欄位加上 ?", () => {
    const optional = toTypeScript(inferValue([{ a: 1, b: 2 }, { a: 1 }]), "Item");
    expect(optional).toContain("b?: number;");
  });

  it("陣列根仍保留巢狀 interface（回歸：曾遺失）", () => {
    const arrTs = toTypeScript(inferValue([{ id: 1 }]), "Row");
    expect(arrTs).toContain("export type Row =");
    expect(arrTs).toContain("interface"); // 巢狀 interface 不應遺失
    expect(arrTs).toContain("id: number;");
  });
});

describe("toJavaDto", () => {
  const java = toJavaDto(inferValue(sampleBody), "User");

  it("產生 record 與型別對應", () => {
    expect(java).toContain("public record User(");
    expect(java).toContain("String name");
    expect(java).toContain("Long age");
    expect(java).toContain("Boolean active");
    expect(java).toContain("List<String> roles");
    expect(java).toContain("Profile profile");
    expect(java).toContain("public record Profile(");
  });

  it("List 帶上 import", () => {
    expect(java).toContain("import java.util.List;");
  });

  it("format 對應 UUID / LocalDate 與其 import", () => {
    const j = toJavaDto(
      inferValue({ id: "550e8400-e29b-41d4-a716-446655440000", born: "2020-01-02" }),
      "Rec",
    );
    expect(j).toContain("UUID id");
    expect(j).toContain("LocalDate born");
    expect(j).toContain("import java.util.UUID;");
    expect(j).toContain("import java.time.LocalDate;");
  });

  it("非物件根 → 註解，不產 record", () => {
    expect(toJavaDto(inferValue([1, 2, 3]), "Nums")).toContain("//");
  });
});

describe("toMarkdownDoc", () => {
  const md = toMarkdownDoc({
    name: "建立使用者",
    method: "post",
    url: "{{baseUrl}}/api/users",
    description: "說明",
    query: [{ key: "dry", value: "true" }],
    headers: [{ key: "Authorization", value: "Bearer x" }],
    bodyJson: JSON.stringify({ userId: 1, items: [{ sku: "a" }] }),
    response: { status: 200, statusText: "OK", body: '{"code":"0000"}', contentType: "application/json" },
  });

  it("含標題、方法、各區段", () => {
    expect(md).toContain("# 建立使用者");
    expect(md).toContain("`POST`");
    expect(md).toContain("## Query 參數");
    expect(md).toContain("## Headers");
    expect(md).toContain("## Request Body");
    expect(md).toContain("## Response");
  });

  it("body 攤平成 dotted-path 列", () => {
    expect(md).toContain("userId");
    expect(md).toContain("items[].sku");
  });

  it("回應 JSON 範例以 code fence 呈現", () => {
    expect(md).toContain("```json");
  });
});
