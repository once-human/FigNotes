import { Task } from "./types";

export class CommentService {
    static async fetchAllComments(): Promise<Task[]> {
        try {
            const allThreads = await (figma as any).getCommentThreadsAsync();
            const tasks: Task[] = [];
            const now = new Date().toISOString();

            for (const thread of allThreads) {
                const firstComment = thread.comments[0];
                if (!firstComment) continue;

                const nodeId = thread.region?.nodeId || null;
                const page = this.findPage(nodeId);
                const frame = this.findFrame(nodeId);

                tasks.push({
                    commentId: thread.id,
                    message: firstComment.message,
                    page: page?.name || "Global / Unassigned",
                    frame: frame?.name || "Canvas",
                    resolved: thread.resolved,
                    resolvedBy: thread.resolved ? "Figma User" : null,
                    effort: 1,
                    discussionStatus: "pending",
                    createdAt: firstComment.createdAt,
                    lastUpdatedAt: now,
                    ageInDays: 0, // Calculated during sync
                    isAvoidance: false // Calculated during sync
                });
            }

            return tasks;
        } catch (err) {
            console.error("Error fetching Figma comments", err);
            return [];
        }
    }

    private static findPage(nodeId: string | null): PageNode | null {
        if (!nodeId) return null;
        try {
            let node = figma.getNodeById(nodeId);
            while (node && node.type !== "PAGE") {
                node = node.parent as BaseNode;
            }
            return node as PageNode;
        } catch {
            return null;
        }
    }

    private static findFrame(nodeId: string | null): FrameNode | null {
        if (!nodeId) return null;
        try {
            let node = figma.getNodeById(nodeId);
            while (node && node.type !== "FRAME" && node.type !== "PAGE") {
                node = node.parent as BaseNode;
            }
            return node?.type === "FRAME" ? node : null;
        } catch {
            return null;
        }
    }
}
