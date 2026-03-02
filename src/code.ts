import { SyncService } from "./syncService";
import { StorageService } from "./storageService";
import { PluginMessage, Task } from "./types";

figma.showUI(__html__, { width: 480, height: 740, themeColors: true });

async function broadcastState(rawComments?: any[]) {
    try {
        const currentUserHandle = figma.currentUser?.name || "User";
        const result = rawComments
            ? await SyncService.sync(rawComments, currentUserHandle)
            : await SyncService.getState(currentUserHandle);
        figma.ui.postMessage({ type: "sync-complete", payload: result });
    } catch (err: any) {
        figma.ui.postMessage({ type: "sync-error", payload: err.message });
        figma.notify("Sync failure: " + err.message, { error: true });
    }
}

figma.ui.onmessage = async (msg: PluginMessage) => {
    try {
        switch (msg.type) {
            case "sync":
                await broadcastState(msg.payload);
                break;

            case "update-task": {
                if (!msg.payload || !msg.payload.id) throw new Error("Invalid task update payload");
                const { id, key, value } = msg.payload;
                const tasks = await StorageService.getTasks();
                const task = tasks[id];
                if (task) {
                    (task as any)[key] = value;
                    await StorageService.updateTask(task);
                    await broadcastState();
                }
                break;
            }

            case "set-working": {
                if (!msg.payload) {
                    await SyncService.clearWorking();
                } else {
                    await SyncService.setWorking(msg.payload);
                }
                await broadcastState();
                break;
            }

            case "set-theme": {
                if (!msg.payload) return;
                await SyncService.setTheme(msg.payload);
                await broadcastState();
                break;
            }

            case "set-hide-cat": {
                if (msg.payload === undefined) return;
                await SyncService.setHideCat(msg.payload);
                await broadcastState();
                break;
            }

            case "resolve-comment": {
                if (!msg.payload) return;
                const tasks = await StorageService.getTasks();
                if (tasks[msg.payload]) {
                    tasks[msg.payload].resolved = true;
                    tasks[msg.payload].resolvedAt = new Date().toISOString();
                    tasks[msg.payload].isCurrentlyWorking = false;
                    await StorageService.saveTasks(tasks);
                    await broadcastState();
                }
                break;
            }

            case "unresolve-comment": {
                if (!msg.payload) return;
                const tasks = await StorageService.getTasks();
                if (tasks[msg.payload]) {
                    tasks[msg.payload].resolved = false;
                    delete tasks[msg.payload].resolvedAt;
                    await StorageService.saveTasks(tasks);
                    await broadcastState();
                }
                break;
            }

            case "ignore-comment": {
                if (!msg.payload) return;
                const tasks = await StorageService.getTasks();
                if (tasks[msg.payload]) {
                    tasks[msg.payload].ignored = true;
                    tasks[msg.payload].isCurrentlyWorking = false;
                    await StorageService.saveTasks(tasks);
                    await broadcastState();
                }
                break;
            }

            case "unignore-comment": {
                if (!msg.payload) return;
                const tasks = await StorageService.getTasks();
                if (tasks[msg.payload]) {
                    tasks[msg.payload].ignored = false;
                    await StorageService.saveTasks(tasks);
                    await broadcastState();
                }
                break;
            }

            case "save-settings":
                await figma.clientStorage.setAsync("figma_pat", msg.payload.pat);
                await figma.clientStorage.setAsync("figma_file_url", msg.payload.fileUrl);
                figma.notify("Settings saved.");
                break;

            case "get-settings": {
                const pat = await figma.clientStorage.getAsync("figma_pat");
                const url = await figma.clientStorage.getAsync("figma_file_url");
                figma.ui.postMessage({ type: "settings-loaded", payload: { pat, fileUrl: url } });
                break;
            }

            case "locate-node": {
                if (!msg.payload) return;
                const tasks = await StorageService.getTasks();
                const task = tasks[msg.payload];
                if (task) {
                    await navigateToTask(task);
                }
                break;
            }

            case "init":
                const pat = await figma.clientStorage.getAsync("figma_pat");
                const fileUrl = await figma.clientStorage.getAsync("figma_file_url");
                figma.ui.postMessage({ type: "settings-loaded", payload: { pat, fileUrl } });
                break;
        }
    } catch (err: any) {
        console.error("[FigNotes] Plugin error:", err);
        figma.notify(err.message, { error: true });
    }
};

async function navigateToTask(task: Task) {
    try {
        let targetNode: BaseNode | null = null;

        if (task.nodeId) {
            targetNode = await figma.getNodeByIdAsync(task.nodeId);
        }

        if (!targetNode && task.frameId) {
            targetNode = await figma.getNodeByIdAsync(task.frameId);
        }

        if (!targetNode && task.pageId) {
            targetNode = await figma.getNodeByIdAsync(task.pageId);
        }

        if (targetNode) {
            let page = targetNode.parent;
            while (page && page.type !== "PAGE") page = page.parent;
            if (page && figma.currentPage.id !== page.id) {
                await figma.setCurrentPageAsync(page as PageNode);
            } else if (targetNode.type === "PAGE") {
                await figma.setCurrentPageAsync(targetNode as PageNode);
            }

            if (targetNode.type !== "PAGE" && targetNode.type !== "DOCUMENT") {
                // Professional smooth zoom
                figma.viewport.scrollAndZoomIntoView([targetNode as SceneNode]);
                figma.currentPage.selection = [targetNode as SceneNode];
            } else {
                figma.viewport.center = { x: 0, y: 0 };
            }
        } else {
            // Absolute fallback
            figma.viewport.center = { x: figma.viewport.center.x, y: figma.viewport.center.y };
            figma.notify("Focusing canvas...", { timeout: 1000 });
        }
    } catch (err) {
        console.warn("[FigNotes] Navigation fallback failed", err);
    }
}
