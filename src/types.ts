export type InternalStatus = "Pending" | "In Progress" | "Done";

export interface Task {
    commentId: string;
    nodeId: string | null;
    frameId: string | null;
    pageId: string | null;
    author: string;
    createdAt: string;
    resolved: boolean;
    internalStatus: InternalStatus;
    timeEstimateMinutes: number;
    assignee: string | null;
    message: string;
    page: string;
    frame: string;
    lastUpdatedAt: string;
    ageInDays: number;
}

export interface FlowMetrics {
    flowId: string;
    flowName: string;
    totalTasks: number;
    unresolvedTasks: number;
    pendingTasks: number;
    totalTimeEstimate: number;
}

export interface SyncResult {
    tasks: Task[];
    metrics: FlowMetrics[];
    fileMetrics: {
        totalUnresolved: number;
        personalPending: number;
        unresolvedTimeEstimate: number;
        completionPercentage: number;
        currentUser?: string;
    };
}

export interface PluginMessage {
    type: "sync" | "update-task" | "bulk-update" | "notify" | "save-settings" | "get-settings" | "init" | "locate-node" | "focus-mode";
    payload?: any;
}
