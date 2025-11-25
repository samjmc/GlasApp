"""
AI Scorer Module for Irish Political News
Uses OpenAI to score and rank articles for political relevance
"""

import logging
from typing import List, Dict, Optional
from openai import OpenAI
import json
import re

logger = logging.getLogger(__name__)


class AIScorer:
    def __init__(self, api_key: str, config: Dict):
        self.client = OpenAI(api_key=api_key)
        self.model = config.get('scoring', {}).get('model', 'gpt-4o-mini')
        self.temperature = config.get('scoring', {}).get('temperature', 0.2)
        self.max_tokens = config.get('scoring', {}).get('max_tokens', 600)
        self.default_scoring_prompt = config.get('scoring', {}).get('default_prompt', '')
        
    def score_article(self, article: Dict) -> Optional[Dict]:
        """
        Score a single article using OpenAI
        
        Args:
            article: Dict with 'title' and 'content' keys
            
        Returns:
            Article dict with 'ai_score', 'ai_summary', and 'score_breakdown' added
        """
        try:
            # Get content
            content = article.get('content', '')
            if not content and 'scraped_content' in article:
                content = article['scraped_content'].get('content', '')
            if not content:
                content = article.get('summary', '')
            
            title = article.get('title', 'No Title')
            
            # Truncate content if too long
            max_content_chars = 8000
            if len(content) > max_content_chars:
                content = content[:max_content_chars] + "..."
            
            # Build prompt
            prompt = self.default_scoring_prompt.format(title=title, content=content)
            
            logger.debug(f"Scoring article: {title[:60]}...")
            
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are an expert political analyst for Irish politics. Score articles objectively."},
                    {"role": "user", "content": prompt}
                ],
                temperature=self.temperature,
                max_tokens=self.max_tokens
            )
            
            result_text = response.choices[0].message.content.strip()
            
            # Parse the JSON response
            score_data = self._parse_score_response(result_text)
            
            if score_data:
                article['ai_score'] = score_data['overall_score']
                article['ai_summary'] = score_data['summary']
                article['score_breakdown'] = score_data['scores']
                
                # Add TD info if present
                if score_data.get('mentions_td'):
                    article['mentions_td'] = True
                    article['td_name'] = score_data.get('td_name')
                    article['party'] = score_data.get('party')
                
                logger.info(f"Scored: {title[:50]}... -> {score_data['overall_score']:.1f}")
                return article
            else:
                logger.warning(f"Failed to parse score for: {title}")
                return None
                
        except Exception as e:
            logger.error(f"Error scoring article '{article.get('title', 'Unknown')}': {str(e)}")
            return None
            
    def _parse_score_response(self, response_text: str) -> Optional[Dict]:
        """Parse the AI response to extract scores"""
        try:
            # Remove markdown code blocks if present
            json_text = response_text.strip()
            
            if '```json' in json_text:
                json_text = re.search(r'```json\s*(.*?)\s*```', json_text, re.DOTALL)
                if json_text:
                    json_text = json_text.group(1).strip()
            elif '```' in json_text:
                json_text = re.search(r'```\s*(.*?)\s*```', json_text, re.DOTALL)
                if json_text:
                    json_text = json_text.group(1).strip()
                    
            data = json.loads(json_text)
            
            # Validate structure
            if 'summary' in data and 'scores' in data and 'overall_score' in data:
                return data
                
        except json.JSONDecodeError:
            logger.debug("JSON parse failed, trying regex extraction")
            pass
            
        return None
        
    def score_batch(self, articles: List[Dict]) -> List[Dict]:
        """
        Score multiple articles
        
        Args:
            articles: List of article dicts
            
        Returns:
            List of scored articles (only those that were successfully scored)
        """
        scored_articles = []
        
        for i, article in enumerate(articles):
            logger.info(f"Scoring article {i+1}/{len(articles)}")
            
            scored = self.score_article(article)
            if scored:
                scored_articles.append(scored)
            else:
                logger.warning(f"Skipping article due to scoring failure: {article.get('title')}")
                
        return scored_articles
        
    def get_top_articles(self, articles: List[Dict], count: int = 5) -> List[Dict]:
        """
        Get top N articles by score
        
        Args:
            articles: List of scored articles
            count: Number of top articles to return
            
        Returns:
            List of top articles sorted by score (descending)
        """
        # Sort by ai_score in descending order
        sorted_articles = sorted(
            articles,
            key=lambda x: x.get('ai_score', 0),
            reverse=True
        )
        
        top_articles = sorted_articles[:count]
        
        logger.info(f"Top {count} article scores: {[f'{a.get('ai_score', 0):.1f}' for a in top_articles]}")
        
        return top_articles


