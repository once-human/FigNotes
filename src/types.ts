export type EffortSize = "Small" | "Medium" | "Large";
export type ThemeMode = "blue" | "pink";

export interface Task {
    commentId: string;
    nodeId: string | null;
    frameId: string | null;
    pageId: string | null;
    author: string;
    createdAt: string;
    resolved: boolean;
    effort: EffortSize | null;
    assignee: string | null;
    message: string;
    page: string;
    frame: string;
    isCurrentlyWorking: boolean;
    mentions: string[];
}

export interface SyncResult {
    tasks: Task[];
    currentUser?: string;
    theme?: ThemeMode;
}

export interface PluginMessage {
    type: "sync" | "update-task" | "notify" | "save-settings" | "get-settings" | "init" | "locate-node" | "resolve-comment" | "set-working" | "set-theme";
    payload?: any;
}
