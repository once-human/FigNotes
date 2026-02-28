import { Task } from "./types";

export class CommentService {
    static async parseRestComments(rawComments: any[]): Promise<Task[]> {
        try {
            const tasks: Task[] = [];
            const now = new Date().toISOString();

            for (const commentObj of rawComments) {
                // Usually REST API gives `client_meta.node_id` or similar for location
                const nodeId = commentObj.client_meta?.node_id || commentObj.file_key /* fallback */ || null;
                const page = this.findPage(nodeId);
                const frame = this.findFrame(nodeId);

                tasks.push({
                    commentId: commentObj.id,
                    message: commentObj.message,
                    page: page?.name || "Global / Unassigned",
                    frame: frame?.name || "Canvas",
                    resolved: commentObj.resolved_at !== null && commentObj.resolved_at !== undefined,
                    resolvedBy: commentObj.resolved_at ? "Figma User" : null,
                    effort: 1,
                    discussionStatus: "pending",
                    createdAt: commentObj.created_at,
                    lastUpdatedAt: now,
                    ageInDays: 0,
                    isAvoidance: false
                });
            }

            return tasks;
        } catch (err) {
            console.error("[FigNotes] Error parsing REST comments:", err);
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
