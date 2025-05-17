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
  size?: string;
  quality?: string;
  background?: string;
  moderation?: string;
  output_format?: string;
  output_compression?: number;
  n?: number;
  saveDirPath?: string;
  fileName?: string;
}

export interface EditImageArgs {
  prompt: string;
  imagePath: string;
  mask?: string;
  size?: string;
  quality?: string;
  background?: string;
  moderation?: string;
  output_format?: string;
  output_compression?: number;
  n?: number;
  saveDirPath?: string;
  fileName?: string;
}

export interface ImageToImageArgs {
  imagePath: string;
  prompt: string;
  size?: string;
  quality?: string;
  background?: string;
  moderation?: string;
  output_format?: string;
  output_compression?: number;
  n?: number;
  saveDirPath?: string;
  fileName?: string;
}

export interface ValidateKeyArgs {}

export type ToolArgs = GenerateImageArgs | EditImageArgs | ImageToImageArgs | ValidateKeyArgs;

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

export interface TokenUsageDetails {
  text_tokens?: number;
  image_tokens?: number;
}

export interface TokenUsage {
  total_tokens?: number;
  input_tokens?: number;
  output_tokens?: number;
  input_tokens_details?: TokenUsageDetails;
}

export interface ImageGenerationResult {
  success: boolean;
  error?: string;
  imagePaths?: string[];
  model?: string;
  prompt?: string;
  usage?: TokenUsage;
}

export interface MultiImageEditArgs {
  prompt: string;
  imagePaths: string[];
  size?: string;
  quality?: string;
  background?: string;
  moderation?: string;
  output_format?: string;
  output_compression?: number;
  n?: number;
  saveDirPath?: string;
  fileName?: string;
}
