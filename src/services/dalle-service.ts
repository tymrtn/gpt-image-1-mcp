import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import FormData from 'form-data';
import { ImageGenerationResult } from '../types/index.js';
import { normalizeSize, resolveSaveDir } from '../utils/params.js';

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
      // Always default to project cwd if not explicitly provided
      defaultSaveDir: config.defaultSaveDir || process.cwd()
    };
  }

  /**
   * Generate images using GPT-Image-1
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
      background?: string;
      moderation?: string;
      output_format?: string;
      output_compression?: number;
      n?: number;
      saveDirPath?: string;
      fileName?: string;
    } = {}
  ): Promise<ImageGenerationResult> {
    let debugData: any = null;
    try {
      // Set default options
      const model = 'gpt-image-1'; // Only support GPT-Image-1
      const n = options.n || 1;
      const saveDir = resolveSaveDir(options.saveDirPath);
      const fileName = options.fileName || `gpt-image-${Date.now()}`;
      const output_format = options.output_format || 'png';

      // Print debug information
      console.log("DEBUG - generateImage options:", JSON.stringify(options, null, 2));

      // Ensure save directory exists and is writeable
      try {
        await fs.ensureDir(saveDir); // Create if it doesn't exist
        await fs.access(saveDir, fs.constants.W_OK); // Check for write permissions
      } catch (err: any) {
        console.error(`Error ensuring directory ${saveDir} is writeable:`, err);
        return {
          success: false,
          error: `Save directory (${saveDir}) is not writeable or could not be created: ${err.message}`
        };
      }

      // Base request parameters
      const requestParams: any = {
        model,
        prompt,
        n
      };
      
      // Size parameter: normalize to supported or auto
      requestParams.size = normalizeSize(options.size);
      
      // Quality parameter (auto is default)
      if (options.quality && ['auto', 'high', 'medium', 'low'].includes(options.quality)) {
        requestParams.quality = options.quality;
      }
      
      // Add other gpt-image-1 specific parameters
      if (options.background && ['auto', 'transparent', 'opaque'].includes(options.background)) {
        requestParams.background = options.background;
      }
      
      if (options.moderation && ['auto', 'low'].includes(options.moderation)) {
        requestParams.moderation = options.moderation;
      }
      
      if (options.output_format && ['png', 'jpeg', 'webp'].includes(options.output_format)) {
        requestParams.output_format = options.output_format;
      }
      
      // Add compression for webp/jpeg
      if ((output_format === 'webp' || output_format === 'jpeg') && 
          typeof options.output_compression === 'number' && 
          options.output_compression >= 0 && 
          options.output_compression <= 100) {
        requestParams.output_compression = options.output_compression;
      }
      
      console.log("DEBUG - gpt-image-1 requestParams:", JSON.stringify(requestParams, null, 2));
    
      // Make the API request - Use the correct API endpoint
    const response = await axios.post(
      `${this.baseUrl}/images/generations`,
      requestParams,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        }
      }
    );
    debugData = response.data;

    // Process response - Add extensive logging
      const data = response.data;
      console.log("DEBUG - Full API Response Structure:", JSON.stringify(data, null, 2));
      console.log("DEBUG - Response Type:", typeof data);
      console.log("DEBUG - Response Keys:", Object.keys(data));
      
      const imagePaths: string[] = [];

      // Check if data structure is as expected
      if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
        console.error("DEBUG - Unexpected response structure:", data);
        throw new Error("Unexpected API response structure. Missing or empty data array.");
      }

      // Save each image with careful validation
      for (let i = 0; i < data.data.length; i++) {
        const item = data.data[i];
        // Handle URL-based responses
        if (item.url) {
          console.log("DEBUG - Found url field, downloading image from URL");
          const urlResponse = await axios.get(item.url, { responseType: 'arraybuffer' });
          const buffer = Buffer.from(urlResponse.data);
          let imagePath = path.join(saveDir, `${fileName}${n > 1 ? `-${i + 1}` : ''}.${output_format}`);
          if (!path.isAbsolute(imagePath)) {
            imagePath = path.resolve(process.cwd(), imagePath);
          }
          await fs.writeFile(imagePath, buffer);
          imagePaths.push(imagePath);
          continue;
        }
        console.log(`DEBUG - Image item ${i}:`, JSON.stringify(item, null, 2));
        console.log(`DEBUG - Item type:`, typeof item);
        console.log(`DEBUG - Item keys:`, Object.keys(item));
        
        // Try to find image data in various formats OpenAI might return
        let base64Data = null;
        if (item.b64_json) {
          console.log("DEBUG - Found b64_json field");
          base64Data = item.b64_json;
        } else if (item.image) {
          console.log("DEBUG - Found image field");
          base64Data = item.image;
        } else if (item.url) {
          console.log("DEBUG - Found url field (cannot process directly)");
          throw new Error("API returned URL instead of base64 data. Update code to handle URL responses.");
        } else {
          console.error("DEBUG - No recognizable image data in item:", item);
          throw new Error("Image data not found in expected formats in API response");
        }
        
        if (!base64Data) {
          console.error("DEBUG - Base64 data is null or empty");
          throw new Error("Base64 image data is empty");
        }
        
        console.log("DEBUG - Base64 data type:", typeof base64Data);
        console.log("DEBUG - Base64 data length:", base64Data.length);
        console.log("DEBUG - Base64 data preview:", base64Data.substring(0, 50) + "...");
        
        const imageBuffer = Buffer.from(base64Data, 'base64');
        let imagePath = path.join(saveDir, `${fileName}${n > 1 ? `-${i + 1}` : ''}.${output_format}`);
        
        // Ensure the path is absolute
        if (!path.isAbsolute(imagePath)) {
          imagePath = path.resolve(process.cwd(), imagePath);
        }
        
        await fs.writeFile(imagePath, imageBuffer);
        imagePaths.push(imagePath);
      }

      // Extract token usage if available
      const usage = data.usage ? {
        total_tokens: data.usage.total_tokens,
        input_tokens: data.usage.input_tokens,
        output_tokens: data.usage.output_tokens,
        input_tokens_details: data.usage.input_tokens_details
      } : undefined;

      return {
        success: true,
        imagePaths,
        model,
        prompt,
        usage
      };
    } catch (error) {
      console.log("DEBUG - Response Data:", debugData);
      console.log("GPT-Image API Error:", error);
      
      let errorMessage = 'Failed to generate image';
      
      if (axios.isAxiosError(error) && error.response?.data?.error) {
        errorMessage = `GPT-Image API Error: ${error.response.data.error.message}`;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      // Include debug response data in the error message
      errorMessage += `\nDEBUG_RESPONSE_DATA: ${JSON.stringify(debugData, null, 2)}`;
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Edit an existing image using GPT-Image-1
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
      quality?: string;
      background?: string;
      moderation?: string;
      output_format?: string;
      output_compression?: number;
      n?: number;
      saveDirPath?: string;
      fileName?: string;
    } = {}
  ): Promise<ImageGenerationResult> {
    try {
      // Set default options
      const model = 'gpt-image-1'; // Only support GPT-Image-1
      const size = normalizeSize(options.size);
      const quality = options.quality || 'auto';
      const background = options.background || 'auto';
      const moderation = options.moderation || 'auto';
      const output_format = options.output_format || 'png';
      const output_compression = options.output_compression || 100;
      const n = options.n || 1;
      const saveDir = resolveSaveDir(options.saveDirPath);
      const fileName = options.fileName || `gpt-image-edit-${Date.now()}`;

      // Ensure save directory exists and is writeable
      try {
        await fs.ensureDir(saveDir); // Create if it doesn't exist
        await fs.access(saveDir, fs.constants.W_OK); // Check for write permissions
      } catch (err: any) {
        console.error(`Error ensuring directory ${saveDir} is writeable:`, err);
        return {
          success: false,
          error: `Save directory (${saveDir}) is not writeable or could not be created: ${err.message}`
        };
      }

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
      formData.append('model', model);
      formData.append('n', n.toString());
      formData.append('size', size);
      
      if (quality) {
        formData.append('quality', quality);
      }
      
      if (background) {
        formData.append('background', background);
      }
      
      if (moderation) {
        formData.append('moderation', moderation);
      }
      
      if (output_format) {
        formData.append('output_format', output_format);
      }
      
      if ((output_format === 'webp' || output_format === 'jpeg') && output_compression) {
        formData.append('output_compression', output_compression.toString());
      }
      

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

      // Check if data structure is as expected
      if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
        console.error("DEBUG - Unexpected editImage response structure:", data);
        throw new Error("Unexpected API response structure. Missing or empty data array.");
      }

      // Save each image with careful validation
      for (let i = 0; i < data.data.length; i++) {
        const item = data.data[i];
        let imageBuffer: Buffer | null = null;
        let imagePath = path.join(saveDir, `${fileName}${n > 1 ? `-${i + 1}` : ''}.${output_format || 'png'}`);

        // Ensure the path is absolute before using it
        if (!path.isAbsolute(imagePath)) {
          imagePath = path.resolve(process.cwd(), imagePath);
        }

        console.log(`DEBUG - Edit Image item ${i}:`, JSON.stringify(item, null, 2));
        console.log(`DEBUG - Edit Item keys:`, Object.keys(item));
        
        // Handle URL-based responses first
        if (item.url) {
          console.log("DEBUG - Found url field, downloading image from URL for edit");
          try {
              const urlResponse = await axios.get(item.url, { responseType: 'arraybuffer' });
              imageBuffer = Buffer.from(urlResponse.data);
              console.log(`DEBUG - Successfully downloaded image from ${item.url}`);
          } catch (downloadError) {
              console.error(`DEBUG - Failed to download image from URL: ${item.url}`, downloadError);
              // Optionally throw or continue to next item depending on desired behavior
              throw new Error(`Failed to download edited image from URL: ${item.url}`);
          }
        } else {
          // Try to find image data in various base64 formats
          let base64Data = null;
          if (item.b64_json) {
            console.log("DEBUG - Found b64_json field for edit");
            base64Data = item.b64_json;
          } else if (item.image) {
            console.log("DEBUG - Found image field for edit (assuming base64)");
            base64Data = item.image; // DALL-E 2 might use 'image'
          } else {
            console.error("DEBUG - No recognizable image data in edit item:", item);
            throw new Error("Image data not found in expected formats (url, b64_json, image) in edit API response");
          }
          
          if (!base64Data) {
            console.error("DEBUG - Base64 data is null or empty for edit");
            throw new Error("Base64 image data is empty for edit");
          }
          
          console.log("DEBUG - Edit Base64 data type:", typeof base64Data);
          console.log("DEBUG - Edit Base64 data length:", base64Data.length);
          
          try {
            imageBuffer = Buffer.from(base64Data, 'base64');
          } catch (bufferError) {
              console.error("DEBUG - Error creating buffer from base64 data:", bufferError);
              throw new Error("Failed to create image buffer from base64 data.");
          }
        }
        
        if (!imageBuffer) {
            console.error("DEBUG - Image buffer is null after processing item, cannot save.");
            throw new Error("Failed to obtain image buffer from API response item.");
        }

        await fs.writeFile(imagePath, imageBuffer);
        console.log(`DEBUG - Successfully saved edited image to: ${imagePath}`);
        imagePaths.push(imagePath);
      }

      // Extract token usage if available (GPT-Image-1 might provide this)
      const usage = data.usage ? {
        total_tokens: data.usage.total_tokens,
        input_tokens: data.usage.input_tokens,
        output_tokens: data.usage.output_tokens,
        input_tokens_details: data.usage.input_tokens_details
      } : undefined;

      return {
        success: true,
        imagePaths,
        model,
        prompt,
        usage // Include usage if available
      };
    } catch (error) {
      console.log("GPT-Image API Error:", error);
      
      let errorMessage = 'Failed to edit image';
      
      if (axios.isAxiosError(error) && error.response?.data?.error) {
        errorMessage = `GPT-Image API Error: ${error.response.data.error.message}`;
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
   * Generate an image using an existing image as input (image-to-image)
   * @param imagePath Path to the input image
   * @param prompt Text description to guide the generation
   * @param options Generation options
   * @returns Result with paths to saved images
   */
  async imageToImage(
    imagePath: string,
    prompt: string,
    options: {
      model?: string;
      size?: string;
      quality?: string;
      background?: string;
      moderation?: string;
      output_format?: string;
      output_compression?: number;
      n?: number;
      saveDirPath?: string;
      fileName?: string;
    } = {}
  ): Promise<ImageGenerationResult> {
    try {
      // Set default options
      const model = 'gpt-image-1';
      const size = normalizeSize(options.size);
      const quality = options.quality || 'auto';
      const background = options.background || 'auto';
      const moderation = options.moderation || 'auto';
      const output_format = options.output_format || 'png';
      const output_compression = options.output_compression || 100;
      const n = options.n || 1;
      const saveDir = resolveSaveDir(options.saveDirPath);
      const fileName = options.fileName || `gpt-img2img-${Date.now()}`;

      // Ensure save directory exists and is writeable
      try {
        await fs.ensureDir(saveDir); // Create if it doesn't exist
        await fs.access(saveDir, fs.constants.W_OK); // Check for write permissions
      } catch (err: any) {
        console.error(`Error ensuring directory ${saveDir} is writeable:`, err);
        return {
          success: false,
          error: `Save directory (${saveDir}) is not writeable or could not be created: ${err.message}`
        };
      }

      // Check if image exists
      if (!await fs.pathExists(imagePath)) {
        return {
          success: false,
          error: `Image file not found: ${imagePath}`
        };
      }

      // Create form data
      const formData = new FormData();
      formData.append('prompt', prompt);
      formData.append('model', model);
      formData.append('n', n.toString());
      formData.append('size', size);
      
      if (quality) {
        formData.append('quality', quality);
      }
      
      if (background) {
        formData.append('background', background);
      }
      
      if (moderation) {
        formData.append('moderation', moderation);
      }
      
      if (output_format) {
        formData.append('output_format', output_format);
      }
      
      if ((output_format === 'webp' || output_format === 'jpeg') && output_compression) {
        formData.append('output_compression', output_compression.toString());
      }
      

      // Read image file and append to form
      const imageBuffer = await fs.readFile(imagePath);
      formData.append('image', imageBuffer, {
        filename: path.basename(imagePath),
        contentType: 'image/png'
      });

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
        const resultBuffer = Buffer.from(item.image, 'base64');
        let resultPath = path.join(saveDir, `${fileName}${n > 1 ? `-${i + 1}` : ''}.${output_format || 'png'}`);
        
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
      console.log("GPT-Image API Error:", error);
      
      let errorMessage = 'Failed to generate image from input image';
      
      if (axios.isAxiosError(error) && error.response?.data?.error) {
        errorMessage = `GPT-Image API Error: ${error.response.data.error.message}`;
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
   * Edit multiple images using gpt-image-1 model
   * @param prompt Text description to guide the generation
   * @param imagePaths Array of paths to the input images
   * @param options Edit options
   * @returns Result with paths to saved images
   */
  async editMultipleImages(
    prompt: string,
    imagePaths: string[],
    options: {
      model?: string;
      size?: string;
      quality?: string;
      background?: string;
      moderation?: string;
      output_format?: string;
      output_compression?: number;
      n?: number;
      saveDirPath?: string;
      fileName?: string;
    } = {}
  ): Promise<ImageGenerationResult> {
    try {
      // Set default options
      const model = options.model || 'gpt-image-1';
      const size = normalizeSize(options.size);
      const quality = options.quality || 'auto';
      const background = options.background || 'auto';
      const moderation = options.moderation || 'auto';
      const output_format = options.output_format || 'png';
      const output_compression = options.output_compression || 100;
      const n = options.n || 1;
      const saveDir = resolveSaveDir(options.saveDirPath);
      const fileName = options.fileName || `image-edit-${Date.now()}`;

      // Ensure save directory exists and is writeable
      try {
        await fs.ensureDir(saveDir); // Create if it doesn't exist
        await fs.access(saveDir, fs.constants.W_OK); // Check for write permissions
      } catch (err: any) {
        console.error(`Error ensuring directory ${saveDir} is writeable:`, err);
        return {
          success: false,
          error: `Save directory (${saveDir}) is not writeable or could not be created: ${err.message}`
        };
      }

      // Check if all images exist
      for (const imagePath of imagePaths) {
        if (!await fs.pathExists(imagePath)) {
          return {
            success: false,
            error: `Image file not found: ${imagePath}`
          };
        }
      }

      // Create form data
      const formData = new FormData();
      formData.append('prompt', prompt);
      formData.append('model', model);
      formData.append('n', n.toString());
      formData.append('size', size);
      
      if (quality) {
        formData.append('quality', quality);
      }
      
      if (background) {
        formData.append('background', background);
      }
      
      if (moderation) {
        formData.append('moderation', moderation);
      }
      
      if (output_format) {
        formData.append('output_format', output_format);
      }
      
      if ((output_format === 'webp' || output_format === 'jpeg') && output_compression) {
        formData.append('output_compression', output_compression.toString());
      }
      

      // Read and append all image files to form
      for (const imagePath of imagePaths) {
        const imageBuffer = await fs.readFile(imagePath);
        formData.append('image[]', imageBuffer, {
          filename: path.basename(imagePath),
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
      const resultImagePaths: string[] = [];

      // Save each image
      for (let i = 0; i < data.data.length; i++) {
        const item = data.data[i];
        const resultBuffer = Buffer.from(item.image, 'base64');
        let resultPath = path.join(saveDir, `${fileName}${n > 1 ? `-${i + 1}` : ''}.${output_format || 'png'}`);
        
        // Ensure the path is absolute
        if (!path.isAbsolute(resultPath)) {
          resultPath = path.resolve(process.cwd(), resultPath);
        }
        
        await fs.writeFile(resultPath, resultBuffer);
        resultImagePaths.push(resultPath);
      }

      // Extract token usage if available
      const usage = data.usage ? {
        total_tokens: data.usage.total_tokens,
        input_tokens: data.usage.input_tokens,
        output_tokens: data.usage.output_tokens,
        input_tokens_details: data.usage.input_tokens_details
      } : undefined;

      return {
        success: true,
        imagePaths: resultImagePaths,
        model,
        prompt,
        usage
      };
    } catch (error) {
      console.log("GPT-Image API Error:", error);
      
      let errorMessage = 'Failed to edit multiple images';
      
      if (axios.isAxiosError(error) && error.response?.data?.error) {
        errorMessage = `GPT-Image API Error: ${error.response.data.error.message}`;
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
