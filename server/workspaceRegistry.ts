import { PrismaClient } from "@prisma/client";
import { db } from "./db";

export interface PreservedWorkspace {
  id: string;
  userId: string;
  runId: string;
  nodeId: string;
  path: string;
  createdAt: number;
}

export class WorkspaceRegistry {
  constructor(private readonly client: PrismaClient = db) {}

  async register(input: Omit<PreservedWorkspace, "id" | "createdAt">): Promise<PreservedWorkspace> {
    const record = await this.client.managedWorkspace.upsert({
      where: { userId_path: { userId: input.userId, path: input.path } },
      create: input,
      update: { runId: input.runId, nodeId: input.nodeId },
    });
    return serialize(record);
  }

  async list(userId: string): Promise<PreservedWorkspace[]> {
    const records = await this.client.managedWorkspace.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    return records.map(serialize);
  }

  async get(userId: string, id: string): Promise<PreservedWorkspace | null> {
    const record = await this.client.managedWorkspace.findFirst({ where: { id, userId } });
    return record ? serialize(record) : null;
  }

  async remove(userId: string, id: string): Promise<boolean> {
    const result = await this.client.managedWorkspace.deleteMany({ where: { id, userId } });
    return result.count === 1;
  }
}

function serialize(record: { id: string; userId: string; runId: string; nodeId: string; path: string; createdAt: Date }): PreservedWorkspace {
  return { ...record, createdAt: record.createdAt.getTime() };
}

export const workspaceRegistry = new WorkspaceRegistry();
