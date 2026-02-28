import { Task } from "./types";

export class CommentService {
    static async parseRestComments(rawComments: any[]): Promise<Task[]> {
        try {
            const tasks: Task[] = [];
            const now = new Date().toISOString();

            for (const commentObj of rawComments) {
                const nodeId = commentObj.client_meta?.node_id || null;
                const pageNode = this.findPageNode(nodeId);
                const frameNode = this.findFrameNode(nodeId);

                tasks.push({
                    commentId: commentObj.id,
                    nodeId: nodeId,
                    frameId: frameNode?.id || null,
                    pageId: pageNode?.id || null,
                    author: commentObj.user?.handle || "Unknown",
                    createdAt: commentObj.created_at,
                    resolved: commentObj.resolved_at !== null && commentObj.resolved_at !== undefined,
                    internalStatus: commentObj.resolved_at ? "Done" : "In Progress",
                    timeEstimateMinutes: 15, // Default
                    assignee: null,
                    priority: "Medium",
                    message: commentObj.message,
                    page: pageNode?.name || "Global",
                    frame: frameNode?.name || "Canvas",
                    lastUpdatedAt: now,
                    ageInDays: 0
                });
            }

            return tasks;
        } catch (err) {
            console.error("[FigNotes] Error parsing REST comments:", err);
            return [];
        }
    }

    private static findPageNode(nodeId: string | null): PageNode | null {
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

    private static findFrameNode(nodeId: string | null): FrameNode | null {
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
