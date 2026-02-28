export type Priority = "Low" | "Medium" | "High" | "Critical";
export type InternalStatus = "Critical" | "Needs Review" | "In Progress" | "Blocked" | "Approved" | "Done";
export type ShipStatus = "Ready" | "Needs Cleanup" | "High Risk";

export type AICategory = "Copy" | "Layout" | "Alignment" | "Branding" | "Dev Clarification" | "Content Missing" | "Other";

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
    priority: Priority;
    message: string;
    page: string;
    frame: string;
    lastUpdatedAt: string;
    ageInDays: number;
    aiCategory?: AICategory;
    duplicateClusterId?: string;
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
    healthScore: number;
    intensity: number;
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
    aiInsights?: {
        summary: string;
        suggestion: string;
    };
}

export interface PluginMessage {
    type: "sync" | "update-task" | "bulk-update" | "notify" | "export" | "save-settings" | "get-settings" | "init" | "locate-node" | "focus-mode" | "update-ai-insights";
    payload?: any;
}
