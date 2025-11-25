import { BotService } from '../server/services/botService';

async function createSampleBots() {
  console.log('Creating sample bot accounts...');
  
  const botConfigs = [
    {
      username: 'political_analyst_bot',
      email: 'analyst@glasspolitics.ie',
      firstName: 'Political',
      lastName: 'Analyst',
      county: 'Dublin',
      bio: 'Analyzing political trends and sharing insights about Irish politics.',
      profileImageUrl: null
    },
    {
      username: 'debate_moderator_bot',
      email: 'moderator@glasspolitics.ie',
      firstName: 'Debate',
      lastName: 'Moderator',
      county: 'Cork',
      bio: 'Facilitating political discussions and encouraging thoughtful debate.',
      profileImageUrl: null
    },
    {
      username: 'news_curator_bot',
      email: 'news@glasspolitics.ie',
      firstName: 'News',
      lastName: 'Curator',
      county: 'Galway',
      bio: 'Sharing relevant political news and updates from across Ireland.',
      profileImageUrl: null
    },
    {
      username: 'poll_tracker_bot',
      email: 'polls@glasspolitics.ie',
      firstName: 'Poll',
      lastName: 'Tracker',
      county: 'Limerick',
      bio: 'Tracking and analyzing political polls and election predictions.',
      profileImageUrl: null
    }
  ];

  for (const config of botConfigs) {
    try {
      await BotService.createBotAccount(config);
      console.log(`✅ Created bot: ${config.username}`);
    } catch (error) {
      console.log(`❌ Failed to create bot ${config.username}:`, error.message);
    }
  }
}

async function main() {
  const command = process.argv[2];
  
  switch (command) {
    case 'create-sample':
      await createSampleBots();
      break;
    case 'list':
      const bots = await BotService.getAllBots();
      console.log('Bot accounts:', bots);
      break;
    default:
      console.log('Usage:');
      console.log('  npm run manage-bots create-sample  # Create sample bot accounts');
      console.log('  npm run manage-bots list          # List all bot accounts');
  }
}

main().catch(console.error);