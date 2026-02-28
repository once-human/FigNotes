import { Task } from "./types";

export class CommentService {
    static async parseRestComments(rawComments: any[], currentUserHandle: string | null): Promise<Task[]> {
        try {
            const tasks: Task[] = [];
            const now = new Date();

            for (const commentObj of rawComments) {
                let nodeId = commentObj.client_meta?.node_id || null;
                if (nodeId) nodeId = nodeId.replace('-', ':');

                const pageNode = this.findPageNode(nodeId);
                const frameNode = this.findFrameNode(nodeId);

                const message = commentObj.message || "";
                const author = commentObj.user?.handle || "Unknown";
                let assignee = null;

                // Automatic Assignment
                // 1. If mention found
                if (currentUserHandle && message.includes(`@${currentUserHandle}`)) {
                    assignee = currentUserHandle;
                }
                // 2. If current user is author (optional default as per request)
                else if (currentUserHandle && author === currentUserHandle) {
                    assignee = currentUserHandle;
                }

                const createdAt = commentObj.created_at;
                const ageInDays = this.calculateAge(createdAt, now);

                tasks.push({
                    commentId: commentObj.id,
                    nodeId: nodeId,
                    frameId: frameNode?.id || null,
                    pageId: pageNode?.id || null,
                    author: author,
                    createdAt: createdAt,
                    resolved: commentObj.resolved_at !== null && commentObj.resolved_at !== undefined,
                    internalStatus: "Pending", // Default
                    timeEstimateMinutes: 15, // Default
                    assignee: assignee,
                    message: message,
                    page: pageNode?.name || "Global",
                    frame: frameNode?.name || "Canvas",
                    lastUpdatedAt: now.toISOString(),
                    ageInDays: ageInDays
                });
            }

            return tasks;
        } catch (err) {
            console.error("[FigNotes] Error parsing REST comments:", err);
            return [];
        }
    }

    private static calculateAge(createdAt: string, now: Date): number {
        const created = new Date(createdAt).getTime();
        const diff = now.getTime() - created;
        return Math.floor(diff / (1000 * 60 * 60 * 24));
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
