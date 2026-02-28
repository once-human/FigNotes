import { Task } from "./types";

export class CommentService {
    static async parseRestComments(rawComments: any[], currentUserHandle: string | null): Promise<Task[]> {
        try {
            const tasks: Task[] = [];

            for (const commentObj of rawComments) {
                let nodeId = commentObj.client_meta?.node_id || null;
                if (nodeId) nodeId = nodeId.replace('-', ':');

                const pageNode = this.findPageNode(nodeId);
                const frameNode = this.findFrameNode(nodeId);

                const message = commentObj.message || "";
                let assignee = null;

                // Automatic Assignment: If comment text contains @username
                if (currentUserHandle && message.includes(`@${currentUserHandle}`)) {
                    assignee = currentUserHandle;
                }

                tasks.push({
                    commentId: commentObj.id,
                    nodeId: nodeId,
                    frameId: frameNode?.id || null,
                    pageId: pageNode?.id || null,
                    author: commentObj.user?.handle || "Unknown",
                    createdAt: commentObj.created_at,
                    resolved: commentObj.resolved_at !== null && commentObj.resolved_at !== undefined,
                    timeEstimateMinutes: 15, // Default
                    assignee: assignee,
                    message: message,
                    page: pageNode?.name || "Global",
                    frame: frameNode?.name || "Canvas"
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
