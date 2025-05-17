import path from 'path';
import { DalleService } from '../services/dalle-service.js';
import {
  GenerateImageArgs,
  EditImageArgs,
  ImageToImageArgs,
  MultiImageEditArgs,
  ValidateKeyArgs,
  ToolResponse,
  Tool
} from '../types/index.js';

// Consistent saveDir description
const SAVE_DIR_PATH_DESCRIPTION = "Full system path to save images. **MUST be an absolute path** (e.g., /Users/me/project/images). If the path is not writeable or cannot be created, an error is returned.";

// Initialize service
const dalleService = new DalleService({
  apiKey: process.env.OPENAI_API_KEY || ''
});

export const tools: Tool[] = [
  {
    name: "multi_image_edit",
    description: "Edit multiple images together using GPT-Image-1",
    inputSchema: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: "Text description to guide the generation"
        },
        imagePaths: {
          type: "array",
          description: "Array of paths to the input images",
          items: {
            type: "string"
          }
        },
        size: {
          type: "string",
          description: "Size of the generated image",
          enum: ["1024x1024", "1536x1024", "1024x1536", "auto"]
        },
        quality: {
          type: "string",
          description: "Quality of the generated image",
          enum: ["high", "medium", "low", "auto"]
        },
        background: {
          type: "string",
          description: "Background transparency setting",
          enum: ["transparent", "opaque", "auto"]
        },
        moderation: {
          type: "string",
          description: "Content moderation level",
          enum: ["low", "auto"]
        },
        output_format: {
          type: "string",
          description: "Format of the generated image",
          enum: ["png", "jpeg", "webp"]
        },
        output_compression: {
          type: "number",
          description: "Compression level (0-100%) for webp/jpeg formats",
          minimum: 0,
          maximum: 100
        },
        n: {
          type: "number",
          description: "Number of images to generate (1-10)",
          minimum: 1,
          maximum: 10
        },
        saveDirPath: {
          type: "string",
          description: SAVE_DIR_PATH_DESCRIPTION
        },
        fileName: {
          type: "string",
          description: "Base filename for the generated images (without extension)"
        }
      },
      required: ["prompt", "imagePaths"]
    },
    handler: async (args: MultiImageEditArgs): Promise<ToolResponse> => {
      // Resolve relative paths to absolute paths
      const resolvedImagePaths = args.imagePaths.map(imgPath => 
        path.isAbsolute(imgPath) ? imgPath : path.resolve(process.cwd(), imgPath)
      );

      const result = await dalleService.editMultipleImages(args.prompt, resolvedImagePaths, {
        size: args.size,
        quality: args.quality,
        background: args.background,
        moderation: args.moderation,
        output_format: args.output_format,
        output_compression: args.output_compression,
        n: args.n,
        saveDirPath: args.saveDirPath,
        fileName: args.fileName
      });

      if (!result.success) {
        return {
          content: [{
            type: "text",
            text: `Error editing multiple images: ${result.error}`
          }]
        };
      }

      const imagePaths = result.imagePaths || [];
      const imageCount = imagePaths.length;
      const model = 'gpt-image-1';

      let responseText = `Successfully created ${imageCount} composite image${imageCount !== 1 ? 's' : ''} using ${model}.\n\n`;
      
      responseText += `Input images:\n`;
      resolvedImagePaths.forEach(imagePath => {
        responseText += `- ${imagePath}\n`;
      });
      
      responseText += `\nPrompt: "${result.prompt}"\n\n`;
      
      // Add token usage if available
      if (result.usage) {
        responseText += `Token usage:\n`;
        responseText += `- Total tokens: ${result.usage.total_tokens}\n`;
        responseText += `- Input tokens: ${result.usage.input_tokens}\n`;
        responseText += `- Output tokens: ${result.usage.output_tokens}\n`;
        if (result.usage.input_tokens_details) {
          responseText += `- Text tokens: ${result.usage.input_tokens_details.text_tokens}\n`;
          responseText += `- Image tokens: ${result.usage.input_tokens_details.image_tokens}\n`;
        }
        responseText += `\n`;
      }
      
      responseText += `Generated image${imageCount !== 1 ? 's' : ''} saved to:\n`;
      
      imagePaths.forEach(imagePath => {
        responseText += `- ${imagePath}\n`;
      });

      return {
        content: [{
          type: "text",
          text: responseText
        }]
      };
    }
  },
  {
    name: "image_to_image",
    description: "Generate an image using an existing image as input with GPT-Image-1",
    inputSchema: {
      type: "object",
      properties: {
        imagePath: {
          type: "string",
          description: "Path to the input image"
        },
        prompt: {
          type: "string",
          description: "Text description to guide the generation"
        },
        size: {
          type: "string",
          description: "Size of the generated image",
          enum: ["1024x1024", "1536x1024", "1024x1536", "auto"]
        },
        quality: {
          type: "string",
          description: "Quality of the generated image",
          enum: ["high", "medium", "low", "auto"]
        },
        background: {
          type: "string",
          description: "Background transparency setting",
          enum: ["transparent", "opaque", "auto"]
        },
        moderation: {
          type: "string",
          description: "Content moderation level",
          enum: ["low", "auto"]
        },
        output_format: {
          type: "string",
          description: "Format of the generated image",
          enum: ["png", "jpeg", "webp"]
        },
        output_compression: {
          type: "number",
          description: "Compression level (0-100%) for webp/jpeg formats",
          minimum: 0,
          maximum: 100
        },
        n: {
          type: "number",
          description: "Number of images to generate (1-10)",
          minimum: 1,
          maximum: 10
        },
        saveDirPath: {
          type: "string",
          description: SAVE_DIR_PATH_DESCRIPTION
        },
        fileName: {
          type: "string",
          description: "Base filename for the generated images (without extension)"
        }
      },
      required: ["imagePath", "prompt"]
    },
    handler: async (args: ImageToImageArgs): Promise<ToolResponse> => {
      // Resolve relative path to absolute path
      const imagePath = path.isAbsolute(args.imagePath) 
        ? args.imagePath 
        : path.resolve(process.cwd(), args.imagePath);

      const result = await dalleService.imageToImage(imagePath, args.prompt, {
        size: args.size,
        quality: args.quality,
        background: args.background,
        moderation: args.moderation,
        output_format: args.output_format,
        output_compression: args.output_compression,
        n: args.n,
        saveDirPath: args.saveDirPath,
        fileName: args.fileName
      });

      if (!result.success) {
        return {
          content: [{
            type: "text",
            text: `Error generating image from input image: ${result.error}`
          }]
        };
      }

      const imagePaths = result.imagePaths || [];
      const imageCount = imagePaths.length;
      const model = 'gpt-image-1';

      let responseText = `Successfully generated ${imageCount} image${imageCount !== 1 ? 's' : ''} from input image using ${model}.\n\n`;
      responseText += `Input image: ${imagePath}\n`;
      responseText += `Prompt: "${result.prompt}"\n\n`;
      responseText += `Generated image${imageCount !== 1 ? 's' : ''} saved to:\n`;
      
      imagePaths.forEach(imagePath => {
        responseText += `- ${imagePath}\n`;
      });

      return {
        content: [{
          type: "text",
          text: responseText
        }]
      };
    }
  },
  {
    name: "generate_image",
    description: "Generate an image using GPT-Image-1 based on a text prompt",
    inputSchema: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: "Text description of the desired image (max length 32000 characters)"
        },
        size: {
          type: "string",
          description: "Size of the generated image",
          enum: ["1024x1024", "1536x1024", "1024x1536", "auto"]
        },
        quality: {
          type: "string",
          description: "Quality of the generated image",
          enum: ["high", "medium", "low", "auto"]
        },
        background: {
          type: "string",
          description: "Background transparency setting",
          enum: ["transparent", "opaque", "auto"]
        },
        moderation: {
          type: "string",
          description: "Content moderation level",
          enum: ["low", "auto"]
        },
        output_format: {
          type: "string",
          description: "Format of the generated image",
          enum: ["png", "jpeg", "webp"]
        },
        output_compression: {
          type: "number",
          description: "Compression level (0-100%) for webp/jpeg formats",
          minimum: 0,
          maximum: 100
        },
        n: {
          type: "number",
          description: "Number of images to generate (1-10)",
          minimum: 1,
          maximum: 10
        },
        saveDirPath: {
          type: "string",
          description: SAVE_DIR_PATH_DESCRIPTION
        },
        fileName: {
          type: "string",
          description: "Base filename for the generated images (without extension)"
        }
      },
      required: ["prompt"]
    },
    handler: async (args: GenerateImageArgs): Promise<ToolResponse> => {
      const result = await dalleService.generateImage(args.prompt, {
        size: args.size,
        quality: args.quality,
        background: args.background,
        moderation: args.moderation,
        output_format: args.output_format,
        output_compression: args.output_compression,
        n: args.n,
        saveDirPath: args.saveDirPath,
        fileName: args.fileName
      });

      if (!result.success) {
        return {
          content: [{
            type: "text",
            text: `Error generating image: ${result.error}`
          }]
        };
      }

      const imagePaths = result.imagePaths || [];
      const imageCount = imagePaths.length;
      const model = 'gpt-image-1';

      let responseText = `Successfully generated ${imageCount} image${imageCount !== 1 ? 's' : ''} using ${model}.\n\n`;
      responseText += `Prompt: "${result.prompt}"\n\n`;
      
      // Add token usage if available
      if (result.usage) {
        responseText += `Token usage:\n`;
        responseText += `- Total tokens: ${result.usage.total_tokens}\n`;
        responseText += `- Input tokens: ${result.usage.input_tokens}\n`;
        responseText += `- Output tokens: ${result.usage.output_tokens}\n`;
        if (result.usage.input_tokens_details) {
          responseText += `- Text tokens: ${result.usage.input_tokens_details.text_tokens}\n`;
          responseText += `- Image tokens: ${result.usage.input_tokens_details.image_tokens}\n`;
        }
        responseText += `\n`;
      }
      
      responseText += `Generated image${imageCount !== 1 ? 's' : ''} saved to:\n`;
      
      imagePaths.forEach(imagePath => {
        responseText += `- ${imagePath}\n`;
      });

      return {
        content: [{
          type: "text",
          text: responseText
        }]
      };
    }
  },
  {
    name: "edit_image",
    description: "Edit an existing image using GPT-Image-1 based on a text prompt",
    inputSchema: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: "Text description of the desired edits"
        },
        imagePath: {
          type: "string",
          description: "Path to the image to edit"
        },
        mask: {
          type: "string",
          description: "Optional path to a mask image where the white areas will be edited and black areas will be preserved"
        },
        size: {
          type: "string",
          description: "Size of the generated image",
          enum: ["1024x1024", "1536x1024", "1024x1536", "auto"]
        },
        quality: {
          type: "string",
          description: "Quality of the generated image",
          enum: ["high", "medium", "low", "auto"]
        },
        background: {
          type: "string",
          description: "Background transparency setting",
          enum: ["transparent", "opaque", "auto"]
        },
        moderation: {
          type: "string",
          description: "Content moderation level",
          enum: ["low", "auto"]
        },
        output_format: {
          type: "string",
          description: "Format of the generated image",
          enum: ["png", "jpeg", "webp"]
        },
        output_compression: {
          type: "number",
          description: "Compression level (0-100%) for webp/jpeg formats",
          minimum: 0,
          maximum: 100
        },
        n: {
          type: "number",
          description: "Number of images to generate (1-10)",
          minimum: 1,
          maximum: 10
        },
        saveDirPath: {
          type: "string",
          description: SAVE_DIR_PATH_DESCRIPTION
        },
        fileName: {
          type: "string",
          description: "Base filename for the edited images (without extension)"
        }
      },
      required: ["prompt", "imagePath"]
    },
    handler: async (args: EditImageArgs): Promise<ToolResponse> => {
      // Resolve relative paths to absolute paths
      const imagePath = path.isAbsolute(args.imagePath) 
        ? args.imagePath 
        : path.resolve(process.cwd(), args.imagePath);
      
      const maskPath = args.mask 
        ? path.isAbsolute(args.mask) 
          ? args.mask 
          : path.resolve(process.cwd(), args.mask)
        : undefined;

      const result = await dalleService.editImage(args.prompt, imagePath, {
        mask: maskPath,
        size: args.size,
        quality: args.quality,
        background: args.background,
        moderation: args.moderation,
        output_format: args.output_format,
        output_compression: args.output_compression,
        n: args.n,
        saveDirPath: args.saveDirPath,
        fileName: args.fileName
      });

      if (!result.success) {
        return {
          content: [{
            type: "text",
            text: `Error editing image: ${result.error}`
          }]
        };
      }

      const imagePaths = result.imagePaths || [];
      const imageCount = imagePaths.length;
      const model = 'gpt-image-1';

      let responseText = `Successfully edited ${imageCount} image${imageCount !== 1 ? 's' : ''} using ${model}.\n\n`;
      responseText += `Original image: ${imagePath}\n`;
      if (maskPath) {
        responseText += `Mask image: ${maskPath}\n`;
      }
      responseText += `Prompt: "${result.prompt}"\n\n`;
      
      // Add token usage if available
      if (result.usage) {
        responseText += `Token usage:\n`;
        responseText += `- Total tokens: ${result.usage.total_tokens}\n`;
        responseText += `- Input tokens: ${result.usage.input_tokens}\n`;
        responseText += `- Output tokens: ${result.usage.output_tokens}\n`;
        if (result.usage.input_tokens_details) {
          responseText += `- Text tokens: ${result.usage.input_tokens_details.text_tokens}\n`;
          responseText += `- Image tokens: ${result.usage.input_tokens_details.image_tokens}\n`;
        }
        responseText += `\n`;
      }
      
      responseText += `Edited image${imageCount !== 1 ? 's' : ''} saved to:\n`;
      
      imagePaths.forEach(imagePath => {
        responseText += `- ${imagePath}\n`;
      });

      return {
        content: [{
          type: "text",
          text: responseText
        }]
      };
    }
  },
  {
    name: "validate_api_key",
    description: "Validate the OpenAI API key by making a test request",
    inputSchema: {
      type: "object",
      properties: {},
      required: []
    },
    handler: async (_args: ValidateKeyArgs): Promise<ToolResponse> => {
      const isValid = await dalleService.validateApiKey();

      if (isValid) {
        return {
          content: [{
            type: "text",
            text: "API key is valid."
          }]
        };
      } else {
        return {
          content: [{
            type: "text",
            text: "API key is invalid or there was an error validating it."
          }]
        };
      }
    }
  }
];

// Function to list all available tools
export function listTools() {
  return {
    tools: tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema
    }))
  };
}
