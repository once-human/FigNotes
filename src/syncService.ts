import { StorageService } from "./storageService";
import { CommentService } from "./commentService";
import { Task, SyncResult, FlowMetrics } from "./types";

export class SyncService {
    static async sync(rawComments: any[], currentUserHandle: string | null): Promise<SyncResult> {
        let liveTasks = await CommentService.parseRestComments(rawComments, currentUserHandle);
        const storedTasksMap = await StorageService.getTasks();
        const reconciledTasks: Task[] = [];

        liveTasks.forEach(live => {
            const stored = storedTasksMap[live.commentId];
            if (stored) {
                reconciledTasks.push({
                    ...live,
                    internalStatus: stored.internalStatus || "Pending",
                    timeEstimateMinutes: typeof stored.timeEstimateMinutes === 'number' ? stored.timeEstimateMinutes : live.timeEstimateMinutes,
                    assignee: stored.assignee || live.assignee
                });
            } else {
                reconciledTasks.push(live);
            }
        });

        const fullTasksMap: Record<string, Task> = {};
        reconciledTasks.forEach(t => fullTasksMap[t.commentId] = t);
        await StorageService.saveTasks(fullTasksMap);

        return this.calculateResult(reconciledTasks, currentUserHandle);
    }

    static async getState(currentUserHandle: string | null): Promise<SyncResult> {
        const storedTasksMap = await StorageService.getTasks();
        const storedTasks = Object.values(storedTasksMap);
        return this.calculateResult(storedTasks, currentUserHandle);
    }

    private static calculateResult(tasks: Task[], currentUserHandle: string | null): SyncResult {
        // Sort: Unresolved (Figma) first, then internal status priority (Pending > In Progress > Done), then date
        const sortedTasks = [...tasks].sort((a, b) => {
            if (a.resolved !== b.resolved) return a.resolved ? 1 : -1;

            const statusWeight = { "Pending": 0, "In Progress": 1, "Done": 2 };
            if (statusWeight[a.internalStatus] !== statusWeight[b.internalStatus]) {
                return statusWeight[a.internalStatus] - statusWeight[b.internalStatus];
            }

            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });

        const pages: Record<string, { name: string, frames: Record<string, Task[]> }> = {};
        tasks.forEach(t => {
            const pageId = t.pageId || "global";
            if (!pages[pageId]) pages[pageId] = { name: t.page, frames: {} };
            const frameId = t.frameId || "canvas";
            if (!pages[pageId].frames[frameId]) pages[pageId].frames[frameId] = [];
            pages[pageId].frames[frameId].push(t);
        });

        const metrics: FlowMetrics[] = [];
        let totalUnresolved = 0;
        let personalPending = 0;
        let unresolvedTimeEstimate = 0;
        let doneInternally = 0;

        Object.entries(pages).forEach(([pId, p]) => {
            Object.entries(p.frames).forEach(([fId, fTasks]) => {
                const fUnresolved = fTasks.filter(t => !t.resolved);
                const fPending = fTasks.filter(t => !t.resolved && t.internalStatus !== "Done");
                const fTimeRemaining = fPending.reduce((acc, t) => acc + t.timeEstimateMinutes, 0);

                totalUnresolved += fUnresolved.length;
                personalPending += fPending.filter(t => t.assignee === currentUserHandle).length;
                unresolvedTimeEstimate += fTimeRemaining;
                doneInternally += fTasks.filter(t => t.internalStatus === "Done").length;

                metrics.push({
                    flowId: fId,
                    flowName: `${p.name} / ${fTasks[0].frame}`,
                    totalTasks: fTasks.length,
                    unresolvedTasks: fUnresolved.length,
                    pendingTasks: fPending.length,
                    totalTimeEstimate: fTimeRemaining
                });
            });
        });

        const completionPercentage = totalUnresolved > 0 ? Math.round((doneInternally / totalUnresolved) * 100) : 100;

        return {
            tasks: sortedTasks,
            metrics: metrics.sort((a, b) => b.pendingTasks - a.pendingTasks),
            fileMetrics: {
                totalUnresolved,
                personalPending,
                unresolvedTimeEstimate,
                completionPercentage,
                currentUser: currentUserHandle || undefined
            }
        };
    }

    static getFocusTask(tasks: Task[], currentUserId: string | null): Task | null {
        const actionable = tasks.filter(t => !t.resolved && t.internalStatus !== "Done");
        if (actionable.length === 0) return null;

        return actionable.sort((a, b) => {
            // 1. Assigned to me
            const aMine = a.assignee === currentUserId;
            const bMine = b.assignee === currentUserId;
            if (aMine !== bMine) return aMine ? -1 : 1;

            // 2. Status priority
            if (a.internalStatus === "In Progress" && b.internalStatus !== "In Progress") return -1;
            if (b.internalStatus === "In Progress" && a.internalStatus !== "In Progress") return 1;

            // 3. Oldest first
            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        })[0];
    }
}
