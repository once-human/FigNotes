import { Task } from "./types";

export class CommentService {
    static async fetchAllComments(): Promise<Task[]> {
        try {
            const threadsMethod = (figma as any).getCommentThreadsAsync ||
                ((figma as any).comments && (figma as any).comments.getThreadsAsync);

            if (!threadsMethod) {
                console.warn("[FigNotes] Comment API not found.");
                return [];
            }

            const allThreads = await threadsMethod.call(threadsMethod === (figma as any).getCommentThreadsAsync ? figma : (figma as any).comments);
            const tasks: Task[] = [];
            const now = new Date().toISOString();

            for (const thread of allThreads) {
                const firstComment = thread.comments[0];
                if (!firstComment) continue;

                const nodeId = thread.region?.nodeId || null;
                const page = await this.findPage(nodeId);
                const frame = await this.findFrame(nodeId);

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
                    ageInDays: 0,
                    isAvoidance: false
                });
            }

            return tasks;
        } catch (err) {
            console.error("[FigNotes] Error fetching comments:", err);
            return [];
        }
    }

    private static async findPage(nodeId: string | null): Promise<PageNode | null> {
        if (!nodeId) return null;
        try {
            // Using Async version for dynamic-page support
            let node = await figma.getNodeByIdAsync(nodeId);
            while (node && node.type !== "PAGE") {
                node = node.parent as BaseNode;
            }
            return node as PageNode;
        } catch {
            return null;
        }
    }

    private static async findFrame(nodeId: string | null): Promise<FrameNode | null> {
        if (!nodeId) return null;
        try {
            // Using Async version for dynamic-page support
            let node = await figma.getNodeByIdAsync(nodeId);
            while (node && node.type !== "FRAME" && node.type !== "PAGE") {
                node = node.parent as BaseNode;
            }
            return node?.type === "FRAME" ? node : null;
        } catch {
            return null;
        }
    }
}
