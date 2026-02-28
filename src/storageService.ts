import { Task } from "./types";

export const STORAGE_KEY = "fignotes_tasks_v5";

export class StorageService {
    static async getTasks(): Promise<Record<string, Task>> {
        try {
            const stored = await figma.clientStorage.getAsync(STORAGE_KEY);
            return stored || {};
        } catch (err) {
            console.error("Failed to read from storage", err);
            return {};
        }
    }

    static async saveTasks(tasks: Record<string, Task>): Promise<void> {
        try {
            await figma.clientStorage.setAsync(STORAGE_KEY, tasks);
        } catch (err) {
            console.error("Failed to save to storage", err);
            throw new Error("Storage write failed");
        }
    }

    static async updateTask(task: Task): Promise<void> {
        const tasks = await this.getTasks();
        tasks[task.commentId] = task;
        await this.saveTasks(tasks);
    }
}
