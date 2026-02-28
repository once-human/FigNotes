import { Task, ThemeMode } from "./types";

export const STORAGE_KEY = "fignotes_tasks_v7";
export const THEME_KEY = "fignotes_theme";

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

    static async getTheme(): Promise<ThemeMode> {
        try {
            const theme = await figma.clientStorage.getAsync(THEME_KEY);
            return theme || "blue";
        } catch {
            return "blue";
        }
    }

    static async saveTheme(theme: ThemeMode): Promise<void> {
        await figma.clientStorage.setAsync(THEME_KEY, theme);
    }
}
