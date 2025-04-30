#!/usr/bin/env node

import dotenv from 'dotenv';
dotenv.config();

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { tools, listTools } from "./tools/index.js";
import { Tool, ToolResponse, GenerateImageArgs, EditImageArgs, VariationArgs, ImageToImageArgs, MultiImageEditArgs, ValidateKeyArgs } from "./types/index.js";

// Initialize MCP server
const server = new Server(
  {
    name: "gpt-image-generator",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {
        generate_image: true,
        edit_image: true,
        create_variation: true,
        image_to_image: true,
        multi_image_edit: true,
        validate_api_key: true
      },
    },
  }
);

/**
 * Handler that lists available tools
 */
server.setRequestHandler(ListToolsRequestSchema, async () => listTools());

/**
 * Handler for tool calls
 */
server.setRequestHandler(CallToolRequestSchema, async (request, _extra) => {
  try {
    const tool = tools.find(t => t.name === request.params.name);
    if (!tool) {
      return {
        content: [{
          type: "text" as const,
          text: `Unknown tool: ${request.params.name}`
        }]
      } as ToolResponse;
    }

    // Only validate arguments if the tool requires them
    if (tool.inputSchema.required && tool.inputSchema.required.length > 0) {
      const args = request.params.arguments || {};
      const missingArgs = tool.inputSchema.required.filter(
        arg => !(arg in args)
      );
      if (missingArgs.length > 0) {
        return {
          content: [{
            type: "text" as const,
            text: `Missing required arguments: ${missingArgs.join(', ')}`
          }]
        } as ToolResponse;
      }
    }

    // Execute tool with appropriate argument type based on tool name
    let response: ToolResponse;
    const args = request.params.arguments || {};
    
    switch (tool.name) {
      case 'generate_image':
        response = await (tool as Tool<GenerateImageArgs>).handler(args as unknown as GenerateImageArgs);
        break;
      case 'edit_image':
        response = await (tool as Tool<EditImageArgs>).handler(args as unknown as EditImageArgs);
        break;
      case 'create_variation':
        response = await (tool as Tool<VariationArgs>).handler(args as unknown as VariationArgs);
        break;
      case 'image_to_image':
        response = await (tool as Tool<ImageToImageArgs>).handler(args as unknown as ImageToImageArgs);
        break;
      case 'multi_image_edit':
        response = await (tool as Tool<MultiImageEditArgs>).handler(args as unknown as MultiImageEditArgs);
        break;
      case 'validate_api_key':
        response = await (tool as Tool<ValidateKeyArgs>).handler({});
        break;
      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${tool.name}`);
    }

    // Add metadata if provided
    if (request.params._meta) {
      return {
        ...response,
        _meta: request.params._meta
      };
    }

    return response;

  } catch (error) {
    console.error('Tool execution error:', error);
    return {
      content: [{
        type: "text" as const,
        text: error instanceof Error ? error.message : 'An unexpected error occurred'
      }]
    } as ToolResponse;
  }
}) as any; // Type assertion for MCP SDK compatibility

/**
 * Start the server
 */
async function main() {
  // Validate API key
  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY environment variable is required. See README.md for setup instructions.');
    process.exit(1);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('GPT-Image MCP server running on stdio');
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
