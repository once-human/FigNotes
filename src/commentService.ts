import { Task } from "./types";

export class CommentService {
    static async fetchAllComments(): Promise<Task[]> {
        try {
            const getDeepKeys = (obj: any) => {
                let keys = new Set<string>();
                while (obj) {
                    Object.getOwnPropertyNames(obj).forEach(k => keys.add(k));
                    obj = Object.getPrototypeOf(obj);
                }
                return Array.from(keys);
            };

            const allKeys = getDeepKeys(figma);
            const commentKeys = allKeys.filter(k => k.toLowerCase().includes('comment') || k.toLowerCase().includes('thread'));

            console.log("[FigNotes] figma.getCommentThreadsAsync type:", typeof (figma as any).getCommentThreadsAsync);
            console.log("[FigNotes] figma.comments type:", typeof (figma as any).comments);
            console.log("[FigNotes] Proto keys containing 'comment/thread':", commentKeys);

            let threadsMethod = (figma as any).getCommentThreadsAsync ||
                ((figma as any).comments && (figma as any).comments.getThreadsAsync);

            if (!threadsMethod) {
                console.warn("[FigNotes] All 'get' methods found:", allKeys.filter(k => k.startsWith('get')));
                throw new Error("Figma Comment API not found. Please ensure you are logged in and using a version of Figma that supports comments.");
            }

            const allThreads = await threadsMethod.call(threadsMethod === (figma as any).getCommentThreadsAsync ? figma : (figma as any).comments);
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
