export interface ToolContent {
  type: "text";
  text: string;
}

export interface ToolResponse {
  content: ToolContent[];
  [key: string]: any; // Allow additional properties for MCP SDK compatibility
}

export interface GenerateImageArgs {
  prompt: string;
  model?: string;
  size?: string;
  quality?: string;
  style?: string;
  n?: number;
  saveDir?: string;
  fileName?: string;
}

export interface EditImageArgs {
  prompt: string;
  imagePath: string;
  mask?: string;
  model?: string;
  size?: string;
  n?: number;
  saveDir?: string;
  fileName?: string;
}

export interface VariationArgs {
  imagePath: string;
  model?: string;
  size?: string;
  n?: number;
  saveDir?: string;
  fileName?: string;
}

export interface ValidateKeyArgs {}

export type ToolArgs = GenerateImageArgs | EditImageArgs | VariationArgs | ValidateKeyArgs;

export interface Tool<T = any> {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, any>;
    required: string[];
  };
  handler: (args: T) => Promise<ToolResponse>;
}

export interface ListToolsResponse {
  tools: Array<{
    name: string;
    description: string;
    inputSchema: Tool["inputSchema"];
  }>;
}

export interface ImageGenerationResult {
  success: boolean;
  error?: string;
  imagePaths?: string[];
  model?: string;
  prompt?: string;
}
