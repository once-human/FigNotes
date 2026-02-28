export type Priority = "Low" | "Medium" | "High" | "Critical";
export type InternalStatus = "Critical" | "Needs Review" | "In Progress" | "Blocked" | "Approved" | "Done";
export type ShipStatus = "Ready" | "Needs Cleanup" | "High Risk";

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
    criticalTasks: number;
    totalTimeEstimate: number;
    healthScore: number;    // 0-100 (weighted formula)
    intensity: number;      // 0-1 (heatmap density)
}

export interface SyncResult {
    tasks: Task[];
    metrics: FlowMetrics[];
    fileMetrics: {
        totalTime: number;
        userTime: number;
        totalUnresolved: number;
        totalCritical: number;
        oldestUnresolvedAge: number;
        shipReadiness: ShipStatus;
    };
    weeklySummary: string;
}

export interface PluginMessage {
    type: "sync" | "update-task" | "bulk-update" | "notify" | "export" | "save-settings" | "get-settings" | "init" | "locate-node" | "focus-mode";
    payload?: any;
}
