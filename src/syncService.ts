import { Task, FlowMetrics, UserBreakdown, SyncResult, HealthStatus } from "./types";
import { StorageService } from "./storageService";
import { CommentService } from "./commentService";

export class SyncService {
    static async sync(): Promise<SyncResult> {
        const liveTasks = await CommentService.fetchAllComments();
        const storedTasks = await StorageService.getTasks();

        const reconciledTasks: Record<string, Task> = {};
        const now = new Date();
        const nowIso = now.toISOString();

        for (const live of liveTasks) {
            if (!live || !live.commentId) continue;

            const stored = storedTasks[live.commentId];

            const task: Task = stored ? {
                ...stored,
                message: live.message ?? stored.message,
                page: live.page ?? stored.page,
                frame: live.frame ?? stored.frame,
                resolved: live.resolved ?? stored.resolved,
                resolvedBy: live.resolvedBy ?? stored.resolvedBy,
                lastUpdatedAt: nowIso
            } : { ...live };

            const createdDate = new Date(task.createdAt || nowIso);
            const diffTime = Math.max(0, now.getTime() - createdDate.getTime());
            task.ageInDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            task.isAvoidance = !task.resolved && (task.effort === 3) && (task.ageInDays > 5);

            reconciledTasks[task.commentId] = task;
        }

        await StorageService.saveTasks(reconciledTasks);

        const taskList = Object.values(reconciledTasks).sort((a, b) => {
            if (a.resolved !== b.resolved) return a.resolved ? 1 : -1;
            if (a.effort !== b.effort) return b.effort - a.effort;
            if (a.ageInDays !== b.ageInDays) return b.ageInDays - a.ageInDays;
            return a.commentId.localeCompare(b.commentId);
        });

        const metrics = this.calculateMetrics(taskList);
        const weeklySummary = this.generateWeeklySummary(taskList, metrics);
        const allResolvedByUser = this.getGlobalUserBreakdown(taskList);

        return {
            tasks: taskList,
            metrics,
            weeklySummary,
            allResolvedByUser
        };
    }

    private static calculateMetrics(tasks: Task[]): FlowMetrics[] {
        const flowGroups = new Map<string, Task[]>();

        tasks.forEach(task => {
            const pageName = task.page || "Unassigned";
            const group = flowGroups.get(pageName) || [];
            group.push(task);
            flowGroups.set(pageName, group);
        });

        const result: FlowMetrics[] = [];

        flowGroups.forEach((flowTasks, flowName) => {
            const totalTasks = flowTasks.length;
            const resolvedTasks = flowTasks.filter(t => t.resolved).length;
            const totalEffort = flowTasks.reduce((sum, t) => sum + (t.effort || 1), 0);
            const completedEffort = flowTasks.reduce((sum, t) => sum + (t.resolved ? (t.effort || 1) : 0), 0);
            const weightedCompletion = totalEffort > 0 ? (completedEffort / totalEffort) * 100 : 0;

            let health: HealthStatus = "Healthy";
            if (weightedCompletion < 40) health = "Critical";
            else if (weightedCompletion <= 75) health = "At Risk";

            const userStats = new Map<string, number>();
            flowTasks.forEach(t => {
                if (t.resolved && t.resolvedBy) {
                    userStats.set(t.resolvedBy, (userStats.get(t.resolvedBy) || 0) + 1);
                }
            });

            result.push({
                flowName,
                totalTasks,
                resolvedTasks,
                totalEffort,
                completedEffort,
                weightedCompletion,
                health,
                userBreakdown: Array.from(userStats.entries()).map(([user, count]) => ({ user, count }))
            });
        });

        return result.sort((a, b) => a.flowName.localeCompare(b.flowName));
    }

    private static generateWeeklySummary(tasks: Task[], metrics: FlowMetrics[]): string {
        const resolvedCount = tasks.filter(t => t.resolved).length;
        const avgCompletion = metrics.length > 0
            ? metrics.reduce((sum, m) => sum + m.weightedCompletion, 0) / metrics.length
            : 0;
        return `Project Status: ${resolvedCount} tasks resolved. Average completion: ${Math.round(avgCompletion)}%.`;
    }

    private static getGlobalUserBreakdown(tasks: Task[]): UserBreakdown[] {
        const userMap = new Map<string, number>();
        tasks.forEach(t => {
            if (t.resolved && t.resolvedBy) {
                userMap.set(t.resolvedBy, (userMap.get(t.resolvedBy) || 0) + 1);
            }
        });
        return Array.from(userMap.entries())
            .map(([user, count]) => ({ user, count }))
            .sort((a, b) => b.count - a.count);
    }
}
