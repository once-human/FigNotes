export type Priority = "Low" | "Medium" | "High" | "Critical";
export type InternalStatus = "Critical" | "Needs Review" | "In Progress" | "Blocked" | "Approved" | "Done";

export interface Task {
    commentId: string;
    nodeId: string | null;
    frameId: string | null;
    pageId: string | null;
    author: string;         // Name of the author
    createdAt: string;
    resolved: boolean;      // Figma native status
    internalStatus: InternalStatus;
    timeEstimateMinutes: number;
    assignee: string | null;
    priority: Priority;
    message: string;
    page: string;           // Display name
    frame: string;          // Display name
    lastUpdatedAt: string;
    ageInDays: number;
}

export interface UserBreakdown {
    user: string;
    count: number;
    totalTimeEstimate: number;
}

export interface FlowMetrics {
    flowId: string;
    flowName: string;
    totalTasks: number;
    unresolvedTasks: number;
    totalTimeEstimate: number;
    healthScore: number;    // 0-100 (resolved ratio)
}

export interface SyncResult {
    tasks: Task[];
    metrics: FlowMetrics[];
    fileMetrics: {
        totalTime: number;
        userTime: number;
    };
    weeklySummary: string;
}

export interface PluginMessage {
    type: "sync" | "update-task" | "notify" | "export" | "save-settings" | "get-settings" | "init" | "locate-node" | "focus-mode";
    payload?: any;
}
