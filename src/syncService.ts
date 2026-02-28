import { StorageService } from "./storageService";
import { CommentService } from "./commentService";
import { Task, SyncResult, FlowMetrics, InternalStatus, Priority } from "./types";

export class SyncService {
    static async sync(rawComments?: any[]): Promise<SyncResult> {
        let liveTasks: Task[] = [];

        if (rawComments && Array.isArray(rawComments)) {
            liveTasks = await CommentService.parseRestComments(rawComments);
        } else {
            console.warn("[FigNotes] No payload received for sync.");
        }

        const storedTasksMap = await StorageService.getTasks();
        const reconciledTasks: Task[] = [];

        // Reconciliation logic
        liveTasks.forEach(live => {
            const stored = storedTasksMap[live.commentId];
            if (stored) {
                // Merge Figma-native with plugin-managed
                reconciledTasks.push({
                    ...live,
                    internalStatus: stored.internalStatus,
                    timeEstimateMinutes: stored.timeEstimateMinutes,
                    assignee: stored.assignee,
                    priority: stored.priority,
                    lastUpdatedAt: new Date().toISOString()
                });
            } else {
                reconciledTasks.push(live);
            }
        });

        const fullTasksMap: Record<string, Task> = {};
        reconciledTasks.forEach(t => fullTasksMap[t.commentId] = t);
        await StorageService.saveTasks(fullTasksMap);

        return this.calculateResult(reconciledTasks);
    }

    static async getState(): Promise<SyncResult> {
        const storedTasksMap = await StorageService.getTasks();
        const storedTasks = Object.values(storedTasksMap);
        return this.calculateResult(storedTasks);
    }

    private static calculateResult(tasks: Task[]): SyncResult {
        // Sort: Priority (Critical first) > Status (Done last) > Age
        const sortedTasks = [...tasks].sort((a, b) => {
            const priorityWeight = { "Critical": 0, "High": 1, "Medium": 2, "Low": 3 };
            const statusWeight = { "Critical": 0, "Blocked": 1, "In Progress": 2, "Needs Review": 3, "Approved": 4, "Done": 5 };

            if (priorityWeight[a.priority] !== priorityWeight[b.priority]) {
                return (priorityWeight[a.priority] as number) - (priorityWeight[b.priority] as number);
            }
            if (statusWeight[a.internalStatus] !== statusWeight[b.internalStatus]) {
                return (statusWeight[a.internalStatus] as number) - (statusWeight[b.internalStatus] as number);
            }
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });

        // Group by Page/Frame for metrics
        const pages: Record<string, { name: string, frames: Record<string, Task[]> }> = {};
        tasks.forEach(t => {
            const pageId = t.pageId || "global";
            if (!pages[pageId]) pages[pageId] = { name: t.page, frames: {} };

            const frameId = t.frameId || "canvas";
            if (!pages[pageId].frames[frameId]) pages[pageId].frames[frameId] = [];
            pages[pageId].frames[frameId].push(t);
        });

        const metrics: FlowMetrics[] = [];
        let totalFileTime = 0;
        let currentUserTime = 0;
        const currentUserId = null; // We'll need to pass this or handle it in UI

        Object.entries(pages).forEach(([pId, p]) => {
            Object.entries(p.frames).forEach(([fId, fTasks]) => {
                const total = fTasks.length;
                const unresolved = fTasks.filter(t => t.internalStatus !== "Done").length;
                const time = fTasks.reduce((acc, t) => acc + t.timeEstimateMinutes, 0);

                totalFileTime += time;

                metrics.push({
                    flowId: fId,
                    flowName: `${p.name} / ${fTasks[0].frame}`,
                    totalTasks: total,
                    unresolvedTasks: unresolved,
                    totalTimeEstimate: time,
                    healthScore: total > 0 ? Math.round(((total - unresolved) / total) * 100) : 100
                });
            });
        });

        return {
            tasks: sortedTasks,
            metrics,
            fileMetrics: {
                totalTime: totalFileTime,
                userTime: currentUserTime
            },
            weeklySummary: `Total ${totalFileTime}min of work remaining.`
        };
    }

    static getFocusTask(tasks: Task[], currentUserId: string | null): Task | null {
        const actionable = tasks.filter(t => t.internalStatus !== "Done" && !t.resolved);
        if (actionable.length === 0) return null;

        return actionable.sort((a, b) => {
            const aMine = a.assignee === currentUserId;
            const bMine = b.assignee === currentUserId;
            if (aMine !== bMine) return aMine ? -1 : 1;

            if (a.priority === "Critical" && b.priority !== "Critical") return -1;
            if (b.priority === "Critical" && a.priority !== "Critical") return 1;

            const aTime = new Date(a.createdAt).getTime();
            const bTime = new Date(b.createdAt).getTime();
            if (aTime !== bTime) return aTime - bTime;

            return b.timeEstimateMinutes - a.timeEstimateMinutes;
        })[0];
    }
}
