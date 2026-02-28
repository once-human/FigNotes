import { Task } from "./types";

export const STORAGE_KEY = "fignotes_tasks_v3"; // Bumped for Command Center schema

export class StorageService {
    /**
     * Fetches all tasks from client storage.
     * Returns a Record keyed by commentId for O(1) access.
     */
    static async getTasks(): Promise<Record<string, Task>> {
        try {
            const stored = await figma.clientStorage.getAsync(STORAGE_KEY);
            return stored || {};
        } catch (err) {
            console.error("Failed to read from storage", err);
            return {};
        }
    }

    /**
     * Saves the entire task set atomically.
     */
    static async saveTasks(tasks: Record<string, Task>): Promise<void> {
        try {
            await figma.clientStorage.setAsync(STORAGE_KEY, tasks);
        } catch (err) {
            console.error("Failed to save to storage", err);
            throw new Error("Storage write failed");
        }
    }

    /**
     * Updates a single task while maintaining record integrity.
     */
    static async updateTask(task: Task): Promise<void> {
        const tasks = await this.getTasks();
        tasks[task.commentId] = {
            ...task,
            lastUpdatedAt: new Date().toISOString()
        };
        await this.saveTasks(tasks);
    }
}
