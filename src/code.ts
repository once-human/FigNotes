import { SyncService } from "./syncService";
import { StorageService } from "./storageService";
import { PluginMessage, Task } from "./types";

figma.showUI(__html__, { width: 440, height: 740, themeColors: true });

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
                    task.lastUpdatedAt = new Date().toISOString();
                    await StorageService.updateTask(task);
                    await broadcastState();
                }
                break;
            }

            case "bulk-update": {
                if (!msg.payload || !msg.payload.ids) throw new Error("Invalid bulk update payload");
                const { ids, updates } = msg.payload;
                const allTasks = await StorageService.getTasks();
                const now = new Date().toISOString();
                for (const taskId of ids) {
                    if (allTasks[taskId]) {
                        Object.assign(allTasks[taskId], updates);
                        allTasks[taskId].lastUpdatedAt = now;
                    }
                }
                await StorageService.saveTasks(allTasks);
                await broadcastState();
                break;
            }

            case "focus-mode": {
                const currentUserHandle = figma.currentUser?.name || "User";
                const state = await SyncService.getState(currentUserHandle);
                const focusTask = SyncService.getFocusTask(state.tasks, currentUserHandle);
                if (focusTask) {
                    figma.ui.postMessage({ type: "focus-task-found", payload: focusTask });
                    // Trigger navigation immediately
                    await navigateToTask(focusTask);
                } else {
                    figma.notify("No pending tasks found.");
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
                } else {
                    // Fallback if task metadata not found but we have an ID
                    const node = await figma.getNodeByIdAsync(msg.payload.replace('-', ':'));
                    if (node) {
                        figma.viewport.scrollAndZoomIntoView([node]);
                        figma.currentPage.selection = [node as SceneNode];
                    }
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
        // Fallback Chain: Node -> Frame -> Page
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
            // Ensure we are on the right page
            let page = targetNode.parent;
            while (page && page.type !== "PAGE") page = page.parent;
            if (page) await figma.setCurrentPageAsync(page as PageNode);

            figma.viewport.scrollAndZoomIntoView([targetNode as SceneNode]);

            if (targetNode.type !== "PAGE" && targetNode.type !== "DOCUMENT") {
                figma.currentPage.selection = [targetNode as SceneNode];
            }
        } else {
            figma.notify("Could not locate node, frame, or page on canvas.", { timeout: 2000 });
        }
    } catch (err) {
        console.warn("[FigNotes] Navigation fallback failed", err);
    }
}
