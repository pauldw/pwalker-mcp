#!/usr/bin/env tsx

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { exec } from "child_process";

// Create server instance
const server = new McpServer({
  name: "goose-mcp",
  version: "0.0.2",
});

const taskQueue: string[] = [];

const runShellCommand = async (command: string[]): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    exec(command.join(" "), { 
      encoding: 'buffer',
      maxBuffer: 1024 * 1024 * 10 // 10MB buffer size
    }, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve(stdout);
      }
    });
  });
};

// Register tools
server.tool(
  "push-tasks",
  "Push a list of items to the task queue. Can be retrieved using the 'pop-task' tool.",
  {
    tasks: z.array(z.string()).describe("A list of tasks to push to the task queue. Can be retrieved using the 'pop-task' tool."),
  },
  async (args) => {
    taskQueue.push(...args.tasks);

    return {
      content: [{
        type: "text",
        text: `Pushed ${args.tasks.length} tasks to the task queue.`
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
        text: `Task popped: ${task}`
      }]
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Goose MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
