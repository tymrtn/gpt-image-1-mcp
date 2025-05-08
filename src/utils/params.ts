import path from 'path';
import fs from 'fs-extra';

// Supported GPT-Image-1 sizes
const SUPPORTED_SIZES = ['1024x1024', '1024x1536', '1536x1024'];

/**
 * Normalize a requested size string to a supported size or 'auto'.
 * Attempts to find the closest supported size if requested size is not supported.
 * 
 * @param size Requested size string
 * @returns A supported size string or 'auto' if unsupported or absent
 */
export function normalizeSize(size?: string): string {
  if (!size || size === 'auto') {
    return 'auto';
  }
  
  // If already supported, return as is
  if (SUPPORTED_SIZES.includes(size)) {
    return size;
  }
  
  // Try to parse dimensions
  const match = size.match(/(\d+)x(\d+)/i);
  if (!match) {
    console.warn(`Size "${size}" is not in the format WIDTHxHEIGHT; normalized to "auto".`);
    return 'auto';
  }
  
  const requestedWidth = parseInt(match[1], 10);
  const requestedHeight = parseInt(match[2], 10);
  
  // Find closest matching size by minimizing area difference
  let closestSize = SUPPORTED_SIZES[0];
  let minDifference = Number.MAX_VALUE;
  
  for (const supportedSize of SUPPORTED_SIZES) {
    const [supportedWidth, supportedHeight] = supportedSize.split('x').map(s => parseInt(s, 10));
    
    // Calculate difference (could use various metrics - using area difference here)
    const areaDifference = Math.abs(
      (requestedWidth * requestedHeight) - (supportedWidth * supportedHeight)
    );
    
    // Prioritize aspect ratio similarity
    const requestedRatio = requestedWidth / requestedHeight;
    const supportedRatio = supportedWidth / supportedHeight;
    const ratioDifference = Math.abs(requestedRatio - supportedRatio);
    
    // Combined score (weighted toward aspect ratio match)
    const combinedScore = ratioDifference * 1000 + areaDifference;
    
    if (combinedScore < minDifference) {
      minDifference = combinedScore;
      closestSize = supportedSize;
    }
  }
  
  console.warn(`Requested size "${size}" adjusted to closest supported size "${closestSize}".`);
  return closestSize;
}

/**
 * Resolve a save directory relative to the current working directory (CWD), 
 * create if needed, and ensure it's a valid writable location.
 *
 * Relative paths are resolved from the CWD where the server process was started.
 *
 * @param saveDir User-provided save directory (relative or absolute)
 * @returns Absolute path to the save directory
 */
export function resolveSaveDir(saveDir?: string): string {
  // Use the Current Working Directory as the base for relative paths
  const baseDir = process.cwd(); 
  console.log(`Resolving saveDir: Input='${saveDir}', BaseDir (CWD)='${baseDir}'`);

  let resolvedPath: string;

  if (!saveDir) {
    // Default to CWD if no saveDir is provided
    resolvedPath = baseDir;
    console.log(`saveDir not provided, defaulting to CWD: ${resolvedPath}`);
  } else {
    // Resolve relative paths against CWD, keep absolute paths as is
    if (path.isAbsolute(saveDir)) {
      resolvedPath = saveDir;
      console.log(`saveDir is absolute: ${resolvedPath}`);
    } else {
      resolvedPath = path.resolve(baseDir, saveDir);
      console.log(`saveDir is relative, resolved against CWD: ${resolvedPath}`);
    }
  }

  // Create directory if it doesn't exist
  try {
    fs.ensureDirSync(resolvedPath);
  } catch (error) {
    console.error(`Failed to create directory ${resolvedPath}:`, error);
    // Fall back to CWD if we can't create the requested one
    console.warn(`Falling back to current working directory ${baseDir}`);
    return baseDir; // Use CWD as fallback
  }

  // Verify we have write access to the directory
  try {
    fs.accessSync(resolvedPath, fs.constants.W_OK);
  } catch (error) {
    console.error(`No write permission for directory ${resolvedPath}:`, error);
    // Fall back to CWD if no write access
    console.warn(`Falling back to current working directory ${baseDir}`);
    return baseDir; // Use CWD as fallback
  }

  console.log(`Resolved save directory successfully: ${resolvedPath}`);
  return resolvedPath;
} 