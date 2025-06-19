import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import sharp from 'sharp';
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
    description: "Edit an existing image using GPT-Image-1 based on a text prompt. Can accept a mask image path or an array of geometric shapes to define the editable area.",
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
          description: "Optional path to a mask image (PNG format where white areas are edited, black areas preserved). Mutually exclusive with 'mask_shapes'."
        },
        mask_coordinate_system_description: {
          type: "string",
          description: "Optional textual guidance for an LLM on how to generate 'mask_shapes'. Example: 'Provide shapes with normalized coordinates (0.0-1.0 for x and y, origin top-left). Supported shapes: rectangle {x, y, width, height}, circle {cx, cy, radius}, polygon {points: [[x,y],...]}. All coordinates and dimensions are normalized relative to image size.'"
        },
        mask_shapes: {
          type: "array",
          description: "Optional array of shape objects to define the mask. Coordinates and dimensions must be normalized (0.0 to 1.0, origin top-left). Mutually exclusive with 'mask' (image file path).",
          items: {
            type: "object",
            properties: {
              type: {
                type: "string",
                enum: ["rectangle", "circle", "polygon"],
                description: "Type of shape."
              },
              details: {
                type: "object",
                description: "Shape-specific details. For rectangle: {x, y, width, height}. For circle: {cx, cy, radius}. For polygon: {points: [[x1,y1], [x2,y2], ...]}.",
                // Additional properties for specific shapes can be validated if needed,
                // but for flexibility, keeping it as a generic object.
              }
            },
            required: ["type", "details"]
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
          description: "Base filename for the edited images (without extension)"
        }
      },
      required: ["prompt", "imagePath"]
    },
    handler: async (args: EditImageArgs & { mask_shapes?: any[], mask_coordinate_system_description?: string }): Promise<ToolResponse> => {
      // Resolve relative paths to absolute paths
      const imagePathAbs = path.isAbsolute(args.imagePath)
        ? args.imagePath
        : path.resolve(process.cwd(), args.imagePath);

      let maskPathToUse: string | undefined = undefined;
      let tempMaskPath: string | undefined = undefined;

      if (args.mask && args.mask_shapes && args.mask_shapes.length > 0) {
        return {
          content: [{
            type: "text",
            text: "Error: 'mask' (image path) and 'mask_shapes' (geometric shapes) are mutually exclusive. Provide one or the other, not both."
          }]
        };
      }

      try {
        if (args.mask_shapes && args.mask_shapes.length > 0) {
          const imageMetadata = await sharp(imagePathAbs).metadata();
          if (!imageMetadata.width || !imageMetadata.height) {
            throw new Error('Could not read image dimensions.');
          }
          const { width: imgWidth, height: imgHeight } = imageMetadata;

          const shapesSvg = args.mask_shapes.map(shape => {
            if (!shape.details) return '';
            switch (shape.type) {
              case 'rectangle':
                if (typeof shape.details.x !== 'number' || typeof shape.details.y !== 'number' || typeof shape.details.width !== 'number' || typeof shape.details.height !== 'number') {
                  console.warn('Skipping invalid rectangle shape:', shape); return '';
                }
                return `<rect x="${shape.details.x * imgWidth}" y="${shape.details.y * imgHeight}" width="${shape.details.width * imgWidth}" height="${shape.details.height * imgHeight}" fill="white" />`;
              case 'circle':
                 if (typeof shape.details.cx !== 'number' || typeof shape.details.cy !== 'number' || typeof shape.details.radius !== 'number') {
                  console.warn('Skipping invalid circle shape:', shape); return '';
                }
                const radius = shape.details.radius * Math.min(imgWidth, imgHeight);
                return `<circle cx="${shape.details.cx * imgWidth}" cy="${shape.details.cy * imgHeight}" r="${radius}" fill="white" />`;
              case 'polygon':
                if (!Array.isArray(shape.details.points) || shape.details.points.some((p: any) => !Array.isArray(p) || p.length !== 2 || typeof p[0] !== 'number' || typeof p[1] !== 'number')) {
                   console.warn('Skipping invalid polygon shape:', shape); return '';
                }
                const pointsStr = shape.details.points.map((p: [number, number]) => `${p[0] * imgWidth},${p[1] * imgHeight}`).join(' ');
                return `<polygon points="${pointsStr}" fill="white" />`;
              default:
                console.warn(`Unsupported shape type: ${shape.type}`);
                return '';
            }
          }).join('');

          const svgBuffer = Buffer.from(`<svg width="${imgWidth}" height="${imgHeight}"><rect width="100%" height="100%" fill="black"/>${shapesSvg}</svg>`);
          
          tempMaskPath = path.join(os.tmpdir(), `mask-${Date.now()}.png`);
          await sharp(svgBuffer).png().toFile(tempMaskPath);
          maskPathToUse = tempMaskPath;

        } else if (args.mask) {
          maskPathToUse = path.isAbsolute(args.mask)
            ? args.mask
            : path.resolve(process.cwd(), args.mask);
        }
      
        const result = await dalleService.editImage(args.prompt, imagePathAbs, {
          mask: maskPathToUse,
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
        responseText += `Original image: ${imagePathAbs}\n`;
        if (maskPathToUse) {
          if (tempMaskPath) {
            responseText += `Mask generated from shapes.\n`;
          } else {
            responseText += `Mask image: ${maskPathToUse}\n`;
          }
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
      } finally {
        if (tempMaskPath) {
          try {
            await fs.unlink(tempMaskPath);
          } catch (unlinkError) {
            console.error(`Error deleting temporary mask file ${tempMaskPath}:`, unlinkError);
          }
        }
      }
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
