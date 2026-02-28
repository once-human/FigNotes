import { StorageService } from "./storageService";
import { CommentService } from "./commentService";
import { Task, SyncResult } from "./types";

export class SyncService {
    static async sync(rawComments: any[], currentUserHandle: string | null): Promise<SyncResult> {
        let liveTasks = await CommentService.parseRestComments(rawComments, currentUserHandle);
        const storedTasksMap = await StorageService.getTasks();
        const reconciledTasks: Task[] = [];

        liveTasks.forEach(live => {
            const stored = storedTasksMap[live.commentId];
            if (stored) {
                reconciledTasks.push({
                    ...live,
                    effort: stored.effort || null,
                    isCurrentlyWorking: stored.isCurrentlyWorking || false,
                    assignee: stored.assignee || live.assignee // Allow manual override to persist
                });
            } else {
                reconciledTasks.push(live);
            }
        });

        const fullTasksMap: Record<string, Task> = {};
        reconciledTasks.forEach(t => fullTasksMap[t.commentId] = t);
        await StorageService.saveTasks(fullTasksMap);

        return { tasks: reconciledTasks, currentUser: currentUserHandle || undefined };
    }

    static async getState(currentUserHandle: string | null): Promise<SyncResult> {
        const storedTasksMap = await StorageService.getTasks();
        const storedTasks = Object.values(storedTasksMap);
        return { tasks: storedTasks, currentUser: currentUserHandle || undefined };
    }

    static async setWorking(taskId: string): Promise<void> {
        const tasks = await StorageService.getTasks();
        // Clear previous working task
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
}
