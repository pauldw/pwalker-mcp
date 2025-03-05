#!/usr/bin/env tsx

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from 'node:fs';

// Create server instance
const server = new McpServer({
  name: "pwalker-mcp",
  version: "0.0.1",
});

const taskQueue: string[] = [];

// Register tools
server.tool(
  "push-tasks",
  "Push a list of tasks and/or tasks from a taskfile to the task queue. Tasks can be retrieved using the 'pop-task' tool.",
  {
    tasklist: z.array(z.string()).optional().describe("A list of tasks to push to the task queue."),
    taskfile: z.string().optional().describe("Absolute path to a file containing newline-separated tasks to push to the task queue. Use this for long lists of tasks."),
  },
  async (args) => {
    let taskCount = 0;
    if (args.taskfile) {
      const taskfileContent = await fs.promises.readFile(args.taskfile, 'utf-8');
      const tasks = taskfileContent.split("\n").filter(Boolean);
      taskQueue.push(...tasks);
      taskCount += tasks.length;
    } 
    
    if (args.tasklist) {
      taskQueue.push(...args.tasklist);
      taskCount += args.tasklist.length;
    }

    return {
      content: [{
        type: "text",
        text: `Pushed ${taskCount} tasks to the task queue. There are now ${taskQueue.length} tasks in the queue.`
      }]
    };
  }
);

server.tool(
  "pop-task",
  "Pop a task from the task queue. Returns 'No tasks in the queue.' if the queue is empty.",
  {},
  async () => {
    const task = taskQueue.shift();

    if (!task) {
      return {
        content: [{
          type: "text",
          text: "No tasks in the queue."
        }]
      };
    }

    return {
      content: [{
        type: "text",
        text: `${task}`
      }]
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
