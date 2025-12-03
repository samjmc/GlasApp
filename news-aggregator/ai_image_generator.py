"""
AI Image Generator for Irish Political News
Uses DALL-E to create custom images for each article
"""

import logging
import requests
from typing import Dict, Optional
from openai import OpenAI
import base64
from pathlib import Path

logger = logging.getLogger(__name__)


class AIImageGenerator:
    def __init__(self, api_key: str, config: Dict):
        self.client = OpenAI(api_key=api_key)
        self.model = config.get('image_generation', {}).get('model', 'dall-e-3')
        self.size = config.get('image_generation', {}).get('size', '1024x1024')
        self.quality = config.get('image_generation', {}).get('quality', 'standard')
        self.style = config.get('image_generation', {}).get('style', 'natural')
        self.save_locally = config.get('image_generation', {}).get('save_locally', True)
        self.output_dir = Path('output/images')
        
        if self.save_locally:
            self.output_dir.mkdir(parents=True, exist_ok=True)
        
    def generate_article_image(self, article: Dict) -> Optional[str]:
        """
        Generate AI image for a political article
        
        Args:
            article: Article dict with 'title' and 'ai_summary'
            
        Returns:
            Image URL or local file path
        """
        try:
            title = article.get('title', '')[:200]
            summary = article.get('ai_summary', '')[:300]
            politician = article.get('politician_name', article.get('td_name', ''))
            story_type = article.get('storyType', article.get('story_type', ''))
            
            # Build the image generation prompt
            prompt = self._build_image_prompt(title, summary, politician, story_type)
            
            logger.info(f"Generating image for: {title[:60]}...")
            logger.debug(f"Image prompt: {prompt}")
            
            # Generate image with DALL-E
            # Note: quality and style only work with DALL-E 3
            if self.model == 'dall-e-3':
                response = self.client.images.generate(
                    model=self.model,
                    prompt=prompt,
                    size=self.size,
                    quality=self.quality,
                    style=self.style,
                    n=1
                )
            else:
                # DALL-E 2 only supports model, prompt, size, n
                response = self.client.images.generate(
                    model=self.model,
                    prompt=prompt,
                    size=self.size,
                    n=1
                )
            
            image_url = response.data[0].url
            
            # Optionally save locally
            if self.save_locally:
                local_path = self._save_image_locally(image_url, article.get('id', 0))
                logger.info(f"✓ Image generated and saved: {local_path}")
                return local_path
            else:
                logger.info(f"✓ Image generated: {image_url}")
                return image_url
                
        except Exception as e:
            logger.error(f"Failed to generate image: {str(e)}")
            # Return the scraped image as fallback
            return article.get('scraped_content', {}).get('top_image')
    
    def _build_image_prompt(self, title: str, summary: str, politician: str, story_type: str) -> str:
        """Build DALL-E prompt from article title"""
        return f"{title}. NO WORDS OR NUMBERS IN THE IMAGE."
    
    def _save_image_locally(self, image_url: str, article_id: int) -> str:
        """Download and save image locally"""
        try:
            # Download image
            response = requests.get(image_url, timeout=30)
            response.raise_for_status()
            
            # Save to file
            filename = f"article_{article_id}_{hash(image_url) % 10000}.png"
            filepath = self.output_dir / filename
            
            with open(filepath, 'wb') as f:
                f.write(response.content)
            
            # Return relative web path
            return f"/images/{filename}"
            
        except Exception as e:
            logger.error(f"Failed to save image locally: {str(e)}")
            return image_url  # Return original URL as fallback
    
    def generate_batch(self, articles: list) -> list:
        """Generate images for multiple articles"""
        
        for article in articles:
            image_path = self.generate_article_image(article)
            if image_path:
                article['ai_generated_image'] = image_path
                # Use AI image by default, fallback to scraped
                if not article.get('imageUrl'):
                    article['imageUrl'] = image_path
        
        return articles

