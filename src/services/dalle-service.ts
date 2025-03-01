import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import FormData from 'form-data';
import { ImageGenerationResult } from '../types/index.js';

interface DalleServiceConfig {
  apiKey: string;
  defaultSaveDir?: string;
}

export class DalleService {
  private config: DalleServiceConfig;
  private baseUrl = 'https://api.openai.com/v1';

  constructor(config: DalleServiceConfig) {
    this.config = {
      apiKey: config.apiKey || process.env.OPENAI_API_KEY || '',
      defaultSaveDir: config.defaultSaveDir || process.env.SAVE_DIR || process.cwd()
    };
  }

  /**
   * Generate images using DALL-E
   * @param prompt Text description of the desired image
   * @param options Generation options
   * @returns Result with paths to saved images
   */
  async generateImage(
    prompt: string,
    options: {
      model?: string;
      size?: string;
      quality?: string;
      style?: string;
      n?: number;
      saveDir?: string;
      fileName?: string;
    } = {}
  ): Promise<ImageGenerationResult> {
    try {
      // Set default options
      const model = options.model || 'dall-e-3';
      const size = options.size || '1024x1024';
      const quality = options.quality || 'standard';
      const style = options.style || 'vivid';
      const n = options.n || 1;
      const saveDir = options.saveDir || this.config.defaultSaveDir || process.cwd();
      const fileName = options.fileName || `dalle-${Date.now()}`;

      // Ensure save directory exists
      await fs.ensureDir(saveDir);

      // Make request to OpenAI API
      const response = await axios.post(
        `${this.baseUrl}/images/generations`,
        {
          model,
          prompt,
          n,
          size,
          quality,
          style,
          response_format: 'b64_json'
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`
          }
        }
      );

      // Process response
      const data = response.data;
      const imagePaths: string[] = [];

      // Save each image
      for (let i = 0; i < data.data.length; i++) {
        const item = data.data[i];
        const imageBuffer = Buffer.from(item.b64_json, 'base64');
        let imagePath = path.join(saveDir, `${fileName}${n > 1 ? `-${i + 1}` : ''}.png`);
        
        // Ensure the path is absolute
        if (!path.isAbsolute(imagePath)) {
          imagePath = path.resolve(process.cwd(), imagePath);
        }
        
        await fs.writeFile(imagePath, imageBuffer);
        imagePaths.push(imagePath);
      }

      return {
        success: true,
        imagePaths,
        model,
        prompt
      };
    } catch (error) {
      console.log("DALL-E API Error:", error);
      
      let errorMessage = 'Failed to generate image';
      
      if (axios.isAxiosError(error) && error.response?.data?.error) {
        errorMessage = `DALL-E API Error: ${error.response.data.error.message}`;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Edit an existing image using DALL-E
   * @param prompt Text description of the desired edits
   * @param imagePath Path to the image to edit
   * @param options Edit options
   * @returns Result with paths to saved images
   */
  async editImage(
    prompt: string,
    imagePath: string,
    options: {
      mask?: string;
      model?: string;
      size?: string;
      n?: number;
      saveDir?: string;
      fileName?: string;
    } = {}
  ): Promise<ImageGenerationResult> {
    try {
      // Set default options
      const model = options.model || 'dall-e-2'; // DALL-E 3 doesn't support image edits yet
      const size = options.size || '1024x1024';
      const n = options.n || 1;
      const saveDir = options.saveDir || this.config.defaultSaveDir || process.cwd();
      const fileName = options.fileName || `dalle-edit-${Date.now()}`;

      // Ensure save directory exists
      await fs.ensureDir(saveDir);

      // Check if image exists
      if (!await fs.pathExists(imagePath)) {
        return {
          success: false,
          error: `Image file not found: ${imagePath}`
        };
      }

      // Check if mask exists if provided
      if (options.mask && !await fs.pathExists(options.mask)) {
        return {
          success: false,
          error: `Mask file not found: ${options.mask}`
        };
      }

      // Create form data
      const formData = new FormData();
      formData.append('prompt', prompt);
      formData.append('n', n.toString());
      formData.append('size', size);
      formData.append('response_format', 'b64_json');

      // Read image file and append to form
      const imageBuffer = await fs.readFile(imagePath);
      formData.append('image', imageBuffer, {
        filename: path.basename(imagePath),
        contentType: 'image/png'
      });

      // Add mask if provided
      if (options.mask) {
        const maskBuffer = await fs.readFile(options.mask);
        formData.append('mask', maskBuffer, {
          filename: path.basename(options.mask),
          contentType: 'image/png'
        });
      }

      // Make request to OpenAI API
      const response = await axios.post(
        `${this.baseUrl}/images/edits`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            'Authorization': `Bearer ${this.config.apiKey}`
          }
        }
      );

      // Process response
      const data = response.data;
      const imagePaths: string[] = [];

      // Save each image
      for (let i = 0; i < data.data.length; i++) {
        const item = data.data[i];
        const resultBuffer = Buffer.from(item.b64_json, 'base64');
        let resultPath = path.join(saveDir, `${fileName}${n > 1 ? `-${i + 1}` : ''}.png`);
        
        // Ensure the path is absolute
        if (!path.isAbsolute(resultPath)) {
          resultPath = path.resolve(process.cwd(), resultPath);
        }
        
        await fs.writeFile(resultPath, resultBuffer);
        imagePaths.push(resultPath);
      }

      return {
        success: true,
        imagePaths,
        model,
        prompt
      };
    } catch (error) {
      console.log("DALL-E API Error:", error);
      
      let errorMessage = 'Failed to edit image';
      
      if (axios.isAxiosError(error) && error.response?.data?.error) {
        errorMessage = `DALL-E API Error: ${error.response.data.error.message}`;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Create variations of an existing image
   * @param imagePath Path to the image to create variations of
   * @param options Variation options
   * @returns Result with paths to saved images
   */
  async createVariation(
    imagePath: string,
    options: {
      model?: string;
      size?: string;
      n?: number;
      saveDir?: string;
      fileName?: string;
    } = {}
  ): Promise<ImageGenerationResult> {
    try {
      // Set default options
      const model = options.model || 'dall-e-2'; // DALL-E 3 doesn't support variations yet
      const size = options.size || '1024x1024';
      const n = options.n || 1;
      const saveDir = options.saveDir || this.config.defaultSaveDir || process.cwd();
      const fileName = options.fileName || `dalle-variation-${Date.now()}`;

      // Ensure save directory exists
      await fs.ensureDir(saveDir);

      // Check if image exists
      if (!await fs.pathExists(imagePath)) {
        return {
          success: false,
          error: `Image file not found: ${imagePath}`
        };
      }

      // Create form data
      const formData = new FormData();
      formData.append('n', n.toString());
      formData.append('size', size);
      formData.append('response_format', 'b64_json');

      // Read image file and append to form
      const imageBuffer = await fs.readFile(imagePath);
      formData.append('image', imageBuffer, {
        filename: path.basename(imagePath),
        contentType: 'image/png'
      });

      // Make request to OpenAI API
      const response = await axios.post(
        `${this.baseUrl}/images/variations`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            'Authorization': `Bearer ${this.config.apiKey}`
          }
        }
      );

      // Process response
      const data = response.data;
      const imagePaths: string[] = [];

      // Save each image
      for (let i = 0; i < data.data.length; i++) {
        const item = data.data[i];
        const resultBuffer = Buffer.from(item.b64_json, 'base64');
        let resultPath = path.join(saveDir, `${fileName}${n > 1 ? `-${i + 1}` : ''}.png`);
        
        // Ensure the path is absolute
        if (!path.isAbsolute(resultPath)) {
          resultPath = path.resolve(process.cwd(), resultPath);
        }
        
        await fs.writeFile(resultPath, resultBuffer);
        imagePaths.push(resultPath);
      }

      return {
        success: true,
        imagePaths,
        model
      };
    } catch (error) {
      console.log("DALL-E API Error:", error);
      
      let errorMessage = 'Failed to create image variation';
      
      if (axios.isAxiosError(error) && error.response?.data?.error) {
        errorMessage = `DALL-E API Error: ${error.response.data.error.message}`;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Validate API key by making a test request
   */
  async validateApiKey(): Promise<boolean> {
    try {
      // Make a minimal request to check if the API key is valid
      await axios.get(`${this.baseUrl}/models`, {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`
        }
      });
      return true;
    } catch (error) {
      console.log("API Key Validation Error:", error);
      return false;
    }
  }
}
