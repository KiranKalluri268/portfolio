import type { SkillContent, SkillWebData } from "../../lib/content/types";

export const WORLD_WIDTH = 2800;
export const WORLD_HEIGHT = 2500;
export const CENTER_X = WORLD_WIDTH / 2;
export const CENTER_Y = WORLD_HEIGHT / 2;

export interface GraphNode {
  id: string;
  parentId?: string;
  kind: "center" | "domain" | "category" | "skill";
  x: number;
  y: number;
  label: string;
  description: string;
  accent: string;
  skill?: SkillContent;
}

export interface GraphEdge {
  id: string;
  from: GraphNode;
  to: GraphNode;
  accent: string;
}

const NODE_BOUNDS = {
  center: { width: 192, height: 192 },
  domain: { width: 208, height: 80 },
  category: { width: 176, height: 64 },
  skill: { width: 144, height: 48 },
} satisfies Record<GraphNode["kind"], { width: number; height: number }>;
const NODE_GAP = 18;

function roundCoordinate(value: number) {
  return Math.round(value * 1000) / 1000;
}

function polar(radius: number, angle: number) {
  const radians = angle * Math.PI / 180;
  return {
    x: CENTER_X + Math.cos(radians) * radius,
    y: CENTER_Y + Math.sin(radians) * radius,
  };
}

function resolveNodeCollisions(nodes: GraphNode[]) {
  const skills = nodes.filter((node) => node.kind === "skill");
  const structuralNodes = nodes.filter((node) => node.kind !== "skill");

  for (let iteration = 0; iteration < 240; iteration += 1) {
    let moved = false;

    for (let firstIndex = 0; firstIndex < skills.length; firstIndex += 1) {
      const first = skills[firstIndex];

      for (let secondIndex = firstIndex + 1; secondIndex < skills.length; secondIndex += 1) {
        const second = skills[secondIndex];
        const deltaX = second.x - first.x;
        const deltaY = second.y - first.y;
        const overlapX = NODE_BOUNDS.skill.width + NODE_GAP - Math.abs(deltaX);
        const overlapY = NODE_BOUNDS.skill.height + NODE_GAP - Math.abs(deltaY);
        if (overlapX <= 0 || overlapY <= 0) continue;

        moved = true;
        if (overlapX < overlapY) {
          const direction = deltaX === 0 ? (firstIndex % 2 === 0 ? 1 : -1) : Math.sign(deltaX);
          const shift = overlapX / 2 + 0.5;
          first.x -= direction * shift;
          second.x += direction * shift;
        } else {
          const direction = deltaY === 0 ? (secondIndex % 2 === 0 ? 1 : -1) : Math.sign(deltaY);
          const shift = overlapY / 2 + 0.5;
          first.y -= direction * shift;
          second.y += direction * shift;
        }
      }

      for (const structuralNode of structuralNodes) {
        const structuralBounds = NODE_BOUNDS[structuralNode.kind];
        const deltaX = first.x - structuralNode.x;
        const deltaY = first.y - structuralNode.y;
        const overlapX =
          (NODE_BOUNDS.skill.width + structuralBounds.width) / 2 + NODE_GAP - Math.abs(deltaX);
        const overlapY =
          (NODE_BOUNDS.skill.height + structuralBounds.height) / 2 + NODE_GAP - Math.abs(deltaY);
        if (overlapX <= 0 || overlapY <= 0) continue;

        moved = true;
        if (overlapX < overlapY) {
          first.x += (deltaX === 0 ? 1 : Math.sign(deltaX)) * (overlapX + 0.5);
        } else {
          first.y += (deltaY === 0 ? 1 : Math.sign(deltaY)) * (overlapY + 0.5);
        }
      }

      first.x = Math.min(
        WORLD_WIDTH - NODE_BOUNDS.skill.width / 2 - NODE_GAP,
        Math.max(NODE_BOUNDS.skill.width / 2 + NODE_GAP, first.x),
      );
      first.y = Math.min(
        WORLD_HEIGHT - NODE_BOUNDS.skill.height / 2 - NODE_GAP,
        Math.max(NODE_BOUNDS.skill.height / 2 + NODE_GAP, first.y),
      );
    }

    if (!moved) break;
  }
}

export function assertCollisionFree(nodes: GraphNode[]) {
  for (let firstIndex = 0; firstIndex < nodes.length; firstIndex += 1) {
    const first = nodes[firstIndex];
    for (let secondIndex = firstIndex + 1; secondIndex < nodes.length; secondIndex += 1) {
      const second = nodes[secondIndex];
      if (first.kind !== "skill" && second.kind !== "skill") continue;
      const firstBounds = NODE_BOUNDS[first.kind];
      const secondBounds = NODE_BOUNDS[second.kind];
      const overlapX =
        (firstBounds.width + secondBounds.width) / 2 + NODE_GAP - Math.abs(second.x - first.x);
      const overlapY =
        (firstBounds.height + secondBounds.height) / 2 + NODE_GAP - Math.abs(second.y - first.y);
      if (overlapX > 0 && overlapY > 0) {
        throw new Error(`Skill web layout collision: "${first.id}" overlaps "${second.id}"`);
      }
    }
  }
}

export function buildSkillWebGraph(data: SkillWebData) {
  const nodes: GraphNode[] = [{
    id: "center",
    kind: "center",
    x: CENTER_X,
    y: CENTER_Y,
    label: data.center.label,
    description: data.center.eyebrow,
    accent: "#ffffff",
  }];
  const edges: GraphEdge[] = [];
  const center = nodes[0];

  for (const domain of data.domains) {
    const domainPosition = polar(350, domain.angle);
    const domainNode: GraphNode = {
      id: `domain:${domain.slug}`,
      parentId: center.id,
      kind: "domain",
      ...domainPosition,
      label: domain.label,
      description: domain.description,
      accent: domain.accent,
    };
    nodes.push(domainNode);
    edges.push({
      id: `${center.id}-${domainNode.id}`,
      from: center,
      to: domainNode,
      accent: domain.accent,
    });

    const categoryMiddle = (domain.categories.length - 1) / 2;
    domain.categories.forEach((category, categoryIndex) => {
      const categoryAngle = domain.angle + (categoryIndex - categoryMiddle) * 16;
      const categoryPosition = polar(665, categoryAngle);
      const categoryNode: GraphNode = {
        id: `category:${category.slug}`,
        parentId: domainNode.id,
        kind: "category",
        ...categoryPosition,
        label: category.label,
        description: category.description,
        accent: domain.accent,
      };
      nodes.push(categoryNode);
      edges.push({
        id: `${domainNode.id}-${categoryNode.id}`,
        from: domainNode,
        to: categoryNode,
        accent: domain.accent,
      });

      category.skills.forEach((skill, skillIndex) => {
        const row = Math.floor(skillIndex / 2);
        const itemsInRow = Math.min(2, category.skills.length - row * 2);
        const column = skillIndex % 2 - (itemsInRow - 1) / 2;
        const skillRadius = 875 + row * 102;
        const skillPosition = polar(skillRadius, categoryAngle);
        const categoryRadians = categoryAngle * Math.PI / 180;
        skillPosition.x += -Math.sin(categoryRadians) * column * 158;
        skillPosition.y += Math.cos(categoryRadians) * column * 158;
        const skillNode: GraphNode = {
          id: `skill:${skill.slug}`,
          parentId: categoryNode.id,
          kind: "skill",
          ...skillPosition,
          label: skill.name,
          description: skill.shortDescription,
          accent: domain.accent,
          skill,
        };
        nodes.push(skillNode);
        edges.push({
          id: `${categoryNode.id}-${skillNode.id}`,
          from: categoryNode,
          to: skillNode,
          accent: domain.accent,
        });
      });
    });
  }

  resolveNodeCollisions(nodes);
  for (const node of nodes) {
    node.x = roundCoordinate(node.x);
    node.y = roundCoordinate(node.y);
  }
  assertCollisionFree(nodes);
  return { nodes, edges };
}

export function skillWebEdgePath(edge: GraphEdge) {
  const dx = edge.to.x - edge.from.x;
  const dy = edge.to.y - edge.from.y;
  const bend = edge.from.kind === "center" ? 0.36 : 0.44;
  const control1 = {
    x: edge.from.x + dx * bend,
    y: edge.from.y + dy * bend,
  };
  const control2 = {
    x: edge.to.x - dx * bend,
    y: edge.to.y - dy * bend,
  };
  return [
    `M ${roundCoordinate(edge.from.x)} ${roundCoordinate(edge.from.y)}`,
    `C ${roundCoordinate(control1.x)} ${roundCoordinate(control1.y)},`,
    `${roundCoordinate(control2.x)} ${roundCoordinate(control2.y)},`,
    `${roundCoordinate(edge.to.x)} ${roundCoordinate(edge.to.y)}`,
  ].join(" ");
}
