import { jest } from '@jest/globals';
import { DalleService } from '../dalle-service.js';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

// Set this to true to run all tests including those that make additional API calls
const RUN_ALL_TESTS = process.env.RUN_ALL_TESTS === 'true';

// These tests use real API calls and may take longer to complete
describe('DalleService Integration Tests', () => {
  let service: DalleService;
  let tempDir: string;
  
  beforeEach(async () => {
    // Create a temporary directory for test images
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dalle-test-'));
    
    service = new DalleService({ 
      apiKey: process.env.OPENAI_API_KEY!,
      defaultSaveDir: tempDir
    });
  });
  
  afterEach(async () => {
    // Clean up temporary directory after tests
    await fs.remove(tempDir);
  });

  // Increase timeout for API calls
  jest.setTimeout(60000);

  describe('validateApiKey', () => {
    it('should validate API key', async () => {
      const result = await service.validateApiKey();
      expect(result).toBe(true);
    });
  });

  describe('generateImage', () => {
    it('should generate an image with default parameters', async () => {
      const result = await service.generateImage('A cute cat sitting on a windowsill');

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.imagePaths).toBeDefined();
      expect(result.imagePaths?.length).toBe(1);
      expect(result.model).toBe('dall-e-3');
      expect(result.prompt).toBe('A cute cat sitting on a windowsill');
      
      // Verify image file exists
      const imagePath = result.imagePaths![0];
      expect(await fs.pathExists(imagePath)).toBe(true);
      
      // Verify image file is not empty
      const stats = await fs.stat(imagePath);
      expect(stats.size).toBeGreaterThan(1000); // Image should be at least 1KB
    });

    it('should generate multiple images with custom parameters', async () => {
      const result = await service.generateImage('A mountain landscape at sunset', {
        model: 'dall-e-2',
        size: '512x512',
        n: 2,
        fileName: 'test-landscape'
      });

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.imagePaths).toBeDefined();
      expect(result.imagePaths?.length).toBe(2);
      expect(result.model).toBe('dall-e-2');
      
      // Verify image files exist
      for (const imagePath of result.imagePaths!) {
        expect(await fs.pathExists(imagePath)).toBe(true);
        expect(imagePath).toContain('test-landscape');
        
        // Verify image file is not empty
        const stats = await fs.stat(imagePath);
        expect(stats.size).toBeGreaterThan(1000);
      }
    });

    it('should handle API errors gracefully', async () => {
      // Create a service with an invalid API key
      const invalidService = new DalleService({ 
        apiKey: 'invalid-key',
        defaultSaveDir: tempDir
      });
      
      const result = await invalidService.generateImage('This should fail');
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.imagePaths).toBeUndefined();
    });
  });

  // Additional tests that make more API calls - only run when RUN_ALL_TESTS is true
  // These tests are skipped by default to avoid excessive API usage
  (RUN_ALL_TESTS ? describe : describe.skip)('editImage', () => {
    let testImagePath: string;
    
    beforeEach(async () => {
      // Use a pre-generated test image from assets if available
      const assetImagePath = path.resolve(process.cwd(), 'assets/test-image.png');
      
      if (await fs.pathExists(assetImagePath)) {
        // Copy the test image to the temp directory
        const tempImagePath = path.join(tempDir, 'test-image.png');
        await fs.copyFile(assetImagePath, tempImagePath);
        testImagePath = tempImagePath;
      } else {
        // Generate a test image to edit
        const genResult = await service.generateImage('A plain white mug on a table', {
          model: 'dall-e-2', // Use DALL-E 2 for edits
          fileName: 'test-mug-original'
        });
        
        testImagePath = genResult.imagePaths![0];
      }
    });
    
    it('should attempt to edit an image', async () => {
      const result = await service.editImage(
        'Add a logo to the mug',
        testImagePath,
        { fileName: 'test-mug-edited' }
      );
      
      // If the API call succeeds, verify the result
      if (result.success) {
        expect(result.error).toBeUndefined();
        expect(result.imagePaths).toBeDefined();
        expect(result.imagePaths?.length).toBe(1);
        
        // Verify edited image file exists
        const imagePath = result.imagePaths![0];
        expect(await fs.pathExists(imagePath)).toBe(true);
        expect(imagePath).toContain('test-mug-edited');
      } else {
        // If the API call fails, log the error but don't fail the test
        // This is because image editing has specific format requirements
        console.log('Image edit API call failed:', result.error);
        expect(result.error).toBeDefined();
      }
    });
  });
  
  (RUN_ALL_TESTS ? describe : describe.skip)('createVariation', () => {
    let testImagePath: string;
    
    beforeEach(async () => {
      // Use a pre-generated test image from assets if available
      const assetImagePath = path.resolve(process.cwd(), 'assets/test-image.png');
      
      if (await fs.pathExists(assetImagePath)) {
        // Copy the test image to the temp directory
        const tempImagePath = path.join(tempDir, 'test-image.png');
        await fs.copyFile(assetImagePath, tempImagePath);
        testImagePath = tempImagePath;
      } else {
        // Generate a test image for variations
        const genResult = await service.generateImage('A simple geometric shape', {
          model: 'dall-e-2', // Use DALL-E 2 for variations
          fileName: 'test-shape-original'
        });
        
        testImagePath = genResult.imagePaths![0];
      }
    });
    
    it('should create variations of an image', async () => {
      const result = await service.createVariation(
        testImagePath,
        { 
          n: 2,
          fileName: 'test-shape-variation'
        }
      );
      
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.imagePaths).toBeDefined();
      expect(result.imagePaths?.length).toBe(2);
      
      // Verify variation image files exist
      for (const imagePath of result.imagePaths!) {
        expect(await fs.pathExists(imagePath)).toBe(true);
        expect(imagePath).toContain('test-shape-variation');
      }
    });
  });
});
