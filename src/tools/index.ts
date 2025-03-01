import { DalleService } from '../services/dalle-service.js';
import { 
  GenerateImageArgs, 
  EditImageArgs, 
  VariationArgs, 
  ValidateKeyArgs, 
  ToolResponse 
} from '../types/index.js';
import path from 'path';

// Initialize service
const dalleService = new DalleService({
  apiKey: process.env.OPENAI_API_KEY || ''
});

export const tools = [
  {
    name: "generate_image",
    description: "Generate an image using DALL-E based on a text prompt",
    inputSchema: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: "Text description of the desired image"
        },
        model: {
          type: "string",
          description: "DALL-E model to use (dall-e-2 or dall-e-3)",
          enum: ["dall-e-2", "dall-e-3"]
        },
        size: {
          type: "string",
          description: "Size of the generated image",
          enum: ["256x256", "512x512", "1024x1024", "1792x1024", "1024x1792"]
        },
        quality: {
          type: "string",
          description: "Quality of the generated image (dall-e-3 only)",
          enum: ["standard", "hd"]
        },
        style: {
          type: "string",
          description: "Style of the generated image (dall-e-3 only)",
          enum: ["vivid", "natural"]
        },
        n: {
          type: "number",
          description: "Number of images to generate (1-10)",
          minimum: 1,
          maximum: 10
        },
        saveDir: {
          type: "string",
          description: "Directory to save the generated images"
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
        model: args.model,
        size: args.size,
        quality: args.quality,
        style: args.style,
        n: args.n,
        saveDir: args.saveDir,
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
      const model = result.model || 'dall-e-3';

      let responseText = `Successfully generated ${imageCount} image${imageCount !== 1 ? 's' : ''} using ${model}.\n\n`;
      responseText += `Prompt: "${result.prompt}"\n\n`;
      responseText += `Image${imageCount !== 1 ? 's' : ''} saved to:\n`;
      
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
    description: "Edit an existing image using DALL-E based on a text prompt",
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
          description: "Path to the mask image (white areas will be edited, black areas preserved)"
        },
        model: {
          type: "string",
          description: "DALL-E model to use (currently only dall-e-2 supports editing)",
          enum: ["dall-e-2"]
        },
        size: {
          type: "string",
          description: "Size of the generated image",
          enum: ["256x256", "512x512", "1024x1024"]
        },
        n: {
          type: "number",
          description: "Number of images to generate (1-10)",
          minimum: 1,
          maximum: 10
        },
        saveDir: {
          type: "string",
          description: "Directory to save the edited images"
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
      
      const mask = args.mask && !path.isAbsolute(args.mask)
        ? path.resolve(process.cwd(), args.mask)
        : args.mask;

      const result = await dalleService.editImage(args.prompt, imagePath, {
        mask,
        model: args.model,
        size: args.size,
        n: args.n,
        saveDir: args.saveDir,
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
      const model = result.model || 'dall-e-2';

      let responseText = `Successfully edited image and generated ${imageCount} variation${imageCount !== 1 ? 's' : ''} using ${model}.\n\n`;
      responseText += `Original image: ${imagePath}\n`;
      if (mask) {
        responseText += `Mask: ${mask}\n`;
      }
      responseText += `Prompt: "${result.prompt}"\n\n`;
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
    name: "create_variation",
    description: "Create variations of an existing image using DALL-E",
    inputSchema: {
      type: "object",
      properties: {
        imagePath: {
          type: "string",
          description: "Path to the image to create variations of"
        },
        model: {
          type: "string",
          description: "DALL-E model to use (currently only dall-e-2 supports variations)",
          enum: ["dall-e-2"]
        },
        size: {
          type: "string",
          description: "Size of the generated image",
          enum: ["256x256", "512x512", "1024x1024"]
        },
        n: {
          type: "number",
          description: "Number of variations to generate (1-10)",
          minimum: 1,
          maximum: 10
        },
        saveDir: {
          type: "string",
          description: "Directory to save the variation images"
        },
        fileName: {
          type: "string",
          description: "Base filename for the variation images (without extension)"
        }
      },
      required: ["imagePath"]
    },
    handler: async (args: VariationArgs): Promise<ToolResponse> => {
      // Resolve relative path to absolute path
      const imagePath = path.isAbsolute(args.imagePath) 
        ? args.imagePath 
        : path.resolve(process.cwd(), args.imagePath);

      const result = await dalleService.createVariation(imagePath, {
        model: args.model,
        size: args.size,
        n: args.n,
        saveDir: args.saveDir,
        fileName: args.fileName
      });

      if (!result.success) {
        return {
          content: [{
            type: "text",
            text: `Error creating image variations: ${result.error}`
          }]
        };
      }

      const imagePaths = result.imagePaths || [];
      const imageCount = imagePaths.length;
      const model = result.model || 'dall-e-2';

      let responseText = `Successfully created ${imageCount} variation${imageCount !== 1 ? 's' : ''} using ${model}.\n\n`;
      responseText += `Original image: ${imagePath}\n\n`;
      responseText += `Variation${imageCount !== 1 ? 's' : ''} saved to:\n`;
      
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
    name: "validate_key",
    description: "Validate the OpenAI API key",
    inputSchema: {
      type: "object",
      properties: {},
      required: []
    },
    handler: async (_args: ValidateKeyArgs): Promise<ToolResponse> => {
      const isValid = await dalleService.validateApiKey();
      return {
        content: [{
          type: "text",
          text: isValid ? "API key is valid" : "API key is invalid"
        }]
      };
    }
  }
];
