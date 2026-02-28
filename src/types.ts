export type Effort = 1 | 2 | 3;
export type DiscussionStatus = "pending" | "discussion" | "blocked";
export type HealthStatus = "Healthy" | "At Risk" | "Critical";

export interface Task {
    commentId: string;
    message: string;
    page: string;
    frame: string;
    resolved: boolean;
    resolvedBy: string | null;
    effort: Effort;
    discussionStatus: DiscussionStatus;
    createdAt: string;
    lastUpdatedAt: string;

    // Enhanced Fields
    ageInDays: number;
    isAvoidance: boolean;
}

export interface UserBreakdown {
    user: string;
    count: number;
}

export interface FlowMetrics {
    flowName: string;
    totalTasks: number;
    resolvedTasks: number;
    totalEffort: number;
    completedEffort: number;
    weightedCompletion: number;
    health: HealthStatus;
    userBreakdown: UserBreakdown[];
}

export interface SyncResult {
    tasks: Task[];
    metrics: FlowMetrics[];
    weeklySummary: string;
    allResolvedByUser: UserBreakdown[];
}

export interface PluginMessage {
    type: "sync" | "update-task" | "notify" | "export";
    payload?: any;
}
