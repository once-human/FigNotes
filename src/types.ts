export interface Task {
    commentId: string;
    nodeId: string | null;
    frameId: string | null;
    pageId: string | null;
    author: string;
    createdAt: string;
    resolved: boolean;
    timeEstimateMinutes: number;
    assignee: string | null;
    message: string;
    page: string;
    frame: string;
}

export interface FlowMetrics {
    flowId: string;
    flowName: string;
    totalTasks: number;
    unresolvedTasks: number;
    totalTimeEstimate: number;
}

export interface SyncResult {
    tasks: Task[];
    metrics: FlowMetrics[];
    fileMetrics: {
        totalUnresolved: number;
        unresolvedTimeEstimate: number;
        completionPercentage: number;
        currentUser?: string;
    };
}

export interface PluginMessage {
    type: "sync" | "update-task" | "bulk-update" | "notify" | "save-settings" | "get-settings" | "init" | "locate-node" | "focus-mode";
    payload?: any;
}
