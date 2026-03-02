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

                // Extract Mentions: Looking for @username pattern
                const mentionMatches = message.match(/@([a-zA-Z0-9_\-]+)/g) || [];
                const mentions = mentionMatches.map((m: string) => m.substring(1));

                let assignee = null;
                const isMeMentioned = currentUserHandle && mentions.includes(currentUserHandle);

                // Logic:
                // 1. If only current user is mentioned -> Assigned to Me
                // 2. If multiple mentions including current user -> Discussion
                // 3. Otherwise -> null (Pending)

                if (isMeMentioned) {
                    if (mentions.length === 1) {
                        assignee = currentUserHandle;
                    }
                }

                tasks.push({
                    commentId: commentObj.id,
                    nodeId: nodeId,
                    frameId: frameNode?.id || null,
                    pageId: pageNode?.id || null,
                    author: commentObj.user?.handle || "Unknown",
                    authorAvatarUrl: commentObj.user?.img_url || null,
                    createdAt: commentObj.created_at,
                    resolved: commentObj.resolved_at !== null && commentObj.resolved_at !== undefined,
                    resolvedAt: commentObj.resolved_at || undefined,
                    effort: null, // Default
                    assignee: assignee,
                    message: message,
                    page: pageNode?.name || "Global",
                    frame: frameNode?.name || "Canvas",
                    isCurrentlyWorking: false,
                    mentions: mentions,
                    ignored: false
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
