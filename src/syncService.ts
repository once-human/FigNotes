import { Task, FlowMetrics, UserBreakdown, SyncResult, HealthStatus } from "./types";
import { StorageService } from "./storageService";
import { CommentService } from "./commentService";

export class SyncService {
    /**
     * Deterministic sync engine with enhanced metrics:
     * - Aging calculation
     * - Avoidance detection
     * - Flow health status
     * - Resolution analytics
     * - Smart sorting
     */
    static async sync(): Promise<SyncResult> {
        const liveTasks = await CommentService.fetchAllComments();
        const storedTasks = await StorageService.getTasks();

        const reconciledTasks: Record<string, Task> = {};
        const now = new Date();
        const nowIso = now.toISOString();

        for (const live of liveTasks) {
            const stored = storedTasks[live.commentId];

            let task: Task;
            if (stored) {
                task = {
                    ...stored,
                    message: live.message,
                    page: live.page,
                    frame: live.frame,
                    resolved: live.resolved,
                    resolvedBy: live.resolvedBy || stored.resolvedBy,
                    lastUpdatedAt: nowIso
                };
            } else {
                task = live;
            }

            // Calculate Aging
            const createdDate = new Date(task.createdAt);
            const diffTime = Math.abs(now.getTime() - createdDate.getTime());
            task.ageInDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

            // Avoidance Detection: Large effort + >5 days unresolved
            task.isAvoidance = !task.resolved && task.effort === 3 && task.ageInDays > 5;

            reconciledTasks[task.commentId] = task;
        }

        await StorageService.saveTasks(reconciledTasks);

        let taskList = Object.values(reconciledTasks);

        // Smart Sorting: Unresolved first -> High effort first -> Oldest first
        taskList.sort((a, b) => {
            if (a.resolved !== b.resolved) return a.resolved ? 1 : -1;
            if (a.effort !== b.effort) return b.effort - a.effort;
            return b.ageInDays - a.ageInDays;
        });

        const metrics = this.calculateMetrics(taskList);
        const weeklySummary = this.generateWeeklySummary(taskList, metrics);
        const allResolvedByUser = this.getGlobalUserBreakdown(taskList);

        return { tasks: taskList, metrics, weeklySummary, allResolvedByUser };
    }

    private static calculateMetrics(tasks: Task[]): FlowMetrics[] {
        const flowGroups = new Map<string, Task[]>();

        tasks.forEach(task => {
            const group = flowGroups.get(task.page) || [];
            group.push(task);
            flowGroups.set(task.page, group);
        });

        const result: FlowMetrics[] = [];

        flowGroups.forEach((flowTasks, flowName) => {
            const totalTasks = flowTasks.length;
            const resolvedTasks = flowTasks.filter(t => t.resolved).length;

            const totalEffort = flowTasks.reduce((sum, t) => sum + t.effort, 0);
            const completedEffort = flowTasks.reduce((sum, t) => sum + (t.resolved ? t.effort : 0), 0);

            const weightedCompletion = totalEffort > 0 ? (completedEffort / totalEffort) * 100 : 0;

            // Health Status
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
        const resolvedThisWeek = tasks.filter(t => t.resolved).length; // Simplified logic, for prod would check resolution date
        const flowCount = metrics.length;
        const totalWeighted = metrics.length > 0
            ? metrics.reduce((sum, m) => sum + m.weightedCompletion, 0) / metrics.length
            : 0;

        return `This week ${resolvedThisWeek} tasks were resolved across ${flowCount} flows. ${Math.round(totalWeighted)}% weighted completion achieved.`;
    }

    private static getGlobalUserBreakdown(tasks: Task[]): UserBreakdown[] {
        const userMap = new Map<string, number>();
        tasks.forEach(t => {
            if (t.resolved && t.resolvedBy) {
                userMap.set(t.resolvedBy, (userMap.get(t.resolvedBy) || 0) + 1);
            }
        });

        return Array.from(userMap.entries()).map(([user, count]) => ({ user, count }));
    }
}
