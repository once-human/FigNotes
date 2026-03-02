import { StorageService } from "./storageService";
import { CommentService } from "./commentService";
import { Task, SyncResult, ThemeMode } from "./types";

export class SyncService {
    static async sync(rawComments: any[], currentUserHandle: string | null): Promise<SyncResult> {
        let liveTasks = await CommentService.parseRestComments(rawComments, currentUserHandle);
        const storedTasksMap = await StorageService.getTasks();
        const theme = await StorageService.getTheme();
        const hideCat = await StorageService.getHideCat();
        const reconciledTasks: Task[] = [];

        liveTasks.forEach(live => {
            const stored = storedTasksMap[live.commentId];
            if (stored) {
                reconciledTasks.push({
                    ...live,
                    resolved: stored.resolved ?? live.resolved,
                    effort: stored.effort || null,
                    ignored: stored.ignored || false,
                    isCurrentlyWorking: stored.isCurrentlyWorking || false,
                    assignee: stored.assignee || live.assignee
                });
            } else {
                reconciledTasks.push(live);
            }
        });

        const fullTasksMap: Record<string, Task> = {};
        reconciledTasks.forEach(t => fullTasksMap[t.commentId] = t);
        await StorageService.saveTasks(fullTasksMap);

        return {
            tasks: reconciledTasks,
            currentUser: currentUserHandle || undefined,
            theme: theme,
            hideCat: hideCat
        };
    }

    static async getState(currentUserHandle: string | null): Promise<SyncResult> {
        const storedTasksMap = await StorageService.getTasks();
        const storedTasks = Object.values(storedTasksMap);
        const theme = await StorageService.getTheme();
        const hideCat = await StorageService.getHideCat();
        return {
            tasks: storedTasks,
            currentUser: currentUserHandle || undefined,
            theme: theme,
            hideCat: hideCat
        };
    }

    static async setHideCat(hidden: boolean): Promise<void> {
        await StorageService.saveHideCat(hidden);
    }

    static async setWorking(taskId: string): Promise<void> {
        const tasks = await StorageService.getTasks();
        // Exclusive pin logic: only one task active at a time
        Object.values(tasks).forEach(t => t.isCurrentlyWorking = false);

        if (tasks[taskId]) {
            tasks[taskId].isCurrentlyWorking = true;
            await StorageService.saveTasks(tasks);
        }
    }

    static async clearWorking(): Promise<void> {
        const tasks = await StorageService.getTasks();
        Object.values(tasks).forEach(t => t.isCurrentlyWorking = false);
        await StorageService.saveTasks(tasks);
    }

    static async setTheme(theme: ThemeMode): Promise<void> {
        await StorageService.saveTheme(theme);
    }
}
