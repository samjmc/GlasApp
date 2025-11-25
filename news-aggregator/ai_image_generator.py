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
        """Build DALL-E prompt using LLM to understand article context"""
        
        # Use LLM to determine what visual would best represent this article
        visual_description = self._get_visual_from_llm(title, summary)
        
        # Create clean, text-free prompt with LLM's contextual understanding
        prompt = (
            f"A clean photorealistic editorial image: {visual_description}. "
            f"Irish setting with natural lighting and subtle green tones. "
            f"Modern newspaper photography style. "
            f"CRITICAL: Absolutely NO text, NO words, NO letters, NO numbers, NO signs with writing. "
            f"Pure visual imagery only, no attempts to write anything."
        )
        
        # Ensure under 1000 chars for DALL-E 2
        return prompt[:1000]
    
    def _get_visual_from_llm(self, title: str, summary: str) -> str:
        """Use LLM to determine the best visual for this article"""
        
        try:
            # Quick LLM call to get visual description
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",  # Fast and cheap
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert at visual storytelling for news articles. Generate concise visual scene descriptions for editorial images."
                    },
                    {
                        "role": "user",
                        "content": f"""Based on this Irish political news article, describe a specific visual scene that would illustrate it well.

Title: {title}
Summary: {summary[:300]}

Provide a concise visual description (2-3 sentences max) that:
1. Captures the specific context and emotion of THIS story
2. Is relevant to the actual events/people mentioned
3. Uses concrete imagery (people, places, objects, actions)
4. Avoids generic political imagery unless nothing else fits

Examples of GOOD responses:
- "A worried family looking at eviction notice, empty Dublin apartment, moving boxes packed"
- "Healthcare workers in understaffed hospital ward, empty beds, concerned medical staff"
- "Students in overcrowded classroom, teacher at chalkboard, lack of resources visible"

Examples of BAD responses:
- "Government building" (too generic)
- "Politicians debating" (doesn't capture specific story)
- "Irish flag" (not specific enough)

Respond with ONLY the visual description, no explanation:"""
                    }
                ],
                temperature=0.7,
                max_tokens=150
            )
            
            visual = response.choices[0].message.content.strip()
            logger.debug(f"LLM generated visual: {visual}")
            return visual
            
        except Exception as e:
            logger.warning(f"LLM visual generation failed, using fallback: {e}")
            # Fallback to generic Irish political scene
            return "Irish government buildings, Leinster House, political scene in Dublin"
    
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

