# Paul Walker's Bespoke MCP Tools

A shifting selection of one-off MCP tools that pwalker is playing with.

Currently contains:

- push-task, which takes a task list and/or file containing newline-separate tasks and adds them to the queue
- pop-task, which pops one task from the queue or indicates the queue is empty

## Goose Installation

Use this extension installation link:

<goose://extension?cmd=npx&arg=-y&arg=github:pauldw/pwalker-mcp&id=pwalker-mcp&name=pwalker-mcp&description=Paul%20Walker%27s%20Bespoke%20MCP%20Tools>

Or add to goose in Settings -> Extensions -> Add with this information:

- Type: Standard IO
- Command: `npx -y github:pauldw/pwalker-mcp"
- ID, Name, and Description: Anything you want.

## Local Development

To run the MCP server from a local copy, use this MCP command instead:

`npm --prefix /path/to/local/copy run start`
