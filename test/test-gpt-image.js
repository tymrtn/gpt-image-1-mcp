#!/usr/bin/env node

import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs-extra';
import path from 'path';
import { DalleService } from '../src/services/dalle-service.js';

// Check for API key
if (!process.env.OPENAI_API_KEY) {
  console.error('Error: OPENAI_API_KEY environment variable is required.');
  process.exit(1);
}

// Create a test directory to save images
const testOutputDir = path.join(process.cwd(), 'test/output');
fs.ensureDirSync(testOutputDir);

// Initialize the service
const dalleService = new DalleService({
  apiKey: process.env.OPENAI_API_KEY,
  defaultSaveDir: testOutputDir
});

/**
 * Test the GPT-Image-1 model for standard image generation
 */
async function testGptImage1Generation() {
  console.log('🧪 Testing GPT-Image-1 standard image generation...');
  
  const result = await dalleService.generateImage('A colorful abstract painting of geometric shapes', {
    model: 'gpt-image-1',
    size: '1024x1024',
    fileName: 'gpt-image1-test'
  });
  
  if (result.success) {
    console.log('✅ GPT-Image-1 generation test passed!');
    console.log(`📊 Generated ${result.imagePaths.length} image(s):`);
    result.imagePaths.forEach(path => console.log(`   - ${path}`));
    
    if (result.usage) {
      console.log('📈 Token usage:');
      console.log(`   - Total tokens: ${result.usage.total_tokens}`);
      console.log(`   - Input tokens: ${result.usage.input_tokens}`);
      console.log(`   - Output tokens: ${result.usage.output_tokens}`);
      if (result.usage.input_tokens_details) {
        console.log(`   - Text tokens: ${result.usage.input_tokens_details.text_tokens}`);
        console.log(`   - Image tokens: ${result.usage.input_tokens_details.image_tokens}`);
      }
    }
  } else {
    console.error('❌ GPT-Image-1 generation test failed:', result.error);
  }
}

/**
 * Test the multi-image edit functionality
 */
async function testMultiImageEdit(testImages) {
  if (!testImages) return;
  
  console.log('🧪 Testing multi-image edit functionality...');
  
  const result = await dalleService.editMultipleImages(
    'Combine these shapes into a cohesive design on a gradient background',
    [testImages.redCirclePath, testImages.blueSquarePath],
    {
      model: 'gpt-image-1',
      fileName: 'multi-image-edit-test'
    }
  );
  
  if (result.success) {
    console.log('✅ Multi-image edit test passed!');
    console.log(`📊 Generated ${result.imagePaths.length} image(s):`);
    result.imagePaths.forEach(path => console.log(`   - ${path}`));
    
    if (result.usage) {
      console.log('📈 Token usage:');
      console.log(`   - Total tokens: ${result.usage.total_tokens}`);
      console.log(`   - Input tokens: ${result.usage.input_tokens}`);
      console.log(`   - Output tokens: ${result.usage.output_tokens}`);
      if (result.usage.input_tokens_details) {
        console.log(`   - Text tokens: ${result.usage.input_tokens_details.text_tokens}`);
        console.log(`   - Image tokens: ${result.usage.input_tokens_details.image_tokens}`);
      }
    }
  } else {
    console.error('❌ Multi-image edit test failed:', result.error);
  }
}

// Run the tests
async function runTests() {
  console.log('🚀 Starting tests for GPT-Image-1 functionality');
  
  // Test GPT-Image-1 generation
  await testGptImage1Generation();
  
  // Create test images and test multi-image edit
  const testImages = await createTestImages();
  await testMultiImageEdit(testImages);
  
  console.log('🏁 Tests completed');
}

runTests().catch(error => {
  console.error('Error running tests:', error);
});
