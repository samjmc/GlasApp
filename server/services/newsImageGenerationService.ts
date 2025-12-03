/**
 * News Image Generation Service
 * Generates DALL-E images for news articles
 */

import OpenAI from 'openai';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
}) : null;

/**
 * Get a random existing image from the news-images folder
 */
export function getRandomExistingImage(): string {
  const existingImages = [
    '/news-images/article_0_1827.png',
    '/news-images/article_0_4371.png',
    '/news-images/article_0_461.png',
    '/news-images/article_0_5566.png',
    '/news-images/article_0_5748.png',
    '/news-images/article_0_5754.png',
    '/news-images/article_0_5926.png',
    '/news-images/article_0_6243.png',
    '/news-images/article_0_6333.png',
    '/news-images/article_0_7318.png',
    '/news-images/article_0_7590.png',
    '/news-images/article_0_8120.png',
    '/news-images/article_0_8548.png',
    '/news-images/article_0_9288.png',
    '/news-images/article_0_9894.png',
    '/news-images/article_0_9904.png'
  ];
  
  return existingImages[Math.floor(Math.random() * existingImages.length)];
}

/**
 * Generate image prompt from article
 */
export function generateImagePrompt(article: { title: string; content: string; source: string }): string {
  return `${article.title}. NO WORDS OR NUMBERS IN THE IMAGE.`;
}

/**
 * Generate DALL-E image for article
 */
export async function generateArticleImage(
  article: { title: string; content: string; source: string },
  articleId: number
): Promise<string> {
  
  // If OpenAI not configured, return random existing image
  if (!openai) {
    console.log('   🖼️  OpenAI not configured - using existing image');
    return getRandomExistingImage();
  }
  
  try {
    console.log('   🎨 Generating DALL-E image...');
    
    const prompt = generateImagePrompt(article);
    
    const response = await openai.images.generate({
      model: 'dall-e-2',
      prompt,
      n: 1,
      size: '1024x1024' // DALL-E 2 supports square outputs only; frontend crops to card ratio
    });
    
    const imageUrl = response.data[0]?.url;
    
    if (!imageUrl) {
      console.log('   ⚠️  No image URL returned - using existing image');
      return getRandomExistingImage();
    }
    
    // Download and save image
    const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const imageBuffer = Buffer.from(imageResponse.data);
    
    const filename = `article_${articleId}_${Date.now()}.png`;
    const publicPath = path.join(__dirname, '../../public/news-images', filename);
    
    fs.writeFileSync(publicPath, imageBuffer);
    
    const publicUrl = `/news-images/${filename}`;
    console.log(`   ✅ Image generated: ${publicUrl}`);
    
    return publicUrl;
    
  } catch (error: any) {
    console.error('   ❌ DALL-E generation failed:', error.message);
    console.log('   🖼️  Falling back to random existing image');
    return getRandomExistingImage();
  }
}

export const NewsImageGenerationService = {
  generateArticleImage,
  getRandomExistingImage,
  generateImagePrompt
};



