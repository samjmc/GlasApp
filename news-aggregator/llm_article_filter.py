"""
LLM Article Filter for Irish Political News
Uses GPT to intelligently filter RSS articles by title for political relevance
"""

import logging
import json
from typing import List, Dict
from openai import OpenAI

logger = logging.getLogger(__name__)


class LLMArticleFilter:
    def __init__(self, api_key: str):
        """
        Initialize the LLM Article Filter
        
        Args:
            api_key: OpenAI API key
        """
        self.client = OpenAI(api_key=api_key)
        self.model = "gpt-4o-mini"  # Cheap and fast for filtering
        self.temperature = 0.1  # Low temperature for consistent filtering
        
    def filter_articles(self, articles: List[Dict], batch_size: int = 50) -> List[Dict]:
        """
        Filter articles by title relevance using LLM
        Processes in batches to reduce API calls
        
        Args:
            articles: List of articles with 'title' and 'summary' keys
            batch_size: Number of articles to process per API call
            
        Returns:
            List of filtered articles (politically relevant only)
        """
        if not articles:
            return []
        
        logger.info(f"Filtering {len(articles)} articles using LLM...")
        
        relevant_articles = []
        
        # Process in batches
        for i in range(0, len(articles), batch_size):
            batch = articles[i:i+batch_size]
            batch_results = self._filter_batch(batch)
            relevant_articles.extend(batch_results)
        
        logger.info(f"LLM filter: {len(articles)} → {len(relevant_articles)} relevant articles")
        return relevant_articles
    
    def _filter_batch(self, articles: List[Dict]) -> List[Dict]:
        """Filter a batch of articles"""
        try:
            # Build prompt with article titles
            prompt = self._build_filter_prompt(articles)
            
            # Call OpenAI
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are an expert at identifying Irish political news. You filter articles to find only those relevant to Irish politics, TDs, government, and policy."},
                    {"role": "user", "content": prompt}
                ],
                temperature=self.temperature,
                max_tokens=500
            )
            
            result_text = response.choices[0].message.content.strip()
            
            # Parse results
            relevant_indices = self._parse_filter_results(result_text)
            
            # Return only relevant articles
            filtered = [articles[i] for i in relevant_indices if i < len(articles)]
            
            logger.debug(f"Batch: {len(articles)} articles → {len(filtered)} relevant")
            return filtered
            
        except Exception as e:
            logger.error(f"Error filtering batch: {str(e)}")
            # Return all articles if filtering fails (safe fallback)
            return articles
    
    def _build_filter_prompt(self, articles: List[Dict]) -> str:
        """Build the filtering prompt for Irish political news"""
        prompt = """You are filtering news for IRISH CITIZENS interested in politics. Be STRICT - only include articles about Irish politics, TDs, government, and policy.

MUST INCLUDE:
- Irish TDs (politicians in Dáil Éireann)
- Irish government ministers, cabinet, Taoiseach, Tánaiste
- Dáil debates, votes, legislation
- Irish political parties (FF, FG, SF, Labour, Greens, etc.)
- Irish elections, referendums, polling
- Government policy affecting Ireland
- Political scandals, ethics probes
- Ireland-UK relations, Brexit impact
- Ireland-EU relations
- Irish budget, spending, taxation
- Housing policy, health policy, etc. affecting Ireland
- Local councils, county issues if politically significant

MUST EXCLUDE (be strict):
- Sports (GAA, soccer, rugby) unless political angle
- Crime/courts unless involving TDs or political corruption
- Business/economy unless government policy involved
- Entertainment, celebrity gossip
- Obituaries, funerals (unless major political figure)
- Weather, traffic
- General international news without Irish connection
- UK politics unless affecting Ireland directly
- US/other country politics unless Ireland involved

CRITICAL RULES:
1. Must mention Ireland, Irish TDs, Irish government, or Irish parties
2. If just "politician" without Irish context → EXCLUDE
3. If UK/EU news without Irish angle → EXCLUDE
4. When in doubt → EXCLUDE (be strict!)

ARTICLES:
"""
        for i, article in enumerate(articles):
            title = article.get('title', 'No Title')
            summary = article.get('summary', '')[:200]
            prompt += f"\n{i}. {title}"
            if summary:
                prompt += f" | {summary}"
        
        prompt += """

Return ONLY a JSON object with relevant article numbers:
{"relevant": [0, 3, 5, 8]}

If NONE are relevant, return:
{"relevant": []}
"""
        return prompt
    
    def _parse_filter_results(self, response_text: str) -> List[int]:
        """Parse the LLM response to get relevant article indices"""
        try:
            # Remove markdown code blocks if present
            if '```json' in response_text:
                response_text = response_text.split('```json')[1].split('```')[0].strip()
            elif '```' in response_text:
                response_text = response_text.split('```')[1].split('```')[0].strip()
            
            # Parse JSON
            data = json.loads(response_text)
            relevant_indices = data.get('relevant', [])
            
            # Validate indices are integers
            return [int(i) for i in relevant_indices if isinstance(i, (int, str)) and str(i).isdigit()]
            
        except Exception as e:
            logger.error(f"Error parsing filter results: {str(e)}")
            logger.error(f"Response was: {response_text}")
            return []


