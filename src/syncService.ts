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
        // Sort: Unresolved first, then by date
        const sortedTasks = [...tasks].sort((a, b) => {
            if (a.resolved !== b.resolved) return a.resolved ? 1 : -1;
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
        let unresolvedTimeEstimate = 0;
        let totalTimeEstimate = 0;

        Object.entries(pages).forEach(([pId, p]) => {
            Object.entries(p.frames).forEach(([fId, fTasks]) => {
                const unresolvedTasks = fTasks.filter(t => !t.resolved);
                const unresolvedCount = unresolvedTasks.length;
                const frameTimeUnresolved = unresolvedTasks.reduce((acc, t) => acc + t.timeEstimateMinutes, 0);
                const frameTimeTotal = fTasks.reduce((acc, t) => acc + t.timeEstimateMinutes, 0);

                totalUnresolved += unresolvedCount;
                unresolvedTimeEstimate += frameTimeUnresolved;
                totalTimeEstimate += frameTimeTotal;

                metrics.push({
                    flowId: fId,
                    flowName: `${p.name} / ${fTasks[0].frame}`,
                    totalTasks: fTasks.length,
                    unresolvedTasks: unresolvedCount,
                    totalTimeEstimate: frameTimeUnresolved
                });
            });
        });

        const totalTasks = tasks.length;
        const completionPercentage = totalTasks > 0 ? Math.round(((totalTasks - totalUnresolved) / totalTasks) * 100) : 100;

        return {
            tasks: sortedTasks,
            metrics: metrics.sort((a, b) => b.unresolvedTasks - a.unresolvedTasks),
            fileMetrics: {
                totalUnresolved,
                unresolvedTimeEstimate,
                completionPercentage,
                currentUser: currentUserHandle || undefined
            }
        };
    }

    static getFocusTask(tasks: Task[], currentUserId: string | null): Task | null {
        const actionable = tasks.filter(t => !t.resolved);
        if (actionable.length === 0) return null;

        return actionable.sort((a, b) => {
            // Priority 1: Assigned to me
            const aMine = a.assignee === currentUserId;
            const bMine = b.assignee === currentUserId;
            if (aMine !== bMine) return aMine ? -1 : 1;

            // Priority 2: Oldest first
            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        })[0];
    }
}
