import { describe, expect, it } from "vitest";

import { getSkillWebData } from "../../../lib/content/skills";
import {
  CENTER_X,
  CENTER_Y,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  buildSkillWebGraph,
  skillWebEdgePath,
} from "../skill-web-layout";

describe("buildSkillWebGraph", () => {
  it("builds a collision-free graph from the real skill web data without throwing", () => {
    const data = getSkillWebData();
    expect(() => buildSkillWebGraph(data)).not.toThrow();
  });

  it("produces exactly one node per center/domain/category/skill entry", () => {
    const data = getSkillWebData();
    const { nodes } = buildSkillWebGraph(data);

    const domainCount = data.domains.length;
    const categoryCount = data.domains.reduce((sum, domain) => sum + domain.categories.length, 0);
    const skillCount = data.domains.reduce(
      (sum, domain) =>
        sum + domain.categories.reduce((inner, category) => inner + category.skills.length, 0),
      0,
    );

    expect(nodes.filter((node) => node.kind === "center")).toHaveLength(1);
    expect(nodes.filter((node) => node.kind === "domain")).toHaveLength(domainCount);
    expect(nodes.filter((node) => node.kind === "category")).toHaveLength(categoryCount);
    expect(nodes.filter((node) => node.kind === "skill")).toHaveLength(skillCount);
  });

  it("places the center node exactly at the world center", () => {
    const data = getSkillWebData();
    const { nodes } = buildSkillWebGraph(data);
    const center = nodes.find((node) => node.kind === "center");
    expect(center).toMatchObject({ x: CENTER_X, y: CENTER_Y });
  });

  it("keeps every node within the world bounds", () => {
    const data = getSkillWebData();
    const { nodes } = buildSkillWebGraph(data);
    for (const node of nodes) {
      expect(node.x).toBeGreaterThanOrEqual(0);
      expect(node.x).toBeLessThanOrEqual(WORLD_WIDTH);
      expect(node.y).toBeGreaterThanOrEqual(0);
      expect(node.y).toBeLessThanOrEqual(WORLD_HEIGHT);
    }
  });

  it("creates one edge per non-center node, each linking to a real parent", () => {
    const data = getSkillWebData();
    const { nodes, edges } = buildSkillWebGraph(data);
    const nodeIds = new Set(nodes.map((node) => node.id));

    expect(edges).toHaveLength(nodes.length - 1);
    for (const edge of edges) {
      expect(nodeIds.has(edge.from.id)).toBe(true);
      expect(nodeIds.has(edge.to.id)).toBe(true);
      expect(edge.to.parentId).toBe(edge.from.id);
      expect(edge.path).toMatch(/^M .+ C .+,.+,.+$/);
    }
  });
});

describe("skillWebEdgePath", () => {
  it("renders a cubic-bezier SVG path starting and ending at the node coordinates", () => {
    const from = { id: "a", kind: "center" as const, x: 0, y: 0, label: "", description: "", accent: "#fff" };
    const to = { id: "b", kind: "domain" as const, x: 100, y: 50, label: "", description: "", accent: "#fff" };
    const path = skillWebEdgePath({ id: "a-b", from, to, accent: "#fff", path: "" });
    expect(path.startsWith("M 0 0")).toBe(true);
    expect(path.endsWith("100 50")).toBe(true);
  });
});
