# 🎨 AI Image Generation for Irish Political News

## Overview

Your news aggregator now uses **DALL-E 3** to generate custom images for every political article!

---

## ✅ What You Get

**Every article has a unique AI-generated image:**
- ✅ Perfectly relevant to the story
- ✅ Consistent Irish political theme (green/white/orange palette)
- ✅ Professional news-quality visuals
- ✅ No copyright issues (100% original)
- ✅ Controlled style and tone

---

## 🎨 How It Works

### Pipeline:
```
1. Article scraped & scored
   ↓
2. DALL-E generates custom image
   • Based on: title + summary + politician + story type
   • Style: Professional Irish news (Irish Times/RTE quality)
   • Theme: Adapts to story (controversy = dramatic, debate = Leinster House, etc.)
   ↓
3. Image saved to public/news-images/
   ↓
4. Used on homepage
```

---

## 💰 Cost

**DALL-E 3 (Current):**
- $0.04 per image
- 5 images/day = $0.20/day
- **$6/month** for images

**Total System Cost:**
- AI Filtering: $0.02/day
- AI Scoring: $0.08/day
- AI Images: $0.20/day
- **Total: $0.30/day = $9/month**

**To reduce costs**, change in `config_irish_politics.yaml`:
```yaml
image_generation:
  model: "dall-e-2"  # $0.02 instead of $0.04
```
This cuts image costs in half: $3/month instead of $6/month.

---

## 🎯 Image Styles by Story Type

### **Controversy/Scandal:**
- Dramatic lighting
- Dublin government buildings
- Serious tone
- Example: Mary Lou McDonald assault incident

### **Debate/Dáil:**
- Leinster House chamber
- Political debate setting
- Professional atmosphere
- Example: Presidential debate

### **Election/Voting:**
- Ballot boxes
- Irish democracy imagery
- Citizens participating
- Example: Election coverage

### **Policy:**
- Government buildings
- Official documents
- Policy implementation visuals
- Example: Simon Harris EU statement

---

## 📁 Where Images Are Stored

### During Aggregation:
```
news-aggregator/output/images/
├── article_0_1827.png
├── article_0_4371.png
├── article_0_5748.png
├── article_0_7318.png
└── article_0_8548.png
```

### After Deployment:
```
public/news-images/
├── article_0_1827.png (Mary Lou assault #2)
├── article_0_4371.png (Presidential debate)
├── article_0_5748.png (Mary Lou assault #1)
├── article_0_7318.png (TD office graffiti)
└── article_0_8548.png (Simon Harris EU)
```

### On Homepage:
```
<img src="/news-images/article_0_XXXX.png" />
```

---

## 🎛️ Customization

Edit `news-aggregator/config_irish_politics.yaml`:

### Change Image Quality:
```yaml
image_generation:
  quality: "hd"  # Better quality, costs 2x more
```

### Change Image Size:
```yaml
image_generation:
  size: "1792x1024"  # Wide format
  # or "1024x1792"  # Tall format
  # or "1024x1024"  # Square (current)
```

### Change Style:
```yaml
image_generation:
  style: "vivid"  # More dramatic/colorful
  # or "natural"  # Realistic (current)
```

### Disable AI Images:
```yaml
image_generation:
  enabled: false  # Fall back to scraped images
```

---

## 🔄 How Images Update

### Daily Automatic:
1. Aggregator runs at 6 AM
2. Generates 5 new images for top articles
3. Saves to `output/images/`
4. You manually copy to `public/news-images/`
5. Homepage updates

### Future (When DB Works):
1. Aggregator generates images
2. Uploads directly to Supabase Storage
3. Saves URLs to database
4. Homepage auto-updates
5. Zero manual work!

---

## 🎨 Image Prompt Template

```
Professional news illustration for Irish political media, 
modern clean design, subtle green/white/orange Irish color palette, 
photorealistic style, [CONTEXT FROM ARTICLE].
No text or words in the image. Professional Irish Times or RTE News 
visual style. Tasteful, informative, appropriate for serious political news.
```

Example for Mary Lou McDonald assault:
```
Professional news illustration, Irish political scene, serious dramatic lighting,
Dublin street canvassing scene, related to Mary Lou McDonald, 
context: assault incident during presidential election canvassing.
Professional Irish Times visual style. No text in image.
```

---

## ✨ Benefits Over Scraped Images

**Scraped Images:**
- ❌ Sometimes missing
- ❌ Inconsistent quality
- ❌ Random composition
- ❌ May not load (external URLs)
- ✅ Free

**AI-Generated Images:**
- ✅ Always present
- ✅ Consistent professional quality
- ✅ Perfectly relevant
- ✅ Controlled theme/style
- ✅ Hosted locally (fast)
- ❌ Costs $6/month

---

## 🚀 Current Status

**Enabled:** ✅ Yes  
**Model:** DALL-E 3  
**Quality:** Standard  
**Size:** 1024x1024 (square)  
**Images Generated:** 5  
**Location:** `public/news-images/`

---

## 📊 Latest Generated Images

Generated on: **October 25, 2025 at 11:42 AM**

1. **article_0_5748.png** - Mary Lou McDonald canvassing assault
2. **article_0_4371.png** - Presidential election debate  
3. **article_0_7318.png** - TD office vandalism
4. **article_0_8548.png** - Simon Harris EU Gaza statement
5. **article_0_1827.png** - Man arrested canvassing assault

All images are **professional, Irish-themed, and perfectly relevant to each article!** 🎉

---

**Your homepage now has beautiful, consistent, AI-generated images for every article!**


