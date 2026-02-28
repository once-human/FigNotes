import { StorageService } from "./storageService";
import { CommentService } from "./commentService";
import { Task, SyncResult, FlowMetrics, InternalStatus, Priority, ShipStatus } from "./types";

export class SyncService {
    static async sync(rawComments?: any[], aiInsights?: any): Promise<SyncResult> {
        let liveTasks: Task[] = [];

        if (rawComments && Array.isArray(rawComments)) {
            liveTasks = await CommentService.parseRestComments(rawComments);
        }

        const storedTasksMap = await StorageService.getTasks();
        const reconciledTasks: Task[] = [];

        liveTasks.forEach(live => {
            const stored = storedTasksMap[live.commentId];
            if (stored) {
                reconciledTasks.push({
                    ...live,
                    internalStatus: stored.internalStatus || live.internalStatus,
                    timeEstimateMinutes: typeof stored.timeEstimateMinutes === 'number' ? stored.timeEstimateMinutes : live.timeEstimateMinutes,
                    assignee: stored.assignee || null,
                    priority: stored.priority || live.priority,
                    lastUpdatedAt: new Date().toISOString()
                });
            } else {
                reconciledTasks.push(live);
            }
        });

        const fullTasksMap: Record<string, Task> = {};
        reconciledTasks.forEach(t => fullTasksMap[t.commentId] = t);
        await StorageService.saveTasks(fullTasksMap);

        return this.calculateResult(reconciledTasks, aiInsights);
    }

    static async getState(aiInsights?: any): Promise<SyncResult> {
        const storedTasksMap = await StorageService.getTasks();
        const storedTasks = Object.values(storedTasksMap);
        return this.calculateResult(storedTasks, aiInsights);
    }

    private static calculateResult(tasks: Task[], aiInsights?: any): SyncResult {
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
        let totalUnresolved = 0;
        let totalCritical = 0;
        let oldestAge = 0;

        Object.entries(pages).forEach(([pId, p]) => {
            Object.entries(p.frames).forEach(([fId, fTasks]) => {
                const total = fTasks.length;
                const unresolvedTasks = fTasks.filter(t => t.internalStatus !== "Done");
                const unresolvedCount = unresolvedTasks.length;
                const resolvedCount = total - unresolvedCount;
                const criticalCount = fTasks.filter(t => t.priority === "Critical" && t.internalStatus !== "Done").length;
                const time = fTasks.reduce((acc, t) => acc + t.timeEstimateMinutes, 0);

                totalFileTime += unresolvedTasks.reduce((acc, t) => acc + t.timeEstimateMinutes, 0);
                totalUnresolved += unresolvedCount;
                totalCritical += criticalCount;

                fTasks.forEach(t => {
                    if (t.internalStatus !== "Done") {
                        const age = this.calculateAge(t.createdAt);
                        if (age > oldestAge) oldestAge = age;
                    }
                });

                // --- ADVANCED HEALTH SCORE FORMULA ---
                // Base: 0-100
                const baseHealth = total > 0 ? (resolvedCount / total) * 100 : 100;

                // Penalties
                let penalty = 0;
                unresolvedTasks.forEach(t => {
                    const age = this.calculateAge(t.createdAt);
                    if (t.priority === "Critical") penalty += 15;
                    if (age > 7) penalty += 10;
                    if (t.timeEstimateMinutes > 60) penalty += 5;
                });

                const healthScore = Math.max(0, Math.round(baseHealth - penalty));
                const intensity = total > 0 ? unresolvedCount / total : 0;

                metrics.push({
                    flowId: fId,
                    flowName: `${p.name} / ${fTasks[0].frame}`,
                    totalTasks: total,
                    unresolvedTasks: unresolvedCount,
                    criticalTasks: criticalCount,
                    totalTimeEstimate: time,
                    healthScore,
                    intensity
                });
            });
        });

        // SHIP READINESS LOGIC
        let shipReadiness: ShipStatus = "Ready";
        if (totalCritical > 0 || oldestAge > 14 || totalUnresolved > 20) {
            shipReadiness = "High Risk";
        } else if (totalUnresolved > 0) {
            shipReadiness = "Needs Cleanup";
        }

        return {
            tasks: sortedTasks,
            metrics: metrics.sort((a, b) => a.healthScore - b.healthScore), // Worst health first
            fileMetrics: {
                totalTime: totalFileTime,
                userTime: 0, // Placeholder
                totalUnresolved,
                totalCritical,
                oldestUnresolvedAge: oldestAge,
                shipReadiness
            },
            weeklySummary: `Ship Status: ${shipReadiness}. ${totalUnresolved} tasks remaining.`,
            aiInsights
        };
    }

    private static calculateAge(createdAt: string): number {
        const created = new Date(createdAt).getTime();
        const now = new Date().getTime();
        return Math.floor((now - created) / (1000 * 60 * 60 * 24));
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
